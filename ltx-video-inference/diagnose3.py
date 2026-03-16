"""快速檢查 SDOps 定義和正確用法"""
import modal

app = modal.App("ltx-diag3")
image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("git")
    .pip_install("numpy<2", "torch>=2.7.0", "safetensors>=0.4.0", "transformers>=4.51.0", "accelerate>=1.6.0", "sentencepiece>=0.2.0", "huggingface_hub>=0.28.0")
    .run_commands("git clone --depth 1 https://github.com/Lightricks/LTX-2.git /opt/ltx2", "cd /opt/ltx2 && pip install packages/ltx-core packages/ltx-pipelines")
)

@app.function(image=image, timeout=120)
def check_sdops():
    import inspect

    # Find SDOps
    from ltx_core.loader.primitives import LoraPathStrengthAndSDOps
    print(f"LoraPathStrengthAndSDOps annotations: {LoraPathStrengthAndSDOps.__annotations__}")

    # Check the module where SDOps is defined
    try:
        from ltx_core.loader import sd_ops as sd_ops_mod
        print(f"sd_ops module: {dir(sd_ops_mod)}")
    except ImportError as e:
        print(f"No sd_ops module: {e}")

    # Try finding SDOps
    import ltx_core.loader.primitives as pmod
    src = inspect.getsource(pmod)
    for line in src.split("\n"):
        if "SDOps" in line or "sd_ops" in line:
            print(f"  > {line.strip()}")

    # Try creating with None
    try:
        lora = LoraPathStrengthAndSDOps(path="/test", strength=1.0, sd_ops=None)
        print(f"sd_ops=None works: {lora}")
    except Exception as e:
        print(f"sd_ops=None fails: {e}")

    # Try to find SDOps type
    try:
        from ltx_core.loader.primitives import SDOps
        print(f"SDOps from primitives: {SDOps}")
        print(f"SDOps source: {inspect.getsource(SDOps)[:500]}")
    except ImportError:
        pass

    try:
        from ltx_core.sd_ops import SDOps
        print(f"SDOps from ltx_core.sd_ops: {SDOps}")
    except ImportError:
        pass

    # Search broadly
    import pkgutil, ltx_core
    for importer, modname, ispkg in pkgutil.walk_packages(ltx_core.__path__, prefix="ltx_core."):
        if "sd_op" in modname.lower():
            print(f"Found module: {modname}")

    return "done"

@app.local_entrypoint()
def main():
    check_sdops.remote()
