"""
Google Analytics 4 (GA4) 數據整合服務
使用 Google Analytics Data API
"""

import os
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass
import json
import aiohttp

try:
    from google.analytics.data_v1beta import BetaAnalyticsDataClient
    from google.analytics.data_v1beta.types import (
        RunReportRequest,
        DateRange,
        Dimension,
        Metric,
        FilterExpression,
        Filter,
        OrderBy,
    )
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    GA4_AVAILABLE = True
except ImportError:
    GA4_AVAILABLE = False


@dataclass
class GA4Config:
    """GA4 配置"""
    property_id: str  # GA4 Property ID (格式: properties/XXXXX)
    client_id: str
    client_secret: str
    redirect_uri: str


@dataclass
class TrafficData:
    """流量數據"""
    date: str
    sessions: int
    users: int
    pageviews: int
    bounce_rate: float
    avg_session_duration: float


@dataclass
class PageData:
    """頁面數據"""
    page_path: str
    page_title: str
    views: int
    unique_users: int
    avg_time_on_page: float


@dataclass
class ReferralData:
    """流量來源數據"""
    source: str
    medium: str
    sessions: int
    users: int
    conversions: int


class GA4Service:
    """
    Google Analytics 4 數據服務
    
    使用方式:
    1. 用戶需要先通過 OAuth 授權 GA4 存取權限
    2. 存儲 access_token 和 refresh_token
    3. 使用此服務獲取 GA4 數據
    """
    
    OAUTH_SCOPES = [
        "https://www.googleapis.com/auth/analytics.readonly"
    ]
    
    def __init__(self, config: GA4Config = None):
        self.config = config or GA4Config(
            property_id=os.getenv("GA4_PROPERTY_ID", ""),
            client_id=os.getenv("GOOGLE_CLIENT_ID", ""),
            client_secret=os.getenv("GOOGLE_CLIENT_SECRET", ""),
            redirect_uri=os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/oauth/google/callback")
        )
        self._client = None
    
    def get_auth_url(self, state: str) -> str:
        """生成 Google OAuth 授權 URL"""
        from urllib.parse import urlencode
        
        params = {
            "client_id": self.config.client_id,
            "redirect_uri": self.config.redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.OAUTH_SCOPES),
            "access_type": "offline",
            "prompt": "consent",
            "state": state
        }
        return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    
    async def exchange_code_for_token(self, code: str) -> Dict[str, Any]:
        """用授權碼交換 Access Token"""
        async with aiohttp.ClientSession() as session:
            data = {
                "client_id": self.config.client_id,
                "client_secret": self.config.client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": self.config.redirect_uri
            }
            
            async with session.post(
                "https://oauth2.googleapis.com/token",
                data=data
            ) as response:
                result = await response.json()
                
                if "error" in result:
                    raise Exception(f"Token exchange failed: {result.get('error_description', result['error'])}")
                
                return {
                    "access_token": result["access_token"],
                    "refresh_token": result.get("refresh_token"),
                    "expires_in": result.get("expires_in", 3600),
                    "token_type": result.get("token_type", "Bearer")
                }
    
    async def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """刷新 Access Token"""
        async with aiohttp.ClientSession() as session:
            data = {
                "client_id": self.config.client_id,
                "client_secret": self.config.client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token"
            }
            
            async with session.post(
                "https://oauth2.googleapis.com/token",
                data=data
            ) as response:
                result = await response.json()
                
                if "error" in result:
                    raise Exception(f"Token refresh failed: {result.get('error_description', result['error'])}")
                
                return {
                    "access_token": result["access_token"],
                    "expires_in": result.get("expires_in", 3600)
                }
    
    def _get_client(self, access_token: str) -> "BetaAnalyticsDataClient":
        """獲取 GA4 客戶端"""
        if not GA4_AVAILABLE:
            raise Exception("Google Analytics library not installed. Run: pip install google-analytics-data")
        
        credentials = Credentials(
            token=access_token,
            client_id=self.config.client_id,
            client_secret=self.config.client_secret
        )
        
        return BetaAnalyticsDataClient(credentials=credentials)
    
    async def get_traffic_overview(
        self,
        access_token: str,
        property_id: str,
        start_date: str = "30daysAgo",
        end_date: str = "today"
    ) -> Dict[str, Any]:
        """
        獲取流量概覽
        
        Args:
            access_token: Google OAuth access token
            property_id: GA4 Property ID (如: 123456789)
            start_date: 開始日期 (格式: YYYY-MM-DD 或 NdaysAgo)
            end_date: 結束日期
            
        Returns:
            流量數據字典
        """
        if not GA4_AVAILABLE:
            # 返回模擬數據用於開發
            return self._get_mock_traffic_data()
        
        client = self._get_client(access_token)
        
        request = RunReportRequest(
            property=f"properties/{property_id}",
            date_ranges=[DateRange(start_date=start_date, end_date=end_date)],
            dimensions=[Dimension(name="date")],
            metrics=[
                Metric(name="sessions"),
                Metric(name="activeUsers"),
                Metric(name="screenPageViews"),
                Metric(name="bounceRate"),
                Metric(name="averageSessionDuration"),
                Metric(name="newUsers"),
                Metric(name="engagedSessions")
            ],
            order_bys=[OrderBy(dimension=OrderBy.DimensionOrderBy(dimension_name="date"))]
        )
        
        response = client.run_report(request)
        
        daily_data = []
        totals = {
            "sessions": 0,
            "users": 0,
            "pageviews": 0,
            "new_users": 0,
            "engaged_sessions": 0
        }
        
        for row in response.rows:
            date = row.dimension_values[0].value
            sessions = int(row.metric_values[0].value)
            users = int(row.metric_values[1].value)
            pageviews = int(row.metric_values[2].value)
            bounce_rate = float(row.metric_values[3].value)
            avg_duration = float(row.metric_values[4].value)
            new_users = int(row.metric_values[5].value)
            engaged = int(row.metric_values[6].value)
            
            daily_data.append({
                "date": f"{date[:4]}-{date[4:6]}-{date[6:]}",
                "sessions": sessions,
                "users": users,
                "pageviews": pageviews,
                "bounce_rate": round(bounce_rate * 100, 2),
                "avg_session_duration": round(avg_duration, 2)
            })
            
            totals["sessions"] += sessions
            totals["users"] += users
            totals["pageviews"] += pageviews
            totals["new_users"] += new_users
            totals["engaged_sessions"] += engaged
        
        return {
            "period": {"start": start_date, "end": end_date},
            "totals": totals,
            "daily": daily_data
        }
    
    async def get_top_pages(
        self,
        access_token: str,
        property_id: str,
        start_date: str = "30daysAgo",
        end_date: str = "today",
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        獲取熱門頁面
        """
        if not GA4_AVAILABLE:
            return self._get_mock_top_pages()
        
        client = self._get_client(access_token)
        
        request = RunReportRequest(
            property=f"properties/{property_id}",
            date_ranges=[DateRange(start_date=start_date, end_date=end_date)],
            dimensions=[
                Dimension(name="pagePath"),
                Dimension(name="pageTitle")
            ],
            metrics=[
                Metric(name="screenPageViews"),
                Metric(name="activeUsers"),
                Metric(name="averageSessionDuration")
            ],
            order_bys=[
                OrderBy(metric=OrderBy.MetricOrderBy(metric_name="screenPageViews"), desc=True)
            ],
            limit=limit
        )
        
        response = client.run_report(request)
        
        pages = []
        for row in response.rows:
            pages.append({
                "path": row.dimension_values[0].value,
                "title": row.dimension_values[1].value,
                "views": int(row.metric_values[0].value),
                "users": int(row.metric_values[1].value),
                "avg_time": round(float(row.metric_values[2].value), 2)
            })
        
        return pages
    
    async def get_traffic_sources(
        self,
        access_token: str,
        property_id: str,
        start_date: str = "30daysAgo",
        end_date: str = "today",
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        獲取流量來源
        """
        if not GA4_AVAILABLE:
            return self._get_mock_traffic_sources()
        
        client = self._get_client(access_token)
        
        request = RunReportRequest(
            property=f"properties/{property_id}",
            date_ranges=[DateRange(start_date=start_date, end_date=end_date)],
            dimensions=[
                Dimension(name="sessionSource"),
                Dimension(name="sessionMedium")
            ],
            metrics=[
                Metric(name="sessions"),
                Metric(name="activeUsers"),
                Metric(name="conversions")
            ],
            order_bys=[
                OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True)
            ],
            limit=limit
        )
        
        response = client.run_report(request)
        
        sources = []
        for row in response.rows:
            sources.append({
                "source": row.dimension_values[0].value,
                "medium": row.dimension_values[1].value,
                "sessions": int(row.metric_values[0].value),
                "users": int(row.metric_values[1].value),
                "conversions": int(row.metric_values[2].value)
            })
        
        return sources
    
    async def get_realtime_users(
        self,
        access_token: str,
        property_id: str
    ) -> Dict[str, Any]:
        """
        獲取即時用戶數據
        """
        if not GA4_AVAILABLE:
            return self._get_mock_realtime()
        
        client = self._get_client(access_token)
        
        from google.analytics.data_v1beta.types import RunRealtimeReportRequest
        
        request = RunRealtimeReportRequest(
            property=f"properties/{property_id}",
            dimensions=[Dimension(name="country")],
            metrics=[Metric(name="activeUsers")]
        )
        
        response = client.run_realtime_report(request)
        
        total_users = 0
        by_country = []
        
        for row in response.rows:
            users = int(row.metric_values[0].value)
            total_users += users
            by_country.append({
                "country": row.dimension_values[0].value,
                "users": users
            })
        
        return {
            "active_users": total_users,
            "by_country": by_country[:10]
        }
    
    # ==================== 模擬數據 (開發用) ====================
    
    def _get_mock_traffic_data(self) -> Dict[str, Any]:
        """返回模擬流量數據"""
        import random
        
        daily_data = []
        base_date = datetime.now() - timedelta(days=30)
        
        for i in range(30):
            date = base_date + timedelta(days=i)
            sessions = random.randint(800, 1500)
            daily_data.append({
                "date": date.strftime("%Y-%m-%d"),
                "sessions": sessions,
                "users": int(sessions * 0.85),
                "pageviews": int(sessions * 2.5),
                "bounce_rate": round(random.uniform(35, 55), 2),
                "avg_session_duration": round(random.uniform(90, 180), 2)
            })
        
        return {
            "period": {"start": "30daysAgo", "end": "today"},
            "totals": {
                "sessions": sum(d["sessions"] for d in daily_data),
                "users": sum(d["users"] for d in daily_data),
                "pageviews": sum(d["pageviews"] for d in daily_data),
                "new_users": int(sum(d["users"] for d in daily_data) * 0.4),
                "engaged_sessions": int(sum(d["sessions"] for d in daily_data) * 0.6)
            },
            "daily": daily_data
        }
    
    def _get_mock_top_pages(self) -> List[Dict[str, Any]]:
        """返回模擬熱門頁面"""
        return [
            {"path": "/", "title": "首頁", "views": 15420, "users": 8500, "avg_time": 45.2},
            {"path": "/blog/ai-marketing-2024", "title": "AI 行銷趨勢 2024", "views": 8730, "users": 6200, "avg_time": 180.5},
            {"path": "/products", "title": "產品介紹", "views": 6540, "users": 4100, "avg_time": 120.3},
            {"path": "/blog/social-media-tips", "title": "社群行銷技巧", "views": 5280, "users": 3800, "avg_time": 210.8},
            {"path": "/pricing", "title": "定價方案", "views": 4120, "users": 2900, "avg_time": 90.1},
            {"path": "/about", "title": "關於我們", "views": 2850, "users": 2100, "avg_time": 65.4},
            {"path": "/contact", "title": "聯絡我們", "views": 1920, "users": 1500, "avg_time": 40.2},
            {"path": "/blog/content-strategy", "title": "內容策略指南", "views": 1650, "users": 1200, "avg_time": 195.6},
        ]
    
    def _get_mock_traffic_sources(self) -> List[Dict[str, Any]]:
        """返回模擬流量來源"""
        return [
            {"source": "google", "medium": "organic", "sessions": 12500, "users": 9800, "conversions": 450},
            {"source": "facebook", "medium": "social", "sessions": 5200, "users": 4100, "conversions": 180},
            {"source": "(direct)", "medium": "(none)", "sessions": 4800, "users": 3900, "conversions": 220},
            {"source": "instagram", "medium": "social", "sessions": 3100, "users": 2600, "conversions": 95},
            {"source": "line", "medium": "social", "sessions": 2400, "users": 2000, "conversions": 120},
            {"source": "google", "medium": "cpc", "sessions": 1800, "users": 1500, "conversions": 85},
            {"source": "linkedin", "medium": "social", "sessions": 950, "users": 780, "conversions": 45},
            {"source": "youtube", "medium": "referral", "sessions": 620, "users": 520, "conversions": 25},
        ]
    
    def _get_mock_realtime(self) -> Dict[str, Any]:
        """返回模擬即時數據"""
        import random
        return {
            "active_users": random.randint(15, 85),
            "by_country": [
                {"country": "Taiwan", "users": random.randint(20, 50)},
                {"country": "United States", "users": random.randint(5, 15)},
                {"country": "Hong Kong", "users": random.randint(3, 10)},
                {"country": "Japan", "users": random.randint(2, 8)},
            ]
        }


# 單例實例
ga4_service = GA4Service()
