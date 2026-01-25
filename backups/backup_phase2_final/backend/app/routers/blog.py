from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Literal, Optional
from datetime import datetime
import os
import uuid
import base64
import asyncio
import google.generativeai as genai

from app.database import get_db
from app.models import User, Post
from app.routers.auth import get_current_user
from app.services.ai_generator import generate_blog_post

router = APIRouter(prefix="/blog", tags=["Blog Engine"])

# --- 圖片生成設定 ---
GOOGLE_GEMINI_KEY = os.getenv("GOOGLE_GEMINI_KEY")
if GOOGLE_GEMINI_KEY:
    genai.configure(api_key=GOOGLE_GEMINI_KEY)

# 嘗試載入新版 genai SDK
try:
    from google import genai as genai_new
    image_client = genai_new.Client(api_key=GOOGLE_GEMINI_KEY) if GOOGLE_GEMINI_KEY else None
except ImportError:
    try:
        import google.genai as genai_new
        image_client = genai_new.Client(api_key=GOOGLE_GEMINI_KEY) if GOOGLE_GEMINI_KEY else None
    except ImportError:
        image_client = None

# 品質配置
ImageQuality = Literal["draft", "standard", "premium"]

QUALITY_CONFIG = {
    "draft": {
        "models": ["models/imagen-4.0-fast-generate-001", "models/gemini-2.0-flash-exp-image-generation"],
        "quality": "quick draft",
        "cost": 5
    },
    "standard": {
        "models": ["models/gemini-2.5-flash-image", "models/imagen-4.0-generate-001"],
        "quality": "high quality",
        "cost": 10
    },
    "premium": {
        "models": ["models/gemini-3-pro-image-preview", "models/imagen-4.0-ultra-generate-001"],
        "quality": "4K ultra",
        "cost": 20
    },
}

# 部落格封面風格
BLOG_COVER_STYLES = {
    "professional": {
        "mood": "clean, authoritative, trustworthy",
        "colors": "sophisticated blues, grays, whites",
        "lighting": "bright, even, professional studio",
        "composition": "clean layout with clear focal point"
    },
    "casual": {
        "mood": "relaxed, approachable, friendly",
        "colors": "warm natural tones, soft pastels",
        "lighting": "natural daylight, soft shadows",
        "composition": "lifestyle oriented, casual setting"
    },
    "friendly": {
        "mood": "warm, welcoming, cheerful",
        "colors": "vibrant but not overwhelming",
        "lighting": "warm golden hour, inviting",
        "composition": "engaging, human-centered"
    },
    "humorous": {
        "mood": "playful, fun, entertaining",
        "colors": "bright, bold, cheerful",
        "lighting": "bright and energetic",
        "composition": "dynamic, eye-catching"
    },
    "educational": {
        "mood": "informative, clear, inspiring",
        "colors": "clean whites, calming blues, accent colors",
        "lighting": "clear, well-lit",
        "composition": "organized, easy to understand"
    },
}

# --- Schemas ---
class BlogRequest(BaseModel):
    topic: str
    tone: str = "professional"

class PostResponse(BaseModel):
    id: int
    title: str
    content: str
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class ImageResponse(BaseModel):
    image_url: str
    prompt_used: str
    reference_analysis: Optional[str] = None


# --- 參考圖片分析函數 ---
async def analyze_reference_image(image_base64: str, content_type: str = "image/jpeg") -> str:
    """使用 Gemini Vision API 分析參考圖片"""
    if not GOOGLE_GEMINI_KEY:
        return ""
    
    try:
        model = genai.GenerativeModel("models/gemini-2.5-flash")
        
        image_part = {
            "mime_type": content_type,
            "data": image_base64
        }
        
        prompt = """請分析這張圖片，提供一個詳細的視覺描述（80-120字），包含：
1. 主要主題/物體
2. 構圖方式與視角
3. 色彩風格與色調
4. 光線氛圍
5. 整體藝術風格

只輸出描述，不要其他說明文字。用於生成類似風格的部落格封面圖片。"""
        
        response = await asyncio.wait_for(
            asyncio.to_thread(model.generate_content, [prompt, image_part]),
            timeout=20.0
        )
        
        if response and response.text:
            analysis = response.text.strip()
            print(f"[Blog] 參考圖片分析結果: {analysis}")
            return analysis
        return ""
        
    except Exception as e:
        print(f"[Blog] 分析參考圖片失敗: {e}")
        return ""


# --- 品質提示詞 ---
SD_QUALITY_BOOSTERS = """masterpiece, best quality, ultra-detailed, high resolution, 8K UHD, professional photography, sharp focus, depth of field, ray tracing, volumetric lighting, cinematic lighting, award-winning, trending on artstation"""

# 專門用於 API 的 negative_prompt 參數
NEGATIVE_PROMPT_FOR_API = "text, words, letters, numbers, typography, titles, captions, labels, watermark, signature, logo, wordmark, brand name, writing, heading, headline, Chinese characters, English text, any language text, signs with text, banners with words, book covers, speech bubbles, UI elements, lowres, blurry, bad quality, jpeg artifacts"

# --- 圖片生成函數 ---
async def generate_blog_cover(
    topic: str, 
    style: str, 
    quality: str, 
    custom_prompt: Optional[str] = None,
    reference_analysis: Optional[str] = None
) -> tuple[str, str]:
    """生成部落格封面圖片"""
    from urllib.parse import quote

    style_config = BLOG_COVER_STYLES.get(style, BLOG_COVER_STYLES["professional"])
    quality_config = QUALITY_CONFIG.get(quality, QUALITY_CONFIG["standard"])

    # 構建主題描述
    if reference_analysis:
        visual_desc = f"Create a blog cover image inspired by this reference style: {reference_analysis}. The image should be about {topic}."
        if custom_prompt and custom_prompt.strip():
            visual_desc += f" Additional requirements: {custom_prompt.strip()}"
    elif custom_prompt and custom_prompt.strip():
        visual_desc = f"{custom_prompt.strip()}, for blog article about {topic}"
    else:
        visual_desc = f"Professional blog cover image for article about {topic}"
    
    # 構建提示詞 - 禁止文字的指令放在最前面
    prompt = f"""[CRITICAL RULE - NO TEXT]: Generate a PURELY VISUAL image. DO NOT include ANY text, words, letters, numbers, typography, titles, captions, labels, watermarks, logos, signs, or any readable characters in ANY language (English, Chinese, or otherwise). The image must be 100% text-free.

{visual_desc}

{SD_QUALITY_BOOSTERS}

Visual Style:
- Mood: {style_config['mood']}
- Colors: {style_config['colors']}
- Lighting: {style_config['lighting']}
- Composition: {style_config['composition']}

Format: 16:9 horizontal wide format blog cover
Quality: {quality_config['quality']}

Requirements:
- Professional photography or high-end digital art
- Sharp focus, beautiful bokeh, depth of field
- Cinematic lighting with soft shadows
- Rich, vibrant yet natural colors
- Clean, modern aesthetic
- NO TEXT ANYWHERE IN THE IMAGE
"""

    if not GOOGLE_GEMINI_KEY or image_client is None:
        seed = quote(f"{topic}-{quality}-{uuid.uuid4().hex}")
        return f"https://picsum.photos/seed/{seed}/1792/1024", prompt

    try:
        from google.genai import types
        
        # 設定 16:9 寬屏比例 (Gemini API 不支援 negative_prompt 參數)
        image_config = types.GenerateImagesConfig(
            aspect_ratio="16:9",
            number_of_images=1
        )
        print("[Blog Image] 使用基本配置")
        
        for model_name in quality_config["models"]:
            try:
                print(f"[Blog Image] 嘗試使用模型 {model_name}...")
                
                if hasattr(image_client.models, 'generate_images'):
                    result = await asyncio.wait_for(
                        asyncio.to_thread(
                            image_client.models.generate_images,
                            model=model_name,
                            prompt=prompt,
                            config=image_config
                        ),
                        timeout=90.0
                    )
                    
                    if hasattr(result, 'images') and result.images:
                        image_bytes = result.images[0].image_bytes
                        b64 = base64.b64encode(image_bytes).decode("utf-8")
                        print(f"[Blog Image] 模型 {model_name} 成功生成 16:9 圖片")
                        return f"data:image/png;base64,{b64}", prompt
                        
            except asyncio.TimeoutError:
                print(f"[Blog Image] Model {model_name} timeout, trying next...")
                continue
            except Exception as e:
                print(f"[Blog Image] Model {model_name} failed: {str(e)}")
                continue
        
        raise Exception("All image models failed")

    except Exception as e:
        print(f"[Blog Image] Generation error: {e}")
        seed = quote(f"{topic}-{quality}-{uuid.uuid4().hex}")
        return f"https://picsum.photos/seed/{seed}/1200/675", prompt


# --- API Endpoints ---

# 1. 生成並存檔
@router.post("/generate", response_model=PostResponse)
async def generate_blog(
    request: BlogRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    COST = 5
    if current_user.credits < COST:
        raise HTTPException(status_code=402, detail="Insufficient credits")

    try:
        content = await generate_blog_post(request.topic, request.tone)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    current_user.credits -= COST
    
    new_post = Post(
        title=request.topic,
        content=content,
        user_id=current_user.id,
        status="draft"
    )
    db.add(new_post)
    db.commit()
    db.refresh(new_post)
    db.refresh(current_user)

    return new_post

# 2. 獲取歷史紀錄
@router.get("/posts", response_model=List[PostResponse])
def get_my_posts(
    skip: int = 0, 
    limit: int = 20, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    posts = db.query(Post).filter(Post.user_id == current_user.id)\
             .order_by(Post.created_at.desc())\
             .offset(skip).limit(limit).all()
    return posts

# 3. 清除所有歷史紀錄
@router.delete("/posts/clear")
def clear_all_posts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    deleted_count = db.query(Post).filter(Post.user_id == current_user.id).delete()
    db.commit()
    return {"message": f"已清除 {deleted_count} 篇文章", "deleted_count": deleted_count}

# 4. 刪除單篇文章
@router.delete("/posts/{post_id}")
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    post = db.query(Post).filter(
        Post.id == post_id, 
        Post.user_id == current_user.id
    ).first()
    
    if not post:
        raise HTTPException(status_code=404, detail="文章不存在")
    
    db.delete(post)
    db.commit()
    return {"message": "文章已刪除"}

# 5. 生成部落格封面圖片 (支援參考圖片)
@router.post("/generate-image", response_model=ImageResponse)
async def generate_blog_image(
    topic: str = Form(...),
    style: str = Form("professional"),
    quality: ImageQuality = Form("standard"),
    custom_prompt: Optional[str] = Form(None),
    reference_image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """生成部落格封面圖片（支援參考圖片）"""
    quality_config = QUALITY_CONFIG.get(quality, QUALITY_CONFIG["standard"])
    cost = quality_config["cost"]
    
    if current_user.credits < cost:
        raise HTTPException(
            status_code=402, 
            detail=f"Insufficient credits. 需要 {cost} 點，目前剩餘 {current_user.credits} 點"
        )

    # 處理參考圖片
    reference_analysis = ""
    if reference_image:
        try:
            image_data = await reference_image.read()
            content_type = reference_image.content_type or "image/jpeg"
            
            if content_type.startswith('image/') and len(image_data) <= 10 * 1024 * 1024:
                reference_image_base64 = base64.b64encode(image_data).decode('utf-8')
                print(f"[Blog] 參考圖片已上傳: {reference_image.filename}, {len(image_data)} bytes")
                
                # 分析參考圖片
                reference_analysis = await analyze_reference_image(reference_image_base64, content_type)
        except Exception as e:
            print(f"[Blog] 處理參考圖片失敗: {e}")

    try:
        image_url, prompt_used = await generate_blog_cover(
            topic,
            style,
            quality,
            custom_prompt,
            reference_analysis
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # 扣點
    current_user.credits -= cost
    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return ImageResponse(
        image_url=image_url, 
        prompt_used=prompt_used,
        reference_analysis=reference_analysis if reference_analysis else None
    )
