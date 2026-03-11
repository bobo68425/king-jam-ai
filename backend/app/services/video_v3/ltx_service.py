"""
LTX-2.3 影片片段生成服務 (非阻塞模式)
=================================================
LTX-2.3 Modal 端點:
  POST {LTX_INFERENCE_URL}/v1/text-to-video   → 立即回傳 { task_id, status: "processing" }
  POST {LTX_INFERENCE_URL}/v1/image-to-video  → 立即回傳 { task_id, status: "processing" }
  GET  {LTX_INFERENCE_URL}/v1/status/{task_id} → 輪詢結果 { status, video_url }

LTX-2.3 升級重點 (相較 LTX-Video v1):
  - 22B 參數 DiT + Spatiotemporal Attention
  - 原生 1080p (最高 4K), 原生直式影片 (1080x1920)
  - Distilled 模型: 8 步推論, CFG=1
  - 同步音視訊生成
  - 更強的提示詞遵循 (4x 大 text connector)
  - 最長 20 秒
"""

import os
import asyncio
import logging
import uuid
from typing import Optional, Dict, Any

import httpx

logger = logging.getLogger(__name__)

LTX_INFERENCE_URL = os.getenv("LTX_INFERENCE_URL", "http://localhost:8080")
if "run.app" in LTX_INFERENCE_URL:
    LTX_INFERENCE_URL = "https://bobo68425--kingjam-ltx-video-api.modal.run"

LTX_POLL_TIMEOUT = int(os.getenv("LTX_POLL_TIMEOUT", "10"))
# 冷啟動 (60s) + 模型載入 (5min) + 推論 (5min) = 11min, 給 15min 緩衝
LTX_MAX_WAIT_SECONDS = int(os.getenv("LTX_MAX_WAIT_SECONDS", "900"))
LTX_POLL_INTERVAL = int(os.getenv("LTX_POLL_INTERVAL", "10"))

# LTX-2.3 支援的解析度 (寬x高, 必須為 32 的倍數)
RESOLUTION_MAP = {
    # 直式 (Portrait 9:16)
    "9:16": {
        "480p":  "544x960",
        "720p":  "768x1360",
        "1080p": "1088x1920",
    },
    # 橫式 (Landscape 16:9)
    "16:9": {
        "480p":  "960x544",
        "720p":  "1360x768",
        "1080p": "1920x1088",
    },
    # 正方 (Square 1:1)
    "1:1": {
        "480p":  "768x768",
        "720p":  "1024x1024",
        "1080p": "1408x1408",
    },
}

# 預設品質等級
DEFAULT_QUALITY = "720p"


def _resolve_resolution(aspect_ratio: str, quality: str = DEFAULT_QUALITY) -> str:
    """
    依據比例與品質等級解析 LTX-2.3 解析度。
    LTX-2.3 原生支援 1080p, 所有值必須為 32 的倍數。
    """
    ar_map = RESOLUTION_MAP.get(aspect_ratio, RESOLUTION_MAP["9:16"])
    return ar_map.get(quality, ar_map[DEFAULT_QUALITY])


async def generate_scene_clip(
    prompt: str = "",
    duration: int = 5,
    aspect_ratio: str = "9:16",
    model_preference: str = "auto",
    webhook_url: Optional[str] = None,
    reference_image_url: Optional[str] = None,
    previous_video_url: Optional[str] = None,
    audio_url: Optional[str] = None,
    quality_prompt: str = "",
    negative_prompt: str = "",
    quality: str = DEFAULT_QUALITY,
) -> Dict[str, Any]:
    """
    非阻塞呼叫 LTX-2.3 Modal 服務生成影片。

    LTX-2.3 模型選項:
      - "ltx-2.3"     → Distilled 模型 (8 步, CFG=1, 快速)
      - "ltx-2.3-pro" → Dev 模型 (40 步, CFG=4, 高品質)
    """
    is_pro = "pro" in model_preference.lower()
    model = "ltx-2.3-pro" if is_pro else "ltx-2.3"
    resolution = _resolve_resolution(aspect_ratio, quality)
    job_id = str(uuid.uuid4())

    enhanced_prompt = prompt.strip()
    if quality_prompt:
        if enhanced_prompt and not enhanced_prompt.endswith(","):
            enhanced_prompt += ", "
        enhanced_prompt += quality_prompt

    # LTX-2.3 distilled: 8 步, CFG=1; Pro: 40 步, CFG=4
    num_inference_steps = 40 if is_pro else 8
    cfg_guidance_scale = 4.0 if is_pro else 1.0

    duration = min(duration, 20)

    payload: Dict[str, Any] = {
        "user_id": 1,
        "prompt": enhanced_prompt,
        "negative_prompt": negative_prompt or (
            "shaky, glitchy, low quality, worst quality, deformed, distorted, "
            "disfigured, motion smear, motion artifacts, fused fingers, "
            "bad anatomy, weird hand, ugly, transition, static"
        ),
        "model": model,
        "duration": duration,
        "resolution": resolution,
        "num_inference_steps": num_inference_steps,
        "cfg_guidance_scale": cfg_guidance_scale,
        "frame_rate": 24.0,
    }

    if reference_image_url or previous_video_url:
        endpoint = f"{LTX_INFERENCE_URL}/v1/image-to-video"
        payload["image_uri"] = reference_image_url or previous_video_url
    else:
        endpoint = f"{LTX_INFERENCE_URL}/v1/text-to-video"

    logger.info(f"[LTX-2.3] Submitting: job={job_id}, model={model}, res={resolution}, dur={duration}s, steps={num_inference_steps}")

    async with httpx.AsyncClient(timeout=httpx.Timeout(connect=60.0, read=30.0, write=30.0, pool=5.0)) as client:
        resp = await client.post(endpoint, json=payload)
        if resp.status_code != 200:
            raise ValueError(f"LTX-2.3 submit error: HTTP {resp.status_code} - {resp.text[:300]}")

        data = resp.json()
        task_id = data.get("task_id")

        if not task_id:
            content_type = resp.headers.get("content-type", "")
            if "video" in content_type or "octet-stream" in content_type:
                video_url = await _upload_video_bytes(resp.content, job_id)
                return {"request_id": job_id, "model": model, "status": "completed", "video_url": video_url}
            raise ValueError(f"LTX-2.3: no task_id in response: {data}")

        logger.info(f"[LTX-2.3] task_id={task_id}, returning immediately for polling.")

        return {
            "request_id": task_id,
            "model": model,
            "status": "pending",
            "video_url": None,
        }


async def _upload_video_bytes(video_data: bytes, job_id: str) -> str:
    """(Compat) Upload binary MP4 to cloud storage."""
    import tempfile

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as f:
            f.write(video_data)
            tmp_path = f.name

        def _upload_sync():
            from app.services.cloud_storage import cloud_storage
            return cloud_storage.upload_file(file_path=tmp_path, user_id=0, file_type="videos")

        result = await asyncio.to_thread(_upload_sync)
        if result.get("success"):
            return result["url"]
        return f"/static/videos/ltx_{job_id}.mp4"
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass


async def check_scene_status(request_id: str, model_id: str) -> Dict[str, Any]:
    """LTX-2.3 狀態查詢 (追蹤由 in-memory job store 完成)"""
    return {"request_id": request_id, "status": "pending", "video_url": None}


async def handle_webhook(payload: Dict[str, Any]) -> Dict[str, Any]:
    request_id = payload.get("request_id", "")
    status = payload.get("status", "")
    return {"request_id": request_id, "status": status.lower()}
