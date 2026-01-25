#!/bin/bash
# =============================================================================
# King Jam AI - 前端部署腳本 (Cloud Run)
# =============================================================================

set -e

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  King Jam AI - 前端部署${NC}"
echo -e "${GREEN}========================================${NC}"

# 檢查必要參數
if [ -z "$GCP_PROJECT_ID" ]; then
    echo -e "${RED}錯誤: 請設置 GCP_PROJECT_ID 環境變數${NC}"
    echo -e "${YELLOW}範例: export GCP_PROJECT_ID=your-project-id${NC}"
    exit 1
fi

REGION="${GCP_REGION:-asia-east1}"
SERVICE_NAME="${SERVICE_NAME:-kingjam-frontend}"
IMAGE_NAME="${REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/kingjam-repo/${SERVICE_NAME}"

# API URL 設定
API_URL="${NEXT_PUBLIC_API_URL:-https://api.kingjam.app}"
SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://kingjam.app}"

echo -e "\n${YELLOW}部署配置:${NC}"
echo "  專案: $GCP_PROJECT_ID"
echo "  區域: $REGION"
echo "  服務名稱: $SERVICE_NAME"
echo "  映像檔: $IMAGE_NAME"
echo "  API URL: $API_URL"
echo "  Site URL: $SITE_URL"
echo ""

# 切換到 frontend 目錄
cd "$(dirname "$0")/../frontend"

# 建立 Docker 映像檔
echo -e "\n${GREEN}[1/3] 建立 Docker 映像檔...${NC}"
docker build \
    --build-arg NEXT_PUBLIC_API_URL=$API_URL \
    --build-arg NEXT_PUBLIC_SITE_URL=$SITE_URL \
    -t $IMAGE_NAME:latest \
    .

# 檢查映像檔大小
IMAGE_SIZE=$(docker images $IMAGE_NAME:latest --format "{{.Size}}")
echo -e "${BLUE}映像檔大小: $IMAGE_SIZE${NC}"

# 推送到 Artifact Registry
echo -e "\n${GREEN}[2/3] 推送映像檔到 Artifact Registry...${NC}"
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet
docker push $IMAGE_NAME:latest

# 部署到 Cloud Run
echo -e "\n${GREEN}[3/3] 部署到 Cloud Run...${NC}"

gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME:latest \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --port 8080 \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 10 \
    --timeout 60 \
    --concurrency 100 \
    --set-env-vars "NODE_ENV=production,NEXT_PUBLIC_API_URL=$API_URL,NEXT_PUBLIC_SITE_URL=$SITE_URL"

# 取得服務 URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)')

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "服務 URL: ${GREEN}$SERVICE_URL${NC}"
echo ""
echo -e "${YELLOW}下一步:${NC}"
echo "1. 設置自訂網域: gcloud run domain-mappings create --service=$SERVICE_NAME --domain=kingjam.app --region=$REGION"
echo "2. 在 Cloudflare 設置 DNS CNAME 指向 ghs.googlehosted.com"
echo ""

# 健康檢查
echo -e "${BLUE}執行健康檢查...${NC}"
sleep 10
if curl -sf "$SERVICE_URL" > /dev/null; then
    echo -e "${GREEN}✅ 健康檢查通過！${NC}"
else
    echo -e "${YELLOW}⚠️ 健康檢查失敗，服務可能需要更多時間啟動${NC}"
fi
