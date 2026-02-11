"""
推薦獎金服務 (Referral Bonus Service)

處理推薦碼生成、獎金發放、夥伴等級升級等功能

推薦流程：
1. 用戶 A 分享推薦碼
2. 用戶 B 使用推薦碼註冊
3. 用戶 B 購買點數或訂閱方案
4. 系統計算並發放獎金給用戶 A
5. 更新用戶 A 的推薦統計和夥伴等級

========================================
推薦獎金計算規則（修正版）
========================================

設計原則：
1. 分潤基於銷售額的合理比例（考慮毛利）
2. 1 BONUS 點 = NT$ 1（直接對應現金價值）
3. 分潤比例確保平台仍有利潤

分潤比例（基於銷售額）：
- 銅牌夥伴：3%（需達成條件升級）
- 銀牌夥伴：5%
- 金牌夥伴：8%

範例計算：
- 被推薦人購買 standard 套餐 NT$449
- 銅牌推薦人獲得：449 × 3% = 13.47 → 13 BONUS 點
- 提領時：13 點 = NT$13

平台利潤分析（standard 套餐）：
- 售價：NT$449（700點）
- 成本：約 NT$210（假設0.30元/點）
- 毛利：NT$239
- 分潤：NT$13（銅牌）
- 淨利：NT$226 ✓ 仍有利潤
"""

import logging
import secrets
import string
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func
import pytz

from app.models import User, CreditTransaction
from app.services.credit_service import (
    CreditService, CreditCategory, TransactionType,
    WITHDRAWAL_EXCHANGE_RATE, REFERRAL_COMMISSION_RATES
)

logger = logging.getLogger(__name__)


# ============================================================
# 常量定義
# ============================================================

# 夥伴等級設定
PARTNER_TIERS = {
    "bronze": {
        "name": "銅牌夥伴",
        "commission_rate": REFERRAL_COMMISSION_RATES["bronze"],  # 3%
        "min_referrals": 0,
        "min_revenue": Decimal("0"),
        "referral_bonus_promo": 50,  # 推薦成功送的活動點數
    },
    "silver": {
        "name": "銀牌夥伴",
        "commission_rate": REFERRAL_COMMISSION_RATES["silver"],  # 5%
        "min_referrals": 10,
        "min_revenue": Decimal("5000"),
        "referral_bonus_promo": 100,
        "monthly_bonus": 50,  # 每月額外獎金點數
    },
    "gold": {
        "name": "金牌夥伴",
        "commission_rate": REFERRAL_COMMISSION_RATES["gold"],  # 8%
        "min_referrals": 30,
        "min_revenue": Decimal("20000"),
        "referral_bonus_promo": 200,
        "monthly_bonus": 100,
    },
}

# 訂閱方案價格（月繳）
SUBSCRIPTION_PRICES = {
    "free": Decimal("0"),
    "basic": Decimal("299"),
    "pro": Decimal("699"),
    "enterprise": Decimal("3699"),
}

# 訂閱方案年繳價格（約 8 折，20% 折扣）
SUBSCRIPTION_PRICES_YEARLY = {
    "free": Decimal("0"),
    "basic": Decimal("2870"),   # 299 * 12 * 0.8
    "pro": Decimal("6710"),    # 699 * 12 * 0.8
    "enterprise": Decimal("35510"),  # 3699 * 12 * 0.8
}


def calculate_referral_bonus(price: Decimal, partner_tier: str) -> Tuple[int, float]:
    """
    計算推薦獎金
    
    Args:
        price: 訂單金額（TWD）
        partner_tier: 夥伴等級（bronze/silver/gold）
    
    Returns:
        (bonus_credits, bonus_twd)
        
    計算方式：
        1 BONUS 點 = NT$ 1
        BONUS 點數 = 訂單金額 × 分潤比例
    """
    tier_config = PARTNER_TIERS.get(partner_tier, PARTNER_TIERS["bronze"])
    commission_rate = tier_config["commission_rate"]
    
    # 計算分潤金額
    bonus_twd = float(price * commission_rate)
    
    # 1 BONUS 點 = NT$ 1（直接取整數）
    bonus_credits = int(bonus_twd)
    
    return bonus_credits, bonus_twd


def _generate_bonus_table(prices: Dict[str, Decimal]) -> Dict[str, Dict[str, int]]:
    """
    動態生成推薦獎金對照表
    
    計算公式：BONUS 點數 = 訂閱價格 × 分潤比例（取整數）
    """
    table = {}
    for plan, price in prices.items():
        if plan == "free" or price == 0:
            continue
        table[plan] = {}
        for tier in PARTNER_TIERS:
            credits, _ = calculate_referral_bonus(price, tier)
            table[plan][tier] = credits
    return table


# 推薦獎金對照表（月繳 / 年繳）
REFERRAL_BONUS_TABLE = _generate_bonus_table(SUBSCRIPTION_PRICES)
REFERRAL_BONUS_TABLE_YEARLY = _generate_bonus_table(SUBSCRIPTION_PRICES_YEARLY)

# 註冊獎勵（活動點數 PROMO，有時效性）
REGISTRATION_BONUS = 100  # 新用戶註冊送的活動點數
REFERRER_REGISTRATION_BONUS = 50  # 推薦者獲得的活動點數（被推薦者註冊時）


@dataclass
class ReferralResult:
    """推薦操作結果"""
    success: bool
    message: str = ""
    referral_id: Optional[int] = None
    bonus_credits: int = 0
    bonus_twd: float = 0
    error: Optional[str] = None


# ============================================================
# 推薦服務類
# ============================================================

class ReferralService:
    """
    推薦獎金服務
    
    使用方式：
    ```python
    referral_service = ReferralService(db)
    
    # 生成推薦碼
    code = referral_service.generate_referral_code(user_id)
    
    # 處理新用戶註冊（使用推薦碼）
    result = referral_service.process_referral_registration(
        new_user_id=new_user.id,
        referral_code="ABC123"
    )
    
    # 處理訂閱付費（發放推薦獎金）
    result = referral_service.process_subscription_payment(
        user_id=user.id,
        subscription_plan="pro"
    )
    ```
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.credit_service = CreditService(db)
    
    # ==================== 推薦碼管理 ====================
    
    def generate_referral_code(self, user_id: int, length: int = 8) -> Optional[str]:
        """
        為用戶生成唯一推薦碼
        """
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return None
        
        # 如果已有推薦碼，直接返回
        if user.referral_code:
            return user.referral_code
        
        # 生成新的推薦碼
        max_attempts = 10
        for _ in range(max_attempts):
            code = self._generate_code(length)
            existing = self.db.query(User).filter(User.referral_code == code).first()
            if not existing:
                user.referral_code = code
                self.db.commit()
                logger.info(f"[Referral] 用戶 #{user_id} 生成推薦碼: {code}")
                return code
        
        logger.error(f"[Referral] 無法為用戶 #{user_id} 生成唯一推薦碼")
        return None
    
    def _generate_code(self, length: int = 8) -> str:
        """生成隨機推薦碼"""
        chars = string.ascii_uppercase + string.digits
        # 移除容易混淆的字元
        chars = chars.replace('O', '').replace('0', '').replace('I', '').replace('1', '').replace('L', '')
        return ''.join(secrets.choice(chars) for _ in range(length))
    
    def get_referrer_by_code(self, referral_code: str) -> Optional[User]:
        """根據推薦碼找到推薦者"""
        if not referral_code:
            return None
        return self.db.query(User).filter(
            User.referral_code == referral_code.upper()
        ).first()
    
    # ==================== 註冊流程 ====================
    
    def process_referral_registration(
        self,
        new_user_id: int,
        referral_code: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> ReferralResult:
        """
        處理新用戶註冊（使用推薦碼）
        
        1. 驗證推薦碼
        2. 記錄推薦關係
        3. 發放註冊獎勵給新用戶（活動點數）
        4. 發放推薦獎勵給推薦者（活動點數）
        """
        new_user = self.db.query(User).filter(User.id == new_user_id).first()
        if not new_user:
            return ReferralResult(success=False, error="用戶不存在")
        
        # 發放新用戶註冊獎勵
        self.credit_service.grant_promo(
            user_id=new_user_id,
            amount=REGISTRATION_BONUS,
            campaign="新用戶註冊",
            expires_in_days=30,
            ip_address=ip_address
        )
        logger.info(f"[Referral] 新用戶 #{new_user_id} 獲得註冊獎勵 {REGISTRATION_BONUS} 點")
        
        # 如果沒有推薦碼，到此結束
        if not referral_code:
            return ReferralResult(
                success=True,
                message="註冊成功，獲得新用戶獎勵",
                bonus_credits=REGISTRATION_BONUS
            )
        
        # 驗證推薦碼
        referrer = self.get_referrer_by_code(referral_code)
        if not referrer:
            return ReferralResult(
                success=True,
                message="註冊成功，但推薦碼無效",
                bonus_credits=REGISTRATION_BONUS
            )
        
        # 不能自己推薦自己
        if referrer.id == new_user_id:
            return ReferralResult(
                success=True,
                message="註冊成功，但不能使用自己的推薦碼",
                bonus_credits=REGISTRATION_BONUS
            )
        
        # 記錄推薦關係
        new_user.referred_by = referral_code.upper()
        
        # 建立推薦記錄
        from app.models import User  # 避免循環導入
        # 需要先在 models.py 中定義 ReferralRecord
        
        # 🚨 詐騙偵測：檢查推薦者是否有資格獲得獎金
        try:
            from app.services.fraud_detection import get_fraud_detection_service
            fraud_service = get_fraud_detection_service(self.db)
            
            # 檢查新用戶是否有風險
            new_user_eligible, new_user_reason = fraud_service.check_referral_eligibility(new_user_id)
            if not new_user_eligible:
                logger.warning(
                    f"[Referral] ⚠️ 新用戶 #{new_user_id} 風險偵測失敗: {new_user_reason}"
                )
                return ReferralResult(
                    success=True,
                    message=f"註冊成功，但推薦獎勵暫緩發放（{new_user_reason}）",
                    bonus_credits=REGISTRATION_BONUS
                )
            
            # 檢查推薦者是否有資格
            referrer_eligible, referrer_reason = fraud_service.check_referral_eligibility(referrer.id)
            if not referrer_eligible:
                logger.warning(
                    f"[Referral] ⚠️ 推薦者 #{referrer.id} 獎金暫停: {referrer_reason}"
                )
                return ReferralResult(
                    success=True,
                    message=f"註冊成功，推薦者獎勵暫緩發放",
                    bonus_credits=REGISTRATION_BONUS
                )
        except Exception as e:
            logger.error(f"[Referral] 詐騙偵測錯誤: {e}")
            # 詐騙偵測失敗時，保守起見暫不發放獎金
        
        # 發放推薦獎勵給推薦者
        partner_tier = referrer.partner_tier or "bronze"
        referral_bonus = PARTNER_TIERS.get(partner_tier, PARTNER_TIERS["bronze"])["referral_bonus_promo"]
        
        self.credit_service.grant_promo(
            user_id=referrer.id,
            amount=referral_bonus,
            campaign="推薦新用戶註冊",
            expires_in_days=30,
            ip_address=ip_address
        )
        
        # 更新推薦者統計
        referrer.total_referrals = (referrer.total_referrals or 0) + 1
        
        self.db.commit()
        
        logger.info(
            f"[Referral] 推薦成功：推薦者 #{referrer.id} ({partner_tier}) "
            f"獲得 {referral_bonus} 活動點數，總推薦數 {referrer.total_referrals}"
        )
        
        return ReferralResult(
            success=True,
            message=f"註冊成功！推薦者獲得 {referral_bonus} 點獎勵",
            bonus_credits=REGISTRATION_BONUS + referral_bonus
        )
    
    # ==================== 訂閱付費流程 ====================
    
    def process_subscription_payment(
        self,
        user_id: int,
        subscription_plan: str,
        ip_address: Optional[str] = None
    ) -> ReferralResult:
        """
        處理訂閱付費，發放推薦獎金
        
        1. 檢查是否有推薦者
        2. 計算推薦獎金
        3. 發放獎金點數（BONUS 類型，可提領）
        4. 更新推薦者統計和等級
        """
        if subscription_plan not in SUBSCRIPTION_PRICES or subscription_plan == "free":
            return ReferralResult(
                success=True,
                message="免費方案無推薦獎金"
            )
        
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return ReferralResult(success=False, error="用戶不存在")
        
        # 更新用戶訂閱方案
        user.subscription_plan = subscription_plan
        user.tier = subscription_plan  # 同步更新 tier
        
        # 發放訂閱月費點數
        monthly_credits = {
            "basic": 200,
            "pro": 800,
            "enterprise": 5000,
        }.get(subscription_plan, 0)
        
        if monthly_credits > 0:
            self.credit_service.grant_subscription(
                user_id=user_id,
                amount=monthly_credits,
                ip_address=ip_address
            )
            logger.info(f"[Referral] 用戶 #{user_id} 訂閱 {subscription_plan}，獲得 {monthly_credits} 月費點數")
        
        # 檢查是否有推薦者
        if not user.referred_by:
            self.db.commit()
            return ReferralResult(
                success=True,
                message=f"訂閱成功，獲得 {monthly_credits} 月費點數"
            )
        
        referrer = self.get_referrer_by_code(user.referred_by)
        if not referrer:
            self.db.commit()
            return ReferralResult(
                success=True,
                message=f"訂閱成功，但找不到推薦者"
            )
        
        # 🚨 詐騙偵測：檢查是否有資格獲得推薦獎金
        try:
            from app.services.fraud_detection import get_fraud_detection_service
            fraud_service = get_fraud_detection_service(self.db)
            
            # 檢查付費用戶風險
            user_eligible, user_reason = fraud_service.check_referral_eligibility(user_id)
            if not user_eligible:
                logger.warning(
                    f"[Referral] ⚠️ 付費用戶 #{user_id} 風險偵測: {user_reason}"
                )
                self.db.commit()
                return ReferralResult(
                    success=True,
                    message=f"訂閱成功，推薦獎金暫緩發放（風險審核中）"
                )
            
            # 檢查推薦者風險
            referrer_eligible, referrer_reason = fraud_service.check_referral_eligibility(referrer.id)
            if not referrer_eligible:
                logger.warning(
                    f"[Referral] ⚠️ 推薦者 #{referrer.id} 獎金暫停: {referrer_reason}"
                )
                self.db.commit()
                return ReferralResult(
                    success=True,
                    message=f"訂閱成功，推薦者獎金暫緩發放"
                )
        except Exception as e:
            logger.error(f"[Referral] 訂閱詐騙偵測錯誤: {e}")
            # 詐騙偵測失敗時，保守起見暫不發放獎金
            self.db.commit()
            return ReferralResult(
                success=True,
                message=f"訂閱成功，推薦獎金處理中"
            )
        
        # 計算推薦獎金（使用統一的計算函數）
        partner_tier = referrer.partner_tier or "bronze"
        price = SUBSCRIPTION_PRICES[subscription_plan]
        bonus_credits, bonus_twd = calculate_referral_bonus(price, partner_tier)
        
        if bonus_credits <= 0:
            self.db.commit()
            return ReferralResult(
                success=True,
                message=f"訂閱成功，但無法計算推薦獎金"
            )
        
        # 發放推薦獎金（BONUS 類型，可提領）
        result = self.credit_service.grant(
            user_id=referrer.id,
            amount=bonus_credits,
            transaction_type=TransactionType.REFERRAL_BONUS,
            credit_category=CreditCategory.BONUS,
            description=f"推薦獎金（{subscription_plan} 方案）",
            metadata={
                "referred_user_id": user_id,
                "subscription_plan": subscription_plan,
                "partner_tier": partner_tier,
                "bonus_twd": bonus_twd,
            },
            ip_address=ip_address
        )
        
        if not result.success:
            return ReferralResult(
                success=False,
                error=f"發放獎金失敗：{result.error}"
            )
        
        # 更新推薦者統計
        referrer.total_referral_revenue = (
            Decimal(str(referrer.total_referral_revenue or 0)) + 
            Decimal(str(bonus_twd))
        )
        
        # 檢查並更新夥伴等級
        self._check_and_upgrade_partner_tier(referrer)
        
        self.db.commit()
        
        logger.info(
            f"[Referral] 推薦獎金發放：推薦者 #{referrer.id} ({partner_tier}) "
            f"獲得 {bonus_credits} 獎金點數 (NT${bonus_twd})，"
            f"累積收益 NT${referrer.total_referral_revenue}"
        )
        
        return ReferralResult(
            success=True,
            message=f"訂閱成功！推薦者獲得 {bonus_credits} 點獎金",
            bonus_credits=bonus_credits,
            bonus_twd=bonus_twd
        )
    
    # ==================== 夥伴等級管理 ====================
    
    def _check_and_upgrade_partner_tier(self, user: User) -> bool:
        """檢查並升級夥伴等級"""
        current_tier = user.partner_tier or "bronze"
        total_referrals = user.total_referrals or 0
        total_revenue = Decimal(str(user.total_referral_revenue or 0))
        
        new_tier = current_tier
        
        # 檢查是否符合金牌條件
        gold_config = PARTNER_TIERS["gold"]
        if (total_referrals >= gold_config["min_referrals"] or 
            total_revenue >= gold_config["min_revenue"]):
            new_tier = "gold"
        # 檢查是否符合銀牌條件
        elif current_tier == "bronze":
            silver_config = PARTNER_TIERS["silver"]
            if (total_referrals >= silver_config["min_referrals"] or 
                total_revenue >= silver_config["min_revenue"]):
                new_tier = "silver"
        
        if new_tier != current_tier:
            old_tier_name = PARTNER_TIERS[current_tier]["name"]
            new_tier_name = PARTNER_TIERS[new_tier]["name"]
            user.partner_tier = new_tier
            logger.info(
                f"[Referral] 用戶 #{user.id} 升級：{old_tier_name} -> {new_tier_name}"
            )
            return True
        
        return False
    
    def get_partner_stats(self, user_id: int) -> Dict[str, Any]:
        """取得用戶的夥伴統計"""
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return {}
        
        partner_tier = user.partner_tier or "bronze"
        tier_config = PARTNER_TIERS.get(partner_tier, PARTNER_TIERS["bronze"])
        
        # 計算距離下一等級的進度
        next_tier = None
        progress = {}
        
        if partner_tier == "bronze":
            next_tier = "silver"
            silver_config = PARTNER_TIERS["silver"]
            progress = {
                "referrals": {
                    "current": user.total_referrals or 0,
                    "required": silver_config["min_referrals"],
                    "percentage": min(100, ((user.total_referrals or 0) / silver_config["min_referrals"]) * 100),
                },
                "revenue": {
                    "current": float(user.total_referral_revenue or 0),
                    "required": float(silver_config["min_revenue"]),
                    "percentage": min(100, (float(user.total_referral_revenue or 0) / float(silver_config["min_revenue"])) * 100),
                },
            }
        elif partner_tier == "silver":
            next_tier = "gold"
            gold_config = PARTNER_TIERS["gold"]
            progress = {
                "referrals": {
                    "current": user.total_referrals or 0,
                    "required": gold_config["min_referrals"],
                    "percentage": min(100, ((user.total_referrals or 0) / gold_config["min_referrals"]) * 100),
                },
                "revenue": {
                    "current": float(user.total_referral_revenue or 0),
                    "required": float(gold_config["min_revenue"]),
                    "percentage": min(100, (float(user.total_referral_revenue or 0) / float(gold_config["min_revenue"])) * 100),
                },
            }
        
        return {
            "user_id": user_id,
            "email": user.email,
            "full_name": user.full_name,
            "avatar": user.avatar,
            "referral_code": user.referral_code,
            "partner_tier": partner_tier,
            "tier_name": tier_config["name"],
            "commission_rate": float(tier_config["commission_rate"]),
            "total_referrals": user.total_referrals or 0,
            "total_referral_revenue": float(user.total_referral_revenue or 0),
            "next_tier": next_tier,
            "next_tier_name": PARTNER_TIERS[next_tier]["name"] if next_tier else None,
            "progress": progress,
            "bonus_credits": self.credit_service.get_category_balance(user_id).bonus,
            "withdrawable_twd": float(self.credit_service.get_category_balance(user_id).withdrawable_twd),
        }
    
    def get_referral_history(
        self,
        user_id: int,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """取得推薦歷史"""
        # 查詢被此用戶推薦的人
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user or not user.referral_code:
            return []
        
        referred_users = self.db.query(User).filter(
            User.referred_by == user.referral_code
        ).order_by(User.created_at.desc()).offset(offset).limit(limit).all()
        
        return [
            {
                "user_id": u.id,
                "email": u.email[:3] + "***" + u.email[u.email.index("@"):],  # 遮罩 email
                "subscription_plan": u.subscription_plan or "free",
                "registered_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in referred_users
        ]


# ============================================================
# 便捷函數
# ============================================================

def get_referral_service(db: Session) -> ReferralService:
    """取得推薦服務實例"""
    return ReferralService(db)
