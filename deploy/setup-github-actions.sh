#!/bin/bash
# =============================================================================
# King Jam AI - GitHub Actions 自動部署設定腳本
# =============================================================================
#
# 此腳本會設定：
# 1. 啟用必要的 GCP API
# 2. 建立 Artifact Registry repository
# 3. 建立服務帳戶並授予權限
# 4. 生成服務帳戶金鑰
#
# 使用方式:
#   export GCP_PROJECT_ID=your-project-id
#   ./setup-github-actions.sh
# =============================================================================

set -e

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     King Jam AI - GitHub Actions 自動部署設定                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# =============================================================================
# 檢查必要參數
# =============================================================================
if [ -z "$GCP_PROJECT_ID" ]; then
    echo -e "${RED}錯誤: 請設置 GCP_PROJECT_ID 環境變數${NC}"
    echo ""
    echo -e "${YELLOW}使用方式:${NC}"
    echo "  export GCP_PROJECT_ID=your-project-id"
    echo "  ./setup-github-actions.sh"
    echo ""
    exit 1
fi

REGION="${GCP_REGION:-asia-east1}"
SA_NAME="github-actions"
SA_EMAIL="${SA_NAME}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
REPO_NAME="kingjam-repo"
KEY_FILE="github-actions-key.json"

echo -e "${BLUE}配置資訊:${NC}"
echo "  專案 ID: $GCP_PROJECT_ID"
echo "  區域: $REGION"
echo "  服務帳戶: $SA_EMAIL"
echo "  Repository: $REPO_NAME"
echo ""

# 確認是否繼續
read -p "是否繼續設定? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "取消設定"
    exit 0
fi

# =============================================================================
# Step 1: 設定 GCP 專案
# =============================================================================
echo ""
echo -e "${GREEN}[1/6] 設定 GCP 專案...${NC}"
gcloud config set project $GCP_PROJECT_ID

# =============================================================================
# Step 2: 啟用必要的 API
# =============================================================================
echo ""
echo -e "${GREEN}[2/6] 啟用必要的 GCP API...${NC}"

APIS=(
    "run.googleapis.com"                    # Cloud Run
    "artifactregistry.googleapis.com"       # Artifact Registry
    "cloudbuild.googleapis.com"             # Cloud Build
    "iam.googleapis.com"                    # IAM
    "compute.googleapis.com"                # Compute (VPC)
    "vpcaccess.googleapis.com"              # VPC Access Connector
)

for api in "${APIS[@]}"; do
    echo "  啟用 $api..."
    gcloud services enable $api --quiet
done

echo -e "${GREEN}  ✓ API 啟用完成${NC}"

# =============================================================================
# Step 3: 建立 Artifact Registry Repository
# =============================================================================
echo ""
echo -e "${GREEN}[3/6] 建立 Artifact Registry Repository...${NC}"

# 檢查是否已存在
if gcloud artifacts repositories describe $REPO_NAME --location=$REGION &>/dev/null; then
    echo -e "${YELLOW}  Repository '$REPO_NAME' 已存在，跳過建立${NC}"
else
    gcloud artifacts repositories create $REPO_NAME \
        --repository-format=docker \
        --location=$REGION \
        --description="King Jam AI Docker images"
    echo -e "${GREEN}  ✓ Repository 建立完成${NC}"
fi

# =============================================================================
# Step 4: 建立服務帳戶
# =============================================================================
echo ""
echo -e "${GREEN}[4/6] 建立服務帳戶...${NC}"

# 檢查是否已存在
if gcloud iam service-accounts describe $SA_EMAIL &>/dev/null; then
    echo -e "${YELLOW}  服務帳戶 '$SA_NAME' 已存在，跳過建立${NC}"
else
    gcloud iam service-accounts create $SA_NAME \
        --display-name="GitHub Actions CI/CD" \
        --description="Service account for GitHub Actions to deploy to Cloud Run"
    echo -e "${GREEN}  ✓ 服務帳戶建立完成${NC}"
fi

# =============================================================================
# Step 5: 授予權限
# =============================================================================
echo ""
echo -e "${GREEN}[5/6] 授予服務帳戶權限...${NC}"

ROLES=(
    "roles/run.admin"                       # Cloud Run 管理權限
    "roles/artifactregistry.writer"         # Artifact Registry 寫入權限
    "roles/iam.serviceAccountUser"          # 服務帳戶使用權限
    "roles/storage.admin"                   # Storage 權限（用於 Cloud Run）
)

for role in "${ROLES[@]}"; do
    echo "  授予 $role..."
    gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
        --member="serviceAccount:$SA_EMAIL" \
        --role="$role" \
        --quiet
done

echo -e "${GREEN}  ✓ 權限授予完成${NC}"

# =============================================================================
# Step 6: 生成金鑰
# =============================================================================
echo ""
echo -e "${GREEN}[6/6] 生成服務帳戶金鑰...${NC}"

# 刪除舊金鑰檔案（如果存在）
if [ -f "$KEY_FILE" ]; then
    rm -f $KEY_FILE
fi

gcloud iam service-accounts keys create $KEY_FILE \
    --iam-account=$SA_EMAIL

echo -e "${GREEN}  ✓ 金鑰生成完成: $KEY_FILE${NC}"

# =============================================================================
# 完成
# =============================================================================
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    設定完成！                                 ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}接下來，請完成以下步驟:${NC}"
echo ""
echo -e "${BLUE}1. 前往 GitHub Repository → Settings → Secrets and variables → Actions${NC}"
echo ""
echo -e "${BLUE}2. 新增以下 Secrets:${NC}"
echo ""
echo -e "   ${GREEN}GCP_PROJECT_ID${NC}"
echo -e "   值: ${CYAN}$GCP_PROJECT_ID${NC}"
echo ""
echo -e "   ${GREEN}GCP_SA_KEY${NC}"
echo -e "   值: (複製下方 JSON 內容)"
echo ""
echo -e "${YELLOW}========== 複製以下內容到 GCP_SA_KEY ==========${NC}"
cat $KEY_FILE
echo ""
echo -e "${YELLOW}================================================${NC}"
echo ""
echo -e "${RED}⚠️  重要安全提醒:${NC}"
echo "   - 請妥善保管此金鑰，切勿提交到 Git"
echo "   - 設定完成後，建議刪除本地金鑰檔案: rm $KEY_FILE"
echo ""
echo -e "${BLUE}3. 驗證設定是否正確:${NC}"
echo "   - 前往 GitHub → Actions"
echo "   - 手動觸發 workflow 或 push 代碼到 main 分支"
echo ""
echo -e "${GREEN}設定腳本執行完畢！${NC}"
