"""
社群平台 OAuth 授權回調 API
處理各平台的 OAuth 授權流程
"""

import os
import json
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


class OAuthStateStore:
    """
    OAuth state 儲存（Redis 優先，in-memory 備援）。
    Cloud Run 多實例環境下，in-memory dict 會導致 state 遺失，
    必須使用 Redis 作為共享儲存。
    """
    REDIS_KEY_PREFIX = "oauth_state:"
    STATE_TTL_SECONDS = 600  # 10 分鐘

    def __init__(self):
        self._redis = None
        self._fallback = {}  # 本地開發備援

    @property
    def redis_client(self):
        if self._redis is None:
            try:
                import redis
                redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
                self._redis = redis.from_url(redis_url, decode_responses=True)
                self._redis.ping()
                print("[OAuth] ✅ 使用 Redis 儲存 OAuth state")
            except Exception as e:
                print(f"[OAuth] ⚠️ Redis 不可用，使用 in-memory 備援: {e}")
                self._redis = None
        return self._redis

    def set(self, state: str, data: dict):
        """儲存 OAuth state"""
        # 序列化 datetime
        serializable = {
            k: (v.isoformat() if isinstance(v, datetime) else v)
            for k, v in data.items()
        }
        client = self.redis_client
        if client:
            try:
                client.setex(
                    f"{self.REDIS_KEY_PREFIX}{state}",
                    self.STATE_TTL_SECONDS,
                    json.dumps(serializable),
                )
                return
            except Exception as e:
                print(f"[OAuth] Redis set 失敗，使用 in-memory: {e}")
        self._fallback[state] = data

    def pop(self, state: str) -> Optional[dict]:
        """取出並刪除 OAuth state（一次性使用）"""
        client = self.redis_client
        if client:
            try:
                key = f"{self.REDIS_KEY_PREFIX}{state}"
                raw = client.get(key)
                if raw:
                    client.delete(key)
                    data = json.loads(raw)
                    # 還原 datetime
                    if "created_at" in data:
                        data["created_at"] = datetime.fromisoformat(data["created_at"])
                    return data
                # Redis 有連線但找不到 → 也嘗試 fallback
            except Exception as e:
                print(f"[OAuth] Redis pop 失敗，嘗試 in-memory: {e}")
        return self._fallback.pop(state, None)

    def __contains__(self, state: str) -> bool:
        client = self.redis_client
        if client:
            try:
                if client.exists(f"{self.REDIS_KEY_PREFIX}{state}"):
                    return True
            except Exception:
                pass
        return state in self._fallback

    def cleanup_expired(self):
        """清理 in-memory 備援中過期的 state（Redis 有 TTL 自動清理）"""
        cutoff = datetime.now() - timedelta(seconds=self.STATE_TTL_SECONDS)
        expired = [
            k for k, v in self._fallback.items()
            if isinstance(v.get("created_at"), datetime) and v["created_at"] < cutoff
        ]
        for k in expired:
            del self._fallback[k]


# 全域 OAuth state 儲存實例
oauth_states = OAuthStateStore()

# 前端回調頁面 URL（OAuth 完成後導向，預設為社群帳號頁）
FRONTEND_CALLBACK_URL = os.getenv("FRONTEND_URL", "http://localhost:3000") + "/dashboard/accounts"


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
    # 平台對應的必要環境變數（Meta 可fallback FACEBOOK_APP_ID/SECRET）
    def _check_meta_keys():
        meta_id = os.getenv("META_APP_ID") or os.getenv("FACEBOOK_APP_ID") or ""
        meta_sec = os.getenv("META_APP_SECRET") or os.getenv("FACEBOOK_APP_SECRET") or ""
        return not (not meta_id or not meta_sec or meta_id.startswith("your_") or meta_sec.startswith("your_"))

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
    if platform == "instagram":
        ig_id = os.getenv("INSTAGRAM_APP_ID") or ""
        ig_sec = os.getenv("INSTAGRAM_APP_SECRET") or ""
        if ig_id and ig_sec and not (ig_id.startswith("your_") or ig_sec.startswith("your_")):
            pass  # Instagram Login 模式，使用 INSTAGRAM_APP_ID/SECRET
        elif not _check_meta_keys():
            raise HTTPException(
                status_code=400,
                detail="Instagram 需設定 META_APP_ID/META_APP_SECRET（Facebook Login）或 INSTAGRAM_APP_ID/INSTAGRAM_APP_SECRET（Instagram Login）。"
            )
    elif platform == "facebook":
        if not _check_meta_keys():
            raise HTTPException(
                status_code=400,
                detail=f"{platform} 尚未設定 API 金鑰。請設定 FACEBOOK_APP_ID 與 FACEBOOK_APP_SECRET（或 META_APP_ID、META_APP_SECRET）"
            )
    elif platform == "threads":
        threads_id = os.getenv("THREADS_APP_ID") or ""
        threads_sec = os.getenv("THREADS_APP_SECRET") or ""
        if not threads_id or not threads_sec or threads_id.startswith("your_") or threads_sec.startswith("your_"):
            raise HTTPException(
                status_code=400,
                detail="Threads 必須設定 THREADS_APP_ID 與 THREADS_APP_SECRET（不可用 FACEBOOK_APP_ID）。請在 Meta 後台 Use cases → Access the Threads API → Settings 取得 Threads app ID 與 app secret，並在 GitHub Secrets 新增。詳見 docs/Threads_串接步驟.md"
            )
    else:
        env_keys = platform_env_keys[platform]
        missing_keys = []
        for key in env_keys:
            val = os.getenv(key, "")
            if not val or val.startswith("your_"):
                missing_keys.append(key)
        if missing_keys:
            raise HTTPException(
                status_code=400,
                detail=f"{platform} 尚未設定 API 金鑰。請設定: {', '.join(missing_keys)}"
            )
    
    # 生成防 CSRF 的 state
    state = secrets.token_urlsafe(32)
    oauth_states.set(state, {
        "user_id": current_user.id,
        "platform": platform,
        "created_at": datetime.now()
    })
    
    # 清理過期的 state (in-memory 備援；Redis 有 TTL 自動清理)
    oauth_states.cleanup_expired()
    
    # 根據平台獲取授權 URL
    try:
        if platform in ["instagram", "facebook", "threads"]:
            # Instagram：若用 Facebook Login 需 META_CONFIG_ID；若用 Instagram Login（INSTAGRAM_APP_ID）則不需
            if platform == "instagram":
                ig_login = bool(
                    os.getenv("INSTAGRAM_APP_ID")
                    and os.getenv("INSTAGRAM_APP_SECRET")
                    and not str(os.getenv("INSTAGRAM_APP_ID", "")).startswith("your_")
                )
                if not ig_login:
                    config_id = os.getenv("META_CONFIG_ID") or os.getenv("FACEBOOK_LOGIN_CONFIG_ID")
                    if not config_id:
                        raise HTTPException(
                            status_code=400,
                            detail="Instagram (Facebook Login) 需 META_CONFIG_ID。或改用 Instagram Login：設定 INSTAGRAM_APP_ID 與 INSTAGRAM_APP_SECRET。詳見 docs/IG_串接步驟.md"
                        )
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
        
        # 構建 extra_settings（儲存平台特定資料，如 Page Access Token、oauth_flow）
        extra_settings = {}
        if profile.extra_data:
            if "page_access_token" in profile.extra_data:
                extra_settings["page_access_token"] = profile.extra_data["page_access_token"]
            if "page_id" in profile.extra_data:
                extra_settings["page_id"] = profile.extra_data["page_id"]
            if "oauth_flow" in profile.extra_data:
                extra_settings["oauth_flow"] = profile.extra_data["oauth_flow"]
        
        print(f"[OAuth] Meta {platform} 連結成功: user_id={user_id}, platform_user_id={profile.platform_user_id}, username={profile.username}, has_page_token={bool(extra_settings.get('page_access_token'))}")
        
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
            # 合併 extra_settings（保留既有設定，更新新的）
            current_settings = existing.extra_settings or {}
            current_settings.update(extra_settings)
            existing.extra_settings = current_settings
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
                is_active=True,
                extra_settings=extra_settings
            )
            db.add(new_account)
        
        db.commit()
        
        return _success_redirect(platform, profile.username)
        
    except Exception as e:
        print(f"[OAuth] Meta {platform} 連結失敗: {str(e)}")
        return _error_redirect(f"連結失敗: {str(e)}")


@router.get("/meta/webhook")
async def meta_webhook_verify(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """
    Meta Webhook 驗證端點。Meta 首次設定時會發送 GET 請求，
    若 hub.verify_token 相符則回傳 hub.challenge 完成驗證。
    """
    verify_token = os.getenv("META_WEBHOOK_VERIFY_TOKEN", "kingjam_meta_verify")
    if hub_mode == "subscribe" and hub_verify_token == verify_token:
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(content=hub_challenge or "")
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/meta/webhook")
async def meta_webhook_events(request: Request):
    """Meta Webhook 事件（解除授權、資料刪除等）"""
    try:
        body = await request.json()
        # 依 object 與 entry 解析事件類型，轉發至 deauthorize/delete 邏輯
        print(f"[OAuth] Meta webhook event: {body}")
        # TODO: 解析並處理 deauthorize、delete 等事件
    except Exception:
        pass
    return {"success": True}


@router.post("/meta/deauthorize")
async def meta_deauthorize_callback(request: Request):
    """Meta/Threads 解除授權回調。用戶取消授權時 Meta 會 POST 此網址。"""
    try:
        body = await request.json()
        # 可在此處理：標記 SocialAccount 為已解除、清除 token 等
        # signed_request 含 user_id，需驗證簽章後解析
        print(f"[OAuth] Meta deauthorize callback: {body}")
    except Exception:
        pass
    return {"success": True}


@router.post("/meta/delete")
async def meta_data_deletion_callback(request: Request):
    """Meta/Threads 資料刪除請求回調。用戶要求刪除資料時 Meta 會 POST 此網址。"""
    try:
        body = await request.json()
        # 可在此處理：刪除該用戶的社群連結與相關資料
        print(f"[OAuth] Meta data deletion callback: {body}")
    except Exception:
        pass
    return {"success": True}


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
