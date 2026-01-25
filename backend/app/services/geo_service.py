"""
IP 地理位置服務
================

提供 IP 地址到國家/地區的轉換功能，用於：
1. 用戶註冊時記錄 IP 國籍
2. 生成內容時取得用戶地區
3. 個性化 Prompt 變量

使用免費的 IP-API 服務（限制：45 次/分鐘）
"""

import aiohttp
import asyncio
from typing import Optional, Dict, Any
from functools import lru_cache
import time


# IP 國家名稱對照表（英文 -> 繁體中文）
COUNTRY_NAME_MAP = {
    "Taiwan": "台灣",
    "Hong Kong": "香港",
    "Macau": "澳門",
    "China": "中國大陸",
    "Japan": "日本",
    "South Korea": "韓國",
    "Singapore": "新加坡",
    "Malaysia": "馬來西亞",
    "Thailand": "泰國",
    "Vietnam": "越南",
    "Philippines": "菲律賓",
    "Indonesia": "印尼",
    "United States": "美國",
    "Canada": "加拿大",
    "United Kingdom": "英國",
    "Australia": "澳洲",
    "New Zealand": "紐西蘭",
    "Germany": "德國",
    "France": "法國",
    "Italy": "義大利",
    "Spain": "西班牙",
    "Netherlands": "荷蘭",
}

# 國家對應的文化/語言特性（用於 Prompt 個性化）
COUNTRY_CULTURE_MAP = {
    "台灣": {
        "language": "繁體中文",
        "culture": "台灣文化",
        "currency": "TWD",
        "timezone": "Asia/Taipei",
        "social_platforms": ["Instagram", "Facebook", "LINE", "Threads"],
        "content_style": "親切、活潑、帶有台灣在地用語",
        "hashtag_style": "中英混搭，包含台灣熱門標籤",
    },
    "香港": {
        "language": "繁體中文",
        "culture": "香港文化",
        "currency": "HKD",
        "timezone": "Asia/Hong_Kong",
        "social_platforms": ["Instagram", "Facebook", "小紅書"],
        "content_style": "精煉、時尚、粵語用詞",
        "hashtag_style": "中英混搭，香港本地熱門標籤",
    },
    "中國大陸": {
        "language": "簡體中文",
        "culture": "中國文化",
        "currency": "CNY",
        "timezone": "Asia/Shanghai",
        "social_platforms": ["小紅書", "抖音", "微博"],
        "content_style": "接地氣、流行用語、網路梗",
        "hashtag_style": "使用熱搜話題標籤",
    },
    "日本": {
        "language": "日文",
        "culture": "日本文化",
        "currency": "JPY",
        "timezone": "Asia/Tokyo",
        "social_platforms": ["Instagram", "Twitter/X", "LINE"],
        "content_style": "禮貌、細膩、含蓄",
        "hashtag_style": "日文標籤為主",
    },
    "美國": {
        "language": "英文",
        "culture": "美國文化",
        "currency": "USD",
        "timezone": "America/New_York",
        "social_platforms": ["Instagram", "TikTok", "Twitter/X"],
        "content_style": "直接、幽默、多元包容",
        "hashtag_style": "英文熱門標籤",
    },
}

# 預設文化設定（當國家不在對照表時使用）
DEFAULT_CULTURE = {
    "language": "繁體中文",
    "culture": "國際化",
    "currency": "TWD",
    "timezone": "Asia/Taipei",
    "social_platforms": ["Instagram", "Facebook"],
    "content_style": "專業、友善、國際化",
    "hashtag_style": "中英混搭",
}


class GeoService:
    """IP 地理位置服務"""
    
    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._cache_ttl = 3600  # 快取 1 小時
        self._last_request_time = 0
        self._rate_limit_delay = 1.5  # 每次請求間隔 1.5 秒（避免超過 45次/分鐘）
    
    async def get_country_from_ip(self, ip: str) -> Optional[str]:
        """
        從 IP 地址取得國家名稱（繁體中文）
        
        Args:
            ip: IP 地址
            
        Returns:
            國家名稱（繁體中文），如 "台灣"、"香港"
        """
        if not ip or ip in ("127.0.0.1", "localhost", "::1"):
            return "台灣"  # 本地開發預設台灣
        
        # 檢查快取
        cache_key = ip
        if cache_key in self._cache:
            cached = self._cache[cache_key]
            if time.time() - cached["timestamp"] < self._cache_ttl:
                return cached["country"]
        
        # Rate limiting
        elapsed = time.time() - self._last_request_time
        if elapsed < self._rate_limit_delay:
            await asyncio.sleep(self._rate_limit_delay - elapsed)
        
        try:
            async with aiohttp.ClientSession() as session:
                # 使用免費的 ip-api.com 服務
                url = f"http://ip-api.com/json/{ip}?fields=status,country,countryCode"
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as response:
                    self._last_request_time = time.time()
                    
                    if response.status == 200:
                        data = await response.json()
                        if data.get("status") == "success":
                            country_en = data.get("country", "")
                            # 轉換為繁體中文
                            country_zh = COUNTRY_NAME_MAP.get(country_en, country_en)
                            
                            # 快取結果
                            self._cache[cache_key] = {
                                "country": country_zh,
                                "country_code": data.get("countryCode"),
                                "timestamp": time.time()
                            }
                            
                            return country_zh
                            
        except Exception as e:
            print(f"[GeoService] IP 查詢失敗 ({ip}): {e}")
        
        return None
    
    def get_culture_info(self, country: Optional[str]) -> Dict[str, Any]:
        """
        取得國家的文化/內容風格資訊
        
        Args:
            country: 國家名稱（繁體中文）
            
        Returns:
            文化資訊字典
        """
        if country and country in COUNTRY_CULTURE_MAP:
            return COUNTRY_CULTURE_MAP[country]
        return DEFAULT_CULTURE
    
    def get_user_locale(
        self,
        user_country: Optional[str] = None,
        address_country: Optional[str] = None,
        register_ip_country: Optional[str] = None,
        current_ip_country: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        根據優先順序取得用戶地區資訊
        
        優先順序：
        1. 用戶自填國籍
        2. 地址國籍
        3. 註冊時 IP 國籍
        4. 當前 IP 國籍
        5. 預設（台灣）
        
        Args:
            user_country: 用戶自填國籍
            address_country: 地址國籍
            register_ip_country: 註冊時 IP 國籍
            current_ip_country: 當前 IP 國籍
            
        Returns:
            包含 country 和 culture_info 的字典
        """
        # 按優先順序選擇國家
        country = (
            user_country or 
            address_country or 
            register_ip_country or 
            current_ip_country or 
            "台灣"
        )
        
        culture_info = self.get_culture_info(country)
        
        return {
            "country": country,
            "source": self._get_country_source(
                user_country, address_country, register_ip_country, current_ip_country
            ),
            **culture_info
        }
    
    def _get_country_source(
        self,
        user_country: Optional[str],
        address_country: Optional[str],
        register_ip_country: Optional[str],
        current_ip_country: Optional[str]
    ) -> str:
        """取得國家資訊來源"""
        if user_country:
            return "user_profile"
        if address_country:
            return "address"
        if register_ip_country:
            return "register_ip"
        if current_ip_country:
            return "current_ip"
        return "default"


# 全域實例
geo_service = GeoService()


# 便捷函數
async def get_country_from_ip(ip: str) -> Optional[str]:
    """從 IP 地址取得國家"""
    return await geo_service.get_country_from_ip(ip)


def get_user_locale(
    user_country: Optional[str] = None,
    address_country: Optional[str] = None,
    register_ip_country: Optional[str] = None,
    current_ip_country: Optional[str] = None
) -> Dict[str, Any]:
    """取得用戶地區資訊"""
    return geo_service.get_user_locale(
        user_country, address_country, register_ip_country, current_ip_country
    )
