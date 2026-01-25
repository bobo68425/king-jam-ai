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
                            video_base64 = base64.b64encode(video_bytes).decode()
                            video_url = f"data:video/mp4;base64,{video_base64}"
                            
                            print(f"[VideoGenerator] ✅ Veo 影片生成成功！大小: {len(video_bytes) / 1024 / 1024:.2f} MB")
                            
                            return VideoResult(
                                video_url=video_url,
                                video_base64=video_base64,
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
        構建優化的 Veo 影片提示詞
        採用 Google 官方推薦的提示詞格式
        """
        scenes = script.get("scenes", [])
        title = script.get("title", "")
        description = script.get("description", "")
        style = script.get("overall_style", "modern, professional")
        color_palette = script.get("color_palette", ["#6366F1", "#8B5CF6"])
        brand_name = script.get("brand_name", "")
        goal = script.get("goal", "")
        personality = script.get("personality", "professional")
        
        # 人物風格映射
        personality_styles = {
            "professional": "clean, corporate, sophisticated",
            "friendly": "warm, inviting, approachable",
            "luxurious": "elegant, premium, high-end",
            "playful": "fun, colorful, energetic",
            "minimalist": "minimal, sleek, modern",
            "innovative": "futuristic, cutting-edge, tech",
            "trustworthy": "reliable, stable, genuine",
        }
        
        style_modifier = personality_styles.get(personality, "modern")
        
        # 提取主要視覺元素
        visual_elements = []
        for scene in scenes[:3]:  # 取前 3 個場景的重點
            visual = scene.get("visual_prompt", "")
            if visual:
                # 提取關鍵詞
                visual_elements.append(visual)
        
        # 構建優化的提示詞（遵循 Google Veo 最佳實踐）
        # 格式：[Camera movement] + [Subject] + [Action] + [Scene details] + [Style]
        
        primary_color = color_palette[0] if color_palette else "#6366F1"
        secondary_color = color_palette[1] if len(color_palette) > 1 else primary_color
        
        # 主視覺描述
        main_visual = visual_elements[0] if visual_elements else description
        
        # 構建專業級提示詞
        prompt_parts = []
        
        # 1. 開場鏡頭動作
        camera_movements = [
            "Smooth cinematic dolly shot",
            "Dynamic tracking shot",
            "Elegant crane shot moving down",
            "Slow push-in shot",
            "Aerial drone shot descending",
        ]
        import random
        camera = random.choice(camera_movements)
        
        # 2. 主體描述
        subject = main_visual if main_visual else "modern product showcase"
        
        # 3. 風格關鍵詞
        style_keywords = f"{style_modifier}, {style}"
        
        # 4. 技術品質關鍵詞
        quality_keywords = "8K, cinematic lighting, shallow depth of field, professional color grading, film grain"
        
        # 5. 氛圍關鍵詞
        if "luxury" in personality or "luxurious" in personality:
            atmosphere = "golden hour lighting, premium atmosphere, sophisticated"
        elif "playful" in personality:
            atmosphere = "bright, vibrant colors, energetic mood"
        elif "minimalist" in personality:
            atmosphere = "clean white background, soft shadows, negative space"
        else:
            atmosphere = "professional studio lighting, modern aesthetic"
        
        # 組合最終提示詞
        prompt = f"""{camera}, {subject}. {style_keywords}. {atmosphere}. {quality_keywords}.

Visual narrative: {description}

Key visual elements:
- Color palette: {primary_color} and {secondary_color}
- Style: {style}
- Mood: {personality_styles.get(personality, 'professional')}

Technical requirements:
- Vertical 9:16 format for social media
- Smooth, continuous motion
- No text overlays
- Professional quality suitable for advertising
- Clean transitions if multiple scenes"""

        print(f"[VideoGenerator] 📝 Veo 提示詞:\n{prompt[:200]}...")
        
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
            
            # 生成圖片
            image_base64 = await self._generate_image(
                visual_prompt,
                color_palette,
                width,
                height,
                text_overlay,
                i + 1,
                len(scenes)
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
        
        # 4. 讀取影片
        video_base64 = None
        video_url = ""
        file_size = 0
        generation_method = "imagen+ffmpeg"
        
        if video_path and os.path.exists(video_path):
            with open(video_path, "rb") as f:
                video_data = f.read()
                file_size = len(video_data)
                video_base64 = base64.b64encode(video_data).decode()
                video_url = f"data:video/mp4;base64,{video_base64}"
            
            print(f"[VideoGenerator] 🎉 影片合成成功，大小: {file_size / 1024 / 1024:.2f} MB")
            
            # 清理
            try:
                os.remove(video_path)
            except:
                pass
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
        total_scenes: int
    ) -> Optional[str]:
        """生成場景圖片"""
        
        aspect_ratio = f"{width}:{height}"
        if width == 1080 and height == 1920:
            aspect_ratio = "9:16"
        elif width == 1920 and height == 1080:
            aspect_ratio = "16:9"
        elif width == height:
            aspect_ratio = "1:1"
        
        # 1. 嘗試使用 Imagen
        client = vertexai_client or genai_client
        if client and visual_prompt:
            enhanced_prompt = f"""
            {visual_prompt}
            
            Style: Professional video frame, cinematic quality, {aspect_ratio} format.
            Technical: High resolution, sharp details, vibrant colors, modern aesthetic.
            """
            
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
                            
                            print(f"[VideoGenerator] ✓ Imagen 圖片生成成功")
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
    
    def _generate_designed_image(
        self,
        color_palette: List[str],
        width: int,
        height: int,
        text_overlay: Optional[str],
        scene_num: int,
        total_scenes: int
    ) -> str:
        """生成設計圖"""
        if not PIL_AVAILABLE:
            return ""
        
        try:
            import random
            
            img = Image.new('RGB', (width, height))
            c1 = self._hex_to_rgb(color_palette[0] if color_palette else "#6366F1")
            c2 = self._hex_to_rgb(color_palette[1] if len(color_palette) > 1 else "#8B5CF6")
            
            # 繪製漸層
            for y in range(height):
                ratio = y / height
                r = int(c1[0] * (1 - ratio) + c2[0] * ratio)
                g = int(c1[1] * (1 - ratio) + c2[1] * ratio)
                b = int(c1[2] * (1 - ratio) + c2[2] * ratio)
                for x in range(width):
                    img.putpixel((x, y), (r, g, b))
            
            draw = ImageDraw.Draw(img)
            
            # 裝飾
            for _ in range(8):
                cx = random.randint(0, width)
                cy = random.randint(0, height)
                radius = random.randint(50, 300)
                draw.ellipse(
                    [(cx - radius, cy - radius), (cx + radius, cy + radius)],
                    outline=(255, 255, 255),
                    width=2
                )
            
            # 場景編號
            try:
                font_size = width // 25
                try:
                    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
                except:
                    font = ImageFont.load_default()
                draw.text((40, 40), f"Scene {scene_num}/{total_scenes}", fill=(255, 255, 255), font=font)
            except:
                pass
            
            # 主要文字
            if text_overlay:
                try:
                    font_size = width // 15
                    try:
                        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
                    except:
                        font = ImageFont.load_default()
                    
                    text = text_overlay[:30]
                    bbox = draw.textbbox((0, 0), text, font=font)
                    text_width = bbox[2] - bbox[0]
                    text_height = bbox[3] - bbox[1]
                    
                    x = (width - text_width) // 2
                    y = height // 2 - text_height // 2
                    
                    padding = 40
                    draw.rounded_rectangle(
                        [(x - padding, y - padding), (x + text_width + padding, y + text_height + padding)],
                        radius=20,
                        fill=(0, 0, 0, 200)
                    )
                    draw.text((x, y), text, fill=(255, 255, 255), font=font)
                except:
                    pass
            
            # 浮水印
            try:
                font = ImageFont.load_default()
                draw.text((width - 150, height - 50), "KingJam AI", fill=(255, 255, 255), font=font)
            except:
                pass
            
            buffer = io.BytesIO()
            img.save(buffer, format='PNG', quality=95)
            return f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode()}"
            
        except Exception as e:
            print(f"[VideoGenerator] 設計圖生成錯誤: {e}")
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
        """生成背景音樂"""
        try:
            music_path = self.output_dir / f"bgm_{project_id}.wav"
            
            sample_rate = 44100
            total_samples = int(duration * sample_rate)
            
            mood_freqs = {
                "upbeat": [261.63, 329.63, 392.00],
                "calm": [220.00, 277.18, 329.63],
                "energetic": [293.66, 369.99, 440.00],
                "inspirational": [246.94, 311.13, 369.99],
            }
            freqs = mood_freqs.get(mood, mood_freqs["upbeat"])
            
            audio_data = []
            for i in range(total_samples):
                t = i / sample_rate
                sample = sum(math.sin(2 * math.pi * f * t) * 0.12 for f in freqs)
                beat = math.sin(2 * math.pi * 2 * t) * 0.3 + 0.7
                sample *= beat
                
                fade_samples = int(sample_rate * 0.5)
                if i < fade_samples:
                    sample *= i / fade_samples
                elif i > total_samples - fade_samples:
                    sample *= (total_samples - i) / fade_samples
                
                audio_data.append(int(sample * 32767))
            
            with open(music_path, 'wb') as f:
                f.write(b'RIFF')
                f.write(struct.pack('<I', 36 + len(audio_data) * 2))
                f.write(b'WAVE')
                f.write(b'fmt ')
                f.write(struct.pack('<I', 16))
                f.write(struct.pack('<H', 1))
                f.write(struct.pack('<H', 1))
                f.write(struct.pack('<I', sample_rate))
                f.write(struct.pack('<I', sample_rate * 2))
                f.write(struct.pack('<H', 2))
                f.write(struct.pack('<H', 16))
                f.write(b'data')
                f.write(struct.pack('<I', len(audio_data) * 2))
                for s in audio_data:
                    f.write(struct.pack('<h', s))
            
            print(f"[VideoGenerator] 🎵 背景音樂 ({duration:.1f}秒)")
            return str(music_path)
            
        except Exception as e:
            print(f"[VideoGenerator] 背景音樂錯誤: {e}")
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
        """使用 FFmpeg 合成影片"""
        
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
            scale_filter = f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black"
            
            # 保存圖片
            image_paths = []
            for i, img_base64 in enumerate(scene_images):
                img_data = img_base64.split(",")[1] if "," in img_base64 else img_base64
                img_bytes = base64.b64decode(img_data)
                
                img_path = self.output_dir / f"scene_{project_id}_{i}.png"
                with open(img_path, "wb") as f:
                    f.write(img_bytes)
                
                duration = scenes[i].get("duration_seconds", 5) if i < len(scenes) else 5
                image_paths.append((str(img_path), duration))
            
            # 生成每個場景的視頻片段
            segment_files = []
            for i, (img_path, duration) in enumerate(image_paths):
                segment_path = self.output_dir / f"segment_{project_id}_{i}.mp4"
                
                cmd = [
                    "ffmpeg", "-y",
                    "-loop", "1",
                    "-i", img_path,
                    "-t", str(duration),
                    "-vf", f"{scale_filter},format=yuv420p",
                    "-c:v", "libx264",
                    "-preset", "medium",
                    "-crf", "18",
                    "-r", "30",
                    "-pix_fmt", "yuv420p",
                    str(segment_path)
                ]
                
                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                await process.communicate()
                
                if os.path.exists(segment_path):
                    segment_files.append(str(segment_path))
            
            if not segment_files:
                return None
            
            # 合併片段
            concat_file = self.output_dir / f"concat_{project_id}.txt"
            with open(concat_file, "w") as f:
                for seg in segment_files:
                    f.write(f"file '{seg}'\n")
            
            merged_video = self.output_dir / f"merged_{project_id}.mp4"
            
            cmd = [
                "ffmpeg", "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", str(concat_file),
                "-c", "copy",
                str(merged_video)
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await process.communicate()
            
            # 添加背景音樂
            output_path = self.output_dir / f"video_{project_id}.mp4"
            
            if music_path and os.path.exists(music_path) and os.path.exists(merged_video):
                cmd = [
                    "ffmpeg", "-y",
                    "-i", str(merged_video),
                    "-i", music_path,
                    "-c:v", "copy",
                    "-c:a", "aac",
                    "-b:a", "192k",
                    "-shortest",
                    "-map", "0:v:0",
                    "-map", "1:a:0",
                    str(output_path)
                ]
                
                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                await process.communicate()
                
                if process.returncode != 0:
                    output_path = merged_video
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
                if concat_file.exists():
                    os.remove(concat_file)
                if music_path and os.path.exists(music_path):
                    os.remove(music_path)
                if merged_video.exists() and str(merged_video) != str(output_path):
                    os.remove(merged_video)
            except:
                pass
            
            if os.path.exists(output_path):
                print(f"[VideoGenerator] 🎬 FFmpeg 影片合成成功")
                return str(output_path)
            
            return None
            
        except Exception as e:
            print(f"[VideoGenerator] FFmpeg 錯誤: {e}")
            return None
    
    def _hex_to_rgb(self, hex_color: str) -> tuple:
        """HEX 轉 RGB"""
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


# 單例實例
video_generator = VideoGeneratorService()
