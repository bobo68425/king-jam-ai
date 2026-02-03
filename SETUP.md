# King Jam AI - 環境設定指南

## 目錄

- [必備工具安裝](#必備工具安裝)
- [專案設定](#專案設定)
- [本地開發環境](#本地開發環境)
- [Google Cloud 設定](#google-cloud-設定)
- [部署到生產環境](#部署到生產環境)
- [常用指令](#常用指令)
- [環境變數說明](#環境變數說明)
- [故障排除](#故障排除)

---

## 必備工具安裝

### macOS

```bash
# 安裝 Homebrew（如果沒有）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安裝必要工具
brew install git node docker google-cloud-sdk

# 啟動 Docker Desktop（需手動下載安裝）
# https://www.docker.com/products/docker-desktop
```

### Windows

1. 安裝 [Git for Windows](https://git-scm.com/download/win)
2. 安裝 [Node.js LTS](https://nodejs.org/)
3. 安裝 [Docker Desktop](https://www.docker.com/products/docker-desktop)
4. 安裝 [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)

### 驗證安裝

```bash
git --version      # 應顯示 2.x 以上
node --version     # 應顯示 20.x 以上
npm --version      # 應顯示 10.x 以上
docker --version   # 應顯示 24.x 以上
gcloud --version   # 應顯示 SDK 版本
```

---

## 專案設定

### 1. Clone 專案

```bash
git clone https://github.com/bobo68425/king-jam-ai.git
cd king-jam-ai
```

### 2. 設定 Git（首次使用）

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

---

## 本地開發環境

### 啟動所有服務

```bash
# 啟動 Docker 服務（PostgreSQL, Redis, Backend, Celery Workers）
docker-compose up -d

# 查看服務狀態
docker-compose ps

# 查看日誌
docker-compose logs -f backend
```

### 資料庫 Migration

```bash
# 執行資料庫遷移
docker exec kingjam_backend alembic upgrade heads

# 查看 migration 狀態
docker exec kingjam_backend alembic current
```

### 前端開發

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

### 服務存取

| 服務 | 網址 | 說明 |
|------|------|------|
| 前端 | http://localhost:3000 | Next.js 開發伺服器 |
| 後端 API | http://localhost:8000 | FastAPI |
| API 文件 | http://localhost:8000/docs | Swagger UI |
| Flower | http://localhost:5555 | Celery 監控面板 |
| PostgreSQL | localhost:5432 | 資料庫 |
| Redis | localhost:6379 | 快取/訊息佇列 |

### 停止服務

```bash
# 停止所有服務
docker-compose down

# 停止並清除資料
docker-compose down -v
```

---

## Google Cloud 設定

### 1. 登入 Google Cloud

```bash
gcloud auth login
gcloud config set project king-jam-ai
```

### 2. 設定 Docker 認證

```bash
gcloud auth configure-docker asia-east1-docker.pkg.dev
```

### 3. 驗證設定

```bash
gcloud config list
# 應顯示 project = king-jam-ai
```

---

## 部署到生產環境

### 部署後端

```bash
cd backend

# 建置並推送 Docker 映像
gcloud builds submit --tag asia-east1-docker.pkg.dev/king-jam-ai/kingjam-repo/kingjam-backend:latest .

# 部署到 Cloud Run
gcloud run deploy kingjam-api \
  --image=asia-east1-docker.pkg.dev/king-jam-ai/kingjam-repo/kingjam-backend:latest \
  --region=asia-east1 \
  --platform=managed \
  --allow-unauthenticated
```

### 部署前端

```bash
cd frontend

# 建置並推送 Docker 映像
gcloud builds submit --tag asia-east1-docker.pkg.dev/king-jam-ai/kingjam-repo/kingjam-frontend:latest .

# 部署到 Cloud Run
gcloud run deploy kingjam-frontend \
  --image=asia-east1-docker.pkg.dev/king-jam-ai/kingjam-repo/kingjam-frontend:latest \
  --region=asia-east1 \
  --platform=managed \
  --allow-unauthenticated
```

---

## 常用指令

### Git

```bash
# 拉取最新程式碼
git pull origin main

# 提交變更
git add .
git commit -m "描述變更內容"
git push origin main

# 查看狀態
git status
```

### Docker

```bash
# 重新建置服務
docker-compose up -d --build

# 進入容器
docker exec -it kingjam_backend bash

# 查看容器日誌
docker logs -f kingjam_backend

# 清理未使用的資源
docker system prune -a
```

### 資料庫

```bash
# 連接到本地資料庫
docker exec -it kingjam_db psql -U kingjam -d kingjam_db

# 備份本地資料庫
docker exec kingjam_db pg_dump -U kingjam kingjam_db > backup.sql

# 恢復資料庫
cat backup.sql | docker exec -i kingjam_db psql -U kingjam -d kingjam_db
```

### Cloud Run 日誌

```bash
# 查看後端日誌
gcloud run services logs read kingjam-api --region=asia-east1 --limit=50

# 查看前端日誌
gcloud run services logs read kingjam-frontend --region=asia-east1 --limit=50
```

---

## 環境變數說明

### 後端環境變數 (docker-compose.yml)

| 變數名稱 | 說明 | 範例 |
|----------|------|------|
| `DATABASE_URL` | PostgreSQL 連線字串 | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | Redis 連線字串 | `redis://host:6379/0` |
| `SECRET_KEY` | JWT 密鑰 | 隨機字串 |
| `GOOGLE_GEMINI_KEY` | Google AI API 金鑰 | `AIza...` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | `GOCSPX-...` |
| `REPLICATE_API_TOKEN` | Replicate (Kling AI) API | `r8_...` |
| `R2_ENDPOINT_URL` | Cloudflare R2 端點 | `https://xxx.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` | R2 存取金鑰 ID | - |
| `R2_SECRET_ACCESS_KEY` | R2 存取金鑰 | - |
| `R2_BUCKET_NAME` | R2 儲存桶名稱 | `kingjam-assets` |

### 前端環境變數

| 變數名稱 | 說明 | 範例 |
|----------|------|------|
| `NEXT_PUBLIC_API_URL` | 後端 API 網址 | `https://api.kingjam.app` |
| `NEXT_PUBLIC_SITE_URL` | 網站網址 | `https://kingjam.app` |

---

## 生產環境資訊

### 服務網址

| 服務 | 網址 |
|------|------|
| 前端 | https://kingjam.app |
| 後端 API | https://api.kingjam.app |
| API 文件 | https://api.kingjam.app/docs |

### Google Cloud 資源

| 資源 | 名稱 | 區域 |
|------|------|------|
| Cloud Run (前端) | kingjam-frontend | asia-east1 |
| Cloud Run (後端) | kingjam-api | asia-east1 |
| Cloud SQL | kingjam-db | asia-east1 |
| Memorystore Redis | kingjam-redis | asia-east1 |
| Artifact Registry | kingjam-repo | asia-east1 |

### Cloud SQL 連線資訊

```
Host: 35.194.129.45
Port: 5432
Database: kingjam
User: postgres
```

---

## 故障排除

### Docker 服務無法啟動

```bash
# 檢查 Docker Desktop 是否運行
docker info

# 重啟 Docker 服務
docker-compose down
docker-compose up -d
```

### 資料庫連線失敗

```bash
# 檢查資料庫容器狀態
docker-compose ps db

# 查看資料庫日誌
docker-compose logs db
```

### 前端編譯錯誤

```bash
# 清除快取重新安裝
cd frontend
rm -rf node_modules .next
npm install --legacy-peer-deps
npm run dev
```

### Cloud Run 部署失敗

```bash
# 查看建置日誌
gcloud builds list --limit=5

# 查看服務狀態
gcloud run services describe kingjam-api --region=asia-east1
```

### API 金鑰問題

如果遇到 API 金鑰洩漏或失效：

1. 前往 [Google AI Studio](https://aistudio.google.com/app/apikey) 創建新金鑰
2. 更新 `docker-compose.yml` 中的 `GOOGLE_GEMINI_KEY`
3. 更新 Cloud Run 環境變數：
   ```bash
   gcloud run services update kingjam-api \
     --region=asia-east1 \
     --update-env-vars="GOOGLE_GEMINI_KEY=新的金鑰"
   ```

---

## 聯絡資訊

- GitHub: https://github.com/bobo68425/king-jam-ai
- 生產環境: https://kingjam.app

---

*最後更新: 2026-01-26*
