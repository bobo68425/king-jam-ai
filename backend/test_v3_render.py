import asyncio
import httpx
import json
import uuid

# Compliant props for video-engine (Remotion)
TEST_PROPS = {
    "script": {
        "projectId": f"test-{uuid.uuid4().hex[:4]}",
        "title": "V3 Schema Test",
        "description": "Verifying the Remotion server schema mapping",
        "totalDurationInFrames": 150,
        "fps": 30,
        "width": 1080,
        "height": 1920,
        "aspectRatio": "9:16"
    },
    "scenes": [
        {
            "index": 0,
            "type": "hook",
            "durationInFrames": 150,
            "narration": "This is a schema compliant test.",
            "visualPrompt": "A futuristic city with flying cars",
            "videoUrl": "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4",
            "transition": "fade"
        }
    ],
    "musicVolume": 0.3
}

async def test_render():
    engine_url = "http://video-engine:8080/render"
    print(f"Testing video-engine at {engine_url}...")
    
    payload = {
        "props": TEST_PROPS,
        "outputFormat": "mp4",
        "quality": "medium"
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(engine_url, json=payload)
            print(f"Response Status: {resp.status_code}")
            if resp.status_code == 200:
                print("Job Submitted Successfully!")
                print(json.dumps(resp.json(), indent=2))
            else:
                print(f"Error: {resp.text}")
    except Exception as e:
        print(f"Connection Failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_render())
