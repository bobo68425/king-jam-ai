"""
短影音生成 API
===============
使用 Director Engine 生成影片腳本和內容
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.routers.auth import get_current_user
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

router = APIRouter(prefix="/video", tags=["Video Generation"])

# 資費設定 - 腳本生成（AI 導演）
SCRIPT_COST = {
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

# Director Engine 實例
director = DirectorEngine()


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
    topic: str = Field(..., min_length=1, max_length=200, description="影片主題")
    goal: str = Field(default="awareness", description="目標：awareness/engagement/conversion")
    platform: str = Field(default="tiktok", description="目標平台")
    duration: str = Field(default="30", description="影片長度：15/30/60")
    format: str = Field(default="9:16", description="影片格式")
    
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
# API Endpoints
# ============================================================

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
    # 1. 計算並檢查點數
    cost = COST_TABLE.get(request.duration, 50)
    if current_user.credits < cost:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"點數不足！需要 {cost} 點，目前餘額 {current_user.credits} 點"
        )
    
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
        video_duration = VideoDuration.MEDIUM_30
    
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
    
    # 5. 調用 Director Engine 生成腳本
    try:
        script = await director.generate_video_script(video_request, brand, avatar)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"腳本生成失敗：{str(e)}"
        )
    
    # 6. 扣除點數
    current_user.credits -= cost
    db.commit()
    
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


# ============================================================
# 影片生成 API
# ============================================================

from app.services.video_generator import video_generator, VideoResult

# 影片生成的額外點數消耗（舊版相容，使用標準品質）
VIDEO_RENDER_COST = RENDER_COST["standard"]


class RenderVideoRequest(BaseModel):
    """影片渲染請求"""
    project_id: str
    script: Dict[str, Any]  # VideoScriptResponse 的內容
    quality: str = "standard"  # standard, premium, ultra


class RenderVideoResponse(BaseModel):
    """影片渲染回應"""
    video_url: str
    thumbnail_url: Optional[str] = None
    duration: float
    format: str
    file_size: int
    credits_used: int
    scene_images: Optional[List[str]] = None  # 場景圖片列表


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
    """
    script = request.script
    duration = str(script.get("total_duration", 30))
    quality = request.quality if request.quality in RENDER_COST else "standard"
    
    # 1. 計算並檢查點數
    cost_table = RENDER_COST.get(quality, RENDER_COST["standard"])
    # Veo 模式用固定價格，標準模式按時長
    if quality in ["premium", "ultra"]:
        cost = cost_table.get("default", 200)
    else:
        cost = cost_table.get(duration, cost_table.get("30", 80))
    
    if current_user.credits < cost:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"點數不足！{quality} 品質渲染需要 {cost} 點，目前餘額 {current_user.credits} 點"
        )
    
    # 2. 生成影片（傳入品質設定）
    try:
        result = await video_generator.generate_video(script, quality=quality)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"影片生成失敗：{str(e)}"
        )
    
    # 3. 扣除點數
    current_user.credits -= cost
    db.commit()
    
    return RenderVideoResponse(
        video_url=result.video_url,
        thumbnail_url=result.thumbnail_url,
        duration=result.duration,
        format=result.format,
        file_size=result.file_size,
        credits_used=cost,
        scene_images=result.scene_images
    )


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
    if current_user.credits < cost:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"點數不足！預覽需要 {cost} 點"
        )
    
    # 只生成第一個場景的圖片
    try:
        first_scene = scenes[0]
        image_base64 = await video_generator._generate_scene_image(
            first_scene.get("visual_prompt", ""),
            script.get("color_palette", ["#6366F1", "#8B5CF6"]),
            script.get("format", "9:16")
        )
        
        # 扣除點數
        current_user.credits -= cost
        db.commit()
        
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
