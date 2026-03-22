"""
Remotion Render Client
======================
調用 Cloud Run 上的 Remotion 渲染服務
"""

import os
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# 外部渲染服務 URL（目前改用本地 FFmpeg，此變數僅在 check_render_status fallback 時使用）
RENDER_SERVICE_URL = os.getenv("REMOTION_RENDER_URL", "")

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
    提交渲染任務。
    如果 REMOTION_RENDER_URL 已設定且非空，則發送到雲端/遠端 Remotion 服務。
    否則，執行本地 FFmpeg 渲染作為回退。
    
    Args:
        props: ShortVideoProps (JSON 格式)，包含 scenes, tts_url, bgm 等
        output_format: mp4 
        quality: low / medium / high
    
    Returns:
        { "jobId": str, "status": "done/rendering", "videoUrl": "..." }
    """
    if RENDER_SERVICE_URL:
        return await submit_render_job_remote(props, output_format, quality)
    else:
        return await submit_render_job_local(props, output_format, quality)


async def submit_render_job_remote(
    props: Dict[str, Any],
    output_format: str = "mp4",
    quality: str = "medium",
) -> Dict[str, Any]:
    """呼叫遠端 Remotion 渲染服務"""
    import httpx
    
    payload = {
        "props": props,
        "outputFormat": output_format,
        "quality": quality,
    }
    
    logger.info(f"[RenderClient] 提交遠端渲染任務: {RENDER_SERVICE_URL}/render")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{RENDER_SERVICE_URL}/render",
            json=payload,
            headers=_get_gcp_auth_headers()
        )
        resp.raise_for_status()
        return resp.json()


async def submit_render_job_local(
    props: Dict[str, Any],
    output_format: str = "mp4",
    quality: str = "medium",
) -> Dict[str, Any]:
    """
    執行本地 FFmpeg 渲染 (回退方案)
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
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            # 下載背景音樂
            local_bgm = None
            if music_url:
                local_bgm = temp_path / "bgm.mp3"
                try:
                    resp = await client.get(music_url, headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"})
                    if resp.status_code == 200:
                        local_bgm.write_bytes(resp.content)
                        logger.info(f"[RenderClient] BGM 下載成功: {len(resp.content)} bytes")
                except Exception as e:
                    logger.error(f"[RenderClient] BGM 下載失敗: {e}")
            
            # 下載配音
            local_tts = None
            if tts_url:
                local_tts = temp_path / "tts.mp3"
                try:
                    resp = await client.get(tts_url, headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"})
                    if resp.status_code == 200:
                        local_tts.write_bytes(resp.content)
                        logger.info(f"[RenderClient] TTS 下載成功: {len(resp.content)} bytes")
                except Exception as e:
                    logger.error(f"[RenderClient] TTS 下載失敗: {e}")
            
            # 下載影片片段
            video_clips = []
            for i, scene in enumerate(scenes):
                clip_url = scene.get("videoUrl") or scene.get("media", {}).get("url")
                if not clip_url:
                    logger.warning(f"[RenderClient] Scene {i} 缺少 videoUrl/media.url，跳過")
                    continue
                logger.info(f"[RenderClient] 正在下載 Scene {i}: {clip_url}")
                clip_path = temp_path / f"scene_{i}.mp4"
                
                # R2 Proxy Download
                if "r2.dev" in clip_url or "cloudflarestorage.com" in clip_url or "kingjam" in clip_url:
                    from urllib.parse import urlparse
                    try:
                        parsed = urlparse(clip_url)
                        # R2 S3 key should be everything after the domain
                        # e.g. /videos/user_id/2026/03/filename.mp4
                        # 有些連結可能包含 bucket name 在 path 開頭，我們嘗試偵測並移除
                        s3_key = parsed.path.lstrip("/")
                        bucket_name = os.getenv("R2_BUCKET_NAME", "kingjam-media")
                        
                        if s3_key.startswith(f"{bucket_name}/"):
                            s3_key = s3_key[len(bucket_name)+1:]
                        
                        logger.info(f"[RenderClient] Scene {i} 偵測到內部連結，嘗試 Boto3 下載 (Bucket: {bucket_name}, Key: {s3_key})")
                        from app.services.cloud_storage import cloud_storage
                        s3_obj = cloud_storage.client.get_object(Bucket=bucket_name, Key=s3_key)
                        clip_path.write_bytes(s3_obj['Body'].read())
                        video_clips.append(str(clip_path))
                        logger.info(f"[RenderClient] Scene {i} Boto3 下載成功 (Size: {len(clip_path.read_bytes())} bytes)")
                        continue
                    except Exception as e:
                        logger.warning(f"[RenderClient] Scene {i} Boto3 下載失敗 (Key: {s3_key if 's3_key' in locals() else 'unknown'}), 回退 HTTP: {e}")
                
                # HTTP Download (Fallback)
                try:
                    logger.info(f"[RenderClient] Scene {i} 嘗試 HTTP 下載: {clip_url}")
                    resp = await client.get(clip_url, headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"})
                    if resp.status_code == 200:
                        clip_path.write_bytes(resp.content)
                        video_clips.append(str(clip_path))
                        logger.info(f"[RenderClient] Scene {i} HTTP 下載成功: {len(resp.content)} bytes")
                    else:
                        logger.error(f"[RenderClient] Scene {i} HTTP 下載失敗 ({resp.status_code}): {clip_url[:150]}")
                except Exception as e:
                    logger.error(f"[RenderClient] Scene {i} HTTP 下載異常: {e}")
        
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
        
        with open(final_video, "rb") as f:
            video_data = f.read()
        
        upload_result = cloud_storage.upload_bytes(
            data=video_data,
            user_id=0,
            file_type="videos/v3/render",
            filename=f"{job_id}.mp4",
            content_type="video/mp4"
        )
        
        if not upload_result.get("success"):
            raise Exception(f"Failed to upload final video to cloud storage: {upload_result.get('error')}")
        
        r2_url = upload_result["url"]
            
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
