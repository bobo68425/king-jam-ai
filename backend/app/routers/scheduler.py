"""
排程上架引擎 API
- 管理排程發布內容
- 管理社群帳號連結
- 查詢發布日誌
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func as sql_func, case
from pydantic import BaseModel, Field
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
    platform_user_id: Optional[str] = None
    platform_username: Optional[str] = None
    platform_avatar: Optional[str] = None
    is_active: bool
    token_expires_at: Optional[datetime] = None
    last_sync_at: Optional[datetime] = None
    created_at: datetime
    extra_settings: Optional[dict] = None

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
    # 新增：關聯到生成歷史，用於評分追蹤
    generation_id: Optional[int] = Field(None, description="關聯的 AI 生成記錄 ID")
    prompt_rating: Optional[int] = Field(None, ge=1, le=5, description="對 AI 生成結果的評分 (1-5)")


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


class GA4ConfigUpdate(BaseModel):
    """GA4 設定"""
    ga4_property_id: str = Field(..., description="GA4 Property ID (數字)")
    

@router.put("/accounts/{account_id}/ga4-config")
async def update_ga4_config(
    account_id: int,
    config: GA4ConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    更新帳號的 GA4 設定
    
    設定 GA4 Property ID 來獲取網站瀏覽數據
    """
    account = db.query(SocialAccount).filter(
        and_(
            SocialAccount.id == account_id,
            SocialAccount.user_id == current_user.id
        )
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="帳號不存在")
    
    # 更新 extra_settings
    extra_settings = account.extra_settings or {}
    extra_settings["ga4_property_id"] = config.ga4_property_id
    account.extra_settings = extra_settings
    
    db.commit()
    db.refresh(account)
    
    return {
        "message": "GA4 設定已更新",
        "ga4_property_id": config.ga4_property_id
    }


@router.get("/accounts/{account_id}/ga4-status")
async def get_ga4_status(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """檢查 GA4 連接狀態"""
    account = db.query(SocialAccount).filter(
        and_(
            SocialAccount.id == account_id,
            SocialAccount.user_id == current_user.id
        )
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="帳號不存在")
    
    extra_settings = account.extra_settings or {}
    ga4_property_id = extra_settings.get("ga4_property_id")
    
    return {
        "account_id": account_id,
        "platform": account.platform,
        "ga4_configured": bool(ga4_property_id),
        "ga4_property_id": ga4_property_id,
        "setup_instructions": {
            "step1": "前往 Google Analytics 4 管理後台",
            "step2": "點擊「管理」→「資源設定」",
            "step3": "複製「資源 ID」(僅數字部分)",
            "step4": "在此處貼上資源 ID",
            "note": "確保您的網站已安裝 GA4 追蹤碼"
        }
    }


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
    """取得排程發布列表（使用 eager loading 優化查詢）"""
    query = db.query(ScheduledPost).options(
        joinedload(ScheduledPost.social_account)  # 預載入關聯，避免 N+1 查詢
    ).filter(
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
    
    # ========== 排程上架自動評分機制 ==========
    # 當用戶將 AI 生成內容排程上架，表示對結果滿意
    # 自動記錄 Prompt 使用並給予評分
    rating = post.prompt_rating or 4  # 預設 4 分（滿意）
    await _record_prompt_usage_from_schedule(
        db=db,
        user_id=current_user.id,
        content_type=post.content_type,
        generation_id=post.generation_id,
        rating=rating
    )
    
    db.commit()
    
    return new_post


async def _record_prompt_usage_from_schedule(
    db: Session,
    user_id: int,
    content_type: str,
    generation_id: Optional[int],
    rating: int = 4
):
    """
    從排程上架記錄 Prompt 使用情況
    
    排程上架 = 用戶對 AI 生成結果滿意 = 正面評分
    """
    from app.models import Prompt, PromptVersion, PromptUsageLog, GenerationHistory
    
    # 內容類型到 Prompt slug 的映射
    CONTENT_TYPE_TO_PROMPT = {
        "blog_post": "blog-article-generator",
        "blog_image": "blog-cover-image-generator",
        "social_image": "social-media-image-generator",
        "short_video": "veo-video-visual-prompt",
        "video_script": "ai-director-video-script",
    }
    
    # 獲取對應的 Prompt
    slug = CONTENT_TYPE_TO_PROMPT.get(content_type)
    if not slug:
        return
    
    prompt = db.query(Prompt).filter(Prompt.slug == slug).first()
    if not prompt or not prompt.current_version_id:
        return
    
    version = db.query(PromptVersion).filter(
        PromptVersion.id == prompt.current_version_id
    ).first()
    if not version:
        return
    
    # 獲取生成歷史（如果有）
    generation = None
    if generation_id:
        generation = db.query(GenerationHistory).filter(
            GenerationHistory.id == generation_id,
            GenerationHistory.user_id == user_id
        ).first()
    
    # 創建使用記錄
    usage_log = PromptUsageLog(
        prompt_id=prompt.id,
        version_id=version.id,
        user_id=user_id,
        generation_id=generation_id,
        is_success=True,
        user_rating=rating,
        user_feedback="排程上架自動評分"
    )
    db.add(usage_log)
    
    # 更新 Prompt 使用次數
    prompt.usage_count = (prompt.usage_count or 0) + 1
    
    # 更新版本的平均評分
    total = version.total_ratings * float(version.avg_rating) + rating
    version.total_ratings += 1
    version.avg_rating = total / version.total_ratings
    
    print(f"[Scheduler] 記錄 Prompt 使用: {prompt.name}, 評分: {rating}, 新平均: {version.avg_rating:.2f}")


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


@router.post("/posts/{post_id}/publish-now")
async def publish_now(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """立即發布排程（將狀態設為 queued 立即執行）"""
    post = db.query(ScheduledPost).filter(
        and_(
            ScheduledPost.id == post_id,
            ScheduledPost.user_id == current_user.id
        )
    ).first()
    
    if not post:
        raise HTTPException(status_code=404, detail="排程不存在")
    
    if post.status not in ["pending", "failed"]:
        raise HTTPException(status_code=400, detail=f"無法立即發布狀態為 {post.status} 的排程")
    
    # 更新狀態為 queued 並設定排程時間為現在
    post.status = "queued"
    post.scheduled_at = datetime.utcnow()
    
    # 記錄日誌
    log = PublishLog(
        scheduled_post_id=post.id,
        action="publish_now",
        message="手動觸發立即發布"
    )
    db.add(log)
    db.commit()
    
    return {"message": "已加入發布佇列，將立即發布"}


# ============================================================
# Prompt 評分 API
# ============================================================

class PromptRatingRequest(BaseModel):
    """Prompt 評分請求"""
    content_type: str = Field(..., description="內容類型: blog_post, blog_image, social_image, short_video")
    rating: int = Field(..., ge=1, le=5, description="評分 1-5 星")
    feedback: Optional[str] = Field(None, description="文字回饋")
    generation_id: Optional[int] = Field(None, description="關聯的生成記錄 ID")


@router.post("/rate-prompt")
async def rate_prompt(
    request: PromptRatingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    對 AI 生成結果評分
    
    用戶可以對任何生成內容進行評分，用於改善 Prompt 效果。
    - 1-2 星：不滿意
    - 3 星：普通
    - 4-5 星：滿意
    """
    from app.models import Prompt, PromptVersion, PromptUsageLog, GenerationHistory
    
    # 內容類型到 Prompt slug 的映射
    CONTENT_TYPE_TO_PROMPT = {
        "blog_post": "blog-article-generator",
        "blog_image": "blog-cover-image-generator", 
        "social_image": "social-media-image-generator",
        "short_video": "veo-video-visual-prompt",
        "video_script": "ai-director-video-script",
    }
    
    slug = CONTENT_TYPE_TO_PROMPT.get(request.content_type)
    if not slug:
        raise HTTPException(status_code=400, detail=f"未知的內容類型: {request.content_type}")
    
    prompt = db.query(Prompt).filter(Prompt.slug == slug).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt 不存在")
    
    version = db.query(PromptVersion).filter(
        PromptVersion.id == prompt.current_version_id
    ).first()
    if not version:
        raise HTTPException(status_code=404, detail="Prompt 版本不存在")
    
    # 驗證 generation_id（如果提供）
    if request.generation_id:
        generation = db.query(GenerationHistory).filter(
            GenerationHistory.id == request.generation_id,
            GenerationHistory.user_id == current_user.id
        ).first()
        if not generation:
            raise HTTPException(status_code=404, detail="生成記錄不存在")
    
    # 創建使用記錄
    usage_log = PromptUsageLog(
        prompt_id=prompt.id,
        version_id=version.id,
        user_id=current_user.id,
        generation_id=request.generation_id,
        is_success=True,
        user_rating=request.rating,
        user_feedback=request.feedback or "手動評分"
    )
    db.add(usage_log)
    
    # 更新版本的平均評分
    total = version.total_ratings * float(version.avg_rating) + request.rating
    version.total_ratings += 1
    version.avg_rating = total / version.total_ratings
    
    db.commit()
    
    return {
        "message": "評分已記錄",
        "prompt_name": prompt.name,
        "rating": request.rating,
        "new_avg_rating": float(version.avg_rating),
        "total_ratings": version.total_ratings
    }


@router.get("/prompt-ratings/{content_type}")
async def get_prompt_rating(
    content_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取特定內容類型的 Prompt 評分統計
    """
    from app.models import Prompt, PromptVersion
    
    CONTENT_TYPE_TO_PROMPT = {
        "blog_post": "blog-article-generator",
        "blog_image": "blog-cover-image-generator",
        "social_image": "social-media-image-generator",
        "short_video": "veo-video-visual-prompt",
        "video_script": "ai-director-video-script",
    }
    
    slug = CONTENT_TYPE_TO_PROMPT.get(content_type)
    if not slug:
        raise HTTPException(status_code=400, detail=f"未知的內容類型: {content_type}")
    
    prompt = db.query(Prompt).filter(Prompt.slug == slug).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt 不存在")
    
    version = db.query(PromptVersion).filter(
        PromptVersion.id == prompt.current_version_id
    ).first()
    
    return {
        "prompt_id": prompt.id,
        "prompt_name": prompt.name,
        "version_number": version.version_number if version else None,
        "avg_rating": float(version.avg_rating) if version else 0,
        "total_ratings": version.total_ratings if version else 0,
        "usage_count": prompt.usage_count
    }


@router.get("/posts/{post_id}/insights")
async def get_post_insights(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取得已發布貼文的成效洞察數據"""
    from app.services.metrics_service import MetricsService
    
    post = db.query(ScheduledPost).filter(
        and_(
            ScheduledPost.id == post_id,
            ScheduledPost.user_id == current_user.id
        )
    ).first()
    
    if not post:
        raise HTTPException(status_code=404, detail="排程不存在")
    
    # 使用 MetricsService 獲取成效數據
    metrics_service = MetricsService(db)
    insights = metrics_service.get_post_insights(post_id, current_user.id)
    
    if insights is None:
        raise HTTPException(status_code=404, detail="找不到成效數據")
    
    return insights


@router.post("/posts/{post_id}/sync-metrics")
async def sync_post_metrics(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """手動觸發同步貼文的成效數據"""
    from app.services.metrics_service import MetricsService
    
    post = db.query(ScheduledPost).filter(
        and_(
            ScheduledPost.id == post_id,
            ScheduledPost.user_id == current_user.id
        )
    ).first()
    
    if not post:
        raise HTTPException(status_code=404, detail="排程不存在")
    
    if post.status != "published":
        raise HTTPException(status_code=400, detail="只有已發布的貼文才能同步成效數據")
    
    metrics_service = MetricsService(db)
    success = metrics_service.sync_post_metrics(post)
    
    if success:
        return {"message": "成效數據已同步", "status": "success"}
    else:
        return {"message": "同步失敗，請稍後再試", "status": "failed"}


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
    """取得日曆事件（用於日曆視圖）- 使用 eager loading 優化查詢"""
    posts = db.query(ScheduledPost).options(
        joinedload(ScheduledPost.social_account)  # 預載入社群帳號，避免 N+1 查詢
    ).filter(
        and_(
            ScheduledPost.user_id == current_user.id,
            ScheduledPost.scheduled_at >= start,
            ScheduledPost.scheduled_at <= end
        )
    ).all()
    
    events = []
    for post in posts:
        # 取得平台名稱（已預載入，不會產生額外查詢）
        platform = post.social_account.platform if post.social_account else None
        
        # 處理標題顯示
        title = post.title or (post.caption[:30] + "..." if post.caption and len(post.caption) > 30 else post.caption) or "無標題"
        
        events.append(CalendarEvent(
            id=post.id,
            title=title,
            start=post.scheduled_at,
            end=post.scheduled_at + timedelta(minutes=30),
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
    """取得排程統計（優化：單一查詢取得所有統計）"""
    now = datetime.now(pytz.UTC)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=now.weekday())
    
    # 使用單一查詢取得所有統計，避免多次 count 查詢
    stats_result = db.query(
        sql_func.count(ScheduledPost.id).label("total"),
        sql_func.sum(case((ScheduledPost.status == "pending", 1), else_=0)).label("pending"),
        sql_func.sum(case((ScheduledPost.status == "published", 1), else_=0)).label("published"),
        sql_func.sum(case((ScheduledPost.status == "failed", 1), else_=0)).label("failed"),
        sql_func.sum(case((ScheduledPost.scheduled_at >= today_start, 1), else_=0)).label("today_count"),
        sql_func.sum(case((ScheduledPost.scheduled_at >= week_start, 1), else_=0)).label("this_week_count"),
    ).filter(
        ScheduledPost.user_id == current_user.id
    ).first()
    
    return SchedulerStats(
        total_scheduled=stats_result.total or 0,
        pending=stats_result.pending or 0,
        published=stats_result.published or 0,
        failed=stats_result.failed or 0,
        today_count=stats_result.today_count or 0,
        this_week_count=stats_result.this_week_count or 0
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
    import os
    
    # 檢查各平台是否已設定 API 金鑰
    def check_platform_ready(env_keys: list) -> str:
        for key in env_keys:
            val = os.getenv(key, "")
            if not val or val.startswith("your_"):
                return "needs_setup"
        return "active"
    
    return {
        "platforms": [
            {"id": "wordpress", "name": "WordPress", "icon": "📝", "status": "active", "description": "部落格文章排程發布"},
            {"id": "instagram", "name": "Instagram", "icon": "📸", "status": check_platform_ready(["META_APP_ID", "META_APP_SECRET"]), "description": "分享照片和短影音"},
            {"id": "facebook", "name": "Facebook", "icon": "📘", "status": check_platform_ready(["META_APP_ID", "META_APP_SECRET"]), "description": "連接朋友和社群"},
            {"id": "threads", "name": "Threads", "icon": "🧵", "status": check_platform_ready(["META_APP_ID", "META_APP_SECRET"]), "description": "文字為主的社群"},
            {"id": "tiktok", "name": "TikTok", "icon": "🎵", "status": check_platform_ready(["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"]), "description": "短影音創作平台"},
            {"id": "linkedin", "name": "LinkedIn", "icon": "💼", "status": check_platform_ready(["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"]), "description": "專業人脈網絡"},
            {"id": "youtube", "name": "YouTube", "icon": "📺", "status": check_platform_ready(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]), "description": "影片分享平台"},
            {"id": "xiaohongshu", "name": "小紅書", "icon": "📕", "status": "coming_soon", "description": "生活方式分享社群"},
            {"id": "line", "name": "LINE", "icon": "💬", "status": check_platform_ready(["LINE_CHANNEL_ID", "LINE_CHANNEL_SECRET"]), "description": "即時通訊與社群"},
        ]
    }


# ============================================================
# 批量操作 API
# ============================================================

class BatchScheduleItem(BaseModel):
    """批量排程項目"""
    content_type: Literal["social_image", "blog_post", "short_video"]
    title: Optional[str] = None
    caption: Optional[str] = None
    media_urls: List[str] = []
    hashtags: List[str] = []
    scheduled_at: datetime
    social_account_id: Optional[int] = None


class BatchScheduleCreate(BaseModel):
    """批量排程請求"""
    items: List[BatchScheduleItem] = Field(..., min_length=1, max_length=20)
    timezone: str = "Asia/Taipei"


class BatchScheduleResponse(BaseModel):
    """批量排程回應"""
    success_count: int
    failed_count: int
    created_posts: List[ScheduledPostResponse]
    errors: List[dict]


@router.post("/posts/batch", response_model=BatchScheduleResponse)
async def create_batch_scheduled_posts(
    batch: BatchScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """批量建立排程發布（最多 20 筆）"""
    now = datetime.now(pytz.UTC)
    created_posts = []
    errors = []
    
    for idx, item in enumerate(batch.items):
        try:
            # 驗證社群帳號
            if item.social_account_id:
                account = db.query(SocialAccount).filter(
                    and_(
                        SocialAccount.id == item.social_account_id,
                        SocialAccount.user_id == current_user.id
                    )
                ).first()
                if not account:
                    errors.append({"index": idx, "error": "社群帳號不存在"})
                    continue
            
            # 檢查排程時間
            scheduled_utc = item.scheduled_at.astimezone(pytz.UTC) if item.scheduled_at.tzinfo else pytz.timezone(batch.timezone).localize(item.scheduled_at).astimezone(pytz.UTC)
            
            if scheduled_utc <= now:
                errors.append({"index": idx, "error": "排程時間必須是未來時間"})
                continue
            
            # 建立排程
            new_post = ScheduledPost(
                user_id=current_user.id,
                social_account_id=item.social_account_id,
                content_type=item.content_type,
                title=item.title,
                caption=item.caption,
                media_urls=item.media_urls,
                hashtags=item.hashtags,
                scheduled_at=item.scheduled_at,
                timezone=batch.timezone,
                status="pending"
            )
            db.add(new_post)
            db.flush()  # 取得 ID
            
            # 記錄日誌
            log = PublishLog(
                scheduled_post_id=new_post.id,
                action="created",
                message="批量排程已建立"
            )
            db.add(log)
            created_posts.append(new_post)
            
        except Exception as e:
            errors.append({"index": idx, "error": str(e)})
    
    db.commit()
    
    # 刷新所有建立的 posts
    for post in created_posts:
        db.refresh(post)
    
    return BatchScheduleResponse(
        success_count=len(created_posts),
        failed_count=len(errors),
        created_posts=created_posts,
        errors=errors
    )


# ============================================================
# 智慧排程建議 API
# ============================================================

class TimeSlotSuggestion(BaseModel):
    """時段建議"""
    time: str  # HH:MM 格式
    day_of_week: int  # 0=週日, 1=週一, ...
    score: float  # 推薦分數 0-100
    reason: str


class SmartScheduleResponse(BaseModel):
    """智慧排程回應"""
    suggested_slots: List[TimeSlotSuggestion]
    platform_tips: dict
    next_available_slots: List[datetime]


# ============================================================
# 成效報告 API
# ============================================================

class PerformanceSummary(BaseModel):
    """成效摘要回應"""
    period_days: int
    total_impressions: int
    total_reach: int
    total_likes: int
    total_comments: int
    total_shares: int
    total_saves: int
    total_clicks: int
    total_views: int
    avg_engagement_rate: float
    total_posts_tracked: int


class PlatformBreakdown(BaseModel):
    """平台分解"""
    platform: str
    total_impressions: int
    total_reach: int
    total_likes: int
    total_comments: int
    avg_engagement_rate: float
    post_count: int


@router.get("/performance/summary", response_model=PerformanceSummary)
async def get_performance_summary(
    days: int = Query(30, ge=1, le=365, description="統計天數"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取得用戶的整體成效摘要"""
    from app.services.metrics_service import MetricsService
    
    metrics_service = MetricsService(db)
    summary = metrics_service.get_performance_summary(current_user.id, days)
    
    return summary


@router.get("/performance/platforms", response_model=List[PlatformBreakdown])
async def get_platform_breakdown(
    days: int = Query(30, ge=1, le=365, description="統計天數"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取得各平台的成效分解"""
    from app.services.metrics_service import MetricsService
    
    metrics_service = MetricsService(db)
    breakdown = metrics_service.get_platform_breakdown(current_user.id, days)
    
    return breakdown


@router.post("/performance/sync-all")
async def sync_all_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """同步用戶所有已發布貼文的成效數據"""
    from app.services.metrics_service import MetricsService
    
    metrics_service = MetricsService(db)
    stats = metrics_service.sync_all_published_posts(current_user.id)
    
    return {
        "message": "同步完成",
        "success": stats["success"],
        "failed": stats["failed"],
        "skipped": stats["skipped"]
    }


# ============================================================
# 智慧排程建議 API
# ============================================================

@router.get("/smart-schedule", response_model=SmartScheduleResponse)
async def get_smart_schedule_suggestions(
    platform: Optional[str] = Query(None, description="目標平台"),
    content_type: Optional[str] = Query(None, description="內容類型"),
    count: int = Query(5, le=10, description="建議數量"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取得智慧排程建議（基於最佳發文時段）"""
    
    # 各平台最佳發文時段（基於行業研究數據）
    platform_best_times = {
        "instagram": [
            {"time": "08:00", "days": [1, 2, 3, 4, 5], "score": 85, "reason": "上班族早餐時段滑手機"},
            {"time": "12:00", "days": [1, 2, 3, 4, 5], "score": 90, "reason": "午休時段最高互動率"},
            {"time": "19:00", "days": [0, 1, 2, 3, 4, 5, 6], "score": 95, "reason": "下班後黃金時段"},
            {"time": "21:00", "days": [0, 6], "score": 88, "reason": "週末晚間放鬆時段"},
        ],
        "facebook": [
            {"time": "09:00", "days": [1, 2, 3, 4, 5], "score": 82, "reason": "工作開始前瀏覽"},
            {"time": "13:00", "days": [1, 2, 3, 4, 5], "score": 88, "reason": "午後休息時段"},
            {"time": "16:00", "days": [3, 4], "score": 85, "reason": "週三四下午活躍度高"},
            {"time": "20:00", "days": [0, 1, 2, 3, 4, 5, 6], "score": 90, "reason": "晚間家庭時間"},
        ],
        "tiktok": [
            {"time": "07:00", "days": [0, 1, 2, 3, 4, 5, 6], "score": 80, "reason": "早起刷影片族群"},
            {"time": "12:00", "days": [0, 1, 2, 3, 4, 5, 6], "score": 85, "reason": "午休娛樂時段"},
            {"time": "19:00", "days": [0, 1, 2, 3, 4, 5, 6], "score": 92, "reason": "晚餐後放鬆高峰"},
            {"time": "22:00", "days": [4, 5, 6], "score": 95, "reason": "週末深夜最高流量"},
        ],
        "linkedin": [
            {"time": "08:00", "days": [2, 3, 4], "score": 90, "reason": "專業人士早晨閱讀"},
            {"time": "10:00", "days": [2, 3], "score": 88, "reason": "週二三工作效率高"},
            {"time": "12:00", "days": [1, 2, 3, 4, 5], "score": 85, "reason": "午餐時段專業內容"},
            {"time": "17:00", "days": [3, 4], "score": 82, "reason": "下班前最後瀏覽"},
        ],
        "xiaohongshu": [
            {"time": "12:00", "days": [0, 1, 2, 3, 4, 5, 6], "score": 88, "reason": "午休種草時段"},
            {"time": "18:00", "days": [0, 1, 2, 3, 4, 5, 6], "score": 90, "reason": "下班後購物研究"},
            {"time": "21:00", "days": [0, 1, 2, 3, 4, 5, 6], "score": 95, "reason": "晚間最高活躍度"},
            {"time": "22:30", "days": [4, 5, 6], "score": 85, "reason": "週末深夜探索"},
        ],
    }
    
    # 內容類型的額外建議
    content_type_tips = {
        "social_image": "圖文貼文在午間和晚間表現最佳",
        "short_video": "短影音在晚間 7-10 點觸及率最高",
        "blog_post": "長文在早晨和午休時段閱讀率較高",
    }
    
    # 取得建議時段
    suggested_slots = []
    best_times = platform_best_times.get(platform, platform_best_times["instagram"])
    
    for slot_info in best_times[:count]:
        for day in slot_info["days"][:2]:  # 每個時段取 2 天
            suggested_slots.append(TimeSlotSuggestion(
                time=slot_info["time"],
                day_of_week=day,
                score=slot_info["score"],
                reason=slot_info["reason"]
            ))
    
    # 計算接下來可用的具體時段
    now = datetime.now(pytz.timezone("Asia/Taipei"))
    next_slots = []
    
    for i in range(count):
        # 找最近的建議時段
        slot = best_times[i % len(best_times)]
        target_hour, target_minute = map(int, slot["time"].split(":"))
        
        next_slot = now.replace(hour=target_hour, minute=target_minute, second=0, microsecond=0)
        
        # 如果今天的時段已過，則改為明天
        if next_slot <= now:
            next_slot += timedelta(days=1)
        
        # 確保是建議的星期幾
        while next_slot.weekday() not in slot["days"]:
            next_slot += timedelta(days=1)
        
        next_slots.append(next_slot)
    
    # 排序並去重
    next_slots = sorted(set(next_slots))[:count]
    
    # 平台提示
    platform_tips = {
        "general": "根據數據分析，以下是您的最佳發文時段建議",
        "content_tip": content_type_tips.get(content_type, "選擇適合的時段能提升內容觸及率"),
        "platform_specific": f"{platform} 用戶在晚間活躍度最高" if platform else "請選擇目標平台以獲得更精準建議"
    }
    
    return SmartScheduleResponse(
        suggested_slots=suggested_slots[:count],
        platform_tips=platform_tips,
        next_available_slots=next_slots
    )
