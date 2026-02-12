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
    def create_instagram_config(cls) -> PlatformConfig:
        """創建 Instagram 配置"""
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
                # 依賴權限需先於 instagram_*（見 Meta 權限文件）
                "pages_read_user_content",
                "pages_show_list",
                "pages_read_engagement",
                "instagram_basic",
                "instagram_content_publish",
                "instagram_manage_insights",
                "business_management"
            ],
            auth_url="https://www.facebook.com/v18.0/dialog/oauth",
            token_url=f"https://graph.facebook.com/{cls.GRAPH_API_VERSION}/oauth/access_token",
            api_base_url=f"https://graph.facebook.com/{cls.GRAPH_API_VERSION}",
            supported_content_types=[
                ContentType.IMAGE, 
                ContentType.VIDEO, 
                ContentType.CAROUSEL,
                ContentType.REEL,
                ContentType.STORY
            ],
            max_video_duration=90,  # Reels 最長 90 秒
            max_caption_length=2200
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
        """創建 Threads 配置"""
        app_id, app_secret = cls._get_meta_credentials()
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
        
        若已設定 META_CONFIG_ID（Facebook Login for Business 設定 ID），
        則使用 config_id 取代 scope，可正確取得 Instagram 權限。
        """
        params = {
            "client_id": self.config.client_id,
            "redirect_uri": self.config.redirect_uri,
            "response_type": "code",
            "state": state
        }
        config_id = os.getenv("META_CONFIG_ID") or os.getenv("FACEBOOK_LOGIN_CONFIG_ID")
        if config_id and self.config.platform_id in ("instagram", "facebook"):
            params["config_id"] = config_id
        else:
            params["scope"] = ",".join(self.config.scopes)
        return f"{self.config.auth_url}?{urlencode(params)}"
    
    async def exchange_code_for_token(self, code: str) -> AuthToken:
        """用授權碼交換 Access Token"""
        params = {
            "client_id": self.config.client_id,
            "client_secret": self.config.client_secret,
            "redirect_uri": self.config.redirect_uri,
            "code": code
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(self.config.token_url, params=params) as response:
                data = await response.json()
                
                if "error" in data:
                    raise Exception(f"Token exchange failed: {data['error']['message']}")
                
                # 短期 token 轉換為長期 token
                long_lived_token = await self._get_long_lived_token(data["access_token"])
                
                return AuthToken(
                    access_token=long_lived_token["access_token"],
                    expires_at=datetime.now() + timedelta(seconds=long_lived_token.get("expires_in", 5184000)),
                    token_type="Bearer"
                )
    
    async def _get_long_lived_token(self, short_token: str) -> Dict[str, Any]:
        """將短期 token 轉換為長期 token (60 天)"""
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
    
    async def refresh_token(self, refresh_token: str) -> AuthToken:
        """
        Meta 長期 token 不使用 refresh_token，
        而是在過期前用現有 token 換取新 token
        """
        return await self._get_long_lived_token(refresh_token)
    
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
        """獲取 Instagram Business 帳號資料"""
        # 先獲取 Facebook Pages
        pages = await self._get_facebook_pages(access_token)
        if not pages:
            raise Exception("No Facebook Pages found. Instagram Business requires a linked Facebook Page.")
        
        # 獲取第一個 Page 的 Instagram Business Account
        page = pages[0]
        self._page_id = page["id"]
        
        async with aiohttp.ClientSession() as session:
            url = f"{self.GRAPH_API_BASE}/{page['id']}"
            params = {
                "fields": "instagram_business_account{id,username,name,profile_picture_url,followers_count}",
                "access_token": access_token
            }
            async with session.get(url, params=params) as response:
                data = await response.json()
                
                if "instagram_business_account" not in data:
                    raise Exception("No Instagram Business Account linked to this Facebook Page")
                
                ig = data["instagram_business_account"]
                self._ig_user_id = ig["id"]
                
                return UserProfile(
                    platform_id="instagram",
                    platform_user_id=ig["id"],
                    username=ig.get("username", ""),
                    display_name=ig.get("name"),
                    avatar_url=ig.get("profile_picture_url"),
                    profile_url=f"https://instagram.com/{ig.get('username', '')}",
                    followers_count=ig.get("followers_count"),
                    extra_data={"page_id": page["id"], "page_name": page["name"]}
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
    
    async def _publish_to_instagram(self, access_token: str, content: PublishContent) -> PublishResult:
        """發布到 Instagram"""
        try:
            if not self._ig_user_id:
                profile = await self._get_instagram_profile(access_token)
                
            # Step 1: 創建媒體容器
            container_id = await self._create_ig_media_container(access_token, content)
            
            # Step 2: 發布媒體
            async with aiohttp.ClientSession() as session:
                url = f"{self.GRAPH_API_BASE}/{self._ig_user_id}/media_publish"
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
    
    async def _create_ig_media_container(self, access_token: str, content: PublishContent) -> str:
        """創建 Instagram 媒體容器"""
        async with aiohttp.ClientSession() as session:
            url = f"{self.GRAPH_API_BASE}/{self._ig_user_id}/media"
            
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
