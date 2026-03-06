import os
import torch
import tempfile
from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel
from typing import Optional

# Setup diffusers and LTX-Video
from diffusers import LTXImageToVideoPipeline, LTXPipeline
from diffusers.utils import export_to_video, load_image

app = FastAPI(title="King Jam AI - LTX Inference Server")

# Pre-load models into memory/GPU on startup
device = "cuda" if torch.cuda.is_available() else "cpu"
dtype = torch.bfloat16 if torch.cuda.is_available() else torch.float32

print(f"Loading LTX models onto {device}...")

try:
    # 預載文字生成影片模型
    t2v_pipe = LTXPipeline.from_pretrained(
        "Lightricks/LTX-Video", 
        torch_dtype=dtype
    )
    t2v_pipe.to(device)

    # 預載圖片生成影片模型
    i2v_pipe = LTXImageToVideoPipeline.from_pretrained(
        "Lightricks/LTX-Video", 
        torch_dtype=dtype
    )
    i2v_pipe.to(device)
    
    print("Models loaded successfully.")
except Exception as e:
    print(f"Error loading models: {e}")
    # In a real startup script we might exit, but for Cloud Run this ensures the server starts
    t2v_pipe = None
    i2v_pipe = None

class VideoRequest(BaseModel):
    prompt: str
    model: Optional[str] = "ltx-2"
    duration: Optional[int] = 5
    resolution: Optional[str] = "1280x720"
    image_uri: Optional[str] = None
    negative_prompt: Optional[str] = "worst quality, inconsistent motion, blurry, jittery, distorted"
    num_inference_steps: Optional[int] = 40

def generate_video(req: VideoRequest):
    if not t2v_pipe or not i2v_pipe:
        raise RuntimeError("Models not loaded properly.")
        
    width, height = map(int, req.resolution.split("x"))
    
    # LTX-Video expects frames instead of duration. 24 fps default.
    num_frames = req.duration * 24 
    # Must be multiple of 8 + 1 (e.g. 121 for 5 seconds)
    num_frames = (num_frames // 8) * 8 + 1
    
    generator = torch.Generator(device=device).manual_seed(0)
    
    if req.image_uri:
        # Image-to-Video
        init_image = load_image(req.image_uri)
        video = i2v_pipe(
            image=init_image,
            prompt=req.prompt,
            negative_prompt=req.negative_prompt,
            width=width,
            height=height,
            num_frames=num_frames,
            num_inference_steps=req.num_inference_steps,
            generator=generator
        ).frames[0]
    else:
        # Text-to-Video
        video = t2v_pipe(
            prompt=req.prompt,
            negative_prompt=req.negative_prompt,
            width=width,
            height=height,
            num_frames=num_frames,
            num_inference_steps=req.num_inference_steps,
            generator=generator
        ).frames[0]
        
    # Export
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp_file:
        output_path = temp_file.name
        
    export_to_video(video, output_path, fps=24)
    return output_path

from fastapi.responses import FileResponse

@app.post("/v1/text-to-video")
@app.post("/v1/image-to-video")
async def handle_generation(request: VideoRequest, background_tasks: BackgroundTasks):
    out_path = None
    try:
        out_path = generate_video(request)
        # Schedule cleanup after response is sent
        background_tasks.add_task(os.remove, out_path)
        return FileResponse(out_path, media_type="video/mp4", filename="generated_video.mp4")
    except Exception as e:
        if out_path and os.path.exists(out_path):
            os.remove(out_path)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    status = "ok" if (t2v_pipe and i2v_pipe) else "error loading modles"
    return {"status": status, "device": device}
