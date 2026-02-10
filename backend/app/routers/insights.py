"""
成效洞察 API 路由
整合 GA4 與社群平台數據
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.models import User, SocialAccount
from app.routers.auth import get_current_user
from app.services.insights_service import insights_service
from app.services.ga4_service import ga4_service

router = APIRouter(prefix="/insights", tags=["Insights"])


# ==================== 方案權限 ====================

# 可完整使用成效洞察引擎的方案（專業版以上）
FULL_INSIGHTS_TIERS = ["pro", "enterprise", "admin"]

def _user_has_full_insights(user: User) -> bool:
    """檢查用戶是否有完整洞察權限（專業版以上）"""
    return (user.tier in FULL_INSIGHTS_TIERS or 
            user.subscription_plan in FULL_INSIGHTS_TIERS or
            user.email == "admin@kingjam.ai")


# ==================== Schemas ====================

class GA4ConnectionRequest(BaseModel):
    property_id: str  # GA4 Property ID


class GA4ConnectionResponse(BaseModel):
    connected: bool
    property_id: Optional[str] = None
    last_sync: Optional[str] = None


# ==================== 方案檢查 ====================

@router.get("/plan-access")
async def get_insights_plan_access(
    current_user: User = Depends(get_current_user)
):
    """
    檢查用戶的洞察引擎使用權限
    
    - 專業版/企業版：完整使用所有功能
    - 免費版/入門版：僅能串接 WordPress 網站（基本發布統計）
    """
    has_full = _user_has_full_insights(current_user)
    tier = current_user.subscription_plan or current_user.tier or "free"
    
    return {
        "has_full_access": has_full,
        "current_tier": tier,
        "allowed_platforms": None if has_full else ["wordpress"],
        "upgrade_required": not has_full,
        "message": None if has_full else "升級至專業版即可解鎖完整成效洞察引擎，包含所有社群平台數據分析、GA4 整合、流量分析等功能。"
    }


# ==================== 儀表板總覽 ====================

@router.get("/dashboard")
async def get_dashboard_overview(
    days: int = Query(default=30, ge=7, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取成效洞察儀表板概覽
    
    整合:
    - 發布統計 (成功/失敗數)
    - 各平台成效數據
    - 綜合指標摘要
    
    非專業版用戶：僅回傳 WordPress 平台數據
    """
    try:
        overview = await insights_service.get_dashboard_overview(
            db=db,
            user_id=current_user.id,
            days=days
        )
        
        # 非專業版：過濾僅保留 WordPress 平台數據
        if not _user_has_full_insights(current_user):
            if overview.get("platforms"):
                overview["platforms"] = [
                    p for p in overview["platforms"]
                    if p.get("platform", "").lower() == "wordpress"
                ]
            # 重新計算 summary（僅包含 WordPress 數據）
            overview["plan_limited"] = True
        
        return overview
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/publish-stats")
async def get_publish_stats(
    days: int = Query(default=30, ge=7, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取發布統計
    """
    try:
        stats = await insights_service.get_publish_stats(
            db=db,
            user_id=current_user.id,
            days=days
        )
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 平台成效 ====================

@router.get("/platforms")
async def get_platforms_insights(
    days: int = Query(default=30, ge=7, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取所有已連結平台的成效數據
    
    非專業版用戶：僅回傳 WordPress 平台數據
    """
    try:
        has_full = _user_has_full_insights(current_user)
        
        query = db.query(SocialAccount).filter(
            SocialAccount.user_id == current_user.id,
            SocialAccount.is_active == True
        )
        
        # 非專業版：僅查詢 WordPress
        if not has_full:
            query = query.filter(SocialAccount.platform == "wordpress")
        
        accounts = query.all()
        
        insights = []
        for account in accounts:
            try:
                platform_data = await insights_service.get_platform_insights(account, days)
                insights.append(platform_data)
            except Exception as e:
                insights.append({
                    "platform": account.platform,
                    "username": account.platform_username,
                    "error": str(e)
                })
        
        return {
            "platforms": insights,
            "total_connected": len(accounts),
            "plan_limited": not has_full
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/platforms/{platform}")
async def get_platform_insights(
    platform: str,
    days: int = Query(default=30, ge=7, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取特定平台的成效數據
    
    非專業版用戶：僅允許查詢 WordPress
    """
    # 非專業版：僅允許 WordPress
    if not _user_has_full_insights(current_user) and platform.lower() != "wordpress":
        raise HTTPException(
            status_code=403,
            detail="升級至專業版即可查看所有社群平台的成效數據"
        )
    
    account = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.platform == platform,
        SocialAccount.is_active == True
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=404,
            detail=f"No connected {platform} account found"
        )
    
    try:
        insights = await insights_service.get_platform_insights(account, days)
        return insights
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 貼文成效 ====================

@router.get("/posts/{post_id}")
async def get_post_performance(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取單一發布貼文的成效數據
    """
    try:
        performance = await insights_service.get_post_performance(
            db=db,
            user_id=current_user.id,
            post_id=post_id
        )
        
        if "error" in performance:
            raise HTTPException(status_code=404, detail=performance["error"])
        
        return performance
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== GA4 整合 ====================

@router.get("/ga4/auth-url")
async def get_ga4_auth_url(
    current_user: User = Depends(get_current_user)
):
    """
    獲取 GA4 OAuth 授權 URL（專業版以上）
    """
    if not _user_has_full_insights(current_user):
        raise HTTPException(
            status_code=403,
            detail="GA4 整合為專業版功能，請升級方案以使用"
        )
    
    import secrets
    state = f"{current_user.id}_{secrets.token_urlsafe(16)}"
    auth_url = ga4_service.get_auth_url(state)
    
    return {
        "auth_url": auth_url,
        "state": state
    }


@router.post("/ga4/callback")
async def ga4_oauth_callback(
    code: str,
    state: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    處理 GA4 OAuth 回調（專業版以上）
    """
    if not _user_has_full_insights(current_user):
        raise HTTPException(
            status_code=403,
            detail="GA4 整合為專業版功能，請升級方案以使用"
        )
    try:
        tokens = await ga4_service.exchange_code_for_token(code)
        
        # 儲存 GA4 連結資訊到 SocialAccount
        existing = db.query(SocialAccount).filter(
            SocialAccount.user_id == current_user.id,
            SocialAccount.platform == "ga4"
        ).first()
        
        if existing:
            existing.access_token = tokens["access_token"]
            existing.refresh_token = tokens.get("refresh_token")
            existing.is_active = True
        else:
            ga4_account = SocialAccount(
                user_id=current_user.id,
                platform="ga4",
                platform_username="Google Analytics",
                access_token=tokens["access_token"],
                refresh_token=tokens.get("refresh_token"),
                is_active=True
            )
            db.add(ga4_account)
        
        db.commit()
        
        return {
            "success": True,
            "message": "GA4 connected successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/ga4/connect")
async def connect_ga4_property(
    request: GA4ConnectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    連結 GA4 Property（專業版以上）
    """
    if not _user_has_full_insights(current_user):
        raise HTTPException(
            status_code=403,
            detail="GA4 整合為專業版功能，請升級方案以使用"
        )
    ga4_account = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.platform == "ga4"
    ).first()
    
    if not ga4_account:
        raise HTTPException(
            status_code=400,
            detail="Please authorize GA4 access first"
        )
    
    # 儲存 Property ID
    ga4_account.platform_user_id = request.property_id
    ga4_account.extra_settings = {
        **(ga4_account.extra_settings or {}),
        "property_id": request.property_id
    }
    db.commit()
    
    return {
        "success": True,
        "property_id": request.property_id
    }


@router.get("/ga4/status")
async def get_ga4_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取 GA4 連結狀態
    """
    ga4_account = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.platform == "ga4",
        SocialAccount.is_active == True
    ).first()
    
    if not ga4_account:
        return {
            "connected": False,
            "property_id": None
        }
    
    return {
        "connected": True,
        "property_id": ga4_account.platform_user_id,
        "extra_settings": ga4_account.extra_settings
    }


@router.get("/ga4/traffic")
async def get_ga4_traffic(
    start_date: str = Query(default="30daysAgo"),
    end_date: str = Query(default="today"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取 GA4 流量數據（專業版以上）
    """
    if not _user_has_full_insights(current_user):
        raise HTTPException(
            status_code=403,
            detail="GA4 流量分析為專業版功能，請升級方案以使用"
        )
    ga4_account = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.platform == "ga4",
        SocialAccount.is_active == True
    ).first()
    
    if not ga4_account:
        raise HTTPException(
            status_code=400,
            detail="GA4 not connected"
        )
    
    property_id = ga4_account.platform_user_id
    if not property_id:
        raise HTTPException(
            status_code=400,
            detail="GA4 Property ID not configured"
        )
    
    try:
        traffic = await ga4_service.get_traffic_overview(
            access_token=ga4_account.access_token,
            property_id=property_id,
            start_date=start_date,
            end_date=end_date
        )
        return traffic
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ga4/top-pages")
async def get_ga4_top_pages(
    start_date: str = Query(default="30daysAgo"),
    end_date: str = Query(default="today"),
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取 GA4 熱門頁面（專業版以上）
    """
    if not _user_has_full_insights(current_user):
        raise HTTPException(
            status_code=403,
            detail="GA4 流量分析為專業版功能，請升級方案以使用"
        )
    ga4_account = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.platform == "ga4",
        SocialAccount.is_active == True
    ).first()
    
    if not ga4_account or not ga4_account.platform_user_id:
        raise HTTPException(status_code=400, detail="GA4 not connected")
    
    try:
        pages = await ga4_service.get_top_pages(
            access_token=ga4_account.access_token,
            property_id=ga4_account.platform_user_id,
            start_date=start_date,
            end_date=end_date,
            limit=limit
        )
        return {"pages": pages}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ga4/sources")
async def get_ga4_traffic_sources(
    start_date: str = Query(default="30daysAgo"),
    end_date: str = Query(default="today"),
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取 GA4 流量來源（專業版以上）
    """
    if not _user_has_full_insights(current_user):
        raise HTTPException(
            status_code=403,
            detail="GA4 流量分析為專業版功能，請升級方案以使用"
        )
    ga4_account = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.platform == "ga4",
        SocialAccount.is_active == True
    ).first()
    
    if not ga4_account or not ga4_account.platform_user_id:
        raise HTTPException(status_code=400, detail="GA4 not connected")
    
    try:
        sources = await ga4_service.get_traffic_sources(
            access_token=ga4_account.access_token,
            property_id=ga4_account.platform_user_id,
            start_date=start_date,
            end_date=end_date,
            limit=limit
        )
        return {"sources": sources}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ga4/realtime")
async def get_ga4_realtime(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取 GA4 即時用戶數據（專業版以上）
    """
    if not _user_has_full_insights(current_user):
        raise HTTPException(
            status_code=403,
            detail="GA4 即時數據為專業版功能，請升級方案以使用"
        )
    ga4_account = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.platform == "ga4",
        SocialAccount.is_active == True
    ).first()
    
    if not ga4_account or not ga4_account.platform_user_id:
        raise HTTPException(status_code=400, detail="GA4 not connected")
    
    try:
        realtime = await ga4_service.get_realtime_users(
            access_token=ga4_account.access_token,
            property_id=ga4_account.platform_user_id
        )
        return realtime
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 模擬數據 (開發用) ====================

@router.get("/demo/dashboard")
async def get_demo_dashboard():
    """
    獲取示範儀表板數據 (不需要登入)
    用於展示功能
    """
    import random
    from datetime import datetime, timedelta
    
    # 生成模擬每日數據
    daily_data = []
    base_date = datetime.now() - timedelta(days=30)
    for i in range(30):
        date = base_date + timedelta(days=i)
        daily_data.append({
            "date": date.strftime("%Y-%m-%d"),
            "posts": random.randint(1, 5),
            "impressions": random.randint(5000, 25000),
            "engagement": random.randint(200, 1500)
        })
    
    return {
        "period": {
            "start": (datetime.now() - timedelta(days=30)).isoformat(),
            "end": datetime.now().isoformat(),
            "days": 30
        },
        "summary": {
            "total_posts": sum(d["posts"] for d in daily_data),
            "success_rate": 96.5,
            "total_impressions": sum(d["impressions"] for d in daily_data),
            "total_engagement": sum(d["engagement"] for d in daily_data),
            "total_followers": 15420,
            "platforms_connected": 4
        },
        "platforms": [
            {
                "platform": "instagram",
                "username": "@demo_brand",
                "avatar": None,
                "metrics": {
                    "follower_count": 8500,
                    "impressions": 125000,
                    "reach": 85000,
                    "profile_views": 3200
                },
                "totals": {
                    "total_likes": 12500,
                    "total_comments": 890,
                    "post_count": 45
                },
                "top_posts": [
                    {
                        "id": "1",
                        "caption": "最新產品上市！🎉 限時優惠中...",
                        "type": "IMAGE",
                        "metrics": {"likes": 2500, "comments": 180, "impressions": 45000}
                    },
                    {
                        "id": "2",
                        "caption": "幕後花絮大公開 ✨",
                        "type": "VIDEO",
                        "metrics": {"likes": 1800, "comments": 95, "impressions": 32000}
                    }
                ]
            },
            {
                "platform": "facebook",
                "username": "Demo Brand Page",
                "metrics": {
                    "page_fans": 5200,
                    "page_impressions": 85000,
                    "page_engaged_users": 4500
                }
            },
            {
                "platform": "youtube",
                "username": "Demo Brand",
                "metrics": {
                    "subscribers": 1720,
                    "total_views": 125000,
                    "video_count": 28
                }
            }
        ],
        "traffic": {
            "totals": {
                "sessions": 35420,
                "users": 28500,
                "pageviews": 89500,
                "new_users": 12000
            },
            "sources": [
                {"source": "google", "medium": "organic", "sessions": 15200},
                {"source": "facebook", "medium": "social", "sessions": 8500},
                {"source": "(direct)", "medium": "(none)", "sessions": 6200},
                {"source": "instagram", "medium": "social", "sessions": 3800}
            ],
            "top_pages": [
                {"path": "/", "title": "首頁", "views": 25000},
                {"path": "/products", "title": "產品頁", "views": 18500},
                {"path": "/blog/ai-marketing", "title": "AI 行銷指南", "views": 12000}
            ]
        },
        "daily": daily_data
    }
