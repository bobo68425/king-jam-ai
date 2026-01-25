"""
用戶帳號管理 API
變更密碼、變更 Email、頭像上傳、通知設定等
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from sqlalchemy.orm import Session
from datetime import datetime
import os
import uuid
import secrets

from app.database import get_db
from app.models import User
from app.routers.auth import get_current_user
from app.core.security import verify_password, get_password_hash

router = APIRouter(prefix="/users", tags=["帳號管理"])


# ============================================================
# Schemas
# ============================================================

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., description="目前密碼")
    new_password: str = Field(..., min_length=8, description="新密碼（至少 8 字元）")


class ChangeEmailRequest(BaseModel):
    new_email: EmailStr = Field(..., description="新電子郵件地址")


class ChangeEmailConfirmRequest(BaseModel):
    new_email: EmailStr = Field(..., description="新電子郵件地址")
    code: str = Field(..., description="驗證碼")


class NotificationSettings(BaseModel):
    email_marketing: bool = True
    email_updates: bool = True
    email_security: bool = True
    email_referral: bool = True


# 臨時存儲 email 變更驗證碼（實際應用應使用 Redis）
email_verification_codes = {}


# ============================================================
# 變更密碼
# ============================================================

@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    變更密碼
    
    需要驗證目前密碼
    """
    # 檢查用戶是否有密碼（社交登入用戶可能沒有）
    if not current_user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="您的帳號是透過社交登入建立，無法變更密碼"
        )
    
    # 驗證目前密碼
    if not verify_password(request.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="目前密碼不正確"
        )
    
    # 檢查新密碼是否與舊密碼相同
    if verify_password(request.new_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="新密碼不能與目前密碼相同"
        )
    
    # 更新密碼
    current_user.hashed_password = get_password_hash(request.new_password)
    current_user.updated_at = datetime.utcnow()
    db.commit()
    
    return {
        "success": True,
        "message": "密碼已變更成功"
    }


# ============================================================
# 變更 Email
# ============================================================

@router.post("/change-email/request")
async def request_email_change(
    request: ChangeEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    請求變更 Email - 發送驗證碼到新郵箱
    """
    new_email = request.new_email.lower()
    
    # 檢查新 email 是否與目前相同
    if new_email == current_user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="新電子郵件地址與目前相同"
        )
    
    # 檢查新 email 是否已被使用
    existing_user = db.query(User).filter(User.email == new_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="此電子郵件地址已被使用"
        )
    
    # 生成 6 位驗證碼
    code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
    
    # 儲存驗證碼（實際應用應使用 Redis，設定過期時間）
    email_verification_codes[current_user.id] = {
        "new_email": new_email,
        "code": code,
        "created_at": datetime.utcnow()
    }
    
    # TODO: 發送驗證郵件
    # await send_verification_email(new_email, code)
    
    # 開發模式：返回驗證碼
    is_dev = os.getenv("ENVIRONMENT", "development") == "development"
    
    return {
        "success": True,
        "message": f"驗證碼已發送至 {new_email}",
        "dev_code": code if is_dev else None  # 開發模式下返回驗證碼
    }


@router.post("/change-email/confirm")
async def confirm_email_change(
    request: ChangeEmailConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    確認變更 Email - 驗證驗證碼並變更
    """
    # 獲取儲存的驗證資訊
    verification = email_verification_codes.get(current_user.id)
    
    if not verification:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="請先請求發送驗證碼"
        )
    
    # 檢查驗證碼是否過期（10 分鐘）
    time_diff = (datetime.utcnow() - verification["created_at"]).total_seconds()
    if time_diff > 600:  # 10 分鐘
        del email_verification_codes[current_user.id]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="驗證碼已過期，請重新請求"
        )
    
    # 驗證碼是否正確
    if verification["code"] != request.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="驗證碼不正確"
        )
    
    # 驗證 email 是否一致
    if verification["new_email"].lower() != request.new_email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="電子郵件地址不符"
        )
    
    # 再次檢查 email 是否已被使用
    existing_user = db.query(User).filter(User.email == request.new_email.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="此電子郵件地址已被使用"
        )
    
    # 更新 email
    old_email = current_user.email
    current_user.email = request.new_email.lower()
    current_user.updated_at = datetime.utcnow()
    db.commit()
    
    # 清除驗證碼
    del email_verification_codes[current_user.id]
    
    return {
        "success": True,
        "message": "電子郵件地址已變更成功",
        "old_email": old_email,
        "new_email": current_user.email
    }


# ============================================================
# 頭像上傳
# ============================================================

UPLOAD_DIR = "/app/static/uploads/avatars"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    上傳用戶頭像
    
    支援格式：JPG, PNG, GIF, WebP
    大小限制：5MB
    """
    # 檢查檔案類型
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支援的圖片格式，請使用：{', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # 讀取檔案內容
    contents = await file.read()
    
    # 檢查檔案大小
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="圖片大小不能超過 5MB"
        )
    
    # 確保目錄存在
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    
    # 生成唯一檔名
    filename = f"avatar_{current_user.id}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    # 刪除舊頭像（如果存在）
    if current_user.avatar:
        old_path = f"/app{current_user.avatar}"
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except:
                pass
    
    # 儲存新頭像
    with open(filepath, "wb") as f:
        f.write(contents)
    
    # 更新用戶頭像路徑
    avatar_url = f"/static/uploads/avatars/{filename}"
    current_user.avatar = avatar_url
    current_user.updated_at = datetime.utcnow()
    db.commit()
    
    return {
        "success": True,
        "message": "頭像已更新",
        "avatar_url": avatar_url
    }


# ============================================================
# 通知設定
# ============================================================

@router.get("/notification-settings")
async def get_notification_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取通知設定
    """
    # 從用戶 extra_data 中獲取通知設定，或返回預設值
    settings = getattr(current_user, 'notification_settings', None)
    
    if not settings:
        settings = {
            "email_marketing": True,
            "email_updates": True,
            "email_security": True,
            "email_referral": True,
        }
    
    return settings


@router.put("/notification-settings")
async def update_notification_settings(
    settings: NotificationSettings,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    更新通知設定
    """
    # 更新通知設定
    current_user.notification_settings = settings.dict()
    current_user.updated_at = datetime.utcnow()
    db.commit()
    
    return {
        "success": True,
        "message": "通知設定已更新",
        "settings": settings.dict()
    }


# ============================================================
# 獲取個人資料
# ============================================================

@router.get("/me")
async def get_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取當前用戶的個人資料
    """
    return {
        "success": True,
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "avatar": current_user.avatar,
            "provider": current_user.provider,
            "tier": current_user.tier,
            "subscription_plan": current_user.subscription_plan,
            "partner_tier": current_user.partner_tier,
            "credits": current_user.credits,
            "credits_paid": current_user.credits_paid,
            "credits_bonus": current_user.credits_bonus,
            "credits_promo": current_user.credits_promo,
            "credits_sub": current_user.credits_sub,
            "referral_code": current_user.referral_code,
            "total_referrals": current_user.total_referrals,
            "is_admin": current_user.is_admin,
            "is_identity_verified": current_user.is_identity_verified,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        }
    }
