from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime, timedelta
import random
import string

from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserResponse, Token
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)

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

# --- 2. 登入 API (回傳 JWT) ---
@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # 這裡 form_data.username 對應到 email
    user = db.query(User).filter(User.email == form_data.username).first()
    
    # 驗證帳號與密碼
    if not user or not verify_password(form_data.password, user.hashed_password):
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


# --- 3. 取得當前登入用戶資訊 ---
@router.get("/me", response_model=UserResponse)
def read_me(current_user: User = Depends(get_current_user)):
    """
    回傳目前登入用戶的基本資料（含 credits）
    """
    return current_user
