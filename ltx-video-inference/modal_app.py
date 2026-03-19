import modal
import os
import io
import time
from typing import Optional, List, Tuple
from pydantic import BaseModel
import threading

# ── Modal App ────────────────────────────────────────────────────────
app_name = "kingjam-ltx-video"
app = modal.App(app_name)

# ── 依賴映像 (LTX-2.3 需要 Python 3.12 + CUDA 12.7+ + PyTorch 2.7) ──
image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg", "libsm6", "libxext6", "curl", "git")
    .pip_install(
        "numpy<2",
        "torch>=2.7.0",
        "torchvision>=0.22.0",
        "torchaudio>=2.7.0",
        "fastapi==0.115.0",
        "pydantic>=2.5.0",
        "safetensors>=0.4.0",
        "transformers==4.53.0",
        "accelerate>=1.6.0",
        "sentencepiece>=0.2.0",
        "imageio-ffmpeg==0.5.1",
        "imageio>=2.36.0",
        "Pillow>=11.0.0",
        "opencv-python-headless>=4.10.0",
        "boto3>=1.34.0",
        "httpx>=0.25.0",
        "redis>=5.0.1",
        "huggingface_hub>=0.28.0",
        "soundfile>=0.13.0",
    )
    .run_commands(
        "git clone --depth 1 https://github.com/Lightricks/LTX-2.git /opt/ltx2",
        "cd /opt/ltx2 && pip install packages/ltx-core packages/ltx-pipelines 'transformers==4.53.0'",
    )
    .env({
        # expandable_segments reduces fragmentation; max_split_size_mb prevents
        # large contiguous-block failures when framework reloads transformer weights
        "PYTORCH_CUDA_ALLOC_CONF": "expandable_segments:True,max_split_size_mb:512",
        # Legacy key kept for compatibility
        "PYTORCH_ALLOC_CONF": "expandable_segments:True,max_split_size_mb:512",
    })
)

# ── 模型掛載 Volume (存放 LTX-2.3 權重) ──
vol = modal.Volume.from_name("kingjam-models", create_if_missing=True)

# 模型目錄結構
CHECKPOINT_DIR = "/models/ltx-2.3"
CHECKPOINT_FILE = "ltx-2.3-22b-distilled.safetensors"
DEV_CHECKPOINT_FILE = "ltx-2.3-22b-dev.safetensors"
SPATIAL_UPSCALER_FILE = "ltx-2.3-spatial-upscaler-x2-1.0.safetensors"
DISTILLED_LORA_FILE = "ltx-2.3-22b-distilled-lora-384.safetensors"
GEMMA_DIR = "/models/gemma-3-12b"

# HuggingFace 模型 ID
HF_MODEL_REPO = "Lightricks/LTX-2.3"
HF_GEMMA_REPO = "google/gemma-3-12b-it"

DEFAULT_NEGATIVE_PROMPT = (
    "shaky, glitchy, low quality, worst quality, deformed, distorted, disfigured, "
    "motion smear, motion artifacts, fused fingers, bad anatomy, weird hand, ugly, "
    "transition, static, blurry, jittery, flickering, watermark, text, signature, "
    "lowres, extra limbs, malformed limbs, multiple heads, severed head"
)

# ── 權限控制 ──
SUPER_ADMIN_IDS = [1, 2]  # 目前開發用的管理員 ID


class VideoRequest(BaseModel):
    user_id: int
    prompt: str
    model: Optional[str] = "ltx-2.3"
    duration: Optional[int] = 5
    resolution: Optional[str] = "768x1280"
    image_uri: Optional[str] = None
    negative_prompt: Optional[str] = DEFAULT_NEGATIVE_PROMPT
    num_inference_steps: Optional[int] = 8
    seed: Optional[int] = None
    cfg_guidance_scale: Optional[float] = 1.0
    frame_rate: Optional[float] = 24.0
    two_stage: Optional[bool] = False
    teacache_threshold: Optional[float] = 0.0  # 0.0 to 1.0, 0.15 is a good start
    dynamic_offload: Optional[bool] = True     # True for extreme VRAM saving


@app.cls(
    image=image,
    gpu="A100-80GB",
    timeout=1800,
    scaledown_window=600,
    min_containers=0,
    max_containers=5,
    volumes={"/models": vol},
    secrets=[
        modal.Secret.from_name("king-jam-secrets"),
        modal.Secret.from_name("hf-secret"),
    ],
)
class LTXVideoInference:
    @modal.enter()
    def setup(self):
        """冷啟動時下載並載入 LTX-2.3 模型權重"""
        import torch
        from huggingface_hub import hf_hub_download, snapshot_download

        start_time = time.time()
        hf_token = os.getenv("HF_TOKEN")

        # ── 下載 LTX-2.3 checkpoint (如 Volume 中尚無) ──
        os.makedirs(CHECKPOINT_DIR, exist_ok=True)

        distilled_path = os.path.join(CHECKPOINT_DIR, CHECKPOINT_FILE)
        if not os.path.exists(distilled_path):
            print(f"[LTX-2.3] 下載 distilled checkpoint: {CHECKPOINT_FILE} ...")
            hf_hub_download(
                repo_id=HF_MODEL_REPO,
                filename=CHECKPOINT_FILE,
                local_dir=CHECKPOINT_DIR,
                token=hf_token,
            )
            vol.commit()
            print(f"[LTX-2.3] Distilled checkpoint 下載完成")
        else:
            print(f"[LTX-2.3] Distilled checkpoint 已快取: {distilled_path}")

        # ── 下載 spatial upscaler (二階段用) ──
        upscaler_path = os.path.join(CHECKPOINT_DIR, SPATIAL_UPSCALER_FILE)
        if not os.path.exists(upscaler_path):
            print(f"[LTX-2.3] 下載 spatial upscaler: {SPATIAL_UPSCALER_FILE} ...")
            hf_hub_download(
                repo_id=HF_MODEL_REPO,
                filename=SPATIAL_UPSCALER_FILE,
                local_dir=CHECKPOINT_DIR,
                token=hf_token,
            )
            vol.commit()
        else:
            print(f"[LTX-2.3] Spatial upscaler 已快取")

        # ── 下載 distilled LoRA ──
        lora_path = os.path.join(CHECKPOINT_DIR, DISTILLED_LORA_FILE)
        if not os.path.exists(lora_path):
            print(f"[LTX-2.3] 下載 distilled LoRA: {DISTILLED_LORA_FILE} ...")
            hf_hub_download(
                repo_id=HF_MODEL_REPO,
                filename=DISTILLED_LORA_FILE,
                local_dir=CHECKPOINT_DIR,
                token=hf_token,
            )
            vol.commit()
        else:
            print(f"[LTX-2.3] Distilled LoRA 已快取")

        # ── 下載 Gemma-3 text encoder ──
        os.makedirs(GEMMA_DIR, exist_ok=True)
        gemma_marker = os.path.join(GEMMA_DIR, "config.json")
        if not os.path.exists(gemma_marker):
            print(f"[LTX-2.3] 下載 Gemma-3 text encoder: {HF_GEMMA_REPO} ...")
            snapshot_download(
                repo_id=HF_GEMMA_REPO,
                local_dir=GEMMA_DIR,
                token=hf_token,
                local_dir_use_symlinks=False,
            )
            vol.commit()
            print(f"[LTX-2.3] Gemma-3 下載完成")
        else:
            print(f"[LTX-2.3] Gemma-3 已快取")

        # ── 載入 Pipeline ──
        print(f"[LTX-2.3] 正在載入 TI2VidTwoStagesPipeline ...")
        from ltx_pipelines.ti2vid_two_stages import TI2VidTwoStagesPipeline
        from ltx_core.loader import LoraPathStrengthAndSDOps
        from ltx_core.loader.registry import StateDictRegistry
        from ltx_core.quantization import QuantizationPolicy

        # ── [關鍵修復] 使用 StateDictRegistry 讓所有模型由 CPU 載入再移 GPU ──
        # 原因: DummyRegistry 下, _target_device() == "cuda"
        #   載入 22B transformer 時先將 bf16 44GB 載入 CUDA, 再 cast fp8 = 峰値 ~66GB
        #   加上 Gemma-3-12B (~24GB) + VAE 超過 79GB → OOM
        # 解法: StateDictRegistry 讓 _target_device() 回傳 "cpu"
        #   所有模型先在 CPU RAM 讀入, 再 .to(cuda) 逐層移動
        #   CUDA 峰値僅 ~22GB (fp8 transformer)
        #   stage_1 與 stage_2 共享同一 registry 避免重複載入
        #
        # 注意: TI2VidTwoStagesPipeline 不接受 registry 參數,
        #   所以在建立 pipeline 後再將 registry 注入兩個 model ledger
        shared_registry = StateDictRegistry()
        self.current_req = None  # 用於在 generate 時動態傳遞優化參數

        self.pipeline = TI2VidTwoStagesPipeline(
            checkpoint_path=distilled_path,
            spatial_upsampler_path=upscaler_path,
            gemma_root=GEMMA_DIR,
            distilled_lora=[
                LoraPathStrengthAndSDOps(path=lora_path, strength=1, sd_ops=None)
            ],
            loras=[],
            quantization=QuantizationPolicy.fp8_cast(),
        )
        # [重要] 注入 StateDictRegistry 並同步 Builders
        for ledger in [self.pipeline.stage_1_model_ledger, self.pipeline.stage_2_model_ledger]:
            ledger.registry = shared_registry
            ledger.build_model_builders()
        print(f"[LTX-2.3] StateDictRegistry({id(shared_registry)}) 已注入並同步 Builders")

        self._transformer_prepare_lock = threading.RLock()
        self._request_lock = threading.RLock()
        self._orig_transformer_fn = self.pipeline.stage_1_model_ledger.transformer
        self._transformer_cache = None

        def _ensure_cuda(obj):
            import torch
            if torch.is_tensor(obj):
                return obj if obj.device.type == "cuda" else obj.to("cuda")
            if isinstance(obj, dict):
                return {k: _ensure_cuda(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [_ensure_cuda(v) for v in obj]
            if isinstance(obj, tuple):
                return tuple(_ensure_cuda(v) for v in obj)
            return obj

        def _configure_block_devices(x0_model):
            import torch
            v_model = x0_model.velocity_model
            dynamic_offload = bool(getattr(x0_model, "_dynamic_offload", False))

            for name, child in v_model.named_children():
                if name != "transformer_blocks":
                    child.to("cuda")

            if hasattr(v_model, "transformer_blocks"):
                for block in v_model.transformer_blocks:
                    block.to("cpu" if dynamic_offload else "cuda")

            if dynamic_offload:
                torch.cuda.empty_cache()

        def _install_runtime_hooks(x0_model):
            import torch
            import types

            if getattr(x0_model, "_safe_hooks_installed", False):
                return

            v_model = x0_model.velocity_model
            x0_model._last_latent_input = None
            x0_model._last_output = None

            orig_forward = x0_model.forward

            def optimized_forward(*f_args, **f_kwargs):
                f_args = _ensure_cuda(f_args)
                f_kwargs = _ensure_cuda(f_kwargs)

                threshold = float(getattr(x0_model, "_teacache_threshold", 0.0) or 0.0)
                if threshold > 0:
                    x = f_args[0] if f_args else f_kwargs.get("x")
                    if x is not None:
                        if x0_model._last_latent_input is not None and x0_model._last_output is not None:
                            diff = (x - x0_model._last_latent_input).abs().mean()
                            base = x0_model._last_latent_input.abs().mean()
                            rel_diff = diff / (base + 1e-6)
                            if rel_diff < threshold:
                                return x0_model._last_output
                        x0_model._last_latent_input = x.clone()

                result = orig_forward(*f_args, **f_kwargs)

                if threshold > 0:
                    x0_model._last_output = result

                return result

            x0_model.forward = optimized_forward

            if hasattr(v_model, "transformer_blocks"):
                for block in v_model.transformer_blocks:
                    if getattr(block, "_safe_wrapped", False):
                        continue

                    block._orig_block_forward = block.forward

                    def make_wrapped_f(b):
                        def wrapped(self_b, *b_args, **b_kwargs):
                            import torch
                            if getattr(x0_model, "_dynamic_offload", False):
                                self_b.to("cuda")
                                res = self_b._orig_block_forward(
                                    *_ensure_cuda(b_args), **_ensure_cuda(b_kwargs)
                                )
                                self_b.to("cpu")
                                torch.cuda.empty_cache()
                                return res
                            return self_b._orig_block_forward(
                                *_ensure_cuda(b_args), **_ensure_cuda(b_kwargs)
                            )
                        return wrapped

                    block.forward = types.MethodType(make_wrapped_f(block), block)
                    block._safe_wrapped = True

            x0_model._safe_hooks_installed = True

        def _apply_request_profile(x0_model):
            req = getattr(self, "current_req", None)
            x0_model._teacache_threshold = float(getattr(req, "teacache_threshold", 0.0) or 0.0)
            x0_model._dynamic_offload = bool(getattr(req, "dynamic_offload", False))
            _configure_block_devices(x0_model)

        def _cached_transformer(*args, **kwargs):
            import gc
            import torch

            with self._transformer_prepare_lock:
                if self._transformer_cache is None:
                    print("[LTX-2.3] [setup] 初始化 transformer cache...")
                    for _ in range(2):
                        gc.collect()
                        torch.cuda.empty_cache()

                    x0_model = self._orig_transformer_fn(*args, **kwargs)
                    _install_runtime_hooks(x0_model)
                    self._transformer_cache = x0_model
                    print("[LTX-2.3] [setup] Transformer cache 已建立")
                else:
                    print("[LTX-2.3] [setup] 使用既有 transformer cache")

                _apply_request_profile(self._transformer_cache)
                print(
                    f"[LTX-2.3] [setup] profile: teacache={getattr(self._transformer_cache, '_teacache_threshold', 0.0):.3f}, "
                    f"dynamic_offload={getattr(self._transformer_cache, '_dynamic_offload', False)}"
                )
                return self._transformer_cache

        self.pipeline.stage_1_model_ledger.transformer = _cached_transformer

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        elapsed = time.time() - start_time
        print("[LTX-2.3] SAFE_CACHE_BUILD_V1")
        print(f"[LTX-2.3] Setup 完成 (耗時: {elapsed:.1f}s), GPU: {self.device}")


    @modal.method()
    def generate(self, req: VideoRequest) -> dict:
        """LTX-2.3 影片生成主邏輯"""
        import torch
        import tempfile
        import uuid
        import random
        import boto3
        import numpy as np

        task_id = str(uuid.uuid4())
        self.current_req = req  # 讓 _patched_transformer 能讀取優化參數
        start_time = time.time()
        print(f"[LTX-2.3] [{task_id}] 開始生成, prompt: {req.prompt[:80]}...")

        try:
            width, height = map(int, req.resolution.split("x"))
            # Two-stage pipeline 要求必須是 64 的倍數
            width = (width // 64) * 64
            height = (height // 64) * 64

            # ── VRAM 保護: A100-80GB 限制 (Gemma-3-12B + LTX-22B + 激活值)
            # 768x1280 + 161幀 大約需要 ~72-76 GiB; 更大的配置會 OOM
            MAX_PIXELS = 768 * 1280
            if width * height > MAX_PIXELS:
                # 等比縮小到最大像素限制, 對齊到 64
                scale = (MAX_PIXELS / (width * height)) ** 0.5
                width = int((width * scale) // 64) * 64
                height = int((height * scale) // 64) * 64
                print(f"[LTX-2.3] [{task_id}] 解析度已縮小至 {width}x{height} (VRAM 保護)")

            num_frames = int(req.duration * req.frame_rate)
            num_frames = (num_frames // 8) * 8 + 1
            # 最多 161 幀 (~6.7s at 24fps) 以避免激活值 OOM
            MAX_FRAMES = 161
            if num_frames > MAX_FRAMES:
                num_frames = ((MAX_FRAMES - 1) // 8) * 8 + 1  # 最近的合法值
                print(f"[LTX-2.3] [{task_id}] 幀數已限制至 {num_frames} (VRAM 保護)")

            actual_seed = req.seed if req.seed is not None else random.randint(0, 2147483647)
            print(f"[LTX-2.3] [{task_id}] res={width}x{height}, frames={num_frames}, steps={req.num_inference_steps}, seed={actual_seed}")

            # 清理 CUDA 快取, 讓 model ledger 重載 transformer 時有连续空間
            torch.cuda.empty_cache()

            from ltx_core.components.guiders import MultiModalGuiderParams
            from ltx_pipelines.utils.args import ImageConditioningInput

            guider_params = MultiModalGuiderParams(
                cfg_scale=req.cfg_guidance_scale,
            )

            images = []
            if req.image_uri:
                images = [ImageConditioningInput(
                    image=req.image_uri,
                    frame_index=0,
                    strength=0.8,
                )]

            video_iter, audio = self.pipeline(
                prompt=req.prompt,
                negative_prompt=req.negative_prompt,
                seed=actual_seed,
                height=height,
                width=width,
                num_frames=num_frames,
                frame_rate=req.frame_rate,
                num_inference_steps=req.num_inference_steps,
                video_guider_params=guider_params,
                audio_guider_params=guider_params,
                images=images,
            )

            video = None
            for frame_chunk in video_iter:
                video = frame_chunk

            # ── 匯出為 MP4 ──
            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
                output_path = tmp.name

            self._export_video(video, audio, output_path, fps=req.frame_rate)
            inference_time = time.time() - start_time
            print(f"[LTX-2.3] [{task_id}] 推論完成 (耗時: {inference_time:.1f}s)")

            # ── 上傳至 R2 ──
            video_url = self._upload_to_r2(req, task_id, output_path)
            print(f"[LTX-2.3] [{task_id}] 上傳成功: {video_url}")

            return {
                "success": True,
                "task_id": task_id,
                "video_url": video_url,
                "object_key": video_url.split("/")[-4:] if video_url else None,
                "model": req.model,
                "inference_time_s": round(inference_time, 1),
            }

        except torch.OutOfMemoryError as e:
            # OOM 後 GPU 狀態已髙化, 強制重啟 container 避免後續請求繼續失敗
            print(f"[LTX-2.3] [{task_id}] CUDA OOM, 重啟 container: {e}")
            import sys
            sys.exit(1)  # Modal 會自動重啟 container 且重試請求
        except Exception as e:
            print(f"[LTX-2.3] [{task_id}] 執行錯誤: {e}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "task_id": task_id,
                "error": str(e),
            }
        finally:
            if "output_path" in locals() and os.path.exists(output_path):
                os.remove(output_path)

    def _export_video(self, video, audio, output_path: str, fps: float = 24.0):
        """將 pipeline 輸出匯出為帶音訊的 MP4"""
        import numpy as np
        import tempfile

        try:
            from ltx_pipelines.export_utils import encode_video
            encode_video(
                video,
                fps=fps,
                audio=audio.float().cpu() if audio is not None else None,
                output_path=output_path,
            )
        except (ImportError, AttributeError):
            from imageio import get_writer
            if hasattr(video, 'numpy'):
                video_np = video.numpy()
            elif isinstance(video, np.ndarray):
                video_np = video
            else:
                video_np = np.array(video)

            if video_np.dtype == np.float32 or video_np.dtype == np.float64:
                video_np = (video_np * 255).clip(0, 255).astype(np.uint8)

            writer = get_writer(output_path, fps=fps)
            for frame in video_np:
                writer.append_data(frame)
            writer.close()

    def _upload_to_r2(self, req: VideoRequest, task_id: str, output_path: str) -> str:
        """上傳影片至 Cloudflare R2"""
        import boto3
        import hashlib
        from datetime import datetime
        from botocore.config import Config

        bucket_name = os.getenv("R2_BUCKET_NAME", "kingjam-media")
        endpoint_url = os.getenv("R2_ENDPOINT_URL")
        public_url = os.getenv("R2_PUBLIC_URL")

        s3_client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=os.getenv("R2_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY"),
            region_name="auto",
            config=Config(signature_version="s3v4"),
        )

        now = datetime.utcnow()
        unique_str = f"{req.user_id}_{now.timestamp()}_{task_id}"
        file_hash = hashlib.md5(unique_str.encode()).hexdigest()[:8]
        object_key = f"videos/{req.user_id}/{now.year}/{now.month:02d}/{file_hash}_{now.strftime('%H%M%S')}.mp4"

        with open(output_path, "rb") as f:
            s3_client.upload_fileobj(
                f,
                bucket_name,
                object_key,
                ExtraArgs={
                    "ContentType": "video/mp4",
                    "CacheControl": "public, max-age=31536000",
                },
            )

        if public_url:
            return f"{public_url.rstrip('/')}/{object_key}"
        return f"{endpoint_url}/{bucket_name}/{object_key}"


# ── 伺服器端: FastAPI 與非同步輪詢機制 ──

job_store = modal.Dict.from_name("kingjam-ltx-jobs", create_if_missing=True)


@app.function(
    image=image,
    timeout=1800,
    secrets=[
        modal.Secret.from_name("king-jam-secrets"),
        modal.Secret.from_name("hf-secret"),
    ],
)
def orchestrate_generation(task_id: str, req: VideoRequest):
    """背景處理: 呼叫 LTXVideoInference 並更新狀態"""
    job_store[task_id] = {"status": "processing", "video_url": None, "error": None}
    print(f"[LTX-2.3-Orch] [{task_id}] 開始, model={req.model}, res={req.resolution}, dur={req.duration}s")

    try:
        res = LTXVideoInference().generate.remote(req)
        if res.get("success"):
            print(f"[LTX-2.3-Orch] [{task_id}] 成功: {res.get('video_url')}")
            job_store[task_id] = {"status": "completed", "video_url": res["video_url"], "error": None}
        else:
            err = res.get("error", "Unknown error")
            print(f"[LTX-2.3-Orch] [{task_id}] 失敗: {err}")
            job_store[task_id] = {"status": "error", "video_url": None, "error": err}
    except Exception as e:
        print(f"[LTX-2.3-Orch] [{task_id}] 崩潰: {e}")
        job_store[task_id] = {"status": "error", "video_url": None, "error": str(e)}


from fastapi import FastAPI

web_app = FastAPI(title="LTX-2.3 Inference Server")


@web_app.post("/v1/text-to-video")
@web_app.post("/v1/image-to-video")
async def submit_job(req: VideoRequest):
    import uuid

    # 權限檢查: 只有超級管理員可以測試 LTX-2.3
    if req.model == "ltx-2.3" and req.user_id not in SUPER_ADMIN_IDS:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="LTX-2.3 僅限超級管理員測試中")

    task_id = str(uuid.uuid4())
    job_store[task_id] = {"status": "queuing", "video_url": None, "error": None}
    orchestrate_generation.spawn(task_id, req)
    return {"task_id": task_id, "status": "processing"}


@web_app.get("/v1/status/{task_id}")
async def get_status(task_id: str):
    res = await job_store.get.aio(task_id)
    if not res:
        return {"status": "error", "error": "Task not found"}
    return res


@web_app.get("/v1/model-info")
async def model_info():
    return {
        "model": "LTX-2.3",
        "version": "22b-distilled",
        "checkpoints": [CHECKPOINT_FILE, SPATIAL_UPSCALER_FILE, DISTILLED_LORA_FILE],
        "capabilities": ["text-to-video", "image-to-video", "audio-video"],
        "max_duration_s": 20,
        "max_resolution": "1920x1080",
        "frame_rates": [24, 25, 48, 50],
        "distilled_steps": 8,
    }


@app.function(image=image)
@modal.asgi_app()
def api():
    return web_app


@app.local_entrypoint()
def trigger_generation(
    prompt: str = "A cinematic drone shot of a futuristic city with flying cars at sunset, 4k, highly detailed",
):
    req = VideoRequest(
        user_id=1,
        prompt=prompt,
        duration=5,
        resolution="704x1280",
        teacache_threshold=0.15,
        dynamic_offload=True,
    )
    result = LTXVideoInference().generate.remote(req)
    print("Result:", result)
