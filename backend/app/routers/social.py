from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from pydantic import BaseModel
from typing import Literal, Optional
from sqlalchemy.orm import Session
import os
import uuid
import google.generativeai as genai
import google.generativeai.types as genai_types
import base64
import io
import json
import re
import asyncio

import time

from app.database import get_db
from app.models import User, GenerationHistory
from app.routers.auth import get_current_user
from app.services.credit_service import CreditService, TransactionType

# 設定 Gemini API Key
GOOGLE_GEMINI_KEY = os.getenv("GOOGLE_GEMINI_KEY")
if GOOGLE_GEMINI_KEY:
    genai.configure(api_key=GOOGLE_GEMINI_KEY)


router = APIRouter(prefix="/social", tags=["Social Content"])


# 資費需與前端 COST_TABLE 對應
ImageQuality = Literal["draft", "standard", "premium"]
Platform = Literal["instagram", "facebook", "tiktok", "pinterest", "threads", "linkedin", "xiaohongshu", "line"]

COST_TABLE = {
    "draft": 10,
    "standard": 20,
    "premium": 50,
}


class SocialRequest(BaseModel):
    topic: str
    platform: str = "instagram"
    image_quality: ImageQuality = "standard"
    tone: str = "engaging"
    reference_image_base64: Optional[str] = None


class SocialResponse(BaseModel):
    image_url: str
    caption: str
    reference_analysis: Optional[str] = None  # 參考圖片分析結果


class SuggestRequest(BaseModel):
    topic: str
    platform: str = "instagram"


class SuggestResponse(BaseModel):
    keywords: str
    image_prompt: str
    product_info: str


# 使用新版 google-genai SDK
try:
    from google import genai as genai_new
    image_client = genai_new.Client(api_key=GOOGLE_GEMINI_KEY) if GOOGLE_GEMINI_KEY else None
except ImportError:
    import google.genai as genai_new
    image_client = genai_new.Client(api_key=GOOGLE_GEMINI_KEY) if GOOGLE_GEMINI_KEY else None


# 視覺風格配置
TONE_STYLES = {
    "engaging": {"mood": "warm, friendly, inviting", "colors": "vibrant, rich", "lighting": "natural warm", "composition": "intimate, subject-focused"},
    "professional": {"mood": "clean, authoritative", "colors": "neutral, business-like", "lighting": "even, professional", "composition": "clean lines"},
    "humorous": {"mood": "playful, fun", "colors": "bright, cheerful", "lighting": "energetic", "composition": "dynamic angles"},
    "minimalist": {"mood": "calm, serene", "colors": "monochromatic, muted", "lighting": "soft, diffused", "composition": "negative space"},
    "romantic": {"mood": "dreamy, soft", "colors": "soft pastels, rose gold", "lighting": "golden hour, bokeh", "composition": "ethereal"},
    "energetic": {"mood": "dynamic, powerful", "colors": "bold, high contrast", "lighting": "dramatic", "composition": "action-oriented"},
    "elegant": {"mood": "sophisticated, luxurious", "colors": "rich blacks, golds", "lighting": "sculpted", "composition": "symmetrical"},
    "cozy": {"mood": "comfortable, homey", "colors": "warm earth tones", "lighting": "warm indoor", "composition": "inviting"},
    "dramatic": {"mood": "intense, bold", "colors": "high contrast", "lighting": "chiaroscuro", "composition": "theatrical"},
    "vintage": {"mood": "nostalgic, classic", "colors": "faded, sepia", "lighting": "film-like", "composition": "retro"},
    "modern": {"mood": "contemporary, sleek", "colors": "clean whites, blacks", "lighting": "crisp", "composition": "geometric"},
    "nature": {"mood": "fresh, organic", "colors": "natural greens", "lighting": "outdoor daylight", "composition": "environmental"},
    "faith": {"mood": "peaceful, hopeful, sacred", "colors": "soft whites, warm golds, sky blues", "lighting": "heavenly, divine rays", "composition": "uplifting, reverent"},
}

# 平台配置
PLATFORM_CONFIG = {
    "instagram": {"aspect_ratio": "1:1", "size": "1080x1080"},
    "facebook": {"aspect_ratio": "1:1", "size": "1200x1200"},
    "tiktok": {"aspect_ratio": "9:16", "size": "1080x1920"},
    "pinterest": {"aspect_ratio": "2:3", "size": "1000x1500"},
    "threads": {"aspect_ratio": "1:1", "size": "1080x1080"},
    "linkedin": {"aspect_ratio": "1.91:1", "size": "1200x627"},
    "xiaohongshu": {"aspect_ratio": "3:4", "size": "1080x1440"},
    "line": {"aspect_ratio": "1:1", "size": "1200x1200"},
}

# 品質配置
QUALITY_CONFIG = {
    "draft": {"models": ["models/imagen-4.0-fast-generate-001", "models/gemini-2.0-flash-exp-image-generation"], "quality": "quick draft"},
    "standard": {"models": ["models/gemini-2.5-flash-image", "models/imagen-4.0-generate-001"], "quality": "high quality"},
    "premium": {"models": ["models/gemini-3-pro-image-preview", "models/imagen-4.0-ultra-generate-001", "models/imagen-4.0-generate-001"], "quality": "4K ultra"},
}


async def analyze_reference_image(image_base64: str, content_type: str = "image/jpeg") -> str:
    """使用 Gemini Vision API 分析參考圖片，回傳視覺描述"""
    if not GOOGLE_GEMINI_KEY:
        return ""
    
    try:
        # 使用 Gemini Vision 模型分析圖片
        model = genai.GenerativeModel("models/gemini-2.5-flash")
        
        # 準備圖片數據
        image_part = {
            "mime_type": content_type,
            "data": image_base64
        }
        
        prompt = """請分析這張圖片，提供一個簡潔的視覺描述（50-80字），包含：
1. 主要主題/物體
2. 構圖方式
3. 色彩風格
4. 光線氛圍
5. 整體風格

只輸出描述，不要其他說明文字。用於生成類似風格的新圖片。"""
        
        response = await asyncio.wait_for(
            asyncio.to_thread(model.generate_content, [prompt, image_part]),
            timeout=15.0
        )
        
        if response and response.text:
            analysis = response.text.strip()
            print(f"參考圖片分析結果: {analysis}")
            return analysis
        return ""
        
    except Exception as e:
        print(f"分析參考圖片失敗: {e}")
        return ""


async def generate_image_with_gemini(topic: str, quality: str, tone: str, platform: str = "instagram", reference_image_base64: Optional[str] = None, image_prompt: Optional[str] = None) -> str:
    """使用 Gemini/Imagen API 生成圖片"""
    from urllib.parse import quote

    if not GOOGLE_GEMINI_KEY or image_client is None:
        seed = quote(f"{topic}-{quality}-{uuid.uuid4().hex}")
        return f"https://picsum.photos/seed/{seed}/800/800"

    style = TONE_STYLES.get(tone, TONE_STYLES["engaging"])
    platform_info = PLATFORM_CONFIG.get(platform, PLATFORM_CONFIG["instagram"])
    config = QUALITY_CONFIG.get(quality, QUALITY_CONFIG["standard"])

    # 構建視覺描述 - 優化 prompt 結構
    if image_prompt and image_prompt.strip():
        visual_desc = f"{image_prompt.strip()}, themed around {topic}"
    else:
        visual_desc = f"Professional photograph of {topic}"
    
    # 構建優化的 prompt - 強調真實感，禁止文字，去除 AI 感
    prompt = f"""[ABSOLUTE CRITICAL - ZERO TEXT RULE]:
⛔ DO NOT include ANY text, words, letters, characters anywhere in the image.
⛔ NO Chinese text (中文/漢字/繁體/簡體) - absolutely forbidden.
⛔ NO English, NO Japanese, NO Korean, NO text in ANY language.
⛔ NO numbers, logos, watermarks, captions, labels, signs.
⛔ PURE VISUAL ONLY - if any text appears, the image will be rejected.

[AUTHENTICITY RULE]:
This must look like a REAL photograph, NOT AI generated, NOT CGI, NOT 3D render.

═══ VISUAL SUBJECT ═══
{visual_desc}

═══ AUTHENTICITY (CRITICAL) ═══
- Shot by professional human photographer on high-end camera
- Natural film grain and subtle lens imperfections
- Genuine lighting with natural falloff and shadows
- Real textures, organic materials, authentic atmosphere
- NOT artificial, NOT synthetic, NOT computer generated

═══ STYLE DIRECTION ═══
Mood: {style['mood']}
Colors: {style['colors']} (natural, true-to-life, not hyper-saturated)
Lighting: {style['lighting']} (authentic, not artificially perfect)
Composition: {style['composition']}
Aspect ratio: {platform_info['aspect_ratio']}
Quality: {config['quality']}, shot on Hasselblad / Sony A7R V

═══ QUALITY REQUIREMENTS ═══
- Professional photography with natural imperfections
- Sharp focus with organic bokeh
- Rich but natural colors (not oversaturated)
- Subtle film grain, analog warmth
- Real-world lighting, not CGI lighting

═══ MUST AVOID ═══
- ANY text, words, letters, characters, typography in ANY language
- Chinese characters (中文), Japanese, Korean, or any written language
- Numbers, logos, watermarks, captions, labels, signs, banners
- AI generated look, synthetic appearance, plastic textures
- Overly smooth, unnaturally perfect, uncanny valley
- Hyper-saturated colors, HDR artifacts, over-processed
- CGI look, 3D render appearance, video game graphics
"""

    try:
        for model_name in config["models"]:
            try:
                print(f"嘗試使用模型 {model_name} 生成圖片...")
                
                if hasattr(image_client.models, 'generate_images'):
                    # 使用 asyncio 設置超時（90秒，給予充足時間生成高品質圖片）
                    result = await asyncio.wait_for(
                        asyncio.to_thread(
                            image_client.models.generate_images,
                            model=model_name,
                            prompt=prompt
                        ),
                        timeout=90.0
                    )
                    
                    if hasattr(result, 'images') and result.images:
                        image_bytes = result.images[0].image_bytes
                        b64 = base64.b64encode(image_bytes).decode("utf-8")
                        print(f"模型 {model_name} 成功生成圖片")
                        return f"data:image/png;base64,{b64}"
                        
            except asyncio.TimeoutError:
                print(f"Model {model_name} timeout after 90s, trying next...")
                continue
            except Exception as e:
                print(f"Model {model_name} failed: {str(e)}")
                continue
        
        raise Exception("All image models failed or timed out")

    except Exception as e:
        print(f"Image generation error: {e}")
        seed = quote(f"{topic}-{quality}-{uuid.uuid4().hex}")
        return f"https://picsum.photos/seed/{seed}/800/800"


# 社群文案備用 Prompt
FALLBACK_SOCIAL_CAPTION_PROMPT = """你是專業社群小編，請為「{{topic}}」撰寫 {{platform}} 貼文。

平台特性：{{platform_description}}
語氣風格：{{tone}}
字數限制：{{char_limit}}
{{keywords_section}}
{{product_info_section}}

創作規則：
1. 開頭抓住注意力，可用 emoji 或問句
2. 內容真實反映主題，像真人分享
3. 語氣自然流暢，避免生硬用語
4. 結尾加上適量 hashtag

⚠️ 重要輸出規則：
- 直接輸出最終貼文內容，就像要直接發布到社群媒體上
- 絕對不要任何前言、標題、編號、說明文字
- 不要輸出「主文案」「Hashtag」「表情符號」等標籤
- 不要輸出任何括號內的說明（如「已在文案中運用」「已融入」等）
- 不要解釋你做了什麼，只要輸出成品"""

async def generate_caption_with_gemini(topic: str, platform: str, tone: str, quality: str, keywords: Optional[str] = None, product_info: Optional[str] = None, db: Session = None, user = None) -> str:
    """使用 Gemini API 生成文案（支援用戶地區個性化）"""
    
    platform_info = {
        "instagram": {"style": "視覺導向，emoji豐富，文案簡潔有力", "length": "100-200字", "hashtag": "5-8個相關hashtag"},
        "facebook": {"style": "親近友好，可分享更多細節", "length": "150-300字", "hashtag": "1-3個hashtag"},
        "tiktok": {"style": "簡短有力，適合年輕族群", "length": "50-100字", "hashtag": "3-5個熱門hashtag"},
        "pinterest": {"style": "描述性強，關鍵詞豐富", "length": "100-200字", "hashtag": "5-10個hashtag"},
        "threads": {"style": "簡潔直接，對話式", "length": "100-200字", "hashtag": "2-4個hashtag"},
        "linkedin": {"style": "專業正式，強調價值", "length": "200-400字", "hashtag": "3-5個專業hashtag"},
        "xiaohongshu": {"style": "親切分享，適合種草，emoji豐富", "length": "150-300字", "hashtag": "5-8個話題標籤"},
        "line": {"style": "簡潔親切，口語化", "length": "100-200字", "hashtag": "2-3個hashtag"},
    }
    
    tone_desc = {
        "engaging": "親切互動，像朋友聊天",
        "professional": "專業權威，有深度",
        "humorous": "幽默風趣，輕鬆有趣",
        "minimalist": "極簡冷淡，簡潔有力",
        "romantic": "浪漫唯美，情感豐富",
        "energetic": "活力動感，激勵人心",
        "elegant": "優雅高貴，品味獨特",
        "cozy": "溫馨舒適，療癒感",
        "dramatic": "戲劇張力，故事感",
        "vintage": "復古懷舊，時光記憶",
        "modern": "現代時尚，趨勢先驅",
        "nature": "自然清新，回歸本真",
        "faith": "信仰靈性，基督教用語，溫柔堅定，充滿盼望與恩典",
    }

    info = platform_info.get(platform, platform_info["instagram"])
    tone_style = tone_desc.get(tone, tone)
    
    keywords_section = f"關鍵詞：{keywords}" if keywords else ""
    product_info_section = f"商品資訊：{product_info}" if product_info else ""

    # 嘗試從資料庫獲取 Prompt（支援用戶地區個性化）
    prompt = None
    if db:
        try:
            from app.services.prompt_loader import load_prompt
            result = await load_prompt(
                db=db,
                slug="social-media-caption-generator",
                variables={
                    "topic": topic,
                    "platform": platform.upper(),
                    "platform_description": f"{info['style']}，長度{info['length']}，{info['hashtag']}",
                    "tone": tone_style,
                    "char_limit": info['length'],
                    "target_audience": "一般大眾",
                    "keywords_section": keywords_section,
                    "product_info_section": product_info_section
                },
                fallback=FALLBACK_SOCIAL_CAPTION_PROMPT,
                user=user,  # 傳入用戶對象，自動注入地區變量
                inject_locale=True
            )
            prompt = result.positive
            if result.from_db:
                print(f"[SocialCaption] ✓ 使用資料庫 Prompt (ID: {result.prompt_id})")
        except Exception as e:
            print(f"[SocialCaption] 從資料庫獲取 Prompt 失敗: {e}")
    
    # 回退到內建 Prompt
    if not prompt:
        keywords_note = f"\n關鍵詞：{keywords}" if keywords else ""
        product_note = f"\n商品資訊：{product_info}" if product_info else ""
        prompt = f"""你是專業社群小編，請為「{topic}」撰寫 {platform.upper()} 貼文。

平台風格：{info['style']}
長度：{info['length']}
Hashtag：{info['hashtag']}
語氣：{tone_style}
{keywords_note}
{product_note}

創作規則：
1. 開頭抓住注意力，可用 emoji 或問句
2. 內容真實反映主題，像真人分享
3. 語氣自然流暢，避免生硬用語
4. 結尾加上適量 hashtag

⚠️ 重要輸出規則：
- 直接輸出最終貼文內容，就像要直接發布到社群媒體上
- 絕對不要任何前言、標題、編號、說明文字
- 不要輸出「主文案」「Hashtag」「表情符號」等標籤
- 不要輸出任何括號內的說明（如「已在文案中運用」「已融入」等）
- 不要解釋你做了什麼，只要輸出成品"""
        print("[SocialCaption] 使用內建備用 Prompt")

    if not GOOGLE_GEMINI_KEY:
        return generate_fallback_caption(topic, platform, tone, keywords, product_info)
    
    for model_name in ["models/gemini-2.5-flash", "models/gemini-2.0-flash", "models/gemini-flash-latest"]:
        try:
            model = genai.GenerativeModel(model_name)
            response = await model.generate_content_async(prompt)
            if response and response.text:
                caption = response.text.strip()
                
                # 移除引號包裹
                if caption.startswith('"') and caption.endswith('"'):
                    caption = caption[1:-1]
                
                # 移除常見的 AI 前置說明
                unwanted_prefixes = [
                    "好的，", "好的!", "好的!", "當然，", "當然!", "沒問題，", "沒問題!",
                    "這是一則", "這是一篇", "以下是", "這是為", "這裡是",
                    "為您創作", "為你創作", "幫您撰寫", "幫你撰寫",
                    "Here's", "Here is", "Sure,", "Of course,",
                ]
                for prefix in unwanted_prefixes:
                    if caption.lower().startswith(prefix.lower()):
                        # 找到冒號、換行或句號後的內容
                        for sep in ["：", ":", "\n", "。"]:
                            if sep in caption[:100]:
                                idx = caption.index(sep)
                                caption = caption[idx+1:].strip()
                                break
                        break
                
                # 移除開頭的 "---" 分隔線
                if caption.startswith("---"):
                    caption = caption[3:].strip()
                if caption.startswith("---"):
                    caption = caption[3:].strip()
                
                # 移除結尾的 "---" 分隔線
                if caption.endswith("---"):
                    caption = caption[:-3].strip()
                
                # 移除結構性標題（如 "**1. 主文案**"、"**2. 相關 Hashtag**" 等）
                import re
                
                # 移除 Markdown 粗體標題行（各種格式）
                caption = re.sub(r'\*\*\d+\.\s*[^*]+\*\*\s*\n?', '', caption)
                caption = re.sub(r'\*\*[^*]*(主文案|文案|Hashtag|標籤|表情符號|emoji)[^*]*\*\*\s*\n?', '', caption, flags=re.IGNORECASE)
                
                # 移除類似 "1. 主文案" "2. 相關 Hashtag" 的標題行
                caption = re.sub(r'^\d+\.\s*(主文案|相關\s*Hashtag|表情符號使用|文案|標籤|Hashtag|emoji|表情)[：:]*\s*\n?', '', caption, flags=re.MULTILINE | re.IGNORECASE)
                
                # 移除獨立的標題行（沒有數字編號的）
                caption = re.sub(r'^(主文案|相關\s*Hashtag|表情符號使用|建議\s*Hashtag|推薦\s*Hashtag)[：:]*\s*\n', '', caption, flags=re.MULTILINE | re.IGNORECASE)
                
                # 移除空的 Markdown 標題
                caption = re.sub(r'\*\*\*\*', '', caption)
                
                # 移除 "---" 分隔線
                caption = re.sub(r'^-{3,}\s*$', '', caption, flags=re.MULTILINE)
                
                # 移除括號中的 AI 說明文字（如「已在主文案中運用」、「已融入文案」等）
                caption = re.sub(r'（[^）]*(?:已在|已融入|運用|使用|包含)[^）]*）', '', caption)
                caption = re.sub(r'\([^)]*(?:already|included|used|integrated)[^)]*\)', '', caption, flags=re.IGNORECASE)
                
                # 移除獨立的說明性文字行
                caption = re.sub(r'^.*(?:已在主文案中|已融入文案|已包含在|表情符號說明)[^\n]*\n?', '', caption, flags=re.MULTILINE)
                
                # 清理多餘空行
                caption = re.sub(r'\n{3,}', '\n\n', caption)
                caption = caption.strip()
                
                return caption
        except Exception as e:
            print(f"Caption model {model_name} failed: {str(e)}")
            continue
    
    return generate_fallback_caption(topic, platform, tone, keywords, product_info)


def generate_fallback_caption(topic: str, platform: str, tone: str, keywords: Optional[str] = None, product_info: Optional[str] = None) -> str:
    """生成備用文案"""
    emoji_map = {
        "engaging": "✨", "professional": "💼", "humorous": "😄", "minimalist": "◻️",
        "romantic": "🌸", "energetic": "⚡", "elegant": "✨", "cozy": "☕",
        "dramatic": "🎭", "vintage": "📷", "modern": "🚀", "nature": "🌿",
    }
    
    emoji = emoji_map.get(tone, "✨")
    
    hashtags = []
    if keywords:
        for kw in keywords.split(",")[:3]:
            kw = kw.strip().replace(" ", "")
            if kw:
                hashtags.append(f"#{kw}")
    hashtags.extend(["#分享", "#推薦", "#生活"])
    
    caption = f"""{emoji} {topic}

這是一個讓人心動的體驗！

"""
    if product_info:
        caption += f"📌 {product_info[:80]}...\n\n" if len(product_info) > 80 else f"📌 {product_info}\n\n"
    
    caption += f"你也想體驗嗎？歡迎留言分享！\n\n{' '.join(hashtags[:5])}"
    return caption


@router.post("/generate", response_model=SocialResponse)
async def generate_social_post(
    topic: str = Form(...),
    platform: Platform = Form("instagram"),
    image_quality: ImageQuality = Form("standard"),
    tone: str = Form("engaging"),
    keywords: Optional[str] = Form(None),
    image_prompt: Optional[str] = Form(None),
    product_info: Optional[str] = Form(None),
    reference_image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """產生社群貼文"""
    cost = COST_TABLE.get(image_quality, COST_TABLE["standard"])

    # 使用 CreditService 扣點並記錄交易
    credit_service = CreditService(db)
    consume_result = credit_service.consume_direct(
        user_id=current_user.id,
        cost=cost,
        transaction_type=TransactionType.CONSUME_SOCIAL_IMAGE,
        description=f"社群貼文 - {topic[:30] if topic else '貼文'}",
        reference_type="social_post",
        metadata={
            "topic": topic,
            "platform": platform,
            "quality": image_quality,
        }
    )
    
    if not consume_result.success:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=consume_result.error or "Insufficient credits")

    # 處理參考圖片
    reference_image_base64 = None
    reference_image_analysis = ""
    content_type = "image/jpeg"
    
    if reference_image:
        try:
            image_data = await reference_image.read()
            content_type = reference_image.content_type or "image/jpeg"
            
            if content_type.startswith('image/'):
                if len(image_data) <= 10 * 1024 * 1024:
                    reference_image_base64 = base64.b64encode(image_data).decode('utf-8')
                    print(f"參考圖片已上傳: {reference_image.filename}, {len(image_data)} bytes")
                    
                    # 使用 Gemini Vision 分析參考圖片
                    reference_image_analysis = await analyze_reference_image(reference_image_base64, content_type)
        except Exception as e:
            print(f"處理參考圖片失敗: {e}")

    # 如果有參考圖片分析結果，自動更新 image_prompt
    final_image_prompt = image_prompt or ""
    if reference_image_base64 and reference_image_analysis:
        # 在圖片提示詞前加上「參考上傳圖片。」和分析結果
        reference_prefix = f"參考上傳圖片。{reference_image_analysis}"
        if final_image_prompt:
            final_image_prompt = f"{reference_prefix}\n\n用戶補充：{final_image_prompt}"
        else:
            final_image_prompt = reference_prefix
        print(f"已整合參考圖片分析到圖片提示詞")
    elif reference_image_base64:
        # 有圖片但分析失敗時，仍然標記有參考圖片
        reference_prefix = "參考上傳圖片風格。"
        if final_image_prompt:
            final_image_prompt = f"{reference_prefix}{final_image_prompt}"
        else:
            final_image_prompt = f"{reference_prefix}請生成類似風格的圖片。"

    start_time = time.time()
    generation_status = "completed"
    error_msg = None
    
    try:
        image_url = await generate_image_with_gemini(topic, image_quality, tone, platform, reference_image_base64, final_image_prompt)
        caption = await generate_caption_with_gemini(topic, platform, tone, image_quality, keywords, product_info, db=db, user=current_user)
    except Exception as e:
        print(f"Generation error: {e}")
        from urllib.parse import quote
        seed = quote(f"{topic}-{image_quality}-{uuid.uuid4().hex}")
        image_url = f"https://picsum.photos/seed/{seed}/800/800"
        caption = generate_fallback_caption(topic, platform, tone, keywords, product_info)
        generation_status = "completed"  # 使用 fallback 仍算完成
        error_msg = f"使用備用生成: {str(e)}"
    
    generation_duration = int((time.time() - start_time) * 1000)
    
    # 記錄生成歷史
    history = GenerationHistory(
        user_id=current_user.id,
        generation_type="social_image",
        status=generation_status,
        input_params={
            "topic": topic,
            "platform": platform,
            "quality": image_quality,
            "tone": tone,
            "keywords": keywords,
            "has_reference": bool(reference_image_base64),
        },
        output_data={
            "image_url": image_url,
            "caption_length": len(caption) if caption else 0,
        },
        media_cloud_url=image_url,
        credits_used=cost,
        generation_duration_ms=generation_duration,
        error_message=error_msg,
    )
    db.add(history)
    db.commit()

    return SocialResponse(image_url=image_url, caption=caption, reference_analysis=reference_image_analysis if reference_image_base64 else None)


@router.post("/suggest", response_model=SuggestResponse)
async def suggest_fields(
    request: SuggestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """根據主題生成欄位建議"""
    cost = 2
    
    # 使用 CreditService 扣點並記錄交易
    credit_service = CreditService(db)
    consume_result = credit_service.consume_direct(
        user_id=current_user.id,
        cost=cost,
        transaction_type=TransactionType.CONSUME_SOCIAL_IMAGE,
        description=f"欄位建議 - {request.topic[:30] if request.topic else '建議'}",
        reference_type="social_suggest",
        metadata={
            "topic": request.topic,
            "platform": request.platform,
        }
    )
    
    if not consume_result.success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=consume_result.error or "Insufficient credits. 需要 2 點。")
    
    platform_names = {"instagram": "Instagram", "facebook": "Facebook", "tiktok": "TikTok", "pinterest": "Pinterest", "threads": "Threads", "linkedin": "LinkedIn", "xiaohongshu": "小紅書", "line": "LINE"}
    platform_name = platform_names.get(request.platform, "Instagram")
    
    prompt = f"""針對「{request.topic}」在 {platform_name} 平台，提供以下建議（JSON格式）：

1. keywords：8-10個相關高流量關鍵詞，用逗號分隔
2. image_prompt：50-80字的視覺描述（場景、光線、色調、氛圍），不含文字元素
3. product_info：商品/服務資訊（名稱、特色、適合對象）

只回覆JSON：
{{"keywords": "...", "image_prompt": "...", "product_info": "..."}}"""

    try:
        for model_name in ["models/gemini-2.5-flash", "models/gemini-2.0-flash", "models/gemini-flash-latest"]:
            try:
                model = genai.GenerativeModel(model_name)
                response = await asyncio.wait_for(asyncio.to_thread(model.generate_content, prompt), timeout=30.0)
                
                if response and response.text:
                    text = response.text.strip()
                    text = re.sub(r'```json\s*', '', text)
                    text = re.sub(r'```\s*', '', text)
                    
                    try:
                        suggestions = json.loads(text)
                        return SuggestResponse(
                            keywords=suggestions.get("keywords", ""),
                            image_prompt=suggestions.get("image_prompt", ""),
                            product_info=suggestions.get("product_info", "")
                        )
                    except json.JSONDecodeError:
                        json_match = re.search(r'\{[^{}]*"keywords"[^{}]*\}', text, re.DOTALL)
                        if json_match:
                            suggestions = json.loads(json_match.group())
                            return SuggestResponse(
                                keywords=suggestions.get("keywords", ""),
                                image_prompt=suggestions.get("image_prompt", ""),
                                product_info=suggestions.get("product_info", "")
                            )
            except Exception as e:
                print(f"Suggest model {model_name} failed: {e}")
                continue
        
        raise Exception("All models failed")
        
    except Exception as e:
        print(f"Suggestion error: {e}")
        return generate_fallback_suggestions(request.topic, request.platform)


def generate_fallback_suggestions(topic: str, platform: str) -> SuggestResponse:
    """生成備用建議"""
    topic_words = topic.replace("：", " ").replace(":", " ").replace("、", " ").split()
    keywords_list = [w.strip() for w in topic_words if len(w.strip()) > 1][:5]
    
    platform_tags = {
        "instagram": ["打卡", "美食", "生活"],
        "xiaohongshu": ["種草", "推薦", "必買"],
    }
    keywords_list.extend(platform_tags.get(platform, ["推薦", "分享"])[:2])
    
    return SuggestResponse(
        keywords=", ".join(keywords_list),
        image_prompt=f"專業攝影風格呈現「{topic}」，自然光線，精緻構圖，色彩溫暖，主體清晰，背景簡潔有層次",
        product_info=f"【{topic}】\n✨ 特色：品質優良\n👥 適合：追求生活品質的你\n💡 推薦：值得體驗"
    )
