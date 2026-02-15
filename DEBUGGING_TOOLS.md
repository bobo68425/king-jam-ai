# 🔧 King Jam AI 偵錯工具指南

本目錄包含多個偵錯和維護工具,幫助您快速診斷和修復平台問題。

---

## 📋 可用工具

### 1. 健康檢查腳本 (`health_check.sh`)
**用途**: 快速檢查所有服務的運行狀態

**使用方法**:
```bash
./health_check.sh
```

**檢查項目**:
- ✅ Docker 服務狀態
- ✅ 環境變數配置
- ✅ Docker Compose 服務
- ✅ 後端 API 健康狀態
- ✅ 前端服務狀態
- ✅ PostgreSQL 資料庫
- ✅ Redis 快取 (主要 + 影片)
- ✅ Celery Workers

**輸出範例**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🔍 King Jam AI 平台健康檢查
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/8] Docker 服務
  ✅ Docker 運行中

[2/8] 環境變數配置
  ✅ .env 檔案存在
  ✅ 關鍵環境變數已設定
...
```

---

### 2. 快速修復工具 (`quick_fix.sh`)
**用途**: 互動式修復常見問題

**使用方法**:
```bash
./quick_fix.sh
```

**可用選項**:
1. **完整重啟所有服務** - 重啟所有 Docker 容器
2. **重建並啟動所有服務** - 清除快取並重建
3. **僅重啟後端 API** - 快速重啟後端服務
4. **僅重啟 Celery Workers** - 重啟所有 Worker
5. **執行資料庫遷移** - 運行 Alembic 遷移
6. **清理 Docker 資源** - 清理未使用的容器和映像
7. **檢查並修復環境變數** - 驗證 .env 配置
8. **重新安裝前端依賴** - 清理並重裝 npm 套件
9. **查看服務日誌** - 即時查看各服務日誌
0. **執行完整健康檢查** - 運行 health_check.sh

**使用場景**:
```bash
# 服務無回應時
./quick_fix.sh
# 選擇 1 (完整重啟)

# 資料庫遷移失敗時
./quick_fix.sh
# 選擇 5 (執行資料庫遷移)

# 前端編譯錯誤時
./quick_fix.sh
# 選擇 8 (重新安裝前端依賴)
```

---

### 3. 程式碼品質檢查 (`code_quality_check.py`)
**用途**: 自動掃描程式碼中的常見問題

**使用方法**:
```bash
python3 code_quality_check.py
```

**檢查項目**:
- 🔍 裸露的 Exception 處理 (`except:`)
- 🔍 通用 Exception 拋出 (`raise Exception()`)
- 🔍 TODO/FIXME/XXX 註解
- 🔍 print() 語句 (應使用 logger)
- 🔍 過長的函數 (>100 行)
- 🔍 console.log 語句 (前端)
- 🔍 TypeScript any 類型
- 🔍 硬編碼的敏感資訊
- 🔍 潛在的 N+1 查詢問題

**輸出範例**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🔍 King Jam AI 程式碼品質分析
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/5] 分析後端程式碼...
  ✅ 找到 150 個 Python 檔案

[2/5] 分析前端程式碼...
  ✅ 找到 85 個前端檔案
...

⚠️  裸露的 Exception 處理: 41 個
   backend/app/main.py:93
   backend/app/services/insights_service.py:548
...
```

---

### 4. 完整偵錯報告 (`DEBUG_REPORT.md`)
**用途**: 詳細的平台狀態分析報告

**內容包含**:
- 🔴 嚴重問題 (Critical Issues)
- 🟡 中等問題 (Medium Priority)
- 🟢 低優先級問題 (Low Priority)
- 🔒 安全性檢查
- ⚡ 效能優化建議
- 📊 架構分析
- 🚀 立即行動清單

**查看方法**:
```bash
cat DEBUG_REPORT.md
# 或使用任何 Markdown 閱讀器
```

---

## 🚀 快速開始指南

### 首次設定
```bash
# 1. 確保 Docker 運行中
open -a Docker

# 2. 配置環境變數
cp .env.example .env
nano .env  # 填入實際的 API 金鑰

# 3. 啟動所有服務
docker-compose up -d

# 4. 執行資料庫遷移
docker exec kingjam_backend alembic upgrade heads

# 5. 啟動前端
cd frontend
npm install --legacy-peer-deps
npm run dev
```

### 日常維護
```bash
# 每天開始工作前
./health_check.sh

# 遇到問題時
./quick_fix.sh

# 提交程式碼前
python3 code_quality_check.py
```

---

## 🔍 常見問題排查

### 問題 1: Docker 服務無法啟動
**症狀**: `Cannot connect to the Docker daemon`

**解決方案**:
```bash
# 啟動 Docker Desktop
open -a Docker

# 等待 30 秒後驗證
docker info
```

---

### 問題 2: 後端 API 無回應
**症狀**: `curl http://localhost:8000/health` 無回應

**解決方案**:
```bash
# 1. 查看後端日誌
docker logs -f kingjam_backend

# 2. 檢查環境變數
./quick_fix.sh
# 選擇 7 (檢查環境變數)

# 3. 重啟後端
./quick_fix.sh
# 選擇 3 (重啟後端)
```

---

### 問題 3: 資料庫連線失敗
**症狀**: `Database connection failed`

**解決方案**:
```bash
# 1. 檢查資料庫狀態
docker exec kingjam_db pg_isready -U kingjam

# 2. 查看資料庫日誌
docker logs kingjam_db

# 3. 重啟資料庫
docker-compose restart db

# 4. 執行遷移
./quick_fix.sh
# 選擇 5 (執行資料庫遷移)
```

---

### 問題 4: Celery Worker 無回應
**症狀**: 任務不執行或卡住

**解決方案**:
```bash
# 1. 查看 Worker 狀態
docker exec kingjam_celery_default celery -A app.celery_app inspect active

# 2. 查看 Flower 監控面板
open http://localhost:5555

# 3. 重啟 Workers
./quick_fix.sh
# 選擇 4 (重啟 Celery Workers)
```

---

### 問題 5: 前端編譯錯誤
**症狀**: `npm run dev` 失敗

**解決方案**:
```bash
# 1. 清理並重裝依賴
./quick_fix.sh
# 選擇 8 (重新安裝前端依賴)

# 2. 手動清理
cd frontend
rm -rf node_modules .next
npm install --legacy-peer-deps
npm run dev
```

---

## 📊 監控和日誌

### 即時日誌查看
```bash
# 所有服務
docker-compose logs -f

# 特定服務
docker logs -f kingjam_backend
docker logs -f kingjam_celery_default
docker logs -f kingjam_db

# 使用 quick_fix.sh
./quick_fix.sh
# 選擇 9 (查看服務日誌)
```

### Flower 監控面板
```bash
# 訪問 Celery 監控面板
open http://localhost:5555

# 登入資訊
# 使用者名稱: admin
# 密碼: kingjam123
```

### API 文件
```bash
# 本地開發
open http://localhost:8000/docs

# 生產環境
open https://api.kingjam.app/docs
```

---

## 🔐 安全性最佳實踐

### 環境變數管理
```bash
# ✅ 好的做法
# 使用 .env 檔案
GOOGLE_GEMINI_KEY=your_actual_key

# ❌ 不好的做法
# 硬編碼在程式碼中
api_key = "AIza..."  # 永遠不要這樣做!
```

### API 金鑰輪換
```bash
# 定期更新 API 金鑰
nano .env  # 更新金鑰

# 重啟服務以套用新金鑰
docker-compose restart backend
```

### 檢查敏感資訊洩漏
```bash
# 運行程式碼品質檢查
python3 code_quality_check.py

# 檢查是否有硬編碼的密鑰
grep -r "password.*=" backend/app/ --include="*.py"
```

---

## 📈 效能優化

### 資料庫查詢優化
```bash
# 查看慢查詢
docker exec kingjam_db psql -U kingjam -d kingjam_db -c "
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;"
```

### Redis 記憶體使用
```bash
# 查看 Redis 記憶體使用
docker exec kingjam_redis redis-cli INFO memory

# 清理過期的 key
docker exec kingjam_redis redis-cli --scan --pattern "*" | xargs docker exec -i kingjam_redis redis-cli DEL
```

### Docker 資源清理
```bash
# 清理未使用的映像
docker image prune -a

# 清理未使用的容器
docker container prune

# 完整清理 (謹慎使用)
./quick_fix.sh
# 選擇 6 (清理 Docker 資源)
```

---

## 🧪 測試建議

### 單元測試 (待實施)
```bash
# 後端測試
cd backend
pytest tests/

# 前端測試
cd frontend
npm test
```

### API 測試
```bash
# 使用 curl 測試 API
curl -X GET http://localhost:8000/health
curl -X GET http://localhost:8000/health/db

# 使用 Swagger UI
open http://localhost:8000/docs
```

---

## 📞 支援資源

- **GitHub**: https://github.com/bobo68425/king-jam-ai
- **生產環境**: https://kingjam.app
- **API 文件**: https://api.kingjam.app/docs
- **設定指南**: [SETUP.md](SETUP.md)
- **偵錯報告**: [DEBUG_REPORT.md](DEBUG_REPORT.md)

---

## 🎯 下一步

1. ✅ 執行健康檢查: `./health_check.sh`
2. ✅ 配置環境變數: `cp .env.example .env && nano .env`
3. ✅ 啟動所有服務: `docker-compose up -d`
4. ✅ 執行資料庫遷移: `docker exec kingjam_backend alembic upgrade heads`
5. ✅ 啟動前端: `cd frontend && npm run dev`
6. ✅ 運行程式碼品質檢查: `python3 code_quality_check.py`

---

*最後更新: 2026-02-15*
