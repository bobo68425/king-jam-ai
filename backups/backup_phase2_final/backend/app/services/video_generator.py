"""
Video Generator Service - 影片生成服務 v3.0
============================================
使用 Google Vertex AI Veo 模型生成高品質影片
支援：Veo 3、Veo 3 Fast、Imagen 圖片生成
"""

import os
import uuid
import asyncio
import base64
import io
import tempfile
import struct
import math
import time
from pathlib import Path
from typing import Optional, List, Dict, Any, Callable
from pydantic import BaseModel

# 配置
GOOGLE_GEMINI_KEY = os.getenv("GOOGLE_GEMINI_KEY")
GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT", "veo-saas-backend")
GOOGLE_CLOUD_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")

# 初始化 Google GenAI Client
genai_client = None
vertexai_client = None

# 方法 1: 使用 Vertex AI SDK（服務帳戶認證）
if GOOGLE_CLOUD_PROJECT and GOOGLE_APPLICATION_CREDENTIALS:
    try:
        from google import genai
        from google.genai import types
        
        # 使用 Vertex AI 模式
        vertexai_client = genai.Client(
            vertexai=True,
            project=GOOGLE_CLOUD_PROJECT,
            location=GOOGLE_CLOUD_LOCATION,
        )
        print(f"[VideoGenerator] ✓ Vertex AI Client 初始化成功 (專案: {GOOGLE_CLOUD_PROJECT})")
    except Exception as e:
        print(f"[VideoGenerator] Vertex AI 初始化失敗: {e}")

# 方法 2: 使用 API Key（備選）
if not vertexai_client and GOOGLE_GEMINI_KEY:
    try:
        from google import genai
        genai_client = genai.Client(api_key=GOOGLE_GEMINI_KEY)
        print("[VideoGenerator] ✓ GenAI Client (API Key) 初始化成功")
    except ImportError:
        try:
            import google.genai as genai
            genai_client = genai.Client(api_key=GOOGLE_GEMINI_KEY)
            print("[VideoGenerator] ✓ GenAI Client (API Key) 初始化成功 (fallback)")
        except ImportError:
            print("[VideoGenerator] ✗ google-genai SDK 未安裝")

# 選擇可用的 client
active_client = vertexai_client or genai_client
if active_client:
    print(f"[VideoGenerator] 使用 {'Vertex AI' if vertexai_client else 'API Key'} 模式")

# 嘗試導入 PIL
try:
    from PIL import Image, ImageDraw, ImageFont
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

# 嘗試導入 edge-tts
try:
    import edge_tts
    EDGE_TTS_AVAILABLE = True
except ImportError:
    EDGE_TTS_AVAILABLE = False


# ============================================================
# Veo 模型配置
# ============================================================

VEO_MODELS = {
    "veo-3-fast": "veo-3.0-fast-generate-preview",  # 快速生成
    "veo-3": "veo-3.0-generate-preview",            # 高品質
    "veo-2": "veo-2.0-generate-001",                # 穩定版本
}

IMAGEN_MODELS = {
    "fast": "models/imagen-4.0-fast-generate-001",
    "standard": "models/imagen-4.0-generate-001",
}


# ============================================================
# 資料模型
# ============================================================

class VideoResult(BaseModel):
    """影片生成結果"""
    video_url: str
    video_base64: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration: float
    format: str
    file_size: int
    scene_images: Optional[List[str]] = None
    generation_method: str = "unknown"  # veo, imagen+ffmpeg, placeholder


# ============================================================
# Video Generator 主服務
# ============================================================

class VideoGeneratorService:
    """
    影片生成服務 v3.0
    
    優先使用 Google Veo 模型直接生成影片
    備選方案：Imagen 圖片 + FFmpeg 合成
    """
    
    TTS_VOICES = {
        "female": "zh-TW-HsiaoChenNeural",
        "male": "zh-TW-YunJheNeural",
        "friendly": "zh-TW-HsiaoChenNeural",
        "professional": "zh-CN-XiaoxiaoNeural",
        "energetic": "zh-CN-YunyangNeural",
    }
    
    def __init__(self):
        self.output_dir = Path(tempfile.gettempdir()) / "kingjam_videos"
        self.output_dir.mkdir(exist_ok=True)
    
    async def generate_video(
        self,
        script: Dict[str, Any],
        progress_callback: Optional[Callable] = None,
        quality: str = "standard"
    ) -> VideoResult:
        """
        生成影片
        
        品質等級：
        - standard: Imagen 圖片 + FFmpeg 合成
        - premium: Veo 3 Fast
        - ultra: Veo 3 最高品質
        """
        project_id = script.get("project_id", str(uuid.uuid4()))
        scenes = script.get("scenes", [])
        total_duration = sum(s.get("duration_seconds", 5) for s in scenes)
        format_str = script.get("format", "9:16")
        color_palette = script.get("color_palette", ["#6366F1", "#8B5CF6"])
        
        if not scenes:
            raise ValueError("腳本中沒有場景")
        
        quality_names = {"standard": "標準", "premium": "高級", "ultra": "頂級"}
        print(f"[VideoGenerator] 🎬 開始生成影片 (品質: {quality_names.get(quality, quality)})")
        print(f"[VideoGenerator] 📋 場景數: {len(scenes)}, 總時長: {total_duration}秒")
        
        # 根據品質等級選擇生成方法
        if quality in ["premium", "ultra"]:
            # 高級/頂級：使用 Veo 模型
            veo_model = "veo-3.0-generate-preview" if quality == "ultra" else "veo-3.0-fast-generate-preview"
            print(f"[VideoGenerator] 🎥 使用 Veo 模型: {veo_model}")
            
            video_result = await self._generate_with_veo(script, project_id, preferred_model=veo_model)
            if video_result:
                return video_result
            
            # Veo 失敗，降級到 Imagen + FFmpeg
            print("[VideoGenerator] ⚠️ Veo 不可用，降級到 Imagen + FFmpeg")
        
        # 標準品質 或 Veo 失敗的降級方案
        print("[VideoGenerator] 📸 使用 Imagen + FFmpeg 方案")
        return await self._generate_with_imagen_ffmpeg(script, project_id)
    
    async def _generate_with_veo(
        self,
        script: Dict[str, Any],
        project_id: str,
        preferred_model: str = "veo-3.0-fast-generate-preview"
    ) -> Optional[VideoResult]:
        """
        使用 Google Veo 模型直接生成影片
        
        模型選項：
        - veo-3.0-generate-preview: 頂級品質
        - veo-3.0-fast-generate-preview: 快速生成
        """
        client = vertexai_client or genai_client
        if not client:
            print("[VideoGenerator] Veo: 沒有可用的 Client")
            return None
        
        scenes = script.get("scenes", [])
        format_str = script.get("format", "9:16")
        color_palette = script.get("color_palette", ["#6366F1", "#8B5CF6"])
        total_duration = sum(s.get("duration_seconds", 5) for s in scenes)
        
        # 構建完整的影片提示詞
        video_prompt = self._build_veo_prompt(script)
        
        # 設定影片參數
        aspect_ratio = "9:16" if format_str == "9:16" else "16:9" if format_str == "16:9" else "1:1"
        
        # 優先使用指定的模型
        veo_models = [preferred_model]
        # 備選模型
        fallback_models = [
            "veo-3.0-fast-generate-preview",
            "veo-3.0-generate-preview", 
            "veo-2.0-generate-001",
        ]
        for m in fallback_models:
            if m not in veo_models:
                veo_models.append(m)
        
        for model_name in veo_models:
            try:
                print(f"[VideoGenerator] 🎥 嘗試 Veo 模型: {model_name}")
                
                # 調用 Veo API 生成影片
                if hasattr(client.models, 'generate_videos'):
                    # Veo 只支持 4, 6, 8 秒的影片
                    veo_duration = 8  # 使用最長的 8 秒
                    
                    # 發起生成請求
                    operation = await asyncio.to_thread(
                        client.models.generate_videos,
                        model=model_name,
                        prompt=video_prompt,
                        config={
                            "aspect_ratio": aspect_ratio,
                            "duration_seconds": veo_duration,
                            "number_of_videos": 1,
                            "generate_audio": True,
                        }
                    )
                    
                    print(f"[VideoGenerator] 📡 Operation: {operation.name}")
                    
                    # 輪詢等待操作完成
                    max_wait = 180  # 最多等待 3 分鐘
                    poll_interval = 5
                    waited = 0
                    
                    while waited < max_wait:
                        # 使用 client.operations.get 獲取最新狀態
                        operation = await asyncio.to_thread(
                            client.operations.get,
                            operation=operation
                        )
                        
                        if operation.done:
                            break
                        
                        print(f"[VideoGenerator] ⏳ 生成中... ({waited}/{max_wait}s)")
                        await asyncio.sleep(poll_interval)
                        waited += poll_interval
                    
                    # 檢查結果
                    if operation.error:
                        print(f"[VideoGenerator] ❌ Veo 錯誤: {operation.error}")
                        continue
                    
                    if not operation.done:
                        print(f"[VideoGenerator] ⏱️ Veo 超時")
                        continue
                    
                    # 獲取影片
                    response = operation.response
                    if response and hasattr(response, 'generated_videos') and response.generated_videos:
                        video_data = response.generated_videos[0]
                        
                        # 獲取影片 bytes
                        video_bytes = None
                        if hasattr(video_data, 'video') and hasattr(video_data.video, 'video_bytes'):
                            video_bytes = video_data.video.video_bytes
                        
                        if video_bytes:
                            print(f"[VideoGenerator] ✅ Veo 影片生成成功！大小: {len(video_bytes) / 1024 / 1024:.2f} MB")
                            
                            # 保存到靜態目錄
                            static_dir = Path("/app/static/videos")
                            static_dir.mkdir(parents=True, exist_ok=True)
                            
                            video_filename = f"veo_{project_id}.mp4"
                            static_path = static_dir / video_filename
                            
                            with open(static_path, "wb") as f:
                                f.write(video_bytes)
                            
                            video_url = f"/video/download/{video_filename}"
                            print(f"[VideoGenerator] 📁 Veo 影片已保存: {static_path}")
                            
                            return VideoResult(
                                video_url=video_url,
                                video_base64=None,
                                thumbnail_url=None,
                                duration=veo_duration,
                                format=format_str,
                                file_size=len(video_bytes),
                                scene_images=None,
                                generation_method="veo"
                            )
                        else:
                            print(f"[VideoGenerator] 無法獲取影片 bytes")
                    else:
                        print(f"[VideoGenerator] 無影片結果")
                
            except asyncio.TimeoutError:
                print(f"[VideoGenerator] Veo {model_name} 超時")
                continue
            except Exception as e:
                error_msg = str(e)
                # 打印完整錯誤以便調試
                print(f"[VideoGenerator] Veo {model_name} 完整錯誤: {error_msg}")
                if "not found" in error_msg.lower() or "404" in error_msg:
                    print(f"[VideoGenerator] → 模型不存在或未啟用")
                elif "permission" in error_msg.lower() or "403" in error_msg:
                    print(f"[VideoGenerator] → 無權限存取此模型")
                elif "quota" in error_msg.lower():
                    print(f"[VideoGenerator] → 配額不足")
                continue
        
        print("[VideoGenerator] 所有 Veo 模型都不可用")
        return None
    
    def _build_veo_prompt(self, script: Dict[str, Any]) -> str:
        """
        構建專業級 Veo 影片提示詞
        採用 Google Veo 最佳實踐 + 電影級敘事結構 + 負面提示詞
        """
        import random
        
        scenes = script.get("scenes", [])
        title = script.get("title", "")
        description = script.get("description", "")
        style = script.get("overall_style", "modern, professional")
        color_palette = script.get("color_palette", ["#6366F1", "#8B5CF6"])
        personality = script.get("personality", "professional")
        target_platform = script.get("target_platform", "tiktok")
        music_genre = script.get("music_genre", "upbeat")
        
        # 電影級風格映射 - 專業廣告級視覺描述
        CINEMATIC_STYLES = {
            "professional": {
                "visual": "clean corporate aesthetic with polished glass and metal surfaces, geometric architectural compositions, premium office environment",
                "lighting": "soft three-point lighting setup with gentle fill, subtle rim lights creating depth, professional studio quality, even exposure",
                "camera": ["Smooth dolly forward", "Steady tracking shot", "Elegant crane descent", "Professional steadicam glide"],
                "atmosphere": "sophisticated confidence, premium quality, trustworthy, authoritative yet approachable",
                "color_grade": "neutral tones with subtle warm highlights, corporate blue accents, clean whites, professional color science",
                "reference": "Apple product videos, corporate brand films, TED talk cinematography"
            },
            "friendly": {
                "visual": "warm lifestyle scenes with natural textures, authentic human moments, cozy interiors, soft fabrics and wood elements",
                "lighting": "soft golden hour glow streaming through windows, natural daylight, warm practical lamps, flattering skin tones",
                "camera": ["Gentle handheld movement", "Intimate close-up", "Smooth follow shot", "Natural observational pan"],
                "atmosphere": "welcoming warmth, genuine human connection, approachable comfort, relatable authenticity",
                "color_grade": "warm orange and amber tones, soft lifted shadows, nostalgic film emulation, creamy highlights",
                "reference": "Google Pixel ads, Airbnb films, lifestyle brand content"
            },
            "luxurious": {
                "visual": "premium materials including marble, gold leaf, velvet, crystal reflections, high-end architectural details, fashion editorial aesthetic",
                "lighting": "dramatic key lighting with sparkling highlights, deep cinematic shadows, chiaroscuro technique, jewelry-style spotlights",
                "camera": ["Slow majestic crane shot", "Elegant orbit around subject", "Cinematic reveal", "Luxurious tracking dolly"],
                "atmosphere": "opulent grandeur, exclusive sophistication, timeless elegance, aspirational luxury",
                "color_grade": "rich blacks, golden highlights, deep contrast, film noir influence, desaturated with selective color",
                "reference": "Chanel No. 5, Rolex, Louis Vuitton campaigns, haute couture films"
            },
            "playful": {
                "visual": "vibrant saturated colors, dynamic geometric shapes, energetic compositions, bold graphic elements, pop art influence",
                "lighting": "bright even lighting with colorful gels, neon accents, RGB LED effects, festival atmosphere",
                "camera": ["Dynamic whip pan", "Energetic tracking shot", "Playful zoom in", "Quick-cut montage movement"],
                "atmosphere": "joyful energy, youthful excitement, creative fun, infectious enthusiasm",
                "color_grade": "highly saturated colors, boosted contrast, candy-colored palette, punchy processing",
                "reference": "Spotify Wrapped, Nintendo ads, Gen-Z brand content"
            },
            "minimalist": {
                "visual": "clean negative space dominating frame, simple geometric forms, Zen-like simplicity, single subject isolation",
                "lighting": "soft diffused light from large sources, minimal shadows, ethereal glow, clean studio environment",
                "camera": ["Static contemplative shot", "Slow subtle push in", "Clean tilt reveal", "Meditative static frame"],
                "atmosphere": "serene calm, thoughtful stillness, intentional simplicity, peaceful focus",
                "color_grade": "muted desaturated tones, pure whites and soft grays, subtle pastel accents, high-key processing",
                "reference": "Muji campaigns, Apple product photography, Scandinavian design films"
            },
            "innovative": {
                "visual": "futuristic elements, floating UI interfaces, holographic effects, sci-fi aesthetic, data visualization, tech environments",
                "lighting": "cool blue and cyan tech lighting, LED strips, screen glow effects, neon accents, volumetric light rays",
                "camera": ["Dynamic drone descent", "Matrix-style smooth motion", "Sci-fi tracking shot", "Tech reveal dolly"],
                "atmosphere": "cutting-edge innovation, future-forward vision, technological wonder, digital frontier",
                "color_grade": "cool blue tones, electric cyan accents, digital color banding, cyberpunk influence",
                "reference": "Tesla Cybertruck reveal, tech keynotes, sci-fi film aesthetics"
            },
            "trustworthy": {
                "visual": "authentic real-world moments, genuine unposed expressions, documentary-style framing, real locations",
                "lighting": "natural available light only, honest shadows, no artificial enhancement, true-to-life conditions",
                "camera": ["Documentary handheld", "Observational steady shot", "Authentic follow", "Vérité style capture"],
                "atmosphere": "reliable authenticity, honest integrity, genuine trust, real human stories",
                "color_grade": "natural realistic colors, minimal grading, true-to-life tones, documentary processing",
                "reference": "Nike real athlete stories, Patagonia documentaries, P&G emotional ads"
            },
            "energetic": {
                "visual": "action-packed scenes with controlled motion blur, dynamic Dutch angles, sports aesthetic, physical movement",
                "lighting": "dramatic backlighting creating silhouettes, sun flares, high contrast action lighting, stadium lights",
                "camera": ["Fast tracking shot", "Dynamic steadicam run", "Explosive zoom", "Action sequence dolly"],
                "atmosphere": "adrenaline rush, powerful momentum, unstoppable energy, peak performance",
                "color_grade": "high contrast processing, punchy saturated colors, teal and orange blockbuster look",
                "reference": "Red Bull extreme sports, Nike Just Do It, action movie trailers"
            },
        }
        
        # 獲取風格配置
        style_config = CINEMATIC_STYLES.get(personality, CINEMATIC_STYLES["professional"])
        
        # 提取場景視覺精華和負面提示詞
        scene_visuals = []
        scene_negatives = []
        for scene in scenes[:4]:
            visual = scene.get("visual_prompt", "")
            if visual:
                scene_visuals.append(visual)
            negative = scene.get("negative_prompt", "")
            if negative:
                scene_negatives.append(negative)
        
        primary_color = color_palette[0] if color_palette else "#6366F1"
        secondary_color = color_palette[1] if len(color_palette) > 1 else primary_color
        
        # 選擇相應的攝影機運動
        camera_move = random.choice(style_config["camera"])
        
        # 根據場景內容決定主體
        main_subject = scene_visuals[0] if scene_visuals else description or "elegant product presentation"
        
        # 音樂氛圍映射
        MUSIC_VIBES = {
            "upbeat": "energetic rhythm driving the visual pace, upbeat tempo sync",
            "calm": "peaceful ambient soundscape, gentle flow",
            "emotional": "touching cinematic score building emotion, swelling strings",
            "epic": "powerful orchestral crescendo, dramatic build",
            "minimal": "subtle electronic beats, understated pulse",
            "inspirational": "uplifting motivational music, hopeful progression",
        }
        music_vibe = MUSIC_VIBES.get(music_genre, "modern contemporary soundtrack")
        
        # 構建專業級提示詞 - Google Veo 最佳格式
        prompt = f"""{camera_move} revealing {main_subject}.

VISUAL STYLE:
{style_config["visual"]}
Overall aesthetic: {style}, cinematic commercial quality
Style reference: {style_config["reference"]}

LIGHTING DESIGN:
{style_config["lighting"]}
Color temperature: {style_config["color_grade"]}

ATMOSPHERE & EMOTION:
{style_config["atmosphere"]}
Narrative context: {description}

TECHNICAL SPECIFICATIONS:
- Format: Vertical 9:16 optimized for {target_platform}
- Resolution: 1080x1920 Full HD, crisp and sharp
- Frame rate: 24fps cinematic motion with natural motion blur
- Depth of field: Shallow with beautiful circular bokeh
- Motion: {camera_move.lower()}, smooth and professional, no jitter
- Color palette: Primary {primary_color}, Secondary {secondary_color}
- Aspect ratio: Perfect 9:16 framing, no cropping needed

AUDIO SYNC:
Visual rhythm matching {music_vibe}

QUALITY REQUIREMENTS (MUST HAVE):
- 8K source quality downsampled to 1080p for maximum clarity
- Professional cinematography standards, broadcast ready
- Perfect color grading with accurate skin tones
- Subtle film grain for organic texture
- Sharp focus on subject with smooth focus transitions
- Clean plate, no compression artifacts
- Professional production value, advertising agency standard
- Natural movement, no AI jitter or morphing artifacts

AVOID (CRITICAL - DO NOT GENERATE):
- Blurry or out of focus footage
- Pixelated or low resolution output
- Distorted or morphing shapes
- Unnatural human movements or expressions
- Watermarks, logos, or text overlays
- Compression artifacts or banding
- Overexposed or underexposed areas
- Amateur or stock footage appearance
- AI-generated look or uncanny valley effect
- Jittery camera movement or frame drops
- Color banding in gradients
- Noisy or grainy footage (unless intentional film grain)"""

        print(f"[VideoGenerator] 📝 Veo 提示詞 (風格: {personality}):\n{prompt[:400]}...")
        
        return prompt.strip()
    
    async def _generate_with_imagen_ffmpeg(
        self,
        script: Dict[str, Any],
        project_id: str
    ) -> VideoResult:
        """
        使用 Imagen 生成圖片 + FFmpeg 合成影片
        """
        scenes = script.get("scenes", [])
        format_str = script.get("format", "9:16")
        color_palette = script.get("color_palette", ["#6366F1", "#8B5CF6"])
        total_duration = sum(s.get("duration_seconds", 5) for s in scenes)
        
        # 設定尺寸
        if format_str == "9:16":
            width, height = 1080, 1920
        elif format_str == "16:9":
            width, height = 1920, 1080
        else:
            width, height = 1080, 1080
        
        # 1. 生成所有場景圖片
        scene_images: List[str] = []
        scene_audios: List[Optional[str]] = []
        
        for i, scene in enumerate(scenes):
            print(f"[VideoGenerator] 📸 生成場景 {i+1}/{len(scenes)}")
            
            visual_prompt = scene.get("visual_prompt", "")
            text_overlay = scene.get("text_overlay")
            narration = scene.get("narration_text", "")
            negative_prompt = scene.get("negative_prompt", "")
            quality_tags = scene.get("quality_tags", "")
            
            # 生成圖片 (帶品質標籤和負面提示詞)
            image_base64 = await self._generate_image(
                visual_prompt,
                color_palette,
                width,
                height,
                text_overlay,
                i + 1,
                len(scenes),
                negative_prompt,
                quality_tags
            )
            
            if image_base64:
                scene_images.append(image_base64)
            
            # 生成語音
            audio_path = None
            if narration and EDGE_TTS_AVAILABLE:
                voice_style = scene.get("voice_emotion", "friendly")
                audio_path = await self._generate_tts(narration, project_id, i, voice_style)
            scene_audios.append(audio_path)
        
        print(f"[VideoGenerator] ✅ 圖片生成完成，共 {len(scene_images)} 張")
        
        # 2. 生成背景音樂
        music_path = await self._generate_background_music(
            script.get("music_genre", "upbeat"),
            total_duration,
            project_id
        )
        
        # 3. 使用 FFmpeg 合成影片
        video_path = await self._create_video_ffmpeg(
            scene_images,
            scenes,
            scene_audios,
            music_path,
            project_id,
            width,
            height
        )
        
        # 4. 處理影片輸出
        video_base64 = None
        video_url = ""
        file_size = 0
        generation_method = "imagen+ffmpeg"
        
        if video_path and os.path.exists(video_path):
            file_size = os.path.getsize(video_path)
            print(f"[VideoGenerator] 🎉 影片合成成功，大小: {file_size / 1024 / 1024:.2f} MB")
            
            # 移動到靜態目錄供下載
            static_dir = Path("/app/static/videos")
            static_dir.mkdir(parents=True, exist_ok=True)
            
            video_filename = f"video_{project_id}.mp4"
            static_path = static_dir / video_filename
            
            import shutil
            shutil.move(video_path, static_path)
            
            # 返回可下載的 URL（相對路徑，前端會透過 API 請求）
            video_url = f"/video/download/{video_filename}"
            
            print(f"[VideoGenerator] 📁 影片已保存: {static_path}")
        else:
            video_url = scene_images[0] if scene_images else ""
            generation_method = "placeholder"
        
        return VideoResult(
            video_url=video_url,
            video_base64=video_base64,
            thumbnail_url=scene_images[0] if scene_images else None,
            duration=total_duration,
            format=format_str,
            file_size=file_size,
            scene_images=scene_images,
            generation_method=generation_method
        )
    
    async def _generate_image(
        self,
        visual_prompt: str,
        color_palette: List[str],
        width: int,
        height: int,
        text_overlay: Optional[str],
        scene_num: int,
        total_scenes: int,
        negative_prompt: str = "",
        quality_tags: str = ""
    ) -> Optional[str]:
        """生成場景圖片 - 專業級品質"""
        
        aspect_ratio = f"{width}:{height}"
        if width == 1080 and height == 1920:
            aspect_ratio = "9:16"
        elif width == 1920 and height == 1080:
            aspect_ratio = "16:9"
        elif width == height:
            aspect_ratio = "1:1"
        
        # 預設品質標籤
        default_quality = "8K resolution, professional photography, cinematic quality, sharp focus, perfect exposure, broadcast ready, advertising standard, color graded, pristine image quality"
        
        # 預設負面提示詞
        default_negative = "blurry, pixelated, low quality, distorted, deformed, bad anatomy, extra limbs, cropped, watermark, text, logo, amateur, stock photo, generic, overexposed, underexposed, noisy, grainy, jpeg artifacts, compression, bad lighting, harsh shadows, AI-generated look, uncanny valley"
        
        # 合併品質標籤
        final_quality = quality_tags if quality_tags else default_quality
        final_negative = negative_prompt if negative_prompt else default_negative
        
        # 1. 嘗試使用 Imagen
        client = vertexai_client or genai_client
        if client and visual_prompt:
            # 構建專業級增強提示詞
            enhanced_prompt = f"""{visual_prompt}

STYLE & QUALITY:
Professional video frame for short-form content, {aspect_ratio} vertical format.
{final_quality}
Cinematic color grading, perfect white balance, professional studio lighting.
Sharp subject focus with beautiful bokeh background.
Clean composition optimized for mobile viewing.

TECHNICAL REQUIREMENTS:
- Resolution: {width}x{height} pixels, crisp and detailed
- Aspect ratio: {aspect_ratio} perfectly framed
- Color depth: Rich, accurate colors with smooth gradients
- Focus: Tack sharp on subject, gentle falloff
- Exposure: Perfect, no clipping in highlights or shadows
- Noise: Clean, grain-free image (or subtle film grain if appropriate)

MUST AVOID: {final_negative}"""
            
            imagen_models = [
                "models/imagen-4.0-fast-generate-001",
                "models/gemini-2.0-flash-exp-image-generation",
                "models/imagen-4.0-generate-001",
            ]
            
            for model_name in imagen_models:
                try:
                    if hasattr(client.models, 'generate_images'):
                        response = await asyncio.wait_for(
                            asyncio.to_thread(
                                client.models.generate_images,
                                model=model_name,
                                prompt=enhanced_prompt
                            ),
                            timeout=60.0
                        )
                        
                        if response.generated_images:
                            image_data = response.generated_images[0].image.image_bytes
                            
                            # 調整尺寸
                            img = Image.open(io.BytesIO(image_data))
                            img = self._resize_image(img, width, height)
                            
                            # 添加文字
                            if text_overlay:
                                img = self._add_text_overlay(img, text_overlay, color_palette)
                            
                            buffer = io.BytesIO()
                            img.save(buffer, format='PNG', quality=95)
                            
                            print(f"[VideoGenerator] ✓ Imagen 圖片生成成功 (場景 {scene_num})")
                            return f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode()}"
                        
                except asyncio.TimeoutError:
                    continue
                except Exception as e:
                    if "not found" not in str(e).lower():
                        print(f"[VideoGenerator] Imagen 錯誤: {str(e)[:80]}")
                    continue
        
        # 2. 生成設計圖
        print(f"[VideoGenerator] 🎨 場景 {scene_num}: 使用設計圖")
        return self._generate_designed_image(color_palette, width, height, text_overlay, scene_num, total_scenes)
    
    def _resize_image(self, img: Image.Image, target_width: int, target_height: int) -> Image.Image:
        """調整圖片尺寸"""
        original_ratio = img.width / img.height
        target_ratio = target_width / target_height
        
        if original_ratio > target_ratio:
            new_width = int(img.height * target_ratio)
            left = (img.width - new_width) // 2
            img = img.crop((left, 0, left + new_width, img.height))
        else:
            new_height = int(img.width / target_ratio)
            top = (img.height - new_height) // 2
            img = img.crop((0, top, img.width, top + new_height))
        
        return img.resize((target_width, target_height), Image.Resampling.LANCZOS)
    
    def _add_text_overlay(self, img: Image.Image, text: str, color_palette: List[str]) -> Image.Image:
        """添加文字疊加"""
        draw = ImageDraw.Draw(img)
        width, height = img.size
        
        try:
            font_size = width // 18
            try:
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
            except:
                font = ImageFont.load_default()
            
            text = text[:40] if len(text) > 40 else text
            bbox = draw.textbbox((0, 0), text, font=font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
            
            x = (width - text_width) // 2
            y = height // 2 - text_height // 2
            
            padding = 30
            draw.rounded_rectangle(
                [(x - padding, y - padding), (x + text_width + padding, y + text_height + padding)],
                radius=15,
                fill=(0, 0, 0, 180)
            )
            draw.text((x, y), text, fill=(255, 255, 255), font=font)
            
        except Exception as e:
            print(f"[VideoGenerator] 文字繪製錯誤: {e}")
        
        return img
    
    def _desaturate_color(self, rgb: tuple, factor: float = 0.4) -> tuple:
        """
        降低顏色飽和度
        factor: 0 = 完全灰度, 1 = 原色
        """
        r, g, b = rgb
        gray = int(0.299 * r + 0.587 * g + 0.114 * b)
        return (
            int(gray + (r - gray) * factor),
            int(gray + (g - gray) * factor),
            int(gray + (b - gray) * factor)
        )
    
    def _generate_designed_image(
        self,
        color_palette: List[str],
        width: int,
        height: int,
        text_overlay: Optional[str],
        scene_num: int,
        total_scenes: int
    ) -> str:
        """
        生成高級設計感圖片 - 低彩度、極簡、現代風格
        
        設計風格參考：
        - Apple 極簡主義
        - 高端品牌視覺
        - 北歐設計美學
        """
        if not PIL_AVAILABLE:
            return ""
        
        try:
            import random
            import math
            
            # ========== 低彩度配色系統 ==========
            
            # 場景配色主題（每個場景使用不同主題）
            DESIGN_THEMES = [
                {
                    "name": "Midnight",
                    "bg_start": (28, 32, 38),      # 深邃藍灰
                    "bg_end": (18, 20, 24),        # 近黑色
                    "accent": (90, 95, 105),       # 中性灰
                    "highlight": (160, 165, 175),  # 淺灰
                    "text": (235, 235, 240),       # 近白
                },
                {
                    "name": "Warm Stone",
                    "bg_start": (45, 42, 40),      # 暖灰棕
                    "bg_end": (28, 26, 24),        # 深棕灰
                    "accent": (120, 110, 100),     # 沙色
                    "highlight": (180, 170, 160),  # 米色
                    "text": (240, 238, 235),       # 暖白
                },
                {
                    "name": "Cool Slate",
                    "bg_start": (35, 40, 48),      # 冷灰藍
                    "bg_end": (20, 22, 28),        # 深藍灰
                    "accent": (80, 100, 120),      # 鋼藍
                    "highlight": (140, 160, 180),  # 淺鋼藍
                    "text": (230, 235, 245),       # 冷白
                },
                {
                    "name": "Forest",
                    "bg_start": (32, 38, 35),      # 深森林綠
                    "bg_end": (18, 22, 20),        # 近黑綠
                    "accent": (70, 90, 80),        # 灰綠
                    "highlight": (130, 150, 140),  # 淺灰綠
                    "text": (235, 240, 238),       # 綠白
                },
                {
                    "name": "Dusty Rose",
                    "bg_start": (42, 36, 38),      # 灰玫瑰
                    "bg_end": (24, 20, 22),        # 深玫瑰灰
                    "accent": (100, 80, 85),       # 暗玫瑰
                    "highlight": (165, 145, 150),  # 淺玫瑰
                    "text": (242, 238, 240),       # 粉白
                },
                {
                    "name": "Charcoal",
                    "bg_start": (38, 38, 38),      # 純灰
                    "bg_end": (22, 22, 22),        # 炭黑
                    "accent": (85, 85, 85),        # 中灰
                    "highlight": (150, 150, 150),  # 淺灰
                    "text": (240, 240, 240),       # 純白
                },
            ]
            
            # 選擇主題（根據場景編號輪換）
            theme = DESIGN_THEMES[(scene_num - 1) % len(DESIGN_THEMES)]
            
            # 也可以根據品牌色調整主題
            if color_palette:
                brand_rgb = self._hex_to_rgb(color_palette[0])
                # 將品牌色降低彩度後融入
                desaturated = self._desaturate_color(brand_rgb, 0.25)
                theme["accent"] = desaturated
                theme["highlight"] = self._desaturate_color(brand_rgb, 0.35)
            
            img = Image.new('RGB', (width, height))
            
            # ========== 高級漸層背景 ==========
            bg_start = theme["bg_start"]
            bg_end = theme["bg_end"]
            
            for y in range(height):
                for x in range(width):
                    # 多層漸層混合
                    # 1. 基礎垂直漸層
                    v_ratio = y / height
                    # 2. 輕微徑向漸層（中心稍亮）
                    cx, cy = width / 2, height * 0.4
                    dist = math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
                    max_dist = math.sqrt(cx ** 2 + cy ** 2)
                    r_ratio = dist / max_dist
                    
                    # 混合比例
                    ratio = v_ratio * 0.7 + r_ratio * 0.3
                    ratio = min(1.0, max(0.0, ratio))
                    
                    # 輕微噪點紋理（高級質感）
                    noise = (random.random() - 0.5) * 4
                    
                    r = int(bg_start[0] + (bg_end[0] - bg_start[0]) * ratio + noise)
                    g = int(bg_start[1] + (bg_end[1] - bg_start[1]) * ratio + noise)
                    b = int(bg_start[2] + (bg_end[2] - bg_start[2]) * ratio + noise)
                    
                    # 確保在有效範圍
                    r = max(0, min(255, r))
                    g = max(0, min(255, g))
                    b = max(0, min(255, b))
                    
                    img.putpixel((x, y), (r, g, b))
            
            draw = ImageDraw.Draw(img, 'RGBA')
            
            # ========== 極簡幾何裝飾 ==========
            
            accent = theme["accent"]
            highlight = theme["highlight"]
            
            # 設計風格選擇（每個場景不同）
            design_style = scene_num % 4
            
            if design_style == 0:
                # 風格 1: 大型圓弧
                arc_cx = width * 0.7
                arc_cy = height * 0.3
                arc_r = min(width, height) * 0.6
                for offset in range(3):
                    alpha = 15 - offset * 4
                    draw.arc(
                        [(arc_cx - arc_r - offset * 40, arc_cy - arc_r - offset * 40),
                         (arc_cx + arc_r + offset * 40, arc_cy + arc_r + offset * 40)],
                        start=180, end=300,
                        fill=(*highlight, alpha),
                        width=2
                    )
                    
            elif design_style == 1:
                # 風格 2: 對角線條
                line_count = 5
                for i in range(line_count):
                    offset = i * 80 - 100
                    alpha = 20 - i * 3
                    draw.line(
                        [(0, height * 0.3 + offset), (width, height * 0.7 + offset)],
                        fill=(*accent, max(5, alpha)),
                        width=1
                    )
                    
            elif design_style == 2:
                # 風格 3: 圓形裝飾（右下角）
                circle_cx = width * 0.85
                circle_cy = height * 0.75
                for r in range(3):
                    radius = 150 + r * 60
                    alpha = 25 - r * 7
                    draw.ellipse(
                        [(circle_cx - radius, circle_cy - radius),
                         (circle_cx + radius, circle_cy + radius)],
                        outline=(*highlight, max(5, alpha)),
                        width=1
                    )
                    
            else:
                # 風格 4: 極簡矩形
                rect_x = width * 0.1
                rect_y = height * 0.6
                rect_w = width * 0.3
                rect_h = height * 0.25
                draw.rectangle(
                    [(rect_x, rect_y), (rect_x + rect_w, rect_y + rect_h)],
                    outline=(*accent, 20),
                    width=1
                )
            
            # ========== 微妙光暈（聚光燈效果）==========
            glow_cx = width * 0.5
            glow_cy = height * 0.35
            for radius in range(300, 600, 30):
                alpha = int(8 * (600 - radius) / 300)
                draw.ellipse(
                    [(glow_cx - radius, glow_cy - radius),
                     (glow_cx + radius, glow_cy + radius)],
                    fill=(*highlight, max(1, alpha))
                )
            
            # ========== 純視覺設計（無文字）==========
            # 中央裝飾元素（替代文字）
            center_x = width // 2
            center_y = int(height * 0.42)
            
            # 中央圓形裝飾
            for r in range(3):
                radius = 60 + r * 25
                alpha = 30 - r * 8
                draw.ellipse(
                    [(center_x - radius, center_y - radius),
                     (center_x + radius, center_y + radius)],
                    outline=(*highlight, max(8, alpha)),
                    width=1
                )
            
            # 中央水平線
            line_width = 120
            draw.line(
                [(center_x - line_width, center_y),
                 (center_x + line_width, center_y)],
                fill=(*accent, 40),
                width=1
            )
            
            # 中央垂直線
            line_height = 80
            draw.line(
                [(center_x, center_y - line_height),
                 (center_x, center_y + line_height)],
                fill=(*accent, 40),
                width=1
            )
            
            # ========== 頂部漸層遮罩 ==========
            for y_pos in range(120):
                alpha = int((120 - y_pos) / 120 * 40)
                draw.line([(0, y_pos), (width, y_pos)], fill=(*bg_start, alpha))
            
            # ========== 底部漸層遮罩 ==========
            for y_pos in range(height - 150, height):
                alpha = int((y_pos - (height - 150)) / 150 * 60)
                draw.line([(0, y_pos), (width, y_pos)], fill=(*bg_end, alpha))
            
            # ========== 邊框裝飾線（極細）==========
            margin = 40
            draw.rectangle(
                [(margin, margin), (width - margin, height - margin)],
                outline=(*accent, 15),
                width=1
            )
            
            buffer = io.BytesIO()
            img.save(buffer, format='PNG', quality=95)
            return f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode()}"
            
        except Exception as e:
            print(f"[VideoGenerator] 設計圖生成錯誤: {e}")
            import traceback
            traceback.print_exc()
            return ""
    
    async def _generate_tts(
        self,
        text: str,
        project_id: str,
        scene_idx: int,
        voice_style: str = "friendly"
    ) -> Optional[str]:
        """生成 TTS 語音"""
        if not EDGE_TTS_AVAILABLE:
            return None
        
        try:
            voice = self.TTS_VOICES.get(voice_style, self.TTS_VOICES["friendly"])
            audio_path = self.output_dir / f"tts_{project_id}_{scene_idx}.mp3"
            
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(str(audio_path))
            
            print(f"[VideoGenerator] 🎤 TTS: {text[:30]}...")
            return str(audio_path)
            
        except Exception as e:
            print(f"[VideoGenerator] TTS 錯誤: {e}")
            return None
    
    async def _generate_background_music(
        self,
        mood: str,
        duration: float,
        project_id: str
    ) -> Optional[str]:
        """
        生成專業級背景音樂
        
        包含：
        - 和弦進行
        - 節奏型態
        - 低音線
        - 環境音效
        - 動態變化
        """
        try:
            music_path = self.output_dir / f"bgm_{project_id}.wav"
            
            sample_rate = 44100
            total_samples = int(duration * sample_rate)
            
            # 專業和弦配置 - 不同情緒的和弦進行
            MOOD_CONFIGS = {
                "upbeat": {
                    "chords": [
                        [261.63, 329.63, 392.00],  # C major
                        [293.66, 369.99, 440.00],  # D major
                        [329.63, 415.30, 493.88],  # E minor
                        [349.23, 440.00, 523.25],  # F major
                    ],
                    "bpm": 120,
                    "bass_octave": 0.5,
                    "brightness": 1.2,
                    "rhythm_intensity": 0.8,
                },
                "calm": {
                    "chords": [
                        [220.00, 277.18, 329.63],  # A minor
                        [246.94, 311.13, 369.99],  # B diminished
                        [261.63, 329.63, 392.00],  # C major
                        [293.66, 349.23, 440.00],  # D minor
                    ],
                    "bpm": 70,
                    "bass_octave": 0.25,
                    "brightness": 0.7,
                    "rhythm_intensity": 0.3,
                },
                "energetic": {
                    "chords": [
                        [329.63, 415.30, 493.88],  # E major
                        [369.99, 466.16, 554.37],  # F# minor
                        [392.00, 493.88, 587.33],  # G major
                        [440.00, 554.37, 659.25],  # A major
                    ],
                    "bpm": 140,
                    "bass_octave": 0.5,
                    "brightness": 1.4,
                    "rhythm_intensity": 1.0,
                },
                "emotional": {
                    "chords": [
                        [261.63, 311.13, 392.00],  # C sus2
                        [293.66, 349.23, 440.00],  # D minor
                        [220.00, 277.18, 329.63],  # A minor
                        [246.94, 293.66, 369.99],  # B minor 7
                    ],
                    "bpm": 80,
                    "bass_octave": 0.25,
                    "brightness": 0.9,
                    "rhythm_intensity": 0.4,
                },
                "epic": {
                    "chords": [
                        [261.63, 329.63, 392.00],  # C major
                        [220.00, 277.18, 329.63],  # A minor
                        [349.23, 440.00, 523.25],  # F major
                        [392.00, 493.88, 587.33],  # G major
                    ],
                    "bpm": 100,
                    "bass_octave": 0.5,
                    "brightness": 1.3,
                    "rhythm_intensity": 0.9,
                },
                "minimal": {
                    "chords": [
                        [261.63, 392.00],  # C5
                        [293.66, 440.00],  # D5
                        [329.63, 493.88],  # E5
                        [261.63, 392.00],  # C5
                    ],
                    "bpm": 90,
                    "bass_octave": 0.25,
                    "brightness": 0.6,
                    "rhythm_intensity": 0.2,
                },
                "inspirational": {
                    "chords": [
                        [261.63, 329.63, 392.00],  # C major
                        [329.63, 392.00, 493.88],  # E minor
                        [349.23, 440.00, 523.25],  # F major
                        [392.00, 493.88, 587.33],  # G major
                    ],
                    "bpm": 95,
                    "bass_octave": 0.5,
                    "brightness": 1.1,
                    "rhythm_intensity": 0.6,
                },
            }
            
            config = MOOD_CONFIGS.get(mood, MOOD_CONFIGS["upbeat"])
            chords = config["chords"]
            bpm = config["bpm"]
            bass_octave = config["bass_octave"]
            brightness = config["brightness"]
            rhythm_intensity = config["rhythm_intensity"]
            
            # 計算節拍
            beat_duration = 60.0 / bpm
            samples_per_beat = int(beat_duration * sample_rate)
            chord_duration = beat_duration * 4  # 每個和弦持續 4 拍
            samples_per_chord = int(chord_duration * sample_rate)
            
            audio_data = []
            
            for i in range(total_samples):
                t = i / sample_rate
                
                # 當前和弦
                chord_idx = int(t / chord_duration) % len(chords)
                freqs = chords[chord_idx]
                
                # 和弦墊音（柔和的背景）
                pad = 0.0
                for f in freqs:
                    # 使用正弦波 + 輕微諧波
                    pad += math.sin(2 * math.pi * f * t) * 0.08
                    pad += math.sin(2 * math.pi * f * 2 * t) * 0.02 * brightness  # 八度諧波
                    pad += math.sin(2 * math.pi * f * 0.5 * t) * 0.04  # 低八度
                
                # 低音線
                bass_freq = freqs[0] * bass_octave
                bass = math.sin(2 * math.pi * bass_freq * t) * 0.12
                # 低音包絡 - 在每拍開始時強調
                beat_position = (t % beat_duration) / beat_duration
                bass_envelope = math.exp(-beat_position * 3) * 0.8 + 0.2
                bass *= bass_envelope
                
                # 節奏元素 - 輕微的脈衝
                rhythm = 0.0
                if rhythm_intensity > 0.3:
                    pulse_freq = bpm / 60  # 每秒拍數
                    rhythm = math.sin(2 * math.pi * pulse_freq * t) * 0.05 * rhythm_intensity
                    # 添加高帽感覺的高頻
                    hihat_t = t % (beat_duration / 2)
                    if hihat_t < 0.01:
                        rhythm += 0.03 * rhythm_intensity
                
                # 環境層 - 非常輕微的噪音感
                import random
                ambient = (random.random() - 0.5) * 0.01
                
                # 動態變化 - 根據時間位置調整音量
                progress = i / total_samples
                
                # 開場漸入（前 10%）
                if progress < 0.1:
                    dynamics = progress / 0.1
                # 結尾漸出（後 15%）
                elif progress > 0.85:
                    dynamics = (1.0 - progress) / 0.15
                # 中間高潮點
                elif 0.4 < progress < 0.6:
                    dynamics = 1.0 + (0.5 - abs(progress - 0.5)) * 0.3
                else:
                    dynamics = 1.0
                
                # 混合所有元素
                sample = (pad + bass + rhythm + ambient) * dynamics * 0.7
                
                # 軟限幅
                if sample > 0.95:
                    sample = 0.95
                elif sample < -0.95:
                    sample = -0.95
                
                audio_data.append(int(sample * 32767))
            
            # 寫入 WAV 文件（立體聲）
            with open(music_path, 'wb') as f:
                num_channels = 1
                bits_per_sample = 16
                byte_rate = sample_rate * num_channels * bits_per_sample // 8
                block_align = num_channels * bits_per_sample // 8
                data_size = len(audio_data) * bits_per_sample // 8
                
                f.write(b'RIFF')
                f.write(struct.pack('<I', 36 + data_size))
                f.write(b'WAVE')
                f.write(b'fmt ')
                f.write(struct.pack('<I', 16))  # PCM
                f.write(struct.pack('<H', 1))   # Audio format (PCM)
                f.write(struct.pack('<H', num_channels))
                f.write(struct.pack('<I', sample_rate))
                f.write(struct.pack('<I', byte_rate))
                f.write(struct.pack('<H', block_align))
                f.write(struct.pack('<H', bits_per_sample))
                f.write(b'data')
                f.write(struct.pack('<I', data_size))
                for s in audio_data:
                    f.write(struct.pack('<h', s))
            
            print(f"[VideoGenerator] 🎵 專業背景音樂 ({mood}, {bpm}BPM, {duration:.1f}秒)")
            return str(music_path)
            
        except Exception as e:
            print(f"[VideoGenerator] 背景音樂錯誤: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    async def _create_video_ffmpeg(
        self,
        scene_images: List[str],
        scenes: List[Dict],
        scene_audios: List[Optional[str]],
        music_path: Optional[str],
        project_id: str,
        width: int,
        height: int
    ) -> Optional[str]:
        """
        使用 FFmpeg 合成專業級影片
        
        特效包含：
        - Ken Burns 效果（緩慢縮放/平移動態）
        - 場景轉場（交叉淡化）
        - TTS 語音混合
        - 高品質編碼
        """
        
        # 檢查 FFmpeg
        try:
            result = await asyncio.create_subprocess_exec(
                "ffmpeg", "-version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await result.communicate()
            if result.returncode != 0:
                return None
        except:
            print("[VideoGenerator] FFmpeg 未安裝")
            return None
        
        try:
            import random
            
            # Ken Burns 效果配置 - 讓靜態圖片產生動態感
            KEN_BURNS_EFFECTS = [
                # (起始縮放, 結束縮放, X偏移方向, Y偏移方向)
                (1.0, 1.15, 0.5, 0.5),    # 緩慢放大，中心
                (1.15, 1.0, 0.5, 0.5),    # 緩慢縮小，中心
                (1.0, 1.12, 0.0, 0.0),    # 放大，左上角
                (1.0, 1.12, 1.0, 1.0),    # 放大，右下角
                (1.12, 1.0, 0.0, 1.0),    # 縮小，左下角
                (1.12, 1.0, 1.0, 0.0),    # 縮小，右上角
                (1.0, 1.08, 0.5, 0.0),    # 微放大，上中
                (1.0, 1.08, 0.5, 1.0),    # 微放大，下中
            ]
            
            # 轉場時長（秒）
            TRANSITION_DURATION = 0.5
            
            # 保存圖片並生成帶效果的片段
            image_paths = []
            for i, img_base64 in enumerate(scene_images):
                img_data = img_base64.split(",")[1] if "," in img_base64 else img_base64
                img_bytes = base64.b64decode(img_data)
                
                img_path = self.output_dir / f"scene_{project_id}_{i}.png"
                with open(img_path, "wb") as f:
                    f.write(img_bytes)
                
                duration = scenes[i].get("duration_seconds", 5) if i < len(scenes) else 5
                camera_movement = scenes[i].get("camera_movement", "static") if i < len(scenes) else "static"
                image_paths.append((str(img_path), duration, camera_movement))
            
            # 生成每個場景的視頻片段（帶 Ken Burns 效果）
            segment_files = []
            for i, (img_path, duration, camera_move) in enumerate(image_paths):
                segment_path = self.output_dir / f"segment_{project_id}_{i}.mp4"
                
                # 根據場景編號選擇不同的 Ken Burns 效果
                effect = KEN_BURNS_EFFECTS[i % len(KEN_BURNS_EFFECTS)]
                start_scale, end_scale, x_dir, y_dir = effect
                
                # 根據 camera_movement 調整效果
                if camera_move == "dolly_in":
                    start_scale, end_scale = 1.0, 1.2
                elif camera_move == "dolly_out":
                    start_scale, end_scale = 1.2, 1.0
                elif camera_move == "tracking":
                    x_dir = 0.0 if random.random() > 0.5 else 1.0
                elif camera_move == "crane_up":
                    y_dir = 1.0
                    start_scale, end_scale = 1.0, 1.1
                elif camera_move == "crane_down":
                    y_dir = 0.0
                    start_scale, end_scale = 1.1, 1.0
                elif camera_move == "orbit":
                    x_dir = 0.0
                    start_scale, end_scale = 1.05, 1.05
                
                # 計算 FFmpeg zoompan 濾鏡參數
                # zoompan 參數：z=縮放, x=X位置, y=Y位置, d=總幀數, s=輸出尺寸, fps=幀率
                fps = 30
                total_frames = int(duration * fps)
                
                # 計算縮放動畫
                # z 從 start_scale 到 end_scale
                # 使用 easing 讓動畫更流暢
                zoom_expr = f"if(lte(on,1),{start_scale},{start_scale}+(on/{total_frames})*({end_scale}-{start_scale}))"
                
                # 計算位置（讓圖片在放大時適當偏移）
                # 當放大時，位置從中心向指定方向偏移
                x_offset = f"(iw-iw/zoom)/2 + (iw/zoom-iw)*{x_dir}*(on/{total_frames})"
                y_offset = f"(ih-ih/zoom)/2 + (ih/zoom-ih)*{y_dir}*(on/{total_frames})"
                
                # 構建 zoompan 濾鏡
                zoompan_filter = f"zoompan=z='{zoom_expr}':x='{x_offset}':y='{y_offset}':d={total_frames}:s={width}x{height}:fps={fps}"
                
                # 添加淡入效果（第一個場景）和淡出效果（最後一個場景）
                fade_filter = ""
                if i == 0:
                    fade_filter = f",fade=t=in:st=0:d=0.5"
                if i == len(image_paths) - 1:
                    fade_filter += f",fade=t=out:st={duration - 0.5}:d=0.5"
                
                # 完整的視覺濾鏡鏈
                video_filter = f"{zoompan_filter}{fade_filter},format=yuv420p"
                
                cmd = [
                    "ffmpeg", "-y",
                    "-loop", "1",
                    "-i", img_path,
                    "-t", str(duration),
                    "-vf", video_filter,
                    "-c:v", "libx264",
                    "-preset", "slow",       # 更高品質
                    "-crf", "18",            # 高品質
                    "-profile:v", "high",    # H.264 High Profile
                    "-level", "4.1",         # 支援 1080p@30fps
                    "-r", str(fps),
                    "-pix_fmt", "yuv420p",
                    "-movflags", "+faststart",  # 支援網頁串流
                    str(segment_path)
                ]
                
                print(f"[VideoGenerator] 🎞️ 場景 {i+1}: Ken Burns 效果 ({start_scale:.2f}→{end_scale:.2f})")
                
                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                stdout, stderr = await process.communicate()
                
                if process.returncode != 0:
                    print(f"[VideoGenerator] 場景 {i+1} FFmpeg 錯誤: {stderr.decode()[:200]}")
                    # 降級到簡單模式
                    simple_cmd = [
                        "ffmpeg", "-y",
                        "-loop", "1",
                        "-i", img_path,
                        "-t", str(duration),
                        "-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p",
                        "-c:v", "libx264",
                        "-preset", "medium",
                        "-crf", "20",
                        "-r", "30",
                        "-pix_fmt", "yuv420p",
                        str(segment_path)
                    ]
                    process = await asyncio.create_subprocess_exec(
                        *simple_cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    await process.communicate()
                
                if os.path.exists(segment_path):
                    segment_files.append(str(segment_path))
            
            if not segment_files:
                print("[VideoGenerator] ❌ 沒有成功生成的片段")
                return None
            
            print(f"[VideoGenerator] ✅ {len(segment_files)} 個場景片段生成完成")
            
            # 使用 xfade 轉場合併片段（交叉淡化效果）
            merged_video = self.output_dir / f"merged_{project_id}.mp4"
            
            if len(segment_files) == 1:
                # 只有一個片段，直接複製
                import shutil
                shutil.copy(segment_files[0], str(merged_video))
            else:
                # 構建 xfade 濾鏡鏈進行交叉淡化轉場
                # 計算每個片段的時長（用於設置 offset）
                offsets = []
                cumulative = 0
                for i, (_, dur, _) in enumerate(image_paths[:-1]):
                    cumulative += dur - TRANSITION_DURATION
                    offsets.append(cumulative)
                
                # 構建複雜濾鏡
                inputs = " ".join([f"-i {seg}" for seg in segment_files])
                
                # 生成 xfade 濾鏡鏈
                filter_complex = []
                prev_label = "[0:v]"
                
                for i in range(len(segment_files) - 1):
                    next_label = f"[{i+1}:v]"
                    output_label = f"[v{i}]" if i < len(segment_files) - 2 else "[vout]"
                    offset = offsets[i]
                    
                    # xfade 轉場效果：fade, fadeblack, fadewhite, distance, wipeleft, slideleft, etc.
                    transition_type = ["fade", "fadeblack", "slideleft", "slideright", "circlecrop"][i % 5]
                    
                    filter_complex.append(
                        f"{prev_label}{next_label}xfade=transition={transition_type}:duration={TRANSITION_DURATION}:offset={offset}{output_label}"
                    )
                    prev_label = output_label
                
                filter_str = ";".join(filter_complex)
                
                # 執行帶轉場的合併
                cmd_str = f'ffmpeg -y {inputs} -filter_complex "{filter_str}" -map "[vout]" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p {str(merged_video)}'
                
                process = await asyncio.create_subprocess_shell(
                    cmd_str,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                stdout, stderr = await process.communicate()
                
                if process.returncode != 0:
                    print(f"[VideoGenerator] xfade 轉場失敗，使用簡單合併: {stderr.decode()[:200]}")
                    # 降級到簡單 concat
                    concat_file = self.output_dir / f"concat_{project_id}.txt"
                    with open(concat_file, "w") as f:
                        for seg in segment_files:
                            f.write(f"file '{seg}'\n")
                    
                    cmd = [
                        "ffmpeg", "-y",
                        "-f", "concat",
                        "-safe", "0",
                        "-i", str(concat_file),
                        "-c:v", "libx264",
                        "-preset", "slow",
                        "-crf", "18",
                        str(merged_video)
                    ]
                    
                    process = await asyncio.create_subprocess_exec(
                        *cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    await process.communicate()
                    
                    if concat_file.exists():
                        os.remove(concat_file)
            
            if not os.path.exists(merged_video):
                print("[VideoGenerator] ❌ 影片合併失敗")
                return None
            
            print("[VideoGenerator] ✅ 影片轉場合併完成")
            
            # 混合音訊（TTS + 背景音樂）
            output_path = self.output_dir / f"video_{project_id}.mp4"
            
            # 合併所有 TTS 音訊
            tts_combined = None
            valid_audios = [(i, a) for i, a in enumerate(scene_audios) if a and os.path.exists(a)]
            
            if valid_audios:
                tts_combined = self.output_dir / f"tts_combined_{project_id}.mp3"
                
                # 創建靜音片段填充
                audio_segments = []
                current_time = 0
                
                for i, (scene_idx, audio_path) in enumerate(valid_audios):
                    scene_start = sum(s.get("duration_seconds", 5) for s in scenes[:scene_idx])
                    
                    # 如果需要在 TTS 前添加靜音
                    if scene_start > current_time:
                        silence_duration = scene_start - current_time
                        silence_path = self.output_dir / f"silence_{project_id}_{i}.mp3"
                        cmd = [
                            "ffmpeg", "-y",
                            "-f", "lavfi",
                            "-i", f"anullsrc=r=44100:cl=mono",
                            "-t", str(silence_duration),
                            "-c:a", "libmp3lame",
                            str(silence_path)
                        ]
                        process = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
                        await process.communicate()
                        if os.path.exists(silence_path):
                            audio_segments.append(str(silence_path))
                    
                    audio_segments.append(audio_path)
                    
                    # 獲取 TTS 音訊時長
                    probe_cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", audio_path]
                    probe = await asyncio.create_subprocess_exec(*probe_cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
                    probe_out, _ = await probe.communicate()
                    try:
                        tts_duration = float(probe_out.decode().strip())
                    except:
                        tts_duration = 3
                    current_time = scene_start + tts_duration
                
                # 合併所有音訊段
                if audio_segments:
                    audio_concat = self.output_dir / f"audio_concat_{project_id}.txt"
                    with open(audio_concat, "w") as f:
                        for seg in audio_segments:
                            f.write(f"file '{seg}'\n")
                    
                    cmd = [
                        "ffmpeg", "-y",
                        "-f", "concat",
                        "-safe", "0",
                        "-i", str(audio_concat),
                        "-c:a", "libmp3lame",
                        "-b:a", "192k",
                        str(tts_combined)
                    ]
                    process = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
                    await process.communicate()
                    
                    # 清理
                    if audio_concat.exists():
                        os.remove(audio_concat)
                    for seg in audio_segments:
                        if seg not in [a for _, a in valid_audios] and os.path.exists(seg):
                            os.remove(seg)
            
            # 最終混音
            if music_path and os.path.exists(music_path) and os.path.exists(merged_video):
                if tts_combined and os.path.exists(tts_combined):
                    # 混合 TTS + 背景音樂
                    cmd = [
                        "ffmpeg", "-y",
                        "-i", str(merged_video),
                        "-i", str(tts_combined),
                        "-i", music_path,
                        "-filter_complex",
                        "[1:a]volume=1.2[tts];[2:a]volume=0.3[bgm];[tts][bgm]amix=inputs=2:duration=longest[aout]",
                        "-map", "0:v:0",
                        "-map", "[aout]",
                        "-c:v", "copy",
                        "-c:a", "aac",
                        "-b:a", "192k",
                        "-shortest",
                        str(output_path)
                    ]
                else:
                    # 只有背景音樂
                    cmd = [
                        "ffmpeg", "-y",
                        "-i", str(merged_video),
                        "-i", music_path,
                        "-filter_complex", "[1:a]volume=0.5[bgm]",
                        "-map", "0:v:0",
                        "-map", "[bgm]",
                        "-c:v", "copy",
                        "-c:a", "aac",
                        "-b:a", "192k",
                        "-shortest",
                        str(output_path)
                    ]
                
                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                stdout, stderr = await process.communicate()
                
                if process.returncode != 0:
                    print(f"[VideoGenerator] 音訊混合失敗: {stderr.decode()[:200]}")
                    output_path = merged_video
            elif tts_combined and os.path.exists(tts_combined):
                # 只有 TTS
                cmd = [
                    "ffmpeg", "-y",
                    "-i", str(merged_video),
                    "-i", str(tts_combined),
                    "-c:v", "copy",
                    "-c:a", "aac",
                    "-b:a", "192k",
                    "-map", "0:v:0",
                    "-map", "1:a:0",
                    "-shortest",
                    str(output_path)
                ]
                process = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
                await process.communicate()
            else:
                output_path = merged_video
            
            # 清理臨時文件
            try:
                for seg in segment_files:
                    if os.path.exists(seg):
                        os.remove(seg)
                for i in range(len(scene_images)):
                    img_path = self.output_dir / f"scene_{project_id}_{i}.png"
                    if img_path.exists():
                        os.remove(img_path)
                if music_path and os.path.exists(music_path):
                    os.remove(music_path)
                if tts_combined and os.path.exists(tts_combined):
                    os.remove(tts_combined)
                if merged_video.exists() and str(merged_video) != str(output_path):
                    os.remove(merged_video)
                # 清理 TTS 音訊
                for audio in scene_audios:
                    if audio and os.path.exists(audio):
                        os.remove(audio)
            except Exception as cleanup_err:
                print(f"[VideoGenerator] 清理警告: {cleanup_err}")
            
            if os.path.exists(output_path):
                print(f"[VideoGenerator] 🎬 專業級影片合成成功！")
                return str(output_path)
            
            return None
            
        except Exception as e:
            print(f"[VideoGenerator] FFmpeg 錯誤: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def _hex_to_rgb(self, hex_color: str) -> tuple:
        """HEX 轉 RGB"""
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


# 單例實例
video_generator = VideoGeneratorService()
