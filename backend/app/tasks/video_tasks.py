"""
影片渲染任務
- Veo 影片生成
- 影片上傳處理
- 縮圖生成
"""

import logging
import os
import time
from datetime import datetime
from typing import Optional, Dict, Any
import pytz

from app.celery_app import celery_app, VideoRenderTask
from app.database import SessionLocal
from app.models import GenerationHistory, User

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.tasks.video_tasks.render_video_async",
    base=VideoRenderTask,
    bind=True,
    queue="queue_video",  # 專用影片佇列
)
def render_video_async(
    self,
    user_id: int,
    prompt: str,
    duration: int = 8,
    aspect_ratio: str = "9:16",
    quality: str = "standard",
    history_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    非同步影片渲染任務
    
    使用 Veo 2.0 生成影片，因為非常耗時所以放在獨立佇列
    
    Args:
        user_id: 用戶 ID
        prompt: 影片描述
        duration: 影片長度（秒）
        aspect_ratio: 寬高比
        quality: 品質等級
        history_id: 生成歷史記錄 ID（可選）
    """
    logger.info(f"[Video] 開始渲染影片 - 用戶 #{user_id}, prompt: {prompt[:50]}...")
    
    start_time = time.time()
    db = SessionLocal()
    
    try:
        # 更新歷史記錄狀態
        history = None
        if history_id:
            history = db.query(GenerationHistory).filter(
                GenerationHistory.id == history_id
            ).first()
            if history:
                history.status = "processing"
                db.commit()
        
        # 發送開始通知
        from app.tasks.notification_tasks import send_instant_notification
        send_instant_notification.delay(
            user_id=user_id,
            title="影片開始生成",
            message=f"您的影片正在生成中，預計需要 2-5 分鐘...",
            notification_type="content"
        )
        
        # 調用 Veo 生成影片
        result = _generate_video_with_veo(
            prompt=prompt,
            duration=duration,
            aspect_ratio=aspect_ratio,
            quality=quality
        )
        
        if not result.get("success"):
            raise Exception(result.get("error", "影片生成失敗"))
        
        video_url = result["video_url"]
        video_path = result.get("video_path")
        
        # 生成縮圖
        thumbnail_url = None
        if video_path and os.path.exists(video_path):
            thumbnail_url = _generate_thumbnail(video_path)
        
        # 上傳到雲端儲存
        cloud_url = None
        cloud_key = None
        if video_path:
            upload_result = _upload_to_cloud(video_path, user_id)
            if upload_result.get("success"):
                cloud_url = upload_result["url"]
                cloud_key = upload_result["key"]
        
        # 計算生成時間
        duration_ms = int((time.time() - start_time) * 1000)
        
        # 更新歷史記錄
        if history:
            history.status = "completed"
            history.media_local_path = video_path
            history.media_cloud_url = cloud_url
            history.media_cloud_key = cloud_key
            history.thumbnail_url = thumbnail_url
            history.generation_duration_ms = duration_ms
            history.output_data = {
                **(history.output_data or {}),
                "video_url": video_url,
                "cloud_url": cloud_url,
            }
            db.commit()
        
        # 發送完成通知
        send_instant_notification.delay(
            user_id=user_id,
            title="影片生成完成",
            message=f"您的影片已生成完成！",
            notification_type="content",
            data={"video_url": cloud_url or video_url}
        )
        
        logger.info(f"[Video] 影片渲染完成 - 耗時 {duration_ms}ms")
        
        return {
            "success": True,
            "video_url": cloud_url or video_url,
            "thumbnail_url": thumbnail_url,
            "duration_ms": duration_ms
        }
        
    except Exception as e:
        logger.error(f"[Video] 影片渲染失敗: {e}")
        
        # 更新歷史記錄
        if history_id:
            try:
                history = db.query(GenerationHistory).filter(
                    GenerationHistory.id == history_id
                ).first()
                if history:
                    history.status = "failed"
                    history.error_message = str(e)
                    db.commit()
            except:
                pass
        
        # 發送失敗通知
        from app.tasks.notification_tasks import send_instant_notification
        send_instant_notification.delay(
            user_id=user_id,
            title="影片生成失敗",
            message=f"很抱歉，影片生成過程中發生錯誤：{str(e)}",
            notification_type="content"
        )
        
        # 重試
        raise self.retry(exc=e)
        
    finally:
        db.close()


@celery_app.task(
    name="app.tasks.video_tasks.process_video_upload",
    base=VideoRenderTask,
    bind=True,
    queue="queue_video",
)
def process_video_upload(
    self,
    user_id: int,
    local_path: str,
    filename: str,
    history_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    處理影片上傳
    
    包括：
    - 轉碼（如需要）
    - 生成縮圖
    - 上傳到雲端
    
    Args:
        user_id: 用戶 ID
        local_path: 本地檔案路徑
        filename: 原始檔名
        history_id: 歷史記錄 ID
    """
    logger.info(f"[Video] 處理上傳影片 - {filename}")
    
    db = SessionLocal()
    
    try:
        if not os.path.exists(local_path):
            raise Exception(f"檔案不存在: {local_path}")
        
        # 取得檔案大小
        file_size = os.path.getsize(local_path)
        
        # 生成縮圖
        thumbnail_url = _generate_thumbnail(local_path)
        
        # 上傳到雲端
        upload_result = _upload_to_cloud(local_path, user_id)
        
        if not upload_result.get("success"):
            raise Exception(upload_result.get("error", "上傳失敗"))
        
        # 更新歷史記錄
        if history_id:
            history = db.query(GenerationHistory).filter(
                GenerationHistory.id == history_id
            ).first()
            if history:
                history.media_cloud_url = upload_result["url"]
                history.media_cloud_key = upload_result["key"]
                history.media_cloud_provider = upload_result.get("provider", "r2")
                history.thumbnail_url = thumbnail_url
                history.file_size_bytes = file_size
                db.commit()
        
        logger.info(f"[Video] 影片上傳完成 - {upload_result['url']}")
        
        return {
            "success": True,
            "cloud_url": upload_result["url"],
            "cloud_key": upload_result["key"],
            "thumbnail_url": thumbnail_url,
            "file_size": file_size
        }
        
    except Exception as e:
        logger.error(f"[Video] 處理上傳失敗: {e}")
        raise self.retry(exc=e)
    finally:
        db.close()


# ============================================================
# 輔助函數
# ============================================================

def _generate_video_with_veo(
    prompt: str,
    duration: int = 8,
    aspect_ratio: str = "9:16",
    quality: str = "standard"
) -> Dict[str, Any]:
    """
    使用 Veo 2.0 生成影片
    """
    import os
    
    try:
        from google import genai
        from google.genai import types
        
        # 初始化客戶端
        client = genai.Client(
            vertexai=True,
            project=os.getenv("GOOGLE_CLOUD_PROJECT"),
            location=os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
        )
        
        # 生成影片
        operation = client.models.generate_videos(
            model="veo-2.0-generate-001",
            prompt=prompt,
            config=types.GenerateVideosConfig(
                aspect_ratio=aspect_ratio,
                number_of_videos=1,
                duration_seconds=duration,
                person_generation="allow_adult",
            ),
        )
        
        # 等待完成（這可能需要幾分鐘）
        while not operation.done:
            logger.info(f"[Video] Veo 生成中... {operation.metadata}")
            time.sleep(10)
            operation = client.operations.get(operation)
        
        # 檢查結果
        if operation.error:
            return {"success": False, "error": str(operation.error)}
        
        video = operation.result.generated_videos[0]
        
        # 儲存影片
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = "/app/static/videos"
        os.makedirs(output_dir, exist_ok=True)
        output_path = f"{output_dir}/veo_{timestamp}.mp4"
        
        video.video.save(output_path)
        
        return {
            "success": True,
            "video_url": f"/static/videos/veo_{timestamp}.mp4",
            "video_path": output_path
        }
        
    except ImportError:
        logger.warning("[Video] google-genai 未安裝，使用模擬模式")
        # 開發模式：返回模擬結果
        return {
            "success": True,
            "video_url": "/static/videos/sample.mp4",
            "video_path": None
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def _generate_thumbnail(video_path: str) -> Optional[str]:
    """
    從影片生成縮圖
    """
    try:
        import subprocess
        
        # 使用 ffmpeg 生成縮圖（取第 1 秒的畫面）
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = "/app/static/thumbnails"
        os.makedirs(output_dir, exist_ok=True)
        thumbnail_path = f"{output_dir}/thumb_{timestamp}.jpg"
        
        cmd = [
            "ffmpeg", "-y",
            "-i", video_path,
            "-ss", "00:00:01",
            "-vframes", "1",
            "-q:v", "2",
            thumbnail_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0 and os.path.exists(thumbnail_path):
            return f"/static/thumbnails/thumb_{timestamp}.jpg"
        else:
            logger.warning(f"[Video] 縮圖生成失敗: {result.stderr}")
            return None
            
    except Exception as e:
        logger.warning(f"[Video] 縮圖生成錯誤: {e}")
        return None


def _upload_to_cloud(local_path: str, user_id: int) -> Dict[str, Any]:
    """
    上傳檔案到雲端儲存
    """
    import os
    
    try:
        from app.services.cloud_storage import cloud_storage
        
        # 使用 cloud_storage 的 upload_file 方法上傳
        result = cloud_storage.upload_file(
            file_path=local_path,
            user_id=user_id,
            file_type="videos"
        )
        
        return result
        
    except ImportError:
        logger.warning("[Video] 雲端儲存服務未配置，跳過上傳")
        return {"success": False, "error": "雲端儲存服務未配置"}
    except Exception as e:
        return {"success": False, "error": str(e)}


@celery_app.task(
    name="app.tasks.video_tasks.generate_ltx_video_task",
    base=VideoRenderTask,
    bind=True,
    queue="queue_video",
)
def generate_ltx_video_task(
    self,
    prompt: str,
    duration: int,
    model: str,
    resolution: str,
    image_url: Optional[str] = None
) -> Dict[str, Any]:
    """
    LTX Video 同步生成任務（透過 Celery 轉為非同步）
    """
    import requests
    import tempfile
    
    LTX_INFERENCE_URL = os.getenv("LTX_INFERENCE_URL", "http://localhost:8080")
    
    headers = {
        "Content-Type": "application/json"
    }
    
    payload = {
        "prompt": prompt,
        "model": model,
        "duration": duration,
        "resolution": resolution
    }
    
    endpoint = f"{LTX_INFERENCE_URL}/v1/text-to-video"
    if image_url:
        endpoint = f"{LTX_INFERENCE_URL}/v1/image-to-video"
        payload["image_uri"] = image_url
        
    try:
        # LTX Server generation might take some time (5-10 mins on L4 depending on frames)
        response = requests.post(endpoint, headers=headers, json=payload, timeout=900)
        response.raise_for_status()
        
        # 暫存影片
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
            temp_path = f.name
            
        # 上傳到雲端
        upload_result = _upload_to_cloud(temp_path, user_id=0)
        os.remove(temp_path)
        
        if upload_result.get("success"):
            return {
                "success": True,
                "video_url": upload_result["url"],
                "cloud_key": upload_result.get("key")
            }
        else:
            raise Exception(upload_result.get("error", "上傳到雲端失敗"))
            
    except requests.exceptions.HTTPError as he:
        err_msg = str(he)
        if he.response is not None:
            err_msg += f" - {he.response.text}"
        logger.error(f"[LTX] 影片生成 HTTP 錯誤: {err_msg}")
        raise self.retry(exc=Exception(err_msg))
    except Exception as e:
        logger.error(f"[LTX] 影片生成失敗: {e}")
        raise self.retry(exc=e)
