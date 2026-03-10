"""
短影音 v3.0 API
===============
基於 Remotion + fal.ai + OpenAI TTS 的全新引擎

Endpoints:
- POST /video/v3/generate      — 全自動流程
- POST /video/v3/scene/generate — 單場景 AI 片段
- POST /video/v3/tts            — TTS 配音
- POST /video/v3/render         — 觸發 Remotion 渲染
- GET  /video/v3/status/{job_id} — 查詢狀態
- POST /video/v3/webhook/fal    — fal.ai Webhook
- GET  /video/v3/themes         — 獲取所有主題模板
- POST /api/generate-video      — 公開 API (全自動閉環)
"""

import logging
import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.routers.auth import get_current_user
from app.services.credit_service import FeatureCode, CreditService
from app.services.credit_decorators import consume_credits_manually
from app.services.prompt_loader import load_prompt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/video/v3", tags=["Video V3 Engine"])

# ---------------------------------------------------------------------------
# Redis-backed job store（取代 in-memory router._ltx_jobs，存活於重啟之間）
# ---------------------------------------------------------------------------
import os as _os, json as _json

def _get_redis():
    """取得共用 Redis 連線（lazy singleton）"""
    if not hasattr(_get_redis, "_client"):
        try:
            import redis
            _get_redis._client = redis.from_url(
                _os.getenv("REDIS_URL", "redis://localhost:6379/0"),
                decode_responses=True,
            )
            _get_redis._client.ping()
        except Exception as e:
            logger.warning(f"[V3 Jobs] Redis 不可用，降級為 in-memory: {e}")
            _get_redis._client = None
    return _get_redis._client

_fallback_jobs: Dict[str, Any] = {}

def _set_ltx_job(job_id: str, data: dict, ttl: int = 3600):
    """寫入 LTX job 狀態到 Redis（fallback 到 in-memory）"""
    r = _get_redis()
    if r:
        try:
            r.setex(f"ltx_job:{job_id}", ttl, _json.dumps(data))
            return
        except Exception:
            pass
    _fallback_jobs[job_id] = data

def _get_ltx_job(job_id: str) -> Optional[dict]:
    """從 Redis 讀取 LTX job 狀態（fallback 到 in-memory）"""
    r = _get_redis()
    if r:
        try:
            raw = r.get(f"ltx_job:{job_id}")
            if raw:
                return _json.loads(raw)
        except Exception:
            pass
    return _fallback_jobs.get(job_id)

@router.get("/debug-gemini")
def debug_gemini():
    import google.generativeai as genai
    import os
    key = os.getenv("GOOGLE_GEMINI_KEY", "")
    if not key:
        return {"error": "No key"}
    genai.configure(api_key=key)
    try:
        models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
        return {"models": list(models)}
    except Exception as e:
        return {"error": str(e)}

@router.get("/debug-openai")
async def debug_openai():
    import os
    key = os.getenv("OPENAI_API_KEY", "")
    if not key:
        return {"error": "No OPENAI_API_KEY in environment"}
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=key)
        res = await client.models.list()
        # just return the first 5 model ids
        return {"status": "ok", "models": [m.id for m in res.data[:5]]}
    except Exception as e:
        return {"error": str(e)}

@router.get("/debug-modal")
async def debug_modal():
    try:
        import modal
        job_store = modal.Dict.from_name("kingjam-ltx-video", "ltx-video-jobs", create_if_missing=True)
        fails = []
        for k in reversed(list(job_store.keys())):
            res = job_store.get(k)
            if res.get("status") == "failed":
                fails.append({"id": k, "error": res.get("error")})
            if len(fails) >= 5:
                break
        return {"failed_jobs": fails}
    except Exception as e:
        return {"error": str(e)}


# ============================================================
# Request / Response Models
# ============================================================

class SceneGenerateRequest(BaseModel):
    """單場景生成請求"""
    prompt: str = Field(..., min_length=1, max_length=2000)
    duration: int = Field(default=5, ge=3, le=15)
    aspect_ratio: str = Field(default="9:16")
    model_preference: str = Field(default="auto", description="auto / wan21 / luma / kling")
    reference_image_url: Optional[str] = None


class TTSRequest(BaseModel):
    """TTS 配音請求"""
    text: str = Field(..., min_length=1, max_length=5000)
    voice: str = Field(default="alloy")
    model: str = Field(default="tts-1-hd")
    speed: str = Field(default="normal")
    fps: int = Field(default=30)


class RenderRequest(BaseModel):
    """Remotion 渲染請求"""
    props: Dict[str, Any] = Field(..., description="ShortVideoProps JSON")
    output_format: str = Field(default="mp4")
    quality: str = Field(default="medium")


class FullGenerateRequest(BaseModel):
    """全自動影片生成請求 — 支援 T2V / I2V / S2V / SadTalker / EchoMimicV2 五種模式"""
    mode: str = Field(default="t2v", description="生成模式: t2v / i2v / s2v / sadtalker / echomimic")
    script: str = Field(..., min_length=1, max_length=5000, description="影片腳本/主題")
    style_id: str = Field(default="tech_startup", description="模板 ID")
    voice: str = Field(default="alloy", description="配音語音")
    duration: int = Field(default=30, ge=10, le=120, description="影片秒數")
    aspect_ratio: str = Field(default="9:16")
    scenes_count: int = Field(default=3, ge=2, le=8, description="場景數")
    ref_image_url: Optional[str] = Field(default=None, description="I2V 模式: 參考圖片 URL")
    audio_url: Optional[str] = Field(default=None, description="S2V 模式: 語音/音頻 URL")
    negative_prompt: Optional[str] = Field(default=None, description="負面提示")


class ThemeResponse(BaseModel):
    """主題模板回應"""
    id: str
    name: str
    category: str
    colors: Dict[str, str]
    music_mood: str


# ============================================================
# API Endpoints
# ============================================================

@router.get("/themes")
async def get_themes():
    """
    獲取所有可用的影片主題模板
    """
    # 直接定義主題列表 (鏡像自 video-engine/src/themes)
    themes = [
        {"id": "tech_startup", "name": "科技新創", "category": "商業", "music_mood": "minimal"},
        {"id": "corporate", "name": "企業形象", "category": "商業", "music_mood": "corporate"},
        {"id": "finance", "name": "金融穩重", "category": "商業", "music_mood": "calm"},
        {"id": "luxury_realestate", "name": "地產豪華", "category": "商業", "music_mood": "epic"},
        {"id": "food", "name": "美食饗宴", "category": "生活", "music_mood": "upbeat"},
        {"id": "travel", "name": "旅行探索", "category": "生活", "music_mood": "inspirational"},
        {"id": "fitness", "name": "健身動感", "category": "生活", "music_mood": "upbeat"},
        {"id": "fashion", "name": "時尚潮流", "category": "生活", "music_mood": "minimal"},
        {"id": "knowledge", "name": "知識解說", "category": "教育", "music_mood": "calm"},
        {"id": "course", "name": "課程教學", "category": "教育", "music_mood": "calm"},
        {"id": "kids", "name": "兒童啟蒙", "category": "教育", "music_mood": "upbeat"},
        {"id": "ted_pro", "name": "TED 專業", "category": "教育", "music_mood": "inspirational"},
        {"id": "retro_film", "name": "復古膠片", "category": "創意", "music_mood": "emotional"},
        {"id": "cyberpunk", "name": "霓虹賽博", "category": "創意", "music_mood": "minimal"},
        {"id": "watercolor", "name": "水彩夢幻", "category": "創意", "music_mood": "emotional"},
        {"id": "minimal_bw", "name": "極簡黑白", "category": "創意", "music_mood": "minimal"},
        {"id": "christmas", "name": "聖誕新年", "category": "節慶", "music_mood": "inspirational"},
        {"id": "valentine", "name": "情人節", "category": "節慶", "music_mood": "emotional"},
        {"id": "mothers_day", "name": "母親節", "category": "節慶", "music_mood": "emotional"},
        {"id": "birthday", "name": "生日派對", "category": "節慶", "music_mood": "upbeat"},
    ]
    
    return {
        "themes": themes,
        "categories": ["商業", "生活", "教育", "創意", "節慶"],
        "total": len(themes),
    }


@router.post("/scene/generate")
async def generate_scene(
    request: SceneGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    單場景 AI 影片片段生成
    使用 fal.ai 異步生成
    """
    from app.services.video_v3.fal_service import generate_scene_clip as fal_generate_scene
    from app.services.video_v3.ltx_service import generate_scene_clip as ltx_generate_scene
    
    # 構建 Webhook URL
    webhook_url = None  # TODO: 設定公開 webhook URL
    
    # 計算點數成本
    is_sadtalker = "sadtalker" in request.model_preference.lower()
    feature_code = FeatureCode.V3_GENERATE_CLIP_SADTALKER if is_sadtalker else FeatureCode.V3_GENERATE_CLIP_STANDARD
    
    # 扣除點數
    consume_result = consume_credits_manually(
        db=db,
        user=current_user,
        feature_code=feature_code,
        description=f"V3 影片片段生成 ({request.model_preference})"
    )
    if not consume_result["success"]:
        raise HTTPException(status_code=402, detail=consume_result.get("error", "點數不足以生成此片段"))

    if is_sadtalker or "fal" in request.model_preference.lower():
        result = await fal_generate_scene(
            prompt=request.prompt,
            duration=request.duration,
            aspect_ratio=request.aspect_ratio,
            model_preference=request.model_preference,
            webhook_url=webhook_url,
            reference_image_url=request.reference_image_url,
        )
    else:
        try:
            result = await ltx_generate_scene(
                prompt=request.prompt,
                duration=request.duration,
                aspect_ratio=request.aspect_ratio,
                model_preference=request.model_preference,
                webhook_url=webhook_url,
                reference_image_url=request.reference_image_url,
            )
        except Exception as e:
            logger.warning(f"[Dual-Engine] LTX 啟動失敗，降級為 Fal.ai: {e}")
            result = await fal_generate_scene(
                prompt=request.prompt,
                duration=request.duration,
                aspect_ratio=request.aspect_ratio,
                model_preference=request.model_preference,
                webhook_url=webhook_url,
                reference_image_url=request.reference_image_url,
            )
    
    # 建立處理中的歷史紀錄
    try:
        from app.models import GenerationHistory
        history = GenerationHistory(
            user_id=current_user.id,
            generation_type="video_clip",
            status="processing",
            input_params={
                "prompt": request.prompt,
                "duration": request.duration,
                "aspect_ratio": request.aspect_ratio,
                "model_preference": request.model_preference
            },
            output_data={
                "request_id": result.get("request_id"),
                "model": result.get("model")
            },
            credits_used=consume_result.get("cost", 0)
        )
        db.add(history)
        db.commit()
    except Exception as e:
        logger.error(f"[Scene Generate] 無法建立歷史紀錄: {e}")

    return {
        "request_id": result["request_id"],
        "model": result["model"],
        "status": result["status"],
        "message": "場景生成任務已提交，請輪詢 /status 或等待 Webhook 回調",
    }


@router.post("/tts")
async def generate_tts(
    request: TTSRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    OpenAI TTS 配音生成
    返回音頻 URL + Remotion SubtitleCue 格式的時間戳
    """
    from app.services.video_v3.openai_tts import (
        generate_tts_with_timestamps,
        timestamps_to_subtitle_cues,
        upload_tts_audio,
    )
    
    try:
        result = await generate_tts_with_timestamps(
            text=request.text,
            voice=request.voice,
            model=request.model,
            speed=request.speed,
        )
        
        # 上傳音頻到雲端
        audio_url = await upload_tts_audio(result.audio_path)
        
        # 轉換為 SubtitleCue 格式
        subtitle_cues = timestamps_to_subtitle_cues(
            result.timestamps,
            fps=request.fps,
        )
        
        if not audio_url:
            logger.error(f"[TTS] 音頻上傳雲端失敗，無法進行合成。本地路徑: {result.audio_path}")
            raise HTTPException(status_code=500, detail="語音配音上傳雲端失敗，請檢查儲存服務設定。")

        # 建立歷史紀錄
        try:
            from app.models import GenerationHistory
            history = GenerationHistory(
                user_id=current_user.id,
                generation_type="tts",
                status="completed",
                input_params={
                    "text": request.text[:100] + "..." if len(request.text) > 100 else request.text,
                    "voice": request.voice,
                    "model": request.model
                },
                media_cloud_url=audio_url,
                credits_used=0 # TODO: TTS point consumption is handled in credit service
            )
            db.add(history)
            db.commit()
        except Exception as e:
            logger.error(f"[TTS] 無法建立歷史紀錄: {e}")

        return {
            "audio_url": audio_url,
            "duration": result.duration,
            "voice": result.voice,
            "subtitles": subtitle_cues,
            "timestamps_count": len(result.timestamps),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[TTS] 生成發生錯誤: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"TTS配音生成失敗: {str(e)}")


@router.post("/render")
async def submit_render(
    request: RenderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    提交 Remotion 渲染任務
    將 props 發送到 Cloud Run 渲染服務
    """
    from app.services.video_v3.render_client import submit_render_job
    
    # 扣除點數
    consume_result = consume_credits_manually(
        db=db,
        user=current_user,
        feature_code=FeatureCode.V3_RENDER_VIDEO,
        description="V3 影片最終合成與配音"
    )
    if not consume_result["success"]:
        raise HTTPException(status_code=402, detail=consume_result.get("error", "點數不足以合成影片"))

    try:
        result = await submit_render_job(
            props=request.props,
            output_format=request.output_format,
            quality=request.quality,
        )
        
        # 建立初始處理中/完成紀錄 (因為本地是同步的)
        try:
            from app.models import GenerationHistory
            job_id = result.get("jobId") or result.get("id")
            if job_id:
                history = GenerationHistory(
                    user_id=current_user.id,
                    generation_type="short_video_v3",
                    status="completed" if job_id.startswith("local-render-") else "processing",
                    input_params={
                        "output_format": request.output_format,
                        "quality": request.quality,
                    },
                    output_data={
                        "render_job_id": job_id,
                        "props": request.props,
                    },
                    media_cloud_url=result.get("videoUrl") if job_id.startswith("local-render-") else None,
                    credits_used=consume_result.get("cost", 0)
                )
                db.add(history)
                db.commit()
        except Exception as e:
            logger.error(f"[Render] 無法建立初始歷史紀錄: {e}")
            
        return result
    except Exception as e:
        logger.error(f"[Render] 提交渲染失敗: {e}", exc_info=True)
        # 建立失敗紀錄
        try:
            from app.models import GenerationHistory
            history = GenerationHistory(
                user_id=current_user.id,
                generation_type="short_video_v3",
                status="failed",
                error_message=str(e),
                input_params={
                    "output_format": request.output_format,
                    "quality": request.quality,
                },
                credits_used=consume_result.get("cost", 0)
            )
            db.add(history)
            db.commit()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"提交雲端渲染失敗，請聯繫管理員。內部錯誤: {str(e)}")


@router.get("/status/{job_id}")
async def get_render_status(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    查詢 Cloud Run / 本地 渲染任務狀態
    """
    from app.services.video_v3.render_client import check_render_status
    
    # 判斷是否為本地渲染任務 (同步完成)
    if job_id.startswith("local-render-"):
        # 本地渲染已經是同步完成，我們從資料庫裡撈出剛剛那筆處理中的紀錄
        from app.models import GenerationHistory
        histories = db.query(GenerationHistory).filter(
            GenerationHistory.user_id == current_user.id,
            GenerationHistory.generation_type == "short_video_v3",
            GenerationHistory.status == "processing"
        ).order_by(GenerationHistory.created_at.desc()).all()
        
        target_history = None
        for h in histories:
            if h.output_data and h.output_data.get("render_job_id") == job_id:
                target_history = h
                break
                
        if target_history:
            # 本地的 videoUrl 就是 R2 URL，這應該在 /render 時就塞好，如果沒有，就用它本來的
            video_url = target_history.media_cloud_url or ""
            target_history.status = "completed"
            db.commit()
            
            return {
                "jobId": job_id,
                "status": "done",
                "progress": 1,
                "videoUrl": video_url,
                "durationMs": 0
            }
        else:
            return {
                "jobId": job_id,
                "status": "error",
                "error": "找不到對應的本地渲染紀錄"
            }
            
    # 否則走原本的 Cloud Run 檢查邏智
    result = await check_render_status(job_id)
    
    # 如果完成，更新歷史紀錄
    if result.get("status") in ["done", "error"]:
        try:
            from app.models import GenerationHistory
            from app.services.video_v3.render_client import RENDER_SERVICE_URL
            
            # 使用迴圈比對 processing 的紀錄
            histories = db.query(GenerationHistory).filter(
                GenerationHistory.user_id == current_user.id,
                GenerationHistory.generation_type == "short_video_v3",
                GenerationHistory.status == "processing"
            ).all()
            
            target_history = None
            for h in histories:
                if h.output_data and h.output_data.get("render_job_id") == job_id:
                    target_history = h
                    break
                    
            if target_history:
                if result.get("status") == "done":
                    target_history.status = "completed"
                    video_url = result.get("videoUrl")
                    if video_url:
                        target_history.media_cloud_url = f"{RENDER_SERVICE_URL}{video_url}"
                else:
                    target_history.status = "failed"
                    target_history.error_message = result.get("error", "渲染失敗")
                
                db.commit()
        except Exception as e:
            logger.error(f"[RenderStatus] 更新歷史紀錄失敗: {e}")
            db.rollback()
            
    return result


@router.post("/webhook/fal")
async def fal_webhook(request: Request):
    """
    fal.ai Webhook 回調端點
    
    fal.ai 任務完成後會 POST 到此端點:
    {
        "request_id": "...",
        "status": "COMPLETED",
        "payload": { "video": { "url": "..." } }
    }
    """
    from app.services.video_v3.fal_service import handle_webhook
    
    payload = await request.json()
    result = await handle_webhook(payload)
    
    # 更新歷史紀錄 (如果在 hook 內能取得 user_id 或 request_id 的話)
    req_id = payload.get("request_id")
    if req_id and result.get("video_url"):
        try:
            from app.database import SessionLocal
            from app.models import GenerationHistory
            db = SessionLocal()
            # 尋找 processing 中，並且 output_data 包含此 request_id 的紀錄
            # 為了效能，通常這需要在 handle_webhook 內處理，但在這裡也可以用 filter 查找
            # (此處假設我們有辦法找到對應紀錄，因為 SQLite JSON 查詢比較複雜，
            # 我們會依賴前端輪詢 `/check-clips` 及時更新紀錄，這裡作為備用)
            pass
        except Exception as e:
            logger.error(f"[Hook] History update error: {e}")
        finally:
            if 'db' in locals():
                db.close()

    # TODO: 更新 Redis 狀態，推送 SSE 通知前端
    logger.info(f"[v3 Webhook] fal.ai 回調: {result}")
    
    return {"received": True, **result}


# ============================================================
# 批次影片片段生成 API
# ============================================================

class BatchClipRequest(BaseModel):
    """批次場景片段生成"""
    scenes: List[Dict[str, Any]] = Field(..., description="場景列表")
    aspect_ratio: str = Field(default="9:16")
    model_preference: str = Field(default="auto")


class CheckClipsRequest(BaseModel):
    """批次查詢片段狀態"""
    jobs: List[Dict[str, str]] = Field(..., description="[{request_id, model}]")


@router.post("/api/generate-clips")
async def generate_clips(
    request: BatchClipRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    批次提交場景到 LTX-2 / fal.ai 生成 AI 影片片段

    非陰塞架構：立即回傳 job_ids（status=pending），
    LTX-2 在背景執行，前端用 /api/check-clips 輪詢取得結果。
    """
    import os
    from app.services.video_v3.fal_service import generate_scene_clip as fal_generate_scene
    from app.services.video_v3.ltx_service import generate_scene_clip as ltx_generate_scene

    fal_key_available = bool(os.getenv("FAL_KEY", "").strip())
    is_sadtalker = "sadtalker" in request.model_preference.lower()
    # 2026-03 之後預設全面改用 LTX-2，僅在 model_preference 明確包含 "fal"
    # 且環境有設定 FAL_KEY 時，才啟用 fal.ai 直連流程。
    use_fal_directly = "fal" in request.model_preference.lower() and fal_key_available
    if "fal" in request.model_preference.lower() and not fal_key_available:
        raise HTTPException(
            status_code=503,
            detail="已指定使用 fal.ai，但 FAL_KEY 尚未設定，請在後台環境變數中設定 FAL_KEY（取得方式：https://fal.ai/dashboard/keys）"
        )

    # 計算點數成本
    feature_code = FeatureCode.V3_GENERATE_CLIP_SADTALKER if is_sadtalker else FeatureCode.V3_GENERATE_CLIP_STANDARD
    credit_service = CreditService(db)
    cost_per_clip = credit_service.get_feature_cost(feature_code, current_user.tier)
    total_cost = cost_per_clip * len(request.scenes)

    if credit_service.get_balance(current_user.id) < total_cost:
        raise HTTPException(status_code=402, detail=f"點數不足 (需要 {total_cost} 點，餘額不足)")

    # 預先扣除點數
    for _ in request.scenes:
        consume_credits_manually(
            db=db,
            user=current_user,
            feature_code=feature_code,
            description=f"V3 影片片段生成 ({request.model_preference})"
        )

    # 獲取質量與負面提示詞
    quality_prompt_res = await load_prompt(
        db=db,
        slug="short-video-v3-quality",
        variables={},
        user=current_user,
        fallback="masterpiece, best quality, highly detailed, ultra-realistic, cinematic, 8k resolution, perfect anatomy, high fidelity, sharp focus, volumetric lighting, photorealistic, RAW photo"
    )
    # 假設 load_prompt 的回傳沒有處理 negative_fallback，我們在這裡做保底
    q_prompt = quality_prompt_res.positive
    n_prompt = quality_prompt_res.negative if hasattr(quality_prompt_res, 'negative') and quality_prompt_res.negative else "(deformed iris, deformed pupils, semi-realistic, cgi, 3d, render, sketch, cartoon, drawing, anime:1.4), text, close up, cropped, out of frame, worst quality, low quality, jpeg artifacts, ugly, duplicate, morbid, mutilated, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, deformed, dehydrated, bad anatomy, bad proportions, extra limbs, cloned face, disfigured, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers, long neck, blurry, jittery, flickering, grainy, pixelated"

    # --- 提交生成任務 (模式判斷) ---
    # 如果只有一個場景，或者多個場景但都是 fal.ai (不支援串聯)，則退回原有的並行產生。
    # 但為了最高彈性，我們把 King Jam LTX-2 的多場景全數轉為背景順序生成，以確保畫面最高品質銜接！
    
    if use_fal_directly:
        async def _submit_scene_fal(scene: dict, idx: int):
            prompt = scene.get("visualPrompt", "")
            ref_image = scene.get("refImageUrl", None)
            if ref_image and ref_image.startswith("/"):
                ref_image = f"https://api.kingjam.app{ref_image}"
            audio_url_item = scene.get("audioUrl", None)
            if audio_url_item and audio_url_item.startswith("/"):
                audio_url_item = f"https://api.kingjam.app{audio_url_item}"
            duration_sec = max(3, min(10, scene.get("durationInFrames", 150) // 30))
            
            try:
                res = await fal_generate_scene(
                    prompt=prompt, duration=duration_sec, aspect_ratio=request.aspect_ratio,
                    model_preference=request.model_preference, reference_image_url=ref_image,
                    audio_url=audio_url_item, quality_prompt=q_prompt, negative_prompt=n_prompt,
                )
                return {"index": idx, "request_id": res.get("request_id"), "model": "fal", "status": "pending"}
            except Exception as e:
                return {"index": idx, "request_id": f"err_{idx}", "model": "error", "status": "error", "error": str(e)}

        import asyncio
        tasks = [_submit_scene_fal(scene, i) for i, scene in enumerate(request.scenes)]
        jobs = await asyncio.gather(*tasks)
    else:
        # LTX-2 Autoregressive Sequential Generation (順序推衍)
        # 為什麼要序列化？因為要確保 場景 N 的起始幀 = 場景 N-1 的結束幀！
        virtual_jobs = []
        for i in range(len(request.scenes)):
            v_job_id = f"ltx_seq_{uuid.uuid4().hex[:8]}_{i}"
            virtual_jobs.append(v_job_id)
            _set_ltx_job(v_job_id, {
                "status": "pending",
                "video_url": None,
                "model": "ltx-2"
            })
        
        # 啟動背景任務進行順序生成
        import asyncio
        asyncio.create_task(_run_sequential_scenes(
            request.scenes, virtual_jobs, request, current_user.id, 
            q_prompt, n_prompt, cost_per_clip
        ))
        
        jobs = [{"index": i, "request_id": jid, "model": "ltx-2", "status": "pending"} for i, jid in enumerate(virtual_jobs)]

    # 將新任務寫入 GenerationHistory
    try:
        from app.models import GenerationHistory
        # 分別為每個 scene 建立 history
        for idx, job in enumerate(jobs):
            if job.get("request_id"):
                history = GenerationHistory(
                    user_id=current_user.id,
                    generation_type="video_clip",
                    status="processing",
                    input_params={
                        "prompt": request.scenes[idx].get("visualPrompt", ""),
                        "duration": max(3, min(10, request.scenes[idx].get("durationInFrames", 150) // 30)),
                        "aspect_ratio": request.aspect_ratio,
                        "model_preference": request.model_preference
                    },
                    output_data={
                        "request_id": job.get("request_id"),
                        "model": job.get("model")
                    },
                    credits_used=cost_per_clip
                )
                db.add(history)
        db.commit()
    except Exception as e:
        logger.error(f"[Generate Clips] 建立歷史紀錄失敗: {e}")

    engine = "fal.ai" if use_fal_directly else "LTX-2"
    return {
        "total": len(request.scenes),
        "submitted": sum(1 for j in jobs if j.get("request_id")),
        "failed": sum(1 for j in jobs if not j.get("request_id")),
        "engine": engine,
        "jobs": jobs,
    }


@router.post("/api/check-clips")
async def check_clips(
    request: CheckClipsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    批次查詢片段生成狀態
    - LTX-2 背景任務：從 Redis 讀取 job 狀態（存活於重啟之間）
    - fal.ai：呼叫 fal_check_status
    """
    from app.services.video_v3.fal_service import check_scene_status as fal_check_status
    import httpx
    import os
    
    LTX_INFERENCE_URL = os.getenv("LTX_INFERENCE_URL", "http://localhost:8080")
    if "run.app" in LTX_INFERENCE_URL:
        LTX_INFERENCE_URL = "https://bobo68425--kingjam-ltx-video-api.modal.run"

    statuses = []
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        for job in request.jobs:
            rid = job.get("request_id")
            model = job.get("model", "")
            if not rid:
                statuses.append({"request_id": rid, "status": "error", "error": "missing request_id"})
                continue
            
            # 攔截虛擬狀態 (Autoregressive Tracking via Redis)
            if rid.startswith("ltx_seq_"):
                vinfo = _get_ltx_job(rid)
                if vinfo:
                    statuses.append({
                        "request_id": rid,
                        "status": vinfo["status"],
                        "video_url": vinfo.get("video_url"),
                        "model": "ltx-2"
                    })
                else:
                    # 如果 Redis 或快取中暫時查不到，視為「仍在佇列中」，避免前端誤判為 0/N 完成
                    statuses.append({
                        "request_id": rid,
                        "status": "pending",
                        "video_url": None,
                        "model": "ltx-2",
                        "error": "Seq Job Not Found"
                    })
                continue
            
            try:
                if "fal" in model.lower():
                    status = await fal_check_status(rid, model)
                    statuses.append(status)
                elif "ltx" in model.lower():
                    # 向 Modal 請求擷取狀態
                    try:
                        resp = await client.get(f"{LTX_INFERENCE_URL}/v1/status/{rid}")
                        if resp.status_code == 200:
                            data = resp.json()
                            status_val = data.get("status", "pending")
                            
                            statuses.append({
                                "request_id": rid,
                                "status": status_val,
                                "video_url": data.get("video_url"),
                                "model": model,
                            })
                        else:
                            statuses.append({"request_id": rid, "status": "pending", "video_url": None, "model": model})
                    except Exception as e:
                        logger.warning(f"LTX Poll Error for {rid}: {e}")
                        statuses.append({"request_id": rid, "status": "pending", "video_url": None, "model": model})
                else:
                    statuses.append({"request_id": rid, "status": "pending", "video_url": None})
            except Exception as e:
                statuses.append({"request_id": rid, "status": "error", "error": str(e)})

    # 更新歷史紀錄
    try:
        from app.models import GenerationHistory
        # 一次查詢所有該用戶 processing 的視頻片段任務
        processing_histories = db.query(GenerationHistory).filter(
            GenerationHistory.user_id == current_user.id,
            GenerationHistory.generation_type == "video_clip",
            GenerationHistory.status == "processing"
        ).all()
        
        has_updates = False
        for status_res in statuses:
            rid = status_res.get("request_id")
            s = status_res.get("status")
            if s in ["completed", "error", "COMPLETED", "ERROR", "failed", "FAILED"]:
                # 找到對應的 history
                for h in processing_histories:
                    if h.output_data and h.output_data.get("request_id") == rid:
                        if s in ["completed", "COMPLETED"]:
                            h.status = "completed"
                            h.media_cloud_url = status_res.get("video_url")
                        else:
                            h.status = "failed"
                            h.error_message = status_res.get("error", "生成失敗")
                        has_updates = True
                        break
                        
        if has_updates:
            db.commit()
    except Exception as e:
        logger.error(f"[Check Clips] 更新歷史紀錄失敗: {e}")
        db.rollback()

    all_done = all(s.get("status") in ("completed", "error", "COMPLETED", "ERROR", "failed", "FAILED") for s in statuses)

    return {
        "all_done": all_done,
        "statuses": statuses,
    }


# 公開 API — 全自動閉環
# ============================================================

@router.post("/api/generate-video")
async def generate_video_api(
    request: FullGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    全自動影片生成 API — 支援 T2V / I2V / S2V 三種模式
    
    - T2V (Text → Video): Gemini 將文字拆分為場景 + AI 影片提示
    - I2V (Image → Video): 以參考圖為基礎，Gemini 生成動態場景描述
    - S2V (Speech → Video): 以語音為驅動，Gemini 生成表情/動作場景
    """
    import os
    import json
    
    job_id = str(uuid.uuid4())
    mode = request.mode.lower()
    
    # 扣除生成腳本點數
    consume_result = consume_credits_manually(
        db=db,
        user=current_user,
        feature_code=FeatureCode.V3_GENERATE_SCRIPT,
        description="V3 AI 腳本生成"
    )
    if not consume_result["success"]:
        raise HTTPException(status_code=402, detail=consume_result.get("error", "點數不足以生成腳本"))

    GEMINI_KEY = os.getenv("GOOGLE_GEMINI_KEY", "")
    if not GEMINI_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_GEMINI_KEY 未設定")
    
    # ====== 根據模式從 Prompt 管理中心獲取或構建不同的 Gemini Prompt ======
    variables = {
        "scenes_count": request.scenes_count,
        "style_id": request.style_id,
        "duration": request.duration,
        "aspect_ratio": request.aspect_ratio,
    }

    if mode == "i2v":
        # 圖片生成影片模式
        prompt_res = await load_prompt(
            db=db,
            slug="short-video-v3-i2v",
            variables=variables,
            user=current_user,
            fallback="""你是一位專業的影片動態導演。用戶會給你一段描述，以及一張參考圖片的概念。請基於這張圖片，生成 {{scenes_count}} 個場景的短影音腳本，讓圖片「動起來」。

重要規則：
- 每個場景應該呈現圖片中不同角度、不同動態的變化
- visualPrompt 必須包含 "reference image" 的元素描述
- 動態應該自然流暢，像電影鏡頭掃描一張照片
- **人像維持原則**：人物必須具備正常的解剖學特徵（如：恰好兩隻手臂、兩條腿、一個頭）。
- **禁止幻象**：嚴禁生成多肢體、斷頭、或分裂的人像描述。
- **高品質渲染詞**：在 visualPrompt 加入如 "cinematic lighting", "high detail", "stable motion", "8k resolution" 等詞彙。

每個場景需要包含：narration, visualPrompt, cameraMove, transition, type。
風格模板: {{style_id}}, 總長: {{duration}}s, 比例: {{aspect_ratio}}
嚴格以 JSON 陣列格式回覆。"""
        )
        system_prompt = prompt_res.positive
        ref_note = f"\n參考圖片 URL: {request.ref_image_url}" if request.ref_image_url else ""
        user_prompt = f"描述：{request.script}{ref_note}"
        
    elif mode == "s2v":
        # 語音驅動影片模式
        prompt_res = await load_prompt(
            db=db,
            slug="short-video-v3-s2v",
            variables=variables,
            user=current_user,
            fallback="""你是一位專業的語音驅動影片導演。用戶會給你一段語音/對話的描述，請生成 {{scenes_count}} 個場景的短影音腳本。

重要規則：
- 旁白文字即為語音內容，需要自然朗讀感
- visualPrompt 要包含角色的表情、動作、口型同步效果
- 場景應該配合語音情緒變化
- **人物完整性**：確保人物四肢健全，比例正確，嚴禁多肢或畸形描述。
- **背景穩定**：背景應維持連貫，避免閃爍或不自然的空間扭曲。

每個場景需要包含：narration, visualPrompt, cameraMove, transition, type, emotion。
風格模板: {{style_id}}, 總長: {{duration}}s, 比例: {{aspect_ratio}}
嚴格以 JSON 陣列格式回覆。"""
        )
        system_prompt = prompt_res.positive
        user_prompt = f"語音主題：{request.script}"
        
    elif mode == "sadtalker":
        # 數字人播報模式
        system_prompt = f"""你是一位專業的講稿撰寫人與導演。
用戶會給你一段語音/對話的主題，請生成 1 個連續場景的短影音腳本，專供「數字人播報 (Avatar)」使用。

重要規則：
- 只需要生成 1 個場景 (因為數字人是一鏡到底的播報)
- narration: 完整的演講稿/播報文字 (中文，長度需符合影片秒數)
- visualPrompt: 填寫 "A highly detailed portrait talking to the camera, neutral background"
- cameraMove: "static"
- transition: "fade"
- type: "story"
- emotion: 情緒標籤 (excited / calm / serious / happy)

風格模板: {request.style_id}
影片總長: {request.duration} 秒

嚴格以 JSON 陣列格式回覆，不要加其他文字。"""
        user_prompt = f"播報主題：{request.script}"
        
    else:
        # T2V 文字生成影片模式
        prompt_res = await load_prompt(
            db=db,
            slug="short-video-v3-t2v",
            variables=variables,
            user=current_user,
            fallback="""你是一位專業的短影音導演與編劇。用戶會給你一段文字主題，請將它轉化為 {{scenes_count}} 個場景的短影音腳本。

重要規則：
- **解剖學正確**：人物必須具備正常的生理結構，嚴禁多手、多腳、斷頭、或身體撕裂。
- **電影級質感**：在 visualPrompt 中始終包含 "Hyper-realistic", "Cinematic 8k", "Highly detailed anatomy", "Perfect limbs" 等核心提示。
- **動態穩定性**：描述清晰、合理的物理運動。

每個場景需要包含：narration, visualPrompt, cameraMove, transition, type。
風格模板: {{style_id}}, 總長: {{duration}}s, 比例: {{aspect_ratio}}
嚴格以 JSON 陣列格式回覆。"""
        )
        system_prompt = prompt_res.positive
        user_prompt = f"主題文字：{request.script}"
    
    # ====== 呼叫 Gemini AI (含 429 重試機制) ======
    import asyncio
    import google.generativeai as genai
    genai.configure(api_key=GEMINI_KEY)

    # 重試設定：3 次嘗試，指數退避，最後一次降級到 flash-lite
    _RETRY_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"]
    _RETRY_DELAYS = [5, 15, 30]          # 秒
    _RATE_LIMIT_CODES = {"429", "resource_exhausted", "resourceexhausted"}

    raw_text = ""
    ai_scenes = None
    last_error: Exception | None = None

    for attempt, (model_name, delay) in enumerate(zip(_RETRY_MODELS, _RETRY_DELAYS), start=1):
        try:
            _model = genai.GenerativeModel(model_name)
            response = _model.generate_content(
                [system_prompt, user_prompt],
                generation_config=genai.GenerationConfig(
                    temperature=0.8,
                    max_output_tokens=8192,
                    response_mime_type="application/json",
                ),
            )

            raw_text = response.text.strip()
            # 清理 markdown code block (以防萬一 response_mime_type 沒完全生效)
            if raw_text.startswith("```"):
                raw_text = raw_text.split("\n", 1)[1] if "\n" in raw_text else raw_text[3:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3].strip()
            if raw_text.startswith("json"):
                raw_text = raw_text[4:].strip()

            ai_scenes = json.loads(raw_text)
            break  # 成功 → 跳出重試迴圈

        except json.JSONDecodeError as e:
            logger.error(f"[v3] Gemini JSON 解析失敗 (attempt {attempt}): {e}, raw: {raw_text[:200]}")
            last_error = e
            if attempt < len(_RETRY_MODELS):
                logger.warning(f"[v3] JSON解析失敗，{delay}s 後重試...")
                import asyncio
                await asyncio.sleep(delay)
                continue
            else:
                break

        except Exception as e:
            err_str = str(e).lower()
            is_rate_limit = any(code in err_str for code in _RATE_LIMIT_CODES)

            if is_rate_limit and attempt < len(_RETRY_MODELS):
                logger.warning(
                    f"[v3] Gemini 429 配額超限 (attempt {attempt}/{len(_RETRY_MODELS)})，"
                    f"{delay}s 後使用 {_RETRY_MODELS[attempt]} 重試..."
                )
                import asyncio
                await asyncio.sleep(delay)
                last_error = e
                continue
            else:
                last_error = e
                break

    if ai_scenes is None:
        # Gemini 所有重試皆失敗，嘗試 Fallback 至 OpenAI gpt-4o-mini
        openai_key = os.getenv("OPENAI_API_KEY")
        if openai_key:
            logger.warning("[v3] Gemini 生成失敗，嘗試 fallback 至 OpenAI gpt-4o-mini...")
            try:
                from openai import AsyncOpenAI
                client = AsyncOpenAI(api_key=openai_key)
                oai_response = await client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    max_tokens=4000,
                    temperature=0.8
                )
                raw_text = oai_response.choices[0].message.content.strip()
                # 清理 markdown code block
                if raw_text.startswith("```"):
                    raw_text = raw_text.split("\n", 1)[1] if "\n" in raw_text else raw_text[3:]
                if raw_text.endswith("```"):
                    raw_text = raw_text[:-3].strip()
                if raw_text.startswith("json"):
                    raw_text = raw_text[4:].strip()
                
                ai_scenes = json.loads(raw_text)
                logger.info(f"[v3] OpenAI fallback 成功，獲取 {len(ai_scenes)} 個場景")
            except Exception as oai_e:
                logger.error(f"[v3] OpenAI fallback 失敗: {str(oai_e)}")
                pass

    if ai_scenes is None or len(ai_scenes) == 0:
        # 所有重試與 fallback 皆失敗
        err_str = str(last_error).lower() if last_error else ""
        is_rate_limit = any(code in err_str for code in _RATE_LIMIT_CODES)
        logger.error(f"[v3] AI 生成腳本最終失敗: {last_error}")
        if is_rate_limit:
            raise HTTPException(
                status_code=429,
                detail="AI 內容生成配額暫時超出限制，請稍後再試（或切換引擎）"
            )
        raise HTTPException(status_code=500, detail=f"AI 生成腳本失敗: {str(last_error)}")
    
    # ====== 將 AI 生成結果轉換為標準格式 ======
    fps = 30
    per_scene_frames = int((request.duration / request.scenes_count) * fps)
    
    scenes = []
    subtitles = []
    frame_offset = 0
    
    for i, ai_scene in enumerate(ai_scenes[:request.scenes_count]):
        scene = {
            "index": i,
            "type": ai_scene.get("type", "story"),
            "durationInFrames": per_scene_frames,
            "narration": ai_scene.get("narration", ""),
            "visualPrompt": ai_scene.get("visualPrompt", ""),
            "cameraMove": ai_scene.get("cameraMove", "static"),
            "transition": ai_scene.get("transition", "fade"),
        }
        
        # I2V 與 SadTalker 模式：每個場景附加參考圖片 URL
        if mode in ("i2v", "sadtalker") and request.ref_image_url:
            ref_url = request.ref_image_url
            if ref_url.startswith("/"):
                ref_url = f"https://api.kingjam.app{ref_url}"
            scene["refImageUrl"] = ref_url
        
        # S2V 與 SadTalker 模式：附加情緒標籤和音頻 URL
        if mode in ("s2v", "sadtalker"):
            scene["emotion"] = ai_scene.get("emotion", "calm")
            if request.audio_url:
                audio_url = request.audio_url
                if audio_url.startswith("/"):
                    audio_url = f"https://api.kingjam.app{audio_url}"
                scene["audioUrl"] = audio_url
        
        scenes.append(scene)
        
        # 生成字幕 cue
        narration = ai_scene.get("narration", "")
        if narration:
            subtitles.append({
                "text": narration,
                "startFrame": frame_offset + int(fps * 0.5),
                "endFrame": frame_offset + per_scene_frames - int(fps * 0.3),
            })
        
        frame_offset += per_scene_frames
    
    # ====== 組合完整回應 ======
    height_map = {"9:16": 1920, "16:9": 1080, "1:1": 1080}
    width_map = {"9:16": 1080, "16:9": 1920, "1:1": 1080}
    
    return {
        "job_id": job_id,
        "status": "completed",
        "mode": mode,
        "scenes": scenes,
        "subtitles": subtitles,
        "script": {
            "projectId": job_id,
            "title": request.script[:50],
            "description": request.script,
            "totalDurationInFrames": frame_offset,
            "fps": fps,
            "width": width_map.get(request.aspect_ratio, 1080),
            "height": height_map.get(request.aspect_ratio, 1920),
            "aspectRatio": request.aspect_ratio,
        },
        "config": {
            "mode": mode,
            "style_id": request.style_id,
            "duration": request.duration,
            "aspect_ratio": request.aspect_ratio,
            "voice": request.voice,
            "scenes_count": len(scenes),
            "ref_image_url": request.ref_image_url,
            "audio_url": request.audio_url,
        },
    }


@router.post("/warmup")
async def warmup_ltx_inference(
    current_user: User = Depends(get_current_user)
):
    """
    Warm-up the LTX-2 Cloud Run GPU inference service.

    Called by the frontend when the user starts typing a prompt,
    giving the L4 GPU 20-30 seconds to load models before the real request arrives.
    """
    import os
    import httpx

    ltx_url = os.getenv("LTX_INFERENCE_URL", "http://localhost:8080")
    if "run.app" in ltx_url:
        ltx_url = "https://bobo68425--kingjam-ltx-video-api.modal.run"

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(f"{ltx_url}/warmup")
            return {"status": "ok", "ltx_response": resp.json()}
    except Exception as e:
        # Warmup failures are silent — don't let this block the user
        logger.info(f"[LTX Warmup] ping failed (normal if cold): {e}")
        return {"status": "warming_up", "message": "Warm-up ping sent"}


@router.post("/warmup-echomimic")
async def warmup_echomimic(
    current_user: User = Depends(get_current_user)
):
    """
    預熱 EchoMimicV2 Cloud Run GPU 推理服務。
    前端在用戶選擇數字人模式 / 上傳 Avatar 圖片時觸發。
    """
    import os
    import httpx

    echomimic_url = os.getenv("ECHOMIMIC_INFERENCE_URL", "http://localhost:8081")

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(f"{echomimic_url}/warmup")
            return {"status": "ok", "echomimic_response": resp.json()}
    except Exception as e:
        logger.info(f"[EchoMimic Warmup] ping failed (normal if cold): {e}")
        return {"status": "warming_up", "message": "Warm-up ping sent to EchoMimicV2"}


# ─────────────────────────────────────────────────────────────
# GPT-SoVITS 語音克隆
# ─────────────────────────────────────────────────────────────

from fastapi import Form as FastAPIForm, UploadFile as FastAPIUploadFile, File as FastAPIFile


@router.post("/warmup-sovits")
async def warmup_sovits(
    current_user: User = Depends(get_current_user)
):
    """預熱 GPT-SoVITS 語音克隆服務（冷啟動預熱）。"""
    import os
    import httpx

    sovits_url = os.getenv("GPT_SOVITS_URL", "http://localhost:8082")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(f"{sovits_url}/warmup")
            return {"status": "ok", "sovits_response": resp.json()}
    except Exception as e:
        logger.info(f"[GPT-SoVITS Warmup] ping failed (normal if cold): {e}")
        return {"status": "warming_up", "message": "Warm-up ping sent to GPT-SoVITS"}


@router.post("/voice-clone")
async def voice_clone(
    reference_audio: FastAPIUploadFile = FastAPIFile(...),
    reference_text: str = FastAPIForm(""),
    target_text: str = FastAPIForm(...),
    language: str = FastAPIForm("zh"),
    speed: float = FastAPIForm(1.0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    GPT-SoVITS 零樣本語音克隆。
    上傳 5~30 秒參考音頻 + 目標文字 → 回傳克隆語音 URL（上傳 GCS）。
    """
    import os
    import httpx
    import uuid
    from app.services.cloud_storage import cloud_storage

    sovits_url = os.getenv("GPT_SOVITS_URL", "http://localhost:8082")

    # 扣除點數（使用 TTS 點數代替，後續可新增專用 feature code）
    consume_result = consume_credits_manually(
        db=db,
        user=current_user,
        feature_code=FeatureCode.V3_TTS,
        description="語音克隆（GPT-SoVITS）"
    )
    if not consume_result["success"]:
        raise HTTPException(status_code=402, detail=consume_result.get("error", "點數不足"))

    # 讀取參考音頻
    audio_bytes = await reference_audio.read()
    if len(audio_bytes) < 1000:
        raise HTTPException(status_code=400, detail="參考音頻太短，請上傳 5 秒以上的音頻")

    # 轉發到 GPT-SoVITS 微服務
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{sovits_url}/clone",
                files={"reference_audio": (reference_audio.filename, audio_bytes, reference_audio.content_type)},
                data={
                    "reference_text": reference_text,
                    "target_text": target_text,
                    "language": language,
                    "speed": str(speed),
                },
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail=f"GPT-SoVITS 錯誤: {resp.text}")

            cloned_audio_bytes = resp.content

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"GPT-SoVITS 服務無法連線: {e}")

    # 上傳克隆音頻到 Cloud Storage
    try:
        audio_url = await cloud_storage.upload_bytes(
            data=cloned_audio_bytes,
            file_type="audio",
            suffix=".wav",
            user_id=str(current_user.id),
            content_type="audio/wav",
        )
        return {"url": audio_url, "status": "ok"}
    except Exception as e:
        logger.warning(f"GCS upload failed, returning base64: {e}")
        import base64
        encoded = base64.b64encode(cloned_audio_bytes).decode()
        return {"audio_base64": encoded, "content_type": "audio/wav", "status": "ok_no_storage"}


# ============================================================
# Q3：ComfyUI / AI 圖像工坊（Replicate API）
# ============================================================

COMFYUI_WORKFLOWS = [
    {
        "id": "text2img-fast",
        "name": "✨ 文字快速生圖",
        "description": "輸入文字描述，快速生成 AI 圖像（SD-Lightning 4步）",
        "inputs": ["prompt", "negative_prompt"],
        "replicate_model": "bytedance/sdxl-lightning-4step:5f24084160c9089501c1b3545d9be3c27883ae2239b6f412990e82d4a6210f8f",
        "cost_per_run": "$0.001",
    },
    {
        "id": "img2img-style",
        "name": "🎨 圖片風格轉換",
        "description": "上傳圖片，轉換成指定藝術風格",
        "inputs": ["prompt", "image_url", "strength"],
        "replicate_model": "stability-ai/stable-diffusion-img2img:15a3689ee13b0d2616e98820eca31d4af4a36b21823518aa831dd79d43e7f83",
        "cost_per_run": "$0.002",
    },
    {
        "id": "portrait-enhance",
        "name": "👤 人像美化",
        "description": "自動修復、提升人像圖片品質",
        "inputs": ["image_url", "version"],
        "replicate_model": "tencentarc/gfpgan:9283608cc6b7be6b65a8e44983db012355f829a539ad48d9d76f66a79dd21ca",
        "cost_per_run": "$0.001",
    },
    {
        "id": "bg-remove",
        "name": "✂️ 一鍵去背",
        "description": "自動移除圖片背景，保留主體",
        "inputs": ["image_url"],
        "replicate_model": "cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
        "cost_per_run": "$0.001",
    },
]


@router.get("/comfyui/workflows")
async def get_comfyui_workflows(
    current_user: User = Depends(get_current_user),
):
    """回傳可用的 AI 圖像工坊 Workflow 列表"""
    return {"workflows": COMFYUI_WORKFLOWS}


class ComfyUIRunRequest(BaseModel):
    workflow_id: str
    prompt: Optional[str] = None
    negative_prompt: Optional[str] = "blurry, bad quality, distorted, ugly"
    image_url: Optional[str] = None
    strength: Optional[float] = 0.8
    version: Optional[str] = "v1.4"


@router.post("/comfyui/run")
async def run_comfyui_workflow(
    request: ComfyUIRunRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    執行 AI 圖像工坊 Workflow（Replicate API）
    回傳生成的圖片 URL（GCS 或 Replicate 直接 URL）
    """
    import replicate
    import os as _os

    replicate_token = _os.getenv("REPLICATE_API_TOKEN", "")
    if not replicate_token:
        raise HTTPException(status_code=503, detail="Replicate API 尚未設定")

    # 找到對應 workflow
    workflow = next((w for w in COMFYUI_WORKFLOWS if w["id"] == request.workflow_id), None)
    if not workflow:
        raise HTTPException(status_code=400, detail=f"找不到 workflow: {request.workflow_id}")

    # 扣除點數（每次執行扣 1 點）
    if current_user.credits < 1:
        raise HTTPException(status_code=402, detail="點數不足，請購買點數")
    current_user.credits -= 1
    db.commit()

    try:
        client = replicate.Client(api_token=replicate_token)

        # 依 workflow 組建 input
        if request.workflow_id == "text2img-fast":
            model_input = {
                "prompt": request.prompt or "a beautiful landscape",
                "negative_prompt": request.negative_prompt or "",
                "num_inference_steps": 4,
                "width": 1024,
                "height": 1024,
            }
        elif request.workflow_id == "img2img-style":
            if not request.image_url:
                raise HTTPException(status_code=400, detail="此 workflow 需要上傳圖片")
            model_input = {
                "prompt": request.prompt or "artistic style",
                "image": request.image_url,
                "strength": request.strength or 0.8,
                "negative_prompt": request.negative_prompt or "",
            }
        elif request.workflow_id == "portrait-enhance":
            if not request.image_url:
                raise HTTPException(status_code=400, detail="此 workflow 需要上傳圖片")
            model_input = {
                "img": request.image_url,
                "version": request.version or "v1.4",
                "scale": 2,
            }
        elif request.workflow_id == "bg-remove":
            if not request.image_url:
                raise HTTPException(status_code=400, detail="此 workflow 需要上傳圖片")
            model_input = {
                "image": request.image_url,
            }
        else:
            raise HTTPException(status_code=400, detail="未知的 workflow")

        # 呼叫 Replicate
        model_id = workflow["replicate_model"]
        logger.info(f"[ComfyUI] Running {request.workflow_id} for user {current_user.id}")
        output = client.run(model_id, input=model_input)

        # 取得輸出 URL
        if isinstance(output, list):
            output_url = str(output[0]) if output else None
        else:
            output_url = str(output) if output else None

        if not output_url:
            raise HTTPException(status_code=500, detail="Replicate 未回傳輸出")

        # 嘗試上傳到 GCS
        try:
            import httpx as _httpx
            async with _httpx.AsyncClient(timeout=60) as hclient:
                img_response = await hclient.get(output_url)
            if img_response.status_code == 200:
                from google.cloud import storage as _storage
                from datetime import datetime as _dt
                import uuid as _uuid
                gcs_client = _storage.Client()
                bucket = gcs_client.bucket("king-jam-ai-videos")
                filename = f"comfyui/{current_user.id}/{_dt.utcnow().strftime('%Y%m%d_%H%M%S')}_{_uuid.uuid4().hex[:8]}.png"
                blob = bucket.blob(filename)
                blob.upload_from_string(img_response.content, content_type="image/png")
                blob.make_public()
                output_url = blob.public_url
        except Exception as upload_err:
            logger.warning(f"[ComfyUI] GCS upload failed, using Replicate URL: {upload_err}")

        logger.info(f"[ComfyUI] {request.workflow_id} success: {output_url}")
        return {
            "status": "ok",
            "workflow_id": request.workflow_id,
            "output_url": output_url,
            "credits_remaining": current_user.credits,
        }

    except HTTPException:
        raise
    except Exception as e:
        # 退還點數
        current_user.credits += 1
        db.commit()
        logger.error(f"[ComfyUI] Workflow {request.workflow_id} failed: {e}")
        raise HTTPException(status_code=500, detail=f"生成失敗：{str(e)}")


async def _run_sequential_scenes(
    scenes: List[Dict[str, Any]], 
    virtual_job_ids: List[str], 
    request: Any, 
    user_id: int,
    q_prompt: str,
    n_prompt: str,
    cost_per_clip: int
):
    """
    背景任務：順序生成 AI 片段，並在場景之間傳遞上一段影片作為參考，確保畫面連貫。
    """
    logger.info(f"[V3 Seq] Starting sequential generation for {len(scenes)} scenes. User: {user_id}")
    
    previous_video_url = None
    
    for i, scene in enumerate(scenes):
        v_job_id = virtual_job_ids[i]
        prompt = scene.get("visualPrompt", "")
        duration_sec = max(3, min(10, scene.get("durationInFrames", 150) // 30))
        
        # 處理參考圖片
        ref_image = scene.get("refImageUrl", None)
        if ref_image:
            if ref_image.startswith("/"):
                ref_image = f"https://api.kingjam.app{ref_image}"
            elif "upload/media/" in ref_image and "api.kingjam.app" not in ref_image:
                # 如果是絕對路徑但不是 api.kingjam.app (可能是 platform.givoo.io)，強行替換域名
                import re
                ref_image = re.sub(r"https?://[^/]+(/upload/media/.*)", r"https://api.kingjam.app\1", ref_image)
            
        audio_url_item = scene.get("audioUrl", None)
        if audio_url_item:
            if audio_url_item.startswith("/"):
                audio_url_item = f"https://api.kingjam.app{audio_url_item}"
            elif "upload/media/" in audio_url_item and "api.kingjam.app" not in audio_url_item:
                import re
                audio_url_item = re.sub(r"https?://[^/]+(/upload/media/.*)", r"https://api.kingjam.app\1", audio_url_item)

        try:
            # 更新狀態為 processing
            _set_ltx_job(v_job_id, {"status": "processing", "video_url": None, "model": "ltx-2"})
            
            # 建立真正的 LTX 生成任務
            from app.services.video_v3.ltx_service import generate_scene_clip
            
            # 核心邏輯：如果是第 2 段之後，且我們有前一段的影片，則傳入作為連貫參考
            # 注意：這裡我們依然保留 ref_image 作為 fallback 或輔助
            current_prev_url = previous_video_url if i > 0 else None
            
            logger.info(f"[V3 Seq] Processing scene {i} (Job: {v_job_id}). Prev: {current_prev_url}")
            
            # 使用 ltx_service 進行生成 (這是一個 polling 的 await)
            # 因為 generate_scene_clip 在 ltx_service.py 中原本是回傳 {request_id, model, status: 'pending'}
            # 我們需要一個能等待結果的版本。
            # 修改：直接在這邊寫 polling 邏輯，或者擴充 ltx_service。
            # 這裡我們採取最穩健的方式：呼叫 generate_scene_clip 拿到 rid，然後自己 poll。
            
            res = await generate_scene_clip(
                prompt=prompt,
                duration=duration_sec,
                aspect_ratio=request.aspect_ratio,
                model_preference=request.model_preference,
                reference_image_url=ref_image,
                previous_video_url=current_prev_url,
                audio_url=audio_url_item,
                quality_prompt=q_prompt,
                negative_prompt=n_prompt
            )
            
            rid = res.get("request_id")
            if not rid:
                raise ValueError("Failed to get request_id from LTX service")
            
            # Polling 邏輯
            import httpx
            import os
            LTX_INFERENCE_URL = os.getenv("LTX_INFERENCE_URL", "http://localhost:8080")
            if "run.app" in LTX_INFERENCE_URL:
                LTX_INFERENCE_URL = "https://bobo68425--kingjam-ltx-video-api.modal.run"
            
            success_url = None
            max_wait = 600 # 10 mins per scene
            waited = 0
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                while waited < max_wait:
                    try:
                        resp = await client.get(f"{LTX_INFERENCE_URL}/v1/status/{rid}")
                        if resp.status_code == 200:
                            data = resp.json()
                            status = data.get("status", "pending")
                            if status == "completed":
                                success_url = data.get("video_url")
                                break
                            elif status == "error":
                                raise ValueError(f"Modal reports error: {data.get('error')}")
                    except Exception as e:
                        logger.warning(f"[V3 Seq] Poll error: {e}")
                    
                    await asyncio.sleep(5)
                    waited += 5
            
            if success_url:
                _set_ltx_job(v_job_id, {
                    "status": "completed",
                    "video_url": success_url,
                    "model": "ltx-2"
                })
                previous_video_url = success_url
                logger.info(f"[V3 Seq] Scene {i} success: {success_url}")
            else:
                raise ValueError("Scene generation timed out or failed")

        except Exception as e:
            logger.error(f"[V3 Seq] Scene {i} failed: {e}")
            _set_ltx_job(v_job_id, {
                "status": "error",
                "video_url": None,
                "model": "ltx-2",
                "error": str(e)
            })
            # 如果一段失敗，後面可能無法連貫，可以選擇繼續 (用原圖) 或 中斷。
            # 這裡選擇繼續，但 previous_video_url 清空
            previous_video_url = None

