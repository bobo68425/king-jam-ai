"""
點數帳本 API
提供點數查詢、交易記錄、方案購買、獎金提領等功能

點數類別（按消耗順序）：
- PROMO (優惠點數): 新手任務、行銷活動、補償，7-30天有效
- SUB (月費點數): 訂閱方案每月發放，當月有效
- PAID (購買點數): 刷卡儲值，永久有效，可退款
- BONUS (獎金點數): 推薦分潤，永久有效，可提領現金

消耗順序：PROMO -> SUB -> PAID -> BONUS
"""

from datetime import datetime, timedelta
from typing import Optional, List, Dict
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func
import pytz

from app.database import get_db
from app.models import User, CreditTransaction, CreditPricing, CreditPackage, WithdrawalRequest, WithdrawalConfig, RefundRequest
from app.routers.auth import get_current_user
from app.services.credit_service import (
    CreditService, 
    CreditCategory,
    TransactionType, 
    FeatureCode,
    DEFAULT_PRICING,
    WITHDRAWAL_EXCHANGE_RATE,
    WITHDRAWAL_MIN_CREDITS,
    WITHDRAWAL_MIN_TWD,
    PAID_REFUND_RATE,
    PAID_DEFAULT_EXCHANGE_RATE,
)
from app.services.verification_service import get_verification_service
import pyotp
import uuid

router = APIRouter(prefix="/credits", tags=["點數帳本"])


# ============================================================
# Request/Response Models
# ============================================================

class CategoryBalanceDetail(BaseModel):
    """分類餘額詳情"""
    promo: int = Field(description="優惠點數（短效期）")
    sub: int = Field(description="月費點數（當月有效）")
    paid: int = Field(description="購買點數（永久、可退款）")
    bonus: int = Field(description="獎金點數（永久、可提領）")
    total: int = Field(description="總計")
    withdrawable: int = Field(description="可提領點數（=bonus）")
    withdrawable_twd: float = Field(description="可提領金額（TWD）")


class CreditBalanceResponse(BaseModel):
    """點數餘額回應"""
    balance: int
    category_balance: CategoryBalanceDetail
    tier: str
    is_consistent: bool = True
    
    class Config:
        from_attributes = True


class TransactionResponse(BaseModel):
    """交易記錄回應"""
    id: int
    credit_category: str
    transaction_type: str
    amount: int
    balance_before: int
    balance_after: int
    description: Optional[str]
    reference_type: Optional[str]
    reference_id: Optional[int]
    consumed_from: Optional[Dict[str, int]] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class TransactionListResponse(BaseModel):
    """交易記錄列表回應"""
    transactions: List[TransactionResponse]
    total: int
    has_more: bool


class UsageStatsResponse(BaseModel):
    """使用統計回應"""
    total_earned: int
    total_spent: int
    balance: int
    category_balance: CategoryBalanceDetail
    by_type: dict
    by_category: dict


class PricingResponse(BaseModel):
    """定價回應"""
    feature_code: str
    feature_name: str
    credits_cost: int
    description: Optional[str]
    
    class Config:
        from_attributes = True


class PackageResponse(BaseModel):
    """點數方案回應"""
    id: int
    package_code: str
    name: str
    credits_amount: int
    bonus_credits: int
    price_twd: float
    original_price_twd: Optional[float]
    validity_days: Optional[int]
    is_popular: bool
    description: Optional[str]
    
    class Config:
        from_attributes = True


class ExpiringCreditsResponse(BaseModel):
    """即將到期點數回應"""
    promo_expiring: int = Field(description="即將到期的優惠點數")
    promo_expires_at: Optional[datetime] = Field(None, description="優惠點數到期時間")
    promo_days_left: int = Field(0, description="優惠點數剩餘天數")
    sub_expiring: int = Field(description="月底到期的月費點數")
    sub_expires_at: Optional[datetime] = Field(None, description="月費點數到期時間（月底）")
    sub_days_left: int = Field(0, description="月費點數剩餘天數")
    total_expiring: int = Field(description="即將到期的總點數")
    has_expiring: bool = Field(description="是否有即將到期的點數")
    urgency: str = Field(description="緊急程度: low, medium, high, critical")
    message: Optional[str] = Field(None, description="提示訊息")


class CheckBalanceRequest(BaseModel):
    """檢查餘額請求"""
    feature_code: str


class CheckBalanceResponse(BaseModel):
    """檢查餘額回應"""
    sufficient: bool
    required: int
    current_balance: int
    category_balance: CategoryBalanceDetail
    remaining_after: int


class AdminAdjustRequest(BaseModel):
    """管理員調整請求"""
    user_id: int
    amount: int = Field(..., description="調整金額（正數增加，負數扣除）")
    credit_category: str = Field(..., description="點數類別: promo, sub, paid, bonus")
    reason: str = Field(..., min_length=1, max_length=255)


class AdminRefundRequest(BaseModel):
    """管理員退款請求（舊版，點數調整用）"""
    user_id: int
    amount: int = Field(..., gt=0)
    credit_category: str = Field(..., description="點數類別")
    original_transaction_id: int
    reason: str = "退款"


# ============================================================
# PAID 點數退款申請 Schemas
# ============================================================

class PaidRefundEligibilityResponse(BaseModel):
    """PAID 退款資格查詢回應"""
    eligible: bool
    paid_balance: int = Field(description="PAID 點數餘額")
    price_per_credit: float = Field(description="購買時每點價格")
    refund_rate: float = Field(description="退款比例")
    max_refund_amount: float = Field(description="最高可退款金額")
    has_pending_refund: bool = Field(description="是否有待處理的退款申請")
    message: str = ""


class PaidRefundApplyRequest(BaseModel):
    """PAID 退款申請請求"""
    credits_amount: int = Field(..., gt=0, description="申請退款的點數")
    reason: str = Field(default="", description="退款原因")
    refund_method: str = Field(default="original", description="退款方式: original, bank_transfer")
    # 銀行轉帳資訊（refund_method=bank_transfer 時必填）
    bank_code: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    account_name: Optional[str] = None


class PaidRefundApplyResponse(BaseModel):
    """PAID 退款申請回應"""
    success: bool
    request_no: Optional[str] = None
    credits_amount: int = 0
    refund_amount: float = 0
    status: str = ""
    message: str = ""


class PaidRefundListItem(BaseModel):
    """退款申請列表項目"""
    id: int
    request_no: str
    credits_amount: int
    price_per_credit: float
    refund_rate: float
    refund_amount: float
    status: str
    reason: Optional[str]
    reject_reason: Optional[str]
    created_at: str
    reviewed_at: Optional[str]
    completed_at: Optional[str]


class GrantCreditsRequest(BaseModel):
    """發放點數請求"""
    user_id: int
    amount: int = Field(..., gt=0)
    credit_category: str = Field(..., description="點數類別: promo, sub, paid, bonus")
    description: str = Field(..., min_length=1, max_length=255)
    promo_code: Optional[str] = None
    campaign: Optional[str] = None
    expires_in_days: Optional[int] = 30


# ============================================================
# 提領相關模型
# ============================================================

class WithdrawalVerificationStatus(BaseModel):
    """提領認證狀態"""
    phone_verified: bool = Field(description="手機是否已認證")
    identity_verified: bool = Field(description="身份是否已認證")
    identity_real_name: Optional[str] = Field(None, description="身份認證的真實姓名")
    two_factor_enabled: bool = Field(description="2FA 是否已啟用")
    all_verified: bool = Field(description="是否已完成所有認證")


class WithdrawalEligibilityResponse(BaseModel):
    """提領資格檢查回應"""
    eligible: bool
    bonus_balance: int
    available_bonus: int = Field(description="可提領的獎金點數（已過冷卻期）")
    cooling_bonus: int = Field(description="冷卻期內的獎金點數（T+14）")
    cooling_period_days: int = Field(default=14, description="冷卻期天數")
    min_credits: int
    exchange_rate: float
    withdrawable_twd: float
    min_twd: float
    # 安全認證狀態
    verification_status: WithdrawalVerificationStatus
    can_withdraw: bool = Field(description="是否可以提領（點數足夠且認證完成）")
    missing_verifications: List[str] = Field(default=[], description="缺少的認證項目")
    # 首次提領資訊
    is_first_withdrawal: bool = Field(default=False, description="是否為首次提領")
    first_withdrawal_requires_review: bool = Field(default=True, description="首次提領是否需人工審核")


class WithdrawalRequestCreate(BaseModel):
    """提領申請請求"""
    credits_amount: int = Field(..., ge=300, description="提領點數（最低 300）")
    bank_code: str = Field(..., min_length=3, max_length=10)
    bank_name: str = Field(..., min_length=1, max_length=50)
    account_number: str = Field(..., min_length=5, max_length=20)
    account_holder: str = Field(..., min_length=1, max_length=50)
    totp_code: str = Field(..., min_length=6, max_length=6, description="Authenticator App 驗證碼")
    user_note: Optional[str] = None


class WithdrawalRequestResponse(BaseModel):
    """提領申請回應"""
    id: int
    credits_amount: int
    amount_twd: float
    exchange_rate: float
    status: str
    bank_name: Optional[str]
    account_number_masked: Optional[str]
    rejection_reason: Optional[str]
    created_at: datetime
    reviewed_at: Optional[datetime]
    transferred_at: Optional[datetime]
    # 風控資訊
    is_first_withdrawal: Optional[bool] = None
    requires_manual_review: Optional[bool] = None
    risk_level: Optional[str] = None
    risk_notes: Optional[str] = None
    
    class Config:
        from_attributes = True


class WithdrawalListResponse(BaseModel):
    """提領記錄列表回應"""
    requests: List[WithdrawalRequestResponse]
    total: int
    has_more: bool


class AdminReviewWithdrawalRequest(BaseModel):
    """管理員審核提領請求"""
    action: str = Field(..., description="approve 或 reject")
    note: Optional[str] = None
    rejection_reason: Optional[str] = None


class AdminCompleteWithdrawalRequest(BaseModel):
    """管理員完成匯款請求"""
    transfer_reference: str = Field(..., min_length=1, max_length=100)


# ============================================================
# 用戶端點
# ============================================================

@router.get("/balance", response_model=CreditBalanceResponse)
async def get_balance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    取得當前點數餘額（含各類別明細）
    """
    credit_service = CreditService(db)
    balance, is_consistent = credit_service.get_verified_balance(current_user.id)
    category_balance = credit_service.get_category_balance(current_user.id)
    
    return CreditBalanceResponse(
        balance=balance,
        category_balance=CategoryBalanceDetail(
            promo=category_balance.promo,
            sub=category_balance.sub,
            paid=category_balance.paid,
            bonus=category_balance.bonus,
            total=category_balance.total,
            withdrawable=category_balance.withdrawable,
            withdrawable_twd=float(category_balance.withdrawable_twd),
        ),
        tier=current_user.tier or "free",
        is_consistent=is_consistent
    )


@router.get("/expiring", response_model=ExpiringCreditsResponse)
async def get_expiring_credits(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    取得即將到期的點數資訊
    
    - PROMO (優惠點數): 根據發放時設定的有效期，通常 7-30 天
    - SUB (月費點數): 每月最後一天到期歸零
    
    用於製造 FOMO (錯失恐懼)，促進用戶使用
    """
    import calendar
    from datetime import date
    
    credit_service = CreditService(db)
    category_balance = credit_service.get_category_balance(current_user.id)
    
    now = datetime.now(pytz.timezone("Asia/Taipei"))
    today = now.date()
    
    # 計算月費點數到期時間（月底）
    _, last_day = calendar.monthrange(today.year, today.month)
    sub_expires_at = datetime(today.year, today.month, last_day, 23, 59, 59, tzinfo=pytz.timezone("Asia/Taipei"))
    sub_days_left = (date(today.year, today.month, last_day) - today).days
    
    # 查詢最近的優惠點數交易，找出最早的到期時間
    promo_expires_at = None
    promo_days_left = 30  # 預設 30 天
    
    if category_balance.promo > 0:
        # 查詢最近的 promo 增加交易
        recent_promo = db.query(CreditTransaction).filter(
            CreditTransaction.user_id == current_user.id,
            CreditTransaction.credit_category == "promo",
            CreditTransaction.amount > 0,
        ).order_by(CreditTransaction.created_at.asc()).first()
        
        if recent_promo:
            # 從 metadata 取得有效期
            expires_in_days = 30
            if recent_promo.extra_data:
                expires_in_days = recent_promo.extra_data.get("expires_in_days", 30)
            
            promo_expires_at = recent_promo.created_at + timedelta(days=expires_in_days)
            promo_days_left = max(0, (promo_expires_at.date() - today).days)
            
            # 如果 promo_expires_at 是 naive datetime，轉換為 aware
            if promo_expires_at.tzinfo is None:
                promo_expires_at = pytz.UTC.localize(promo_expires_at)
    
    # 計算即將到期的點數
    promo_expiring = category_balance.promo if promo_days_left <= 7 else 0
    sub_expiring = category_balance.sub if sub_days_left <= 7 else 0
    total_expiring = promo_expiring + sub_expiring
    
    # 判斷緊急程度
    min_days = min(
        promo_days_left if category_balance.promo > 0 else 999,
        sub_days_left if category_balance.sub > 0 else 999
    )
    
    if min_days <= 1:
        urgency = "critical"
    elif min_days <= 3:
        urgency = "high"
    elif min_days <= 7:
        urgency = "medium"
    else:
        urgency = "low"
    
    # 生成提示訊息
    message = None
    if urgency == "critical":
        if category_balance.promo > 0 and promo_days_left <= 1:
            message = f"⚠️ 您有 {category_balance.promo} 點優惠點數今天到期！"
        elif category_balance.sub > 0 and sub_days_left <= 1:
            message = f"⚠️ 您有 {category_balance.sub} 點月費點數今天到期！"
    elif urgency == "high":
        if category_balance.promo > 0 and promo_days_left <= 3:
            message = f"🔥 優惠點數 {category_balance.promo} 點將在 {promo_days_left} 天後到期"
        elif category_balance.sub > 0 and sub_days_left <= 3:
            message = f"🔥 月費點數 {category_balance.sub} 點將在 {sub_days_left} 天後到期"
    elif urgency == "medium":
        if total_expiring > 0:
            message = f"📅 您有 {total_expiring} 點即將在 7 天內到期"
    
    has_expiring = (
        (category_balance.promo > 0 and promo_days_left <= 7) or
        (category_balance.sub > 0 and sub_days_left <= 7)
    )
    
    return ExpiringCreditsResponse(
        promo_expiring=category_balance.promo if promo_days_left <= 7 else 0,
        promo_expires_at=promo_expires_at if category_balance.promo > 0 else None,
        promo_days_left=promo_days_left if category_balance.promo > 0 else 0,
        sub_expiring=category_balance.sub if sub_days_left <= 7 else 0,
        sub_expires_at=sub_expires_at if category_balance.sub > 0 else None,
        sub_days_left=sub_days_left if category_balance.sub > 0 else 0,
        total_expiring=total_expiring,
        has_expiring=has_expiring,
        urgency=urgency,
        message=message,
    )


@router.get("/transactions", response_model=TransactionListResponse)
async def get_transactions(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    transaction_type: Optional[str] = None,
    credit_category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    取得交易記錄
    """
    credit_service = CreditService(db)
    
    transactions = credit_service.get_transaction_history(
        user_id=current_user.id,
        limit=limit + 1,
        offset=offset,
        transaction_type=transaction_type,
        credit_category=credit_category
    )
    
    has_more = len(transactions) > limit
    if has_more:
        transactions = transactions[:limit]
    
    total_query = db.query(CreditTransaction).filter(
        CreditTransaction.user_id == current_user.id
    )
    if transaction_type:
        total_query = total_query.filter(
            CreditTransaction.transaction_type == transaction_type
        )
    if credit_category:
        total_query = total_query.filter(
            CreditTransaction.credit_category == credit_category
        )
    total = total_query.count()
    
    return TransactionListResponse(
        transactions=[
            TransactionResponse(
                id=tx.id,
                credit_category=tx.credit_category,
                transaction_type=tx.transaction_type,
                amount=tx.amount,
                balance_before=tx.balance_before,
                balance_after=tx.balance_after,
                description=tx.description,
                reference_type=tx.reference_type,
                reference_id=tx.reference_id,
                consumed_from=tx.extra_data.get("consumed_from") if tx.extra_data else None,
                created_at=tx.created_at
            )
            for tx in transactions
        ],
        total=total,
        has_more=has_more
    )


@router.get("/usage-stats", response_model=UsageStatsResponse)
async def get_usage_stats(
    days: int = Query(30, ge=1, le=365, description="統計天數"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    取得點數使用統計（含各類別明細）
    """
    credit_service = CreditService(db)
    
    start_date = datetime.now(pytz.UTC) - timedelta(days=days)
    stats = credit_service.get_usage_stats(
        user_id=current_user.id,
        start_date=start_date
    )
    
    balance = credit_service.get_balance(current_user.id)
    category_balance = credit_service.get_category_balance(current_user.id)
    
    return UsageStatsResponse(
        total_earned=stats["total_earned"],
        total_spent=stats["total_spent"],
        balance=balance,
        category_balance=CategoryBalanceDetail(
            promo=category_balance.promo,
            sub=category_balance.sub,
            paid=category_balance.paid,
            bonus=category_balance.bonus,
            total=category_balance.total,
            withdrawable=category_balance.withdrawable,
            withdrawable_twd=float(category_balance.withdrawable_twd),
        ),
        by_type=stats["by_type"],
        by_category=stats["by_category"]
    )


@router.post("/check", response_model=CheckBalanceResponse)
async def check_balance_for_feature(
    request: CheckBalanceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    檢查餘額是否足夠使用某功能
    """
    credit_service = CreditService(db)
    
    try:
        feature_code = FeatureCode(request.feature_code)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"無效的功能代碼: {request.feature_code}"
        )
    
    cost = credit_service.get_feature_cost(feature_code, current_user.tier)
    balance = credit_service.get_balance(current_user.id)
    category_balance = credit_service.get_category_balance(current_user.id)
    
    return CheckBalanceResponse(
        sufficient=balance >= cost,
        required=cost,
        current_balance=balance,
        category_balance=CategoryBalanceDetail(
            promo=category_balance.promo,
            sub=category_balance.sub,
            paid=category_balance.paid,
            bonus=category_balance.bonus,
            total=category_balance.total,
            withdrawable=category_balance.withdrawable,
            withdrawable_twd=float(category_balance.withdrawable_twd),
        ),
        remaining_after=balance - cost
    )


@router.get("/pricing", response_model=List[PricingResponse])
async def get_pricing(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    取得點數定價表
    
    直接從資料庫 credit_pricing 表取得所有有效的定價項目。
    定價需與各引擎的 COST_TABLE 保持一致。
    """
    # 直接從資料庫取得定價，按 feature_code 排序方便前端分類顯示
    db_pricing = db.query(CreditPricing).filter(
        CreditPricing.is_active == True,
        (CreditPricing.tier == current_user.tier) | (CreditPricing.tier.is_(None))
    ).order_by(CreditPricing.feature_code).all()
    
    return [
        PricingResponse(
            feature_code=p.feature_code,
            feature_name=p.feature_name,
            credits_cost=p.credits_cost,
            description=p.description
        )
        for p in db_pricing
    ]


@router.get("/packages", response_model=List[PackageResponse])
async def get_packages(
    db: Session = Depends(get_db)
):
    """
    取得可購買的點數方案
    """
    packages = db.query(CreditPackage).filter(
        CreditPackage.is_active == True
    ).order_by(CreditPackage.sort_order).all()
    
    return [
        PackageResponse(
            id=p.id,
            package_code=p.package_code,
            name=p.name,
            credits_amount=p.credits_amount,
            bonus_credits=p.bonus_credits,
            price_twd=float(p.price_twd),
            original_price_twd=float(p.original_price_twd) if p.original_price_twd else None,
            validity_days=p.validity_days,
            is_popular=p.is_popular,
            description=p.description
        )
        for p in packages
    ]


# ============================================================
# 提領端點
# ============================================================

@router.get("/withdrawal/eligibility", response_model=WithdrawalEligibilityResponse)
async def check_withdrawal_eligibility(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    檢查提領資格
    
    提領條件：
    1. 可提領獎金點數（已過 T+14 冷卻期）達到最低門檻 3,000 點 (NT$300)
    2. 首次提領需完成：手機認證 + 身份認證 + 人工審核
    3. 每次提領需使用 Authenticator App 驗證
    4. 銀行帳戶戶名需與身份認證姓名一致
    """
    from sqlalchemy import text
    
    credit_service = CreditService(db)
    category_balance = credit_service.get_category_balance(current_user.id)
    
    # 獲取冷卻期設定
    withdrawal_config = db.query(WithdrawalConfig).filter(
        WithdrawalConfig.is_active == True
    ).first()
    cooling_period_days = withdrawal_config.cooling_period_days if withdrawal_config else 14
    first_withdrawal_requires_review = withdrawal_config.first_withdrawal_manual_review if withdrawal_config else True
    
    # 檢查是否為首次提領
    previous_withdrawal = db.query(WithdrawalRequest).filter(
        WithdrawalRequest.user_id == current_user.id,
        WithdrawalRequest.status == "completed"
    ).first()
    is_first_withdrawal = previous_withdrawal is None
    
    # 檢查認證狀態
    phone_status = db.execute(text("""
        SELECT is_verified, phone_number FROM phone_verifications WHERE user_id = :user_id
    """), {"user_id": current_user.id}).fetchone()
    
    identity_status = db.execute(text("""
        SELECT status, real_name FROM identity_verifications WHERE user_id = :user_id
    """), {"user_id": current_user.id}).fetchone()
    
    two_factor_status = db.execute(text("""
        SELECT is_totp_enabled FROM two_factor_auth WHERE user_id = :user_id
    """), {"user_id": current_user.id}).fetchone()
    
    phone_verified = bool(phone_status and phone_status.is_verified)
    identity_verified = bool(identity_status and identity_status.status == "approved")
    identity_real_name = identity_status.real_name if identity_status else None
    two_factor_enabled = bool(two_factor_status and two_factor_status.is_totp_enabled)
    
    all_verified = phone_verified and identity_verified and two_factor_enabled
    
    # 計算缺少的認證
    missing = []
    if not phone_verified:
        missing.append("phone")
    if not identity_verified:
        missing.append("identity")
    if not two_factor_enabled:
        missing.append("two_factor")
    
    verification_status = WithdrawalVerificationStatus(
        phone_verified=phone_verified,
        identity_verified=identity_verified,
        identity_real_name=identity_real_name,
        two_factor_enabled=two_factor_enabled,
        all_verified=all_verified
    )
    
    # 判斷資格（使用可提領點數，非總 BONUS）
    eligible = category_balance.available_bonus >= WITHDRAWAL_MIN_CREDITS
    can_withdraw = eligible and all_verified
    
    return WithdrawalEligibilityResponse(
        eligible=eligible,
        bonus_balance=category_balance.bonus,
        available_bonus=category_balance.available_bonus,
        cooling_bonus=category_balance.cooling_bonus,
        cooling_period_days=cooling_period_days,
        min_credits=WITHDRAWAL_MIN_CREDITS,
        exchange_rate=float(WITHDRAWAL_EXCHANGE_RATE),
        withdrawable_twd=float(category_balance.withdrawable_twd),
        min_twd=float(WITHDRAWAL_MIN_TWD),
        verification_status=verification_status,
        can_withdraw=can_withdraw,
        missing_verifications=missing,
        is_first_withdrawal=is_first_withdrawal,
        first_withdrawal_requires_review=first_withdrawal_requires_review,
    )


@router.post("/withdrawal/request", response_model=WithdrawalRequestResponse)
async def create_withdrawal_request(
    request: WithdrawalRequestCreate,
    req: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    申請提領獎金點數
    
    提領條件：
    1. 獎金點數達最低門檻 3,000 點 (NT$300)
    2. 需完成手機認證 + 身份認證 + 2FA 設定
    3. 每次提領需輸入 Authenticator App 驗證碼
    4. 銀行帳戶戶名需與身份認證姓名一致
    """
    from sqlalchemy import text
    
    credit_service = CreditService(db)
    
    # ========== 1. 檢查認證狀態 ==========
    phone_status = db.execute(text("""
        SELECT is_verified FROM phone_verifications WHERE user_id = :user_id
    """), {"user_id": current_user.id}).fetchone()
    
    if not phone_status or not phone_status.is_verified:
        raise HTTPException(
            status_code=400,
            detail="請先完成手機認證才能提領"
        )
    
    identity_status = db.execute(text("""
        SELECT status, real_name FROM identity_verifications WHERE user_id = :user_id
    """), {"user_id": current_user.id}).fetchone()
    
    if not identity_status or identity_status.status != "approved":
        raise HTTPException(
            status_code=400,
            detail="請先完成身份認證才能提領"
        )
    
    two_factor = db.execute(text("""
        SELECT is_totp_enabled, totp_secret FROM two_factor_auth WHERE user_id = :user_id
    """), {"user_id": current_user.id}).fetchone()
    
    if not two_factor or not two_factor.is_totp_enabled:
        raise HTTPException(
            status_code=400,
            detail="請先設定雙重驗證 (Authenticator App) 才能提領"
        )
    
    # ========== 2. 驗證 2FA 驗證碼 ==========
    totp = pyotp.TOTP(two_factor.totp_secret)
    if not totp.verify(request.totp_code, valid_window=1):
        raise HTTPException(
            status_code=400,
            detail="驗證碼錯誤或已過期，請重新輸入"
        )
    
    # ========== 3. 驗證戶名一致性 ==========
    # 比較銀行戶名與身份認證姓名（移除空格後比較）
    identity_name = identity_status.real_name.replace(" ", "").strip()
    account_name = request.account_holder.replace(" ", "").strip()
    
    if identity_name != account_name:
        raise HTTPException(
            status_code=400,
            detail=f"銀行帳戶戶名必須與身份認證姓名一致（{identity_status.real_name}）"
        )
    
    # ========== 4. 檢查點數餘額（含 T+14 冷卻期） ==========
    category_balance = credit_service.get_category_balance(current_user.id)
    
    # 檢查可提領點數（已過冷卻期的 BONUS）
    if category_balance.available_bonus < WITHDRAWAL_MIN_CREDITS:
        if category_balance.cooling_bonus > 0:
            raise HTTPException(
                status_code=400,
                detail=f"可提領點數不足。您有 {category_balance.bonus} 點獎金，"
                       f"但 {category_balance.cooling_bonus} 點尚在 T+14 冷卻期內，"
                       f"目前可提領 {category_balance.available_bonus} 點（最低 {WITHDRAWAL_MIN_CREDITS} 點）"
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"獎金點數不足，最低提領門檻為 {WITHDRAWAL_MIN_CREDITS} 點"
            )
    
    if request.credits_amount > category_balance.available_bonus:
        raise HTTPException(
            status_code=400,
            detail=f"提領金額超過可提領上限（目前可提領 {category_balance.available_bonus} 點，"
                   f"冷卻期內 {category_balance.cooling_bonus} 點）"
        )
    
    # ========== 5. 檢查待處理的申請 ==========
    pending = db.query(WithdrawalRequest).filter(
        WithdrawalRequest.user_id == current_user.id,
        WithdrawalRequest.status.in_(["pending", "reviewing", "approved"])
    ).first()
    if pending:
        raise HTTPException(
            status_code=400,
            detail="您有尚未完成的提領申請，請等待處理完成"
        )
    
    # ========== 6. 風控檢查：首次提領 & 高額提領 ==========
    # 檢查是否為首次提領
    previous_withdrawal = db.query(WithdrawalRequest).filter(
        WithdrawalRequest.user_id == current_user.id,
        WithdrawalRequest.status == "completed"
    ).first()
    is_first_withdrawal = previous_withdrawal is None
    
    # 獲取風控設定
    withdrawal_config = db.query(WithdrawalConfig).filter(
        WithdrawalConfig.is_active == True
    ).first()
    
    # 判斷是否需要人工審核
    requires_manual_review = False
    risk_level = "low"
    risk_notes_list = []
    
    # 規則 1：首次提領需人工審核
    if is_first_withdrawal:
        if withdrawal_config is None or withdrawal_config.first_withdrawal_manual_review:
            requires_manual_review = True
            risk_level = "medium"
            risk_notes_list.append("首次提領（需人工審核）")
    
    # 規則 2：高額提領需人工審核
    high_amount_threshold = withdrawal_config.high_amount_threshold if withdrawal_config else 50000
    if request.credits_amount >= high_amount_threshold:
        requires_manual_review = True
        risk_level = "high" if risk_level == "medium" else "medium"
        risk_notes_list.append(f"高額提領（>= {high_amount_threshold} 點）")
    
    # 規則 3：檢查用戶風險檔案
    from app.services.fraud_detection import UserRiskProfile, RiskLevel
    user_risk_profile = db.query(UserRiskProfile).filter(
        UserRiskProfile.user_id == current_user.id
    ).first()
    
    if user_risk_profile:
        if user_risk_profile.withdrawal_blocked:
            raise HTTPException(
                status_code=403,
                detail="您的提領功能已被暫停，請聯繫客服"
            )
        if user_risk_profile.risk_level in [RiskLevel.MEDIUM.value, RiskLevel.HIGH.value]:
            requires_manual_review = True
            risk_level = user_risk_profile.risk_level
            risk_notes_list.append(f"用戶風險等級：{user_risk_profile.risk_level}")
    
    risk_notes = "；".join(risk_notes_list) if risk_notes_list else None
    
    # ========== 7. 建立提領申請 ==========
    amount_twd = Decimal(request.credits_amount) * WITHDRAWAL_EXCHANGE_RATE
    
    withdrawal = WithdrawalRequest(
        user_id=current_user.id,
        credits_amount=request.credits_amount,
        amount_twd=amount_twd,
        exchange_rate=WITHDRAWAL_EXCHANGE_RATE,
        status="reviewing" if requires_manual_review else "pending",
        bank_code=request.bank_code,
        bank_name=request.bank_name,
        account_number=request.account_number,
        account_holder=request.account_holder,
        user_note=request.user_note,
        # 風控標記
        is_first_withdrawal=is_first_withdrawal,
        requires_manual_review=requires_manual_review,
        risk_level=risk_level,
        risk_notes=risk_notes,
    )
    db.add(withdrawal)
    db.flush()
    
    # 扣除獎金點數
    ip_address = req.client.host if req.client else None
    result = credit_service.deduct_for_withdrawal(
        user_id=current_user.id,
        credits_amount=request.credits_amount,
        withdrawal_request_id=withdrawal.id,
        ip_address=ip_address
    )
    
    if not result.success:
        db.rollback()
        raise HTTPException(status_code=400, detail=result.error)
    
    # 更新關聯的交易 ID
    withdrawal.credit_transaction_id = result.transaction_id
    db.commit()
    db.refresh(withdrawal)
    
    # 遮罩帳號
    masked_account = f"{'*' * (len(request.account_number) - 4)}{request.account_number[-4:]}"
    
    return WithdrawalRequestResponse(
        id=withdrawal.id,
        credits_amount=withdrawal.credits_amount,
        amount_twd=float(withdrawal.amount_twd),
        exchange_rate=float(withdrawal.exchange_rate),
        status=withdrawal.status,
        bank_name=withdrawal.bank_name,
        account_number_masked=masked_account,
        rejection_reason=None,
        created_at=withdrawal.created_at,
        reviewed_at=None,
        transferred_at=None,
        # 風控資訊
        is_first_withdrawal=withdrawal.is_first_withdrawal,
        requires_manual_review=withdrawal.requires_manual_review,
        risk_level=withdrawal.risk_level,
        risk_notes=withdrawal.risk_notes,
    )


@router.get("/withdrawal/history", response_model=WithdrawalListResponse)
async def get_withdrawal_history(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    取得提領歷史記錄
    """
    query = db.query(WithdrawalRequest).filter(
        WithdrawalRequest.user_id == current_user.id
    ).order_by(WithdrawalRequest.created_at.desc())
    
    total = query.count()
    requests = query.offset(offset).limit(limit + 1).all()
    
    has_more = len(requests) > limit
    if has_more:
        requests = requests[:limit]
    
    return WithdrawalListResponse(
        requests=[
            WithdrawalRequestResponse(
                id=w.id,
                credits_amount=w.credits_amount,
                amount_twd=float(w.amount_twd),
                exchange_rate=float(w.exchange_rate),
                status=w.status,
                bank_name=w.bank_name,
                account_number_masked=f"{'*' * (len(w.account_number or '') - 4)}{(w.account_number or '')[-4:]}" if w.account_number else None,
                rejection_reason=w.rejection_reason,
                created_at=w.created_at,
                reviewed_at=w.reviewed_at,
                transferred_at=w.transferred_at,
            )
            for w in requests
        ],
        total=total,
        has_more=has_more
    )


@router.post("/withdrawal/{withdrawal_id}/cancel")
async def cancel_withdrawal_request(
    withdrawal_id: int,
    req: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    取消提領申請（只能取消 pending 狀態的申請）
    """
    withdrawal = db.query(WithdrawalRequest).filter(
        WithdrawalRequest.id == withdrawal_id,
        WithdrawalRequest.user_id == current_user.id
    ).first()
    
    if not withdrawal:
        raise HTTPException(status_code=404, detail="提領申請不存在")
    
    if withdrawal.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"只能取消「申請中」的提領，目前狀態為「{withdrawal.status}」"
        )
    
    # 退還點數
    credit_service = CreditService(db)
    ip_address = req.client.host if req.client else None
    
    result = credit_service.refund_withdrawal(
        user_id=current_user.id,
        credits_amount=withdrawal.credits_amount,
        withdrawal_request_id=withdrawal.id,
        reason="用戶自行取消提領",
        ip_address=ip_address
    )
    
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    
    # 更新狀態
    withdrawal.status = "cancelled"
    db.commit()
    
    return {"success": True, "message": "提領申請已取消，點數已退還"}


# ============================================================
# 管理員端點
# ============================================================

@router.post("/admin/grant")
async def admin_grant_credits(
    request: GrantCreditsRequest,
    req: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    管理員發放點數
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    try:
        category = CreditCategory(request.credit_category)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"無效的點數類別: {request.credit_category}"
        )
    
    credit_service = CreditService(db)
    ip_address = req.client.host if req.client else None
    
    if category == CreditCategory.PROMO:
        result = credit_service.grant_promo(
            user_id=request.user_id,
            amount=request.amount,
            promo_code=request.promo_code,
            campaign=request.campaign,
            expires_in_days=request.expires_in_days or 30,
            ip_address=ip_address
        )
    elif category == CreditCategory.SUB:
        result = credit_service.grant_subscription(
            user_id=request.user_id,
            amount=request.amount,
            ip_address=ip_address
        )
    elif category == CreditCategory.PAID:
        result = credit_service.grant_purchase(
            user_id=request.user_id,
            amount=request.amount,
            ip_address=ip_address
        )
    elif category == CreditCategory.BONUS:
        result = credit_service.grant(
            user_id=request.user_id,
            amount=request.amount,
            transaction_type=TransactionType.ADMIN_ADJUSTMENT,
            credit_category=category,
            description=request.description,
            ip_address=ip_address
        )
    else:
        result = credit_service.grant(
            user_id=request.user_id,
            amount=request.amount,
            transaction_type=TransactionType.ADMIN_ADJUSTMENT,
            credit_category=category,
            description=request.description,
            ip_address=ip_address
        )
    
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    
    return {
        "success": True,
        "transaction_id": result.transaction_id,
        "new_balance": result.balance,
        "category_balance": result.category_balance.to_dict() if result.category_balance else None
    }


@router.post("/admin/adjust")
async def admin_adjust_credits(
    request: AdminAdjustRequest,
    req: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    管理員調整點數（可增減）
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    try:
        category = CreditCategory(request.credit_category)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"無效的點數類別: {request.credit_category}"
        )
    
    credit_service = CreditService(db)
    ip_address = req.client.host if req.client else None
    
    result = credit_service.admin_adjust(
        user_id=request.user_id,
        amount=request.amount,
        credit_category=category,
        reason=request.reason,
        admin_user_id=current_user.id,
        ip_address=ip_address
    )
    
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    
    return {
        "success": True,
        "transaction_id": result.transaction_id,
        "new_balance": result.balance,
        "category_balance": result.category_balance.to_dict() if result.category_balance else None
    }


@router.post("/admin/refund")
async def admin_refund(
    request: AdminRefundRequest,
    req: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    點數退款
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    try:
        category = CreditCategory(request.credit_category)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"無效的點數類別: {request.credit_category}"
        )
    
    credit_service = CreditService(db)
    ip_address = req.client.host if req.client else None
    
    result = credit_service.refund(
        user_id=request.user_id,
        amount=request.amount,
        credit_category=category,
        original_transaction_id=request.original_transaction_id,
        reason=request.reason,
        ip_address=ip_address
    )
    
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    
    return {
        "success": True,
        "transaction_id": result.transaction_id,
        "new_balance": result.balance,
        "category_balance": result.category_balance.to_dict() if result.category_balance else None
    }


@router.post("/admin/sync-balance/{user_id}")
async def admin_sync_balance(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    同步用戶餘額（從交易記錄重新計算各類別餘額）
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    credit_service = CreditService(db)
    result = credit_service.sync_balance_from_transactions(user_id)
    
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    
    return {
        "success": True,
        "new_balance": result.balance,
        "category_balance": result.category_balance.to_dict() if result.category_balance else None
    }


@router.get("/admin/audit/{user_id}")
async def admin_audit_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    審計用戶點數記錄
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    credit_service = CreditService(db)
    
    balance, is_consistent = credit_service.get_verified_balance(user_id)
    category_balance = credit_service.get_category_balance(user_id)
    stats = credit_service.get_usage_stats(user_id)
    transactions = credit_service.get_transaction_history(user_id, limit=100)
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用戶不存在")
    
    return {
        "user_id": user_id,
        "email": user.email,
        "tier": user.tier,
        "current_balance": balance,
        "category_balance": category_balance.to_dict(),
        "is_consistent": is_consistent,
        "stats": stats,
        "recent_transactions": [
            {
                "id": tx.id,
                "category": tx.credit_category,
                "type": tx.transaction_type,
                "amount": tx.amount,
                "balance_before": tx.balance_before,
                "balance_after": tx.balance_after,
                "description": tx.description,
                "consumed_from": tx.extra_data.get("consumed_from") if tx.extra_data else None,
                "created_at": tx.created_at.isoformat()
            }
            for tx in transactions
        ]
    }


# ============================================================
# 提領管理端點
# ============================================================

@router.get("/admin/eligible-users")
async def admin_list_eligible_users(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    取得可提領的用戶清單（管理員）
    
    查詢條件：
    - BONUS 點數 >= 300（最低提領門檻，1 BONUS 點 = NT$1）
    - 未被封鎖提領功能
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    # 查詢 BONUS 點數達標的用戶
    query = db.query(User).filter(
        User.credits_bonus >= WITHDRAWAL_MIN_CREDITS,
        User.is_active == True
    ).order_by(User.credits_bonus.desc())
    
    total = query.count()
    users = query.offset(offset).limit(limit).all()
    
    # 計算每個用戶的可提領金額和認證狀態
    from sqlalchemy import text
    
    eligible_users = []
    for user in users:
        # 檢查認證狀態
        phone_status = db.execute(text("""
            SELECT is_verified FROM phone_verifications WHERE user_id = :user_id
        """), {"user_id": user.id}).fetchone()
        
        identity_status = db.execute(text("""
            SELECT status, real_name FROM identity_verifications WHERE user_id = :user_id
        """), {"user_id": user.id}).fetchone()
        
        two_factor_status = db.execute(text("""
            SELECT is_totp_enabled FROM two_factor_auth WHERE user_id = :user_id
        """), {"user_id": user.id}).fetchone()
        
        phone_verified = bool(phone_status and phone_status.is_verified)
        identity_verified = bool(identity_status and identity_status.status == "approved")
        two_factor_enabled = bool(two_factor_status and two_factor_status.is_totp_enabled)
        
        # 檢查是否有待處理的提領申請
        pending_withdrawal = db.query(WithdrawalRequest).filter(
            WithdrawalRequest.user_id == user.id,
            WithdrawalRequest.status.in_(["pending", "reviewing", "approved"])
        ).first()
        
        # 計算可提領金額（使用 CreditService 計算含冷卻期）
        credit_service = CreditService(db)
        category_balance = credit_service.get_category_balance(user.id)
        
        # 計算 PAID 點數可退款金額
        # 規則：使用最後一次購買的匯率，退款 75%
        # 預設匯率：NT$ 0.65/點（基於中間套餐價格）
        from app.services.credit_service import PAID_DEFAULT_EXCHANGE_RATE, PAID_REFUND_RATE
        
        paid_balance = user.credits_paid or 0
        paid_refundable_twd = 0.0
        paid_exchange_rate = float(PAID_DEFAULT_EXCHANGE_RATE)  # 預設 0.65 TWD/點
        
        if paid_balance > 0:
            # 查詢最後一次購買記錄（從 extra_data 中獲取價格資訊）
            last_purchase = db.execute(text("""
                SELECT extra_data 
                FROM credit_transactions 
                WHERE user_id = :user_id 
                  AND transaction_type = 'purchase' 
                  AND credit_category = 'paid'
                  AND amount > 0
                ORDER BY created_at DESC 
                LIMIT 1
            """), {"user_id": user.id}).fetchone()
            
            if last_purchase and last_purchase.extra_data:
                try:
                    import json
                    extra = last_purchase.extra_data if isinstance(last_purchase.extra_data, dict) else json.loads(last_purchase.extra_data)
                    price = extra.get("price_twd", 0)
                    # 使用總點數（含贈送）計算實際每點價格
                    base_credits = extra.get("credits_amount", 0)
                    bonus = extra.get("bonus_credits", 0)
                    total_credits = base_credits + bonus
                    if total_credits > 0 and price > 0:
                        # 實際購買價格 = 付款金額 / 總點數
                        paid_exchange_rate = price / total_credits
                except:
                    pass
            
            # 計算可退款金額（75%）
            paid_refundable_twd = paid_balance * paid_exchange_rate * float(PAID_REFUND_RATE)
        
        eligible_users.append({
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "customer_id": user.customer_id,
            # BONUS 點數（獎金，可提領）
            "bonus_balance": user.credits_bonus or 0,
            "available_bonus": category_balance.available_bonus,
            "cooling_bonus": category_balance.cooling_bonus,
            "withdrawable_twd": float(category_balance.withdrawable_twd),
            # PAID 點數（付費，可退款 75%）
            "paid_balance": paid_balance,
            "paid_exchange_rate": round(paid_exchange_rate, 4),
            "paid_refundable_twd": round(paid_refundable_twd, 2),
            # 認證狀態
            "phone_verified": phone_verified,
            "identity_verified": identity_verified,
            "identity_real_name": identity_status.real_name if identity_status else None,
            "two_factor_enabled": two_factor_enabled,
            "all_verified": phone_verified and identity_verified and two_factor_enabled,
            # 其他
            "has_pending_withdrawal": pending_withdrawal is not None,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        })
    
    # 統計資訊
    total_bonus = sum(u["bonus_balance"] for u in eligible_users)
    total_paid = sum(u["paid_balance"] for u in eligible_users)
    total_withdrawable = sum(u["withdrawable_twd"] for u in eligible_users)
    total_paid_refundable = sum(u["paid_refundable_twd"] for u in eligible_users)
    fully_verified_count = sum(1 for u in eligible_users if u["all_verified"])
    
    return {
        "users": eligible_users,
        "total": total,
        "stats": {
            "total_eligible_users": total,
            "fully_verified_users": fully_verified_count,
            "total_bonus_points": total_bonus,
            "total_paid_points": total_paid,
            "total_withdrawable_twd": total_withdrawable,
            "total_paid_refundable_twd": round(total_paid_refundable, 2),
        }
    }


@router.get("/admin/withdrawals")
async def admin_list_withdrawals(
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    取得所有提領申請（管理員）
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    query = db.query(WithdrawalRequest).order_by(WithdrawalRequest.created_at.desc())
    
    if status:
        query = query.filter(WithdrawalRequest.status == status)
    
    total = query.count()
    requests = query.offset(offset).limit(limit).all()
    
    return {
        "requests": [
            {
                "id": w.id,
                "user_id": w.user_id,
                "user_email": w.user.email if w.user else None,
                "credits_amount": w.credits_amount,
                "amount_twd": float(w.amount_twd),
                "status": w.status,
                "bank_code": w.bank_code,
                "bank_name": w.bank_name,
                "account_number": w.account_number,
                "account_holder": w.account_holder,
                "rejection_reason": w.rejection_reason,
                "transfer_reference": w.transfer_reference,
                # 風控資訊
                "is_first_withdrawal": w.is_first_withdrawal,
                "requires_manual_review": w.requires_manual_review,
                "risk_level": w.risk_level,
                "risk_notes": w.risk_notes,
                "user_note": w.user_note,
                # 時間
                "created_at": w.created_at.isoformat(),
                "reviewed_at": w.reviewed_at.isoformat() if w.reviewed_at else None,
                "transferred_at": w.transferred_at.isoformat() if w.transferred_at else None,
            }
            for w in requests
        ],
        "total": total,
    }


@router.post("/admin/withdrawals/{withdrawal_id}/review")
async def admin_review_withdrawal(
    withdrawal_id: int,
    request: AdminReviewWithdrawalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    審核提領申請（核准或駁回）
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    withdrawal = db.query(WithdrawalRequest).filter(
        WithdrawalRequest.id == withdrawal_id
    ).first()
    
    if not withdrawal:
        raise HTTPException(status_code=404, detail="提領申請不存在")
    
    if withdrawal.status not in ["pending", "reviewing"]:
        raise HTTPException(
            status_code=400,
            detail=f"無法審核此狀態的申請：{withdrawal.status}"
        )
    
    if request.action == "approve":
        withdrawal.status = "approved"
        withdrawal.reviewed_by = current_user.id
        withdrawal.reviewed_at = datetime.now(pytz.UTC)
        withdrawal.review_note = request.note
        db.commit()
        return {"success": True, "message": "已核准，等待匯款"}
    
    elif request.action == "reject":
        if not request.rejection_reason:
            raise HTTPException(status_code=400, detail="駁回需提供原因")
        
        # 退還點數
        credit_service = CreditService(db)
        result = credit_service.refund_withdrawal(
            user_id=withdrawal.user_id,
            credits_amount=withdrawal.credits_amount,
            withdrawal_request_id=withdrawal.id,
            reason=f"提領申請被駁回：{request.rejection_reason}",
        )
        
        if not result.success:
            raise HTTPException(status_code=400, detail=result.error)
        
        withdrawal.status = "rejected"
        withdrawal.reviewed_by = current_user.id
        withdrawal.reviewed_at = datetime.now(pytz.UTC)
        withdrawal.rejection_reason = request.rejection_reason
        withdrawal.review_note = request.note
        db.commit()
        
        return {"success": True, "message": "已駁回，點數已退還用戶"}
    
    else:
        raise HTTPException(status_code=400, detail="無效的操作，請使用 approve 或 reject")


@router.post("/admin/withdrawals/{withdrawal_id}/complete")
async def admin_complete_withdrawal(
    withdrawal_id: int,
    request: AdminCompleteWithdrawalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    完成匯款（標記為已完成）
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    withdrawal = db.query(WithdrawalRequest).filter(
        WithdrawalRequest.id == withdrawal_id
    ).first()
    
    if not withdrawal:
        raise HTTPException(status_code=404, detail="提領申請不存在")
    
    if withdrawal.status != "approved":
        raise HTTPException(
            status_code=400,
            detail=f"只能完成已核准的申請，目前狀態為：{withdrawal.status}"
        )
    
    withdrawal.status = "completed"
    withdrawal.transfer_reference = request.transfer_reference
    withdrawal.transferred_at = datetime.now(pytz.UTC)
    db.commit()
    
    return {"success": True, "message": "已標記為完成匯款"}


# ============================================================
# PAID 點數退款 API
# ============================================================

def _generate_refund_request_no() -> str:
    """生成退款申請編號"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    random_part = uuid.uuid4().hex[:6].upper()
    return f"RF{timestamp}{random_part}"


def _get_user_purchase_price(db: Session, user_id: int) -> float:
    """
    獲取用戶的平均購買價格
    
    查詢最近的購買記錄，計算平均每點價格
    """
    from sqlalchemy import text
    
    # 查詢所有購買記錄
    purchases = db.execute(text("""
        SELECT extra_data 
        FROM credit_transactions 
        WHERE user_id = :user_id 
          AND transaction_type = 'purchase' 
          AND credit_category = 'paid'
          AND amount > 0
        ORDER BY created_at DESC 
        LIMIT 5
    """), {"user_id": user_id}).fetchall()
    
    if not purchases:
        return float(PAID_DEFAULT_EXCHANGE_RATE)
    
    total_price = 0.0
    total_credits = 0
    
    for purchase in purchases:
        if purchase.extra_data:
            try:
                import json
                extra = purchase.extra_data if isinstance(purchase.extra_data, dict) else json.loads(purchase.extra_data)
                price = extra.get("price_twd", 0)
                # 只計算基本點數（不含贈送）
                credits = extra.get("base_credits") or extra.get("credits_amount", 0)
                if credits > 0 and price > 0:
                    total_price += price
                    total_credits += credits
            except:
                pass
    
    if total_credits > 0:
        return total_price / total_credits
    
    return float(PAID_DEFAULT_EXCHANGE_RATE)


@router.get("/paid-refund/eligibility", response_model=PaidRefundEligibilityResponse)
async def check_paid_refund_eligibility(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    查詢 PAID 點數退款資格
    
    返回用戶的 PAID 點數餘額、購買價格、退款比例等資訊
    """
    paid_balance = current_user.credits_paid or 0
    
    # 查詢是否有待處理的退款申請
    pending_refund = db.query(RefundRequest).filter(
        RefundRequest.user_id == current_user.id,
        RefundRequest.status.in_(["pending", "approved", "processing"])
    ).first()
    
    if paid_balance <= 0:
        return PaidRefundEligibilityResponse(
            eligible=False,
            paid_balance=0,
            price_per_credit=0,
            refund_rate=float(PAID_REFUND_RATE),
            max_refund_amount=0,
            has_pending_refund=pending_refund is not None,
            message="沒有可退款的 PAID 點數"
        )
    
    # 計算購買價格
    price_per_credit = _get_user_purchase_price(db, current_user.id)
    
    # 計算最高可退款金額
    max_refund_amount = paid_balance * price_per_credit * float(PAID_REFUND_RATE)
    
    return PaidRefundEligibilityResponse(
        eligible=not pending_refund,
        paid_balance=paid_balance,
        price_per_credit=round(price_per_credit, 4),
        refund_rate=float(PAID_REFUND_RATE),
        max_refund_amount=round(max_refund_amount, 2),
        has_pending_refund=pending_refund is not None,
        message="" if not pending_refund else "您已有待處理的退款申請"
    )


@router.post("/paid-refund/apply", response_model=PaidRefundApplyResponse)
async def apply_paid_refund(
    request: PaidRefundApplyRequest,
    req: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    申請 PAID 點數退款
    
    - 只能退購買的基本點數（不含贈送）
    - 退款金額 = 點數 × 購買價格 × 75%
    - 需管理員審核
    """
    paid_balance = current_user.credits_paid or 0
    
    # 驗證點數
    if request.credits_amount > paid_balance:
        return PaidRefundApplyResponse(
            success=False,
            message=f"申請退款點數 ({request.credits_amount}) 超過可用餘額 ({paid_balance})"
        )
    
    if request.credits_amount <= 0:
        return PaidRefundApplyResponse(
            success=False,
            message="退款點數必須大於 0"
        )
    
    # 檢查是否有待處理的退款申請
    pending_refund = db.query(RefundRequest).filter(
        RefundRequest.user_id == current_user.id,
        RefundRequest.status.in_(["pending", "approved", "processing"])
    ).first()
    
    if pending_refund:
        return PaidRefundApplyResponse(
            success=False,
            message="您已有待處理的退款申請，請等待處理完成後再申請"
        )
    
    # 驗證銀行轉帳資訊
    if request.refund_method == "bank_transfer":
        if not all([request.bank_code, request.account_number, request.account_name]):
            return PaidRefundApplyResponse(
                success=False,
                message="銀行轉帳需要提供完整的銀行資訊"
            )
    
    # 計算購買價格和退款金額
    price_per_credit = _get_user_purchase_price(db, current_user.id)
    refund_amount = request.credits_amount * price_per_credit * float(PAID_REFUND_RATE)
    
    # 建立退款申請
    refund_request = RefundRequest(
        request_no=_generate_refund_request_no(),
        user_id=current_user.id,
        credits_amount=request.credits_amount,
        price_per_credit=Decimal(str(price_per_credit)),
        refund_rate=PAID_REFUND_RATE,
        refund_amount=Decimal(str(refund_amount)),
        refund_method=request.refund_method,
        bank_code=request.bank_code,
        bank_name=request.bank_name,
        account_number=request.account_number,
        account_name=request.account_name,
        status="pending",
        reason=request.reason,
        ip_address=req.client.host if req.client else None,
        user_agent=req.headers.get("user-agent"),
    )
    
    db.add(refund_request)
    
    # 凍結點數（從 credits_paid 扣除，暫存到申請記錄中）
    current_user.credits_paid = paid_balance - request.credits_amount
    current_user.credits = (current_user.credits or 0) - request.credits_amount
    
    # 記錄交易
    credit_service = CreditService(db)
    credit_service.add_credits(
        user_id=current_user.id,
        amount=-request.credits_amount,
        transaction_type="refund_request",
        credit_category="paid",
        description=f"PAID 退款申請（凍結）: {refund_request.request_no}",
        reference_type="refund_request",
        reference_id=0,  # 稍後更新
        metadata={
            "request_no": refund_request.request_no,
            "refund_amount": float(refund_amount),
            "price_per_credit": price_per_credit,
        },
    )
    
    db.commit()
    db.refresh(refund_request)
    
    return PaidRefundApplyResponse(
        success=True,
        request_no=refund_request.request_no,
        credits_amount=request.credits_amount,
        refund_amount=round(refund_amount, 2),
        status="pending",
        message="退款申請已提交，等待審核"
    )


@router.get("/paid-refund/history")
async def get_paid_refund_history(
    limit: int = Query(default=10, le=50),
    offset: int = Query(default=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    查詢用戶的退款申請記錄
    """
    query = db.query(RefundRequest).filter(
        RefundRequest.user_id == current_user.id
    )
    
    total = query.count()
    refunds = query.order_by(RefundRequest.created_at.desc()).offset(offset).limit(limit).all()
    
    return {
        "success": True,
        "refunds": [
            {
                "id": r.id,
                "request_no": r.request_no,
                "credits_amount": r.credits_amount,
                "price_per_credit": float(r.price_per_credit),
                "refund_rate": float(r.refund_rate),
                "refund_amount": float(r.refund_amount),
                "status": r.status,
                "reason": r.reason,
                "reject_reason": r.reject_reason,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            }
            for r in refunds
        ],
        "total": total,
    }


@router.post("/paid-refund/{request_no}/cancel")
async def cancel_paid_refund(
    request_no: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    取消退款申請（僅限 pending 狀態）
    """
    refund = db.query(RefundRequest).filter(
        RefundRequest.request_no == request_no,
        RefundRequest.user_id == current_user.id
    ).first()
    
    if not refund:
        raise HTTPException(status_code=404, detail="退款申請不存在")
    
    if refund.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"只能取消待審核的申請，目前狀態為：{refund.status}"
        )
    
    # 退還凍結的點數
    current_user.credits_paid = (current_user.credits_paid or 0) + refund.credits_amount
    current_user.credits = (current_user.credits or 0) + refund.credits_amount
    
    # 記錄交易
    credit_service = CreditService(db)
    credit_service.add_credits(
        user_id=current_user.id,
        amount=refund.credits_amount,
        transaction_type="refund_cancelled",
        credit_category="paid",
        description=f"PAID 退款取消（解凍）: {refund.request_no}",
        reference_type="refund_request",
        reference_id=refund.id,
    )
    
    refund.status = "cancelled"
    db.commit()
    
    return {"success": True, "message": "退款申請已取消，點數已退還"}


# ============================================================
# 管理員退款審核 API
# ============================================================

class AdminRefundReviewRequest(BaseModel):
    """管理員審核退款請求"""
    action: str = Field(..., description="approve 或 reject")
    note: str = Field(default="", description="審核備註")
    rejection_reason: str = Field(default="", description="駁回原因")


@router.get("/admin/refunds")
async def admin_list_refunds(
    status: Optional[str] = None,
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    管理員查詢退款申請列表
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    query = db.query(RefundRequest)
    
    if status:
        query = query.filter(RefundRequest.status == status)
    
    total = query.count()
    refunds = query.order_by(RefundRequest.created_at.desc()).offset(offset).limit(limit).all()
    
    result = []
    for r in refunds:
        user = db.query(User).filter(User.id == r.user_id).first()
        result.append({
            "id": r.id,
            "request_no": r.request_no,
            "user_id": r.user_id,
            "user_email": user.email if user else None,
            "user_name": user.full_name if user else None,
            "credits_amount": r.credits_amount,
            "price_per_credit": float(r.price_per_credit),
            "refund_rate": float(r.refund_rate),
            "refund_amount": float(r.refund_amount),
            "refund_method": r.refund_method,
            "bank_code": r.bank_code,
            "bank_name": r.bank_name,
            "account_number": r.account_number[-4:] if r.account_number else None,  # 只顯示後4碼
            "account_name": r.account_name,
            "status": r.status,
            "reason": r.reason,
            "reject_reason": r.reject_reason,
            "review_note": r.review_note,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        })
    
    # 統計
    stats = {
        "pending": db.query(RefundRequest).filter(RefundRequest.status == "pending").count(),
        "approved": db.query(RefundRequest).filter(RefundRequest.status == "approved").count(),
        "processing": db.query(RefundRequest).filter(RefundRequest.status == "processing").count(),
        "completed": db.query(RefundRequest).filter(RefundRequest.status == "completed").count(),
        "rejected": db.query(RefundRequest).filter(RefundRequest.status == "rejected").count(),
    }
    
    return {
        "success": True,
        "refunds": result,
        "total": total,
        "stats": stats,
    }


@router.post("/admin/refunds/{refund_id}/review")
async def admin_review_refund(
    refund_id: int,
    request: AdminRefundReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    管理員審核退款申請
    
    - approve: 批准退款
    - reject: 駁回退款（退還點數給用戶）
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    refund = db.query(RefundRequest).filter(RefundRequest.id == refund_id).first()
    
    if not refund:
        raise HTTPException(status_code=404, detail="退款申請不存在")
    
    if refund.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"只能審核待處理的申請，目前狀態為：{refund.status}"
        )
    
    user = db.query(User).filter(User.id == refund.user_id).first()
    
    if request.action == "approve":
        refund.status = "approved"
        refund.reviewed_by = current_user.id
        refund.reviewed_at = datetime.now(pytz.UTC)
        refund.review_note = request.note
        db.commit()
        return {"success": True, "message": "已批准，等待退款處理"}
    
    elif request.action == "reject":
        if not request.rejection_reason:
            raise HTTPException(status_code=400, detail="駁回需提供原因")
        
        # 退還凍結的點數
        if user:
            user.credits_paid = (user.credits_paid or 0) + refund.credits_amount
            user.credits = (user.credits or 0) + refund.credits_amount
            
            # 記錄交易
            credit_service = CreditService(db)
            credit_service.add_credits(
                user_id=user.id,
                amount=refund.credits_amount,
                transaction_type="refund_rejected",
                credit_category="paid",
                description=f"PAID 退款駁回（解凍）: {refund.request_no}",
                reference_type="refund_request",
                reference_id=refund.id,
            )
        
        refund.status = "rejected"
        refund.reviewed_by = current_user.id
        refund.reviewed_at = datetime.now(pytz.UTC)
        refund.reject_reason = request.rejection_reason
        refund.review_note = request.note
        db.commit()
        
        return {"success": True, "message": "已駁回，點數已退還用戶"}
    
    else:
        raise HTTPException(status_code=400, detail="無效的操作")


@router.post("/admin/refunds/{refund_id}/complete")
async def admin_complete_refund(
    refund_id: int,
    note: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    管理員完成退款（標記為已退款）
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    refund = db.query(RefundRequest).filter(RefundRequest.id == refund_id).first()
    
    if not refund:
        raise HTTPException(status_code=404, detail="退款申請不存在")
    
    if refund.status not in ["approved", "processing"]:
        raise HTTPException(
            status_code=400,
            detail=f"只能完成已批准的申請，目前狀態為：{refund.status}"
        )
    
    refund.status = "completed"
    refund.processed_by = current_user.id
    refund.processed_at = datetime.now(pytz.UTC)
    refund.completed_at = datetime.now(pytz.UTC)
    refund.process_note = note
    db.commit()
    
    return {"success": True, "message": "退款已完成"}
