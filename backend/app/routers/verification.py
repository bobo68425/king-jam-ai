"""
身份認證 API
用戶提交身份認證、管理員審核
"""

import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, text
from datetime import datetime, timedelta
import hashlib

from app.database import get_db
from app.models import User, IdentityVerification
from app.routers.auth import get_current_user
from app.core.admin_security import require_super_admin, is_super_admin, require_secondary_password

router = APIRouter(prefix="/verification", tags=["身份認證"])

# 證件上傳目錄
IDENTITY_UPLOAD_DIR = "/app/static/uploads/identity"
if not os.path.exists("/app/static"):
    _base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    IDENTITY_UPLOAD_DIR = os.path.join(_base, "static", "uploads", "identity")
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
MAX_IDENTITY_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB


# ============================================================
# Schemas
# ============================================================

class IdentitySubmitRequest(BaseModel):
    """提交身份認證請求"""
    real_name: str = Field(..., min_length=2, max_length=50, description="真實姓名")
    id_number: str = Field(..., min_length=10, max_length=10, description="身份證字號")
    birth_date: Optional[str] = Field(None, description="出生日期 YYYY-MM-DD")
    id_front_image: str = Field(..., description="身份證正面照片 (Base64 或 URL)")
    id_back_image: str = Field(..., description="身份證反面照片 (Base64 或 URL)")
    selfie_image: str = Field(..., description="手持身份證自拍照 (Base64 或 URL)")


class IdentityReviewRequest(BaseModel):
    """審核身份認證請求"""
    action: str = Field(..., description="approve 或 reject")
    rejection_reason: Optional[str] = Field(None, description="駁回原因（顯示給用戶）")
    secondary_password: str = Field(..., description="二次驗證密碼")


# ============================================================
# 用戶端 API
# ============================================================

@router.get("/status")
async def get_verification_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取當前用戶的所有認證狀態（手機、身份、2FA）
    """
    from sqlalchemy import text
    
    # 1. 手機認證狀態
    phone_result = db.execute(text("""
        SELECT phone_number, is_verified, verified_at 
        FROM phone_verifications 
        WHERE user_id = :user_id
    """), {"user_id": current_user.id}).fetchone()
    
    phone_status = {
        "is_verified": phone_result.is_verified if phone_result else False,
        "phone_number": phone_result.phone_number if phone_result else None,
        "verified_at": phone_result.verified_at.isoformat() if phone_result and phone_result.verified_at else None,
    }
    
    # 2. 身份認證狀態
    identity_verification = db.query(IdentityVerification).filter(
        IdentityVerification.user_id == current_user.id
    ).first()
    
    identity_status = {
        "status": identity_verification.status if identity_verification else None,
        "is_verified": current_user.is_identity_verified,
        "real_name": identity_verification.real_name[:1] + "**" if identity_verification and identity_verification.real_name else None,
        "submitted_at": identity_verification.submitted_at.isoformat() if identity_verification and identity_verification.submitted_at else None,
        "reviewed_at": identity_verification.reviewed_at.isoformat() if identity_verification and identity_verification.reviewed_at else None,
        "verified_at": current_user.identity_verified_at.isoformat() if current_user.identity_verified_at else None,
        "rejection_reason": identity_verification.rejection_reason if identity_verification and identity_verification.status in ["rejected", "supplement_required"] else None,
    }
    
    # 3. 雙重認證狀態
    two_factor_result = db.execute(text("""
        SELECT is_totp_enabled, enabled_at 
        FROM two_factor_auth 
        WHERE user_id = :user_id
    """), {"user_id": current_user.id}).fetchone()
    
    two_factor_status = {
        "is_enabled": two_factor_result.is_totp_enabled if two_factor_result else False,
        "is_totp_enabled": two_factor_result.is_totp_enabled if two_factor_result else False,
        "enabled_at": two_factor_result.enabled_at.isoformat() if two_factor_result and two_factor_result.enabled_at else None,
    }
    
    return {
        "success": True,
        "phone": phone_status,
        "identity": identity_status,
        "two_factor": two_factor_status,
    }


# ============================================================
# 手機驗證 API（別名路由，供前端 /verification/phone/* 使用）
# ============================================================

class PhoneSendCodeRequest(BaseModel):
    """發送驗證碼請求"""
    phone_number: str = Field(..., description="手機號碼")


class PhoneVerifyRequest(BaseModel):
    """驗證碼驗證請求"""
    code: str = Field(..., min_length=6, max_length=6, description="6 位數驗證碼")


@router.post("/phone/send-code")
async def send_phone_verification_code(
    request: Request,
    data: PhoneSendCodeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    發送手機驗證碼（前端別名路由）
    """
    import os
    from app.services.sms_service import get_sms_service, get_otp_manager
    
    sms_service = get_sms_service()
    otp_manager = get_otp_manager()
    
    # 格式化手機號碼
    is_valid, formatted_phone = sms_service.validate_phone_number(data.phone_number)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=formatted_phone  # 錯誤訊息
        )
    
    # 將手機號碼存儲到 session 中供驗證使用
    # 使用資料庫記錄
    db.execute(text("""
        INSERT INTO phone_verifications (user_id, phone_number, is_verified, created_at, updated_at)
        VALUES (:user_id, :phone, false, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE SET 
            phone_number = :phone,
            is_verified = false,
            updated_at = NOW()
    """), {"user_id": current_user.id, "phone": formatted_phone})
    db.commit()
    
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"發送失敗：{result.error}"
        )
    
    # 存儲 OTP 供驗證使用
    await otp_manager.store_otp(formatted_phone, otp)
    
    # 開發環境返回驗證碼（方便測試）
    response_data = {
        "success": True,
        "message": "驗證碼已發送",
        "phone_masked": formatted_phone[:4] + "****" + formatted_phone[-2:] if len(formatted_phone) >= 10 else "****",
        "expires_in": 300,  # 5 分鐘
    }
    
    # 開發環境或控制台模式顯示驗證碼
    if os.getenv("ENVIRONMENT") != "production" or os.getenv("SMS_PROVIDER") == "console":
        response_data["dev_code"] = otp
    
    return response_data


@router.post("/phone/verify")
async def verify_phone_code(
    data: PhoneVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    驗證手機驗證碼（前端別名路由）
    """
    from app.services.sms_service import get_otp_manager
    
    otp_manager = get_otp_manager()
    
    # 從資料庫獲取用戶的待驗證手機號碼
    phone_record = db.execute(text("""
        SELECT phone_number, is_verified FROM phone_verifications 
        WHERE user_id = :user_id
    """), {"user_id": current_user.id}).fetchone()
    
    if not phone_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="請先發送驗證碼"
        )
    
    if phone_record.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="手機號碼已驗證"
        )
    
    phone_number = phone_record.phone_number
    
    # 驗證 OTP
    is_valid = await otp_manager.verify_otp(phone_number, data.code)
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="驗證碼錯誤或已過期"
        )
    
    # 更新驗證狀態（phone_verifications 為主記錄，credits/withdrawal 皆由此讀取）
    db.execute(text("""
        UPDATE phone_verifications 
        SET is_verified = true, verified_at = NOW(), updated_at = NOW()
        WHERE user_id = :user_id
    """), {"user_id": current_user.id})
    
    db.commit()
    
    return {
        "success": True,
        "message": "手機號碼驗證成功",
    }


# ============================================================
# 身份認證證件上傳（含浮水印）
# ============================================================

@router.post("/identity/upload-image")
async def upload_identity_image(
    file: UploadFile = File(...),
    image_type: str = Form("front"),  # front, back, selfie
    current_user: User = Depends(get_current_user)
):
    """
    上傳證件照，自動加上「僅供網站開通認證使用」浮水印
    """
    os.makedirs(IDENTITY_UPLOAD_DIR, exist_ok=True)
    
    content_type = file.content_type or ""
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"不支援的格式，請上傳 JPG、PNG 或 WebP"
        )
    
    ext = ".jpg" if "jpeg" in content_type or "jpg" in content_type else ".png"
    if "webp" in content_type:
        ext = ".webp"
    
    filename = f"{current_user.id}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(IDENTITY_UPLOAD_DIR, filename)
    
    chunk_size = 64 * 1024
    total_size = 0
    try:
        with open(file_path, "wb") as f:
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > MAX_IDENTITY_IMAGE_SIZE:
                    f.close()
                    os.remove(file_path)
                    raise HTTPException(
                        status_code=400,
                        detail="照片大小超過 5MB 限制"
                    )
                f.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"儲存失敗：{str(e)}")
    
    # 加上浮水印
    try:
        from app.services.identity_watermark import add_watermark
        add_watermark(file_path, file_path)
    except Exception as e:
        # 浮水印失敗仍保留原圖
        import logging
        logging.getLogger(__name__).warning(f"浮水印處理失敗，保留原圖: {e}")
    
    # 回傳 URL（與 /upload/media 格式一致，由 static 提供）
    image_url = f"/static/uploads/identity/{filename}"
    return {
        "success": True,
        "image_url": image_url,
        "url": image_url,
    }


# ============================================================
# 雙重驗證 (2FA / TOTP) API
# ============================================================

@router.post("/2fa/setup")
async def setup_2fa(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    發起 2FA 設定：產生 TOTP secret 與 provisioning URI（供 QR Code 掃描）
    """
    import pyotp

    # 產生新的 TOTP secret
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=current_user.email or str(current_user.id),
        issuer_name="King Jam AI",
    )

    # 寫入 two_factor_auth（尚未啟用，需驗證後才啟用）
    db.execute(text("""
        INSERT INTO two_factor_auth (user_id, totp_secret, is_totp_enabled, created_at, updated_at)
        VALUES (:user_id, :secret, false, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            totp_secret = :secret,
            is_totp_enabled = false,
            updated_at = NOW()
    """), {"user_id": current_user.id, "secret": secret})
    db.commit()

    return {
        "success": True,
        "secret": secret,
        "provisioning_uri": provisioning_uri,
    }


class TwoFactorVerifyRequest(BaseModel):
    """2FA 驗證並啟用請求"""
    code: str = Field(..., min_length=6, max_length=6, description="6 位數 TOTP 驗證碼")


@router.post("/2fa/verify")
async def verify_and_enable_2fa(
    data: TwoFactorVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    驗證 TOTP 驗證碼並啟用 2FA，回傳備用碼
    """
    import pyotp
    import secrets
    import json

    two_factor = db.execute(text("""
        SELECT totp_secret FROM two_factor_auth WHERE user_id = :user_id
    """), {"user_id": current_user.id}).fetchone()

    if not two_factor or not two_factor.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="請先執行 2FA 設定"
        )

    totp = pyotp.TOTP(two_factor.totp_secret)
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="驗證碼錯誤或已過期"
        )

    # 產生備用碼（每組 8 字元，共 8 組）
    backup_codes = [secrets.token_hex(4).upper() for _ in range(8)]

    # 啟用 2FA 並儲存備用碼
    db.execute(text("""
        UPDATE two_factor_auth 
        SET is_totp_enabled = true, enabled_at = NOW(), backup_codes = :backup_codes, updated_at = NOW()
        WHERE user_id = :user_id
    """), {"user_id": current_user.id, "backup_codes": json.dumps(backup_codes)})
    db.commit()

    return {
        "success": True,
        "message": "雙重驗證已啟用",
        "backup_codes": backup_codes,
    }


@router.post("/submit")
async def submit_verification(
    request: Request,
    data: IdentitySubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    提交身份認證
    """
    # 檢查是否已有認證記錄
    existing = db.query(IdentityVerification).filter(
        IdentityVerification.user_id == current_user.id
    ).first()
    
    if existing and existing.status not in ["rejected"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="您已提交過身份認證，無法重複提交"
        )
    
    # 驗證身份證字號格式
    if not _validate_tw_id_number(data.id_number):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="身份證字號格式不正確"
        )
    
    # 計算身份證號雜湊
    id_hash = hashlib.sha256(data.id_number.upper().encode()).hexdigest()
    
    # 檢查身份證號是否已被使用
    duplicate = db.query(IdentityVerification).filter(
        and_(
            IdentityVerification.id_number_hash == id_hash,
            IdentityVerification.user_id != current_user.id,
            IdentityVerification.status == "approved"
        )
    ).first()
    
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="此身份證號已被其他帳號認證使用"
        )
    
    # 如果已有被駁回的記錄，更新它
    if existing and existing.status == "rejected":
        existing.real_name = data.real_name
        existing.id_number = data.id_number.upper()
        existing.id_number_hash = id_hash
        existing.birth_date = datetime.strptime(data.birth_date, "%Y-%m-%d") if data.birth_date else None
        existing.id_front_image = data.id_front_image[:255] if len(data.id_front_image) > 255 else data.id_front_image
        existing.id_back_image = data.id_back_image[:255] if len(data.id_back_image) > 255 else data.id_back_image
        existing.selfie_image = data.selfie_image[:255] if len(data.selfie_image) > 255 else data.selfie_image
        existing.status = "pending"
        existing.rejection_reason = None
        existing.submitted_at = datetime.utcnow()
        existing.updated_at = datetime.utcnow()
        verification = existing
    else:
        # 創建新認證記錄
        verification = IdentityVerification(
            user_id=current_user.id,
            real_name=data.real_name,
            id_number=data.id_number.upper(),
            id_number_hash=id_hash,
            birth_date=datetime.strptime(data.birth_date, "%Y-%m-%d") if data.birth_date else None,
            id_front_image=data.id_front_image[:255] if len(data.id_front_image) > 255 else data.id_front_image,
            id_back_image=data.id_back_image[:255] if len(data.id_back_image) > 255 else data.id_back_image,
            selfie_image=data.selfie_image[:255] if len(data.selfie_image) > 255 else data.selfie_image,
            status="pending",
        )
        db.add(verification)
    
    db.commit()
    
    return {
        "success": True,
        "message": "身份認證已提交，請等待審核",
        "verification_id": verification.id,
        "status": "pending",
    }


# ============================================================
# 管理員 API
# ============================================================

@router.get("/admin/list")
async def list_verifications(
    status_filter: str = "pending",
    search: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取身份認證列表（管理員）
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理員權限"
        )
    
    query = db.query(IdentityVerification).join(
        User, IdentityVerification.user_id == User.id
    )
    
    # 狀態篩選
    if status_filter != "all":
        query = query.filter(IdentityVerification.status == status_filter)
    
    # 搜尋
    if search:
        query = query.filter(
            or_(
                User.email.ilike(f"%{search}%"),
                IdentityVerification.real_name.ilike(f"%{search}%"),
            )
        )
    
    total = query.count()
    
    verifications = query.order_by(
        IdentityVerification.created_at.asc()
    ).offset(offset).limit(limit).all()
    
    # 統計
    stats = {
        "pending": db.query(IdentityVerification).filter(IdentityVerification.status == "pending").count(),
        "reviewing": db.query(IdentityVerification).filter(IdentityVerification.status == "reviewing").count(),
        "approved": db.query(IdentityVerification).filter(IdentityVerification.status == "approved").count(),
        "rejected": db.query(IdentityVerification).filter(IdentityVerification.status == "rejected").count(),
    }
    
    return {
        "success": True,
        "total": total,
        "stats": stats,
        "verifications": [
            {
                "id": v.id,
                "user_id": v.user_id,
                "user_email": v.user.email if v.user else None,
                "real_name": v.real_name or "",
                "id_number_masked": _mask_id_number(v.id_number) if v.id_number else "****",
                "status": v.status,
                "risk_flags": [],
                "is_duplicate_id": False,
                "created_at": v.created_at.isoformat() if v.created_at else None,
                "reviewed_at": v.reviewed_at.isoformat() if v.reviewed_at else None,
            }
            for v in verifications
        ],
    }


@router.get("/admin/{verification_id}")
async def get_verification_admin(
    verification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取身份認證詳情（管理員）
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理員權限"
        )
    
    verification = db.query(IdentityVerification).filter(
        IdentityVerification.id == verification_id
    ).first()
    
    if not verification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="認證記錄不存在"
        )
    
    user = db.query(User).filter(User.id == verification.user_id).first()
    
    return {
        "success": True,
        "verification": {
            "id": verification.id,
            "user_id": verification.user_id,
            "user_email": user.email if user else None,
            "user_created_at": user.created_at.isoformat() if user and user.created_at else None,
            "real_name": verification.real_name or "",
            "id_number": verification.id_number or "",
            "birth_date": verification.birth_date.strftime("%Y-%m-%d") if verification.birth_date else None,
            "gender": None,
            "status": verification.status,
            "id_front_image": verification.id_front_image or "",
            "id_back_image": verification.id_back_image or "",
            "selfie_image": verification.selfie_image or "",
            "risk_flags": [],
            "is_duplicate_id": False,
            "duplicate_users": [],
            "auto_check_result": None,
            "auto_check_score": None,
            "review_note": None,
            "reject_reason": verification.rejection_reason,
            "reviewed_by": verification.reviewed_by,
            "reviewed_at": verification.reviewed_at.isoformat() if verification.reviewed_at else None,
            "created_at": verification.created_at.isoformat() if verification.created_at else None,
            "ip_address": None,
        },
        "logs": [],
    }


@router.post("/admin/{verification_id}/review")
async def review_verification(
    verification_id: int,
    request: Request,
    data: IdentityReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    審核身份認證（僅超級管理員）
    """
    require_super_admin(current_user)
    require_secondary_password(data.secondary_password)
    
    verification = db.query(IdentityVerification).filter(
        IdentityVerification.id == verification_id
    ).first()
    
    if not verification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="認證記錄不存在"
        )
    
    if verification.status not in ["pending", "reviewing"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"此認證狀態為 {verification.status}，無法審核"
        )
    
    if data.action not in ["approve", "reject"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="無效的審核動作"
        )
    
    if data.action == "approve":
        verification.status = "approved"
        verification.reviewed_by = current_user.id
        verification.reviewed_at = datetime.utcnow()
        verification.approved_at = datetime.utcnow()
        
        # 更新用戶認證狀態
        user = db.query(User).filter(User.id == verification.user_id).first()
        if user:
            user.is_identity_verified = True
            user.identity_verified_at = datetime.utcnow()
        
        message = "身份認證已通過"
    else:
        if not data.rejection_reason:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="請提供駁回原因"
            )
        
        verification.status = "rejected"
        verification.reviewed_by = current_user.id
        verification.reviewed_at = datetime.utcnow()
        verification.rejection_reason = data.rejection_reason
        
        message = "身份認證已駁回"
    
    db.commit()
    
    return {
        "success": True,
        "message": message,
        "status": verification.status,
    }


@router.post("/admin/{verification_id}/start-review")
async def start_review(
    verification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    開始審核（標記為審核中）
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理員權限"
        )
    
    verification = db.query(IdentityVerification).filter(
        IdentityVerification.id == verification_id
    ).first()
    
    if not verification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="認證記錄不存在"
        )
    
    if verification.status == "pending":
        verification.status = "reviewing"
        db.commit()
    
    return {
        "success": True,
        "message": "已開始審核",
        "status": verification.status,
    }


# ============================================================
# 輔助函數
# ============================================================

def _validate_tw_id_number(id_number: str) -> bool:
    """驗證台灣身份證字號格式"""
    if not id_number or len(id_number) != 10:
        return False
    
    id_number = id_number.upper()
    
    if not id_number[0].isalpha():
        return False
    
    if not id_number[1:].isdigit():
        return False
    
    if id_number[1] not in ['1', '2']:
        return False
    
    letter_map = {
        'A': 10, 'B': 11, 'C': 12, 'D': 13, 'E': 14, 'F': 15,
        'G': 16, 'H': 17, 'I': 34, 'J': 18, 'K': 19, 'L': 20,
        'M': 21, 'N': 22, 'O': 35, 'P': 23, 'Q': 24, 'R': 25,
        'S': 26, 'T': 27, 'U': 28, 'V': 29, 'W': 32, 'X': 30,
        'Y': 31, 'Z': 33
    }
    
    letter_num = letter_map.get(id_number[0], 0)
    if letter_num == 0:
        return False
    n1 = letter_num // 10
    n2 = letter_num % 10
    
    # 台灣身分證檢查碼公式：權重 n1,n2,d1~d9 = 1,9,8,7,6,5,4,3,2,1,1
    total = n1 * 1 + n2 * 9
    digit_weights = [8, 7, 6, 5, 4, 3, 2, 1, 1]
    for i, digit in enumerate(id_number[1:]):
        total += int(digit) * digit_weights[i]
    
    return total % 10 == 0


def _mask_id_number(id_number: str) -> str:
    """遮罩身份證號顯示"""
    if not id_number or len(id_number) < 10:
        return "****"
    return id_number[:5] + "****" + id_number[-1]
