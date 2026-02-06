from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional, Dict, Any
import random
import string
import logging

from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserResponse, Token
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def generate_customer_id(db: Session) -> str:
    """
    生成客戶編號
    格式：KJ + 年份(2位) + 月份(2位) + 序號(5位)
    例如：KJ2601-00001（2026年1月第1位客戶）
    """
    now = datetime.now()
    year_month = now.strftime("%y%m")  # 例如 2601
    prefix = f"KJ{year_month}"
    
    # 查詢該月份已有多少客戶
    like_pattern = f"{prefix}-%"
    count = db.query(User).filter(User.customer_id.like(like_pattern)).count()
    
    # 生成序號
    seq = str(count + 1).zfill(5)  # 00001, 00002, ...
    
    return f"{prefix}-{seq}"


def generate_referral_code() -> str:
    """
    生成推薦碼
    格式：8位英數混合
    """
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choice(chars) for _ in range(8))


# --- 1. 註冊 API ---
@router.post("/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    # 檢查 Email 是否已被註冊
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # 生成客戶編號
    customer_id = generate_customer_id(db)
    
    # 生成唯一推薦碼
    referral_code = generate_referral_code()
    while db.query(User).filter(User.referral_code == referral_code).first():
        referral_code = generate_referral_code()
    
    # 建立新用戶 (密碼加密)
    hashed_password = get_password_hash(user.password)
    new_user = User(
        customer_id=customer_id,
        email=user.email,
        hashed_password=hashed_password,
        full_name=user.full_name,
        provider="local",
        referral_code=referral_code,
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

# ============================================================
# 裝置指紋相關模型
# ============================================================

class LoginWithFingerprintRequest(BaseModel):
    """帶裝置指紋的登入請求"""
    email: str
    password: str
    fingerprint: Optional[str] = None
    fingerprint_data: Optional[Dict[str, Any]] = None


class LoginResponse(BaseModel):
    """登入回應"""
    access_token: str
    token_type: str
    risk_warning: Optional[str] = None


def get_client_ip(request: Request) -> str:
    """獲取客戶端真實 IP"""
    # 優先從 X-Forwarded-For 取得（用於反向代理）
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    
    # 其次嘗試 X-Real-IP
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    
    # 最後使用 client.host
    return request.client.host if request.client else "unknown"


# --- 2. 登入 API (回傳 JWT) ---
@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # 這裡 form_data.username 對應到 email
    user = db.query(User).filter(User.email == form_data.username).first()
    
    # 檢查用戶是否存在
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 檢查是否為社交登入用戶（無密碼）
    if not user.hashed_password:
        provider_name = {
            "google": "Google",
            "facebook": "Facebook", 
            "line": "LINE"
        }.get(user.provider, user.provider)
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "type": "social_login_required",
                "provider": user.provider,
                "message": f"此帳號是透過 {provider_name} 註冊，請使用 {provider_name} 登入"
            }
        )
    
    # 驗證密碼
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 產生 Token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


# --- 2b. 帶裝置指紋的登入 API ---
@router.post("/login-with-fingerprint", response_model=LoginResponse)
def login_with_fingerprint(
    request_data: LoginWithFingerprintRequest,
    request: Request,
    db: Session = Depends(get_db),
    user_agent: Optional[str] = Header(None),
):
    """
    帶裝置指紋的登入 API
    
    - 記錄 IP 和裝置指紋
    - 偵測可疑行為（同 IP/裝置的多帳號）
    - 如果偵測到風險，返回警告（但不阻止登入）
    """
    # 驗證帳號
    user = db.query(User).filter(User.email == request_data.email).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 檢查是否為社交登入用戶（無密碼）
    if not user.hashed_password:
        provider_name = {
            "google": "Google",
            "facebook": "Facebook", 
            "line": "LINE"
        }.get(user.provider, user.provider)
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "type": "social_login_required",
                "provider": user.provider,
                "message": f"此帳號是透過 {provider_name} 註冊，請使用 {provider_name} 登入"
            }
        )
    
    # 驗證密碼
    if not verify_password(request_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 獲取客戶端 IP
    client_ip = get_client_ip(request)
    
    # 執行詐騙偵測
    risk_warning = None
    try:
        from app.services.fraud_detection import get_fraud_detection_service
        
        fraud_service = get_fraud_detection_service(db)
        risk_result = fraud_service.record_login(
            user_id=user.id,
            ip_address=client_ip,
            fingerprint=request_data.fingerprint,
            fingerprint_data=request_data.fingerprint_data,
            user_agent=user_agent,
        )
        
        if risk_result["risk_detected"]:
            logger.warning(
                f"[Auth] ⚠️ 風險登入偵測 - 用戶: {user.email}, "
                f"IP: {client_ip}, 風險等級: {risk_result['risk_level']}"
            )
            
            # 僅記錄，不阻止登入
            if risk_result["risk_level"] in ["high", "blocked"]:
                risk_warning = "為確保您的帳號安全，我們偵測到一些異常活動，如有疑問請聯繫客服"
    
    except Exception as e:
        logger.error(f"[Auth] 詐騙偵測錯誤: {e}")
        # 詐騙偵測失敗不影響登入
    
    # 產生 Token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    # 發送登入安全通知
    try:
        from app.routers.notifications import create_security_notification
        from datetime import datetime
        
        # 嘗試獲取位置資訊
        location = "未知位置"
        try:
            from app.services.geo_service import get_location_by_ip
            location_info = get_location_by_ip(client_ip)
            if location_info:
                location = f"{location_info.get('city', '')} {location_info.get('country', '')}".strip() or "未知位置"
        except:
            pass
        
        create_security_notification(
            db=db,
            user_id=user.id,
            title="登入成功",
            message=f"您的帳號於 {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} (UTC) 從 {location} 登入。如非本人操作，請立即修改密碼。",
            data={
                "ip_address": client_ip,
                "location": location,
                "user_agent": user_agent[:100] if user_agent else None,
                "login_time": datetime.utcnow().isoformat(),
            },
            send_email=False  # 登入通知預設不發郵件，避免騷擾
        )
    except Exception as e:
        logger.warning(f"[Auth] 發送登入通知失敗: {e}")
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        risk_warning=risk_warning,
    )

from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from app.core.security import SECRET_KEY, ALGORITHM

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user


# Optional 版本 - 不強制要求登入
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme_optional), 
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    可選的用戶認證 - 如果有 token 則返回用戶，沒有則返回 None
    """
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            return None
    except JWTError:
        return None

    user = db.query(User).filter(User.email == email).first()
    return user


# --- 3. 取得當前登入用戶資訊 ---
@router.get("/me", response_model=UserResponse)
def read_me(current_user: User = Depends(get_current_user)):
    """
    回傳目前登入用戶的基本資料（含 credits）
    """
    return current_user


# ============================================================
# 忘記密碼 / 找回帳號 相關
# ============================================================

class ForgotPasswordRequest(BaseModel):
    """忘記密碼請求"""
    email: str


class FindAccountRequest(BaseModel):
    """找回帳號請求"""
    phone: Optional[str] = None
    full_name: Optional[str] = None


class FindAccountResponse(BaseModel):
    """找回帳號回應"""
    accounts: list[str]
    message: str


class ResetPasswordRequest(BaseModel):
    """重設密碼請求"""
    token: str
    new_password: str


# --- 4. 忘記密碼 API ---
@router.post("/forgot-password")
def forgot_password(
    request_data: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    忘記密碼 - 發送重設密碼郵件
    
    為了安全考量，無論帳號是否存在都回傳成功訊息
    """
    user = db.query(User).filter(User.email == request_data.email).first()
    
    if user:
        # 生成重設密碼 Token（有效期 24 小時）
        reset_token = create_access_token(
            data={"sub": user.email, "type": "password_reset"},
            expires_delta=timedelta(hours=24)
        )
        
        # 嘗試發送重設密碼郵件
        try:
            from app.services.email_service import get_email_service
            
            email_service = get_email_service()
            result = email_service.send_password_reset(
                to=user.email,
                reset_token=reset_token,
                user_name=user.full_name
            )
            
            if result.get("success"):
                logger.info(f"[Auth] 密碼重設郵件已發送: {user.email}")
            else:
                logger.error(f"[Auth] 發送密碼重設郵件失敗: {result.get('error')}")
        except Exception as e:
            logger.error(f"[Auth] 發送密碼重設郵件失敗: {e}")
            # 不向用戶透露郵件發送失敗
    
    # 無論成功與否都回傳相同訊息（安全考量）
    return {"message": "如果此帳號存在，重設密碼郵件已發送"}


# --- 5. 重設密碼 API ---
@router.post("/reset-password")
def reset_password(
    request_data: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    重設密碼 - 使用 Token 重設密碼
    """
    try:
        payload = jwt.decode(request_data.token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        token_type = payload.get("type")
        
        if not email or token_type != "password_reset":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無效的重設密碼連結"
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="重設密碼連結已過期或無效"
        )
    
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到此帳號"
        )
    
    # 驗證密碼長度
    if len(request_data.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="密碼長度至少需要 6 個字元"
        )
    
    # 更新密碼
    user.hashed_password = get_password_hash(request_data.new_password)
    db.commit()
    
    logger.info(f"[Auth] 密碼重設成功: {user.email}")
    
    return {"message": "密碼重設成功，請使用新密碼登入"}


# --- 6. 找回帳號 API ---
@router.post("/find-account", response_model=FindAccountResponse)
def find_account(
    request_data: FindAccountRequest,
    db: Session = Depends(get_db),
):
    """
    找回帳號 - 透過手機號碼或姓名查詢帳號
    
    回傳部分隱藏的 email 列表
    """
    if not request_data.phone and not request_data.full_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="請提供手機號碼或姓名"
        )
    
    query = db.query(User)
    
    if request_data.phone:
        # 透過手機號碼查詢
        query = query.filter(User.phone == request_data.phone)
    elif request_data.full_name:
        # 透過姓名查詢（精確匹配）
        query = query.filter(User.full_name == request_data.full_name)
    
    users = query.limit(5).all()  # 限制最多回傳 5 個帳號
    
    if not users:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到符合的帳號"
        )
    
    # 回傳完整 email（前端會自行遮罩）
    accounts = [user.email for user in users]
    
    return FindAccountResponse(
        accounts=accounts,
        message=f"找到 {len(accounts)} 個帳號"
    )


# 需要引入 os 模組
import os
