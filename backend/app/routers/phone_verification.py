"""
手機驗證 API
提供 OTP 驗證碼發送與驗證功能
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field, validator
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
import re

from app.database import get_db
from app.models import User
from app.routers.auth import get_current_user
from app.services.sms_service import get_sms_service, get_otp_manager, OTP_EXPIRE_MINUTES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/phone", tags=["手機驗證"])


# ============================================================
# Schemas
# ============================================================

class SendOTPRequest(BaseModel):
    """發送 OTP 請求"""
    phone_number: str = Field(..., description="手機號碼 (支援 0912345678 或 +886912345678)")
    
    @validator('phone_number')
    def validate_phone(cls, v):
        # 移除空白和特殊字符
        v = re.sub(r'[\s\-\(\)]', '', v)
        
        # 基本長度檢查
        if len(v) < 9 or len(v) > 15:
            raise ValueError('手機號碼長度不正確')
        
        return v


class VerifyOTPRequest(BaseModel):
    """驗證 OTP 請求"""
    phone_number: str = Field(..., description="手機號碼")
    otp_code: str = Field(..., min_length=6, max_length=6, description="6 位數驗證碼")
    
    @validator('otp_code')
    def validate_otp(cls, v):
        if not v.isdigit():
            raise ValueError('驗證碼必須為數字')
        return v


# ============================================================
# API 端點
# ============================================================

@router.get("/status")
async def get_phone_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取手機驗證狀態
    """
    result = db.execute(text("""
        SELECT phone_number, is_verified, verified_at, created_at
        FROM phone_verifications 
        WHERE user_id = :user_id
    """), {"user_id": current_user.id}).fetchone()
    
    if result:
        # 遮罩手機號碼
        phone = result.phone_number
        if phone and len(phone) >= 10:
            masked = phone[:4] + "****" + phone[-2:]
        else:
            masked = "****"
        
        return {
            "success": True,
            "has_phone": True,
            "phone_number_masked": masked,
            "is_verified": result.is_verified,
            "verified_at": result.verified_at.isoformat() if result.verified_at else None,
        }
    
    return {
        "success": True,
        "has_phone": False,
        "phone_number_masked": None,
        "is_verified": False,
        "verified_at": None,
    }


@router.post("/send-otp")
async def send_otp(
    request: Request,
    data: SendOTPRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    發送 OTP 驗證碼到手機
    
    限制：
    - 每 60 秒只能發送一次
    - 每日最多發送 10 次
    """
    sms_service = get_sms_service()
    otp_manager = get_otp_manager()
    
    # 格式化手機號碼
    is_valid, formatted_phone = sms_service.validate_phone_number(data.phone_number)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=formatted_phone  # 這裡是錯誤訊息
        )
    
    # 檢查是否可重發
    can_resend, wait_seconds = await otp_manager.can_resend(formatted_phone)
    if not can_resend:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"請等待 {wait_seconds} 秒後再試"
        )
    
    # 檢查此手機號碼是否已被其他用戶驗證
    existing = db.execute(text("""
        SELECT user_id FROM phone_verifications 
        WHERE phone_number = :phone AND is_verified = true AND user_id != :user_id
    """), {"phone": formatted_phone, "user_id": current_user.id}).fetchone()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="此手機號碼已被其他帳號綁定"
        )
    
    # 發送 OTP
    result, otp = await sms_service.send_otp(formatted_phone)
    
    if not result.success:
        logger.error(f"[Phone] OTP 發送失敗: {result.error}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="驗證碼發送失敗，請稍後再試"
        )
    
    # 存儲 OTP
    await otp_manager.store_otp(formatted_phone, otp)
    
    # 記錄發送（用於每日限制等）
    logger.info(f"[Phone] OTP 已發送至 {formatted_phone[:4]}****{formatted_phone[-2:]}")
    
    return {
        "success": True,
        "message": f"驗證碼已發送至 {formatted_phone[:4]}****{formatted_phone[-2:]}",
        "expires_in": OTP_EXPIRE_MINUTES * 60,  # 秒
        "resend_cooldown": 60,  # 秒
    }


@router.post("/verify-otp")
async def verify_otp(
    data: VerifyOTPRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    驗證 OTP 並綁定手機
    """
    sms_service = get_sms_service()
    otp_manager = get_otp_manager()
    
    # 格式化手機號碼
    is_valid, formatted_phone = sms_service.validate_phone_number(data.phone_number)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=formatted_phone
        )
    
    # 驗證 OTP
    is_verified, message = await otp_manager.verify_otp(formatted_phone, data.otp_code)
    
    if not is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )
    
    # 驗證成功，更新或創建手機驗證記錄
    existing = db.execute(text("""
        SELECT id FROM phone_verifications WHERE user_id = :user_id
    """), {"user_id": current_user.id}).fetchone()
    
    now = datetime.utcnow()
    
    if existing:
        # 更新現有記錄
        db.execute(text("""
            UPDATE phone_verifications 
            SET phone_number = :phone, is_verified = true, verified_at = :verified_at, updated_at = :updated_at
            WHERE user_id = :user_id
        """), {
            "phone": formatted_phone,
            "verified_at": now,
            "updated_at": now,
            "user_id": current_user.id
        })
    else:
        # 創建新記錄
        db.execute(text("""
            INSERT INTO phone_verifications (user_id, phone_number, is_verified, verified_at, created_at, updated_at)
            VALUES (:user_id, :phone, true, :verified_at, :created_at, :updated_at)
        """), {
            "user_id": current_user.id,
            "phone": formatted_phone,
            "verified_at": now,
            "created_at": now,
            "updated_at": now
        })
    
    db.commit()
    
    # 清除 OTP
    await otp_manager.clear_otp(formatted_phone)
    
    # 發送通知
    try:
        from app.routers.notifications import create_security_notification
        create_security_notification(
            db=db,
            user_id=current_user.id,
            title="手機驗證成功",
            message=f"您的手機號碼 {formatted_phone[:4]}****{formatted_phone[-2:]} 已成功綁定。",
            data={"phone_masked": f"{formatted_phone[:4]}****{formatted_phone[-2:]}"},
            send_email=False
        )
    except Exception as e:
        logger.warning(f"[Phone] 發送通知失敗: {e}")
    
    logger.info(f"[Phone] 用戶 {current_user.id} 手機驗證成功: {formatted_phone[:4]}****")
    
    return {
        "success": True,
        "message": "手機驗證成功",
        "phone_number_masked": f"{formatted_phone[:4]}****{formatted_phone[-2:]}",
        "verified_at": now.isoformat(),
    }


@router.post("/unbind")
async def unbind_phone(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    解除手機綁定
    
    注意：如果用戶已開啟提領功能，解綁後需重新驗證
    """
    result = db.execute(text("""
        SELECT phone_number, is_verified FROM phone_verifications 
        WHERE user_id = :user_id
    """), {"user_id": current_user.id}).fetchone()
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="您尚未綁定手機"
        )
    
    # 刪除記錄
    db.execute(text("""
        DELETE FROM phone_verifications WHERE user_id = :user_id
    """), {"user_id": current_user.id})
    
    db.commit()
    
    logger.info(f"[Phone] 用戶 {current_user.id} 解除手機綁定")
    
    return {
        "success": True,
        "message": "手機綁定已解除",
    }


@router.post("/resend-otp")
async def resend_otp(
    data: SendOTPRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    重新發送 OTP（與 send-otp 相同，但語義更清楚）
    """
    return await send_otp(None, data, db, current_user)
