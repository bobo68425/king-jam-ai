"""
社群平台整合服務
提供各社群平台的 OAuth 授權與內容發布功能
"""

from .base import BasePlatform, PlatformConfig, PublishContent, ContentType, PublishResult
from .meta import MetaPlatform
from .tiktok import TikTokPlatform
from .linkedin import LinkedInPlatform
from .youtube import YouTubePlatform
from .line import LinePlatform

__all__ = [
    "BasePlatform",
    "PlatformConfig",
    "PublishContent",
    "ContentType",
    "PublishResult",
    "MetaPlatform",
    "TikTokPlatform",
    "LinkedInPlatform",
    "YouTubePlatform",
    "LinePlatform",
]
