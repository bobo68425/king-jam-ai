"""
點數帳本服務 (Credit Ledger Service)
確保所有點數操作都有記錄，並防止超支

設計原則：
1. 雙式記帳 - 每筆交易記錄前後餘額
2. 原子性操作 - 使用資料庫交易確保一致性
3. 樂觀鎖 - 防止並發問題
4. 可審計性 - 所有操作都有完整記錄
5. 強一致性 - credit_transactions 與 users 餘額在同一 DB Transaction 中更新

點數類別（按消耗順序）：
- PROMO (優惠點數): 新手任務、行銷活動、補償，7-30天有效，純消耗不可退
- SUB (月費點數): 訂閱方案每月發放，當月有效，月底歸零
- PAID (購買點數): 刷卡儲值，永久有效，可申請退款
- BONUS (獎金點數): 推薦分潤，永久有效，可提領現金（最後扣除）

消耗順序：PROMO -> SUB -> PAID -> BONUS
設計邏輯：BONUS 等同於現金（可提領），最後消耗讓用戶自己決定是累積提領還是用於生成

交易一致性保證：
- 使用 SELECT FOR UPDATE 進行行級鎖定
- 餘額更新和交易記錄在同一個 commit() 中完成
- 使用 begin_nested() 建立 Savepoint 進行細粒度控制
- 任何異常都會完整回滾，不會出現帳務不平的情況
"""

import logging
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple
from enum import Enum
from dataclasses import dataclass, field
from contextlib import contextmanager
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, text
from sqlalchemy.exc import IntegrityError, OperationalError
from decimal import Decimal
import pytz

from app.models import User, CreditTransaction, CreditPricing, GenerationHistory

logger = logging.getLogger(__name__)


# ============================================================
# 交易管理器
# ============================================================

class TransactionManager:
    """
    交易管理器 - 確保點數操作的原子性
    
    提供 Savepoint 支援，可以在單一 DB Transaction 中
    進行多次操作，並在失敗時回滾到特定點
    """
    
    def __init__(self, db: Session):
        self.db = db
        self._savepoint_counter = 0
    
    @contextmanager
    def atomic(self):
        """
        原子性操作上下文管理器
        
        使用方式：
        ```python
        with tx_manager.atomic():
            user.credits = new_balance
            db.add(transaction)
            # 如果這裡發生異常，會自動回滾到 Savepoint
        ```
        """
        self._savepoint_counter += 1
        savepoint_name = f"sp_{self._savepoint_counter}"
        
        try:
            # 建立 Savepoint
            nested = self.db.begin_nested()
            yield nested
            # 成功則提交 Savepoint
            nested.commit()
        except Exception as e:
            # 失敗則回滾到 Savepoint
            if nested.is_active:
                nested.rollback()
            logger.error(f"[TransactionManager] 原子操作失敗，已回滾: {e}")
            raise
    
    def verify_consistency(self, user_id: int) -> bool:
        """
        驗證用戶餘額與交易記錄的一致性
        
        檢查：
        1. User.credits == 最後一筆交易的 balance_after
        2. 各類別餘額總和 == User.credits
        """
        try:
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                return False
            
            # 檢查 1: 與最後交易記錄一致
            last_tx = self.db.query(CreditTransaction).filter(
                CreditTransaction.user_id == user_id
            ).order_by(CreditTransaction.created_at.desc()).first()
            
            if last_tx:
                if user.credits != last_tx.balance_after:
                    logger.error(
                        f"[Consistency] 用戶 #{user_id} 餘額不一致: "
                        f"User.credits={user.credits}, 最後交易餘額={last_tx.balance_after}"
                    )
                    return False
            
            # 檢查 2: 各類別總和一致
            category_total = (
                (user.credits_promo or 0) +
                (user.credits_sub or 0) +
                (user.credits_paid or 0) +
                (user.credits_bonus or 0)
            )
            
            if user.credits != category_total:
                logger.error(
                    f"[Consistency] 用戶 #{user_id} 類別總和不一致: "
                    f"User.credits={user.credits}, 類別總和={category_total}"
                )
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"[Consistency] 驗證失敗: {e}")
            return False


# ============================================================
# 常量定義
# ============================================================

# ============================================================
# 點數匯率設定
# ============================================================
# 
# 購買點數價格（參考）：
#   - starter:    NT$ 0.99/點 (100點=99元)
#   - basic:      NT$ 0.75/點 (330點=249元)
#   - standard:   NT$ 0.64/點 (700點=449元)
#   - pro:        NT$ 0.56/點 (1800點=999元)
#   - enterprise: NT$ 0.46/點 (6500點=2999元)
#
# 平台毛利分析（假設AI成本約0.30元/點）：
#   - starter:    毛利 0.99-0.30 = 0.69元/點 (70%)
#   - basic:      毛利 0.75-0.30 = 0.45元/點 (60%)
#   - standard:   毛利 0.64-0.30 = 0.34元/點 (53%)
#   - pro:        毛利 0.56-0.30 = 0.26元/點 (46%)
#   - enterprise: 毛利 0.46-0.30 = 0.16元/點 (35%)
#
# ============================================================
# 推薦分潤設計原則
# ============================================================
#
# 1. 分潤應基於毛利，而非銷售額
# 2. 分潤比例：毛利的 20-30%（約為銷售額的 5-10%）
# 3. BONUS 點數價值 = 分潤金額（直接以TWD計）
#
# 推薦分潤比例（基於銷售額）：
#   - 銅牌夥伴：3%
#   - 銀牌夥伴：5%
#   - 金牌夥伴：8%
#
# 範例（standard 套餐 NT$449）：
#   - 銅牌分潤：449 × 3% = 13.47 TWD
#   - 平台毛利：449 × 53% - 13.47 = 224.50 TWD（仍有利潤）
#
# ============================================================

# BONUS 獎金點數設定
# 1 BONUS 點 = 1 TWD（分潤直接以TWD計入）
BONUS_EXCHANGE_RATE = Decimal("1.00")  # 1 BONUS 點 = NT$ 1.00

# 提領設定
WITHDRAWAL_EXCHANGE_RATE = Decimal("1.00")  # 提領時 1 BONUS 點 = NT$ 1.00
WITHDRAWAL_MIN_CREDITS = 300  # 最低提領 300 BONUS 點 = NT$ 300
WITHDRAWAL_MIN_TWD = Decimal("300")  # 最低提領金額

# PAID 付費點數退款設定
PAID_REFUND_RATE = Decimal("0.75")  # 退款比例 75%
PAID_DEFAULT_EXCHANGE_RATE = Decimal("0.65")  # 預設購買匯率（基於中間套餐）

# 推薦分潤比例（基於銷售額）
REFERRAL_COMMISSION_RATES = {
    "bronze": Decimal("0.03"),   # 銅牌 3%
    "silver": Decimal("0.05"),   # 銀牌 5%
    "gold": Decimal("0.08"),     # 金牌 8%
}


class CreditCategory(str, Enum):
    """點數類別（按消耗順序）"""
    PROMO = "promo"    # 優惠點數 - 新手任務、行銷活動、補償，短效期
    SUB = "sub"        # 月費點數 - 訂閱方案每月發放，當月有效
    PAID = "paid"      # 購買點數 - 刷卡儲值，永久有效，可退款
    BONUS = "bonus"    # 獎金點數 - 推薦分潤，永久有效，可提領現金


# 消耗順序：優惠 -> 月費 -> 購買 -> 獎金（獎金最後扣，因為可提領現金）
CONSUME_ORDER = [
    CreditCategory.PROMO,
    CreditCategory.SUB,
    CreditCategory.PAID,
    CreditCategory.BONUS,
]


class TransactionType(str, Enum):
    """交易類型"""
    # 增加類型
    INITIAL_GRANT = "initial_grant"           # 註冊贈送 -> promo
    PURCHASE = "purchase"                     # 購買點數 -> paid
    REFERRAL_BONUS = "referral_bonus"         # 推薦獎勵 -> bonus
    REFUND = "refund"                         # 退款 -> 原類別
    ADMIN_ADJUSTMENT = "admin_adjustment"     # 管理員調整
    PROMO_CREDIT = "promo_credit"             # 活動贈送 -> promo
    SUBSCRIPTION_GRANT = "subscription_grant" # 訂閱贈送 -> sub
    MONTHLY_GRANT = "monthly_grant"           # 每月分配 -> sub
    TASK_REWARD = "task_reward"               # 任務獎勵 -> promo
    COMPENSATION = "compensation"             # 補償 -> promo
    
    # 消耗類型
    CONSUME_SOCIAL_IMAGE = "consume_social_image"
    CONSUME_BLOG_POST = "consume_blog_post"
    CONSUME_SHORT_VIDEO = "consume_short_video"
    CONSUME_VEO_VIDEO = "consume_veo_video"
    CONSUME_BACKGROUND_REMOVAL = "consume_background_removal"
    
    # 提領類型
    WITHDRAWAL = "withdrawal"  # 提領 -> 只能從 bonus 扣除


# 交易類型對應的預設點數類別
TRANSACTION_CATEGORY_MAP: Dict[TransactionType, CreditCategory] = {
    TransactionType.INITIAL_GRANT: CreditCategory.PROMO,  # 註冊贈送歸類為優惠點數
    TransactionType.PURCHASE: CreditCategory.PAID,
    TransactionType.REFERRAL_BONUS: CreditCategory.BONUS,
    TransactionType.PROMO_CREDIT: CreditCategory.PROMO,
    TransactionType.SUBSCRIPTION_GRANT: CreditCategory.SUB,
    TransactionType.MONTHLY_GRANT: CreditCategory.SUB,
    TransactionType.TASK_REWARD: CreditCategory.PROMO,
    TransactionType.COMPENSATION: CreditCategory.PROMO,
    TransactionType.WITHDRAWAL: CreditCategory.BONUS,
}


class FeatureCode(str, Enum):
    """功能代碼（對應點數定價，需與資料庫 credit_pricing 一致）"""
    # 社群圖文
    SOCIAL_IMAGE_DRAFT = "social_image_draft"
    SOCIAL_IMAGE_STANDARD = "social_image_standard"
    SOCIAL_IMAGE_PREMIUM = "social_image_premium"
    
    # 部落格文章
    BLOG_POST_BASIC = "blog_post_basic"
    
    # 部落格封面圖
    BLOG_COVER_DRAFT = "blog_cover_draft"
    BLOG_COVER_STANDARD = "blog_cover_standard"
    BLOG_COVER_PREMIUM = "blog_cover_premium"
    
    # 短影片腳本生成
    SCRIPT_15S = "script_15s"
    SCRIPT_30S = "script_30s"
    SCRIPT_60S = "script_60s"
    
    # 標準影片渲染（Imagen + FFmpeg）
    RENDER_STANDARD_15S = "render_standard_15s"
    RENDER_STANDARD_30S = "render_standard_30s"
    RENDER_STANDARD_60S = "render_standard_60s"
    
    # Veo 影片渲染（高成本）
    RENDER_VEO_FAST = "render_veo_fast"
    RENDER_VEO_ULTRA = "render_veo_ultra"


# 預設定價（資料庫未設定時的備用，需與引擎一致）
DEFAULT_PRICING: Dict[str, int] = {
    # 社群圖文
    FeatureCode.SOCIAL_IMAGE_DRAFT: 10,
    FeatureCode.SOCIAL_IMAGE_STANDARD: 20,
    FeatureCode.SOCIAL_IMAGE_PREMIUM: 50,
    
    # 部落格文章
    FeatureCode.BLOG_POST_BASIC: 5,
    
    # 部落格封面圖
    FeatureCode.BLOG_COVER_DRAFT: 5,
    FeatureCode.BLOG_COVER_STANDARD: 10,
    FeatureCode.BLOG_COVER_PREMIUM: 20,
    
    # 短影片腳本
    FeatureCode.SCRIPT_15S: 20,
    FeatureCode.SCRIPT_30S: 30,
    FeatureCode.SCRIPT_60S: 50,
    
    # 標準影片渲染
    FeatureCode.RENDER_STANDARD_15S: 50,
    FeatureCode.RENDER_STANDARD_30S: 80,
    FeatureCode.RENDER_STANDARD_60S: 120,
    
    # Veo 影片渲染
    FeatureCode.RENDER_VEO_FAST: 200,
    FeatureCode.RENDER_VEO_ULTRA: 350,
}


@dataclass
class CategoryBalance:
    """各類別餘額"""
    promo: int = 0     # 優惠點數（短效期）
    sub: int = 0       # 月費點數（當月有效）
    paid: int = 0      # 購買點數（永久、可退款）
    bonus: int = 0     # 獎金點數（永久、可提領）
    available_bonus: int = 0  # 可提領的獎金點數（排除 T+14 冷卻期）
    cooling_bonus: int = 0    # 冷卻期內的獎金點數
    
    @property
    def total(self) -> int:
        return self.promo + self.sub + self.paid + self.bonus
    
    @property
    def withdrawable(self) -> int:
        """可提領金額（只有超過冷卻期的 BONUS 可提領）"""
        return self.available_bonus
    
    @property
    def withdrawable_twd(self) -> Decimal:
        """可提領金額（TWD）"""
        return Decimal(self.available_bonus) * WITHDRAWAL_EXCHANGE_RATE
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "promo": self.promo,
            "sub": self.sub,
            "paid": self.paid,
            "bonus": self.bonus,
            "available_bonus": self.available_bonus,
            "cooling_bonus": self.cooling_bonus,
            "total": self.total,
            "withdrawable": self.withdrawable,
            "withdrawable_twd": float(self.withdrawable_twd),
        }


@dataclass
class CreditResult:
    """點數操作結果"""
    success: bool
    balance: int = 0
    category_balance: Optional[CategoryBalance] = None
    transaction_id: Optional[int] = None
    consumed_from: Optional[Dict[str, int]] = None  # 從各類別消耗的數量
    error: Optional[str] = None
    error_code: Optional[str] = None


# ============================================================
# 點數服務類
# ============================================================

class CreditService:
    """
    點數帳本服務
    
    使用方式：
    ```python
    credit_service = CreditService(db)
    
    # 查看分類餘額
    balance = credit_service.get_category_balance(user_id)
    print(f"可提領: {balance.withdrawable} 點 = NT${balance.withdrawable_twd}")
    
    # 消耗點數（自動按順序從各類別扣除）
    result = credit_service.consume(
        user_id=user_id,
        feature_code=FeatureCode.VEO_VIDEO_15S,
    )
    print(f"消耗來源: {result.consumed_from}")
    ```
    """
    
    def __init__(self, db: Session):
        self.db = db
        self._pricing_cache: Dict[str, int] = {}
    
    # ==================== 查詢方法 ====================
    
    def get_balance(self, user_id: int) -> int:
        """取得用戶總點數餘額"""
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return 0
        return user.credits or 0
    
    def get_category_balance(self, user_id: int) -> CategoryBalance:
        """取得各類別點數餘額（含 T+14 冷卻期計算）"""
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return CategoryBalance()
        
        bonus_total = user.credits_bonus or 0
        
        # 計算可提領的 BONUS（排除冷卻期內的點數）
        available_bonus, cooling_bonus = self._calculate_available_bonus(user_id, bonus_total)
        
        return CategoryBalance(
            promo=user.credits_promo or 0,
            sub=user.credits_sub or 0,
            paid=user.credits_paid or 0,
            bonus=bonus_total,
            available_bonus=available_bonus,
            cooling_bonus=cooling_bonus,
        )
    
    def _calculate_available_bonus(self, user_id: int, bonus_total: int) -> Tuple[int, int]:
        """
        計算可提領的 BONUS 點數（排除 T+14 冷卻期）
        
        Returns:
            (available_bonus, cooling_bonus)
        """
        from datetime import datetime
        now = datetime.utcnow()
        
        # 查詢冷卻期內的 BONUS 點數（available_at > now）
        cooling_sum = self.db.query(
            func.coalesce(func.sum(CreditTransaction.amount), 0)
        ).filter(
            CreditTransaction.user_id == user_id,
            CreditTransaction.credit_category == CreditCategory.BONUS.value,
            CreditTransaction.amount > 0,  # 只計算增加的（獲得的獎金）
            CreditTransaction.available_at.isnot(None),
            CreditTransaction.available_at > now,
        ).scalar() or 0
        
        cooling_bonus = int(cooling_sum)
        available_bonus = max(0, bonus_total - cooling_bonus)
        
        return available_bonus, cooling_bonus
    
    def _get_cooling_period_days(self) -> int:
        """
        獲取 BONUS 提領冷卻期天數
        
        從 WithdrawalConfig 表讀取設定，預設 14 天
        配合信用卡退款週期（T+14）
        """
        from app.models import WithdrawalConfig
        
        config = self.db.query(WithdrawalConfig).filter(
            WithdrawalConfig.is_active == True
        ).first()
        
        if config and config.cooling_period_days is not None:
            return config.cooling_period_days
        
        # 預設 14 天
        return 14
    
    def get_verified_balance(self, user_id: int) -> Tuple[int, bool]:
        """取得並驗證點數餘額"""
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return (0, True)
        
        # 取得最後一筆交易
        last_tx = self.db.query(CreditTransaction).filter(
            CreditTransaction.user_id == user_id
        ).order_by(CreditTransaction.created_at.desc()).first()
        
        if not last_tx:
            return (user.credits or 0, True)
        
        is_consistent = (user.credits == last_tx.balance_after)
        
        if not is_consistent:
            logger.warning(
                f"[Credit] 餘額不一致！用戶 #{user_id}: "
                f"User.credits={user.credits}, 最後交易餘額={last_tx.balance_after}"
            )
        
        return (user.credits or 0, is_consistent)
    
    def check_balance(self, user_id: int, feature_code: FeatureCode) -> bool:
        """檢查餘額是否足夠使用某功能"""
        cost = self.get_feature_cost(feature_code)
        balance = self.get_balance(user_id)
        return balance >= cost
    
    def get_feature_cost(self, feature_code: FeatureCode, user_tier: str = "free") -> int:
        """取得功能的點數消耗"""
        cache_key = f"{feature_code}_{user_tier}"
        
        if cache_key in self._pricing_cache:
            return self._pricing_cache[cache_key]
        
        pricing = self.db.query(CreditPricing).filter(
            CreditPricing.feature_code == feature_code,
            CreditPricing.is_active == True,
            (CreditPricing.tier == user_tier) | (CreditPricing.tier.is_(None))
        ).order_by(CreditPricing.tier.desc().nullslast()).first()
        
        if pricing:
            cost = pricing.credits_cost
        else:
            cost = DEFAULT_PRICING.get(feature_code, 10)
        
        self._pricing_cache[cache_key] = cost
        return cost
    
    def get_transaction_history(
        self,
        user_id: int,
        limit: int = 50,
        offset: int = 0,
        transaction_type: Optional[str] = None,
        credit_category: Optional[str] = None
    ) -> List[CreditTransaction]:
        """取得交易歷史"""
        query = self.db.query(CreditTransaction).filter(
            CreditTransaction.user_id == user_id
        )
        
        if transaction_type:
            query = query.filter(CreditTransaction.transaction_type == transaction_type)
        if credit_category:
            query = query.filter(CreditTransaction.credit_category == credit_category)
        
        return query.order_by(
            CreditTransaction.created_at.desc()
        ).offset(offset).limit(limit).all()
    
    def get_usage_stats(
        self,
        user_id: int,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """取得點數使用統計"""
        query = self.db.query(
            CreditTransaction.transaction_type,
            CreditTransaction.credit_category,
            func.count(CreditTransaction.id).label("count"),
            func.sum(CreditTransaction.amount).label("total_amount")
        ).filter(
            CreditTransaction.user_id == user_id
        )
        
        if start_date:
            query = query.filter(CreditTransaction.created_at >= start_date)
        if end_date:
            query = query.filter(CreditTransaction.created_at <= end_date)
        
        results = query.group_by(
            CreditTransaction.transaction_type,
            CreditTransaction.credit_category
        ).all()
        
        stats = {
            "total_earned": 0,
            "total_spent": 0,
            "by_type": {},
            "by_category": {
                "promo": {"earned": 0, "spent": 0},
                "sub": {"earned": 0, "spent": 0},
                "paid": {"earned": 0, "spent": 0},
                "bonus": {"earned": 0, "spent": 0},
            }
        }
        
        for tx_type, category, count, total in results:
            amount = total or 0
            
            if tx_type not in stats["by_type"]:
                stats["by_type"][tx_type] = {"count": 0, "amount": 0}
            stats["by_type"][tx_type]["count"] += count
            stats["by_type"][tx_type]["amount"] += amount
            
            if category in stats["by_category"]:
                if amount > 0:
                    stats["by_category"][category]["earned"] += amount
                    stats["total_earned"] += amount
                else:
                    stats["by_category"][category]["spent"] += abs(amount)
                    stats["total_spent"] += abs(amount)
        
        return stats
    
    # ==================== 點數增加 ====================
    
    def grant(
        self,
        user_id: int,
        amount: int,
        transaction_type: TransactionType,
        credit_category: Optional[CreditCategory] = None,
        description: str = "",
        reference_type: Optional[str] = None,
        reference_id: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None
    ) -> CreditResult:
        """
        增加點數
        
        Args:
            user_id: 用戶 ID
            amount: 增加的點數（必須為正數）
            transaction_type: 交易類型
            credit_category: 點數類別（若未指定則根據交易類型自動決定）
            description: 描述
            reference_type: 關聯資源類型
            reference_id: 關聯資源 ID
            metadata: 額外資訊
            ip_address: IP 位址
        """
        if amount <= 0:
            return CreditResult(
                success=False,
                error="增加的點數必須為正數",
                error_code="INVALID_AMOUNT"
            )
        
        # 決定點數類別
        if credit_category is None:
            credit_category = TRANSACTION_CATEGORY_MAP.get(
                transaction_type, 
                CreditCategory.PAID
            )
        
        return self._execute_grant(
            user_id=user_id,
            amount=amount,
            transaction_type=transaction_type,
            credit_category=credit_category,
            description=description,
            reference_type=reference_type,
            reference_id=reference_id,
            metadata=metadata,
            ip_address=ip_address
        )
    
    def grant_initial(
        self,
        user_id: int,
        amount: int = 100,
        ip_address: Optional[str] = None
    ) -> CreditResult:
        """贈送註冊初始點數（歸類為優惠點數，有時效性）"""
        return self.grant(
            user_id=user_id,
            amount=amount,
            transaction_type=TransactionType.INITIAL_GRANT,
            credit_category=CreditCategory.PROMO,
            description="註冊贈送點數（30天有效）",
            metadata={"expires_in_days": 30},
            ip_address=ip_address
        )
    
    def grant_referral_bonus(
        self,
        user_id: int,
        amount: int = 50,
        referrer_code: str = "",
        ip_address: Optional[str] = None
    ) -> CreditResult:
        """贈送推薦獎勵點數（歸類為獎金點數，可提領）"""
        return self.grant(
            user_id=user_id,
            amount=amount,
            transaction_type=TransactionType.REFERRAL_BONUS,
            credit_category=CreditCategory.BONUS,
            description=f"推薦獎勵（推薦碼：{referrer_code}）",
            metadata={"referrer_code": referrer_code},
            ip_address=ip_address
        )
    
    def grant_subscription(
        self,
        user_id: int,
        amount: int,
        subscription_id: Optional[int] = None,
        ip_address: Optional[str] = None
    ) -> CreditResult:
        """發放訂閱月費點數（當月有效）"""
        return self.grant(
            user_id=user_id,
            amount=amount,
            transaction_type=TransactionType.SUBSCRIPTION_GRANT,
            credit_category=CreditCategory.SUB,
            description="訂閱方案每月點數",
            reference_type="subscription" if subscription_id else None,
            reference_id=subscription_id,
            ip_address=ip_address
        )
    
    def grant_purchase(
        self,
        user_id: int,
        amount: int,
        order_id: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> CreditResult:
        """購買點數（永久有效，可退款）"""
        return self.grant(
            user_id=user_id,
            amount=amount,
            transaction_type=TransactionType.PURCHASE,
            credit_category=CreditCategory.PAID,
            description=f"購買點數" + (f"（訂單：{order_id}）" if order_id else ""),
            metadata={"order_id": order_id} if order_id else None,
            ip_address=ip_address
        )
    
    def grant_promo(
        self,
        user_id: int,
        amount: int,
        promo_code: Optional[str] = None,
        campaign: Optional[str] = None,
        expires_in_days: int = 30,
        ip_address: Optional[str] = None
    ) -> CreditResult:
        """發放優惠點數（短效期，純消耗不可退）"""
        desc = "優惠點數"
        if promo_code:
            desc += f"（兌換碼：{promo_code}）"
        elif campaign:
            desc += f"（活動：{campaign}）"
        
        return self.grant(
            user_id=user_id,
            amount=amount,
            transaction_type=TransactionType.PROMO_CREDIT,
            credit_category=CreditCategory.PROMO,
            description=desc,
            metadata={
                "promo_code": promo_code, 
                "campaign": campaign,
                "expires_in_days": expires_in_days,
            },
            ip_address=ip_address
        )
    
    # ==================== 點數消耗 ====================
    
    def consume(
        self,
        user_id: int,
        feature_code: FeatureCode,
        description: str = "",
        reference_type: Optional[str] = None,
        reference_id: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None
    ) -> CreditResult:
        """
        消耗點數
        
        按照優先順序從各類別扣除：PROMO -> SUB -> PAID -> BONUS
        BONUS 最後扣，因為 BONUS 等同於現金（可提領）
        """
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return CreditResult(
                success=False,
                error="用戶不存在",
                error_code="USER_NOT_FOUND"
            )
        
        cost = self.get_feature_cost(feature_code, user.tier)
        
        # 檢查總餘額
        total_balance = (
            (user.credits_promo or 0) +
            (user.credits_sub or 0) +
            (user.credits_paid or 0) +
            (user.credits_bonus or 0)
        )
        
        if total_balance < cost:
            return CreditResult(
                success=False,
                balance=total_balance,
                error=f"點數不足（需要 {cost}，目前 {total_balance}）",
                error_code="INSUFFICIENT_CREDITS"
            )
        
        # 決定交易類型
        tx_type_map = {
            FeatureCode.SOCIAL_IMAGE_BASIC: TransactionType.CONSUME_SOCIAL_IMAGE,
            FeatureCode.SOCIAL_IMAGE_PREMIUM: TransactionType.CONSUME_SOCIAL_IMAGE,
            FeatureCode.BLOG_POST_BASIC: TransactionType.CONSUME_BLOG_POST,
            FeatureCode.BLOG_POST_PREMIUM: TransactionType.CONSUME_BLOG_POST,
            FeatureCode.SHORT_VIDEO_BASIC: TransactionType.CONSUME_SHORT_VIDEO,
            FeatureCode.SHORT_VIDEO_PREMIUM: TransactionType.CONSUME_SHORT_VIDEO,
            FeatureCode.VEO_VIDEO_8S: TransactionType.CONSUME_VEO_VIDEO,
            FeatureCode.VEO_VIDEO_15S: TransactionType.CONSUME_VEO_VIDEO,
            FeatureCode.VEO_VIDEO_30S: TransactionType.CONSUME_VEO_VIDEO,
        }
        
        transaction_type = tx_type_map.get(feature_code, TransactionType.CONSUME_SOCIAL_IMAGE)
        
        return self._execute_consume(
            user_id=user_id,
            cost=cost,
            transaction_type=transaction_type,
            description=description or f"使用 {feature_code}",
            reference_type=reference_type,
            reference_id=reference_id,
            metadata={
                "feature_code": feature_code,
                "cost": cost,
                **(metadata or {})
            },
            ip_address=ip_address
        )
    
    def consume_direct(
        self,
        user_id: int,
        cost: int,
        transaction_type: TransactionType,
        description: str = "",
        reference_type: Optional[str] = None,
        reference_id: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None
    ) -> CreditResult:
        """
        直接扣除指定金額的點數（不依賴 FeatureCode）
        
        適用於有自訂價格表的功能（如影片腳本生成、影片渲染）
        按照優先順序從各類別扣除：PROMO -> SUB -> PAID -> BONUS
        
        Args:
            user_id: 用戶 ID
            cost: 扣除的點數
            transaction_type: 交易類型
            description: 描述
            reference_type: 關聯資源類型
            reference_id: 關聯資源 ID
            metadata: 額外資訊
            ip_address: IP 位址
        """
        if cost <= 0:
            return CreditResult(
                success=False,
                error="扣除金額必須為正數",
                error_code="INVALID_AMOUNT"
            )
        
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return CreditResult(
                success=False,
                error="用戶不存在",
                error_code="USER_NOT_FOUND"
            )
        
        # 檢查總餘額
        total_balance = (
            (user.credits_promo or 0) +
            (user.credits_sub or 0) +
            (user.credits_paid or 0) +
            (user.credits_bonus or 0)
        )
        
        if total_balance < cost:
            return CreditResult(
                success=False,
                balance=total_balance,
                error=f"點數不足（需要 {cost}，目前 {total_balance}）",
                error_code="INSUFFICIENT_CREDITS"
            )
        
        return self._execute_consume(
            user_id=user_id,
            cost=cost,
            transaction_type=transaction_type,
            description=description,
            reference_type=reference_type,
            reference_id=reference_id,
            metadata=metadata,
            ip_address=ip_address
        )
    
    # ==================== 提領功能 ====================
    
    def check_withdrawal_eligibility(self, user_id: int) -> Dict[str, Any]:
        """檢查提領資格"""
        category_balance = self.get_category_balance(user_id)
        
        return {
            "eligible": category_balance.bonus >= WITHDRAWAL_MIN_CREDITS,
            "bonus_balance": category_balance.bonus,
            "min_credits": WITHDRAWAL_MIN_CREDITS,
            "exchange_rate": float(WITHDRAWAL_EXCHANGE_RATE),
            "withdrawable_twd": float(category_balance.withdrawable_twd),
            "min_twd": float(WITHDRAWAL_MIN_TWD),
        }
    
    def deduct_for_withdrawal(
        self,
        user_id: int,
        credits_amount: int,
        withdrawal_request_id: int,
        ip_address: Optional[str] = None
    ) -> CreditResult:
        """
        為提領扣除獎金點數
        
        只能從 BONUS 類別扣除
        """
        if credits_amount < WITHDRAWAL_MIN_CREDITS:
            return CreditResult(
                success=False,
                error=f"提領最低門檻為 {WITHDRAWAL_MIN_CREDITS} 點",
                error_code="BELOW_MINIMUM"
            )
        
        return self._execute_consume_from_category(
            user_id=user_id,
            amount=credits_amount,
            credit_category=CreditCategory.BONUS,
            transaction_type=TransactionType.WITHDRAWAL,
            description=f"獎金提領（申請編號：{withdrawal_request_id}）",
            reference_type="withdrawal_request",
            reference_id=withdrawal_request_id,
            metadata={
                "amount_twd": float(Decimal(credits_amount) * WITHDRAWAL_EXCHANGE_RATE),
            },
            ip_address=ip_address
        )
    
    def refund_withdrawal(
        self,
        user_id: int,
        credits_amount: int,
        withdrawal_request_id: int,
        reason: str = "提領取消退還",
        ip_address: Optional[str] = None
    ) -> CreditResult:
        """退還提領的獎金點數（取消或駁回時）"""
        return self.grant(
            user_id=user_id,
            amount=credits_amount,
            transaction_type=TransactionType.REFUND,
            credit_category=CreditCategory.BONUS,
            description=reason,
            reference_type="withdrawal_request",
            reference_id=withdrawal_request_id,
            ip_address=ip_address
        )
    
    # ==================== 管理功能 ====================
    
    def admin_adjust(
        self,
        user_id: int,
        amount: int,
        credit_category: CreditCategory,
        reason: str,
        admin_user_id: int,
        ip_address: Optional[str] = None
    ) -> CreditResult:
        """管理員調整點數"""
        if amount == 0:
            return CreditResult(
                success=False,
                error="調整金額不可為 0",
                error_code="INVALID_AMOUNT"
            )
        
        if amount > 0:
            return self.grant(
                user_id=user_id,
                amount=amount,
                transaction_type=TransactionType.ADMIN_ADJUSTMENT,
                credit_category=credit_category,
                description=reason,
                metadata={"admin_user_id": admin_user_id, "reason": reason},
                ip_address=ip_address
            )
        else:
            # 從指定類別扣除
            return self._execute_consume_from_category(
                user_id=user_id,
                amount=abs(amount),
                credit_category=credit_category,
                transaction_type=TransactionType.ADMIN_ADJUSTMENT,
                description=reason,
                metadata={"admin_user_id": admin_user_id, "reason": reason},
                ip_address=ip_address
            )
    
    def refund(
        self,
        user_id: int,
        amount: int,
        credit_category: CreditCategory,
        original_transaction_id: int,
        reason: str = "退款",
        ip_address: Optional[str] = None
    ) -> CreditResult:
        """點數退款"""
        if amount <= 0:
            return CreditResult(
                success=False,
                error="退款金額必須為正數",
                error_code="INVALID_AMOUNT"
            )
        
        return self.grant(
            user_id=user_id,
            amount=amount,
            transaction_type=TransactionType.REFUND,
            credit_category=credit_category,
            description=reason,
            reference_type="credit_transaction",
            reference_id=original_transaction_id,
            metadata={"original_transaction_id": original_transaction_id},
            ip_address=ip_address
        )
    
    # ==================== 月底歸零功能 ====================
    
    def expire_sub_credits(self, user_id: int) -> CreditResult:
        """
        月費點數歸零（每月底執行）
        
        SUB 類別的點數當月有效，月底自動歸零
        """
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return CreditResult(success=False, error="用戶不存在")
        
        sub_balance = user.credits_sub or 0
        if sub_balance <= 0:
            return CreditResult(success=True, balance=user.credits or 0)
        
        return self._execute_consume_from_category(
            user_id=user_id,
            amount=sub_balance,
            credit_category=CreditCategory.SUB,
            transaction_type=TransactionType.ADMIN_ADJUSTMENT,
            description="月費點數到期歸零",
            metadata={"reason": "monthly_expiration"},
        )
    
    # ==================== 核心交易方法 ====================
    
    def _execute_grant(
        self,
        user_id: int,
        amount: int,
        transaction_type: TransactionType,
        credit_category: CreditCategory,
        description: str = "",
        reference_type: Optional[str] = None,
        reference_id: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None
    ) -> CreditResult:
        """
        執行點數增加
        
        🔒 交易原子性保證：
        1. 使用 SELECT FOR UPDATE 鎖定用戶記錄
        2. 在同一個 DB Transaction 中更新餘額和建立交易記錄
        3. 只有一次 commit()，確保全部成功或全部回滾
        4. 任何異常都會回滾整個交易
        """
        transaction = None
        
        try:
            # 🔒 Step 1: 使用行級鎖鎖定用戶記錄，防止並發
            user = self.db.query(User).filter(
                User.id == user_id
            ).with_for_update(nowait=False).first()
            
            if not user:
                return CreditResult(
                    success=False,
                    error="用戶不存在",
                    error_code="USER_NOT_FOUND"
                )
            
            # Step 2: 計算新餘額
            current_balance = user.credits or 0
            new_balance = current_balance + amount
            
            # Step 3: 計算新的類別餘額
            new_category_balance = {
                "promo": user.credits_promo or 0,
                "sub": user.credits_sub or 0,
                "paid": user.credits_paid or 0,
                "bonus": user.credits_bonus or 0,
            }
            new_category_balance[credit_category.value] += amount
            
            # 🔒 Step 4: 原子操作 - 同時更新餘額和建立交易記錄
            # 更新總餘額
            user.credits = new_balance
            
            # 更新類別餘額
            user.credits_promo = new_category_balance["promo"]
            user.credits_sub = new_category_balance["sub"]
            user.credits_paid = new_category_balance["paid"]
            user.credits_bonus = new_category_balance["bonus"]
            
            # 計算可提領時間（T+14 冷卻期，僅適用於 BONUS）
            available_at = None
            if credit_category == CreditCategory.BONUS:
                from datetime import datetime, timedelta
                # 獲取冷卻期設定（預設 14 天）
                cooling_days = self._get_cooling_period_days()
                available_at = datetime.utcnow() + timedelta(days=cooling_days)
            
            # 建立交易記錄（包含 balance_before 和 balance_after 用於審計）
            transaction = CreditTransaction(
                user_id=user_id,
                credit_category=credit_category.value,
                transaction_type=transaction_type.value,
                amount=amount,
                balance_before=current_balance,
                balance_after=new_balance,
                reference_type=reference_type,
                reference_id=reference_id,
                description=description,
                extra_data={
                    **(metadata or {}),
                    "category_balance_after": new_category_balance,
                    "cooling_period_days": cooling_days if available_at else None,
                },
                ip_address=ip_address,
                available_at=available_at,  # T+14 冷卻期
            )
            self.db.add(transaction)
            
            # 🔒 Step 5: 一次性提交 - 確保原子性
            # 如果 commit 失敗，所有更改都會回滾
            self.db.commit()
            self.db.refresh(transaction)
            
            # Step 6: 驗證一致性（可選，用於除錯）
            if logger.isEnabledFor(logging.DEBUG):
                tx_manager = TransactionManager(self.db)
                if not tx_manager.verify_consistency(user_id):
                    logger.warning(f"[Credit] ⚠️ 用戶 #{user_id} 一致性驗證失敗")
            
            category_balance = CategoryBalance(
                promo=new_category_balance["promo"],
                sub=new_category_balance["sub"],
                paid=new_category_balance["paid"],
                bonus=new_category_balance["bonus"],
            )
            
            logger.info(
                f"[Credit] ✅ 增加成功：用戶 #{user_id}, "
                f"類別={credit_category.value}, 金額=+{amount}, "
                f"餘額 {current_balance} -> {new_balance}, "
                f"交易ID={transaction.id}"
            )
            
            return CreditResult(
                success=True,
                balance=new_balance,
                category_balance=category_balance,
                transaction_id=transaction.id
            )
            
        except OperationalError as e:
            # 🔒 鎖等待超時或死鎖
            self.db.rollback()
            logger.error(f"[Credit] ❌ 交易失敗（鎖衝突）: {e}")
            return CreditResult(
                success=False,
                error="系統繁忙，請稍後再試",
                error_code="LOCK_CONFLICT"
            )
        except IntegrityError as e:
            # 🔒 資料完整性錯誤
            self.db.rollback()
            logger.error(f"[Credit] ❌ 交易失敗（資料庫錯誤）: {e}")
            return CreditResult(
                success=False,
                error="交易失敗，請稍後再試",
                error_code="DB_ERROR"
            )
        except Exception as e:
            # 🔒 任何其他錯誤都回滾
            self.db.rollback()
            logger.error(f"[Credit] ❌ 交易失敗: {e}")
            return CreditResult(
                success=False,
                error=str(e),
                error_code="UNKNOWN_ERROR"
            )
    
    def _execute_consume(
        self,
        user_id: int,
        cost: int,
        transaction_type: TransactionType,
        description: str = "",
        reference_type: Optional[str] = None,
        reference_id: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None
    ) -> CreditResult:
        """
        執行點數消耗
        按順序從各類別扣除：PROMO -> SUB -> PAID -> BONUS
        BONUS 最後扣，因為 BONUS 等同於現金（可提領）
        
        🔒 交易原子性保證：
        1. 使用 SELECT FOR UPDATE 鎖定用戶記錄
        2. 先計算扣除計劃，再一次性執行
        3. 餘額更新和交易記錄在同一個 commit() 中完成
        4. 使用 balance_before/balance_after 確保可審計
        """
        transaction = None
        
        try:
            # 🔒 Step 1: 使用行級鎖鎖定用戶記錄
            user = self.db.query(User).filter(
                User.id == user_id
            ).with_for_update(nowait=False).first()
            
            if not user:
                return CreditResult(
                    success=False,
                    error="用戶不存在",
                    error_code="USER_NOT_FOUND"
                )
            
            current_balance = user.credits or 0
            
            # Step 2: 先計算扣除計劃（不實際修改）
            remaining = cost
            consumed_from: Dict[str, int] = {}
            
            category_balances = {
                CreditCategory.PROMO: user.credits_promo or 0,
                CreditCategory.SUB: user.credits_sub or 0,
                CreditCategory.PAID: user.credits_paid or 0,
                CreditCategory.BONUS: user.credits_bonus or 0,
            }
            
            new_category_balances = category_balances.copy()
            
            for category in CONSUME_ORDER:
                if remaining <= 0:
                    break
                
                available = new_category_balances[category]
                
                if available > 0:
                    to_consume = min(available, remaining)
                    consumed_from[category.value] = to_consume
                    new_category_balances[category] = available - to_consume
                    remaining -= to_consume
            
            # Step 3: 檢查是否有足夠餘額
            if remaining > 0:
                # 不需要回滾，因為還沒有任何修改
                return CreditResult(
                    success=False,
                    balance=current_balance,
                    error=f"點數不足（需要 {cost}，目前 {current_balance}）",
                    error_code="INSUFFICIENT_CREDITS"
                )
            
            # Step 4: 計算新餘額
            new_balance = current_balance - cost
            
            # 🔒 Step 5: 原子操作 - 同時更新所有餘額和建立交易記錄
            # 更新總餘額
            user.credits = new_balance
            
            # 更新各類別餘額
            user.credits_promo = new_category_balances[CreditCategory.PROMO]
            user.credits_sub = new_category_balances[CreditCategory.SUB]
            user.credits_paid = new_category_balances[CreditCategory.PAID]
            user.credits_bonus = new_category_balances[CreditCategory.BONUS]
            
            # 決定主要消耗的類別（消耗最多的那個）
            main_category = max(consumed_from.keys(), key=lambda k: consumed_from[k]) if consumed_from else "paid"
            
            # 建立交易記錄
            transaction = CreditTransaction(
                user_id=user_id,
                credit_category=main_category,
                transaction_type=transaction_type.value,
                amount=-cost,
                balance_before=current_balance,
                balance_after=new_balance,
                reference_type=reference_type,
                reference_id=reference_id,
                description=description,
                extra_data={
                    **(metadata or {}),
                    "consumed_from": consumed_from,
                    "category_balance_before": {k.value: v for k, v in category_balances.items()},
                    "category_balance_after": {k.value: v for k, v in new_category_balances.items()},
                },
                ip_address=ip_address
            )
            self.db.add(transaction)
            
            # 🔒 Step 6: 一次性提交 - 確保原子性
            self.db.commit()
            self.db.refresh(transaction)
            
            category_balance = CategoryBalance(
                promo=new_category_balances[CreditCategory.PROMO],
                sub=new_category_balances[CreditCategory.SUB],
                paid=new_category_balances[CreditCategory.PAID],
                bonus=new_category_balances[CreditCategory.BONUS],
            )
            
            logger.info(
                f"[Credit] ✅ 消耗成功：用戶 #{user_id}, "
                f"金額=-{cost}, 來源={consumed_from}, "
                f"餘額 {current_balance} -> {new_balance}, "
                f"交易ID={transaction.id}"
            )
            
            # 檢查是否需要發送低餘額提醒
            self._check_low_balance_alert(user_id, new_balance)
            
            return CreditResult(
                success=True,
                balance=new_balance,
                category_balance=category_balance,
                transaction_id=transaction.id,
                consumed_from=consumed_from
            )
            
        except OperationalError as e:
            # 🔒 鎖等待超時或死鎖
            self.db.rollback()
            logger.error(f"[Credit] ❌ 消耗失敗（鎖衝突）: {e}")
            return CreditResult(
                success=False,
                error="系統繁忙，請稍後再試",
                error_code="LOCK_CONFLICT"
            )
        except IntegrityError as e:
            # 🔒 資料完整性錯誤
            self.db.rollback()
            logger.error(f"[Credit] ❌ 消耗失敗（資料庫錯誤）: {e}")
            return CreditResult(
                success=False,
                error="交易失敗，請稍後再試",
                error_code="DB_ERROR"
            )
        except Exception as e:
            # 🔒 任何其他錯誤都回滾
            self.db.rollback()
            logger.error(f"[Credit] ❌ 消耗失敗: {e}")
            return CreditResult(
                success=False,
                error=str(e),
                error_code="UNKNOWN_ERROR"
            )
    
    def _execute_consume_from_category(
        self,
        user_id: int,
        amount: int,
        credit_category: CreditCategory,
        transaction_type: TransactionType,
        description: str = "",
        reference_type: Optional[str] = None,
        reference_id: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None
    ) -> CreditResult:
        """
        從指定類別扣除點數
        
        🔒 交易原子性保證：
        與 _execute_consume 相同的原子性設計
        """
        transaction = None
        
        try:
            # 🔒 Step 1: 使用行級鎖鎖定用戶記錄
            user = self.db.query(User).filter(
                User.id == user_id
            ).with_for_update(nowait=False).first()
            
            if not user:
                return CreditResult(
                    success=False,
                    error="用戶不存在",
                    error_code="USER_NOT_FOUND"
                )
            
            category_fields = {
                CreditCategory.PROMO: "credits_promo",
                CreditCategory.SUB: "credits_sub",
                CreditCategory.PAID: "credits_paid",
                CreditCategory.BONUS: "credits_bonus",
            }
            
            field_name = category_fields[credit_category]
            available = getattr(user, field_name) or 0
            
            # Step 2: 檢查類別餘額
            if available < amount:
                return CreditResult(
                    success=False,
                    error=f"{credit_category.value} 類別點數不足（需要 {amount}，目前 {available}）",
                    error_code="INSUFFICIENT_CREDITS"
                )
            
            current_balance = user.credits or 0
            new_balance = current_balance - amount
            new_category_balance = available - amount
            
            # 🔒 Step 3: 原子操作 - 同時更新餘額和建立交易記錄
            # 更新總餘額
            user.credits = new_balance
            setattr(user, field_name, new_category_balance)
            
            # 建立交易記錄
            transaction = CreditTransaction(
                user_id=user_id,
                credit_category=credit_category.value,
                transaction_type=transaction_type.value,
                amount=-amount,
                balance_before=current_balance,
                balance_after=new_balance,
                reference_type=reference_type,
                reference_id=reference_id,
                description=description,
                extra_data={
                    **(metadata or {}),
                    "category_balance_before": available,
                    "category_balance_after": new_category_balance,
                },
                ip_address=ip_address
            )
            self.db.add(transaction)
            
            # 🔒 Step 4: 一次性提交
            self.db.commit()
            self.db.refresh(transaction)
            
            category_balance = self.get_category_balance(user_id)
            
            logger.info(
                f"[Credit] ✅ 類別扣除成功：用戶 #{user_id}, "
                f"類別={credit_category.value}, 金額=-{amount}, "
                f"餘額 {current_balance} -> {new_balance}, "
                f"交易ID={transaction.id}"
            )
            
            return CreditResult(
                success=True,
                balance=new_balance,
                category_balance=category_balance,
                transaction_id=transaction.id,
                consumed_from={credit_category.value: amount}
            )
            
        except OperationalError as e:
            self.db.rollback()
            logger.error(f"[Credit] ❌ 類別扣除失敗（鎖衝突）: {e}")
            return CreditResult(
                success=False,
                error="系統繁忙，請稍後再試",
                error_code="LOCK_CONFLICT"
            )
        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"[Credit] ❌ 類別扣除失敗（資料庫錯誤）: {e}")
            return CreditResult(
                success=False,
                error="交易失敗，請稍後再試",
                error_code="DB_ERROR"
            )
        except Exception as e:
            self.db.rollback()
            logger.error(f"[Credit] ❌ 類別扣除失敗: {e}")
            return CreditResult(
                success=False,
                error=str(e),
                error_code="UNKNOWN_ERROR"
            )
    
    # ==================== 工具方法 ====================
    
    def sync_balance_from_transactions(self, user_id: int) -> CreditResult:
        """從交易記錄重新計算餘額"""
        try:
            # 按類別計算總和
            results = self.db.query(
                CreditTransaction.credit_category,
                func.sum(CreditTransaction.amount).label("total")
            ).filter(
                CreditTransaction.user_id == user_id
            ).group_by(CreditTransaction.credit_category).all()
            
            category_totals = {r.credit_category: r.total or 0 for r in results}
            
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                return CreditResult(
                    success=False,
                    error="用戶不存在",
                    error_code="USER_NOT_FOUND"
                )
            
            # 更新各類別餘額
            user.credits_promo = max(0, category_totals.get("promo", 0))
            user.credits_sub = max(0, category_totals.get("sub", 0))
            user.credits_paid = max(0, category_totals.get("paid", 0))
            user.credits_bonus = max(0, category_totals.get("bonus", 0))
            
            # 更新總餘額
            total = (
                user.credits_promo +
                user.credits_sub +
                user.credits_paid +
                user.credits_bonus
            )
            user.credits = total
            
            self.db.commit()
            
            logger.info(f"[Credit] 餘額同步完成：用戶 #{user_id}, 總計={total}")
            
            return CreditResult(
                success=True,
                balance=total,
                category_balance=self.get_category_balance(user_id)
            )
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"[Credit] 餘額同步失敗: {e}")
            return CreditResult(
                success=False,
                error=str(e),
                error_code="SYNC_ERROR"
            )
    
    # ==================== 低餘額提醒 ====================
    
    LOW_BALANCE_THRESHOLDS = [100, 50, 20, 10]  # 當餘額低於這些閾值時發送提醒
    
    def _check_low_balance_alert(self, user_id: int, balance: int):
        """
        檢查是否需要發送低餘額提醒
        
        為避免重複發送，使用 Redis 或用戶設定記錄上次提醒的閾值
        這裡簡化處理：只在剛好跨過閾值時提醒
        """
        try:
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                return
            
            # 檢查是否跨過任何閾值
            settings = user.notification_settings or {}
            last_alert_threshold = settings.get("last_low_balance_alert_threshold", 0)
            
            for threshold in self.LOW_BALANCE_THRESHOLDS:
                # 餘額剛好低於閾值，且上次提醒的閾值比這個高（或沒有提醒過）
                if balance < threshold and last_alert_threshold > threshold:
                    self._send_low_balance_notification(user, balance, threshold)
                    
                    # 更新上次提醒閾值
                    settings["last_low_balance_alert_threshold"] = threshold
                    user.notification_settings = settings
                    self.db.commit()
                    break
                    
            # 如果餘額恢復到較高水平，重置閾值
            if balance >= max(self.LOW_BALANCE_THRESHOLDS):
                if last_alert_threshold > 0:
                    settings["last_low_balance_alert_threshold"] = max(self.LOW_BALANCE_THRESHOLDS) + 1
                    user.notification_settings = settings
                    self.db.commit()
                    
        except Exception as e:
            logger.warning(f"[Credit] 檢查低餘額提醒失敗: {e}")
    
    def _send_low_balance_notification(self, user: User, balance: int, threshold: int):
        """發送低餘額提醒通知"""
        try:
            from app.routers.notifications import create_credit_notification
            
            create_credit_notification(
                db=self.db,
                user_id=user.id,
                title="點數餘額不足",
                message=f"您的點數餘額僅剩 {balance:,} 點，建議儲值以繼續使用服務。",
                data={
                    "alert_type": "low_balance",
                    "balance": balance,
                    "threshold": threshold,
                    "action_url": "/dashboard/credits",
                    "action_text": "立即儲值",
                },
                send_email=True  # 低餘額提醒發送郵件
            )
            
            logger.info(f"[Credit] 已發送低餘額提醒：用戶 #{user.id}, 餘額={balance}, 閾值={threshold}")
            
        except Exception as e:
            logger.error(f"[Credit] 發送低餘額提醒失敗: {e}")


# ============================================================
# 便捷函數
# ============================================================

def get_credit_service(db: Session) -> CreditService:
    """取得點數服務實例"""
    return CreditService(db)
