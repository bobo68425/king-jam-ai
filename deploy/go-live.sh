#!/bin/bash
# =============================================================================
# King Jam AI - 正式上線腳本
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  King Jam AI - 正式上線${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 確認
echo -e "${RED}警告: 此腳本將執行正式上線流程！${NC}"
echo ""
read -p "確定要繼續嗎? (輸入 'yes' 確認): " confirm

if [ "$confirm" != "yes" ]; then
    echo "已取消"
    exit 0
fi

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}  步驟 1: 最終檢查${NC}"
echo -e "${BLUE}========================================${NC}"

# 執行冒煙測試
./smoke-test.sh || {
    echo -e "${RED}冒煙測試失敗，請先修復問題${NC}"
    exit 1
}

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}  步驟 2: 設定最小執行個體${NC}"
echo -e "${BLUE}========================================${NC}"

if [ -n "$GCP_PROJECT_ID" ]; then
    echo -e "${YELLOW}設定 Cloud Run 最小執行個體為 1（減少冷啟動）...${NC}"
    
    gcloud run services update kingjam-api \
        --min-instances=1 \
        --region=${GCP_REGION:-asia-east1} \
        2>/dev/null || echo "跳過（可能尚未部署）"
fi

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}  步驟 3: 驗證關鍵功能${NC}"
echo -e "${BLUE}========================================${NC}"

echo -e "${YELLOW}請手動驗證以下功能:${NC}"
echo ""
echo "1. [ ] 用戶註冊/登入"
echo "2. [ ] Google OAuth 登入"
echo "3. [ ] 付款流程（可用測試金額）"
echo "4. [ ] AI 內容生成"
echo "5. [ ] 社群發布功能"
echo ""
read -p "所有功能驗證完成? (y/n): " verified

if [ "$verified" != "y" ]; then
    echo -e "${YELLOW}請先完成功能驗證${NC}"
    exit 1
fi

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}  步驟 4: 記錄上線時間${NC}"
echo -e "${BLUE}========================================${NC}"

LAUNCH_TIME=$(date -u '+%Y-%m-%d %H:%M:%S UTC')
echo -e "${GREEN}上線時間: $LAUNCH_TIME${NC}"

# 寫入上線記錄
echo "King Jam AI 正式上線: $LAUNCH_TIME" >> ../LAUNCH_LOG.txt

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  🎉 恭喜！King Jam AI 已正式上線！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "前端網址: ${GREEN}https://kingjam.app${NC}"
echo -e "API 網址: ${GREEN}https://api.kingjam.app${NC}"
echo ""
echo -e "${YELLOW}接下來請:${NC}"
echo "1. 監控 Cloud Run 日誌，注意任何錯誤"
echo "2. 監控 Cloud SQL 效能"
echo "3. 設定告警通知"
echo "4. 公告上線消息"
echo ""
echo -e "${GREEN}祝一切順利！${NC}"
