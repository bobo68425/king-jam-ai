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


class SceneInstruction(BaseModel):
    """
    場景指令 - 給下游引擎的精確指令
    """
    scene_number: int
    scene_type: SceneType
    duration_seconds: float
    
    # 視覺指令 (給圖像/影片生成)
    visual_prompt: str = Field(..., description="視覺生成 Prompt")
    visual_style: str = Field(default="", description="視覺風格補充")
    camera_movement: str = Field(default="static", description="鏡頭運動")
    
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
    duration: VideoDuration = Field(default=VideoDuration.MEDIUM_30)
    format: VideoFormat = Field(default=VideoFormat.VERTICAL_9_16)
    
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
        self.model = genai.GenerativeModel('gemini-2.0-flash') if GOOGLE_GEMINI_KEY else None
    
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
            return self._generate_fallback_script(request, brand, avatar)
    
    def _build_system_prompt(self, brand: BrandProfile, avatar: Optional[AvatarAsset]) -> str:
        """
        構建 System Prompt - 注入品牌 DNA
        這是「反通用化」的核心：每個 prompt 都與品牌設定交互
        """
        avatar_section = ""
        if avatar:
            avatar_section = f"""
## 角色設定
- 代言人名稱：{avatar.name}
- 性別：{avatar.gender.value}
- 年齡範圍：{avatar.age_range}
- 外觀：{avatar.appearance}
- 性格：{avatar.personality}
- 聲音風格：{avatar.voice_style}
"""
        
        return f"""你是一位專業的短影音導演，專門為「{brand.brand_name}」品牌創作內容。

## 品牌 DNA (必須嚴格遵守)
- 品牌名稱：{brand.brand_name}
- 標語：{brand.tagline or '無'}
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

## 你的任務
1. 所有內容必須符合品牌性格「{brand.personality.value}」
2. 視覺風格必須體現「{brand.visual_style}」
3. 文案語氣必須是「{brand.tone_of_voice}」
4. 顏色使用以「{brand.primary_color}」為主，「{brand.secondary_color}」為輔
5. 內容要打動「{brand.target_audience}」這群人

## 輸出格式
請以 JSON 格式輸出影片腳本，包含以下結構：
{{
  "title": "影片標題",
  "description": "影片描述（要詳細描述整支影片的視覺敘事）",
  "overall_style": "整體視覺風格描述",
  "music_genre": "配樂風格",
  "scenes": [
    {{
      "scene_number": 1,
      "scene_type": "hook/problem/solution/demonstration/cta",
      "duration_seconds": 5,
      "visual_prompt": "電影級視覺提示詞（英文）- 必須包含：1.鏡頭動作(如 Slow dolly in)、2.主體描述、3.動作描述、4.場景細節、5.光線氛圍。範例：'Slow tracking shot of elegant hands holding a premium coffee cup, steam rising gently, warm golden hour lighting, shallow depth of field, cozy cafe background with bokeh lights'",
      "visual_style": "視覺風格補充（如：cinematic, moody, vibrant, minimal）",
      "camera_movement": "dolly_in/dolly_out/tracking/crane_up/crane_down/static/orbit",
      "narration_text": "旁白文字（繁體中文，自然口語）",
      "voice_emotion": "excited/calm/curious/urgent/warm/confident",
      "text_overlay": "螢幕上顯示的文字（簡短有力）",
      "text_position": "top/center/bottom",
      "background_music_mood": "upbeat/emotional/energetic/calm/epic/minimal",
      "sound_effects": ["whoosh", "pop", "ambient"]
    }}
  ]
}}

## 重要：Visual Prompt 撰寫指南（給 AI 影片生成）
1. 開頭用鏡頭動作：Slow push in / Smooth tracking shot / Cinematic dolly / Aerial drone descent
2. 描述主體和動作：A woman walking / Hands pouring coffee / Product rotating
3. 加入環境細節：Modern studio with soft lighting / Sunset beach with golden reflections
4. 指定光線：Golden hour / Soft diffused light / Dramatic rim lighting / Neon glow
5. 技術參數：Shallow depth of field / 8K quality / Film grain / Professional color grading
6. 氛圍關鍵字：Luxurious / Energetic / Peaceful / Modern / Premium
"""
    
    def _build_user_prompt(self, request: VideoRequest, brand: BrandProfile) -> str:
        """構建 User Prompt - 需求轉譯"""
        product_info = ""
        if request.product_name:
            product_info = f"\n產品名稱：{request.product_name}"
            if request.product_features:
                product_info += f"\n產品特色：{', '.join(request.product_features)}"
        
        return f"""請為「{brand.brand_name}」創作一支短影音：

## 需求
- 主題：{request.topic}
- 目標：{request.goal}
- 平台：{request.platform}
- 長度：{request.duration.value} 秒
- 格式：{request.format.value}
{product_info}
{f'- 關鍵訊息：{request.key_message}' if request.key_message else ''}
{f'- 參考風格：{request.reference_style}' if request.reference_style else ''}

## 要求
1. 開場 3 秒內必須抓住注意力 (Hook) - 使用動態鏡頭和視覺衝擊
2. 內容節奏要適合 {request.platform} 平台的用戶習慣
3. 結尾要有明確的行動呼籲 (CTA)
4. **visual_prompt 必須寫成電影級品質** - 包含鏡頭動作、光線、氛圍
5. 旁白要自然、符合品牌語氣
6. 每個場景的視覺必須具有連貫性和敘事性

## 視覺風格範例（根據品牌性格）
- 專業權威：Clean corporate aesthetic, modern office, soft key lighting
- 親切友善：Warm lifestyle shots, natural lighting, genuine expressions  
- 奢華高端：Dramatic lighting, premium materials, slow elegant movements
- 活潑有趣：Vibrant colors, dynamic angles, energetic motion
- 極簡現代：Minimal compositions, white space, subtle shadows

請生成完整的 JSON 格式腳本，確保 visual_prompt 是專業的電影級提示詞。
"""
    
    async def _call_gemini(self, system_prompt: str, user_prompt: str) -> str:
        """調用 Gemini API"""
        import asyncio
        
        full_prompt = f"{system_prompt}\n\n---\n\n{user_prompt}"
        
        response = await asyncio.to_thread(
            self.model.generate_content,
            full_prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.7,
                max_output_tokens=4096,
            )
        )
        
        return response.text
    
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
            return self._generate_fallback_script(request, brand, avatar)
        
        try:
            data = json.loads(json_match.group())
        except json.JSONDecodeError:
            return self._generate_fallback_script(request, brand, avatar)
        
        # 構建場景
        scenes = []
        for i, scene_data in enumerate(data.get("scenes", [])):
            try:
                scene = SceneInstruction(
                    scene_number=scene_data.get("scene_number", i + 1),
                    scene_type=SceneType(scene_data.get("scene_type", "hook")),
                    duration_seconds=scene_data.get("duration_seconds", 5),
                    visual_prompt=scene_data.get("visual_prompt", ""),
                    visual_style=scene_data.get("visual_style", ""),
                    camera_movement=scene_data.get("camera_movement", "static"),
                    narration_text=scene_data.get("narration_text", ""),
                    voice_emotion=scene_data.get("voice_emotion", "neutral"),
                    text_overlay=scene_data.get("text_overlay"),
                    text_position=scene_data.get("text_position", "center"),
                    text_animation=scene_data.get("text_animation", "fade_in"),
                    background_music_mood=scene_data.get("background_music_mood", "upbeat"),
                    sound_effects=scene_data.get("sound_effects", [])
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
        avatar: Optional[AvatarAsset]
    ) -> VideoScript:
        """生成備用腳本"""
        import uuid
        
        duration = int(request.duration.value)
        
        # 根據時長分配場景
        if duration == 15:
            scene_durations = [3, 7, 5]  # Hook, Content, CTA
        elif duration == 30:
            scene_durations = [3, 8, 10, 9]  # Hook, Problem, Solution, CTA
        else:
            scene_durations = [3, 10, 15, 17, 15]  # Hook, Problem, Solution, Demo, CTA
        
        scenes = []
        scene_types = [SceneType.HOOK, SceneType.PROBLEM, SceneType.SOLUTION, SceneType.DEMONSTRATION, SceneType.CTA]
        
        # 根據場景類型生成專業視覺提示詞
        visual_prompts = {
            SceneType.HOOK: f"Dynamic tracking shot revealing {brand.industry} scene, dramatic lighting with {brand.primary_color} color accent, cinematic quality, 8K, shallow depth of field, professional color grading",
            SceneType.PROBLEM: f"Slow push in shot, person with thoughtful expression, soft natural lighting, {brand.visual_style} aesthetic, muted colors transitioning to {brand.secondary_color}",
            SceneType.SOLUTION: f"Elegant reveal shot, {brand.visual_style} scene with {brand.primary_color} accent lighting, premium atmosphere, smooth camera movement, professional studio quality",
            SceneType.DEMONSTRATION: f"Close-up tracking shot showcasing details, soft rim lighting with {brand.primary_color} glow, {brand.visual_style}, 8K quality, beautiful bokeh background",
            SceneType.CTA: f"Confident establishing shot, {brand.visual_style} aesthetic, powerful {brand.primary_color} accent colors, clean composition, professional cinematic quality",
        }
        
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
                visual_prompt=visual_prompts.get(scene_type, f"Professional {brand.visual_style} scene, {brand.primary_color} accent, 8K cinematic quality"),
                visual_style=brand.visual_style,
                camera_movement=camera_movements.get(scene_type, "static"),
                narration_text=self._get_fallback_narration(scene_type, brand, request),
                voice_emotion="excited" if scene_type == SceneType.HOOK else "friendly",
                text_overlay=brand.brand_name if scene_type == SceneType.CTA else None,
                text_position="center",
                background_music_mood="upbeat",
                sound_effects=["whoosh"] if i == 0 else []
            ))
        
        return VideoScript(
            project_id=str(uuid.uuid4()),
            title=f"{brand.brand_name} - {request.topic}",
            description=f"關於{request.topic}的短影音",
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
    
    def _get_fallback_narration(
        self,
        scene_type: SceneType,
        brand: BrandProfile,
        request: VideoRequest
    ) -> str:
        """生成備用旁白"""
        narrations = {
            SceneType.HOOK: f"你是不是也有這個困擾？",
            SceneType.PROBLEM: f"很多人都在問，{request.topic}到底該怎麼做？",
            SceneType.SOLUTION: f"{brand.brand_name}為你準備了最佳解答！",
            SceneType.DEMONSTRATION: f"看看效果有多驚人！",
            SceneType.CTA: f"現在就來體驗{brand.brand_name}吧！",
        }
        return narrations.get(scene_type, "")


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
