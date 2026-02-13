# Threads 串接步驟

本指南說明如何將 Threads 帳號串接到 King Jam AI。

---

## 重要說明

**Threads API 使用專用的 App ID 與 App Secret**，與 Facebook/Instagram 的 App ID 不同。

建立 Meta 應用程式並選擇「Access the Threads API」use case 時，會得到**兩組**憑證：
- 主應用程式編號（用於 FB/IG）
- **Threads app ID** 與 **Threads app secret**（用於 Threads API）

必須使用 **Threads app ID** 與 **Threads app secret** 才能正確連接 Threads。

---

## 一、Meta 後台設定

### 步驟 1：建立或編輯應用程式

1. 前往 [Meta for Developers](https://developers.facebook.com/)
2. 建立新應用程式，或編輯現有應用程式
3. 在 **Use cases** 中新增「**Access the Threads API**」use case

### 步驟 2：取得 Threads 憑證

1. 左側選單點 **Use cases** → **Access the Threads API** → **Settings**
2. 找到 **Threads app ID** 與 **Threads app secret**
3. 複製這兩個值（**不是**主應用程式的 App ID）

### 步驟 3：設定 OAuth 回調網址（必做，否則會出現「重新導向失敗」）

在 Threads use case 的 Settings 中：

1. 找到 **「重新導向回呼網址」** 或 **「Client OAuth Settings」** 或 **「有效的 OAuth 重新導向 URI」**
2. 在欄位中**一字不差**填入：
   ```
   https://api.kingjam.app/oauth/meta/callback
   ```
   - 必須是 `https://`
   - 結尾**不要**加斜線 `/`
   - 不可有空格或換行

3. **解除安裝回呼網址**（若必填，請填入）：
   ```
   https://api.kingjam.app/oauth/meta/deauthorize
   ```

4. **刪除回呼網址**（若必填，請填入）：
   ```
   https://api.kingjam.app/oauth/meta/delete
   ```

5. 點擊 **儲存** 或 **Save**

### 步驟 3.5：確認應用程式網域

在 **設定** → **基本資料** 中，確認「**應用程式網域**」包含：

- `kingjam.app`
- `www.kingjam.app`
- `api.kingjam.app`

若沒有，請新增後儲存。

### 步驟 4：新增測試用戶（開發階段）

1. 點擊 **Add or Remove Threads Test Users**
2. 新增要測試的 Threads 帳號為 **Threads Testers**
3. 測試用戶需在 Threads 的 **Account Settings** → **Website permissions** 中接受邀請

---

## 二、King Jam AI 設定

### GitHub Secrets（線上部署）

在 GitHub 專案 → **Settings** → **Secrets and variables** → **Actions** 新增：

| Secret | 值 |
|--------|-----|
| `THREADS_APP_ID` | Meta 後台 Threads use case 的 **Threads app ID** |
| `THREADS_APP_SECRET` | Meta 後台 Threads use case 的 **Threads app secret** |

### 本地開發

在 `backend/.env` 或 `docker-compose.yml` 中：

```env
THREADS_APP_ID=你的_Threads_App_ID
THREADS_APP_SECRET=你的_Threads_App_Secret
META_REDIRECT_URI=http://localhost:8000/oauth/meta/callback
```

---

## 三、錯誤排除

### 「授權失敗: 要求未傳送應用程式編號」(error_code: 4476002)

**原因**：使用了 Facebook/Instagram 的 App ID，而非 Threads 專用 App ID。

**解法**：
1. 確認應用程式已新增「Access the Threads API」use case
2. 在 Threads use case 的 **Settings** 取得 Threads app ID 與 app secret
3. 設定 `THREADS_APP_ID` 與 `THREADS_APP_SECRET`（不要用 FACEBOOK_APP_ID）

### 「Long-lived token exchange failed: Error validating application」

**原因**：Threads 使用專用端點 `graph.threads.net/access_token` 交換長期 token，不可用 Facebook 的 `graph.facebook.com`。

**解法**：已修正，Threads 現使用 `grant_type=th_exchange_token` 與 `https://graph.threads.net/access_token`。請重新部署後端。

### 「網址已遭封鎖」「重新導向失敗」(error_code: 1349168)

**原因**：OAuth 重新導向 URI 未在 Threads 設定中列入許可名單。

**解法**：
1. 前往 **Use cases** → **Access the Threads API** → **Settings**
2. 在「重新導向回呼網址」或「Client OAuth Settings」中新增：
   `https://api.kingjam.app/oauth/meta/callback`
3. 確認「應用程式網域」已包含 `api.kingjam.app`
4. 確認已啟用「用戶端 OAuth 登入」與「網站 OAuth 登入」
5. 點擊儲存

### 「無法儲存表單」

- 確認「應用程式網域」已加入 `api.kingjam.app`
- 確認 OAuth 重新導向 URI 格式正確（https、無尾斜線）

---

## 四、相關檔案

- 後端 Meta 整合：`backend/app/services/social_platforms/meta.py`
- OAuth 流程：`backend/app/routers/oauth.py`
- 部署設定：`.github/workflows/deploy-backend-cloudrun.yml`
