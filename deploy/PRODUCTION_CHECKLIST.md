# King Jam AI 正式上線檢查清單

## 一、GCP 基礎設施

### Cloud SQL
- [ ] 執行個體已建立 (`kingjam-db`)
- [ ] 資料庫密碼已設置並記錄
- [ ] 已執行資料庫遷移 (`alembic upgrade head`)
- [ ] 已測試連線成功

### Memorystore Redis
- [ ] 執行個體已建立 (`kingjam-redis`)
- [ ] 已記錄 Redis IP 位址
- [ ] 已測試連線成功

### Cloud Storage
- [ ] 儲存桶已建立
- [ ] CORS 設定已套用
- [ ] 權限設定正確

### VPC Connector
- [ ] Connector 已建立 (`kingjam-connector`)
- [ ] Cloud Run 可存取內部網路

---

## 二、Cloud Run 後端

### 部署
- [ ] Docker 映像檔已建立並推送
- [ ] Cloud Run 服務已部署
- [ ] 健康檢查通過 (`/health` 回傳 200)
- [ ] 環境變數已設置

### 環境變數檢查
- [ ] `DATABASE_URL` - Cloud SQL 連線
- [ ] `SECRET_KEY` - JWT 密鑰
- [ ] `REDIS_URL` - Redis 連線
- [ ] `ENVIRONMENT=production`
- [ ] `FRONTEND_URL=https://kingjam.app`
- [ ] `BACKEND_URL=https://api.kingjam.app`

---

## 三、前端部署 (Vercel)

### Vercel 設定
- [ ] 專案已連結 GitHub
- [ ] 環境變數已設置
  - [ ] `NEXT_PUBLIC_API_URL=https://api.kingjam.app`
  - [ ] `NEXT_PUBLIC_SITE_URL=https://kingjam.app`
- [ ] 建置成功
- [ ] 預覽部署測試通過

---

## 四、網域配置

### DNS 設定 (Cloudflare)
- [ ] `api.kingjam.app` CNAME → `ghs.googlehosted.com`
- [ ] `kingjam.app` CNAME → `cname.vercel-dns.com`
- [ ] `www.kingjam.app` CNAME → `cname.vercel-dns.com`
- [ ] DNS 傳播完成

### SSL 證書
- [ ] `api.kingjam.app` SSL 有效
- [ ] `kingjam.app` SSL 有效
- [ ] HTTPS 強制跳轉正常

---

## 五、OAuth 設定

### Google OAuth
- [ ] 登入 [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
- [ ] 新增已授權的 JavaScript 來源:
  - `https://kingjam.app`
  - `https://www.kingjam.app`
- [ ] 新增已授權的重新導向 URI:
  - `https://kingjam.app/auth/callback/google`
  - `https://api.kingjam.app/auth/google/callback`
- [ ] 測試 Google 登入功能

### Facebook OAuth
- [ ] 登入 [Facebook Developer](https://developers.facebook.com/)
- [ ] 新增有效的 OAuth 重新導向 URI:
  - `https://kingjam.app/auth/callback/facebook`
  - `https://api.kingjam.app/auth/facebook/callback`
- [ ] 應用程式設為「上線」模式
- [ ] 測試 Facebook 登入功能

### LINE Login (如有)
- [ ] 登入 [LINE Developer Console](https://developers.line.biz/)
- [ ] 更新 Callback URL
- [ ] 測試 LINE 登入功能

---

## 六、金流設定

### 綠界 ECPay
- [ ] 登入 [綠界商家後台](https://vendor.ecpay.com.tw/)
- [ ] 取得正式環境商店代號、HashKey、HashIV
- [ ] 設定付款結果通知網址:
  - `https://api.kingjam.app/payment/callback/ecpay`
- [ ] 設定付款完成返回網址:
  - `https://kingjam.app/dashboard/payment/result`
- [ ] 更新後端環境變數 `PAYMENT_MODE=production`
- [ ] 測試小額付款流程

### Stripe (如有)
- [ ] 切換到 Live 模式
- [ ] 更新 API Key
- [ ] 設定 Webhook endpoint
- [ ] 測試付款流程

---

## 七、郵件服務

### SendGrid
- [ ] 登入 [SendGrid](https://app.sendgrid.com/)
- [ ] 建立 API Key
- [ ] 驗證發送網域 (`kingjam.app`)
- [ ] 設定 SPF、DKIM 記錄
- [ ] 測試郵件發送

---

## 八、功能測試

### 基本功能
- [ ] 首頁正常載入
- [ ] 用戶註冊流程
- [ ] Email 登入功能
- [ ] 社群登入功能 (Google/Facebook)
- [ ] 忘記密碼/重設密碼

### 核心功能
- [ ] AI 文章生成
- [ ] 社群圖文生成
- [ ] 短影片生成
- [ ] 排程發布功能

### 付款功能
- [ ] 購買點數頁面正常
- [ ] ECPay 付款流程
- [ ] 付款成功點數入帳
- [ ] 訂閱方案升級

### 管理後台
- [ ] 管理員登入
- [ ] 用戶管理功能
- [ ] 提領審核功能
- [ ] 行銷活動功能

---

## 九、監控與備份

### 監控設定
- [ ] Cloud Run 日誌已開啟
- [ ] Cloud SQL 監控已開啟
- [ ] 設定錯誤告警

### 備份策略
- [ ] Cloud SQL 自動備份已開啟
- [ ] 儲存桶版本控制已開啟

---

## 十、上線切換

### 最終確認
- [ ] 所有測試通過
- [ ] 團隊成員確認
- [ ] 備份現有資料

### 上線步驟
1. [ ] 確認 DNS 已切換到正式環境
2. [ ] 監控錯誤日誌
3. [ ] 執行冒煙測試
4. [ ] 公告上線

---

## 緊急聯絡

- **GCP 支援**: https://cloud.google.com/support
- **綠界客服**: 02-2655-1775
- **Vercel 支援**: https://vercel.com/support

---

## 回滾計畫

如發生嚴重問題:

1. Cloud Run 回滾到前一版本:
   ```bash
   gcloud run services update-traffic kingjam-api --to-revisions=PREVIOUS_REVISION=100
   ```

2. DNS 切回測試環境 (如需要)

3. 通知用戶並調查問題

---

最後更新: 2026-01-23
