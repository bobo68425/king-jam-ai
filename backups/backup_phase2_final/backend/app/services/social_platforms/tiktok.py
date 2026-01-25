"""
TikTok 平台整合
使用 TikTok Content Posting API
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


class TikTokPlatform(BasePlatform):
    """
    TikTok 平台整合
    
    TikTok Content Posting API 需求:
    - 申請 TikTok for Developers 帳號
    - 創建應用並獲取 Client Key 和 Secret
    - 需要申請 Content Posting API 權限
    
    支援功能:
    - 影片發布 (最長 10 分鐘)
    - 照片發布 (最多 35 張)
    """
    
    API_BASE = "https://open.tiktokapis.com/v2"
    
    @classmethod
    def create_config(cls) -> PlatformConfig:
        """創建 TikTok 配置"""
        return PlatformConfig(
            platform_id="tiktok",
            name="TikTok",
            client_id=os.getenv("TIKTOK_CLIENT_KEY", ""),
            client_secret=os.getenv("TIKTOK_CLIENT_SECRET", ""),
            redirect_uri=os.getenv("TIKTOK_REDIRECT_URI", "http://localhost:8000/oauth/tiktok/callback"),
            scopes=[
                "user.info.basic",
                "user.info.profile",
                "user.info.stats",
                "video.publish",
                "video.upload"
            ],
            auth_url="https://www.tiktok.com/v2/auth/authorize/",
            token_url="https://open.tiktokapis.com/v2/oauth/token/",
            api_base_url="https://open.tiktokapis.com/v2",
            supported_content_types=[ContentType.VIDEO, ContentType.IMAGE],
            max_video_duration=10 * 60,  # 10 分鐘
            max_video_size=4 * 1024 * 1024 * 1024,  # 4GB
            max_caption_length=2200
        )
    
    def __init__(self, config: PlatformConfig = None):
        super().__init__(config or self.create_config())
        self._open_id = None
    
    # ==================== OAuth 授權流程 ====================
    
    def get_auth_url(self, state: str) -> str:
        """生成 TikTok OAuth 授權 URL"""
        params = {
            "client_key": self.config.client_id,
            "redirect_uri": self.config.redirect_uri,
            "scope": ",".join(self.config.scopes),
            "response_type": "code",
            "state": state
        }
        return f"{self.config.auth_url}?{urlencode(params)}"
    
    async def exchange_code_for_token(self, code: str) -> AuthToken:
        """用授權碼交換 Access Token"""
        async with aiohttp.ClientSession() as session:
            url = self.config.token_url
            data = {
                "client_key": self.config.client_id,
                "client_secret": self.config.client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": self.config.redirect_uri
            }
            
            async with session.post(url, data=data) as response:
                result = await response.json()
                
                if "error" in result:
                    raise Exception(f"Token exchange failed: {result.get('error_description', result['error'])}")
                
                # TikTok 返回的 expires_in 是秒數
                expires_at = datetime.now() + timedelta(seconds=result.get("expires_in", 86400))
                
                return AuthToken(
                    access_token=result["access_token"],
                    refresh_token=result.get("refresh_token"),
                    expires_at=expires_at,
                    token_type=result.get("token_type", "Bearer"),
                    scope=result.get("scope"),
                    extra_data={"open_id": result.get("open_id")}
                )
    
    async def refresh_token(self, refresh_token: str) -> AuthToken:
        """刷新 Access Token"""
        async with aiohttp.ClientSession() as session:
            url = self.config.token_url
            data = {
                "client_key": self.config.client_id,
                "client_secret": self.config.client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token"
            }
            
            async with session.post(url, data=data) as response:
                result = await response.json()
                
                if "error" in result:
                    raise Exception(f"Token refresh failed: {result.get('error_description', result['error'])}")
                
                expires_at = datetime.now() + timedelta(seconds=result.get("expires_in", 86400))
                
                return AuthToken(
                    access_token=result["access_token"],
                    refresh_token=result.get("refresh_token"),
                    expires_at=expires_at,
                    extra_data={"open_id": result.get("open_id")}
                )
    
    async def revoke_token(self, access_token: str) -> bool:
        """撤銷授權"""
        async with aiohttp.ClientSession() as session:
            url = f"{self.API_BASE}/oauth/revoke/"
            data = {
                "client_key": self.config.client_id,
                "client_secret": self.config.client_secret,
                "token": access_token
            }
            async with session.post(url, data=data) as response:
                return response.status == 200
    
    # ==================== 用戶資料 ====================
    
    async def get_user_profile(self, access_token: str) -> UserProfile:
        """獲取用戶資料"""
        async with aiohttp.ClientSession() as session:
            url = f"{self.API_BASE}/user/info/"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            params = {
                "fields": "open_id,union_id,avatar_url,display_name,username,follower_count,following_count,likes_count,video_count"
            }
            
            async with session.get(url, headers=headers, params=params) as response:
                result = await response.json()
                
                if result.get("error", {}).get("code") != "ok":
                    raise Exception(f"Failed to get user info: {result.get('error', {}).get('message')}")
                
                data = result.get("data", {}).get("user", {})
                self._open_id = data.get("open_id")
                
                return UserProfile(
                    platform_id="tiktok",
                    platform_user_id=data.get("open_id", ""),
                    username=data.get("username", ""),
                    display_name=data.get("display_name"),
                    avatar_url=data.get("avatar_url"),
                    profile_url=f"https://tiktok.com/@{data.get('username', '')}",
                    followers_count=data.get("follower_count"),
                    extra_data={
                        "following_count": data.get("following_count"),
                        "likes_count": data.get("likes_count"),
                        "video_count": data.get("video_count")
                    }
                )
    
    # ==================== 內容發布 ====================
    
    async def publish(self, access_token: str, content: PublishContent) -> PublishResult:
        """發布影片到 TikTok"""
        try:
            if content.content_type == ContentType.VIDEO:
                return await self._publish_video(access_token, content)
            elif content.content_type == ContentType.IMAGE:
                return await self._publish_photo(access_token, content)
            else:
                return PublishResult(
                    success=False,
                    error_message=f"TikTok 不支援 {content.content_type.value} 類型內容"
                )
        except Exception as e:
            return PublishResult(success=False, error_message=str(e))
    
    async def _publish_video(self, access_token: str, content: PublishContent) -> PublishResult:
        """發布影片"""
        async with aiohttp.ClientSession() as session:
            # Step 1: 初始化上傳
            init_url = f"{self.API_BASE}/post/publish/video/init/"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            init_data = {
                "post_info": {
                    "title": content.caption[:150] if content.caption else "",
                    "privacy_level": "PUBLIC_TO_EVERYONE",
                    "disable_duet": False,
                    "disable_comment": False,
                    "disable_stitch": False
                },
                "source_info": {
                    "source": "PULL_FROM_URL",
                    "video_url": content.media_urls[0]
                }
            }
            
            async with session.post(init_url, headers=headers, json=init_data) as response:
                result = await response.json()
                
                if result.get("error", {}).get("code") != "ok":
                    return PublishResult(
                        success=False,
                        error_message=result.get("error", {}).get("message", "Unknown error"),
                        error_code=result.get("error", {}).get("code")
                    )
                
                publish_id = result.get("data", {}).get("publish_id")
                
                # 影片需要處理時間，返回 publish_id 供後續查詢狀態
                return PublishResult(
                    success=True,
                    platform_post_id=publish_id,
                    extra_data={"status": "processing", "publish_id": publish_id}
                )
    
    async def _publish_photo(self, access_token: str, content: PublishContent) -> PublishResult:
        """發布照片貼文 (最多 35 張)"""
        async with aiohttp.ClientSession() as session:
            init_url = f"{self.API_BASE}/post/publish/content/init/"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            # TikTok Photo Mode
            photo_images = []
            for url in content.media_urls[:35]:  # 最多 35 張
                photo_images.append({"image_url": url})
            
            init_data = {
                "post_info": {
                    "title": content.caption[:150] if content.caption else "",
                    "privacy_level": "PUBLIC_TO_EVERYONE",
                    "disable_comment": False
                },
                "source_info": {
                    "source": "PULL_FROM_URL",
                    "photo_images": photo_images
                },
                "post_mode": "DIRECT_POST",
                "media_type": "PHOTO"
            }
            
            async with session.post(init_url, headers=headers, json=init_data) as response:
                result = await response.json()
                
                if result.get("error", {}).get("code") != "ok":
                    return PublishResult(
                        success=False,
                        error_message=result.get("error", {}).get("message", "Unknown error"),
                        error_code=result.get("error", {}).get("code")
                    )
                
                publish_id = result.get("data", {}).get("publish_id")
                
                return PublishResult(
                    success=True,
                    platform_post_id=publish_id,
                    extra_data={"status": "processing", "publish_id": publish_id}
                )
    
    async def check_publish_status(self, access_token: str, publish_id: str) -> Dict[str, Any]:
        """查詢發布狀態"""
        async with aiohttp.ClientSession() as session:
            url = f"{self.API_BASE}/post/publish/status/fetch/"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            data = {"publish_id": publish_id}
            
            async with session.post(url, headers=headers, json=data) as response:
                result = await response.json()
                return result.get("data", {})
    
    async def delete_post(self, access_token: str, post_id: str) -> bool:
        """TikTok 不支援通過 API 刪除貼文"""
        return False
