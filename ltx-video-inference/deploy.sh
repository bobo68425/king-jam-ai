#!/bin/bash
# Deploy LTX-2 Inference Server to Google Cloud Run

export PROJECT_ID=$(gcloud config get-value project)
export REGION="asia-east1"
export SERVICE_NAME="ltx-inference"
export IMAGE_URL="asia-east1-docker.pkg.dev/${PROJECT_ID}/kingjam-repo/ltx-inference:latest"

echo "Building LTX inference image..."
# Using Kaniko or standard docker build, pre-baking weights will take some time
gcloud builds submit --tag ${IMAGE_URL} .

echo "Deploying to Cloud Run with L4 GPU..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_URL} \
  --region ${REGION} \
  --allow-unauthenticated \
  --memory 32Gi \
  --cpu 8 \
  --gpu 1 \
  --gpu-type nvidia-l4 \
  --max-instances 1 \
  --timeout 3600 \
  --set-env-vars="HUGGINGFACE_HUB_CACHE=/root/.cache/huggingface"

echo "Deployment finished."
