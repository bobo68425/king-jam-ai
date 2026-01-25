#!/bin/bash
# =============================================================================
# King Jam AI - 網域設置腳本
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  King Jam AI - 網域設置指南${NC}"
echo -e "${GREEN}========================================${NC}"

if [ -z "$GCP_PROJECT_ID" ]; then
    echo -e "${RED}錯誤: 請設置 GCP_PROJECT_ID 環境變數${NC}"
    exit 1
fi

REGION="${GCP_REGION:-asia-east1}"
SERVICE_NAME="${SERVICE_NAME:-kingjam-api}"

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}  步驟 1: Cloud Run 網域對應${NC}"
echo -e "${BLUE}========================================${NC}"

echo -e "\n${YELLOW}為 API 子網域建立對應:${NC}"
echo -e "執行以下命令:"
echo ""
echo -e "${GREEN}gcloud run domain-mappings create \\
  --service=$SERVICE_NAME \\
  --domain=api.kingjam.app \\
  --region=$REGION${NC}"
echo ""

# 嘗試執行
read -p "是否現在執行? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    gcloud run domain-mappings create \
      --service=$SERVICE_NAME \
      --domain=api.kingjam.app \
      --region=$REGION || echo -e "${YELLOW}網域對應可能已存在${NC}"
fi

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}  步驟 2: 取得 DNS 記錄${NC}"
echo -e "${BLUE}========================================${NC}"

echo -e "\n${YELLOW}取得網域驗證所需的 DNS 記錄:${NC}"
gcloud run domain-mappings describe \
  --domain=api.kingjam.app \
  --region=$REGION \
  --format='yaml(resourceRecords)' 2>/dev/null || echo "請先完成步驟 1"

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}  步驟 3: Cloudflare DNS 設定${NC}"
echo -e "${BLUE}========================================${NC}"

echo -e "\n${YELLOW}請在 Cloudflare DNS 中新增以下記錄:${NC}"
echo ""
echo -e "┌────────┬────────┬─────────────────────────┬────────┐"
echo -e "│ ${GREEN}類型${NC}   │ ${GREEN}名稱${NC}   │ ${GREEN}值${NC}                       │ ${GREEN}Proxy${NC}  │"
echo -e "├────────┼────────┼─────────────────────────┼────────┤"
echo -e "│ CNAME  │ api    │ ghs.googlehosted.com    │ ${YELLOW}關閉${NC}   │"
echo -e "│ CNAME  │ @      │ cname.vercel-dns.com    │ ${YELLOW}關閉${NC}   │"
echo -e "│ CNAME  │ www    │ cname.vercel-dns.com    │ ${YELLOW}關閉${NC}   │"
echo -e "└────────┴────────┴─────────────────────────┴────────┘"
echo ""
echo -e "${RED}注意: Cloud Run 自訂網域需要關閉 Cloudflare Proxy (橘色雲朵)${NC}"
echo -e "${RED}      驗證完成後可以開啟 Proxy${NC}"

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}  步驟 4: Vercel 網域設定${NC}"
echo -e "${BLUE}========================================${NC}"

echo -e "\n${YELLOW}在 Vercel 專案設定中:${NC}"
echo "1. 進入 Project Settings > Domains"
echo "2. 新增網域: kingjam.app"
echo "3. 新增網域: www.kingjam.app"
echo "4. Vercel 會提供 CNAME 記錄值（通常是 cname.vercel-dns.com）"
echo "5. 確認 DNS 驗證完成"

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}  步驟 5: SSL 證書${NC}"
echo -e "${BLUE}========================================${NC}"

echo -e "\n${YELLOW}SSL 證書狀態:${NC}"
echo "• Cloud Run: 自動提供 SSL 證書 (Let's Encrypt)"
echo "• Vercel: 自動提供 SSL 證書"
echo "• Cloudflare: 如啟用 Proxy，會額外提供 Edge 證書"
echo ""
echo "驗證 SSL 狀態:"
echo "  curl -I https://api.kingjam.app/health"
echo "  curl -I https://kingjam.app"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  網域設置完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}DNS 傳播可能需要幾分鐘到 48 小時${NC}"
echo ""
echo "驗證命令:"
echo "  dig api.kingjam.app"
echo "  dig kingjam.app"
echo "  dig www.kingjam.app"
echo ""
