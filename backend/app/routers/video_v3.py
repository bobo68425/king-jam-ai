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

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/video/v3", tags=["Video V3 Engine"])


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
    """全自動影片生成請求"""
    script: str = Field(..., min_length=1, max_length=5000, description="影片腳本/主題")
    style_id: str = Field(default="tech_startup", description="模板 ID")
    voice: str = Field(default="alloy", description="配音語音")
    duration: int = Field(default=30, ge=10, le=120, description="影片秒數")
    aspect_ratio: str = Field(default="9:16")
    scenes_count: int = Field(default=3, ge=2, le=8, description="場景數")


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
async def generate_scene(request: SceneGenerateRequest):
    """
    單場景 AI 影片片段生成
    使用 fal.ai 異步生成
    """
    from app.services.video_v3.fal_service import generate_scene_clip
    
    # 構建 Webhook URL
    webhook_url = None  # TODO: 設定公開 webhook URL
    
    result = await generate_scene_clip(
        prompt=request.prompt,
        duration=request.duration,
        aspect_ratio=request.aspect_ratio,
        model_preference=request.model_preference,
        webhook_url=webhook_url,
        reference_image_url=request.reference_image_url,
    )
    
    return {
        "request_id": result["request_id"],
        "model": result["model"],
        "status": result["status"],
        "message": "場景生成任務已提交，請輪詢 /status 或等待 Webhook 回調",
    }


@router.post("/tts")
async def generate_tts(request: TTSRequest):
    """
    OpenAI TTS 配音生成
    返回音頻 URL + Remotion SubtitleCue 格式的時間戳
    """
    from app.services.video_v3.openai_tts import (
        generate_tts_with_timestamps,
        timestamps_to_subtitle_cues,
        upload_tts_audio,
    )
    
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
    
    return {
        "audio_url": audio_url or f"/static/audio/{result.audio_path.split('/')[-1]}",
        "duration": result.duration,
        "voice": result.voice,
        "subtitle_cues": subtitle_cues,
        "timestamps_count": len(result.timestamps),
    }


@router.post("/render")
async def submit_render(request: RenderRequest):
    """
    提交 Remotion 渲染任務
    將 props 發送到 Cloud Run 渲染服務
    """
    from app.services.video_v3.render_client import submit_render_job
    
    result = await submit_render_job(
        props=request.props,
        output_format=request.output_format,
        quality=request.quality,
    )
    
    return result


@router.get("/render/status/{job_id}")
async def get_render_status(job_id: str):
    """
    查詢渲染任務狀態
    """
    from app.services.video_v3.render_client import check_render_status
    
    return await check_render_status(job_id)


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
    
    # TODO: 更新 Redis 狀態，推送 SSE 通知前端
    logger.info(f"[v3 Webhook] fal.ai 回調: {result}")
    
    return {"received": True, **result}


# ============================================================
# 公開 API — 全自動閉環
# ============================================================

@router.post("/api/generate-video")
async def generate_video_api(request: FullGenerateRequest):
    """
    全自動影片生成 API — 使用 Gemini AI 生成腳本與運鏡
    
    流程:
    1. 使用 Gemini AI 將文字腳本拆分為場景 (含旁白、運鏡、視覺提示)
    2. 返回結構化 scenes 資料供前端預覽
    
    Request:
        { "script": "...", "style_id": "tech_startup", "voice": "alloy" }
    
    Response:
        { "job_id": "...", "status": "completed", "scenes": [...], "subtitles": [...] }
    """
    import os
    import json
    
    job_id = str(uuid.uuid4())
    
    GEMINI_KEY = os.getenv("GOOGLE_GEMINI_KEY", "")
    if not GEMINI_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_GEMINI_KEY 未設定")
    
    # ====== 使用 Gemini AI 生成場景腳本 ======
    system_prompt = f"""你是一位專業的短影音導演與編劇。
用戶會給你一段文字主題，請將它轉化為 {request.scenes_count} 個場景的短影音腳本。

每個場景需要包含：
- narration: 旁白文字 (中文，15-30字，適合配音朗讀)
- visualPrompt: 英文的 AI 影片生成提示詞 (描述畫面，含鏡頭運動)
- cameraMove: 運鏡方式 (pan-left / pan-right / zoom-in / zoom-out / dolly-forward / static / tilt-up / orbit)
- transition: 轉場效果 (fade / slide-left / slide-right / zoom-in / dissolve)
- type: 場景類型 (hook / problem / solution / benefit / cta / story / demo)

風格模板: {request.style_id}
影片總長: {request.duration} 秒
比例: {request.aspect_ratio}

嚴格以 JSON 陣列格式回覆，不要加其他文字。範例：
[
  {{
    "narration": "你是否也曾為此困擾？",
    "visualPrompt": "Cinematic close-up of a person looking frustrated at a computer screen, warm lighting, shallow depth of field, dolly forward",
    "cameraMove": "dolly-forward", 
    "transition": "fade",
    "type": "hook"
  }}
]"""
    
    user_prompt = f"主題文字：{request.script}"
    
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_KEY)
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        response = model.generate_content(
            [system_prompt, user_prompt],
            generation_config=genai.GenerationConfig(
                temperature=0.8,
                max_output_tokens=2000,
            ),
        )
        
        raw_text = response.text.strip()
        # 清理 markdown code block
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1] if "\n" in raw_text else raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3].strip()
        if raw_text.startswith("json"):
            raw_text = raw_text[4:].strip()
        
        ai_scenes = json.loads(raw_text)
        
    except json.JSONDecodeError as e:
        logger.error(f"[v3] Gemini JSON 解析失敗: {e}, raw: {raw_text[:200]}")
        raise HTTPException(status_code=500, detail=f"AI 回應格式錯誤: {str(e)}")
    except Exception as e:
        logger.error(f"[v3] Gemini 生成失敗: {e}")
        raise HTTPException(status_code=500, detail=f"AI 生成失敗: {str(e)}")
    
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
    return {
        "job_id": job_id,
        "status": "completed",
        "scenes": scenes,
        "subtitles": subtitles,
        "script": {
            "projectId": job_id,
            "title": request.script[:50],
            "description": request.script,
            "totalDurationInFrames": frame_offset,
            "fps": fps,
            "width": 1080,
            "height": 1920 if request.aspect_ratio == "9:16" else 1080,
            "aspectRatio": request.aspect_ratio,
        },
        "config": {
            "style_id": request.style_id,
            "duration": request.duration,
            "aspect_ratio": request.aspect_ratio,
            "voice": request.voice,
            "scenes_count": len(scenes),
        },
    }

