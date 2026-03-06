"""
LTX Video 影片片段生成服務
======================
使用 LTX API 生成 AI 影片片段，並透過 Celery 轉為非同步
支持模型: LTX-2 (Text-to-Video, Image-to-Video)
"""

import os
import logging
from typing import Optional, Dict, Any

from app.celery_app import celery_app
from celery.result import AsyncResult

logger = logging.getLogger(__name__)

async def generate_scene_clip(
    prompt: str = "",
    duration: int = 5,
    aspect_ratio: str = "9:16",
    model_preference: str = "auto",
    webhook_url: Optional[str] = None,
    reference_image_url: Optional[str] = None,
    audio_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    委託 Celery 工作節點非同步生成 LTX 影片片段
    """
    from app.tasks.video_tasks import generate_ltx_video_task
    
    # 比例轉換為 LTX 支援的分辨率
    # 參考: 9:16 = 720x1280, 16:9 = 1280x720, 1:1 = 1024x1024
    resolution = "1280x720"
    if aspect_ratio == "9:16":
        resolution = "720x1280"
    elif aspect_ratio == "1:1":
        resolution = "1024x1024"

    model = "ltx-2-pro" if "pro" in model_preference.lower() else "ltx-2"
    
    # 發送任務到 Celery 的 queue_video
    task = generate_ltx_video_task.apply_async(
        kwargs={
            "prompt": prompt,
            "duration": duration,
            "model": model,
            "resolution": resolution,
            "image_url": reference_image_url
        }
    )
    
    logger.info(f"[LTX] 任務已提交: model={model}, request_id={task.id}")
    
    return {
        "request_id": task.id,
        "model": model,
        "status": "queued",
    }


async def check_scene_status(request_id: str, model_id: str) -> Dict[str, Any]:
    """
    查詢 Celery 任務狀態並取得結果
    """
    res = AsyncResult(request_id, app=celery_app)
    
    status = res.state
    logger.info(f"[LTX] 狀態查詢: {request_id} → {status}")
    
    if status == "SUCCESS":
        result_data = res.result
        video_url = None
        if isinstance(result_data, dict) and result_data.get("success"):
            video_url = result_data.get("video_url")
            
        if video_url:
            logger.info(f"[LTX] ✅ 影片生成完成: {video_url[:100]}")
            
        return {
            "request_id": request_id,
            "status": "completed",
            "video_url": video_url,
        }
        
    elif status == "FAILURE":
        return {
            "request_id": request_id,
            "status": "failed",
            "error": str(res.info),
        }
    
    # PENDING / STARTED / RETRY 等其他狀態統一轉為全小寫
    return {
        "request_id": request_id,
        "status": status.lower() if status else "queued",
    }


async def handle_webhook(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    LTX Webhook 處理 (目前若未使用，僅提供相容介面)
    """
    request_id = payload.get("request_id", "")
    status = payload.get("status", "")
    return {"request_id": request_id, "status": status.lower()}
