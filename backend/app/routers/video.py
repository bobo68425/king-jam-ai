"""
短影音生成 API
===============
使用 Director Engine 生成影片腳本和內容
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
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
    
    返回預估等待時間，用於前端顯示「預估等待時間」
    計算方式：佇列長度 × 該模型的平均處理時間
    """
    import redis
    
    try:
        # 連接 Redis
        client = redis.from_url("redis://redis:6379/0", socket_timeout=3)
        
        # 獲取 video 佇列長度
        queue_length = client.llen("queue_video") or 0
        
        # 獲取正在處理的任務數（從 rate_limiter）
        active_tasks = video_rate_limiter.get_global_count()
        
        # 計算用戶自己的任務位置（如果有的話）
        user_position = None
        user_task_count = video_rate_limiter.get_user_task_count(current_user.id)
        if user_task_count > 0:
            user_position = queue_length + 1  # 最後一個
        
        # 計算預估等待時間
        # 假設同時處理的任務數為 1（單一 worker）
        selected_model = model or "kling"
        processing_time = ESTIMATED_PROCESSING_TIME.get(selected_model, 90)
        
        # 預估等待時間 = 佇列中的任務數 × 平均處理時間 + 當前任務的處理時間
        estimated_wait = (queue_length * processing_time) + (processing_time if queue_length == 0 else 0)
        
        # 如果有正在處理的任務，加上剩餘處理時間（估計一半）
        if active_tasks > 0:
            estimated_wait += processing_time // 2
        
        estimated_minutes = round(estimated_wait / 60, 1)
        
        # 生成顯示文字
        if estimated_wait <= 0:
            wait_display = "立即處理"
        elif estimated_wait < 60:
            wait_display = f"約 {estimated_wait} 秒"
        elif estimated_wait < 3600:
            minutes = int(estimated_wait // 60)
            seconds = int(estimated_wait % 60)
            if seconds > 0:
                wait_display = f"約 {minutes} 分 {seconds} 秒"
            else:
                wait_display = f"約 {minutes} 分鐘"
        else:
            hours = int(estimated_wait // 3600)
            minutes = int((estimated_wait % 3600) // 60)
            wait_display = f"約 {hours} 小時 {minutes} 分鐘"
        
        # 判斷系統負載
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
        
        # 如果系統繁忙，建議使用較快的模型
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
        
    except Exception as e:
        # Redis 連接失敗時返回預設值
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
    
    使用 Director Engine 將模糊需求轉換為結構化的影片腳本，
    包含每個場景的視覺 prompt、旁白、音效等詳細指令。
    """
    # 1. 計算點數（腳本生成）
    cost = COST_TABLE.get(request.duration, 15)  # 預設 15 點
    
    # 初始化點數服務
    credit_service = CreditService(db)
    
    # 2. 構建品牌設定
    if request.brand:
        # 使用自訂品牌設定
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
        # 使用預設模板
        brand = DEFAULT_BRAND_TEMPLATES[request.brand_template].model_copy()
        brand.brand_name = "我的品牌"  # 可以之後讓用戶自訂
    else:
        # 使用預設品牌
        brand = BrandProfile(
            brand_name="我的品牌",
            industry="綜合",
            personality=BrandPersonality.FRIENDLY,
        )
    
    # 3. 構建角色設定（可選）
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
    
    # 4. 構建影片請求
    try:
        video_format = VideoFormat(request.format)
    except ValueError:
        video_format = VideoFormat.VERTICAL_9_16
    
    try:
        video_duration = VideoDuration(request.duration)
    except ValueError:
        # 根據傳入值選擇最接近的時長
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
    
    # 5. 先扣除點數（使用 CreditService 記錄交易）
    consume_result = credit_service.consume_direct(
        user_id=current_user.id,
        cost=cost,
        transaction_type=TransactionType.CONSUME_SHORT_VIDEO,
        description=f"腳本生成 - {request.topic[:30] if request.topic else '影片'}",
        reference_type="video_script",
        metadata={
            "duration": request.duration,
            "platform": request.platform,
            "topic": request.topic,
        }
    )
    
    if not consume_result.success:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=consume_result.error or f"點數不足！需要 {cost} 點"
        )
    
    # 6. 調用 Director Engine 生成腳本
    start_time = time.time()
    try:
        script = await director.generate_video_script(video_request, brand, avatar)
        generation_duration = int((time.time() - start_time) * 1000)
        
        # 記錄腳本生成歷史（使用 video_script 類型區分）
        history = GenerationHistory(
            user_id=current_user.id,
            generation_type="video_script",  # 腳本類型，與 short_video 區分
            status="completed",
            input_params={
                "topic": request.topic,
                "goal": request.goal,
                "platform": request.platform,
                "duration": request.duration,
                "format": request.format,
                "product_name": request.product_name,
                "key_message": request.key_message,
            },
            output_data={
                "project_id": script.project_id,
                "title": script.title,
                "scenes_count": len(script.scenes),
                "description": script.description,
            },
            credits_used=cost,
            generation_duration_ms=generation_duration,
        )
        db.add(history)
        db.commit()
        
    except Exception as e:
        # 記錄失敗歷史
        history = GenerationHistory(
            user_id=current_user.id,
            generation_type="short_video",
            status="failed",
            input_params={
                "topic": request.topic,
                "platform": request.platform,
                "duration": request.duration,
            },
            credits_used=cost,
            error_message=str(e),
        )
        db.add(history)
        db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"腳本生成失敗：{str(e)}"
        )
    
    # 7. 構建回應
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
    script: Dict[str, Any] = Field(..., description="腳本資料（來自 /generate）")
    voice_id: str = Field(default="zh-TW-HsiaoChenNeural", description="TTS 語音 ID")
    generate_thumbnails: bool = Field(default=True, description="是否生成縮圖")
    generate_audio: bool = Field(default=True, description="是否生成 TTS 語音")
    generate_preview_video: bool = Field(default=False, description="是否生成預覽影片")


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
    audio_base64: Optional[str] = None  # base64 編碼的音訊（供前端直接播放）
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
    """
    生成 Storyboard 預覽（Director Engine 2.0）
    
    低成本預覽模式：
    - 生成靜態分鏡圖（每場景約 2 點）
    - 生成 TTS 語音（每場景約 1 點）
    - 可選：生成快速預覽影片（約 5 點）
    
    用戶確認分鏡無誤後，才呼叫 /render 進行昂貴的影片渲染。
    
    成本對比：
    - Storyboard 預覽：約 5-15 點
    - 完整影片渲染：50-350 點
    """
    script = request.script
    scenes = script.get("scenes", [])
    
    if not scenes:
        raise HTTPException(
            status_code=400,
            detail="腳本中沒有場景"
        )
    
    # 計算成本
    cost = 0
    if request.generate_thumbnails:
        cost += len(scenes) * STORYBOARD_COST["preview"]
    if request.generate_audio:
        cost += len(scenes) * STORYBOARD_COST["tts"]
    if request.generate_preview_video:
        cost += STORYBOARD_COST["preview_video"]
    
    # 檢查並扣除點數
    credit_service = CreditService(db)
    consume_result = credit_service.consume_direct(
        user_id=current_user.id,
        cost=cost,
        transaction_type=TransactionType.CONSUME_SHORT_VIDEO,
        description=f"Storyboard 預覽 ({len(scenes)} 場景)",
        reference_type="storyboard_preview",
        metadata={
            "project_id": script.get("project_id"),
            "scenes_count": len(scenes),
            "type": "storyboard_preview",
        }
    )
    
    if not consume_result.success:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=consume_result.error or f"點數不足！需要 {cost} 點"
        )
    
    try:
        # 生成 Storyboard 預覽
        preview = await storyboard_service.generate_preview(
            script=script,
            voice_id=request.voice_id,
            generate_thumbnails=request.generate_thumbnails,
            generate_audio=request.generate_audio,
            generate_preview_video=request.generate_preview_video,
        )
        
        # 生成 SRT 字幕
        srt_subtitles = storyboard_service.generate_srt_subtitles(preview.scenes)
        
        # 轉換回應格式
        scenes_response = [
            StoryboardSceneResponse(
                scene_index=s.scene_index,
                title=s.title,
                description=s.description,
                visual_prompt=s.visual_prompt,
                narration=s.narration,
                duration_seconds=s.duration_seconds,
                thumbnail_base64=s.thumbnail_base64,
                audio_url=s.audio_url,
                audio_base64=s.audio_base64,  # base64 音訊供前端播放
                audio_duration=s.audio_duration,
                subtitle_text=s.subtitle_text,
                subtitle_start=s.subtitle_start,
                subtitle_end=s.subtitle_end,
            )
            for s in preview.scenes
        ]
        
        return StoryboardPreviewResponse(
            project_id=preview.project_id,
            title=preview.title,
            description=preview.description,
            format=preview.format,
            total_duration=preview.total_duration,
            scenes=scenes_response,
            preview_video_url=preview.preview_video_url,
            voice_id=preview.voice_id,
            primary_color=preview.primary_color,
            secondary_color=preview.secondary_color,
            preview_credits_used=cost,
            estimated_render_credits=preview.estimated_render_credits,
            srt_subtitles=srt_subtitles,
        )
        
    except Exception as e:
        # 預覽失敗，記錄錯誤
        print(f"[Storyboard] 預覽生成失敗: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"預覽生成失敗: {str(e)}"
        )


@router.get("/tts/voices", response_model=List[TTSVoiceInfo])
async def get_tts_voices(
    current_user: User = Depends(get_current_user)
):
    """
    獲取可用的 TTS 語音列表
    """
    tts_service = TTSService()
    voices = tts_service.get_available_voices()
    
    return [
        TTSVoiceInfo(
            voice_id=voice_id,
            name=info["name"],
            gender=info["gender"],
            style=info["style"],
        )
        for voice_id, info in voices.items()
    ]


class TTSPreviewRequest(BaseModel):
    """TTS 試聽請求"""
    voice_id: str = Field(..., description="語音 ID")
    text: str = Field(
        default="你好，歡迎使用 King Jam AI 智慧內容創作平台。這是語音試聽範例。",
        description="試聽文字",
        max_length=200
    )


@router.post("/tts/preview")
async def preview_tts_voice(
    request: TTSPreviewRequest,
    current_user: User = Depends(get_current_user)
):
    """
    TTS 語音試聽（免費，不扣點）
    
    用於品牌資產包設定時試聽語音效果
    """
    from fastapi.responses import StreamingResponse
    import io
    
    tts_service = TTSService()
    
    # 限制試聽文字長度
    text = request.text[:200] if len(request.text) > 200 else request.text
    
    # 根據語音 ID 判斷使用的語言，設定預設試聽文字
    preview_texts = {
        "zh-TW": "你好，歡迎使用 King Jam AI。這是繁體中文語音試聽。",
        "zh-CN": "你好，欢迎使用 King Jam AI。这是简体中文语音试听。",
        "zh-HK": "你好，歡迎使用 King Jam AI。呢個係粵語語音試聽。",
        "en-US": "Hello, welcome to King Jam AI. This is an English voice preview.",
        "en-GB": "Hello, welcome to King Jam AI. This is a British English voice preview.",
        "ja-JP": "こんにちは、King Jam AI へようこそ。日本語の音声プレビューです。",
        "ko-KR": "안녕하세요, King Jam AI에 오신 것을 환영합니다. 한국어 음성 미리듣기입니다.",
    }
    
    # 如果沒有提供文字，使用對應語言的預設文字
    if not text or text == "你好，歡迎使用 King Jam AI 智慧內容創作平台。這是語音試聽範例。":
        locale = request.voice_id.rsplit("-", 1)[0] if "-" in request.voice_id else "zh-TW"
        # 處理如 zh-TW-HsiaoChenNeural -> zh-TW
        if locale.count("-") >= 2:
            parts = locale.split("-")
            locale = f"{parts[0]}-{parts[1]}"
        text = preview_texts.get(locale, preview_texts["zh-TW"])
    
    try:
        result = await tts_service.generate_speech(
            text=text,
            voice_id=request.voice_id
        )
        
        # 讀取音頻檔案
        with open(result.audio_path, "rb") as f:
            audio_data = f.read()
        
        # 清理臨時檔案
        import os
        try:
            os.remove(result.audio_path)
            if result.subtitle_path and os.path.exists(result.subtitle_path):
                os.remove(result.subtitle_path)
        except:
            pass
        
        # 返回音頻流
        return StreamingResponse(
            io.BytesIO(audio_data),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": f"inline; filename=preview_{request.voice_id}.mp3",
                "Cache-Control": "no-cache",
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"語音生成失敗: {str(e)}"
    )


@router.get("/templates")
async def get_brand_templates():
    """
    取得預設品牌模板列表
    """
    templates = []
    for key, brand in DEFAULT_BRAND_TEMPLATES.items():
        templates.append({
            "id": key,
            "name": brand.brand_name,
            "industry": brand.industry,
            "personality": brand.personality.value,
            "visual_style": brand.visual_style,
            "primary_color": brand.primary_color,
            "secondary_color": brand.secondary_color,
        })
    return {"templates": templates}


@router.get("/pricing")
async def get_pricing():
    """
    取得影片生成價格（分級定價）
    """
    return {
        # 腳本生成費用
        "script_pricing": [
            {"duration": "15", "seconds": 15, "credits": 20, "description": "15秒腳本"},
            {"duration": "30", "seconds": 30, "credits": 30, "description": "30秒腳本"},
            {"duration": "60", "seconds": 60, "credits": 50, "description": "60秒腳本"},
        ],
        # 渲染費用（分品質）
        "render_pricing": {
            "standard": {
                "name": "標準",
                "description": "Imagen 圖片 + FFmpeg 合成",
                "features": ["AI 生成圖片", "背景音樂", "場景轉場", "自訂長度"],
                "duration": "自訂",
                "prices": [
                    {"duration": "15", "credits": 50},
                    {"duration": "30", "credits": 80},
                    {"duration": "60", "credits": 120},
                ]
            },
            "premium": {
                "name": "高級",
                "description": "Veo 3 Fast 快速生成",
                "features": ["AI 影片生成", "流暢動態", "原生音頻"],
                "duration": "固定 8 秒",
                "veo": True,
                "prices": [
                    {"duration": "8", "credits": 200},
                ]
            },
            "ultra": {
                "name": "頂級",
                "description": "Veo 3 最高品質",
                "features": ["頂級畫質", "原生音頻", "1080p", "電影級"],
                "duration": "固定 8 秒",
                "veo": True,
                "prices": [
                    {"duration": "8", "credits": 350},
                ]
            },
        },
        # 預覽費用
        "preview_cost": 10,
    }


@router.get("/download/{filename}")
async def download_video(filename: str):
    """
    下載生成的影片（本地檔案）
    """
    # 安全檢查：防止路徑遍歷攻擊
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="無效的檔案名稱")
    
    video_path = STATIC_VIDEO_DIR / filename
    
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="影片不存在或已過期")
    
    return FileResponse(
        path=str(video_path),
        media_type="video/mp4",
        filename=filename,
        headers={
            "Cache-Control": "public, max-age=3600",
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.get("/download-proxy")
async def download_video_proxy(url: str, filename: str = "kingjam-video.mp4"):
    """
    代理下載雲端影片（解決 CORS 問題）
    """
    import aiohttp
    from urllib.parse import urlparse
    from fastapi.responses import StreamingResponse
    
    # 安全檢查：只允許下載我們自己的雲端資源
    parsed = urlparse(url)
    allowed_domains = [
        "storage.googleapis.com",
        "storage.cloud.google.com",
        ".storage.googleapis.com",
        "localhost",
        "127.0.0.1",
    ]
    
    is_allowed = any(
        parsed.netloc == domain or parsed.netloc.endswith(domain)
        for domain in allowed_domains
    )
    
    if not is_allowed:
        raise HTTPException(status_code=400, detail="不允許下載此來源的檔案")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=120)) as response:
                if response.status != 200:
                    raise HTTPException(status_code=404, detail="無法獲取影片")
                
                content = await response.read()
                content_type = response.headers.get("Content-Type", "video/mp4")
                
                return StreamingResponse(
                    iter([content]),
                    media_type=content_type,
                    headers={
                        "Content-Disposition": f"attachment; filename={filename}",
                        "Content-Length": str(len(content)),
                        "Cache-Control": "no-cache",
                    }
                )
    except aiohttp.ClientError as e:
        raise HTTPException(status_code=500, detail=f"下載失敗: {str(e)}")


@router.get("/platforms")
async def get_platforms():
    """
    取得支援的平台列表
    """
    return {
        "platforms": [
            {"id": "tiktok", "name": "TikTok", "icon": "🎵", "format": "9:16", "max_duration": 60},
            {"id": "instagram_reels", "name": "Instagram Reels", "icon": "📸", "format": "9:16", "max_duration": 90},
            {"id": "youtube_shorts", "name": "YouTube Shorts", "icon": "▶️", "format": "9:16", "max_duration": 60},
            {"id": "xiaohongshu", "name": "小紅書", "icon": "📕", "format": "9:16", "max_duration": 60},
            {"id": "facebook_reels", "name": "Facebook Reels", "icon": "👍", "format": "9:16", "max_duration": 60},
        ]
    }


@router.get("/scene-types")
async def get_scene_types():
    """
    取得場景類型說明
    """
    return {
        "scene_types": [
            {"id": "hook", "name": "開場吸引", "description": "抓住觀眾注意力的開場", "typical_duration": "2-5秒"},
            {"id": "problem", "name": "問題描述", "description": "描述觀眾的痛點或需求", "typical_duration": "5-10秒"},
            {"id": "solution", "name": "解決方案", "description": "展示你的解決方案", "typical_duration": "10-15秒"},
            {"id": "demonstration", "name": "產品展示", "description": "展示產品功能或效果", "typical_duration": "10-20秒"},
            {"id": "testimonial", "name": "見證分享", "description": "客戶見證或使用心得", "typical_duration": "5-15秒"},
            {"id": "cta", "name": "行動呼籲", "description": "引導觀眾採取行動", "typical_duration": "3-5秒"},
        ]
    }


@router.get("/visual-styles")
async def get_visual_styles():
    """
    取得視覺風格選項
    """
    return {
        "visual_styles": [
            {
                "id": "cinematic",
                "name": "電影感",
                "description": "寬銀幕比例、淺景深、電影調色",
                "keywords": "cinematic, film grain, shallow depth of field, anamorphic",
                "preview_color": "#1a1a2e"
            },
            {
                "id": "minimal",
                "name": "極簡風",
                "description": "大量留白、乾淨線條、低飽和度",
                "keywords": "minimal, clean, white space, subtle shadows, muted colors",
                "preview_color": "#f5f5f5"
            },
            {
                "id": "vibrant",
                "name": "鮮豔活潑",
                "description": "高飽和度、對比強烈、充滿活力",
                "keywords": "vibrant, saturated, high contrast, colorful, energetic",
                "preview_color": "#ff6b6b"
            },
            {
                "id": "luxurious",
                "name": "奢華質感",
                "description": "金色光暈、深色調、高端材質",
                "keywords": "luxurious, golden, dark, premium materials, elegant",
                "preview_color": "#d4af37"
            },
            {
                "id": "documentary",
                "name": "紀錄片風格",
                "description": "自然光、手持攝影、真實感",
                "keywords": "documentary, natural light, handheld, authentic, raw",
                "preview_color": "#8b7355"
            },
            {
                "id": "neon",
                "name": "霓虹科技",
                "description": "霓虹燈光、賽博龐克、未來感",
                "keywords": "neon, cyberpunk, futuristic, glowing, tech",
                "preview_color": "#00fff5"
            },
            {
                "id": "warm_lifestyle",
                "name": "溫暖生活",
                "description": "暖色調、柔和光線、居家感",
                "keywords": "warm, cozy, golden hour, lifestyle, soft",
                "preview_color": "#ffb347"
            },
            {
                "id": "moody",
                "name": "情緒氛圍",
                "description": "低調光線、陰影對比、戲劇性",
                "keywords": "moody, dramatic, shadows, contrast, atmospheric",
                "preview_color": "#2c3e50"
            },
        ]
    }


@router.get("/music-styles")
async def get_music_styles():
    """
    取得音樂風格選項
    """
    return {
        "music_styles": [
            {"id": "upbeat", "name": "輕快活潑", "description": "適合產品展示、開箱", "bpm": "120-140", "icon": "🎵"},
            {"id": "emotional", "name": "感性抒情", "description": "適合品牌故事、見證", "bpm": "60-80", "icon": "💕"},
            {"id": "energetic", "name": "高能量", "description": "適合運動、促銷", "bpm": "140-160", "icon": "⚡"},
            {"id": "calm", "name": "平靜舒緩", "description": "適合美食、生活風格", "bpm": "70-90", "icon": "🌊"},
            {"id": "epic", "name": "史詩磅礴", "description": "適合品牌形象、里程碑", "bpm": "80-100", "icon": "🎬"},
            {"id": "minimal", "name": "極簡電子", "description": "適合科技、簡約風格", "bpm": "100-120", "icon": "🔲"},
            {"id": "inspirational", "name": "勵志激勵", "description": "適合教育、成長", "bpm": "90-110", "icon": "🌟"},
            {"id": "trendy", "name": "流行趨勢", "description": "適合時尚、年輕族群", "bpm": "110-130", "icon": "🔥"},
        ]
    }


@router.get("/camera-movements")
async def get_camera_movements():
    """
    取得鏡頭運動選項
    """
    return {
        "camera_movements": [
            {"id": "dolly_in", "name": "推近", "description": "攝影機向前移動，增加緊張感", "effect": "聚焦、強調"},
            {"id": "dolly_out", "name": "拉遠", "description": "攝影機向後移動，揭示全景", "effect": "揭示、結尾"},
            {"id": "tracking", "name": "跟拍", "description": "攝影機跟隨主體移動", "effect": "動態、跟隨"},
            {"id": "crane_up", "name": "升降上", "description": "攝影機向上移動", "effect": "壯觀、揭示"},
            {"id": "crane_down", "name": "升降下", "description": "攝影機向下移動", "effect": "降落、聚焦"},
            {"id": "orbit", "name": "環繞", "description": "攝影機繞著主體旋轉", "effect": "展示、360度"},
            {"id": "static", "name": "固定", "description": "攝影機不移動", "effect": "穩定、專注"},
            {"id": "handheld", "name": "手持", "description": "輕微晃動的手持效果", "effect": "真實、緊張"},
            {"id": "steadicam", "name": "穩定器", "description": "平滑的移動跟拍", "effect": "流暢、專業"},
            {"id": "zoom_in", "name": "變焦推近", "description": "鏡頭變焦拉近", "effect": "戲劇性、強調"},
            {"id": "whip_pan", "name": "快速搖鏡", "description": "快速水平搖動", "effect": "轉場、能量"},
        ]
    }


@router.get("/subtitle-styles")
async def get_subtitle_styles():
    """
    取得字幕樣式選項
    """
    return {
        "subtitle_styles": [
            {
                "id": "none",
                "name": "無字幕",
                "description": "純影像，無文字覆蓋",
                "preview": "🚫"
            },
            {
                "id": "minimal",
                "name": "極簡",
                "description": "白色細字，無背景",
                "preview": "Aa",
                "css": "color: white; font-weight: 300; text-shadow: 1px 1px 2px black;"
            },
            {
                "id": "bold_center",
                "name": "粗體置中",
                "description": "大字置中，醒目易讀",
                "preview": "AA",
                "css": "color: white; font-weight: 900; font-size: 1.5em; text-align: center;"
            },
            {
                "id": "boxed",
                "name": "方框底",
                "description": "半透明黑底，專業感",
                "preview": "📦",
                "css": "color: white; background: rgba(0,0,0,0.7); padding: 8px 16px;"
            },
            {
                "id": "gradient",
                "name": "漸層背景",
                "description": "彩色漸層背景，吸睛",
                "preview": "🌈",
                "css": "color: white; background: linear-gradient(90deg, #ff6b6b, #feca57);"
            },
            {
                "id": "outline",
                "name": "描邊字",
                "description": "粗邊框描邊，視覺衝擊",
                "preview": "🔲",
                "css": "color: white; -webkit-text-stroke: 2px black; font-weight: 900;"
            },
            {
                "id": "typewriter",
                "name": "打字機",
                "description": "逐字出現動畫",
                "preview": "⌨️",
                "animation": "typewriter"
            },
            {
                "id": "bounce",
                "name": "彈跳",
                "description": "字幕彈跳進入",
                "preview": "⬆️",
                "animation": "bounce"
            },
        ]
    }


@router.get("/quick-templates")
async def get_quick_templates():
    """
    取得快速模板 - 預設的影片結構
    """
    return {
        "templates": [
            {
                "id": "product_launch",
                "name": "🚀 產品發布",
                "description": "新品上市的標準結構",
                "duration": "30",
                "scenes": [
                    {"type": "hook", "duration": 3, "tip": "震撼開場，製造懸念"},
                    {"type": "problem", "duration": 5, "tip": "展示痛點問題"},
                    {"type": "solution", "duration": 8, "tip": "產品作為解決方案"},
                    {"type": "demonstration", "duration": 9, "tip": "功能展示"},
                    {"type": "cta", "duration": 5, "tip": "立即購買"},
                ],
                "music": "upbeat",
                "style": "cinematic"
            },
            {
                "id": "brand_story",
                "name": "📖 品牌故事",
                "description": "情感連結的品牌敘事",
                "duration": "60",
                "scenes": [
                    {"type": "hook", "duration": 5, "tip": "引人入勝的開場"},
                    {"type": "problem", "duration": 10, "tip": "創辦初衷/市場痛點"},
                    {"type": "solution", "duration": 15, "tip": "品牌理念和願景"},
                    {"type": "demonstration", "duration": 15, "tip": "產品/服務展示"},
                    {"type": "testimonial", "duration": 10, "tip": "客戶見證"},
                    {"type": "cta", "duration": 5, "tip": "加入我們"},
                ],
                "music": "emotional",
                "style": "documentary"
            },
            {
                "id": "flash_sale",
                "name": "⚡ 限時促銷",
                "description": "緊迫感的促銷廣告",
                "duration": "15",
                "scenes": [
                    {"type": "hook", "duration": 2, "tip": "限時！緊急！"},
                    {"type": "demonstration", "duration": 6, "tip": "快速展示產品"},
                    {"type": "cta", "duration": 7, "tip": "倒數計時 + 立即購買"},
                ],
                "music": "energetic",
                "style": "vibrant"
            },
            {
                "id": "tutorial",
                "name": "📚 教學指南",
                "description": "步驟式教學內容",
                "duration": "60",
                "scenes": [
                    {"type": "hook", "duration": 5, "tip": "今天教你..."},
                    {"type": "demonstration", "duration": 15, "tip": "步驟 1"},
                    {"type": "demonstration", "duration": 15, "tip": "步驟 2"},
                    {"type": "demonstration", "duration": 15, "tip": "步驟 3"},
                    {"type": "cta", "duration": 10, "tip": "追蹤獲取更多"},
                ],
                "music": "calm",
                "style": "minimal"
            },
            {
                "id": "lifestyle",
                "name": "🌿 生活風格",
                "description": "氛圍感的生活方式內容",
                "duration": "30",
                "scenes": [
                    {"type": "hook", "duration": 4, "tip": "美好的一天"},
                    {"type": "demonstration", "duration": 10, "tip": "日常場景"},
                    {"type": "demonstration", "duration": 10, "tip": "使用產品的瞬間"},
                    {"type": "cta", "duration": 6, "tip": "開啟你的美好生活"},
                ],
                "music": "calm",
                "style": "warm_lifestyle"
            },
            {
                "id": "testimonial",
                "name": "⭐ 客戶見證",
                "description": "真實用戶的推薦",
                "duration": "30",
                "scenes": [
                    {"type": "hook", "duration": 3, "tip": "Before 痛點"},
                    {"type": "testimonial", "duration": 12, "tip": "客戶故事"},
                    {"type": "demonstration", "duration": 10, "tip": "After 改變"},
                    {"type": "cta", "duration": 5, "tip": "你也可以"},
                ],
                "music": "emotional",
                "style": "documentary"
            },
        ]
    }


# ============================================================
# 影片生成 API
# ============================================================

from app.services.video_generator import video_generator, VideoResult

# 影片生成的額外點數消耗（舊版相容，使用標準品質）
VIDEO_RENDER_COST = RENDER_COST["standard"]


class SceneImageInput(BaseModel):
    """場景圖片輸入"""
    scene_index: int
    image_url: Optional[str] = None  # 上傳後的 URL
    image_base64: Optional[str] = None  # Base64 圖片資料


class RenderVideoRequest(BaseModel):
    """影片渲染請求"""
    project_id: str
    script: Dict[str, Any]  # VideoScriptResponse 的內容
    quality: str = "standard"  # standard, premium, ultra
    custom_images: Optional[List[SceneImageInput]] = None  # 用戶自訂場景圖片
    custom_music_base64: Optional[str] = None  # 用戶自訂音樂（Base64 編碼）
    custom_music_name: Optional[str] = None  # 自訂音樂檔名


class RenderVideoResponse(BaseModel):
    """影片渲染回應"""
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration: Optional[float] = 0
    format: Optional[str] = None
    file_size: Optional[int] = 0
    credits_used: Optional[int] = 0
    scene_images: Optional[List[str]] = None  # 場景圖片列表
    task_id: Optional[str] = None  # 非同步任務 ID


class RenderProgressResponse(BaseModel):
    """渲染進度回應"""
    stage: str
    progress: float
    message: str
    current_scene: Optional[int] = None
    total_scenes: Optional[int] = None


@router.post("/render", response_model=RenderVideoResponse)
async def render_video(
    request: RenderVideoRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    渲染影片
    
    根據已生成的腳本，實際渲染產出影片檔案。
    
    品質等級：
    - standard: Imagen 圖片 + FFmpeg 合成（較便宜）
    - premium: Veo 3 Fast（中等價格，較快）
    - ultra: Veo 3（最高品質，含原生音頻）
    
    OOM 預防：
    - 用戶級別並發限制
    - 全局佇列長度限制
    """
    # OOM 預防：檢查速率限制
    can_submit, reason = video_rate_limiter.can_submit_task(current_user.id)
    if not can_submit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=reason
        )
    
    script = request.script
    duration = str(script.get("total_duration", 30))
    quality = request.quality if request.quality in RENDER_COST else "standard"
    
    # 1. 計算點數
    cost_table = RENDER_COST.get(quality, RENDER_COST["standard"])
    # Kling/Veo 模式用固定價格，標準模式按時長
    if quality in ["premium", "ultra", "kling", "kling-10s", "kling-pro", "kling-pro-10s"]:
        cost = cost_table.get("default", 50)
    else:
        cost = cost_table.get(duration, cost_table.get("30", 80))
    
    # 初始化點數服務
    credit_service = CreditService(db)
    
    # 2. 處理用戶自訂圖片
    custom_images_dict = None
    if request.custom_images:
        custom_images_dict = {}
        for img in request.custom_images:
            if img.image_base64:
                custom_images_dict[img.scene_index] = img.image_base64
            elif img.image_url:
                # 如果只有 URL，需要讀取並轉為 base64
                custom_images_dict[img.scene_index] = img.image_url
    
    # 3. 先扣除點數（使用 CreditService 記錄交易）
    if quality in ["premium", "ultra"]:
        tx_type = TransactionType.CONSUME_VEO_VIDEO
    elif quality.startswith("kling"):
        tx_type = TransactionType.CONSUME_SHORT_VIDEO  # Kling 視為短影片
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
    
    # 4. 生成影片（傳入品質設定和自訂圖片）
    start_time = time.time()
    task_id = f"render_{current_user.id}_{int(start_time)}"
    
    # OOM 預防：註冊任務
    video_rate_limiter.register_task(current_user.id, task_id)
    
    # 處理自訂音樂
    custom_music_base64 = None
    custom_music_name = None
    
    # 優先從 request 獲取，其次從 script 獲取
    if request.custom_music_base64:
        custom_music_base64 = request.custom_music_base64
        custom_music_name = request.custom_music_name
    elif script.get("custom_music_base64"):
        custom_music_base64 = script.get("custom_music_base64")
        custom_music_name = script.get("custom_music_name")
    
    if custom_music_base64:
        print(f"[video_render] 使用自訂音樂: {custom_music_name}")
    
    try:
        from app.tasks.video_tasks import render_video_v2_task
        
        # 建立初始歷史記錄 (status="pending")
        topic = script.get("topic") or script.get("input_topic") or script.get("title", "")
        script_credits = script.get("credits_used", 0)
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
                "scenes_count": len(script.get("scenes", [])),
                "script_credits": script_credits,
                "render_credits": cost,
            },
            credits_used=total_credits,
        )
        db.add(history)
        db.commit()
        db.refresh(history)
        
        # 提交非同步任務
        # 確保 custom_images 使用字串 Key，避免 JSON 序列化問題
        task_custom_images = None
        if custom_images_dict:
            task_custom_images = {str(k): v for k, v in custom_images_dict.items()}
            
        task = render_video_v2_task.delay(
            user_id=current_user.id,
            script=script,
            quality=quality,
            custom_images=task_custom_images,
            custom_music_base64=custom_music_base64,
            custom_music_name=custom_music_name,
            history_id=history.id
        )
        
        return RenderVideoResponse(
            task_id=task.id,
            duration=float(duration),
            format=script.get("format", "9:16"),
            credits_used=total_credits
        )
        
    except Exception as e:
        # 記錄失敗歷史
        script_credits = script.get("credits_used", 0)
        total_credits = script_credits + cost
        
        history = GenerationHistory(
            user_id=current_user.id,
            generation_type="short_video",
            status="failed",
            input_params={
                "project_id": script.get("project_id"),
                "quality": quality,
                "duration": duration,
                "script_credits": script_credits,
                "render_credits": cost,
            },
            credits_used=total_credits,  # 記錄總消耗
            error_message=str(e),
        )
        db.add(history)
        db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"影片生成失敗：{str(e)}"
        )
    finally:
        # OOM 預防：任務完成，釋放配額
        video_rate_limiter.complete_task(current_user.id, task_id)


@router.post("/render-preview")
async def render_preview(
    request: RenderVideoRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    生成影片預覽（僅生成第一個場景的圖片）
    消耗較少點數，用於預覽效果
    """
    script = request.script
    scenes = script.get("scenes", [])
    
    if not scenes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="腳本中沒有場景"
        )
    
    # 只需要 10 點
    cost = 10
    
    # 初始化點數服務並扣除點數
    credit_service = CreditService(db)
    consume_result = credit_service.consume_direct(
        user_id=current_user.id,
        cost=cost,
        transaction_type=TransactionType.CONSUME_SHORT_VIDEO,
        description="影片預覽生成",
        reference_type="video_preview",
        metadata={
            "project_id": script.get("project_id"),
        }
    )
    
    if not consume_result.success:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=consume_result.error or f"點數不足！預覽需要 {cost} 點"
        )
    
    # 只生成第一個場景的圖片
    try:
        first_scene = scenes[0]
        image_base64 = await video_generator._generate_scene_image(
            first_scene.get("visual_prompt", ""),
            script.get("color_palette", ["#6366F1", "#8B5CF6"]),
            script.get("format", "9:16")
        )
        
        return {
            "preview_image": image_base64,
            "scene_number": 1,
            "credits_used": cost
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"預覽生成失敗：{str(e)}"
        )


@router.get("/proxy-music")
async def proxy_music(
    url: str,
    current_user: User = Depends(get_current_user)
):
    """
    音樂代理端點（繞過 CORS 限制）
    
    允許前端播放外部音樂 CDN 的音頻檔案
    """
    from fastapi.responses import StreamingResponse
    import aiohttp
    
    # 只允許特定的白名單域名
    allowed_domains = [
        "cdn.pixabay.com",
        "pixabay.com",
        "audio.pixabay.com",
    ]
    
    # 驗證 URL
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        if parsed.netloc not in allowed_domains:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="不允許的音樂來源"
            )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="無效的 URL"
        )
    
    try:
        async with aiohttp.ClientSession() as session:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://pixabay.com/",
                "Accept": "audio/mpeg,audio/*;q=0.9,*/*;q=0.8",
            }
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as response:
                if response.status != 200:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"無法獲取音樂檔案：HTTP {response.status}"
                    )
                
                content = await response.read()
                content_type = response.headers.get("Content-Type", "audio/mpeg")
                
                return StreamingResponse(
                    iter([content]),
                    media_type=content_type,
                    headers={
                        "Content-Disposition": "inline",
                        "Cache-Control": "public, max-age=3600",
                    }
                )
    except aiohttp.ClientError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"音樂下載失敗：{str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"代理錯誤：{str(e)}"
        )


class MusicPreviewRequest(BaseModel):
    """音樂預覽請求"""
    style: str = Field(default="upbeat", description="音樂風格")


@router.post("/music/preview")
async def preview_music(
    request: MusicPreviewRequest,
    current_user: User = Depends(get_current_user)
):
    """
    音樂風格預覽（免費，不扣點）
    
    生成一段 10 秒的背景音樂預覽
    """
    from fastapi.responses import StreamingResponse
    import io
    
    try:
        # 生成預覽音樂（10秒）
        music_path = await video_generator._generate_background_music(
            request.style,
            10.0,  # 10 秒預覽
            f"preview_{current_user.id}"
        )
        
        if not music_path or not os.path.exists(music_path):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="音樂生成失敗"
            )
        
        # 讀取音樂檔案
        with open(music_path, 'rb') as f:
            audio_data = f.read()
        
        # 清理暫存檔案
        try:
            os.remove(music_path)
        except:
            pass
        
        return StreamingResponse(
            io.BytesIO(audio_data),
            media_type="audio/wav",
            headers={
                "Content-Disposition": "inline",
                "Cache-Control": "public, max-age=300",
            }
        )
        
    except Exception as e:
        print(f"[MusicPreview] 錯誤: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"音樂預覽生成失敗：{str(e)}"
        )
