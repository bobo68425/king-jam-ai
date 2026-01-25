"""
系統監控任務
定時健康檢查、告警通知

每 5 分鐘執行一次完整檢查
"""

import logging
import asyncio
from datetime import datetime
from typing import Dict, Any

from app.celery_app import celery_app
from app.services.monitoring import system_monitor

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.tasks.monitoring_tasks.health_check",
    queue="queue_high",  # 使用高優先級佇列
    bind=True,
    max_retries=0,  # 健康檢查不重試
    soft_time_limit=60,
    time_limit=90,
)
def health_check(self) -> Dict[str, Any]:
    """
    執行完整健康檢查
    
    檢查項目：
    - Redis 連接
    - PostgreSQL 連接
    - Celery Workers 狀態
    - 系統資源（記憶體/磁碟）
    - 佇列長度
    
    異常時發送告警通知
    """
    logger.info("[HealthCheck] 開始執行健康檢查...")
    
    try:
        # 執行非同步檢查
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            report = loop.run_until_complete(system_monitor.check_all())
        finally:
            loop.close()
        
        # 記錄結果
        status = report.get("overall_status", "unknown")
        alerts_count = len(report.get("alerts", []))
        
        if status == "healthy":
            logger.info("[HealthCheck] ✅ 系統健康")
        elif status == "warning":
            logger.warning(f"[HealthCheck] ⚠️ 發現 {alerts_count} 個警告")
        else:
            logger.error(f"[HealthCheck] 🚨 發現 {alerts_count} 個嚴重問題")
        
        return report
        
    except Exception as e:
        logger.error(f"[HealthCheck] 執行失敗: {e}")
        
        # 嘗試發送告警
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(
                    system_monitor._send_alert(
                        level=system_monitor.AlertLevel.CRITICAL,
                        component="health_check",
                        message=f"健康檢查任務本身失敗: {e}",
                    )
                )
            finally:
                loop.close()
        except:
            pass
        
        return {
            "success": False,
            "error": str(e),
            "overall_status": "unknown",
        }


@celery_app.task(
    name="app.tasks.monitoring_tasks.quick_ping",
    queue="queue_high",
    bind=True,
    soft_time_limit=10,
    time_limit=15,
)
def quick_ping(self) -> Dict[str, Any]:
    """
    快速 Ping 檢查
    
    僅檢查核心服務（Redis, DB）
    適合更頻繁的執行
    """
    result = {
        "timestamp": datetime.utcnow().isoformat(),
        "redis": False,
        "database": False,
    }
    
    try:
        import redis
        client = redis.from_url("redis://redis:6379/0", socket_timeout=3)
        client.ping()
        result["redis"] = True
    except Exception as e:
        logger.error(f"[QuickPing] Redis 失敗: {e}")
    
    try:
        from sqlalchemy import text
        from app.database import SessionLocal
        db = SessionLocal()
        try:
            db.execute(text("SELECT 1"))
            result["database"] = True
        finally:
            db.close()
    except Exception as e:
        logger.error(f"[QuickPing] DB 失敗: {e}")
    
    result["healthy"] = result["redis"] and result["database"]
    return result


@celery_app.task(
    name="app.tasks.monitoring_tasks.worker_heartbeat",
    queue="queue_default",
    bind=True,
)
def worker_heartbeat(self) -> Dict[str, Any]:
    """
    Worker 心跳任務
    
    用於確認 worker-default 正在運行
    """
    return {
        "worker": "worker-default",
        "timestamp": datetime.utcnow().isoformat(),
        "task_id": self.request.id,
        "status": "alive",
    }


@celery_app.task(
    name="app.tasks.monitoring_tasks.video_worker_heartbeat",
    queue="queue_video",
    bind=True,
)
def video_worker_heartbeat(self) -> Dict[str, Any]:
    """
    Video Worker 心跳任務
    
    用於確認 worker-video 正在運行
    """
    return {
        "worker": "worker-video",
        "timestamp": datetime.utcnow().isoformat(),
        "task_id": self.request.id,
        "status": "alive",
    }
