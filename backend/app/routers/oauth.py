"""
社群平台 OAuth 授權回調 API
處理各平台的 OAuth 授權流程
"""

import os
import secrets
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse, HTMLResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, SocialAccount
from app.routers.auth import get_current_user
from app.services.social_platforms import (
    MetaPlatform, TikTokPlatform, LinkedInPlatform, YouTubePlatform, LinePlatform
)

router = APIRouter(prefix="/oauth", tags=["OAuth"])

# 存儲 OAuth state (生產環境應使用 Redis)
oauth_states = {}

# 前端回調頁面 URL
FRONTEND_CALLBACK_URL = os.getenv("FRONTEND_URL", "http://localhost:3000") + "/dashboard/settings"


# ==================== 平台實例 ====================

def get_meta_platform(platform_type: str):
    """獲取 Meta 平台實例"""
    if platform_type == "instagram":
        return MetaPlatform(MetaPlatform.create_instagram_config())
    elif platform_type == "facebook":
        return MetaPlatform(MetaPlatform.create_facebook_config())
    elif platform_type == "threads":
        return MetaPlatform(MetaPlatform.create_threads_config())
    raise ValueError(f"Unknown Meta platform: {platform_type}")


# ==================== 授權發起端點 ====================

@router.get("/connect/{platform}")
async def initiate_oauth(
    platform: str,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    發起 OAuth 授權流程
    
    返回授權 URL，前端應導向此 URL
    """
    # 平台對應的必要環境變數
    platform_env_keys = {
        "instagram": ("META_APP_ID", "META_APP_SECRET"),
        "facebook": ("META_APP_ID", "META_APP_SECRET"),
        "threads": ("META_APP_ID", "META_APP_SECRET"),
        "tiktok": ("TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"),
        "linkedin": ("LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"),
        "youtube": ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"),
        "line": ("LINE_CHANNEL_ID", "LINE_CHANNEL_SECRET"),
    }
    
    # 檢查平台是否支援
    if platform not in platform_env_keys:
        raise HTTPException(status_code=400, detail=f"不支援的平台: {platform}")
    
    # 檢查 API 金鑰是否已設定
    env_keys = platform_env_keys[platform]
    missing_keys = []
    for key in env_keys:
        val = os.getenv(key, "")
        if not val or val.startswith("your_"):
            missing_keys.append(key)
    
    if missing_keys:
        raise HTTPException(
            status_code=400, 
            detail=f"{platform} 尚未設定 API 金鑰。請在 docker-compose.yml 中設定: {', '.join(missing_keys)}"
        )
    
    # 生成防 CSRF 的 state
    state = secrets.token_urlsafe(32)
    oauth_states[state] = {
        "user_id": current_user.id,
        "platform": platform,
        "created_at": datetime.now()
    }
    
    # 清理過期的 state (超過 10 分鐘)
    cutoff = datetime.now() - timedelta(minutes=10)
    expired_states = [k for k, v in oauth_states.items() if v["created_at"] < cutoff]
    for k in expired_states:
        del oauth_states[k]
    
    # 根據平台獲取授權 URL
    try:
        if platform in ["instagram", "facebook", "threads"]:
            platform_instance = get_meta_platform(platform)
        elif platform == "tiktok":
            platform_instance = TikTokPlatform()
        elif platform == "linkedin":
            platform_instance = LinkedInPlatform()
        elif platform == "youtube":
            platform_instance = YouTubePlatform()
        elif platform == "line":
            platform_instance = LinePlatform()
        else:
            raise HTTPException(status_code=400, detail=f"不支援的平台: {platform}")
        
        auth_url = platform_instance.get_auth_url(state)
        
        return {
            "auth_url": auth_url,
            "state": state,
            "platform": platform
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Meta (Instagram/Facebook/Threads) 回調 ====================

@router.get("/meta/callback")
async def meta_oauth_callback(
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None),
    error_description: str = Query(None),
    db: Session = Depends(get_db)
):
    """Meta OAuth 回調處理"""
    if error:
        return _error_redirect(f"授權失敗: {error_description or error}")
    
    if not state or state not in oauth_states:
        return _error_redirect("無效的授權請求")
    
    state_data = oauth_states.pop(state)
    user_id = state_data["user_id"]
    platform = state_data["platform"]
    
    try:
        platform_instance = get_meta_platform(platform)
        
        # 交換 token
        token = await platform_instance.exchange_code_for_token(code)
        
        # 獲取用戶資料
        profile = await platform_instance.get_user_profile(token.access_token)
        
        # 檢查是否已存在連結
        existing = db.query(SocialAccount).filter(
            SocialAccount.user_id == user_id,
            SocialAccount.platform == platform,
            SocialAccount.platform_user_id == profile.platform_user_id
        ).first()
        
        if existing:
            # 更新現有帳號
            existing.access_token = token.access_token
            existing.refresh_token = token.refresh_token
            existing.token_expires_at = token.expires_at
            existing.platform_username = profile.username
            existing.platform_avatar = profile.avatar_url
            existing.is_active = True
            existing.updated_at = datetime.utcnow()
        else:
            # 創建新帳號連結
            new_account = SocialAccount(
                user_id=user_id,
                platform=platform,
                platform_user_id=profile.platform_user_id,
                platform_username=profile.username,
                platform_avatar=profile.avatar_url,
                access_token=token.access_token,
                refresh_token=token.refresh_token,
                token_expires_at=token.expires_at,
                is_active=True
            )
            db.add(new_account)
        
        db.commit()
        
        return _success_redirect(platform, profile.username)
        
    except Exception as e:
        return _error_redirect(f"連結失敗: {str(e)}")


# ==================== TikTok 回調 ====================

@router.get("/tiktok/callback")
async def tiktok_oauth_callback(
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None),
    error_description: str = Query(None),
    db: Session = Depends(get_db)
):
    """TikTok OAuth 回調處理"""
    if error:
        return _error_redirect(f"授權失敗: {error_description or error}")
    
    if not state or state not in oauth_states:
        return _error_redirect("無效的授權請求")
    
    state_data = oauth_states.pop(state)
    user_id = state_data["user_id"]
    
    try:
        platform_instance = TikTokPlatform()
        
        token = await platform_instance.exchange_code_for_token(code)
        profile = await platform_instance.get_user_profile(token.access_token)
        
        existing = db.query(SocialAccount).filter(
            SocialAccount.user_id == user_id,
            SocialAccount.platform == "tiktok",
            SocialAccount.platform_user_id == profile.platform_user_id
        ).first()
        
        if existing:
            existing.access_token = token.access_token
            existing.refresh_token = token.refresh_token
            existing.token_expires_at = token.expires_at
            existing.platform_username = profile.username
            existing.platform_avatar = profile.avatar_url
            existing.is_active = True
            existing.updated_at = datetime.utcnow()
        else:
            new_account = SocialAccount(
                user_id=user_id,
                platform="tiktok",
                platform_user_id=profile.platform_user_id,
                platform_username=profile.username,
                platform_avatar=profile.avatar_url,
                access_token=token.access_token,
                refresh_token=token.refresh_token,
                token_expires_at=token.expires_at,
                is_active=True
            )
            db.add(new_account)
        
        db.commit()
        
        return _success_redirect("tiktok", profile.username)
        
    except Exception as e:
        return _error_redirect(f"連結失敗: {str(e)}")


# ==================== LinkedIn 回調 ====================

@router.get("/linkedin/callback")
async def linkedin_oauth_callback(
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None),
    error_description: str = Query(None),
    db: Session = Depends(get_db)
):
    """LinkedIn OAuth 回調處理"""
    if error:
        return _error_redirect(f"授權失敗: {error_description or error}")
    
    if not state or state not in oauth_states:
        return _error_redirect("無效的授權請求")
    
    state_data = oauth_states.pop(state)
    user_id = state_data["user_id"]
    
    try:
        platform_instance = LinkedInPlatform()
        
        token = await platform_instance.exchange_code_for_token(code)
        profile = await platform_instance.get_user_profile(token.access_token)
        
        existing = db.query(SocialAccount).filter(
            SocialAccount.user_id == user_id,
            SocialAccount.platform == "linkedin",
            SocialAccount.platform_user_id == profile.platform_user_id
        ).first()
        
        if existing:
            existing.access_token = token.access_token
            existing.refresh_token = token.refresh_token
            existing.token_expires_at = token.expires_at
            existing.platform_username = profile.username
            existing.platform_avatar = profile.avatar_url
            existing.is_active = True
            existing.updated_at = datetime.utcnow()
        else:
            new_account = SocialAccount(
                user_id=user_id,
                platform="linkedin",
                platform_user_id=profile.platform_user_id,
                platform_username=profile.username,
                platform_avatar=profile.avatar_url,
                access_token=token.access_token,
                refresh_token=token.refresh_token,
                token_expires_at=token.expires_at,
                is_active=True
            )
            db.add(new_account)
        
        db.commit()
        
        return _success_redirect("linkedin", profile.display_name)
        
    except Exception as e:
        return _error_redirect(f"連結失敗: {str(e)}")


# ==================== YouTube 回調 ====================

@router.get("/youtube/callback")
async def youtube_oauth_callback(
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None),
    db: Session = Depends(get_db)
):
    """YouTube OAuth 回調處理"""
    if error:
        return _error_redirect(f"授權失敗: {error}")
    
    if not state or state not in oauth_states:
        return _error_redirect("無效的授權請求")
    
    state_data = oauth_states.pop(state)
    user_id = state_data["user_id"]
    
    try:
        platform_instance = YouTubePlatform()
        
        token = await platform_instance.exchange_code_for_token(code)
        profile = await platform_instance.get_user_profile(token.access_token)
        
        existing = db.query(SocialAccount).filter(
            SocialAccount.user_id == user_id,
            SocialAccount.platform == "youtube",
            SocialAccount.platform_user_id == profile.platform_user_id
        ).first()
        
        if existing:
            existing.access_token = token.access_token
            existing.refresh_token = token.refresh_token
            existing.token_expires_at = token.expires_at
            existing.platform_username = profile.username
            existing.platform_avatar = profile.avatar_url
            existing.is_active = True
            existing.updated_at = datetime.utcnow()
        else:
            new_account = SocialAccount(
                user_id=user_id,
                platform="youtube",
                platform_user_id=profile.platform_user_id,
                platform_username=profile.username,
                platform_avatar=profile.avatar_url,
                access_token=token.access_token,
                refresh_token=token.refresh_token,
                token_expires_at=token.expires_at,
                is_active=True
            )
            db.add(new_account)
        
        db.commit()
        
        return _success_redirect("youtube", profile.display_name)
        
    except Exception as e:
        return _error_redirect(f"連結失敗: {str(e)}")


# ==================== LINE 回調 ====================

@router.get("/line/callback")
async def line_oauth_callback(
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None),
    error_description: str = Query(None),
    db: Session = Depends(get_db)
):
    """LINE OAuth 回調處理"""
    if error:
        return _error_redirect(f"授權失敗: {error_description or error}")
    
    if not state or state not in oauth_states:
        return _error_redirect("無效的授權請求")
    
    state_data = oauth_states.pop(state)
    user_id = state_data["user_id"]
    
    try:
        platform_instance = LinePlatform()
        
        token = await platform_instance.exchange_code_for_token(code)
        profile = await platform_instance.get_user_profile(token.access_token)
        
        existing = db.query(SocialAccount).filter(
            SocialAccount.user_id == user_id,
            SocialAccount.platform == "line",
            SocialAccount.platform_user_id == profile.platform_user_id
        ).first()
        
        if existing:
            existing.access_token = token.access_token
            existing.refresh_token = token.refresh_token
            existing.token_expires_at = token.expires_at
            existing.platform_username = profile.username
            existing.platform_avatar = profile.avatar_url
            existing.is_active = True
            existing.updated_at = datetime.utcnow()
        else:
            new_account = SocialAccount(
                user_id=user_id,
                platform="line",
                platform_user_id=profile.platform_user_id,
                platform_username=profile.username,
                platform_avatar=profile.avatar_url,
                access_token=token.access_token,
                refresh_token=token.refresh_token,
                token_expires_at=token.expires_at,
                is_active=True
            )
            db.add(new_account)
        
        db.commit()
        
        return _success_redirect("line", profile.display_name)
        
    except Exception as e:
        return _error_redirect(f"連結失敗: {str(e)}")


# ==================== 輔助函數 ====================

def _success_redirect(platform: str, username: str):
    """成功後重定向到前端"""
    return RedirectResponse(
        url=f"{FRONTEND_CALLBACK_URL}?oauth=success&platform={platform}&username={username}",
        status_code=302
    )


def _error_redirect(message: str):
    """錯誤後重定向到前端"""
    from urllib.parse import quote
    return RedirectResponse(
        url=f"{FRONTEND_CALLBACK_URL}?oauth=error&message={quote(message)}",
        status_code=302
    )


# ==================== 狀態查詢 ====================

@router.get("/status/{platform}")
async def check_connection_status(
    platform: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """查詢平台連結狀態"""
    account = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.platform == platform,
        SocialAccount.is_active == True
    ).first()
    
    if not account:
        return {"connected": False}
    
    # 檢查 token 是否過期
    is_expired = account.token_expires_at and account.token_expires_at < datetime.utcnow()
    
    return {
        "connected": True,
        "username": account.platform_username,
        "avatar": account.platform_avatar,
        "is_expired": is_expired,
        "expires_at": account.token_expires_at.isoformat() if account.token_expires_at else None
    }


# ==================== Google OAuth (GA4) ====================

@router.get("/google/callback")
async def google_oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db)
):
    """
    處理 Google OAuth 回調 (用於 GA4 連結)
    """
    from app.services.ga4_service import ga4_service
    
    try:
        # 解析 state 獲取 user_id
        parts = state.split("_")
        if len(parts) < 2:
            return _error_redirect("Invalid state parameter")
        
        user_id = int(parts[0])
        
        # 驗證用戶存在
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return _error_redirect("User not found")
        
        # 交換 token
        tokens = await ga4_service.exchange_code_for_token(code)
        
        # 儲存或更新 GA4 帳號
        existing = db.query(SocialAccount).filter(
            SocialAccount.user_id == user_id,
            SocialAccount.platform == "ga4"
        ).first()
        
        if existing:
            existing.access_token = tokens["access_token"]
            existing.refresh_token = tokens.get("refresh_token") or existing.refresh_token
            existing.token_expires_at = datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 3600))
            existing.is_active = True
        else:
            ga4_account = SocialAccount(
                user_id=user_id,
                platform="ga4",
                platform_username="Google Analytics",
                access_token=tokens["access_token"],
                refresh_token=tokens.get("refresh_token"),
                token_expires_at=datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 3600)),
                is_active=True
            )
            db.add(ga4_account)
        
        db.commit()
        
        # 重定向到前端成功頁面
        return RedirectResponse(
            url=f"{FRONTEND_CALLBACK_URL}?oauth=success&platform=ga4",
            status_code=302
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return _error_redirect(f"Google OAuth failed: {str(e)}")
