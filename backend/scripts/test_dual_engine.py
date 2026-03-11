"""
測試影片生成 v3.0 - LTX-2.3 引擎
"""
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
from app.services.video_v3.ltx_service import generate_scene_clip as ltx_generate

async def test_ltx_fast():
    print("Testing LTX-2.3 Fast Engine...")
    try:
        res = await ltx_generate(
            prompt="A majestic eagle soaring through clouds at sunset, 4k cinematic",
            duration=5,
            aspect_ratio="16:9",
            model_preference="auto"
        )
        print(f"LTX-2.3 Fast Result: {res}")
    except Exception as e:
        print(f"LTX-2.3 Fast Error: {e}")

async def test_ltx_pro():
    print("Testing LTX-2.3 Pro Engine...")
    try:
        res = await ltx_generate(
            prompt="A majestic eagle soaring through clouds at sunset, 4k cinematic",
            duration=5,
            aspect_ratio="16:9",
            model_preference="ltx-2.3-pro",
            quality="1080p"
        )
        print(f"LTX-2.3 Pro Result: {res}")
    except Exception as e:
        print(f"LTX-2.3 Pro Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_ltx_fast())
    asyncio.run(test_ltx_pro())
