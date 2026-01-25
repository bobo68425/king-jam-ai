"""
金流服務
整合綠界 (ECPay) 和 Stripe 支付

測試帳號資訊：
- ECPay 測試商店代號: 3002607
- ECPay 測試 HashKey: pwFHCqoQZGmho4w6
- ECPay 測試 HashIV: EkRm7iFT261dpevs
- Stripe 測試模式使用 sk_test_ 開頭的密鑰
"""

import os
import hashlib
import urllib.parse
import hmac
import json
import uuid
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional, Dict, Any, Tuple
from enum import Enum

import httpx
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import User, Order, PaymentLog

logger = logging.getLogger(__name__)


# ============================================================
# 常量定義
# ============================================================

class PaymentProvider(str, Enum):
    ECPAY = "ecpay"
    STRIPE = "stripe"


class OrderType(str, Enum):
    SUBSCRIPTION = "subscription"
    CREDITS = "credits"


class OrderStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    PAID = "paid"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


# 綠界測試環境設定
ECPAY_TEST_CONFIG = {
    "merchant_id": "3002607",
    "hash_key": "pwFHCqoQZGmho4w6",
    "hash_iv": "EkRm7iFT261dpevs",
    "api_url": "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5",
    "query_url": "https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5",
}

# 綠界正式環境設定（從環境變數讀取）
ECPAY_PROD_CONFIG = {
    "merchant_id": os.getenv("ECPAY_MERCHANT_ID", ""),
    "hash_key": os.getenv("ECPAY_HASH_KEY", ""),
    "hash_iv": os.getenv("ECPAY_HASH_IV", ""),
    "api_url": "https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5",
    "query_url": "https://payment.ecpay.com.tw/Cashier/QueryTradeInfo/V5",
}

# Stripe 設定
STRIPE_TEST_SECRET_KEY = os.getenv("STRIPE_TEST_SECRET_KEY", "sk_test_placeholder")
STRIPE_LIVE_SECRET_KEY = os.getenv("STRIPE_LIVE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

# 環境模式
PAYMENT_MODE = os.getenv("PAYMENT_MODE", "test")  # test 或 production


# ============================================================
# 工具函數
# ============================================================

def generate_order_no() -> str:
    """生成訂單編號"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    random_part = uuid.uuid4().hex[:8].upper()
    return f"KJ{timestamp}{random_part}"


def get_ecpay_config() -> Dict[str, str]:
    """取得綠界設定"""
    if PAYMENT_MODE == "production" and ECPAY_PROD_CONFIG["merchant_id"]:
        return ECPAY_PROD_CONFIG
    return ECPAY_TEST_CONFIG


def get_stripe_key() -> str:
    """取得 Stripe API Key"""
    if PAYMENT_MODE == "production" and STRIPE_LIVE_SECRET_KEY:
        return STRIPE_LIVE_SECRET_KEY
    return STRIPE_TEST_SECRET_KEY


# ============================================================
# 綠界 ECPay 服務
# ============================================================

class ECPayService:
    """
    綠界金流服務
    
    支援付款方式：
    - 信用卡 (Credit)
    - ATM 虛擬帳號 (ATM)
    - 超商代碼 (CVS)
    - 超商條碼 (BARCODE)
    """
    
    def __init__(self):
        self.config = get_ecpay_config()
    
    def _url_encode(self, data: str) -> str:
        """URL 編碼（綠界特殊規則）"""
        encoded = urllib.parse.quote_plus(data)
        # 綠界特殊字元轉換
        encoded = encoded.replace("%2d", "-")
        encoded = encoded.replace("%5f", "_")
        encoded = encoded.replace("%2e", ".")
        encoded = encoded.replace("%21", "!")
        encoded = encoded.replace("%2a", "*")
        encoded = encoded.replace("%28", "(")
        encoded = encoded.replace("%29", ")")
        return encoded
    
    def _generate_check_mac_value(self, params: Dict[str, Any]) -> str:
        """生成檢查碼"""
        # 1. 參數依照 Key 排序
        sorted_params = sorted(params.items(), key=lambda x: x[0])
        
        # 2. 組合字串
        param_str = "&".join([f"{k}={v}" for k, v in sorted_params])
        
        # 3. 前後加上 HashKey 和 HashIV
        raw_str = f"HashKey={self.config['hash_key']}&{param_str}&HashIV={self.config['hash_iv']}"
        
        # 4. URL Encode
        encoded_str = self._url_encode(raw_str).lower()
        
        # 5. SHA256 加密並轉大寫
        check_mac = hashlib.sha256(encoded_str.encode("utf-8")).hexdigest().upper()
        
        return check_mac
    
    def create_payment(
        self,
        order: Order,
        return_url: str,
        notify_url: str,
        payment_method: str = "ALL",  # ALL, Credit, ATM, CVS, BARCODE
        client_back_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        建立綠界付款
        
        Args:
            order: 訂單物件
            return_url: 付款完成後導向頁面
            notify_url: 付款結果通知 URL (後端接收)
            payment_method: 付款方式
            client_back_url: 取消付款時導向頁面
        
        Returns:
            包含付款表單 HTML 的字典
        """
        # 訂單編號（綠界限制 20 字元）
        merchant_trade_no = f"KJ{datetime.now().strftime('%y%m%d%H%M%S')}{order.id:04d}"
        
        params = {
            "MerchantID": self.config["merchant_id"],
            "MerchantTradeNo": merchant_trade_no,
            "MerchantTradeDate": datetime.now().strftime("%Y/%m/%d %H:%M:%S"),
            "PaymentType": "aio",
            "TotalAmount": int(order.total_amount),
            "TradeDesc": urllib.parse.quote_plus("KingJam AI 點數購買"),
            "ItemName": order.item_name,
            "ReturnURL": notify_url,
            "OrderResultURL": return_url,
            "ChoosePayment": payment_method,
            "EncryptType": 1,  # SHA256
            "NeedExtraPaidInfo": "Y",
        }
        
        if client_back_url:
            params["ClientBackURL"] = client_back_url
        
        # 信用卡分期（金額 >= 3000 可分期）
        if payment_method in ["ALL", "Credit"] and order.total_amount >= 3000:
            params["CreditInstallment"] = "3,6,12"
        
        # 生成檢查碼
        params["CheckMacValue"] = self._generate_check_mac_value(params)
        
        # 生成表單 HTML
        form_html = self._generate_form_html(params)
        
        return {
            "success": True,
            "payment_url": self.config["api_url"],
            "form_html": form_html,
            "merchant_trade_no": merchant_trade_no,
            "params": params,
        }
    
    def _generate_form_html(self, params: Dict[str, Any]) -> str:
        """生成自動提交的表單 HTML"""
        inputs = "\n".join([
            f'<input type="hidden" name="{k}" value="{v}">'
            for k, v in params.items()
        ])
        
        return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>正在跳轉到綠界付款...</title>
</head>
<body>
    <form id="ecpay_form" method="POST" action="{self.config['api_url']}">
        {inputs}
    </form>
    <script>document.getElementById('ecpay_form').submit();</script>
</body>
</html>
"""
    
    def verify_callback(self, params: Dict[str, Any]) -> Tuple[bool, str]:
        """
        驗證綠界回呼
        
        Returns:
            (是否驗證成功, 訊息)
        """
        if "CheckMacValue" not in params:
            return False, "缺少 CheckMacValue"
        
        received_mac = params.pop("CheckMacValue")
        calculated_mac = self._generate_check_mac_value(params)
        
        if received_mac != calculated_mac:
            return False, "CheckMacValue 驗證失敗"
        
        return True, "驗證成功"
    
    def query_trade(self, merchant_trade_no: str) -> Dict[str, Any]:
        """查詢訂單狀態"""
        params = {
            "MerchantID": self.config["merchant_id"],
            "MerchantTradeNo": merchant_trade_no,
            "TimeStamp": int(datetime.now().timestamp()),
        }
        
        params["CheckMacValue"] = self._generate_check_mac_value(params)
        
        try:
            response = httpx.post(
                self.config["query_url"],
                data=params,
                timeout=30,
            )
            
            # 解析回應
            result = dict(urllib.parse.parse_qsl(response.text))
            return {
                "success": True,
                "data": result,
            }
        except Exception as e:
            logger.error(f"ECPay 查詢失敗: {e}")
            return {
                "success": False,
                "error": str(e),
            }


# ============================================================
# Stripe 服務
# ============================================================

class StripeService:
    """
    Stripe 金流服務
    
    支援：
    - Checkout Session（結帳頁面）
    - Payment Intent（自訂付款流程）
    - Subscription（訂閱）
    """
    
    def __init__(self):
        self.api_key = get_stripe_key()
        self.api_base = "https://api.stripe.com/v1"
    
    def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        """發送 API 請求"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/x-www-form-urlencoded",
        }
        
        url = f"{self.api_base}/{endpoint}"
        
        try:
            if method == "GET":
                response = httpx.get(url, headers=headers, timeout=30)
            else:
                response = httpx.post(url, headers=headers, data=data, timeout=30)
            
            result = response.json()
            
            if response.status_code >= 400:
                return {
                    "success": False,
                    "error": result.get("error", {}).get("message", "Unknown error"),
                    "data": result,
                }
            
            return {
                "success": True,
                "data": result,
            }
        except Exception as e:
            logger.error(f"Stripe API 請求失敗: {e}")
            return {
                "success": False,
                "error": str(e),
            }
    
    def create_checkout_session(
        self,
        order: Order,
        success_url: str,
        cancel_url: str,
        customer_email: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        建立 Checkout Session
        
        Args:
            order: 訂單物件
            success_url: 付款成功導向 URL
            cancel_url: 取消付款導向 URL
            customer_email: 客戶 Email
        
        Returns:
            包含 checkout URL 的字典
        """
        # 轉換金額為最小單位（TWD 不需要乘 100）
        amount = int(order.total_amount)
        
        data = {
            "mode": "payment",
            "success_url": success_url,
            "cancel_url": cancel_url,
            "line_items[0][price_data][currency]": "twd",
            "line_items[0][price_data][unit_amount]": amount * 100,  # Stripe 使用最小單位
            "line_items[0][price_data][product_data][name]": order.item_name,
            "line_items[0][quantity]": 1,
            "metadata[order_id]": str(order.id),
            "metadata[order_no]": order.order_no,
        }
        
        if customer_email:
            data["customer_email"] = customer_email
        
        if order.item_description:
            data["line_items[0][price_data][product_data][description]"] = order.item_description
        
        result = self._request("POST", "checkout/sessions", data)
        
        if result["success"]:
            return {
                "success": True,
                "checkout_url": result["data"]["url"],
                "session_id": result["data"]["id"],
            }
        
        return result
    
    def create_subscription_checkout(
        self,
        order: Order,
        price_id: str,  # Stripe Price ID
        success_url: str,
        cancel_url: str,
        customer_email: Optional[str] = None,
        trial_days: int = 0,
    ) -> Dict[str, Any]:
        """建立訂閱 Checkout Session"""
        data = {
            "mode": "subscription",
            "success_url": success_url,
            "cancel_url": cancel_url,
            "line_items[0][price]": price_id,
            "line_items[0][quantity]": 1,
            "metadata[order_id]": str(order.id),
            "metadata[order_no]": order.order_no,
        }
        
        if customer_email:
            data["customer_email"] = customer_email
        
        if trial_days > 0:
            data["subscription_data[trial_period_days]"] = trial_days
        
        result = self._request("POST", "checkout/sessions", data)
        
        if result["success"]:
            return {
                "success": True,
                "checkout_url": result["data"]["url"],
                "session_id": result["data"]["id"],
            }
        
        return result
    
    def retrieve_session(self, session_id: str) -> Dict[str, Any]:
        """查詢 Checkout Session"""
        return self._request("GET", f"checkout/sessions/{session_id}")
    
    def verify_webhook(self, payload: bytes, signature: str) -> Tuple[bool, Any]:
        """驗證 Webhook 簽名"""
        if not STRIPE_WEBHOOK_SECRET:
            logger.warning("Stripe Webhook Secret 未設定")
            return True, json.loads(payload)
        
        try:
            import stripe
            stripe.api_key = self.api_key
            event = stripe.Webhook.construct_event(
                payload, signature, STRIPE_WEBHOOK_SECRET
            )
            return True, event
        except Exception as e:
            logger.error(f"Stripe Webhook 驗證失敗: {e}")
            return False, str(e)


# ============================================================
# 整合支付服務
# ============================================================

class PaymentService:
    """
    整合支付服務
    
    統一處理訂單建立、支付、回呼
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.ecpay = ECPayService()
        self.stripe = StripeService()
    
    def create_order(
        self,
        user: User,
        order_type: str,
        item_code: str,
        item_name: str,
        total_amount: Decimal,
        credits_amount: Optional[int] = None,
        bonus_credits: Optional[int] = None,
        subscription_months: Optional[int] = None,
        item_description: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Order:
        """建立訂單"""
        order = Order(
            order_no=generate_order_no(),
            user_id=user.id,
            order_type=order_type,
            item_code=item_code,
            item_name=item_name,
            item_description=item_description,
            unit_price=total_amount,
            total_amount=total_amount,
            credits_amount=credits_amount,
            bonus_credits=bonus_credits,
            subscription_months=subscription_months,
            status=OrderStatus.PENDING.value,
            ip_address=ip_address,
            user_agent=user_agent,
            expires_at=datetime.utcnow() + timedelta(hours=24),
        )
        
        # 處理推薦人
        if user.referred_by:
            referrer = self.db.query(User).filter(
                User.referral_code == user.referred_by
            ).first()
            if referrer:
                order.referrer_id = referrer.id
        
        self.db.add(order)
        self.db.commit()
        self.db.refresh(order)
        
        # 記錄日誌
        self._log_payment(
            order_id=order.id,
            action="create_order",
            status_after=order.status,
            message=f"訂單建立: {item_name}",
            ip_address=ip_address,
        )
        
        return order
    
    def initiate_payment(
        self,
        order: Order,
        provider: str,
        return_url: str,
        cancel_url: str,
        notify_url: str,
        customer_email: Optional[str] = None,
        payment_method: str = "ALL",
    ) -> Dict[str, Any]:
        """
        發起支付
        
        Args:
            order: 訂單
            provider: 支付供應商 (ecpay, stripe)
            return_url: 成功返回 URL
            cancel_url: 取消返回 URL
            notify_url: 後端通知 URL
            customer_email: 客戶 Email
            payment_method: 付款方式（綠界專用）
        """
        order.payment_provider = provider
        
        if provider == PaymentProvider.ECPAY.value:
            result = self.ecpay.create_payment(
                order=order,
                return_url=return_url,
                notify_url=notify_url,
                payment_method=payment_method,
                client_back_url=cancel_url,
            )
            
            if result["success"]:
                order.ecpay_merchant_trade_no = result["merchant_trade_no"]
                order.status = OrderStatus.PROCESSING.value
        
        elif provider == PaymentProvider.STRIPE.value:
            result = self.stripe.create_checkout_session(
                order=order,
                success_url=return_url,
                cancel_url=cancel_url,
                customer_email=customer_email,
            )
            
            if result["success"]:
                order.stripe_checkout_session_id = result["session_id"]
                order.status = OrderStatus.PROCESSING.value
        
        else:
            return {"success": False, "error": "不支援的支付方式"}
        
        self.db.commit()
        
        # 記錄日誌
        self._log_payment(
            order_id=order.id,
            action="initiate_payment",
            status_before=OrderStatus.PENDING.value,
            status_after=order.status,
            provider=provider,
            message=f"發起 {provider} 支付",
        )
        
        return result
    
    def process_payment_callback(
        self,
        order: Order,
        is_success: bool,
        provider_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """處理支付回呼"""
        if is_success:
            order.status = OrderStatus.PAID.value
            order.paid_at = datetime.utcnow()
            order.provider_response = provider_data
            
            # 發放點數或啟用訂閱
            self._fulfill_order(order)
            
            action = "payment_success"
            message = "付款成功"
        else:
            order.status = OrderStatus.FAILED.value
            order.provider_response = provider_data
            
            action = "payment_failed"
            message = "付款失敗"
        
        self.db.commit()
        
        # 記錄日誌
        self._log_payment(
            order_id=order.id,
            action=action,
            status_after=order.status,
            provider=order.payment_provider,
            provider_response=provider_data,
            message=message,
        )
        
        return {
            "success": is_success,
            "order_status": order.status,
        }
    
    def _fulfill_order(self, order: Order):
        """履行訂單（發放點數/啟用訂閱）"""
        user = self.db.query(User).filter(User.id == order.user_id).first()
        if not user:
            return
        
        if order.order_type == OrderType.CREDITS.value:
            # 發放點數（分開處理基本點數和贈送點數）
            base_credits = order.credits_amount or 0
            bonus_credits = order.bonus_credits or 0
            total_credits = base_credits + bonus_credits
            
            from app.services.credit_service import CreditService
            credit_service = CreditService(self.db)
            
            # 1. 基本點數 → PAID（可退款）
            if base_credits > 0:
                user.credits_paid = (user.credits_paid or 0) + base_credits
                user.credits = (user.credits or 0) + base_credits
                
                credit_service.add_credits(
                    user_id=user.id,
                    amount=base_credits,
                    transaction_type="purchase",
                    credit_category="paid",
                    description=f"購買點數: {order.item_name}",
                    reference_type="order",
                    reference_id=order.id,
                    metadata={
                        "order_no": order.order_no,
                        "price_twd": float(order.total_amount),
                        "base_credits": base_credits,
                        "bonus_credits": bonus_credits,
                        # 計算每點購買價格（用於退款計算）
                        "price_per_credit": float(order.total_amount) / base_credits if base_credits > 0 else 0,
                    },
                )
            
            # 2. 贈送點數 → PROMO（不可退款，30天有效）
            if bonus_credits > 0:
                user.credits_promo = (user.credits_promo or 0) + bonus_credits
                user.credits = (user.credits or 0) + bonus_credits
                
                credit_service.grant_promo(
                    user_id=user.id,
                    amount=bonus_credits,
                    campaign=f"購買贈送: {order.item_name}",
                    expires_in_days=30,
                )
            
            self._log_payment(
                order_id=order.id,
                action="credits_granted",
                message=f"發放點數: {base_credits} PAID + {bonus_credits} PROMO = {total_credits} 點",
            )
        
        elif order.order_type == OrderType.SUBSCRIPTION.value:
            # 啟用訂閱
            user.subscription_plan = order.item_code
            months = order.subscription_months or 1
            
            if user.subscription_expires_at and user.subscription_expires_at > datetime.utcnow():
                # 延長現有訂閱
                user.subscription_expires_at = user.subscription_expires_at + timedelta(days=30 * months)
            else:
                # 新訂閱
                user.subscription_expires_at = datetime.utcnow() + timedelta(days=30 * months)
            
            # 發放月費點數
            from app.models import SubscriptionPlan
            plan = self.db.query(SubscriptionPlan).filter(
                SubscriptionPlan.plan_code == order.item_code
            ).first()
            
            if plan and plan.monthly_credits > 0:
                user.credits_sub = (user.credits_sub or 0) + plan.monthly_credits
                user.credits = (user.credits or 0) + plan.monthly_credits
            
            self._log_payment(
                order_id=order.id,
                action="subscription_activated",
                message=f"啟用訂閱: {order.item_name}, {months} 個月",
            )
        
        # 處理推薦人分潤
        self._process_referral_bonus(order)
        
        order.status = OrderStatus.COMPLETED.value
        order.completed_at = datetime.utcnow()
        self.db.commit()
    
    def _process_referral_bonus(self, order: Order):
        """處理推薦人分潤"""
        from app.services.credit_service import REFERRAL_COMMISSION_RATES
        
        if not order.referrer_id or order.referral_processed:
            return
        
        referrer = self.db.query(User).filter(User.id == order.referrer_id).first()
        if not referrer:
            return
        
        # 根據推薦人等級計算分潤比例
        partner_tier = referrer.partner_tier or "bronze"
        commission_rate = REFERRAL_COMMISSION_RATES.get(
            partner_tier, 
            REFERRAL_COMMISSION_RATES["bronze"]
        )
        
        # 計算分潤金額
        bonus_twd = order.total_amount * commission_rate
        
        # 1 BONUS 點 = NT$ 1（直接對應現金價值）
        bonus_credits = int(bonus_twd)
        
        if bonus_credits <= 0:
            return
        
        # 發放獎金點數
        referrer.credits_bonus = (referrer.credits_bonus or 0) + bonus_credits
        referrer.credits = (referrer.credits or 0) + bonus_credits
        referrer.total_referral_revenue = (referrer.total_referral_revenue or Decimal("0")) + bonus_twd
        
        # 更新推薦人統計
        referrer.total_referrals = (referrer.total_referrals or 0) + 1
        
        order.referral_bonus = bonus_twd
        order.referral_processed = True
        
        self._log_payment(
            order_id=order.id,
            action="referral_bonus",
            message=f"推薦人分潤 ({partner_tier} {float(commission_rate)*100:.0f}%): NT${float(bonus_twd):.0f} = {bonus_credits} BONUS點",
        )
    
    def _log_payment(
        self,
        order_id: int,
        action: str,
        status_before: Optional[str] = None,
        status_after: Optional[str] = None,
        provider: Optional[str] = None,
        provider_response: Optional[Dict] = None,
        message: Optional[str] = None,
        ip_address: Optional[str] = None,
        extra_data: Optional[Dict] = None,
    ):
        """記錄支付日誌"""
        log = PaymentLog(
            order_id=order_id,
            action=action,
            status_before=status_before,
            status_after=status_after,
            provider=provider,
            provider_response=provider_response,
            message=message,
            ip_address=ip_address,
            extra_data=extra_data,
        )
        self.db.add(log)
    
    def get_order_by_no(self, order_no: str) -> Optional[Order]:
        """根據訂單編號查詢訂單"""
        return self.db.query(Order).filter(Order.order_no == order_no).first()
    
    def get_order_by_ecpay_no(self, merchant_trade_no: str) -> Optional[Order]:
        """根據綠界訂單編號查詢訂單"""
        return self.db.query(Order).filter(
            Order.ecpay_merchant_trade_no == merchant_trade_no
        ).first()
    
    def get_order_by_stripe_session(self, session_id: str) -> Optional[Order]:
        """根據 Stripe Session ID 查詢訂單"""
        return self.db.query(Order).filter(
            Order.stripe_checkout_session_id == session_id
        ).first()


# ============================================================
# 服務實例
# ============================================================

def get_payment_service(db: Session) -> PaymentService:
    """取得支付服務實例"""
    return PaymentService(db)
