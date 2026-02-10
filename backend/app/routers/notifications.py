"""
站內通知 API
整合站內通知與電子郵件通知
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, Integer
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime

from app.database import get_db
from app.models import User, Notification
from app.routers.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["通知中心"])

# 通知類型對應的 Email 設定 key
NOTIFICATION_EMAIL_SETTINGS = {
    "system": "email_updates",
    "credit": "email_updates",
    "referral": "email_referral",
    "security": "email_security",
    "content": "email_updates",
    "payment": "email_updates",
    "schedule": "email_updates",
    "marketing": "email_marketing",
}

# 通知優先級常數
PRIORITY_IMPORTANT = "important"   # 導覽列顯示 + 郵件通知
PRIORITY_REMINDER = "reminder"     # 導覽列顯示
PRIORITY_GENERAL = "general"       # 只在通知中心顯示

# 各通知類型的預設優先級映射
DEFAULT_PRIORITY_MAP = {
    "payment": PRIORITY_IMPORTANT,
    "security": PRIORITY_IMPORTANT,
    "credit": PRIORITY_REMINDER,
    "referral": PRIORITY_REMINDER,
    "schedule": PRIORITY_REMINDER,
    "content": PRIORITY_GENERAL,
    "system": PRIORITY_GENERAL,
    "marketing": PRIORITY_GENERAL,
}


# ============================================================
# Pydantic 模型
# ============================================================

class NotificationResponse(BaseModel):
    id: int
    notification_type: str
    priority: str = "general"
    title: str
    message: str
    data: Optional[Any] = None
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    total: int
    unread_count: int


class CreateNotificationRequest(BaseModel):
    notification_type: str = "system"
    title: str
    message: str
    data: Optional[dict] = None


class MarkReadRequest(BaseModel):
    notification_ids: List[int]


# ============================================================
# API 端點
# ============================================================

@router.get("", response_model=NotificationListResponse)
async def get_notifications(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    notification_type: Optional[str] = None,
    priority: Optional[str] = None,
    unread_only: bool = False,
    navbar_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取得用戶通知列表
    
    Args:
        navbar_only: 若為 True，只回傳 important + reminder 優先級（導覽列用）
        priority: 篩選特定優先級 (important/reminder/general)
    """
    query = db.query(Notification).filter(
        Notification.user_id == current_user.id
    )
    
    if notification_type:
        query = query.filter(Notification.notification_type == notification_type)
    
    # 導覽列模式：只顯示 important + reminder
    if navbar_only:
        query = query.filter(Notification.priority.in_([PRIORITY_IMPORTANT, PRIORITY_REMINDER]))
    elif priority:
        query = query.filter(Notification.priority == priority)
    
    if unread_only:
        query = query.filter(Notification.is_read == False)
    
    total = query.count()
    
    # 未讀數根據是否為 navbar 模式分開計算
    if navbar_only:
        unread_count = db.query(Notification).filter(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
            Notification.priority.in_([PRIORITY_IMPORTANT, PRIORITY_REMINDER])
        ).count()
    else:
        unread_count = db.query(Notification).filter(
            Notification.user_id == current_user.id,
            Notification.is_read == False
        ).count()
    
    notifications = query.order_by(
        desc(Notification.created_at)
    ).offset(offset).limit(limit).all()
    
    return NotificationListResponse(
        notifications=[NotificationResponse.model_validate(n) for n in notifications],
        total=total,
        unread_count=unread_count
    )


@router.get("/unread-count")
async def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取得未讀通知數量"""
    count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).count()
    
    return {"unread_count": count}


@router.post("/{notification_id}/read")
async def mark_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """標記通知為已讀"""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="通知不存在")
    
    notification.is_read = True
    notification.read_at = datetime.utcnow()
    db.commit()
    
    return {"success": True, "message": "已標記為已讀"}


@router.post("/read-all")
async def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """標記所有通知為已讀"""
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({
        "is_read": True,
        "read_at": datetime.utcnow()
    })
    db.commit()
    
    return {"success": True, "message": "已標記所有通知為已讀"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """刪除通知"""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="通知不存在")
    
    db.delete(notification)
    db.commit()
    
    return {"success": True, "message": "通知已刪除"}


@router.delete("")
async def clear_all_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """清除所有通知"""
    db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).delete()
    db.commit()
    
    return {"success": True, "message": "所有通知已清除"}


@router.get("/stats")
async def get_notification_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取得通知統計"""
    # 總數
    total = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).count()
    
    # 未讀數
    unread = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).count()
    
    # 按類型統計
    type_stats = db.query(
        Notification.notification_type,
        func.count(Notification.id).label("count"),
        func.sum(func.cast(Notification.is_read == False, Integer)).label("unread")
    ).filter(
        Notification.user_id == current_user.id
    ).group_by(Notification.notification_type).all()
    
    by_type = {
        stat.notification_type: {
            "total": stat.count,
            "unread": stat.unread or 0
        }
        for stat in type_stats
    }
    
    return {
        "total": total,
        "unread": unread,
        "by_type": by_type
    }


@router.post("/mark-read-batch")
async def mark_batch_as_read(
    request: MarkReadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """批量標記通知為已讀"""
    updated = db.query(Notification).filter(
        Notification.id.in_(request.notification_ids),
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({
        "is_read": True,
        "read_at": datetime.utcnow()
    }, synchronize_session=False)
    
    db.commit()
    
    return {"success": True, "updated_count": updated}


@router.get("/types")
async def get_notification_types():
    """取得通知類型列表（含預設優先級）"""
    return {
        "types": [
            {"id": "payment", "name": "付款通知", "description": "付款成功、退款處理", "default_priority": "important"},
            {"id": "security", "name": "安全通知", "description": "登入提醒、密碼變更", "default_priority": "important"},
            {"id": "credit", "name": "點數通知", "description": "點數變動、餘額提醒", "default_priority": "reminder"},
            {"id": "referral", "name": "推薦通知", "description": "推薦獎勵、分潤入帳", "default_priority": "reminder"},
            {"id": "schedule", "name": "排程通知", "description": "排程發布結果", "default_priority": "reminder"},
            {"id": "content", "name": "內容通知", "description": "內容生成完成", "default_priority": "general"},
            {"id": "system", "name": "系統通知", "description": "平台更新、維護公告", "default_priority": "general"},
            {"id": "marketing", "name": "行銷通知", "description": "優惠活動、促銷資訊", "default_priority": "general"},
        ],
        "priorities": [
            {"id": "important", "name": "重要通知", "description": "上方導覽列顯示 + 郵件通知"},
            {"id": "reminder", "name": "提醒通知", "description": "上方導覽列顯示"},
            {"id": "general", "name": "一般通知", "description": "只顯示於通知中心"},
        ]
    }


# ============================================================
# 內部函數（供其他模組使用）
# ============================================================

def _should_send_email(user: User, notification_type: str) -> bool:
    """檢查是否應該發送 Email 通知"""
    if not user.email:
        return False
    
    settings = user.notification_settings or {}
    
    # 優先檢查 type_preferences（新版設定）
    type_prefs = settings.get("type_preferences")
    if type_prefs and notification_type in type_prefs:
        return type_prefs[notification_type].get("email", False)
    
    # 向後相容：檢查舊版 email_ 設定
    setting_key = NOTIFICATION_EMAIL_SETTINGS.get(notification_type, "email_updates")
    return settings.get(setting_key, True)


def _should_show_navbar(user: User, notification_type: str) -> bool:
    """檢查是否應在導覽列顯示"""
    settings = user.notification_settings or {}
    type_prefs = settings.get("type_preferences")
    if type_prefs and notification_type in type_prefs:
        return type_prefs[notification_type].get("navbar", True)
    
    # 預設：important + reminder 類型顯示在導覽列
    default_priority = DEFAULT_PRIORITY_MAP.get(notification_type, PRIORITY_GENERAL)
    return default_priority in [PRIORITY_IMPORTANT, PRIORITY_REMINDER]


def _send_notification_email(
    user: User,
    notification_type: str,
    title: str,
    message: str,
    data: Optional[dict] = None
):
    """發送通知郵件（背景執行）"""
    try:
        from app.services.email_service import get_email_service
        
        email_service = get_email_service()
        
        # 根據通知類型選擇郵件模板
        if notification_type == "payment" and data:
            # 付款相關通知
            if data.get("payment_status") == "success":
                email_service.send_payment_success(
                    to=user.email,
                    order_no=data.get("order_no", ""),
                    item_name=data.get("item_name", ""),
                    amount=data.get("amount", 0),
                    credits=data.get("credits", 0),
                    paid_at=datetime.utcnow(),
                    user_name=user.full_name
                )
                return
        
        elif notification_type == "security":
            # 安全通知
            email_service.send_security_alert(
                to=user.email,
                alert_type=title,
                message=message,
                ip_address=data.get("ip_address", "未知") if data else "未知",
                timestamp=datetime.utcnow(),
                location=data.get("location") if data else None,
                user_name=user.full_name
            )
            return
        
        elif notification_type == "schedule" and data:
            # 排程通知
            schedule_type = data.get("schedule_type", "info")
            email_service.send_schedule_notification(
                to=user.email,
                notification_type=schedule_type,
                title=title,
                message=message,
                post_url=data.get("post_url"),
                user_name=user.full_name
            )
            return
        
        elif notification_type == "credit" and data:
            # 點數不足提醒
            if data.get("alert_type") == "low_balance":
                email_service.send_low_credits_alert(
                    to=user.email,
                    balance=data.get("balance", 0),
                    threshold=data.get("threshold", 100),
                    user_name=user.full_name
                )
                return
        
        # 通用通知郵件
        email_service.send_notification(
            to=user.email,
            title=title,
            content_html=f"<p>{message}</p>",
            action_url=data.get("action_url") if data else None,
            action_text=data.get("action_text", "查看詳情") if data else "查看詳情",
            user_name=user.full_name
        )
        
    except Exception as e:
        logger.error(f"[Notification] 發送 Email 失敗: {e}")


def create_notification(
    db: Session,
    user_id: int,
    notification_type: str,
    title: str,
    message: str,
    data: Optional[dict] = None,
    send_email: Optional[bool] = None,
    priority: Optional[str] = None
) -> Notification:
    """
    建立通知（內部函數）
    
    Args:
        db: 資料庫 Session
        user_id: 用戶 ID
        notification_type: 通知類型
        title: 標題
        message: 內容
        data: 額外資料
        send_email: 是否同時發送 Email（None=自動依優先級決定）
        priority: 通知優先級 (important/reminder/general)，None=自動依類型決定
    """
    # 查詢用戶以獲取通知偏好設定
    user = db.query(User).filter(User.id == user_id).first()
    
    # 根據用戶偏好決定 priority
    if priority is None:
        if user:
            navbar_enabled = _should_show_navbar(user, notification_type)
            email_enabled = _should_send_email(user, notification_type)
            if email_enabled and navbar_enabled:
                priority = PRIORITY_IMPORTANT
            elif navbar_enabled:
                priority = PRIORITY_REMINDER
            else:
                priority = PRIORITY_GENERAL
        else:
            priority = DEFAULT_PRIORITY_MAP.get(notification_type, PRIORITY_GENERAL)
    
    # 自動決定是否發送 Email（依用戶偏好）
    if send_email is None:
        if user:
            send_email = _should_send_email(user, notification_type)
        else:
            send_email = (priority == PRIORITY_IMPORTANT)
    
    # 建立站內通知
    notification = Notification(
        user_id=user_id,
        notification_type=notification_type,
        priority=priority,
        title=title,
        message=message,
        data=data
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    
    # 發送 Email
    if send_email and user and user.email:
        import threading
        thread = threading.Thread(
            target=_send_notification_email,
            args=(user, notification_type, title, message, data)
        )
        thread.start()
    
    return notification


def create_system_notification(
    db: Session, 
    user_id: int, 
    title: str, 
    message: str,
    send_email: Optional[bool] = None,
    priority: Optional[str] = None
):
    """建立系統通知 (預設: general)"""
    return create_notification(db, user_id, "system", title, message, send_email=send_email, priority=priority)


def create_credit_notification(
    db: Session, 
    user_id: int, 
    title: str, 
    message: str, 
    data: dict = None,
    send_email: Optional[bool] = None,
    priority: Optional[str] = None
):
    """建立點數相關通知 (預設: reminder)"""
    return create_notification(db, user_id, "credit", title, message, data, send_email=send_email, priority=priority)


def create_referral_notification(
    db: Session, 
    user_id: int, 
    title: str, 
    message: str, 
    data: dict = None,
    send_email: Optional[bool] = None,
    priority: Optional[str] = None
):
    """建立推薦相關通知 (預設: reminder)"""
    return create_notification(db, user_id, "referral", title, message, data, send_email=send_email, priority=priority)


def create_security_notification(
    db: Session, 
    user_id: int, 
    title: str, 
    message: str, 
    data: dict = None,
    send_email: Optional[bool] = None,
    priority: Optional[str] = None
):
    """建立安全相關通知 (預設: important)"""
    return create_notification(db, user_id, "security", title, message, data, send_email=send_email, priority=priority)


def create_content_notification(
    db: Session, 
    user_id: int, 
    title: str, 
    message: str, 
    data: dict = None,
    send_email: Optional[bool] = None,
    priority: Optional[str] = None
):
    """建立內容生成相關通知 (預設: general)"""
    return create_notification(db, user_id, "content", title, message, data, send_email=send_email, priority=priority)


def create_payment_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    data: dict = None,
    send_email: Optional[bool] = None,
    priority: Optional[str] = None
):
    """建立付款相關通知 (預設: important)"""
    return create_notification(db, user_id, "payment", title, message, data, send_email=send_email, priority=priority)


def create_schedule_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    data: dict = None,
    send_email: Optional[bool] = None,
    priority: Optional[str] = None
):
    """建立排程相關通知 (預設: reminder)"""
    return create_notification(db, user_id, "schedule", title, message, data, send_email=send_email, priority=priority)


# ============================================================
# 批量通知
# ============================================================

def create_bulk_notification(
    db: Session,
    user_ids: List[int],
    notification_type: str,
    title: str,
    message: str,
    data: Optional[dict] = None,
    send_email: bool = False,
    priority: Optional[str] = None
) -> int:
    """
    批量建立通知
    
    Returns:
        建立的通知數量
    """
    if priority is None:
        priority = DEFAULT_PRIORITY_MAP.get(notification_type, PRIORITY_GENERAL)
    
    notifications = []
    for user_id in user_ids:
        notification = Notification(
            user_id=user_id,
            notification_type=notification_type,
            priority=priority,
            title=title,
            message=message,
            data=data
        )
        notifications.append(notification)
    
    db.add_all(notifications)
    db.commit()
    
    return len(notifications)


def create_broadcast_notification(
    db: Session,
    notification_type: str,
    title: str,
    message: str,
    data: Optional[dict] = None,
    active_only: bool = True
) -> int:
    """
    廣播通知給所有用戶
    
    Returns:
        建立的通知數量
    """
    query = db.query(User.id)
    if active_only:
        query = query.filter(User.is_active == True)
    
    user_ids = [u.id for u in query.all()]
    
    return create_bulk_notification(
        db=db,
        user_ids=user_ids,
        notification_type=notification_type,
        title=title,
        message=message,
        data=data,
        send_email=False  # 廣播不發 Email
    )
