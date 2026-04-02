"""
Remotion Render Client
======================
調用遠端 Remotion 渲染服務（若已設定 REMOTION_RENDER_URL）
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
    執行本地 MoviePy 渲染 - 支援 crossfade 轉場，品質更高
    """
    import httpx
    import asyncio
    import tempfile
    from pathlib import Path
    from app.services.cloud_storage import cloud_storage

    logger.info(f"[RenderClient] 開始本地 MoviePy 渲染: quality={quality}, format={output_format}")

    # 解析 props
    scenes = props.get("scenes", [])
    music_url = props.get("music", {}).get("url")
    tts_url = props.get("tts", {}).get("url")
    transition_duration = float(props.get("transitionDuration", 0.5))  # 轉場時長
    
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
                    logger.error(f"[RenderClient] Scene {i} 下載異常: {e}")
        
        if not video_clips:
            logger.error("[RenderClient] 錯誤: 沒有成功下載任何影片片段。")
            raise Exception("No video clips available to render.")

        # 2. 使用 MoviePy 合併影片（支援 crossfade 轉場）
        final_video = await _merge_with_moviepy(
            video_clips, 
            local_tts, 
            local_bgm, 
            temp_path, 
            transition_duration,
            quality
        )
        
        # 3. 上傳到 R2
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
            "durationMs": 0
        }


async def _merge_with_moviepy(
    video_clips: list,
    tts_path: Path | None,
    bgm_path: Path | None,
    temp_path: Path,
    transition_duration: float = 0.5,
    quality: str = "medium"
) -> Path:
    """使用 MoviePy 合併影片並添加 crossfade 轉場"""
    import uuid
    
    # 在執行緒池中執行 MoviePy（因為它是同步的）
    loop = asyncio.get_event_loop()
    
    def _run_moviepy():
        from moviepy import VideoFileClip, concatenate_videoclips, CompositeAudioClip, AudioFileClip
        import moviepy.config as mp_config
        
        # 設定 ImageMagick 路徑（如果需要）
        # mp_config.IMAGEMAGICK_BINARY = "/usr/local/bin/convert"
        
        clips = []
        for clip_path in video_clips:
            clip = VideoFileClip(clip_path)
            clips.append(clip)
        
        if len(clips) == 1:
            final_clip = clips[0]
        elif len(clips) == 2:
            # 兩段影片：直接 crossfade
            final_clip = concatenate_videoclips(
                [clips[0].crossfadeout(transition_duration), 
                 clips[1].crossfadein(transition_duration)],
                method="compose"
            )
        else:
            # 多段影片：使用 compose 方法串聯
            processed_clips = []
            for i, clip in enumerate(clips):
                if i == 0:
                    # 第一段：尾部 crossfade
                    processed_clips.append(clip.crossfadeout(transition_duration))
                elif i == len(clips) - 1:
                    # 最後一段：頭部 crossfade
                    processed_clips.append(clip.crossfadein(transition_duration))
                else:
                    # 中間段：雙向 crossfade
                    processed_clips.append(clip.crossfadein(transition_duration).crossfadeout(transition_duration))
            
            final_clip = concatenate_videoclips(processed_clips, method="compose")
        
        # 添加音訊
        audio_clips = []
        if tts_path and tts_path.exists():
            tts_audio = AudioFileClip(str(tts_path))
            audio_clips.append(tts_audio)
        
        if bgm_path and bgm_path.exists():
            bgm_audio = AudioFileClip(str(bgm_path))
            bgm_audio = bgm_audio.with_volume_scaled(0.3)
            audio_clips.append(bgm_audio)
        
        if audio_clips:
            if len(audio_clips) == 1:
                final_audio = audio_clips[0]
            else:
                from moviepy import CompositeAudioClip
                final_audio = CompositeAudioClip(audio_clips)
            final_clip = final_clip.with_audio(final_audio)
        
        # 輸出設定
        output_path = temp_path / f"final_{uuid.uuid4().hex[:8]}.mp4"
        
        # 品質設定
        quality_presets = {
            "low": {"codec": "libx264", "preset": "fast", "crf": 28},
            "medium": {"codec": "libx264", "preset": "medium", "crf": 23},
            "high": {"codec": "libx264", "preset": "slow", "crf": 18},
        }
        q = quality_presets.get(quality, quality_presets["medium"])
        
        final_clip.write_videofile(
            str(output_path),
            codec=q["codec"],
            preset=q["preset"],
            crf=q["crf"],
            audio_codec="aac",
            audio_bitrate="192k",
            logger=None  # 禁用進度輸出
        )
        
        # 清理 clips
        for clip in clips:
            clip.close()
        
        return output_path
    
    # 在執行緒中執行 MoviePy（避免阻塞事件循環）
    result = await loop.run_in_executor(None, _run_moviepy)
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
