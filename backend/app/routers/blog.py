from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Literal, Optional
from datetime import datetime
import os
import uuid
import base64
import asyncio
import json
import re
import time
import google.generativeai as genai

from app.database import get_db
from app.models import User, Post, GenerationHistory
from app.routers.auth import get_current_user
from app.services.ai_generator import generate_blog_post
from app.services.credit_service import CreditService, TransactionType

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

# 部落格封面風格 - 豐富多元的視覺風格
BLOG_COVER_STYLES = {
    "professional": {
        "mood": "clean, authoritative, trustworthy, sophisticated",
        "colors": "deep navy blue, charcoal gray, crisp white, subtle gold accents",
        "lighting": "soft diffused studio lighting with professional edge lighting",
        "composition": "balanced asymmetric layout with strong focal point",
        "texture": "smooth gradients, subtle geometric patterns"
    },
    "casual": {
        "mood": "relaxed, approachable, authentic, lifestyle-oriented",
        "colors": "warm terracotta, sage green, cream, soft coral",
        "lighting": "natural window light, soft afternoon glow",
        "composition": "organic flow, comfortable negative space",
        "texture": "natural materials, fabric textures, organic shapes"
    },
    "friendly": {
        "mood": "warm, welcoming, optimistic, human-centered",
        "colors": "sunshine yellow, coral pink, sky blue, fresh mint",
        "lighting": "golden hour warmth, soft fill light",
        "composition": "inviting perspective, eye-level engaging view",
        "texture": "smooth with playful rounded elements"
    },
    "humorous": {
        "mood": "playful, witty, energetic, surprising",
        "colors": "vibrant magenta, electric blue, lime green, hot orange",
        "lighting": "bright pop-art style, bold contrast",
        "composition": "dynamic angles, unexpected cropping",
        "texture": "bold patterns, graphic elements, Memphis design"
    },
    "educational": {
        "mood": "inspiring, clear, innovative, knowledge-focused",
        "colors": "teal, amber, off-white, deep indigo",
        "lighting": "crisp even lighting, slight rim light for depth",
        "composition": "structured grid with focal hierarchy",
        "texture": "clean lines, infographic-inspired elements"
    },
    "creative": {
        "mood": "artistic, imaginative, expressive, unique",
        "colors": "vibrant complementary colors, unexpected color combinations",
        "lighting": "dramatic chiaroscuro, artistic shadows, studio lighting with colored gels",
        "composition": "rule-breaking, abstract elements, dynamic diagonal lines",
        "texture": "painterly brushstrokes, mixed media feel, impasto texture",
        "cinematic": "Wes Anderson symmetry, Studio Ghibli inspired, Pixar quality render, artistic film grain, 35mm anamorphic look"
    },
    "tech": {
        "mood": "futuristic, innovative, cutting-edge, sleek",
        "colors": "electric cyan, neon purple, dark charcoal, holographic",
        "lighting": "dramatic backlighting, neon glow, tech ambiance, volumetric fog",
        "composition": "geometric precision, isometric perspective, sci-fi establishing shot",
        "texture": "smooth gradients, glass effects, digital patterns, holographic surfaces",
        "cinematic": "Unreal Engine 5 render, Octane raytracing, cyberpunk aesthetics, Blade Runner 2049 style, IMAX quality, 8K resolution"
    },
    "nature": {
        "mood": "serene, organic, fresh, eco-conscious",
        "colors": "forest green, ocean blue, sunset orange, earth brown",
        "lighting": "natural golden hour sunlight, dappled light through leaves, atmospheric haze",
        "composition": "organic flow, natural framing, wide establishing shot",
        "texture": "organic textures, botanical elements, water ripples, morning dew",
        "cinematic": "National Geographic quality, Planet Earth cinematography, drone aerial perspective, 8K ultra HD, cinematic color grading"
    },
    "luxury": {
        "mood": "elegant, premium, refined, exclusive",
        "colors": "rich burgundy, deep emerald, champagne gold, black",
        "lighting": "soft glamour lighting, subtle sparkle, dramatic chiaroscuro",
        "composition": "sophisticated minimalism, ample breathing room, fashion editorial framing",
        "texture": "velvet, marble, metallic foil, silk, fine leather",
        "cinematic": "Vogue editorial quality, high-end commercial photography, medium format render, luxury brand aesthetic, Tom Ford visual style"
    },
    "vintage": {
        "mood": "nostalgic, timeless, romantic, storytelling",
        "colors": "sepia tones, dusty rose, aged cream, antique gold",
        "lighting": "warm vintage film grain, soft vignette",
        "composition": "classic proportions, retro framing",
        "texture": "aged paper, film grain, vintage patina"
    },
    "faith": {
        "mood": "sacred, peaceful, hopeful, spiritually uplifting, reverent, majestic",
        "colors": "heavenly gold, pure white, deep royal purple, soft dove gray, celestial blue, warm amber",
        "lighting": "divine volumetric god rays, soft ethereal glow, warm sunrise ambiance, dramatic rim lighting, heavenly backlight with lens flare",
        "composition": "cinematic wide angle upward perspective, epic establishing shot, peaceful symmetry with rule of thirds, dolly zoom effect depth",
        "texture": "smooth flowing fabrics, soft volumetric clouds, gentle crepuscular rays, sacred geometry patterns",
        "cinematic": "Unreal Engine 5 quality, Octane render, photorealistic ray tracing, 8K ultra HD, IMAX film grain, anamorphic lens bokeh, Hollywood cinematography, Terrence Malick style visuals, Emmanuel Lubezki lighting"
    },
}

# 主題到風格的智能映射
TOPIC_STYLE_MAPPING = {
    # 科技類
    "科技": "tech", "AI": "tech", "人工智慧": "tech", "軟體": "tech", "程式": "tech",
    "區塊鏈": "tech", "元宇宙": "tech", "數位": "tech", "雲端": "tech", "5G": "tech",
    "手機": "tech", "電腦": "tech", "網路": "tech", "app": "tech", "技術": "tech",
    
    # 自然/環保類
    "自然": "nature", "環保": "nature", "植物": "nature", "花卉": "nature", "森林": "nature",
    "海洋": "nature", "動物": "nature", "生態": "nature", "綠色": "nature", "永續": "nature",
    "旅遊": "nature", "戶外": "nature", "露營": "nature", "登山": "nature",
    
    # 創意/藝術類
    "設計": "creative", "藝術": "creative", "創意": "creative", "繪畫": "creative",
    "攝影": "creative", "音樂": "creative", "電影": "creative", "文化": "creative",
    
    # 商業/專業類
    "商業": "professional", "企業": "professional", "金融": "professional", "投資": "professional",
    "管理": "professional", "策略": "professional", "領導": "professional", "職場": "professional",
    
    # 教育類
    "教育": "educational", "學習": "educational", "課程": "educational", "知識": "educational",
    "技能": "educational", "培訓": "educational", "研究": "educational",
    
    # 生活/休閒類
    "生活": "casual", "美食": "casual", "烹飪": "casual", "咖啡": "casual", "茶": "casual",
    "居家": "casual", "家庭": "casual", "親子": "casual", "寵物": "casual",
    
    # 時尚/奢華類
    "時尚": "luxury", "精品": "luxury", "珠寶": "luxury", "手錶": "luxury", "奢華": "luxury",
    "品牌": "luxury", "美妝": "luxury", "保養": "luxury",
    
    # 健康/運動類
    "健康": "friendly", "運動": "friendly", "健身": "friendly", "瑜珈": "friendly",
    "營養": "friendly", "減肥": "friendly", "養生": "friendly", "醫療": "friendly",
    
    # 娛樂/幽默類
    "娛樂": "humorous", "遊戲": "humorous", "趣味": "humorous", "搞笑": "humorous",
    "meme": "humorous", "有趣": "humorous",
    
    # 復古/懷舊類
    "復古": "vintage", "懷舊": "vintage", "經典": "vintage", "歷史": "vintage",
    "傳統": "vintage", "文化遺產": "vintage",
    
    # 信仰/宗教類
    "信仰": "faith", "聖經": "faith", "基督": "faith", "耶穌": "faith", "上帝": "faith",
    "福音": "faith", "教會": "faith", "禱告": "faith", "靈修": "faith", "神": "faith",
    "主日": "faith", "敬拜": "faith", "讚美": "faith", "恩典": "faith", "救恩": "faith",
    "十字架": "faith", "復活": "faith", "天國": "faith", "聖靈": "faith", "見證": "faith",
    "牧師": "faith", "傳道": "faith", "宣教": "faith", "門徒": "faith", "屬靈": "faith",
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
    cover_image: Optional[str] = None  # 封面圖片 URL
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
# 品質提升 - 強調真實感，去除 AI 感
SD_QUALITY_BOOSTERS = """masterpiece, best quality, ultra-detailed, high resolution, 8K UHD, 
professional photography by award-winning photographer, shot on Hasselblad H6D-400C, 
natural film grain, authentic lighting, genuine texture, organic imperfections,
real-world photography, editorial quality, magazine cover worthy,
subtle lens characteristics, true-to-life colors, human-crafted aesthetic,
cinematic color grading, Kodak Portra 400 film emulation, analog warmth"""

# 專門用於 API 的 negative_prompt 參數 - 強調去除文字、AI 特徵和陳腔濫調
NEGATIVE_PROMPT_FOR_API = """
=== 絕對禁止任何文字 ===
text, words, letters, alphabet, characters, Chinese characters, 中文, 漢字, 繁體字, 簡體字,
Japanese text, Korean text, any language text, readable text, legible text,
numbers, digits, typography, font, titles, captions, subtitles, labels, 
watermark, signature, logo, brand name, slogan, tagline, quote,
signs, banners, posters with text, text overlay, text on image,

=== 去除 AI 特徵 ===
AI generated, artificial looking, plastic skin, waxy texture, uncanny valley, 
overly smooth, unnaturally perfect, synthetic appearance, CGI look, 
hyper-saturated colors, over-processed, HDR artifacts, unnatural symmetry,
stock photo aesthetic, generic composition, soulless, lifeless expression,
oversaturated, overexposed, cartoon-like, video game render, 3D render look,
deepfake appearance, morph artifacts, blending errors, anatomical errors,

=== 品質問題 ===
lowres, blurry, bad quality, jpeg artifacts, pixelated,

=== 陳腔濫調 ===
cliché imagery, generic religious iconography, predictable composition,
praying hands clipart, generic cross silhouette, cheap church graphics,
motivational poster style, greeting card aesthetic, cheesy spiritual imagery"""


def detect_topic_style(topic: str) -> str:
    """根據主題智能檢測最適合的視覺風格"""
    topic_lower = topic.lower()
    
    # 檢查主題關鍵字
    for keyword, style in TOPIC_STYLE_MAPPING.items():
        if keyword.lower() in topic_lower:
            return style
    
    # 預設返回 professional
    return "professional"


async def generate_topic_visual_prompt(topic: str, detected_style: str = "") -> dict:
    """使用 AI 根據主題生成視覺描述 - 強調主題獨特性"""
    if not GOOGLE_GEMINI_KEY:
        return {}
    
    try:
        model = genai.GenerativeModel("models/gemini-2.5-flash")
        
        # 針對信仰類別的特殊處理 - 要求多樣化
        if detected_style == "faith":
            prompt = f"""作為頂尖的視覺設計師，為這篇基督信仰相關文章設計一個【獨一無二】的封面圖。

文章主題：{topic}

【重要規則】
1. 必須根據這個【具體主題】設計視覺，不要用泛用的宗教意象
2. 避免陳腔濫調：禁止使用「天空雲彩配光芒」、「十字架剪影」、「雙手禱告」等老套畫面
3. 用隱喻/象徵手法表達主題核心精神
4. 參考高端藝術攝影、美術館級作品的美學
5. 每次生成都要不同，避免重複

【視覺風格參考】
- 文藝復興大師（卡拉瓦喬、林布蘭）的光影戲劇性
- 現代極簡藝術攝影（如 Gregory Crewdson、Erwin Olaf）
- 抽象概念攝影（光、影、材質的詩意表達）
- 自然界的神聖秩序（斐波那契螺旋、分形幾何）
- 建築空間的莊嚴感（教堂穹頂、光影長廊）

請分析文章主題，用 JSON 格式回答（只輸出 JSON）：
{{
    "visual_subject": "一個具體、獨特、能象徵這篇文章核心概念的畫面（80字內）。舉例：如果主題是「等候神」，可以是「清晨薄霧中一棵古老橄欖樹，沉穩佇立，陽光穿透樹冠灑落金色光斑」",
    "symbolic_meaning": "這個畫面如何象徵文章主題",
    "color_palette": "5個適合這個主題情緒的顏色（用英文）",
    "mood": "情緒氛圍（用英文）",
    "art_style": "具體的藝術風格參考（如 Caravaggio chiaroscuro, minimalist fine art）",
    "lighting": "光線設計細節",
    "composition": "構圖與景深建議",
    "unique_element": "一個讓這張圖片獨特難忘的視覺元素"
}}"""
        else:
            prompt = f"""作為頂尖視覺設計師，為這篇部落格文章設計一個【獨一無二】的封面圖。

文章主題：{topic}

【重要規則】
1. 視覺主體必須與【這個具體主題】直接相關，不要泛用意象
2. 避免 stock photo 風格，追求藝術性與原創性
3. 畫面要有故事感，能引發讀者好奇
4. 參考高端品牌廣告、時尚雜誌、藝術攝影的美學

請用 JSON 格式回答（只輸出 JSON）：
{{
    "visual_subject": "一個具體、獨特、與主題直接相關的畫面描述（80字內）",
    "color_palette": "5個最適合這個主題的顏色（用英文）",
    "mood": "整體氛圍（用英文）",
    "art_style": "藝術風格（如 editorial photography, fine art, conceptual）",
    "lighting": "光線設計",
    "composition": "構圖建議",
    "unique_element": "一個讓這張圖片獨特難忘的視覺元素"
}}"""
        
        response = await asyncio.wait_for(
            asyncio.to_thread(model.generate_content, prompt),
            timeout=20.0
        )
        
        if response and response.text:
            text = response.text.strip()
            # 清理 JSON
            text = re.sub(r'```json\s*', '', text)
            text = re.sub(r'```\s*', '', text)
            
            try:
                result = json.loads(text)
                print(f"[Blog] AI 視覺分析成功: {result.get('visual_subject', '')[:50]}...")
                return result
            except:
                # 嘗試提取 JSON
                json_match = re.search(r'\{.*\}', text, re.DOTALL)
                if json_match:
                    try:
                        return json.loads(json_match.group())
                    except:
                        pass
        return {}
        
    except Exception as e:
        print(f"[Blog] AI 視覺分析失敗: {e}")
        return {}


# --- 信仰類別的多樣化視覺元素 ---
FAITH_VISUAL_VARIATIONS = [
    # 自然象徵
    {"scene": "ancient olive tree in morning mist, golden sunlight filtering through branches, dewdrops on leaves", "mood": "patience, waiting on God"},
    {"scene": "single wheat stalk standing tall in golden field, wind gently moving, sunset backdrop", "mood": "faith, harvest"},
    {"scene": "river flowing over smooth stones, crystal clear water, mountain valley setting", "mood": "living water, peace"},
    {"scene": "eagle soaring above misty mountains, wings spread wide, dramatic sky", "mood": "rise above, strength"},
    {"scene": "lotus flower emerging from dark water, pristine white petals, morning light", "mood": "purity, renewal"},
    {"scene": "old vine with new green shoots, textured bark, spring morning", "mood": "abide, growth"},
    
    # 光影藝術
    {"scene": "single beam of light through ancient stone window, dust particles dancing, cathedral interior", "mood": "divine presence, revelation"},
    {"scene": "candle flame in complete darkness, warm glow on weathered hands holding it", "mood": "hope in darkness"},
    {"scene": "shadow of cross on weathered stone wall, late afternoon golden light", "mood": "salvation, memorial"},
    {"scene": "prismatic light through antique glass, rainbow spectrum on old book pages", "mood": "promise, covenant"},
    
    # 旅程意象
    {"scene": "narrow path through misty forest, sunlight breaking through at the end", "mood": "the way, journey"},
    {"scene": "ancient door slightly ajar, warm light spilling through, stone archway", "mood": "invitation, opportunity"},
    {"scene": "footprints on sandy beach at sunrise, waves gently washing", "mood": "following, trust"},
    {"scene": "winding staircase in old tower, light from above, spiral upward", "mood": "ascension, growth"},
    
    # 材質隱喻
    {"scene": "potter's hands shaping clay on wheel, close-up, warm studio light", "mood": "formation, purpose"},
    {"scene": "bread broken on rustic wooden table, wheat stalks nearby, warm light", "mood": "communion, provision"},
    {"scene": "oil lamp with gentle flame, ancient design, warm ambient glow", "mood": "wisdom, guidance"},
    {"scene": "scroll partially unrolled on wooden desk, soft natural light", "mood": "scripture, wisdom"},
    
    # 建築空間
    {"scene": "empty wooden pew in quiet chapel, stained glass light patterns", "mood": "stillness, prayer"},
    {"scene": "bell tower silhouette against orange sunrise, birds in flight", "mood": "call, awakening"},
    {"scene": "arched stone corridor with repeating columns, light at end", "mood": "sanctuary, eternity"},
    {"scene": "simple wooden cross on hilltop, dramatic cloud formation, wide angle", "mood": "sacrifice, victory"},
    
    # 抽象概念
    {"scene": "two hands almost touching, Michelangelo inspired, dramatic lighting", "mood": "creation, connection"},
    {"scene": "single perfect rose with thorns, dramatic chiaroscuro lighting", "mood": "beauty from pain"},
    {"scene": "mirror on dark surface reflecting light above, minimalist", "mood": "reflection, truth"},
    {"scene": "anchor resting on sandy ocean floor, underwater light rays", "mood": "hope, steadfast"},
]

import random

def get_faith_visual_fallback(topic: str) -> dict:
    """為信仰類別生成隨機多樣化的視覺元素"""
    # 嘗試從主題中提取關鍵概念來選擇相關場景
    topic_lower = topic.lower()
    
    # 根據主題關鍵字加權選擇
    weighted_scenes = []
    for scene_info in FAITH_VISUAL_VARIATIONS:
        weight = 1
        # 如果場景的 mood 與主題相關，增加權重
        mood_words = scene_info["mood"].lower().split(", ")
        for word in mood_words:
            if word in topic_lower:
                weight = 5
                break
        weighted_scenes.extend([scene_info] * weight)
    
    # 隨機選擇
    selected = random.choice(weighted_scenes)
    return {
        "visual_subject": selected["scene"],
        "mood": selected["mood"],
        "unique_element": "dramatic lighting with cinematic depth"
    }


# --- 圖片生成函數 ---
async def generate_blog_cover(
    topic: str, 
    style: str, 
    quality: str, 
    custom_prompt: Optional[str] = None,
    reference_analysis: Optional[str] = None
) -> tuple[str, str]:
    """生成部落格封面圖片 - 智能適應主題風格"""
    from urllib.parse import quote

    quality_config = QUALITY_CONFIG.get(quality, QUALITY_CONFIG["standard"])
    
    # 智能檢測最適合的風格
    detected_style = detect_topic_style(topic)
    # 如果用戶選擇的是 professional（預設），則使用智能檢測的風格
    actual_style = detected_style if style == "professional" else style
    style_config = BLOG_COVER_STYLES.get(actual_style, BLOG_COVER_STYLES["professional"])
    
    print(f"[Blog] 主題: {topic}, 用戶選擇風格: {style}, 智能檢測: {detected_style}, 實際使用: {actual_style}")
    
    # 嘗試使用 AI 生成主題專屬視覺描述
    ai_visual = {}
    if not reference_analysis and not custom_prompt:
        ai_visual = await generate_topic_visual_prompt(topic, detected_style)
        if ai_visual:
            print(f"[Blog] AI 視覺分析成功: {ai_visual.get('visual_subject', '')[:80]}...")
        elif actual_style == "faith":
            # 信仰類別如果 AI 失敗，使用多樣化備選
            ai_visual = get_faith_visual_fallback(topic)
            print(f"[Blog] 使用信仰備選視覺: {ai_visual.get('visual_subject', '')[:50]}...")

    # 構建主題描述
    if reference_analysis:
        visual_desc = f"Create a blog cover image inspired by this reference style: {reference_analysis}. The image should be about {topic}."
        if custom_prompt and custom_prompt.strip():
            visual_desc += f" Additional requirements: {custom_prompt.strip()}"
    elif custom_prompt and custom_prompt.strip():
        visual_desc = f"{custom_prompt.strip()}, for blog article about {topic}"
    elif ai_visual:
        # 使用 AI 生成的視覺描述 - 強調獨特性
        unique_elem = ai_visual.get('unique_element', '')
        visual_desc = f"""Create a UNIQUE and ARTISTIC blog cover image:

PRIMARY SUBJECT (most important - this must be the main focus):
{ai_visual.get('visual_subject', topic)}

ARTISTIC INTERPRETATION:
- Art Style: {ai_visual.get('art_style', 'fine art photography, editorial quality')}
- Symbolic Meaning: {ai_visual.get('symbolic_meaning', 'representing the core theme')}

VISUAL ELEMENTS:
- Colors: {ai_visual.get('color_palette', style_config['colors'])}
- Mood: {ai_visual.get('mood', style_config['mood'])}
- Lighting: {ai_visual.get('lighting', style_config['lighting'])}
- Composition: {ai_visual.get('composition', style_config['composition'])}
{f'- Unique Element: {unique_elem}' if unique_elem else ''}

CRITICAL: The image must be visually distinctive and directly related to the specific topic "{topic}". DO NOT use generic or clichéd imagery."""
    else:
        visual_desc = f"Create a captivating blog cover image about {topic}"
    
    # 動態選擇色彩和氛圍
    colors = ai_visual.get('color_palette', style_config['colors']) if ai_visual else style_config['colors']
    mood = ai_visual.get('mood', style_config['mood']) if ai_visual else style_config['mood']
    lighting = ai_visual.get('lighting', style_config['lighting']) if ai_visual else style_config['lighting']
    composition = ai_visual.get('composition', style_config['composition']) if ai_visual else style_config['composition']
    texture = style_config.get('texture', 'smooth with subtle details')
    cinematic = style_config.get('cinematic', '')
    
    # 構建電影級渲染提示（如果有）
    cinematic_section = ""
    if cinematic:
        cinematic_section = f"""
=== CINEMATIC & RENDERING ===
{cinematic}
"""
    
    # 針對信仰類別的額外指令
    faith_instructions = ""
    if actual_style == "faith":
        faith_instructions = """
=== FAITH IMAGERY GUIDELINES ===
AVOID these clichéd elements:
- Generic "god rays through clouds" backgrounds
- Floating hands in prayer pose
- Cross silhouette against sunset
- Generic dove flying
- Motivational poster aesthetics
- Cheap church graphics style

INSTEAD, create:
- Artistic, museum-quality imagery
- Thoughtful metaphorical representations
- Caravaggio/Rembrandt level lighting drama
- Fine art photography aesthetic
- Unique visual metaphors for spiritual concepts
"""

    # 構建提示詞 - 禁止文字的指令放在最前面（多次強調）
    prompt = f"""[ABSOLUTE CRITICAL RULE - ZERO TEXT ALLOWED]:
⛔ DO NOT include ANY text, words, letters, characters, or typography in the image.
⛔ NO Chinese characters (中文/漢字/繁體/簡體) - absolutely forbidden.
⛔ NO English text, NO Japanese, NO Korean, NO text in ANY language.
⛔ NO numbers, NO watermarks, NO logos, NO labels, NO captions.
⛔ The image must be 100% PURE VISUAL with ZERO readable content.
⛔ If you add any text, the image will be rejected.

[UNIQUENESS RULE]: This image MUST be visually distinctive and specifically relevant to this exact topic: "{topic}". Do NOT use generic, stock-photo-style imagery. Create something an art director would be proud of.

{visual_desc}

{SD_QUALITY_BOOSTERS}
{faith_instructions}
=== VISUAL DESIGN ===
MOOD & ATMOSPHERE: {mood}
COLOR PALETTE: {colors}
LIGHTING DESIGN: {lighting}
COMPOSITION: {composition}
TEXTURE & DETAILS: {texture}
{cinematic_section}
=== TECHNICAL SPECS ===
Format: 16:9 horizontal wide format blog cover
Quality: {quality_config['quality']}

=== QUALITY REQUIREMENTS ===
- Award-winning visual quality (think National Geographic, Vogue, museum exhibition)
- Sharp focus with beautiful bokeh where appropriate
- Rich, nuanced colors matching the topic mood
- Cinematic lighting with dimensional depth
- Clean, polished aesthetic with subtle imperfections for authenticity
- High contrast and visual impact
- Emotionally engaging composition that tells a story
- Each image should feel like a unique piece of art
- ABSOLUTELY NO TEXT IN THE IMAGE
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
    
    # 使用 CreditService 扣點並記錄交易
    credit_service = CreditService(db)
    consume_result = credit_service.consume_direct(
        user_id=current_user.id,
        cost=COST,
        transaction_type=TransactionType.CONSUME_BLOG_POST,
        description=f"部落格生成 - {request.topic[:30] if request.topic else '文章'}",
        reference_type="blog_post",
        metadata={
            "topic": request.topic,
            "tone": request.tone,
        }
    )
    
    if not consume_result.success:
        raise HTTPException(status_code=402, detail=consume_result.error or "Insufficient credits")

    start_time = time.time()
    try:
        content = await generate_blog_post(request.topic, request.tone, db=db)
        generation_duration = int((time.time() - start_time) * 1000)
        
        new_post = Post(
            title=request.topic,
            content=content,
            user_id=current_user.id,
            status="draft"
        )
        db.add(new_post)
        db.commit()
        db.refresh(new_post)
        
        # 記錄生成歷史
        history = GenerationHistory(
            user_id=current_user.id,
            generation_type="blog_post",
            status="completed",
            input_params={
                "topic": request.topic,
                "tone": request.tone,
            },
            output_data={
                "post_id": new_post.id,
                "title": new_post.title,
                "content_length": len(content),
            },
            credits_used=COST,
            generation_duration_ms=generation_duration,
        )
        db.add(history)
        db.commit()
        
    except Exception as e:
        # 記錄失敗歷史
        history = GenerationHistory(
            user_id=current_user.id,
            generation_type="blog_post",
            status="failed",
            input_params={
                "topic": request.topic,
                "tone": request.tone,
            },
            credits_used=COST,
            error_message=str(e),
        )
        db.add(history)
        db.commit()
        
        raise HTTPException(status_code=500, detail=str(e))
    
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


# 4.5 批量刪除文章
class BatchDeleteRequest(BaseModel):
    post_ids: List[int]

@router.post("/posts/batch-delete")
def batch_delete_posts(
    request: BatchDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """批量刪除多篇文章"""
    if not request.post_ids:
        raise HTTPException(status_code=400, detail="請選擇要刪除的文章")
    
    # 只刪除屬於當前用戶的文章
    deleted_count = db.query(Post).filter(
        Post.id.in_(request.post_ids),
        Post.user_id == current_user.id
    ).delete(synchronize_session=False)
    
    db.commit()
    return {"message": f"已刪除 {deleted_count} 篇文章", "deleted_count": deleted_count}


# 5. 生成部落格封面圖片 (支援參考圖片)
@router.post("/generate-image", response_model=ImageResponse)
async def generate_blog_image(
    topic: str = Form(...),
    style: str = Form("professional"),
    quality: ImageQuality = Form("standard"),
    custom_prompt: Optional[str] = Form(None),
    reference_image: Optional[UploadFile] = File(None),
    post_id: Optional[int] = Form(None),  # 可選的文章 ID，用於自動更新封面
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """生成部落格封面圖片（支援參考圖片）"""
    quality_config = QUALITY_CONFIG.get(quality, QUALITY_CONFIG["standard"])
    cost = quality_config["cost"]
    
    # 使用 CreditService 扣點並記錄交易
    credit_service = CreditService(db)
    consume_result = credit_service.consume_direct(
        user_id=current_user.id,
        cost=cost,
        transaction_type=TransactionType.CONSUME_SOCIAL_IMAGE,
        description=f"部落格封面圖 - {topic[:30] if topic else '圖片'}",
        reference_type="blog_image",
        metadata={
            "topic": topic,
            "style": style,
            "quality": quality,
        }
    )
    
    if not consume_result.success:
        raise HTTPException(
            status_code=402, 
            detail=consume_result.error or f"Insufficient credits. 需要 {cost} 點"
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

    start_time = time.time()
    try:
        image_url, prompt_used = await generate_blog_cover(
            topic,
            style,
            quality,
            custom_prompt,
            reference_analysis
        )
        generation_duration = int((time.time() - start_time) * 1000)
        
        # 記錄生成歷史
        history = GenerationHistory(
            user_id=current_user.id,
            generation_type="blog_image",
            status="completed",
            input_params={
                "topic": topic,
                "style": style,
                "quality": quality,
                "custom_prompt": custom_prompt,
                "has_reference": bool(reference_image),
            },
            output_data={
                "image_url": image_url,
                "prompt_used": prompt_used[:200] if prompt_used else None,
                "post_id": post_id,
            },
            media_cloud_url=image_url,
            credits_used=cost,
            generation_duration_ms=generation_duration,
        )
        db.add(history)
        
        # 如果提供了 post_id，則自動更新文章的封面圖片
        if post_id:
            post = db.query(Post).filter(
                Post.id == post_id,
                Post.user_id == current_user.id
            ).first()
            if post:
                post.cover_image = image_url
                print(f"[Blog] 已更新文章 {post_id} 的封面圖片")
        
        db.commit()
        
    except Exception as e:
        # 記錄失敗歷史
        history = GenerationHistory(
            user_id=current_user.id,
            generation_type="blog_image",
            status="failed",
            input_params={
                "topic": topic,
                "style": style,
                "quality": quality,
            },
            credits_used=cost,
            error_message=str(e),
        )
        db.add(history)
        db.commit()
        
        raise HTTPException(status_code=500, detail=str(e))

    return ImageResponse(
        image_url=image_url, 
        prompt_used=prompt_used,
        reference_analysis=reference_analysis if reference_analysis else None
    )
