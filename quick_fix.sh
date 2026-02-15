#!/bin/bash

# King Jam AI 快速修復腳本
# 用途: 自動修復常見的平台問題

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  🔧 King Jam AI 快速修復工具${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ============================================================
# 修復選單
# ============================================================
echo "請選擇要執行的修復操作:"
echo ""
echo "  1) 完整重啟所有服務"
echo "  2) 重建並啟動所有服務 (清除快取)"
echo "  3) 僅重啟後端 API"
echo "  4) 僅重啟 Celery Workers"
echo "  5) 執行資料庫遷移"
echo "  6) 清理 Docker 資源 (謹慎使用)"
echo "  7) 檢查並修復環境變數"
echo "  8) 重新安裝前端依賴"
echo "  9) 查看服務日誌"
echo "  0) 執行完整健康檢查"
echo ""
read -p "請輸入選項 (0-9): " choice

case $choice in
    1)
        echo -e "${YELLOW}正在重啟所有服務...${NC}"
        docker-compose restart
        echo -e "${GREEN}✅ 所有服務已重啟${NC}"
        echo -e "${BLUE}執行健康檢查...${NC}"
        sleep 5
        ./health_check.sh
        ;;
    
    2)
        echo -e "${YELLOW}正在停止所有服務...${NC}"
        docker-compose down
        
        echo -e "${YELLOW}正在清理 Docker 快取...${NC}"
        docker system prune -f
        
        echo -e "${YELLOW}正在重建並啟動服務...${NC}"
        docker-compose up -d --build
        
        echo -e "${GREEN}✅ 服務已重建並啟動${NC}"
        echo -e "${BLUE}等待服務完全啟動...${NC}"
        sleep 10
        ./health_check.sh
        ;;
    
    3)
        echo -e "${YELLOW}正在重啟後端 API...${NC}"
        docker-compose restart backend
        echo -e "${GREEN}✅ 後端 API 已重啟${NC}"
        sleep 3
        curl -s http://localhost:8000/health && echo -e "\n${GREEN}後端運行正常${NC}" || echo -e "\n${RED}後端無回應${NC}"
        ;;
    
    4)
        echo -e "${YELLOW}正在重啟 Celery Workers...${NC}"
        docker-compose restart celery-worker-high celery-worker-default celery-worker-video celery-beat
        echo -e "${GREEN}✅ Celery Workers 已重啟${NC}"
        ;;
    
    5)
        echo -e "${YELLOW}正在執行資料庫遷移...${NC}"
        
        # 檢查資料庫是否運行
        if ! docker exec kingjam_db pg_isready -U kingjam &> /dev/null; then
            echo -e "${RED}❌ 資料庫未運行,請先啟動服務${NC}"
            exit 1
        fi
        
        # 執行遷移
        docker exec kingjam_backend alembic upgrade heads
        echo -e "${GREEN}✅ 資料庫遷移完成${NC}"
        
        # 初始化資料
        echo -e "${YELLOW}正在初始化資料...${NC}"
        curl -s http://localhost:8000/health/init-db | python3 -m json.tool
        echo -e "${GREEN}✅ 資料初始化完成${NC}"
        ;;
    
    6)
        echo -e "${RED}⚠️  警告: 此操作將清理所有未使用的 Docker 資源${NC}"
        read -p "確定要繼續嗎? (y/N): " confirm
        
        if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
            echo -e "${YELLOW}正在清理 Docker 資源...${NC}"
            docker system prune -a --volumes -f
            echo -e "${GREEN}✅ Docker 資源已清理${NC}"
            echo -e "${BLUE}建議重新啟動服務: docker-compose up -d${NC}"
        else
            echo -e "${BLUE}已取消操作${NC}"
        fi
        ;;
    
    7)
        echo -e "${YELLOW}檢查環境變數配置...${NC}"
        
        if [ ! -f ".env" ]; then
            echo -e "${YELLOW}未找到 .env 檔案,正在創建...${NC}"
            cp .env.example .env
            echo -e "${GREEN}✅ 已創建 .env 檔案${NC}"
            echo -e "${BLUE}請編輯 .env 檔案並填入實際的 API 金鑰${NC}"
            echo -e "${BLUE}執行: nano .env${NC}"
        else
            echo -e "${GREEN}✅ .env 檔案存在${NC}"
            
            # 檢查關鍵變數
            source .env 2>/dev/null || true
            
            echo ""
            echo "關鍵環境變數狀態:"
            [ -z "$GOOGLE_GEMINI_KEY" ] && echo -e "  ${RED}❌ GOOGLE_GEMINI_KEY 未設定${NC}" || echo -e "  ${GREEN}✅ GOOGLE_GEMINI_KEY${NC}"
            [ -z "$GOOGLE_CLIENT_ID" ] && echo -e "  ${RED}❌ GOOGLE_CLIENT_ID 未設定${NC}" || echo -e "  ${GREEN}✅ GOOGLE_CLIENT_ID${NC}"
            [ -z "$GOOGLE_CLIENT_SECRET" ] && echo -e "  ${RED}❌ GOOGLE_CLIENT_SECRET 未設定${NC}" || echo -e "  ${GREEN}✅ GOOGLE_CLIENT_SECRET${NC}"
            [ -z "$REPLICATE_API_TOKEN" ] && echo -e "  ${YELLOW}⚠️  REPLICATE_API_TOKEN 未設定 (影片功能需要)${NC}" || echo -e "  ${GREEN}✅ REPLICATE_API_TOKEN${NC}"
            [ -z "$R2_ENDPOINT_URL" ] && echo -e "  ${YELLOW}⚠️  R2_ENDPOINT_URL 未設定 (雲端儲存需要)${NC}" || echo -e "  ${GREEN}✅ R2_ENDPOINT_URL${NC}"
        fi
        ;;
    
    8)
        echo -e "${YELLOW}正在重新安裝前端依賴...${NC}"
        cd frontend
        
        echo -e "${YELLOW}清理舊的依賴...${NC}"
        rm -rf node_modules .next
        
        echo -e "${YELLOW}安裝依賴...${NC}"
        npm install --legacy-peer-deps
        
        echo -e "${GREEN}✅ 前端依賴已重新安裝${NC}"
        echo -e "${BLUE}啟動前端: npm run dev${NC}"
        cd ..
        ;;
    
    9)
        echo ""
        echo "請選擇要查看的日誌:"
        echo "  1) 後端 API"
        echo "  2) Celery Worker (高優先級)"
        echo "  3) Celery Worker (預設)"
        echo "  4) Celery Worker (影片)"
        echo "  5) PostgreSQL"
        echo "  6) Redis"
        echo "  7) 所有服務"
        echo ""
        read -p "請輸入選項 (1-7): " log_choice
        
        case $log_choice in
            1) docker logs -f --tail=100 kingjam_backend ;;
            2) docker logs -f --tail=100 kingjam_celery_high ;;
            3) docker logs -f --tail=100 kingjam_celery_default ;;
            4) docker logs -f --tail=100 kingjam_celery_video ;;
            5) docker logs -f --tail=100 kingjam_db ;;
            6) docker logs -f --tail=100 kingjam_redis ;;
            7) docker-compose logs -f --tail=50 ;;
            *) echo -e "${RED}無效的選項${NC}" ;;
        esac
        ;;
    
    0)
        echo -e "${BLUE}執行完整健康檢查...${NC}"
        ./health_check.sh
        ;;
    
    *)
        echo -e "${RED}無效的選項${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}操作完成!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
