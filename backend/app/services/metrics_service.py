"""
成效數據服務 (Metrics Service)

負責：
- 從各社群平台 API 獲取成效數據
- 存儲到 ContentMetrics 表
- 計算互動率等衍生指標

支援的平台：
- Instagram (Meta Graph API)
- Facebook (Meta Graph API)
- YouTube (YouTube Data API)
- TikTok (TikTok Marketing API)
- LinkedIn (LinkedIn Marketing API)
- WordPress (WordPress REST API + GA4)
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc

from app.models import (
    User, ScheduledPost, SocialAccount, ContentMetrics, 
    MetricsSyncLog, Post
)

logger = logging.getLogger(__name__)


class MetricsService:
    """成效數據服務"""
    
    def __init__(self, db: Session):
        self.db = db
    
    # ============================================================
    # 獲取單一貼文成效
    # ============================================================
    
    def get_post_insights(
        self, 
        scheduled_post_id: int,
        user_id: int
    ) -> Dict[str, Any]:
        """
        獲取排程貼文的成效洞察數據
        
        Returns:
            dict: 成效數據，包含曝光、互動等指標
        """
        # 檢查排程是否存在
        post = self.db.query(ScheduledPost).filter(
            and_(
                ScheduledPost.id == scheduled_post_id,
                ScheduledPost.user_id == user_id
            )
        ).first()
        
        if not post:
            return None
        
        # 獲取最新的成效數據
        latest_metrics = self.db.query(ContentMetrics).filter(
            ContentMetrics.scheduled_post_id == scheduled_post_id
        ).order_by(desc(ContentMetrics.metric_date)).first()
        
        if latest_metrics:
            # 返回已存儲的數據
            return self._format_metrics_response(latest_metrics)
        
        # 如果沒有數據且已發布，自動同步數據（生成模擬數據）
        if post.status == "published":
            # 嘗試同步數據
            synced = self.sync_post_metrics(post)
            if synced:
                # 重新獲取
                latest_metrics = self.db.query(ContentMetrics).filter(
                    ContentMetrics.scheduled_post_id == scheduled_post_id
                ).order_by(desc(ContentMetrics.metric_date)).first()
                
                if latest_metrics:
                    return self._format_metrics_response(latest_metrics)
        
        # 返回空數據結構
        return self._get_empty_metrics(post)
    
    def _format_metrics_response(self, metrics: ContentMetrics) -> Dict[str, Any]:
        """格式化成效數據回應"""
        # 從 raw_data 中獲取額外資訊
        raw_data = metrics.raw_data or {}
        data_source = raw_data.get("data_source", metrics.platform)
        ga4_connected = raw_data.get("ga4_connected", False)
        note = raw_data.get("note")
        
        return {
            "impressions": metrics.impressions or 0,
            "reach": metrics.reach or 0,
            "engagement": (metrics.likes or 0) + (metrics.comments or 0) + (metrics.shares or 0) + (metrics.saves or 0),
            "likes": metrics.likes or 0,
            "comments": metrics.comments or 0,
            "shares": metrics.shares or 0,
            "clicks": metrics.clicks or 0,
            "saves": metrics.saves or 0,
            "views": metrics.views or 0,
            "engagement_rate": float(metrics.engagement_rate or 0) * 100,  # 轉為百分比
            "watch_time_seconds": metrics.watch_time_seconds or 0,
            "avg_watch_time_seconds": float(metrics.avg_watch_time_seconds or 0),
            "video_completion_rate": float(metrics.video_completion_rate or 0) * 100,
            "followers_gained": metrics.followers_gained or 0,
            "net_followers": metrics.net_followers or 0,
            "platform": metrics.platform,
            "metric_date": metrics.metric_date.isoformat() if metrics.metric_date else None,
            "last_synced_at": metrics.last_synced_at.isoformat() if metrics.last_synced_at else None,
            "sync_status": metrics.sync_status,
            "data_source": data_source,
            "ga4_connected": ga4_connected,
            "note": note
        }
    
    def _get_empty_metrics(self, post: ScheduledPost) -> Dict[str, Any]:
        """返回空的成效數據結構"""
        note = None
        if post.status != "published":
            note = "內容尚未發布，發布後才能查看成效數據"
        elif not post.platform_post_id:
            note = "尚未連接社群平台，請先完成平台授權以獲取成效數據"
        else:
            note = "成效數據尚未同步，請稍後再查看"
        
        return {
            "impressions": 0,
            "reach": 0,
            "engagement": 0,
            "likes": 0,
            "comments": 0,
            "shares": 0,
            "clicks": 0,
            "saves": 0,
            "views": 0,
            "engagement_rate": 0,
            "watch_time_seconds": 0,
            "avg_watch_time_seconds": 0,
            "video_completion_rate": 0,
            "followers_gained": 0,
            "net_followers": 0,
            "platform": post.settings.get("platform") if post.settings else None,
            "metric_date": None,
            "last_synced_at": None,
            "sync_status": "pending",
            "data_source": "not_connected",
            "ga4_connected": False,
            "note": note
        }
    
    # ============================================================
    # 同步貼文成效數據
    # ============================================================
    
    def sync_post_metrics(self, post: ScheduledPost) -> bool:
        """
        同步單一貼文的成效數據
        
        根據貼文關聯的社群帳號，從對應平台 API 獲取數據
        如果沒有真實的平台 API 連接，會生成模擬數據
        """
        if post.status != "published":
            logger.info(f"Post {post.id} is not published, skipping sync")
            return False
        
        # 獲取社群帳號
        account = post.social_account
        platform = None
        
        if account:
            platform = account.platform
        else:
            # 嘗試從 settings 獲取平台資訊
            platform = post.settings.get("platform") if post.settings else None
        
        # 如果沒有指定平台，根據內容類型推測
        if not platform:
            if post.content_type == "blog_post":
                platform = "wordpress"
            elif post.content_type == "short_video":
                platform = "tiktok"
            else:
                platform = "instagram"  # 預設平台
        
        try:
            # 根據平台調用對應的 API（目前使用模擬數據）
            metrics_data = self._fetch_platform_metrics(post, platform, account)
            
            if metrics_data:
                # 儲存或更新成效數據
                self._save_metrics(post, platform, metrics_data)
                return True
            
        except Exception as e:
            logger.error(f"Error syncing metrics for post {post.id}: {e}")
            self._record_sync_error(post, platform, str(e))
        
        return False
    
    def _fetch_platform_metrics(
        self, 
        post: ScheduledPost, 
        platform: str,
        account: Optional[SocialAccount]
    ) -> Optional[Dict[str, Any]]:
        """
        從各平台 API 獲取成效數據
        
        TODO: 實際整合各平台 API
        目前使用模擬數據作為演示
        """
        # 根據平台選擇對應的獲取方法
        fetchers = {
            "instagram": self._fetch_instagram_metrics,
            "facebook": self._fetch_facebook_metrics,
            "youtube": self._fetch_youtube_metrics,
            "tiktok": self._fetch_tiktok_metrics,
            "linkedin": self._fetch_linkedin_metrics,
            "wordpress": self._fetch_wordpress_metrics,
            "threads": self._fetch_threads_metrics,
        }
        
        fetcher = fetchers.get(platform)
        if fetcher:
            return fetcher(post, account)
        
        # 不支援的平台，返回模擬數據
        return self._generate_mock_metrics(post, platform)
    
    # ============================================================
    # 各平台 API 整合（含模擬數據）
    # ============================================================
    
    def _fetch_instagram_metrics(
        self, 
        post: ScheduledPost,
        account: Optional[SocialAccount]
    ) -> Dict[str, Any]:
        """
        從 Instagram Graph API 獲取成效數據
        
        API 文件：https://developers.facebook.com/docs/instagram-api/reference/ig-media/insights
        
        所需權限：
        - instagram_basic
        - instagram_manage_insights
        """
        # TODO: 實際 API 整合
        # 以下為模擬數據
        
        # 檢查是否有必要的認證資訊
        if account and account.access_token:
            # 這裡應該呼叫實際的 Instagram API
            # media_id = post.platform_post_id
            # response = requests.get(
            #     f"https://graph.instagram.com/{media_id}/insights",
            #     params={
            #         "metric": "impressions,reach,engagement,saved",
            #         "access_token": account.access_token
            #     }
            # )
            pass
        
        return self._generate_mock_metrics(post, "instagram")
    
    def _fetch_facebook_metrics(
        self, 
        post: ScheduledPost,
        account: Optional[SocialAccount]
    ) -> Dict[str, Any]:
        """
        從 Facebook Graph API 獲取成效數據
        
        API 文件：https://developers.facebook.com/docs/graph-api/reference/post/insights/
        """
        # TODO: 實際 API 整合
        return self._generate_mock_metrics(post, "facebook")
    
    def _fetch_youtube_metrics(
        self, 
        post: ScheduledPost,
        account: Optional[SocialAccount]
    ) -> Dict[str, Any]:
        """
        從 YouTube Analytics API 獲取成效數據
        
        API 文件：https://developers.google.com/youtube/analytics
        """
        # TODO: 實際 API 整合
        return self._generate_mock_metrics(post, "youtube", is_video=True)
    
    def _fetch_tiktok_metrics(
        self, 
        post: ScheduledPost,
        account: Optional[SocialAccount]
    ) -> Dict[str, Any]:
        """
        從 TikTok Marketing API 獲取成效數據
        
        API 文件：https://developers.tiktok.com/doc/tiktok-api-v2-video-query/
        """
        # TODO: 實際 API 整合
        return self._generate_mock_metrics(post, "tiktok", is_video=True)
    
    def _fetch_linkedin_metrics(
        self, 
        post: ScheduledPost,
        account: Optional[SocialAccount]
    ) -> Dict[str, Any]:
        """
        從 LinkedIn Marketing API 獲取成效數據
        
        API 文件：https://docs.microsoft.com/en-us/linkedin/marketing/
        """
        # TODO: 實際 API 整合
        return self._generate_mock_metrics(post, "linkedin")
    
    def _fetch_wordpress_metrics(
        self, 
        post: ScheduledPost,
        account: Optional[SocialAccount]
    ) -> Dict[str, Any]:
        """
        從 WordPress REST API 獲取真實成效數據
        
        獲取文章的：
        - 評論數 (comments)
        - 瀏覽數 (views) - 需要 Jetpack 或類似外掛
        - 文章狀態
        """
        import requests
        
        # 檢查是否有 WordPress 帳號設定
        if not account or not account.extra_settings:
            logger.warning(f"Post {post.id} has no WordPress account settings")
            return self._generate_mock_metrics(post, "wordpress")
        
        site_url = account.extra_settings.get("site_url", "").rstrip("/")
        if not site_url:
            logger.warning(f"Post {post.id} WordPress account has no site_url")
            return self._generate_mock_metrics(post, "wordpress")
        
        # 嘗試從多個來源獲取文章 ID
        wp_post_id = post.platform_post_id
        
        # 如果沒有 platform_post_id，嘗試從 settings 中獲取
        if not wp_post_id and post.settings:
            wp_post_id = post.settings.get("wordpress_post_id")
        
        # 如果還是沒有，嘗試從 platform_post_url 解析
        if not wp_post_id and post.platform_post_url:
            import re
            # URL 格式可能是 https://site.com/?p=123
            match = re.search(r'\?p=(\d+)', post.platform_post_url)
            if match:
                wp_post_id = match.group(1)
        
        if not wp_post_id:
            logger.info(f"Post {post.id} has no WordPress post ID, using mock data")
            return self._generate_mock_metrics(post, "wordpress")
        
        try:
            # 獲取 WordPress 文章數據
            api_url = f"{site_url}/wp-json/wp/v2/posts/{wp_post_id}"
            response = requests.get(api_url, timeout=10)
            
            if response.status_code != 200:
                logger.warning(f"Failed to fetch WordPress post {wp_post_id}: {response.status_code}")
                return self._generate_mock_metrics(post, "wordpress")
            
            wp_data = response.json()
            
            # 獲取評論數
            comments_count = 0
            comments_url = f"{site_url}/wp-json/wp/v2/comments?post={wp_post_id}"
            try:
                comments_response = requests.get(comments_url, timeout=10)
                if comments_response.status_code == 200:
                    # 使用 X-WP-Total header 獲取總評論數
                    comments_count = int(comments_response.headers.get("X-WP-Total", 0))
            except Exception as e:
                logger.warning(f"Failed to fetch comments for WordPress post {wp_post_id}: {e}")
            
            # WordPress REST API 不直接提供瀏覽數
            # 需要透過 GA4 或其他分析工具獲取
            views = 0
            ga4_connected = False
            
            # 嘗試從 GA4 獲取瀏覽數據（如果用戶有連接 GA4）
            try:
                from app.services.ga4_service import ga4_service
                # 檢查是否有 GA4 設定
                ga4_property_id = account.extra_settings.get("ga4_property_id") if account and account.extra_settings else None
                ga4_access_token = account.extra_settings.get("ga4_access_token") if account and account.extra_settings else None
                
                if ga4_property_id and ga4_access_token:
                    # 獲取特定頁面的瀏覽數據
                    import asyncio
                    loop = asyncio.new_event_loop()
                    top_pages = loop.run_until_complete(
                        ga4_service.get_top_pages(
                            access_token=ga4_access_token,
                            property_id=ga4_property_id,
                            start_date="30daysAgo",
                            end_date="today",
                            limit=100
                        )
                    )
                    loop.close()
                    
                    # 從頁面列表中找到匹配的文章
                    post_url = post.platform_post_url
                    if post_url:
                        from urllib.parse import urlparse
                        post_path = urlparse(post_url).path
                        for page in top_pages:
                            if page.get("path", "").rstrip("/") == post_path.rstrip("/"):
                                views = page.get("views", 0)
                                ga4_connected = True
                                break
            except Exception as e:
                logger.debug(f"GA4 data not available for post {post.id}: {e}")
            
            # 返回真實數據（不使用模擬數據）
            # 瀏覽數如果為 0，表示需要連接 GA4
            return {
                "impressions": views,
                "reach": views,
                "views": views,
                "likes": 0,  # WordPress 沒有按讚功能
                "comments": comments_count,  # 真實評論數
                "shares": 0,  # 無法從 WordPress 獲取
                "saves": 0,  # WordPress 沒有收藏功能
                "clicks": 0,  # 需要 GA4 獲取
                "engagement_rate": 0,
                "followers_gained": 0,
                "followers_lost": 0,
                "net_followers": 0,
                "watch_time_seconds": 0,
                "avg_watch_time_seconds": 0,
                "video_completion_rate": 0,
                "data_source": "wordpress_api" if not ga4_connected else "wordpress_api+ga4",
                "wp_post_id": wp_post_id,
                "wp_post_title": wp_data.get("title", {}).get("rendered", ""),
                "wp_post_status": wp_data.get("status", ""),
                "ga4_connected": ga4_connected,
                "note": None if ga4_connected else "連接 Google Analytics 4 以獲取完整的瀏覽數據"
            }
            
        except Exception as e:
            logger.error(f"Error fetching WordPress metrics for post {post.id}: {e}")
            return self._generate_mock_metrics(post, "wordpress")
    
    def _fetch_threads_metrics(
        self, 
        post: ScheduledPost,
        account: Optional[SocialAccount]
    ) -> Dict[str, Any]:
        """
        從 Threads API 獲取成效數據
        
        API 文件：https://developers.facebook.com/docs/threads
        """
        # TODO: 實際 API 整合
        return self._generate_mock_metrics(post, "threads")
    
    # ============================================================
    # 模擬數據生成（開發/演示用）
    # ============================================================
    
    def _generate_mock_metrics(
        self, 
        post: ScheduledPost, 
        platform: str,
        is_video: bool = False
    ) -> Dict[str, Any]:
        """
        返回未連接狀態的成效數據
        
        當沒有真實的平台 API 連接時，返回空數據並標記為未連接
        讓前端顯示 N/A
        """
        # 返回未連接狀態的數據（所有數值為 0，標記為未連接）
        # 前端會根據 ga4_connected: false 顯示 N/A
        
        if post.content_type == "short_video":
            is_video = True
        
        platform_names = {
            "instagram": "Instagram",
            "facebook": "Facebook",
            "youtube": "YouTube",
            "tiktok": "TikTok",
            "linkedin": "LinkedIn",
            "wordpress": "WordPress",
            "threads": "Threads",
        }
        platform_name = platform_names.get(platform, platform)
        
        return {
            "impressions": 0,
            "reach": 0,
            "views": 0,
            "likes": 0,
            "comments": 0,
            "shares": 0,
            "saves": 0,
            "clicks": 0,
            "engagement_rate": 0,
            "followers_gained": 0,
            "followers_lost": 0,
            "net_followers": 0,
            "watch_time_seconds": 0,
            "avg_watch_time_seconds": 0,
            "video_completion_rate": 0,
            "data_source": "not_connected",
            "ga4_connected": False,
            "note": f"尚未連接 {platform_name} 帳號，請先完成平台授權以獲取真實成效數據"
        }
    
    # ============================================================
    # 數據儲存
    # ============================================================
    
    def _save_metrics(
        self, 
        post: ScheduledPost, 
        platform: str,
        metrics_data: Dict[str, Any]
    ):
        """儲存成效數據到資料庫"""
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        
        # 檢查今天是否已有記錄
        existing = self.db.query(ContentMetrics).filter(
            and_(
                ContentMetrics.scheduled_post_id == post.id,
                ContentMetrics.metric_date == today
            )
        ).first()
        
        if existing:
            # 更新現有記錄
            for key, value in metrics_data.items():
                if hasattr(existing, key):
                    setattr(existing, key, value)
            existing.last_synced_at = datetime.utcnow()
            existing.sync_status = "synced"
        else:
            # 創建新記錄
            new_metrics = ContentMetrics(
                user_id=post.user_id,
                scheduled_post_id=post.id,
                platform=platform,
                platform_post_id=post.platform_post_id,
                platform_post_url=post.platform_post_url,
                metric_date=today,
                impressions=metrics_data.get("impressions", 0),
                reach=metrics_data.get("reach", 0),
                views=metrics_data.get("views", 0),
                likes=metrics_data.get("likes", 0),
                comments=metrics_data.get("comments", 0),
                shares=metrics_data.get("shares", 0),
                saves=metrics_data.get("saves", 0),
                clicks=metrics_data.get("clicks", 0),
                engagement_rate=Decimal(str(metrics_data.get("engagement_rate", 0))),
                watch_time_seconds=metrics_data.get("watch_time_seconds", 0),
                avg_watch_time_seconds=Decimal(str(metrics_data.get("avg_watch_time_seconds", 0))),
                video_completion_rate=Decimal(str(metrics_data.get("video_completion_rate", 0))),
                followers_gained=metrics_data.get("followers_gained", 0),
                followers_lost=metrics_data.get("followers_lost", 0),
                net_followers=metrics_data.get("net_followers", 0),
                last_synced_at=datetime.utcnow(),
                sync_status="synced",
                raw_data=metrics_data
            )
            self.db.add(new_metrics)
        
        self.db.commit()
    
    def _record_sync_error(self, post: ScheduledPost, platform: str, error: str):
        """記錄同步錯誤"""
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        
        # 檢查是否已有記錄
        existing = self.db.query(ContentMetrics).filter(
            and_(
                ContentMetrics.scheduled_post_id == post.id,
                ContentMetrics.metric_date == today
            )
        ).first()
        
        if existing:
            existing.sync_status = "failed"
            existing.sync_error = error
            existing.last_synced_at = datetime.utcnow()
        else:
            new_metrics = ContentMetrics(
                user_id=post.user_id,
                scheduled_post_id=post.id,
                platform=platform,
                metric_date=today,
                sync_status="failed",
                sync_error=error,
                last_synced_at=datetime.utcnow()
            )
            self.db.add(new_metrics)
        
        self.db.commit()
    
    # ============================================================
    # 批量同步
    # ============================================================
    
    def sync_all_published_posts(self, user_id: Optional[int] = None) -> Dict[str, int]:
        """
        同步所有已發布貼文的成效數據
        
        Args:
            user_id: 可選，只同步特定用戶的貼文
        
        Returns:
            dict: 同步統計 {success: int, failed: int, skipped: int}
        """
        # 建立查詢
        query = self.db.query(ScheduledPost).filter(
            ScheduledPost.status == "published"
        )
        
        if user_id:
            query = query.filter(ScheduledPost.user_id == user_id)
        
        # 只同步最近 30 天的貼文
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        query = query.filter(ScheduledPost.published_at >= thirty_days_ago)
        
        posts = query.all()
        
        stats = {"success": 0, "failed": 0, "skipped": 0}
        
        for post in posts:
            try:
                if self.sync_post_metrics(post):
                    stats["success"] += 1
                else:
                    stats["skipped"] += 1
            except Exception as e:
                logger.error(f"Error syncing post {post.id}: {e}")
                stats["failed"] += 1
        
        # 記錄同步日誌
        sync_log = MetricsSyncLog(
            sync_type="batch_sync",
            user_id=user_id,
            status="completed",
            total_posts=len(posts),
            success_count=stats["success"],
            failed_count=stats["failed"],
            skipped_count=stats["skipped"],
            completed_at=datetime.utcnow()
        )
        self.db.add(sync_log)
        self.db.commit()
        
        return stats
    
    # ============================================================
    # 成效報告
    # ============================================================
    
    def get_performance_summary(
        self, 
        user_id: int,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        獲取用戶的整體成效摘要
        
        Args:
            user_id: 用戶 ID
            days: 統計天數
        
        Returns:
            dict: 整體成效數據
        """
        from sqlalchemy import func
        
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # 聚合查詢
        result = self.db.query(
            func.sum(ContentMetrics.impressions).label("total_impressions"),
            func.sum(ContentMetrics.reach).label("total_reach"),
            func.sum(ContentMetrics.likes).label("total_likes"),
            func.sum(ContentMetrics.comments).label("total_comments"),
            func.sum(ContentMetrics.shares).label("total_shares"),
            func.sum(ContentMetrics.saves).label("total_saves"),
            func.sum(ContentMetrics.clicks).label("total_clicks"),
            func.sum(ContentMetrics.views).label("total_views"),
            func.avg(ContentMetrics.engagement_rate).label("avg_engagement_rate"),
            func.count(ContentMetrics.id).label("total_posts")
        ).filter(
            and_(
                ContentMetrics.user_id == user_id,
                ContentMetrics.metric_date >= start_date
            )
        ).first()
        
        return {
            "period_days": days,
            "total_impressions": result.total_impressions or 0,
            "total_reach": result.total_reach or 0,
            "total_likes": result.total_likes or 0,
            "total_comments": result.total_comments or 0,
            "total_shares": result.total_shares or 0,
            "total_saves": result.total_saves or 0,
            "total_clicks": result.total_clicks or 0,
            "total_views": result.total_views or 0,
            "avg_engagement_rate": float(result.avg_engagement_rate or 0) * 100,
            "total_posts_tracked": result.total_posts or 0
        }
    
    def get_platform_breakdown(
        self, 
        user_id: int,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """
        獲取各平台的成效分解
        """
        from sqlalchemy import func
        
        start_date = datetime.utcnow() - timedelta(days=days)
        
        results = self.db.query(
            ContentMetrics.platform,
            func.sum(ContentMetrics.impressions).label("total_impressions"),
            func.sum(ContentMetrics.reach).label("total_reach"),
            func.sum(ContentMetrics.likes).label("total_likes"),
            func.sum(ContentMetrics.comments).label("total_comments"),
            func.avg(ContentMetrics.engagement_rate).label("avg_engagement_rate"),
            func.count(ContentMetrics.id).label("post_count")
        ).filter(
            and_(
                ContentMetrics.user_id == user_id,
                ContentMetrics.metric_date >= start_date
            )
        ).group_by(ContentMetrics.platform).all()
        
        return [
            {
                "platform": r.platform,
                "total_impressions": r.total_impressions or 0,
                "total_reach": r.total_reach or 0,
                "total_likes": r.total_likes or 0,
                "total_comments": r.total_comments or 0,
                "avg_engagement_rate": float(r.avg_engagement_rate or 0) * 100,
                "post_count": r.post_count or 0
            }
            for r in results
        ]
