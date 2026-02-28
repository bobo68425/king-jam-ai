"""
Remotion Render Client
======================
調用 Cloud Run 上的 Remotion 渲染服務
"""

import os
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Cloud Run 渲染服務 URL
RENDER_SERVICE_URL = os.getenv(
    "REMOTION_RENDER_URL",
    "https://kingjam-video-renderer-xxxxx.run.app"  # 部署後替換
)


async def submit_render_job(
    props: Dict[str, Any],
    output_format: str = "mp4",
    quality: str = "medium",
) -> Dict[str, Any]:
    """
    提交渲染任務到 Cloud Run
    
    Args:
        props: ShortVideoProps (JSON 格式)
        output_format: mp4 / webm
        quality: low / medium / high
    
    Returns:
        { "jobId": str, "status": "queued" }
    """
    import httpx
    
    payload = {
        "props": props,
        "outputFormat": output_format,
        "quality": quality,
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{RENDER_SERVICE_URL}/render",
            json=payload,
        )
        response.raise_for_status()
        result = response.json()
    
    logger.info(f"[RenderClient] 渲染任務已提交: {result}")
    return result


async def check_render_status(job_id: str) -> Dict[str, Any]:
    """
    查詢渲染任務狀態
    
    Returns:
        { "jobId": str, "status": str, "progress": int, 
          "videoUrl": str | None, "durationMs": int }
    """
    import httpx
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{RENDER_SERVICE_URL}/status/{job_id}"
        )
        response.raise_for_status()
        return response.json()


async def download_rendered_video(job_id: str) -> Optional[str]:
    """
    下載渲染完成的影片到本地
    
    Returns:
        本地檔案路徑
    """
    import httpx
    import tempfile
    
    status = await check_render_status(job_id)
    if status.get("status") != "done" or not status.get("videoUrl"):
        return None
    
    video_url = f"{RENDER_SERVICE_URL}{status['videoUrl']}"
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.get(video_url)
        response.raise_for_status()
        
        with tempfile.NamedTemporaryFile(
            delete=False, suffix=".mp4", prefix="v3_render_"
        ) as f:
            f.write(response.content)
            logger.info(f"[RenderClient] 影片已下載: {f.name}")
            return f.name
