# King Jam AI 正式上線檢查清單

> **基礎設施**：後端／資料庫／快取以 **Railway（或同等託管）** 為主，**不使用** GCP Cloud Run、Cloud SQL、Cloud Run 網域對應或 Cloud Run Jobs。

## 一、後端與資料

- [ ] Postgres（託管）已建立，`DATABASE_URL` 已設定
- [ ] 已執行遷移：`alembic upgrade head`（於可連 DB 的環境）
- [ ] Redis（若使用）`REDIS_URL` 正確，Celery worker 可連線（若有背景任務）
- [ ] 健康檢查：`GET /health` 回 200

### 環境變數（後端）

- [ ] `SECRET_KEY`、`ENVIRONMENT=production`
- [ ] `FRONTEND_URL`、`BACKEND_URL`（與正式網域一致）
- [ ] 第三方 API／金流／簡訊等依 `.env.example` 補齊

---

## 二、前端（Vercel 等）

- [ ] 專案已連結 GitHub
- [ ] `NEXT_PUBLIC_API_URL`、`NEXT_PUBLIC_SITE_URL`
- [ ] 建置與預覽通過

---

## 三、網域與 SSL（Cloudflare 等）

- [ ] `kingjam.app` / `www` → 指向前端託管
- [ ] `api.kingjam.app` → 指向**目前 API 主機**（勿再用 `ghs.googlehosted.com` 舊 Cloud Run 對應）
- [ ] HTTPS 正常

---

## 四、OAuth（Google / Facebook / LINE）

（與先前檢查清單相同：授權來源與 Callback 含 `https://kingjam.app` 與 `https://api.kingjam.app/...`）

- [ ] Google OAuth 設定與測試
- [ ] Facebook OAuth 設定與測試
- [ ] LINE（若有）Callback 更新與測試

---

## 五、金流（綠界等）

- [ ] 正式商店代號與 HashKey / HashIV
- [ ] 通知與返回網址指向 `https://api.kingjam.app/...` 與 `https://kingjam.app/...`
- [ ] 小額測試付款

---

## 六、郵件（SendGrid 等）

- [ ] API Key、網域驗證（SPF/DKIM）
- [ ] 測試寄信

---

## 七、功能測試

- [ ] 註冊／登入／社群登入
- [ ] AI 文章、圖文、短影音、排程
- [ ] 點數／付款／訂閱
- [ ] 管理後台（若啟用）

---

## 八、監控與備份

- [ ] 後端託管日誌與告警
- [ ] 資料庫自動備份（由託管商或自行排程）
- [ ] 物件儲存（R2 等）權限與生命週期

---

## 九、上線與回滾

- [ ] DNS 與流量已切到正式環境
- [ ] 冒煙測試：`deploy/smoke-test.sh`（可選）
- [ ] 回滾：使用託管平台「上一版部署」或還原 Git tag／映像

---

## 緊急聯絡

- **綠界客服**: 02-2655-1775  
- **Vercel 支援**: https://vercel.com/support  
- **Railway**: https://railway.app  

最後更新: 2026-03-23
