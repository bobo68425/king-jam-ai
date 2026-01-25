"""
成效數據同步 Celery 任務

定期同步各平台的成效數據
"""

import logging
from datetime import datetime, timedelta
from celery import shared_task

from app.database import SessionLocal
from app.services.metrics_service import MetricsService

logger = logging.getLogger(__name__)


@shared_task(name="sync_metrics_for_user")
def sync_metrics_for_user(user_id: int):
    """
    同步特定用戶的所有已發布貼文成效數據
    
    Args:
        user_id: 用戶 ID
    """
    logger.info(f"Starting metrics sync for user {user_id}")
    
    db = SessionLocal()
    try:
        metrics_service = MetricsService(db)
        stats = metrics_service.sync_all_published_posts(user_id)
        
        logger.info(
            f"Metrics sync completed for user {user_id}: "
            f"success={stats['success']}, failed={stats['failed']}, skipped={stats['skipped']}"
        )
        
        return stats
    except Exception as e:
        logger.error(f"Error syncing metrics for user {user_id}: {e}")
        raise
    finally:
        db.close()


@shared_task(name="sync_all_metrics")
def sync_all_metrics():
    """
    同步所有用戶的已發布貼文成效數據
    
    此任務應該設定為每日執行（建議在凌晨低峰期）
    """
    logger.info("Starting daily metrics sync for all users")
    
    db = SessionLocal()
    try:
        metrics_service = MetricsService(db)
        stats = metrics_service.sync_all_published_posts()
        
        logger.info(
            f"Daily metrics sync completed: "
            f"success={stats['success']}, failed={stats['failed']}, skipped={stats['skipped']}"
        )
        
        return stats
    except Exception as e:
        logger.error(f"Error in daily metrics sync: {e}")
        raise
    finally:
        db.close()


@shared_task(name="sync_single_post_metrics")
def sync_single_post_metrics(post_id: int):
    """
    同步單一貼文的成效數據
    
    Args:
        post_id: 排程貼文 ID
    """
    logger.info(f"Starting metrics sync for post {post_id}")
    
    db = SessionLocal()
    try:
        from app.models import ScheduledPost
        
        post = db.query(ScheduledPost).filter(ScheduledPost.id == post_id).first()
        
        if not post:
            logger.warning(f"Post {post_id} not found")
            return {"status": "not_found"}
        
        if post.status != "published":
            logger.info(f"Post {post_id} is not published, skipping")
            return {"status": "skipped", "reason": "not_published"}
        
        metrics_service = MetricsService(db)
        success = metrics_service.sync_post_metrics(post)
        
        if success:
            logger.info(f"Metrics sync completed for post {post_id}")
            return {"status": "success"}
        else:
            logger.warning(f"Metrics sync failed for post {post_id}")
            return {"status": "failed"}
            
    except Exception as e:
        logger.error(f"Error syncing metrics for post {post_id}: {e}")
        raise
    finally:
        db.close()


@shared_task(name="schedule_post_metrics_sync")
def schedule_post_metrics_sync(post_id: int, delay_hours: int = 1):
    """
    排程在發布後延遲同步成效數據
    
    發布後 1 小時、6 小時、24 小時、72 小時各同步一次
    
    Args:
        post_id: 排程貼文 ID
        delay_hours: 延遲小時數
    """
    # 定義同步時間點（發布後的小時數）
    sync_points = [1, 6, 24, 72]
    
    if delay_hours in sync_points:
        # 執行同步
        sync_single_post_metrics.delay(post_id)
        
        # 排程下一次同步
        current_index = sync_points.index(delay_hours)
        if current_index < len(sync_points) - 1:
            next_delay = sync_points[current_index + 1]
            hours_until_next = next_delay - delay_hours
            
            # 使用 countdown 排程下一次同步
            schedule_post_metrics_sync.apply_async(
                args=[post_id, next_delay],
                countdown=hours_until_next * 3600
            )
            
            logger.info(
                f"Scheduled next metrics sync for post {post_id} "
                f"in {hours_until_next} hours (at {next_delay}h mark)"
            )
