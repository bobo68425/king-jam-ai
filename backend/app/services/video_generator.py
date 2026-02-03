"""
Video Generator Service - 影片生成服務 v3.1
============================================
支援多種 AI 影片生成模型：
- Google Veo 3 / Veo 3 Fast（頂級品質）
- Kling AI（高性價比）
- Imagen + FFmpeg（基礎合成）
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

# Kling AI 配置（透過 Replicate）
REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN", "")

# 初始化 Google GenAI Client
genai_client = None
vertexai_client = None

# 檢查是否在 Cloud Run 環境（有預設服務帳戶）
IS_CLOUD_RUN = os.getenv("K_SERVICE") is not None
GOOGLE_CLOUD_PROJECT_ACTUAL = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCP_PROJECT") or "king-jam-ai"

print(f"[VideoGenerator] 環境檢測: Cloud Run={IS_CLOUD_RUN}, Project={GOOGLE_CLOUD_PROJECT_ACTUAL}")

# 方法 1: 嘗試使用 Vertex AI SDK（Cloud Run 自動有服務帳戶認證）
try:
    from google import genai
    from google.genai import types
    
    # 使用 Vertex AI 模式（Cloud Run 會自動使用服務帳戶）
    vertexai_client = genai.Client(
        vertexai=True,
        project=GOOGLE_CLOUD_PROJECT_ACTUAL,
        location=GOOGLE_CLOUD_LOCATION,
    )
    print(f"[VideoGenerator] ✓ Vertex AI Client 初始化成功 (專案: {GOOGLE_CLOUD_PROJECT_ACTUAL})")
except ImportError as e:
    print(f"[VideoGenerator] Vertex AI 導入失敗: {e}")
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

# Replicate Client（用於 Kling AI）- 延遲初始化以避免相容性問題
replicate_client = None
REPLICATE_AVAILABLE = False

def get_replicate_client():
    """延遲初始化 Replicate Client"""
    global replicate_client, REPLICATE_AVAILABLE
    if replicate_client is not None:
        return replicate_client
    
    if not REPLICATE_API_TOKEN:
        print("[VideoGenerator] ⚠️ REPLICATE_API_TOKEN 未設定，Kling AI 不可用")
        return None
    
    try:
        import replicate
        replicate_client = replicate.Client(api_token=REPLICATE_API_TOKEN)
        REPLICATE_AVAILABLE = True
        print("[VideoGenerator] ✓ Replicate Client 初始化成功 (Kling AI 可用)")
        return replicate_client
    except ImportError:
        print("[VideoGenerator] ⚠️ replicate SDK 未安裝，Kling AI 不可用")
        return None
    except Exception as e:
        print(f"[VideoGenerator] ⚠️ Replicate 初始化失敗: {e}")
        return None


# ============================================================
# 免費商用背景音樂庫
# 來源：Mixkit (https://mixkit.co) - 免費商用，無需署名
# 授權：Mixkit License - 可用於商業項目，無需標註來源
# ============================================================

FREE_MUSIC_LIBRARY = {
    # 活力動感風格 (Upbeat / Energetic)
    "upbeat": [
        "https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3",
        "https://assets.mixkit.co/music/preview/mixkit-hip-hop-02-738.mp3",
        "https://assets.mixkit.co/music/preview/mixkit-driving-ambition-32.mp3",
    ],
    # 勵志振奮風格 (Inspirational / Motivational)
    "inspirational": [
        "https://assets.mixkit.co/music/preview/mixkit-spirit-of-the-game-132.mp3",
        "https://assets.mixkit.co/music/preview/mixkit-a-very-happy-christmas-897.mp3",
        "https://assets.mixkit.co/music/preview/mixkit-life-is-a-dream-837.mp3",
    ],
    # 悠閒放鬆風格 (Calm / Relaxing)
    "calm": [
        "https://assets.mixkit.co/music/preview/mixkit-serene-view-443.mp3",
        "https://assets.mixkit.co/music/preview/mixkit-sleepy-cat-135.mp3",
        "https://assets.mixkit.co/music/preview/mixkit-beautiful-dream-493.mp3",
    ],
    # 電影史詩風格 (Epic / Cinematic)
    "epic": [
        "https://assets.mixkit.co/music/preview/mixkit-epic-orchestra-transition-2290.mp3",
        "https://assets.mixkit.co/music/preview/mixkit-cinematic-mystery-suspense-story-trailer-608.mp3",
        "https://assets.mixkit.co/music/preview/mixkit-epic-cinematic-trailer-115.mp3",
    ],
    # 情感細膩風格 (Emotional / Piano)
    "emotional": [
        "https://assets.mixkit.co/music/preview/mixkit-piano-reflections-22.mp3",
        "https://assets.mixkit.co/music/preview/mixkit-sad-piano-hope-464.mp3",
        "https://assets.mixkit.co/music/preview/mixkit-feeling-happy-5.mp3",
    ],
    # 科技未來風格 (Tech / Electronic)
    "minimal": [
        "https://assets.mixkit.co/music/preview/mixkit-games-worldbeat-466.mp3",
        "https://assets.mixkit.co/music/preview/mixkit-deep-urban-623.mp3",
        "https://assets.mixkit.co/music/preview/mixkit-complicated-305.mp3",
    ],
    # 企業形象 (Corporate)
    "corporate": [
        "https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3",
        "https://assets.mixkit.co/music/preview/mixkit-a-very-happy-christmas-897.mp3",
        "https://assets.mixkit.co/music/preview/mixkit-driving-ambition-32.mp3",
    ],
}

def get_music_url_for_style(style: str) -> str:
    """
    根據風格獲取免費商用音樂 URL
    
    來源：Mixkit - 免費商用音樂，無需署名
    授權：可用於商業項目、YouTube、社交媒體等
    """
    import random
    
    # 標準化風格名稱
    style_map = {
        "upbeat": "upbeat",
        "energetic": "upbeat", 
        "inspirational": "inspirational",
        "motivational": "inspirational",
        "faith": "inspirational",  # 信仰靈性風格使用勵志音樂
        "worship": "inspirational",
        "calm": "calm",
        "relaxing": "calm",
        "chill": "calm",
        "epic": "epic",
        "cinematic": "epic",
        "dramatic": "epic",
        "emotional": "emotional",
        "piano": "emotional",
        "touching": "emotional",
        "minimal": "minimal",
        "tech": "minimal",
        "electronic": "minimal",
        "corporate": "corporate",
    }
    
    normalized_style = style_map.get(style.lower(), "upbeat")
    urls = FREE_MUSIC_LIBRARY.get(normalized_style, FREE_MUSIC_LIBRARY["upbeat"])
    
    if urls:
        return random.choice(urls)
    return FREE_MUSIC_LIBRARY["upbeat"][0]

# ============================================================
# 模型配置
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

# 第三方 AI 視頻模型配置（透過 Replicate）
THIRD_PARTY_VIDEO_MODELS = {
    # Kling v2.1 - 官方 Kuaishou 模型 (image-to-video)
    "kling": "kwaivgi/kling-v2.1",           # Kling v2.1 - 5秒/10秒, 720p/1080p
    # MiniMax 備用
    "minimax": "minimax/video-01",           # MiniMax Hailuo - 6秒高品質
    "minimax-live": "minimax/video-01-live", # MiniMax Live - 更快速
    "luma": "luma/ray",                      # Luma Dream Machine
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
    
    # Edge TTS 語音映射（已驗證可用）
    # 參考: https://learn.microsoft.com/azure/ai-services/speech-service/language-support
    # 注意：只包含經過測試確認可用的語音
    TTS_VOICES = {
        # 基本風格映射
        "female": "zh-TW-HsiaoChenNeural",
        "male": "zh-TW-YunJheNeural",
        "friendly": "zh-TW-HsiaoChenNeural",
        # ============================================================
        # 風格別名映射（指定風格會自動選擇適合的語音）
        # ============================================================
        "professional": "zh-CN-XiaoxiaoNeural",  # 曉曉（溫暖知性）
        "energetic": "zh-CN-YunyangNeural",      # 雲揚（專業新聞）
        "warm": "zh-TW-HsiaoYuNeural",           # 曉雨（溫柔甜美）
        "gentle": "zh-TW-HsiaoYuNeural",         # 曉雨
        "news": "zh-CN-YunyangNeural",           # 雲揚（專業新聞）
        "story": "zh-CN-XiaoxiaoNeural",         # 曉曉（溫暖知性）
        "young": "zh-CN-XiaoyiNeural",           # 曉伊（活潑卡通）
        "chat": "zh-CN-YunxiNeural",             # 雲希（陽光活力）
        "elegant": "zh-TW-HsiaoChenNeural",      # 曉臻（親切正式）
        "childlike": "zh-CN-YunxiaNeural",       # 雲夏（可愛童聲）
        "calm": "zh-TW-YunJheNeural",            # 雲哲（專業穩重）
        "sports": "zh-CN-YunjianNeural",         # 雲健（熱情解說）
        "faith": "zh-TW-HsiaoYuNeural",          # 曉雨（溫柔堅定，適合信仰內容）
        "worship": "zh-TW-HsiaoYuNeural",        # 曉雨
        
        # ============================================================
        # 直接指定語音 ID（用於品牌包設定）- 官方驗證可用 ✓
        # ============================================================
        # 繁體中文（台灣）
        "zh-TW-HsiaoChenNeural": "zh-TW-HsiaoChenNeural",
        "zh-TW-HsiaoYuNeural": "zh-TW-HsiaoYuNeural",
        "zh-TW-YunJheNeural": "zh-TW-YunJheNeural",
        # 簡體中文
        "zh-CN-XiaoxiaoNeural": "zh-CN-XiaoxiaoNeural",
        "zh-CN-XiaoyiNeural": "zh-CN-XiaoyiNeural",
        "zh-CN-YunyangNeural": "zh-CN-YunyangNeural",
        "zh-CN-YunjianNeural": "zh-CN-YunjianNeural",
        "zh-CN-YunxiNeural": "zh-CN-YunxiNeural",
        "zh-CN-YunxiaNeural": "zh-CN-YunxiaNeural",
        # 簡體中文方言
        "zh-CN-liaoning-XiaobeiNeural": "zh-CN-liaoning-XiaobeiNeural",
        "zh-CN-shaanxi-XiaoniNeural": "zh-CN-shaanxi-XiaoniNeural",
        # 粵語（香港）
        "zh-HK-HiuMaanNeural": "zh-HK-HiuMaanNeural",
        "zh-HK-HiuGaaiNeural": "zh-HK-HiuGaaiNeural",
        "zh-HK-WanLungNeural": "zh-HK-WanLungNeural",
        # 英文
        "en-US-JennyNeural": "en-US-JennyNeural",
        "en-US-GuyNeural": "en-US-GuyNeural",
        "en-US-AriaNeural": "en-US-AriaNeural",
        "en-GB-SoniaNeural": "en-GB-SoniaNeural",
        "en-GB-RyanNeural": "en-GB-RyanNeural",
        # 日文
        "ja-JP-NanamiNeural": "ja-JP-NanamiNeural",
        "ja-JP-KeitaNeural": "ja-JP-KeitaNeural",
        # 韓文
        "ko-KR-SunHiNeural": "ko-KR-SunHiNeural",
        "ko-KR-InJoonNeural": "ko-KR-InJoonNeural",
    }
    
    def __init__(self):
        self.output_dir = Path(tempfile.gettempdir()) / "kingjam_videos"
        self.output_dir.mkdir(exist_ok=True)
    
    async def generate_video(
        self,
        script: Dict[str, Any],
        progress_callback: Optional[Callable] = None,
        quality: str = "standard",
        custom_images: Optional[Dict[int, str]] = None,
        custom_music_base64: Optional[str] = None,
        custom_music_name: Optional[str] = None
    ) -> VideoResult:
        """
        生成影片
        
        品質等級：
        - standard: Imagen 圖片 + FFmpeg 合成（支援自訂圖片）
        - kling: Kling AI 1.5（高性價比）
        - kling-pro: Kling AI 1.5 Pro（更好品質）
        - premium: Veo 3 Fast
        - ultra: Veo 3 最高品質
        
        custom_images: 用戶自訂場景圖片 {scene_index: base64_or_url}
        custom_music_base64: 用戶自訂音樂（Base64 編碼）
        custom_music_name: 自訂音樂檔名
        """
        project_id = script.get("project_id", str(uuid.uuid4()))
        scenes = script.get("scenes", [])
        total_duration = sum(s.get("duration_seconds", 5) for s in scenes)
        format_str = script.get("format", "9:16")
        color_palette = script.get("color_palette", ["#6366F1", "#8B5CF6"])
        
        # 保存自訂圖片和音樂供後續使用
        self._custom_images = custom_images or {}
        self._custom_music_base64 = custom_music_base64
        self._custom_music_name = custom_music_name
        
        if not scenes:
            raise ValueError("腳本中沒有場景")
        
        quality_names = {
            "standard": "標準合成", 
            "kling": "Kling 5秒 720p",
            "kling-10s": "Kling 10秒 720p",
            "kling-pro": "Kling Pro 5秒 1080p",
            "kling-pro-10s": "Kling Pro 10秒 1080p",
            "premium": "Veo Fast 8秒", 
            "ultra": "Veo Pro 8秒"
        }
        print(f"[VideoGenerator] 🎬 開始生成影片 (模型: {quality_names.get(quality, quality)})")
        print(f"[VideoGenerator] 📋 場景數: {len(scenes)}, 總時長: {total_duration}秒")
        
        # 根據品質等級選擇生成方法
        if quality.startswith("kling"):
            # Kling v2.1 影片生成 (image-to-video)
            is_pro = "pro" in quality
            is_10s = "10s" in quality
            kling_duration = 10 if is_10s else 5
            print(f"[VideoGenerator] 🎥 使用 Kling v2.1 模型, Pro={is_pro}, 時長: {kling_duration}秒")
            
            video_result = await self._generate_with_kling(script, project_id, model=quality, duration=kling_duration)
            if video_result:
                return video_result
            
            # Kling 失敗，降級到 Imagen + FFmpeg
            print("[VideoGenerator] ⚠️ Kling 不可用，降級到 Imagen + FFmpeg")
        
        elif quality in ["premium", "ultra"]:
            # 高級/頂級：使用 Veo 模型
            veo_model = "veo-3.0-generate-preview" if quality == "ultra" else "veo-3.0-fast-generate-preview"
            print(f"[VideoGenerator] 🎥 使用 Veo 模型: {veo_model}")
            
            video_result = await self._generate_with_veo(script, project_id, preferred_model=veo_model)
            if video_result:
                return video_result
            
            # Veo 失敗，降級到 Imagen + FFmpeg
            print("[VideoGenerator] ⚠️ Veo 不可用，降級到 Imagen + FFmpeg")
        
        # 標準品質 或 其他方案失敗的降級方案
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
                    
                    # 發起生成請求（不使用 generate_audio，我們會單獨處理音訊）
                    config = {
                        "aspect_ratio": aspect_ratio,
                        "duration_seconds": veo_duration,
                        "number_of_videos": 1,
                    }
                    # generate_audio 只在 Vertex AI 模式下支援
                    if client == vertexai_client:
                        config["generate_audio"] = True
                    
                    operation = await asyncio.to_thread(
                        client.models.generate_videos,
                        model=model_name,
                        prompt=video_prompt,
                        config=config
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
                            
                            print(f"[VideoGenerator] 📁 Veo 影片已保存: {static_path}")
                            
                            # 上傳到雲端儲存
                            video_url = f"/video/download/{video_filename}"
                            try:
                                from app.services.cloud_storage import cloud_storage
                                if cloud_storage.is_configured():
                                    print(f"[VideoGenerator] ☁️ 正在上傳 Veo 影片到雲端儲存...")
                                    upload_result = cloud_storage.upload_file(
                                        file_path=str(static_path),
                                        user_id=0,
                                        file_type="videos",
                                        original_filename=video_filename
                                    )
                                    if upload_result.get("success"):
                                        video_url = upload_result["url"]
                                        print(f"[VideoGenerator] ✅ Veo 雲端上傳成功: {video_url}")
                                        try:
                                            os.remove(static_path)
                                        except:
                                            pass
                                    else:
                                        print(f"[VideoGenerator] ⚠️ Veo 雲端上傳失敗: {upload_result.get('error')}")
                            except Exception as e:
                                print(f"[VideoGenerator] ⚠️ Veo 雲端儲存異常: {e}")
                            
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
    
    async def _generate_with_kling(
        self,
        script: Dict[str, Any],
        project_id: str,
        model: str = "kling",
        duration: int = 5
    ) -> Optional[VideoResult]:
        """
        使用 Kling v2.1 生成影片（透過 Replicate）
        
        Kling v2.1 是 image-to-video 模型，需要先生成起始圖片
        - standard: 720p, 24fps
        - pro: 1080p, 24fps
        - duration: 5 或 10 秒
        """
        client = get_replicate_client()
        if not client:
            print("[VideoGenerator] Kling: Replicate Client 未初始化")
            return None
        
        scenes = script.get("scenes", [])
        format_str = script.get("format", "9:16")
        title = script.get("title", "")
        
        # 構建提示詞
        prompt = self._build_kling_prompt(script)
        
        # Kling 模式：standard (720p) 或 pro (1080p)
        is_pro = "pro" in model
        kling_mode = "pro" if is_pro else "standard"
        kling_duration = 10 if "10s" in model else 5
        
        try:
            # 步驟 1: 生成起始圖片
            print(f"[VideoGenerator] 🖼️ 生成起始圖片...")
            
            # 取第一個場景的視覺描述
            first_scene = scenes[0] if scenes else {}
            image_prompt = first_scene.get("visual_prompt", prompt)
            color_palette = script.get("color_palette", ["#6366F1", "#8B5CF6"])
            
            # 根據比例設置圖片尺寸
            size_map = {
                "9:16": (720, 1280) if not is_pro else (1080, 1920),
                "16:9": (1280, 720) if not is_pro else (1920, 1080),
                "1:1": (1024, 1024),
            }
            width, height = size_map.get(format_str, (720, 1280))
            
            import base64
            import io
            start_image_data = None
            
            # 方法 1: 嘗試使用 Imagen
            img_client = vertexai_client or genai_client
            imagen_models = [
                "models/imagen-4.0-fast-generate-001",
                "models/gemini-2.0-flash-exp-image-generation",
            ]
            
            for model_name in imagen_models:
                try:
                    if img_client and hasattr(img_client.models, 'generate_images'):
                        response = await asyncio.wait_for(
                            asyncio.to_thread(
                                img_client.models.generate_images,
                                model=model_name,
                                prompt=image_prompt
                            ),
                            timeout=60.0
                        )
                        
                        if response and hasattr(response, 'generated_images') and response.generated_images:
                            img_bytes = response.generated_images[0].image.image_bytes
                            start_image_data = f"data:image/png;base64,{base64.b64encode(img_bytes).decode()}"
                            print(f"[VideoGenerator] ✅ 起始圖片生成完成 (Imagen)")
                            break
                except Exception as img_err:
                    continue
            
            # 方法 2: 使用明亮起始圖片（專為 Kling 優化）
            if not start_image_data:
                print(f"[VideoGenerator] 📐 生成明亮起始圖片...")
                start_image_data = self._generate_kling_start_image(color_palette, width, height, title)
                if start_image_data:
                    print(f"[VideoGenerator] ✅ 明亮起始圖片生成完成")
            
            if not start_image_data:
                print("[VideoGenerator] ❌ 起始圖片生成失敗")
                return None
            
            # 步驟 2: 調用 Kling v2.1 生成影片
            print(f"[VideoGenerator] 🎥 開始 Kling v2.1 影片生成...")
            print(f"[VideoGenerator] 📝 提示詞: {prompt[:100]}...")
            print(f"[VideoGenerator] ⚙️ 模式: {kling_mode}, 時長: {kling_duration}秒")
            
            # Kling 專用 negative prompt（避免常見問題）
            kling_negative = """blurry, out of focus, low resolution, pixelated, 
grainy noise, compression artifacts, watermark, logo, text overlay, 
distorted faces, unnatural movements, jittery motion, choppy animation,
amateur lighting, overexposed, underexposed, washed out colors,
static image, no motion, frozen frame, glitch, artifact"""

            output = await asyncio.to_thread(
                client.run,
                THIRD_PARTY_VIDEO_MODELS["kling"],
                input={
                    "prompt": prompt,
                    "start_image": start_image_data,
                    "mode": kling_mode,
                    "duration": kling_duration,
                    "negative_prompt": kling_negative,
                }
            )
            
            # 處理輸出（可能是 URL、FileOutput 或 iterator）
            video_url_remote = None
            print(f"[VideoGenerator] 📦 Kling 返回類型: {type(output)}")
            print(f"[VideoGenerator] 📦 Kling 返回內容: {output}")
            
            if isinstance(output, str):
                video_url_remote = output
            elif hasattr(output, 'url'):
                # FileOutput 對象
                video_url_remote = str(output.url) if hasattr(output.url, '__str__') else output.url
            elif hasattr(output, '__iter__'):
                for item in output:
                    print(f"[VideoGenerator] 📦 迭代項目: {type(item)} - {item}")
                    if isinstance(item, str) and item.startswith('http'):
                        video_url_remote = item
                        break
                    elif hasattr(item, 'url'):
                        video_url_remote = str(item.url)
                        break
            
            if not video_url_remote:
                print("[VideoGenerator] ❌ Kling 未返回影片 URL")
                return None
            
            print(f"[VideoGenerator] ✅ Kling 影片生成成功！URL: {video_url_remote[:80]}...")
            
            # 下載影片到本地
            import httpx
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.get(video_url_remote)
                if response.status_code != 200:
                    print(f"[VideoGenerator] ❌ 下載 Kling 影片失敗: {response.status_code}")
                    return None
                video_bytes = response.content
            
            # 保存到靜態目錄
            static_dir = Path("/app/static/videos")
            static_dir.mkdir(parents=True, exist_ok=True)
            
            video_filename = f"kling_{project_id}.mp4"
            static_path = static_dir / video_filename
            
            with open(static_path, "wb") as f:
                f.write(video_bytes)
            
            print(f"[VideoGenerator] 📁 Kling 影片已保存: {static_path}, 大小: {len(video_bytes) / 1024 / 1024:.2f} MB")
            
            # 🔊 添加音訊處理（TTS + 背景音樂）
            final_video_path = await self._add_audio_to_video(
                video_path=str(static_path),
                script=script,
                project_id=project_id,
                duration=kling_duration
            )
            
            if final_video_path and final_video_path != str(static_path):
                # 如果生成了新的帶音訊影片，更新路徑
                video_filename = os.path.basename(final_video_path)
                final_size = os.path.getsize(final_video_path)
                print(f"[VideoGenerator] 🔊 音訊已添加，最終影片: {final_video_path}, 大小: {final_size / 1024 / 1024:.2f} MB")
                upload_path = final_video_path
            else:
                final_size = len(video_bytes)
                upload_path = str(static_path)
            
            # 上傳到雲端儲存
            video_url = f"/video/download/{video_filename}"
            try:
                from app.services.cloud_storage import cloud_storage
                if cloud_storage.is_configured():
                    print(f"[VideoGenerator] ☁️ 正在上傳 Kling 影片到雲端儲存...")
                    upload_result = cloud_storage.upload_file(
                        file_path=upload_path,
                        user_id=0,
                        file_type="videos",
                        original_filename=f"kling_{project_id}.mp4"
                    )
                    if upload_result.get("success"):
                        video_url = upload_result["url"]
                        print(f"[VideoGenerator] ✅ Kling 雲端上傳成功: {video_url}")
                        # 刪除本地檔案
                        try:
                            os.remove(upload_path)
                            if upload_path != str(static_path) and os.path.exists(static_path):
                                os.remove(static_path)
                        except:
                            pass
                    else:
                        print(f"[VideoGenerator] ⚠️ Kling 雲端上傳失敗: {upload_result.get('error')}")
            except Exception as e:
                print(f"[VideoGenerator] ⚠️ Kling 雲端儲存異常: {e}")
            
            return VideoResult(
                video_url=video_url,
                video_base64=None,
                thumbnail_url=None,
                duration=int(kling_duration),
                format=format_str,
                file_size=final_size,
                scene_images=None,
                generation_method="kling"
            )
            
        except Exception as e:
            print(f"[VideoGenerator] ❌ Kling 生成失敗: {e}")
            return None
    
    def _generate_kling_start_image(
        self, 
        color_palette: List[str], 
        width: int, 
        height: int, 
        title: str = ""
    ) -> Optional[str]:
        """
        生成 Kling 專用的純黑起始圖片
        
        Kling v2.1 是 image-to-video 模型，必須有起始圖片
        使用純黑圖片，讓 Kling 從黑場開始生成
        """
        if not PIL_AVAILABLE:
            return None
        
        try:
            import io
            import base64
            
            # 創建純黑圖片
            img = Image.new('RGB', (width, height), color=(0, 0, 0))
            
            # 轉換為 base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG', quality=95)
            
            print(f"[VideoGenerator] ⬛ 生成純黑起始圖片 ({width}x{height})")
            
            return f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode()}"
            
        except Exception as e:
            print(f"[VideoGenerator] ❌ Kling 起始圖片生成失敗: {e}")
            return None
    
    def _build_kling_prompt(self, script: Dict[str, Any]) -> str:
        """
        構建 Kling v2.1 影片提示詞
        
        Kling 最佳實踐：
        1. 描述動態和運動（camera movement, subject motion）
        2. 使用具體的視覺細節
        3. 包含光線和氛圍描述
        4. 避免過長的提示詞（建議 100-200 字）
        """
        import random
        
        scenes = script.get("scenes", [])
        title = script.get("title", "")
        description = script.get("description", "")
        style = script.get("overall_style", "modern, cinematic")
        color_palette = script.get("color_palette", ["#6366F1", "#8B5CF6"])
        personality = script.get("personality", "professional")
        
        # 從第一個場景提取視覺提示詞
        first_scene = scenes[0] if scenes else {}
        visual_prompt = first_scene.get("visual_prompt", "")
        camera_movement = first_scene.get("camera_movement", "smooth dolly forward")
        
        # Kling 專用的運鏡詞彙
        CAMERA_MOVES = {
            "dolly": "smooth dolly forward revealing the scene",
            "pan": "elegant pan across the environment",
            "tracking": "dynamic tracking shot following the subject",
            "crane": "cinematic crane shot descending gracefully",
            "orbit": "360 degree orbit around the subject",
            "push": "slow push in towards the focal point",
            "pull": "gradual pull back revealing context",
            "static": "locked off shot with subtle subject motion",
        }
        
        # Kling 專用的動態描述
        MOTION_STYLES = {
            "professional": "subtle confident movements, professional gestures, purposeful actions",
            "friendly": "natural relaxed motion, warm genuine expressions, organic interactions",
            "luxurious": "elegant slow movements, refined gestures, sophisticated grace",
            "energetic": "dynamic energetic motion, vibrant movements, exciting action",
            "calm": "peaceful gentle movements, serene flow, tranquil atmosphere",
        }
        
        # Kling 專用的光線描述
        LIGHTING_STYLES = {
            "professional": "soft diffused studio lighting with subtle shadows, clean and polished look",
            "friendly": "warm golden hour sunlight streaming through windows, cozy ambient glow",
            "luxurious": "dramatic chiaroscuro lighting with sparkling highlights, rich deep shadows",
            "energetic": "vibrant colorful lighting with dynamic contrasts, bold illumination",
            "calm": "soft ethereal light with gentle gradients, peaceful luminous atmosphere",
        }
        
        # 選擇運鏡
        selected_camera = CAMERA_MOVES.get(camera_movement, random.choice(list(CAMERA_MOVES.values())))
        
        # 選擇動態風格
        motion_style = MOTION_STYLES.get(personality, MOTION_STYLES["professional"])
        
        # 選擇光線風格
        lighting_style = LIGHTING_STYLES.get(personality, LIGHTING_STYLES["professional"])
        
        # 構建提示詞（簡潔但完整）
        prompt_parts = []
        
        # 1. 核心視覺描述（使用場景的 visual_prompt 或標題）
        if visual_prompt:
            # 清理並使用場景視覺提示詞的核心內容
            core_visual = visual_prompt.split(",")[0:3]  # 取前3個描述
            prompt_parts.append(", ".join(core_visual))
        elif title:
            prompt_parts.append(f"Cinematic scene depicting: {title}")
        elif description:
            prompt_parts.append(f"Visual story about: {description[:80]}")
        
        # 2. 運鏡描述（Kling 對此反應很好）
        prompt_parts.append(selected_camera)
        
        # 3. 動態描述
        prompt_parts.append(motion_style)
        
        # 4. 光線和氛圍
        prompt_parts.append(lighting_style)
        
        # 5. 品質關鍵詞
        quality_terms = [
            "cinematic 4K quality",
            "professional color grading", 
            "film grain texture",
            "shallow depth of field",
            "broadcast quality production"
        ]
        prompt_parts.append(random.choice(quality_terms))
        
        # 6. 風格修飾
        style_terms = [
            f"{style} aesthetic",
            "premium visual storytelling",
            "advertising quality",
        ]
        prompt_parts.append(random.choice(style_terms))
        
        # 組合提示詞（用逗號分隔，Kling 偏好這種格式）
        final_prompt = ", ".join(prompt_parts)
        
        # 限制長度（Kling 對過長提示詞效果不佳）
        if len(final_prompt) > 500:
            final_prompt = final_prompt[:500].rsplit(",", 1)[0]
        
        return final_prompt
    
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
        
        # 電影級風格映射 - 頂級廣告視覺描述 (Premium Quality v2.0)
        CINEMATIC_STYLES = {
            "professional": {
                "visual": """pristine corporate environment with floor-to-ceiling glass walls reflecting city skylines,
polished concrete and brushed aluminum surfaces, Herman Miller furniture, live edge wood accents,
geometric architectural lines creating depth, subtle branded elements integrated seamlessly,
modern art pieces adding sophistication, lush indoor plants for organic warmth""",
                "lighting": """masterfully crafted three-point lighting with large soft key creating dimensional faces,
subtle fill preserving shadow detail without flatness, elegant rim light for subject separation,
practical office lighting adding realism, window light creating natural gradients,
color temperature: 5500K daylight balanced with warm accent touches""",
                "camera": ["Smooth gimbal dolly forward revealing scale", "Precision tracking shot with subtle parallax", 
                          "Elegant jib descent from architectural height", "Steadicam glide through premium space"],
                "atmosphere": "confident sophistication, trustworthy authority, accessible expertise, premium without pretension",
                "color_grade": """clean neutral base with subtle warm skin tone lift, 
corporate navy and slate accents, pristine whites with detail,
ARRI LogC to Rec.709 grade, subtle S-curve contrast,
skin-friendly midtones, controlled highlights""",
                "reference": "Apple 'At Work' series, Salesforce brand films, Bloomberg studio aesthetics, WeWork lifestyle content"
            },
            "friendly": {
                "visual": """sun-drenched lifestyle moments in thoughtfully designed spaces,
natural linen textures, warm wood tones, handcrafted ceramics, vintage brass accents,
authentic human interactions with genuine laughter, pets adding warmth,
cozy reading nooks, steaming coffee cups, morning light streaming through sheer curtains,
real homes with lived-in warmth, not sterile staging""",
                "lighting": """golden hour magic with warm light painting faces beautifully,
soft window light with gentle shadows, practical lamps creating pools of warmth,
candle flicker adding intimacy, fireplace glow for evening scenes,
diffused natural daylight, no harsh shadows, skin-flattering always""",
                "camera": ["Gentle observational handheld with subtle breathing", "Intimate close-up revealing emotion",
                          "Smooth follow shot maintaining connection", "Natural pan discovering moments"],
                "atmosphere": "genuine warmth that feels like home, authentic connection, relatable comfort, the feeling of being understood",
                "color_grade": """warm amber undertones, lifted shadows with orange hue,
Kodak Portra 400 film emulation, creamy highlight rolloff,
nostalgic but not dated, cozy color temperature,
natural skin warmth, soft green foliage rendering""",
                "reference": "Google 'Year in Search', Airbnb 'Belong Anywhere', Coca-Cola 'Real Magic', IKEA lifestyle films"
            },
            "luxurious": {
                "visual": """opulent materials: Calacatta marble with gold veining, brushed brass fixtures, 
hand-stitched leather, Venetian velvet, Baccarat crystal catching light,
haute couture fabrics draped perfectly, fresh peonies in crystal vases,
architectural masterpieces with double-height ceilings, museum-quality art,
Monaco yacht interiors, Parisian apartment grandeur, Swiss chalet elegance""",
                "lighting": """dramatic chiaroscuro with sparkling jewelry-style key lights,
deep cinematic shadows adding mystery and depth, rim lights creating halos,
chandelier sparkle, candelabra ambiance, moonlight through silk curtains,
spotlight reveals on hero products, volumetric rays through dust particles""",
                "camera": ["Majestic crane revealing grandeur", "Hypnotic orbit around precious subject",
                          "Slow cinematic reveal building anticipation", "Tracking dolly through opulent space"],
                "atmosphere": "timeless elegance, exclusive access to extraordinary, aspirational yet attainable sophistication, old money understated luxury",
                "color_grade": """deep rich blacks with shadow detail, golden highlight accents,
film noir influence with selective color pops, desaturated base with jewel tone accents,
skin rendered like Renaissance paintings, metallic surfaces gleaming,
high contrast with preserved detail, S-curve with lifted blacks""",
                "reference": "Chanel 'The One That I Want', Cartier 'Shape Your Time', Louis Vuitton 'L'Invitation au Voyage', Dior haute couture films"
            },
            "playful": {
                "visual": """explosion of saturated colors: electric pink, lime green, sunshine yellow,
dynamic geometric shapes in motion, Memphis design influence, pop art bold graphics,
confetti moments, balloon installations, candy-colored environments,
energetic Gen-Z aesthetics, TikTok-native visual language,
creative chaos with intentional composition, maximum visual stimulation""",
                "lighting": """bright even wash eliminating shadows, colorful gel lighting creating mood,
neon tube accents, RGB LED effects, festival-style color mixing,
ring light beauty, billboard brightness, club atmosphere with moving lights""",
                "camera": ["Snappy whip pan with motion blur", "Energetic tracking matching subject energy",
                          "Playful zoom punch for emphasis", "Quick-cut montage building rhythm"],
                "atmosphere": "infectious joy, youthful rebellion, creative expression, FOMO-inducing excitement, main character energy",
                "color_grade": """maximum saturation pushed to the edge, boosted contrast for punch,
candy-colored palette, punchy split-tone processing,
crushed blacks with neon shadows, blown highlights as aesthetic choice,
Instagram-filter boldness, dopamine-triggering colors""",
                "reference": "Spotify Wrapped, Nintendo Switch lifestyle, Fenty Beauty campaigns, McDonald's 'Famous Orders'"
            },
            "minimalist": {
                "visual": """vast negative space as primary design element, single subject commanding attention,
Scandinavian simplicity, Japanese wabi-sabi philosophy, Bauhaus geometric purity,
white-on-white layering, subtle texture variations, mono-material focus,
architectural concrete poetry, zen garden stillness, gallery-white environments""",
                "lighting": """ethereal diffused glow from massive soft sources, shadowless high-key illumination,
gentle gradients across seamless backgrounds, morning fog softness,
studio infinity cove, natural north-facing window light,
pure and clean, no dramatic shadows, meditative calm""",
                "camera": ["Contemplative static frame holding stillness", "Glacially slow push-in building tension",
                          "Clean geometric tilt reveal", "Zen-like static observation"],
                "atmosphere": "profound calm, intentional emptiness, thoughtful stillness, the luxury of less, space to breathe",
                "color_grade": """desaturated to near monochrome, pure whites with subtle warmth,
soft grays with delicate undertones, whisper-quiet pastel accents,
high-key exposure, compressed dynamic range, ethereal processing,
Fuji Acros film simulation, Nordic color science""",
                "reference": "Muji lifestyle films, Apple 'Designed by Apple', Aesop store interiors, Comme des Garçons campaigns"
            },
            "innovative": {
                "visual": """bleeding-edge technology visualization, holographic UI floating in space,
quantum computing aesthetics, neural network visualizations, data as art,
SpaceX-style clean tech, Tesla factory precision, server room cathedral lighting,
transparent OLED displays, robotic precision movements, 3D-printed structures""",
                "lighting": """cool 6500K tech-blue key lighting, cyan LED accent strips,
monitor glow illuminating faces, fiber optic star fields,
volumetric fog rays through darkness, laser precision beams,
neon edge lighting, holographic rim effects, screen reflection fills""",
                "camera": ["Drone descent through impossible space", "Matrix-style frozen moment orbit",
                          "Sci-fi tracking through tech corridor", "Reveal dolly from micro to macro"],
                "atmosphere": "bleeding-edge discovery, future-is-now excitement, technological sublime, humanity enhanced by innovation",
                "color_grade": """cool blue dominant with electric cyan accents, teal and orange tension,
digital color banding as aesthetic, cyberpunk influence,
high contrast with crushed blacks, LED color contamination,
Blade Runner 2049 color science, TRON Legacy glow""",
                "reference": "Tesla 'Cybertruck Reveal', Apple WWDC keynotes, Boston Dynamics showcases, SpaceX launch films"
            },
            "trustworthy": {
                "visual": """unscripted real-life moments captured with documentary authenticity,
genuine expressions without direction, real locations with character,
working hands showing expertise, weathered faces telling stories,
community gatherings, multi-generational families, actual customers not actors,
behind-the-scenes access, the beautiful imperfection of real life""",
                "lighting": """purely available light honoring reality, honest shadows telling time of day,
no artificial enhancement, window light as-is, street lamp authenticity,
overcast soft light, harsh noon sun when real, evening golden hour natural,
true-to-life exposure, documentary brightness levels""",
                "camera": ["Observational documentary handheld with human presence", "Vérité steady wide shot",
                          "Patient follow allowing moments to unfold", "Intimate interview framing"],
                "atmosphere": "unfiltered truth, earned trust through transparency, real stories real people, authentic connection that can't be faked",
                "color_grade": """minimal intervention, true-to-life color, documentary naturalism,
news broadcast neutrality, slight desaturation for gravitas,
honest skin tones, no beauty filter, weather-accurate rendering,
16mm film texture optional, truthful processing""",
                "reference": "Nike 'Dream Crazy', Patagonia 'Don't Buy This Jacket', Dove 'Real Beauty', P&G 'Thank You Mom'"
            },
            "energetic": {
                "visual": """peak athletic performance frozen in power, explosive action with controlled blur,
dynamic Dutch angles creating tension, sports arena electricity,
sweat droplets catching light, muscle definition at maximum exertion,
finish line moments, victory celebrations, against-all-odds determination,
urban parkour flow, extreme sports at the edge""",
                "lighting": """dramatic backlighting creating heroic silhouettes, lens flare as victory symbol,
stadium lights creating atmosphere, golden hour athlete glory,
high contrast action lighting, rim lights defining form,
sweat glistening under spot lights, dust particles catching beams""",
                "camera": ["Phantom slow-motion revealing power", "Steadicam chase matching athlete pace",
                          "Explosive zoom for impact moments", "Crane revealing scale of achievement"],
                "atmosphere": "unlimited human potential, adrenaline coursing, unstoppable momentum, the glory of pushing limits, victory tastes sweet",
                "color_grade": """high contrast blockbuster processing, teal shadows with orange highlights,
punchy saturated colors, crushed blacks for drama,
Michael Bay color science, sports broadcast punch,
highlight bloom for glory, deep blacks for intensity""",
                "reference": "Nike 'Just Do It', Red Bull 'Gives You Wings', Under Armour 'Rule Yourself', Gatorade 'Is It In You'"
            },
            "faith": {
                "visual": """sacred atmosphere with divine light rays streaming through stained glass windows,
peaceful church interiors with warm wood pews and candle glow, hands in prayer, open Bible pages,
cross silhouettes against sunrise, quiet garden meditation spaces, baptism waters, communion elements,
family gathered in worship, community fellowship moments, hands reaching upward in praise,
dove in flight symbolizing Holy Spirit, mountaintop vistas symbolizing faith journey""",
                "lighting": """heavenly light rays breaking through clouds, ethereal golden hour glow,
soft divine radiance from above, warm candlelight ambiance, sunrise hope lighting,
gentle rim light creating halos, peaceful diffused natural light through windows,
dawn light symbolizing new beginnings, sunset reflecting God's glory""",
                "camera": ["Slow reverent tilt upward toward light", "Gentle dolly forward into sacred space",
                          "Peaceful wide establishing shot", "Intimate close-up on hands in prayer"],
                "atmosphere": "sacred peace, divine presence, hopeful redemption, comforting grace, eternal love, heavenly serenity, spiritual transformation",
                "color_grade": """warm golden tones of grace, soft whites symbolizing purity,
heavenly blue accents, gentle desaturation for reverence,
sunrise orange and gold, peaceful earth tones,
skin rendered with divine warmth, ethereal highlight glow,
Kodak Ektar warmth, film-like softness for timeless feel""",
                "reference": "The Chosen series cinematography, Hillsong worship films, church promotional content, Christian lifestyle brand imagery"
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
        
        # ═══════════════════════════════════════════════════════════════
        # 三明治 Prompt 架構 (Sandwich Prompt Architecture)
        # ═══════════════════════════════════════════════════════════════
        # 前綴 (PREFIX): 強制電影質感觸發器
        # 用戶輸入 (USER INPUT): 場景內容描述
        # 後綴 (SUFFIX): 品質增強修飾詞
        # ═══════════════════════════════════════════════════════════════
        
        # ===== 前綴: 電影風格觸發器 (Cinematic Style Triggers) =====
        CINEMATIC_PREFIX = """Cinematic shot, 35mm film grain, Kodak Portra 400 film stock, 
Anamorphic lens with natural lens flare, Wide angle establishing shot, 
Shallow depth of field, Beautiful bokeh F/1.8, 
Color graded with teal and orange tones, High contrast moody lighting,
Professional Hollywood cinematography"""

        # ===== 後綴: 品質增強修飾詞 (Quality Modifiers) =====
        QUALITY_SUFFIX = """Masterpiece, Best quality, Ultra-realistic, 8K resolution, 
Intricate details, Sharp focus, Hyper-detailed textures,
Professional color grading, Film-like dynamic range,
Smooth continuous motion at 24fps cinematic cadence,
Buttery smooth camera movement, No stuttering or lag,
Premium production value, Award-winning cinematography"""

        # ===== 負面提示詞 (Negative Prompts - 隱藏設定) =====
        NEGATIVE_MODIFIERS = """Blurry, Low quality, Distorted, Deformed, Watermark, Text overlay,
Bad anatomy, Static frozen frame, Jittery motion, Flickering, Frame drops,
Choppy animation, Stuttering, Lag, Pixelated, Grainy noise,
Compression artifacts, Amateur lighting, Overexposed, Underexposed,
AI generated look, CGI plastic feel, Uncanny valley"""

        # ===== 用戶內容 (User Content) =====
        user_content = f"""Very slow {camera_move} gracefully revealing {main_subject}. 
All movement extremely slow and fluid, like a luxury perfume commercial.

═══════════════════════════════════════════════════════════════
VISUAL DIRECTION
═══════════════════════════════════════════════════════════════

SCENE AESTHETIC:
{style_config["visual"]}
Overall mood: {style}, premium commercial production quality
Art direction reference: {style_config["reference"]}
Visual storytelling approach: Emotion-driven, visually immersive

CINEMATOGRAPHY (SLOW & STEADY - CRITICAL FOR SMOOTH PLAYBACK):
- Camera movement: VERY SLOW {camera_move.lower()}, extremely smooth, glacially paced
- Movement speed: 50% slower than normal, gentle and deliberate
- Camera stability: Rock-solid gimbal stabilization, zero vibration or shake
- Motion style: Floating, dreamy, hypnotic slow-motion feel
- Lens choice: Premium cinema lens with beautiful rendering, minimal distortion
- Depth of field: Shallow with creamy circular bokeh, subject isolation
- Focus: Smooth gradual focus pulls, never sudden changes
- Framing: Rule of thirds, golden ratio, intentional negative space
- IMPORTANT: All motion must be continuous and fluid, no sudden movements

LIGHTING MASTERCLASS:
{style_config["lighting"]}
- Key light: Soft, flattering, three-dimensional
- Fill light: Subtle shadow detail without flatness
- Rim/hair light: Elegant subject separation
- Practical lights: Motivated, adds depth and realism
- Color temperature harmony: {style_config["color_grade"]}

ATMOSPHERE & EMOTIONAL RESONANCE:
{style_config["atmosphere"]}
Story context: {description}
Emotional journey: Build anticipation → Reveal → Satisfaction

═══════════════════════════════════════════════════════════════
TECHNICAL EXCELLENCE
═══════════════════════════════════════════════════════════════

FORMAT & RESOLUTION:
- Aspect ratio: 9:16 vertical, perfectly composed for {target_platform}
- Resolution: Native 4K (2160x3840) source, pristine clarity
- Frame rate: 24fps true cinematic motion cadence
- Bit depth: 10-bit color for smooth gradients

COLOR SCIENCE:
- Primary brand color: {primary_color} (hero element)
- Secondary accent: {secondary_color} (complementary)
- Color grading: Film emulation, lifted blacks, controlled highlights
- Skin tones: Natural, healthy, flattering
- Overall palette: Cohesive, intentional, brand-aligned

MOTION QUALITY (CRITICAL - ULTRA SLOW & SMOOTH):
- Speed: ALL motion at 50% slower than normal speed, dreamy slow-motion aesthetic
- Frame consistency: Every frame must flow perfectly into the next, absolutely no stuttering
- Camera stability: Professional gimbal-smooth, rock-solid, zero micro-jitters or vibration
- Motion style: Floating, hypnotic, meditative pace - like a luxury perfume commercial
- Motion interpolation: Fluid 24fps with perfect motion cadence, no dropped frames
- Subject motion: Slow, graceful, deliberate movements only - no fast actions
- Motion blur: Cinematic 180° shutter angle, organic natural blur on moving elements
- Transitions: Seamless, invisible, butter-smooth dissolves
- Temporal coherence: Maintain perfect visual consistency across all frames
- AVOID: Fast movements, quick cuts, sudden changes, jerky motion
- PREFER: Slow reveals, gentle pans, floating camera, serene pace

AUDIO-VISUAL SYNC:
Rhythm synchronized with {music_vibe}
Visual beats aligned with musical accents

═══════════════════════════════════════════════════════════════
QUALITY IMPERATIVES (NON-NEGOTIABLE)
═══════════════════════════════════════════════════════════════

MUST ACHIEVE:
✓ Broadcast-ready, television commercial standard
✓ Award-winning cinematography aesthetics
✓ Magazine-cover level visual polish
✓ Luxury brand production value
✓ Photorealistic textures and materials
✓ Perfect exposure, no clipped highlights or crushed blacks
✓ Pristine image clarity, zero compression artifacts
✓ Professional colorist-level grading
✓ Seamless, natural movement throughout
✓ Emotionally engaging visual narrative

ABSOLUTELY AVOID (ZERO TOLERANCE):
✗ STUTTERING, LAG, or choppy motion - this is the #1 priority to avoid
✗ FAST MOVEMENTS - all motion must be slow and deliberate
✗ QUICK CUTS or rapid scene changes
✗ Frame drops, skipped frames, or inconsistent frame timing
✗ Jerky movement, sudden jumps, or motion discontinuity
✗ Frozen frames or static pauses in motion
✗ Any blur, softness, or focus issues
✗ Pixelation, aliasing, or resolution problems
✗ Morphing, warping, or shape distortion
✗ Uncanny valley, AI-generated artifacts
✗ Unnatural human movement or expressions
✗ Watermarks, logos, text, or overlays
✗ Compression artifacts, banding, posterization
✗ Exposure problems (over/under)
✗ Amateur, stock footage, or generic appearance
✗ Camera shake, jitter, or micro-vibrations
✗ Color banding in gradients or skies
✗ Noise or unwanted grain
✗ Cheap, tacky, or low-budget aesthetics
✗ Plastic skin texture or waxy appearance
✗ Temporal flickering or inconsistent lighting between frames
✗ Running, jumping, or any rapid physical actions
✗ Chaotic or busy scenes with multiple moving elements"""

        # ═══════════════════════════════════════════════════════════════
        # 組合三明治結構 (Assemble Sandwich Structure)
        # ═══════════════════════════════════════════════════════════════
        # 最終提示詞 = 前綴 + 用戶內容 + 後綴 + (負面提示詞內嵌)
        
        prompt = f"""{CINEMATIC_PREFIX}

{user_content}

═══════════════════════════════════════════════════════════════
QUALITY ENHANCEMENT (SUFFIX)
═══════════════════════════════════════════════════════════════
{QUALITY_SUFFIX}

═══════════════════════════════════════════════════════════════
STRICTLY AVOID (NEGATIVE PROMPTS EMBEDDED)
═══════════════════════════════════════════════════════════════
{NEGATIVE_MODIFIERS}"""

        print(f"[VideoGenerator] 📝 Veo 三明治架構提示詞 (風格: {personality}):")
        print(f"  → 前綴: Cinematic triggers loaded")
        print(f"  → 內容: {main_subject[:50]}...")
        print(f"  → 後綴: Quality modifiers applied")
        print(f"  → 負面: Anti-artifacts filters enabled")
        
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
        
        # 1. 生成所有場景圖片（優先使用用戶自訂圖片）
        scene_images: List[str] = []
        scene_audios: List[Optional[str]] = []
        
        for i, scene in enumerate(scenes):
            # 檢查是否有用戶自訂圖片
            custom_image = self._custom_images.get(i) if hasattr(self, '_custom_images') else None
            
            # 先獲取場景的通用資料（TTS 等會用到）
            narration = scene.get("narration_text", "")
            
            if custom_image:
                print(f"[VideoGenerator] 🖼️ 場景 {i+1}/{len(scenes)}: 使用用戶自訂圖片")
                # 處理自訂圖片（不添加文字）
                image_base64 = await self._process_custom_image(custom_image, width, height)
                if image_base64:
                    scene_images.append(image_base64)
                else:
                    # 如果自訂圖片處理失敗，回退到 AI 生成
                    print(f"[VideoGenerator] ⚠️ 自訂圖片處理失敗，使用 AI 生成")
                    image_base64 = await self._generate_scene_image_fallback(scene, color_palette, width, height, i, len(scenes))
                    if image_base64:
                        scene_images.append(image_base64)
            else:
                print(f"[VideoGenerator] 📸 生成場景 {i+1}/{len(scenes)}")
                
                visual_prompt = scene.get("visual_prompt", "")
                negative_prompt = scene.get("negative_prompt", "")
                quality_tags = scene.get("quality_tags", "")
                
                # 生成圖片（不添加文字覆蓋，保持畫面乾淨）
                image_base64 = await self._generate_image(
                    visual_prompt,
                    color_palette,
                    width,
                    height,
                    None,  # 不添加文字
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
        
        # 2. 背景音樂處理
        music_url = script.get("music_url")
        music_volume = script.get("music_volume", 0.3)
        music_genre = script.get("music_genre", "upbeat")
        
        # 處理風格選擇模式 (style:xxx) - 從 Mixkit 免費音樂庫獲取
        if music_url and music_url.startswith("style:"):
            style = music_url.replace("style:", "")
            music_genre = style
            music_url = get_music_url_for_style(style)
            print(f"[VideoGenerator] 🎵 風格選擇: {style} -> Mixkit 音樂")
        
        music_path = None
        
        # 優先使用 Mixkit 免費商用音樂
        if music_url and music_url.startswith("http"):
            print(f"[VideoGenerator] 🎵 下載 Mixkit 音樂: {music_url[:60]}...")
            music_path = await self._download_external_music(music_url, project_id)
            if music_path:
                print(f"[VideoGenerator] ✅ Mixkit 音樂下載成功")
            else:
                # 嘗試其他 URL
                fallback_url = get_music_url_for_style(music_genre)
                if fallback_url != music_url:
                    print(f"[VideoGenerator] 🔄 嘗試備用音樂...")
                    music_path = await self._download_external_music(fallback_url, project_id)
        
        # AI 音樂標記（備用）
        if not music_path and music_url and music_url.startswith("ai:"):
            ai_style = music_url.replace("ai:", "")
            print(f"[VideoGenerator] 🎹 使用 AI 生成背景音樂 (風格: {ai_style})")
            music_path = await self._generate_background_music(ai_style, total_duration, project_id)
        
        if not music_path:
            # 最後回退：直接獲取 Mixkit 音樂
            fallback_url = get_music_url_for_style(music_genre)
            print(f"[VideoGenerator] 🎵 使用備用 Mixkit 音樂...")
            music_path = await self._download_external_music(fallback_url, project_id)
        
        if not music_path:
            # 真正的最後回退：AI 生成
            print(f"[VideoGenerator] 🎹 回退到 AI 生成背景音樂 (風格: {music_genre})")
            music_path = await self._generate_background_music(music_genre, total_duration, project_id)
        
        # 3. 使用 FFmpeg 合成影片
        video_path = await self._create_video_ffmpeg(
            scene_images,
            scenes,
            scene_audios,
            music_path,
            project_id,
            width,
            height,
            music_volume
        )
        
        # 4. 處理影片輸出
        video_base64 = None
        video_url = ""
        file_size = 0
        generation_method = "imagen+ffmpeg"
        
        if video_path and os.path.exists(video_path):
            file_size = os.path.getsize(video_path)
            print(f"[VideoGenerator] 🎉 影片合成成功，大小: {file_size / 1024 / 1024:.2f} MB")
            
            # 嘗試上傳到雲端儲存
            try:
                from app.services.cloud_storage import cloud_storage
                if cloud_storage.is_configured():
                    print(f"[VideoGenerator] ☁️ 正在上傳到雲端儲存...")
                    upload_result = cloud_storage.upload_file(
                        file_path=video_path,
                        user_id=0,  # 系統生成，使用 0 作為 user_id
                        file_type="videos",
                        original_filename=f"video_{project_id}.mp4"
                    )
                    if upload_result.get("success"):
                        video_url = upload_result["url"]
                        print(f"[VideoGenerator] ✅ 雲端上傳成功: {video_url}")
                        # 刪除本地檔案
                        try:
                            os.remove(video_path)
                        except:
                            pass
                    else:
                        print(f"[VideoGenerator] ⚠️ 雲端上傳失敗: {upload_result.get('error')}")
                        # 回退到本地儲存
                        video_url = self._save_to_local(video_path, project_id)
                else:
                    print(f"[VideoGenerator] ⚠️ 雲端儲存未設定，使用本地儲存")
                    video_url = self._save_to_local(video_path, project_id)
            except Exception as e:
                print(f"[VideoGenerator] ⚠️ 雲端儲存異常: {e}，使用本地儲存")
                video_url = self._save_to_local(video_path, project_id)
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
        
        # 預設品質標籤 (Premium Quality v3.0 - 強調真實感，去除 AI 感)
        default_quality = """═══ AUTHENTIC QUALITY MARKERS ═══
masterpiece, best quality, ultra high resolution, 8K UHD source,
shot on Hasselblad H6D-400C medium format, ARRI Alexa Mini LF footage,
natural film grain texture, Kodak Vision3 500T film emulation, analog warmth,
authentic lighting imperfections, genuine texture, organic feel,
real-world photography, captured moment, not generated,
human photographer aesthetic, handcrafted composition, intentional imperfections,
true-to-life colors, natural color science, no artificial enhancement,
professional studio but natural look, genuine atmosphere,
editorial magazine quality, luxury brand campaign authenticity,
broadcast ready, advertising standard, real commercial production"""
        
        # 預設負面提示詞 (v3.1 - 首要目標：消除 AI 生成特徵 + 禁止任何文字)
        default_negative = """═══ ZERO TEXT ALLOWED - ABSOLUTE RULE ═══
text, words, letters, alphabet, characters, typography, font,
Chinese characters, 中文, 漢字, 繁體字, 簡體字, Japanese text, Korean text,
any language text, readable text, legible text, numbers, digits,
titles, captions, subtitles, labels, watermark, signature, logo,
brand name, slogan, tagline, quote, signs, banners, posters with text,
text overlay, text on image, written content,

═══ AI ARTIFACTS - MUST ELIMINATE ═══
AI generated, artificial intelligence created, machine generated, synthetic image,
artificial looking, computer generated, CGI appearance, 3D render look,
plastic skin, waxy texture, silicone appearance, mannequin-like,
overly smooth skin, poreless face, airbrushed look, over-retouched,
unnaturally perfect, too clean, too symmetrical, mathematical precision,
uncanny valley, dead eyes, lifeless expression, frozen face,
hyper-saturated colors, over-processed, HDR artifacts, tone-mapped look,
soulless, generic, stock photo aesthetic, template-based,
video game graphics, Unreal Engine render (negative), Unity render,
deepfake appearance, morph artifacts, face swap artifacts,
digital painting look, illustration style when photo needed,

═══ TECHNICAL ISSUES ═══
blurry, out of focus, motion blur, camera shake, soft focus,
pixelated, low resolution, poor quality, degraded, compression artifacts,
distorted, warped, deformed, malformed, bad anatomy,
extra limbs, mutated hands, extra fingers, missing limbs,
cropped awkwardly, cut off, bad framing,
overexposed, underexposed, flat lighting, harsh shadows,
noisy, grainy (unless intentional), jpeg artifacts, banding,
cluttered background, distracting elements,
cheap, tacky, amateur, unprofessional"""
        
        # 合併品質標籤
        final_quality = quality_tags if quality_tags else default_quality
        final_negative = negative_prompt if negative_prompt else default_negative
        
        # 1. 嘗試使用 Imagen
        client = vertexai_client or genai_client
        if client and visual_prompt:
            # 構建專業級增強提示詞 (Premium Quality v2.0)
            enhanced_prompt = f"""═══ VISUAL SUBJECT ═══
{visual_prompt}

═══ AUTHENTICITY DIRECTIVE (CRITICAL) ═══
This must look like a REAL photograph taken by a professional human photographer
NOT AI generated, NOT CGI, NOT 3D render, NOT digital art
Capture authentic moment with natural imperfections
Include subtle film grain, natural lighting variance, organic textures
Real-world physics, genuine materials, authentic atmosphere

═══ ARTISTIC DIRECTION ═══
Premium video frame designed for viral short-form content
Format: {aspect_ratio} vertical, optimized for mobile-first viewing
Aesthetic: Luxury brand commercial shot on location, editorial magazine quality
Style: Natural photography with cinematic color grading
Feel: Handcrafted, intentional, human-directed

═══ CINEMATOGRAPHY ═══
Camera: Shot on ARRI Alexa Mini LF with Cooke S7/i lenses
Composition: Rule of thirds, golden ratio, intentional negative space
Focus: Razor sharp on subject, creamy bokeh background separation
Depth: Shallow depth of field with beautiful anamorphic bokeh
Framing: Perfect {aspect_ratio} composition, professional framing
Movement: Subtle natural camera presence, not sterile

═══ LIGHTING DESIGN ═══
Setup: Professional cinematographer lighting, natural motivated sources
Key light: Soft, flattering, dimensional with natural falloff
Fill light: Subtle shadow detail, not artificially lifted
Rim light: Organic subject-background separation
Quality: Real studio lighting, not computer generated

═══ COLOR SCIENCE ═══
Film stock: Kodak Vision3 500T / Fujifilm Eterna look
Grading: Cinematic film emulation, natural lifted shadows
White balance: Perfect neutral or intentionally warm/cool for mood
Palette: True-to-life colors, not hyper-saturated
Skin tones: Natural, healthy, real human skin texture (not plastic)

═══ TECHNICAL SPECIFICATIONS ═══
Resolution: {width}x{height} pixels, native 4K clarity
Sharpness: Natural sharp, not over-sharpened AI look
Texture: Real film grain, subtle lens characteristics
Dynamic range: Natural tonal range, organic highlight rolloff
Format: Authentic photography aesthetic

═══ QUALITY IMPERATIVES ═══
{final_quality}

═══ EXCLUSIONS (CRITICAL - ESPECIALLY AI ARTIFACTS) ═══
{final_negative}"""
            
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
                            
                            # 不添加文字覆蓋 - 保持畫面乾淨
                            # if text_overlay:
                            #     img = self._add_text_overlay(img, text_overlay, color_palette)
                            
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
        
        # 2. 生成設計圖（不添加文字）
        print(f"[VideoGenerator] 🎨 場景 {scene_num}: 使用設計圖")
        return self._generate_designed_image(color_palette, width, height, None, scene_num, total_scenes)
    
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
        生成純黑色基本設計圖
        
        統一使用純黑背景，簡潔專業
        """
        if not PIL_AVAILABLE:
            return ""
        
        try:
            # 創建純黑圖片
            img = Image.new('RGB', (width, height), color=(0, 0, 0))
            
            print(f"[VideoGenerator] ⬛ 生成純黑設計圖 場景 {scene_num}/{total_scenes} ({width}x{height})")
            
            # 轉換為 base64
            import io
            import base64
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
    
    async def _add_audio_to_video(
        self,
        video_path: str,
        script: Dict[str, Any],
        project_id: str,
        duration: int
    ) -> Optional[str]:
        """
        為影片添加 TTS 旁白和背景音樂
        
        用於 Kling/Veo 等直接生成的影片，它們本身不包含音訊
        """
        try:
            scenes = script.get("scenes", [])
            voice_id = script.get("tts_voice", "zh-TW-HsiaoChenNeural")
            music_url = script.get("music_url")
            music_volume = script.get("music_volume", 0.3)
            
            print(f"[VideoGenerator] 🔍 音訊處理: 場景數={len(scenes)}, 語音={voice_id}")
            print(f"[VideoGenerator] 🔍 音樂設定: URL={music_url}, 音量={music_volume}")
            
            # 1. 生成 TTS 旁白
            tts_audios = []
            total_narration = ""
            for i, scene in enumerate(scenes):
                # 支援多種欄位名稱：narration_text, narration, subtitle_text
                narration = (
                    scene.get("narration_text", "") or 
                    scene.get("narration", "") or 
                    scene.get("subtitle_text", "")
                )
                # 過濾掉佔位符文字
                if narration in ["（無旁白）", "(無旁白)", "（沒有旁白）", "(沒有旁白)", ""]:
                    narration = ""
                print(f"[VideoGenerator] 🔍 場景 {i+1} 旁白: '{narration[:30] if narration else '(無實際旁白)'}...'")
                if narration:
                    total_narration += narration + " "
            
            print(f"[VideoGenerator] 🔍 總旁白長度: {len(total_narration)} 字元, EDGE_TTS={EDGE_TTS_AVAILABLE}")
            
            # 使用完整旁白生成單一 TTS 檔案
            tts_path = None
            if total_narration.strip() and EDGE_TTS_AVAILABLE:
                tts_path = self.output_dir / f"tts_full_{project_id}.mp3"
                try:
                    communicate = edge_tts.Communicate(total_narration.strip(), voice_id)
                    await communicate.save(str(tts_path))
                    print(f"[VideoGenerator] 🎤 TTS 生成完成: {total_narration[:50]}...")
                except Exception as e:
                    print(f"[VideoGenerator] TTS 生成失敗: {e}")
                    tts_path = None
            
            # 2. 背景音樂處理
            music_path = None
            music_genre = script.get("music_genre", "upbeat")
            
            # 優先使用用戶上傳的自訂音樂
            custom_music_base64 = script.get("custom_music_base64") or getattr(self, '_custom_music_base64', None)
            custom_music_name = script.get("custom_music_name") or getattr(self, '_custom_music_name', None)
            
            if custom_music_base64:
                print(f"[VideoGenerator] 🎵 使用用戶自訂音樂: {custom_music_name or '未命名'}")
                try:
                    # 解碼 base64 並保存為臨時檔案
                    import base64
                    music_data = base64.b64decode(custom_music_base64)
                    # 從檔名推斷格式，預設為 mp3
                    ext = "mp3"
                    if custom_music_name:
                        ext = custom_music_name.split('.')[-1].lower()
                        if ext not in ['mp3', 'wav', 'ogg', 'aac', 'm4a']:
                            ext = 'mp3'
                    music_path = self.output_dir / f"custom_music_{project_id}.{ext}"
                    with open(music_path, 'wb') as f:
                        f.write(music_data)
                    print(f"[VideoGenerator] ✅ 自訂音樂已保存: {music_path}, 大小: {len(music_data)} bytes")
                except Exception as e:
                    print(f"[VideoGenerator] ⚠️ 自訂音樂處理失敗: {e}")
                    music_path = None
            
            # 如果沒有自訂音樂，使用預設音樂庫
            if not music_path:
                # 處理風格選擇模式 (style:xxx) - 從 Mixkit 免費音樂庫獲取
                actual_music_url = music_url
                if music_url and music_url.startswith("style:"):
                    style = music_url.replace("style:", "")
                    music_genre = style
                    actual_music_url = get_music_url_for_style(style)
                    print(f"[VideoGenerator] 🎵 風格選擇: {style} -> Mixkit 音樂")
                
                # 優先使用 Mixkit 免費商用音樂
                if actual_music_url and actual_music_url.startswith("http"):
                    print(f"[VideoGenerator] 🎵 下載 Mixkit 音樂...")
                    music_path = await self._download_external_music(actual_music_url, project_id)
                    if music_path:
                        print(f"[VideoGenerator] ✅ Mixkit 音樂下載成功")
                    else:
                        # 嘗試備用
                        fallback_url = get_music_url_for_style(music_genre)
                        if fallback_url != actual_music_url:
                            music_path = await self._download_external_music(fallback_url, project_id)
                
                # AI 音樂標記（備用）
                if not music_path and actual_music_url and actual_music_url.startswith("ai:"):
                    ai_style = actual_music_url.replace("ai:", "")
                    print(f"[VideoGenerator] 🎹 使用 AI 生成背景音樂 (風格: {ai_style})")
                    music_path = await self._generate_background_music(ai_style, duration, project_id)
                
                if not music_path:
                    # 最後回退
                    fallback_url = get_music_url_for_style(music_genre)
                    music_path = await self._download_external_music(fallback_url, project_id)
                
                if not music_path:
                    print(f"[VideoGenerator] 🎹 回退到 AI 生成背景音樂")
                    music_path = await self._generate_background_music(music_genre, duration, project_id)
            
            # 3. 如果沒有音訊，直接返回原影片
            if not tts_path and not music_path:
                print("[VideoGenerator] ⚠️ 沒有可用的音訊，返回原始影片")
                return video_path
            
            # 4. 使用 FFmpeg 合成
            output_path = self.output_dir / f"final_{project_id}.mp4"
            static_dir = Path("/app/static/videos")
            final_path = static_dir / f"final_{project_id}.mp4"
            
            if tts_path and music_path:
                # TTS + 背景音樂（保持原始影片長度）
                cmd = [
                    "ffmpeg", "-y",
                    "-i", video_path,
                    "-i", str(tts_path),
                    "-stream_loop", "-1", "-i", str(music_path),  # 循環播放音樂
                    "-filter_complex",
                    f"[1:a]apad=pad_dur={duration}[tts_padded];[2:a]volume={music_volume}[bgm];[tts_padded][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]",
                    "-map", "0:v:0",
                    "-map", "[aout]",
                    "-c:v", "copy",
                    "-c:a", "aac",
                    "-b:a", "192k",
                    "-t", str(duration),  # 限制輸出長度為原始影片長度
                    str(final_path)
                ]
            elif tts_path:
                # 只有 TTS（用靜音填充至影片長度）
                cmd = [
                    "ffmpeg", "-y",
                    "-i", video_path,
                    "-i", str(tts_path),
                    "-filter_complex", f"[1:a]apad=pad_dur={duration}[aout]",
                    "-map", "0:v:0",
                    "-map", "[aout]",
                    "-c:v", "copy",
                    "-c:a", "aac",
                    "-b:a", "192k",
                    "-t", str(duration),
                    str(final_path)
                ]
            else:
                # 只有背景音樂（循環播放）
                cmd = [
                    "ffmpeg", "-y",
                    "-i", video_path,
                    "-stream_loop", "-1", "-i", str(music_path),  # 循環播放音樂
                    "-filter_complex", f"[1:a]volume={music_volume}[bgm]",
                    "-map", "0:v:0",
                    "-map", "[bgm]",
                    "-c:v", "copy",
                    "-c:a", "aac",
                    "-b:a", "192k",
                    "-t", str(duration),  # 限制輸出長度
                    str(final_path)
                ]
            
            print(f"[VideoGenerator] 🎬 FFmpeg 合成音訊...")
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                print(f"[VideoGenerator] ❌ FFmpeg 錯誤: {stderr.decode()[:500]}")
                return video_path
            
            # 清理臨時檔案
            try:
                if tts_path and os.path.exists(tts_path):
                    os.remove(tts_path)
                if music_path and os.path.exists(music_path):
                    os.remove(music_path)
            except:
                pass
            
            print(f"[VideoGenerator] ✅ 音訊合成完成")
            return str(final_path)
            
        except Exception as e:
            print(f"[VideoGenerator] ❌ 音訊添加失敗: {e}")
            import traceback
            traceback.print_exc()
            return video_path
    
    def _save_to_local(self, video_path: str, project_id: str) -> str:
        """保存影片到本地靜態目錄"""
        import shutil
        static_dir = Path("/app/static/videos")
        static_dir.mkdir(parents=True, exist_ok=True)
        
        video_filename = f"video_{project_id}.mp4"
        static_path = static_dir / video_filename
        
        shutil.move(video_path, static_path)
        print(f"[VideoGenerator] 📁 影片已保存: {static_path}")
        
        return f"/video/download/{video_filename}"
    
    async def _download_external_music(
        self,
        music_url: str,
        project_id: str
    ) -> Optional[str]:
        """
        下載外部音樂檔案（Pixabay 等免費資源）
        """
        try:
            import aiohttp
            
            music_path = self.output_dir / f"bgm_ext_{project_id}.mp3"
            
            # 添加瀏覽器標頭以繞過防盜鏈
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "audio/mpeg, audio/*, */*",
                "Accept-Language": "en-US,en;q=0.9,zh-TW;q=0.8,zh;q=0.7",
                "Referer": "https://pixabay.com/",
                "Origin": "https://pixabay.com",
            }
            
            async with aiohttp.ClientSession(headers=headers) as session:
                async with session.get(music_url, timeout=aiohttp.ClientTimeout(total=60)) as response:
                    if response.status == 200:
                        content = await response.read()
                        with open(music_path, 'wb') as f:
                            f.write(content)
                        print(f"[VideoGenerator] 🎵 外部音樂下載完成: {len(content) / 1024:.1f} KB")
                        return str(music_path)
                    else:
                        print(f"[VideoGenerator] 外部音樂下載失敗: HTTP {response.status}")
                        # 嘗試備用方法：使用 httpx
                        return await self._download_music_httpx(music_url, project_id)
                        
        except Exception as e:
            print(f"[VideoGenerator] 外部音樂下載錯誤: {e}")
            # 嘗試備用方法
            return await self._download_music_httpx(music_url, project_id)
    
    async def _download_music_httpx(
        self,
        music_url: str,
        project_id: str
    ) -> Optional[str]:
        """
        備用下載方法：使用 httpx
        """
        try:
            import httpx
            
            music_path = self.output_dir / f"bgm_ext_{project_id}.mp3"
            
            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "*/*",
                "Referer": "https://pixabay.com/",
            }
            
            async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
                response = await client.get(music_url, headers=headers)
                if response.status_code == 200:
                    with open(music_path, 'wb') as f:
                        f.write(response.content)
                    print(f"[VideoGenerator] 🎵 外部音樂下載完成 (httpx): {len(response.content) / 1024:.1f} KB")
                    return str(music_path)
                else:
                    print(f"[VideoGenerator] httpx 下載失敗: HTTP {response.status_code}")
                    return None
                    
        except Exception as e:
            print(f"[VideoGenerator] httpx 下載錯誤: {e}")
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
        height: int,
        music_volume: float = 0.3
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
                
                # 豐富的轉場效果庫 - 20+ 種專業過場
                TRANSITION_EFFECTS = [
                    # 基礎淡化
                    "fade",           # 交叉淡化
                    "fadeblack",      # 淡入黑色
                    "fadewhite",      # 淡入白色
                    "fadegrays",      # 淡入灰階
                    # 滑動效果
                    "slideleft",      # 左滑
                    "slideright",     # 右滑
                    "slideup",        # 上滑
                    "slidedown",      # 下滑
                    # 擦除效果
                    "wipeleft",       # 左擦除
                    "wiperight",      # 右擦除
                    "wipeup",         # 上擦除
                    "wipedown",       # 下擦除
                    # 幾何效果
                    "circlecrop",     # 圓形裁切
                    "circleopen",     # 圓形展開
                    "circleclose",    # 圓形收縮
                    "rectcrop",       # 矩形裁切
                    "diagtl",         # 對角線（左上）
                    "diagtr",         # 對角線（右上）
                    "diagbl",         # 對角線（左下）
                    "diagbr",         # 對角線（右下）
                    # 特殊效果
                    "dissolve",       # 溶解
                    "pixelize",       # 像素化
                    "radial",         # 徑向
                    "horzopen",       # 水平展開
                    "horzclose",      # 水平收縮
                    "vertopen",       # 垂直展開
                    "vertclose",      # 垂直收縮
                    "smoothleft",     # 平滑左滑
                    "smoothright",    # 平滑右滑
                    "smoothup",       # 平滑上滑
                    "smoothdown",     # 平滑下滑
                ]
                
                import random
                # 隨機打亂轉場效果順序，增加變化性
                shuffled_transitions = TRANSITION_EFFECTS.copy()
                random.shuffle(shuffled_transitions)
                
                for i in range(len(segment_files) - 1):
                    next_label = f"[{i+1}:v]"
                    output_label = f"[v{i}]" if i < len(segment_files) - 2 else "[vout]"
                    offset = offsets[i]
                    
                    # 使用隨機選擇的轉場效果
                    transition_type = shuffled_transitions[i % len(shuffled_transitions)]
                    
                    filter_complex.append(
                        f"{prev_label}{next_label}xfade=transition={transition_type}:duration={TRANSITION_DURATION}:offset={offset}{output_label}"
                    )
                    prev_label = output_label
                    
                    print(f"[VideoGenerator] 🎬 場景 {i+1}→{i+2} 轉場: {transition_type}")
                
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
                print(f"[VideoGenerator] 🎵 混音: 背景音樂音量={music_volume}")
                if tts_combined and os.path.exists(tts_combined):
                    # 混合 TTS + 背景音樂
                    cmd = [
                        "ffmpeg", "-y",
                        "-i", str(merged_video),
                        "-i", str(tts_combined),
                        "-i", music_path,
                        "-filter_complex",
                        f"[1:a]volume=1.2[tts];[2:a]volume={music_volume}[bgm];[tts][bgm]amix=inputs=2:duration=longest[aout]",
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
                        "-filter_complex", f"[1:a]volume={music_volume}[bgm]",
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
    
    async def add_subtitles_to_video(
        self,
        video_path: str,
        subtitles: List[Dict[str, Any]],
        output_path: Optional[str] = None,
        font_size: int = 48,
        font_color: str = "white",
        outline_color: str = "black",
        outline_width: int = 3,
        position: str = "bottom",  # bottom, center, top
        margin_bottom: int = 80
    ) -> Optional[str]:
        """
        在影片上疊加動態字幕（硬字幕/燒錄字幕）
        
        Args:
            video_path: 輸入影片路徑
            subtitles: 字幕資料列表 [{"text": "...", "start": 0.0, "end": 3.0}, ...]
            output_path: 輸出路徑（不指定則覆蓋原檔）
            font_size: 字型大小
            font_color: 字型顏色
            outline_color: 描邊顏色
            outline_width: 描邊寬度
            position: 字幕位置
            margin_bottom: 底部邊距
        
        Returns:
            輸出影片路徑
        """
        if not subtitles:
            return video_path
        
        try:
            # 生成 SRT 檔案
            srt_path = self.output_dir / f"subtitles_{uuid.uuid4()}.srt"
            self._generate_srt_file(subtitles, str(srt_path))
            
            # 設定輸出路徑
            if not output_path:
                output_path = str(self.output_dir / f"subtitled_{uuid.uuid4()}.mp4")
            
            # 計算字幕位置
            if position == "bottom":
                y_position = f"h-{margin_bottom}-text_h"
            elif position == "center":
                y_position = "(h-text_h)/2"
            else:  # top
                y_position = f"{margin_bottom}"
            
            # 構建 FFmpeg 字幕濾鏡
            # 使用 subtitles 濾鏡（支援 SRT 格式）
            # 字型設定：使用思源黑體或系統中文字型
            srt_path_escaped = str(srt_path).replace(":", "\\:")
            subtitle_filter = (
                f"subtitles={srt_path_escaped}:"
                f"force_style='FontSize={font_size},"
                f"FontName=Noto Sans CJK TC,"
                f"PrimaryColour=&H00FFFFFF,"  # AABBGGRR 格式，白色
                f"OutlineColour=&H00000000,"  # 黑色描邊
                f"BorderStyle=3,"
                f"Outline={outline_width},"
                f"Shadow=1,"
                f"MarginV={margin_bottom},"
                f"Alignment=2'"  # 2=底部居中
            )
            
            cmd = [
                "ffmpeg", "-y",
                "-i", video_path,
                "-vf", subtitle_filter,
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "20",
                "-c:a", "copy",
                output_path
            ]
            
            print(f"[VideoGenerator] 📝 正在疊加字幕...")
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            
            # 清理 SRT 檔案
            if srt_path.exists():
                os.remove(srt_path)
            
            if process.returncode != 0:
                print(f"[VideoGenerator] 字幕疊加失敗: {stderr.decode()[:300]}")
                # 嘗試使用 drawtext 作為備選方案
                return await self._add_subtitles_drawtext(
                    video_path, subtitles, output_path, 
                    font_size, font_color, outline_color, outline_width, margin_bottom
                )
            
            if os.path.exists(output_path):
                print(f"[VideoGenerator] ✅ 字幕疊加成功")
                return output_path
            
            return video_path
            
        except Exception as e:
            print(f"[VideoGenerator] 字幕疊加錯誤: {e}")
            return video_path
    
    async def _add_subtitles_drawtext(
        self,
        video_path: str,
        subtitles: List[Dict[str, Any]],
        output_path: str,
        font_size: int,
        font_color: str,
        outline_color: str,
        outline_width: int,
        margin_bottom: int
    ) -> Optional[str]:
        """
        使用 drawtext 濾鏡疊加字幕（備選方案）
        """
        try:
            # 構建 drawtext 濾鏡鏈
            filter_parts = []
            
            for sub in subtitles:
                text = sub.get("text", "").replace("'", r"\'").replace(":", r"\:")
                start = sub.get("start", 0)
                end = sub.get("end", start + 3)
                
                # drawtext 濾鏡參數
                filter_parts.append(
                    f"drawtext=text='{text}':"
                    f"fontsize={font_size}:"
                    f"fontcolor={font_color}:"
                    f"borderw={outline_width}:"
                    f"bordercolor={outline_color}:"
                    f"x=(w-text_w)/2:"
                    f"y=h-{margin_bottom}-text_h:"
                    f"enable='between(t,{start},{end})'"
                )
            
            filter_str = ",".join(filter_parts)
            
            cmd = [
                "ffmpeg", "-y",
                "-i", video_path,
                "-vf", filter_str,
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "20",
                "-c:a", "copy",
                output_path
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await process.communicate()
            
            if os.path.exists(output_path):
                return output_path
            
            return video_path
            
        except Exception as e:
            print(f"[VideoGenerator] drawtext 字幕失敗: {e}")
            return video_path
    
    def _generate_srt_file(
        self,
        subtitles: List[Dict[str, Any]],
        output_path: str
    ):
        """
        生成 SRT 字幕檔案
        """
        srt_content = []
        
        for i, sub in enumerate(subtitles):
            text = sub.get("text", "")
            start = sub.get("start", 0)
            end = sub.get("end", start + 3)
            
            # 格式化時間戳
            start_time = self._format_srt_timestamp(start)
            end_time = self._format_srt_timestamp(end)
            
            srt_content.append(f"{i + 1}")
            srt_content.append(f"{start_time} --> {end_time}")
            srt_content.append(text)
            srt_content.append("")
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(srt_content))
    
    def _format_srt_timestamp(self, seconds: float) -> str:
        """格式化 SRT 時間戳"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"
    
    def _hex_to_rgb(self, hex_color: str) -> tuple:
        """HEX 轉 RGB"""
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    
    async def _process_custom_image(
        self,
        image_input: str,
        width: int,
        height: int
    ) -> Optional[str]:
        """
        處理用戶自訂圖片（不添加任何文字覆蓋）
        
        image_input: Base64 圖片資料或 URL
        返回處理後的 Base64 圖片
        """
        try:
            if not PIL_AVAILABLE:
                print("[VideoGenerator] PIL 不可用，無法處理自訂圖片")
                return None
            
            # 解析圖片資料
            if image_input.startswith("data:image"):
                # Base64 格式
                header, data = image_input.split(",", 1)
                image_bytes = base64.b64decode(data)
            elif image_input.startswith("/upload/"):
                # 本地上傳的 URL
                file_path = f"/app/static{image_input.replace('/upload/', '/uploads/')}"
                if not os.path.exists(file_path):
                    # 嘗試場景圖片路徑
                    file_path = f"/app/static/uploads/scenes/{image_input.split('/')[-1]}"
                
                if os.path.exists(file_path):
                    with open(file_path, "rb") as f:
                        image_bytes = f.read()
                else:
                    print(f"[VideoGenerator] 找不到圖片: {image_input}")
                    return None
            elif image_input.startswith("http"):
                # 遠端 URL（未來可支援）
                print("[VideoGenerator] 暫不支援遠端 URL")
                return None
            else:
                # 假設是純 Base64
                try:
                    image_bytes = base64.b64decode(image_input)
                except:
                    print("[VideoGenerator] 無法解析圖片資料")
                    return None
            
            # 開啟並處理圖片
            img = Image.open(io.BytesIO(image_bytes))
            
            # 轉換為 RGB（處理 RGBA 或其他模式）
            if img.mode != "RGB":
                img = img.convert("RGB")
            
            # 調整尺寸以符合目標格式
            img = self._resize_image(img, width, height)
            
            # 不添加任何文字覆蓋 - 保持畫面乾淨
            
            # 轉換為 Base64
            buffer = io.BytesIO()
            img.save(buffer, format="PNG", quality=95)
            base64_data = base64.b64encode(buffer.getvalue()).decode()
            
            print(f"[VideoGenerator] ✓ 自訂圖片處理成功 ({width}x{height})")
            return f"data:image/png;base64,{base64_data}"
            
        except Exception as e:
            print(f"[VideoGenerator] 自訂圖片處理錯誤: {e}")
            return None
    
    async def _generate_scene_image_fallback(
        self,
        scene: Dict[str, Any],
        color_palette: List[str],
        width: int,
        height: int,
        scene_index: int,
        total_scenes: int
    ) -> Optional[str]:
        """場景圖片生成的備用方法（不添加文字）"""
        visual_prompt = scene.get("visual_prompt", "")
        negative_prompt = scene.get("negative_prompt", "")
        quality_tags = scene.get("quality_tags", "")
        
        return await self._generate_image(
            visual_prompt,
            color_palette,
            width,
            height,
            None,  # 不添加文字覆蓋
            scene_index + 1,
            total_scenes,
            negative_prompt,
            quality_tags
        )


# 單例實例
video_generator = VideoGeneratorService()
