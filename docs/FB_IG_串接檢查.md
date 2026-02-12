# FB & IG 串接檢查指南

---

## 一、兩類用途說明

| 用途 | 環境變數 | 說明 |
|------|----------|------|
| **Facebook 登入** | FACEBOOK_APP_ID、FACEBOOK_APP_SECRET | 用戶以 FB 帳號登入 King Jam AI |
| **FB/IG 社群帳號連結** | 同上（共用） | 連結粉絲專頁、IG 商業帳號，用於排程發文 |

同一組 Meta 應用程式可同時用於登入與帳號連結。

---

## 二、能否接通檢查清單

### 1. GitHub Secrets

在 GitHub → Settings → Secrets 確認：

| Secret | 說明 |
|--------|------|
| `FACEBOOK_APP_ID` | Meta 應用程式編號 |
| `FACEBOOK_APP_SECRET` | Meta 應用程式密鑰 |

### 2. Meta 後台 OAuth 設定

1. 開啟 [Meta for Developers](https://developers.facebook.com/)
2. 選擇應用程式 → **Facebook 登入** → **設定**
3. 在「有效的 OAuth 重新導向 URI」加入：

   ```
   https://api.kingjam.app/oauth/meta/callback
   ```

4. 儲存變更

### 3. 應用程式模式

- 測試模式：僅限測試用戶
- 正式上線：需切換為「上線」模式，一般用戶才能使用

### 4. 發文所需權限

若要連結 IG/FB 並發文，需在 Meta 後台申請／審核以下權限：

**Instagram Business：**
- `instagram_basic`
- `instagram_content_publish`
- `instagram_manage_insights`
- `pages_show_list`
- `pages_read_engagement`
- `business_management`

**Facebook Page：**
- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`
- `pages_manage_engagement`

### 5. 帳號條件

- **Instagram**：需為商業帳號或創作者帳號，且已連結 Facebook 粉絲專頁
- **Facebook**：需有粉絲專頁，才能進行授權與發文

---

## 三、API 測試

### 檢查平台狀態

```bash
curl -s "https://api.kingjam.app/scheduler/platforms" -H "Authorization: Bearer YOUR_TOKEN"
```

若 FB/IG 有回傳 `"status": "active"`，表示憑證已正確設定。

### 連結流程

1. 登入 https://kingjam.app
2. 進入 **會員中心** → **社群帳號** 或 **設定**
3. 點擊「連結 Instagram」或「連結 Facebook」
4. 完成 Meta 授權流程

---

## 四、常見問題

| 現象 | 可能原因 |
|------|----------|
| 點連結無反應 | FACEBOOK_APP_ID / SECRET 未設定或錯誤 |
| 授權後顯示錯誤 | OAuth 重新導向 URI 未加入 `https://api.kingjam.app/oauth/meta/callback` |
| 授權成功但無法發文 | 權限未審核通過，或 IG 非商業帳號 |
| 顯示「needs_setup」 | GitHub Secrets 未設定或部署尚未更新 |

---

## 五、結論

若已完成：

- GitHub Secrets 設定
- Meta 後台 OAuth 重新導向 URI 設定
- 應用程式為上線模式

則 FB 登入與 FB/IG 社群帳號連結皆可正常使用。
