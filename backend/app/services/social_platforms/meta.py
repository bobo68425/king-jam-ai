"""
Meta 平台整合 (Instagram, Facebook, Threads)
使用 Meta Graph API
"""

import os
import aiohttp
from urllib.parse import urlencode
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

from .base import (
    BasePlatform, PlatformConfig, AuthToken, UserProfile,
    PublishContent, PublishResult, ContentType
)


class MetaPlatform(BasePlatform):
    """
    Meta 平台整合 (Instagram / Facebook / Threads)
    
    Instagram Business API 需求:
    - Facebook Page 連結到 Instagram Business/Creator 帳號
    - 需要以下權限: instagram_basic, instagram_content_publish, pages_read_engagement
    
    Facebook API 需求:
    - 需要 pages_manage_posts 權限
    
    Threads API 需求:
    - 需要 threads_basic, threads_content_publish 權限
    """
    
    GRAPH_API_VERSION = "v18.0"
    GRAPH_API_BASE = f"https://graph.facebook.com/{GRAPH_API_VERSION}"
    
    @classmethod
    def _get_meta_credentials(cls) -> tuple:
        """取得 Meta 憑證（優先 META_*，次之 FACEBOOK_*）"""
        app_id = os.getenv("META_APP_ID") or os.getenv("FACEBOOK_APP_ID") or ""
        app_secret = os.getenv("META_APP_SECRET") or os.getenv("FACEBOOK_APP_SECRET") or ""
        return app_id, app_secret

    @classmethod
    def _get_threads_credentials(cls) -> tuple:
        """取得 Threads 專用憑證。Threads API 必須使用 Threads use case 的 App ID/Secret，不可用 FB/IG 的。"""
        app_id = os.getenv("THREADS_APP_ID") or ""
        app_secret = os.getenv("THREADS_APP_SECRET") or ""
        return app_id, app_secret

    @classmethod
    def _get_instagram_login_credentials(cls) -> tuple:
        """取得 Instagram API with Instagram Login 專用憑證。見 https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login"""
        app_id = os.getenv("INSTAGRAM_APP_ID") or ""
        app_secret = os.getenv("INSTAGRAM_APP_SECRET") or ""
        return app_id, app_secret

    @classmethod
    def create_instagram_config(cls, account=None) -> PlatformConfig:
        """
        創建 Instagram 配置。
        - 若 account 有 extra_settings.oauth_flow == "instagram_login"，使用 Instagram Login 配置
        - 若 account 無 oauth_flow 或為 Facebook Login，使用 Facebook Login 配置
        - 若無 account，依 env：INSTAGRAM_APP_ID/SECRET 優先，否則 Facebook Login
        """
        use_instagram_login = False
        if account and getattr(account, "extra_settings", None):
            extra = account.extra_settings or {}
            use_instagram_login = extra.get("oauth_flow") == "instagram_login"
        elif not account:
            ig_id, ig_sec = cls._get_instagram_login_credentials()
            use_instagram_login = bool(ig_id and ig_sec)
        if use_instagram_login:
            ig_app_id, ig_app_secret = cls._get_instagram_login_credentials()
            if ig_app_id and ig_app_secret:
                return cls._create_instagram_login_config(ig_app_id, ig_app_secret)
        return cls._create_instagram_facebook_login_config()

    @classmethod
    def _create_instagram_login_config(cls, app_id: str, app_secret: str) -> PlatformConfig:
        """Instagram API with Instagram Login：用戶用 IG 帳號登入，不需 Facebook 粉專。"""
        backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
        redirect_uri = os.getenv("META_REDIRECT_URI") or os.getenv("INSTAGRAM_REDIRECT_URI") or f"{backend_url.rstrip('/')}/oauth/meta/callback"
        return PlatformConfig(
            platform_id="instagram",
            name="Instagram",
            client_id=app_id,
            client_secret=app_secret,
            redirect_uri=redirect_uri,
            scopes=[
                "instagram_business_basic",
                "instagram_business_content_publish",
                "instagram_business_manage_comments",
                "instagram_business_manage_messages",
            ],
            auth_url="https://www.instagram.com/oauth/authorize",
            token_url="https://api.instagram.com/oauth/access_token",
            api_base_url=f"https://graph.instagram.com/{cls.GRAPH_API_VERSION}",
            supported_content_types=[
                ContentType.IMAGE,
                ContentType.VIDEO,
                ContentType.CAROUSEL,
                ContentType.REEL,
                ContentType.STORY,
            ],
            max_video_duration=90,
            max_caption_length=2200,
            oauth_flow_type="instagram_login",
        )

    @classmethod
    def _create_instagram_facebook_login_config(cls) -> PlatformConfig:
        """Instagram API with Facebook Login：需粉專連結 IG、META_CONFIG_ID。"""
        app_id, app_secret = cls._get_meta_credentials()
        backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
        redirect_uri = os.getenv("META_REDIRECT_URI") or f"{backend_url.rstrip('/')}/oauth/meta/callback"
        return PlatformConfig(
            platform_id="instagram",
            name="Instagram",
            client_id=app_id,
            client_secret=app_secret,
            redirect_uri=redirect_uri,
            scopes=[
                "pages_read_user_content",
                "pages_show_list",
                "pages_read_engagement",
                "instagram_basic",
                "instagram_content_publish",
                "instagram_manage_insights",
                "business_management",
            ],
            auth_url="https://www.facebook.com/v18.0/dialog/oauth",
            token_url=f"https://graph.facebook.com/{cls.GRAPH_API_VERSION}/oauth/access_token",
            api_base_url=f"https://graph.facebook.com/{cls.GRAPH_API_VERSION}",
            supported_content_types=[
                ContentType.IMAGE,
                ContentType.VIDEO,
                ContentType.CAROUSEL,
                ContentType.REEL,
                ContentType.STORY,
            ],
            max_video_duration=90,
            max_caption_length=2200,
        )
    
    @classmethod
    def create_facebook_config(cls) -> PlatformConfig:
        """創建 Facebook 配置"""
        app_id, app_secret = cls._get_meta_credentials()
        backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
        redirect_uri = os.getenv("META_REDIRECT_URI") or f"{backend_url.rstrip('/')}/oauth/meta/callback"
        return PlatformConfig(
            platform_id="facebook",
            name="Facebook",
            client_id=app_id,
            client_secret=app_secret,
            redirect_uri=redirect_uri,
            scopes=[
                "pages_show_list",
                "pages_read_engagement",
                "pages_manage_posts",
                "pages_manage_engagement"
            ],
            auth_url="https://www.facebook.com/v18.0/dialog/oauth",
            token_url=f"https://graph.facebook.com/{cls.GRAPH_API_VERSION}/oauth/access_token",
            api_base_url=f"https://graph.facebook.com/{cls.GRAPH_API_VERSION}",
            supported_content_types=[
                ContentType.IMAGE, 
                ContentType.VIDEO, 
                ContentType.TEXT,
                ContentType.CAROUSEL
            ],
            max_video_duration=240 * 60,  # 4 小時
            max_caption_length=63206
        )
    
    @classmethod
    def create_threads_config(cls) -> PlatformConfig:
        """創建 Threads 配置。需使用 Threads use case 的 App ID/Secret（見 Meta 後台 Settings）"""
        app_id, app_secret = cls._get_threads_credentials()
        backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
        redirect_uri = os.getenv("META_REDIRECT_URI") or f"{backend_url.rstrip('/')}/oauth/meta/callback"
        return PlatformConfig(
            platform_id="threads",
            name="Threads",
            client_id=app_id,
            client_secret=app_secret,
            redirect_uri=redirect_uri,
            scopes=[
                "threads_basic",
                "threads_content_publish",
                "threads_manage_insights",
                "threads_manage_replies"
            ],
            auth_url="https://threads.net/oauth/authorize",
            token_url="https://graph.threads.net/oauth/access_token",
            api_base_url="https://graph.threads.net/v1.0",
            supported_content_types=[
                ContentType.IMAGE, 
                ContentType.VIDEO, 
                ContentType.TEXT,
                ContentType.CAROUSEL
            ],
            max_video_duration=300,  # 5 分鐘
            max_caption_length=500
        )
    
    def __init__(self, config: PlatformConfig):
        super().__init__(config)
        self._ig_user_id = None  # Instagram Business Account ID
        self._page_id = None  # Facebook Page ID
        self._threads_user_id = None  # Threads User ID
    
    # ==================== OAuth 授權流程 ====================
    
    def get_auth_url(self, state: str) -> str:
        """生成 Meta OAuth 授權 URL
        
        - Instagram Login：使用 scope，不需 META_CONFIG_ID
        - Instagram (Facebook Login)：需 META_CONFIG_ID
        - Facebook：直接使用 scope（不可用 config_id，因其含 IG 專用 scope）
        - Threads：使用 scope
        """
        params = {
            "client_id": self.config.client_id,
            "redirect_uri": self.config.redirect_uri,
            "response_type": "code",
            "state": state,
        }
        if getattr(self.config, "oauth_flow_type", "meta") == "instagram_login":
            params["scope"] = ",".join(self.config.scopes)
        elif self.config.platform_id == "instagram":
            config_id = (os.getenv("META_CONFIG_ID") or os.getenv("FACEBOOK_LOGIN_CONFIG_ID") or "").strip()
            if not config_id:
                raise ValueError(
                    "Instagram (Facebook Login) 需設定 META_CONFIG_ID。"
                    "或改用 Instagram Login：設定 INSTAGRAM_APP_ID 與 INSTAGRAM_APP_SECRET。"
                )
            params["config_id"] = config_id
        else:
            # Facebook、Threads 等：直接使用 scope 參數
            params["scope"] = ",".join(self.config.scopes)
        return f"{self.config.auth_url}?{urlencode(params)}"
    
    async def exchange_code_for_token(self, code: str) -> AuthToken:
        """用授權碼交換 Access Token"""
        if getattr(self.config, "oauth_flow_type", "meta") == "instagram_login":
            return await self._exchange_instagram_login_code(code)
        if self.config.platform_id == "threads":
            return await self._exchange_threads_code(code)
        
        params = {
            "client_id": self.config.client_id,
            "client_secret": self.config.client_secret,
            "redirect_uri": self.config.redirect_uri,
            "code": code,
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(self.config.token_url, params=params) as response:
                data = await response.json()
                
                if "error" in data:
                    raise Exception(f"Token exchange failed: {data['error']['message']}")
                
                short_token = data["access_token"]
                if self.config.platform_id == "threads":
                    long_lived_token = await self._get_threads_long_lived_token(short_token)
                else:
                    long_lived_token = await self._get_long_lived_token(short_token)
                
                return AuthToken(
                    access_token=long_lived_token["access_token"],
                    expires_at=datetime.now() + timedelta(seconds=long_lived_token.get("expires_in", 5184000)),
                    token_type="Bearer",
                )
    
    async def _exchange_threads_code(self, code: str) -> AuthToken:
        """Threads：POST 換短期 token，再換長期 token。Threads API 必須用 POST。"""
        import logging
        logger = logging.getLogger(__name__)
        
        form_data = aiohttp.FormData()
        form_data.add_field("client_id", self.config.client_id)
        form_data.add_field("client_secret", self.config.client_secret)
        form_data.add_field("grant_type", "authorization_code")
        form_data.add_field("redirect_uri", self.config.redirect_uri)
        form_data.add_field("code", code)
        
        logger.warning(f"[Threads Token Exchange] client_id={self.config.client_id}, redirect_uri={self.config.redirect_uri}, token_url={self.config.token_url}")
        
        async with aiohttp.ClientSession() as session:
            async with session.post(self.config.token_url, data=form_data) as response:
                resp_text = await response.text()
                logger.warning(f"[Threads Token Exchange] status={response.status}, response={resp_text[:500]}")
                
                if response.status != 200:
                    try:
                        err_data = await response.json()
                        error_msg = err_data.get("error_message") or err_data.get("error", {}).get("message", resp_text[:200])
                    except Exception:
                        error_msg = resp_text[:200]
                    raise Exception(f"Threads 授權失敗: {error_msg}")
                
                import json
                data = json.loads(resp_text)
                short_token = data["access_token"]
                
                # 轉換為長期 token
                long_lived_token = await self._get_threads_long_lived_token(short_token)
                
                return AuthToken(
                    access_token=long_lived_token["access_token"],
                    expires_at=datetime.now() + timedelta(seconds=long_lived_token.get("expires_in", 5184000)),
                    token_type="Bearer",
                )

    async def _exchange_instagram_login_code(self, code: str) -> AuthToken:
        """Instagram Login：POST 換短期 token，再換長期 token。"""
        import logging
        logger = logging.getLogger(__name__)
        
        form_data = aiohttp.FormData()
        form_data.add_field("client_id", self.config.client_id)
        form_data.add_field("client_secret", self.config.client_secret)
        form_data.add_field("grant_type", "authorization_code")
        form_data.add_field("redirect_uri", self.config.redirect_uri)
        form_data.add_field("code", code)
        
        logger.warning(f"[IG Token Exchange] client_id={self.config.client_id}, redirect_uri={self.config.redirect_uri}, token_url={self.config.token_url}")
        
        async with aiohttp.ClientSession() as session:
            async with session.post(self.config.token_url, data=form_data) as response:
                resp_text = await response.text()
                logger.warning(f"[IG Token Exchange] status={response.status}, response={resp_text[:500]}")
                
                try:
                    data = await response.json(content_type=None)
                except Exception as json_err:
                    raise Exception(f"Instagram Login: JSON parse failed: {resp_text[:300]}")
                
                # 錯誤處理：Instagram Login API 回傳格式為
                # {"error_type": "OAuthException", "code": 400, "error_message": "..."}
                # 注意：與 Graph API 的 {"error": {"message": "..."}} 格式不同
                if "error_type" in data or "error_message" in data:
                    error_msg = data.get("error_message", str(data))
                    error_type = data.get("error_type", "unknown")
                    logger.error(f"[IG Token Exchange] Instagram API error: type={error_type}, message={error_msg}")
                    raise Exception(f"Instagram Login 授權失敗: {error_msg}")
                
                if "error" in data:
                    err = data.get("error", {})
                    if isinstance(err, dict):
                        raise Exception(f"Token exchange failed: {err.get('message', str(data))}")
                    else:
                        raise Exception(f"Token exchange failed: {str(data)}")
                
                # 回傳格式: {"data": [{"access_token": "...", "user_id": "...", "permissions": "..."}]}
                items = data.get("data") if isinstance(data.get("data"), list) else [data]
                item = items[0] if items else data
                short_token = item.get("access_token")
                if not short_token:
                    raise Exception(f"Instagram Login: 未取得 access_token, response_keys={list(data.keys())}, data={str(data)[:300]}")
                
                long_lived = await self._get_instagram_long_lived_token(short_token)
                return AuthToken(
                    access_token=long_lived["access_token"],
                    expires_at=datetime.now() + timedelta(seconds=long_lived.get("expires_in", 5184000)),
                    token_type="Bearer",
                )

    async def _get_instagram_long_lived_token(self, short_token: str) -> Dict[str, Any]:
        """Instagram Login：將短期 token 換成長期 token (60 天)。端點為 graph.instagram.com/access_token（無版本號）"""
        params = {
            "grant_type": "ig_exchange_token",
            "client_secret": self.config.client_secret,
            "access_token": short_token,
        }
        async with aiohttp.ClientSession() as session:
            async with session.get(
                "https://graph.instagram.com/access_token", params=params
            ) as response:
                data = await response.json()
                if "error" in data:
                    raise Exception(f"Long-lived token failed: {data['error'].get('message', str(data))}")
                return data

    async def _get_long_lived_token(self, short_token: str) -> Dict[str, Any]:
        """將短期 token 轉換為長期 token (60 天)，用於 FB/IG (Facebook Login)"""
        params = {
            "grant_type": "fb_exchange_token",
            "client_id": self.config.client_id,
            "client_secret": self.config.client_secret,
            "fb_exchange_token": short_token
        }
        
        async with aiohttp.ClientSession() as session:
            url = f"{self.GRAPH_API_BASE}/oauth/access_token"
            async with session.get(url, params=params) as response:
                data = await response.json()
                if "error" in data:
                    raise Exception(f"Long-lived token exchange failed: {data['error']['message']}")
                return data

    async def _get_threads_long_lived_token(self, short_token: str) -> Dict[str, Any]:
        """Threads 專用：將短期 token 轉換為長期 token (60 天)。使用 graph.threads.net，非 graph.facebook.com"""
        params = {
            "grant_type": "th_exchange_token",
            "client_secret": self.config.client_secret,
            "access_token": short_token
        }
        
        async with aiohttp.ClientSession() as session:
            url = "https://graph.threads.net/access_token"
            async with session.get(url, params=params) as response:
                data = await response.json()
                if "error" in data:
                    raise Exception(f"Long-lived token exchange failed: {data['error']['message']}")
                return data
    
    async def refresh_token(self, current_token: str) -> AuthToken:
        """
        Meta 長期 token 不使用 refresh_token，
        而是在過期前用現有 token 換取新 token
        """
        if self.config.platform_id == "threads":
            params = {"grant_type": "th_refresh_token", "access_token": current_token}
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "https://graph.threads.net/refresh_access_token", params=params
                ) as response:
                    data = await response.json()
                    if "error" in data:
                        raise Exception(f"Token refresh failed: {data['error']['message']}")
                    return AuthToken(
                        access_token=data["access_token"],
                        expires_at=datetime.now()
                        + timedelta(seconds=data.get("expires_in", 5184000)),
                        token_type="Bearer",
                    )
        if getattr(self.config, "oauth_flow_type", "meta") == "instagram_login":
            params = {"grant_type": "ig_refresh_token", "access_token": current_token}
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "https://graph.instagram.com/refresh_access_token", params=params
                ) as response:
                    data = await response.json()
                    if "error" in data:
                        raise Exception(f"Token refresh failed: {data['error'].get('message', str(data))}")
                    return AuthToken(
                        access_token=data["access_token"],
                        expires_at=datetime.now()
                        + timedelta(seconds=data.get("expires_in", 5184000)),
                        token_type="Bearer",
                    )
        return AuthToken(
            access_token=(await self._get_long_lived_token(current_token))["access_token"],
            expires_at=datetime.now() + timedelta(seconds=5184000),
            token_type="Bearer",
        )
    
    async def revoke_token(self, access_token: str) -> bool:
        """撤銷授權"""
        async with aiohttp.ClientSession() as session:
            url = f"{self.GRAPH_API_BASE}/me/permissions"
            params = {"access_token": access_token}
            async with session.delete(url, params=params) as response:
                return response.status == 200
    
    # ==================== 用戶資料 ====================
    
    async def get_user_profile(self, access_token: str) -> UserProfile:
        """獲取用戶資料"""
        if self.platform_id == "instagram":
            return await self._get_instagram_profile(access_token)
        elif self.platform_id == "facebook":
            return await self._get_facebook_profile(access_token)
        elif self.platform_id == "threads":
            return await self._get_threads_profile(access_token)
        else:
            raise ValueError(f"Unknown platform: {self.platform_id}")
    
    async def _get_instagram_profile(self, access_token: str) -> UserProfile:
        """獲取 Instagram 帳號資料。Instagram Login 直接呼叫 /me；Facebook Login 需透過粉專查詢。"""
        if getattr(self.config, "oauth_flow_type", "meta") == "instagram_login":
            return await self._get_instagram_login_profile(access_token)
        return await self._get_instagram_facebook_login_profile(access_token)

    async def _get_instagram_login_profile(self, access_token: str) -> UserProfile:
        """Instagram Login：直接 GET graph.instagram.com/me，不需粉專。"""
        async with aiohttp.ClientSession() as session:
            url = f"{self.config.api_base_url}/me"
            params = {
                "fields": "user_id,username,name,profile_picture_url,followers_count",
                "access_token": access_token,
            }
            async with session.get(url, params=params) as response:
                data = await response.json()
                if "error" in data:
                    raise Exception(f"Instagram API Error: {data['error'].get('message', str(data))}")
                # 回傳可能是 {"user_id": "...", "username": "..."} 或 {"data": [{"user_id": "...", ...}]}
                item = data
                if "data" in data and isinstance(data["data"], list) and data["data"]:
                    item = data["data"][0]
                ig_id = item.get("user_id") or item.get("id")
                if not ig_id:
                    raise Exception("Instagram Login: 未取得 user_id")
                self._ig_user_id = str(ig_id)
                return UserProfile(
                    platform_id="instagram",
                    platform_user_id=str(ig_id),
                    username=item.get("username", ""),
                    display_name=item.get("name"),
                    avatar_url=item.get("profile_picture_url"),
                    profile_url=f"https://instagram.com/{item.get('username', '')}",
                    followers_count=item.get("followers_count"),
                    extra_data={"oauth_flow": "instagram_login"},
                )

    async def _get_instagram_facebook_login_profile(self, access_token: str) -> UserProfile:
        """Facebook Login：先取粉專列表，再逐一查詢各粉專的 IG。"""
        pages = await self._get_facebook_pages(access_token)
        if not pages:
            raise Exception("No Facebook Pages found. Instagram Business requires a linked Facebook Page.")
        
        async with aiohttp.ClientSession() as session:
            for page in pages:
                url = f"{self.GRAPH_API_BASE}/{page['id']}"
                token = page.get("access_token") or access_token
                params = {
                    "fields": "instagram_business_account{id,username,name,profile_picture_url,followers_count}",
                    "access_token": token,
                }
                async with session.get(url, params=params) as response:
                    data = await response.json()
                    if "error" in data:
                        continue
                    ig = data.get("instagram_business_account")
                    if ig and isinstance(ig, dict) and ig.get("id"):
                        self._page_id = page["id"]
                        self._ig_user_id = ig["id"]
                        return UserProfile(
                            platform_id="instagram",
                            platform_user_id=ig["id"],
                            username=ig.get("username", ""),
                            display_name=ig.get("name"),
                            avatar_url=ig.get("profile_picture_url"),
                            profile_url=f"https://instagram.com/{ig.get('username', '')}",
                            followers_count=ig.get("followers_count"),
                            extra_data={"page_id": page["id"], "page_name": page["name"]},
                        )
        
        page_names = ", ".join(p.get("name", p.get("id", "?")) for p in pages[:5])
        raise Exception(
            f"No Instagram Business Account linked to any of your Facebook Pages ({page_names}). "
            "Please link an Instagram Business/Creator account in Facebook Page Settings → Instagram."
        )
    
    async def _get_facebook_profile(self, access_token: str) -> UserProfile:
        """獲取 Facebook Page 資料"""
        pages = await self._get_facebook_pages(access_token)
        if not pages:
            raise Exception("No Facebook Pages found")
        
        page = pages[0]
        self._page_id = page["id"]
        
        return UserProfile(
            platform_id="facebook",
            platform_user_id=page["id"],
            username=page.get("username", page["name"]),
            display_name=page["name"],
            avatar_url=page.get("picture", {}).get("data", {}).get("url"),
            profile_url=f"https://facebook.com/{page['id']}",
            followers_count=page.get("followers_count"),
            extra_data={
                "page_access_token": page.get("access_token"),
                "page_id": page["id"],
                "page_name": page["name"]
            }
        )
    
    async def _get_threads_profile(self, access_token: str) -> UserProfile:
        """獲取 Threads 帳號資料"""
        async with aiohttp.ClientSession() as session:
            url = f"{self.config.api_base_url}/me"
            params = {
                "fields": "id,username,threads_profile_picture_url,threads_biography",
                "access_token": access_token
            }
            async with session.get(url, params=params) as response:
                data = await response.json()
                
                if "error" in data:
                    raise Exception(f"Threads API Error: {data['error']['message']}")
                
                self._threads_user_id = data["id"]
                
                return UserProfile(
                    platform_id="threads",
                    platform_user_id=data["id"],
                    username=data.get("username", ""),
                    display_name=data.get("username"),
                    avatar_url=data.get("threads_profile_picture_url"),
                    profile_url=f"https://threads.net/@{data.get('username', '')}"
                )
    
    async def _get_facebook_pages(self, access_token: str) -> List[Dict[str, Any]]:
        """獲取用戶管理的 Facebook Pages"""
        async with aiohttp.ClientSession() as session:
            url = f"{self.GRAPH_API_BASE}/me/accounts"
            params = {
                "fields": "id,name,username,access_token,picture,followers_count",
                "access_token": access_token
            }
            async with session.get(url, params=params) as response:
                data = await response.json()
                return data.get("data", [])

    # ==================== 內容發布 ====================
    
    async def publish(self, access_token: str, content: PublishContent) -> PublishResult:
        """發布內容"""
        if self.platform_id == "instagram":
            return await self._publish_to_instagram(access_token, content)
        elif self.platform_id == "facebook":
            return await self._publish_to_facebook(access_token, content)
        elif self.platform_id == "threads":
            return await self._publish_to_threads(access_token, content)
        else:
            return PublishResult(success=False, error_message=f"Unknown platform: {self.platform_id}")
    
    def _get_instagram_api_base(self) -> str:
        """取得 Instagram API 基底 URL：Login 用 graph.instagram.com，Facebook Login 用 graph.facebook.com"""
        if getattr(self.config, "oauth_flow_type", "meta") == "instagram_login":
            return self.config.api_base_url
        return self.GRAPH_API_BASE

    async def _publish_to_instagram(self, access_token: str, content: PublishContent) -> PublishResult:
        """發布到 Instagram"""
        try:
            if not self._ig_user_id:
                await self._get_instagram_profile(access_token)
            
            api_base = self._get_instagram_api_base()
            container_id = await self._create_ig_media_container(access_token, content, api_base)
            
            async with aiohttp.ClientSession() as session:
                url = f"{api_base}/{self._ig_user_id}/media_publish"
                params = {
                    "creation_id": container_id,
                    "access_token": access_token
                }
                async with session.post(url, params=params) as response:
                    data = await response.json()
                    
                    if "error" in data:
                        return PublishResult(
                            success=False,
                            error_message=data["error"]["message"],
                            error_code=str(data["error"].get("code"))
                        )
                    
                    post_id = data["id"]
                    return PublishResult(
                        success=True,
                        platform_post_id=post_id,
                        platform_post_url=f"https://instagram.com/p/{post_id}"
                    )
                    
        except Exception as e:
            return PublishResult(success=False, error_message=str(e))
    
    async def _create_ig_media_container(
        self, access_token: str, content: PublishContent, api_base: Optional[str] = None
    ) -> str:
        """創建 Instagram 媒體容器"""
        if api_base is None:
            api_base = self._get_instagram_api_base()
        async with aiohttp.ClientSession() as session:
            url = f"{api_base}/{self._ig_user_id}/media"
            
            params = {
                "access_token": access_token,
                "caption": content.caption
            }
            
            if content.content_type == ContentType.IMAGE:
                params["image_url"] = content.media_urls[0]
            elif content.content_type == ContentType.VIDEO:
                params["video_url"] = content.media_urls[0]
                params["media_type"] = "VIDEO"
            elif content.content_type == ContentType.REEL:
                params["video_url"] = content.media_urls[0]
                params["media_type"] = "REELS"
            elif content.content_type == ContentType.CAROUSEL:
                # 輪播需要先創建子項目
                children_ids = []
                for media_url in content.media_urls:
                    child_params = {
                        "access_token": access_token,
                        "is_carousel_item": True
                    }
                    if media_url.endswith(('.mp4', '.mov')):
                        child_params["video_url"] = media_url
                        child_params["media_type"] = "VIDEO"
                    else:
                        child_params["image_url"] = media_url
                    
                    async with session.post(url, params=child_params) as resp:
                        child_data = await resp.json()
                        children_ids.append(child_data["id"])
                
                params["media_type"] = "CAROUSEL"
                params["children"] = ",".join(children_ids)
            
            async with session.post(url, params=params) as response:
                data = await response.json()
                if "error" in data:
                    raise Exception(f"Failed to create media container: {data['error']['message']}")
                return data["id"]
    
    async def _publish_to_facebook(self, access_token: str, content: PublishContent) -> PublishResult:
        """
        發布到 Facebook Page
        
        注意：Facebook Graph API 發布到粉絲專頁需要使用 Page Access Token，
        而非 User Access Token。此方法會自動從 /me/accounts 取得 Page Access Token。
        """
        try:
            # 取得 Page 資料（含 Page Access Token）
            pages = await self._get_facebook_pages(access_token)
            if not pages:
                return PublishResult(
                    success=False,
                    error_message="找不到 Facebook 粉絲專頁。請確認帳號已連結粉絲專頁。"
                )
            
            page = pages[0]
            self._page_id = page["id"]
            # 使用 Page Access Token（非 User Token）來發布
            page_access_token = page.get("access_token", access_token)
            
            print(f"[Meta] 發布到 Facebook Page: {page.get('name')} (ID: {self._page_id})")
            
            async with aiohttp.ClientSession() as session:
                if content.content_type == ContentType.TEXT:
                    # 純文字貼文
                    url = f"{self.GRAPH_API_BASE}/{self._page_id}/feed"
                    params = {
                        "message": content.caption,
                        "access_token": page_access_token
                    }
                elif content.content_type == ContentType.IMAGE:
                    # 圖片貼文
                    url = f"{self.GRAPH_API_BASE}/{self._page_id}/photos"
                    media_url = content.media_urls[0]
                    
                    if media_url.startswith("data:"):
                        # Base64 Data URI → 用 source 參數上傳 (multipart/form-data)
                        import base64 as b64_module
                        import re
                        match = re.match(r'data:([^;]+);base64,(.+)', media_url)
                        if not match:
                            return PublishResult(
                                success=False,
                                error_message="無效的 Base64 圖片格式"
                            )
                        content_type_str = match.group(1)
                        image_bytes = b64_module.b64decode(match.group(2))
                        
                        ext_map = {"image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp"}
                        ext = ext_map.get(content_type_str, "png")
                        
                        form_data = aiohttp.FormData()
                        form_data.add_field('source', image_bytes, filename=f"image.{ext}", content_type=content_type_str)
                        form_data.add_field('caption', content.caption or "")
                        form_data.add_field('access_token', page_access_token)
                        
                        print(f"[Meta] 使用 source 參數上傳 Base64 圖片 ({len(image_bytes)} bytes)")
                    else:
                        # 一般 HTTP URL → 用 url 參數
                        form_data = None
                        params = {
                            "url": media_url,
                            "caption": content.caption,
                            "access_token": page_access_token
                        }
                elif content.content_type == ContentType.VIDEO:
                    # 影片貼文
                    url = f"{self.GRAPH_API_BASE}/{self._page_id}/videos"
                    form_data = None
                    params = {
                        "file_url": content.media_urls[0],
                        "description": content.caption,
                        "access_token": page_access_token
                    }
                else:
                    return PublishResult(
                        success=False, 
                        error_message=f"Unsupported content type: {content.content_type}"
                    )
                
                # 根據是否有 form_data 決定上傳方式
                if content.content_type == ContentType.IMAGE and form_data is not None:
                    async with session.post(url, data=form_data) as response:
                        data = await response.json()
                else:
                    async with session.post(url, params=params) as response:
                        data = await response.json()
                
                if "error" in data:
                    print(f"[Meta] Facebook 發布失敗: {data['error']}")
                    return PublishResult(
                        success=False,
                        error_message=data["error"]["message"],
                        error_code=str(data["error"].get("code"))
                    )
                
                # photos API 回傳 {"id": photoId, "post_id": pageId_postId}
                # feed API 回傳 {"id": pageId_postId}
                post_id = data.get("post_id") or data.get("id")
                
                # 建構可靠的 Facebook 貼文 URL
                # post_id 格式為 pageId_postId，例如 "123456_789012"
                if post_id and "_" in str(post_id):
                    parts = str(post_id).split("_", 1)
                    fb_url = f"https://www.facebook.com/permalink.php?story_fbid={parts[1]}&id={parts[0]}"
                else:
                    fb_url = f"https://www.facebook.com/{post_id}"
                
                print(f"[Meta] Facebook 發布成功: post_id={post_id}, url={fb_url}, raw_data={data}")
                return PublishResult(
                    success=True,
                    platform_post_id=str(post_id),
                    platform_post_url=fb_url
                )
                    
        except Exception as e:
            print(f"[Meta] Facebook 發布異常: {str(e)}")
            return PublishResult(success=False, error_message=str(e))
    
    async def _publish_to_threads(self, access_token: str, content: PublishContent) -> PublishResult:
        """發布到 Threads"""
        try:
            if not self._threads_user_id:
                await self._get_threads_profile(access_token)
            
            async with aiohttp.ClientSession() as session:
                # Step 1: 創建媒體容器
                url = f"{self.config.api_base_url}/{self._threads_user_id}/threads"
                params = {
                    "text": content.caption,
                    "access_token": access_token
                }
                
                if content.content_type == ContentType.IMAGE and content.media_urls:
                    params["media_type"] = "IMAGE"
                    params["image_url"] = content.media_urls[0]
                elif content.content_type == ContentType.VIDEO and content.media_urls:
                    params["media_type"] = "VIDEO"
                    params["video_url"] = content.media_urls[0]
                elif content.content_type == ContentType.CAROUSEL and content.media_urls:
                    params["media_type"] = "CAROUSEL"
                    # Threads carousel 需要特殊處理
                else:
                    params["media_type"] = "TEXT"
                
                async with session.post(url, params=params) as response:
                    data = await response.json()
                    
                    if "error" in data:
                        return PublishResult(
                            success=False,
                            error_message=data["error"]["message"]
                        )
                    
                    container_id = data["id"]
                
                # Step 2: 發布
                publish_url = f"{self.config.api_base_url}/{self._threads_user_id}/threads_publish"
                publish_params = {
                    "creation_id": container_id,
                    "access_token": access_token
                }
                
                async with session.post(publish_url, params=publish_params) as response:
                    data = await response.json()
                    
                    if "error" in data:
                        return PublishResult(
                            success=False,
                            error_message=data["error"]["message"]
                        )
                    
                    return PublishResult(
                        success=True,
                        platform_post_id=data["id"],
                        platform_post_url=f"https://threads.net/t/{data['id']}"
                    )
                    
        except Exception as e:
            return PublishResult(success=False, error_message=str(e))
    
    async def delete_post(self, access_token: str, post_id: str) -> bool:
        """刪除貼文"""
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.GRAPH_API_BASE}/{post_id}"
                params = {"access_token": access_token}
                async with session.delete(url, params=params) as response:
                    return response.status == 200
        except:
            return False
