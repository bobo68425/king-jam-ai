"""
OpenAI TTS 配音服務 (tts-1-hd)
=================================
整合 OpenAI Text-to-Speech API
支援 word-level 時間戳以實現字幕對齊
"""

import os
import logging
import tempfile
import json
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# OPENAI_API_KEY 移到函數內動態獲取，避免模組載入時就固定

# 語音選項
VOICES = {
    "alloy": "中性、溫暖",
    "echo": "男性、穩重",
    "fable": "英式、故事感",
    "onyx": "男性、深沉",
    "nova": "女性、活潑",
    "shimmer": "女性、柔和",
}

# 語速映射
SPEED_MAP = {
    "slow": 0.8,
    "normal": 1.0,
    "fast": 1.2,
    "very_fast": 1.5,
}


@dataclass
class TTSTimestamp:
    """單字時間戳"""
    word: str
    start: float  # 秒
    end: float    # 秒


@dataclass 
class TTSResult:
    """TTS 生成結果"""
    audio_path: str
    audio_url: Optional[str]
    duration: float
    timestamps: List[TTSTimestamp]
    voice: str
    model: str


def timestamps_to_subtitle_cues(
    timestamps: List[TTSTimestamp],
    fps: int = 30,
    max_chars_per_cue: int = 20,
) -> List[Dict[str, Any]]:
    """
    將 word-level timestamps 轉換為 Remotion SubtitleCue 格式
    
    邏輯：
    1. 按句子/標點斷句
    2. 合併短句，確保每條字幕不超過 max_chars
    3. 轉換秒數為 frame number
    
    Returns:
        [{ "text": str, "startFrame": int, "endFrame": int }]
    """
    if not timestamps:
        return []
    
    cues: List[Dict[str, Any]] = []
    current_words: List[str] = []
    current_start: Optional[float] = None
    current_end: float = 0
    
    punctuation = set("。！？，；：、,.!?;:")
    
    for ts in timestamps:
        word = ts.word.strip()
        if not word:
            continue
        
        if current_start is None:
            current_start = ts.start
        
        current_words.append(word)
        current_end = ts.end
        
        # 斷句邏輯
        text_so_far = "".join(current_words)
        should_break = (
            len(text_so_far) >= max_chars_per_cue
            or any(c in punctuation for c in word)
        )
        
        if should_break and current_start is not None:
            cues.append({
                "text": text_so_far,
                "startFrame": int(current_start * fps),
                "endFrame": int(current_end * fps) + int(fps * 0.3),  # 多顯示 0.3 秒
            })
            current_words = []
            current_start = None
    
    # 處理剩餘文字
    if current_words and current_start is not None:
        cues.append({
            "text": "".join(current_words),
            "startFrame": int(current_start * fps),
            "endFrame": int(current_end * fps) + int(fps * 0.5),
        })
    
    return cues


async def generate_tts_with_timestamps(
    text: str,
    voice: str = "alloy",
    model: str = "tts-1-hd",
    speed: str = "normal",
    response_format: str = "mp3",
) -> TTSResult:
    """
    使用 OpenAI TTS-1-HD 生成配音 + 時間戳
    
    流程：
    1. 調用 OpenAI TTS API (帶 timestamps)
    2. 保存音頻文件
    3. 解析 word-level timestamps
    4. 返回 TTSResult
    
    Args:
        text: 要朗讀的文本
        voice: 語音 (alloy/echo/fable/onyx/nova/shimmer)
        model: 模型 (tts-1 / tts-1-hd)
        speed: 語速 (slow/normal/fast/very_fast)
        response_format: 音頻格式 (mp3/opus/aac/flac)
    
    Returns:
        TTSResult with audio path and timestamps
    """
    import httpx
    
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not openai_key:
        raise ValueError("OPENAI_API_KEY 環境變數未設定")
    
    actual_speed = SPEED_MAP.get(speed, 1.0)
    
    # 方法 1: 使用 OpenAI API 直接生成音頻
    headers = {
        "Authorization": f"Bearer {openai_key}",
        "Content-Type": "application/json",
    }
    
    payload = {
        "model": model,
        "input": text,
        "voice": voice,
        "speed": actual_speed,
        "response_format": response_format,
    }
    
    audio_path = ""
    timestamps: List[TTSTimestamp] = []
    duration = 0.0
    
    # 生成音頻
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.openai.com/v1/audio/speech",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        
        # 保存音頻
        suffix = f".{response_format}"
        with tempfile.NamedTemporaryFile(
            delete=False, suffix=suffix, prefix="tts_"
        ) as f:
            f.write(response.content)
            audio_path = f.name
        
        logger.info(f"[TTS] 音頻已保存: {audio_path} ({len(response.content)} bytes)")
    
    # 方法 2: 使用 Whisper 獲取時間戳 (回傳用)
    # OpenAI TTS 目前不直接返回時間戳,
    # 使用文字長度和語速估算
    timestamps = _estimate_timestamps(text, actual_speed)
    
    # 估算總時長 (基於中文語速)
    chars_per_second = 4.5 * actual_speed  # 中文約 4.5 字/秒
    duration = len(text.replace(" ", "").replace("\n", "")) / chars_per_second
    
    logger.info(f"[TTS] 生成完成: voice={voice}, duration={duration:.1f}s, timestamps={len(timestamps)}")
    
    return TTSResult(
        audio_path=audio_path,
        audio_url=None,  # 上傳後再填入
        duration=duration,
        timestamps=timestamps,
        voice=voice,
        model=model,
    )


def _estimate_timestamps(text: str, speed: float = 1.0) -> List[TTSTimestamp]:
    """
    基於文字內容估算時間戳
    
    中文: ~4.5 字/秒 (正常語速)
    英文: ~3 words/秒
    
    標點符號會產生自然停頓
    """
    chars_per_second = 4.5 * speed
    pause_chars = set("。！？，；：、,.!?;:…")
    
    timestamps: List[TTSTimestamp] = []
    current_time = 0.2  # 開頭留白
    
    for char in text:
        if char.strip() == "":
            continue
        
        # 計算字元持續時間
        if char in pause_chars:
            char_duration = 0.3 / speed  # 標點停頓
        elif ord(char) < 128:
            # ASCII 字符
            char_duration = 0.1 / speed
        else:
            # 中文字
            char_duration = 1.0 / chars_per_second
        
        timestamps.append(TTSTimestamp(
            word=char,
            start=round(current_time, 3),
            end=round(current_time + char_duration, 3),
        ))
        
        current_time += char_duration
    
    return timestamps


async def upload_tts_audio(audio_path: str) -> Optional[str]:
    """
    上傳 TTS 音頻到雲端儲存
    
    Returns:
        公開訪問的 URL，或 None
    """
    try:
        from app.services.cloud_storage import cloud_storage
        if cloud_storage.is_configured():
            result = cloud_storage.upload_file(
                file_path=audio_path,
                user_id=0,
                file_type="audio",
                original_filename=os.path.basename(audio_path),
            )
            if result.get("success"):
                return result.get("url")
            else:
                logger.error(f"[TTS] 雲端上傳失敗回傳錯誤: {result.get('error')}")
                raise Exception(f"雲端空間拒絕上傳: {result.get('error')}")
        else:
            raise Exception("尚未設定雲端空間 (Cloud Storage 未配置)")
    except Exception as e:
        logger.warning(f"[TTS] 音頻上傳失敗: {e}")
        raise
