"""下載 Gemma-3 文字編碼器到 Modal Volume"""
import modal
import os

app = modal.App("gemma-downloader")
vol = modal.Volume.from_name("kingjam-models", create_if_missing=True)
image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "huggingface_hub>=0.28.0", "hf-xet>=1.0.0", "tqdm"
)

GEMMA_DIR = "/models/gemma-3"


@app.function(
    image=image,
    volumes={"/models": vol},
    secrets=[modal.Secret.from_name("hf-secret")],
    timeout=3600,
    memory=8192,
)
def download_gemma():
    import time
    from huggingface_hub import snapshot_download

    os.makedirs(GEMMA_DIR, exist_ok=True)

    marker = os.path.join(GEMMA_DIR, "config.json")
    if os.path.exists(marker):
        print("Gemma-3 已存在於 Volume, 跳過")
        return "already_exists"

    print("=" * 50)
    print("  下載 google/gemma-3-4b-pt ...")
    print("=" * 50)

    start = time.time()
    snapshot_download(
        repo_id="google/gemma-3-4b-pt",
        local_dir=GEMMA_DIR,
        token=os.getenv("HF_TOKEN"),
    )
    elapsed = time.time() - start
    print(f"\n下載完成, 耗時 {elapsed:.0f}s")

    vol.commit()
    print("Volume committed")

    total = 0
    for root, dirs, files in os.walk(GEMMA_DIR):
        for f in files:
            fp = os.path.join(root, f)
            size = os.path.getsize(fp)
            total += size
            print(f"  {os.path.relpath(fp, GEMMA_DIR)} — {size / (1024**3):.2f} GB")
    print(f"\n總大小: {total / (1024**3):.2f} GB")
    return "success"


@app.local_entrypoint()
def main():
    print("啟動 Gemma-3 下載 (Modal 伺服器端)...")
    result = download_gemma.remote()
    print(f"\n結果: {result}")
