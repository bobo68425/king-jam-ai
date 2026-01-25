#!/bin/bash
# =============================================================================
# King Jam AI - 資料庫遷移腳本
# 用於在 Cloud SQL 上執行 Alembic 遷移
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  King Jam AI - 資料庫遷移${NC}"
echo -e "${GREEN}========================================${NC}"

if [ -z "$GCP_PROJECT_ID" ]; then
    echo -e "${RED}錯誤: 請設置 GCP_PROJECT_ID 環境變數${NC}"
    exit 1
fi

REGION="${GCP_REGION:-asia-east1}"
DB_INSTANCE="${DB_INSTANCE:-kingjam-db}"

echo -e "\n${YELLOW}連線資訊:${NC}"
echo "  專案: $GCP_PROJECT_ID"
echo "  執行個體: $DB_INSTANCE"
echo ""

# 方法 1: 使用 Cloud SQL Auth Proxy（推薦用於本地執行）
echo -e "${YELLOW}選擇遷移方式:${NC}"
echo "1. 使用 Cloud SQL Auth Proxy（本地執行）"
echo "2. 使用 Cloud Run Job（雲端執行）"
echo ""
read -p "請選擇 (1/2): " choice

case $choice in
    1)
        echo -e "\n${GREEN}啟動 Cloud SQL Auth Proxy...${NC}"
        
        # 檢查 cloud-sql-proxy 是否安裝
        if ! command -v cloud-sql-proxy &> /dev/null; then
            echo -e "${YELLOW}正在安裝 Cloud SQL Auth Proxy...${NC}"
            curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.amd64
            chmod +x cloud-sql-proxy
            sudo mv cloud-sql-proxy /usr/local/bin/
        fi
        
        # 取得連線名稱
        CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE --format='value(connectionName)')
        
        echo -e "${GREEN}連線名稱: $CONNECTION_NAME${NC}"
        echo ""
        echo -e "${YELLOW}請在另一個終端機執行:${NC}"
        echo "cloud-sql-proxy $CONNECTION_NAME &"
        echo ""
        echo -e "${YELLOW}然後在 backend 目錄執行:${NC}"
        echo "export DATABASE_URL='postgresql://kingjam:PASSWORD@localhost:5432/kingjam_db'"
        echo "alembic upgrade head"
        ;;
        
    2)
        echo -e "\n${GREEN}建立 Cloud Run Job 執行遷移...${NC}"
        
        # 建立遷移用的 Cloud Run Job
        gcloud run jobs create kingjam-migrate \
            --image ${REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/kingjam-repo/kingjam-api:latest \
            --region $REGION \
            --set-env-vars "ENVIRONMENT=production" \
            --add-cloudsql-instances ${GCP_PROJECT_ID}:${REGION}:${DB_INSTANCE} \
            --vpc-connector kingjam-connector \
            --command "alembic" \
            --args "upgrade,head" \
            --max-retries 0 \
            2>/dev/null || echo "Job 可能已存在，嘗試更新..."
        
        echo -e "\n${GREEN}執行遷移 Job...${NC}"
        gcloud run jobs execute kingjam-migrate \
            --region $REGION \
            --wait
            
        echo -e "\n${GREEN}查看執行日誌...${NC}"
        gcloud run jobs executions list --job kingjam-migrate --region $REGION --limit 1
        ;;
        
    *)
        echo -e "${RED}無效的選擇${NC}"
        exit 1
        ;;
esac

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  遷移完成！${NC}"
echo -e "${GREEN}========================================${NC}"
