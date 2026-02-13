# Instagram 串接具體步驟

本指南說明如何將 Instagram 商業帳號串接到 King Jam AI，以支援排程發文、發布貼文與限時動態。

King Jam AI 支援兩種串接方式：

| 方式 | 參考文件 | 前置條件 |
|------|----------|----------|
| **Instagram API with Instagram Login** | [官方文件](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login) | 不需粉專，用戶用 IG 帳號登入 |
| **Instagram API with Facebook Login** | [官方文件](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login) | 需粉專連結 IG、META_CONFIG_ID |

**若設定 `INSTAGRAM_APP_ID` 與 `INSTAGRAM_APP_SECRET`，系統會優先使用 Instagram Login（不需粉專）。**

---

## 一、前置條件

### 1. Instagram 帳號要求

- **必須為商業帳號或創作者帳號**（個人帳號無法使用 Graph API）
- **Instagram Login**：不需連結 Facebook 粉專
- **Facebook Login**：必須已連結 Facebook 粉絲專頁

### 2. 若尚未轉換為商業帳號

1. 開啟 Instagram App → 設定 → 帳號
2. 點「切換為專業帳號」→ 選擇「創作者」或「企業」
3. 連結 Facebook 粉絲專頁（若沒有粉專，需先建立）

---

## 二、Meta 應用程式設定

### 步驟 1：建立 Meta 應用程式

1. 前往 [Meta for Developers](https://developers.facebook.com/)
2. 點「我的應用程式」→「建立應用程式」
3. 選擇「**商業**」類型
4. 填寫應用程式名稱（如：King Jam AI）

### 步驟 2：產品設定

1. 進入應用程式後，點「新增產品」
2. 找到「**Facebook 登入**」→ 點「設定」
3. 平台選擇「**網頁**」
4. 在「有效的 OAuth 重新導向 URI」加入：

   ```
   https://api.kingjam.app/oauth/meta/callback
   ```

   若為本地開發，可再加：

   ```
   http://localhost:8000/oauth/meta/callback
   ```

### 步驟 3：取得 App ID 與 App Secret

1. 左側選單「設定」→「基本資料」
2. 複製：
   - **應用程式編號 (App ID)** → 對應 `FACEBOOK_APP_ID` 或 `META_APP_ID`
   - **應用程式密鑰 (App Secret)** → 對應 `FACEBOOK_APP_SECRET` 或 `META_APP_SECRET`

### 步驟 4：申請 Instagram 權限

1. 左側選單「應用程式審查」→「權限與功能」
2. 申請以下權限（測試模式可先使用，正式上線需審核）：

   | 權限 | 用途 |
   |------|------|
   | `instagram_basic` | 讀取 IG 基本資料 |
   | `instagram_content_publish` | 發布貼文、限時動態、Reels |
   | `instagram_manage_insights` | 取得洞察數據 |
   | `pages_show_list` | 列出可管理的粉專 |
   | `pages_read_engagement` | 讀取粉專互動 |
   | `business_management` | 管理商業帳號 |

3. 若需發文到 IG，**`instagram_content_publish` 必須審核通過**

### 步驟 5：應用程式模式

- **測試模式**：僅授權給「測試用戶」列表中的帳號
- **正式上線**：在「應用程式審查」中提交審核，通過後切換為「上線」

---

## 三、King Jam AI 後端設定

### 1. GitHub Secrets（線上部署）

在 GitHub 專案 → Settings → Secrets and variables → Actions 新增：

| Secret | 值 |
|--------|-----|
| `FACEBOOK_APP_ID` | Meta 應用程式編號（Facebook Login 用） |
| `FACEBOOK_APP_SECRET` | Meta 應用程式密鑰（Facebook Login 用） |
| `META_CONFIG_ID` | Facebook Login for Business Configuration ID（Facebook Login 必填） |
| `INSTAGRAM_APP_ID` | 選用，Instagram Login 的 App ID（不需粉專） |
| `INSTAGRAM_APP_SECRET` | 選用，Instagram Login 的 App Secret |

若設定 `INSTAGRAM_APP_ID` 與 `INSTAGRAM_APP_SECRET`，新連結的 IG 會使用 Instagram Login，不需 `META_CONFIG_ID`。

### 2. 本地開發（docker-compose）

在 `backend/.env` 或 `docker-compose.yml` 中設定：

```env
FACEBOOK_APP_ID=你的_App_ID
FACEBOOK_APP_SECRET=你的_App_Secret
META_REDIRECT_URI=http://localhost:8000/oauth/meta/callback
```

---

## 四、串接流程（用戶端）

### 1. 連結 Instagram

1. 登入 https://kingjam.app
2. 進入 **會員中心** → **社群帳號**（或 設定 → 社群帳號）
3. 找到「Instagram」卡片，點「**連結帳號**」
4. 系統會導向 Meta 授權頁面
5. 選擇要連結的 **Facebook 粉絲專頁**（該粉專必須已連結 IG 商業帳號）
6. 授權完成後會回到 King Jam AI，顯示「已連結」

### 2. 發文流程

1. 前往「**AI 生成引擎**」→「社群圖文」或「**發布管理**」
2. 建立貼文（選擇 IG 為目標平台）
3. 使用排程或立即發布

### 3. 支援的 IG 內容類型

- 單張圖片貼文
- 多圖輪播（Carousel）
- 短影片（Reels，最長 90 秒）
- 限時動態（Story）

---

## 五、驗證串接是否成功

### 1. 檢查平台狀態

```bash
curl -s "https://api.kingjam.app/scheduler/platforms" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

若 IG 回傳 `"status": "active"`，表示憑證已正確設定。

### 2. 在介面檢查

- 社群帳號頁面：Instagram 卡片顯示「已連結」、帳號名稱、頭像
- 排程發文：選擇平台時 IG 可選、發文後無錯誤

---

## 六、常見問題

| 現象 | 可能原因 | 解法 |
|------|----------|------|
| **無法載入網址、網域未包含在應用程式中** | 應用程式網域未設定 | 見下方「應用程式網域設定」 |
| **Invalid Scopes: instagram_basic, instagram_content_publish...** | 標準 Facebook Login 不支援 Instagram 權限 | 見下方「Invalid Scopes 解法」 |
| 點連結無反應 | 未設定 FACEBOOK_APP_ID / SECRET | 檢查 GitHub Secrets 或 .env |
| 授權後顯示錯誤 | OAuth 重新導向 URI 未設定 | 在 Meta 後台加入 `https://api.kingjam.app/oauth/meta/callback` |
| 顯示「needs_setup」 | 憑證未設定或部署未更新 | 確認 Secrets 並重新部署 |
| 授權成功但無法發文 | 權限未審核、IG 非商業帳號、粉專未連結 | 確認 IG 為商業帳號且已連結粉專，並申請 `instagram_content_publish` |
| 找不到 Instagram 選項 | 粉專未連結 IG 商業帳號 | 在 FB 粉專設定中連結 IG 帳號 |

### 應用程式網域設定（無法載入網址時）

若出現「無法載入網址」或「這個網址的網域未包含在應用程式的網域中」：

1. 進入 Meta 後台 → **設定** → **基本資料**
2. 找到 **「應用程式網域」** 區塊
3. 新增以下網域（每行一個，**不含** `https://`）：
   - `kingjam.app`
   - `www.kingjam.app`
   - `api.kingjam.app`
4. 儲存變更
5. 確認 **「用戶端 OAuth 設定」** 中的「有效的 OAuth 重新導向 URI」包含：
   - `https://api.kingjam.app/oauth/meta/callback`（必須完全一致，含結尾斜線與否）

### Invalid Scopes 解法（必做）

依 [官方文件](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/get-started)，Instagram API 必須使用 **Facebook Login for Business**，標準 OAuth scope 會出現 Invalid Scopes。

**步驟 1：Configure Facebook Login for Business**

1. Meta 後台 → 應用程式 → 左側「**Facebook 登入**」→「**設定**」
2. 點「**Get started with Facebook Login for Business**」
3. 若已啟用可略過

**步驟 2：建立 Configuration**

1. 左側「**Configurations**」→「**Create configuration**」
2. **登入資料版本** 選擇「**Instagram 圖形 API**」（必選，否則仍會 Invalid Scopes）
3. 依序完成：存取權杖 → 資產 → **權限**
4. 權限至少包含：`instagram_basic`、`pages_show_list`（官方最低要求）
5. 若需發文，再加：`instagram_content_publish`、`pages_read_engagement`
6. 建立完成後，複製 **Configuration ID**

**步驟 3：設定 GitHub Secret**

1. GitHub → Settings → Secrets → Actions
2. 新增 `META_CONFIG_ID` = Configuration ID
3. 重新部署後端（Secret 僅在部署時寫入 Cloud Run）

---

## 七、Instagram API with Instagram Login（選用）

若不想透過 Facebook 粉專，可改用 **Instagram Login**：用戶直接用 IG 帳號授權，不需粉專。

### 步驟 1：Meta 後台設定

1. 進入應用程式 → **Instagram** → **API setup with Instagram login**
2. 若尚未新增，點「新增產品」→ 選擇 **Instagram** → 選「**API setup with Instagram login**」
3. 進入 **3. Set up Instagram business login** → **Business login settings**
4. 複製 **Instagram App ID** 與 **Instagram App Secret**（與主 App ID 不同）
5. 在 **OAuth redirect URIs** 加入：`https://api.kingjam.app/oauth/meta/callback`

### 步驟 2：環境變數

在 GitHub Secrets 或 `.env` 新增：

| 變數 | 值 |
|------|-----|
| `INSTAGRAM_APP_ID` | Business login settings 的 Instagram App ID |
| `INSTAGRAM_APP_SECRET` | Business login settings 的 Instagram App Secret |

設定後，**不需** `META_CONFIG_ID`，新連結的 IG 帳號會使用 Instagram Login 流程。

### 步驟 3：權限（Scope）

Instagram Login 使用新 scope（舊的將於 2025/1/27 棄用）：

- `instagram_business_basic`
- `instagram_business_content_publish`
- `instagram_business_manage_comments`
- `instagram_business_manage_messages`

### 注意事項

- 已透過 Facebook Login 連結的帳號不受影響，仍可正常發文
- 若同時設定兩種方式，新連結會優先使用 Instagram Login
- 詳見 [Instagram API with Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login)

---

## 八、相關檔案

- 後端 Meta 整合：`backend/app/services/social_platforms/meta.py`
- OAuth 流程：`backend/app/routers/oauth.py`
- 社群帳號頁面：`frontend/app/dashboard/accounts/page.tsx`
- Invalid Scopes 排除：`docs/IG_Invalid_Scopes_排除.md`
- 共通檢查：`docs/FB_IG_串接檢查.md`
