import os
import gc
import uuid
import asyncio
import tempfile
import torch
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any

from diffusers import LTXImageToVideoPipeline, LTXPipeline
from diffusers.utils import export_to_video, load_image

# Optional: bitsandbytes INT8 quantization (reduces VRAM ~50% on L4)
try:
    from transformers import BitsAndBytesConfig
    _BNB_AVAILABLE = True
except ImportError:
    _BNB_AVAILABLE = False

# Quantization enabled by env var (default: True on CUDA for L4)
_USE_INT8 = os.getenv("USE_INT8_QUANT", "true").lower() == "true"

app = FastAPI(title="King Jam AI - LTX Inference Server")

device = "cuda" if torch.cuda.is_available() else "cpu"
dtype = torch.float16 if torch.cuda.is_available() else torch.float32

# Model weights served from GCS FUSE volume mount
MODEL_PATH = os.getenv("MODEL_PATH", "/models/LTX-Video")

# ── Pipeline cache (one loaded at a time) ──────────────────────────
_current_pipe = None
_current_pipe_type: Optional[str] = None
_pipe_lock = asyncio.Lock() if False else None  # initialised in startup


@app.on_event("startup")
async def _init_globals():
    global _pipe_lock
    _pipe_lock = asyncio.Lock()


# ── In-memory task store ───────────────────────────────────────────
# { task_id: { "status": "processing"|"completed"|"error",
#              "video_url": str|None, "error": str|None } }
_tasks: Dict[str, Dict[str, Any]] = {}


# ── Pydantic models ────────────────────────────────────────────────
class VideoRequest(BaseModel):
    prompt: str
    model: Optional[str] = "ltx-2"
    duration: Optional[int] = 5
    resolution: Optional[str] = "854x480"
    image_uri: Optional[str] = None
    negative_prompt: Optional[str] = "worst quality, inconsistent motion, blurry, jittery, distorted"
    # 降低推理步數：從 40 步降到 28 步，省下 ~30% 生成時間，畫質幾乎無損
    num_inference_steps: Optional[int] = 28


# ── Pipeline loader ────────────────────────────────────────────────
def _load_pipe(pipe_type: str):
    global _current_pipe, _current_pipe_type

    if _current_pipe is not None and _current_pipe_type == pipe_type:
        return _current_pipe

    if _current_pipe is not None:
        print(f"[LTX] Evicting {_current_pipe_type} pipeline...")
        del _current_pipe
        _current_pipe = None
        _current_pipe_type = None
        if device == "cuda":
            torch.cuda.empty_cache()
        gc.collect()

    print(f"[LTX] Loading {pipe_type} pipeline from {MODEL_PATH}...")

    # Build kwargs — enable INT8 quantization on CUDA if bitsandbytes available
    use_quant = _BNB_AVAILABLE and _USE_INT8 and device == "cuda"
    if use_quant:
        print("[LTX] INT8 quantization enabled (bitsandbytes) — VRAM usage ~50% lower")
        bnb_config = BitsAndBytesConfig(load_in_8bit=True)
        kwargs = dict(
            torch_dtype=torch.float16,
            local_files_only=True,
            low_cpu_mem_usage=True,
            quantization_config=bnb_config,
        )
    else:
        if not _BNB_AVAILABLE:
            print("[LTX] bitsandbytes not available, using fp16")
        kwargs = dict(
            torch_dtype=dtype,
            local_files_only=True,
            low_cpu_mem_usage=True,
        )

    if pipe_type == "i2v":
        pipe = LTXImageToVideoPipeline.from_pretrained(MODEL_PATH, **kwargs)
    else:
        pipe = LTXPipeline.from_pretrained(MODEL_PATH, **kwargs)

    # With INT8 quant, device placement is handled by bitsandbytes automatically
    if not use_quant:
        pipe.to(device)

    _current_pipe = pipe
    _current_pipe_type = pipe_type
    print(f"[LTX] {pipe_type} pipeline ready ✅ (quant={'int8' if use_quant else 'fp16'})")
    return pipe


# ── Core generation (blocking, runs in thread pool) ────────────────
def _run_generation_sync(req: VideoRequest) -> str:
    """Run model inference synchronously. Returns path to MP4 file."""
    width, height = map(int, req.resolution.split("x"))
    num_frames = req.duration * 24
    num_frames = (num_frames // 8) * 8 + 1
    generator = torch.Generator(device="cpu").manual_seed(42)

    if req.image_uri:
        pipe = _load_pipe("i2v")
        init_image = load_image(req.image_uri)
        video = pipe(
            image=init_image,
            prompt=req.prompt,
            negative_prompt=req.negative_prompt,
            width=width,
            height=height,
            num_frames=num_frames,
            num_inference_steps=req.num_inference_steps,
            generator=generator,
        ).frames[0]
    else:
        pipe = _load_pipe("t2v")
        video = pipe(
            prompt=req.prompt,
            negative_prompt=req.negative_prompt,
            width=width,
            height=height,
            num_frames=num_frames,
            num_inference_steps=req.num_inference_steps,
            generator=generator,
        ).frames[0]

    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
        output_path = tmp.name
    export_to_video(video, output_path, fps=24)
    return output_path


# ── Background generation task ─────────────────────────────────────
async def _run_generation_task(task_id: str, req: VideoRequest):
    """Async wrapper: runs generation in thread pool, uploads to GCS, updates task store."""
    print(f"[LTX] [{task_id}] Starting generation: prompt={req.prompt[:60]}...")
    try:
        # Run heavy CPU/GPU work in thread pool (non-blocking for event loop)
        async with _pipe_lock:
            out_path = await asyncio.get_event_loop().run_in_executor(
                None, _run_generation_sync, req
            )

        print(f"[LTX] [{task_id}] Generation complete, uploading...")

        # Upload to GCS and get public URL
        video_url = await _upload_to_gcs(task_id, out_path)

        _tasks[task_id] = {
            "status": "completed",
            "video_url": video_url,
            "error": None,
        }
        print(f"[LTX] [{task_id}] ✅ Done: {video_url}")

    except Exception as e:
        print(f"[LTX] [{task_id}] ❌ Failed: {e}")
        _tasks[task_id] = {"status": "error", "video_url": None, "error": str(e)}

    finally:
        # Clean up temp file
        if "out_path" in dir() and out_path and os.path.exists(out_path):
            try:
                os.remove(out_path)
            except Exception:
                pass


async def _upload_to_gcs(task_id: str, video_path: str) -> str:
    """Upload MP4 to GCS via the cloud_storage service or raw gsutil."""
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
        print(f"[LTX] GCS upload failed: {err}. Returning local fallback path.")
        return f"/static/videos/ltx_{task_id}.mp4"

    # Make object public
    await asyncio.create_subprocess_exec(
        "gsutil", "acl", "ch", "-u", "AllUsers:R", dest
    )
    return public_url


# ── HTTP Endpoints ─────────────────────────────────────────────────

@app.post("/v1/text-to-video")
@app.post("/v1/image-to-video")
async def submit_generation(request: VideoRequest):
    """
    Non-blocking generation endpoint.
    Returns task_id immediately; generation runs in background.
    Poll GET /v1/status/{task_id} for result.
    """
    task_id = str(uuid.uuid4())
    _tasks[task_id] = {"status": "processing", "video_url": None, "error": None}

    # Fire-and-forget: asyncio.create_task keeps running after response
    asyncio.create_task(_run_generation_task(task_id, request))

    return {
        "task_id": task_id,
        "status": "processing",
        "eta": "10-15m",
        "poll_url": f"/v1/status/{task_id}",
    }


@app.get("/v1/status/{task_id}")
async def get_status(task_id: str):
    """Poll generation status."""
    task = _tasks.get(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    return {"task_id": task_id, **task}


@app.get("/warmup")
@app.post("/warmup")
async def warmup():
    """Lightweight warm-up probe."""
    loaded = _current_pipe is not None
    return {
        "status": "ready" if loaded else "cold",
        "device": device,
        "model_path": MODEL_PATH,
        "pipeline": _current_pipe_type,
        "active_tasks": len([t for t in _tasks.values() if t["status"] == "processing"]),
    }


@app.get("/health")
async def health_check():
    model_path_exists = os.path.isdir(MODEL_PATH)
    return {
        "status": "ok" if model_path_exists else "model_path_missing",
        "model_path": MODEL_PATH,
        "model_path_exists": model_path_exists,
        "pipeline_loaded": _current_pipe is not None,
        "pipeline": _current_pipe_type,
        "device": device,
        "active_tasks": len([t for t in _tasks.values() if t["status"] == "processing"]),
    }
