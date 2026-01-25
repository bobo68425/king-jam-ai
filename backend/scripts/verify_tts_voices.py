#!/usr/bin/env python3
"""
驗證 Edge TTS 語音可用性
執行: python scripts/verify_tts_voices.py
"""

import asyncio
import sys

# 嘗試導入 edge-tts
try:
    import edge_tts
    EDGE_TTS_AVAILABLE = True
except ImportError:
    EDGE_TTS_AVAILABLE = False
    print("❌ edge-tts 未安裝，請執行: pip install edge-tts")
    sys.exit(1)


# 要驗證的語音列表（與前端配置一致）
VOICES_TO_VERIFY = [
    # 繁體中文（台灣）
    ("zh-TW-HsiaoChenNeural", "曉臻（女）", "你好，我是曉臻，這是測試語音。"),
    ("zh-TW-YunJheNeural", "雲哲（男）", "你好，我是雲哲，這是測試語音。"),
    ("zh-TW-HsiaoYuNeural", "曉雨（女）", "你好，我是曉雨，這是測試語音。"),
    
    # 簡體中文
    ("zh-CN-XiaoxiaoNeural", "曉曉（女）", "你好，我是晓晓，这是测试语音。"),
    ("zh-CN-YunyangNeural", "雲揚（男）", "你好，我是云扬，这是测试语音。"),
    ("zh-CN-XiaoyiNeural", "曉伊（女）", "你好，我是晓伊，这是测试语音。"),
    ("zh-CN-YunjianNeural", "雲健（男）", "你好，我是云健，这是测试语音。"),
    ("zh-CN-XiaochenNeural", "曉辰（女）", "你好，我是晓辰，这是测试语音。"),
    ("zh-CN-XiaohanNeural", "曉涵（女）", "你好，我是晓涵，这是测试语音。"),
    ("zh-CN-XiaomoNeural", "曉墨（女）", "你好，我是晓墨，这是测试语音。"),
    
    # 粵語（香港）
    ("zh-HK-HiuMaanNeural", "曉曼（女）", "你好，我係曉曼，呢個係測試語音。"),
    ("zh-HK-WanLungNeural", "雲龍（男）", "你好，我係雲龍，呢個係測試語音。"),
    ("zh-HK-HiuGaaiNeural", "曉佳（女）", "你好，我係曉佳，呢個係測試語音。"),
    
    # 英文
    ("en-US-JennyNeural", "Jenny（女）", "Hello, I'm Jenny. This is a test voice."),
    ("en-US-GuyNeural", "Guy（男）", "Hello, I'm Guy. This is a test voice."),
    ("en-US-AriaNeural", "Aria（女）", "Hello, I'm Aria. This is a test voice."),
    ("en-GB-SoniaNeural", "Sonia（女）", "Hello, I'm Sonia. This is a test voice."),
    ("en-GB-RyanNeural", "Ryan（男）", "Hello, I'm Ryan. This is a test voice."),
    
    # 日文
    ("ja-JP-NanamiNeural", "七海（女）", "こんにちは、七海です。テスト音声です。"),
    ("ja-JP-KeitaNeural", "慶太（男）", "こんにちは、慶太です。テスト音声です。"),
    
    # 韓文
    ("ko-KR-SunHiNeural", "선희（女）", "안녕하세요, 선희입니다. 테스트 음성입니다."),
    ("ko-KR-InJoonNeural", "인준（男）", "안녕하세요, 인준입니다. 테스트 음성입니다."),
]


async def verify_voice(voice_id: str, name: str, test_text: str) -> dict:
    """驗證單個語音是否可用"""
    try:
        communicate = edge_tts.Communicate(test_text, voice_id)
        
        # 只需要驗證能否生成，不需要保存檔案
        audio_data = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]
                if len(audio_data) > 1000:  # 獲取一些數據即可
                    break
        
        if len(audio_data) > 0:
            return {
                "voice_id": voice_id,
                "name": name,
                "status": "✅ 可用",
                "available": True
            }
        else:
            return {
                "voice_id": voice_id,
                "name": name,
                "status": "⚠️ 無數據",
                "available": False
            }
    except Exception as e:
        return {
            "voice_id": voice_id,
            "name": name,
            "status": f"❌ 錯誤: {str(e)[:50]}",
            "available": False
        }


async def main():
    print("=" * 60)
    print("Edge TTS 語音可用性驗證")
    print("=" * 60)
    print()
    
    results = []
    available_count = 0
    
    for voice_id, name, test_text in VOICES_TO_VERIFY:
        result = await verify_voice(voice_id, name, test_text)
        results.append(result)
        if result["available"]:
            available_count += 1
        print(f"{result['status']} {voice_id} - {name}")
    
    print()
    print("=" * 60)
    print(f"總計: {len(results)} 個語音")
    print(f"可用: {available_count} 個")
    print(f"不可用: {len(results) - available_count} 個")
    print("=" * 60)
    
    # 列出不可用的語音
    unavailable = [r for r in results if not r["available"]]
    if unavailable:
        print("\n❌ 不可用的語音:")
        for r in unavailable:
            print(f"  - {r['voice_id']}: {r['status']}")
    else:
        print("\n✅ 所有語音都可用！")
    
    return len(unavailable) == 0


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
