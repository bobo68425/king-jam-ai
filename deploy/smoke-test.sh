#!/bin/bash
# =============================================================================
# King Jam AI - 冒煙測試腳本
# 用於驗證部署後的基本功能
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

API_URL="${API_URL:-https://api.kingjam.app}"
FRONTEND_URL="${FRONTEND_URL:-https://kingjam.app}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  King Jam AI - 冒煙測試${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "API URL: $API_URL"
echo "Frontend URL: $FRONTEND_URL"
echo ""

PASS=0
FAIL=0

# 測試函數
test_endpoint() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    
    printf "測試 %-40s" "$name..."
    
    status_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 10 2>/dev/null || echo "000")
    
    if [ "$status_code" -eq "$expected_status" ]; then
        echo -e " ${GREEN}✓ PASS${NC} ($status_code)"
        ((PASS++))
    else
        echo -e " ${RED}✗ FAIL${NC} (expected $expected_status, got $status_code)"
        ((FAIL++))
    fi
}

test_endpoint_json() {
    local name=$1
    local url=$2
    local key=$3
    
    printf "測試 %-40s" "$name..."
    
    response=$(curl -s "$url" --max-time 10 2>/dev/null || echo "{}")
    
    if echo "$response" | grep -q "\"$key\""; then
        echo -e " ${GREEN}✓ PASS${NC}"
        ((PASS++))
    else
        echo -e " ${RED}✗ FAIL${NC} (missing key: $key)"
        ((FAIL++))
    fi
}

echo -e "\n${YELLOW}=== 後端 API 測試 ===${NC}\n"

# 基本健康檢查
test_endpoint "Health Check" "$API_URL/health"
test_endpoint "API Root" "$API_URL/"

# API 文檔
test_endpoint "OpenAPI Docs" "$API_URL/docs"
test_endpoint "OpenAPI JSON" "$API_URL/openapi.json"

# 公開 API
test_endpoint_json "Payment Products" "$API_URL/payment/products" "success"
test_endpoint_json "Credit Pricing" "$API_URL/credits/pricing" "success"

echo -e "\n${YELLOW}=== 前端測試 ===${NC}\n"

# 前端頁面
test_endpoint "Homepage" "$FRONTEND_URL"
test_endpoint "Login Page" "$FRONTEND_URL/login"
test_endpoint "Privacy Policy" "$FRONTEND_URL/privacy"
test_endpoint "Refund Policy" "$FRONTEND_URL/refund"

# 靜態資源
test_endpoint "Logo" "$FRONTEND_URL/logo.png"

echo -e "\n${YELLOW}=== SSL 證書測試 ===${NC}\n"

printf "測試 %-40s" "API SSL 證書..."
if curl -s --head "$API_URL" 2>/dev/null | grep -qi "strict-transport-security\|HTTP/2"; then
    echo -e " ${GREEN}✓ PASS${NC}"
    ((PASS++))
else
    echo -e " ${YELLOW}⚠ WARN${NC} (HSTS 可能未啟用)"
fi

printf "測試 %-40s" "Frontend SSL 證書..."
if curl -s --head "$FRONTEND_URL" 2>/dev/null | grep -qi "strict-transport-security\|HTTP/2"; then
    echo -e " ${GREEN}✓ PASS${NC}"
    ((PASS++))
else
    echo -e " ${YELLOW}⚠ WARN${NC} (HSTS 可能未啟用)"
fi

echo -e "\n${YELLOW}=== CORS 測試 ===${NC}\n"

printf "測試 %-40s" "CORS Headers..."
cors_header=$(curl -s -I -X OPTIONS "$API_URL/health" \
    -H "Origin: $FRONTEND_URL" \
    -H "Access-Control-Request-Method: GET" 2>/dev/null | grep -i "access-control-allow-origin" || echo "")

if [ -n "$cors_header" ]; then
    echo -e " ${GREEN}✓ PASS${NC}"
    ((PASS++))
else
    echo -e " ${RED}✗ FAIL${NC} (CORS headers missing)"
    ((FAIL++))
fi

# 結果摘要
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  測試結果摘要${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "通過: ${GREEN}$PASS${NC}"
echo -e "失敗: ${RED}$FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}所有測試通過！系統已準備就緒。${NC}"
    exit 0
else
    echo -e "${RED}有 $FAIL 個測試失敗，請檢查問題。${NC}"
    exit 1
fi
