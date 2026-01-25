#!/bin/bash
# =============================================================================
# King Jam AI - Secret Manager 設置腳本
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  King Jam AI - Secret Manager 設置${NC}"
echo -e "${GREEN}========================================${NC}"

if [ -z "$GCP_PROJECT_ID" ]; then
    echo -e "${RED}錯誤: 請設置 GCP_PROJECT_ID 環境變數${NC}"
    exit 1
fi

# 檢查 .env.production 檔案
ENV_FILE="${1:-.env.production}"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}錯誤: 找不到環境變數檔案 $ENV_FILE${NC}"
    echo "請先建立 .env.production 檔案，或指定檔案路徑"
    echo "使用方式: ./setup-secrets.sh [env-file-path]"
    exit 1
fi

echo -e "\n${YELLOW}讀取環境變數檔案: $ENV_FILE${NC}"

# 需要建立的密鑰列表
SECRETS=(
    "DATABASE_URL"
    "SECRET_KEY"
    "REDIS_URL"
    "GOOGLE_CLIENT_ID"
    "GOOGLE_CLIENT_SECRET"
    "FACEBOOK_APP_ID"
    "FACEBOOK_APP_SECRET"
    "ECPAY_MERCHANT_ID"
    "ECPAY_HASH_KEY"
    "ECPAY_HASH_IV"
    "SENDGRID_API_KEY"
    "GOOGLE_APPLICATION_CREDENTIALS_JSON"
)

echo -e "\n${GREEN}建立/更新 Secret Manager 密鑰...${NC}"

for SECRET_NAME in "${SECRETS[@]}"; do
    # 從 .env 檔案讀取值
    SECRET_VALUE=$(grep "^${SECRET_NAME}=" "$ENV_FILE" | cut -d '=' -f2-)
    
    if [ -z "$SECRET_VALUE" ]; then
        echo -e "${YELLOW}跳過 $SECRET_NAME (未設置)${NC}"
        continue
    fi
    
    # 檢查密鑰是否存在
    if gcloud secrets describe "kingjam-${SECRET_NAME,,}" --project=$GCP_PROJECT_ID &>/dev/null; then
        # 更新現有密鑰
        echo "$SECRET_VALUE" | gcloud secrets versions add "kingjam-${SECRET_NAME,,}" \
            --project=$GCP_PROJECT_ID \
            --data-file=-
        echo -e "${GREEN}✓ 更新 kingjam-${SECRET_NAME,,}${NC}"
    else
        # 建立新密鑰
        echo "$SECRET_VALUE" | gcloud secrets create "kingjam-${SECRET_NAME,,}" \
            --project=$GCP_PROJECT_ID \
            --data-file=- \
            --replication-policy="automatic"
        echo -e "${GREEN}✓ 建立 kingjam-${SECRET_NAME,,}${NC}"
    fi
done

# 授權 Cloud Run 服務帳戶存取密鑰
echo -e "\n${GREEN}設置 IAM 權限...${NC}"
PROJECT_NUMBER=$(gcloud projects describe $GCP_PROJECT_ID --format='value(projectNumber)')
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for SECRET_NAME in "${SECRETS[@]}"; do
    SECRET_LOWER="kingjam-${SECRET_NAME,,}"
    if gcloud secrets describe $SECRET_LOWER --project=$GCP_PROJECT_ID &>/dev/null; then
        gcloud secrets add-iam-policy-binding $SECRET_LOWER \
            --project=$GCP_PROJECT_ID \
            --member="serviceAccount:${SERVICE_ACCOUNT}" \
            --role="roles/secretmanager.secretAccessor" \
            --quiet
    fi
done

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Secret Manager 設置完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}已建立的密鑰:${NC}"
gcloud secrets list --project=$GCP_PROJECT_ID --filter="name:kingjam-" --format="table(name)"
echo ""
