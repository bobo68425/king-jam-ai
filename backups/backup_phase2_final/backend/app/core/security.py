from datetime import datetime, timedelta
from typing import Optional
from jose import jwt
import bcrypt
import os
import hashlib

# 設定 JWT 密鑰 (真實環境應讀取環境變數)
SECRET_KEY = os.getenv("SECRET_KEY", "dev_secret_key_change_this")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# 處理 bcrypt 的 72 字節限制
# 使用前綴標記來區分是否需要預處理
PASSWORD_PREFIX = "kj_sha256_"

def _prepare_password(password: str) -> bytes:
    """將密碼轉換為適合 bcrypt 的格式（最多 72 字節）"""
    password_bytes = password.encode('utf-8')
    # 如果密碼超過 72 字節，先進行 SHA256 雜湊
    if len(password_bytes) > 72:
        # SHA256 產生 32 字節，轉為 hex 是 64 字節
        sha256_hash = hashlib.sha256(password_bytes).hexdigest()
        # 加上前綴標記（11 字節），總共 75 字節，但我們只取前 72 字節
        prefixed = (PASSWORD_PREFIX + sha256_hash).encode('utf-8')
        return prefixed[:72] if len(prefixed) > 72 else prefixed
    return password_bytes

# 1. 驗證密碼是否正確
def verify_password(plain_password, hashed_password):
    # 使用相同的處理方式
    prepared_password = _prepare_password(plain_password)
    # 確保 hashed_password 是 bytes
    if isinstance(hashed_password, str):
        hashed_password = hashed_password.encode('utf-8')
    return bcrypt.checkpw(prepared_password, hashed_password)

# 2. 將密碼加密 (雜湊)
def get_password_hash(password):
    # 處理長密碼問題
    prepared_password = _prepare_password(password)
    # 生成 salt 並雜湊密碼
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(prepared_password, salt)
    # 返回字符串格式（與 passlib 兼容）
    return hashed.decode('utf-8')

# 3. 產生 JWT Token
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt