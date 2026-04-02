from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import User, GenerationHistory, ScheduledPost, SocialAccount
from app.routers.auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary")
def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """合併多個 API 為單一響應，提升前端效能"""
    
    # 用戶資料
    user_data = {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "avatar": current_user.avatar,
        "tier": current_user.tier,
        "is_active": current_user.is_active,
    }
    
    # 點數餘額
    credit_balance = {
        "balance": current_user.credits,
        "tier": current_user.subscription_plan or "free",
        "is_super_admin": current_user.is_admin,
    }
    
    # 推薦統計
    referral_stats = {
        "email": current_user.email,
        "full_name": current_user.full_name,
        "avatar": current_user.avatar,
        "partner_tier": current_user.partner_tier or "bronze",
        "total_referrals": current_user.total_referrals,
        "total_referral_revenue": float(current_user.total_referral_revenue or 0),
    }
    
    # 使用統計 (最近 30 天)
    from app.services.credit_service import CreditService
    credit_service = CreditService(db)
    usage_stats = credit_service.get_usage_stats(current_user.id, days=30)
    
    # 最近生成記錄
    recent_history = db.query(GenerationHistory).filter(
        GenerationHistory.user_id == current_user.id
    ).order_by(GenerationHistory.created_at.desc()).limit(5).all()
    
    history_items = []
    for h in recent_history:
        history_items.append({
            "id": h.id,
            "generation_type": h.generation_type,
            "status": h.status,
            "credits_used": h.credits_used,
            "created_at": h.created_at.isoformat() if h.created_at else None,
            "input_params": h.input_params or {},
            "output_data": h.output_data or {},
            "thumbnail_url": h.thumbnail_url,
        })
    
    # 待發布排程 (使用 joinedload 避免 N+1 查詢)
    upcoming_posts = db.query(ScheduledPost).options(
        joinedload(ScheduledPost.social_account)
    ).filter(
        ScheduledPost.user_id == current_user.id,
        ScheduledPost.status == "pending"
    ).order_by(ScheduledPost.scheduled_at.asc()).limit(5).all()
    
    post_items = []
    for p in upcoming_posts:
        post_items.append({
            "id": p.id,
            "content_type": p.content_type,
            "title": p.title,
            "caption": p.caption,
            "scheduled_at": p.scheduled_at.isoformat() if p.scheduled_at else None,
            "status": p.status,
            "platform": p.social_account.platform if p.social_account else None,
        })
    
    # 已連結帳號
    social_accounts = db.query(SocialAccount).filter(
        SocialAccount.user_id == current_user.id,
        SocialAccount.is_active == True
    ).all()
    
    account_items = []
    for a in social_accounts:
        account_items.append({
            "id": a.id,
            "platform": a.platform,
            "platform_username": a.platform_username,
            "is_active": a.is_active,
        })
    
    # 即將到期點數
    from app.services.credit_service import CreditService
    expiring = credit_service.get_expiring_credits(current_user.id)
    
    return {
        "user": user_data,
        "credits": credit_balance,
        "referral": referral_stats,
        "usage": usage_stats,
        "history": history_items,
        "upcoming_posts": post_items,
        "social_accounts": account_items,
        "expiring_credits": expiring,
    }