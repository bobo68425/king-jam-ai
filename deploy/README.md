# King Jam AI 部署指南

## 快速開始

### 前置需求

1. 安裝 [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
2. 安裝 [Docker](https://docs.docker.com/get-docker/)
3. 擁有 GCP 專案並啟用計費

### 部署流程

```bash
# 1. 設置環境變數
export GCP_PROJECT_ID=your-project-id
export GCP_REGION=asia-east1

# 2. 登入 GCP
gcloud auth login
gcloud config set project $GCP_PROJECT_ID

# 3. 建立基礎設施
cd deploy
chmod +x *.sh
./gcp-setup.sh

# 4. 準備環境變數
cp env-production-template.txt .env.production
# 編輯 .env.production 填入實際值

# 5. 設置 Secret Manager
./setup-secrets.sh .env.production

# 6. 部署後端
./deploy-backend.sh

# 7. 部署前端 (Vercel)
# - 連接 GitHub 到 Vercel
# - 設置環境變數
# - 觸發部署

# 8. 設置網域
./domain-setup.sh
```

## 目錄結構

```
deploy/
├── README.md                    # 本文件
├── PRODUCTION_CHECKLIST.md      # 上線檢查清單
├── gcp-setup.sh                 # GCP 基礎設施設置
├── setup-secrets.sh             # Secret Manager 設置
├── deploy-backend.sh            # 後端部署腳本
├── domain-setup.sh              # 網域設置指南
├── cors-config.json             # Cloud Storage CORS 設定
└── env-production-template.txt  # 環境變數模板
```

## 架構說明

```
                     用戶
                      │
                      ▼
              ┌─────────────┐
              │ Cloudflare  │ (CDN + SSL)
              └─────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   Vercel    │ │ Cloud Run   │ │   Cloud     │
│  (前端)     │ │   (API)     │ │  Storage    │
│ kingjam.app │ │api.kingjam  │ │  (檔案)     │
└─────────────┘ └─────────────┘ └─────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Cloud SQL   │ │ Memorystore │ │   Cloud     │
│ (PostgreSQL)│ │   (Redis)   │ │   Tasks     │
└─────────────┘ └─────────────┘ └─────────────┘
```

## 服務清單

| 服務 | 用途 | 網址 |
|------|------|------|
| 前端 | Next.js 應用程式 | https://kingjam.app |
| API | FastAPI 後端 | https://api.kingjam.app |
| 資料庫 | PostgreSQL 15 | Cloud SQL (內部) |
| 快取 | Redis 7 | Memorystore (內部) |
| 檔案儲存 | 用戶上傳、影片 | Cloud Storage |

## 費用估算

| 服務 | 規格 | 月費 (USD) |
|------|------|-----------|
| Cloud SQL | db-f1-micro | ~$10 |
| Memorystore | 1GB Basic | ~$35 |
| Cloud Run | 按使用量 | ~$30-50 |
| Cloud Storage | 10GB | ~$0.5 |
| Vercel | Pro Plan (可選) | $20 |
| **總計** | | **~$75-115** |

## 維護指南

### 查看日誌

```bash
# Cloud Run 日誌
gcloud run services logs read kingjam-api --region=asia-east1

# 即時日誌
gcloud run services logs tail kingjam-api --region=asia-east1
```

### 更新部署

```bash
# 重新部署後端
./deploy-backend.sh

# 或使用 Cloud Build
gcloud builds submit --config=../backend/cloudbuild.yaml ../backend
```

### 擴展服務

```bash
# 調整 Cloud Run 執行個體
gcloud run services update kingjam-api \
  --min-instances=1 \
  --max-instances=20 \
  --region=asia-east1
```

### 資料庫備份

Cloud SQL 自動備份已開啟。手動備份:

```bash
gcloud sql backups create --instance=kingjam-db
```

## 故障排除

### API 無法存取

1. 檢查 Cloud Run 狀態
2. 檢查 VPC Connector 連線
3. 確認環境變數正確

### 資料庫連線失敗

1. 確認 Cloud SQL 執行個體運行中
2. 檢查 VPC Connector
3. 驗證連線字串格式

### Redis 連線失敗

1. 確認 Memorystore 執行個體運行中
2. 檢查 IP 位址是否正確
3. 確認 VPC 設定

## 聯絡資訊

- 技術支援: service@kingjam.app
- GCP 支援: https://cloud.google.com/support

---

© 2026 King Jam AI
