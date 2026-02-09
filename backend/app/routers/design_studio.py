"""
圖片設計室 API 路由
包含去背、AI 生圖等圖片處理功能
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Literal
from sqlalchemy.orm import Session
import os
import base64
import asyncio
import uuid

from app.services.rembg_service import rembg_service
from app.services.credit_service import CreditService, TransactionType
from app.routers.auth import get_current_user
from app.database import get_db
from app.models import User

router = APIRouter(prefix="/api/design-studio", tags=["design-studio"])

# 去背功能消耗點數
BACKGROUND_REMOVAL_COST = 1

# --- AI 生圖設定 ---
GOOGLE_GEMINI_KEY = os.getenv("GOOGLE_GEMINI_KEY")

# 嘗試載入 Google GenAI SDK
try:
    from google import genai as genai_new
    ds_image_client = genai_new.Client(api_key=GOOGLE_GEMINI_KEY) if GOOGLE_GEMINI_KEY else None
except ImportError:
    try:
        import google.genai as genai_new
        ds_image_client = genai_new.Client(api_key=GOOGLE_GEMINI_KEY) if GOOGLE_GEMINI_KEY else None
    except ImportError:
        ds_image_client = None

# AI 生圖品質配置
AI_IMAGE_QUALITY = {
    "draft": {
        "models": ["models/imagen-4.0-fast-generate-001", "models/gemini-2.0-flash-exp-image-generation"],
        "cost": 5,
        "label": "快速草稿"
    },
    "standard": {
        "models": ["models/gemini-2.5-flash-image", "models/imagen-4.0-generate-001"],
        "cost": 10,
        "label": "標準品質"
    },
    "premium": {
        "models": ["models/gemini-3-pro-image-preview", "models/imagen-4.0-ultra-generate-001"],
        "cost": 20,
        "label": "高級品質"
    },
}

# AI 生圖風格
AI_IMAGE_STYLES = {
    "realistic": "photorealistic, ultra detailed, professional photography, sharp focus, natural lighting",
    "illustration": "digital illustration, vibrant colors, clean lines, artistic, modern illustration style",
    "3d": "3D rendered, realistic materials, soft lighting, octane render, cinema 4D style",
    "watercolor": "watercolor painting, soft brushstrokes, delicate colors, artistic, hand-painted feel",
    "flat": "flat design, minimal, vector style, clean shapes, solid colors, modern graphic design",
    "anime": "anime style, Japanese animation, vibrant colors, detailed, manga aesthetic",
    "oil_painting": "oil painting style, rich textures, classical art, dramatic lighting, museum quality",
    "pixel": "pixel art style, retro 8-bit aesthetic, clean pixels, nostalgic gaming style",
}


class RemoveBackgroundRequest(BaseModel):
    """去背請求模型"""
    image_base64: Optional[str] = None  # Base64 編碼的圖片（含或不含 data URI 前綴）
    image_url: Optional[str] = None      # 圖片 URL
    output_type: int = 1                  # 1=PNG透明背景, 2=JPG白色背景
    return_type: int = 2                  # 1=URL, 2=Base64（本地服務只支援 Base64）
    use_async: bool = False               # 保留參數但本地服務不需要


class RemoveBackgroundResponse(BaseModel):
    """去背回應模型"""
    success: bool
    image: str           # 去背後的圖片（Base64）
    width: Optional[int] = None
    height: Optional[int] = None


@router.post("/remove-background", response_model=RemoveBackgroundResponse)
async def remove_background(
    request: RemoveBackgroundRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    圖片去背 API（消耗 1 點）
    
    使用本地 rembg（開源 U2Net 模型）進行去背處理
    
    支援兩種輸入方式：
    - image_base64: 直接傳送 Base64 編碼的圖片
    - image_url: 傳送圖片的公開 URL
    
    參數說明：
    - output_type: 1=PNG透明背景（預設）, 2=JPG白色背景
    - return_type: 固定為 Base64 返回
    """
    if not request.image_base64 and not request.image_url:
        raise HTTPException(
            status_code=400,
            detail="必須提供 image_base64 或 image_url"
        )
    
    # 扣除點數
    credit_service = CreditService(db)
    consume_result = credit_service.consume_direct(
        user_id=current_user.id,
        cost=BACKGROUND_REMOVAL_COST,
        transaction_type=TransactionType.CONSUME_BACKGROUND_REMOVAL,
        description="圖片去背",
        metadata={}
    )
    
    if not consume_result.success:
        raise HTTPException(
            status_code=402,  # Payment Required
            detail=f"點數不足：需要 {BACKGROUND_REMOVAL_COST} 點，目前餘額 {consume_result.balance} 點"
        )
    
    try:
        result = await rembg_service.remove_background(
            image_base64=request.image_base64,
            image_url=request.image_url,
            output_type=request.output_type,
            return_type=request.return_type,
        )
        
        return RemoveBackgroundResponse(
            success=result["success"],
            image=result["image"],
            width=result.get("width"),
            height=result.get("height"),
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"去背處理失敗: {str(e)}"
        )


@router.get("/api-status")
async def check_api_status():
    """
    檢查去背服務狀態
    """
    is_available = rembg_service.is_available()
    
    return {
        "service": "rembg",
        "available": is_available,
        "ai_image": ds_image_client is not None,
        "message": "本地去背服務（rembg）已就緒" if is_available else "rembg 未安裝，請執行: pip install rembg[gpu]"
    }


# ==========================================
# AI 生圖功能
# ==========================================

class GenerateImageRequest(BaseModel):
    """AI 生圖請求模型"""
    prompt: str                                          # 使用者描述
    width: int = 1024                                    # 畫布寬度
    height: int = 1024                                   # 畫布高度
    style: str = "realistic"                             # 風格
    quality: Literal["draft", "standard", "premium"] = "standard"  # 品質


class GenerateImageResponse(BaseModel):
    """AI 生圖回應模型"""
    success: bool
    image: str                 # Base64 data URI
    prompt_used: str           # 最終使用的 prompt
    cost: int                  # 扣除點數
    width: int
    height: int


@router.post("/generate-image", response_model=GenerateImageResponse)
async def generate_ai_image(
    request: GenerateImageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    AI 生圖 API - 根據文字描述生成符合畫布尺寸的圖片
    
    支援多種風格和品質等級，消耗點數。
    """
    if not request.prompt or len(request.prompt.strip()) == 0:
        raise HTTPException(status_code=400, detail="請輸入圖片描述")
    
    if not GOOGLE_GEMINI_KEY or ds_image_client is None:
        raise HTTPException(status_code=503, detail="AI 生圖服務未啟用，請設定 GOOGLE_GEMINI_KEY")
    
    quality_config = AI_IMAGE_QUALITY.get(request.quality, AI_IMAGE_QUALITY["standard"])
    cost = quality_config["cost"]
    
    # 扣除點數
    credit_service = CreditService(db)
    consume_result = credit_service.consume_direct(
        user_id=current_user.id,
        cost=cost,
        transaction_type=TransactionType.CONSUME_SOCIAL_IMAGE,
        description=f"AI 生圖 - {request.prompt[:30]}",
        reference_type="design_studio_ai_image",
        metadata={
            "prompt": request.prompt,
            "style": request.style,
            "quality": request.quality,
            "width": request.width,
            "height": request.height,
        }
    )
    
    if not consume_result.success:
        raise HTTPException(
            status_code=402,
            detail=f"點數不足：需要 {cost} 點，目前餘額 {consume_result.balance} 點"
        )
    
    # 計算最接近的長寬比
    w, h = request.width, request.height
    ratio = w / h
    if ratio > 1.6:
        aspect = "16:9"
    elif ratio > 1.3:
        aspect = "3:2"
    elif ratio > 1.1:
        aspect = "4:3"
    elif ratio > 0.9:
        aspect = "1:1"
    elif ratio > 0.7:
        aspect = "3:4"
    elif ratio > 0.6:
        aspect = "2:3"
    else:
        aspect = "9:16"
    
    # 組合 prompt
    style_desc = AI_IMAGE_STYLES.get(request.style, AI_IMAGE_STYLES["realistic"])
    final_prompt = f"""{request.prompt}

Style: {style_desc}
Technical specs: {aspect} aspect ratio, high resolution, no text or watermarks in the image.
"""
    
    try:
        from google.genai import types
        
        image_config = types.GenerateImagesConfig(
            aspect_ratio=aspect,
            number_of_images=1
        )
        
        for model_name in quality_config["models"]:
            try:
                print(f"[Design Studio AI] 嘗試使用模型 {model_name}...")
                
                if hasattr(ds_image_client.models, 'generate_images'):
                    result = await asyncio.wait_for(
                        asyncio.to_thread(
                            ds_image_client.models.generate_images,
                            model=model_name,
                            prompt=final_prompt,
                            config=image_config
                        ),
                        timeout=120.0
                    )
                    
                    if hasattr(result, 'images') and result.images:
                        image_bytes = result.images[0].image_bytes
                        b64 = base64.b64encode(image_bytes).decode("utf-8")
                        print(f"[Design Studio AI] 模型 {model_name} 成功生成圖片")
                        
                        return GenerateImageResponse(
                            success=True,
                            image=f"data:image/png;base64,{b64}",
                            prompt_used=final_prompt,
                            cost=cost,
                            width=request.width,
                            height=request.height,
                        )
                        
            except asyncio.TimeoutError:
                print(f"[Design Studio AI] Model {model_name} timeout, trying next...")
                continue
            except Exception as e:
                print(f"[Design Studio AI] Model {model_name} failed: {str(e)}")
                continue
        
        raise HTTPException(status_code=500, detail="所有 AI 模型都無法生成圖片，請稍後再試")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Design Studio AI] Generation error: {e}")
        raise HTTPException(status_code=500, detail=f"AI 生圖失敗: {str(e)}")


@router.get("/ai-image-styles")
async def get_ai_image_styles():
    """取得可用的 AI 生圖風格列表"""
    styles = [
        {"id": "realistic", "name": "寫實攝影", "desc": "逼真的攝影風格"},
        {"id": "illustration", "name": "數位插畫", "desc": "現代數位插畫風格"},
        {"id": "3d", "name": "3D 渲染", "desc": "3D 立體渲染風格"},
        {"id": "watercolor", "name": "水彩畫", "desc": "柔和水彩畫風格"},
        {"id": "flat", "name": "扁平設計", "desc": "簡約扁平向量風格"},
        {"id": "anime", "name": "動漫風格", "desc": "日式動漫風格"},
        {"id": "oil_painting", "name": "油畫", "desc": "經典油畫風格"},
        {"id": "pixel", "name": "像素風", "desc": "復古像素遊戲風格"},
    ]
    
    qualities = [
        {"id": "draft", "name": "快速草稿", "cost": 5, "desc": "快速生成，適合預覽"},
        {"id": "standard", "name": "標準品質", "cost": 10, "desc": "平衡品質與速度"},
        {"id": "premium", "name": "高級品質", "cost": 20, "desc": "最高品質，細節豐富"},
    ]
    
    return {
        "styles": styles,
        "qualities": qualities,
        "available": ds_image_client is not None,
    }
