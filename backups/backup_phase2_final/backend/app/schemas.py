from pydantic import BaseModel, EmailStr
from typing import Optional

# 1. 用戶註冊時需要的資料
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None

# 2. 回傳給前端的用戶資料 (不包含密碼!)
class UserResponse(BaseModel):
    id: int
    customer_id: Optional[str] = None  # 客戶編號
    email: EmailStr
    full_name: Optional[str] = None
    tier: str
    credits: int
    is_active: bool
    referral_code: Optional[str] = None  # 推薦碼

    class Config:
        from_attributes = True # 讓 Pydantic 能讀取 ORM 模型

# 3. 登入成功後回傳的 Token 格式
class Token(BaseModel):
    access_token: str
    token_type: str

# --- Social Auth Schemas ---

class SocialLoginRequest(BaseModel):
    code: str # 前端從 Google/Line/FB 拿到的授權碼
    redirect_uri: Optional[str] = None # 有些 Provider (如 Google) 交換 token 時需要驗證此欄位