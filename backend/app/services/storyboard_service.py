"""
Storyboard 預覽服務 - Director Engine 2.0

功能：
- 低成本預覽：生成靜態分鏡圖，讓用戶確認後才渲染影片
- TTS 語音整合：使用 Edge TTS 生成語音
- 字幕軌生成：準備 SRT 字幕檔供 FFmpeg 合成

成本對比：
- Storyboard 預覽：約 5-10 點（每場景 1-2 點）
- 完整影片渲染：50-350 點

流程：
腳本生成 -> Storyboard 預覽 -> 用戶確認 -> 影片渲染
"""

import os
import uuid
import json
import asyncio
import tempfile
import subprocess
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
from pydantic import BaseModel

# TTS
try:
    import edge_tts
    EDGE_TTS_AVAILABLE = True
except ImportError:
    EDGE_TTS_AVAILABLE = False
    print("[Storyboard] edge-tts 不可用，TTS 功能將被停用")

# Image generation
try:
    import google.generativeai as genai
    from PIL import Image
    import io
    import base64
    IMAGEN_AVAILABLE = True
except ImportError:
    IMAGEN_AVAILABLE = False


# ============================================================
# 資料模型
# ============================================================

class StoryboardScene(BaseModel):
    """分鏡場景"""
    scene_index: int
    title: str
    description: str
    visual_prompt: str
    narration: str
    duration_seconds: float
    
    # 預覽資產
    thumbnail_url: Optional[str] = None
    thumbnail_base64: Optional[str] = None
    
    # TTS 資產
    audio_url: Optional[str] = None
    audio_base64: Optional[str] = None  # base64 編碼的音訊（供前端直接播放）
    audio_duration: Optional[float] = None
    
    # 字幕
    subtitle_text: str = ""
    subtitle_start: float = 0
    subtitle_end: float = 0


class StoryboardPreview(BaseModel):
    """完整分鏡預覽"""
    project_id: str
    title: str
    description: str
    format: str  # "9:16", "16:9", "1:1"
    total_duration: float
    scenes: List[StoryboardScene]
    
    # 預覽影片（可選，低畫質快速合成）
    preview_video_url: Optional[str] = None
    
    # TTS 設定
    voice_id: str = "zh-TW-HsiaoChenNeural"
    voice_style: str = "friendly"
    
    # 品牌色
    primary_color: str = "#6366F1"
    secondary_color: str = "#8B5CF6"
    
    # 狀態
    created_at: datetime = None
    expires_at: datetime = None  # 預覽有效期（例如 24 小時）
    
    # 成本
    preview_credits_used: int = 0
    estimated_render_credits: int = 0


class TTSResult(BaseModel):
    """TTS 生成結果"""
    audio_path: str
    duration_seconds: float
    subtitle_data: List[Dict[str, Any]]  # 時間戳字幕資料


# ============================================================
# TTS 服務
# ============================================================

class TTSService:
    """
    TTS 語音合成服務
    
    使用 Edge TTS（免費、高品質）
    """
    
    # Edge TTS 語音列表（已驗證可用）
    # 這些語音都已經過 edge-tts --list-voices 確認可用
    VOICES = {
        # ============================================================
        # 繁體中文（台灣）- 官方驗證 ✓
        # ============================================================
        "zh-TW-HsiaoChenNeural": {"name": "曉臻（女，親切正式）", "gender": "female", "style": "friendly", "locale": "zh-TW"},
        "zh-TW-HsiaoYuNeural": {"name": "曉雨（女，溫柔甜美）", "gender": "female", "style": "calm", "locale": "zh-TW"},
        "zh-TW-YunJheNeural": {"name": "雲哲（男，專業穩重）", "gender": "male", "style": "professional", "locale": "zh-TW"},
        
        # ============================================================
        # 簡體中文 - 官方驗證 ✓
        # ============================================================
        "zh-CN-XiaoxiaoNeural": {"name": "曉曉（女，溫暖知性）", "gender": "female", "style": "warm", "locale": "zh-CN"},
        "zh-CN-XiaoyiNeural": {"name": "曉伊（女，活潑卡通）", "gender": "female", "style": "cute", "locale": "zh-CN"},
        "zh-CN-YunyangNeural": {"name": "雲揚（男，專業新聞）", "gender": "male", "style": "professional", "locale": "zh-CN"},
        "zh-CN-YunjianNeural": {"name": "雲健（男，熱情解說）", "gender": "male", "style": "sports", "locale": "zh-CN"},
        "zh-CN-YunxiNeural": {"name": "雲希（男，陽光活力）", "gender": "male", "style": "lively", "locale": "zh-CN"},
        "zh-CN-YunxiaNeural": {"name": "雲夏（男，可愛童聲）", "gender": "male", "style": "childlike", "locale": "zh-CN"},
        
        # ============================================================
        # 簡體中文 - 方言語音 ✓
        # ============================================================
        "zh-CN-liaoning-XiaobeiNeural": {"name": "曉北（女，東北方言）", "gender": "female", "style": "humorous", "locale": "zh-CN"},
        "zh-CN-shaanxi-XiaoniNeural": {"name": "曉妮（女，陝西方言）", "gender": "female", "style": "bright", "locale": "zh-CN"},
        
        # ============================================================
        # 粵語（香港）- 官方驗證 ✓
        # ============================================================
        "zh-HK-HiuMaanNeural": {"name": "曉曼（女，粵語親切）", "gender": "female", "style": "friendly", "locale": "zh-HK"},
        "zh-HK-HiuGaaiNeural": {"name": "曉佳（女，粵語活潑）", "gender": "female", "style": "lively", "locale": "zh-HK"},
        "zh-HK-WanLungNeural": {"name": "雲龍（男，粵語穩重）", "gender": "male", "style": "professional", "locale": "zh-HK"},
        
        # ============================================================
        # 英文 - 官方驗證 ✓
        # ============================================================
        "en-US-JennyNeural": {"name": "Jenny（女，美式親切）", "gender": "female", "style": "friendly", "locale": "en-US"},
        "en-US-GuyNeural": {"name": "Guy（男，美式專業）", "gender": "male", "style": "professional", "locale": "en-US"},
        "en-US-AriaNeural": {"name": "Aria（女，美式自然）", "gender": "female", "style": "natural", "locale": "en-US"},
        "en-GB-SoniaNeural": {"name": "Sonia（女，英式優雅）", "gender": "female", "style": "elegant", "locale": "en-GB"},
        "en-GB-RyanNeural": {"name": "Ryan（男，英式專業）", "gender": "male", "style": "professional", "locale": "en-GB"},
        
        # ============================================================
        # 日文 - 官方驗證 ✓
        # ============================================================
        "ja-JP-NanamiNeural": {"name": "七海（女，日語親切）", "gender": "female", "style": "friendly", "locale": "ja-JP"},
        "ja-JP-KeitaNeural": {"name": "慶太（男，日語專業）", "gender": "male", "style": "professional", "locale": "ja-JP"},
        
        # ============================================================
        # 韓文 - 官方驗證 ✓
        # ============================================================
        "ko-KR-SunHiNeural": {"name": "선희（女，韓語親切）", "gender": "female", "style": "friendly", "locale": "ko-KR"},
        "ko-KR-InJoonNeural": {"name": "인준（男，韓語穩重）", "gender": "male", "style": "professional", "locale": "ko-KR"},
    }
    
    DEFAULT_VOICE = "zh-TW-HsiaoChenNeural"
    
    def __init__(self):
        self.output_dir = Path(tempfile.gettempdir()) / "kingjam_tts"
        self.output_dir.mkdir(exist_ok=True)
    
    async def generate_speech(
        self,
        text: str,
        voice_id: str = None,
        rate: str = "+0%",
        pitch: str = "+0Hz"
    ) -> TTSResult:
        """
        生成語音
        
        Args:
            text: 要合成的文字
            voice_id: 語音 ID
            rate: 語速調整（例如 "+10%", "-5%"）
            pitch: 音調調整
        
        Returns:
            TTSResult 包含音頻路徑和字幕資料
        """
        if not EDGE_TTS_AVAILABLE:
            raise RuntimeError("edge-tts 未安裝，請執行: pip install edge-tts")
        
        voice_id = voice_id or self.DEFAULT_VOICE
        output_id = str(uuid.uuid4())
        audio_path = self.output_dir / f"{output_id}.mp3"
        subtitle_path = self.output_dir / f"{output_id}.vtt"
        
        try:
            # 使用 edge-tts 生成語音和字幕
            communicate = edge_tts.Communicate(text, voice_id, rate=rate, pitch=pitch)
            
            # 收集字幕資料
            subtitle_data = []
            
            async def save_audio_with_subtitles():
                with open(audio_path, "wb") as f:
                    async for chunk in communicate.stream():
                        if chunk["type"] == "audio":
                            f.write(chunk["data"])
                        elif chunk["type"] == "WordBoundary":
                            subtitle_data.append({
                                "text": chunk["text"],
                                "start": chunk["offset"] / 10000000,  # 轉換為秒
                                "end": (chunk["offset"] + chunk["duration"]) / 10000000,
                            })
            
            await save_audio_with_subtitles()
            
            # 計算音頻時長
            duration = await self._get_audio_duration(str(audio_path))
            
            return TTSResult(
                audio_path=str(audio_path),
                duration_seconds=duration,
                subtitle_data=subtitle_data
            )
            
        except Exception as e:
            print(f"[TTS] 生成失敗: {e}")
            raise
    
    async def generate_scene_audio(
        self,
        scenes: List[Dict[str, Any]],
        voice_id: str = None
    ) -> List[TTSResult]:
        """
        批量生成場景語音
        """
        results = []
        for i, scene in enumerate(scenes):
            narration = scene.get("narration", "")
            if not narration:
                # 如果沒有旁白，生成空的結果
                results.append(TTSResult(
                    audio_path="",
                    duration_seconds=scene.get("duration_seconds", 5),
                    subtitle_data=[]
                ))
                continue
            
            print(f"[TTS] 生成場景 {i+1} 語音...")
            result = await self.generate_speech(narration, voice_id)
            results.append(result)
        
        return results
    
    async def _get_audio_duration(self, audio_path: str) -> float:
        """獲取音頻時長"""
        try:
            result = await asyncio.to_thread(
                subprocess.run,
                [
                    "ffprobe", "-v", "quiet", "-show_entries",
                    "format=duration", "-of", "default=noprint_wrappers=1:nokey=1",
                    audio_path
                ],
                capture_output=True,
                text=True
            )
            return float(result.stdout.strip())
        except Exception:
            return 5.0  # 預設 5 秒
    
    def get_available_voices(self) -> Dict[str, Dict]:
        """獲取可用的語音列表"""
        return self.VOICES


# ============================================================
# Storyboard 預覽服務
# ============================================================

class StoryboardService:
    """
    Storyboard 預覽服務
    
    功能：
    1. 生成低成本分鏡預覽圖
    2. 生成 TTS 語音
    3. 生成字幕時間軸
    4. 快速合成預覽影片（可選）
    """
    
    PREVIEW_COST_PER_SCENE = 2  # 每個場景預覽消耗 2 點
    
    def __init__(self):
        self.tts_service = TTSService()
        self.output_dir = Path(tempfile.gettempdir()) / "kingjam_storyboard"
        self.output_dir.mkdir(exist_ok=True)
        
        # Imagen 模型（用於生成縮圖）
        self.genai_client = None
        if IMAGEN_AVAILABLE:
            try:
                api_key = os.getenv("GOOGLE_GEMINI_KEY")
                if api_key:
                    genai.configure(api_key=api_key)
                    self.genai_client = genai
                    print("[Storyboard] ✓ Gemini API 初始化成功")
            except Exception as e:
                print(f"[Storyboard] Gemini 初始化失敗: {e}")
    
    async def generate_preview(
        self,
        script: Dict[str, Any],
        voice_id: str = "zh-TW-HsiaoChenNeural",
        generate_thumbnails: bool = True,
        generate_audio: bool = True,
        generate_preview_video: bool = False
    ) -> StoryboardPreview:
        """
        生成完整的 Storyboard 預覽
        
        Args:
            script: 腳本資料（來自 Director Engine）
            voice_id: TTS 語音 ID
            generate_thumbnails: 是否生成縮圖
            generate_audio: 是否生成語音
            generate_preview_video: 是否合成預覽影片
        
        Returns:
            StoryboardPreview
        """
        project_id = script.get("project_id", str(uuid.uuid4()))
        scenes_data = script.get("scenes", [])
        
        print(f"[Storyboard] 🎬 開始生成預覽 (場景數: {len(scenes_data)})")
        
        # 1. 處理每個場景
        storyboard_scenes = []
        current_time = 0
        
        for i, scene_data in enumerate(scenes_data):
            # 支援 narration 和 narration_text 兩種欄位名稱
            narration_text = scene_data.get("narration_text", "") or scene_data.get("narration", "")
            
            scene = StoryboardScene(
                scene_index=i,
                title=scene_data.get("title", f"場景 {i+1}"),
                description=scene_data.get("description", ""),
                visual_prompt=scene_data.get("visual_prompt", ""),
                narration=narration_text,
                duration_seconds=scene_data.get("duration_seconds", 5),
                subtitle_text=narration_text,
                subtitle_start=current_time,
                subtitle_end=current_time + scene_data.get("duration_seconds", 5),
            )
            
            if narration_text:
                print(f"[Storyboard] 場景 {i+1} 旁白: {narration_text[:30]}...")
            
            # 2. 生成縮圖（如果啟用）
            if generate_thumbnails:
                thumbnail = await self._generate_thumbnail(scene.visual_prompt, project_id, i)
                if thumbnail:
                    scene.thumbnail_base64 = thumbnail
            
            # 3. 生成語音（如果啟用）
            if generate_audio and scene.narration:
                try:
                    tts_result = await self.tts_service.generate_speech(
                        scene.narration, 
                        voice_id
                    )
                    scene.audio_url = tts_result.audio_path
                    scene.audio_duration = tts_result.duration_seconds
                    
                    # 將音訊轉為 base64 供前端直接播放
                    if os.path.exists(tts_result.audio_path):
                        file_size = os.path.getsize(tts_result.audio_path)
                        if file_size > 0:
                            with open(tts_result.audio_path, 'rb') as f:
                                audio_data = f.read()
                                base64_data = base64.b64encode(audio_data).decode('utf-8')
                                scene.audio_base64 = f"data:audio/mpeg;base64,{base64_data}"
                            print(f"[Storyboard] 🎤 場景 {i+1} TTS 生成完成 ({scene.audio_duration:.1f}秒, {file_size/1024:.1f}KB, base64長度: {len(scene.audio_base64)})")
                        else:
                            print(f"[Storyboard] ⚠️ 場景 {i+1} TTS 檔案為空")
                    else:
                        print(f"[Storyboard] ⚠️ 場景 {i+1} TTS 檔案不存在: {tts_result.audio_path}")
                    
                    # 根據實際語音時長調整場景時長
                    if tts_result.duration_seconds > scene.duration_seconds:
                        scene.duration_seconds = tts_result.duration_seconds + 0.5
                        scene.subtitle_end = scene.subtitle_start + scene.duration_seconds
                except Exception as e:
                    print(f"[Storyboard] ❌ 場景 {i+1} TTS 失敗: {e}")
                    import traceback
                    traceback.print_exc()
            
            storyboard_scenes.append(scene)
            current_time += scene.duration_seconds
        
        # 4. 計算總時長和成本
        total_duration = sum(s.duration_seconds for s in storyboard_scenes)
        preview_credits = len(storyboard_scenes) * self.PREVIEW_COST_PER_SCENE
        
        # 估算渲染成本
        estimated_render_credits = self._estimate_render_cost(total_duration)
        
        # 5. 建立預覽物件
        preview = StoryboardPreview(
            project_id=project_id,
            title=script.get("title", "未命名專案"),
            description=script.get("description", ""),
            format=script.get("format", "9:16"),
            total_duration=total_duration,
            scenes=storyboard_scenes,
            voice_id=voice_id,
            primary_color=script.get("color_palette", ["#6366F1"])[0],
            secondary_color=script.get("color_palette", ["#6366F1", "#8B5CF6"])[1] if len(script.get("color_palette", [])) > 1 else "#8B5CF6",
            created_at=datetime.utcnow(),
            preview_credits_used=preview_credits,
            estimated_render_credits=estimated_render_credits,
        )
        
        # 6. 生成預覽影片（如果啟用）
        if generate_preview_video:
            preview_video = await self._generate_preview_video(preview)
            if preview_video:
                preview.preview_video_url = preview_video
        
        print(f"[Storyboard] ✅ 預覽生成完成 (消耗 {preview_credits} 點)")
        return preview
    
    async def _generate_thumbnail(
        self,
        visual_prompt: str,
        project_id: str,
        scene_index: int
    ) -> Optional[str]:
        """
        生成場景縮圖
        
        優先使用 Imagen 4.0，失敗則生成佔位圖
        """
        # 1. 嘗試使用 Imagen 生成
        if self.genai_client:
            try:
                # 使用 Imagen 4.0 模型
                model = self.genai_client.GenerativeModel('gemini-2.5-flash-exp')
                
                thumbnail_prompt = f"""
Create a simple storyboard sketch illustration:
{visual_prompt[:200]}

Style: Clean black and white sketch, simple linework, storyboard frame style.
"""
                response = await asyncio.to_thread(
                    model.generate_content,
                    [thumbnail_prompt],
                    generation_config={
                        "response_mime_type": "text/plain"
                    }
                )
                
                # Gemini 文字模型無法直接生成圖片，改用佔位圖
                # 未來可接入 Imagen API
                print(f"[Storyboard] 場景 {scene_index + 1} 使用佔位圖")
                
            except Exception as e:
                print(f"[Storyboard] Imagen 生成失敗: {e}")
        
        # 2. 備用方案：生成佔位圖
        return await self._generate_placeholder_thumbnail(visual_prompt, scene_index)
    
    async def _generate_placeholder_thumbnail(
        self,
        visual_prompt: str,
        scene_index: int
    ) -> Optional[str]:
        """
        生成佔位縮圖（當 Imagen 不可用時）
        """
        try:
            # 使用 PIL 生成佔位圖
            width, height = 360, 640  # 9:16 比例
            
            # 根據場景索引選擇漸變色
            colors = [
                [(45, 55, 72), (55, 65, 81)],    # 深灰藍
                [(30, 64, 175), (37, 99, 235)],  # 藍色
                [(109, 40, 217), (139, 92, 246)], # 紫色
                [(219, 39, 119), (236, 72, 153)], # 粉紅
                [(6, 95, 70), (16, 185, 129)],   # 綠色
                [(180, 83, 9), (245, 158, 11)],  # 橙色
            ]
            color_pair = colors[scene_index % len(colors)]
            
            # 建立漸變背景
            img = Image.new('RGB', (width, height))
            for y in range(height):
                ratio = y / height
                r = int(color_pair[0][0] * (1 - ratio) + color_pair[1][0] * ratio)
                g = int(color_pair[0][1] * (1 - ratio) + color_pair[1][1] * ratio)
                b = int(color_pair[0][2] * (1 - ratio) + color_pair[1][2] * ratio)
                for x in range(width):
                    img.putpixel((x, y), (r, g, b))
            
            # 添加場景編號和提示文字
            from PIL import ImageDraw, ImageFont
            draw = ImageDraw.Draw(img)
            
            # 場景編號（大字）
            scene_text = f"#{scene_index + 1}"
            try:
                # 嘗試載入字體
                font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 72)
                font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
            except:
                font_large = ImageFont.load_default()
                font_small = ImageFont.load_default()
            
            # 繪製場景編號
            bbox = draw.textbbox((0, 0), scene_text, font=font_large)
            text_width = bbox[2] - bbox[0]
            x = (width - text_width) // 2
            draw.text((x, height // 3), scene_text, fill=(255, 255, 255, 200), font=font_large)
            
            # 繪製提示文字（截斷）
            short_prompt = visual_prompt[:60] + "..." if len(visual_prompt) > 60 else visual_prompt
            # 換行處理
            words = short_prompt.split()
            lines = []
            current_line = ""
            for word in words:
                test_line = f"{current_line} {word}".strip()
                if len(test_line) <= 30:
                    current_line = test_line
                else:
                    if current_line:
                        lines.append(current_line)
                    current_line = word
            if current_line:
                lines.append(current_line)
            
            y_offset = height * 2 // 3
            for line in lines[:3]:  # 最多 3 行
                bbox = draw.textbbox((0, 0), line, font=font_small)
                text_width = bbox[2] - bbox[0]
                x = (width - text_width) // 2
                draw.text((x, y_offset), line, fill=(200, 200, 200), font=font_small)
                y_offset += 20
            
            # 添加邊框
            draw.rectangle([(0, 0), (width - 1, height - 1)], outline=(100, 100, 100), width=2)
            
            # 轉換為 base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG', quality=85)
            buffer.seek(0)
            
            base64_str = base64.b64encode(buffer.getvalue()).decode('utf-8')
            return f"data:image/png;base64,{base64_str}"
            
        except Exception as e:
            print(f"[Storyboard] 佔位圖生成失敗: {e}")
            return None
    
    async def _generate_preview_video(
        self,
        preview: StoryboardPreview
    ) -> Optional[str]:
        """
        快速合成預覽影片
        
        使用 FFmpeg 將靜態圖片和音頻合成為低畫質預覽影片
        """
        try:
            output_path = self.output_dir / f"{preview.project_id}_preview.mp4"
            
            # 建立 FFmpeg 指令
            # 這裡使用簡單的幻燈片模式
            filter_complex = []
            inputs = []
            
            for i, scene in enumerate(preview.scenes):
                if scene.thumbnail_base64:
                    # 將 base64 解碼並保存為臨時圖片
                    img_path = self.output_dir / f"{preview.project_id}_scene_{i}.png"
                    img_data = base64.b64decode(scene.thumbnail_base64)
                    with open(img_path, 'wb') as f:
                        f.write(img_data)
                    inputs.append(f"-loop 1 -t {scene.duration_seconds} -i {img_path}")
            
            if not inputs:
                return None
            
            # 執行 FFmpeg
            cmd = f"ffmpeg -y {' '.join(inputs)} -filter_complex 'concat=n={len(inputs)}:v=1:a=0' -c:v libx264 -pix_fmt yuv420p {output_path}"
            
            result = await asyncio.to_thread(
                subprocess.run,
                cmd,
                shell=True,
                capture_output=True
            )
            
            if result.returncode == 0 and output_path.exists():
                return str(output_path)
            
            return None
            
        except Exception as e:
            print(f"[Storyboard] 預覽影片生成失敗: {e}")
            return None
    
    def _estimate_render_cost(self, total_duration: float) -> int:
        """估算完整渲染成本"""
        if total_duration <= 15:
            return 50  # Standard
        elif total_duration <= 30:
            return 80
        elif total_duration <= 60:
            return 120
        else:
            return 200
    
    def generate_srt_subtitles(
        self,
        scenes: List[StoryboardScene]
    ) -> str:
        """
        生成 SRT 格式字幕
        """
        srt_content = []
        
        for i, scene in enumerate(scenes):
            if not scene.subtitle_text:
                continue
            
            # 格式化時間戳
            start_time = self._format_srt_time(scene.subtitle_start)
            end_time = self._format_srt_time(scene.subtitle_end)
            
            srt_content.append(f"{i + 1}")
            srt_content.append(f"{start_time} --> {end_time}")
            srt_content.append(scene.subtitle_text)
            srt_content.append("")
        
        return "\n".join(srt_content)
    
    def _format_srt_time(self, seconds: float) -> str:
        """格式化 SRT 時間戳"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


# ============================================================
# 便捷函數
# ============================================================

def get_storyboard_service() -> StoryboardService:
    return StoryboardService()

def get_tts_service() -> TTSService:
    return TTSService()
