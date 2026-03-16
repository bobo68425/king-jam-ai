"""
管理員 API
系統管理、儲存管理、清理任務、健康監控
"""

from fastapi import APIRouter, Depends, HTTPException, status, Response, Query
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from datetime import datetime, timedelta
import asyncio
import os

from app.database import get_db
from app.models import (
    User, Order, WithdrawalRequest, RefundRequest, ScheduledPost,
    CreditTransaction, GenerationHistory, IdentityVerification, Expense
)
from app.routers.auth import get_current_user
from app.services.lifecycle_manager import lifecycle_manager
from app.services.rate_limiter import video_rate_limiter
from app.services.monitoring import system_monitor
from app.core.admin_security import require_super_admin, is_super_admin

router = APIRouter(prefix="/admin", tags=["管理"])


# ============================================================
# 儲存管理
# ============================================================

class CleanupRequest(BaseModel):
    dry_run: bool = True  # 預設為試運行


class CleanupResponse(BaseModel):
    success: bool
    dry_run: bool
    local_files_cleaned: int
    local_bytes_freed: int
    local_mb_freed: float
    cloud_files_cleaned: int
    db_records_updated: int
    errors: list
    details: list


@router.get("/storage/stats")
async def get_storage_stats(
    current_user: User = Depends(get_current_user)
):
    """
    獲取儲存統計
    
    包括：
    - 本地檔案數量和大小
    - 各類型記錄數量
    - 過期記錄統計
    """
    # 檢查管理員權限（簡單檢查，可根據需求擴展）
    if current_user.email not in ["admin@kingjam.ai", "james@kingjam.ai"]:
        # 普通用戶只能看自己的統計
        pass
    
    stats = lifecycle_manager.get_storage_stats()
    
    return {
        "success": True,
        "stats": stats,
        "retention_policies": lifecycle_manager.RETENTION_POLICIES,
    }


@router.post("/storage/cleanup", response_model=CleanupResponse)
async def cleanup_storage(
    request: CleanupRequest,
    current_user: User = Depends(get_current_user)
):
    """
    手動清理過期媒體
    
    需要管理員權限
    
    Args:
        dry_run: True=只統計不刪除, False=實際刪除
    """
    # 檢查管理員權限
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理員權限"
        )
    
    report = lifecycle_manager.cleanup_expired_media(dry_run=request.dry_run)
    
    return CleanupResponse(
        success=report.get("success", False),
        dry_run=request.dry_run,
        local_files_cleaned=report.get("local_files_cleaned", 0),
        local_bytes_freed=report.get("local_bytes_freed", 0),
        local_mb_freed=round(report.get("local_bytes_freed", 0) / 1024 / 1024, 2),
        cloud_files_cleaned=report.get("cloud_files_cleaned", 0),
        db_records_updated=report.get("db_records_updated", 0),
        errors=report.get("errors", []),
        details=report.get("details", [])[:50],  # 限制詳情數量
    )


@router.post("/storage/cleanup-async")
async def cleanup_storage_async(
    request: CleanupRequest,
    current_user: User = Depends(get_current_user)
):
    """
    非同步清理過期媒體（透過 Celery）
    
    適用於大量檔案清理
    """
    # 檢查管理員權限
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理員權限"
        )
    
    from app.tasks.cleanup_tasks import cleanup_expired_media
    
    task = cleanup_expired_media.delay(dry_run=request.dry_run)
    
    return {
        "success": True,
        "task_id": task.id,
        "message": "清理任務已提交",
        "dry_run": request.dry_run,
    }


# ============================================================
# 系統狀態
# ============================================================

@router.get("/system/status")
async def get_system_status(
    current_user: User = Depends(get_current_user)
):
    """
    獲取系統狀態
    
    包括：
    - 影片任務佇列狀態
    - 記憶體使用
    - 儲存使用
    """
    # 影片任務佇列狀態
    queue_status = video_rate_limiter.get_system_status()
    
    # 儲存統計
    storage_stats = lifecycle_manager.get_storage_stats()
    
    return {
        "success": True,
        "queue": queue_status,
        "storage": {
            "local_size_mb": storage_stats.get("local", {}).get("total_size_mb", 0),
            "videos_count": storage_stats.get("local", {}).get("videos", {}).get("count", 0),
        },
        "retention_policies": lifecycle_manager.RETENTION_POLICIES,
    }


@router.get("/user/task-stats")
async def get_user_task_stats(
    current_user: User = Depends(get_current_user)
):
    """
    獲取當前用戶的任務統計
    """
    stats = video_rate_limiter.get_user_stats(current_user.id)
    
    return {
        "success": True,
        "user_id": current_user.id,
        **stats,
    }


# ============================================================
# 健康監控
# ============================================================

@router.get("/health/full")
async def full_health_check(
    current_user: User = Depends(get_current_user)
):
    """
    完整健康檢查
    
    檢查所有組件狀態，返回詳細報告
    """
    report = await system_monitor.check_all()
    
    return {
        "success": True,
        **report,
    }


@router.get("/health/quick")
async def quick_health_check():
    """
    快速健康檢查（公開端點）
    
    僅檢查核心服務，供外部監控使用
    """
    result = {
        "timestamp": datetime.utcnow().isoformat(),
        "status": "healthy",
        "checks": {},
    }
    
    # Redis
    try:
        import redis
        redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        client = redis.from_url(redis_url, socket_timeout=3)
        client.ping()
        result["checks"]["redis"] = "ok"
    except:
        result["checks"]["redis"] = "error"
        result["status"] = "unhealthy"
    
    # Database
    try:
        from sqlalchemy import text
        from app.database import SessionLocal
        db = SessionLocal()
        try:
            db.execute(text("SELECT 1"))
            result["checks"]["database"] = "ok"
        finally:
            db.close()
    except:
        result["checks"]["database"] = "error"
        result["status"] = "unhealthy"
    
    return result


@router.get("/health/workers")
async def check_workers(
    current_user: User = Depends(get_current_user)
):
    """
    檢查 Celery Workers 狀態
    """
    result = await system_monitor._check_celery_workers()
    return {
        "success": True,
        **result,
    }


@router.post("/health/test-alert")
async def test_alert(
    level: str = "warning",
    current_user: User = Depends(get_current_user)
):
    """
    測試告警通知
    
    發送測試告警到所有已配置的通道
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理員權限"
        )
    
    from app.services.monitoring import AlertLevel
    
    alert_level = AlertLevel.WARNING if level == "warning" else AlertLevel.CRITICAL
    
    await system_monitor._send_alert(
        level=alert_level,
        component="test",
        message=f"這是一個測試告警 - {datetime.utcnow().isoformat()}",
    )
    
    return {
        "success": True,
        "message": f"測試告警已發送 (level={level})",
        "channels": {
            "slack": system_monitor._alert_channels["slack"]["enabled"],
            "email": system_monitor._alert_channels["email"]["enabled"],
            "line": system_monitor._alert_channels["line"]["enabled"],
            "console": True,
        }
    }


# ============================================================
# 詐騙偵測管理
# ============================================================

class FraudAlertResolution(BaseModel):
    resolution_note: str
    unblock_user: bool = False


@router.get("/fraud/alerts")
async def get_fraud_alerts(
    resolved: bool = False,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取詐騙警報列表
    
    需要管理員權限
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理員權限"
        )
    
    from app.services.fraud_detection import FraudAlert
    
    query = db.query(FraudAlert).filter(FraudAlert.is_resolved == resolved)
    
    total = query.count()
    alerts = query.order_by(FraudAlert.created_at.desc()).offset(offset).limit(limit).all()
    
    return {
        "success": True,
        "total": total,
        "alerts": [
            {
                "id": a.id,
                "user_id": a.user_id,
                "alert_type": a.alert_type,
                "risk_level": a.risk_level,
                "risk_score": a.risk_score,
                "related_user_ids": a.related_user_ids,
                "evidence": a.evidence,
                "is_resolved": a.is_resolved,
                "created_at": a.created_at.isoformat(),
            }
            for a in alerts
        ],
    }


@router.get("/fraud/user/{user_identifier}")
async def get_user_fraud_info(
    user_identifier: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取用戶詐騙風險資訊
    
    支援用戶 ID（數字）或 Email 查詢
    需要管理員權限
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理員權限"
        )
    
    # 判斷輸入是 ID 還是 Email
    user_identifier = user_identifier.strip()
    user = None
    
    if user_identifier.isdigit():
        # 用戶 ID 查詢
        user = db.query(User).filter(User.id == int(user_identifier)).first()
    else:
        # Email 查詢
        user = db.query(User).filter(User.email == user_identifier).first()
        if not user:
            # 嘗試模糊匹配 email
            user = db.query(User).filter(User.email.ilike(f"%{user_identifier}%")).first()
        if not user:
            # 嘗試匹配姓名
            user = db.query(User).filter(User.full_name.ilike(f"%{user_identifier}%")).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"找不到用戶：{user_identifier}"
        )
    
    from app.services.fraud_detection import get_fraud_detection_service
    
    service = get_fraud_detection_service(db)
    info = service.get_user_risk_info(user.id)
    
    # 添加用戶基本資訊
    info["email"] = user.email
    info["full_name"] = user.full_name
    info["customer_id"] = user.customer_id
    
    # 前端期望數據在 data 字段中
    return {
        "success": True,
        "data": info,
    }


@router.post("/fraud/alerts/{alert_id}/resolve")
async def resolve_fraud_alert(
    alert_id: int,
    resolution: FraudAlertResolution,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    解決詐騙警報
    
    可選擇是否解除用戶封鎖
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理員權限"
        )
    
    from app.services.fraud_detection import get_fraud_detection_service
    
    service = get_fraud_detection_service(db)
    success = service.resolve_alert(
        alert_id=alert_id,
        resolved_by=current_user.id,
        resolution_note=resolution.resolution_note,
        unblock_user=resolution.unblock_user,
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="警報不存在"
        )
    
    return {
        "success": True,
        "message": "警報已解決",
        "unblocked": resolution.unblock_user,
    }


@router.get("/fraud/stats")
async def get_fraud_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取詐騙偵測統計
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理員權限"
        )
    
    from app.services.fraud_detection import FraudAlert, UserRiskProfile, RiskLevel
    from sqlalchemy import func
    
    # 警報統計
    total_alerts = db.query(FraudAlert).count()
    unresolved_alerts = db.query(FraudAlert).filter(FraudAlert.is_resolved == False).count()
    
    # 依類型統計
    alerts_by_type = db.query(
        FraudAlert.alert_type,
        func.count(FraudAlert.id)
    ).filter(
        FraudAlert.is_resolved == False
    ).group_by(FraudAlert.alert_type).all()
    
    # 風險用戶統計
    risk_profiles = db.query(
        UserRiskProfile.risk_level,
        func.count(UserRiskProfile.id)
    ).group_by(UserRiskProfile.risk_level).all()
    
    blocked_users = db.query(UserRiskProfile).filter(
        UserRiskProfile.referral_bonus_blocked == True
    ).count()
    
    return {
        "success": True,
        "alerts": {
            "total": total_alerts,
            "unresolved": unresolved_alerts,
            "by_type": {t: c for t, c in alerts_by_type},
        },
        "risk_profiles": {
            "by_level": {l: c for l, c in risk_profiles},
            "bonus_blocked": blocked_users,
        },
    }


@router.get("/fraud/suspicious-referrals")
async def get_suspicious_referrals(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取可疑推薦關係
    
    顯示同 IP/裝置的推薦關係
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理員權限"
        )
    
    from app.services.fraud_detection import IPAddressLog, DeviceFingerprint
    from sqlalchemy import func
    
    # 找出同 IP 的用戶群組
    same_ip_groups = db.query(
        IPAddressLog.ip_hash,
        func.count(func.distinct(IPAddressLog.user_id)).label("user_count"),
        func.array_agg(func.distinct(IPAddressLog.user_id)).label("user_ids"),
    ).group_by(IPAddressLog.ip_hash).having(
        func.count(func.distinct(IPAddressLog.user_id)) > 1
    ).order_by(func.count(func.distinct(IPAddressLog.user_id)).desc()).limit(limit).all()
    
    suspicious_groups = []
    for ip_hash, user_count, user_ids in same_ip_groups:
        # 獲取用戶資訊
        users = db.query(User).filter(User.id.in_(user_ids)).all()
        
        # 檢查是否有推薦關係
        referrals = []
        for u in users:
            if u.referred_by:
                referrer = db.query(User).filter(User.referral_code == u.referred_by).first()
                if referrer and referrer.id in user_ids:
                    referrals.append({
                        "referrer_id": referrer.id,
                        "referrer_email": referrer.email[:3] + "***",
                        "referred_id": u.id,
                        "referred_email": u.email[:3] + "***",
                    })
        
        if referrals:
            suspicious_groups.append({
                "ip_hash": ip_hash[:16] + "...",
                "user_count": user_count,
                "referrals_within_group": len(referrals),
                "referrals": referrals,
                "users": [
                    {
                        "id": u.id,
                        "email": u.email[:3] + "***",
                        "subscription": u.subscription_plan,
                    }
                    for u in users
                ],
            })
    
    return {
        "success": True,
        "suspicious_groups": suspicious_groups,
        "total_groups": len(suspicious_groups),
    }


# ============================================================
# Prometheus 指標端點
# ============================================================

@router.get("/metrics", response_class=Response)
async def prometheus_metrics():
    """
    Prometheus 指標端點
    
    提供系統指標供 Prometheus 抓取
    格式：Prometheus exposition format
    """
    metrics = []
    
    # 基本資訊
    metrics.append("# HELP kingjam_up System up status")
    metrics.append("# TYPE kingjam_up gauge")
    metrics.append("kingjam_up 1")
    
    try:
        # 佇列長度
        import redis
        redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        client = redis.from_url(redis_url, socket_timeout=3)
        
        metrics.append("# HELP kingjam_queue_length Celery queue length")
        metrics.append("# TYPE kingjam_queue_length gauge")
        
        for queue in ["queue_high", "queue_default", "queue_video"]:
            length = client.llen(queue)
            metrics.append(f'kingjam_queue_length{{queue="{queue}"}} {length}')
        
        # 系統資源
        try:
            import psutil
            
            metrics.append("# HELP kingjam_memory_percent Memory usage percentage")
            metrics.append("# TYPE kingjam_memory_percent gauge")
            metrics.append(f"kingjam_memory_percent {psutil.virtual_memory().percent}")
            
            metrics.append("# HELP kingjam_disk_percent Disk usage percentage")
            metrics.append("# TYPE kingjam_disk_percent gauge")
            metrics.append(f"kingjam_disk_percent {psutil.disk_usage('/').percent}")
            
        except ImportError:
            pass
        
        # 儲存統計
        storage_stats = lifecycle_manager.get_storage_stats()
        local_stats = storage_stats.get("local", {})
        
        metrics.append("# HELP kingjam_storage_local_mb Local storage size in MB")
        metrics.append("# TYPE kingjam_storage_local_mb gauge")
        metrics.append(f"kingjam_storage_local_mb {local_stats.get('total_size_mb', 0)}")
        
        metrics.append("# HELP kingjam_storage_videos_count Local video files count")
        metrics.append("# TYPE kingjam_storage_videos_count gauge")
        metrics.append(f"kingjam_storage_videos_count {local_stats.get('videos', {}).get('count', 0)}")
        
    except Exception as e:
        metrics.append(f"# Error collecting metrics: {e}")
    
    return Response(
        content="\n".join(metrics),
        media_type="text/plain; charset=utf-8"
    )


# ============================================================
# 管理員總覽儀表板
# ============================================================

@router.get("/dashboard/overview")
async def get_dashboard_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    管理員總覽儀表板
    
    整合所有待處理事項與系統狀態
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理員權限"
        )
    
    today = datetime.utcnow().date()
    week_ago = datetime.utcnow() - timedelta(days=7)
    month_ago = datetime.utcnow() - timedelta(days=30)
    
    # ========== 待處理事項統計 ==========
    
    # 提領審核
    pending_withdrawals = db.query(WithdrawalRequest).filter(
        WithdrawalRequest.status.in_(["pending", "reviewing"])
    ).count()
    
    pending_withdrawal_amount = db.query(func.sum(WithdrawalRequest.amount_twd)).filter(
        WithdrawalRequest.status.in_(["pending", "reviewing"])
    ).scalar() or 0
    
    # 退款申請
    pending_refunds = db.query(RefundRequest).filter(
        RefundRequest.status.in_(["pending", "approved", "processing"])
    ).count()
    
    pending_refund_amount = db.query(func.sum(RefundRequest.refund_amount)).filter(
        RefundRequest.status.in_(["pending", "approved", "processing"])
    ).scalar() or 0
    
    # 待處理訂單
    pending_orders = db.query(Order).filter(
        Order.status.in_(["pending", "processing", "paid"])
    ).count()
    
    # 排程發布 - 失敗的
    failed_posts = db.query(ScheduledPost).filter(
        ScheduledPost.status == "failed"
    ).count()
    
    # 詐騙警報
    try:
        from app.services.fraud_detection import FraudAlert
        unresolved_fraud_alerts = db.query(FraudAlert).filter(
            FraudAlert.is_resolved == False
        ).count()
    except:
        unresolved_fraud_alerts = 0
    
    # 身份認證
    pending_verifications = db.query(IdentityVerification).filter(
        IdentityVerification.status.in_(["pending", "reviewing"])
    ).count()
    
    # ========== 系統統計 ==========
    
    # 用戶統計
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()
    new_users_today = db.query(User).filter(
        func.date(User.created_at) == today
    ).count()
    new_users_week = db.query(User).filter(
        User.created_at >= week_ago
    ).count()
    
    paying_users = db.query(User).filter(
        or_(
            User.subscription_plan != "free",
            User.credits_paid > 0
        )
    ).count()
    
    # 收入統計
    today_revenue = db.query(func.sum(Order.total_amount)).filter(
        and_(
            Order.status.in_(["paid", "completed"]),
            func.date(Order.paid_at) == today
        )
    ).scalar() or 0
    
    week_revenue = db.query(func.sum(Order.total_amount)).filter(
        and_(
            Order.status.in_(["paid", "completed"]),
            Order.paid_at >= week_ago
        )
    ).scalar() or 0
    
    month_revenue = db.query(func.sum(Order.total_amount)).filter(
        and_(
            Order.status.in_(["paid", "completed"]),
            Order.paid_at >= month_ago
        )
    ).scalar() or 0
    
    # 生成統計
    generations_today = db.query(GenerationHistory).filter(
        func.date(GenerationHistory.created_at) == today
    ).count()
    
    generations_week = db.query(GenerationHistory).filter(
        GenerationHistory.created_at >= week_ago
    ).count()
    
    # ========== 最近待處理事項清單 ==========
    
    # 最近的提領申請
    recent_withdrawals = db.query(WithdrawalRequest).filter(
        WithdrawalRequest.status.in_(["pending", "reviewing"])
    ).order_by(WithdrawalRequest.created_at.desc()).limit(5).all()
    
    # 最近的退款申請
    recent_refunds = db.query(RefundRequest).filter(
        RefundRequest.status.in_(["pending", "approved"])
    ).order_by(RefundRequest.created_at.desc()).limit(5).all()
    
    # 最近的訂單（待完成）
    recent_orders = db.query(Order).filter(
        Order.status.in_(["paid"])
    ).order_by(Order.created_at.desc()).limit(5).all()
    
    # 最近失敗的排程
    recent_failed_posts = db.query(ScheduledPost).filter(
        ScheduledPost.status == "failed"
    ).order_by(ScheduledPost.updated_at.desc()).limit(5).all()
    
    return {
        "success": True,
        "timestamp": datetime.utcnow().isoformat(),
        "is_super_admin": is_super_admin(current_user),
        
        # 待處理事項數量
        "pending_items": {
            "withdrawals": {
                "count": pending_withdrawals,
                "amount": float(pending_withdrawal_amount),
            },
            "refunds": {
                "count": pending_refunds,
                "amount": float(pending_refund_amount),
            },
            "orders": pending_orders,
            "failed_posts": failed_posts,
            "fraud_alerts": unresolved_fraud_alerts,
            "verifications": pending_verifications,
            "total": pending_withdrawals + pending_refunds + pending_orders + failed_posts + unresolved_fraud_alerts + pending_verifications,
        },
        
        # 用戶統計
        "users": {
            "total": total_users,
            "active": active_users,
            "paying": paying_users,
            "new_today": new_users_today,
            "new_week": new_users_week,
        },
        
        # 收入統計
        "revenue": {
            "today": float(today_revenue),
            "week": float(week_revenue),
            "month": float(month_revenue),
        },
        
        # 生成統計
        "generations": {
            "today": generations_today,
            "week": generations_week,
        },
        
        # 最近待處理清單
        "recent_pending": {
            "withdrawals": [
                {
                    "id": w.id,
                    "user_id": w.user_id,
                    "amount_twd": float(w.amount_twd),
                    "credits_amount": w.credits_amount,
                    "status": w.status,
                    "risk_level": w.risk_level,
                    "created_at": w.created_at.isoformat() if w.created_at else None,
                }
                for w in recent_withdrawals
            ],
            "refunds": [
                {
                    "id": r.id,
                    "request_no": r.request_no,
                    "user_id": r.user_id,
                    "credits_amount": r.credits_amount,
                    "refund_amount": float(r.refund_amount),
                    "status": r.status,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in recent_refunds
            ],
            "orders": [
                {
                    "id": o.id,
                    "order_no": o.order_no,
                    "user_id": o.user_id,
                    "item_name": o.item_name,
                    "total_amount": float(o.total_amount),
                    "status": o.status,
                    "payment_provider": o.payment_provider,
                    "created_at": o.created_at.isoformat() if o.created_at else None,
                }
                for o in recent_orders
            ],
            "failed_posts": [
                {
                    "id": p.id,
                    "user_id": p.user_id,
                    "content_type": p.content_type,
                    "error_message": p.error_message[:100] if p.error_message else None,
                    "retry_count": p.retry_count,
                    "updated_at": p.updated_at.isoformat() if p.updated_at else None,
                }
                for p in recent_failed_posts
            ],
        },
    }


@router.get("/dashboard/pending-list")
async def get_pending_list(
    item_type: str = "all",  # all, withdrawals, refunds, orders, posts, fraud
    status_filter: str = "pending",
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取待處理事項完整列表
    
    Args:
        item_type: 事項類型 (all, withdrawals, refunds, orders, posts, fraud)
        status_filter: 狀態篩選
        limit: 每頁數量
        offset: 偏移量
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理員權限"
        )
    
    result = {
        "success": True,
        "item_type": item_type,
        "items": [],
        "total": 0,
    }
    
    if item_type in ["all", "withdrawals"]:
        query = db.query(WithdrawalRequest)
        if status_filter == "pending":
            query = query.filter(WithdrawalRequest.status.in_(["pending", "reviewing"]))
        elif status_filter != "all":
            query = query.filter(WithdrawalRequest.status == status_filter)
        
        if item_type == "withdrawals":
            result["total"] = query.count()
            items = query.order_by(WithdrawalRequest.created_at.desc()).offset(offset).limit(limit).all()
            result["items"] = [
                {
                    "type": "withdrawal",
                    "id": w.id,
                    "user_id": w.user_id,
                    "amount_twd": float(w.amount_twd),
                    "credits_amount": w.credits_amount,
                    "status": w.status,
                    "risk_level": w.risk_level,
                    "bank_name": w.bank_name,
                    "requires_manual_review": w.requires_manual_review,
                    "created_at": w.created_at.isoformat() if w.created_at else None,
                }
                for w in items
            ]
    
    if item_type in ["all", "refunds"]:
        query = db.query(RefundRequest)
        if status_filter == "pending":
            query = query.filter(RefundRequest.status.in_(["pending", "approved", "processing"]))
        elif status_filter != "all":
            query = query.filter(RefundRequest.status == status_filter)
        
        if item_type == "refunds":
            result["total"] = query.count()
            items = query.order_by(RefundRequest.created_at.desc()).offset(offset).limit(limit).all()
            result["items"] = [
                {
                    "type": "refund",
                    "id": r.id,
                    "request_no": r.request_no,
                    "user_id": r.user_id,
                    "credits_amount": r.credits_amount,
                    "refund_amount": float(r.refund_amount),
                    "refund_method": r.refund_method,
                    "status": r.status,
                    "reason": r.reason[:100] if r.reason else None,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in items
            ]
    
    if item_type in ["all", "orders"]:
        query = db.query(Order)
        if status_filter == "pending":
            query = query.filter(Order.status.in_(["pending", "processing", "paid"]))
        elif status_filter != "all":
            query = query.filter(Order.status == status_filter)
        
        if item_type == "orders":
            result["total"] = query.count()
            items = query.order_by(Order.created_at.desc()).offset(offset).limit(limit).all()
            result["items"] = [
                {
                    "type": "order",
                    "id": o.id,
                    "order_no": o.order_no,
                    "user_id": o.user_id,
                    "order_type": o.order_type,
                    "item_name": o.item_name,
                    "total_amount": float(o.total_amount),
                    "payment_provider": o.payment_provider,
                    "status": o.status,
                    "created_at": o.created_at.isoformat() if o.created_at else None,
                }
                for o in items
            ]
    
    if item_type in ["all", "posts"]:
        query = db.query(ScheduledPost).filter(ScheduledPost.status == "failed")
        
        if item_type == "posts":
            result["total"] = query.count()
            items = query.order_by(ScheduledPost.updated_at.desc()).offset(offset).limit(limit).all()
            result["items"] = [
                {
                    "type": "failed_post",
                    "id": p.id,
                    "user_id": p.user_id,
                    "content_type": p.content_type,
                    "title": p.title,
                    "error_message": p.error_message,
                    "retry_count": p.retry_count,
                    "scheduled_at": p.scheduled_at.isoformat() if p.scheduled_at else None,
                    "updated_at": p.updated_at.isoformat() if p.updated_at else None,
                }
                for p in items
            ]
    
    if item_type in ["all", "fraud"]:
        try:
            from app.services.fraud_detection import FraudAlert
            query = db.query(FraudAlert).filter(FraudAlert.is_resolved == False)
            
            if item_type == "fraud":
                result["total"] = query.count()
                items = query.order_by(FraudAlert.created_at.desc()).offset(offset).limit(limit).all()
                result["items"] = [
                    {
                        "type": "fraud_alert",
                        "id": a.id,
                        "user_id": a.user_id,
                        "alert_type": a.alert_type,
                        "risk_level": a.risk_level,
                        "risk_score": a.risk_score,
                        "created_at": a.created_at.isoformat() if a.created_at else None,
                    }
                    for a in items
                ]
        except:
            pass
    
    return result


@router.get("/dashboard/quick-stats")
async def get_quick_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    快速統計（用於頂部通知欄）
    
    返回待處理事項數量
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理員權限"
        )
    
    pending_withdrawals = db.query(WithdrawalRequest).filter(
        WithdrawalRequest.status.in_(["pending", "reviewing"])
    ).count()
    
    pending_refunds = db.query(RefundRequest).filter(
        RefundRequest.status.in_(["pending", "approved"])
    ).count()
    
    failed_posts = db.query(ScheduledPost).filter(
        ScheduledPost.status == "failed"
    ).count()
    
    try:
        from app.services.fraud_detection import FraudAlert
        fraud_alerts = db.query(FraudAlert).filter(
            FraudAlert.is_resolved == False
        ).count()
    except:
        fraud_alerts = 0
    
    total = pending_withdrawals + pending_refunds + failed_posts + fraud_alerts
    
    return {
        "success": True,
        "pending": {
            "withdrawals": pending_withdrawals,
            "refunds": pending_refunds,
            "failed_posts": failed_posts,
            "fraud_alerts": fraud_alerts,
            "total": total,
        },
        "has_urgent": fraud_alerts > 0 or pending_withdrawals > 5,
    }


# ============================================================
# 安全監控 - 非法訪問記錄
# ============================================================

class AccessAttemptLog(BaseModel):
    attempted_path: str
    user_email: Optional[str] = None


# 內存中的訪問記錄（生產環境可改用資料庫）
_access_attempts: List[Dict[str, Any]] = []
_MAX_ATTEMPTS_LOG = 1000  # 最多保留 1000 條記錄


@router.post("/security/log-access-attempt")
async def log_unauthorized_access(
    data: AccessAttemptLog,
    current_user: User = Depends(get_current_user),
):
    """
    記錄非授權訪問嘗試
    
    此端點允許任何已登入用戶調用（用於前端記錄訪問嘗試）
    但只有非管理員的訪問才會被記錄
    """
    import logging
    logger = logging.getLogger("admin_security")
    
    # 管理員不記錄（正常訪問）
    if current_user.is_admin:
        return {"success": True, "logged": False, "reason": "admin_access"}
    
    # 記錄訪問嘗試
    attempt = {
        "timestamp": datetime.utcnow().isoformat(),
        "user_id": current_user.id,
        "user_email": current_user.email,
        "attempted_path": data.attempted_path,
        "ip_address": None,  # 可從 request 獲取
    }
    
    # 添加到內存記錄
    _access_attempts.append(attempt)
    
    # 限制記錄數量
    if len(_access_attempts) > _MAX_ATTEMPTS_LOG:
        _access_attempts.pop(0)
    
    # 記錄到日誌
    logger.warning(
        f"🚨 非授權訪問嘗試 | "
        f"用戶: {current_user.email} (ID: {current_user.id}) | "
        f"路徑: {data.attempted_path}"
    )
    
    return {"success": True, "logged": True}


@router.get("/security/access-attempts")
async def get_access_attempts(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
):
    """
    獲取非授權訪問嘗試記錄
    
    僅限管理員查看
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理員權限"
        )
    
    # 返回最近的記錄（倒序）
    recent_attempts = list(reversed(_access_attempts[-limit:]))
    
    # 統計
    unique_users = len(set(a["user_email"] for a in _access_attempts if a["user_email"]))
    unique_paths = len(set(a["attempted_path"] for a in _access_attempts))
    
    return {
        "success": True,
        "total_attempts": len(_access_attempts),
        "unique_users": unique_users,
        "unique_paths": unique_paths,
        "attempts": recent_attempts,
    }


# ============================================================
# 訂單管理
# ============================================================

@router.get("/orders")
async def list_orders(
    page: int = 1,
    page_size: int = 20,
    status: str = None,
    user_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    獲取訂單列表（管理員）
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理員權限"
        )
    
    query = db.query(Order)
    
    # 篩選條件
    if status:
        query = query.filter(Order.status == status)
    if user_id:
        query = query.filter(Order.user_id == user_id)
    
    # 總數
    total = query.count()
    
    # 排序和分頁
    orders = query.order_by(Order.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    orders_data = []
    for o in orders:
        user = db.query(User).filter(User.id == o.user_id).first()
        orders_data.append({
            "id": o.id,
            "order_no": o.order_no,
            "user_id": o.user_id,
            "user_email": user.email if user else None,
            "order_type": o.order_type,
            "item_code": o.item_code,
            "item_name": o.item_name,
            "total_amount": float(o.total_amount),
            "credits_amount": o.credits_amount,
            "bonus_credits": o.bonus_credits,
            "status": o.status,
            "payment_provider": o.payment_provider,
            "payment_method": o.payment_method,
            "created_at": o.created_at.isoformat() if o.created_at else None,
            "paid_at": o.paid_at.isoformat() if o.paid_at else None,
            "completed_at": o.completed_at.isoformat() if o.completed_at else None,
        })
    
    return {
        "success": True,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "orders": orders_data,
    }


@router.get("/orders/{order_no}")
async def get_order_detail(
    order_no: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    查詢訂單詳情（管理員）
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理員權限"
        )
    
    order = db.query(Order).filter(Order.order_no == order_no).first()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到此訂單"
        )
    
    user = db.query(User).filter(User.id == order.user_id).first()
    
    return {
        "success": True,
        "order": {
            "id": order.id,
            "order_no": order.order_no,
            "user_id": order.user_id,
            "user_email": user.email if user else None,
            "order_type": order.order_type,
            "item_code": order.item_code,
            "item_name": order.item_name,
            "total_amount": float(order.total_amount),
            "credits_amount": order.credits_amount,
            "bonus_credits": order.bonus_credits,
            "status": order.status,
            "payment_provider": order.payment_provider,
            "payment_method": order.payment_method,
            "ecpay_merchant_trade_no": order.ecpay_merchant_trade_no,
            "ecpay_trade_no": order.ecpay_trade_no,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "paid_at": order.paid_at.isoformat() if order.paid_at else None,
            "completed_at": order.completed_at.isoformat() if order.completed_at else None,
        }
    }


@router.post("/orders/{order_no}/confirm-payment")
async def admin_confirm_payment(
    order_no: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    管理員手動確認付款
    
    用於回調失敗但實際已付款的情況
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理員權限"
        )
    
    order = db.query(Order).filter(Order.order_no == order_no).first()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到此訂單"
        )
    
    if order.status in ["paid", "completed"]:
        return {
            "success": True,
            "message": "訂單已經是付款完成狀態",
            "status": order.status,
        }
    
    if order.status not in ["pending", "processing"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"訂單狀態 {order.status} 無法確認付款"
        )
    
    # 使用 PaymentService 處理付款回調
    from app.services.payment_service import PaymentService
    
    payment_service = PaymentService(db)
    payment_service.process_payment_callback(
        order=order,
        is_success=True,
        provider_data={"admin_confirmed": True, "confirmed_by": current_user.id},
    )
    
    return {
        "success": True,
        "message": f"訂單 {order_no} 已手動確認付款完成",
        "new_status": order.status,
        "credits_granted": (order.credits_amount or 0) + (order.bonus_credits or 0),
    }


# ============================================================
# 天使投資人管理 (僅限超級管理員)
# ============================================================

@router.get("/users")
async def admin_get_users(
    q: Optional[str] = None,
    angel_only: Optional[bool] = Query(None, alias="is_angel"),
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    獲取用戶列表，支援關鍵字搜尋與天使狀態篩選
    """
    require_super_admin(current_user)
    
    query = db.query(User)
    
    if q:
        query = query.filter(
            or_(
                User.email.ilike(f"%{q}%"),
                User.full_name.ilike(f"%{q}%"),
                User.customer_id.ilike(f"%{q}%")
            )
        )
        
    if angel_only is True:
        query = query.filter(User.is_angel == True)
    elif angel_only is False:
        query = query.filter(User.is_angel == False)
        
    total = query.count()
    users = query.order_by(User.investment_units.desc(), User.created_at.desc()).offset(offset).limit(limit).all()
    
    # Calculate global stats for all authorized angels (regardless of search/filter)
    global_angels_query = db.query(
        func.count(User.id),
        func.sum(User.investment_units)
    ).filter(User.is_angel == True).first()
    
    global_stats = {
        "total_angels": global_angels_query[0] or 0,
        "total_units": int(global_angels_query[1] or 0)
    }
    
    return {
        "success": True,
        "total": total,
        "global_stats": global_stats,
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "is_admin": u.is_admin,
                "is_angel": u.is_angel,
                "investment_units": getattr(u, "investment_units", 0),
                "angel_phone": getattr(u, "angel_phone", None),
                "angel_note": getattr(u, "angel_note", None),
                "referral_code": getattr(u, "referral_code", None),
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ]
    }


@router.post("/users/{user_id}/toggle-angel")
async def admin_toggle_angel(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    切換用戶的天使投資人身份
    """
    require_super_admin(current_user)
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="找不到此用戶")
        
    user.is_angel = not user.is_angel
    # 若取消天使身份，同時清除投資單位
    if not user.is_angel:
        user.investment_units = 0
    db.commit()
    
    return {
        "success": True,
        "message": f"用戶 {user.email} 的天使身份已更新為 {user.is_angel}",
        "is_angel": user.is_angel,
        "investment_units": user.investment_units,
    }


class SetInvestmentUnitsRequest(BaseModel):
    units: int  # 投資單位數（1單位 = NT$200,000）


@router.post("/users/{user_id}/set-investment-units")
async def admin_set_investment_units(
    user_id: int,
    body: SetInvestmentUnitsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    設定天使投資人的投資單位數
    1 單位 = NT$200,000，每單位享有 1% 利潤分紅
    """
    require_super_admin(current_user)

    if body.units < 0:
        raise HTTPException(status_code=400, detail="投資單位數不可為負數")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="找不到此用戶")

    if not user.is_angel:
        raise HTTPException(status_code=400, detail="此用戶尚未被授予天使投資人身份")

    user.investment_units = body.units
    db.commit()

    total_invested = body.units * 200_000
    return {
        "success": True,
        "message": f"已設定 {user.email} 的投資單位為 {body.units} 單位 (NT${total_invested:,})",
        "user_id": user_id,
        "investment_units": body.units,
        "total_invested_ntd": total_invested,
        "dividend_rate_pct": body.units,  # 每單位 1%，N 單位 = N%
    }


class SetAngelProfileRequest(BaseModel):
    phone: Optional[str] = None
    note: Optional[str] = None
    referral_code: Optional[str] = None


@router.post("/users/{user_id}/set-angel-profile")
async def admin_set_angel_profile(
    user_id: int,
    body: SetAngelProfileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    設定天使投資人的詳細資料（電話、備註、推薦碼）
    """
    require_super_admin(current_user)
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="找不到此用戶")
        
    if not user.is_angel:
        raise HTTPException(status_code=400, detail="此用戶非天使投資人")
        
    if body.phone is not None:
        user.angel_phone = body.phone
    if body.note is not None:
        user.angel_note = body.note
    if body.referral_code is not None:
        # 檢查唯一性
        if body.referral_code != user.referral_code:
            existing = db.query(User).filter(User.referral_code == body.referral_code).first()
            if existing:
                raise HTTPException(status_code=400, detail="此推薦碼已被使用")
            user.referral_code = body.referral_code
        
    db.commit()
    
    return {
        "success": True,
        "message": f"用戶 {user.email} 的管理資料已更新",
        "angel_phone": user.angel_phone,
        "angel_note": user.angel_note,
        "referral_code": user.referral_code,
    }


class ExpenseCreate(BaseModel):
    item_name: str
    amount: float
    category: Optional[str] = "other"
    description: Optional[str] = None
    expense_date: Optional[datetime] = None


@router.get("/expenses")
async def admin_get_expenses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    獲取所有支出紀錄（超級管理員或天使投資人）
    """
    if not is_super_admin(current_user) and not is_angel(current_user):
        raise HTTPException(status_code=403, detail="權限不足")
        
    expenses = db.query(Expense).order_by(Expense.expense_date.desc()).all()
    return {"success": True, "expenses": expenses}


@router.post("/expenses")
async def admin_add_expense(
    body: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    新增支出紀錄（超級管理員）
    """
    require_super_admin(current_user)
    new_expense = Expense(
        item_name=body.item_name,
        amount=body.amount,
        category=body.category,
        description=body.description,
        expense_date=body.expense_date or datetime.now()
    )
    db.add(new_expense)
    db.commit()
    db.refresh(new_expense)
    return {"success": True, "expense": new_expense}


@router.delete("/expenses/{expense_id}")
async def admin_delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    刪除支出紀錄（超級管理員）
    """
    require_super_admin(current_user)
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="找不到支出紀錄")
    db.delete(expense)
    db.commit()
    return {"success": True, "message": "已刪除支出紀錄"}
