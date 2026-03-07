import modal
import os
import io
import time
from typing import Optional
from pydantic import BaseModel

# 建立 Modal App
app_name = "kingjam-ltx-video"
app = modal.App(app_name)

# 依賴映像檔 (定義運算環境)
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libsm6", "libxext6", "curl")
    .pip_install(
        "numpy<2",
        "torch>=2.0.0",
        "triton==2.1.0",
        "fastapi==0.109.0",
        "pydantic==2.5.3",
        "diffusers==0.32.1",
        "transformers==4.47.1",
        "accelerate==1.2.1",
        "peft==0.14.0",
        "sentencepiece==0.2.0",
        "imageio-ffmpeg==0.5.1",
        "imageio==2.36.1",
        "Pillow==11.0.0",
        "opencv-python-headless==4.10.0.84",
        "bitsandbytes==0.44.1",
        "boto3>=1.34.0",
        "httpx>=0.25.0",
        "redis>=5.0.1",
        "huggingface_hub"
    )
)

# 定義模型掛載 Volume (對應原始的 BaseModel GCS Fuse，在 Modal 中對應 Volume)
vol = modal.Volume.from_name("kingjam-models", create_if_missing=True)
MODEL_PATH = "/models/LTX-Video"


class VideoRequest(BaseModel):
    user_id: int
    prompt: str
    model: Optional[str] = "ltx-2"
    duration: Optional[int] = 4     # 降低為 4 秒提高速度
    resolution: Optional[str] = "480x864" # 提高預設解析度提升畫質
    image_uri: Optional[str] = None
    negative_prompt: Optional[str] = "distorted anatomy, extra limbs, malformed limbs, multiple heads, mangled hands, missing fingers, malformed body, severed head, decapitated, splitting human, duplicate body parts, stretching, blurry, low quality, jittery, flickering, watermark, text, signature, lowres, ugly, deformed arms, deformed legs, disjointed limbs, floating limbs, unnatural movement"
    num_inference_steps: Optional[int] = 35 # 從 20 提高到 35 提升細節清晰度


@app.cls(
    image=image, # 使用完整定義的 image
    gpu="A10G", # 升級 GPU 避免 VRAM 溢出或過慢
    timeout=1800, # 延長至 30 分鐘，確保冷啟動下載模型不會超時
    scaledown_window=600,  # 閒置超時自動縮容 10 分鐘
    min_containers=0,      # 修改為 0 以節省閒置成本 (首個 Request 會有約 30s 冷啟動)
    max_containers=10,      # 並發限制 10 台 GPU
    allow_concurrent_inputs=1, # 確保每台 GPU 只處理一個片段，促使 Modal 自動擴容
    volumes={"/models": vol},
    secrets=[
        modal.Secret.from_name("king-jam-secrets"),
        modal.Secret.from_name("hf-secret")
    ]
)
class LTXVideoInference:
    @modal.enter()
    def setup(self):
        """冷啟動時載入模型權重，若無則自動從 HuggingFace 下載到 Volume"""
        import torch
        from diffusers import LTXPipeline, LTXImageToVideoPipeline
        from transformers import BitsAndBytesConfig
        import gc
        import os
        import time
        from huggingface_hub import snapshot_download
        
        start_time = time.time()
        
        # 優先檢查正確的路徑
        potential_paths = [
            MODEL_PATH,
            os.path.join(MODEL_PATH, "LTX-Video"), # 處理 Volume 內可能的嵌套
        ]
        
        found_path = None
        for p in potential_paths:
            check_file = os.path.join(p, "model_index.json")
            if os.path.exists(check_file):
                print(f"[LTX-Modal] 找到模型快取: {p}")
                found_path = p
                break
        
        if not found_path:
            print(f"[LTX-Modal] 模型尚未快取至 Volume，開始從 HuggingFace 下載...")
            os.makedirs(MODEL_PATH, exist_ok=True)
            snapshot_download(
                repo_id="Lightricks/LTX-Video",
                local_dir=MODEL_PATH,
                token=os.getenv("HF_TOKEN"),
                local_dir_use_symlinks=False # 確保檔案實體寫入 Volume
            )
            print(f"[LTX-Modal] 下載完成，即刻寫入 Volume。")
            vol.commit()
            found_path = MODEL_PATH
            
        self.current_model_path = found_path
        print(f"[LTX-Modal] 啟動容器，準備載入模型權重: {self.current_model_path}")
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.dtype = torch.float16 if self.device == "cuda" else torch.float32
        
        # 如果是 A10G (24GB)，我們使用 Float16，並搭配強力的 Offload 策略
        self.current_model_path = found_path
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.dtype = torch.float16 # A10G 建議使用 float16
        
        self._kwargs = dict(
            torch_dtype=self.dtype,
            local_files_only=True,
            low_cpu_mem_usage=True,
        )
        
        # --- 預先載入 T2V Pipeline ---
        print(f"[LTX-Modal] 正在 GPU 預熱 T2V Pipeline (使用 Offload 策略)...")
        self.t2v_pipe = LTXPipeline.from_pretrained(self.current_model_path, **self._kwargs)
        
        # VRAM 最強優化: Sequential Offload (雖然慢一點，但絕對不會 OOM)
        self.t2v_pipe.enable_sequential_cpu_offload() 
        self.t2v_pipe.vae.enable_tiling()
        self.t2v_pipe.vae.enable_slicing()
        self.t2v_pipe.enable_attention_slicing()
        
        self.i2v_pipe = None
        print(f"[LTX-Modal] Setup 完成, 共耗時 {time.time() - start_time:.2f} 秒")
        
    def _get_pipe(self, pipe_type: str):
        import torch
        import gc
        from diffusers import LTXPipeline, LTXImageToVideoPipeline
        
        # 強制清理 VRAM
        torch.cuda.empty_cache()
        gc.collect()
        
        if pipe_type == "t2v":
            if self.i2v_pipe is not None:
                print("[LTX-Modal] 切換 T2V, 卸載 I2V...")
                del self.i2v_pipe
                self.i2v_pipe = None
                torch.cuda.empty_cache()
                gc.collect()
            if self.t2v_pipe is None:
                print(f"[LTX-Modal] 載入 T2V Pipeline from {self.current_model_path}...")
                self.t2v_pipe = LTXPipeline.from_pretrained(self.current_model_path, **self._kwargs)
                self.t2v_pipe.enable_model_cpu_offload()
                self.t2v_pipe.vae.enable_tiling()
                self.t2v_pipe.vae.enable_slicing()
            return self.t2v_pipe
            
        elif pipe_type == "i2v":
            if self.t2v_pipe is not None:
                print("[LTX-Modal] 切換 I2V, 卸載 T2V...")
                del self.t2v_pipe
                self.t2v_pipe = None
                torch.cuda.empty_cache()
                gc.collect()
            if self.i2v_pipe is None:
                print(f"[LTX-Modal] 載入 I2V Pipeline from {self.current_model_path}...")
                self.i2v_pipe = LTXImageToVideoPipeline.from_pretrained(self.current_model_path, **self._kwargs)
                self.i2v_pipe.enable_model_cpu_offload()
                self.i2v_pipe.vae.enable_tiling()
                self.i2v_pipe.vae.enable_slicing()
            return self.i2v_pipe

    @modal.method()
    def generate(self, req: VideoRequest) -> dict:
        """影片生成主邏輯，結合 Upstash 同步與 R2 儲存"""
        import torch
        import tempfile
        import uuid
        import boto3
        import redis
        from diffusers.utils import export_to_video, load_image
        
        import time
        task_id = str(uuid.uuid4())
        start_time = time.time()
        print(f"[LTX-Modal] [{task_id}] 開始生成任務, prompt: {req.prompt[:50]}...")
        
        try:
            width, height = map(int, req.resolution.split("x"))
            
            # 確保長寬能被 32 整除 (LTX-Video 限制)
            width = (width // 32) * 32
            height = (height // 32) * 32
            
            num_frames = req.duration * 24
            num_frames = (num_frames // 8) * 8 + 1
            generator = torch.Generator(device="cpu").manual_seed(42)

            if req.image_uri:
                pipe = self._get_pipe("i2v")
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
                pipe = self._get_pipe("t2v")
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
            inference_time = time.time() - start_time
            print(f"[LTX-Modal] [{task_id}] 推論完成 (耗時: {inference_time:.2f} 秒)，準備上傳至 R2...")
            
            import httpx
            
            # --- 步驟 2: 上傳至 Cloudflare R2 ---
            provider = os.getenv("CLOUD_STORAGE_PROVIDER", "r2")
            bucket_name = os.getenv("R2_BUCKET_NAME", "kingjam-media")
            endpoint_url = os.getenv("R2_ENDPOINT_URL")
            public_url = os.getenv("R2_PUBLIC_URL")
            
            print(f"[LTX-Modal] [{task_id}] Connecting to R2 Endpoint: {endpoint_url}")
            
            from botocore.config import Config
            s3_client = boto3.client(
                's3',
                endpoint_url=endpoint_url,
                aws_access_key_id=os.getenv("R2_ACCESS_KEY_ID"),
                aws_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY"),
                region_name="auto", # for cloudflare R2
                config=Config(
                    signature_version='s3v4',
                )
            )
            
            from datetime import datetime
            import hashlib
            now = datetime.utcnow()
            unique_str = f"{req.user_id}_{now.timestamp()}_{task_id}"
            file_hash = hashlib.md5(unique_str.encode()).hexdigest()[:8]
            object_key = f"videos/{req.user_id}/{now.year}/{now.month:02d}/{file_hash}_{now.strftime('%H%M%S')}.mp4"
            
            with open(output_path, 'rb') as f:
                s3_client.upload_fileobj(
                    f,
                    bucket_name,
                    object_key,
                    ExtraArgs={
                        'ContentType': "video/mp4",
                        'CacheControl': 'public, max-age=31536000',
                    }
                )
                
            video_url = f"{public_url.rstrip('/')}/{object_key}" if public_url else f"{endpoint_url}/{bucket_name}/{object_key}"
            print(f"[LTX-Modal] [{task_id}] 上傳成功: {video_url}")
            
            return {
                "success": True,
                "task_id": task_id,
                "video_url": video_url,
                "object_key": object_key
            }
            
        except Exception as e:
            print(f"[LTX-Modal] [{task_id}] 執行錯誤: {e}")
            return {
                "success": False,
                "task_id": task_id,
                "error": str(e)
            }
        finally:
            if "output_path" in locals() and os.path.exists(output_path):
                os.remove(output_path)


# ── 伺服器端: FastAPI 與非同步輪詢機制 ──

job_store = modal.Dict.from_name("kingjam-ltx-jobs", create_if_missing=True)

@app.function(image=image, timeout=1800, secrets=[modal.Secret.from_name("king-jam-secrets"), modal.Secret.from_name("hf-secret")])
def orchestrate_generation(task_id: str, req: VideoRequest):
    """背景處理負責呼叫 LTXVideoInference 生成影片並寫入狀態"""
    import os
    # 真正的處理開始，將狀態從 queuing 更新為 processing
    job_store[task_id] = {"status": "processing", "video_url": None, "error": None}
    
    print(f"[LTX-Orchestrator] [{task_id}] 開始協作生成任務, model={req.model}, res={req.resolution}, duration={req.duration}...")
    try:
        # 使用 .spawn() 確保是真正的非同步平行處理
        res = LTXVideoInference().generate.remote(req)
        if res.get("success"):
            print(f"[LTX-Orchestrator] [{task_id}] 生成成功: {res.get('video_url')}")
            job_store[task_id] = {"status": "completed", "video_url": res["video_url"], "error": None}
        else:
            err = res.get("error", "Unknown error")
            print(f"[LTX-Orchestrator] [{task_id}] 生成失敗: {err}")
            job_store[task_id] = {"status": "error", "video_url": None, "error": err}
    except Exception as e:
        print(f"[LTX-Orchestrator] [{task_id}] 協作程序崩潰: {e}")
        job_store[task_id] = {"status": "error", "video_url": None, "error": str(e)}

from fastapi import FastAPI, Request

web_app = FastAPI(title="LTX-2 Inference Server")

@web_app.post("/v1/text-to-video")
@web_app.post("/v1/image-to-video")
async def submit_job(req: VideoRequest):
    import uuid
    task_id = str(uuid.uuid4())
    # 初始狀態設為 queuing，直到 orchestrator 被喚醒 (冷啟動)
    job_store[task_id] = {"status": "queuing", "video_url": None, "error": None}
    
    # 觸發背景任務，不會阻塞 HTTP 回應
    orchestrate_generation.spawn(task_id, req)
    
    return {"task_id": task_id, "status": "processing"}

@web_app.get("/v1/status/{task_id}")
async def get_status(task_id: str):
    res = job_store.get(task_id)
    if not res:
        return {"status": "error", "error": "Task not found"}
    return res

@app.function(image=image)
@modal.asgi_app()
def api():
    """開放對外 Web Endpoint"""
    return web_app

@app.local_entrypoint()
def trigger_generation(prompt: str = "A cinematic drone shot of a futuristic city with flying cars at sunset, 4k, highly detailed"):
    """本地測試 Entrypoint"""
    req = VideoRequest(
        user_id=1,
        prompt=prompt,
        duration=5
    )
    result = LTXVideoInference().generate.remote(req)
    print("Result:", result)
