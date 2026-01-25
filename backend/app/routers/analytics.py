"""
成效分析 API 路由
提供內容成效數據查詢、手動同步、報表生成等功能
"""

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_
from typing import Optional, List
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.database import get_db
from app.models import User, ContentMetrics, MetricsSyncLog, ScheduledPost, Post, SocialAccount
from app.routers.auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics"])


# ============================================================
# Schemas
# ============================================================

class MetricsSummary(BaseModel):
    total_impressions: int
    total_reach: int
    total_likes: int
    total_comments: int
    total_shares: int
    total_saves: int
    avg_engagement_rate: float
    post_count: int


class PlatformMetrics(BaseModel):
    platform: str
    impressions: int
    reach: int
    likes: int
    comments: int
    engagement_rate: float
    post_count: int


class PostMetrics(BaseModel):
    id: int
    scheduled_post_id: Optional[int]
    post_id: Optional[int]
    platform: str
    platform_post_url: Optional[str]
    metric_date: datetime
    impressions: int
    reach: int
    likes: int
    comments: int
    shares: int
    saves: int
    engagement_rate: float
    last_synced_at: Optional[datetime]


class SyncRequest(BaseModel):
    platform: Optional[str] = None


class SyncResponse(BaseModel):
    task_id: str
    status: str
    message: str


# ============================================================
# 總覽端點
# ============================================================

@router.get("/overview")
async def get_analytics_overview(
    days: int = Query(default=30, ge=7, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取成效總覽
    彙總指定天數內的所有平台成效
    """
    start_date = datetime.now() - timedelta(days=days)
    
    # 查詢該用戶的所有指標
    metrics = db.query(ContentMetrics).filter(
        ContentMetrics.user_id == current_user.id,
        ContentMetrics.metric_date >= start_date
    ).all()
    
    if not metrics:
        return {
            "period": {"days": days, "start": start_date.isoformat(), "end": datetime.now().isoformat()},
            "summary": {
                "total_impressions": 0,
                "total_reach": 0,
                "total_likes": 0,
                "total_comments": 0,
                "total_shares": 0,
                "total_saves": 0,
                "avg_engagement_rate": 0,
                "post_count": 0
            },
            "by_platform": [],
            "daily_trend": []
        }
    
    # 彙總數據
    total_impressions = sum(m.impressions or 0 for m in metrics)
    total_reach = sum(m.reach or 0 for m in metrics)
    total_likes = sum(m.likes or 0 for m in metrics)
    total_comments = sum(m.comments or 0 for m in metrics)
    total_shares = sum(m.shares or 0 for m in metrics)
    total_saves = sum(m.saves or 0 for m in metrics)
    
    # 計算平均互動率
    engagement_rates = [float(m.engagement_rate) for m in metrics if m.engagement_rate]
    avg_engagement_rate = sum(engagement_rates) / len(engagement_rates) if engagement_rates else 0
    
    # 按平台分組
    platform_data = {}
    for m in metrics:
        if m.platform not in platform_data:
            platform_data[m.platform] = {
                "platform": m.platform,
                "impressions": 0,
                "reach": 0,
                "likes": 0,
                "comments": 0,
                "post_count": 0,
                "engagement_rates": []
            }
        
        platform_data[m.platform]["impressions"] += m.impressions or 0
        platform_data[m.platform]["reach"] += m.reach or 0
        platform_data[m.platform]["likes"] += m.likes or 0
        platform_data[m.platform]["comments"] += m.comments or 0
        platform_data[m.platform]["post_count"] += 1
        if m.engagement_rate:
            platform_data[m.platform]["engagement_rates"].append(float(m.engagement_rate))
    
    by_platform = []
    for p, data in platform_data.items():
        rates = data.pop("engagement_rates")
        data["engagement_rate"] = sum(rates) / len(rates) if rates else 0
        by_platform.append(data)
    
    # 每日趨勢
    daily_data = {}
    for m in metrics:
        date_key = m.metric_date.strftime("%Y-%m-%d")
        if date_key not in daily_data:
            daily_data[date_key] = {
                "date": date_key,
                "impressions": 0,
                "reach": 0,
                "likes": 0,
                "comments": 0
            }
        daily_data[date_key]["impressions"] += m.impressions or 0
        daily_data[date_key]["reach"] += m.reach or 0
        daily_data[date_key]["likes"] += m.likes or 0
        daily_data[date_key]["comments"] += m.comments or 0
    
    daily_trend = sorted(daily_data.values(), key=lambda x: x["date"])
    
    return {
        "period": {
            "days": days,
            "start": start_date.isoformat(),
            "end": datetime.now().isoformat()
        },
        "summary": {
            "total_impressions": total_impressions,
            "total_reach": total_reach,
            "total_likes": total_likes,
            "total_comments": total_comments,
            "total_shares": total_shares,
            "total_saves": total_saves,
            "avg_engagement_rate": round(avg_engagement_rate * 100, 2),
            "post_count": len(set(m.scheduled_post_id or m.post_id for m in metrics if m.scheduled_post_id or m.post_id))
        },
        "by_platform": by_platform,
        "daily_trend": daily_trend
    }


# ============================================================
# 平台端點
# ============================================================

@router.get("/platforms")
async def get_platforms_analytics(
    days: int = Query(default=30, ge=7, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取各平台成效彙總
    """
    start_date = datetime.now() - timedelta(days=days)
    
    # 按平台彙總
    results = db.query(
        ContentMetrics.platform,
        func.sum(ContentMetrics.impressions).label("total_impressions"),
        func.sum(ContentMetrics.reach).label("total_reach"),
        func.sum(ContentMetrics.likes).label("total_likes"),
        func.sum(ContentMetrics.comments).label("total_comments"),
        func.sum(ContentMetrics.shares).label("total_shares"),
        func.sum(ContentMetrics.saves).label("total_saves"),
        func.avg(ContentMetrics.engagement_rate).label("avg_engagement"),
        func.count(ContentMetrics.id).label("record_count")
    ).filter(
        ContentMetrics.user_id == current_user.id,
        ContentMetrics.metric_date >= start_date
    ).group_by(ContentMetrics.platform).all()
    
    platforms = []
    for r in results:
        platforms.append({
            "platform": r.platform,
            "impressions": int(r.total_impressions or 0),
            "reach": int(r.total_reach or 0),
            "likes": int(r.total_likes or 0),
            "comments": int(r.total_comments or 0),
            "shares": int(r.total_shares or 0),
            "saves": int(r.total_saves or 0),
            "engagement_rate": round(float(r.avg_engagement or 0) * 100, 2),
            "record_count": r.record_count
        })
    
    return {"platforms": platforms}


@router.get("/platforms/{platform}")
async def get_platform_analytics(
    platform: str,
    days: int = Query(default=30, ge=7, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取特定平台的詳細成效
    """
    start_date = datetime.now() - timedelta(days=days)
    
    metrics = db.query(ContentMetrics).filter(
        ContentMetrics.user_id == current_user.id,
        ContentMetrics.platform == platform,
        ContentMetrics.metric_date >= start_date
    ).order_by(desc(ContentMetrics.metric_date)).all()
    
    if not metrics:
        return {
            "platform": platform,
            "summary": {},
            "posts": [],
            "daily_trend": []
        }
    
    # 彙總
    summary = {
        "total_impressions": sum(m.impressions or 0 for m in metrics),
        "total_reach": sum(m.reach or 0 for m in metrics),
        "total_likes": sum(m.likes or 0 for m in metrics),
        "total_comments": sum(m.comments or 0 for m in metrics),
        "avg_engagement_rate": round(
            sum(float(m.engagement_rate or 0) for m in metrics) / len(metrics) * 100, 2
        ) if metrics else 0
    }
    
    # 貼文列表
    posts = []
    seen_posts = set()
    for m in metrics:
        post_key = m.scheduled_post_id or m.post_id
        if post_key and post_key not in seen_posts:
            seen_posts.add(post_key)
            posts.append({
                "id": m.id,
                "scheduled_post_id": m.scheduled_post_id,
                "post_id": m.post_id,
                "platform_post_url": m.platform_post_url,
                "impressions": m.impressions,
                "reach": m.reach,
                "likes": m.likes,
                "comments": m.comments,
                "engagement_rate": round(float(m.engagement_rate or 0) * 100, 2),
                "last_synced_at": m.last_synced_at.isoformat() if m.last_synced_at else None
            })
    
    # 每日趨勢
    daily_data = {}
    for m in metrics:
        date_key = m.metric_date.strftime("%Y-%m-%d")
        if date_key not in daily_data:
            daily_data[date_key] = {"date": date_key, "impressions": 0, "likes": 0}
        daily_data[date_key]["impressions"] += m.impressions or 0
        daily_data[date_key]["likes"] += m.likes or 0
    
    return {
        "platform": platform,
        "summary": summary,
        "posts": posts[:20],  # 最多 20 筆
        "daily_trend": sorted(daily_data.values(), key=lambda x: x["date"])
    }


# ============================================================
# 貼文端點
# ============================================================

@router.get("/posts")
async def get_posts_analytics(
    days: int = Query(default=30, ge=7, le=90),
    platform: Optional[str] = None,
    sort_by: str = Query(default="impressions", enum=["impressions", "likes", "engagement_rate", "metric_date"]),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取貼文成效列表
    """
    start_date = datetime.now() - timedelta(days=days)
    
    query = db.query(ContentMetrics).filter(
        ContentMetrics.user_id == current_user.id,
        ContentMetrics.metric_date >= start_date
    )
    
    if platform:
        query = query.filter(ContentMetrics.platform == platform)
    
    # 排序
    sort_column = getattr(ContentMetrics, sort_by, ContentMetrics.impressions)
    query = query.order_by(desc(sort_column))
    
    metrics = query.limit(limit).all()
    
    posts = []
    for m in metrics:
        posts.append({
            "id": m.id,
            "scheduled_post_id": m.scheduled_post_id,
            "post_id": m.post_id,
            "platform": m.platform,
            "platform_post_url": m.platform_post_url,
            "metric_date": m.metric_date.isoformat(),
            "impressions": m.impressions or 0,
            "reach": m.reach or 0,
            "likes": m.likes or 0,
            "comments": m.comments or 0,
            "shares": m.shares or 0,
            "saves": m.saves or 0,
            "engagement_rate": round(float(m.engagement_rate or 0) * 100, 2),
            "last_synced_at": m.last_synced_at.isoformat() if m.last_synced_at else None
        })
    
    return {"posts": posts}


@router.get("/posts/{post_id}")
async def get_post_analytics(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取單一貼文的成效歷史
    """
    # 查詢該貼文的所有指標記錄（按日期排序）
    metrics = db.query(ContentMetrics).filter(
        ContentMetrics.user_id == current_user.id,
        ContentMetrics.scheduled_post_id == post_id
    ).order_by(ContentMetrics.metric_date).all()
    
    if not metrics:
        # 嘗試查詢 post_id
        metrics = db.query(ContentMetrics).filter(
            ContentMetrics.user_id == current_user.id,
            ContentMetrics.post_id == post_id
        ).order_by(ContentMetrics.metric_date).all()
    
    if not metrics:
        raise HTTPException(status_code=404, detail="Post metrics not found")
    
    # 最新指標
    latest = metrics[-1]
    
    # 歷史趨勢
    history = []
    for m in metrics:
        history.append({
            "date": m.metric_date.isoformat(),
            "impressions": m.impressions or 0,
            "reach": m.reach or 0,
            "likes": m.likes or 0,
            "comments": m.comments or 0,
            "engagement_rate": round(float(m.engagement_rate or 0) * 100, 2)
        })
    
    return {
        "post_id": post_id,
        "platform": latest.platform,
        "platform_post_url": latest.platform_post_url,
        "current_metrics": {
            "impressions": latest.impressions or 0,
            "reach": latest.reach or 0,
            "likes": latest.likes or 0,
            "comments": latest.comments or 0,
            "shares": latest.shares or 0,
            "saves": latest.saves or 0,
            "engagement_rate": round(float(latest.engagement_rate or 0) * 100, 2)
        },
        "history": history,
        "last_synced_at": latest.last_synced_at.isoformat() if latest.last_synced_at else None
    }


# ============================================================
# 同步端點
# ============================================================

@router.post("/sync")
async def trigger_sync(
    request: SyncRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    手動觸發成效數據同步
    """
    from app.tasks.analytics_tasks import manual_sync
    
    # 檢查是否有進行中的同步
    recent_sync = db.query(MetricsSyncLog).filter(
        MetricsSyncLog.user_id == current_user.id,
        MetricsSyncLog.status == "running",
        MetricsSyncLog.started_at >= datetime.now() - timedelta(minutes=10)
    ).first()
    
    if recent_sync:
        raise HTTPException(
            status_code=429,
            detail="已有同步任務進行中，請稍後再試"
        )
    
    # 觸發 Celery 任務
    task = manual_sync.delay(user_id=current_user.id, platform=request.platform)
    
    return {
        "task_id": task.id,
        "status": "queued",
        "message": "同步任務已加入佇列"
    }


@router.post("/sync/post/{post_id}")
async def trigger_post_sync(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    同步單一貼文的成效
    """
    from app.tasks.analytics_tasks import sync_single_post
    
    # 驗證貼文屬於該用戶
    post = db.query(ScheduledPost).filter(
        ScheduledPost.id == post_id,
        ScheduledPost.user_id == current_user.id
    ).first()
    
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post.status != "published" or not post.platform_post_id:
        raise HTTPException(status_code=400, detail="Post has not been published")
    
    # 觸發 Celery 任務
    task = sync_single_post.delay(scheduled_post_id=post_id)
    
    return {
        "task_id": task.id,
        "status": "queued",
        "message": "貼文同步任務已加入佇列"
    }


# ============================================================
# 同步日誌端點
# ============================================================

@router.get("/sync/logs")
async def get_sync_logs(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取同步日誌
    """
    logs = db.query(MetricsSyncLog).filter(
        MetricsSyncLog.user_id == current_user.id
    ).order_by(desc(MetricsSyncLog.started_at)).limit(limit).all()
    
    return {
        "logs": [
            {
                "id": log.id,
                "sync_type": log.sync_type,
                "platform": log.platform,
                "status": log.status,
                "total_posts": log.total_posts,
                "success_count": log.success_count,
                "failed_count": log.failed_count,
                "error_message": log.error_message,
                "started_at": log.started_at.isoformat() if log.started_at else None,
                "completed_at": log.completed_at.isoformat() if log.completed_at else None,
                "duration_seconds": log.duration_seconds
            }
            for log in logs
        ]
    }


# ============================================================
# 排名端點
# ============================================================

@router.get("/top-posts")
async def get_top_posts(
    days: int = Query(default=30, ge=7, le=90),
    metric: str = Query(default="impressions", enum=["impressions", "likes", "engagement_rate"]),
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取表現最佳的貼文
    """
    start_date = datetime.now() - timedelta(days=days)
    
    sort_column = getattr(ContentMetrics, metric, ContentMetrics.impressions)
    
    metrics = db.query(ContentMetrics).filter(
        ContentMetrics.user_id == current_user.id,
        ContentMetrics.metric_date >= start_date,
        ContentMetrics.scheduled_post_id.isnot(None)
    ).order_by(desc(sort_column)).limit(limit).all()
    
    posts = []
    for m in metrics:
        # 獲取貼文詳情
        scheduled_post = None
        if m.scheduled_post_id:
            scheduled_post = db.query(ScheduledPost).filter(
                ScheduledPost.id == m.scheduled_post_id
            ).first()
        
        posts.append({
            "id": m.id,
            "scheduled_post_id": m.scheduled_post_id,
            "platform": m.platform,
            "platform_post_url": m.platform_post_url,
            "title": scheduled_post.title if scheduled_post else None,
            "caption": (scheduled_post.caption[:100] + "...") if scheduled_post and scheduled_post.caption and len(scheduled_post.caption) > 100 else (scheduled_post.caption if scheduled_post else None),
            "impressions": m.impressions or 0,
            "reach": m.reach or 0,
            "likes": m.likes or 0,
            "comments": m.comments or 0,
            "engagement_rate": round(float(m.engagement_rate or 0) * 100, 2),
            "published_at": scheduled_post.published_at.isoformat() if scheduled_post and scheduled_post.published_at else None
        })
    
    return {"top_posts": posts, "metric": metric, "days": days}
