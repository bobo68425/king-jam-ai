"""
社群平台基礎類別
定義所有平台共用的接口與配置
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum


class ContentType(Enum):
    """發布內容類型"""
    IMAGE = "image"
    VIDEO = "video"
    TEXT = "text"
    CAROUSEL = "carousel"  # 多圖輪播
    STORY = "story"
    REEL = "reel"


@dataclass
class PlatformConfig:
    """平台配置"""
    platform_id: str
    name: str
    client_id: str
    client_secret: str
    redirect_uri: str
    scopes: List[str]
    auth_url: str
    token_url: str
    api_base_url: str
    supported_content_types: List[ContentType]
    max_video_duration: int = 60  # 秒
    max_image_size: int = 8 * 1024 * 1024  # 8MB
    max_video_size: int = 100 * 1024 * 1024  # 100MB
    max_caption_length: int = 2200


@dataclass
class AuthToken:
    """授權令牌"""
    access_token: str
    refresh_token: Optional[str] = None
    expires_at: Optional[datetime] = None
    token_type: str = "Bearer"
    scope: Optional[str] = None
    extra_data: Optional[Dict[str, Any]] = None


@dataclass
class UserProfile:
    """用戶資料"""
    platform_id: str
    platform_user_id: str
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    profile_url: Optional[str] = None
    followers_count: Optional[int] = None
    extra_data: Optional[Dict[str, Any]] = None


@dataclass
class PublishContent:
    """發布內容"""
    content_type: ContentType
    caption: str
    media_urls: List[str] = None
    hashtags: List[str] = None
    location: Optional[str] = None
    scheduled_time: Optional[datetime] = None
    extra_params: Optional[Dict[str, Any]] = None


@dataclass
class PublishResult:
    """發布結果"""
    success: bool
    platform_post_id: Optional[str] = None
    platform_post_url: Optional[str] = None
    error_message: Optional[str] = None
    error_code: Optional[str] = None
    extra_data: Optional[Dict[str, Any]] = None


class BasePlatform(ABC):
    """
    社群平台基礎抽象類別
    所有平台實作都必須繼承此類別
    """
    
    def __init__(self, config: PlatformConfig):
        self.config = config
        self._session = None
    
    @property
    def platform_id(self) -> str:
        return self.config.platform_id
    
    @property
    def name(self) -> str:
        return self.config.name
    
    # ==================== OAuth 授權流程 ====================
    
    @abstractmethod
    def get_auth_url(self, state: str) -> str:
        """
        生成 OAuth 授權 URL
        
        Args:
            state: 防止 CSRF 的狀態碼
            
        Returns:
            授權頁面 URL
        """
        pass
    
    @abstractmethod
    async def exchange_code_for_token(self, code: str) -> AuthToken:
        """
        用授權碼交換 Access Token
        
        Args:
            code: OAuth 授權碼
            
        Returns:
            AuthToken 對象
        """
        pass
    
    @abstractmethod
    async def refresh_token(self, refresh_token: str) -> AuthToken:
        """
        刷新 Access Token
        
        Args:
            refresh_token: 刷新令牌
            
        Returns:
            新的 AuthToken 對象
        """
        pass
    
    @abstractmethod
    async def revoke_token(self, access_token: str) -> bool:
        """
        撤銷授權
        
        Args:
            access_token: 要撤銷的令牌
            
        Returns:
            是否成功
        """
        pass
    
    # ==================== 用戶資料 ====================
    
    @abstractmethod
    async def get_user_profile(self, access_token: str) -> UserProfile:
        """
        獲取用戶資料
        
        Args:
            access_token: 訪問令牌
            
        Returns:
            UserProfile 對象
        """
        pass
    
    # ==================== 內容發布 ====================
    
    @abstractmethod
    async def publish(
        self, 
        access_token: str, 
        content: PublishContent
    ) -> PublishResult:
        """
        發布內容
        
        Args:
            access_token: 訪問令牌
            content: 發布內容
            
        Returns:
            PublishResult 對象
        """
        pass
    
    @abstractmethod
    async def delete_post(
        self, 
        access_token: str, 
        post_id: str
    ) -> bool:
        """
        刪除發布的內容
        
        Args:
            access_token: 訪問令牌
            post_id: 平台貼文 ID
            
        Returns:
            是否成功
        """
        pass
    
    # ==================== 輔助方法 ====================
    
    def validate_content(self, content: PublishContent) -> List[str]:
        """
        驗證內容是否符合平台規範
        
        Returns:
            錯誤訊息列表，空表示通過
        """
        errors = []
        
        # 檢查內容類型
        if content.content_type not in self.config.supported_content_types:
            errors.append(f"{self.name} 不支援 {content.content_type.value} 類型內容")
        
        # 檢查文案長度
        if content.caption and len(content.caption) > self.config.max_caption_length:
            errors.append(f"文案長度超過 {self.config.max_caption_length} 字元限制")
        
        return errors
    
    def format_hashtags(self, hashtags: List[str]) -> str:
        """格式化 Hashtags"""
        if not hashtags:
            return ""
        formatted = []
        for tag in hashtags:
            tag = tag.strip().replace(" ", "")
            if not tag.startswith("#"):
                tag = f"#{tag}"
            formatted.append(tag)
        return " ".join(formatted)
    
    async def _make_request(
        self,
        method: str,
        url: str,
        access_token: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        發送 API 請求
        """
        import aiohttp
        
        headers = kwargs.pop("headers", {})
        headers["Authorization"] = f"Bearer {access_token}"
        
        async with aiohttp.ClientSession() as session:
            async with session.request(method, url, headers=headers, **kwargs) as response:
                data = await response.json()
                if response.status >= 400:
                    raise Exception(f"API Error: {response.status} - {data}")
                return data
