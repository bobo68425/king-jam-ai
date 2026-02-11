"""
Celery 背景任務執行器配置
- 多佇列設計 (high, default, video, analytics)
- 雙 Redis 隔離（影片任務獨立，避免影響核心服務）
- 失敗重試策略 (指數退避)
- 任務監控與日誌
"""

import os
from celery import Celery
from kombu import Queue, Exchange

# ============================================================
# Redis 配置（雙 Redis 隔離架構）
# ============================================================
# 主 Redis：驗證碼、Token 快取、一般任務
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)

# 影片專用 Redis：影片渲染任務（隔離，避免高負載影響登入/驗證碼）
VIDEO_REDIS_URL = os.getenv("VIDEO_REDIS_URL", "redis://localhost:6380/0")
VIDEO_BROKER_URL = os.getenv("VIDEO_BROKER_URL", VIDEO_REDIS_URL)
VIDEO_RESULT_BACKEND = os.getenv("VIDEO_RESULT_BACKEND", "redis://localhost:6380/1")

# ============================================================
# 建立 Celery 應用
# ============================================================
# 根據 Worker 類型選擇 Redis（支援隔離架構）
WORKER_TYPE = os.getenv("WORKER_TYPE", "default")

if WORKER_TYPE == "video":
    # 影片 Worker 使用獨立 Redis
    ACTIVE_BROKER_URL = VIDEO_BROKER_URL
    ACTIVE_RESULT_BACKEND = VIDEO_RESULT_BACKEND
    print(f"[Celery] 🎬 Video Worker 使用獨立 Redis: {VIDEO_BROKER_URL}")
else:
    # 其他 Worker 使用主 Redis
    ACTIVE_BROKER_URL = CELERY_BROKER_URL
    ACTIVE_RESULT_BACKEND = CELERY_RESULT_BACKEND

celery_app = Celery(
    "kingjam_worker",
    broker=ACTIVE_BROKER_URL,
    backend=ACTIVE_RESULT_BACKEND,
    include=[
        "app.tasks.scheduler_tasks",
        "app.tasks.video_tasks",
        "app.tasks.notification_tasks",
        "app.tasks.token_tasks",
        "app.tasks.cleanup_tasks",
        "app.tasks.monitoring_tasks",
        "app.tasks.credit_tasks",  # 點數系統任務
        "app.tasks.analytics_tasks",  # 成效分析任務
    ]
)

# ============================================================
# 佇列與交換機定義
# ============================================================
default_exchange = Exchange("default", type="direct")
video_exchange = Exchange("video", type="direct")
high_exchange = Exchange("high", type="direct")
analytics_exchange = Exchange("analytics", type="direct")

# 定義佇列
CELERY_QUEUES = (
    # 高優先級佇列 - 驗證碼、即時通知
    Queue(
        "queue_high",
        high_exchange,
        routing_key="high",
        queue_arguments={"x-max-priority": 10}
    ),
    # 預設佇列 - 社群發布、排程任務
    Queue(
        "queue_default",
        default_exchange,
        routing_key="default",
        queue_arguments={"x-max-priority": 5}
    ),
    # 影片佇列 - Veo 渲染（耗時任務，隔離處理）
    Queue(
        "queue_video",
        video_exchange,
        routing_key="video",
        queue_arguments={"x-max-priority": 3}
    ),
    # 分析佇列 - 成效數據抓取（獨立處理，避免阻塞發布任務）
    Queue(
        "queue_analytics",
        analytics_exchange,
        routing_key="analytics",
        queue_arguments={"x-max-priority": 2}
    ),
)

# 任務路由規則
CELERY_TASK_ROUTES = {
    # 高優先級任務
    "app.tasks.notification_tasks.send_verification_email": {"queue": "queue_high"},
    "app.tasks.notification_tasks.send_instant_notification": {"queue": "queue_high"},
    "app.tasks.token_tasks.refresh_token_urgent": {"queue": "queue_high"},
    
    # 預設佇列任務
    "app.tasks.scheduler_tasks.*": {"queue": "queue_default"},
    "app.tasks.token_tasks.refresh_all_expiring_tokens": {"queue": "queue_default"},
    "app.tasks.notification_tasks.send_scheduled_reminder": {"queue": "queue_default"},
    
    # 影片佇列任務
    "app.tasks.video_tasks.*": {"queue": "queue_video"},
    
    # 分析佇列任務（獨立隔離，避免阻塞驗證碼和發布任務）
    "app.tasks.analytics_tasks.*": {"queue": "queue_analytics"},
}

# ============================================================
# Celery 配置
# ============================================================
celery_app.conf.update(
    # 佇列設定
    task_queues=CELERY_QUEUES,
    task_routes=CELERY_TASK_ROUTES,
    task_default_queue="queue_default",
    task_default_exchange="default",
    task_default_routing_key="default",
    
    # 序列化設定
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    
    # 時區設定
    timezone="Asia/Taipei",
    enable_utc=True,
    
    # 結果設定
    result_expires=3600 * 24,  # 結果保留 24 小時
    result_extended=True,
    
    # 任務執行設定
    task_acks_late=True,  # 任務完成後才確認（防止任務丟失）
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,  # 每次只取一個任務（公平分配）
    
    # 重試設定（全域預設）
    task_annotations={
        "*": {
            "rate_limit": "100/m",  # 每分鐘最多 100 個任務
            "max_retries": 3,
            "default_retry_delay": 60,
        }
    },
    
    # Worker 設定
    worker_concurrency=4,  # 並發數
    worker_max_tasks_per_child=100,  # 每個 worker 處理 100 個任務後重啟（防止記憶體洩漏）
    
    # 監控設定
    task_track_started=True,
    task_send_sent_event=True,
    worker_send_task_events=True,
    
)

# ============================================================
# Beat 排程器配置（週期任務）
# ============================================================
from celery.schedules import crontab

celery_app.conf.beat_schedule = {
    # 每 5 分鐘掃描待發布的排程
    "scan-scheduled-posts": {
        "task": "app.tasks.scheduler_tasks.scan_pending_posts",
        "schedule": 300.0,  # 5 分鐘
        "options": {"queue": "queue_default"}
    },
    # 每小時檢查即將過期的 Token
    "check-expiring-tokens": {
        "task": "app.tasks.token_tasks.refresh_all_expiring_tokens",
        "schedule": 3600.0,  # 1 小時
        "options": {"queue": "queue_default"}
    },
    # 每天凌晨 3 點清理過期任務記錄
    "cleanup-old-logs": {
        "task": "app.tasks.scheduler_tasks.cleanup_old_publish_logs",
        "schedule": crontab(hour=3, minute=0),
        "options": {"queue": "queue_default"}
    },
    # ============================================================
    # 媒體生命週期管理（成本控制）
    # ============================================================
    # 每天凌晨 4 點清理過期媒體檔案
    "cleanup-expired-media": {
        "task": "app.tasks.cleanup_tasks.cleanup_expired_media",
        "schedule": crontab(hour=4, minute=0),
        "kwargs": {"dry_run": False},
        "options": {"queue": "queue_default"}
    },
    # 每 6 小時清理臨時檔案
    "cleanup-temp-files": {
        "task": "app.tasks.cleanup_tasks.cleanup_local_temp_files",
        "schedule": 21600.0,  # 6 小時
        "options": {"queue": "queue_default"}
    },
    # ============================================================
    # 系統監控（危機處理機制）
    # ============================================================
    # 每 5 分鐘完整健康檢查
    "system-health-check": {
        "task": "app.tasks.monitoring_tasks.health_check",
        "schedule": 300.0,  # 5 分鐘
        "options": {"queue": "queue_high"}
    },
    # 每 1 分鐘快速 Ping（核心服務）
    "quick-ping": {
        "task": "app.tasks.monitoring_tasks.quick_ping",
        "schedule": 60.0,  # 1 分鐘
        "options": {"queue": "queue_high"}
    },
    # 每 2 分鐘 Worker 心跳
    "worker-heartbeat": {
        "task": "app.tasks.monitoring_tasks.worker_heartbeat",
        "schedule": 120.0,  # 2 分鐘
        "options": {"queue": "queue_default"}
    },
    # 每 2 分鐘 Video Worker 心跳
    "video-worker-heartbeat": {
        "task": "app.tasks.monitoring_tasks.video_worker_heartbeat",
        "schedule": 120.0,  # 2 分鐘
        "options": {"queue": "queue_video"}
    },
    # ============================================================
    # 點數系統任務（帳務一致性）
    # ============================================================
    # 每小時檢查點數一致性
    "credit-consistency-check": {
        "task": "app.tasks.credit_tasks.check_credit_consistency",
        "schedule": 3600.0,  # 1 小時
        "options": {"queue": "queue_default"}
    },
    # 每天凌晨 5 點生成點數報表
    "daily-credit-report": {
        "task": "app.tasks.credit_tasks.generate_daily_credit_report",
        "schedule": crontab(hour=5, minute=0),
        "options": {"queue": "queue_default"}
    },
    # 每月 1 號 00:05 發放預付訂閱點數（募資 6 個月等）
    "grant-prepaid-subscription-credits": {
        "task": "app.tasks.credit_tasks.grant_prepaid_subscription_credits",
        "schedule": crontab(day_of_month=1, hour=0, minute=5),
        "options": {"queue": "queue_default"}
    },
    # 每月最後一天 23:59 歸零月費點數
    "expire-monthly-sub-credits": {
        "task": "app.tasks.credit_tasks.expire_monthly_sub_credits",
        "schedule": crontab(day_of_month=28, hour=23, minute=59),  # 每月28號先執行，避免跨月問題
        "options": {"queue": "queue_default"}
    },
    # ============================================================
    # 成效分析任務（獨立佇列 queue_analytics）
    # ============================================================
    # 每日凌晨 2 點抓取所有平台成效數據
    "fetch-daily-metrics": {
        "task": "app.tasks.analytics_tasks.fetch_all_metrics",
        "schedule": crontab(hour=2, minute=0),
        "options": {"queue": "queue_analytics"}
    },
    # 每 6 小時更新近期貼文指標（捕捉熱門時段）
    "update-recent-metrics": {
        "task": "app.tasks.analytics_tasks.fetch_recent_metrics",
        "schedule": 21600.0,  # 6 小時
        "kwargs": {"hours": 48},  # 更新 48 小時內發布的貼文
        "options": {"queue": "queue_analytics"}
    },
    # 每週一凌晨 3 點生成週報
    "generate-weekly-analytics-report": {
        "task": "app.tasks.analytics_tasks.generate_weekly_report",
        "schedule": crontab(day_of_week=1, hour=3, minute=0),
        "options": {"queue": "queue_analytics"}
    },
}


# ============================================================
# 任務基礎類別（含重試策略）
# ============================================================
from celery import Task
from celery.exceptions import MaxRetriesExceededError
import logging

logger = logging.getLogger(__name__)


class BaseTaskWithRetry(Task):
    """
    基礎任務類別，包含：
    - 指數退避重試策略
    - 錯誤日誌記錄
    - 任務生命週期 hooks
    """
    
    # 自動重試的異常類型
    autoretry_for = (
        ConnectionError,
        TimeoutError,
        Exception,  # 可依需求細化
    )
    
    # 重試設定
    max_retries = 3
    retry_backoff = True  # 啟用指數退避
    retry_backoff_max = 600  # 最大退避時間 10 分鐘
    retry_jitter = True  # 加入隨機抖動，避免雪崩
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """任務失敗時的處理"""
        logger.error(
            f"Task {self.name}[{task_id}] failed: {exc}",
            exc_info=einfo,
            extra={
                "task_id": task_id,
                "task_name": self.name,
                "args": args,
                "kwargs": kwargs,
            }
        )
    
    def on_retry(self, exc, task_id, args, kwargs, einfo):
        """任務重試時的處理"""
        logger.warning(
            f"Task {self.name}[{task_id}] retrying: {exc}",
            extra={
                "task_id": task_id,
                "task_name": self.name,
                "retry_count": self.request.retries,
            }
        )
    
    def on_success(self, retval, task_id, args, kwargs):
        """任務成功時的處理"""
        logger.info(
            f"Task {self.name}[{task_id}] completed successfully",
            extra={
                "task_id": task_id,
                "task_name": self.name,
            }
        )


class SocialAPITask(BaseTaskWithRetry):
    """
    社群 API 任務專用類別
    針對社群平台 API 常見的 5xx 錯誤進行特殊處理
    """
    
    # 社群 API 特定的重試異常
    autoretry_for = (
        ConnectionError,
        TimeoutError,
    )
    
    # 社群 API 通常需要更多重試次數
    max_retries = 5
    retry_backoff = True
    retry_backoff_max = 900  # 最大 15 分鐘
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """社群發布失敗時，更新資料庫狀態"""
        super().on_failure(exc, task_id, args, kwargs, einfo)
        
        # 嘗試更新排程貼文狀態
        try:
            scheduled_post_id = kwargs.get("scheduled_post_id") or (args[0] if args else None)
            if scheduled_post_id:
                from app.database import SessionLocal
                from app.models import ScheduledPost, PublishLog
                
                db = SessionLocal()
                try:
                    post = db.query(ScheduledPost).filter(
                        ScheduledPost.id == scheduled_post_id
                    ).first()
                    if post:
                        post.status = "failed"
                        post.error_message = str(exc)
                        post.retry_count = self.request.retries
                        
                        # 記錄失敗日誌
                        log = PublishLog(
                            scheduled_post_id=post.id,
                            action="failed",
                            message=f"發布失敗（已重試 {self.request.retries} 次）: {str(exc)}",
                            details={"exception": str(exc), "traceback": str(einfo)}
                        )
                        db.add(log)
                        db.commit()
                finally:
                    db.close()
        except Exception as e:
            logger.error(f"Failed to update post status: {e}")


class VideoRenderTask(BaseTaskWithRetry):
    """
    影片渲染任務專用類別
    - 更長的超時時間
    - 較少的重試次數（因為成本高）
    - OOM 預防措施
    """
    
    # 影片渲染超時設定
    time_limit = 1800  # 30 分鐘硬限制
    soft_time_limit = 1500  # 25 分鐘軟限制
    
    # 重試設定（影片渲染成本高，減少重試）
    max_retries = 2
    retry_backoff = True
    retry_backoff_max = 300  # 最大 5 分鐘
    
    # OOM 預防：任務速率限制
    rate_limit = "10/m"  # 每分鐘最多 10 個影片任務（全局）
    
    # OOM 預防：記憶體警告閾值
    MEMORY_WARNING_THRESHOLD = 0.8  # 80% 記憶體使用警告
    MEMORY_CRITICAL_THRESHOLD = 0.9  # 90% 記憶體使用拒絕新任務
    
    def before_start(self, task_id, args, kwargs):
        """任務開始前檢查系統資源"""
        super().before_start(task_id, args, kwargs)
        
        # 檢查記憶體使用
        try:
            import psutil
            memory = psutil.virtual_memory()
            memory_percent = memory.percent / 100
            
            if memory_percent >= self.MEMORY_CRITICAL_THRESHOLD:
                raise MemoryError(
                    f"系統記憶體不足 ({memory_percent:.0%})，任務已排隊等待"
                )
            elif memory_percent >= self.MEMORY_WARNING_THRESHOLD:
                import logging
                logging.warning(
                    f"[VideoTask] ⚠️ 記憶體使用率高 ({memory_percent:.0%})，建議減少並發"
                )
        except ImportError:
            pass  # psutil 未安裝，跳過檢查
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """任務失敗時清理資源"""
        super().on_failure(exc, task_id, args, kwargs, einfo)
        
        # 強制垃圾回收
        import gc
        gc.collect()