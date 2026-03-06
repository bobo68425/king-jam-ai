"""
測試影片隨機生成模組 v3.0 - LTX/Fal 雙引擎
"""
import sys
import os

# 確保可導入 app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
from app.services.video_v3.ltx_service import generate_scene_clip as ltx_generate
from app.services.video_v3.fal_service import generate_scene_clip as fal_generate

async def test_ltx():
    print("Testing LTX-2 Engine...")
    try:
        res = await ltx_generate(
            prompt="A majestic eagle soaring through clouds at sunset, 4k cinematic",
            duration=5,
            aspect_ratio="16:9",
            model_preference="ltx-2"
        )
        print(f"LTX Result: {res}")
    except Exception as e:
        print(f"LTX Error: {e}")

async def test_fal():
    print("Testing Fal AI Fallback Engine...")
    try:
        res = await fal_generate(
            prompt="A majestic eagle soaring through clouds at sunset, 4k cinematic",
            duration=5,
            aspect_ratio="16:9",
            model_preference="kling"
        )
        print(f"Fal Result: {res}")
    except Exception as e:
        print(f"Fal Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_ltx())
    asyncio.run(test_fal())
