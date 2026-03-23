# IG 連線疑難排解

## Invalid Scopes 錯誤（必須處理）

若出現「**Invalid Scopes: instagram_basic, instagram_content_publish, instagram_manage_insights**」：

**標準 Facebook Login 不支援 Instagram 權限**，必須使用 **Facebook Login for Business**。

### 設定步驟

1. 前往 [developers.facebook.com](https://developers.facebook.com/) → 您的應用程式
2. 左側選單「**Facebook 登入**」→「**設定**」
3. 點「**Get started with Facebook Login for Business**」
4. 左側選單「**Configurations**」→「**Create configuration**」或「**Create from template**」
5. 選擇「**Instagram Graph API**」模板，或手動加入權限：
   - `pages_read_user_content`
   - `pages_show_list`
   - `pages_read_engagement`
   - `instagram_basic`
   - `instagram_content_publish`（發文用）
   - `instagram_manage_insights`
6. 建立後取得 **Configuration ID**（一串數字）
7. 前往 GitHub → Settings → Secrets → Actions
8. 新增 Secret：`META_CONFIG_ID` = 該 Configuration ID
9. 重新部署後端

---

## 其他問題（設定無誤仍無法連接時）

當 Meta 後台設定（應用程式網域、OAuth URI）皆正確，仍出現「無法載入網址」或連線失敗時，請依序檢查以下項目。

---

## 一、確認 GitHub Secrets 與 Meta 後台一致

後端從 **GitHub Secrets** 讀取 `FACEBOOK_APP_ID` 和 `FACEBOOK_APP_SECRET`，必須與您編輯的 Meta 應用程式完全一致。

### 檢查步驟

1. 前往 GitHub 專案 → **Settings** → **Secrets and variables** → **Actions**
2. 確認 `FACEBOOK_APP_ID` 的值與 Meta 後台「應用程式編號」**完全相同**（例如：`2307913626397839`）
3. 確認 `FACEBOOK_APP_SECRET` 對應該應用程式的「應用程式密鑰」
4. 若有多個 Meta 應用程式，請確認編輯的是 **King Jam AI 實際使用的那一個**

---

## 二、驗證後端實際使用的 redirect_uri

後端依 `BACKEND_URL` 組成 redirect_uri，預設為：

```
https://api.kingjam.app/oauth/meta/callback
```

- 不可有結尾斜線 `/`
- 必須為 `https`
- 與 Meta 後台「有效的 OAuth 重新導向 URI」**完全一致**

後端託管環境通常會設定 `BACKEND_URL=https://api.kingjam.app`，一般無需額外設定。

---

## 三、使用 META_CONFIG_ID 時（Facebook Login for Business）

若已設定 `META_CONFIG_ID`（Facebook Login for Business 設定 ID）：

1. 在 Meta 後台 → **Configurations** 中，確認該 Configuration 已正確建立
2. 確認 Configuration 包含所需的 Instagram 權限（如 `instagram_basic`、`instagram_content_publish` 等）
3. **應用程式網域**與**有效的 OAuth 重新導向 URI** 仍須在「設定 → 基本資料」與「Facebook 登入 → 設定」中正確設定，Configuration 不會取代這些設定

---

## 四、清除快取與重試

1. 使用瀏覽器 **無痕模式** 重新嘗試連結 IG
2. 或清除瀏覽器快取、Cookie 後再試
3. 暫時關閉可能干擾的擴充套件（廣告攔截、隱私增強等）

---

## 五、確認 IG 帳號與粉專設定

- Instagram 必須為 **商業帳號** 或 **創作者帳號**
- 必須已連結 **Facebook 粉絲專頁**
- 連結 IG 時，授權流程會要求選擇粉專，請選擇 **已連結 IG 的那個粉專**

---

## 六、若仍無法連接

請提供以下資訊以便進一步排查：

1. 點擊「連結 IG」後，畫面停在哪一步？（例如：Meta 授權頁未出現、授權後導向錯誤、出現錯誤訊息等）
2. 瀏覽器開發者工具（F12）→ Console 或 Network 面板是否有錯誤訊息？
3. GitHub Secrets 中的 `FACEBOOK_APP_ID` 前三碼（用於確認是否與 Meta 後台一致，例如 `230`）
