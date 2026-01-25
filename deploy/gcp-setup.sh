#!/bin/bash
# =============================================================================
# King Jam AI - GCP 基礎設施設置腳本
# =============================================================================

set -e

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  King Jam AI - GCP 部署設置${NC}"
echo -e "${GREEN}========================================${NC}"

# 檢查必要參數
if [ -z "$GCP_PROJECT_ID" ]; then
    echo -e "${RED}錯誤: 請設置 GCP_PROJECT_ID 環境變數${NC}"
    echo "使用方式: GCP_PROJECT_ID=your-project-id ./gcp-setup.sh"
    exit 1
fi

REGION="${GCP_REGION:-asia-east1}"
DB_INSTANCE_NAME="${DB_INSTANCE_NAME:-kingjam-db}"
REDIS_INSTANCE_NAME="${REDIS_INSTANCE_NAME:-kingjam-redis}"
STORAGE_BUCKET="${STORAGE_BUCKET:-${GCP_PROJECT_ID}-kingjam-uploads}"

echo -e "\n${YELLOW}配置資訊:${NC}"
echo "  專案 ID: $GCP_PROJECT_ID"
echo "  區域: $REGION"
echo "  資料庫名稱: $DB_INSTANCE_NAME"
echo "  Redis 名稱: $REDIS_INSTANCE_NAME"
echo "  儲存桶: $STORAGE_BUCKET"
echo ""

# 設置專案
echo -e "\n${GREEN}[1/7] 設置 GCP 專案...${NC}"
gcloud config set project $GCP_PROJECT_ID

# 啟用必要的 API
echo -e "\n${GREEN}[2/7] 啟用必要的 GCP API...${NC}"
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  artifactregistry.googleapis.com \
  vpcaccess.googleapis.com

echo -e "${GREEN}API 啟用完成${NC}"

# 建立 Cloud SQL 執行個體
echo -e "\n${GREEN}[3/7] 建立 Cloud SQL 執行個體...${NC}"
if gcloud sql instances describe $DB_INSTANCE_NAME --project=$GCP_PROJECT_ID &>/dev/null; then
    echo -e "${YELLOW}Cloud SQL 執行個體已存在，跳過建立${NC}"
else
    gcloud sql instances create $DB_INSTANCE_NAME \
      --database-version=POSTGRES_15 \
      --tier=db-f1-micro \
      --region=$REGION \
      --storage-type=SSD \
      --storage-size=10GB \
      --storage-auto-increase \
      --backup-start-time=03:00 \
      --maintenance-window-day=SUN \
      --maintenance-window-hour=04 \
      --availability-type=zonal
    
    echo -e "${GREEN}Cloud SQL 執行個體建立完成${NC}"
    
    # 建立資料庫
    gcloud sql databases create kingjam_db --instance=$DB_INSTANCE_NAME
    
    # 建立用戶（會提示輸入密碼）
    echo -e "${YELLOW}請設置資料庫密碼:${NC}"
    gcloud sql users create kingjam \
      --instance=$DB_INSTANCE_NAME \
      --password=$(openssl rand -base64 24)
fi

# 建立 VPC Connector（Cloud Run 連接 Cloud SQL 需要）
echo -e "\n${GREEN}[4/7] 建立 VPC Connector...${NC}"
if gcloud compute networks vpc-access connectors describe kingjam-connector --region=$REGION &>/dev/null; then
    echo -e "${YELLOW}VPC Connector 已存在，跳過建立${NC}"
else
    gcloud compute networks vpc-access connectors create kingjam-connector \
      --region=$REGION \
      --range=10.8.0.0/28
    echo -e "${GREEN}VPC Connector 建立完成${NC}"
fi

# 建立 Memorystore Redis
echo -e "\n${GREEN}[5/7] 建立 Memorystore Redis...${NC}"
if gcloud redis instances describe $REDIS_INSTANCE_NAME --region=$REGION &>/dev/null; then
    echo -e "${YELLOW}Redis 執行個體已存在，跳過建立${NC}"
else
    gcloud redis instances create $REDIS_INSTANCE_NAME \
      --size=1 \
      --region=$REGION \
      --redis-version=redis_7_0 \
      --tier=basic
    echo -e "${GREEN}Redis 執行個體建立完成${NC}"
fi

# 建立 Cloud Storage 儲存桶
echo -e "\n${GREEN}[6/7] 建立 Cloud Storage 儲存桶...${NC}"
if gsutil ls -b gs://$STORAGE_BUCKET &>/dev/null; then
    echo -e "${YELLOW}儲存桶已存在，跳過建立${NC}"
else
    gsutil mb -l $REGION gs://$STORAGE_BUCKET
    gsutil cors set cors-config.json gs://$STORAGE_BUCKET 2>/dev/null || true
    gsutil iam ch allUsers:objectViewer gs://$STORAGE_BUCKET  # 公開讀取
    echo -e "${GREEN}儲存桶建立完成${NC}"
fi

# 建立 Artifact Registry 倉庫
echo -e "\n${GREEN}[7/7] 建立 Artifact Registry 倉庫...${NC}"
if gcloud artifacts repositories describe kingjam-repo --location=$REGION &>/dev/null; then
    echo -e "${YELLOW}Artifact Registry 已存在，跳過建立${NC}"
else
    gcloud artifacts repositories create kingjam-repo \
      --repository-format=docker \
      --location=$REGION \
      --description="King Jam AI Docker images"
    echo -e "${GREEN}Artifact Registry 建立完成${NC}"
fi

# 輸出連線資訊
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  設置完成！${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${YELLOW}重要資訊:${NC}"
echo ""

# 取得 Cloud SQL 連線資訊
SQL_CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE_NAME --format='value(connectionName)')
echo -e "Cloud SQL 連線名稱: ${GREEN}$SQL_CONNECTION_NAME${NC}"

# 取得 Redis IP
REDIS_IP=$(gcloud redis instances describe $REDIS_INSTANCE_NAME --region=$REGION --format='value(host)' 2>/dev/null || echo "建立中...")
echo -e "Redis IP: ${GREEN}$REDIS_IP${NC}"

echo -e "\n${YELLOW}下一步:${NC}"
echo "1. 記錄以上連線資訊"
echo "2. 設置 Secret Manager 密鑰"
echo "3. 執行 ./deploy-backend.sh 部署後端"
echo ""
echo -e "${GREEN}完成！${NC}"
