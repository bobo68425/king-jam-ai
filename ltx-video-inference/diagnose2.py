"""查看 LoraPathStrengthAndSDOps 的正確用法"""
import modal

app = modal.App("ltx-diag2")
image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("git")
    .pip_install("numpy<2", "torch>=2.7.0", "safetensors>=0.4.0", "transformers>=4.51.0", "accelerate>=1.6.0", "sentencepiece>=0.2.0", "huggingface_hub>=0.28.0")
    .run_commands("git clone --depth 1 https://github.com/Lightricks/LTX-2.git /opt/ltx2", "cd /opt/ltx2 && pip install packages/ltx-core packages/ltx-pipelines")
)

@app.function(image=image, timeout=120)
def check_api():
    import inspect
    from ltx_core.loader import LoraPathStrengthAndSDOps
    print(f"Type: {type(LoraPathStrengthAndSDOps)}")
    print(f"Fields: {LoraPathStrengthAndSDOps._fields if hasattr(LoraPathStrengthAndSDOps, '_fields') else 'N/A'}")
    print(f"Source:\n{inspect.getsource(LoraPathStrengthAndSDOps)}")
    
    from ltx_pipelines.ti2vid_two_stages import TI2VidTwoStagesPipeline
    sig = inspect.signature(TI2VidTwoStagesPipeline.__init__)
    print(f"\nPipeline __init__ full sig:\n{sig}")

    # Check __call__ too
    if hasattr(TI2VidTwoStagesPipeline, '__call__'):
        sig2 = inspect.signature(TI2VidTwoStagesPipeline.__call__)
        print(f"\nPipeline __call__ sig:\n{sig2}")

    return "done"

@app.local_entrypoint()
def main():
    check_api.remote()
