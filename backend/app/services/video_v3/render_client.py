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
    "https://kingjam-video-renderer-811364632967.asia-east1.run.app"
)

def _get_gcp_auth_headers() -> Dict[str, str]:
    """若呼叫的對象是受 IAM 保護的 Cloud Run 服務，則嘗試取得並帶上 ID Token。"""
    headers = {}
    if "run.app" in RENDER_SERVICE_URL:
        try:
            import google.auth.transport.requests
            import google.oauth2.id_token
            req = google.auth.transport.requests.Request()
            token = google.oauth2.id_token.fetch_id_token(req, RENDER_SERVICE_URL)
            headers["Authorization"] = f"Bearer {token}"
        except Exception as e:
            logger.warning(f"[RenderClient] OIDC ID Token 獲取失敗 (可能未設定憑證或不需要 IAM): {e}")
    return headers


async def submit_render_job(
    props: Dict[str, Any],
    output_format: str = "mp4",
    quality: str = "medium",
) -> Dict[str, Any]:
    """
    執行本地 FFmpeg 渲染 (取代原本的 Cloud Run Remotion 渲染)
    
    Args:
        props: ShortVideoProps (JSON 格式)，包含 scenes, tts_url, bgm 等
        output_format: mp4 
        quality: low / medium / high
    
    Returns:
        { "jobId": str, "status": "done", "videoUrl": "..." }
    """
    import httpx
    import asyncio
    import tempfile
    from pathlib import Path
    from app.services.cloud_storage import cloud_storage

    logger.info(f"[RenderClient] 開始本地 FFmpeg 渲染: quality={quality}, format={output_format}")

    # 解析 props
    scenes = props.get("scenes", [])
    music_url = props.get("music", {}).get("url")
    tts_url = props.get("tts", {}).get("url")
    
    # 創建暫存資料夾
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        # 1. 下載所有素材
        async with httpx.AsyncClient() as client:
            # 下載背景音樂
            local_bgm = None
            if music_url:
                local_bgm = temp_path / "bgm.mp3"
                resp = await client.get(music_url, headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"})
                if resp.status_code == 200:
                    local_bgm.write_bytes(resp.content)
            
            # 下載配音
            local_tts = None
            if tts_url:
                local_tts = temp_path / "tts.mp3"
                resp = await client.get(tts_url, headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"})
                if resp.status_code == 200:
                    local_tts.write_bytes(resp.content)
            
            # 下載影片片段
            video_clips = []
            for i, scene in enumerate(scenes):
                clip_url = scene.get("media", {}).get("url")
                if clip_url:
                    clip_path = temp_path / f"scene_{i}.mp4"
                    
                    # R2 Proxy Download: 如果是我們自己的的 R2 或 API 網域，改用 boto3 S3 下載以穿透 Cloudflare 防火牆
                    if "r2.dev" in clip_url or "cloudflarestorage.com" in clip_url:
                        from urllib.parse import urlparse
                        try:
                            parsed = urlparse(clip_url)
                            # 從 /videos/1/2026/03/... 擷取 S3 Key (移除 leading slash)
                            path_parts = parsed.path.strip("/").split("/")
                            if "kingjam-media" in path_parts:
                                path_parts.remove("kingjam-media")
                            s3_key = "/".join(path_parts)
                            
                            logger.info(f"[RenderClient] 偵測到 R2 內部連結，改用 boto3 下載: {s3_key}")
                            from app.services.cloud_storage import cloud_storage
                            s3_obj = cloud_storage.client.get_object(Bucket=cloud_storage.bucket_name, Key=s3_key)
                            clip_path.write_bytes(s3_obj['Body'].read())
                            video_clips.append(str(clip_path))
                            continue
                        except Exception as e:
                            logger.error(f"[RenderClient] 內部 S3 下載失敗，回退 httpx: {e}")
                    
                    # 外部連結 (如 fal.ai 或 fallback) 仍使用 httpx
                    resp = await client.get(clip_url, headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"})
                    if resp.status_code == 200:
                        clip_path.write_bytes(resp.content)
                        video_clips.append(str(clip_path))
                    else:
                        logger.error(f"[RenderClient] 影片 HTTP 下載失敗 ({resp.status_code}): {clip_url[:100]}")
        
        if not video_clips:
            logger.error("[RenderClient] 錯誤: 沒有成功下載任何影片片段。")
            raise Exception("No video clips available to render.")

        # 2. 合併影片片段
        concat_file = temp_path / "concat.txt"
        with open(concat_file, "w") as f:
            for clip in video_clips:
                f.write(f"file '{clip}'\n")
        
        merged_video = temp_path / "merged.mp4"
        cmd_merge = [
            "ffmpeg", "-y", "-f", "concat", "-safe", "0",
            "-i", str(concat_file), "-c", "copy", str(merged_video)
        ]
        
        proc_merge = await asyncio.create_subprocess_exec(*cmd_merge, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        await proc_merge.communicate()
        
        if not merged_video.exists():
            raise Exception("Failed to merge video clips.")

        # 3. 混合音訊
        final_video = temp_path / "final.mp4"
        audio_inputs = []
        filter_complex = ""

        # 第一個輸入是影片
        audio_inputs.extend(["-i", str(merged_video)])
        
        if local_tts and local_bgm:
            audio_inputs.extend(["-i", str(local_tts), "-i", str(local_bgm)])
            filter_complex = "[1:a]volume=1.0[tts];[2:a]volume=0.3[bgm];[tts][bgm]amix=inputs=2:duration=longest[aout]"
        elif local_tts:
            audio_inputs.extend(["-i", str(local_tts)])
            filter_complex = "[1:a]volume=1.0[aout]"
        elif local_bgm:
            audio_inputs.extend(["-i", str(local_bgm)])
            filter_complex = "[1:a]volume=0.3[aout]"

        if filter_complex:
            cmd_mix = [
                "ffmpeg", "-y", *audio_inputs,
                "-filter_complex", filter_complex,
                "-map", "0:v:0", "-map", "[aout]",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest",
                str(final_video)
            ]
        else:
            cmd_mix = [
                "ffmpeg", "-y", *audio_inputs,
                "-c:v", "copy", "-c:a", "aac", "-shortest",
                str(final_video)
            ]
            
        proc_mix = await asyncio.create_subprocess_exec(*cmd_mix, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        stdout, stderr = await proc_mix.communicate()

        if proc_mix.returncode != 0:
            logger.error(f"[RenderClient] 混音失敗，使用原始無聲合併影片: {stderr.decode()[:200]}")
            import shutil
            shutil.copy(str(merged_video), str(final_video))
            
        # 4. 上傳到 R2
        import uuid
        job_id = f"local-render-{uuid.uuid4().hex[:8]}"
        object_name = f"videos/v3/render/{job_id}.mp4"
        
        with open(final_video, "rb") as f:
            video_data = f.read()
            
        r2_url = await cloud_storage.upload_bytes(
            video_data,
            object_name,
            content_type="video/mp4"
        )
        
        if not r2_url:
            raise Exception("Failed to upload final video to cloud storage.")
            
        logger.info(f"[RenderClient] 渲染完成，已上傳至: {r2_url}")
        
        return {
            "jobId": job_id,
            "status": "done",
            "videoUrl": r2_url,
            "durationMs": 0 # Not calculated
        }


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
            f"{RENDER_SERVICE_URL}/status/{job_id}",
            headers=_get_gcp_auth_headers(),
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
        # 如果下載影片的路徑也是受保護的端點 (不含網域)，則需要帶上 token
        # 通常影片產生後會有公開 URL，或者此處直接帶上 token 亦無妨
        req_headers = _get_gcp_auth_headers() if "run.app" in video_url else {}
        response = await client.get(video_url, headers=req_headers)
        response.raise_for_status()
        
        with tempfile.NamedTemporaryFile(
            delete=False, suffix=".mp4", prefix="v3_render_"
        ) as f:
            f.write(response.content)
            logger.info(f"[RenderClient] 影片已下載: {f.name}")
            return f.name
