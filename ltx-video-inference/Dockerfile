# =============================================================================
# King Jam AI - LTX Inference (TensorRT + CUDA 12.4 Optimized for L4 GPU)
# =============================================================================
# Base: PyTorch + CUDA 12.4 + cuDNN 9 (Ada Lovelace / Compute Capability 8.9)
# TensorRT Python bindings are installed via pip (no need for the heavy NGC image)
# GCS volume mount is handled by Cloud Run --add-volume (no gcsfuse needed in image)
# =============================================================================
FROM pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime

ENV PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    PIP_ROOT_USER_ACTION=ignore \
    # L4 GPU (Ada Lovelace) — Compute Capability 8.9
    TORCH_CUDA_ARCH_LIST="8.9" \
    # Tell diffusers/xformers to use the CUDA path
    LD_LIBRARY_PATH=/usr/local/cuda/lib64:$LD_LIBRARY_PATH

WORKDIR /app

# ── System dependencies ────────────────────────────────────────────────────────
# ffmpeg: required for video encoding via imageio/imageio-ffmpeg
# libsm6/libxext6: required by OpenCV (used by diffusers image utils)
# google-cloud-sdk: provides gsutil for video upload to GCS
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsm6 \
    libxext6 \
    curl \
    gnupg \
    && curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" \
    > /etc/apt/sources.list.d/google-cloud-sdk.list \
    && apt-get update && apt-get install -y --no-install-recommends google-cloud-cli \
    && rm -rf /var/lib/apt/lists/*

# ── Python dependencies ────────────────────────────────────────────────────────
COPY requirements.txt .

# Install TensorRT Python bindings first (compatible with CUDA 12.4)
# Then install the rest of the project dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    # Install TensorRT Python bindings AFTER other deps (avoid resolver conflicts)
    pip install --no-cache-dir --no-deps \
    tensorrt==10.3.0 \
    tensorrt-cu12-bindings==10.3.0 \
    tensorrt-cu12-libs==10.3.0

# ── Application code ───────────────────────────────────────────────────────────
# NOTE: Model weights are NOT baked into this image.
# They are mounted from GCS at runtime via Cloud Run volume:
#   --add-volume name=ltx-models,type=cloud-storage,bucket=kingjam-media \
#   --add-volume-mount volume=ltx-models,mount-path=/models
COPY . .

EXPOSE 8080

# uvicorn with 1 worker (GPU inference must be single-process)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--timeout-keep-alive", "900"]
