"""
品牌資產包 (Brand Kit) API
===========================

功能：
- 品牌包 CRUD
- 資產上傳（Logo、參考圖）
- 品牌風格應用

使用場景：
- 社群圖文生成時自動套用品牌色
- 影片生成時使用品牌 Logo 和配色
- ControlNet 風格遷移
"""

import os
import uuid
import base64
from datetime import datetime
from typing import Optional, List, Dict, Any
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.database import get_db
from app.models import User, BrandKit, BrandKitAsset
from app.routers.auth import get_current_user

router = APIRouter(prefix="/brand-kit", tags=["Brand Kit"])

# 靜態檔案目錄 - 支援 Docker 和本地開發
if os.path.exists("/app/static"):
    STATIC_BASE = Path("/app/static")
else:
    STATIC_BASE = Path(__file__).parent.parent.parent / "static"

UPLOAD_DIR = STATIC_BASE / "uploads" / "brand_kits"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# 允許的檔案類型
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".svg", ".webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


# ============================================================
# Request/Response Models
# ============================================================

class ColorPalette(BaseModel):
    """色彩調色盤"""
    primary: str = Field(default="#6366F1", description="主色")
    secondary: str = Field(default="#8B5CF6", description="副色")
    accent: Optional[str] = Field(default=None, description="強調色")
    background: str = Field(default="#FFFFFF", description="背景色")
    text: str = Field(default="#1F2937", description="文字色")
    palette: List[str] = Field(default=[], description="完整調色盤")


class FontSettings(BaseModel):
    """字型設定"""
    heading: str = Field(default="Noto Sans TC", description="標題字型")
    body: str = Field(default="Noto Sans TC", description="內文字型")
    style: str = Field(default="modern", description="字型風格")


class VoiceSettings(BaseModel):
    """品牌聲音設定"""
    voice_style: str = Field(default="friendly", description="品牌聲音風格")
    tts_voice: str = Field(default="zh-TW-HsiaoChenNeural", description="TTS 語音")


class BrandKitCreate(BaseModel):
    """創建品牌包請求"""
    name: str = Field(..., min_length=1, max_length=100, description="品牌名稱")
    description: Optional[str] = None
    
    # 色彩
    colors: ColorPalette = Field(default_factory=ColorPalette)
    
    # 字型
    fonts: FontSettings = Field(default_factory=FontSettings)
    
    # 視覺風格
    visual_style: str = Field(default="modern", description="視覺風格")
    image_style: str = Field(default="photography", description="圖片風格")
    
    # 品牌聲音
    voice: VoiceSettings = Field(default_factory=VoiceSettings)
    
    # 品牌訊息
    tagline: Optional[str] = Field(default=None, max_length=200)
    key_messages: List[str] = Field(default=[])
    tone_of_voice: List[str] = Field(default=[])
    
    # 目標受眾
    industry: Optional[str] = None
    target_audience: Dict[str, Any] = Field(default={})
    
    # 設為預設
    is_default: bool = False
    
    # IP 角色設定
    character_personality: Optional[str] = Field(default=None, description="角色性格特徵")
    character_age_group: Optional[str] = Field(default=None, description="角色年齡組")
    character_traits: List[str] = Field(default=[], description="角色額外特徵標籤")


class BrandKitUpdate(BaseModel):
    """更新品牌包請求"""
    name: Optional[str] = None
    description: Optional[str] = None
    colors: Optional[ColorPalette] = None
    fonts: Optional[FontSettings] = None
    visual_style: Optional[str] = None
    image_style: Optional[str] = None
    voice: Optional[VoiceSettings] = None
    tagline: Optional[str] = None
    key_messages: Optional[List[str]] = None
    tone_of_voice: Optional[List[str]] = None
    industry: Optional[str] = None
    target_audience: Optional[Dict[str, Any]] = None
    is_default: Optional[bool] = None
    # IP 角色設定
    character_personality: Optional[str] = None
    character_age_group: Optional[str] = None
    character_traits: Optional[List[str]] = None


class BrandKitAssetResponse(BaseModel):
    """品牌資產回應"""
    id: int
    asset_type: str
    filename: str
    file_url: str
    file_size: Optional[int]
    width: Optional[int]
    height: Optional[int]
    created_at: datetime
    
    class Config:
        from_attributes = True


class BrandKitResponse(BaseModel):
    """品牌包回應"""
    id: int
    name: str
    description: Optional[str]
    
    # 色彩
    primary_color: str
    secondary_color: str
    accent_color: Optional[str]
    background_color: str
    text_color: str
    color_palette: List[str]
    
    # Logo
    logo_url: Optional[str]
    logo_light_url: Optional[str]
    logo_dark_url: Optional[str]
    logo_icon_url: Optional[str]
    
    # 字型
    heading_font: str
    body_font: str
    font_style: str
    
    # 風格
    visual_style: str
    image_style: str
    
    # 聲音
    brand_voice: str
    preferred_tts_voice: str
    
    # 訊息
    tagline: Optional[str]
    key_messages: List[str]
    tone_of_voice: List[str]
    
    # 受眾
    industry: Optional[str]
    target_audience: Dict[str, Any]
    
    # 狀態
    is_active: bool
    is_default: bool
    
    # IP 角色設定
    character_personality: Optional[str] = None
    character_age_group: Optional[str] = None
    character_traits: List[str] = []
    
    # 資產
    assets: List[BrandKitAssetResponse] = []
    reference_images: List[Dict[str, Any]] = []
    
    # 時間
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class BrandKitListResponse(BaseModel):
    """品牌包列表回應"""
    brand_kits: List[BrandKitResponse]
    total: int


# ============================================================
# API 端點
# ============================================================

@router.get("", response_model=BrandKitListResponse)
async def list_brand_kits(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    取得用戶的所有品牌包
    """
    brand_kits = db.query(BrandKit).filter(
        BrandKit.user_id == current_user.id,
        BrandKit.is_active == True
    ).order_by(BrandKit.is_default.desc(), BrandKit.created_at.desc()).all()
    
    return BrandKitListResponse(
        brand_kits=[_to_response(bk) for bk in brand_kits],
        total=len(brand_kits)
    )


@router.get("/default", response_model=Optional[BrandKitResponse])
async def get_default_brand_kit(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    取得預設品牌包
    """
    brand_kit = db.query(BrandKit).filter(
        BrandKit.user_id == current_user.id,
        BrandKit.is_active == True,
        BrandKit.is_default == True
    ).first()
    
    if not brand_kit:
        return None
    
    return _to_response(brand_kit)


@router.get("/{brand_kit_id}", response_model=BrandKitResponse)
async def get_brand_kit(
    brand_kit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    取得單一品牌包
    """
    brand_kit = db.query(BrandKit).filter(
        BrandKit.id == brand_kit_id,
        BrandKit.user_id == current_user.id
    ).first()
    
    if not brand_kit:
        raise HTTPException(status_code=404, detail="品牌包不存在")
    
    return _to_response(brand_kit)


@router.post("", response_model=BrandKitResponse)
async def create_brand_kit(
    request: BrandKitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    創建品牌包
    """
    # 如果設為預設，先取消其他預設
    if request.is_default:
        db.query(BrandKit).filter(
            BrandKit.user_id == current_user.id,
            BrandKit.is_default == True
        ).update({"is_default": False})
    
    brand_kit = BrandKit(
        user_id=current_user.id,
        name=request.name,
        description=request.description,
        
        # 色彩
        primary_color=request.colors.primary,
        secondary_color=request.colors.secondary,
        accent_color=request.colors.accent,
        background_color=request.colors.background,
        text_color=request.colors.text,
        color_palette=request.colors.palette,
        
        # 字型
        heading_font=request.fonts.heading,
        body_font=request.fonts.body,
        font_style=request.fonts.style,
        
        # 風格
        visual_style=request.visual_style,
        image_style=request.image_style,
        
        # 聲音
        brand_voice=request.voice.voice_style,
        preferred_tts_voice=request.voice.tts_voice,
        
        # 訊息
        tagline=request.tagline,
        key_messages=request.key_messages,
        tone_of_voice=request.tone_of_voice,
        
        # 受眾
        industry=request.industry,
        target_audience=request.target_audience,
        
        is_default=request.is_default,
        
        # IP 角色設定
        character_personality=request.character_personality,
        character_age_group=request.character_age_group,
        character_traits=request.character_traits,
    )
    
    db.add(brand_kit)
    db.commit()
    db.refresh(brand_kit)
    
    return _to_response(brand_kit)


@router.put("/{brand_kit_id}", response_model=BrandKitResponse)
async def update_brand_kit(
    brand_kit_id: int,
    request: BrandKitUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    更新品牌包
    """
    brand_kit = db.query(BrandKit).filter(
        BrandKit.id == brand_kit_id,
        BrandKit.user_id == current_user.id
    ).first()
    
    if not brand_kit:
        raise HTTPException(status_code=404, detail="品牌包不存在")
    
    # 更新欄位
    if request.name is not None:
        brand_kit.name = request.name
    if request.description is not None:
        brand_kit.description = request.description
    
    if request.colors is not None:
        brand_kit.primary_color = request.colors.primary
        brand_kit.secondary_color = request.colors.secondary
        brand_kit.accent_color = request.colors.accent
        brand_kit.background_color = request.colors.background
        brand_kit.text_color = request.colors.text
        brand_kit.color_palette = request.colors.palette
    
    if request.fonts is not None:
        brand_kit.heading_font = request.fonts.heading
        brand_kit.body_font = request.fonts.body
        brand_kit.font_style = request.fonts.style
    
    if request.visual_style is not None:
        brand_kit.visual_style = request.visual_style
    if request.image_style is not None:
        brand_kit.image_style = request.image_style
    
    if request.voice is not None:
        brand_kit.brand_voice = request.voice.voice_style
        brand_kit.preferred_tts_voice = request.voice.tts_voice
    
    if request.tagline is not None:
        brand_kit.tagline = request.tagline
    if request.key_messages is not None:
        brand_kit.key_messages = request.key_messages
    if request.tone_of_voice is not None:
        brand_kit.tone_of_voice = request.tone_of_voice
    
    if request.industry is not None:
        brand_kit.industry = request.industry
    if request.target_audience is not None:
        brand_kit.target_audience = request.target_audience
    
    if request.is_default is not None and request.is_default:
        # 取消其他預設
        db.query(BrandKit).filter(
            BrandKit.user_id == current_user.id,
            BrandKit.id != brand_kit_id,
            BrandKit.is_default == True
        ).update({"is_default": False})
        brand_kit.is_default = True
    
    # IP 角色設定
    if request.character_personality is not None:
        brand_kit.character_personality = request.character_personality
    if request.character_age_group is not None:
        brand_kit.character_age_group = request.character_age_group
    if request.character_traits is not None:
        brand_kit.character_traits = request.character_traits
    
    db.commit()
    db.refresh(brand_kit)
    
    return _to_response(brand_kit)


@router.delete("/{brand_kit_id}")
async def delete_brand_kit(
    brand_kit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    刪除品牌包（軟刪除）
    """
    brand_kit = db.query(BrandKit).filter(
        BrandKit.id == brand_kit_id,
        BrandKit.user_id == current_user.id
    ).first()
    
    if not brand_kit:
        raise HTTPException(status_code=404, detail="品牌包不存在")
    
    brand_kit.is_active = False
    db.commit()
    
    return {"success": True, "message": "品牌包已刪除"}


@router.post("/{brand_kit_id}/assets")
async def upload_brand_asset(
    brand_kit_id: int,
    asset_type: str = Form(..., description="資產類型: logo, logo_light, logo_dark, logo_icon, reference"),
    file: UploadFile = File(...),
    metadata: Optional[str] = Form(default=None, description="額外資訊 (JSON)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    上傳品牌資產（Logo、參考圖）
    """
    # 驗證品牌包
    brand_kit = db.query(BrandKit).filter(
        BrandKit.id == brand_kit_id,
        BrandKit.user_id == current_user.id
    ).first()
    
    if not brand_kit:
        raise HTTPException(status_code=404, detail="品牌包不存在")
    
    # 驗證資產類型
    valid_types = ["logo", "logo_light", "logo_dark", "logo_icon", "reference", "pattern"]
    if asset_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"無效的資產類型，允許: {', '.join(valid_types)}")
    
    # 驗證檔案
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"不支援的檔案格式，允許: {', '.join(ALLOWED_EXTENSIONS)}")
    
    # 讀取檔案
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"檔案過大，最大 {MAX_FILE_SIZE // 1024 // 1024}MB")
    
    # 生成檔名
    filename = f"{uuid.uuid4()}{ext}"
    user_dir = UPLOAD_DIR / str(current_user.id)
    user_dir.mkdir(exist_ok=True)
    file_path = user_dir / filename
    
    # 儲存檔案
    with open(file_path, "wb") as f:
        f.write(content)
    
    # 獲取圖片尺寸
    width, height = None, None
    try:
        from PIL import Image
        with Image.open(file_path) as img:
            width, height = img.size
    except:
        pass
    
    # 解析 metadata
    asset_metadata = {}
    if metadata:
        try:
            import json
            asset_metadata = json.loads(metadata)
        except:
            pass
    
    # 建立資產記錄
    file_url = f"/upload/brand_kits/{current_user.id}/{filename}"
    
    asset = BrandKitAsset(
        brand_kit_id=brand_kit_id,
        asset_type=asset_type,
        filename=file.filename,
        file_url=file_url,
        file_size=len(content),
        mime_type=file.content_type,
        width=width,
        height=height,
        extra_data=asset_metadata,
    )
    db.add(asset)
    
    # 更新品牌包的 Logo URL
    if asset_type == "logo":
        brand_kit.logo_url = file_url
    elif asset_type == "logo_light":
        brand_kit.logo_light_url = file_url
    elif asset_type == "logo_dark":
        brand_kit.logo_dark_url = file_url
    elif asset_type == "logo_icon":
        brand_kit.logo_icon_url = file_url
    elif asset_type == "reference":
        # 添加到參考圖列表
        refs = brand_kit.reference_images or []
        refs.append({
            "url": file_url,
            "type": asset_metadata.get("type", "style"),
            "weight": asset_metadata.get("weight", 0.7),
        })
        brand_kit.reference_images = refs
    
    db.commit()
    db.refresh(asset)
    
    return {
        "success": True,
        "asset": BrandKitAssetResponse.model_validate(asset),
        "message": f"資產上傳成功"
    }


@router.delete("/{brand_kit_id}/assets/{asset_id}")
async def delete_brand_asset(
    brand_kit_id: int,
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    刪除品牌資產
    """
    # 驗證品牌包
    brand_kit = db.query(BrandKit).filter(
        BrandKit.id == brand_kit_id,
        BrandKit.user_id == current_user.id
    ).first()
    
    if not brand_kit:
        raise HTTPException(status_code=404, detail="品牌包不存在")
    
    # 查詢資產
    asset = db.query(BrandKitAsset).filter(
        BrandKitAsset.id == asset_id,
        BrandKitAsset.brand_kit_id == brand_kit_id
    ).first()
    
    if not asset:
        raise HTTPException(status_code=404, detail="資產不存在")
    
    # 從品牌包中移除 URL
    if asset.asset_type == "logo" and brand_kit.logo_url == asset.file_url:
        brand_kit.logo_url = None
    elif asset.asset_type == "logo_light" and brand_kit.logo_light_url == asset.file_url:
        brand_kit.logo_light_url = None
    elif asset.asset_type == "logo_dark" and brand_kit.logo_dark_url == asset.file_url:
        brand_kit.logo_dark_url = None
    elif asset.asset_type == "logo_icon" and brand_kit.logo_icon_url == asset.file_url:
        brand_kit.logo_icon_url = None
    elif asset.asset_type == "reference":
        refs = brand_kit.reference_images or []
        brand_kit.reference_images = [r for r in refs if r.get("url") != asset.file_url]
    
    # 刪除檔案
    try:
        file_path = STATIC_BASE / asset.file_url.replace('/upload/', '/uploads/').lstrip('/')
        if file_path.exists():
            os.remove(file_path)
    except:
        pass
    
    # 刪除記錄
    db.delete(asset)
    db.commit()
    
    return {"success": True, "message": "資產已刪除"}


# ============================================================
# 輔助函數
# ============================================================

def _to_response(brand_kit: BrandKit) -> BrandKitResponse:
    """轉換為回應格式"""
    return BrandKitResponse(
        id=brand_kit.id,
        name=brand_kit.name,
        description=brand_kit.description,
        primary_color=brand_kit.primary_color,
        secondary_color=brand_kit.secondary_color,
        accent_color=brand_kit.accent_color,
        background_color=brand_kit.background_color,
        text_color=brand_kit.text_color,
        color_palette=brand_kit.color_palette or [],
        logo_url=brand_kit.logo_url,
        logo_light_url=brand_kit.logo_light_url,
        logo_dark_url=brand_kit.logo_dark_url,
        logo_icon_url=brand_kit.logo_icon_url,
        heading_font=brand_kit.heading_font,
        body_font=brand_kit.body_font,
        font_style=brand_kit.font_style,
        visual_style=brand_kit.visual_style,
        image_style=brand_kit.image_style,
        brand_voice=brand_kit.brand_voice,
        preferred_tts_voice=brand_kit.preferred_tts_voice,
        tagline=brand_kit.tagline,
        key_messages=brand_kit.key_messages or [],
        tone_of_voice=brand_kit.tone_of_voice or [],
        industry=brand_kit.industry,
        target_audience=brand_kit.target_audience or {},
        is_active=brand_kit.is_active,
        is_default=brand_kit.is_default,
        # IP 角色設定
        character_personality=brand_kit.character_personality,
        character_age_group=brand_kit.character_age_group,
        character_traits=brand_kit.character_traits or [],
        assets=[BrandKitAssetResponse.model_validate(a) for a in brand_kit.assets],
        reference_images=brand_kit.reference_images or [],
        created_at=brand_kit.created_at,
        updated_at=brand_kit.updated_at,
    )
