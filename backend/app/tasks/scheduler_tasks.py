"""
排程發布任務
- 掃描待發布的排程
- 執行社群平台發布
- 清理過期日誌
"""

import logging
from datetime import datetime, timedelta
from typing import Optional
import pytz

from app.celery_app import celery_app, SocialAPITask
from app.database import SessionLocal
from app.models import ScheduledPost, PublishLog, SocialAccount
from app.services.social_platforms.base import PublishContent, ContentType

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.scheduler_tasks.scan_pending_posts")
def scan_pending_posts():
    """
    掃描待發布的排程貼文
    每 5 分鐘執行一次，將到期的排程加入發布佇列
    """
    logger.info("[Scheduler] 開始掃描待發布排程...")
    
    db = SessionLocal()
    try:
        now = datetime.now(pytz.UTC)
        # 找出已到發布時間且狀態為 pending 的排程
        # 加入 5 分鐘緩衝（避免錯過）
        buffer_time = now + timedelta(minutes=5)
        
        pending_posts = db.query(ScheduledPost).filter(
            ScheduledPost.status == "pending",
            ScheduledPost.scheduled_at <= buffer_time
        ).all()
        
        logger.info(f"[Scheduler] 找到 {len(pending_posts)} 個待發布排程")
        
        for post in pending_posts:
            # 更新狀態為 queued
            post.status = "queued"
            
            # 記錄日誌
            log = PublishLog(
                scheduled_post_id=post.id,
                action="queued",
                message="已加入發布佇列"
            )
            db.add(log)
            
            # 觸發發布任務
            publish_scheduled_post.delay(scheduled_post_id=post.id)
            
            logger.info(f"[Scheduler] 排程 #{post.id} 已加入發布佇列")
        
        db.commit()
        
        return {
            "scanned": len(pending_posts),
            "queued_ids": [p.id for p in pending_posts]
        }
        
    except Exception as e:
        logger.error(f"[Scheduler] 掃描失敗: {e}")
        db.rollback()
        raise
    finally:
        db.close()


@celery_app.task(
    name="app.tasks.scheduler_tasks.publish_scheduled_post",
    base=SocialAPITask,
    bind=True,  # 綁定 self 以存取重試資訊
)
def publish_scheduled_post(self, scheduled_post_id: int):
    """
    執行單一排程貼文的發布
    
    Args:
        scheduled_post_id: 排程貼文 ID
    """
    logger.info(f"[Publisher] 開始發布排程 #{scheduled_post_id}")
    
    db = SessionLocal()
    try:
        # 取得排程資料
        post = db.query(ScheduledPost).filter(
            ScheduledPost.id == scheduled_post_id
        ).first()
        
        if not post:
            logger.error(f"[Publisher] 找不到排程 #{scheduled_post_id}")
            return {"success": False, "error": "排程不存在"}
        
        # 檢查狀態
        if post.status not in ["queued", "pending"]:
            logger.warning(f"[Publisher] 排程 #{scheduled_post_id} 狀態不正確: {post.status}")
            return {"success": False, "error": f"狀態不正確: {post.status}"}
        
        # 更新狀態為 publishing
        post.status = "publishing"
        log = PublishLog(
            scheduled_post_id=post.id,
            action="publishing",
            message="開始發布"
        )
        db.add(log)
        db.commit()
        
        # 檢查是否有綁定社群帳號
        if not post.social_account_id:
            # 沒有綁定帳號，僅記錄為「已排程」狀態
            post.status = "published"
            post.published_at = datetime.now(pytz.UTC)
            log = PublishLog(
                scheduled_post_id=post.id,
                action="published",
                message="排程已執行（無綁定社群帳號，僅記錄）"
            )
            db.add(log)
            db.commit()
            
            logger.info(f"[Publisher] 排程 #{scheduled_post_id} 已記錄（無社群帳號）")
            return {"success": True, "message": "已記錄"}
        
        # 取得社群帳號
        social_account = db.query(SocialAccount).filter(
            SocialAccount.id == post.social_account_id
        ).first()
        
        if not social_account:
            raise Exception("社群帳號不存在")
        
        if not social_account.is_active:
            raise Exception("社群帳號已停用")
        
        # === WordPress 特殊處理 ===
        if social_account.platform == "wordpress":
            result = publish_to_wordpress(post, social_account)
            
            if result.get("success"):
                post.status = "published"
                post.published_at = datetime.now(pytz.UTC)
                post.platform_post_id = str(result.get("post_id"))
                post.platform_post_url = result.get("post_url")
                
                log = PublishLog(
                    scheduled_post_id=post.id,
                    action="published",
                    message="WordPress 文章發布成功",
                    details={
                        "platform_post_id": result.get("post_id"),
                        "platform_post_url": result.get("post_url")
                    }
                )
                db.add(log)
                db.commit()
                
                logger.info(f"[Publisher] 排程 #{scheduled_post_id} WordPress 發布成功")
                return result
            else:
                raise Exception(f"WordPress 發布失敗: {result.get('error')}")
        
        # === 其他社群平台處理 ===
        # 檢查 Token 是否有效
        if social_account.token_expires_at:
            if social_account.token_expires_at < datetime.now(pytz.UTC):
                # Token 已過期，嘗試刷新
                from app.tasks.token_tasks import refresh_token_sync
                refresh_result = refresh_token_sync(social_account.id)
                
                if not refresh_result.get("success"):
                    raise Exception(f"Token 已過期且刷新失敗: {refresh_result.get('error')}")
                
                # 重新載入帳號資料
                db.refresh(social_account)
        
        # 取得平台發布器
        platform_publisher = get_platform_publisher(social_account.platform)
        
        if not platform_publisher:
            # 平台尚未實作，標記為成功但記錄警告
            post.status = "published"
            post.published_at = datetime.now(pytz.UTC)
            log = PublishLog(
                scheduled_post_id=post.id,
                action="published",
                message=f"排程已執行（{social_account.platform} 自動發布尚未實作）"
            )
            db.add(log)
            db.commit()
            
            logger.warning(f"[Publisher] 平台 {social_account.platform} 尚未實作自動發布")
            return {"success": True, "message": "已記錄（平台待實作）"}
        
        # 準備發布內容
        content = PublishContent(
            content_type=ContentType.IMAGE if post.content_type == "social_image" else ContentType.VIDEO,
            caption=post.caption or "",
            media_urls=post.media_urls or [],
            hashtags=post.hashtags or [],
        )
        
        # 執行發布（這是同步版本，實際應使用 async）
        # 這裡簡化處理，實際需要根據平台 SDK 調整
        import asyncio
        
        async def do_publish():
            return await platform_publisher.publish(
                access_token=social_account.access_token,
                content=content
            )
        
        result = asyncio.run(do_publish())
        
        if result.success:
            # 發布成功
            post.status = "published"
            post.published_at = datetime.now(pytz.UTC)
            post.platform_post_id = result.platform_post_id
            post.platform_post_url = result.platform_post_url
            
            log = PublishLog(
                scheduled_post_id=post.id,
                action="published",
                message="發布成功",
                details={
                    "platform_post_id": result.platform_post_id,
                    "platform_post_url": result.platform_post_url
                }
            )
            db.add(log)
            db.commit()
            
            logger.info(f"[Publisher] 排程 #{scheduled_post_id} 發布成功")
            return {
                "success": True,
                "platform_post_id": result.platform_post_id,
                "platform_post_url": result.platform_post_url
            }
        else:
            # 發布失敗，拋出異常觸發重試
            raise Exception(f"發布失敗: {result.error_message}")
        
    except Exception as e:
        logger.error(f"[Publisher] 排程 #{scheduled_post_id} 發布錯誤: {e}")
        
        # 記錄錯誤
        try:
            post = db.query(ScheduledPost).filter(
                ScheduledPost.id == scheduled_post_id
            ).first()
            if post:
                post.error_message = str(e)
                post.retry_count = self.request.retries
                
                log = PublishLog(
                    scheduled_post_id=post.id,
                    action="error",
                    message=f"發布錯誤（重試 {self.request.retries}/{self.max_retries}）",
                    details={"error": str(e)}
                )
                db.add(log)
                db.commit()
        except:
            pass
        
        # 觸發重試
        raise self.retry(exc=e)
        
    finally:
        db.close()


@celery_app.task(name="app.tasks.scheduler_tasks.cleanup_old_publish_logs")
def cleanup_old_publish_logs(days: int = 30):
    """
    清理過期的發布日誌
    預設保留 30 天
    """
    logger.info(f"[Cleanup] 開始清理 {days} 天前的發布日誌...")
    
    db = SessionLocal()
    try:
        cutoff_date = datetime.now(pytz.UTC) - timedelta(days=days)
        
        # 刪除舊日誌
        deleted_count = db.query(PublishLog).filter(
            PublishLog.created_at < cutoff_date
        ).delete()
        
        db.commit()
        
        logger.info(f"[Cleanup] 已刪除 {deleted_count} 筆過期日誌")
        return {"deleted": deleted_count}
        
    except Exception as e:
        logger.error(f"[Cleanup] 清理失敗: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def publish_to_wordpress(post: ScheduledPost, social_account: SocialAccount) -> dict:
    """
    發布文章到 WordPress
    
    Args:
        post: 排程貼文
        social_account: WordPress 帳號
        
    Returns:
        發布結果
    """
    import asyncio
    from app.services.social_platforms.wordpress import (
        create_wordpress_service,
        WordPressPostStatus
    )
    
    try:
        # 從 extra_settings 取得 WordPress 設定
        extra = social_account.extra_settings or {}
        site_url = extra.get("site_url", social_account.platform_username)
        username = extra.get("username", "")
        app_password = social_account.access_token
        
        if not all([site_url, username, app_password]):
            return {"success": False, "error": "WordPress 設定不完整"}
        
        # 從 post.settings 取得發布設定
        settings = post.settings or {}
        categories = settings.get("categories", [])
        excerpt = settings.get("excerpt", "")
        featured_image_url = settings.get("featured_image_url")
        
        async def do_publish():
            wp_service = create_wordpress_service(site_url, username, app_password)
            try:
                result = await wp_service.publish_blog_post(
                    title=post.title or "未命名文章",
                    content=post.caption or "",  # caption 存放完整 HTML 內容
                    excerpt=excerpt,
                    category_names=categories if categories else None,
                    tag_names=post.hashtags if post.hashtags else None,
                    featured_image_url=featured_image_url,
                    status=WordPressPostStatus.PUBLISH,  # 立即發布
                    scheduled_date=None
                )
                
                return {
                    "success": result.success,
                    "post_id": result.post_id,
                    "post_url": result.post_url,
                    "error": result.error_message
                }
            finally:
                await wp_service.close()
        
        return asyncio.run(do_publish())
        
    except Exception as e:
        logger.error(f"[WordPress] 發布錯誤: {e}")
        return {"success": False, "error": str(e)}


def get_platform_publisher(platform: str):
    """
    取得平台發布器實例
    
    Args:
        platform: 平台名稱 (instagram, facebook, tiktok, etc.)
        
    Returns:
        平台發布器實例，若尚未實作則返回 None
    """
    # 動態載入平台實作
    platform_map = {
        "instagram": "app.services.social_platforms.meta.InstagramPublisher",
        "facebook": "app.services.social_platforms.meta.FacebookPublisher",
        "tiktok": "app.services.social_platforms.tiktok.TikTokPublisher",
        "youtube": "app.services.social_platforms.youtube.YouTubePublisher",
        "linkedin": "app.services.social_platforms.linkedin.LinkedInPublisher",
        "line": "app.services.social_platforms.line.LinePublisher",
    }
    
    module_path = platform_map.get(platform)
    if not module_path:
        return None
    
    try:
        module_name, class_name = module_path.rsplit(".", 1)
        module = __import__(module_name, fromlist=[class_name])
        publisher_class = getattr(module, class_name)
        return publisher_class()
    except (ImportError, AttributeError) as e:
        logger.warning(f"[Publisher] 無法載入平台 {platform}: {e}")
        return None
