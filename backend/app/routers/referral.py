"""
推薦系統 API 端點

提供推薦碼生成、獎金發放、夥伴統計等功能
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

from app.database import get_db
from app.models import User
from app.routers.auth import get_current_user
from app.services.referral_service import (
    ReferralService,
    get_referral_service,
    PARTNER_TIERS,
    REFERRAL_BONUS_TABLE,
    REFERRAL_BONUS_TABLE_YEARLY,
    SUBSCRIPTION_PRICES,
    SUBSCRIPTION_PRICES_YEARLY,
)

router = APIRouter(prefix="/referral", tags=["推薦系統"])


# ============================================================
# Pydantic 模型
# ============================================================

class ReferralCodeResponse(BaseModel):
    """推薦碼回應"""
    referral_code: str
    share_url: str
    
class PartnerStatsResponse(BaseModel):
    """夥伴統計回應"""
    user_id: int
    email: Optional[str] = None
    full_name: Optional[str] = None
    avatar: Optional[str] = None
    referral_code: Optional[str]
    partner_tier: str
    tier_name: str
    commission_rate: float
    total_referrals: int
    total_referral_revenue: float
    next_tier: Optional[str]
    next_tier_name: Optional[str]
    progress: Dict[str, Any]
    bonus_credits: int
    withdrawable_twd: float

class ReferralHistoryItem(BaseModel):
    """推薦歷史項目"""
    user_id: int
    email: str
    subscription_plan: str
    registered_at: Optional[str]

class RegisterWithReferralRequest(BaseModel):
    """使用推薦碼註冊請求"""
    referral_code: Optional[str] = None

class SubscriptionPaymentRequest(BaseModel):
    """訂閱付費請求"""
    subscription_plan: str

class ReferralResultResponse(BaseModel):
    """推薦操作結果"""
    success: bool
    message: str
    bonus_credits: int = 0
    bonus_twd: float = 0
    error: Optional[str] = None

class PartnerTierInfo(BaseModel):
    """夥伴等級資訊"""
    tier_code: str
    tier_name: str
    commission_rate: float
    min_referrals: int
    min_revenue: float
    referral_bonus_promo: int
    monthly_bonus: Optional[int] = None

class ReferralBonusTableResponse(BaseModel):
    """推薦獎金表回應"""
    partner_tiers: List[PartnerTierInfo]
    bonus_table: Dict[str, Dict[str, int]]
    subscription_prices: Dict[str, float]
    bonus_table_yearly: Dict[str, Dict[str, int]] = {}
    subscription_prices_yearly: Dict[str, float] = {}


# ============================================================
# API 端點
# ============================================================

@router.get("/my-code", response_model=ReferralCodeResponse)
def get_my_referral_code(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    取得我的推薦碼
    
    如果沒有推薦碼，會自動生成一個
    """
    service = get_referral_service(db)
    code = service.generate_referral_code(current_user.id)
    
    if not code:
        raise HTTPException(status_code=500, detail="無法生成推薦碼")
    
    return ReferralCodeResponse(
        referral_code=code,
        share_url=f"https://kingjam.ai/register?ref={code}"
    )


@router.get("/stats", response_model=PartnerStatsResponse)
def get_partner_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取得我的夥伴統計"""
    service = get_referral_service(db)
    stats = service.get_partner_stats(current_user.id)
    
    if not stats:
        raise HTTPException(status_code=404, detail="找不到用戶")
    
    return PartnerStatsResponse(**stats)


@router.get("/history", response_model=List[ReferralHistoryItem])
def get_referral_history(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取得我的推薦歷史"""
    service = get_referral_service(db)
    history = service.get_referral_history(current_user.id, limit, offset)
    
    return [ReferralHistoryItem(**item) for item in history]


@router.get("/bonus-table", response_model=ReferralBonusTableResponse)
def get_bonus_table():
    """取得推薦獎金表"""
    tiers = []
    for code, config in PARTNER_TIERS.items():
        tiers.append(PartnerTierInfo(
            tier_code=code,
            tier_name=config["name"],
            commission_rate=float(config["commission_rate"]),
            min_referrals=config["min_referrals"],
            min_revenue=float(config["min_revenue"]),
            referral_bonus_promo=config["referral_bonus_promo"],
            monthly_bonus=config.get("monthly_bonus"),
        ))
    
    return ReferralBonusTableResponse(
        partner_tiers=tiers,
        bonus_table=REFERRAL_BONUS_TABLE,
        subscription_prices={k: float(v) for k, v in SUBSCRIPTION_PRICES.items()},
        bonus_table_yearly=REFERRAL_BONUS_TABLE_YEARLY,
        subscription_prices_yearly={k: float(v) for k, v in SUBSCRIPTION_PRICES_YEARLY.items()},
    )


@router.post("/process-registration", response_model=ReferralResultResponse)
def process_referral_registration(
    request: RegisterWithReferralRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    處理使用推薦碼的註冊
    
    - 發放新用戶註冊獎勵
    - 如果有有效推薦碼，發放推薦獎勵給推薦者
    """
    service = get_referral_service(db)
    result = service.process_referral_registration(
        new_user_id=current_user.id,
        referral_code=request.referral_code
    )
    
    return ReferralResultResponse(
        success=result.success,
        message=result.message,
        bonus_credits=result.bonus_credits,
        bonus_twd=result.bonus_twd,
        error=result.error
    )


@router.post("/process-subscription", response_model=ReferralResultResponse)
def process_subscription_payment(
    request: SubscriptionPaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    處理訂閱付費
    
    - 更新用戶訂閱方案
    - 發放訂閱月費點數
    - 如果有推薦者，發放推薦獎金
    """
    if request.subscription_plan not in SUBSCRIPTION_PRICES:
        raise HTTPException(
            status_code=400, 
            detail=f"無效的訂閱方案：{request.subscription_plan}"
        )
    
    service = get_referral_service(db)
    result = service.process_subscription_payment(
        user_id=current_user.id,
        subscription_plan=request.subscription_plan
    )
    
    return ReferralResultResponse(
        success=result.success,
        message=result.message,
        bonus_credits=result.bonus_credits,
        bonus_twd=result.bonus_twd,
        error=result.error
    )


@router.get("/validate/{code}")
def validate_referral_code(
    code: str,
    db: Session = Depends(get_db)
):
    """
    驗證推薦碼是否有效
    """
    service = get_referral_service(db)
    referrer = service.get_referrer_by_code(code)
    
    if not referrer:
        return {
            "valid": False,
            "message": "推薦碼無效"
        }
    
    return {
        "valid": True,
        "referrer_name": referrer.full_name or "用戶",
        "message": "推薦碼有效"
    }


# ============================================================
# 管理員端點
# ============================================================

@router.get("/admin/leaderboard")
def get_referral_leaderboard(
    limit: int = 20,
    db: Session = Depends(get_db),
    # TODO: 需要驗證管理員權限
):
    """取得推薦排行榜"""
    users = db.query(User).filter(
        User.total_referrals > 0
    ).order_by(User.total_referrals.desc()).limit(limit).all()
    
    return [
        {
            "rank": i + 1,
            "user_id": u.id,
            "email": u.email,
            "partner_tier": u.partner_tier or "bronze",
            "total_referrals": u.total_referrals or 0,
            "total_revenue": float(u.total_referral_revenue or 0),
        }
        for i, u in enumerate(users)
    ]


@router.post("/admin/upgrade-tier/{user_id}")
def admin_upgrade_partner_tier(
    user_id: int,
    new_tier: str,
    db: Session = Depends(get_db),
    # TODO: 需要驗證管理員權限
):
    """管理員手動升級夥伴等級"""
    if new_tier not in PARTNER_TIERS:
        raise HTTPException(status_code=400, detail=f"無效的夥伴等級：{new_tier}")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用戶不存在")
    
    old_tier = user.partner_tier or "bronze"
    user.partner_tier = new_tier
    db.commit()
    
    return {
        "success": True,
        "message": f"已將用戶 #{user_id} 從 {old_tier} 升級為 {new_tier}",
        "old_tier": old_tier,
        "new_tier": new_tier
    }
