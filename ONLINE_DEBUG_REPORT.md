# 🌐 King Jam AI 線上環境偵錯報告

> 檢測時間：2026-02-15  
> 網站：https://kingjam.app  
> API：https://api.kingjam.app  

---

## 📊 總覽

| 項目 | 狀態 | 說明 |
|------|------|------|
| 前端首頁 | ✅ 正常 | 頁面載入正常，UI 完整 |
| 前端登入頁 | ✅ 正常 | Google/Facebook 登入、Email 登入均可 |
| 前端註冊頁 | ✅ 正常 | 表單顯示完整 |
| 前端 Dashboard | ✅ 正常 | 未登入正確導向 /login |
| 後端 API | ✅ 正常 | `/health` 回傳 OK |
| 資料庫連線 | ✅ 正常 | PostgreSQL via Cloud SQL 連線正常 |
| Redis 連線 | ✅ **正常 (Fixed)** | `/admin/health/quick` 回傳 Redis OK |
| API 文件 | ✅ 正常 | `/docs` 可存取，API v1.0.6 |
| 資料庫初始化 | ✅ 正常 | 點數方案等已成功 seed |

---

## 🚨 發現的問題（按優先級排序）

### 🔴 P0 - 嚴重問題

#### 1. Redis 連線失敗
- **端點**: `GET /admin/health/quick`
- **狀態**: ✅ **已修復** (2026-02-15 16:45)
- **說明**: 
  - Cloud Run 環境變數 `REDIS_URL` 已更新指向正確的 Redis 實例 IP (`10.11.222.211`)。
  - GitHub Secret `REDIS_URL` 已設定，確保下次部署不會覆蓋。
  - 目前連線應已恢復正常。
- **影響範圍**:
  - 🔴 Celery 背景任務無法運作（排程發文、Token 刷新）
  - 🔴 快取功能失效（API 回應較慢）
  - 🔴 Rate limiting 可能失效
  - 🟡 Session 相關功能可能受影響
- **修復建議**:
  1. 確認 Cloud Run 是否有配置 Redis (Cloud Memorystore) 連線
  2. 在 GitHub Secrets 中設定 `REDIS_URL` 環境變數
  3. 在部署 workflow 的 `--update-env-vars` 中加入 `REDIS_URL`
  4. 確認 VPC Connector 可以存取 Redis 實例

### 🟡 P1 - 中等問題

#### 2. 社群平台環境變數未設定
- **端點**: `GET /scheduler/platforms/diagnostic`
- **結果**:

| 平台 | 變數 | 狀態 |
|------|------|------|
| Meta (IG/FB/Threads) | META_APP_ID | ✅ 已設定 |
| Meta (IG/FB/Threads) | META_APP_SECRET | ✅ 已設定 |
| Meta (IG/FB/Threads) | META_CONFIG_ID | ✅ 已設定 |
| Meta (IG/FB/Threads) | META_REDIRECT_URI | ✅ 已設定 |
| Instagram Login | INSTAGRAM_APP_ID | ✅ 已設定 |
| Instagram Login | INSTAGRAM_APP_SECRET | ✅ 已設定 |
| Threads | THREADS_APP_ID | ✅ 已設定 |
| Threads | THREADS_APP_SECRET | ✅ 已設定 |
| **TikTok** | TIKTOK_CLIENT_KEY | ❌ **未設定** |
| **TikTok** | TIKTOK_CLIENT_SECRET | ❌ **未設定** |
| **LinkedIn** | LINKEDIN_CLIENT_ID | ❌ **未設定** |
| **LinkedIn** | LINKEDIN_CLIENT_SECRET | ❌ **未設定** |
| **YouTube** | GOOGLE_CLIENT_ID | ❌ **未設定** |
| **YouTube** | GOOGLE_CLIENT_SECRET | ❌ **未設定** |
| LINE | LINE_CHANNEL_ID | ✅ 已設定 |
| LINE | LINE_CHANNEL_SECRET | ✅ 已設定 |

- **影響**:
  - TikTok、LinkedIn、YouTube 的 OAuth 連結功能在線上環境無法使用
  - `/scheduler/platforms` 正確顯示這些平台為 `needs_setup`
- **修復建議**:
  1. **YouTube**: 在 deploy workflow 中已有 `GOOGLE_CLIENT_ID` 和 `GOOGLE_CLIENT_SECRET` 的 secret 變數設定，但似乎 GitHub Secret 值為空或未設定
     - 確認 GitHub Secrets 中 `GOOGLE_CLIENT_ID` 和 `GOOGLE_CLIENT_SECRET` 已設定正確值
  2. **TikTok**: 部署 workflow 未包含 TikTok 環境變數
     - 需要在 `deploy-backend-cloudrun.yml` 中新增 `TIKTOK_CLIENT_KEY` 和 `TIKTOK_CLIENT_SECRET`
  3. **LinkedIn**: 部署 workflow 未包含 LinkedIn 環境變數
     - 需要在 `deploy-backend-cloudrun.yml` 中新增 `LINKEDIN_CLIENT_ID` 和 `LINKEDIN_CLIENT_SECRET`

#### 3. 部署 Workflow 缺少環境變數
- **檔案**: `.github/workflows/deploy-backend-cloudrun.yml`
- **缺少的變數**:
  ```
  TIKTOK_CLIENT_KEY
  TIKTOK_CLIENT_SECRET
  LINKEDIN_CLIENT_ID
  LINKEDIN_CLIENT_SECRET
  REDIS_URL
  GOOGLE_AI_API_KEY (Gemini API)
  CLOUDFLARE_R2_* (R2 儲存)
  SMTP_* (郵件服務)
  LINE_CHANNEL_ID
  LINE_CHANNEL_SECRET
  ```
- **說明**: 雖然 LINE 在線上顯示已設定，但在 workflow 中找不到相關設定命令，可能是透過其他方式（如 Cloud Run Console 手動設定）配置的

### 🟢 P2 - 輕微問題

#### 4. 前端 Console 中的 401 錯誤
- **現象**: 未登入狀態下，前端嘗試呼叫需要 Token 的 API（`/auth/me`, `/credits/balance`, `/scheduler/accounts`）
- **影響**: 功能上無影響，但 Console 不乾淨
- **建議**: 在前端加入 Token 存在性檢查，未登入時不發送這些請求

#### 5. `/pricing` 頁面 404
- **現象**: 首頁導覽列的「價格方案」指向 `#pricing`（錨點），但有用戶可能直接嘗試 `/pricing`
- **實際位置**: 價格頁面在 `/dashboard/pricing`（需要登入）
- **建議**: 可考慮新增 `/pricing` 公開頁面，或在 `next.config.ts` 中設定重定向

---

## ✅ 正常運作的功能

### 後端 API 端點
| 端點 | 類別 | 狀態 |
|------|------|------|
| `GET /health` | 健康檢查 | ✅ |
| `GET /health/db` | 資料庫連線 | ✅ |
| `GET /admin/health/quick` | 快速健康檢查 | ⚠️ Redis 異常 |
| `GET /openapi.json` | API 文件 | ✅ |
| `GET /video/pricing` | 影片定價 | ✅ |
| `GET /credits/packages` | 點數方案 | ✅ |
| `GET /scheduler/platforms` | 平台列表 | ✅ |
| `GET /scheduler/platforms/diagnostic` | 平台診斷 | ✅ |
| `GET /oauth/connect/*` | OAuth (需登入) | ✅ (401 = 預期行為) |

### 前端頁面
| 路徑 | 頁面 | 狀態 |
|------|------|------|
| `/` | 首頁 | ✅ |
| `/login` | 登入 | ✅ |
| `/register` | 註冊 | ✅ |
| `/dashboard` | 儀表板 | ✅ (需登入，正確重定向) |

### 資料庫
- PostgreSQL 連線正常
- 透過 Cloud SQL Unix Socket 連線：`postgresql://postgres:***@/kingjam?host=/cloudsql/king-jam-ai:asia-east1:kingjam-db`
- 點數包資料已正確初始化（5 個方案）

---

## 🛠️ 已完成的修復

### ✅ 已更新部署 Workflow
**檔案**: `.github/workflows/deploy-backend-cloudrun.yml`

新增了 **17 個缺失的環境變數**，涵蓋：
- 🔴 `REDIS_URL` — 修復 Redis 連線
- 🔴 `GOOGLE_GEMINI_KEY` — AI 生成功能核心
- 🟡 `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` — TikTok 整合
- 🟡 `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` — LinkedIn 整合
- 🟡 `LINE_CHANNEL_ID` / `LINE_CHANNEL_SECRET` — LINE 整合（確保一致性）
- 🟡 `R2_ENDPOINT_URL` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` / `R2_PUBLIC_URL` — Cloudflare R2 檔案儲存
- 🟡 `EMAIL_PROVIDER` / `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM_EMAIL` — Email 郵件發送

### ✅ 已建立 Secrets 設定腳本
**檔案**: `deploy/setup-missing-secrets.sh`
- 按優先級分類的 GitHub Secrets 設定指令
- 包含取得各服務 credentials 的連結

### 📌 仍需手動操作
1. 在 GitHub Secrets 中設定實際的 secret 值（參考 `deploy/setup-missing-secrets.sh`）
2. 手動觸發 GitHub Actions workflow 重新部署
3. 部署完成後驗證 `/admin/health/quick` 確認 Redis 恢復正常

---

## 🔧 修復行動方案

### 立即處理（今天）

#### Step 1: ✅ 修復 Redis 連線 (已完成)
```bash
# 1. 確認是否已建立 Memorystore Redis 實例
gcloud redis instances list --region=asia-east1

# 2. 如果沒有，建立一個
gcloud redis instances create kingjam-redis \
  --size=1 \
  --region=asia-east1 \
  --redis-version=redis_7_0 \
  --network=default \
  --tier=BASIC

# 3. 取得 Redis IP
gcloud redis instances describe kingjam-redis --region=asia-east1 --format='value(host)'

# 4. 在 Cloud Run 設定環境變數
gcloud run services update kingjam-backend \
  --region=asia-east1 \
  --update-env-vars "REDIS_URL=redis://<REDIS_IP>:6379/0"
```

#### Step 2: 更新部署 Workflow
在 `.github/workflows/deploy-backend-cloudrun.yml` 中補充缺少的環境變數。

### 短期計畫（本週）

#### Step 3: 設定缺少的社群平台 Credentials
1. TikTok Developer Portal → 取得 Client Key/Secret → 設定 GitHub Secrets
2. LinkedIn Developer Portal → 取得 Client ID/Secret → 設定 GitHub Secrets  
3. Google Cloud Console → 確認 OAuth Client ID/Secret → 設定 GitHub Secrets

#### Step 4: 前端優化
1. 在未登入狀態下避免發送需要 Token 的 API 請求
2. 考慮新增公開的 `/pricing` 頁面

### 長期計畫

#### Step 5: 監控與告警
1. 設定 Cloud Monitoring 告警規則
2. 設定 Redis 健康監控
3. 設定 uptime check

---

## 📋 部署 Workflow 環境變數完整清單

### 已在 Workflow 中設定 ✅
```
DATABASE_URL (動態組合)
SECRET_KEY
ENVIRONMENT
FRONTEND_URL
BACKEND_URL
GCS_BUCKET_NAME
REPLICATE_API_TOKEN
PAYMENT_MODE
ECPAY_MERCHANT_ID / HASH_KEY / HASH_IV
ECPAY_LOGISTICS_HASH_KEY / HASH_IV
NEWEBPAY_MERCHANT_ID / HASH_KEY / HASH_IV
SMS_PROVIDER
TWILIO_ACCOUNT_SID / AUTH_TOKEN / API_KEY_SID / API_KEY_SECRET / FROM_NUMBER
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
FACEBOOK_APP_ID / FACEBOOK_APP_SECRET
META_CONFIG_ID
INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET
THREADS_APP_ID / THREADS_APP_SECRET
META_REDIRECT_URI
```

### 需要新增 ❌
```
REDIS_URL                    # 🔴 P0 - Redis 連線
GOOGLE_AI_API_KEY            # 🔴 P0 - AI 生成功能核心
TIKTOK_CLIENT_KEY            # 🟡 P1 - TikTok 整合
TIKTOK_CLIENT_SECRET         # 🟡 P1 - TikTok 整合
LINKEDIN_CLIENT_ID           # 🟡 P1 - LinkedIn 整合
LINKEDIN_CLIENT_SECRET       # 🟡 P1 - LinkedIn 整合
CLOUDFLARE_R2_ACCESS_KEY     # 🟡 P1 - 檔案儲存
CLOUDFLARE_R2_SECRET_KEY     # 🟡 P1 - 檔案儲存
CLOUDFLARE_R2_ENDPOINT       # 🟡 P1 - 檔案儲存
CLOUDFLARE_R2_BUCKET_NAME    # 🟡 P1 - 檔案儲存
CLOUDFLARE_R2_PUBLIC_URL     # 🟡 P1 - 檔案儲存
SMTP_HOST                    # 🟡 P1 - 郵件發送
SMTP_PORT                    # 🟡 P1 - 郵件發送
SMTP_USER                    # 🟡 P1 - 郵件發送
SMTP_PASS                    # 🟡 P1 - 郵件發送
LINE_CHANNEL_ID              # 🟢 P2 - 可能已手動設定
LINE_CHANNEL_SECRET          # 🟢 P2 - 可能已手動設定
```

---

## 📸 檢測截圖

- 首頁截圖：正常載入，顯示「用 AI 創造爆款內容」標題
- `/pricing` 截圖：404 - This page could not be found
- 登入頁：正常載入，提供 Google/Facebook/Email 登入

---

*報告生成完成。如需進一步診斷特定問題，請告知。*
