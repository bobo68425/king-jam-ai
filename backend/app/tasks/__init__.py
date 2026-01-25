"""
King Jam AI 背景任務模組
包含：
- scheduler_tasks: 排程發布任務
- video_tasks: 影片渲染任務
- notification_tasks: 通知任務
- token_tasks: Token 管理任務
- metrics_tasks: 成效數據同步任務
"""

from .scheduler_tasks import (
    scan_pending_posts,
    publish_scheduled_post,
    cleanup_old_publish_logs,
)

from .video_tasks import (
    render_video_async,
    process_video_upload,
)

from .notification_tasks import (
    send_verification_email,
    send_instant_notification,
    send_scheduled_reminder,
    send_token_expiry_warning,
)

from .token_tasks import (
    refresh_token_urgent,
    refresh_all_expiring_tokens,
    check_token_validity,
)

from .metrics_tasks import (
    sync_metrics_for_user,
    sync_all_metrics,
    sync_single_post_metrics,
    schedule_post_metrics_sync,
)

__all__ = [
    # Scheduler
    "scan_pending_posts",
    "publish_scheduled_post",
    "cleanup_old_publish_logs",
    # Video
    "render_video_async",
    "process_video_upload",
    # Notification
    "send_verification_email",
    "send_instant_notification",
    "send_scheduled_reminder",
    "send_token_expiry_warning",
    # Token
    "refresh_token_urgent",
    "refresh_all_expiring_tokens",
    "check_token_validity",
    # Metrics
    "sync_metrics_for_user",
    "sync_all_metrics",
    "sync_single_post_metrics",
    "schedule_post_metrics_sync",
]
