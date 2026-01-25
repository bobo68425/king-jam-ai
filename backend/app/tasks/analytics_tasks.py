"""
成效分析任務
- 每日凌晨 2 點抓取所有平台成效數據
- 每 6 小時更新近期貼文指標
- 週報生成
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from celery import shared_task
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.celery_app import celery_app, BaseTaskWithRetry
from app.database import SessionLocal
from app.models import (
    User, SocialAccount, ScheduledPost, Post,
    ContentMetrics, MetricsSyncLog
)
from app.services.insights_service import insights_service
from app.services.ga4_service import ga4_service

logger = logging.getLogger(__name__)


# ============================================================
# 分析任務專用基礎類別
# ============================================================

class AnalyticsTask(BaseTaskWithRetry):
    """
    分析任務專用類別
    - 較長的超時時間（API 呼叫可能較慢）
    - 自動記錄同步日誌
    """
    
    # 分析任務超時設定
    time_limit = 3600  # 1 小時硬限制
    soft_time_limit = 3300  # 55 分鐘軟限制
    
    # 重試設定
    max_retries = 3
    retry_backoff = True
    retry_backoff_max = 600  # 最大 10 分鐘


# ============================================================
# 主要任務：每日抓取所有平台成效
# ============================================================

@celery_app.task(base=AnalyticsTask, bind=True, name="app.tasks.analytics_tasks.fetch_all_metrics")
def fetch_all_metrics(self, user_id: Optional[int] = None, platform: Optional[str] = None):
    """
    抓取所有平台的成效數據
    
    Args:
        user_id: 指定用戶 ID（None 表示所有用戶）
        platform: 指定平台（None 表示所有平台）
    
    每日凌晨 2 點由 Celery Beat 觸發
    """
    db = SessionLocal()
    sync_log = None
    
    try:
        # 建立同步日誌
        sync_log = MetricsSyncLog(
            sync_type="daily_fetch",
            platform=platform,
            user_id=user_id,
            status="running",
            celery_task_id=self.request.id
        )
        db.add(sync_log)
        db.commit()
        
        logger.info(f"[Analytics] 開始每日成效數據抓取 task_id={self.request.id}")
        
        # 查詢需要同步的社群帳號
        query = db.query(SocialAccount).filter(
            SocialAccount.is_active == True,
            SocialAccount.access_token.isnot(None)
        )
        
        if user_id:
            query = query.filter(SocialAccount.user_id == user_id)
        if platform:
            query = query.filter(SocialAccount.platform == platform)
        
        accounts = query.all()
        total = len(accounts)
        success = 0
        failed = 0
        skipped = 0
        
        logger.info(f"[Analytics] 找到 {total} 個社群帳號需要同步")
        
        for account in accounts:
            try:
                # 跳過 GA4（單獨處理）
                if account.platform == "ga4":
                    skipped += 1
                    continue
                
                # 抓取該帳號的貼文成效
                result = fetch_account_metrics(db, account)
                
                if result["success"]:
                    success += 1
                    logger.info(f"[Analytics] ✅ {account.platform}@{account.platform_username} 同步成功")
                else:
                    failed += 1
                    logger.warning(f"[Analytics] ❌ {account.platform}@{account.platform_username} 同步失敗: {result.get('error')}")
                    
            except Exception as e:
                failed += 1
                logger.error(f"[Analytics] ❌ 帳號 {account.id} 同步異常: {str(e)}")
        
        # 同步 GA4 數據
        ga4_result = fetch_ga4_metrics_for_all_users(db, user_id)
        
        # 更新同步日誌
        sync_log.status = "completed" if failed == 0 else "partial"
        sync_log.total_posts = total
        sync_log.success_count = success + ga4_result.get("success", 0)
        sync_log.failed_count = failed + ga4_result.get("failed", 0)
        sync_log.skipped_count = skipped
        sync_log.completed_at = datetime.now()
        sync_log.duration_seconds = int((datetime.now() - sync_log.started_at).total_seconds())
        db.commit()
        
        logger.info(
            f"[Analytics] 每日同步完成: 成功={success}, 失敗={failed}, 跳過={skipped}, "
            f"耗時={sync_log.duration_seconds}秒"
        )
        
        return {
            "status": "completed",
            "total": total,
            "success": success,
            "failed": failed,
            "skipped": skipped,
            "duration": sync_log.duration_seconds
        }
        
    except Exception as e:
        logger.error(f"[Analytics] 每日同步失敗: {str(e)}")
        
        if sync_log:
            sync_log.status = "failed"
            sync_log.error_message = str(e)
            sync_log.completed_at = datetime.now()
            db.commit()
        
        raise
        
    finally:
        db.close()


# ============================================================
# 近期貼文更新（每 6 小時）
# ============================================================

@celery_app.task(base=AnalyticsTask, bind=True, name="app.tasks.analytics_tasks.fetch_recent_metrics")
def fetch_recent_metrics(self, hours: int = 48):
    """
    更新近期發布貼文的成效
    
    Args:
        hours: 抓取多少小時內發布的貼文
    """
    db = SessionLocal()
    
    try:
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        # 查詢近期發布的貼文
        recent_posts = db.query(ScheduledPost).filter(
            ScheduledPost.status == "published",
            ScheduledPost.published_at >= cutoff_time,
            ScheduledPost.platform_post_id.isnot(None)
        ).all()
        
        logger.info(f"[Analytics] 更新 {len(recent_posts)} 篇近期貼文的成效")
        
        success = 0
        failed = 0
        
        for post in recent_posts:
            try:
                result = fetch_single_post_metrics(db, post)
                if result["success"]:
                    success += 1
                else:
                    failed += 1
            except Exception as e:
                failed += 1
                logger.error(f"[Analytics] 貼文 {post.id} 更新失敗: {str(e)}")
        
        logger.info(f"[Analytics] 近期貼文更新完成: 成功={success}, 失敗={failed}")
        
        return {"success": success, "failed": failed}
        
    finally:
        db.close()


# ============================================================
# 單一帳號成效抓取
# ============================================================

def fetch_account_metrics(db: Session, account: SocialAccount) -> Dict[str, Any]:
    """
    抓取單一社群帳號的所有貼文成效
    """
    try:
        # 查詢該帳號最近 30 天發布的貼文
        cutoff_time = datetime.now() - timedelta(days=30)
        
        posts = db.query(ScheduledPost).filter(
            ScheduledPost.social_account_id == account.id,
            ScheduledPost.status == "published",
            ScheduledPost.published_at >= cutoff_time,
            ScheduledPost.platform_post_id.isnot(None)
        ).all()
        
        if not posts:
            return {"success": True, "message": "No posts to sync", "count": 0}
        
        success_count = 0
        
        for post in posts:
            try:
                result = fetch_single_post_metrics(db, post)
                if result["success"]:
                    success_count += 1
            except Exception as e:
                logger.warning(f"[Analytics] 貼文 {post.id} 成效抓取失敗: {str(e)}")
        
        return {
            "success": True,
            "count": len(posts),
            "synced": success_count
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}


# ============================================================
# 單一貼文成效抓取
# ============================================================

def fetch_single_post_metrics(db: Session, post: ScheduledPost) -> Dict[str, Any]:
    """
    抓取單一貼文的成效數據
    """
    import asyncio
    
    try:
        if not post.social_account:
            return {"success": False, "error": "No social account"}
        
        account = post.social_account
        platform = account.platform.lower()
        
        # 使用 insights_service 獲取成效
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            performance = loop.run_until_complete(
                insights_service.get_post_performance(db, post.user_id, post.id)
            )
        finally:
            loop.close()
        
        if "error" in performance:
            return {"success": False, "error": performance["error"]}
        
        metrics_data = performance.get("metrics", {})
        
        # 檢查是否已有今日的指標記錄
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        
        existing = db.query(ContentMetrics).filter(
            ContentMetrics.scheduled_post_id == post.id,
            ContentMetrics.metric_date >= today
        ).first()
        
        if existing:
            # 更新現有記錄
            existing.impressions = metrics_data.get("impressions", existing.impressions)
            existing.reach = metrics_data.get("reach", existing.reach)
            existing.likes = metrics_data.get("likes", existing.likes)
            existing.comments = metrics_data.get("comments", existing.comments)
            existing.shares = metrics_data.get("shares", existing.shares)
            existing.saves = metrics_data.get("saved", existing.saves)
            existing.clicks = metrics_data.get("engagement", existing.clicks)
            existing.raw_data = metrics_data
            existing.last_synced_at = datetime.now()
            existing.sync_status = "synced"
            
            # 計算互動率
            if existing.impressions > 0:
                total_engagement = existing.likes + existing.comments + existing.shares + existing.saves
                existing.engagement_rate = total_engagement / existing.impressions
        else:
            # 建立新記錄
            new_metrics = ContentMetrics(
                user_id=post.user_id,
                scheduled_post_id=post.id,
                platform=platform,
                platform_post_id=post.platform_post_id,
                platform_post_url=post.platform_post_url,
                metric_date=today,
                impressions=metrics_data.get("impressions", 0),
                reach=metrics_data.get("reach", 0),
                likes=metrics_data.get("likes", 0),
                comments=metrics_data.get("comments", 0),
                shares=metrics_data.get("shares", 0),
                saves=metrics_data.get("saved", 0),
                clicks=metrics_data.get("engagement", 0),
                raw_data=metrics_data,
                last_synced_at=datetime.now(),
                sync_status="synced"
            )
            
            # 計算互動率
            if new_metrics.impressions > 0:
                total_engagement = new_metrics.likes + new_metrics.comments + new_metrics.shares + new_metrics.saves
                new_metrics.engagement_rate = total_engagement / new_metrics.impressions
            
            db.add(new_metrics)
        
        db.commit()
        return {"success": True}
        
    except Exception as e:
        logger.error(f"[Analytics] 抓取貼文 {post.id} 成效失敗: {str(e)}")
        return {"success": False, "error": str(e)}


# ============================================================
# GA4 數據同步
# ============================================================

def fetch_ga4_metrics_for_all_users(db: Session, user_id: Optional[int] = None) -> Dict[str, int]:
    """
    抓取所有用戶的 GA4 數據
    """
    import asyncio
    
    query = db.query(SocialAccount).filter(
        SocialAccount.platform == "ga4",
        SocialAccount.is_active == True,
        SocialAccount.access_token.isnot(None),
        SocialAccount.platform_user_id.isnot(None)  # Property ID
    )
    
    if user_id:
        query = query.filter(SocialAccount.user_id == user_id)
    
    ga4_accounts = query.all()
    
    success = 0
    failed = 0
    
    for account in ga4_accounts:
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                # 獲取流量數據
                traffic = loop.run_until_complete(
                    ga4_service.get_traffic_overview(
                        access_token=account.access_token,
                        property_id=account.platform_user_id,
                        start_date="yesterday",
                        end_date="yesterday"
                    )
                )
                
                # 儲存到 ContentMetrics（網站層級）
                yesterday = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=1)
                
                totals = traffic.get("totals", {})
                
                existing = db.query(ContentMetrics).filter(
                    ContentMetrics.user_id == account.user_id,
                    ContentMetrics.platform == "ga4",
                    ContentMetrics.metric_date >= yesterday,
                    ContentMetrics.metric_date < yesterday + timedelta(days=1)
                ).first()
                
                if existing:
                    existing.page_sessions = totals.get("sessions", 0)
                    existing.page_users = totals.get("users", 0)
                    existing.views = totals.get("pageviews", 0)
                    existing.raw_data = traffic
                    existing.last_synced_at = datetime.now()
                    existing.sync_status = "synced"
                else:
                    new_ga4_metrics = ContentMetrics(
                        user_id=account.user_id,
                        platform="ga4",
                        metric_date=yesterday,
                        page_sessions=totals.get("sessions", 0),
                        page_users=totals.get("users", 0),
                        views=totals.get("pageviews", 0),
                        raw_data=traffic,
                        last_synced_at=datetime.now(),
                        sync_status="synced"
                    )
                    db.add(new_ga4_metrics)
                
                db.commit()
                success += 1
                logger.info(f"[Analytics] ✅ GA4 用戶 {account.user_id} 同步成功")
                
            finally:
                loop.close()
                
        except Exception as e:
            failed += 1
            logger.error(f"[Analytics] ❌ GA4 用戶 {account.user_id} 同步失敗: {str(e)}")
    
    return {"success": success, "failed": failed}


# ============================================================
# 週報生成
# ============================================================

@celery_app.task(base=AnalyticsTask, bind=True, name="app.tasks.analytics_tasks.generate_weekly_report")
def generate_weekly_report(self, user_id: Optional[int] = None):
    """
    生成週報
    """
    db = SessionLocal()
    
    try:
        logger.info("[Analytics] 開始生成週報")
        
        # 計算上週時間範圍
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        week_end = today - timedelta(days=today.weekday())  # 本週一
        week_start = week_end - timedelta(days=7)  # 上週一
        
        # 查詢需要生成報告的用戶
        query = db.query(User).filter(User.is_active == True)
        if user_id:
            query = query.filter(User.id == user_id)
        
        users = query.all()
        
        for user in users:
            try:
                # 查詢該用戶上週的指標
                metrics = db.query(ContentMetrics).filter(
                    ContentMetrics.user_id == user.id,
                    ContentMetrics.metric_date >= week_start,
                    ContentMetrics.metric_date < week_end
                ).all()
                
                if not metrics:
                    continue
                
                # 彙總數據
                total_impressions = sum(m.impressions or 0 for m in metrics)
                total_reach = sum(m.reach or 0 for m in metrics)
                total_likes = sum(m.likes or 0 for m in metrics)
                total_comments = sum(m.comments or 0 for m in metrics)
                
                # TODO: 發送週報通知或郵件
                logger.info(
                    f"[Analytics] 用戶 {user.id} 週報: "
                    f"曝光={total_impressions}, 觸及={total_reach}, "
                    f"讚={total_likes}, 留言={total_comments}"
                )
                
            except Exception as e:
                logger.error(f"[Analytics] 用戶 {user.id} 週報生成失敗: {str(e)}")
        
        logger.info("[Analytics] 週報生成完成")
        return {"status": "completed", "users_processed": len(users)}
        
    finally:
        db.close()


# ============================================================
# 手動觸發任務
# ============================================================

@celery_app.task(base=AnalyticsTask, bind=True, name="app.tasks.analytics_tasks.manual_sync")
def manual_sync(self, user_id: int, platform: Optional[str] = None):
    """
    手動觸發成效同步（用戶點擊刷新按鈕時）
    """
    return fetch_all_metrics(user_id=user_id, platform=platform)


@celery_app.task(base=AnalyticsTask, bind=True, name="app.tasks.analytics_tasks.sync_single_post")
def sync_single_post(self, scheduled_post_id: int):
    """
    同步單一貼文的成效
    """
    db = SessionLocal()
    
    try:
        post = db.query(ScheduledPost).filter(
            ScheduledPost.id == scheduled_post_id
        ).first()
        
        if not post:
            return {"success": False, "error": "Post not found"}
        
        return fetch_single_post_metrics(db, post)
        
    finally:
        db.close()
