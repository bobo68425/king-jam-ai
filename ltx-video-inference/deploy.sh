#!/bin/bash
# ============================================================
# Deploy LTX-2.3 Inference Server to Google Cloud Run
# ============================================================
# LTX-2.3 需要:
#   - GPU: NVIDIA L4 (24GB) 或 A100 (40/80GB)
#   - VRAM: >= 24GB (distilled w/ offloading), 推薦 80GB
#   - 模型權重 ~50GB (GCS 掛載)
#   - Python >= 3.12, CUDA >= 12.7
# ============================================================

set -e

export PROJECT_ID=$(gcloud config get-value project)
export REGION="asia-southeast1"
export SERVICE_NAME="ltx-inference-v2"
export IMAGE_URL="asia-east1-docker.pkg.dev/${PROJECT_ID}/kingjam-repo/ltx-inference-v2:latest"
export MODEL_BUCKET="kingjam-media"
export MODEL_GCS_PATH="ltx-models/ltx-2.3"

echo "============================================================"
echo " LTX-2.3 Inference Server Deployment"
echo "============================================================"
echo "Project:  ${PROJECT_ID}"
echo "Region:   ${REGION}"
echo "Service:  ${SERVICE_NAME}"
echo "Model:    LTX-2.3 (22B Distilled)"
echo "============================================================"

echo ""
echo "[1/3] Building Docker image..."
gcloud builds submit --tag ${IMAGE_URL} .

echo ""
echo "[2/3] Deploying to Cloud Run with A100 GPU..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_URL} \
  --region ${REGION} \
  --allow-unauthenticated \
  --memory 32Gi \
  --cpu 8 \
  --gpu 1 \
  --gpu-type nvidia-a100-80gb \
  --min-instances 0 \
  --max-instances 2 \
  --timeout 3600 \
  --set-env-vars="MODEL_DIR=/models/${MODEL_GCS_PATH},GEMMA_DIR=/models/ltx-models/gemma-3,LTX_CHECKPOINT=ltx-2.3-22b-distilled.safetensors,LTX_UPSCALER=ltx-2.3-spatial-upscaler-x2-1.0.safetensors,LTX_LORA=ltx-2.3-22b-distilled-lora-384.safetensors" \
  --add-volume=name=ltx-models,type=cloud-storage,bucket=${MODEL_BUCKET},readonly=true \
  --add-volume-mount=volume=ltx-models,mount-path=/models

echo ""
echo "[3/3] Deployment finished."
echo "============================================================"
echo "Model weights: gs://${MODEL_BUCKET}/${MODEL_GCS_PATH}"
echo ""
echo "Required model files in GCS:"
echo "  gs://${MODEL_BUCKET}/${MODEL_GCS_PATH}/ltx-2.3-22b-distilled.safetensors       (~46 GB)"
echo "  gs://${MODEL_BUCKET}/${MODEL_GCS_PATH}/ltx-2.3-spatial-upscaler-x2-1.0.safetensors (~1 GB)"
echo "  gs://${MODEL_BUCKET}/${MODEL_GCS_PATH}/ltx-2.3-22b-distilled-lora-384.safetensors  (~7.6 GB)"
echo "  gs://${MODEL_BUCKET}/ltx-models/gemma-3/  (Gemma-3 text encoder)"
echo "============================================================"
