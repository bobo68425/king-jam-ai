#!/bin/bash

# King Jam AI 平台健康檢查腳本
# 用途: 快速診斷平台各項服務的運行狀態

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 圖示
CHECK="✅"
CROSS="❌"
WARNING="⚠️"
INFO="ℹ️"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  🔍 King Jam AI 平台健康檢查${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 計數器
PASSED=0
FAILED=0
WARNINGS=0

# ============================================================
# 1. Docker 狀態檢查
# ============================================================
echo -e "${BLUE}[1/8] Docker 服務${NC}"
if docker info &> /dev/null; then
    echo -e "  ${CHECK} Docker 運行中"
    ((PASSED++))
else
    echo -e "  ${CROSS} Docker 未啟動"
    echo -e "  ${INFO} 請執行: open -a Docker"
    ((FAILED++))
    exit 1
fi
echo ""

# ============================================================
# 2. 環境變數檢查
# ============================================================
echo -e "${BLUE}[2/8] 環境變數配置${NC}"
if [ -f ".env" ]; then
    echo -e "  ${CHECK} .env 檔案存在"
    ((PASSED++))
    
    # 檢查關鍵環境變數
    source .env 2>/dev/null || true
    
    MISSING_VARS=()
    [ -z "$GOOGLE_GEMINI_KEY" ] && MISSING_VARS+=("GOOGLE_GEMINI_KEY")
    [ -z "$GOOGLE_CLIENT_ID" ] && MISSING_VARS+=("GOOGLE_CLIENT_ID")
    [ -z "$GOOGLE_CLIENT_SECRET" ] && MISSING_VARS+=("GOOGLE_CLIENT_SECRET")
    
    if [ ${#MISSING_VARS[@]} -gt 0 ]; then
        echo -e "  ${WARNING} 缺失環境變數: ${MISSING_VARS[*]}"
        ((WARNINGS++))
    else
        echo -e "  ${CHECK} 關鍵環境變數已設定"
        ((PASSED++))
    fi
else
    echo -e "  ${CROSS} .env 檔案不存在"
    echo -e "  ${INFO} 請執行: cp .env.example .env"
    ((FAILED++))
fi
echo ""

# ============================================================
# 3. Docker Compose 服務狀態
# ============================================================
echo -e "${BLUE}[3/8] Docker Compose 服務${NC}"
if docker-compose ps &> /dev/null; then
    RUNNING=$(docker-compose ps --services --filter "status=running" 2>/dev/null | wc -l)
    TOTAL=$(docker-compose ps --services 2>/dev/null | wc -l)
    
    if [ "$RUNNING" -eq "$TOTAL" ] && [ "$TOTAL" -gt 0 ]; then
        echo -e "  ${CHECK} 所有服務運行中 ($RUNNING/$TOTAL)"
        ((PASSED++))
    elif [ "$RUNNING" -gt 0 ]; then
        echo -e "  ${WARNING} 部分服務運行中 ($RUNNING/$TOTAL)"
        echo -e "  ${INFO} 執行 'docker-compose ps' 查看詳情"
        ((WARNINGS++))
    else
        echo -e "  ${CROSS} 服務未啟動"
        echo -e "  ${INFO} 請執行: docker-compose up -d"
        ((FAILED++))
    fi
else
    echo -e "  ${CROSS} Docker Compose 配置錯誤"
    ((FAILED++))
fi
echo ""

# ============================================================
# 4. 後端 API 健康檢查
# ============================================================
echo -e "${BLUE}[4/8] 後端 API (FastAPI)${NC}"
if curl -s http://localhost:8000/health | grep -q "ok"; then
    echo -e "  ${CHECK} 後端 API 正常運行"
    ((PASSED++))
    
    # 檢查資料庫連線
    if curl -s http://localhost:8000/health/db | grep -q "connected"; then
        echo -e "  ${CHECK} 資料庫連線正常"
        ((PASSED++))
    else
        echo -e "  ${CROSS} 資料庫連線失敗"
        ((FAILED++))
    fi
else
    echo -e "  ${CROSS} 後端 API 無回應"
    echo -e "  ${INFO} 檢查: docker logs kingjam_backend"
    ((FAILED++))
fi
echo ""

# ============================================================
# 5. 前端服務檢查
# ============================================================
echo -e "${BLUE}[5/8] 前端 (Next.js)${NC}"
if curl -s http://localhost:3000 &> /dev/null; then
    echo -e "  ${CHECK} 前端服務運行中"
    ((PASSED++))
else
    echo -e "  ${WARNING} 前端服務未啟動"
    echo -e "  ${INFO} 請執行: cd frontend && npm run dev"
    ((WARNINGS++))
fi
echo ""

# ============================================================
# 6. PostgreSQL 資料庫檢查
# ============================================================
echo -e "${BLUE}[6/8] PostgreSQL 資料庫${NC}"
if docker exec kingjam_db pg_isready -U kingjam &> /dev/null; then
    echo -e "  ${CHECK} PostgreSQL 運行中"
    ((PASSED++))
    
    # 檢查資料庫連線數
    CONNECTIONS=$(docker exec kingjam_db psql -U kingjam -d kingjam_db -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | tr -d ' ')
    if [ ! -z "$CONNECTIONS" ]; then
        echo -e "  ${INFO} 當前連線數: $CONNECTIONS"
    fi
else
    echo -e "  ${CROSS} PostgreSQL 無回應"
    ((FAILED++))
fi
echo ""

# ============================================================
# 7. Redis 快取檢查
# ============================================================
echo -e "${BLUE}[7/8] Redis 快取${NC}"
if docker exec kingjam_redis redis-cli ping &> /dev/null; then
    echo -e "  ${CHECK} Redis (主要) 運行中"
    ((PASSED++))
else
    echo -e "  ${CROSS} Redis (主要) 無回應"
    ((FAILED++))
fi

if docker exec kingjam_redis_video redis-cli ping &> /dev/null; then
    echo -e "  ${CHECK} Redis (影片) 運行中"
    ((PASSED++))
else
    echo -e "  ${WARNING} Redis (影片) 無回應"
    ((WARNINGS++))
fi
echo ""

# ============================================================
# 8. Celery Workers 檢查
# ============================================================
echo -e "${BLUE}[8/8] Celery Workers${NC}"

# 檢查 High Priority Worker
if docker exec kingjam_celery_high celery -A app.celery_app inspect ping &> /dev/null; then
    echo -e "  ${CHECK} Celery Worker (高優先級) 運行中"
    ((PASSED++))
else
    echo -e "  ${WARNING} Celery Worker (高優先級) 無回應"
    ((WARNINGS++))
fi

# 檢查 Default Worker
if docker exec kingjam_celery_default celery -A app.celery_app inspect ping &> /dev/null; then
    echo -e "  ${CHECK} Celery Worker (預設) 運行中"
    ((PASSED++))
else
    echo -e "  ${WARNING} Celery Worker (預設) 無回應"
    ((WARNINGS++))
fi

# 檢查 Video Worker
if docker ps --filter "name=kingjam_celery_video" --format "{{.Names}}" | grep -q "celery_video"; then
    echo -e "  ${CHECK} Celery Worker (影片) 運行中"
    ((PASSED++))
else
    echo -e "  ${WARNING} Celery Worker (影片) 無回應"
    ((WARNINGS++))
fi
echo ""

# ============================================================
# 總結
# ============================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  📊 檢查結果總結${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${GREEN}通過: $PASSED${NC}"
echo -e "  ${YELLOW}警告: $WARNINGS${NC}"
echo -e "  ${RED}失敗: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}${CHECK} 所有檢查通過!平台運行正常。${NC}"
    exit 0
elif [ $FAILED -eq 0 ]; then
    echo -e "${YELLOW}${WARNING} 平台基本正常,但有 $WARNINGS 個警告需要注意。${NC}"
    exit 0
else
    echo -e "${RED}${CROSS} 發現 $FAILED 個嚴重問題,請立即處理。${NC}"
    echo ""
    echo -e "${INFO} 常用除錯指令:"
    echo -e "  - 查看服務狀態: ${BLUE}docker-compose ps${NC}"
    echo -e "  - 查看後端日誌: ${BLUE}docker logs -f kingjam_backend${NC}"
    echo -e "  - 重啟所有服務: ${BLUE}docker-compose restart${NC}"
    echo -e "  - 完整重建服務: ${BLUE}docker-compose down && docker-compose up -d --build${NC}"
    exit 1
fi
