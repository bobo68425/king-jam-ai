"""
募資行銷活動 API
- 銷售碼驗證與兌換
- 管理員：募資專案、方案、銷售碼管理
"""

import logging
import secrets
import string
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc

from app.database import get_db
from app.models import User, FundingProject, FundingTier, SalesCode, Order, SubscriptionPlan
from app.routers.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["募資行銷"])

# ============================================================
# Schemas
# ============================================================


class SalesCodeValidateResponse(BaseModel):
    valid: bool
    project_name: Optional[str] = None
    tier_name: Optional[str] = None
    plan_name: Optional[str] = None
    subscription_months: Optional[int] = None
    error: Optional[str] = None


class SalesCodeRedeemRequest(BaseModel):
    code: str = Field(..., min_length=4, max_length=32)


class SalesCodeRedeemResponse(BaseModel):
    success: bool
    order_no: Optional[str] = None
    message: Optional[str] = None
    error: Optional[str] = None


class GenerateSalesCodesRequest(BaseModel):
    tier_id: int = Field(..., gt=0)
    count: int = Field(..., ge=1, le=500)
    expires_in_days: Optional[int] = Field(None, ge=1, le=365)


class GenerateSalesCodesResponse(BaseModel):
    success: bool
    codes: List[str]
    count: int
    tier_name: Optional[str] = None
    error: Optional[str] = None


# ============================================================
# 銷售碼產生
# ============================================================


def generate_sales_code(prefix: str = "KJ") -> str:
    """產生可讀的銷售碼，格式：KJ-XXX-XXXX"""
    chars = string.ascii_uppercase + string.digits
    segment1 = "".join(secrets.choice(chars) for _ in range(4))
    segment2 = "".join(secrets.choice(chars) for _ in range(4))
    return f"{prefix}-{segment1}-{segment2}"


# ============================================================
# 公開 API：驗證銷售碼（未登入可驗證）
# ============================================================


@router.get("/payment/sales-code/validate", response_model=SalesCodeValidateResponse)
async def validate_sales_code(
    code: str = Query(..., min_length=4, max_length=32),
    db: Session = Depends(get_db),
):
    """
    驗證銷售碼是否有效
    未登入也可呼叫，用於前端輸入後即時驗證
    """
    code_upper = code.strip().upper()
    
    sales_code = db.query(SalesCode).filter(
        SalesCode.code == code_upper,
    ).first()
    
    if not sales_code:
        return SalesCodeValidateResponse(valid=False, error="無效的結帳碼")
    
    if sales_code.status == "redeemed":
        return SalesCodeValidateResponse(valid=False, error="此結帳碼已使用")
    
    if sales_code.status == "expired":
        return SalesCodeValidateResponse(valid=False, error="此結帳碼已過期")
    
    if sales_code.expires_at and sales_code.expires_at < datetime.utcnow():
        sales_code.status = "expired"
        db.commit()
        return SalesCodeValidateResponse(valid=False, error="此結帳碼已過期")
    
    # 取得方案與專案資訊
    tier = db.query(FundingTier).filter(FundingTier.id == sales_code.tier_id).first()
    if not tier or not tier.is_active:
        return SalesCodeValidateResponse(valid=False, error="此方案已停用")
    
    project = db.query(FundingProject).filter(FundingProject.id == tier.project_id).first()
    if not project or not project.is_active:
        return SalesCodeValidateResponse(valid=False, error="此專案已停用")
    
    plan = db.query(SubscriptionPlan).filter(
        SubscriptionPlan.plan_code == project.target_plan_code,
    ).first()
    plan_name = plan.name if plan else project.target_plan_code
    
    return SalesCodeValidateResponse(
        valid=True,
        project_name=project.name,
        tier_name=tier.tier_name,
        plan_name=plan_name,
        subscription_months=project.subscription_months,
    )


# ============================================================
# 兌換銷售碼（需登入）
# ============================================================


@router.post("/payment/sales-code/redeem", response_model=SalesCodeRedeemResponse)
async def redeem_sales_code(
    request: SalesCodeRedeemRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    兌換銷售碼
    建立 0 元訂單並直接完成，開通訂閱
    """
    code_upper = request.code.strip().upper()
    
    sales_code = db.query(SalesCode).filter(SalesCode.code == code_upper).first()
    
    if not sales_code:
        return SalesCodeRedeemResponse(success=False, error="無效的結帳碼")
    
    if sales_code.status == "redeemed":
        return SalesCodeRedeemResponse(success=False, error="此結帳碼已使用")
    
    if sales_code.status == "expired":
        return SalesCodeRedeemResponse(success=False, error="此結帳碼已過期")
    
    if sales_code.expires_at and sales_code.expires_at < datetime.utcnow():
        sales_code.status = "expired"
        db.commit()
        return SalesCodeRedeemResponse(success=False, error="此結帳碼已過期")
    
    tier = db.query(FundingTier).filter(FundingTier.id == sales_code.tier_id).first()
    if not tier or not tier.is_active:
        return SalesCodeRedeemResponse(success=False, error="此方案已停用")
    
    project = db.query(FundingProject).filter(FundingProject.id == tier.project_id).first()
    if not project or not project.is_active:
        return SalesCodeRedeemResponse(success=False, error="此專案已停用")
    
    plan = db.query(SubscriptionPlan).filter(
        SubscriptionPlan.plan_code == project.target_plan_code,
    ).first()
    plan_name = plan.name if plan else project.target_plan_code
    
    # 產生訂單編號
    from app.services.payment_service import generate_order_no
    order_no = generate_order_no()
    
    # 建立 0 元訂單
    order = Order(
        order_no=order_no,
        user_id=current_user.id,
        order_type="subscription",
        item_code=project.target_plan_code,
        item_name=f"{project.name} {tier.tier_name} - {plan_name} {project.subscription_months} 個月",
        item_description=f"募資結帳碼兌換：{project.name} {tier.tier_name}",
        quantity=1,
        unit_price=0,
        total_amount=0,
        currency="TWD",
        subscription_months=project.subscription_months,
        credits_amount=None,
        bonus_credits=None,
        payment_provider="sales_code",
        payment_method="sales_code",
        status="completed",
        paid_at=datetime.utcnow(),
        completed_at=datetime.utcnow(),
    )
    db.add(order)
    db.flush()
    
    # 標記銷售碼已兌換
    sales_code.status = "redeemed"
    sales_code.redeemer_user_id = current_user.id
    sales_code.redeemed_at = datetime.utcnow()
    sales_code.order_id = order.id
    
    # 履行訂閱開通
    from app.services.payment_service import PaymentService, OrderStatus
    payment_service = PaymentService(db)
    payment_service._fulfill_order(order)
    
    db.commit()
    
    logger.info(
        f"Sales code redeemed: code={code_upper}, user={current_user.id}, "
        f"project={project.name}, tier={tier.tier_name}, order={order_no}"
    )
    
    return SalesCodeRedeemResponse(
        success=True,
        order_no=order_no,
        message=f"兌換成功！已開通 {plan_name} {project.subscription_months} 個月",
    )


# ============================================================
# 管理員 API
# ============================================================


@router.get("/admin/funding/projects")
async def list_funding_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """募資專案列表"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    projects = db.query(FundingProject).order_by(FundingProject.sort_order).all()
    
    return {
        "success": True,
        "projects": [
            {
                "id": p.id,
                "project_code": p.project_code,
                "name": p.name,
                "description": p.description,
                "target_plan_code": p.target_plan_code,
                "subscription_months": p.subscription_months,
                "fundraising_platform": p.fundraising_platform,
                "platform_url": p.platform_url,
                "is_active": p.is_active,
                "sort_order": p.sort_order,
                "tiers": [
                    {
                        "id": t.id,
                        "tier_code": t.tier_code,
                        "tier_name": t.tier_name,
                        "fundraising_price_twd": float(t.fundraising_price_twd),
                        "original_price_twd": float(t.original_price_twd) if t.original_price_twd else None,
                        "is_active": t.is_active,
                    }
                    for t in p.tiers
                ],
            }
            for p in projects
        ],
    }


class FundingProjectCreate(BaseModel):
    project_code: str = Field(..., min_length=2, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    target_plan_code: str = Field(..., min_length=2, max_length=50)
    subscription_months: int = Field(6, ge=1, le=24)
    description: Optional[str] = None
    fundraising_platform: Optional[str] = None
    platform_url: Optional[str] = None


class FundingTierCreate(BaseModel):
    project_id: int = Field(..., gt=0)
    tier_code: str = Field(..., min_length=2, max_length=50)
    tier_name: str = Field(..., min_length=1, max_length=100)
    fundraising_price_twd: float = Field(..., ge=0)
    original_price_twd: Optional[float] = Field(None, ge=0)


@router.post("/admin/funding/projects")
async def create_funding_project(
    body: FundingProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """建立募資專案"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    existing = db.query(FundingProject).filter(
        FundingProject.project_code == body.project_code,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="專案代碼已存在")
    
    project = FundingProject(
        project_code=body.project_code,
        name=body.name,
        description=body.description,
        target_plan_code=body.target_plan_code,
        subscription_months=body.subscription_months,
        fundraising_platform=body.fundraising_platform,
        platform_url=body.platform_url,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    
    return {"success": True, "project": {"id": project.id, "project_code": project.project_code}}


@router.post("/admin/funding/tiers")
async def create_funding_tier(
    body: FundingTierCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """建立募資方案層級"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    project = db.query(FundingProject).filter(FundingProject.id == body.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="專案不存在")
    
    tier = FundingTier(
        project_id=body.project_id,
        tier_code=body.tier_code,
        tier_name=body.tier_name,
        fundraising_price_twd=body.fundraising_price_twd,
        original_price_twd=body.original_price_twd,
    )
    db.add(tier)
    db.commit()
    db.refresh(tier)
    
    return {"success": True, "tier": {"id": tier.id, "tier_code": tier.tier_code}}


@router.post("/admin/funding/sales-codes/generate", response_model=GenerateSalesCodesResponse)
async def generate_sales_codes(
    request: GenerateSalesCodesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """批次產生銷售碼"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    tier = db.query(FundingTier).filter(FundingTier.id == request.tier_id).first()
    if not tier:
        return GenerateSalesCodesResponse(success=False, error="方案不存在")
    
    expires_at = None
    if request.expires_in_days:
        expires_at = datetime.utcnow() + timedelta(days=request.expires_in_days)
    
    prefix = "KJ"
    codes = []
    for _ in range(request.count):
        code = generate_sales_code(prefix)
        while db.query(SalesCode).filter(SalesCode.code == code).first():
            code = generate_sales_code(prefix)
        
        sc = SalesCode(
            code=code,
            tier_id=request.tier_id,
            expires_at=expires_at,
        )
        db.add(sc)
        codes.append(code)
    
    db.commit()
    
    logger.info(
        f"Generated {len(codes)} sales codes for tier_id={request.tier_id} by admin {current_user.id}"
    )
    
    return GenerateSalesCodesResponse(
        success=True,
        codes=codes,
        count=len(codes),
        tier_name=tier.tier_name,
    )


@router.get("/admin/funding/sales-codes")
async def list_sales_codes(
    tier_id: Optional[int] = None,
    status: Optional[str] = None,
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """銷售碼列表"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    query = (
        db.query(SalesCode)
        .options(joinedload(SalesCode.redeemer))
        .join(FundingTier)
        .join(FundingProject)
    )
    
    if tier_id:
        query = query.filter(SalesCode.tier_id == tier_id)
    if status:
        query = query.filter(SalesCode.status == status)
    
    total = query.count()
    items = query.order_by(desc(SalesCode.created_at)).offset(offset).limit(limit).all()
    
    return {
        "success": True,
        "total": total,
        "codes": [
            {
                "id": s.id,
                "code": s.code,
                "tier_name": s.tier.tier_name,
                "project_name": s.tier.project.name,
                "status": s.status,
                "redeemed_at": s.redeemed_at.isoformat() if s.redeemed_at else None,
                "expires_at": s.expires_at.isoformat() if s.expires_at else None,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "redeemer_email": s.redeemer.email if s.redeemer else None,
            }
            for s in items
        ],
    }
