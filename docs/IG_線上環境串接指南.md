# Instagram 線上環境串接指南

> 更新日期：2026-02-15
> 參考文件：
> - [設定 Instagram 專業帳號](https://help.instagram.com/502981923235522)
> - [Instagram API with Facebook Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login)

---

## 概覽

King Jam AI 線上環境支援兩種 IG 串接方式。**系統會優先使用 Instagram Login**（若已設定 `INSTAGRAM_APP_ID`）。

| 方式 | 適用情境 | 環境變數 | 用戶前置條件 |
|------|---------|----------|-------------|
| **Instagram Login** | 不需粉專，用戶直接用 IG 登入 | `INSTAGRAM_APP_ID` + `INSTAGRAM_APP_SECRET` | IG 專業帳號 |
| **Facebook Login** | 需粉專連結，功能更完整 | `META_APP_ID` + `META_APP_SECRET` + `META_CONFIG_ID` | IG 專業帳號 + FB 粉專 |

---

## 一、線上環境狀態確認 ✅

### GitHub Secrets（目前已全部設定）

```
FACEBOOK_APP_ID        ✅ 已設定
FACEBOOK_APP_SECRET    ✅ 已設定
INSTAGRAM_APP_ID       ✅ 已設定
INSTAGRAM_APP_SECRET   ✅ 已設定
META_CONFIG_ID         ✅ 已設定
META_WEBHOOK_VERIFY_TOKEN ✅ 已設定
```

### 後端環境變數驗證

```bash
# 驗證所有 IG 相關環境變數
curl -s https://api.kingjam.app/scheduler/platforms/diagnostic | python3 -m json.tool
```

預期結果：
```json
{
  "meta": { "META_APP_ID": true, "META_APP_SECRET": true, "META_CONFIG_ID": true },
  "instagram_login": { "INSTAGRAM_APP_ID": true, "INSTAGRAM_APP_SECRET": true }
}
```

---

## 二、Meta Developer Dashboard 設定確認（必做）

### ✅ 確認清單

請登入 [Meta for Developers](https://developers.facebook.com/) 確認以下設定：

### 1. 應用程式基本資料

**位置：** 設定 → 基本資料

- [ ] **應用程式網域** 已加入：
  - `kingjam.app`
  - `api.kingjam.app`
- [ ] **隱私權政策網址**：`https://kingjam.app/privacy`
- [ ] **服務條款網址**：`https://kingjam.app/terms`
- [ ] **應用程式模式**：已上線（Live）或測試中

### 2. Facebook Login for Business（Instagram API with Facebook Login 用）

**位置：** 左側 Use cases → Authenticate and request data from users with Facebook Login → Customize → Settings

- [ ] **有效的 OAuth 重新導向 URI** 包含：
  ```
  https://api.kingjam.app/oauth/meta/callback
  ```
- [ ] **Client OAuth Login**：已啟用
- [ ] **Web OAuth Login**：已啟用

### 3. Facebook Login Configuration（Facebook Login 必要）

**位置：** 左側 Use cases → Authenticate and request data from users with Facebook Login → Customize → Configurations

- [ ] 已建立 Configuration，**登入資料版本** 選擇 **「Instagram 圖形 API」**
- [ ] Configuration 中 **權限 (Permissions)** 至少包含：
  - `instagram_basic`（讀取 IG 基本資料）
  - `pages_show_list`（列出可管理的粉專）
  - `pages_read_engagement`（讀取粉專互動 — 發文需要）
  - `instagram_content_publish`（發布貼文 — 需審核通過）
  - `business_management`（管理商業帳號）
- [ ] Configuration ID 與 `META_CONFIG_ID` Secret 一致

### 4. Instagram 產品（Instagram Login 用）

**位置：** 左側 Use cases → 找到 Instagram 相關 → API setup with Instagram login

- [ ] 已啟用 **Instagram** 產品
- [ ] 進入 **Business login settings**
- [ ] **Instagram App ID** 與 `INSTAGRAM_APP_ID` Secret 一致
- [ ] **Instagram App Secret** 與 `INSTAGRAM_APP_SECRET` Secret 一致
- [ ] **Valid OAuth redirect URIs** 包含：
  ```
  https://api.kingjam.app/oauth/meta/callback
  ```
- [ ] **Permissions** 至少包含：
  - `instagram_business_basic`
  - `instagram_business_content_publish`
  - `instagram_business_manage_comments`
  - `instagram_business_manage_messages`

### 5. 解除授權 / 資料刪除回調

**位置：** 設定 → 基本資料（頁面下方）

- [ ] **解除授權回調 URL**：`https://api.kingjam.app/oauth/meta/deauthorize`
- [ ] **資料刪除請求回調 URL**：`https://api.kingjam.app/oauth/meta/delete`

### 6. Webhook（選用）

**位置：** 左側 Webhooks

- [ ] **驗證回調 URL**：`https://api.kingjam.app/oauth/meta/webhook`
- [ ] **驗證令牌** 與 `META_WEBHOOK_VERIFY_TOKEN` Secret 一致

---

## 三、用戶端 IG 帳號要求

根據 [Instagram 幫助中心](https://help.instagram.com/502981923235522)，用戶的 IG 帳號**必須是專業帳號**（商業帳號或創作者帳號），個人帳號無法使用 Instagram API。

### 如何轉換為專業帳號

1. 開啟 Instagram App → **設定** → **帳號類型與工具**
2. 點「**切換為專業帳號**」
3. 選擇「**商業**」或「**創作者**」
4. 完成設定（選擇類別、聯絡方式等）

### Instagram Login vs Facebook Login 的差異

| 功能 | Instagram Login | Facebook Login |
|------|-----------------|----------------|
| **需要 FB 粉專** | ❌ 不需要 | ✅ 需要 |
| **發布貼文** | ✅ | ✅ |
| **發布 Reels** | ✅ | ✅ |
| **發布限時動態** | ✅ (所有專業帳號) | ✅ (僅商業帳號) |
| **讀取洞察數據** | ✅ | ✅ |
| **管理留言** | ✅ | ✅ |
| **搜尋 Hashtag** | ❌ | ✅ |
| **存取消費者帳號** | ❌ | ❌ |

---

## 四、OAuth 流程說明

### Instagram Login 流程（目前線上優先使用）

```
用戶點「連結 Instagram」
  ↓
前端 GET /oauth/connect/instagram
  ↓
後端生成 Instagram OAuth URL: https://www.instagram.com/oauth/authorize
  (使用 INSTAGRAM_APP_ID, scope: instagram_business_basic, ...)
  ↓
用戶在 Instagram 授權頁面登入 + 授權
  ↓
Instagram 重導向到 https://api.kingjam.app/oauth/meta/callback?code=xxx&state=xxx
  ↓
後端用 code 換 short-lived token (POST https://api.instagram.com/oauth/access_token)
  ↓
後端換 long-lived token (GET https://graph.instagram.com/access_token)
  ↓
後端取得 IG 帳號資料 (GET https://graph.instagram.com/v18.0/me)
  ↓
儲存 SocialAccount，重導向前端 /dashboard/accounts?oauth=success
```

### Facebook Login 流程（INSTAGRAM_APP_ID 未設定時使用）

```
用戶點「連結 Instagram」
  ↓
前端 GET /oauth/connect/instagram
  ↓
後端生成 Facebook OAuth URL: https://www.facebook.com/v18.0/dialog/oauth
  (使用 META_APP_ID, config_id: META_CONFIG_ID)
  ↓
用戶在 Facebook 授權 → 選擇粉專 → 授權 IG 權限
  ↓
Facebook 重導向到 https://api.kingjam.app/oauth/meta/callback?code=xxx&state=xxx
  ↓
後端用 code 換 short-lived token
  ↓
後端換 long-lived token (fb_exchange_token)
  ↓
後端查 /me/accounts → 取得粉專 → 查 /{page-id}?fields=instagram_business_account
  ↓
儲存 SocialAccount (含 page_id, page_access_token)
```

---

## 五、常見問題排解

### 1. 用戶授權後顯示「Invalid Scopes」

**原因：** Facebook Login 未正確使用 **Facebook Login for Business**。

**解法：**
1. Meta 後台 → Configurations → 確認使用 **「Instagram 圖形 API」** 版本
2. 確認 Configuration ID = `META_CONFIG_ID`

### 2. 授權成功但找不到 IG 帳號

**原因（Facebook Login）：** 用戶的 FB 粉專未連結 IG 商業帳號。

**解法：**
1. 用戶需到 Facebook 粉專 → 設定 → Instagram → 連結 IG 帳號
2. IG 帳號必須已轉為專業帳號

### 3. 可以讀取但無法發文

**原因：** `instagram_content_publish` 權限未審核通過。

**解法：**
1. Meta 後台 → 應用程式審查 → 權限與功能
2. 申請 `instagram_content_publish` 審核
3. 測試模式下，僅測試用戶可發文

### 4.「無法載入網址」或「網域未包含在應用程式中」

**解法：**
1. Meta 後台 → 設定 → 基本資料 → 應用程式網域
2. 加入 `kingjam.app` 和 `api.kingjam.app`

### 5. 授權後 Token 過期

**說明：** Long-lived token 有效期 60 天，需定期刷新。

**已實作：** `meta.py` 中 `refresh_token()` 方法支援自動刷新。

---

## 六、測試步驟

### 1. 確認後端 API 正常

```bash
# 健康檢查
curl -s https://api.kingjam.app/admin/health/quick
# 預期: {"status":"healthy","checks":{"redis":"ok","database":"ok"}}

# 平台診斷
curl -s https://api.kingjam.app/scheduler/platforms/diagnostic
# 預期: instagram_login 的所有值都為 true
```

### 2. 測試 OAuth 流程

1. 登入 https://kingjam.app
2. 進入 **會員中心** → **社群帳號**
3. 點「連結 Instagram」
4. 系統應導向 Instagram 授權頁面（Instagram Login）
5. 授權後回到 King Jam AI，顯示「已連結」

### 3. 測試發文

1. 進入 **AI 生成引擎** → **社群圖文**
2. 選擇 Instagram 為目標平台
3. 生成或手動填寫內容
4. 點「發布」或設定排程

---

## 七、注意事項

### 應用程式審核

- **測試模式**：僅 Meta 後台中列為「測試用戶」的帳號可授權
- **正式上線**：需通過 Meta 應用程式審核，所有用戶才能使用
- **審核重點**：需提供螢幕截圖/影片說明 App 如何使用每個權限

### API 版本

目前程式碼使用 `v18.0`，Meta 會定期淘汰舊版本。建議維持在最新的穩定版本。

### Rate Limiting

Instagram API 有速率限制：
- 內容發布：每 24 小時最多 25 則（API Endpoint 限制）
- API 呼叫：最多 200 次/用戶/小時

---

## 八、相關檔案

| 檔案 | 說明 |
|------|------|
| `backend/app/services/social_platforms/meta.py` | Meta 平台整合（IG/FB/Threads） |
| `backend/app/routers/oauth.py` | OAuth 授權流程 |
| `docs/IG_串接步驟.md` | 串接步驟教學 |
| `docs/IG_Invalid_Scopes_排除.md` | Invalid Scopes 問題排解 |
| `docs/FB_IG_串接檢查.md` | 共通檢查 |
