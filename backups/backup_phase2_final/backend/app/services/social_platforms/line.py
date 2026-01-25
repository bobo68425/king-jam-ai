"""
LINE 平台整合
使用 LINE Messaging API 和 LINE Notify
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


class LinePlatform(BasePlatform):
    """
    LINE 平台整合
    
    支援兩種發布方式:
    1. LINE Official Account (Messaging API) - 推送訊息給追蹤者
    2. LINE VOOM - 發布動態貼文
    
    需求:
    - LINE Developers Console 創建 Provider 和 Channel
    - 啟用 Messaging API
    """
    
    API_BASE = "https://api.line.me/v2"
    
    @classmethod
    def create_config(cls) -> PlatformConfig:
        """創建 LINE 配置"""
        return PlatformConfig(
            platform_id="line",
            name="LINE",
            client_id=os.getenv("LINE_CHANNEL_ID", ""),
            client_secret=os.getenv("LINE_CHANNEL_SECRET", ""),
            redirect_uri=os.getenv("LINE_REDIRECT_URI", "http://localhost:8000/oauth/line/callback"),
            scopes=["profile", "openid"],
            auth_url="https://access.line.me/oauth2/v2.1/authorize",
            token_url="https://api.line.me/oauth2/v2.1/token",
            api_base_url="https://api.line.me/v2",
            supported_content_types=[ContentType.TEXT, ContentType.IMAGE, ContentType.VIDEO],
            max_video_duration=60,  # Messaging API 限制
            max_caption_length=5000
        )
    
    def __init__(self, config: PlatformConfig = None):
        super().__init__(config or self.create_config())
        self._user_id = None
        self._channel_access_token = os.getenv("LINE_CHANNEL_ACCESS_TOKEN", "")
    
    # ==================== OAuth 授權流程 ====================
    
    def get_auth_url(self, state: str) -> str:
        """生成 LINE Login OAuth 授權 URL"""
        params = {
            "response_type": "code",
            "client_id": self.config.client_id,
            "redirect_uri": self.config.redirect_uri,
            "scope": " ".join(self.config.scopes),
            "state": state,
            "bot_prompt": "aggressive"  # 提示用戶加入 Official Account
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
                
                expires_at = datetime.now() + timedelta(seconds=result.get("expires_in", 2592000))
                
                return AuthToken(
                    access_token=result["access_token"],
                    refresh_token=result.get("refresh_token"),
                    expires_at=expires_at,
                    scope=result.get("scope"),
                    extra_data={"id_token": result.get("id_token")}
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
                
                expires_at = datetime.now() + timedelta(seconds=result.get("expires_in", 2592000))
                
                return AuthToken(
                    access_token=result["access_token"],
                    refresh_token=result.get("refresh_token"),
                    expires_at=expires_at
                )
    
    async def revoke_token(self, access_token: str) -> bool:
        """撤銷授權"""
        async with aiohttp.ClientSession() as session:
            url = "https://api.line.me/oauth2/v2.1/revoke"
            data = {
                "access_token": access_token,
                "client_id": self.config.client_id,
                "client_secret": self.config.client_secret
            }
            async with session.post(url, data=data) as response:
                return response.status == 200
    
    # ==================== 用戶資料 ====================
    
    async def get_user_profile(self, access_token: str) -> UserProfile:
        """獲取用戶資料"""
        async with aiohttp.ClientSession() as session:
            url = f"{self.API_BASE}/profile"
            headers = {"Authorization": f"Bearer {access_token}"}
            
            async with session.get(url, headers=headers) as response:
                if response.status != 200:
                    text = await response.text()
                    raise Exception(f"Failed to get user profile: {text}")
                
                data = await response.json()
                self._user_id = data.get("userId")
                
                return UserProfile(
                    platform_id="line",
                    platform_user_id=data.get("userId", ""),
                    username=data.get("displayName", ""),
                    display_name=data.get("displayName"),
                    avatar_url=data.get("pictureUrl"),
                    profile_url=None,
                    extra_data={"status_message": data.get("statusMessage")}
                )
    
    # ==================== 內容發布 ====================
    
    async def publish(self, access_token: str, content: PublishContent) -> PublishResult:
        """
        發布內容
        
        LINE 的發布是推送訊息給 Official Account 的追蹤者
        需要使用 Channel Access Token (不是用戶的 Access Token)
        """
        try:
            if not self._channel_access_token:
                return PublishResult(
                    success=False,
                    error_message="缺少 LINE Channel Access Token，請在環境變數設定 LINE_CHANNEL_ACCESS_TOKEN"
                )
            
            return await self._broadcast_message(content)
        except Exception as e:
            return PublishResult(success=False, error_message=str(e))
    
    async def _broadcast_message(self, content: PublishContent) -> PublishResult:
        """廣播訊息給所有追蹤者"""
        async with aiohttp.ClientSession() as session:
            url = "https://api.line.me/v2/bot/message/broadcast"
            headers = {
                "Authorization": f"Bearer {self._channel_access_token}",
                "Content-Type": "application/json"
            }
            
            messages = []
            
            # 根據內容類型構建訊息
            if content.content_type == ContentType.TEXT:
                messages.append({
                    "type": "text",
                    "text": content.caption
                })
            elif content.content_type == ContentType.IMAGE:
                # 圖片訊息
                for url in content.media_urls[:5]:  # 最多 5 則訊息
                    messages.append({
                        "type": "image",
                        "originalContentUrl": url,
                        "previewImageUrl": url
                    })
                # 加上文案
                if content.caption:
                    messages.insert(0, {
                        "type": "text",
                        "text": content.caption
                    })
            elif content.content_type == ContentType.VIDEO:
                # 影片訊息需要提供預覽圖
                messages.append({
                    "type": "video",
                    "originalContentUrl": content.media_urls[0],
                    "previewImageUrl": content.extra_params.get("preview_url", content.media_urls[0])
                })
                if content.caption:
                    messages.insert(0, {
                        "type": "text",
                        "text": content.caption
                    })
            
            data = {"messages": messages[:5]}  # LINE 一次最多 5 則訊息
            
            async with session.post(url, headers=headers, json=data) as response:
                if response.status != 200:
                    text = await response.text()
                    return PublishResult(success=False, error_message=text)
                
                result = await response.json()
                
                return PublishResult(
                    success=True,
                    extra_data={
                        "sent_messages": len(messages),
                        "response": result
                    }
                )
    
    async def push_to_user(self, user_id: str, content: PublishContent) -> PublishResult:
        """推送訊息給特定用戶"""
        async with aiohttp.ClientSession() as session:
            url = "https://api.line.me/v2/bot/message/push"
            headers = {
                "Authorization": f"Bearer {self._channel_access_token}",
                "Content-Type": "application/json"
            }
            
            messages = []
            if content.caption:
                messages.append({"type": "text", "text": content.caption})
            
            for media_url in content.media_urls[:4]:
                if content.content_type == ContentType.IMAGE:
                    messages.append({
                        "type": "image",
                        "originalContentUrl": media_url,
                        "previewImageUrl": media_url
                    })
            
            data = {
                "to": user_id,
                "messages": messages[:5]
            }
            
            async with session.post(url, headers=headers, json=data) as response:
                if response.status != 200:
                    text = await response.text()
                    return PublishResult(success=False, error_message=text)
                
                return PublishResult(success=True)
    
    async def delete_post(self, access_token: str, post_id: str) -> bool:
        """LINE 訊息無法刪除"""
        return False
    
    async def get_follower_count(self) -> int:
        """獲取追蹤者數量"""
        async with aiohttp.ClientSession() as session:
            url = "https://api.line.me/v2/bot/followers/ids"
            headers = {"Authorization": f"Bearer {self._channel_access_token}"}
            
            count = 0
            next_token = None
            
            while True:
                params = {"limit": 1000}
                if next_token:
                    params["start"] = next_token
                
                async with session.get(url, headers=headers, params=params) as response:
                    if response.status != 200:
                        break
                    
                    data = await response.json()
                    count += len(data.get("userIds", []))
                    next_token = data.get("next")
                    
                    if not next_token:
                        break
            
            return count
