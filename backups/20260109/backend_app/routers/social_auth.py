import os
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta

from app.database import get_db
from app.models import User
from app.schemas import Token, SocialLoginRequest
from app.core.security import create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter(prefix="/auth", tags=["Social Authentication"])

# 從環境變數讀取設定
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

LINE_CHANNEL_ID = os.getenv("LINE_CHANNEL_ID")
LINE_CHANNEL_SECRET = os.getenv("LINE_CHANNEL_SECRET")

FACEBOOK_APP_ID = os.getenv("FACEBOOK_APP_ID")
FACEBOOK_APP_SECRET = os.getenv("FACEBOOK_APP_SECRET")

# --- 共用函式：處理或建立 User ---
def get_or_create_social_user(db: Session, email: str, full_name: str, provider: str, social_id: str):
    # 1. 先用 Email 找 (防止重複註冊)
    user = db.query(User).filter(User.email == email).first()
    
    if user:
        # 如果用戶存在，可以考慮更新他的 provider 或 social_id (這邊先簡單處理)
        # 也可以在這裡更新 avatar_url
        return user
    
    # 2. 如果不存在，建立新用戶
    new_user = User(
        email=email,
        full_name=full_name,
        provider=provider,
        social_id=social_id,
        is_active=True,
        hashed_password=None # 第三方登入沒有密碼
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

# --- 1. Google Login ---
@router.post("/google", response_model=Token)
async def google_login(request: SocialLoginRequest, db: Session = Depends(get_db)):
    # 1. 用 Code 換 Token
    token_url = "https://oauth2.googleapis.com/token"
    data = {
        "code": request.code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": request.redirect_uri, # 必須與前端設定的一模一樣
        "grant_type": "authorization_code",
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(token_url, data=data)
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Invalid Google code")
        tokens = response.json()
        
        # 2. 用 Access Token 拿使用者資料
        user_info_response = await client.get(
            "https://www.googleapis.com/oauth2/v1/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"}
        )
        user_info = user_info_response.json()
    
    # 3. 處理資料庫邏輯
    email = user_info.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email")
        
    user = get_or_create_social_user(
        db, 
        email=email, 
        full_name=user_info.get("name"), 
        provider="google", 
        social_id=user_info.get("id")
    )
    
    # 4. 發放我們的 JWT
    access_token = create_access_token(data={"sub": user.email}, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": access_token, "token_type": "bearer"}

# --- 2. LINE Login ---
@router.post("/line", response_model=Token)
async def line_login(request: SocialLoginRequest, db: Session = Depends(get_db)):
    # 注意：LINE 需要在開發者後台申請「OpenID Connect」權限才有 Email
    token_url = "https://api.line.me/oauth2/v2.1/token"
    headers = {'Content-Type': 'application/x-www-form-urlencoded'}
    data = {
        'grant_type': 'authorization_code',
        'code': request.code,
        'redirect_uri': request.redirect_uri,
        'client_id': LINE_CHANNEL_ID,
        'client_secret': LINE_CHANNEL_SECRET
    }
    
    async with httpx.AsyncClient() as client:
        # 1. 換 Token
        response = await client.post(token_url, headers=headers, data=data)
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Invalid LINE code")
        tokens = response.json()
        
        # 2. 驗證 ID Token 並解析資料 (LINE 把個資包在 id_token 裡)
        # 這裡簡化處理，直接呼叫 /verify 驗證 id_token
        id_token = tokens.get('id_token')
        verify_url = "https://api.line.me/oauth2/v2.1/verify"
        verify_response = await client.post(verify_url, data={
            'id_token': id_token,
            'client_id': LINE_CHANNEL_ID
        })
        user_info = verify_response.json()

    # 3. DB 處理
    email = user_info.get("email")
    # 注意：如果 LINE 後台沒開 email 權限，這裡會是 None
    if not email:
        raise HTTPException(status_code=400, detail="Line account has no email permission")

    user = get_or_create_social_user(
        db,
        email=email,
        full_name=user_info.get("name"),
        provider="line",
        social_id=user_info.get("sub") # LINE 的 User ID 是 'sub'
    )
    
    access_token = create_access_token(data={"sub": user.email}, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": access_token, "token_type": "bearer"}

# --- 3. Facebook Login ---
@router.post("/facebook", response_model=Token)
async def facebook_login(request: SocialLoginRequest, db: Session = Depends(get_db)):
    token_url = "https://graph.facebook.com/v19.0/oauth/access_token"
    
    async with httpx.AsyncClient() as client:
        # 1. 換 Token
        params = {
            "client_id": FACEBOOK_APP_ID,
            "client_secret": FACEBOOK_APP_SECRET,
            "redirect_uri": request.redirect_uri,
            "code": request.code
        }
        response = await client.get(token_url, params=params)
        if response.status_code != 200:
             raise HTTPException(status_code=400, detail="Invalid Facebook code")
        data = response.json()
        access_token = data['access_token']
        
        # 2. 拿個資 (明確指定要 email 欄位)
        me_url = "https://graph.facebook.com/me"
        me_params = {
            "fields": "id,name,email,picture",
            "access_token": access_token
        }
        me_response = await client.get(me_url, params=me_params)
        user_info = me_response.json()
        
    # 3. DB 處理
    email = user_info.get("email")
    if not email:
        # FB 有時註冊是用手機號碼，可能沒 Email，這是常見雷點
        raise HTTPException(status_code=400, detail="Facebook account has no email")

    user = get_or_create_social_user(
        db,
        email=email,
        full_name=user_info.get("name"),
        provider="facebook",
        social_id=user_info.get("id")
    )

    access_token = create_access_token(data={"sub": user.email}, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": access_token, "token_type": "bearer"}