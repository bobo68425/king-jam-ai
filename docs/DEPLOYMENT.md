# King Jam AI 部署指南

## 網域配置

正式網域：**kingjam.app**

## 環境變數配置

### 前端環境變數 (Next.js)

在 Vercel 或部署平台設定以下環境變數：

```env
NEXT_PUBLIC_API_URL=https://api.kingjam.app
NEXT_PUBLIC_SITE_URL=https://kingjam.app
```

### 後端環境變數 (FastAPI)

```env
# 資料庫
DATABASE_URL=postgresql://user:password@host:5432/kingjam_db

# JWT 密鑰（請使用強密碼）
SECRET_KEY=your-super-secret-key-change-this

# 環境
ENVIRONMENT=production

# CORS 已配置以下網域
# - https://kingjam.app
# - https://www.kingjam.app
```

## DNS 配置建議

| 類型 | 名稱 | 值 | 說明 |
|------|------|-----|------|
| A | @ | [伺服器 IP] | 主網域指向前端 |
| A | www | [伺服器 IP] | www 子網域 |
| A | api | [伺服器 IP] | API 子網域 |
| CNAME | www | kingjam.app | 或使用 CNAME |

## 部署架構建議

```
                    ┌─────────────────┐
                    │   Cloudflare    │
                    │   (CDN + SSL)   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │  kingjam.app│  │api.kingjam  │  │   靜態資源   │
    │   (前端)    │  │   (後端)    │  │   (S3/R2)   │
    │   Vercel    │  │   Docker    │  │             │
    └─────────────┘  └─────────────┘  └─────────────┘
```

## SSL 證書

建議使用：
- **Cloudflare**: 免費 SSL + CDN
- **Let's Encrypt**: 免費 SSL 證書
- **AWS ACM**: 如使用 AWS 服務

## 部署清單

### 上線前檢查

- [ ] 設定 DNS 指向
- [ ] 配置 SSL 證書
- [ ] 設定環境變數
- [ ] 測試 API 連線
- [ ] 測試登入功能
- [ ] 測試付款流程（ECPay/Stripe）
- [ ] 測試社群登入（Google/Facebook）
- [ ] 設定 Google OAuth 回調網址
- [ ] 設定 Facebook OAuth 回調網址
- [ ] 配置錯誤監控（Sentry）
- [ ] 設定備份策略

### OAuth 回調網址設定

**Google Cloud Console:**
```
https://kingjam.app/auth/callback/google
```

**Facebook Developer:**
```
https://kingjam.app/auth/callback/facebook
```

### ECPay 金流設定

正式環境回調網址：
```
https://api.kingjam.app/payment/ecpay/callback
https://api.kingjam.app/payment/ecpay/return
```

## 效能優化建議

1. **前端優化**
   - 啟用 Next.js Image Optimization
   - 使用 CDN 快取靜態資源
   - 啟用 Gzip/Brotli 壓縮

2. **後端優化**
   - 使用 Redis 快取
   - 資料庫索引優化
   - 啟用連線池

3. **安全性**
   - 啟用 HTTPS
   - 設定 HSTS
   - 配置 CSP 標頭
   - 限制 API 請求速率

## 監控與日誌

建議配置：
- **Sentry**: 錯誤追蹤
- **Google Analytics 4**: 使用者分析
- **Uptime Robot**: 服務監控
- **PostgreSQL 日誌**: 資料庫監控

## 備份策略

- **資料庫**: 每日自動備份，保留 30 天
- **上傳檔案**: 同步至 S3/R2
- **設定檔**: Git 版本控制

---

© 2026 King Jam AI | https://kingjam.app
