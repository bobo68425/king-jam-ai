"""
系統監控服務
健康檢查、告警通知、危機處理

功能：
- Celery Worker 健康檢查
- Redis/PostgreSQL 連接檢查
- 記憶體/磁碟使用監控
- 告警通知（Email/Slack/Line）
- 自動恢復嘗試
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from enum import Enum
import asyncio
import httpx

logger = logging.getLogger(__name__)


class AlertLevel(Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    RECOVERY = "recovery"


class AlertChannel(Enum):
    EMAIL = "email"
    SLACK = "slack"
    LINE = "line"
    CONSOLE = "console"


class SystemMonitor:
    """
    系統監控器
    
    定時檢查各組件健康狀態，發現問題時發送告警
    """
    
    # 告警閾值配置
    THRESHOLDS = {
        "memory_warning": 80,      # 記憶體使用 80% 警告
        "memory_critical": 90,     # 記憶體使用 90% 嚴重
        "disk_warning": 80,        # 磁碟使用 80% 警告
        "disk_critical": 90,       # 磁碟使用 90% 嚴重
        "queue_warning": 100,      # 佇列長度 100 警告
        "queue_critical": 500,     # 佇列長度 500 嚴重
        "worker_timeout": 60,      # Worker 無回應 60 秒
    }
    
    # 告警抑制（防止告警風暴）
    ALERT_COOLDOWN = {
        AlertLevel.WARNING: 300,   # 警告 5 分鐘內不重複
        AlertLevel.CRITICAL: 60,   # 嚴重 1 分鐘內不重複
    }
    
    def __init__(self):
        self._last_alerts: Dict[str, datetime] = {}
        self._alert_channels = self._init_channels()
    
    def _init_channels(self) -> Dict[str, Dict]:
        """初始化告警通道配置"""
        return {
            "slack": {
                "enabled": bool(os.getenv("SLACK_WEBHOOK_URL")),
                "webhook_url": os.getenv("SLACK_WEBHOOK_URL"),
            },
            "email": {
                "enabled": bool(os.getenv("ALERT_EMAIL")),
                "recipients": os.getenv("ALERT_EMAIL", "").split(","),
            },
            "line": {
                "enabled": bool(os.getenv("LINE_NOTIFY_TOKEN")),
                "token": os.getenv("LINE_NOTIFY_TOKEN"),
            },
            "console": {
                "enabled": True,  # 始終啟用控制台輸出
            }
        }
    
    async def check_all(self) -> Dict[str, Any]:
        """
        執行完整健康檢查
        
        Returns:
            檢查結果報告
        """
        report = {
            "timestamp": datetime.utcnow().isoformat(),
            "overall_status": "healthy",
            "checks": {},
            "alerts": [],
        }
        
        # 1. 檢查 Redis
        redis_result = await self._check_redis()
        report["checks"]["redis"] = redis_result
        if not redis_result["healthy"]:
            report["overall_status"] = "critical"
            report["alerts"].append({
                "component": "redis",
                "level": "critical",
                "message": redis_result.get("error", "Redis 連接失敗"),
            })
        
        # 2. 檢查 PostgreSQL
        db_result = await self._check_database()
        report["checks"]["database"] = db_result
        if not db_result["healthy"]:
            report["overall_status"] = "critical"
            report["alerts"].append({
                "component": "database",
                "level": "critical",
                "message": db_result.get("error", "資料庫連接失敗"),
            })
        
        # 3. 檢查 Celery Workers
        workers_result = await self._check_celery_workers()
        report["checks"]["celery_workers"] = workers_result
        if not workers_result["healthy"]:
            if workers_result.get("critical"):
                report["overall_status"] = "critical"
            elif report["overall_status"] != "critical":
                report["overall_status"] = "warning"
            report["alerts"].extend(workers_result.get("alerts", []))
        
        # 4. 檢查系統資源
        resources_result = await self._check_system_resources()
        report["checks"]["system_resources"] = resources_result
        if resources_result.get("alerts"):
            if report["overall_status"] == "healthy":
                report["overall_status"] = "warning"
            report["alerts"].extend(resources_result["alerts"])
        
        # 5. 檢查佇列長度
        queue_result = await self._check_queue_length()
        report["checks"]["queues"] = queue_result
        if queue_result.get("alerts"):
            if report["overall_status"] == "healthy":
                report["overall_status"] = "warning"
            report["alerts"].extend(queue_result["alerts"])
        
        # 發送告警
        for alert in report["alerts"]:
            await self._send_alert(
                level=AlertLevel(alert["level"]),
                component=alert["component"],
                message=alert["message"],
            )
        
        return report
    
    async def _check_redis(self) -> Dict:
        """檢查 Redis 連接"""
        try:
            import redis
            client = redis.from_url(
                os.getenv("REDIS_URL", "redis://localhost:6379/0"),
                socket_timeout=5
            )
            client.ping()
            info = client.info()
            return {
                "healthy": True,
                "connected_clients": info.get("connected_clients", 0),
                "used_memory_human": info.get("used_memory_human", "unknown"),
            }
        except Exception as e:
            logger.error(f"[Monitor] Redis 檢查失敗: {e}")
            return {"healthy": False, "error": str(e)}
    
    async def _check_database(self) -> Dict:
        """檢查資料庫連接"""
        try:
            from sqlalchemy import text
            from app.database import SessionLocal
            
            db = SessionLocal()
            try:
                result = db.execute(text("SELECT 1")).fetchone()
                return {
                    "healthy": result is not None,
                    "connection": "ok",
                }
            finally:
                db.close()
        except Exception as e:
            logger.error(f"[Monitor] 資料庫檢查失敗: {e}")
            return {"healthy": False, "error": str(e)}
    
    async def _check_celery_workers(self) -> Dict:
        """檢查 Celery Workers 狀態"""
        result = {
            "healthy": True,
            "workers": {},
            "alerts": [],
            "critical": False,
        }
        
        try:
            from app.celery_app import celery_app
            
            # 獲取活躍的 workers
            inspect = celery_app.control.inspect(timeout=5)
            
            # Ping workers
            ping_result = inspect.ping() or {}
            active_result = inspect.active() or {}
            stats_result = inspect.stats() or {}
            
            expected_workers = ["worker-high", "worker-default", "worker-video"]
            
            for worker_name in expected_workers:
                found = False
                for worker_id, data in ping_result.items():
                    if worker_name in worker_id:
                        found = True
                        result["workers"][worker_name] = {
                            "status": "online",
                            "active_tasks": len(active_result.get(worker_id, [])),
                            "pid": stats_result.get(worker_id, {}).get("pid"),
                        }
                        break
                
                if not found:
                    result["healthy"] = False
                    result["workers"][worker_name] = {"status": "offline"}
                    
                    # worker-video 離線是嚴重問題
                    if worker_name == "worker-video":
                        result["critical"] = True
                        result["alerts"].append({
                            "component": f"celery_{worker_name}",
                            "level": "critical",
                            "message": f"Celery Worker '{worker_name}' 已離線！影片生成功能受影響",
                        })
                    else:
                        result["alerts"].append({
                            "component": f"celery_{worker_name}",
                            "level": "warning",
                            "message": f"Celery Worker '{worker_name}' 已離線",
                        })
            
            return result
            
        except Exception as e:
            logger.error(f"[Monitor] Celery Workers 檢查失敗: {e}")
            return {
                "healthy": False,
                "error": str(e),
                "critical": True,
                "alerts": [{
                    "component": "celery",
                    "level": "critical",
                    "message": f"無法連接 Celery: {e}",
                }]
            }
    
    async def _check_system_resources(self) -> Dict:
        """檢查系統資源"""
        result = {
            "memory": {},
            "disk": {},
            "alerts": [],
        }
        
        try:
            import psutil
            
            # 記憶體
            mem = psutil.virtual_memory()
            result["memory"] = {
                "percent": mem.percent,
                "available_gb": round(mem.available / (1024**3), 2),
                "total_gb": round(mem.total / (1024**3), 2),
            }
            
            if mem.percent >= self.THRESHOLDS["memory_critical"]:
                result["alerts"].append({
                    "component": "memory",
                    "level": "critical",
                    "message": f"記憶體使用率 {mem.percent}% 超過臨界值！",
                })
            elif mem.percent >= self.THRESHOLDS["memory_warning"]:
                result["alerts"].append({
                    "component": "memory",
                    "level": "warning",
                    "message": f"記憶體使用率 {mem.percent}% 偏高",
                })
            
            # 磁碟
            disk = psutil.disk_usage("/")
            result["disk"] = {
                "percent": disk.percent,
                "free_gb": round(disk.free / (1024**3), 2),
                "total_gb": round(disk.total / (1024**3), 2),
            }
            
            if disk.percent >= self.THRESHOLDS["disk_critical"]:
                result["alerts"].append({
                    "component": "disk",
                    "level": "critical",
                    "message": f"磁碟使用率 {disk.percent}% 超過臨界值！",
                })
            elif disk.percent >= self.THRESHOLDS["disk_warning"]:
                result["alerts"].append({
                    "component": "disk",
                    "level": "warning",
                    "message": f"磁碟使用率 {disk.percent}% 偏高",
                })
            
        except ImportError:
            result["error"] = "psutil 未安裝"
        except Exception as e:
            result["error"] = str(e)
        
        return result
    
    async def _check_queue_length(self) -> Dict:
        """檢查 Celery 佇列長度"""
        result = {
            "queues": {},
            "alerts": [],
        }
        
        try:
            import redis
            client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))
            
            queues = ["queue_high", "queue_default", "queue_video"]
            
            for queue in queues:
                length = client.llen(queue)
                result["queues"][queue] = length
                
                if length >= self.THRESHOLDS["queue_critical"]:
                    result["alerts"].append({
                        "component": f"queue_{queue}",
                        "level": "critical",
                        "message": f"佇列 {queue} 長度 {length} 超過臨界值！",
                    })
                elif length >= self.THRESHOLDS["queue_warning"]:
                    result["alerts"].append({
                        "component": f"queue_{queue}",
                        "level": "warning",
                        "message": f"佇列 {queue} 長度 {length} 偏高",
                    })
                    
        except Exception as e:
            result["error"] = str(e)
        
        return result
    
    async def _send_alert(
        self,
        level: AlertLevel,
        component: str,
        message: str,
    ):
        """發送告警"""
        # 檢查告警抑制
        alert_key = f"{component}:{level.value}"
        cooldown = self.ALERT_COOLDOWN.get(level, 60)
        
        if alert_key in self._last_alerts:
            elapsed = (datetime.utcnow() - self._last_alerts[alert_key]).total_seconds()
            if elapsed < cooldown:
                logger.debug(f"[Monitor] 告警抑制中: {alert_key}")
                return
        
        self._last_alerts[alert_key] = datetime.utcnow()
        
        # 格式化告警訊息
        alert_msg = self._format_alert(level, component, message)
        
        # 發送到各通道
        if level in [AlertLevel.CRITICAL, AlertLevel.WARNING]:
            # Slack
            if self._alert_channels["slack"]["enabled"]:
                await self._send_slack(alert_msg, level)
            
            # Email（僅嚴重告警）
            if level == AlertLevel.CRITICAL and self._alert_channels["email"]["enabled"]:
                await self._send_email(alert_msg, level)
            
            # Line Notify
            if self._alert_channels["line"]["enabled"]:
                await self._send_line(alert_msg, level)
        
        # 始終輸出到控制台
        log_func = logger.critical if level == AlertLevel.CRITICAL else logger.warning
        log_func(f"[ALERT] {alert_msg}")
    
    def _format_alert(self, level: AlertLevel, component: str, message: str) -> str:
        """格式化告警訊息"""
        emoji = {
            AlertLevel.INFO: "ℹ️",
            AlertLevel.WARNING: "⚠️",
            AlertLevel.CRITICAL: "🚨",
            AlertLevel.RECOVERY: "✅",
        }
        
        return f"{emoji.get(level, '')} [{level.value.upper()}] {component}: {message}"
    
    async def _send_slack(self, message: str, level: AlertLevel):
        """發送 Slack 通知"""
        webhook_url = self._alert_channels["slack"]["webhook_url"]
        if not webhook_url:
            return
        
        try:
            color = {
                AlertLevel.WARNING: "#ff9800",
                AlertLevel.CRITICAL: "#f44336",
                AlertLevel.RECOVERY: "#4caf50",
            }.get(level, "#2196f3")
            
            payload = {
                "attachments": [{
                    "color": color,
                    "text": message,
                    "footer": "KingJam AI Monitor",
                    "ts": int(datetime.utcnow().timestamp()),
                }]
            }
            
            async with httpx.AsyncClient() as client:
                await client.post(webhook_url, json=payload, timeout=10)
                
        except Exception as e:
            logger.error(f"[Monitor] Slack 發送失敗: {e}")
    
    async def _send_email(self, message: str, level: AlertLevel):
        """發送 Email 通知"""
        # 使用 SendGrid 或其他郵件服務
        try:
            from app.services.email_service import send_email
            
            recipients = self._alert_channels["email"]["recipients"]
            subject = f"[{level.value.upper()}] KingJam AI 系統告警"
            
            for recipient in recipients:
                if recipient.strip():
                    await send_email(
                        to=recipient.strip(),
                        subject=subject,
                        body=message,
                    )
        except Exception as e:
            logger.error(f"[Monitor] Email 發送失敗: {e}")
    
    async def _send_line(self, message: str, level: AlertLevel):
        """發送 Line Notify"""
        token = self._alert_channels["line"]["token"]
        if not token:
            return
        
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    "https://notify-api.line.me/api/notify",
                    headers={"Authorization": f"Bearer {token}"},
                    data={"message": message},
                    timeout=10,
                )
        except Exception as e:
            logger.error(f"[Monitor] Line Notify 發送失敗: {e}")
    
    async def send_recovery_alert(self, component: str, message: str):
        """發送恢復通知"""
        await self._send_alert(
            level=AlertLevel.RECOVERY,
            component=component,
            message=message,
        )


# 全局實例
system_monitor = SystemMonitor()
