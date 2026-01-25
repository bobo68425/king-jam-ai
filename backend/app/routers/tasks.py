"""
背景任務管理 API
提供任務觸發和狀態查詢的端點
"""

from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
import pytz

from app.database import get_db
from app.models import User, ScheduledPost, SocialAccount
from app.routers.auth import get_current_user

router = APIRouter(prefix="/tasks", tags=["背景任務"])


# ============================================================
# Request/Response Models
# ============================================================

class TaskTriggerResponse(BaseModel):
    success: bool
    task_id: str
    message: str


class TaskStatusResponse(BaseModel):
    task_id: str
    status: str  # PENDING, STARTED, SUCCESS, FAILURE, RETRY, REVOKED
    result: Optional[dict] = None
    error: Optional[str] = None


class TokenCheckResponse(BaseModel):
    account_id: int
    platform: str
    username: Optional[str]
    is_valid: bool
    expires_at: Optional[str]
    remaining_hours: Optional[float]
    needs_refresh: bool
    can_refresh: bool


class QueueStatsResponse(BaseModel):
    queue_high: int
    queue_default: int
    queue_video: int
    total: int


# ============================================================
# 任務觸發端點
# ============================================================

@router.post("/scan-pending-posts", response_model=TaskTriggerResponse)
async def trigger_scan_pending_posts(
    current_user: User = Depends(get_current_user)
):
    """
    手動觸發掃描待發布的排程
    （正常情況下由 Celery Beat 每 5 分鐘自動執行）
    """
    from app.tasks.scheduler_tasks import scan_pending_posts
    
    task = scan_pending_posts.delay()
    
    return TaskTriggerResponse(
        success=True,
        task_id=task.id,
        message="掃描任務已加入佇列"
    )


@router.post("/publish/{post_id}", response_model=TaskTriggerResponse)
async def trigger_publish_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    手動觸發發布指定的排程貼文
    """
    # 檢查權限
    post = db.query(ScheduledPost).filter(
        ScheduledPost.id == post_id,
        ScheduledPost.user_id == current_user.id
    ).first()
    
    if not post:
        raise HTTPException(status_code=404, detail="排程不存在")
    
    if post.status not in ["pending", "failed"]:
        raise HTTPException(
            status_code=400, 
            detail=f"無法發布狀態為 {post.status} 的排程"
        )
    
    from app.tasks.scheduler_tasks import publish_scheduled_post
    
    task = publish_scheduled_post.delay(scheduled_post_id=post_id)
    
    # 更新狀態
    post.status = "queued"
    db.commit()
    
    return TaskTriggerResponse(
        success=True,
        task_id=task.id,
        message="發布任務已加入佇列"
    )


@router.post("/refresh-token/{account_id}", response_model=TaskTriggerResponse)
async def trigger_refresh_token(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    手動觸發刷新指定帳號的 Token
    """
    # 檢查權限
    account = db.query(SocialAccount).filter(
        SocialAccount.id == account_id,
        SocialAccount.user_id == current_user.id
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="帳號不存在")
    
    from app.tasks.token_tasks import refresh_token_urgent
    
    task = refresh_token_urgent.delay(social_account_id=account_id)
    
    return TaskTriggerResponse(
        success=True,
        task_id=task.id,
        message="Token 刷新任務已加入佇列"
    )


@router.post("/refresh-all-tokens", response_model=TaskTriggerResponse)
async def trigger_refresh_all_tokens(
    current_user: User = Depends(get_current_user)
):
    """
    手動觸發批次刷新所有即將過期的 Token
    （正常情況下由 Celery Beat 每小時自動執行）
    """
    from app.tasks.token_tasks import refresh_all_expiring_tokens
    
    task = refresh_all_expiring_tokens.delay()
    
    return TaskTriggerResponse(
        success=True,
        task_id=task.id,
        message="批次刷新任務已加入佇列"
    )


# ============================================================
# 任務狀態查詢
# ============================================================

@router.get("/status/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    查詢任務執行狀態
    """
    from app.celery_app import celery_app
    
    result = celery_app.AsyncResult(task_id)
    
    response = TaskStatusResponse(
        task_id=task_id,
        status=result.status,
    )
    
    if result.ready():
        if result.successful():
            response.result = result.result
        else:
            response.error = str(result.result)
    
    return response


@router.get("/queue-stats", response_model=QueueStatsResponse)
async def get_queue_stats(
    current_user: User = Depends(get_current_user)
):
    """
    獲取各佇列的任務數量
    """
    from app.celery_app import celery_app
    
    # 使用 Redis 直接查詢佇列長度
    import redis
    import os
    
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    r = redis.from_url(redis_url)
    
    queue_high = r.llen("queue_high") or 0
    queue_default = r.llen("queue_default") or 0
    queue_video = r.llen("queue_video") or 0
    
    return QueueStatsResponse(
        queue_high=queue_high,
        queue_default=queue_default,
        queue_video=queue_video,
        total=queue_high + queue_default + queue_video
    )


# ============================================================
# Token 檢查
# ============================================================

@router.get("/check-tokens", response_model=List[TokenCheckResponse])
async def check_all_tokens(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    檢查當前用戶所有社群帳號的 Token 狀態
    """
    accounts = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.is_active == True
    ).all()
    
    results = []
    now = datetime.now(pytz.UTC)
    
    for account in accounts:
        is_valid = True
        remaining_hours = None
        needs_refresh = False
        
        if account.token_expires_at:
            if account.token_expires_at < now:
                is_valid = False
            else:
                remaining = account.token_expires_at - now
                remaining_hours = remaining.total_seconds() / 3600
                needs_refresh = remaining_hours < 24
        
        results.append(TokenCheckResponse(
            account_id=account.id,
            platform=account.platform,
            username=account.platform_username,
            is_valid=is_valid,
            expires_at=account.token_expires_at.isoformat() if account.token_expires_at else None,
            remaining_hours=remaining_hours,
            needs_refresh=needs_refresh,
            can_refresh=bool(account.refresh_token)
        ))
    
    return results


# ============================================================
# 影片任務
# ============================================================

class VideoRenderRequest(BaseModel):
    prompt: str
    duration: int = 8
    aspect_ratio: str = "9:16"
    quality: str = "standard"


@router.post("/render-video", response_model=TaskTriggerResponse)
async def trigger_render_video(
    request: VideoRenderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    觸發非同步影片渲染任務
    """
    from app.tasks.video_tasks import render_video_async
    from app.models import GenerationHistory
    
    # 建立歷史記錄
    history = GenerationHistory(
        user_id=current_user.id,
        generation_type="short_video",
        status="pending",
        input_params={
            "prompt": request.prompt,
            "duration": request.duration,
            "aspect_ratio": request.aspect_ratio,
            "quality": request.quality
        }
    )
    db.add(history)
    db.commit()
    db.refresh(history)
    
    # 觸發任務
    task = render_video_async.delay(
        user_id=current_user.id,
        prompt=request.prompt,
        duration=request.duration,
        aspect_ratio=request.aspect_ratio,
        quality=request.quality,
        history_id=history.id
    )
    
    return TaskTriggerResponse(
        success=True,
        task_id=task.id,
        message=f"影片渲染任務已加入佇列 (歷史記錄 #{history.id})"
    )
