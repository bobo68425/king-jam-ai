"""
LinkedIn 平台整合
使用 LinkedIn Marketing API
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


class LinkedInPlatform(BasePlatform):
    """
    LinkedIn 平台整合
    
    LinkedIn API 需求:
    - 創建 LinkedIn Developer Application
    - 需要 Marketing Developer Platform 權限
    - 需要申請以下產品: Share on LinkedIn, Sign In with LinkedIn
    
    支援功能:
    - 文字貼文
    - 圖片貼文 (單張)
    - 影片貼文
    - 多圖貼文
    """
    
    API_BASE = "https://api.linkedin.com/v2"
    
    @classmethod
    def create_config(cls) -> PlatformConfig:
        """創建 LinkedIn 配置"""
        return PlatformConfig(
            platform_id="linkedin",
            name="LinkedIn",
            client_id=os.getenv("LINKEDIN_CLIENT_ID", ""),
            client_secret=os.getenv("LINKEDIN_CLIENT_SECRET", ""),
            redirect_uri=os.getenv("LINKEDIN_REDIRECT_URI", "http://localhost:8000/oauth/linkedin/callback"),
            scopes=[
                "openid",                       # OpenID Connect
                "profile",                      # 基本個人檔案
                "email",                        # 電子郵件
                "w_member_social",              # 發布貼文
                "r_liteprofile",                # 讀取精簡個人檔案
                "r_1st_connections_size",       # 讀取一級連結數量
            ],
            auth_url="https://www.linkedin.com/oauth/v2/authorization",
            token_url="https://www.linkedin.com/oauth/v2/accessToken",
            api_base_url="https://api.linkedin.com/v2",
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
            # 獲取基本資料
            url = f"{self.API_BASE}/userinfo"
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
    
    # ==================== 內容發布 ====================
    
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
            return PublishResult(success=False, error_message=str(e))
    
    async def _publish_text(self, access_token: str, content: PublishContent) -> PublishResult:
        """發布純文字貼文"""
        async with aiohttp.ClientSession() as session:
            url = f"{self.API_BASE}/ugcPosts"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "X-Restli-Protocol-Version": "2.0.0"
            }
            
            data = {
                "author": self._person_urn,
                "lifecycleState": "PUBLISHED",
                "specificContent": {
                    "com.linkedin.ugc.ShareContent": {
                        "shareCommentary": {
                            "text": content.caption
                        },
                        "shareMediaCategory": "NONE"
                    }
                },
                "visibility": {
                    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                }
            }
            
            async with session.post(url, headers=headers, json=data) as response:
                if response.status not in [200, 201]:
                    text = await response.text()
                    return PublishResult(success=False, error_message=text)
                
                result = await response.json()
                post_id = result.get("id", "")
                
                return PublishResult(
                    success=True,
                    platform_post_id=post_id,
                    platform_post_url=f"https://linkedin.com/feed/update/{post_id}"
                )
    
    async def _publish_image(self, access_token: str, content: PublishContent) -> PublishResult:
        """發布圖片貼文"""
        # Step 1: 註冊上傳
        asset = await self._register_upload(access_token, "image")
        
        # Step 2: 上傳圖片
        await self._upload_media(access_token, asset["uploadUrl"], content.media_urls[0])
        
        # Step 3: 創建貼文
        async with aiohttp.ClientSession() as session:
            url = f"{self.API_BASE}/ugcPosts"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "X-Restli-Protocol-Version": "2.0.0"
            }
            
            data = {
                "author": self._person_urn,
                "lifecycleState": "PUBLISHED",
                "specificContent": {
                    "com.linkedin.ugc.ShareContent": {
                        "shareCommentary": {
                            "text": content.caption
                        },
                        "shareMediaCategory": "IMAGE",
                        "media": [{
                            "status": "READY",
                            "media": asset["asset"]
                        }]
                    }
                },
                "visibility": {
                    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                }
            }
            
            async with session.post(url, headers=headers, json=data) as response:
                if response.status not in [200, 201]:
                    text = await response.text()
                    return PublishResult(success=False, error_message=text)
                
                result = await response.json()
                post_id = result.get("id", "")
                
                return PublishResult(
                    success=True,
                    platform_post_id=post_id,
                    platform_post_url=f"https://linkedin.com/feed/update/{post_id}"
                )
    
    async def _publish_video(self, access_token: str, content: PublishContent) -> PublishResult:
        """發布影片貼文"""
        # Step 1: 註冊影片上傳
        asset = await self._register_upload(access_token, "video")
        
        # Step 2: 上傳影片
        await self._upload_media(access_token, asset["uploadUrl"], content.media_urls[0])
        
        # Step 3: 創建貼文
        async with aiohttp.ClientSession() as session:
            url = f"{self.API_BASE}/ugcPosts"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "X-Restli-Protocol-Version": "2.0.0"
            }
            
            data = {
                "author": self._person_urn,
                "lifecycleState": "PUBLISHED",
                "specificContent": {
                    "com.linkedin.ugc.ShareContent": {
                        "shareCommentary": {
                            "text": content.caption
                        },
                        "shareMediaCategory": "VIDEO",
                        "media": [{
                            "status": "READY",
                            "media": asset["asset"]
                        }]
                    }
                },
                "visibility": {
                    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                }
            }
            
            async with session.post(url, headers=headers, json=data) as response:
                if response.status not in [200, 201]:
                    text = await response.text()
                    return PublishResult(success=False, error_message=text)
                
                result = await response.json()
                post_id = result.get("id", "")
                
                return PublishResult(
                    success=True,
                    platform_post_id=post_id,
                    platform_post_url=f"https://linkedin.com/feed/update/{post_id}"
                )
    
    async def _publish_multi_image(self, access_token: str, content: PublishContent) -> PublishResult:
        """發布多圖貼文"""
        # 上傳所有圖片
        media_list = []
        for url in content.media_urls[:9]:  # LinkedIn 最多 9 張
            asset = await self._register_upload(access_token, "image")
            await self._upload_media(access_token, asset["uploadUrl"], url)
            media_list.append({
                "status": "READY",
                "media": asset["asset"]
            })
        
        # 創建貼文
        async with aiohttp.ClientSession() as session:
            url = f"{self.API_BASE}/ugcPosts"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "X-Restli-Protocol-Version": "2.0.0"
            }
            
            data = {
                "author": self._person_urn,
                "lifecycleState": "PUBLISHED",
                "specificContent": {
                    "com.linkedin.ugc.ShareContent": {
                        "shareCommentary": {
                            "text": content.caption
                        },
                        "shareMediaCategory": "IMAGE",
                        "media": media_list
                    }
                },
                "visibility": {
                    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                }
            }
            
            async with session.post(url, headers=headers, json=data) as response:
                if response.status not in [200, 201]:
                    text = await response.text()
                    return PublishResult(success=False, error_message=text)
                
                result = await response.json()
                post_id = result.get("id", "")
                
                return PublishResult(
                    success=True,
                    platform_post_id=post_id,
                    platform_post_url=f"https://linkedin.com/feed/update/{post_id}"
                )
    
    async def _register_upload(self, access_token: str, media_type: str) -> Dict[str, str]:
        """註冊媒體上傳"""
        async with aiohttp.ClientSession() as session:
            url = f"{self.API_BASE}/assets?action=registerUpload"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "X-Restli-Protocol-Version": "2.0.0"
            }
            
            recipe = "urn:li:digitalmediaRecipe:feedshare-image" if media_type == "image" else "urn:li:digitalmediaRecipe:feedshare-video"
            
            data = {
                "registerUploadRequest": {
                    "recipes": [recipe],
                    "owner": self._person_urn,
                    "serviceRelationships": [{
                        "relationshipType": "OWNER",
                        "identifier": "urn:li:userGeneratedContent"
                    }]
                }
            }
            
            async with session.post(url, headers=headers, json=data) as response:
                result = await response.json()
                
                upload_mechanism = result["value"]["uploadMechanism"]
                upload_url = upload_mechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]["uploadUrl"]
                asset = result["value"]["asset"]
                
                return {"uploadUrl": upload_url, "asset": asset}
    
    async def _upload_media(self, access_token: str, upload_url: str, media_url: str):
        """上傳媒體文件"""
        async with aiohttp.ClientSession() as session:
            # 下載媒體
            async with session.get(media_url) as resp:
                media_data = await resp.read()
            
            # 上傳到 LinkedIn
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/octet-stream"
            }
            
            async with session.put(upload_url, headers=headers, data=media_data) as response:
                if response.status not in [200, 201]:
                    raise Exception(f"Failed to upload media: {response.status}")
    
    async def delete_post(self, access_token: str, post_id: str) -> bool:
        """刪除貼文"""
        async with aiohttp.ClientSession() as session:
            url = f"{self.API_BASE}/ugcPosts/{post_id}"
            headers = {"Authorization": f"Bearer {access_token}"}
            
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
            url = f"{self.API_BASE}/networkSizes/{self._person_urn}"
            headers = {"Authorization": f"Bearer {access_token}"}
            params = {"edgeType": "FIRST_DEGREE"}
            
            async with session.get(url, headers=headers, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get("firstDegreeSize", 0)
                return 0
    
    async def get_posts(self, access_token: str, count: int = 50) -> List[Dict[str, Any]]:
        """
        獲取用戶的貼文列表
        
        Args:
            access_token: 訪問令牌
            count: 最多返回數量
            
        Returns:
            貼文列表
        """
        if not self._person_urn:
            await self.get_user_profile(access_token)
        
        async with aiohttp.ClientSession() as session:
            url = f"{self.API_BASE}/ugcPosts"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "X-Restli-Protocol-Version": "2.0.0"
            }
            params = {
                "q": "authors",
                "authors": f"List({self._person_urn})",
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
            post_id: 貼文 ID
            
        Returns:
            貼文統計數據
        """
        async with aiohttp.ClientSession() as session:
            url = f"{self.API_BASE}/socialActions/{post_id}"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "X-Restli-Protocol-Version": "2.0.0"
            }
            
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
            url = f"{self.API_BASE}/organizationalEntityShareStatistics"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "X-Restli-Protocol-Version": "2.0.0"
            }
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