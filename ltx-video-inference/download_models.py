"""
LTX-2.3 模型下載腳本 (Modal 伺服器端執行)
==========================================
在 Modal 基礎設施上直接從 HuggingFace 下載模型到 Volume，
避免本機下載 50+ GB 檔案。

Usage:
  modal run download_models.py

所需模型:
  1. ltx-2.3-22b-distilled.safetensors       (~46 GB) — 主模型 (Distilled, 8步)
  2. ltx-2.3-spatial-upscaler-x2-1.0.safetensors (~1 GB) — 空間升頻器
  3. ltx-2.3-22b-distilled-lora-384.safetensors  (~7.6 GB) — Distilled LoRA
  4. google/gemma-3-4b-pt                       (~8 GB) — 文字編碼器
"""

import modal
import os

app = modal.App("ltx-model-downloader")

vol = modal.Volume.from_name("kingjam-models", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("huggingface_hub>=0.28.0", "hf-xet>=1.0.0", "tqdm")
)

HF_MODEL_REPO = "Lightricks/LTX-2.3"
HF_GEMMA_REPO = "google/gemma-3-4b-pt"

CHECKPOINT_DIR = "/models/ltx-2.3"
GEMMA_DIR = "/models/gemma-3"

FILES_TO_DOWNLOAD = [
    "ltx-2.3-22b-distilled.safetensors",
    "ltx-2.3-spatial-upscaler-x2-1.0.safetensors",
    "ltx-2.3-22b-distilled-lora-384.safetensors",
]


@app.function(
    image=image,
    volumes={"/models": vol},
    secrets=[modal.Secret.from_name("hf-secret")],
    timeout=7200,
    memory=8192,
)
def download_ltx_models():
    """下載 LTX-2.3 模型權重到 Modal Volume"""
    from huggingface_hub import hf_hub_download
    import time

    hf_token = os.getenv("HF_TOKEN")
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)

    print("=" * 60)
    print("  LTX-2.3 Model Downloader")
    print("=" * 60)
    print(f"  HuggingFace Repo: {HF_MODEL_REPO}")
    print(f"  Target Dir:       {CHECKPOINT_DIR}")
    print(f"  Files:            {len(FILES_TO_DOWNLOAD)}")
    print("=" * 60)

    for i, filename in enumerate(FILES_TO_DOWNLOAD, 1):
        target_path = os.path.join(CHECKPOINT_DIR, filename)

        if os.path.exists(target_path):
            size_gb = os.path.getsize(target_path) / (1024**3)
            print(f"\n[{i}/{len(FILES_TO_DOWNLOAD)}] {filename} — 已存在 ({size_gb:.1f} GB), 跳過")
            continue

        print(f"\n[{i}/{len(FILES_TO_DOWNLOAD)}] 下載 {filename} ...")
        start = time.time()

        hf_hub_download(
            repo_id=HF_MODEL_REPO,
            filename=filename,
            local_dir=CHECKPOINT_DIR,
            token=hf_token,
        )

        elapsed = time.time() - start
        size_gb = os.path.getsize(target_path) / (1024**3)
        speed = size_gb / elapsed * 1024 if elapsed > 0 else 0
        print(f"    完成: {size_gb:.1f} GB, 耗時 {elapsed:.0f}s ({speed:.0f} MB/s)")

    vol.commit()
    print("\n Volume committed (LTX-2.3 checkpoints)")

    # 列出已下載的檔案
    print("\n已下載檔案:")
    for f in os.listdir(CHECKPOINT_DIR):
        fp = os.path.join(CHECKPOINT_DIR, f)
        if os.path.isfile(fp):
            print(f"  {f} — {os.path.getsize(fp) / (1024**3):.2f} GB")


@app.function(
    image=image,
    volumes={"/models": vol},
    secrets=[modal.Secret.from_name("hf-secret")],
    timeout=3600,
    memory=8192,
)
def download_gemma():
    """下載 Gemma-3 文字編碼器到 Modal Volume"""
    from huggingface_hub import snapshot_download
    import time

    hf_token = os.getenv("HF_TOKEN")
    os.makedirs(GEMMA_DIR, exist_ok=True)

    marker = os.path.join(GEMMA_DIR, "config.json")
    if os.path.exists(marker):
        print(f"Gemma-3 已存在於 {GEMMA_DIR}, 跳過")
        vol.commit()
        return

    print("=" * 60)
    print("  Gemma-3 Text Encoder Downloader")
    print("=" * 60)
    print(f"  HuggingFace Repo: {HF_GEMMA_REPO}")
    print(f"  Target Dir:       {GEMMA_DIR}")
    print("=" * 60)

    start = time.time()
    snapshot_download(
        repo_id=HF_GEMMA_REPO,
        local_dir=GEMMA_DIR,
        token=hf_token,
        local_dir_use_symlinks=False,
    )
    elapsed = time.time() - start
    print(f"\n Gemma-3 下載完成, 耗時 {elapsed:.0f}s")

    vol.commit()
    print(" Volume committed (Gemma-3)")

    total_size = 0
    for root, dirs, files in os.walk(GEMMA_DIR):
        for f in files:
            fp = os.path.join(root, f)
            total_size += os.path.getsize(fp)
    print(f"  總大小: {total_size / (1024**3):.2f} GB")


@app.local_entrypoint()
def main():
    """下載所有 LTX-2.3 所需模型"""
    print("\n啟動 LTX-2.3 模型下載 (Modal 伺服器端)...\n")

    print("[Step 1/2] 下載 LTX-2.3 checkpoints...")
    download_ltx_models.remote()

    print("\n[Step 2/2] 下載 Gemma-3 text encoder...")
    download_gemma.remote()

    print("\n" + "=" * 60)
    print("  所有模型下載完成！")
    print("  Volume: kingjam-models")
    print("  LTX-2.3: /models/ltx-2.3/")
    print("  Gemma-3: /models/gemma-3/")
    print("=" * 60)
    print("\n下一步: modal deploy modal_app.py")
