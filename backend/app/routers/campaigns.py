"""
行銷活動管理 API
管理優惠活動、促銷碼、點數贈送活動等
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, List
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, or_

from app.database import get_db
from app.models import User, CreditTransaction, Notification
from app.routers.auth import get_current_user
from app.services.credit_service import CreditService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/campaigns", tags=["管理後台 - 行銷活動"])


# ============================================================
# Pydantic Models
# ============================================================

class CampaignCreate(BaseModel):
    name: str = Field(..., description="活動名稱")
    campaign_type: str = Field(..., description="活動類型: promo_credits, discount_code, referral_bonus")
    description: Optional[str] = None
    
    # 點數贈送設定
    credits_amount: int = Field(default=0, ge=0, description="贈送點數數量")
    expires_in_days: int = Field(default=30, ge=1, le=365, description="點數有效天數")
    
    # 目標用戶設定
    target_type: str = Field(default="all", description="目標類型: all, new_users, inactive, tier, custom")
    target_tier: Optional[str] = Field(default=None, description="目標方案等級")
    target_user_ids: Optional[List[int]] = Field(default=None, description="指定用戶 ID 列表")
    inactive_days: Optional[int] = Field(default=30, description="不活躍天數（用於 inactive 類型）")
    
    # 活動時間
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    
    # 發送通知
    send_notification: bool = Field(default=True, description="是否發送站內通知")
    send_email: bool = Field(default=False, description="是否發送 Email")
    notification_title: Optional[str] = None
    notification_message: Optional[str] = None


class CampaignExecuteRequest(BaseModel):
    campaign_id: int
    dry_run: bool = Field(default=True, description="試運行（不實際發放）")


class BulkCreditsRequest(BaseModel):
    """批量發放點數"""
    user_ids: List[int] = Field(..., description="用戶 ID 列表")
    credits_amount: int = Field(..., ge=1, description="點數數量")
    expires_in_days: int = Field(default=30, ge=1, le=365)
    campaign_name: str = Field(..., description="活動名稱")
    send_notification: bool = True
    notification_title: Optional[str] = None
    notification_message: Optional[str] = None


class PromoCodeCreate(BaseModel):
    """優惠碼"""
    code: str = Field(..., min_length=4, max_length=20, description="優惠碼")
    credits_amount: int = Field(..., ge=1, description="點數數量")
    max_uses: int = Field(default=100, ge=1, description="最大使用次數")
    max_per_user: int = Field(default=1, ge=1, description="每人限用次數")
    expires_at: Optional[datetime] = None
    description: Optional[str] = None


# ============================================================
# 活動統計
# ============================================================

@router.get("/stats")
async def get_campaign_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取得行銷活動統計"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    # 總用戶數
    total_users = db.query(func.count(User.id)).scalar()
    
    # 活躍用戶（30天內有活動）
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    active_users = db.query(func.count(User.id)).filter(
        User.updated_at >= thirty_days_ago
    ).scalar()
    
    # 新用戶（7天內註冊）
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    new_users = db.query(func.count(User.id)).filter(
        User.created_at >= seven_days_ago
    ).scalar()
    
    # 付費用戶
    paid_users = db.query(func.count(User.id)).filter(
        User.credits_paid > 0
    ).scalar()
    
    # 本月發放 PROMO 點數
    first_day_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    promo_this_month = db.query(func.sum(CreditTransaction.amount)).filter(
        CreditTransaction.transaction_type == "promo",
        CreditTransaction.created_at >= first_day_of_month,
        CreditTransaction.amount > 0
    ).scalar() or 0
    
    # 按方案統計用戶數
    tier_stats = db.query(
        User.tier,
        func.count(User.id).label("count")
    ).group_by(User.tier).all()
    
    return {
        "success": True,
        "stats": {
            "total_users": total_users,
            "active_users": active_users,
            "new_users_7d": new_users,
            "paid_users": paid_users,
            "promo_credits_this_month": int(promo_this_month),
            "by_tier": {stat.tier: stat.count for stat in tier_stats}
        }
    }


# ============================================================
# 目標用戶查詢
# ============================================================

@router.get("/target-users")
async def get_target_users(
    target_type: str = Query(..., description="all, new_users, inactive, tier, custom"),
    tier: Optional[str] = None,
    inactive_days: int = 30,
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取得目標用戶列表"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    query = db.query(User).filter(User.is_active == True)
    
    if target_type == "new_users":
        # 7天內新註冊
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        query = query.filter(User.created_at >= seven_days_ago)
    
    elif target_type == "inactive":
        # 不活躍用戶
        inactive_date = datetime.utcnow() - timedelta(days=inactive_days)
        query = query.filter(
            or_(User.updated_at < inactive_date, User.updated_at == None)
        )
    
    elif target_type == "tier":
        if tier:
            query = query.filter(User.tier == tier)
    
    elif target_type == "paid":
        # 付費用戶
        query = query.filter(User.credits_paid > 0)
    
    elif target_type == "free":
        # 免費用戶（從未付費）
        query = query.filter(User.credits_paid == 0)
    
    users = query.limit(limit).all()
    
    return {
        "success": True,
        "count": len(users),
        "users": [
            {
                "id": u.id,
                "email": u.email[:3] + "***" + u.email[u.email.index("@"):] if "@" in u.email else u.email[:3] + "***",
                "full_name": u.full_name,
                "tier": u.tier,
                "credits": u.credits,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ]
    }


# ============================================================
# 批量發放點數
# ============================================================

@router.post("/bulk-credits")
async def bulk_grant_credits(
    request: BulkCreditsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """批量發放 PROMO 點數"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    credit_service = CreditService(db)
    
    success_count = 0
    failed_count = 0
    results = []
    
    for user_id in request.user_ids:
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                failed_count += 1
                results.append({"user_id": user_id, "status": "not_found"})
                continue
            
            # 發放 PROMO 點數
            credit_service.grant_promo(
                user_id=user_id,
                amount=request.credits_amount,
                campaign=request.campaign_name,
                expires_in_days=request.expires_in_days
            )
            
            # 更新用戶餘額
            user.credits_promo = (user.credits_promo or 0) + request.credits_amount
            user.credits = (user.credits or 0) + request.credits_amount
            
            # 發送通知
            if request.send_notification:
                title = request.notification_title or f"🎁 恭喜獲得 {request.credits_amount} 點"
                message = request.notification_message or f"您已獲得 {request.credits_amount} 點優惠點數（活動：{request.campaign_name}），快去體驗 AI 創作功能吧！"
                
                notification = Notification(
                    user_id=user_id,
                    notification_type="marketing",
                    title=title,
                    message=message,
                    data={
                        "campaign": request.campaign_name,
                        "credits": request.credits_amount,
                        "action_url": "/dashboard/credits"
                    }
                )
                db.add(notification)
            
            success_count += 1
            results.append({"user_id": user_id, "status": "success", "email": user.email})
            
        except Exception as e:
            logger.error(f"發放點數失敗 user_id={user_id}: {e}")
            failed_count += 1
            results.append({"user_id": user_id, "status": "error", "error": str(e)})
    
    db.commit()
    
    logger.info(
        f"[Campaign] 批量發放完成 - 活動: {request.campaign_name}, "
        f"成功: {success_count}, 失敗: {failed_count}, "
        f"操作者: {current_user.email}"
    )
    
    return {
        "success": True,
        "campaign_name": request.campaign_name,
        "total": len(request.user_ids),
        "success_count": success_count,
        "failed_count": failed_count,
        "total_credits": request.credits_amount * success_count,
        "results": results[:50]  # 只返回前 50 筆
    }


# ============================================================
# 快速行銷活動
# ============================================================

@router.post("/quick/welcome-back")
async def welcome_back_campaign(
    inactive_days: int = Query(30, ge=7, le=180),
    credits_amount: int = Query(50, ge=10, le=500),
    dry_run: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    回歸禮活動 - 對不活躍用戶發放點數
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    inactive_date = datetime.utcnow() - timedelta(days=inactive_days)
    
    users = db.query(User).filter(
        User.is_active == True,
        or_(User.updated_at < inactive_date, User.updated_at == None)
    ).all()
    
    if dry_run:
        return {
            "success": True,
            "dry_run": True,
            "campaign": "welcome_back",
            "target_count": len(users),
            "credits_per_user": credits_amount,
            "total_credits": credits_amount * len(users),
            "preview_users": [
                {"id": u.id, "email": u.email[:3] + "***"} 
                for u in users[:10]
            ]
        }
    
    # 實際執行
    request = BulkCreditsRequest(
        user_ids=[u.id for u in users],
        credits_amount=credits_amount,
        expires_in_days=14,
        campaign_name=f"回歸禮_{datetime.utcnow().strftime('%Y%m%d')}",
        send_notification=True,
        notification_title="🎉 好久不見！送你回歸禮",
        notification_message=f"我們很想念你！特別送上 {credits_amount} 點，快回來體驗最新的 AI 功能吧！"
    )
    
    return await bulk_grant_credits(request, db, current_user)


@router.post("/quick/new-user-bonus")
async def new_user_bonus_campaign(
    days: int = Query(7, ge=1, le=30),
    credits_amount: int = Query(100, ge=10, le=500),
    dry_run: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    新手加碼活動 - 對新註冊用戶發放額外點數
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    since_date = datetime.utcnow() - timedelta(days=days)
    
    users = db.query(User).filter(
        User.is_active == True,
        User.created_at >= since_date
    ).all()
    
    if dry_run:
        return {
            "success": True,
            "dry_run": True,
            "campaign": "new_user_bonus",
            "target_count": len(users),
            "credits_per_user": credits_amount,
            "total_credits": credits_amount * len(users),
            "preview_users": [
                {"id": u.id, "email": u.email[:3] + "***", "created_at": u.created_at.isoformat()} 
                for u in users[:10]
            ]
        }
    
    request = BulkCreditsRequest(
        user_ids=[u.id for u in users],
        credits_amount=credits_amount,
        expires_in_days=30,
        campaign_name=f"新手加碼_{datetime.utcnow().strftime('%Y%m%d')}",
        send_notification=True,
        notification_title="🎁 新手專屬加碼！",
        notification_message=f"感謝您加入 King Jam AI！額外贈送 {credits_amount} 點讓您盡情體驗！"
    )
    
    return await bulk_grant_credits(request, db, current_user)


@router.post("/quick/vip-reward")
async def vip_reward_campaign(
    min_paid_credits: int = Query(1000, ge=100),
    credits_amount: int = Query(200, ge=50, le=1000),
    dry_run: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    VIP 回饋活動 - 對付費用戶發放感謝點數
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    users = db.query(User).filter(
        User.is_active == True,
        User.credits_paid >= min_paid_credits
    ).all()
    
    if dry_run:
        return {
            "success": True,
            "dry_run": True,
            "campaign": "vip_reward",
            "target_count": len(users),
            "credits_per_user": credits_amount,
            "total_credits": credits_amount * len(users),
            "preview_users": [
                {"id": u.id, "email": u.email[:3] + "***", "credits_paid": u.credits_paid} 
                for u in users[:10]
            ]
        }
    
    request = BulkCreditsRequest(
        user_ids=[u.id for u in users],
        credits_amount=credits_amount,
        expires_in_days=60,
        campaign_name=f"VIP回饋_{datetime.utcnow().strftime('%Y%m%d')}",
        send_notification=True,
        notification_title="💎 VIP 專屬感謝禮",
        notification_message=f"感謝您的支持！特別贈送 {credits_amount} 點作為回饋，祝創作愉快！"
    )
    
    return await bulk_grant_credits(request, db, current_user)


# ============================================================
# 活動歷史記錄
# ============================================================

@router.get("/history")
async def get_campaign_history(
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取得行銷活動發放歷史"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    # 從交易記錄中統計行銷活動
    campaigns = db.query(
        CreditTransaction.description,
        func.count(CreditTransaction.id).label("count"),
        func.sum(CreditTransaction.amount).label("total_credits"),
        func.min(CreditTransaction.created_at).label("first_at"),
        func.max(CreditTransaction.created_at).label("last_at"),
    ).filter(
        CreditTransaction.transaction_type == "promo",
        CreditTransaction.amount > 0
    ).group_by(
        CreditTransaction.description
    ).order_by(
        desc(func.max(CreditTransaction.created_at))
    ).offset(offset).limit(limit).all()
    
    return {
        "success": True,
        "campaigns": [
            {
                "name": c.description or "未命名活動",
                "recipient_count": c.count,
                "total_credits": int(c.total_credits) if c.total_credits else 0,
                "first_at": c.first_at.isoformat() if c.first_at else None,
                "last_at": c.last_at.isoformat() if c.last_at else None,
            }
            for c in campaigns
        ]
    }
