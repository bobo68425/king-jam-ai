#!/bin/bash

# ============================================================
# Celery 本地開發啟動腳本
# 使用方式：./scripts/start_celery.sh [component]
# component: all | worker-high | worker-default | worker-video | beat | flower
# ============================================================

set -e

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 檢查 Redis 是否運行
check_redis() {
    if ! redis-cli ping > /dev/null 2>&1; then
        echo -e "${RED}❌ Redis 未運行！請先啟動 Redis${NC}"
        echo -e "${YELLOW}執行: docker-compose up -d redis${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Redis 已連線${NC}"
}

# 設定環境變數
export DATABASE_URL="${DATABASE_URL:-postgresql://kingjam:kingjam_pass@localhost:5432/kingjam_db}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379/0}"
export CELERY_BROKER_URL="${CELERY_BROKER_URL:-redis://localhost:6379/0}"
export CELERY_RESULT_BACKEND="${CELERY_RESULT_BACKEND:-redis://localhost:6379/0}"

COMPONENT=${1:-all}

case $COMPONENT in
    worker-high)
        echo -e "${BLUE}🚀 啟動高優先級 Worker...${NC}"
        check_redis
        celery -A app.celery_app worker -Q queue_high -c 2 -l info --hostname=worker-high@%h
        ;;
    worker-default)
        echo -e "${BLUE}🚀 啟動預設 Worker...${NC}"
        check_redis
        celery -A app.celery_app worker -Q queue_default -c 4 -l info --hostname=worker-default@%h
        ;;
    worker-video)
        echo -e "${BLUE}🚀 啟動影片 Worker...${NC}"
        check_redis
        celery -A app.celery_app worker -Q queue_video -c 2 -l info --hostname=worker-video@%h
        ;;
    beat)
        echo -e "${BLUE}🚀 啟動 Beat 排程器...${NC}"
        check_redis
        celery -A app.celery_app beat -l info
        ;;
    flower)
        echo -e "${BLUE}🚀 啟動 Flower 監控...${NC}"
        check_redis
        celery -A app.celery_app flower --port=5555
        ;;
    all)
        echo -e "${BLUE}🚀 啟動所有 Celery 元件...${NC}"
        check_redis
        
        # 使用多個終端機視窗或 tmux
        echo -e "${YELLOW}建議使用以下命令分別在不同終端機啟動：${NC}"
        echo ""
        echo -e "# 終端機 1 - 高優先級 Worker"
        echo -e "${GREEN}./scripts/start_celery.sh worker-high${NC}"
        echo ""
        echo -e "# 終端機 2 - 預設 Worker"
        echo -e "${GREEN}./scripts/start_celery.sh worker-default${NC}"
        echo ""
        echo -e "# 終端機 3 - 影片 Worker"
        echo -e "${GREEN}./scripts/start_celery.sh worker-video${NC}"
        echo ""
        echo -e "# 終端機 4 - Beat 排程器"
        echo -e "${GREEN}./scripts/start_celery.sh beat${NC}"
        echo ""
        echo -e "# 終端機 5 - Flower 監控 (可選)"
        echo -e "${GREEN}./scripts/start_celery.sh flower${NC}"
        echo ""
        echo -e "${YELLOW}或使用 Docker Compose 一鍵啟動：${NC}"
        echo -e "${GREEN}docker-compose up -d${NC}"
        ;;
    *)
        echo -e "${RED}未知的元件: $COMPONENT${NC}"
        echo "使用方式: ./scripts/start_celery.sh [component]"
        echo "可用元件: all | worker-high | worker-default | worker-video | beat | flower"
        exit 1
        ;;
esac
