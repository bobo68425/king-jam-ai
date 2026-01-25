#!/bin/bash
# =============================================================================
# King Jam AI - 後端部署腳本 (Cloud Run)
# =============================================================================

set -e

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  King Jam AI - 後端部署${NC}"
echo -e "${GREEN}========================================${NC}"

# 檢查必要參數
if [ -z "$GCP_PROJECT_ID" ]; then
    echo -e "${RED}錯誤: 請設置 GCP_PROJECT_ID 環境變數${NC}"
    exit 1
fi

REGION="${GCP_REGION:-asia-east1}"
SERVICE_NAME="${SERVICE_NAME:-kingjam-api}"
IMAGE_NAME="${REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/kingjam-repo/${SERVICE_NAME}"

echo -e "\n${YELLOW}部署配置:${NC}"
echo "  專案: $GCP_PROJECT_ID"
echo "  區域: $REGION"
echo "  服務名稱: $SERVICE_NAME"
echo "  映像檔: $IMAGE_NAME"
echo ""

# 切換到 backend 目錄
cd "$(dirname "$0")/../backend"

# 建立 Docker 映像檔
echo -e "\n${GREEN}[1/3] 建立 Docker 映像檔...${NC}"
docker build -f Dockerfile.prod -t $IMAGE_NAME:latest .

# 推送到 Artifact Registry
echo -e "\n${GREEN}[2/3] 推送映像檔到 Artifact Registry...${NC}"
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet
docker push $IMAGE_NAME:latest

# 部署到 Cloud Run
echo -e "\n${GREEN}[3/3] 部署到 Cloud Run...${NC}"

# 取得 Cloud SQL 連線名稱
SQL_CONNECTION_NAME=$(gcloud sql instances describe kingjam-db --format='value(connectionName)' 2>/dev/null || echo "")

# 取得 Redis IP
REDIS_IP=$(gcloud redis instances describe kingjam-redis --region=$REGION --format='value(host)' 2>/dev/null || echo "")

# 部署命令
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME:latest \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --port 8080 \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 10 \
    --timeout 300 \
    --concurrency 80 \
    --set-env-vars "ENVIRONMENT=production" \
    --set-env-vars "FRONTEND_URL=https://kingjam.app" \
    --set-env-vars "BACKEND_URL=https://api.kingjam.app" \
    ${SQL_CONNECTION_NAME:+--add-cloudsql-instances=$SQL_CONNECTION_NAME} \
    --vpc-connector kingjam-connector \
    --vpc-egress all-traffic

# 取得服務 URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)')

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "服務 URL: ${GREEN}$SERVICE_URL${NC}"
echo ""
echo -e "${YELLOW}下一步:${NC}"
echo "1. 設置自訂網域: gcloud run domain-mappings create --service=$SERVICE_NAME --domain=api.kingjam.app --region=$REGION"
echo "2. 在 Cloudflare 設置 DNS CNAME 指向 ghs.googlehosted.com"
echo ""
