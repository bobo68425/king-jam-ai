#!/bin/bash
# Deploy LTX-2 Inference Server to Google Cloud Run
# Model weights are stored in GCS and mounted via Cloud Run FUSE volume.

set -e

export PROJECT_ID=$(gcloud config get-value project)
export REGION="asia-southeast1"
export SERVICE_NAME="ltx-inference"
export IMAGE_URL="asia-east1-docker.pkg.dev/${PROJECT_ID}/kingjam-repo/ltx-inference:latest"
export MODEL_BUCKET="kingjam-media"
export MODEL_GCS_PATH="ltx-models/LTX-Video"

echo "Building LTX inference image (lightweight, no model weights baked in)..."
gcloud builds submit --tag ${IMAGE_URL} .

echo "Deploying to Cloud Run with L4 GPU + GCS model volume..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_URL} \
  --region ${REGION} \
  --allow-unauthenticated \
  --memory 16Gi \
  --cpu 8 \
  --gpu 1 \
  --gpu-type nvidia-l4 \
  --min-instances 0 \
  --max-instances 1 \
  --timeout 3600 \
  --set-env-vars="MODEL_PATH=/models/ltx-models/LTX-Video" \
  --add-volume=name=ltx-models,type=cloud-storage,bucket=${MODEL_BUCKET},readonly=true \
  --add-volume-mount=volume=ltx-models,mount-path=/models

echo "Deployment finished."
echo "Model weights served from: gs://${MODEL_BUCKET}/${MODEL_GCS_PATH}"
