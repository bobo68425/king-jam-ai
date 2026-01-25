"""
管理後台 - 通知中心 API
發送系統公告、批量通知、用戶訊息等
"""

import logging
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, Integer

from app.database import get_db
from app.models import User, Notification, NotificationTemplate
from app.routers.auth import get_current_user
from app.routers.notifications import (
    create_notification, 
    create_bulk_notification,
    create_broadcast_notification
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/notifications", tags=["管理後台 - 通知中心"])


# ============================================================
# Pydantic Models
# ============================================================

class SendNotificationRequest(BaseModel):
    """發送通知給指定用戶"""
    user_ids: List[int] = Field(..., description="目標用戶 ID 列表")
    notification_type: str = Field(default="system", description="通知類型")
    title: str = Field(..., max_length=100, description="標題")
    message: str = Field(..., max_length=1000, description="內容")
    action_url: Optional[str] = Field(default=None, description="操作連結")
    send_email: bool = Field(default=False, description="同時發送 Email")


class BroadcastRequest(BaseModel):
    """廣播通知"""
    notification_type: str = Field(default="system")
    title: str = Field(..., max_length=100)
    message: str = Field(..., max_length=1000)
    action_url: Optional[str] = None
    target_tier: Optional[str] = Field(default=None, description="目標方案（空為全部）")
    send_email: bool = False


class AnnouncementRequest(BaseModel):
    """系統公告"""
    title: str = Field(..., max_length=100)
    message: str = Field(..., max_length=2000)
    announcement_type: str = Field(default="info", description="info, warning, maintenance, feature")
    action_url: Optional[str] = None
    priority: str = Field(default="normal", description="normal, high, urgent")
    send_email: bool = False


class TemplateCreate(BaseModel):
    """建立通知模板"""
    name: str = Field(..., max_length=100, description="模板名稱")
    code: str = Field(..., max_length=50, description="模板代碼（唯一）")
    description: Optional[str] = None
    notification_type: str = Field(default="system")
    title: str = Field(..., max_length=200)
    message: str = Field(...)
    action_url: Optional[str] = None
    action_text: Optional[str] = None
    variables: Optional[List[dict]] = Field(default=[])
    category: Optional[str] = None


class TemplateUpdate(BaseModel):
    """更新通知模板"""
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    notification_type: Optional[str] = None
    title: Optional[str] = Field(None, max_length=200)
    message: Optional[str] = None
    action_url: Optional[str] = None
    action_text: Optional[str] = None
    variables: Optional[List[dict]] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None


# ============================================================
# 通知統計
# ============================================================

@router.get("/stats")
async def get_notification_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取得通知統計"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    # 總通知數
    total = db.query(func.count(Notification.id)).scalar()
    
    # 今日發送
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_count = db.query(func.count(Notification.id)).filter(
        Notification.created_at >= today
    ).scalar()
    
    # 未讀總數
    unread_total = db.query(func.count(Notification.id)).filter(
        Notification.is_read == False
    ).scalar()
    
    # 按類型統計
    type_stats = db.query(
        Notification.notification_type,
        func.count(Notification.id).label("count")
    ).group_by(Notification.notification_type).all()
    
    # 最近 7 天趨勢
    from datetime import timedelta
    trend = []
    for i in range(7):
        day = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=i)
        next_day = day + timedelta(days=1)
        count = db.query(func.count(Notification.id)).filter(
            Notification.created_at >= day,
            Notification.created_at < next_day
        ).scalar()
        trend.append({
            "date": day.strftime("%m/%d"),
            "count": count
        })
    
    return {
        "success": True,
        "stats": {
            "total": total,
            "today": today_count,
            "unread": unread_total,
            "by_type": {stat.notification_type: stat.count for stat in type_stats},
            "trend": list(reversed(trend))
        }
    }


# ============================================================
# 發送通知
# ============================================================

@router.post("/send")
async def send_notification(
    request: SendNotificationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """發送通知給指定用戶"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    if not request.user_ids:
        raise HTTPException(status_code=400, detail="請選擇目標用戶")
    
    # 準備通知數據
    data = {"admin_sender": current_user.id}
    if request.action_url:
        data["action_url"] = request.action_url
    
    success_count = 0
    
    for user_id in request.user_ids:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            continue
        
        create_notification(
            db=db,
            user_id=user_id,
            notification_type=request.notification_type,
            title=request.title,
            message=request.message,
            data=data,
            send_email=request.send_email
        )
        success_count += 1
    
    logger.info(
        f"[AdminNotification] 發送通知 - 標題: {request.title}, "
        f"目標: {len(request.user_ids)}, 成功: {success_count}, "
        f"操作者: {current_user.email}"
    )
    
    return {
        "success": True,
        "sent_count": success_count,
        "total_targets": len(request.user_ids)
    }


@router.post("/broadcast")
async def broadcast_notification(
    request: BroadcastRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """廣播通知給所有用戶（或指定方案用戶）"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    # 取得目標用戶
    query = db.query(User.id).filter(User.is_active == True)
    
    if request.target_tier:
        query = query.filter(User.tier == request.target_tier)
    
    user_ids = [u.id for u in query.all()]
    
    if not user_ids:
        return {
            "success": False,
            "error": "沒有符合條件的用戶"
        }
    
    # 準備通知數據
    data = {
        "broadcast": True,
        "admin_sender": current_user.id
    }
    if request.action_url:
        data["action_url"] = request.action_url
    
    # 批量建立通知
    count = create_bulk_notification(
        db=db,
        user_ids=user_ids,
        notification_type=request.notification_type,
        title=request.title,
        message=request.message,
        data=data,
        send_email=False  # 廣播不發 email
    )
    
    logger.info(
        f"[AdminNotification] 廣播通知 - 標題: {request.title}, "
        f"目標方案: {request.target_tier or '全部'}, 發送數: {count}, "
        f"操作者: {current_user.email}"
    )
    
    return {
        "success": True,
        "sent_count": count,
        "target_tier": request.target_tier or "all"
    }


@router.post("/announcement")
async def send_announcement(
    request: AnnouncementRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """發送系統公告"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    # 取得所有活躍用戶
    user_ids = [u.id for u in db.query(User.id).filter(User.is_active == True).all()]
    
    # 根據公告類型設定通知類型和樣式
    notification_type = "system"
    icon_map = {
        "info": "ℹ️",
        "warning": "⚠️",
        "maintenance": "🔧",
        "feature": "✨",
        "celebration": "🎉"
    }
    icon = icon_map.get(request.announcement_type, "📢")
    
    # 準備通知數據
    data = {
        "announcement": True,
        "announcement_type": request.announcement_type,
        "priority": request.priority,
        "admin_sender": current_user.id
    }
    if request.action_url:
        data["action_url"] = request.action_url
    
    # 批量建立通知
    count = create_bulk_notification(
        db=db,
        user_ids=user_ids,
        notification_type=notification_type,
        title=f"{icon} {request.title}",
        message=request.message,
        data=data,
        send_email=request.send_email
    )
    
    logger.info(
        f"[AdminNotification] 系統公告 - 標題: {request.title}, "
        f"類型: {request.announcement_type}, 發送數: {count}, "
        f"操作者: {current_user.email}"
    )
    
    return {
        "success": True,
        "sent_count": count,
        "announcement_type": request.announcement_type
    }


# ============================================================
# 通知記錄查詢
# ============================================================

@router.get("/history")
async def get_notification_history(
    notification_type: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取得通知發送歷史"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    # 按標題分組統計
    query = db.query(
        Notification.title,
        Notification.notification_type,
        func.count(Notification.id).label("count"),
        func.sum(func.cast(Notification.is_read, Integer)).label("read_count"),
        func.min(Notification.created_at).label("sent_at"),
    )
    
    if notification_type:
        query = query.filter(Notification.notification_type == notification_type)
    
    if search:
        query = query.filter(Notification.title.ilike(f"%{search}%"))
    
    results = query.group_by(
        Notification.title,
        Notification.notification_type
    ).order_by(
        desc(func.max(Notification.created_at))
    ).offset(offset).limit(limit).all()
    
    return {
        "success": True,
        "notifications": [
            {
                "title": r.title,
                "notification_type": r.notification_type,
                "sent_count": r.count,
                "read_count": r.read_count or 0,
                "read_rate": round((r.read_count or 0) / r.count * 100, 1) if r.count > 0 else 0,
                "sent_at": r.sent_at.isoformat() if r.sent_at else None,
            }
            for r in results
        ]
    }


@router.get("/user/{user_id}")
async def get_user_notifications(
    user_id: int,
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """查看特定用戶的通知記錄"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用戶不存在")
    
    notifications = db.query(Notification).filter(
        Notification.user_id == user_id
    ).order_by(desc(Notification.created_at)).limit(limit).all()
    
    unread_count = db.query(func.count(Notification.id)).filter(
        Notification.user_id == user_id,
        Notification.is_read == False
    ).scalar()
    
    return {
        "success": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name
        },
        "unread_count": unread_count,
        "notifications": [
            {
                "id": n.id,
                "notification_type": n.notification_type,
                "title": n.title,
                "message": n.message[:100] + "..." if len(n.message) > 100 else n.message,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notifications
        ]
    }


# ============================================================
# 通知模板 CRUD
# ============================================================

@router.get("/templates")
async def get_notification_templates(
    category: Optional[str] = None,
    is_active: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取得通知模板列表"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    query = db.query(NotificationTemplate)
    
    if category:
        query = query.filter(NotificationTemplate.category == category)
    
    if is_active:
        query = query.filter(NotificationTemplate.is_active == True)
    
    templates = query.order_by(NotificationTemplate.created_at.desc()).all()
    
    return {
        "success": True,
        "templates": [
            {
                "id": t.id,
                "code": t.code,
                "name": t.name,
                "description": t.description,
                "notification_type": t.notification_type,
                "title": t.title,
                "message": t.message,
                "action_url": t.action_url,
                "action_text": t.action_text,
                "variables": t.variables or [],
                "category": t.category,
                "is_active": t.is_active,
                "is_system": t.is_system,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in templates
        ]
    }


@router.post("/templates")
async def create_template(
    request: TemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """建立通知模板"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    # 檢查代碼是否已存在
    existing = db.query(NotificationTemplate).filter(
        NotificationTemplate.code == request.code
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="模板代碼已存在")
    
    template = NotificationTemplate(
        name=request.name,
        code=request.code,
        description=request.description,
        notification_type=request.notification_type,
        title=request.title,
        message=request.message,
        action_url=request.action_url,
        action_text=request.action_text,
        variables=request.variables or [],
        category=request.category,
        created_by=current_user.id,
    )
    
    db.add(template)
    db.commit()
    db.refresh(template)
    
    logger.info(f"[Template] 建立模板: {template.code}, 操作者: {current_user.email}")
    
    return {
        "success": True,
        "template": {
            "id": template.id,
            "code": template.code,
            "name": template.name,
        }
    }


@router.get("/templates/{template_id}")
async def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取得模板詳情"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    template = db.query(NotificationTemplate).filter(
        NotificationTemplate.id == template_id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    return {
        "success": True,
        "template": {
            "id": template.id,
            "code": template.code,
            "name": template.name,
            "description": template.description,
            "notification_type": template.notification_type,
            "title": template.title,
            "message": template.message,
            "action_url": template.action_url,
            "action_text": template.action_text,
            "variables": template.variables or [],
            "category": template.category,
            "is_active": template.is_active,
            "is_system": template.is_system,
            "created_at": template.created_at.isoformat() if template.created_at else None,
            "updated_at": template.updated_at.isoformat() if template.updated_at else None,
        }
    }


@router.put("/templates/{template_id}")
async def update_template(
    template_id: int,
    request: TemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """更新通知模板"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    template = db.query(NotificationTemplate).filter(
        NotificationTemplate.id == template_id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    # 更新欄位
    update_data = request.dict(exclude_unset=True)
    for key, value in update_data.items():
        if value is not None:
            setattr(template, key, value)
    
    db.commit()
    
    logger.info(f"[Template] 更新模板: {template.code}, 操作者: {current_user.email}")
    
    return {
        "success": True,
        "message": "模板已更新"
    }


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """刪除通知模板"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    template = db.query(NotificationTemplate).filter(
        NotificationTemplate.id == template_id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    if template.is_system:
        raise HTTPException(status_code=400, detail="系統模板不可刪除")
    
    db.delete(template)
    db.commit()
    
    logger.info(f"[Template] 刪除模板: {template.code}, 操作者: {current_user.email}")
    
    return {
        "success": True,
        "message": "模板已刪除"
    }


@router.post("/templates/init-defaults")
async def init_default_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """初始化預設模板"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    default_templates = [
        {
            "code": "maintenance",
            "name": "系統維護公告",
            "notification_type": "system",
            "category": "system",
            "title": "🔧 系統維護通知",
            "message": "親愛的用戶您好，\n\n系統將於 {date} {time} 進行例行維護，預計維護時間約 {duration}。\n\n維護期間部分功能可能暫時無法使用，造成不便敬請見諒。\n\n感謝您的支持！",
            "variables": [
                {"name": "date", "description": "維護日期"},
                {"name": "time", "description": "維護時間"},
                {"name": "duration", "description": "預計時長"},
            ],
            "is_system": True,
        },
        {
            "code": "new_feature",
            "name": "新功能上線",
            "notification_type": "system",
            "category": "system",
            "title": "✨ 新功能上線",
            "message": "親愛的用戶您好，\n\n我們很高興地宣布 {feature_name} 功能正式上線！\n\n{feature_description}\n\n立即前往體驗吧！",
            "variables": [
                {"name": "feature_name", "description": "功能名稱"},
                {"name": "feature_description", "description": "功能說明"},
            ],
            "is_system": True,
        },
        {
            "code": "promotion",
            "name": "促銷活動",
            "notification_type": "marketing",
            "category": "marketing",
            "title": "🎉 限時優惠活動",
            "message": "親愛的用戶您好，\n\n{promotion_name} 活動開跑！\n\n{promotion_description}\n\n活動期間：{start_date} ~ {end_date}\n\n千萬別錯過！",
            "variables": [
                {"name": "promotion_name", "description": "活動名稱"},
                {"name": "promotion_description", "description": "活動說明"},
                {"name": "start_date", "description": "開始日期"},
                {"name": "end_date", "description": "結束日期"},
            ],
            "is_system": True,
        },
        {
            "code": "credits_gift",
            "name": "點數贈送",
            "notification_type": "credit",
            "category": "transactional",
            "title": "🎁 您收到了點數禮物！",
            "message": "親愛的用戶您好，\n\n感謝您的支持！我們特別贈送您 {credits} 點，快去體驗最新的 AI 功能吧！\n\n此點數有效期限至 {expiry_date}。",
            "action_url": "/dashboard/credits",
            "action_text": "查看點數",
            "variables": [
                {"name": "credits", "description": "點數數量"},
                {"name": "expiry_date", "description": "有效期限"},
            ],
            "is_system": True,
        },
        {
            "code": "welcome",
            "name": "歡迎訊息",
            "notification_type": "system",
            "category": "transactional",
            "title": "👋 歡迎加入 King Jam AI！",
            "message": "親愛的 {user_name}，\n\n歡迎加入 King Jam AI！\n\n您已獲得 100 點免費點數，可以開始體驗 AI 文章生成、社群圖文設計、短影片製作等功能。\n\n如有任何問題，歡迎聯繫我們的客服團隊！",
            "action_url": "/dashboard",
            "action_text": "開始使用",
            "variables": [
                {"name": "user_name", "description": "用戶名稱"},
            ],
            "is_system": True,
        },
        {
            "code": "security_alert",
            "name": "安全提醒",
            "notification_type": "security",
            "category": "transactional",
            "title": "🔒 安全提醒",
            "message": "親愛的用戶您好，\n\n我們偵測到您的帳號有異常活動。為了保護您的帳號安全，建議您：\n\n1. 立即變更密碼\n2. 啟用雙重認證\n3. 檢查近期登入記錄\n\n如非本人操作，請立即聯繫客服。",
            "action_url": "/dashboard/profile",
            "action_text": "前往設定",
            "is_system": True,
        },
        {
            "code": "payment_success",
            "name": "付款成功",
            "notification_type": "credit",
            "category": "transactional",
            "title": "✅ 付款成功",
            "message": "親愛的用戶您好，\n\n您的訂單 {order_no} 已付款成功！\n\n商品：{item_name}\n金額：NT${amount}\n獲得點數：{credits} 點\n\n感謝您的支持！",
            "action_url": "/dashboard/credits",
            "action_text": "查看點數",
            "variables": [
                {"name": "order_no", "description": "訂單編號"},
                {"name": "item_name", "description": "商品名稱"},
                {"name": "amount", "description": "付款金額"},
                {"name": "credits", "description": "獲得點數"},
            ],
            "is_system": True,
        },
        {
            "code": "low_credits",
            "name": "點數不足提醒",
            "notification_type": "credit",
            "category": "transactional",
            "title": "⚠️ 點數餘額不足",
            "message": "親愛的用戶您好，\n\n您的點數餘額已不足 {threshold} 點，目前餘額為 {balance} 點。\n\n為了確保您能繼續使用 AI 內容創作服務，建議您儘快購買點數。",
            "action_url": "/dashboard/pricing",
            "action_text": "購買點數",
            "variables": [
                {"name": "threshold", "description": "門檻值"},
                {"name": "balance", "description": "目前餘額"},
            ],
            "is_system": True,
        },
    ]
    
    created_count = 0
    skipped_count = 0
    
    for tpl in default_templates:
        existing = db.query(NotificationTemplate).filter(
            NotificationTemplate.code == tpl["code"]
        ).first()
        
        if existing:
            skipped_count += 1
            continue
        
        template = NotificationTemplate(
            code=tpl["code"],
            name=tpl["name"],
            notification_type=tpl["notification_type"],
            category=tpl.get("category"),
            title=tpl["title"],
            message=tpl["message"],
            action_url=tpl.get("action_url"),
            action_text=tpl.get("action_text"),
            variables=tpl.get("variables", []),
            is_system=tpl.get("is_system", False),
            created_by=current_user.id,
        )
        db.add(template)
        created_count += 1
    
    db.commit()
    
    logger.info(f"[Template] 初始化預設模板: 建立 {created_count}, 跳過 {skipped_count}")
    
    return {
        "success": True,
        "created": created_count,
        "skipped": skipped_count
    }


@router.post("/templates/{template_id}/use")
async def use_template(
    template_id: int,
    user_ids: List[int],
    variables: Optional[dict] = None,
    send_email: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """使用模板發送通知"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    template = db.query(NotificationTemplate).filter(
        NotificationTemplate.id == template_id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    # 替換變數
    title = template.title
    message = template.message
    
    if variables:
        for key, value in variables.items():
            title = title.replace(f"{{{key}}}", str(value))
            message = message.replace(f"{{{key}}}", str(value))
    
    # 發送通知
    data = {"template_code": template.code}
    if template.action_url:
        data["action_url"] = template.action_url
    if template.action_text:
        data["action_text"] = template.action_text
    
    count = create_bulk_notification(
        db=db,
        user_ids=user_ids,
        notification_type=template.notification_type,
        title=title,
        message=message,
        data=data,
        send_email=send_email
    )
    
    logger.info(
        f"[Template] 使用模板發送: {template.code}, "
        f"目標: {len(user_ids)}, 發送: {count}, "
        f"操作者: {current_user.email}"
    )
    
    return {
        "success": True,
        "sent_count": count,
        "template_code": template.code
    }
