"""
支付 API
處理訂單建立、支付發起、回呼處理
"""

import os
import logging
from typing import Optional, List
from decimal import Decimal
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Order, CreditPackage, SubscriptionPlan
from app.routers.auth import get_current_user
from app.services.payment_service import (
    PaymentService,
    get_payment_service,
    PaymentProvider,
    OrderType,
    OrderStatus,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payment", tags=["支付"])

# 前端 URL 設定
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


# ============================================================
# Schemas
# ============================================================

class ProductListItem(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    price: float
    original_price: Optional[float] = None
    credits_amount: Optional[int] = None
    bonus_credits: Optional[int] = None
    monthly_credits: Optional[int] = None
    features: Optional[List[str]] = None
    is_popular: bool = False


class ProductListResponse(BaseModel):
    success: bool
    credit_packages: List[ProductListItem]
    subscription_plans: List[ProductListItem]


class CreateOrderRequest(BaseModel):
    order_type: str = Field(..., description="subscription 或 credits")
    item_code: str = Field(..., description="方案代碼或套餐代碼")
    payment_provider: Optional[str] = Field(default=None, description="金流供應商（留空自動選擇）")
    payment_method: str = Field(default="ALL", description="付款方式")
    quantity: int = Field(default=1, ge=1, le=12, description="數量（訂閱為月數）")
    referral_code: Optional[str] = Field(default=None, description="推薦碼")


# 金流額度限制
NEWEBPAY_LIMIT = 40000  # 藍新金流額度：NT$ 40,000
ECPAY_LIMIT = 200000    # 綠界金流額度：NT$ 200,000


def select_payment_provider(amount: float) -> str:
    """
    根據金額自動選擇金流供應商
    
    策略：
    - 目前預設使用綠界金流（穩定可用）
    - 藍新金流待完整測試後再啟用
    
    額度：
    - 藍新金流：NT$ 40,000
    - 綠界金流：NT$ 200,000
    """
    # 暫時全部使用綠界金流，等藍新金流測試完成後再調整
    return PaymentProvider.ECPAY.value
    
    # TODO: 藍新金流測試完成後，啟用以下邏輯
    # if amount <= NEWEBPAY_LIMIT:
    #     return PaymentProvider.NEWEBPAY.value
    # elif amount <= ECPAY_LIMIT:
    #     return PaymentProvider.ECPAY.value
    # else:
    #     return PaymentProvider.ECPAY.value


class CreateOrderResponse(BaseModel):
    success: bool
    order_no: Optional[str] = None
    payment_provider: Optional[str] = None
    checkout_url: Optional[str] = None
    form_html: Optional[str] = None
    error: Optional[str] = None


class OrderDetailResponse(BaseModel):
    success: bool
    order: Optional[dict] = None
    error: Optional[str] = None


class OrderListResponse(BaseModel):
    success: bool
    orders: List[dict]
    total: int


# ============================================================
# 產品列表
# ============================================================

@router.get("/products", response_model=ProductListResponse)
async def get_products(db: Session = Depends(get_db)):
    """
    取得所有可購買的產品
    
    包括：
    - 點數套餐
    - 訂閱方案
    """
    # 取得點數套餐（is_active 為 True 或 NULL）
    credit_packages = db.query(CreditPackage).filter(
        (CreditPackage.is_active == True) | (CreditPackage.is_active == None)
    ).order_by(CreditPackage.sort_order).all()
    
    # 取得訂閱方案
    subscription_plans = db.query(SubscriptionPlan).filter(
        SubscriptionPlan.is_active == True,
        SubscriptionPlan.plan_code != "free",
    ).order_by(SubscriptionPlan.sort_order).all()
    
    return {
        "success": True,
        "credit_packages": [
            {
                "code": p.package_code,
                "name": p.name,
                "description": p.description,
                "price": float(p.price_twd),
                "original_price": float(p.original_price_twd) if p.original_price_twd else None,
                "credits_amount": p.credits_amount,
                "bonus_credits": p.bonus_credits,
                "is_popular": p.is_popular or False,
            }
            for p in credit_packages
        ],
        "subscription_plans": [
            {
                "code": p.plan_code,
                "name": p.name,
                "description": p.description,
                "price": float(p.price_monthly),
                "monthly_credits": p.monthly_credits,
                "features": p.features if isinstance(p.features, list) else [],
                "is_popular": p.is_popular or False,
            }
            for p in subscription_plans
        ],
    }


# ============================================================
# 訂單管理
# ============================================================

@router.post("/orders", response_model=CreateOrderResponse)
async def create_order(
    request: CreateOrderRequest,
    req: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    建立訂單並發起支付
    """
    payment_service = get_payment_service(db)
    
    # 驗證訂單類型
    if request.order_type not in [OrderType.SUBSCRIPTION.value, OrderType.CREDITS.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="無效的訂單類型"
        )
    
    # 驗證支付方式（如果有指定）
    if request.payment_provider and request.payment_provider not in [
        PaymentProvider.ECPAY.value, 
        PaymentProvider.NEWEBPAY.value, 
        PaymentProvider.STRIPE.value,
    ]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="無效的支付方式"
        )
    
    # 取得商品資訊
    if request.order_type == OrderType.CREDITS.value:
        package = db.query(CreditPackage).filter(
            CreditPackage.package_code == request.item_code
        ).first()
        
        if not package:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="找不到此點數套餐"
            )
        
        item_name = package.name
        item_description = package.description
        total_amount = package.price_twd * request.quantity
        credits_amount = package.credits_amount * request.quantity
        bonus_credits = (package.bonus_credits or 0) * request.quantity
        subscription_months = None
        
    else:  # subscription
        plan = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.plan_code == request.item_code
        ).first()
        
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="找不到此訂閱方案"
            )
        
        item_name = f"{plan.name} x {request.quantity}個月"
        item_description = plan.description
        total_amount = plan.price_monthly * request.quantity
        credits_amount = None
        bonus_credits = None
        subscription_months = request.quantity
    
    # 取得客戶端資訊
    ip_address = req.client.host if req.client else None
    user_agent = req.headers.get("user-agent")
    
    # 處理推薦碼（如果用戶尚未綁定推薦人）
    try:
        if request.referral_code and not current_user.referred_by:
            # 驗證推薦碼是否存在且不是自己的
            referrer = db.query(User).filter(
                User.referral_code == request.referral_code.upper(),
                User.id != current_user.id
            ).first()
            
            if referrer:
                current_user.referred_by = referrer.referral_code
                db.commit()
                logger.info(f"用戶 {current_user.id} 綁定推薦人: {referrer.referral_code}")
    except Exception as e:
        logger.warning(f"推薦碼處理失敗: {e}")
        # 繼續處理訂單，不因推薦碼問題中斷
    
    # 建立訂單
    try:
        order = payment_service.create_order(
            user=current_user,
            order_type=request.order_type,
            item_code=request.item_code,
            item_name=item_name,
            item_description=item_description,
            total_amount=Decimal(str(total_amount)),
            credits_amount=credits_amount,
            bonus_credits=bonus_credits,
            subscription_months=subscription_months,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    except Exception as e:
        logger.error(f"建立訂單失敗: {e}")
        return {
            "success": False,
            "error": f"建立訂單失敗: {str(e)}",
        }
    
    # 自動選擇金流供應商（如果未指定）
    payment_provider = request.payment_provider or select_payment_provider(float(total_amount))
    logger.info(f"訂單 {order.order_no} 金額 NT${total_amount}，使用金流：{payment_provider}")
    
    # 設定回呼 URL
    return_url = f"{FRONTEND_URL}/dashboard/payment/result?order_no={order.order_no}"
    cancel_url = f"{FRONTEND_URL}/dashboard/pricing"
    notify_url = f"{os.getenv('BACKEND_URL', 'http://localhost:8000')}/payment/callback/{payment_provider}"
    
    # 發起支付
    try:
        result = payment_service.initiate_payment(
            order=order,
            provider=payment_provider,
            return_url=return_url,
            cancel_url=cancel_url,
            notify_url=notify_url,
            customer_email=current_user.email,
            payment_method=request.payment_method,
        )
    except Exception as e:
        logger.error(f"發起支付失敗: {e}")
        return {
            "success": False,
            "error": f"發起支付失敗: {str(e)}",
        }
    
    if not result.get("success"):
        return {
            "success": False,
            "error": result.get("error", "發起支付失敗"),
        }
    
    return {
        "success": True,
        "order_no": order.order_no,
        "payment_provider": payment_provider,
        "checkout_url": result.get("checkout_url"),
        "form_html": result.get("form_html"),
    }


@router.get("/orders", response_model=OrderListResponse)
async def list_orders(
    status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    取得用戶訂單列表
    """
    query = db.query(Order).filter(Order.user_id == current_user.id)
    
    if status:
        query = query.filter(Order.status == status)
    
    total = query.count()
    orders = query.order_by(Order.created_at.desc()).offset(offset).limit(limit).all()
    
    return {
        "success": True,
        "orders": [
            {
                "order_no": o.order_no,
                "order_type": o.order_type,
                "item_name": o.item_name,
                "total_amount": float(o.total_amount),
                "status": o.status,
                "payment_provider": o.payment_provider,
                "created_at": o.created_at.isoformat() if o.created_at else None,
                "paid_at": o.paid_at.isoformat() if o.paid_at else None,
            }
            for o in orders
        ],
        "total": total,
    }


@router.get("/orders/{order_no}", response_model=OrderDetailResponse)
async def get_order(
    order_no: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    取得訂單詳情
    """
    order = db.query(Order).filter(
        Order.order_no == order_no,
        Order.user_id == current_user.id,
    ).first()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到此訂單"
        )
    
    return {
        "success": True,
        "order": {
            "order_no": order.order_no,
            "order_type": order.order_type,
            "item_code": order.item_code,
            "item_name": order.item_name,
            "item_description": order.item_description,
            "total_amount": float(order.total_amount),
            "currency": order.currency,
            "credits_amount": order.credits_amount,
            "bonus_credits": order.bonus_credits,
            "subscription_months": order.subscription_months,
            "status": order.status,
            "payment_provider": order.payment_provider,
            "payment_method": order.payment_method,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "paid_at": order.paid_at.isoformat() if order.paid_at else None,
            "completed_at": order.completed_at.isoformat() if order.completed_at else None,
        },
    }


# ============================================================
# 支付回呼
# ============================================================

@router.post("/callback/ecpay")
async def ecpay_callback(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    綠界支付回呼
    """
    from app.services.payment_service import ECPayService
    
    try:
        form_data = await request.form()
        params = dict(form_data)
        
        logger.info(f"ECPay 回呼: {params}")
        
        # 驗證回呼
        ecpay = ECPayService()
        check_mac = params.pop("CheckMacValue", "")
        is_valid, message = ecpay.verify_callback(params)
        params["CheckMacValue"] = check_mac
        
        if not is_valid:
            logger.error(f"ECPay 驗證失敗: {message}")
            return Response(content="0|CheckMacValue Error", status_code=200)
        
        # 取得訂單
        merchant_trade_no = params.get("MerchantTradeNo")
        payment_service = get_payment_service(db)
        order = payment_service.get_order_by_ecpay_no(merchant_trade_no)
        
        if not order:
            logger.error(f"找不到訂單: {merchant_trade_no}")
            return Response(content="0|Order Not Found", status_code=200)
        
        # 處理付款結果
        rtn_code = params.get("RtnCode")
        is_success = rtn_code == "1"
        
        if is_success:
            order.ecpay_trade_no = params.get("TradeNo")
            order.payment_method = params.get("PaymentType")
        
        payment_service.process_payment_callback(
            order=order,
            is_success=is_success,
            provider_data=params,
        )
        
        return Response(content="1|OK", status_code=200)
        
    except Exception as e:
        logger.error(f"ECPay 回呼處理失敗: {e}")
        return Response(content="0|Error", status_code=200)


@router.post("/callback/newebpay")
async def newebpay_callback(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    藍新金流支付回呼
    """
    from app.services.payment_service import NewebPayService
    
    try:
        form_data = await request.form()
        params = dict(form_data)
        
        logger.info(f"NewebPay 回呼: TradeInfo={params.get('TradeInfo', '')[:50]}...")
        
        # 驗證並解密回呼
        newebpay = NewebPayService()
        is_valid, decrypted_data = newebpay.verify_callback(params)
        
        if not is_valid:
            logger.error(f"NewebPay 驗證失敗: {decrypted_data.get('error')}")
            return Response(content="Error", status_code=200)
        
        logger.info(f"NewebPay 解密資料: {decrypted_data}")
        
        # 取得訂單資訊
        result_data = decrypted_data.get("Result", {})
        if isinstance(result_data, str):
            import json
            result_data = json.loads(result_data)
        
        merchant_order_no = result_data.get("MerchantOrderNo")
        payment_service = get_payment_service(db)
        order = payment_service.get_order_by_newebpay_no(merchant_order_no)
        
        if not order:
            logger.error(f"找不到訂單: {merchant_order_no}")
            return Response(content="Order Not Found", status_code=200)
        
        # 處理付款結果
        status_code = decrypted_data.get("Status")
        is_success = status_code == "SUCCESS"
        
        if is_success:
            order.newebpay_trade_no = result_data.get("TradeNo")
            order.payment_method = result_data.get("PaymentType")
        
        payment_service.process_payment_callback(
            order=order,
            is_success=is_success,
            provider_data=decrypted_data,
        )
        
        return Response(content="OK", status_code=200)
        
    except Exception as e:
        logger.error(f"NewebPay 回呼處理失敗: {e}")
        return Response(content="Error", status_code=200)


@router.post("/callback/stripe")
async def stripe_callback(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Stripe Webhook 回呼
    """
    from app.services.payment_service import StripeService
    
    try:
        payload = await request.body()
        signature = request.headers.get("stripe-signature", "")
        
        stripe_service = StripeService()
        is_valid, event = stripe_service.verify_webhook(payload, signature)
        
        if not is_valid:
            logger.error(f"Stripe 驗證失敗: {event}")
            raise HTTPException(status_code=400, detail="Webhook 驗證失敗")
        
        event_type = event.get("type") if isinstance(event, dict) else event.type
        data = event.get("data", {}).get("object", {}) if isinstance(event, dict) else event.data.object
        
        logger.info(f"Stripe Webhook: {event_type}")
        
        if event_type == "checkout.session.completed":
            session_id = data.get("id") if isinstance(data, dict) else data.id
            
            payment_service = get_payment_service(db)
            order = payment_service.get_order_by_stripe_session(session_id)
            
            if order:
                payment_status = data.get("payment_status") if isinstance(data, dict) else data.payment_status
                is_success = payment_status == "paid"
                
                payment_service.process_payment_callback(
                    order=order,
                    is_success=is_success,
                    provider_data=data if isinstance(data, dict) else {"id": data.id},
                )
        
        return {"received": True}
        
    except Exception as e:
        logger.error(f"Stripe 回呼處理失敗: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# 綠界付款頁面
# ============================================================

@router.get("/ecpay/checkout/{order_no}", response_class=HTMLResponse)
async def ecpay_checkout_page(
    order_no: str,
    db: Session = Depends(get_db),
):
    """
    綠界付款頁面（自動提交表單）
    """
    order = db.query(Order).filter(Order.order_no == order_no).first()
    
    if not order:
        return HTMLResponse(
            content="<h1>訂單不存在</h1>",
            status_code=404,
        )
    
    if order.status not in [OrderStatus.PENDING.value, OrderStatus.PROCESSING.value]:
        return RedirectResponse(
            url=f"{FRONTEND_URL}/dashboard/payment/result?order_no={order_no}"
        )
    
    # 重新生成付款表單
    from app.services.payment_service import ECPayService
    
    ecpay = ECPayService()
    return_url = f"{FRONTEND_URL}/dashboard/payment/result?order_no={order_no}"
    notify_url = f"{os.getenv('BACKEND_URL', 'http://localhost:8000')}/payment/callback/ecpay"
    
    result = ecpay.create_payment(
        order=order,
        return_url=return_url,
        notify_url=notify_url,
        payment_method="ALL",
    )
    
    if result.get("success"):
        order.ecpay_merchant_trade_no = result["merchant_trade_no"]
        db.commit()
        return HTMLResponse(content=result["form_html"])
    
    return HTMLResponse(
        content=f"<h1>建立付款失敗</h1><p>{result.get('error')}</p>",
        status_code=500,
    )


# ============================================================
# 藍新金流付款頁面
# ============================================================

@router.get("/newebpay/checkout/{order_no}", response_class=HTMLResponse)
async def newebpay_checkout_page(
    order_no: str,
    db: Session = Depends(get_db),
):
    """
    藍新金流付款頁面（自動提交表單）
    """
    order = db.query(Order).filter(Order.order_no == order_no).first()
    
    if not order:
        return HTMLResponse(
            content="<h1>訂單不存在</h1>",
            status_code=404,
        )
    
    if order.status not in [OrderStatus.PENDING.value, OrderStatus.PROCESSING.value]:
        return RedirectResponse(
            url=f"{FRONTEND_URL}/dashboard/payment/result?order_no={order_no}"
        )
    
    # 生成付款表單
    from app.services.payment_service import NewebPayService
    
    newebpay = NewebPayService()
    return_url = f"{FRONTEND_URL}/dashboard/payment/result?order_no={order_no}"
    notify_url = f"{os.getenv('BACKEND_URL', 'http://localhost:8000')}/payment/callback/newebpay"
    
    result = newebpay.create_payment(
        order=order,
        return_url=return_url,
        notify_url=notify_url,
        payment_method="ALL",
    )
    
    if result.get("success"):
        order.newebpay_merchant_order_no = result["merchant_order_no"]
        db.commit()
        return HTMLResponse(content=result["form_html"])
    
    return HTMLResponse(
        content=f"<h1>建立付款失敗</h1><p>{result.get('error')}</p>",
        status_code=500,
    )


# ============================================================
# 查詢支付結果
# ============================================================

@router.get("/result/{order_no}")
async def get_payment_result(
    order_no: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    查詢支付結果
    """
    order = db.query(Order).filter(
        Order.order_no == order_no,
        Order.user_id == current_user.id,
    ).first()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到此訂單"
        )
    
    # 如果狀態仍在處理中，主動查詢金流狀態
    if order.status == OrderStatus.PROCESSING.value:
        payment_service = get_payment_service(db)
        
        # ECPay 主動查詢
        if order.payment_provider == PaymentProvider.ECPAY.value and order.ecpay_merchant_trade_no:
            from app.services.payment_service import ECPayService
            
            ecpay = ECPayService()
            result = ecpay.query_trade(order.ecpay_merchant_trade_no)
            
            if result.get("success"):
                trade_data = result["data"]
                trade_status = trade_data.get("TradeStatus")
                
                # TradeStatus: 0=未付款, 1=已付款, 10099031=已付款(舊版)
                if trade_status in ["1", "10099031"]:
                    logger.info(f"ECPay 主動查詢成功: 訂單 {order.order_no} 已付款")
                    order.ecpay_trade_no = trade_data.get("TradeNo")
                    order.payment_method = trade_data.get("PaymentType")
                    payment_service.process_payment_callback(
                        order=order,
                        is_success=True,
                        provider_data=trade_data,
                    )
        
        # Stripe 主動查詢
        elif order.payment_provider == PaymentProvider.STRIPE.value and order.stripe_checkout_session_id:
            from app.services.payment_service import StripeService
            
            stripe_service = StripeService()
            result = stripe_service.retrieve_session(order.stripe_checkout_session_id)
            
            if result.get("success"):
                session_data = result["data"]
                if session_data.get("payment_status") == "paid":
                    payment_service.process_payment_callback(
                        order=order,
                        is_success=True,
                        provider_data=session_data,
                    )
    
    return {
        "success": True,
        "order_no": order.order_no,
        "status": order.status,
        "item_name": order.item_name,
        "total_amount": float(order.total_amount),
        "credits_granted": (order.credits_amount or 0) + (order.bonus_credits or 0) if order.status == OrderStatus.COMPLETED.value else 0,
        "paid_at": order.paid_at.isoformat() if order.paid_at else None,
    }
