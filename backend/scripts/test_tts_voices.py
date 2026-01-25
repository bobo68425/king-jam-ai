#!/usr/bin/env python3
"""
測試 Edge TTS 語音可用性 - 快速版本
"""
import asyncio

try:
    import edge_tts
except ImportError:
    print("請先安裝: pip install edge-tts")
    exit(1)

# 要測試的語音
VOICES = [
    # 繁體中文
    ("zh-TW-HsiaoChenNeural", "曉臻"),
    ("zh-TW-YunJheNeural", "雲哲"),
    ("zh-TW-HsiaoYuNeural", "曉雨"),
    
    # 簡體中文 - 主要語音
    ("zh-CN-XiaoxiaoNeural", "曉曉"),
    ("zh-CN-YunyangNeural", "雲揚"),
    ("zh-CN-XiaoyiNeural", "曉伊"),
    ("zh-CN-YunjianNeural", "雲健"),
    
    # 簡體中文 - 可能有問題的語音
    ("zh-CN-XiaochenNeural", "曉辰"),  # 可能不存在
    ("zh-CN-XiaohanNeural", "曉涵"),   # 可能需要不同 ID
    ("zh-CN-XiaomoNeural", "曉墨"),    # 可能需要不同 ID
    
    # 嘗試其他可能的 ID
    ("zh-CN-XiaoshuangNeural", "曉爽"),
    ("zh-CN-XiaoruiNeural", "曉睿"),
    ("zh-CN-XiaoxuanNeural", "曉萱"),
    ("zh-CN-YunxiNeural", "雲希"),
    ("zh-CN-YunzeNeural", "雲澤"),
    
    # 粵語
    ("zh-HK-HiuMaanNeural", "曉曼"),
    ("zh-HK-WanLungNeural", "雲龍"),
    ("zh-HK-HiuGaaiNeural", "曉佳"),
    
    # 英文
    ("en-US-JennyNeural", "Jenny"),
    ("en-US-GuyNeural", "Guy"),
    
    # 日文
    ("ja-JP-NanamiNeural", "七海"),
    ("ja-JP-KeitaNeural", "慶太"),
    
    # 韓文
    ("ko-KR-SunHiNeural", "선희"),
    ("ko-KR-InJoonNeural", "인준"),
]

async def test_voice(voice_id: str, name: str) -> tuple:
    """測試單個語音"""
    try:
        text = "測試" if "zh" in voice_id else "Test"
        communicate = edge_tts.Communicate(text, voice_id)
        
        audio_data = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]
                if len(audio_data) > 500:
                    return (voice_id, name, True, None)
        
        if len(audio_data) > 0:
            return (voice_id, name, True, None)
        return (voice_id, name, False, "無音頻數據")
    except Exception as e:
        return (voice_id, name, False, str(e)[:50])

async def main():
    print("=" * 70)
    print("Edge TTS 語音可用性測試")
    print("=" * 70)
    
    results = await asyncio.gather(*[test_voice(v, n) for v, n in VOICES])
    
    available = []
    unavailable = []
    
    for voice_id, name, success, error in results:
        if success:
            available.append((voice_id, name))
            print(f"✅ {voice_id} - {name}")
        else:
            unavailable.append((voice_id, name, error))
            print(f"❌ {voice_id} - {name}: {error}")
    
    print()
    print("=" * 70)
    print(f"✅ 可用: {len(available)}")
    print(f"❌ 不可用: {len(unavailable)}")
    print("=" * 70)
    
    if unavailable:
        print("\n不可用的語音:")
        for v, n, e in unavailable:
            print(f"  - {v} ({n}): {e}")
    
    print("\n可用的語音 ID 列表 (複製到配置):")
    print("=" * 70)
    for v, n in available:
        print(f'  "{v}": {{"name": "{n}", "gender": "...", "style": "..."}},')

if __name__ == "__main__":
    asyncio.run(main())
