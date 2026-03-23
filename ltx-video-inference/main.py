"""
LTX-2.3 Local / Container Inference Server
==========================================
本地開發或以容器部署（Docker / 雲端 GPU 等）。
使用 ltx-pipelines 官方套件載入 LTX-2.3 模型。

Usage (local):
  pip install -r requirements.txt
  cd /path/to/LTX-2 && pip install packages/ltx-core packages/ltx-pipelines
  MODEL_DIR=/models/ltx-2.3 GEMMA_DIR=/models/gemma-3 uvicorn main:app --port 8080
"""

import os
import gc
import uuid
import asyncio
import tempfile
from typing import Optional, Dict, Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="King Jam AI - LTX-2.3 Inference Server")

# ── 環境配置 ──
MODEL_DIR = os.getenv("MODEL_DIR", "/models/ltx-2.3")
GEMMA_DIR = os.getenv("GEMMA_DIR", "/models/gemma-3")

CHECKPOINT_FILE = os.getenv("LTX_CHECKPOINT", "ltx-2.3-22b-distilled.safetensors")
SPATIAL_UPSCALER_FILE = os.getenv("LTX_UPSCALER", "ltx-2.3-spatial-upscaler-x2-1.0.safetensors")
DISTILLED_LORA_FILE = os.getenv("LTX_LORA", "ltx-2.3-22b-distilled-lora-384.safetensors")

# ── Pipeline 快取 ──
_pipeline = None
_pipe_lock: Optional[asyncio.Lock] = None

# ── 任務追蹤 ──
_tasks: Dict[str, Dict[str, Any]] = {}


class VideoRequest(BaseModel):
    prompt: str
    model: Optional[str] = "ltx-2.3"
    duration: Optional[int] = 5
    resolution: Optional[str] = "768x1360"
    image_uri: Optional[str] = None
    negative_prompt: Optional[str] = (
        "shaky, glitchy, low quality, worst quality, deformed, distorted, "
        "disfigured, motion smear, motion artifacts, fused fingers, "
        "bad anatomy, weird hand, ugly, transition, static"
    )
    num_inference_steps: Optional[int] = 8
    cfg_guidance_scale: Optional[float] = 1.0
    frame_rate: Optional[float] = 24.0
    seed: Optional[int] = None


@app.on_event("startup")
async def _init_globals():
    global _pipe_lock
    _pipe_lock = asyncio.Lock()


def _load_pipeline():
    """載入 LTX-2.3 TI2VidTwoStagesPipeline (首次呼叫時)"""
    global _pipeline
    if _pipeline is not None:
        return _pipeline

    checkpoint_path = os.path.join(MODEL_DIR, CHECKPOINT_FILE)
    upscaler_path = os.path.join(MODEL_DIR, SPATIAL_UPSCALER_FILE)
    lora_path = os.path.join(MODEL_DIR, DISTILLED_LORA_FILE)

    print(f"[LTX-2.3] Loading pipeline from {MODEL_DIR}...")
    print(f"  checkpoint: {checkpoint_path}")
    print(f"  upscaler:   {upscaler_path}")
    print(f"  lora:       {lora_path}")
    print(f"  gemma:      {GEMMA_DIR}")

    from ltx_pipelines.ti2vid_two_stages import TI2VidTwoStagesPipeline
    from ltx_core.loader import LoraPathStrengthAndSDOps

    _pipeline = TI2VidTwoStagesPipeline(
        checkpoint_path=checkpoint_path,
        spatial_upsampler_path=upscaler_path,
        gemma_root=GEMMA_DIR,
        distilled_lora=[
            LoraPathStrengthAndSDOps(path=lora_path, strength=1)
        ],
    )

    print("[LTX-2.3] Pipeline ready")
    return _pipeline


def _run_generation_sync(req: VideoRequest) -> str:
    """同步推論，回傳 MP4 暫存路徑"""
    import torch
    import random
    import numpy as np

    pipeline = _load_pipeline()

    width, height = map(int, req.resolution.split("x"))
    width = (width // 32) * 32
    height = (height // 32) * 32

    num_frames = int(req.duration * req.frame_rate)
    num_frames = (num_frames // 8) * 8 + 1

    seed = req.seed if req.seed is not None else random.randint(0, 2147483647)

    gen_kwargs = dict(
        prompt=req.prompt,
        negative_prompt=req.negative_prompt,
        seed=seed,
        height=height,
        width=width,
        num_frames=num_frames,
        frame_rate=req.frame_rate,
        num_inference_steps=req.num_inference_steps,
        cfg_guidance_scale=req.cfg_guidance_scale,
    )

    if req.image_uri:
        gen_kwargs["images"] = [(req.image_uri, 0, 0.8)]

    video, audio = pipeline(**gen_kwargs)

    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
        output_path = tmp.name

    try:
        from ltx_pipelines.export_utils import encode_video
        encode_video(
            video,
            fps=req.frame_rate,
            audio=audio.float().cpu() if audio is not None else None,
            output_path=output_path,
        )
    except (ImportError, AttributeError):
        from imageio import get_writer
        if hasattr(video, "numpy"):
            video_np = video.numpy()
        elif isinstance(video, np.ndarray):
            video_np = video
        else:
            video_np = np.array(video)

        if video_np.dtype in (np.float32, np.float64):
            video_np = (video_np * 255).clip(0, 255).astype(np.uint8)

        writer = get_writer(output_path, fps=req.frame_rate)
        for frame in video_np:
            writer.append_data(frame)
        writer.close()

    return output_path


async def _run_generation_task(task_id: str, req: VideoRequest):
    """非同步推論任務 (背景執行)"""
    print(f"[LTX-2.3] [{task_id}] Starting: prompt={req.prompt[:60]}...")
    try:
        async with _pipe_lock:
            out_path = await asyncio.get_event_loop().run_in_executor(
                None, _run_generation_sync, req
            )

        print(f"[LTX-2.3] [{task_id}] Generation complete, uploading...")
        video_url = await _upload_to_storage(task_id, out_path)

        _tasks[task_id] = {"status": "completed", "video_url": video_url, "error": None}
        print(f"[LTX-2.3] [{task_id}] Done: {video_url}")

    except Exception as e:
        print(f"[LTX-2.3] [{task_id}] Failed: {e}")
        _tasks[task_id] = {"status": "error", "video_url": None, "error": str(e)}
    finally:
        if "out_path" in dir() and out_path and os.path.exists(out_path):
            try:
                os.remove(out_path)
            except Exception:
                pass


async def _upload_to_storage(task_id: str, video_path: str) -> str:
    """上傳至 GCS (Cloud Run) 或回傳本地路徑"""
    import subprocess

    bucket = os.getenv("GCS_BUCKET_NAME", "kingjam-media")
    dest = f"gs://{bucket}/ltx-videos/{task_id}.mp4"
    public_url = f"https://storage.googleapis.com/{bucket}/ltx-videos/{task_id}.mp4"

    proc = await asyncio.create_subprocess_exec(
        "gsutil", "cp", video_path, dest,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        err = stderr.decode()
        print(f"[LTX-2.3] GCS upload failed: {err}. Returning local fallback.")
        return f"/static/videos/ltx_{task_id}.mp4"

    await asyncio.create_subprocess_exec(
        "gsutil", "acl", "ch", "-u", "AllUsers:R", dest
    )
    return public_url


# ── HTTP Endpoints ──

@app.post("/v1/text-to-video")
@app.post("/v1/image-to-video")
async def submit_generation(request: VideoRequest):
    task_id = str(uuid.uuid4())
    _tasks[task_id] = {"status": "processing", "video_url": None, "error": None}
    asyncio.create_task(_run_generation_task(task_id, request))
    return {
        "task_id": task_id,
        "status": "processing",
        "eta": "2-8m",
        "poll_url": f"/v1/status/{task_id}",
    }


@app.get("/v1/status/{task_id}")
async def get_status(task_id: str):
    task = _tasks.get(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    return {"task_id": task_id, **task}


@app.get("/v1/model-info")
async def model_info():
    return {
        "model": "LTX-2.3",
        "version": "22b-distilled",
        "max_duration_s": 20,
        "max_resolution": "1920x1088",
        "frame_rates": [24, 25, 48, 50],
        "distilled_steps": 8,
    }


@app.get("/warmup")
@app.post("/warmup")
async def warmup():
    loaded = _pipeline is not None
    return {
        "status": "ready" if loaded else "cold",
        "model": "LTX-2.3 (22b-distilled)",
        "model_dir": MODEL_DIR,
        "pipeline_loaded": loaded,
        "active_tasks": len([t for t in _tasks.values() if t["status"] == "processing"]),
    }


@app.get("/health")
async def health_check():
    checkpoint_exists = os.path.isfile(os.path.join(MODEL_DIR, CHECKPOINT_FILE))
    return {
        "status": "ok" if checkpoint_exists else "model_missing",
        "model_dir": MODEL_DIR,
        "checkpoint": CHECKPOINT_FILE,
        "checkpoint_exists": checkpoint_exists,
        "pipeline_loaded": _pipeline is not None,
        "active_tasks": len([t for t in _tasks.values() if t["status"] == "processing"]),
    }
