"""
YouTube 平台整合
使用 YouTube Data API v3
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


class YouTubePlatform(BasePlatform):
    """
    YouTube 平台整合
    
    YouTube API 需求:
    - Google Cloud Console 創建專案
    - 啟用 YouTube Data API v3
    - 創建 OAuth 2.0 憑證
    
    支援功能:
    - 影片上傳
    - Shorts 上傳
    """
    
    API_BASE = "https://www.googleapis.com/youtube/v3"
    UPLOAD_BASE = "https://www.googleapis.com/upload/youtube/v3"
    
    @classmethod
    def create_config(cls) -> PlatformConfig:
        """創建 YouTube 配置"""
        return PlatformConfig(
            platform_id="youtube",
            name="YouTube",
            client_id=os.getenv("GOOGLE_CLIENT_ID", ""),
            client_secret=os.getenv("GOOGLE_CLIENT_SECRET", ""),
            redirect_uri=os.getenv("YOUTUBE_REDIRECT_URI") or f"{os.getenv('BACKEND_URL', 'http://localhost:8000').rstrip('/')}/oauth/youtube/callback",
            scopes=[
                "https://www.googleapis.com/auth/youtube",
                "https://www.googleapis.com/auth/youtube.upload",
                "https://www.googleapis.com/auth/youtube.readonly"
            ],
            auth_url="https://accounts.google.com/o/oauth2/v2/auth",
            token_url="https://oauth2.googleapis.com/token",
            api_base_url="https://www.googleapis.com/youtube/v3",
            supported_content_types=[ContentType.VIDEO],
            max_video_duration=12 * 60 * 60,  # 12 小時
            max_video_size=256 * 1024 * 1024 * 1024,  # 256GB
            max_caption_length=5000
        )
    
    def __init__(self, config: PlatformConfig = None):
        super().__init__(config or self.create_config())
        self._channel_id = None
    
    # ==================== OAuth 授權流程 ====================
    
    def get_auth_url(self, state: str) -> str:
        """生成 Google OAuth 授權 URL"""
        params = {
            "client_id": self.config.client_id,
            "redirect_uri": self.config.redirect_uri,
            "scope": " ".join(self.config.scopes),
            "response_type": "code",
            "state": state,
            "access_type": "offline",
            "prompt": "consent"
        }
        return f"{self.config.auth_url}?{urlencode(params)}"
    
    async def exchange_code_for_token(self, code: str) -> AuthToken:
        """用授權碼交換 Access Token"""
        async with aiohttp.ClientSession() as session:
            url = self.config.token_url
            data = {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": self.config.redirect_uri,
                "client_id": self.config.client_id,
                "client_secret": self.config.client_secret
            }
            
            async with session.post(url, data=data) as response:
                result = await response.json()
                
                if "error" in result:
                    raise Exception(f"Token exchange failed: {result.get('error_description', result['error'])}")
                
                expires_at = datetime.now() + timedelta(seconds=result.get("expires_in", 3600))
                
                return AuthToken(
                    access_token=result["access_token"],
                    refresh_token=result.get("refresh_token"),
                    expires_at=expires_at,
                    scope=result.get("scope")
                )
    
    async def refresh_token(self, refresh_token: str) -> AuthToken:
        """刷新 Access Token"""
        async with aiohttp.ClientSession() as session:
            url = self.config.token_url
            data = {
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": self.config.client_id,
                "client_secret": self.config.client_secret
            }
            
            async with session.post(url, data=data) as response:
                result = await response.json()
                
                if "error" in result:
                    raise Exception(f"Token refresh failed: {result.get('error_description', result['error'])}")
                
                expires_at = datetime.now() + timedelta(seconds=result.get("expires_in", 3600))
                
                return AuthToken(
                    access_token=result["access_token"],
                    refresh_token=refresh_token,  # Google 不會返回新的 refresh_token
                    expires_at=expires_at
                )
    
    async def revoke_token(self, access_token: str) -> bool:
        """撤銷授權"""
        async with aiohttp.ClientSession() as session:
            url = f"https://oauth2.googleapis.com/revoke?token={access_token}"
            async with session.post(url) as response:
                return response.status == 200
    
    # ==================== 用戶資料 ====================
    
    async def get_user_profile(self, access_token: str) -> UserProfile:
        """獲取 YouTube 頻道資料"""
        async with aiohttp.ClientSession() as session:
            url = f"{self.API_BASE}/channels"
            params = {
                "part": "snippet,statistics",
                "mine": "true"
            }
            headers = {"Authorization": f"Bearer {access_token}"}
            
            async with session.get(url, params=params, headers=headers) as response:
                if response.status != 200:
                    text = await response.text()
                    raise Exception(f"Failed to get channel info: {text}")
                
                result = await response.json()
                
                if not result.get("items"):
                    raise Exception("No YouTube channel found")
                
                channel = result["items"][0]
                snippet = channel["snippet"]
                statistics = channel.get("statistics", {})
                
                self._channel_id = channel["id"]
                
                return UserProfile(
                    platform_id="youtube",
                    platform_user_id=channel["id"],
                    username=snippet.get("customUrl", snippet.get("title", "")),
                    display_name=snippet.get("title"),
                    avatar_url=snippet.get("thumbnails", {}).get("default", {}).get("url"),
                    profile_url=f"https://youtube.com/channel/{channel['id']}",
                    followers_count=int(statistics.get("subscriberCount", 0)),
                    extra_data={
                        "view_count": statistics.get("viewCount"),
                        "video_count": statistics.get("videoCount"),
                        "description": snippet.get("description")
                    }
                )
    
    # ==================== 內容發布 ====================
    
    async def publish(self, access_token: str, content: PublishContent) -> PublishResult:
        """上傳影片到 YouTube"""
        try:
            if content.content_type != ContentType.VIDEO:
                return PublishResult(
                    success=False,
                    error_message="YouTube 只支援影片上傳"
                )
            
            return await self._upload_video(access_token, content)
        except Exception as e:
            return PublishResult(success=False, error_message=str(e))
    
    async def _upload_video(self, access_token: str, content: PublishContent) -> PublishResult:
        """使用 Resumable Upload 上傳影片到 YouTube"""
        import json
        
        async with aiohttp.ClientSession() as session:
            # Step 1: 下載影片
            async with session.get(content.media_urls[0]) as resp:
                if resp.status != 200:
                    return PublishResult(
                        success=False,
                        error_message=f"無法下載影片: HTTP {resp.status}"
                    )
                video_data = await resp.read()
                video_content_type = resp.content_type or "video/mp4"
            
            # Step 2: 準備 metadata
            is_shorts = content.extra_params and content.extra_params.get("is_shorts", False)
            
            # title 與 description 分離：title 取 extra_params 或 caption 前 100 字
            title = (
                (content.extra_params or {}).get("title")
                or (content.caption[:100] if content.caption else "Untitled Video")
            )
            if is_shorts and not title.startswith("#Shorts"):
                title = f"{title} #Shorts"
            
            metadata = {
                "snippet": {
                    "title": title,
                    "description": content.caption or "",
                    "tags": content.hashtags or [],
                    "categoryId": "22"  # People & Blogs
                },
                "status": {
                    "privacyStatus": "public",
                    "selfDeclaredMadeForKids": False
                }
            }
            
            # Step 3: 使用 Resumable Upload (官方推薦方式)
            # 3a: 初始化 resumable upload session
            init_url = (
                f"{self.UPLOAD_BASE}/videos"
                f"?uploadType=resumable&part=snippet,status"
            )
            init_headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json; charset=UTF-8",
                "X-Upload-Content-Length": str(len(video_data)),
                "X-Upload-Content-Type": video_content_type,
            }
            
            async with session.post(
                init_url, headers=init_headers, data=json.dumps(metadata)
            ) as init_resp:
                if init_resp.status != 200:
                    text = await init_resp.text()
                    return PublishResult(
                        success=False,
                        error_message=f"YouTube resumable upload init 失敗: {text}"
                    )
                upload_url = init_resp.headers.get("Location")
                if not upload_url:
                    return PublishResult(
                        success=False,
                        error_message="YouTube 未回傳 upload URL"
                    )
            
            # 3b: 上傳影片 binary
            upload_headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": video_content_type,
                "Content-Length": str(len(video_data)),
            }
            
            async with session.put(
                upload_url, headers=upload_headers, data=video_data
            ) as upload_resp:
                if upload_resp.status not in [200, 201]:
                    text = await upload_resp.text()
                    return PublishResult(
                        success=False,
                        error_message=f"YouTube 影片上傳失敗: {text}"
                    )
                
                result = await upload_resp.json()
                video_id = result["id"]
                
                return PublishResult(
                    success=True,
                    platform_post_id=video_id,
                    platform_post_url=f"https://youtube.com/watch?v={video_id}",
                    extra_data={
                        "title": result.get("snippet", {}).get("title", title),
                        "channel_id": result.get("snippet", {}).get("channelId", ""),
                    }
                )
    
    async def delete_post(self, access_token: str, post_id: str) -> bool:
        """刪除影片"""
        async with aiohttp.ClientSession() as session:
            url = f"{self.API_BASE}/videos"
            params = {"id": post_id}
            headers = {"Authorization": f"Bearer {access_token}"}
            
            async with session.delete(url, params=params, headers=headers) as response:
                return response.status == 204


# ============================================================
# Publisher 別名（供 scheduler_tasks.get_platform_publisher 使用）
# ============================================================

class YouTubePublisher(YouTubePlatform):
    """YouTube 發布器 — 繼承 YouTubePlatform 的完整功能"""
    pass
