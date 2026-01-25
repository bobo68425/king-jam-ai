"""
排程上架引擎 API
- 管理排程發布內容
- 管理社群帳號連結
- 查詢發布日誌
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from pydantic import BaseModel
from typing import List, Optional, Literal
from datetime import datetime, timedelta
import pytz

from app.database import get_db
from app.models import User, SocialAccount, ScheduledPost, PublishLog
from app.routers.auth import get_current_user

router = APIRouter(prefix="/scheduler", tags=["Scheduler Engine"])


# ============================================================
# Schemas
# ============================================================

class SocialAccountCreate(BaseModel):
    platform: str
    platform_username: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None


class SocialAccountResponse(BaseModel):
    id: int
    platform: str
    platform_username: Optional[str]
    platform_avatar: Optional[str]
    is_active: bool
    last_sync_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class ScheduledPostCreate(BaseModel):
    social_account_id: Optional[int] = None
    content_type: Literal["social_image", "blog_post", "short_video"]
    title: Optional[str] = None
    caption: Optional[str] = None
    media_urls: List[str] = []
    hashtags: List[str] = []
    scheduled_at: datetime
    timezone: str = "Asia/Taipei"
    settings: dict = {}


class ScheduledPostUpdate(BaseModel):
    social_account_id: Optional[int] = None
    title: Optional[str] = None
    caption: Optional[str] = None
    media_urls: Optional[List[str]] = None
    hashtags: Optional[List[str]] = None
    scheduled_at: Optional[datetime] = None
    timezone: Optional[str] = None
    settings: Optional[dict] = None


class ScheduledPostResponse(BaseModel):
    id: int
    user_id: int
    social_account_id: Optional[int]
    content_type: str
    title: Optional[str]
    caption: Optional[str]
    media_urls: List[str]
    hashtags: List[str]
    scheduled_at: datetime
    timezone: str
    status: str
    published_at: Optional[datetime]
    platform_post_url: Optional[str]
    error_message: Optional[str]
    retry_count: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class PublishLogResponse(BaseModel):
    id: int
    scheduled_post_id: int
    action: str
    message: Optional[str]
    details: dict
    created_at: datetime

    class Config:
        from_attributes = True


class CalendarEvent(BaseModel):
    id: int
    title: str
    start: datetime
    end: datetime
    status: str
    content_type: str
    platform: Optional[str]


class SchedulerStats(BaseModel):
    total_scheduled: int
    pending: int
    published: int
    failed: int
    today_count: int
    this_week_count: int


# ============================================================
# 社群帳號管理 API
# ============================================================

@router.get("/accounts", response_model=List[SocialAccountResponse])
async def get_social_accounts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取得用戶所有連結的社群帳號"""
    accounts = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id
    ).all()
    return accounts


@router.post("/accounts", response_model=SocialAccountResponse)
async def create_social_account(
    account: SocialAccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """新增社群帳號連結"""
    # 檢查是否已存在相同平台的帳號
    existing = db.query(SocialAccount).filter(
        and_(
            SocialAccount.user_id == current_user.id,
            SocialAccount.platform == account.platform,
            SocialAccount.platform_username == account.platform_username
        )
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="此平台帳號已連結"
        )
    
    new_account = SocialAccount(
        user_id=current_user.id,
        platform=account.platform,
        platform_username=account.platform_username,
        access_token=account.access_token,
        refresh_token=account.refresh_token,
        is_active=True
    )
    db.add(new_account)
    db.commit()
    db.refresh(new_account)
    
    return new_account


@router.delete("/accounts/{account_id}")
async def delete_social_account(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """刪除社群帳號連結"""
    account = db.query(SocialAccount).filter(
        and_(
            SocialAccount.id == account_id,
            SocialAccount.user_id == current_user.id
        )
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="帳號不存在")
    
    db.delete(account)
    db.commit()
    
    return {"message": "帳號已移除"}


# ============================================================
# 排程內容管理 API
# ============================================================

@router.get("/posts", response_model=List[ScheduledPostResponse])
async def get_scheduled_posts(
    status_filter: Optional[str] = Query(None, description="篩選狀態"),
    content_type: Optional[str] = Query(None, description="篩選內容類型"),
    start_date: Optional[datetime] = Query(None, description="開始日期"),
    end_date: Optional[datetime] = Query(None, description="結束日期"),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取得排程發布列表"""
    query = db.query(ScheduledPost).filter(
        ScheduledPost.user_id == current_user.id
    )
    
    if status_filter:
        query = query.filter(ScheduledPost.status == status_filter)
    if content_type:
        query = query.filter(ScheduledPost.content_type == content_type)
    if start_date:
        query = query.filter(ScheduledPost.scheduled_at >= start_date)
    if end_date:
        query = query.filter(ScheduledPost.scheduled_at <= end_date)
    
    posts = query.order_by(ScheduledPost.scheduled_at.asc()).offset(offset).limit(limit).all()
    return posts


@router.post("/posts", response_model=ScheduledPostResponse)
async def create_scheduled_post(
    post: ScheduledPostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """建立排程發布"""
    # 驗證社群帳號
    if post.social_account_id:
        account = db.query(SocialAccount).filter(
            and_(
                SocialAccount.id == post.social_account_id,
                SocialAccount.user_id == current_user.id
            )
        ).first()
        if not account:
            raise HTTPException(status_code=404, detail="社群帳號不存在")
    
    # 檢查排程時間必須是未來
    now = datetime.now(pytz.UTC)
    scheduled_utc = post.scheduled_at.astimezone(pytz.UTC) if post.scheduled_at.tzinfo else pytz.timezone(post.timezone).localize(post.scheduled_at).astimezone(pytz.UTC)
    
    if scheduled_utc <= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="排程時間必須是未來時間"
        )
    
    new_post = ScheduledPost(
        user_id=current_user.id,
        social_account_id=post.social_account_id,
        content_type=post.content_type,
        title=post.title,
        caption=post.caption,
        media_urls=post.media_urls,
        hashtags=post.hashtags,
        scheduled_at=post.scheduled_at,
        timezone=post.timezone,
        settings=post.settings,
        status="pending"
    )
    db.add(new_post)
    db.commit()
    db.refresh(new_post)
    
    # 記錄日誌
    log = PublishLog(
        scheduled_post_id=new_post.id,
        action="created",
        message="排程已建立"
    )
    db.add(log)
    db.commit()
    
    return new_post


@router.get("/posts/{post_id}", response_model=ScheduledPostResponse)
async def get_scheduled_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取得單一排程詳情"""
    post = db.query(ScheduledPost).filter(
        and_(
            ScheduledPost.id == post_id,
            ScheduledPost.user_id == current_user.id
        )
    ).first()
    
    if not post:
        raise HTTPException(status_code=404, detail="排程不存在")
    
    return post


@router.put("/posts/{post_id}", response_model=ScheduledPostResponse)
async def update_scheduled_post(
    post_id: int,
    update: ScheduledPostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """更新排程內容"""
    post = db.query(ScheduledPost).filter(
        and_(
            ScheduledPost.id == post_id,
            ScheduledPost.user_id == current_user.id
        )
    ).first()
    
    if not post:
        raise HTTPException(status_code=404, detail="排程不存在")
    
    if post.status not in ["pending", "failed"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="只能修改待發布或失敗的排程"
        )
    
    # 更新欄位
    update_data = update.dict(exclude_unset=True)
    for key, value in update_data.items():
        if value is not None:
            setattr(post, key, value)
    
    # 重設狀態為待發布
    if post.status == "failed":
        post.status = "pending"
        post.error_message = None
    
    db.commit()
    db.refresh(post)
    
    # 記錄日誌
    log = PublishLog(
        scheduled_post_id=post.id,
        action="updated",
        message="排程已更新"
    )
    db.add(log)
    db.commit()
    
    return post


@router.delete("/posts/{post_id}")
async def delete_scheduled_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """刪除排程"""
    post = db.query(ScheduledPost).filter(
        and_(
            ScheduledPost.id == post_id,
            ScheduledPost.user_id == current_user.id
        )
    ).first()
    
    if not post:
        raise HTTPException(status_code=404, detail="排程不存在")
    
    if post.status == "publishing":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="正在發布中的排程無法刪除"
        )
    
    db.delete(post)
    db.commit()
    
    return {"message": "排程已刪除"}


@router.post("/posts/{post_id}/cancel")
async def cancel_scheduled_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取消排程"""
    post = db.query(ScheduledPost).filter(
        and_(
            ScheduledPost.id == post_id,
            ScheduledPost.user_id == current_user.id
        )
    ).first()
    
    if not post:
        raise HTTPException(status_code=404, detail="排程不存在")
    
    if post.status not in ["pending", "queued"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="只能取消待發布或排隊中的排程"
        )
    
    post.status = "cancelled"
    db.commit()
    
    # 記錄日誌
    log = PublishLog(
        scheduled_post_id=post.id,
        action="cancelled",
        message="排程已取消"
    )
    db.add(log)
    db.commit()
    
    return {"message": "排程已取消"}


@router.post("/posts/{post_id}/retry")
async def retry_scheduled_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """重試失敗的排程"""
    post = db.query(ScheduledPost).filter(
        and_(
            ScheduledPost.id == post_id,
            ScheduledPost.user_id == current_user.id
        )
    ).first()
    
    if not post:
        raise HTTPException(status_code=404, detail="排程不存在")
    
    if post.status != "failed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="只能重試失敗的排程"
        )
    
    post.status = "pending"
    post.error_message = None
    post.retry_count += 1
    db.commit()
    
    # 記錄日誌
    log = PublishLog(
        scheduled_post_id=post.id,
        action="retried",
        message=f"第 {post.retry_count} 次重試"
    )
    db.add(log)
    db.commit()
    
    return {"message": "已加入重試佇列"}


# ============================================================
# 日曆視圖 API
# ============================================================

@router.get("/calendar", response_model=List[CalendarEvent])
async def get_calendar_events(
    start: datetime = Query(..., description="日曆開始日期"),
    end: datetime = Query(..., description="日曆結束日期"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取得日曆事件（用於日曆視圖）"""
    posts = db.query(ScheduledPost).filter(
        and_(
            ScheduledPost.user_id == current_user.id,
            ScheduledPost.scheduled_at >= start,
            ScheduledPost.scheduled_at <= end
        )
    ).all()
    
    events = []
    for post in posts:
        # 取得平台名稱
        platform = None
        if post.social_account_id:
            account = db.query(SocialAccount).filter(
                SocialAccount.id == post.social_account_id
            ).first()
            if account:
                platform = account.platform
        
        events.append(CalendarEvent(
            id=post.id,
            title=post.title or post.caption[:30] + "..." if post.caption else "無標題",
            start=post.scheduled_at,
            end=post.scheduled_at + timedelta(minutes=30),  # 假設每個事件30分鐘
            status=post.status,
            content_type=post.content_type,
            platform=platform
        ))
    
    return events


# ============================================================
# 統計 API
# ============================================================

@router.get("/stats", response_model=SchedulerStats)
async def get_scheduler_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取得排程統計"""
    base_query = db.query(ScheduledPost).filter(
        ScheduledPost.user_id == current_user.id
    )
    
    total = base_query.count()
    pending = base_query.filter(ScheduledPost.status == "pending").count()
    published = base_query.filter(ScheduledPost.status == "published").count()
    failed = base_query.filter(ScheduledPost.status == "failed").count()
    
    # 今日和本週統計
    now = datetime.now(pytz.UTC)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=now.weekday())
    
    today_count = base_query.filter(
        ScheduledPost.scheduled_at >= today_start
    ).count()
    
    this_week_count = base_query.filter(
        ScheduledPost.scheduled_at >= week_start
    ).count()
    
    return SchedulerStats(
        total_scheduled=total,
        pending=pending,
        published=published,
        failed=failed,
        today_count=today_count,
        this_week_count=this_week_count
    )


# ============================================================
# 發布日誌 API
# ============================================================

@router.get("/posts/{post_id}/logs", response_model=List[PublishLogResponse])
async def get_publish_logs(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取得排程的發布日誌"""
    # 先驗證排程屬於當前用戶
    post = db.query(ScheduledPost).filter(
        and_(
            ScheduledPost.id == post_id,
            ScheduledPost.user_id == current_user.id
        )
    ).first()
    
    if not post:
        raise HTTPException(status_code=404, detail="排程不存在")
    
    logs = db.query(PublishLog).filter(
        PublishLog.scheduled_post_id == post_id
    ).order_by(PublishLog.created_at.desc()).all()
    
    return logs


# ============================================================
# 支援的平台
# ============================================================

@router.get("/platforms")
async def get_supported_platforms():
    """取得支援的社群平台列表"""
    return {
        "platforms": [
            {"id": "instagram", "name": "Instagram", "icon": "📸", "status": "coming_soon"},
            {"id": "facebook", "name": "Facebook", "icon": "📘", "status": "coming_soon"},
            {"id": "tiktok", "name": "TikTok", "icon": "🎵", "status": "coming_soon"},
            {"id": "threads", "name": "Threads", "icon": "🧵", "status": "coming_soon"},
            {"id": "linkedin", "name": "LinkedIn", "icon": "💼", "status": "coming_soon"},
            {"id": "youtube", "name": "YouTube", "icon": "📺", "status": "coming_soon"},
            {"id": "xiaohongshu", "name": "小紅書", "icon": "📕", "status": "coming_soon"},
            {"id": "line", "name": "LINE", "icon": "💬", "status": "coming_soon"},
        ]
    }
