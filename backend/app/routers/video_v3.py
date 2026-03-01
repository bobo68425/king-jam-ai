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
    """全自動影片生成請求 — 支援 T2V / I2V / S2V / SadTalker 四種模式"""
    mode: str = Field(default="t2v", description="生成模式: t2v / i2v / s2v / sadtalker")
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
async def generate_clips(request: BatchClipRequest):
    """
    批次提交場景到 fal.ai 生成 AI 影片片段
    
    輸入: scenes 陣列 (每個含 visualPrompt, refImageUrl 等)
    輸出: 每個場景的 fal.ai job ID
    """
    from app.services.video_v3.fal_service import generate_scene_clip
    
    results = []
    errors = []
    
    for i, scene in enumerate(request.scenes):
        try:
            prompt = scene.get("visualPrompt", "")
            ref_image = scene.get("refImageUrl", None)
            audio_url = scene.get("audioUrl", None)
            duration_sec = max(3, min(10, scene.get("durationInFrames", 150) // 30))
            
            result = await generate_scene_clip(
                prompt=prompt,
                duration=duration_sec,
                aspect_ratio=request.aspect_ratio,
                model_preference=request.model_preference,
                reference_image_url=ref_image,
                audio_url=audio_url,
            )
            
            results.append({
                "index": i,
                "request_id": result["request_id"],
                "model": result["model"],
                "status": "queued",
            })
            logger.info(f"[v3 batch] 場景 {i} 已提交: {result['request_id']}")
            
        except Exception as e:
            logger.error(f"[v3 batch] 場景 {i} 提交失敗: {e}")
            errors.append({"index": i, "error": str(e)})
            results.append({
                "index": i,
                "request_id": None,
                "model": None,
                "status": "error",
                "error": str(e),
            })
    
    return {
        "total": len(request.scenes),
        "submitted": len([r for r in results if r["status"] == "queued"]),
        "failed": len(errors),
        "jobs": results,
    }


@router.post("/api/check-clips")
async def check_clips(request: CheckClipsRequest):
    """
    批次查詢 fal.ai 片段生成狀態
    """
    from app.services.video_v3.fal_service import check_scene_status
    
    statuses = []
    for job in request.jobs:
        rid = job.get("request_id")
        model = job.get("model", "")
        if not rid:
            statuses.append({"request_id": rid, "status": "error", "error": "missing request_id"})
            continue
        try:
            status = await check_scene_status(rid, model)
            statuses.append(status)
        except Exception as e:
            statuses.append({"request_id": rid, "status": "error", "error": str(e)})
    
    all_done = all(s.get("status") in ("completed", "error", "COMPLETED") for s in statuses)
    
    return {
        "all_done": all_done,
        "statuses": statuses,
    }


# 公開 API — 全自動閉環
# ============================================================

@router.post("/api/generate-video")
async def generate_video_api(request: FullGenerateRequest):
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
    
    GEMINI_KEY = os.getenv("GOOGLE_GEMINI_KEY", "")
    if not GEMINI_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_GEMINI_KEY 未設定")
    
    # ====== 根據模式構建不同的 Gemini Prompt ======
    if mode == "i2v":
        # 圖片生成影片模式
        system_prompt = f"""你是一位專業的影片動態導演。
用戶會給你一段描述，以及一張參考圖片的概念。
請基於這張圖片，生成 {request.scenes_count} 個場景的短影音腳本，讓圖片「動起來」。

重要規則：
- 每個場景應該呈現圖片中不同角度、不同動態的變化
- visualPrompt 必須包含 "reference image" 的元素描述
- 動態應該自然流暢，像電影鏡頭掃描一張照片

每個場景需要包含：
- narration: 旁白文字 (中文，15-30字)
- visualPrompt: 英文 AI 影片提示詞 (描述從圖片衍生的動態畫面)
- cameraMove: 運鏡方式 (pan-left / pan-right / zoom-in / zoom-out / dolly-forward / static / tilt-up / orbit)
- transition: 轉場效果 (fade / slide-left / slide-right / zoom-in / dissolve)
- type: 場景類型 (hook / story / demo / cta)

風格模板: {request.style_id}
影片總長: {request.duration} 秒
比例: {request.aspect_ratio}

嚴格以 JSON 陣列格式回覆，不要加其他文字。"""
        ref_note = f"\n參考圖片 URL: {request.ref_image_url}" if request.ref_image_url else ""
        user_prompt = f"描述：{request.script}{ref_note}"
        
    elif mode == "s2v":
        # 語音驅動影片模式
        system_prompt = f"""你是一位專業的語音驅動影片導演。
用戶會給你一段語音/對話的描述，請生成 {request.scenes_count} 個場景的短影音腳本。

重要規則：
- 旁白文字即為語音內容，需要自然朗讀感
- visualPrompt 要包含角色的表情、動作、口型同步效果
- 場景應該配合語音情緒變化（激動→平靜→高潮）
- 包含 "speaking", "lip sync", "facial expression" 等關鍵詞

每個場景需要包含：
- narration: 語音旁白文字 (中文，20-40字，對話式)
- visualPrompt: 英文 AI 影片提示詞 (強調表情、口型同步、肢體語言)
- cameraMove: 運鏡方式 (pan-left / pan-right / zoom-in / zoom-out / dolly-forward / static / tilt-up / orbit)
- transition: 轉場效果 (fade / slide-left / slide-right / zoom-in / dissolve)
- type: 場景類型 (hook / story / demo / cta)
- emotion: 情緒標籤 (excited / calm / serious / happy / dramatic)

風格模板: {request.style_id}
影片總長: {request.duration} 秒
比例: {request.aspect_ratio}

嚴格以 JSON 陣列格式回覆，不要加其他文字。"""
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
        # T2V 文字生成影片模式（原有邏輯）
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
    
    # ====== 呼叫 Gemini AI ======
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_KEY)
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        response = model.generate_content(
            [system_prompt, user_prompt],
            generation_config=genai.GenerationConfig(
                temperature=0.8,
                max_output_tokens=3000,
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
        
        # I2V 與 SadTalker 模式：每個場景附加參考圖片 URL
        if mode in ("i2v", "sadtalker") and request.ref_image_url:
            scene["refImageUrl"] = request.ref_image_url
        
        # S2V 與 SadTalker 模式：附加情緒標籤和音頻 URL
        if mode in ("s2v", "sadtalker"):
            scene["emotion"] = ai_scene.get("emotion", "calm")
            if request.audio_url:
                scene["audioUrl"] = request.audio_url
        
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

