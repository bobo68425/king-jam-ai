"""
LTX-2 影片片段生成服務 (非阻塞模式)
=================================================
LTX Cloud Run 端點 (新架構):
  POST {LTX_INFERENCE_URL}/v1/text-to-video   → 立即回傳 { task_id, status: "processing" }
  POST {LTX_INFERENCE_URL}/v1/image-to-video  → 立即回傳 { task_id, status: "processing" }
  GET  {LTX_INFERENCE_URL}/v1/status/{task_id} → 輪詢結果 { status, video_url }

呼叫流程:
  1. POST → 取得 task_id
  2. 輪詢 /v1/status 直到 status=completed 或 error
  3. 回傳 { request_id, model, status: "completed", video_url }
"""

import os
import asyncio
import logging
import uuid
from typing import Optional, Dict, Any

import httpx

logger = logging.getLogger(__name__)

LTX_INFERENCE_URL = os.getenv("LTX_INFERENCE_URL", "http://localhost:8080")
# 單次 status poll 的 timeout（秒）
LTX_POLL_TIMEOUT = int(os.getenv("LTX_POLL_TIMEOUT", "10"))
# 最長等待生成完成的時間（秒）: cold start (30s) + model load (3min) + generation (5min)
LTX_MAX_WAIT_SECONDS = int(os.getenv("LTX_MAX_WAIT_SECONDS", "900"))
LTX_POLL_INTERVAL = int(os.getenv("LTX_POLL_INTERVAL", "10"))  # poll 間隔（秒）


def _resolve_resolution(aspect_ratio: str) -> str:
    # 降低解析度以大幅縮短生成時間 (約 2-3 分鐘 -> 1 分鐘)
    # 如需更高畫質，可調整為 480x854 / 854x480 / 768x768
    # LTX 要求長寬必須是 32 的倍數
    mapping = {
        "9:16": "480x864",
        "16:9": "864x480",
        "1:1":  "768x768",
    }
    return mapping.get(aspect_ratio, "480x864")


async def generate_scene_clip(
    prompt: str = "",
    duration: int = 5,
    aspect_ratio: str = "9:16",
    model_preference: str = "auto",
    webhook_url: Optional[str] = None,
    reference_image_url: Optional[str] = None,
    audio_url: Optional[str] = None,
    quality_prompt: str = "",
    negative_prompt: str = "",
) -> Dict[str, Any]:
    """
    非阻塞呼叫 LTX Cloud Run 生成影片。

    步驟:
      1. POST /v1/text-to-video → 立即取得 task_id
      2. 輪詢 GET /v1/status/{task_id} 直到完成
      3. 回傳 { request_id, model, status, video_url }
    """
    model = "ltx-2-pro" if "pro" in model_preference.lower() else "ltx-2"
    resolution = _resolve_resolution(aspect_ratio)
    job_id = str(uuid.uuid4())

    # 自動加上質量提示詞與強制寫入 Negative Prompt
    enhanced_prompt = prompt.strip()
    if quality_prompt:
        if enhanced_prompt and not enhanced_prompt.endswith(","):
            enhanced_prompt += ", "
        enhanced_prompt += quality_prompt

    if reference_image_url:
        endpoint = f"{LTX_INFERENCE_URL}/v1/image-to-video"
        payload: Dict[str, Any] = {
            "user_id": 1,
            "prompt": enhanced_prompt,
            "negative_prompt": negative_prompt,
            "model": model,
            "duration": duration,
            "resolution": resolution,
            "image_uri": reference_image_url,
        }
    else:
        endpoint = f"{LTX_INFERENCE_URL}/v1/text-to-video"
        payload = {
            "user_id": 1,
            "prompt": enhanced_prompt,
            "negative_prompt": negative_prompt,
            "model": model,
            "duration": duration,
            "resolution": resolution,
        }

    logger.info(f"[LTX] Submitting task: job={job_id}, model={model}")

    async with httpx.AsyncClient(timeout=httpx.Timeout(connect=60.0, read=30.0, write=30.0, pool=5.0)) as client:
        # ── Step 1: Submit ──────────────────────────────────────────
        resp = await client.post(endpoint, json=payload)
        if resp.status_code != 200:
            raise ValueError(f"LTX submit error: HTTP {resp.status_code} - {resp.text[:300]}")

        data = resp.json()
        task_id = data.get("task_id")

        if not task_id:
            # 舊版 LTX 可能直接回傳 binary MP4（相容）
            content_type = resp.headers.get("content-type", "")
            if "video" in content_type or "octet-stream" in content_type:
                video_url = await _upload_video_bytes(resp.content, job_id)
                return {"request_id": job_id, "model": model, "status": "completed", "video_url": video_url}
            raise ValueError(f"LTX: no task_id in response: {data}")

        logger.info(f"[LTX] task_id={task_id} generated, returning immediately to allow frontend polling.")

        # ── Step 2: Return immediately ──────────────────────────────
        # 不在這裡 blocking poll，直接回傳 task_id, 讓 _run_ltx (或者 polling endpoint) 去處理
        return {
            "request_id": task_id,
            "model": model,
            "status": "pending",
            "video_url": None,
        }


async def _upload_video_bytes(video_data: bytes, job_id: str) -> str:
    """(Compat) Upload binary MP4 from old-style LTX response to GCS."""
    import asyncio
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
    """
    LTX 狀態查詢（相容介面）。
    實際追蹤是在 kingjam-api 的 in-memory job store 完成。
    """
    return {"request_id": request_id, "status": "pending", "video_url": None}


async def handle_webhook(payload: Dict[str, Any]) -> Dict[str, Any]:
    request_id = payload.get("request_id", "")
    status = payload.get("status", "")
    return {"request_id": request_id, "status": status.lower()}
