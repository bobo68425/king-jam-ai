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
    def create_instagram_config(cls) -> PlatformConfig:
        """創建 Instagram 配置"""
        return PlatformConfig(
            platform_id="instagram",
            name="Instagram",
            client_id=os.getenv("META_APP_ID", ""),
            client_secret=os.getenv("META_APP_SECRET", ""),
            redirect_uri=os.getenv("META_REDIRECT_URI", "http://localhost:8000/oauth/meta/callback"),
            scopes=[
                "instagram_basic",
                "instagram_content_publish",
                "instagram_manage_insights",
                "pages_show_list",
                "pages_read_engagement",
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
        return PlatformConfig(
            platform_id="facebook",
            name="Facebook",
            client_id=os.getenv("META_APP_ID", ""),
            client_secret=os.getenv("META_APP_SECRET", ""),
            redirect_uri=os.getenv("META_REDIRECT_URI", "http://localhost:8000/oauth/meta/callback"),
            scopes=[
                "pages_show_list",
                "pages_read_engagement",
                "pages_manage_posts",
                "pages_manage_engagement",
                "publish_video"
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
        return PlatformConfig(
            platform_id="threads",
            name="Threads",
            client_id=os.getenv("META_APP_ID", ""),
            client_secret=os.getenv("META_APP_SECRET", ""),
            redirect_uri=os.getenv("META_REDIRECT_URI", "http://localhost:8000/oauth/meta/callback"),
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
        """生成 Meta OAuth 授權 URL"""
        params = {
            "client_id": self.config.client_id,
            "redirect_uri": self.config.redirect_uri,
            "scope": ",".join(self.config.scopes),
            "response_type": "code",
            "state": state
        }
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
            extra_data={"page_access_token": page.get("access_token")}
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
        """發布到 Facebook Page"""
        try:
            if not self._page_id:
                await self._get_facebook_profile(access_token)
            
            async with aiohttp.ClientSession() as session:
                if content.content_type == ContentType.TEXT:
                    # 純文字貼文
                    url = f"{self.GRAPH_API_BASE}/{self._page_id}/feed"
                    params = {
                        "message": content.caption,
                        "access_token": access_token
                    }
                elif content.content_type == ContentType.IMAGE:
                    # 圖片貼文
                    url = f"{self.GRAPH_API_BASE}/{self._page_id}/photos"
                    params = {
                        "url": content.media_urls[0],
                        "caption": content.caption,
                        "access_token": access_token
                    }
                elif content.content_type == ContentType.VIDEO:
                    # 影片貼文
                    url = f"{self.GRAPH_API_BASE}/{self._page_id}/videos"
                    params = {
                        "file_url": content.media_urls[0],
                        "description": content.caption,
                        "access_token": access_token
                    }
                else:
                    return PublishResult(
                        success=False, 
                        error_message=f"Unsupported content type: {content.content_type}"
                    )
                
                async with session.post(url, params=params) as response:
                    data = await response.json()
                    
                    if "error" in data:
                        return PublishResult(
                            success=False,
                            error_message=data["error"]["message"],
                            error_code=str(data["error"].get("code"))
                        )
                    
                    post_id = data.get("id") or data.get("post_id")
                    return PublishResult(
                        success=True,
                        platform_post_id=post_id,
                        platform_post_url=f"https://facebook.com/{post_id}"
                    )
                    
        except Exception as e:
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
