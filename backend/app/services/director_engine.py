"""
AI Director Engine - 短影音導演引擎
=======================================
核心職責：將模糊需求 + 品牌基因 + 角色資產 → 結構化生成指令

「反通用化」規則：每個 Prompt 都必須與 BrandProfile 進行交互
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Dict, Any
from enum import Enum
import json
import os
import google.generativeai as genai

# Configure Gemini
GOOGLE_GEMINI_KEY = os.getenv("GOOGLE_GEMINI_KEY")
if GOOGLE_GEMINI_KEY:
    genai.configure(api_key=GOOGLE_GEMINI_KEY)


# ============================================================
# 1. 品牌基因 (Brand DNA) - 定義品牌的核心特質
# ============================================================

class BrandPersonality(str, Enum):
    """品牌性格類型"""
    PROFESSIONAL = "professional"      # 專業權威
    FRIENDLY = "friendly"              # 親切友善
    LUXURIOUS = "luxurious"            # 奢華高端
    PLAYFUL = "playful"                # 活潑有趣
    MINIMALIST = "minimalist"          # 極簡現代
    INNOVATIVE = "innovative"          # 創新前衛
    TRUSTWORTHY = "trustworthy"        # 可信賴
    ENERGETIC = "energetic"            # 活力充沛


class BrandProfile(BaseModel):
    """
    品牌設定檔 - 品牌的 DNA
    所有生成內容都必須與此交互，確保品牌一致性
    """
    # 基本資訊
    brand_name: str = Field(..., description="品牌名稱")
    tagline: Optional[str] = Field(None, description="品牌標語")
    industry: str = Field(..., description="所屬產業")
    
    # 品牌性格
    personality: BrandPersonality = Field(default=BrandPersonality.FRIENDLY, description="品牌性格")
    tone_of_voice: str = Field(default="親切、專業、有溫度", description="說話語氣")
    
    # 視覺識別
    primary_color: str = Field(default="#6366F1", description="主色調 (HEX)")
    secondary_color: str = Field(default="#8B5CF6", description="輔助色 (HEX)")
    visual_style: str = Field(default="modern, clean", description="視覺風格關鍵字")
    
    # 目標受眾
    target_audience: str = Field(default="25-45歲都市專業人士", description="目標受眾")
    audience_pain_points: List[str] = Field(default=[], description="受眾痛點")
    
    # 內容偏好
    preferred_themes: List[str] = Field(default=[], description="偏好主題")
    forbidden_themes: List[str] = Field(default=[], description="禁止主題")
    key_messages: List[str] = Field(default=[], description="核心訊息")
    
    # 語言風格
    language: str = Field(default="zh-TW", description="主要語言")
    use_emoji: bool = Field(default=True, description="是否使用表情符號")
    hashtag_style: str = Field(default="branded", description="hashtag 風格")


# ============================================================
# 2. 角色資產 (Avatar Assets) - 虛擬代言人設定
# ============================================================

class AvatarGender(str, Enum):
    MALE = "male"
    FEMALE = "female"
    NEUTRAL = "neutral"


class AvatarAsset(BaseModel):
    """虛擬代言人/角色設定"""
    name: str = Field(..., description="角色名稱")
    gender: AvatarGender = Field(default=AvatarGender.NEUTRAL)
    age_range: str = Field(default="25-35", description="年齡範圍")
    appearance: str = Field(default="", description="外觀描述")
    personality: str = Field(default="", description="性格特質")
    voice_style: str = Field(default="friendly, warm", description="聲音風格")
    
    # TTS 參數
    tts_voice_id: Optional[str] = Field(None, description="TTS 聲音 ID")
    tts_speed: float = Field(default=1.0, description="語速 (0.5-2.0)")
    tts_pitch: float = Field(default=1.0, description="音調 (0.5-2.0)")


# ============================================================
# 3. 影片專案結構 (Video Project Structure)
# ============================================================

class VideoFormat(str, Enum):
    """影片格式"""
    VERTICAL_9_16 = "9:16"      # TikTok, Reels, Shorts
    SQUARE_1_1 = "1:1"          # Instagram Feed
    HORIZONTAL_16_9 = "16:9"    # YouTube


class VideoDuration(str, Enum):
    """影片長度"""
    KLING_5 = "5"        # 5 秒 (Kling 模型)
    QUICK_8 = "8"        # 8 秒 (Veo 模型)
    KLING_10 = "10"      # 10 秒 (Kling 模型)
    SHORT_15 = "15"      # 15 秒
    MEDIUM_30 = "30"     # 30 秒
    LONG_60 = "60"       # 60 秒


class SceneType(str, Enum):
    """場景類型"""
    HOOK = "hook"                    # 開場吸引
    PROBLEM = "problem"              # 問題描述
    SOLUTION = "solution"            # 解決方案
    DEMONSTRATION = "demonstration"  # 產品展示
    TESTIMONIAL = "testimonial"      # 見證分享
    CTA = "cta"                      # 行動呼籲
    TRANSITION = "transition"        # 過場
    
    @classmethod
    def from_string(cls, value: str) -> "SceneType":
        """
        安全地將字串轉換為 SceneType
        處理 AI 可能生成的複合類型如 "hook/problem", "solution/cta" 等
        """
        if not value:
            return cls.HOOK
        
        # 標準化：轉小寫、去除空白
        value = value.lower().strip()
        
        # 直接匹配
        try:
            return cls(value)
        except ValueError:
            pass
        
        # 處理複合類型（取第一個）
        if "/" in value:
            first_part = value.split("/")[0].strip()
            try:
                return cls(first_part)
            except ValueError:
                pass
        
        # 處理連字號類型
        if "-" in value:
            first_part = value.split("-")[0].strip()
            try:
                return cls(first_part)
            except ValueError:
                pass
        
        # 模糊匹配
        mappings = {
            "opening": cls.HOOK,
            "intro": cls.HOOK,
            "attention": cls.HOOK,
            "pain": cls.PROBLEM,
            "challenge": cls.PROBLEM,
            "issue": cls.PROBLEM,
            "answer": cls.SOLUTION,
            "fix": cls.SOLUTION,
            "demo": cls.DEMONSTRATION,
            "show": cls.DEMONSTRATION,
            "showcase": cls.DEMONSTRATION,
            "review": cls.TESTIMONIAL,
            "feedback": cls.TESTIMONIAL,
            "action": cls.CTA,
            "call": cls.CTA,
            "ending": cls.CTA,
            "outro": cls.CTA,
            "close": cls.CTA,
        }
        
        for key, scene_type in mappings.items():
            if key in value:
                return scene_type
        
        # 默認返回 HOOK
        return cls.HOOK


class SceneInstruction(BaseModel):
    """
    場景指令 - 給下游引擎的精確指令
    """
    scene_number: int
    scene_type: SceneType
    duration_seconds: float
    
    # 視覺指令 (給圖像/影片生成)
    visual_prompt: str = Field(..., description="視覺生成 Prompt")
    negative_prompt: str = Field(
        default="""=== ZERO TEXT - ABSOLUTE RULE ===
text, words, letters, alphabet, characters, typography, font, readable text,
Chinese characters, 中文, 漢字, 繁體字, 簡體字, Japanese text, Korean text,
any language text, numbers, digits, watermark, text overlay, logo, signature, 
username, copyright, labels, captions, subtitles, signs, banners,

=== TECHNICAL ISSUES ===
blurry, out of focus, soft focus, pixelated, low resolution, low quality, poor quality, 
distorted, warped, morphing, deformed, bad anatomy, extra limbs, mutated hands, missing fingers, extra fingers,
cropped, cut off, partial frame,
amateur, unprofessional, stock photo, generic, cliché, overused,
overexposed, blown highlights, underexposed, crushed blacks, flat lighting, harsh shadows, uneven lighting,
noisy, grainy, film grain (unless intentional), jpeg artifacts, compression artifacts, banding, posterization,
cluttered, busy background, distracting elements, messy composition,

=== AI ARTIFACTS ===
AI-generated look, uncanny valley, plastic skin, waxy appearance, lifeless eyes, unnatural pose,
cheap, tacky, dated, low-budget, DIY quality,
motion blur (unless intentional), camera shake, jitter, flickering,
color cast, wrong white balance, oversaturated, desaturated (unless intentional),
lens flare (unless intentional), chromatic aberration, vignetting (unless intentional)""",
        description="負面提示詞 - 避免生成的元素（含禁止任何文字）"
    )
    visual_style: str = Field(default="", description="視覺風格補充")
    camera_movement: str = Field(default="static", description="鏡頭運動")
    
    # 品質強化標籤
    quality_tags: str = Field(
        default="""masterpiece, best quality, ultra high resolution, 8K UHD, HDR,
professional cinematography, cinematic composition, rule of thirds, golden ratio,
premium production value, advertising campaign quality, broadcast ready,
razor sharp focus, tack sharp, crisp details, fine textures,
professional three-point lighting, soft key light, fill light, rim light, volumetric lighting,
perfect color grading, film-look color science, ACES color workflow,
shallow depth of field, beautiful bokeh, creamy background blur,
smooth gradients, rich tonal range, deep blacks, clean highlights,
photorealistic, hyperrealistic, lifelike, natural skin texture,
award-winning photography, magazine cover quality, editorial standard,
premium aesthetic, luxury brand quality, high-end commercial production""",
        description="品質強化標籤"
    )
    
    # 音訊指令 (給 TTS)
    narration_text: str = Field(default="", description="旁白文字")
    voice_emotion: str = Field(default="neutral", description="情緒表達")
    
    # 文字疊加
    text_overlay: Optional[str] = Field(None, description="螢幕文字")
    text_position: str = Field(default="center", description="文字位置")
    text_animation: str = Field(default="fade_in", description="文字動畫")
    
    # 音效/配樂
    background_music_mood: str = Field(default="upbeat", description="背景音樂情緒")
    sound_effects: List[str] = Field(default=[], description="音效標籤")


class VideoScript(BaseModel):
    """
    完整影片腳本 - Director Engine 的輸出
    """
    project_id: str
    title: str
    description: str
    
    # 格式設定
    format: VideoFormat
    total_duration: int  # 秒
    
    # 品牌關聯
    brand_profile: BrandProfile
    avatar: Optional[AvatarAsset] = None
    
    # 場景列表
    scenes: List[SceneInstruction]
    
    # 整體設定
    overall_style: str
    color_palette: List[str]
    music_genre: str
    target_platform: str


# ============================================================
# 4. Director Engine - 核心導演引擎
# ============================================================

class VideoRequest(BaseModel):
    """使用者的模糊需求輸入"""
    topic: str = Field(..., description="影片主題")
    goal: str = Field(default="awareness", description="目標：awareness/engagement/conversion")
    platform: str = Field(default="tiktok", description="目標平台")
    duration: VideoDuration = Field(default=VideoDuration.QUICK_8)
    format: VideoFormat = Field(default=VideoFormat.VERTICAL_9_16)
    
    # Kling 多場景模式：每個場景各自生成一支短片再串接
    # scene_count > 1 表示要生成多場景（每個場景 = 一次 Kling API 呼叫）
    scene_count: Optional[int] = Field(default=None, description="目標場景數（Kling 多場景時設定）")
    
    # 可選的額外資訊
    product_name: Optional[str] = None
    product_features: Optional[List[str]] = None
    key_message: Optional[str] = None
    reference_style: Optional[str] = None  # 參考風格


class DirectorEngine:
    """
    AI 導演引擎
    
    核心職責：
    1. 解析使用者模糊需求
    2. 與品牌基因交互，確保一致性
    3. 生成結構化的場景指令
    4. 輸出給下游引擎 (圖像/TTS/影片) 使用的精確 Prompts
    """
    
    def __init__(self):
        self.model = genai.GenerativeModel('gemini-1.5-flash') if GOOGLE_GEMINI_KEY else None
    
    async def generate_video_script(
        self,
        request: VideoRequest,
        brand: BrandProfile,
        avatar: Optional[AvatarAsset] = None
    ) -> VideoScript:
        """
        主入口：生成完整影片腳本
        """
        if not self.model:
            return self._generate_fallback_script(request, brand, avatar)
        
        # 1. 構建 System Prompt (注入品牌 DNA)
        system_prompt = self._build_system_prompt(brand, avatar)
        
        # 2. 構建 User Prompt (需求轉譯)
        user_prompt = self._build_user_prompt(request, brand)
        
        # 3. 調用 Gemini 生成腳本
        try:
            response = await self._call_gemini(system_prompt, user_prompt)
            script = self._parse_response(response, request, brand, avatar)
            return script
        except Exception as e:
            print(f"Gemini API 錯誤: {e}")
            return self._generate_fallback_script(request, brand, avatar, error=f"Gemini API Error: {str(e)}")
    
    def _build_system_prompt(self, brand: BrandProfile, avatar: Optional[AvatarAsset]) -> str:
        """
        構建 System Prompt - 注入品牌 DNA
        這是「反通用化」的核心：每個 prompt 都與品牌設定交互
        """
        avatar_section = ""
        if avatar:
            avatar_section = f"""
## 🎭 角色設定
- 代言人名稱：{avatar.name}
- 性別：{avatar.gender.value}
- 年齡範圍：{avatar.age_range}
- 外觀：{avatar.appearance}
- 性格：{avatar.personality}
- 聲音風格：{avatar.voice_style}
"""
        
        # 品牌性格對應的電影風格指南
        PERSONALITY_FILM_STYLES = {
            "professional": "如 Apple 廣告 - 極簡、精緻、產品至上",
            "friendly": "如 Google 廣告 - 溫暖、生活化、真實情感",
            "luxurious": "如 Chanel/Dior 廣告 - 華麗、慢動作、金色光暈",
            "playful": "如 Spotify 廣告 - 色彩繽紛、節奏快、動態圖形",
            "minimalist": "如 Muji 廣告 - 留白、安靜、自然材質",
            "innovative": "如 Tesla 廣告 - 科技感、未來主義、藍色光效",
            "trustworthy": "如 Nike 廣告 - 真實故事、紀錄片風格、情感共鳴",
            "energetic": "如 Red Bull 廣告 - 極限運動、快速剪輯、刺激感",
        }
        
        film_reference = PERSONALITY_FILM_STYLES.get(brand.personality.value, "專業商業廣告風格")
        
        # 檢查品牌名稱是否有效（非預設值且非空）
        has_brand = brand.brand_name and brand.brand_name not in ["我的品牌", "My Brand", "Brand", ""]
        
        # 根據是否有品牌名稱調整 prompt
        if has_brand:
            brand_intro = f"""你是一位獲獎的短影音導演，曾為國際品牌創作過多支病毒式傳播的影片。
現在你專門為「{brand.brand_name}」品牌創作內容。

## 🎯 品牌 DNA (必須嚴格遵守)
- 品牌名稱：{brand.brand_name}
- 標語：{brand.tagline or '無'}"""
        else:
            brand_intro = f"""你是一位獲獎的短影音導演，曾為國際品牌創作過多支病毒式傳播的影片。
現在你為客戶創作精彩的短影音內容。

## 🎯 創作 DNA (必須嚴格遵守)
- **重要**：旁白中請勿提及任何品牌名稱，保持通用性
- 標語：{brand.tagline or '無'}"""
        
        return f"""{brand_intro}
- 產業：{brand.industry}
- 品牌性格：{brand.personality.value}
- 說話語氣：{brand.tone_of_voice}
- 視覺風格：{brand.visual_style}
- 主色調：{brand.primary_color}
- 輔助色：{brand.secondary_color}
- 目標受眾：{brand.target_audience}
- 核心訊息：{', '.join(brand.key_messages) if brand.key_messages else '無'}
- 禁止主題：{', '.join(brand.forbidden_themes) if brand.forbidden_themes else '無'}
{avatar_section}

## 🎬 電影風格參考
根據品牌性格「{brand.personality.value}」，你的視覺風格應該是：
**{film_reference}**

## 📋 你的創作原則
1. **反通用化**：每個畫面都必須體現品牌 DNA，拒絕通用模板
2. **視覺敘事**：用鏡頭說故事，搭配精彩旁白引導觀眾
3. **情感連結**：在前 3 秒抓住觀眾的情感
4. **品牌一致**：顏色 {brand.primary_color} + {brand.secondary_color}，風格 {brand.visual_style}
5. **受眾共鳴**：每個場景都要讓「{brand.target_audience}」感到被理解
6. **必須有旁白**：每個場景都必須包含 narration_text（旁白文字），不可留空！旁白要自然口語化，符合品牌語氣
7. **品牌名稱處理**：如果沒有提供正式品牌名稱（或品牌名稱是「我的品牌」），旁白中請勿提及任何品牌名稱，使用「我們」或其他通用稱謂代替

## 📤 輸出格式
請以 JSON 格式輸出影片腳本：
{{
  "title": "吸引人的影片標題",
  "description": "詳細描述整支影片的視覺敘事和情感弧線",
  "overall_style": "整體視覺風格（例如：cinematic commercial with warm tones）",
  "music_genre": "配樂風格（upbeat/emotional/energetic/calm/epic/minimal/inspirational）",
  "scenes": [
    {{
      "scene_number": 1,
      "scene_type": "hook/problem/solution/demonstration/cta",
      "duration_seconds": 5,
      "visual_prompt": "【必須是專業英文提示詞】格式：[Camera Move] + [Subject] + [Action] + [Environment] + [Lighting] + [Mood]",
      "visual_style": "cinematic/moody/vibrant/minimal/luxurious/documentary",
      "camera_movement": "dolly_in/dolly_out/tracking/crane_up/crane_down/static/orbit/handheld/steadicam",
      "narration_text": "【必填！不可留空】繁體中文旁白，自然口語，符合品牌語氣，每個場景都要有旁白",
      "voice_emotion": "excited/calm/curious/urgent/warm/confident/inspiring",
      "text_overlay": "螢幕文字（選填，用於強調重點）",
      "text_position": "top/center/bottom",
      "text_animation": "fade_in/slide_up/pop/typewriter/none",
      "background_music_mood": "upbeat/emotional/energetic/calm/epic/minimal",
      "sound_effects": ["whoosh", "pop", "ambient", "impact", "transition"]
    }}
  ]
}}

## ✍️ Visual Prompt 撰寫指南（極其重要！）

### 優秀範例：
❌ 不好：「A product on a table」
✅ 好：「Slow cinematic dolly in on sleek smart watch resting on marble surface, morning sunlight creating long shadows, steam from nearby coffee cup drifting through frame, shallow depth of field with soft bokeh, premium advertising aesthetic, 8K quality」

### 必須包含的元素：
1. **鏡頭動作**：Slow dolly in / Smooth tracking left / Crane shot descending / Orbit around / Push in / Pull back
2. **主體描述**：詳細描述畫面主角（人物姿態、產品角度、物件細節）
3. **動作動詞**：resting, floating, rotating, walking, pouring, revealing, emerging
4. **環境細節**：場景、背景、前景元素、空間感
5. **光線設計**：Golden hour / Soft diffused / Dramatic rim lighting / Neon glow / Natural window light
6. **技術標籤**：Shallow depth of field / 8K / Cinematic color grading / Film grain / Professional lighting
7. **情緒氛圍**：Premium / Warm / Energetic / Peaceful / Luxurious / Inspiring

### 品牌色彩融入：
- 場景中加入 {brand.primary_color} 色系的元素（例如：props, lighting gels, wardrobe）
- 使用 {brand.secondary_color} 作為點綴（例如：accent lights, small objects）

## 🚫 負面提示詞 (Negative Prompts) - 必須避免，特別注意去除 AI 感

每個 visual_prompt 都必須附帶 negative_prompt，確保生成品質並消除 AI 生成的特徵：

### 🤖 AI 特徵必須去除：
- AI 生成感：AI generated, artificial looking, synthetic, CGI look, 3D render appearance
- 塑膠質感：plastic skin, waxy texture, overly smooth, unnaturally perfect
- 不自然對稱：unnatural symmetry, too perfect, uncanny valley
- 過度處理：hyper-saturated, over-processed, HDR artifacts, over-sharpened
- 缺乏靈魂：soulless, lifeless, generic expression, stock photo aesthetic

### 畫質問題：
- blurry, pixelated, low resolution, jpeg artifacts, compression artifacts, noise

### 人物問題：
- deformed, distorted face, extra limbs, mutated hands, bad anatomy, unnatural pose
- plastic skin, waxy face, uncanny valley, dead eyes, frozen expression

### 構圖問題：
- cropped, cut off, bad framing, awkward composition, cluttered background

### 技術問題：
- overexposed, underexposed, bad lighting, harsh shadows, color banding

### 風格問題：
- amateur, unprofessional, stock photo look, generic, cliché, cartoon-like
- video game render, deepfake appearance, morph artifacts

### 元素問題：
- watermark, logo, text, signature, border, frame

### 品牌禁忌：
{', '.join(brand.forbidden_themes) if brand.forbidden_themes else '無特定禁忌'}

### 每個場景的 negative_prompt 必須包含（去除 AI 感優先）：
"AI generated, artificial looking, synthetic, CGI, plastic skin, waxy texture, overly smooth, unnaturally perfect, uncanny valley, hyper-saturated, over-processed, soulless, lifeless, stock photo, blurry, pixelated, low quality, distorted, deformed, bad anatomy, extra limbs, mutated hands, cropped, watermark, text, logo, amateur, generic, overexposed, underexposed, jpeg artifacts, bad lighting, video game render, 3D render look, deepfake"
"""
    
    def _build_user_prompt(self, request: VideoRequest, brand: BrandProfile) -> str:
        """構建 User Prompt - 需求轉譯"""
        product_info = ""
        if request.product_name:
            product_info = f"\n🛍️ 產品名稱：{request.product_name}"
            if request.product_features:
                product_info += f"\n✨ 產品特色：{', '.join(request.product_features)}"
        
        # 平台特定的節奏建議
        PLATFORM_RHYTHM = {
            "tiktok": "極快節奏，每 2-3 秒一個視覺高潮，開場必須震撼",
            "instagram_reels": "視覺優先，美學感強，每個畫面都要值得截圖",
            "youtube_shorts": "敘事完整，有開頭中間結尾，最後 5 秒強 CTA",
            "xiaohongshu": "精緻感，生活方式導向，軟性種草風格",
            "facebook_reels": "易懂直白，適合較廣年齡層，情感訴求強",
        }
        platform_tip = PLATFORM_RHYTHM.get(request.platform, "快節奏、視覺衝擊")
        
        # 目標對應的敘事結構
        GOAL_STRUCTURE = {
            "awareness": "品牌曝光 → 重點在視覺記憶點和品牌識別，不急於推銷",
            "engagement": "互動參與 → 設計會讓人想評論、分享的橋段，製造話題",
            "conversion": "轉換購買 → 強調痛點→解決方案→限時優惠→立即行動",
        }
        goal_tip = GOAL_STRUCTURE.get(request.goal, "品牌曝光")
        
        # 檢查品牌名稱是否有效
        has_brand = brand.brand_name and brand.brand_name not in ["我的品牌", "My Brand", "Brand", ""]
        
        if has_brand:
            title_line = f"🎬 請為「{brand.brand_name}」創作一支短影音"
        else:
            title_line = "🎬 請創作一支精彩的短影音（注意：旁白中請勿提及任何品牌名稱）"
        
        # 計算場景數：如果有指定就用，否則依們 clip 時長自動推算
        clip_dur = int(request.duration.value)
        scene_count = request.scene_count if request.scene_count else (
            3 if clip_dur <= 5 else
            2 if clip_dur <= 10 else
            4 if clip_dur <= 30 else 5
        )
        
        return f"""{title_line}

## 📌 基本需求
- 主題：{request.topic}
- 目標：{request.goal} ({goal_tip})
- 平台：{request.platform}
- 長度：{request.duration.value} 秒
- 格式：{request.format.value}
{product_info}
{f'- 💬 關鍵訊息：{request.key_message}' if request.key_message else ''}
{f'- 🎨 參考風格：{request.reference_style}' if request.reference_style else ''}

## 🎯 平台特性 ({request.platform})
{platform_tip}

## ⚡ 創作要求

### 1. 黃金開場 (前 3 秒)
- 必須有視覺衝擊或情感鉤子
- 使用動態鏡頭（dolly in, crane shot, tracking）
- 聲音設計：音效或音樂 drop 配合畫面
- 可以用疑問句、驚人數據、或反常畫面開場

### 2. 內容節奏
- 場景切換要有韻律感，配合音樂節拍
- 每個場景都要有明確的視覺焦點
- 使用對比（問題→解決、before→after、平凡→驚喜）

### 3. 視覺敘事
- **visual_prompt 必須是電影級英文提示詞**
- 包含：鏡頭動作 + 主體 + 動作 + 環境 + 光線 + 氛圍
- 例如：「Smooth dolly forward into modern living room, morning light streaming through floor-to-ceiling windows, steam rising from fresh coffee on marble countertop, warm color grading with golden highlights, premium lifestyle aesthetic, shallow depth of field」

### 4. 品牌融入
- 顏色必須使用 {brand.primary_color} 和 {brand.secondary_color}
- 風格符合「{brand.visual_style}」
- 語氣符合「{brand.tone_of_voice}」

### 5. 強力收尾 (CTA)
- 明確告訴觀眾下一步行動
- 使用 urgency（限時、限量）或 benefit（獲得什麼）
- 品牌 logo 或名稱必須出現

## 🎨 場景類型建議
根據 {clip_dur} 秒/場景、共 {scene_count} 個場景（總時長約 {clip_dur * scene_count} 秒）的影片：
{self._get_scene_allocation_guide(clip_dur, scene_count)}

請生成完整的 JSON 格式腳本，每個 visual_prompt 都必須是可直接用於 AI 影片生成的專業提示詞！
確保 scenes 陣列包含 **恰好 {scene_count} 個場景**，每個場景的 duration_seconds 設為 {clip_dur}！
"""
    
    async def _call_gemini(self, system_prompt: str, user_prompt: str) -> str:
        """調用 Gemini API（含 429 重試機制）"""
        import traceback
        import asyncio

        full_prompt = f"{system_prompt}\n\n---\n\n{user_prompt}"

        # 重試設定：3 次嘗試
        _RETRY_MODELS = ["gemini-1.5-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b"]
        _RETRY_DELAYS = [5, 15, 30]   # 秒
        _RATE_LIMIT_CODES = {"429", "resource_exhausted", "resourceexhausted"}

        last_error: Exception | None = None

        for attempt, (model_name, delay) in enumerate(zip(_RETRY_MODELS, _RETRY_DELAYS), start=1):
            try:
                model = genai.GenerativeModel(model_name)
                response = await asyncio.to_thread(
                    model.generate_content,
                    full_prompt,
                    generation_config=genai.GenerationConfig(
                        temperature=0.7,
                        max_output_tokens=4096,
                    )
                )
                return response.text

            except Exception as e:
                err_str = str(e).lower()
                print(f"[DirectorEngine] Gemini 嘗試 {attempt} 失敗: {e}")
                
                is_rate_limit = any(code in err_str for code in _RATE_LIMIT_CODES)

                if is_rate_limit and attempt < len(_RETRY_MODELS):
                    print(
                        f"[DirectorEngine] Gemini 429 配額超限 (attempt {attempt}/{len(_RETRY_MODELS)})，"
                        f"{delay}s 後使用 {_RETRY_MODELS[attempt]} 重試..."
                    )
                    await asyncio.sleep(delay)
                    last_error = e
                    continue
                else:
                    last_error = e
                    break

        # 所有重試皆失敗 → 交給呼叫端 fallback
        print(f"[DirectorEngine] 所有 Gemini 重試皆失敗: {last_error}")
        raise last_error
    
    def _parse_response(
        self,
        response: str,
        request: VideoRequest,
        brand: BrandProfile,
        avatar: Optional[AvatarAsset]
    ) -> VideoScript:
        """解析 Gemini 回應"""
        import re
        import uuid
        
        # 提取 JSON
        json_match = re.search(r'\{[\s\S]*\}', response)
        if not json_match:
            return self._generate_fallback_script(request, brand, avatar, error="Gemini JSON Match Failed. Raw: " + response[:100])
        
        try:
            data = json.loads(json_match.group())
        except json.JSONDecodeError as e:
            return self._generate_fallback_script(request, brand, avatar, error=f"JSON Decode Error: {str(e)}")
        
        # 基礎負面提示詞
        base_negative = "blurry, pixelated, low quality, distorted, deformed, bad anatomy, extra limbs, mutated hands, cropped, watermark, text, logo, amateur, stock photo, generic, overexposed, underexposed, noisy, grainy, jpeg artifacts, compression, bad lighting, harsh shadows, cluttered, busy background, AI-generated look, uncanny valley"
        
        # 品牌禁忌
        brand_forbidden = ", ".join(brand.forbidden_themes) if brand.forbidden_themes else ""
        full_negative = f"{base_negative}, {brand_forbidden}" if brand_forbidden else base_negative
        
        # 基礎品質標籤
        base_quality = "8K resolution, professional cinematography, color graded, broadcast quality, advertising standard, sharp focus, professional lighting, film-quality production"
        
        # 構建場景
        scenes = []
        for i, scene_data in enumerate(data.get("scenes", [])):
            try:
                # 增強視覺提示詞
                visual_prompt = scene_data.get("visual_prompt", "")
                if visual_prompt and "8K" not in visual_prompt:
                    visual_prompt = f"{visual_prompt}, {base_quality}"
                
                scene = SceneInstruction(
                    scene_number=scene_data.get("scene_number") or (i + 1),
                    scene_type=SceneType.from_string(scene_data.get("scene_type") or "hook"),
                    duration_seconds=scene_data.get("duration_seconds") or 5,
                    visual_prompt=visual_prompt or "Professional cinematic scene",
                    negative_prompt=scene_data.get("negative_prompt") or full_negative,
                    visual_style=scene_data.get("visual_style") or "",
                    camera_movement=scene_data.get("camera_movement") or "static",
                    quality_tags=scene_data.get("quality_tags") or base_quality,
                    narration_text=scene_data.get("narration_text") or self._get_fallback_narration(
                        SceneType(scene_data.get("scene_type", "hook")),
                        brand,
                        request
                    ),
                    voice_emotion=scene_data.get("voice_emotion") or "neutral",
                    text_overlay=scene_data.get("text_overlay"),
                    text_position=scene_data.get("text_position") or "center",
                    text_animation=scene_data.get("text_animation") or "fade_in",
                    background_music_mood=scene_data.get("background_music_mood") or "upbeat",
                    sound_effects=scene_data.get("sound_effects") or []
                )
                scenes.append(scene)
            except Exception as e:
                print(f"場景解析錯誤: {e}")
                continue
        
        return VideoScript(
            project_id=str(uuid.uuid4()),
            title=data.get("title", request.topic),
            description=data.get("description", ""),
            format=request.format,
            total_duration=int(request.duration.value),
            brand_profile=brand,
            avatar=avatar,
            scenes=scenes,
            overall_style=data.get("overall_style", brand.visual_style),
            color_palette=[brand.primary_color, brand.secondary_color],
            music_genre=data.get("music_genre", "upbeat pop"),
            target_platform=request.platform
        )
    
    def _generate_fallback_script(
        self,
        request: VideoRequest,
        brand: BrandProfile,
        avatar: Optional[AvatarAsset],
        error: str = ""
    ) -> VideoScript:
        """生成備用腳本 - 專業級品質"""
        import uuid
        
        duration = int(request.duration.value)
        
        # 根據時長分配場景
        if duration <= 5:
            # Kling 5秒 - 單一場景
            scene_durations = [5]  # 單一精華場景
        elif duration <= 8:
            # Veo 模型固定 8 秒，精簡為 2 個場景
            scene_durations = [3, 5]  # Hook, CTA
        elif duration == 10:
            # Kling 10秒 - 2 個場景
            scene_durations = [4, 6]  # Hook, CTA
        elif duration == 15:
            scene_durations = [3, 7, 5]  # Hook, Content, CTA
        elif duration == 30:
            scene_durations = [3, 8, 10, 9]  # Hook, Problem, Solution, CTA
        elif duration == 60:
            scene_durations = [3, 10, 15, 17, 15]  # Hook, Problem, Solution, Demo, CTA
        else:
            # 其他時長按比例分配
            scene_durations = [
                int(duration * 0.15),  # Hook
                int(duration * 0.25),  # Problem
                int(duration * 0.30),  # Solution
                int(duration * 0.30),  # CTA
            ]
        
        scenes = []
        scene_types = [SceneType.HOOK, SceneType.PROBLEM, SceneType.SOLUTION, SceneType.DEMONSTRATION, SceneType.CTA]
        
        # 清理可能包含中文的屬性（因為 Kling prompt 必須是純英文）
        safe_industry = "commercial" if brand.industry in ["綜合", "General", ""] else brand.industry.replace("綜合", "commercial")
        safe_style = "cinematic" if any("\u4e00" <= c <= "\u9fff" for c in brand.visual_style) else brand.visual_style
        
        # 將主題加入以增加關聯性
        topic_context = request.topic[:30] if request.topic else safe_industry
        
        # 專業級視覺提示詞模板
        visual_prompts = {
            SceneType.HOOK: f"""Cinematic opening shot: Smooth dolly in revealing {topic_context} scene, 
dramatic rim lighting with {brand.primary_color} color accent creating depth, 
lens flare catching golden hour light, shallow depth of field with creamy bokeh,
professional advertising aesthetic, 8K resolution, film grain texture,
premium commercial quality, broadcast standard, color graded for impact""",
            
            SceneType.PROBLEM: f"""Intimate push-in shot: Subject with contemplative expression in {topic_context} context, 
soft diffused window light creating gentle shadows, {safe_style} environment,
cool tones transitioning to warm {brand.secondary_color} highlights,
emotional documentary style, authentic moment captured, shallow focus,
8K cinematic quality, professional color grading, natural skin tones""",
            
            SceneType.SOLUTION: f"""Elegant reveal shot: Smooth crane descending to reveal premium {topic_context} solution,
{safe_style} scene bathed in {brand.primary_color} accent lighting,
premium atmosphere with subtle particle effects, glass and metal reflections,
luxurious depth with multiple focal planes, 8K resolution, film-quality production,
advertising agency standard, broadcast ready, pristine image quality""",
            
            SceneType.DEMONSTRATION: f"""Dynamic tracking shot: Camera orbiting around {topic_context} subject showcasing intricate details,
soft rim lighting creating dimensional separation with {brand.primary_color} glow,
{safe_style} aesthetic, macro-like clarity on textures,
beautiful bokeh spheres in background, 8K quality, professional product photography,
color graded for premium feel, sharp focus on details, cinematic motion""",
            
            SceneType.CTA: f"""Powerful establishing shot: Confident composition with {safe_style} aesthetic related to {topic_context},
bold {brand.primary_color} accent colors creating visual impact,
clean negative space for brand message, professional studio lighting,
uplifting golden hour atmosphere, 8K cinematic quality, broadcast ready,
advertising campaign finale, inspirational mood, memorable framing""",
        }
        
        # 場景特定負面提示詞 - 強調去除 AI 感
        base_anti_ai = "AI generated, artificial looking, synthetic, CGI, plastic skin, waxy texture, overly smooth, unnaturally perfect, uncanny valley, hyper-saturated, over-processed, soulless, lifeless, 3D render look, video game graphics, deepfake"
        
        negative_prompts = {
            SceneType.HOOK: f"{base_anti_ai}, static boring shot, dark underexposed, amateur lighting, blurry, pixelated, stock photo, generic opening, watermark, text overlay, low quality, compression artifacts, fake energy, forced excitement",
            SceneType.PROBLEM: f"{base_anti_ai}, overacted emotion, fake expression, harsh lighting, unflattering angle, blurry, distorted face, amateur, stock photo, watermark, low resolution, noisy image, plastic tears, artificial sadness",
            SceneType.SOLUTION: f"{base_anti_ai}, cluttered background, cheap look, poor lighting, blurry, overexposed, amateur production, stock footage, watermark, low quality, compression, bad composition, fake luxury, artificial elegance",
            SceneType.DEMONSTRATION: f"{base_anti_ai}, motion blur, out of focus, harsh shadows, unflattering angle, amateur product shot, stock photo, watermark, pixelated, noisy, low resolution, bad framing, plastic product, fake shine",
            SceneType.CTA: f"{base_anti_ai}, weak composition, cluttered design, poor contrast, amateur, generic ending, stock photo, watermark, blurry text, low quality, forgettable, uninspiring, forced emotion, artificial urgency",
        }
        
        # 品質強化標籤 - 強調真實感
        quality_tags = """8K resolution, professional cinematography, natural film grain, authentic lighting,
shot on ARRI Alexa, Kodak film emulation, genuine texture, organic imperfections, real-world production,
broadcast quality, advertising standard, sharp focus, professional lighting, true-to-life colors,
human-crafted aesthetic, analog warmth, natural color grading, authentic atmosphere"""
        
        camera_movements = {
            SceneType.HOOK: "tracking",
            SceneType.PROBLEM: "dolly_in",
            SceneType.SOLUTION: "crane_up",
            SceneType.DEMONSTRATION: "orbit",
            SceneType.CTA: "dolly_out",
        }
        
        for i, dur in enumerate(scene_durations):
            scene_type = scene_types[min(i, len(scene_types) - 1)]
            
            scenes.append(SceneInstruction(
                scene_number=i + 1,
                scene_type=scene_type,
                duration_seconds=dur,
                visual_prompt=visual_prompts.get(scene_type, f"Professional {brand.visual_style} scene, {brand.primary_color} accent, 8K cinematic quality, broadcast ready, advertising standard"),
                negative_prompt=negative_prompts.get(scene_type, "blurry, pixelated, low quality, amateur, stock photo, watermark, generic, bad lighting"),
                visual_style=brand.visual_style,
                camera_movement=camera_movements.get(scene_type, "static"),
                quality_tags=quality_tags,
                narration_text=self._get_fallback_narration(scene_type, brand, request),
                voice_emotion="excited" if scene_type == SceneType.HOOK else "friendly",
                text_overlay=brand.brand_name if scene_type == SceneType.CTA else None,
                text_position="center",
                background_music_mood="upbeat",
                sound_effects=["whoosh"] if i == 0 else []
            ))
        
        return VideoScript(
            project_id=str(uuid.uuid4()),
            title=f"{brand.brand_name or '影片'} - {request.topic}",
            description=f"Fallback generated. Error: {error}" if error else f"關於{request.topic}的短影音",
            format=request.format,
            total_duration=duration,
            brand_profile=brand,
            avatar=avatar,
            scenes=scenes,
            overall_style=brand.visual_style,
            color_palette=[brand.primary_color, brand.secondary_color],
            music_genre="upbeat pop",
            target_platform=request.platform
        )
    
    def _get_scene_allocation_guide(self, clip_duration: int, scene_count: int) -> str:
        """根據每個場景時長和場景數生成場景分配建議"""
        scene_labels = ["Hook (開場)", "Problem (痛點)", "Solution (解方)", "Demonstration (展示)", "CTA (行動呼籲)"]
        total_sec = clip_duration * scene_count
        
        # 根據 scene_count 自動分配場景類型
        if scene_count == 1:
            return f"""- **Hook + CTA（單一場景）**：{clip_duration} 秒，一鏡到底，直接展示核心訊息 + 行動呼籲
⚠️ 只有 1 個場景！必須在單個鏡頭內同時傳達品牌識別和行動呼籲！"""
        elif scene_count == 2:
            return f"""- **Hook（開場）**：{clip_duration} 秒，視覺衝擊 + 情感鉤子
- **CTA（行動呼籲）**：{clip_duration} 秒，核心訊息 + 強力收尾
共 2 個場景，每場景各 {clip_duration} 秒，串接後共 {total_sec} 秒。"""
        elif scene_count == 3:
            return f"""- **Hook（開場）**：{clip_duration} 秒，視覺衝擊 + 情感鉤子
- **Solution（解方展示）**：{clip_duration} 秒，核心價值 + 產品亮點
- **CTA（行動呼籲）**：{clip_duration} 秒，強力收尾 + 行動呼籲
共 3 個場景，每場景各 {clip_duration} 秒，串接後共 {total_sec} 秒。"""
        elif scene_count == 4:
            return f"""- **Hook（開場）**：{clip_duration} 秒，視覺衝擊 + 情感鉤子
- **Problem（痛點）**：{clip_duration} 秒，展示問題/需求
- **Solution（解方）**：{clip_duration} 秒，核心解決方案
- **CTA（行動呼籲）**：{clip_duration} 秒，強力收尾
共 4 個場景，每場景各 {clip_duration} 秒，串接後共 {total_sec} 秒。"""
        else:
            lines = []
            for i in range(scene_count):
                label = scene_labels[i] if i < len(scene_labels) else f"場景 {i+1}"
                lines.append(f"- **{label}**：{clip_duration} 秒")
            lines.append(f"共 {scene_count} 個場景，每場景各 {clip_duration} 秒，串接後共 {total_sec} 秒。")
            return "\n".join(lines)
    def _get_fallback_narration(
        self,
        scene_type: SceneType,
        brand: BrandProfile,
        request: VideoRequest
    ) -> str:
        """生成備用旁白 - 確保每個場景都有旁白"""
        topic_short = request.topic[:30] if len(request.topic) > 30 else request.topic
        
        # 檢查品牌名稱是否有效（非預設值且非空）
        has_brand = brand.brand_name and brand.brand_name not in ["我的品牌", "My Brand", "Brand", ""]
        
        if has_brand:
            # 有品牌名稱時的旁白
            narrations = {
                SceneType.HOOK: f"你是不是也在尋找更好的方法？讓我們告訴你一個秘密！",
                SceneType.PROBLEM: f"很多人都在問，{topic_short}到底該怎麼做？這個問題困擾了太多人！",
                SceneType.SOLUTION: f"{brand.brand_name}為你準備了最佳解答，讓一切變得簡單！",
                SceneType.DEMONSTRATION: f"來看看實際效果有多驚人，這就是{brand.brand_name}的魔力！",
                SceneType.CTA: f"現在就來體驗{brand.brand_name}吧！點擊連結，開啟你的全新旅程！",
            }
            default = f"歡迎來到{brand.brand_name}的世界！"
        else:
            # 沒有品牌名稱時的旁白（省略品牌）
            narrations = {
                SceneType.HOOK: f"你是不是也在尋找更好的方法？讓我們告訴你一個秘密！",
                SceneType.PROBLEM: f"很多人都在問，{topic_short}到底該怎麼做？這個問題困擾了太多人！",
                SceneType.SOLUTION: f"我們為你準備了最佳解答，讓一切變得簡單！",
                SceneType.DEMONSTRATION: f"來看看實際效果有多驚人，這就是專業的力量！",
                SceneType.CTA: f"現在就來體驗吧！點擊連結，開啟你的全新旅程！",
            }
            default = f"一起來探索更多精彩內容！"
        
        # 確保永遠返回有內容的旁白
        return narrations.get(scene_type, default)


# ============================================================
# 5. 預設品牌模板
# ============================================================

DEFAULT_BRAND_TEMPLATES: Dict[str, BrandProfile] = {
    "tech_startup": BrandProfile(
        brand_name="我的品牌",
        tagline="創新改變生活",
        industry="科技",
        personality=BrandPersonality.INNOVATIVE,
        tone_of_voice="專業但親切，充滿熱情",
        primary_color="#6366F1",
        secondary_color="#8B5CF6",
        visual_style="modern, clean, futuristic",
        target_audience="25-40歲科技愛好者",
        key_messages=["創新", "效率", "未來"]
    ),
    "lifestyle_brand": BrandProfile(
        brand_name="我的品牌",
        tagline="享受生活每一刻",
        industry="生活風格",
        personality=BrandPersonality.FRIENDLY,
        tone_of_voice="溫暖、真誠、有感染力",
        primary_color="#F472B6",
        secondary_color="#FB923C",
        visual_style="warm, cozy, lifestyle photography",
        target_audience="25-35歲都市女性",
        key_messages=["品味", "質感", "自我"]
    ),
    "food_beverage": BrandProfile(
        brand_name="我的品牌",
        tagline="美味不等待",
        industry="餐飲",
        personality=BrandPersonality.PLAYFUL,
        tone_of_voice="活潑、有趣、讓人食指大動",
        primary_color="#EF4444",
        secondary_color="#F59E0B",
        visual_style="appetizing, vibrant, close-up food shots",
        target_audience="18-45歲美食愛好者",
        key_messages=["美味", "新鮮", "享受"]
    ),
}
