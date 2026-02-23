"""
LinkedIn 平台整合
使用 LinkedIn Community Management API
"""

import os
import logging
import aiohttp
from urllib.parse import urlencode
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

from .base import (
    BasePlatform, PlatformConfig, AuthToken, UserProfile,
    PublishContent, PublishResult, ContentType
)

logger = logging.getLogger(__name__)

# LinkedIn API 版本 — 定期更新以使用最新功能
LINKEDIN_API_VERSION = "202501"


class LinkedInPlatform(BasePlatform):
    """
    LinkedIn 平台整合 (Community Management API)
    
    LinkedIn API 需求:
    - 創建 LinkedIn Developer Application
    - 需要申請以下產品: Share on LinkedIn, Sign In with LinkedIn using OpenID Connect
    
    支援功能:
    - 文字貼文
    - 圖片貼文 (單張)
    - 影片貼文
    - 多圖貼文
    """
    
    API_BASE = "https://api.linkedin.com"
    
    @classmethod
    def create_config(cls) -> PlatformConfig:
        """創建 LinkedIn 配置"""
        return PlatformConfig(
            platform_id="linkedin",
            name="LinkedIn",
            client_id=os.getenv("LINKEDIN_CLIENT_ID", ""),
            client_secret=os.getenv("LINKEDIN_CLIENT_SECRET", ""),
            redirect_uri=os.getenv("LINKEDIN_REDIRECT_URI") or f"{os.getenv('BACKEND_URL', 'http://localhost:8000').rstrip('/')}/oauth/linkedin/callback",
            scopes=[
                "openid",                       # OpenID Connect
                "profile",                      # 基本個人檔案
                "email",                        # 電子郵件
                "w_member_social",              # 發布貼文
            ],
            auth_url="https://www.linkedin.com/oauth/v2/authorization",
            token_url="https://www.linkedin.com/oauth/v2/accessToken",
            api_base_url="https://api.linkedin.com",
            supported_content_types=[
                ContentType.TEXT,
                ContentType.IMAGE,
                ContentType.VIDEO,
                ContentType.CAROUSEL
            ],
            max_video_duration=10 * 60,  # 10 分鐘
            max_caption_length=3000
        )
    
    def __init__(self, config: PlatformConfig = None):
        super().__init__(config or self.create_config())
        self._person_urn = None
    
    def _api_headers(self, access_token: str, content_type: str = "application/json") -> dict:
        """取得 Community Management API 標準 header"""
        return {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": content_type,
            "LinkedIn-Version": LINKEDIN_API_VERSION,
            "X-Restli-Protocol-Version": "2.0.0",
        }
    
    # ==================== OAuth 授權流程 ====================
    
    def get_auth_url(self, state: str) -> str:
        """生成 LinkedIn OAuth 授權 URL"""
        params = {
            "client_id": self.config.client_id,
            "redirect_uri": self.config.redirect_uri,
            "scope": " ".join(self.config.scopes),
            "response_type": "code",
            "state": state
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
            headers = {"Content-Type": "application/x-www-form-urlencoded"}
            
            async with session.post(url, data=data, headers=headers) as response:
                result = await response.json()
                
                if "error" in result:
                    raise Exception(f"Token exchange failed: {result.get('error_description', result['error'])}")
                
                expires_at = datetime.now() + timedelta(seconds=result.get("expires_in", 5184000))
                
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
            headers = {"Content-Type": "application/x-www-form-urlencoded"}
            
            async with session.post(url, data=data, headers=headers) as response:
                result = await response.json()
                
                if "error" in result:
                    raise Exception(f"Token refresh failed: {result.get('error_description', result['error'])}")
                
                expires_at = datetime.now() + timedelta(seconds=result.get("expires_in", 5184000))
                
                return AuthToken(
                    access_token=result["access_token"],
                    refresh_token=result.get("refresh_token"),
                    expires_at=expires_at
                )
    
    async def revoke_token(self, access_token: str) -> bool:
        """LinkedIn 不提供標準的 token 撤銷 API"""
        return True
    
    # ==================== 用戶資料 ====================
    
    async def get_user_profile(self, access_token: str) -> UserProfile:
        """獲取用戶資料"""
        async with aiohttp.ClientSession() as session:
            # 使用 OpenID Connect userinfo 端點
            url = f"{self.API_BASE}/v2/userinfo"
            headers = {"Authorization": f"Bearer {access_token}"}
            
            async with session.get(url, headers=headers) as response:
                if response.status != 200:
                    text = await response.text()
                    raise Exception(f"Failed to get user info: {text}")
                
                data = await response.json()
                
                self._person_urn = f"urn:li:person:{data.get('sub', '')}"
                
                return UserProfile(
                    platform_id="linkedin",
                    platform_user_id=data.get("sub", ""),
                    username=data.get("email", ""),
                    display_name=data.get("name"),
                    avatar_url=data.get("picture"),
                    profile_url=f"https://linkedin.com/in/{data.get('sub', '')}",
                    extra_data={
                        "email": data.get("email"),
                        "given_name": data.get("given_name"),
                        "family_name": data.get("family_name")
                    }
                )
    
    # ==================== 內容發布 (Community Management API) ====================
    
    async def publish(self, access_token: str, content: PublishContent) -> PublishResult:
        """發布內容到 LinkedIn"""
        try:
            if not self._person_urn:
                await self.get_user_profile(access_token)
            
            if content.content_type == ContentType.TEXT:
                return await self._publish_text(access_token, content)
            elif content.content_type == ContentType.IMAGE:
                return await self._publish_image(access_token, content)
            elif content.content_type == ContentType.VIDEO:
                return await self._publish_video(access_token, content)
            elif content.content_type == ContentType.CAROUSEL:
                return await self._publish_multi_image(access_token, content)
            else:
                return PublishResult(
                    success=False,
                    error_message=f"LinkedIn 不支援 {content.content_type.value} 類型內容"
                )
        except Exception as e:
            logger.error(f"[LinkedIn] 發布錯誤: {e}")
            return PublishResult(success=False, error_message=str(e))
    
    async def _publish_text(self, access_token: str, content: PublishContent) -> PublishResult:
        """發布純文字貼文 (Community Management API)"""
        async with aiohttp.ClientSession() as session:
            url = f"{self.API_BASE}/rest/posts"
            headers = self._api_headers(access_token)
            
            data = {
                "author": self._person_urn,
                "commentary": content.caption or "",
                "visibility": "PUBLIC",
                "distribution": {
                    "feedDistribution": "MAIN_FEED",
                    "targetEntities": [],
                    "thirdPartyDistributionChannels": []
                },
                "lifecycleState": "PUBLISHED",
                "isReshareDisabledByAuthor": False
            }
            
            async with session.post(url, headers=headers, json=data) as response:
                if response.status not in [200, 201]:
                    text = await response.text()
                    logger.error(f"[LinkedIn] 文字發布失敗: {response.status} {text}")
                    return PublishResult(success=False, error_message=text)
                
                # Community Management API 回傳 post URN 在 x-restli-id header
                post_urn = response.headers.get("x-restli-id", "")
                
                return PublishResult(
                    success=True,
                    platform_post_id=post_urn,
                    platform_post_url=f"https://linkedin.com/feed/update/{post_urn}"
                )
    
    async def _publish_image(self, access_token: str, content: PublishContent) -> PublishResult:
        """發布圖片貼文 (Community Management API)"""
        # Step 1: 初始化圖片上傳
        image_urn = await self._initialize_image_upload(access_token)
        if not image_urn:
            return PublishResult(success=False, error_message="LinkedIn 圖片上傳初始化失敗")
        
        upload_url = image_urn["uploadUrl"]
        image_id = image_urn["image"]
        
        # Step 2: 上傳圖片
        await self._upload_binary(access_token, upload_url, content.media_urls[0])
        
        # Step 3: 創建帶圖片的貼文
        async with aiohttp.ClientSession() as session:
            url = f"{self.API_BASE}/rest/posts"
            headers = self._api_headers(access_token)
            
            data = {
                "author": self._person_urn,
                "commentary": content.caption or "",
                "visibility": "PUBLIC",
                "distribution": {
                    "feedDistribution": "MAIN_FEED",
                    "targetEntities": [],
                    "thirdPartyDistributionChannels": []
                },
                "content": {
                    "media": {
                        "title": (content.caption or "")[:200],
                        "id": image_id
                    }
                },
                "lifecycleState": "PUBLISHED",
                "isReshareDisabledByAuthor": False
            }
            
            async with session.post(url, headers=headers, json=data) as response:
                if response.status not in [200, 201]:
                    text = await response.text()
                    logger.error(f"[LinkedIn] 圖片發布失敗: {response.status} {text}")
                    return PublishResult(success=False, error_message=text)
                
                post_urn = response.headers.get("x-restli-id", "")
                
                return PublishResult(
                    success=True,
                    platform_post_id=post_urn,
                    platform_post_url=f"https://linkedin.com/feed/update/{post_urn}"
                )
    
    async def _publish_video(self, access_token: str, content: PublishContent) -> PublishResult:
        """發布影片貼文 (Community Management API)"""
        # Step 1: 下載影片取得大小
        async with aiohttp.ClientSession() as session:
            async with session.get(content.media_urls[0]) as resp:
                if resp.status != 200:
                    return PublishResult(success=False, error_message=f"無法下載影片: HTTP {resp.status}")
                video_data = await resp.read()
        
        # Step 2: 初始化影片上傳
        video_urn = await self._initialize_video_upload(access_token, len(video_data))
        if not video_urn:
            return PublishResult(success=False, error_message="LinkedIn 影片上傳初始化失敗")
        
        upload_url = video_urn["uploadUrl"]
        video_id = video_urn["video"]
        
        # Step 3: 上傳影片 binary
        async with aiohttp.ClientSession() as session:
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/octet-stream",
            }
            async with session.put(upload_url, headers=headers, data=video_data) as response:
                if response.status not in [200, 201, 202]:
                    text = await response.text()
                    raise Exception(f"LinkedIn 影片上傳失敗: {response.status} {text}")
        
        # Step 4: 創建帶影片的貼文
        async with aiohttp.ClientSession() as session:
            url = f"{self.API_BASE}/rest/posts"
            headers = self._api_headers(access_token)
            
            data = {
                "author": self._person_urn,
                "commentary": content.caption or "",
                "visibility": "PUBLIC",
                "distribution": {
                    "feedDistribution": "MAIN_FEED",
                    "targetEntities": [],
                    "thirdPartyDistributionChannels": []
                },
                "content": {
                    "media": {
                        "title": (content.caption or "")[:200],
                        "id": video_id
                    }
                },
                "lifecycleState": "PUBLISHED",
                "isReshareDisabledByAuthor": False
            }
            
            async with session.post(url, headers=headers, json=data) as response:
                if response.status not in [200, 201]:
                    text = await response.text()
                    logger.error(f"[LinkedIn] 影片發布失敗: {response.status} {text}")
                    return PublishResult(success=False, error_message=text)
                
                post_urn = response.headers.get("x-restli-id", "")
                
                return PublishResult(
                    success=True,
                    platform_post_id=post_urn,
                    platform_post_url=f"https://linkedin.com/feed/update/{post_urn}"
                )
    
    async def _publish_multi_image(self, access_token: str, content: PublishContent) -> PublishResult:
        """發布多圖貼文 (Community Management API)"""
        # 上傳所有圖片
        image_ids = []
        for img_url in content.media_urls[:20]:  # LinkedIn 多圖最多 20 張
            image_urn = await self._initialize_image_upload(access_token)
            if not image_urn:
                return PublishResult(success=False, error_message="LinkedIn 圖片上傳初始化失敗")
            await self._upload_binary(access_token, image_urn["uploadUrl"], img_url)
            image_ids.append({"id": image_urn["image"]})
        
        # 創建多圖貼文
        async with aiohttp.ClientSession() as session:
            url = f"{self.API_BASE}/rest/posts"
            headers = self._api_headers(access_token)
            
            data = {
                "author": self._person_urn,
                "commentary": content.caption or "",
                "visibility": "PUBLIC",
                "distribution": {
                    "feedDistribution": "MAIN_FEED",
                    "targetEntities": [],
                    "thirdPartyDistributionChannels": []
                },
                "content": {
                    "multiImage": {
                        "images": image_ids
                    }
                },
                "lifecycleState": "PUBLISHED",
                "isReshareDisabledByAuthor": False
            }
            
            async with session.post(url, headers=headers, json=data) as response:
                if response.status not in [200, 201]:
                    text = await response.text()
                    logger.error(f"[LinkedIn] 多圖發布失敗: {response.status} {text}")
                    return PublishResult(success=False, error_message=text)
                
                post_urn = response.headers.get("x-restli-id", "")
                
                return PublishResult(
                    success=True,
                    platform_post_id=post_urn,
                    platform_post_url=f"https://linkedin.com/feed/update/{post_urn}"
                )
    
    # ==================== 媒體上傳 (Community Management API) ====================
    
    async def _initialize_image_upload(self, access_token: str) -> Optional[Dict[str, str]]:
        """初始化圖片上傳 (POST /rest/images?action=initializeUpload)"""
        async with aiohttp.ClientSession() as session:
            url = f"{self.API_BASE}/rest/images?action=initializeUpload"
            headers = self._api_headers(access_token)
            data = {
                "initializeUploadRequest": {
                    "owner": self._person_urn
                }
            }
            
            async with session.post(url, headers=headers, json=data) as response:
                if response.status not in [200, 201]:
                    text = await response.text()
                    logger.error(f"[LinkedIn] 圖片初始化失敗: {response.status} {text}")
                    return None
                
                result = await response.json()
                value = result.get("value", {})
                return {
                    "uploadUrl": value.get("uploadUrl", ""),
                    "image": value.get("image", "")
                }
    
    async def _initialize_video_upload(self, access_token: str, file_size: int) -> Optional[Dict[str, str]]:
        """初始化影片上傳 (POST /rest/videos?action=initializeUpload)"""
        async with aiohttp.ClientSession() as session:
            url = f"{self.API_BASE}/rest/videos?action=initializeUpload"
            headers = self._api_headers(access_token)
            data = {
                "initializeUploadRequest": {
                    "owner": self._person_urn,
                    "fileSizeBytes": file_size,
                    "uploadCausalIGUser": True,
                    "uploadRichMediaOnly": False
                }
            }
            
            async with session.post(url, headers=headers, json=data) as response:
                if response.status not in [200, 201]:
                    text = await response.text()
                    logger.error(f"[LinkedIn] 影片初始化失敗: {response.status} {text}")
                    return None
                
                result = await response.json()
                value = result.get("value", {})
                # 影片可能有多個 upload instructions (分段上傳)，取第一個
                upload_instructions = value.get("uploadInstructions", [])
                upload_url = upload_instructions[0]["uploadUrl"] if upload_instructions else value.get("uploadUrl", "")
                return {
                    "uploadUrl": upload_url,
                    "video": value.get("video", "")
                }
    
    async def _upload_binary(self, access_token: str, upload_url: str, media_url: str):
        """下載媒體並上傳到 LinkedIn"""
        async with aiohttp.ClientSession() as session:
            # 下載媒體
            async with session.get(media_url) as resp:
                if resp.status != 200:
                    raise Exception(f"無法下載媒體: HTTP {resp.status}")
                media_data = await resp.read()
            
            # 上傳到 LinkedIn
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/octet-stream",
            }
            
            async with session.put(upload_url, headers=headers, data=media_data) as response:
                if response.status not in [200, 201]:
                    text = await response.text()
                    raise Exception(f"LinkedIn 媒體上傳失敗: {response.status} {text}")
    
    async def delete_post(self, access_token: str, post_id: str) -> bool:
        """刪除貼文 (Community Management API)"""
        async with aiohttp.ClientSession() as session:
            url = f"{self.API_BASE}/rest/posts/{post_id}"
            headers = self._api_headers(access_token)
            
            async with session.delete(url, headers=headers) as response:
                return response.status == 204
    
    # ==================== 成效分析 ====================
    
    async def get_connections_count(self, access_token: str) -> int:
        """
        獲取用戶的一級連結數量
        
        Returns:
            連結數量
        """
        if not self._person_urn:
            await self.get_user_profile(access_token)
        
        async with aiohttp.ClientSession() as session:
            url = f"{self.API_BASE}/v2/networkSizes/{self._person_urn}"
            headers = {"Authorization": f"Bearer {access_token}"}
            params = {"edgeType": "FIRST_DEGREE"}
            
            async with session.get(url, headers=headers, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get("firstDegreeSize", 0)
                return 0
    
    async def get_posts(self, access_token: str, count: int = 50) -> List[Dict[str, Any]]:
        """
        獲取用戶的貼文列表 (Community Management API)
        
        Args:
            access_token: 訪問令牌
            count: 最多返回數量
            
        Returns:
            貼文列表
        """
        if not self._person_urn:
            await self.get_user_profile(access_token)
        
        async with aiohttp.ClientSession() as session:
            url = f"{self.API_BASE}/rest/posts"
            headers = self._api_headers(access_token)
            params = {
                "q": "author",
                "author": self._person_urn,
                "count": count
            }
            
            async with session.get(url, headers=headers, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get("elements", [])
                return []
    
    async def get_post_stats(self, access_token: str, post_id: str) -> Dict[str, Any]:
        """
        獲取單個貼文的互動統計
        
        Args:
            access_token: 訪問令牌
            post_id: 貼文 ID 或 URN
            
        Returns:
            貼文統計數據
        """
        async with aiohttp.ClientSession() as session:
            url = f"{self.API_BASE}/v2/socialActions/{post_id}"
            headers = {"Authorization": f"Bearer {access_token}"}
            
            async with session.get(url, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    return {
                        "likes": data.get("likesSummary", {}).get("totalLikes", 0),
                        "comments": data.get("commentsSummary", {}).get("totalFirstLevelComments", 0),
                    }
                return {"likes": 0, "comments": 0}
    
    async def get_share_statistics(self, access_token: str, share_id: str) -> Dict[str, Any]:
        """
        獲取分享的統計數據（需要 Marketing API 權限）
        
        Args:
            access_token: 訪問令牌
            share_id: 分享 ID
            
        Returns:
            分享統計數據
        """
        async with aiohttp.ClientSession() as session:
            url = f"{self.API_BASE}/v2/organizationalEntityShareStatistics"
            headers = {"Authorization": f"Bearer {access_token}"}
            params = {
                "q": "organizationalEntity",
                "organizationalEntity": share_id
            }
            
            async with session.get(url, headers=headers, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    elements = data.get("elements", [])
                    if elements:
                        stats = elements[0].get("totalShareStatistics", {})
                        return {
                            "impressions": stats.get("impressionCount", 0),
                            "clicks": stats.get("clickCount", 0),
                            "likes": stats.get("likeCount", 0),
                            "comments": stats.get("commentCount", 0),
                            "shares": stats.get("shareCount", 0),
                            "engagement": stats.get("engagement", 0)
                        }
                return {}


# ============================================================
# Publisher 別名（供 scheduler_tasks.get_platform_publisher 使用）
# ============================================================

class LinkedInPublisher(LinkedInPlatform):
    """LinkedIn 發布器 — 繼承 LinkedInPlatform 的完整功能"""
    pass