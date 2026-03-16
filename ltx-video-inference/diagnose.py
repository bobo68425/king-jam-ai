"""診斷 LTX-2.3 容器啟動失敗原因"""
import modal
import os

app = modal.App("ltx-diagnose")

vol = modal.Volume.from_name("kingjam-models", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg", "git")
    .pip_install(
        "numpy<2",
        "torch>=2.7.0",
        "safetensors>=0.4.0",
        "transformers>=4.51.0",
        "accelerate>=1.6.0",
        "sentencepiece>=0.2.0",
        "huggingface_hub>=0.28.0",
    )
    .run_commands(
        "git clone --depth 1 https://github.com/Lightricks/LTX-2.git /opt/ltx2",
        "cd /opt/ltx2 && pip install packages/ltx-core packages/ltx-pipelines",
    )
)


@app.function(
    image=image,
    gpu="A100-80GB",
    volumes={"/models": vol},
    secrets=[modal.Secret.from_name("hf-secret")],
    timeout=600,
)
def diagnose():
    import traceback

    print("=" * 60)
    print("  LTX-2.3 Diagnostic")
    print("=" * 60)

    # 1. Check model files
    print("\n[1] Model files on Volume:")
    for d in ["/models/ltx-2.3", "/models/gemma-3"]:
        if os.path.isdir(d):
            files = os.listdir(d)
            print(f"  {d}: {len(files)} files")
            for f in sorted(files):
                fp = os.path.join(d, f)
                if os.path.isfile(fp):
                    print(f"    {f} ({os.path.getsize(fp) / 1e9:.2f} GB)")
        else:
            print(f"  {d}: NOT FOUND")

    # 2. Check ltx-pipelines package
    print("\n[2] ltx-pipelines package:")
    try:
        import ltx_pipelines
        print(f"  location: {ltx_pipelines.__file__}")
        print(f"  dir: {dir(ltx_pipelines)}")
    except Exception as e:
        print(f"  IMPORT ERROR: {e}")

    # 3. Check available classes
    print("\n[3] Available pipeline classes:")
    try:
        from ltx_pipelines import ti2vid_two_stages
        print(f"  ti2vid_two_stages: {dir(ti2vid_two_stages)}")
    except Exception as e:
        print(f"  ti2vid_two_stages IMPORT ERROR: {e}")

    try:
        from ltx_pipelines.ti2vid_two_stages import TI2VidTwoStagesPipeline
        print(f"  TI2VidTwoStagesPipeline: OK")

        import inspect
        sig = inspect.signature(TI2VidTwoStagesPipeline.__init__)
        print(f"  __init__ params: {list(sig.parameters.keys())}")
    except Exception as e:
        print(f"  TI2VidTwoStagesPipeline ERROR: {e}")
        traceback.print_exc()

    # 4. Check ltx_core
    print("\n[4] ltx_core package:")
    try:
        import ltx_core
        print(f"  location: {ltx_core.__file__}")
    except Exception as e:
        print(f"  IMPORT ERROR: {e}")

    try:
        from ltx_core.loader import LoraPathStrengthAndSDOps
        print(f"  LoraPathStrengthAndSDOps: OK")
    except Exception as e:
        print(f"  LoraPathStrengthAndSDOps ERROR: {e}")
        traceback.print_exc()

    # 5. Try instantiating the pipeline
    print("\n[5] Try loading pipeline:")
    try:
        from ltx_pipelines.ti2vid_two_stages import TI2VidTwoStagesPipeline
        from ltx_core.loader import LoraPathStrengthAndSDOps

        ckpt = "/models/ltx-2.3/ltx-2.3-22b-distilled.safetensors"
        upscaler = "/models/ltx-2.3/ltx-2.3-spatial-upscaler-x2-1.0.safetensors"
        lora = "/models/ltx-2.3/ltx-2.3-22b-distilled-lora-384.safetensors"
        gemma = "/models/gemma-3"

        print(f"  ckpt exists: {os.path.exists(ckpt)}")
        print(f"  upscaler exists: {os.path.exists(upscaler)}")
        print(f"  lora exists: {os.path.exists(lora)}")
        print(f"  gemma exists: {os.path.isdir(gemma)}")

        pipeline = TI2VidTwoStagesPipeline(
            checkpoint_path=ckpt,
            spatial_upsampler_path=upscaler,
            gemma_root=gemma,
            distilled_lora=[LoraPathStrengthAndSDOps(path=lora, strength=1)],
        )
        print("  Pipeline loaded OK!")
    except Exception as e:
        print(f"  Pipeline LOAD ERROR: {e}")
        traceback.print_exc()

    print("\n" + "=" * 60)
    return "done"


@app.local_entrypoint()
def main():
    print("Running LTX-2.3 diagnostic on Modal GPU...")
    result = diagnose.remote()
    print(f"Result: {result}")
