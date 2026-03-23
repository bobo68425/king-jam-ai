"""
短影音生成 API
===============
使用 Director Engine 生成影片腳本和內容
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
import logging
import traceback
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from pathlib import Path
import os

from datetime import datetime
import time

from app.database import get_db
from app.models import User, GenerationHistory
from app.routers.auth import get_current_user
from app.services.credit_service import CreditService, TransactionType
from app.services.rate_limiter import video_rate_limiter
from app.services.director_engine import (
    DirectorEngine,
    VideoRequest,
    VideoScript,
    BrandProfile,
    BrandPersonality,
    AvatarAsset,
    AvatarGender,
    VideoFormat,
    VideoDuration,
    SceneInstruction,
    DEFAULT_BRAND_TEMPLATES,
)
from app.services.storyboard_service import (
    StoryboardService,
    StoryboardPreview,
    StoryboardScene,
    TTSService,
    get_storyboard_service,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/video", tags=["Video Generation"])

# 靜態影片目錄
STATIC_VIDEO_DIR = Path("/app/static/videos")

# 資費設定 - 腳本生成（AI 導演）
SCRIPT_COST = {
    "5": 10,    # 5 秒腳本 (Kling)
    "8": 15,    # 8 秒腳本 (Veo)
    "10": 15,   # 10 秒腳本 (Kling)
    "15": 20,   # 15 秒腳本
    "30": 30,   # 30 秒腳本
    "60": 50,   # 60 秒腳本
}

# 影片渲染資費 - 根據品質分級
RENDER_COST = {
    # 標準品質 (Imagen + FFmpeg) - 支持任意長度
    "standard": {
        "15": 50,
        "30": 80,
        "60": 120,
    },
    # Kling v2.1 720p - 5秒
    "kling": {
        "5": 30,
        "default": 30,
    },
    # Kling v2.1 720p - 10秒
    "kling-10s": {
        "10": 55,
        "default": 55,
    },
    # Kling v2.1 Pro 1080p - 5秒
    "kling-pro": {
        "5": 50,
        "default": 50,
    },
    # Kling v2.1 Pro 1080p - 10秒
    "kling-pro-10s": {
        "10": 90,
        "default": 90,
    },
    # 高級品質 (Veo 3 Fast) - 固定 8 秒
    "premium": {
        "8": 200,
        "default": 200,
    },
    # 頂級品質 (Veo 3) - 固定 8 秒
    "ultra": {
        "8": 350,
        "default": 350,
    },
}

# 舊版相容
COST_TABLE = SCRIPT_COST

# Storyboard 預覽成本（低成本確認模式）
STORYBOARD_COST = {
    "preview": 2,      # 每個場景預覽 2 點
    "tts": 1,          # 每個場景 TTS 1 點
    "preview_video": 5, # 快速預覽影片 5 點
}

# Director Engine 實例
director = DirectorEngine()

# Storyboard Service 實例
storyboard_service = StoryboardService()

# 預估處理時間（秒）
ESTIMATED_PROCESSING_TIME = {
    "kling": 60,         # Kling 720p 5秒 約 1 分鐘
    "kling-10s": 90,     # Kling 720p 10秒 約 1.5 分鐘
    "kling-pro": 90,     # Kling Pro 1080p 5秒 約 1.5 分鐘
    "kling-pro-10s": 120, # Kling Pro 1080p 10秒 約 2 分鐘
    "premium": 180,      # Veo Fast 約 3 分鐘
    "ultra": 300,        # Veo Pro 約 5 分鐘
    "standard": 120,     # 標準合成 約 2 分鐘
}


# ============================================================
# Request/Response Models
# ============================================================

class BrandProfileRequest(BaseModel):
    """品牌設定請求"""
    brand_name: str = Field(..., min_length=1, max_length=50)
    tagline: Optional[str] = Field(None, max_length=100)
    industry: str = Field(..., min_length=1, max_length=50)
    personality: str = Field(default="friendly")
    tone_of_voice: str = Field(default="親切、專業、有溫度", max_length=200)
    primary_color: str = Field(default="#6366F1", pattern="^#[0-9A-Fa-f]{6}$")
    secondary_color: str = Field(default="#8B5CF6", pattern="^#[0-9A-Fa-f]{6}$")
    visual_style: str = Field(default="modern, clean", max_length=200)
    target_audience: str = Field(default="25-45歲都市專業人士", max_length=200)
    key_messages: List[str] = Field(default=[])
    forbidden_themes: List[str] = Field(default=[])


class AvatarRequest(BaseModel):
    """角色設定請求"""
    name: str = Field(..., min_length=1, max_length=50)
    gender: str = Field(default="neutral")
    age_range: str = Field(default="25-35")
    appearance: str = Field(default="", max_length=500)
    personality: str = Field(default="", max_length=500)
    voice_style: str = Field(default="friendly, warm", max_length=200)


class VideoGenerateRequest(BaseModel):
    """影片生成請求"""
    # 基本需求
    topic: str = Field(..., min_length=1, max_length=2000, description="影片主題或腳本內容")
    goal: str = Field(default="awareness", description="目標：awareness/engagement/conversion")
    platform: str = Field(default="tiktok", description="目標平台")
    duration: str = Field(default="30", description="影片長度：15/30/60")
    format: str = Field(default="9:16", description="影片格式")
    
    # 進階風格設定
    visual_style: Optional[str] = Field(default="cinematic", description="視覺風格")
    music_style: Optional[str] = Field(default="upbeat", description="音樂風格")
    subtitle_style: Optional[str] = Field(default="boxed", description="字幕樣式")
    
    # 產品資訊（可選）
    product_name: Optional[str] = Field(None, max_length=100)
    product_features: Optional[List[str]] = Field(None)
    key_message: Optional[str] = Field(None, max_length=200)
    reference_style: Optional[str] = Field(None, max_length=200)
    
    # 品牌設定
    brand: Optional[BrandProfileRequest] = None
    brand_template: Optional[str] = Field(None, description="使用預設模板：tech_startup/lifestyle_brand/food_beverage")
    
    # 角色設定（可選）
    avatar: Optional[AvatarRequest] = None


class SceneResponse(BaseModel):
    """場景回應"""
    scene_number: int
    scene_type: str
    duration_seconds: float
    visual_prompt: str
    visual_style: str
    camera_movement: str
    narration_text: str
    voice_emotion: str
    text_overlay: Optional[str]
    text_position: str
    text_animation: str
    background_music_mood: str
    sound_effects: List[str]


class VideoScriptResponse(BaseModel):
    """影片腳本回應"""
    project_id: str
    title: str
    description: str
    format: str
    total_duration: int
    overall_style: str
    color_palette: List[str]
    music_genre: str
    target_platform: str
    scenes: List[SceneResponse]
    
    # 成本資訊
    credits_used: int


# ============================================================
# Queue Status Response Model
# ============================================================

class QueueStatusResponse(BaseModel):
    """佇列狀態回應"""
    queue_length: int = Field(description="佇列中等待的任務數")
    active_tasks: int = Field(description="正在處理的任務數")
    your_position: Optional[int] = Field(None, description="您的任務在佇列中的位置")
    estimated_wait_seconds: int = Field(description="預估等待時間（秒）")
    estimated_wait_minutes: float = Field(description="預估等待時間（分鐘）")
    estimated_wait_display: str = Field(description="預估等待時間顯示文字")
    system_load: str = Field(description="系統負載: low/medium/high/busy")
    is_busy: bool = Field(description="系統是否繁忙")
    suggested_model: Optional[str] = Field(None, description="建議的模型（如果系統繁忙）")
    message: Optional[str] = Field(None, description="提示訊息")


# ============================================================
# API Endpoints
# ============================================================

@router.get("/queue-status", response_model=QueueStatusResponse)
async def get_queue_status(
    model: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    獲取影片生成佇列狀態
    """
    import redis
    
    try:
        # 連接 Redis
        client = redis.from_url("redis://redis:6379/0", socket_timeout=3)
        
        # 獲取 video 佇列長度
        queue_length = client.llen("queue_video") or 0
        
        # 獲取正在處理的任務數
        active_tasks = video_rate_limiter.get_global_count()
        
        # 計算用戶自己的任務位置
        user_position = None
        user_task_count = video_rate_limiter.get_user_task_count(current_user.id)
        if user_task_count > 0:
            user_position = queue_length + 1
        
        selected_model = model or "kling"
        processing_time = ESTIMATED_PROCESSING_TIME.get(selected_model, 90)
        
        estimated_wait = (queue_length * processing_time) + (processing_time if queue_length == 0 else 0)
        if active_tasks > 0:
            estimated_wait += processing_time // 2
        
        estimated_minutes = round(estimated_wait / 60, 1)
        
        if estimated_wait <= 0:
            wait_display = "立即處理"
        elif estimated_wait < 60:
            wait_display = f"約 {estimated_wait} 秒"
        elif estimated_wait < 3600:
            minutes = int(estimated_wait // 60)
            seconds = int(estimated_wait % 60)
            wait_display = f"約 {minutes} 分 {seconds} 秒" if seconds > 0 else f"約 {minutes} 分鐘"
        else:
            hours = int(estimated_wait // 3600)
            minutes = int((estimated_wait % 3600) // 60)
            wait_display = f"約 {hours} 小時 {minutes} 分鐘"
        
        total_pending = queue_length + active_tasks
        if total_pending == 0:
            system_load = "low"
            is_busy = False
        elif total_pending <= 2:
            system_load = "medium"
            is_busy = False
        elif total_pending <= 5:
            system_load = "high"
            is_busy = True
        else:
            system_load = "busy"
            is_busy = True
        
        suggested_model = None
        message = None
        
        if is_busy:
            if model in ["ultra", "premium"]:
                suggested_model = "kling"
                message = f"系統繁忙，前方還有 {queue_length} 個任務。建議使用 Kling 模型以縮短等待時間。"
            else:
                message = f"系統繁忙，前方還有 {queue_length} 個任務，預估等待 {wait_display}。"
        elif queue_length > 0:
            message = f"前方還有 {queue_length} 個任務，預估等待 {wait_display}。"
        else:
            message = "目前無需等待，可立即開始生成！"
        
        return QueueStatusResponse(
            queue_length=queue_length,
            active_tasks=active_tasks,
            your_position=user_position,
            estimated_wait_seconds=estimated_wait,
            estimated_wait_minutes=estimated_minutes,
            estimated_wait_display=wait_display,
            system_load=system_load,
            is_busy=is_busy,
            suggested_model=suggested_model,
            message=message,
        )
        
    except Exception:
        return QueueStatusResponse(
            queue_length=0,
            active_tasks=0,
            your_position=None,
            estimated_wait_seconds=90,
            estimated_wait_minutes=1.5,
            estimated_wait_display="約 1-2 分鐘",
            system_load="medium",
            is_busy=False,
            suggested_model=None,
            message="無法獲取佇列狀態，預估處理時間約 1-2 分鐘。",
        )


@router.post("/generate", response_model=VideoScriptResponse)
async def generate_video_script(
    request: VideoGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    生成影片腳本
    """
    cost = COST_TABLE.get(request.duration, 15)
    credit_service = CreditService(db)
    
    if request.brand:
        try:
            personality = BrandPersonality(request.brand.personality)
        except ValueError:
            personality = BrandPersonality.FRIENDLY
        
        brand = BrandProfile(
            brand_name=request.brand.brand_name,
            tagline=request.brand.tagline,
            industry=request.brand.industry,
            personality=personality,
            tone_of_voice=request.brand.tone_of_voice,
            primary_color=request.brand.primary_color,
            secondary_color=request.brand.secondary_color,
            visual_style=request.brand.visual_style,
            target_audience=request.brand.target_audience,
            key_messages=request.brand.key_messages,
            forbidden_themes=request.brand.forbidden_themes,
        )
    elif request.brand_template and request.brand_template in DEFAULT_BRAND_TEMPLATES:
        brand = DEFAULT_BRAND_TEMPLATES[request.brand_template].model_copy()
        brand.brand_name = "我的品牌"
    else:
        brand = BrandProfile(brand_name="我的品牌", industry="綜合", personality=BrandPersonality.FRIENDLY)
    
    avatar = None
    if request.avatar:
        try:
            gender = AvatarGender(request.avatar.gender)
        except ValueError:
            gender = AvatarGender.NEUTRAL
        
        avatar = AvatarAsset(
            name=request.avatar.name,
            gender=gender,
            age_range=request.avatar.age_range,
            appearance=request.avatar.appearance,
            personality=request.avatar.personality,
            voice_style=request.avatar.voice_style,
        )
    
    try:
        video_format = VideoFormat(request.format)
    except ValueError:
        video_format = VideoFormat.VERTICAL_9_16
    
    try:
        video_duration = VideoDuration(request.duration)
    except ValueError:
        duration_map = {"5": VideoDuration.KLING_5, "10": VideoDuration.KLING_10, "8": VideoDuration.QUICK_8}
        video_duration = duration_map.get(request.duration, VideoDuration.QUICK_8)
    
    video_request = VideoRequest(
        topic=request.topic,
        goal=request.goal,
        platform=request.platform,
        duration=video_duration,
        format=video_format,
        product_name=request.product_name,
        product_features=request.product_features,
        key_message=request.key_message,
        reference_style=request.reference_style,
    )
    
    consume_result = credit_service.consume_direct(
        user_id=current_user.id,
        cost=cost,
        transaction_type=TransactionType.CONSUME_SHORT_VIDEO,
        description=f"腳本生成 - {request.topic[:30] if request.topic else '影片'}",
        reference_type="video_script",
        metadata={"duration": request.duration, "platform": request.platform, "topic": request.topic}
    )
    
    if not consume_result.success:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=consume_result.error or f"點數不足！需要 {cost} 點")
    
    start_time = time.time()
    try:
        script = await director.generate_video_script(video_request, brand, avatar)
        generation_duration = int((time.time() - start_time) * 1000)
        
        history = GenerationHistory(
            user_id=current_user.id,
            generation_type="video_script",
            status="completed",
            input_params={
                "topic": request.topic,
                "goal": request.goal,
                "platform": request.platform,
                "duration": request.duration,
                "format": request.format,
            },
            output_data={"project_id": script.project_id, "title": script.title, "scenes_count": len(script.scenes)},
            credits_used=cost,
            generation_duration_ms=generation_duration,
        )
        db.add(history)
        db.commit()
        
    except Exception as e:
        history = GenerationHistory(
            user_id=current_user.id,
            generation_type="short_video",
            status="failed",
            input_params={"topic": request.topic, "platform": request.platform, "duration": request.duration},
            credits_used=cost,
            error_message=str(e),
        )
        db.add(history)
        db.commit()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"腳本生成失敗：{str(e)}")
    
    scenes_response = [
        SceneResponse(
            scene_number=scene.scene_number,
            scene_type=scene.scene_type.value,
            duration_seconds=scene.duration_seconds,
            visual_prompt=scene.visual_prompt,
            visual_style=scene.visual_style,
            camera_movement=scene.camera_movement,
            narration_text=scene.narration_text,
            voice_emotion=scene.voice_emotion,
            text_overlay=scene.text_overlay,
            text_position=scene.text_position,
            text_animation=scene.text_animation,
            background_music_mood=scene.background_music_mood,
            sound_effects=scene.sound_effects,
        )
        for scene in script.scenes
    ]
    
    return VideoScriptResponse(
        project_id=script.project_id,
        title=script.title,
        description=script.description,
        format=script.format.value,
        total_duration=script.total_duration,
        overall_style=script.overall_style,
        color_palette=script.color_palette,
        music_genre=script.music_genre,
        target_platform=script.target_platform,
        scenes=scenes_response,
        credits_used=cost,
    )


# ============================================================
# Director Engine 2.0 - Storyboard 預覽 API
# ============================================================

class StoryboardPreviewRequest(BaseModel):
    """Storyboard 預覽請求"""
    script: Dict[str, Any]
    voice_id: str = "zh-TW-HsiaoChenNeural"
    generate_thumbnails: bool = True
    generate_audio: bool = True
    generate_preview_video: bool = False


class StoryboardSceneResponse(BaseModel):
    """分鏡場景回應"""
    scene_index: int
    title: str
    description: str
    visual_prompt: str
    narration: str
    duration_seconds: float
    thumbnail_base64: Optional[str] = None
    audio_url: Optional[str] = None
    audio_base64: Optional[str] = None
    audio_duration: Optional[float] = None
    subtitle_text: str = ""
    subtitle_start: float = 0
    subtitle_end: float = 0


class StoryboardPreviewResponse(BaseModel):
    """Storyboard 預覽回應"""
    project_id: str
    title: str
    description: str
    format: str
    total_duration: float
    scenes: List[StoryboardSceneResponse]
    preview_video_url: Optional[str] = None
    voice_id: str
    primary_color: str
    secondary_color: str
    preview_credits_used: int
    estimated_render_credits: int
    srt_subtitles: Optional[str] = None


class TTSVoiceInfo(BaseModel):
    """TTS 語音資訊"""
    voice_id: str
    name: str
    gender: str
    style: str


@router.post("/preview", response_model=StoryboardPreviewResponse)
async def generate_storyboard_preview(
    request: StoryboardPreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """生成 Storyboard 預覽"""
    script = request.script
    scenes = script.get("scenes", [])
    if not scenes:
        raise HTTPException(status_code=400, detail="腳本中沒有場景")
    
    cost = 0
    if request.generate_thumbnails: cost += len(scenes) * STORYBOARD_COST["preview"]
    if request.generate_audio: cost += len(scenes) * STORYBOARD_COST["tts"]
    if request.generate_preview_video: cost += STORYBOARD_COST["preview_video"]
    
    credit_service = CreditService(db)
    consume_result = credit_service.consume_direct(
        user_id=current_user.id,
        cost=cost,
        transaction_type=TransactionType.CONSUME_SHORT_VIDEO,
        description=f"Storyboard 預覽 ({len(scenes)} 場景)",
        reference_type="storyboard_preview",
        metadata={"project_id": script.get("project_id")}
    )
    
    if not consume_result.success:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=consume_result.error or f"點數不足！需要 {cost} 點")
    
    try:
        preview = await storyboard_service.generate_preview(
            script=script,
            voice_id=request.voice_id,
            generate_thumbnails=request.generate_thumbnails,
            generate_audio=request.generate_audio,
            generate_preview_video=request.generate_preview_video,
        )
        srt_subtitles = storyboard_service.generate_srt_subtitles(preview.scenes)
        scenes_response = [
            StoryboardSceneResponse(
                scene_index=s.scene_index, title=s.title, description=s.description,
                visual_prompt=s.visual_prompt, narration=s.narration,
                duration_seconds=s.duration_seconds, thumbnail_base64=s.thumbnail_base64,
                audio_url=s.audio_url, audio_base64=s.audio_base64, audio_duration=s.audio_duration,
                subtitle_text=s.subtitle_text, subtitle_start=s.subtitle_start, subtitle_end=s.subtitle_end,
            ) for s in preview.scenes
        ]
        
        return StoryboardPreviewResponse(
            project_id=preview.project_id, title=preview.title, description=preview.description,
            format=preview.format, total_duration=preview.total_duration, scenes=scenes_response,
            preview_video_url=preview.preview_video_url, voice_id=preview.voice_id,
            primary_color=preview.primary_color, secondary_color=preview.secondary_color,
            preview_credits_used=cost, estimated_render_credits=preview.estimated_render_credits,
            srt_subtitles=srt_subtitles,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"預覽生成失敗: {str(e)}")


@router.get("/tts/voices", response_model=List[TTSVoiceInfo])
async def get_tts_voices(current_user: User = Depends(get_current_user)):
    """獲取可用的 TTS 語音列表"""
    tts_service = TTSService()
    voices = tts_service.get_available_voices()
    return [TTSVoiceInfo(voice_id=vid, name=info["name"], gender=info["gender"], style=info["style"]) for vid, info in voices.items()]


class TTSPreviewRequest(BaseModel):
    """TTS 試聽請求"""
    voice_id: str
    text: str = "你好，歡迎使用 King Jam AI 智慧內容創作平台。這是語音試聽範例。"


@router.post("/tts/preview")
async def preview_tts_voice(request: TTSPreviewRequest, current_user: User = Depends(get_current_user)):
    """TTS 語音試聽（免費）"""
    from fastapi.responses import StreamingResponse
    import io
    tts_service = TTSService()
    text = request.text[:200]
    try:
        result = await tts_service.generate_speech(text=text, voice_id=request.voice_id)
        with open(result.audio_path, "rb") as f:
            audio_data = f.read()
        try:
            os.remove(result.audio_path)
            if result.subtitle_path: os.remove(result.subtitle_path)
        except: pass
        return StreamingResponse(io.BytesIO(audio_data), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"語音生成失敗: {str(e)}")


@router.get("/templates")
async def get_brand_templates():
    """取得預設品牌模板列表"""
    templates = []
    for key, brand in DEFAULT_BRAND_TEMPLATES.items():
        templates.append({
            "id": key, "name": brand.brand_name, "industry": brand.industry,
            "personality": brand.personality.value, "visual_style": brand.visual_style,
            "primary_color": brand.primary_color, "secondary_color": brand.secondary_color,
        })
    return {"templates": templates}


@router.get("/pricing")
async def get_pricing():
    """取得影片生成價格"""
    return {
        "script_pricing": [
            {"duration": "15", "credits": 20}, {"duration": "30", "credits": 30}, {"duration": "60", "credits": 50},
        ],
        "render_pricing": {
            "standard": {"prices": [{"duration": "15", "credits": 50}, {"duration": "30", "credits": 80}, {"duration": "60", "credits": 120}]},
            "premium": {"prices": [{"duration": "8", "credits": 200}]},
            "ultra": {"prices": [{"duration": "8", "credits": 350}]},
        },
        "preview_cost": 10,
    }


@router.get("/download/{filename}")
async def download_video(filename: str):
    """下載生成的影片"""
    if ".." in filename or "/" in filename or "\\" in filename: raise HTTPException(status_code=400)
    video_path = STATIC_VIDEO_DIR / filename
    if not video_path.exists(): raise HTTPException(status_code=404)
    return FileResponse(path=str(video_path), media_type="video/mp4", filename=filename)


@router.get("/download-proxy")
async def download_video_proxy(url: str, filename: str = "kingjam-video.mp4"):
    """代理下載雲端影片"""
    import aiohttp
    from fastapi.responses import StreamingResponse
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=120) as response:
                content = await response.read()
                return StreamingResponse(iter([content]), media_type=response.headers.get("Content-Type", "video/mp4"), headers={"Content-Disposition": f"attachment; filename={filename}"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/platforms")
async def get_platforms():
    """取得支援的平台列表"""
    return {"platforms": [{"id": "tiktok", "name": "TikTok"}, {"id": "instagram_reels", "name": "Instagram"}]}


@router.get("/scene-types")
async def get_scene_types():
    """取得場景類型說明"""
    return {"scene_types": [{"id": "hook", "name": "開場吸引"}, {"id": "cta", "name": "行動呼籲"}]}


@router.get("/visual-styles")
async def get_visual_styles():
    """取得視覺風格選項"""
    return {"visual_styles": [{"id": "cinematic", "name": "電影感"}, {"id": "minimal", "name": "極簡風"}]}


@router.get("/music-styles")
async def get_music_styles():
    """取得音樂風格選項"""
    return {"music_styles": [{"id": "upbeat", "name": "輕快活潑"}, {"id": "emotional", "name": "感性抒情"}]}


@router.get("/camera-movements")
async def get_camera_movements():
    """取得鏡頭運動選項"""
    return {"camera_movements": [{"id": "dolly_in", "name": "推近"}, {"id": "orbit", "name": "環繞"}]}


@router.get("/subtitle-styles")
async def get_subtitle_styles():
    """取得字幕樣式選項"""
    return {"subtitle_styles": [{"id": "minimal", "name": "極簡"}, {"id": "boxed", "name": "方框底"}]}


@router.get("/quick-templates")
async def get_quick_templates():
    """取得快速模板"""
    return {
        "templates": [
            {
                "id": "product_launch", "name": "🚀 產品發布", "duration": "30",
                "scenes": [{"id": "cta", "duration": 5, "tip": "立即購買"}],
                "music": "upbeat", "style": "cinematic"
            }
        ]
    }


# ============================================================
# 核心影片生成路由 (Super Debug & Protected)
# ============================================================

from app.services.video_generator import video_generator, VideoResult

@router.post("/render", response_model=RenderVideoResponse)
async def render_video(
    request: RenderVideoRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    提交影片渲染任務 (Veo 3 / Kling) - MEGA DEBUG 模式
    """
    # 預先定義變數以便在 except/finally 區塊中使用
    task_id = None
    cost = 0
    duration = "30"
    quality = "standard"
    script = request.script
    
    try:
        # OOM 預防：檢查速率限制
        can_submit, reason = video_rate_limiter.can_submit_task(current_user.id)
        if not can_submit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=reason
            )
        
        if not script:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="缺少腳本內容")
            
        duration = str(script.get("total_duration", 30))
        quality = request.quality if request.quality in RENDER_COST else "standard"
        
        # 1. 計算點數
        cost_table = RENDER_COST.get(quality, RENDER_COST["standard"])
        if quality in ["premium", "ultra", "kling", "kling-10s", "kling-pro", "kling-pro-10s"]:
            cost = cost_table.get("default", 50)
        else:
            cost = cost_table.get(duration, cost_table.get("30", 80))
        
        # 初始化點數服務
        credit_service = CreditService(db)
        
        # 2. 處理用戶自訂圖片
        custom_images_dict = {}
        if request.custom_images:
            for img in request.custom_images:
                key = str(img.scene_index)
                if img.image_base64:
                    custom_images_dict[key] = img.image_base64
                elif img.image_url:
                    custom_images_dict[key] = img.image_url
        
        # 3. 先扣除點數
        if quality in ["premium", "ultra"]:
            tx_type = TransactionType.CONSUME_VEO_VIDEO
        else:
            tx_type = TransactionType.CONSUME_SHORT_VIDEO
            
        consume_result = credit_service.consume_direct(
            user_id=current_user.id,
            cost=cost,
            transaction_type=tx_type,
            description=f"影片渲染 - {quality} 品質, {duration}秒",
            reference_type="video_render",
            metadata={
                "quality": quality,
                "duration": duration,
                "project_id": script.get("project_id"),
            }
        )
        
        if not consume_result.success:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=consume_result.error or f"點數不足！{quality} 品質渲染需要 {cost} 點"
            )
        
        # 4. 生成任務 ID
        start_time = time.time()
        task_id = f"render_{current_user.id}_{int(start_time)}"
        
        # OOM 預防：註冊任務
        video_rate_limiter.register_task(current_user.id, task_id)
        
        from app.tasks.video_tasks import render_video_v2_task
        
        # 建立初始歷史記錄 (status="pending")
        topic = script.get("topic") or script.get("input_topic") or script.get("title", "")
        script_credits_raw = script.get("credits_used", 0)
        try:
            script_credits = int(script_credits_raw)
        except (ValueError, TypeError):
            script_credits = 0
            
        total_credits = script_credits + cost
        
        history = GenerationHistory(
            user_id=current_user.id,
            generation_type="short_video",
            status="pending",
            input_params={
                "topic": topic,
                "project_id": script.get("project_id"),
                "title": script.get("title"),
                "quality": quality,
                "duration": duration,
                "render_credits": cost,
            },
            credits_used=total_credits,
        )
        db.add(history)
        db.commit()
        db.refresh(history)
        
        # 5. 非同步派遣任務 (Celery)
        celery_task = render_video_v2_task.delay(
            user_id=current_user.id,
            script=script,
            quality=quality,
            custom_images=custom_images_dict,
            custom_music_base64=request.custom_music_base64 or script.get("custom_music_base64"),
            custom_music_name=request.custom_music_name or script.get("custom_music_name"),
            history_id=history.id
        )
        
        return RenderVideoResponse(
            task_id=celery_task.id if hasattr(celery_task, 'id') else task_id,
            duration=float(duration),
            format=script.get("format", "9:16"),
            credits_used=total_credits
        )

    except HTTPException as he:
        raise he
    except Exception as e:
        error_traceback = traceback.format_exc()
        logger.error(f"[video_render] 渲染發生致命錯誤: {str(e)}\n{error_traceback}")
        
        # 嘗試記錄失敗
        try:
            h_fail = GenerationHistory(
                user_id=current_user.id,
                generation_type="short_video",
                status="failed",
                error_message=f"{str(e)}\n{error_traceback[:500]}",
                input_params={"quality": quality, "duration": duration, "project_id": script.get("project_id") if script else "unknown"},
                credits_used=cost,
            )
            db.add(h_fail)
            db.commit()
        except:
            db.rollback()
            
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"影片生成內部錯誤：{str(e)} | Trace: {error_traceback.splitlines()[-1]}"
        )
    finally:
        if task_id:
            video_rate_limiter.complete_task(current_user.id, task_id)


@router.post("/proxy-music")
async def proxy_music_v2(url: str, current_user: User = Depends(get_current_user)):
    """音樂代理端點"""
    from fastapi.responses import StreamingResponse
    import aiohttp
    async with aiohttp.ClientSession() as session:
        async with session.get(url, timeout=30) as response:
            content = await response.read()
            return StreamingResponse(io.BytesIO(content), media_type=response.headers.get("Content-Type", "audio/mpeg"))


@router.post("/music/preview")
async def preview_music_v2(request: MusicPreviewRequest, current_user: User = Depends(get_current_user)):
    """音樂風格預覽"""
    from fastapi.responses import StreamingResponse
    import io
    try:
        music_path = await video_generator._generate_background_music(request.style, 10.0, f"preview_{current_user.id}")
        if not music_path or not os.path.exists(music_path): raise HTTPException(status_code=500, detail="音樂生成失敗")
        with open(music_path, 'rb') as f: audio_data = f.read()
        try: os.remove(music_path)
        except: pass
        return StreamingResponse(io.BytesIO(audio_data), media_type="audio/wav")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
