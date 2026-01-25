# 社群平台 OAuth 串接設定指南

本指南說明如何取得各社群平台的 API 金鑰，以啟用 King Jam AI 的社群帳號連結功能。

---

## 📋 總覽

| 平台 | 所需金鑰 | 申請網址 |
|------|----------|----------|
| Meta (Instagram/Facebook/Threads) | App ID + App Secret | [Meta for Developers](https://developers.facebook.com/) |
| TikTok | Client Key + Client Secret | [TikTok for Developers](https://developers.tiktok.com/) |
| LinkedIn | Client ID + Client Secret | [LinkedIn Developer](https://www.linkedin.com/developers/) |
| YouTube | Google Client ID + Secret | [Google Cloud Console](https://console.cloud.google.com/) |
| LINE | Channel ID + Channel Secret | [LINE Developers](https://developers.line.biz/) |

---

## 1️⃣ Meta (Instagram / Facebook / Threads)

### 申請步驟

1. 前往 [Meta for Developers](https://developers.facebook.com/)
2. 點擊「我的應用程式」→「建立應用程式」
3. 選擇應用程式類型：**商業**
4. 填寫應用程式名稱（例如：King Jam AI）

### 設定 OAuth

1. 在應用程式設定中，找到「Facebook 登入」產品並新增
2. 設定有效的 OAuth 重新導向 URI：
   ```
   http://localhost:8000/oauth/meta/callback
   ```
3. 在「設定」→「基本資料」中取得：
   - **應用程式編號** (App ID) → `META_APP_ID`
   - **應用程式密鑰** (App Secret) → `META_APP_SECRET`

### 所需權限

#### Instagram Business
- `instagram_basic`
- `instagram_content_publish`
- `instagram_manage_insights`
- `pages_show_list`
- `pages_read_engagement`
- `business_management`

#### Facebook Page
- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`
- `pages_manage_engagement`
- `publish_video`

#### Threads
- `threads_basic`
- `threads_content_publish`
- `threads_manage_insights`
- `threads_manage_replies`

### ⚠️ 注意事項
- Instagram 連結需要有 **Facebook 粉絲專頁** 並連結到 **Instagram 商業帳號/創作者帳號**
- 需要提交應用程式審核才能取得正式權限

---

## 2️⃣ TikTok

### 申請步驟

1. 前往 [TikTok for Developers](https://developers.tiktok.com/)
2. 創建開發者帳號
3. 點擊「Manage apps」→「Create app」
4. 選擇「Web」平台

### 設定 OAuth

1. 在應用程式設定中，填寫 Redirect URI：
   ```
   http://localhost:8000/oauth/tiktok/callback
   ```
2. 在「App info」中取得：
   - **Client Key** → `TIKTOK_CLIENT_KEY`
   - **Client Secret** → `TIKTOK_CLIENT_SECRET`

### 所需權限

申請以下 Scopes：
- `user.info.basic`
- `user.info.profile`
- `user.info.stats`
- `video.publish`
- `video.upload`

### ⚠️ 注意事項
- 需要申請 **Content Posting API** 權限
- 影片發布需要 TikTok 審核通過

---

## 3️⃣ LinkedIn

### 申請步驟

1. 前往 [LinkedIn Developer Portal](https://www.linkedin.com/developers/)
2. 點擊「Create app」
3. 填寫應用程式資訊

### 設定 OAuth

1. 在「Auth」頁籤中，新增 Redirect URL：
   ```
   http://localhost:8000/oauth/linkedin/callback
   ```
2. 取得：
   - **Client ID** → `LINKEDIN_CLIENT_ID`
   - **Client Secret** → `LINKEDIN_CLIENT_SECRET`

### 所需權限

在「Products」頁籤中申請：
- **Share on LinkedIn**
- **Sign In with LinkedIn using OpenID Connect**

所需 Scopes：
- `openid`
- `profile`
- `email`
- `w_member_social`

### ⚠️ 注意事項
- 需要公司粉絲專頁才能發布到公司頁面
- 個人發布會發到個人動態

---

## 4️⃣ YouTube

### 申請步驟

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 創建新專案或選擇現有專案
3. 啟用 **YouTube Data API v3**

### 設定 OAuth

1. 前往「API 和服務」→「憑證」
2. 創建「OAuth 2.0 用戶端 ID」
3. 選擇「網頁應用程式」
4. 新增已授權的重新導向 URI：
   ```
   http://localhost:8000/oauth/youtube/callback
   ```
5. 取得：
   - **用戶端 ID** → `GOOGLE_CLIENT_ID`
   - **用戶端密鑰** → `GOOGLE_CLIENT_SECRET`

### 所需權限

Scopes：
- `https://www.googleapis.com/auth/youtube`
- `https://www.googleapis.com/auth/youtube.upload`
- `https://www.googleapis.com/auth/youtube.readonly`

### ⚠️ 注意事項
- 需要有 YouTube 頻道
- 上傳影片需要通過 Google 審核

---

## 5️⃣ LINE

### 申請步驟

1. 前往 [LINE Developers](https://developers.line.biz/)
2. 創建 Provider
3. 創建 **LINE Login** Channel（用於用戶授權）
4. 創建 **Messaging API** Channel（用於發送訊息）

### 設定 OAuth

1. 在 LINE Login Channel 中：
   - 設定 Callback URL：
     ```
     http://localhost:8000/oauth/line/callback
     ```
   - 取得 **Channel ID** → `LINE_CHANNEL_ID`
   - 取得 **Channel Secret** → `LINE_CHANNEL_SECRET`

2. 在 Messaging API Channel 中：
   - 取得 **Channel Access Token** → `LINE_CHANNEL_ACCESS_TOKEN`
   （在「Messaging API」頁籤中發行）

### 所需權限

LINE Login Scopes：
- `profile`
- `openid`

### ⚠️ 注意事項
- 發送訊息會消耗 LINE 官方帳號的免費訊息額度
- 免費帳號每月限制 500 則推播訊息

---

## 🔧 環境變數設定

將取得的金鑰填入 `docker-compose.yml`：

```yaml
# Meta (Instagram/Facebook/Threads)
META_APP_ID: 你的_meta_app_id
META_APP_SECRET: 你的_meta_app_secret
META_REDIRECT_URI: http://localhost:8000/oauth/meta/callback

# TikTok
TIKTOK_CLIENT_KEY: 你的_tiktok_client_key
TIKTOK_CLIENT_SECRET: 你的_tiktok_client_secret
TIKTOK_REDIRECT_URI: http://localhost:8000/oauth/tiktok/callback

# LinkedIn
LINKEDIN_CLIENT_ID: 你的_linkedin_client_id
LINKEDIN_CLIENT_SECRET: 你的_linkedin_client_secret
LINKEDIN_REDIRECT_URI: http://localhost:8000/oauth/linkedin/callback

# YouTube (使用 Google OAuth)
GOOGLE_CLIENT_ID: 你的_google_client_id
GOOGLE_CLIENT_SECRET: 你的_google_client_secret
YOUTUBE_REDIRECT_URI: http://localhost:8000/oauth/youtube/callback

# LINE
LINE_CHANNEL_ID: 你的_line_channel_id
LINE_CHANNEL_SECRET: 你的_line_channel_secret
LINE_REDIRECT_URI: http://localhost:8000/oauth/line/callback
LINE_CHANNEL_ACCESS_TOKEN: 你的_line_channel_access_token
```

---

## 🚀 設定完成後

1. 重啟 Docker 服務：
   ```bash
   docker-compose down
   docker-compose up -d
   ```

2. 前往前端設定頁面：
   ```
   http://localhost:3000/dashboard/settings
   ```

3. 點擊要連結的社群平台，即可開始 OAuth 授權流程

---

## ❓ 常見問題

### Q: 為什麼連結時出現「設定中」提示？
A: 表示該平台的 API 金鑰尚未設定或設定錯誤，請檢查環境變數。

### Q: 授權成功但無法發布？
A: 部分平台需要額外的權限審核（如 Meta、TikTok），請在開發者後台提交審核申請。

### Q: 如何測試發布功能？
A: 建議先使用測試帳號，確認功能正常後再連結正式帳號。

---

## 📞 支援

如有問題，請聯繫技術支援或查閱各平台官方文件。
