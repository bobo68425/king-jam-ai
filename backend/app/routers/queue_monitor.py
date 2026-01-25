"""
佇列監控 API
提供 Celery 佇列狀態、Worker 健康度等資訊

端點：
- GET /queue/status - 所有佇列狀態
- GET /queue/video/status - 影片佇列詳情
- POST /queue/video/scale - 手動擴展影片 Worker（需管理員權限）
"""

import os
import subprocess
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import redis

from app.routers.auth import get_current_user
from app.models import User

router = APIRouter(prefix="/queue", tags=["Queue Monitor"])

# Redis 連接配置
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
VIDEO_REDIS_URL = os.getenv("VIDEO_REDIS_URL", "redis://localhost:6380/0")


class QueueStatus(BaseModel):
    """佇列狀態"""
    name: str
    length: int
    consumers: int = 0


class VideoQueueStatus(BaseModel):
    """影片佇列詳細狀態"""
    queue_length: int
    active_tasks: int
    workers: int
    min_workers: int = 1
    max_workers: int = 5
    scale_up_threshold: int = 10
    should_scale: bool = False
    recommended_replicas: int = 1
    redis_memory_mb: float = 0
    timestamp: str


class ScaleRequest(BaseModel):
    """擴展請求"""
    replicas: int


class ScaleResponse(BaseModel):
    """擴展回應"""
    success: bool
    message: str
    previous_replicas: int
    new_replicas: int


def get_redis_client(url: str) -> redis.Redis:
    """獲取 Redis 客戶端"""
    return redis.from_url(url, decode_responses=True)


@router.get("/status", response_model=Dict[str, QueueStatus])
async def get_all_queue_status(
    current_user: User = Depends(get_current_user)
):
    """
    獲取所有佇列狀態
    """
    queues = {}
    
    try:
        # 主 Redis 佇列
        main_redis = get_redis_client(REDIS_URL)
        
        for queue_name in ["queue_high", "queue_default", "queue_analytics"]:
            length = main_redis.llen(queue_name)
            queues[queue_name] = QueueStatus(
                name=queue_name,
                length=length
            )
        
        # 影片 Redis 佇列
        video_redis = get_redis_client(VIDEO_REDIS_URL)
        video_length = video_redis.llen("queue_video")
        queues["queue_video"] = QueueStatus(
            name="queue_video",
            length=video_length
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"無法獲取佇列狀態: {str(e)}"
        )
    
    return queues


@router.get("/video/status", response_model=VideoQueueStatus)
async def get_video_queue_status(
    current_user: User = Depends(get_current_user)
):
    """
    獲取影片佇列詳細狀態
    包含擴展建議
    """
    min_workers = int(os.getenv("MIN_WORKERS", "1"))
    max_workers = int(os.getenv("MAX_WORKERS", "5"))
    scale_up_threshold = int(os.getenv("SCALE_UP_THRESHOLD", "10"))
    
    try:
        video_redis = get_redis_client(VIDEO_REDIS_URL)
        
        # 佇列長度
        queue_length = video_redis.llen("queue_video")
        
        # 活躍任務
        active_keys = video_redis.keys("celery-task-meta-*")
        active_tasks = len(active_keys)
        
        # Worker 數量（從 Docker 獲取）
        workers = 1
        try:
            result = subprocess.run(
                ["docker", "compose", "ps", "-q", "celery-worker-video"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                workers = len([l for l in result.stdout.strip().split("\n") if l])
        except Exception:
            pass
        
        # Redis 記憶體使用
        info = video_redis.info("memory")
        redis_memory_mb = info.get("used_memory", 0) / (1024 * 1024)
        
        # 計算建議副本數
        should_scale = queue_length > scale_up_threshold
        if queue_length <= 0:
            recommended_replicas = min_workers
        elif queue_length > scale_up_threshold:
            extra = (queue_length - scale_up_threshold) // 10 + 1
            recommended_replicas = min(min_workers + extra, max_workers)
        else:
            recommended_replicas = workers
        
        return VideoQueueStatus(
            queue_length=queue_length,
            active_tasks=active_tasks,
            workers=workers,
            min_workers=min_workers,
            max_workers=max_workers,
            scale_up_threshold=scale_up_threshold,
            should_scale=should_scale,
            recommended_replicas=recommended_replicas,
            redis_memory_mb=round(redis_memory_mb, 2),
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"無法獲取影片佇列狀態: {str(e)}"
        )


@router.post("/video/scale", response_model=ScaleResponse)
async def scale_video_workers(
    request: ScaleRequest,
    current_user: User = Depends(get_current_user)
):
    """
    手動擴展影片 Worker
    需要管理員權限
    """
    # 檢查管理員權限
    if current_user.tier not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理員權限"
        )
    
    min_workers = int(os.getenv("MIN_WORKERS", "1"))
    max_workers = int(os.getenv("MAX_WORKERS", "5"))
    
    # 驗證範圍
    if request.replicas < min_workers or request.replicas > max_workers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"副本數必須在 {min_workers} 到 {max_workers} 之間"
        )
    
    # 獲取當前副本數
    previous_replicas = 1
    try:
        result = subprocess.run(
            ["docker", "compose", "ps", "-q", "celery-worker-video"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            previous_replicas = len([l for l in result.stdout.strip().split("\n") if l])
    except Exception:
        pass
    
    # 執行擴展
    try:
        result = subprocess.run(
            ["docker", "compose", "up", "-d", "--scale", f"celery-worker-video={request.replicas}"],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            return ScaleResponse(
                success=True,
                message=f"已將 Video Worker 從 {previous_replicas} 擴展至 {request.replicas}",
                previous_replicas=previous_replicas,
                new_replicas=request.replicas
            )
        else:
            return ScaleResponse(
                success=False,
                message=f"擴展失敗: {result.stderr}",
                previous_replicas=previous_replicas,
                new_replicas=previous_replicas
            )
            
    except subprocess.TimeoutExpired:
        return ScaleResponse(
            success=False,
            message="擴展超時，請稍後重試",
            previous_replicas=previous_replicas,
            new_replicas=previous_replicas
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"擴展失敗: {str(e)}"
        )
