"""
用戶管理 API
核心營運需求 - 用戶列表、搜索、詳情、點數調整、狀態管理
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_, desc, asc, case
from datetime import datetime, timedelta
from decimal import Decimal

from app.database import get_db
from app.models import (
    User, Order, CreditTransaction, GenerationHistory, 
    WithdrawalRequest, RefundRequest, SocialAccount, ScheduledPost
)
from app.routers.auth import get_current_user
from app.services.credit_service import CategoryBalance
from app.core.admin_security import (
    is_super_admin, require_super_admin, 
    require_secondary_password, SUPER_ADMIN_EMAIL
)

router = APIRouter(prefix="/admin/users", tags=["用戶管理"])


# ============================================================
# Schemas
# ============================================================

class UserListItem(BaseModel):
    id: int
    customer_id: Optional[str] = None
    email: str
    full_name: Optional[str] = None
    avatar: Optional[str] = None
    provider: str = "local"
    is_active: bool = True
    is_admin: bool = False
    tier: Optional[str] = "free"
    credits: int = 0
    credits_paid: int = 0
    credits_bonus: int = 0
    credits_promo: int = 0
    credits_sub: int = 0
    partner_tier: Optional[str] = "bronze"
    total_referrals: int = 0
    total_referral_revenue: float = 0
    subscription_plan: Optional[str] = "free"
    subscription_expires_at: Optional[datetime] = None
    referral_code: Optional[str] = None
    referred_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    # 計算欄位
    total_orders: int = 0
    total_spent: float = 0
    total_generations: int = 0
    last_active_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    success: bool
    total: int
    page: int
    page_size: int
    total_pages: int
    users: List[UserListItem]


class UserDetailResponse(BaseModel):
    success: bool
    user: UserListItem
    credit_balance: Dict[str, Any]
    recent_orders: List[Dict[str, Any]]
    recent_transactions: List[Dict[str, Any]]
    recent_generations: List[Dict[str, Any]]
    referral_info: Dict[str, Any]
    social_accounts: List[Dict[str, Any]]
    stats: Dict[str, Any]


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None
    tier: Optional[str] = None
    partner_tier: Optional[str] = None
    subscription_plan: Optional[str] = None


class CreditAdjustmentRequest(BaseModel):
    category: str = Field(..., description="點數類別: paid, bonus, promo, sub")
    amount: int = Field(..., description="調整金額（正數增加，負數扣除）")
    reason: str = Field(..., description="調整原因")
    secondary_password: str = Field(..., description="二次驗證密碼")


class UserStatsResponse(BaseModel):
    success: bool
    total_users: int
    active_users: int
    inactive_users: int
    admin_users: int
    paying_users: int
    subscribers: int
    
    # 按時間統計
    new_users_today: int
    new_users_week: int
    new_users_month: int
    
    # 按訂閱統計
    subscription_breakdown: Dict[str, int]
    
    # 按夥伴等級統計
    partner_tier_breakdown: Dict[str, int]
    
    # 收入統計
    total_revenue: float
    revenue_today: float
    revenue_week: float
    revenue_month: float


# ============================================================
# 權限檢查
# ============================================================

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """要求管理員權限"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理員權限"
        )
    return current_user


# ============================================================
# 用戶列表 API
# ============================================================

@router.get("", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1, description="頁碼"),
    page_size: int = Query(20, ge=1, le=100, description="每頁數量"),
    search: Optional[str] = Query(None, description="搜索關鍵字（Email/姓名/客戶編號）"),
    is_active: Optional[bool] = Query(None, description="篩選：是否啟用"),
    is_admin: Optional[bool] = Query(None, description="篩選：是否管理員"),
    tier: Optional[str] = Query(None, description="篩選：會員等級"),
    partner_tier: Optional[str] = Query(None, description="篩選：夥伴等級"),
    subscription_plan: Optional[str] = Query(None, description="篩選：訂閱方案"),
    has_credits: Optional[bool] = Query(None, description="篩選：是否有點數"),
    has_orders: Optional[bool] = Query(None, description="篩選：是否有訂單"),
    sort_by: str = Query("created_at", description="排序欄位"),
    sort_order: str = Query("desc", description="排序方向: asc/desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    獲取用戶列表
    
    支援：
    - 分頁
    - 關鍵字搜索
    - 多維度篩選
    - 排序
    """
    # 基礎查詢
    query = db.query(User)
    
    # 搜索
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                User.email.ilike(search_term),
                User.full_name.ilike(search_term),
                User.customer_id.ilike(search_term),
                User.referral_code.ilike(search_term)
            )
        )
    
    # 篩選
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    
    if is_admin is not None:
        query = query.filter(User.is_admin == is_admin)
    
    if tier:
        query = query.filter(User.tier == tier)
    
    if partner_tier:
        query = query.filter(User.partner_tier == partner_tier)
    
    if subscription_plan:
        query = query.filter(User.subscription_plan == subscription_plan)
    
    if has_credits is not None:
        if has_credits:
            query = query.filter(User.credits > 0)
        else:
            query = query.filter(User.credits <= 0)
    
    # 總數
    total = query.count()
    
    # 排序
    sort_column = getattr(User, sort_by, User.created_at)
    if sort_order == "desc":
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(asc(sort_column))
    
    # 分頁
    offset = (page - 1) * page_size
    users = query.offset(offset).limit(page_size).all()
    
    # 獲取每個用戶的額外統計
    user_list = []
    for user in users:
        # 訂單統計
        order_stats = db.query(
            func.count(Order.id).label("count"),
            func.coalesce(func.sum(Order.total_amount), 0).label("total")
        ).filter(
            Order.user_id == user.id,
            Order.status == "completed"
        ).first()
        
        # 生成統計
        gen_count = db.query(func.count(GenerationHistory.id)).filter(
            GenerationHistory.user_id == user.id,
            GenerationHistory.is_deleted == False
        ).scalar() or 0
        
        # 最後活躍時間（最近一筆生成或交易）
        last_gen = db.query(GenerationHistory.created_at).filter(
            GenerationHistory.user_id == user.id
        ).order_by(desc(GenerationHistory.created_at)).first()
        
        last_tx = db.query(CreditTransaction.created_at).filter(
            CreditTransaction.user_id == user.id
        ).order_by(desc(CreditTransaction.created_at)).first()
        
        last_active = None
        if last_gen and last_tx:
            last_active = max(last_gen[0], last_tx[0])
        elif last_gen:
            last_active = last_gen[0]
        elif last_tx:
            last_active = last_tx[0]
        
        user_item = UserListItem(
            id=user.id,
            customer_id=user.customer_id,
            email=user.email,
            full_name=user.full_name,
            avatar=user.avatar,
            provider=user.provider,
            is_active=user.is_active,
            is_admin=user.is_admin,
            tier=user.tier,
            credits=user.credits,
            credits_paid=user.credits_paid,
            credits_bonus=user.credits_bonus,
            credits_promo=user.credits_promo,
            credits_sub=user.credits_sub,
            partner_tier=user.partner_tier,
            total_referrals=user.total_referrals,
            total_referral_revenue=float(user.total_referral_revenue or 0),
            subscription_plan=user.subscription_plan,
            subscription_expires_at=user.subscription_expires_at,
            referral_code=user.referral_code,
            referred_by=user.referred_by,
            created_at=user.created_at,
            updated_at=user.updated_at,
            total_orders=order_stats.count if order_stats else 0,
            total_spent=float(order_stats.total) if order_stats else 0,
            total_generations=gen_count,
            last_active_at=last_active
        )
        user_list.append(user_item)
    
    total_pages = (total + page_size - 1) // page_size
    
    return UserListResponse(
        success=True,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        users=user_list
    )


# ============================================================
# 用戶統計 API（必須在 /{user_id} 之前定義）
# ============================================================

@router.get("/stats/overview")
async def get_user_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    獲取用戶統計總覽
    
    包含：
    - 用戶總數/活躍/停用
    - 新用戶數（今日/本週/本月）
    - 訂閱分佈
    - 夥伴等級分佈
    - 收入統計
    """
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=now.weekday())
    month_start = today_start.replace(day=1)
    
    # 基本統計
    total_users = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar() or 0
    inactive_users = db.query(func.count(User.id)).filter(User.is_active == False).scalar() or 0
    admin_users = db.query(func.count(User.id)).filter(User.is_admin == True).scalar() or 0
    
    # 付費用戶（有完成訂單的用戶）
    paying_users = db.query(func.count(func.distinct(Order.user_id))).filter(
        Order.status == "completed"
    ).scalar() or 0
    
    # 訂閱用戶
    subscribers = db.query(func.count(User.id)).filter(
        User.subscription_plan != "free"
    ).scalar() or 0
    
    # 新用戶統計
    new_users_today = db.query(func.count(User.id)).filter(
        User.created_at >= today_start
    ).scalar() or 0
    
    new_users_week = db.query(func.count(User.id)).filter(
        User.created_at >= week_start
    ).scalar() or 0
    
    new_users_month = db.query(func.count(User.id)).filter(
        User.created_at >= month_start
    ).scalar() or 0
    
    # 訂閱方案分佈
    subscription_breakdown = dict(
        db.query(
            User.subscription_plan,
            func.count(User.id)
        ).group_by(User.subscription_plan).all()
    )
    
    # 夥伴等級分佈
    partner_tier_breakdown = dict(
        db.query(
            User.partner_tier,
            func.count(User.id)
        ).group_by(User.partner_tier).all()
    )
    
    # 收入統計
    total_revenue = db.query(
        func.coalesce(func.sum(Order.total_amount), 0)
    ).filter(
        Order.status == "completed"
    ).scalar() or 0
    
    revenue_today = db.query(
        func.coalesce(func.sum(Order.total_amount), 0)
    ).filter(
        Order.status == "completed",
        Order.paid_at >= today_start
    ).scalar() or 0
    
    revenue_week = db.query(
        func.coalesce(func.sum(Order.total_amount), 0)
    ).filter(
        Order.status == "completed",
        Order.paid_at >= week_start
    ).scalar() or 0
    
    revenue_month = db.query(
        func.coalesce(func.sum(Order.total_amount), 0)
    ).filter(
        Order.status == "completed",
        Order.paid_at >= month_start
    ).scalar() or 0
    
    return {
        "success": True,
        "total_users": total_users,
        "active_users": active_users,
        "inactive_users": inactive_users,
        "admin_users": admin_users,
        "paying_users": paying_users,
        "subscribers": subscribers,
        "new_users_today": new_users_today,
        "new_users_week": new_users_week,
        "new_users_month": new_users_month,
        "subscription_breakdown": subscription_breakdown,
        "partner_tier_breakdown": partner_tier_breakdown,
        "total_revenue": float(total_revenue),
        "revenue_today": float(revenue_today),
        "revenue_week": float(revenue_week),
        "revenue_month": float(revenue_month),
    }


# ============================================================
# 匯出用戶資料 API（必須在 /{user_id} 之前定義）
# ============================================================

class ExportRequest(BaseModel):
    format: str = "json"
    secondary_password: str = Field(..., description="二次驗證密碼")


@router.post("/export")
async def export_users(
    request: ExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    匯出用戶資料（僅限超級管理員 + 二次密碼驗證）
    
    目前僅支援 JSON 格式
    """
    # 檢查超級管理員權限
    require_super_admin(current_user)
    
    # 驗證二次密碼
    require_secondary_password(request.secondary_password)
    
    users = db.query(User).order_by(User.created_at).all()
    
    export_data = []
    for user in users:
        export_data.append({
            "id": user.id,
            "customer_id": user.customer_id,
            "email": user.email,
            "full_name": user.full_name,
            "provider": user.provider,
            "is_active": user.is_active,
            "is_admin": user.is_admin,
            "tier": user.tier,
            "credits": user.credits,
            "credits_paid": user.credits_paid,
            "credits_bonus": user.credits_bonus,
            "credits_promo": user.credits_promo,
            "credits_sub": user.credits_sub,
            "partner_tier": user.partner_tier,
            "total_referrals": user.total_referrals,
            "total_referral_revenue": float(user.total_referral_revenue or 0),
            "subscription_plan": user.subscription_plan,
            "referral_code": user.referral_code,
            "referred_by": user.referred_by,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        })
    
    return {
        "success": True,
        "format": request.format,
        "total": len(export_data),
        "exported_at": datetime.utcnow().isoformat(),
        "data": export_data,
    }


# ============================================================
# 批量操作 API（必須在 /{user_id} 之前定義）
# ============================================================

class BulkActionRequest(BaseModel):
    user_ids: List[int]
    action: str  # activate, deactivate, grant_promo
    promo_credits: Optional[int] = None  # 如果 action 是 grant_promo
    promo_reason: Optional[str] = None
    secondary_password: Optional[str] = None  # 敏感操作需要二次密碼


@router.post("/bulk-action")
async def bulk_user_action(
    request: BulkActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    批量用戶操作
    
    支援：
    - activate: 批量啟用
    - deactivate: 批量停用
    - grant_promo: 批量贈送優惠點數（僅限超級管理員 + 二次密碼）
    """
    # 批量贈送點數需要超級管理員權限和二次密碼
    if request.action == "grant_promo":
        require_super_admin(current_user)
        require_secondary_password(request.secondary_password)
    
    if not request.user_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="請選擇至少一位用戶"
        )
    
    users = db.query(User).filter(User.id.in_(request.user_ids)).all()
    
    if not users:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到指定的用戶"
        )
    
    results = []
    
    if request.action == "activate":
        for user in users:
            if user.id != current_user.id:  # 跳過自己
                user.is_active = True
                results.append({"id": user.id, "email": user.email, "action": "activated"})
        db.commit()
        
    elif request.action == "deactivate":
        for user in users:
            if user.id != current_user.id:  # 跳過自己
                user.is_active = False
                results.append({"id": user.id, "email": user.email, "action": "deactivated"})
        db.commit()
        
    elif request.action == "grant_promo":
        if not request.promo_credits or request.promo_credits <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="請指定有效的優惠點數數量"
            )
        
        for user in users:
            balance_before = user.credits_promo
            user.credits_promo += request.promo_credits
            user.credits += request.promo_credits
            
            # 記錄交易
            transaction = CreditTransaction(
                user_id=user.id,
                credit_category="promo",
                transaction_type="promo_credit",
                amount=request.promo_credits,
                balance_before=balance_before,
                balance_after=user.credits_promo,
                description=f"管理員批量贈送: {request.promo_reason or '行銷活動'}",
                extra_data={
                    "granted_by": current_user.id,
                    "granted_by_email": current_user.email,
                    "reason": request.promo_reason or "行銷活動",
                    "bulk_action": True,
                }
            )
            db.add(transaction)
            results.append({
                "id": user.id, 
                "email": user.email, 
                "action": "granted_promo",
                "credits": request.promo_credits
            })
        db.commit()
        
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="無效的操作類型"
        )
    
    return {
        "success": True,
        "message": f"已完成批量操作: {request.action}",
        "affected_count": len(results),
        "results": results,
    }


# ============================================================
# 用戶詳情 API
# ============================================================

@router.get("/{user_id}")
async def get_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    獲取用戶詳細資訊
    
    包含：
    - 基本資料
    - 點數餘額詳情
    - 最近訂單
    - 最近交易記錄
    - 最近生成記錄
    - 推薦資訊
    - 社群帳號
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用戶不存在"
        )
    
    # 訂單統計
    order_stats = db.query(
        func.count(Order.id).label("count"),
        func.coalesce(func.sum(Order.total_amount), 0).label("total")
    ).filter(
        Order.user_id == user.id,
        Order.status == "completed"
    ).first()
    
    # 生成統計
    gen_count = db.query(func.count(GenerationHistory.id)).filter(
        GenerationHistory.user_id == user.id,
        GenerationHistory.is_deleted == False
    ).scalar() or 0
    
    # 點數餘額詳情
    credit_balance = {
        "total": user.credits,
        "paid": user.credits_paid,
        "bonus": user.credits_bonus,
        "promo": user.credits_promo,
        "sub": user.credits_sub,
        "withdrawable_twd": float(user.credits_bonus),  # 1 BONUS = 1 TWD
    }
    
    # 最近訂單（10 筆）
    recent_orders = db.query(Order).filter(
        Order.user_id == user.id
    ).order_by(desc(Order.created_at)).limit(10).all()
    
    orders_data = [
        {
            "id": o.id,
            "order_no": o.order_no,
            "order_type": o.order_type,
            "item_name": o.item_name,
            "total_amount": float(o.total_amount),
            "status": o.status,
            "payment_provider": o.payment_provider,
            "credits_amount": o.credits_amount,
            "bonus_credits": o.bonus_credits,
            "created_at": o.created_at.isoformat() if o.created_at else None,
            "paid_at": o.paid_at.isoformat() if o.paid_at else None,
        }
        for o in recent_orders
    ]
    
    # 最近交易記錄（20 筆）
    recent_transactions = db.query(CreditTransaction).filter(
        CreditTransaction.user_id == user.id
    ).order_by(desc(CreditTransaction.created_at)).limit(20).all()
    
    transactions_data = [
        {
            "id": t.id,
            "transaction_type": t.transaction_type,
            "credit_category": t.credit_category,
            "amount": t.amount,
            "balance_before": t.balance_before,
            "balance_after": t.balance_after,
            "description": t.description,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in recent_transactions
    ]
    
    # 最近生成記錄（10 筆）
    recent_generations = db.query(GenerationHistory).filter(
        GenerationHistory.user_id == user.id,
        GenerationHistory.is_deleted == False
    ).order_by(desc(GenerationHistory.created_at)).limit(10).all()
    
    generations_data = [
        {
            "id": g.id,
            "generation_type": g.generation_type,
            "status": g.status,
            "credits_used": g.credits_used,
            "thumbnail_url": g.thumbnail_url,
            "created_at": g.created_at.isoformat() if g.created_at else None,
        }
        for g in recent_generations
    ]
    
    # 推薦資訊
    referred_users = db.query(User).filter(
        User.referred_by == user.referral_code
    ).all()
    
    referral_info = {
        "referral_code": user.referral_code,
        "referred_by": user.referred_by,
        "total_referrals": user.total_referrals,
        "total_revenue": float(user.total_referral_revenue or 0),
        "partner_tier": user.partner_tier,
        "referred_users": [
            {
                "id": r.id,
                "email": r.email[:3] + "***" + r.email[r.email.index("@"):] if "@" in r.email else r.email[:3] + "***",
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "subscription_plan": r.subscription_plan,
            }
            for r in referred_users[:20]  # 最多顯示 20 位
        ]
    }
    
    # 社群帳號
    social_accounts = db.query(SocialAccount).filter(
        SocialAccount.user_id == user.id
    ).all()
    
    social_data = [
        {
            "id": s.id,
            "platform": s.platform,
            "platform_username": s.platform_username,
            "is_active": s.is_active,
            "last_sync_at": s.last_sync_at.isoformat() if s.last_sync_at else None,
        }
        for s in social_accounts
    ]
    
    # 統計數據
    stats = {
        "total_orders": order_stats.count if order_stats else 0,
        "total_spent": float(order_stats.total) if order_stats else 0,
        "total_generations": gen_count,
        "total_credits_consumed": db.query(
            func.coalesce(func.sum(case(
                (CreditTransaction.amount < 0, -CreditTransaction.amount),
                else_=0
            )), 0)
        ).filter(CreditTransaction.user_id == user.id).scalar() or 0,
        "account_age_days": (datetime.utcnow() - user.created_at).days if user.created_at else 0,
    }
    
    # 提領/退款記錄統計
    withdrawal_count = db.query(func.count(WithdrawalRequest.id)).filter(
        WithdrawalRequest.user_id == user.id
    ).scalar() or 0
    
    refund_count = db.query(func.count(RefundRequest.id)).filter(
        RefundRequest.user_id == user.id
    ).scalar() or 0
    
    stats["withdrawal_requests"] = withdrawal_count
    stats["refund_requests"] = refund_count
    
    # 構建用戶基本資料
    user_data = UserListItem(
        id=user.id,
        customer_id=user.customer_id,
        email=user.email,
        full_name=user.full_name,
        avatar=user.avatar,
        provider=user.provider,
        is_active=user.is_active,
        is_admin=user.is_admin,
        tier=user.tier,
        credits=user.credits,
        credits_paid=user.credits_paid,
        credits_bonus=user.credits_bonus,
        credits_promo=user.credits_promo,
        credits_sub=user.credits_sub,
        partner_tier=user.partner_tier,
        total_referrals=user.total_referrals,
        total_referral_revenue=float(user.total_referral_revenue or 0),
        subscription_plan=user.subscription_plan,
        subscription_expires_at=user.subscription_expires_at,
        referral_code=user.referral_code,
        referred_by=user.referred_by,
        created_at=user.created_at,
        updated_at=user.updated_at,
        total_orders=stats["total_orders"],
        total_spent=stats["total_spent"],
        total_generations=gen_count,
    )
    
    return {
        "success": True,
        "user": user_data,
        "credit_balance": credit_balance,
        "recent_orders": orders_data,
        "recent_transactions": transactions_data,
        "recent_generations": generations_data,
        "referral_info": referral_info,
        "social_accounts": social_data,
        "stats": stats,
    }


# ============================================================
# 用戶編輯 API
# ============================================================

@router.put("/{user_id}")
async def update_user(
    user_id: int,
    request: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    更新用戶資料
    
    可更新欄位：
    - full_name: 姓名
    - is_active: 啟用狀態
    - is_admin: 管理員權限
    - tier: 會員等級
    - partner_tier: 夥伴等級
    - subscription_plan: 訂閱方案
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用戶不存在"
        )
    
    # 防止自己取消自己的管理員權限
    if user.id == current_user.id and request.is_admin is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="無法取消自己的管理員權限"
        )
    
    # 更新欄位
    update_fields = {}
    
    if request.full_name is not None:
        user.full_name = request.full_name
        update_fields["full_name"] = request.full_name
    
    if request.is_active is not None:
        user.is_active = request.is_active
        update_fields["is_active"] = request.is_active
    
    if request.is_admin is not None:
        user.is_admin = request.is_admin
        update_fields["is_admin"] = request.is_admin
    
    if request.tier is not None:
        if request.tier not in ["free", "basic", "pro", "enterprise"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無效的會員等級"
            )
        user.tier = request.tier
        update_fields["tier"] = request.tier
    
    if request.partner_tier is not None:
        if request.partner_tier not in ["bronze", "silver", "gold"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無效的夥伴等級"
            )
        user.partner_tier = request.partner_tier
        update_fields["partner_tier"] = request.partner_tier
    
    if request.subscription_plan is not None:
        if request.subscription_plan not in ["free", "basic", "pro", "enterprise"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="無效的訂閱方案"
            )
        user.subscription_plan = request.subscription_plan
        update_fields["subscription_plan"] = request.subscription_plan
    
    db.commit()
    
    return {
        "success": True,
        "message": "用戶資料已更新",
        "updated_fields": update_fields,
    }


# ============================================================
# 點數調整 API
# ============================================================

@router.post("/{user_id}/credits")
async def adjust_user_credits(
    user_id: int,
    request: CreditAdjustmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    調整用戶點數（僅限超級管理員 + 二次密碼驗證）
    
    參數：
    - category: 點數類別 (paid, bonus, promo, sub)
    - amount: 調整金額（正數增加，負數扣除）
    - reason: 調整原因
    - secondary_password: 二次驗證密碼
    """
    # 檢查超級管理員權限
    require_super_admin(current_user)
    
    # 驗證二次密碼
    require_secondary_password(request.secondary_password)
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用戶不存在"
        )
    
    # 驗證類別
    if request.category not in ["paid", "bonus", "promo", "sub"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="無效的點數類別，必須是: paid, bonus, promo, sub"
        )
    
    # 獲取對應的點數欄位
    category_field = {
        "paid": "credits_paid",
        "bonus": "credits_bonus",
        "promo": "credits_promo",
        "sub": "credits_sub"
    }[request.category]
    
    # 獲取當前餘額
    current_balance = getattr(user, category_field)
    new_balance = current_balance + request.amount
    
    # 檢查是否會變成負數
    if new_balance < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"調整後餘額不能為負數，當前 {request.category.upper()} 餘額: {current_balance}"
        )
    
    # 更新點數
    setattr(user, category_field, new_balance)
    
    # 更新總點數
    user.credits = user.credits_paid + user.credits_bonus + user.credits_promo + user.credits_sub
    
    # 記錄交易
    transaction = CreditTransaction(
        user_id=user.id,
        credit_category=request.category,
        transaction_type="admin_adjustment",
        amount=request.amount,
        balance_before=current_balance,
        balance_after=new_balance,
        description=f"管理員調整: {request.reason}",
        extra_data={
            "adjusted_by": current_user.id,
            "adjusted_by_email": current_user.email,
            "reason": request.reason,
        }
    )
    db.add(transaction)
    db.commit()
    
    return {
        "success": True,
        "message": f"已調整用戶 {request.category.upper()} 點數",
        "adjustment": {
            "category": request.category,
            "amount": request.amount,
            "balance_before": current_balance,
            "balance_after": new_balance,
        },
        "new_total_credits": user.credits,
    }


# ============================================================
# 用戶狀態管理
# ============================================================

@router.post("/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    切換用戶啟用狀態
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用戶不存在"
        )
    
    # 防止停用自己
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="無法停用自己的帳號"
        )
    
    user.is_active = not user.is_active
    db.commit()
    
    return {
        "success": True,
        "message": f"用戶已{'啟用' if user.is_active else '停用'}",
        "is_active": user.is_active,
    }


class ToggleAdminRequest(BaseModel):
    secondary_password: str = Field(..., description="二次驗證密碼")


@router.post("/{user_id}/toggle-admin")
async def toggle_user_admin(
    user_id: int,
    request: ToggleAdminRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    切換用戶管理員權限（僅限超級管理員 + 二次密碼驗證）
    """
    # 檢查超級管理員權限
    require_super_admin(current_user)
    
    # 驗證二次密碼
    require_secondary_password(request.secondary_password)
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用戶不存在"
        )
    
    # 防止變更超級管理員的權限
    if user.email == SUPER_ADMIN_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="無法變更超級管理員的權限"
        )
    
    # 防止取消自己的管理員權限
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="無法變更自己的管理員權限"
        )
    
    user.is_admin = not user.is_admin
    db.commit()
    
    return {
        "success": True,
        "message": f"用戶{'已設為管理員' if user.is_admin else '已取消管理員權限'}",
        "is_admin": user.is_admin,
    }
