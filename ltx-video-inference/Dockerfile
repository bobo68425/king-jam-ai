# =============================================================================
# King Jam AI - LTX-2.3 Inference Server (CUDA 12.8 + Python 3.12)
# =============================================================================
# LTX-2.3 需求:
#   - Python >= 3.12
#   - CUDA >= 12.7 (使用 12.8)
#   - PyTorch >= 2.7
#   - A100-80GB GPU (22B 模型)
#
# 模型權重由 GCS / Modal Volume 外部掛載，不包含在映像中
# =============================================================================
FROM nvidia/cuda:12.8.0-runtime-ubuntu22.04

ENV PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    PIP_ROOT_USER_ACTION=ignore \
    LD_LIBRARY_PATH=/usr/local/cuda/lib64:$LD_LIBRARY_PATH

WORKDIR /app

# ── System dependencies ──
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 \
    python3.12-venv \
    python3.12-dev \
    python3-pip \
    ffmpeg \
    libsm6 \
    libxext6 \
    curl \
    git \
    gnupg \
    && curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" \
    > /etc/apt/sources.list.d/google-cloud-sdk.list \
    && apt-get update && apt-get install -y --no-install-recommends google-cloud-cli \
    && rm -rf /var/lib/apt/lists/* \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.12 1 \
    && update-alternatives --install /usr/bin/python python /usr/bin/python3.12 1

# ── Python dependencies ──
COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch>=2.7.0 --index-url https://download.pytorch.org/whl/cu128 && \
    pip install --no-cache-dir -r requirements.txt

# ── Install LTX-2.3 official packages ──
RUN git clone --depth 1 https://github.com/Lightricks/LTX-2.git /opt/ltx2 && \
    cd /opt/ltx2 && pip install --no-cache-dir packages/ltx-core packages/ltx-pipelines

# ── Application code ──
COPY . .

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--timeout-keep-alive", "900"]
