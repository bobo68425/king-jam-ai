# Meta「無法載入網址」— 應用程式網域設定

當連結 IG 時出現「**無法載入網址**」或「**這個網址的網域未包含在應用程式的網域中**」，請依以下步驟設定。

---

## 一、正確位置

1. 前往 [developers.facebook.com](https://developers.facebook.com/)
2. 點「**我的應用程式**」
3. 選擇您的應用程式（King Jam AI 用的那一個）
4. 左側選單點 **「設定」** → **「基本資料」**
5. 在頁面中往下捲，找到 **「應用程式網域」** 區塊

---

## 二、應用程式網域填寫方式

### 格式
- 只填 **網域**，不要加 `https://` 或 `http://`
- 不要加路徑或斜線
- 每行一個網域

### 需加入的網域

```
kingjam.app
www.kingjam.app
api.kingjam.app
```

### 常見錯誤

| 錯誤寫法 | 正確寫法 |
|----------|----------|
| `https://kingjam.app` | `kingjam.app` |
| `https://api.kingjam.app/oauth/meta/callback` | `api.kingjam.app` |
| `www.kingjam.app/` | `www.kingjam.app` |
| 一次填多個用逗號 | 每行一個 |

---

## 三、OAuth 重新導向 URI（同頁面或 Facebook 登入）

1. 左側選單點 **「Facebook 登入」** → **「設定」**（或「產品」→「Facebook 登入」→「設定」）
2. 找到 **「有效的 OAuth 重新導向 URI」**
3. 確認有：
   ```
   https://api.kingjam.app/oauth/meta/callback
   ```
   - 這裡要 **完整 URL**，包含 `https://`
   - 請勿多加結尾斜線

---

## 四、儲存與生效

1. 點 **「儲存變更」**
2. 等待約 **2–5 分鐘** 讓設定生效
3. 清除瀏覽器快取或改用 **無痕模式**
4. 再試一次連結 IG

---

## 五、檢查清單

- [ ] 應用程式網域有 `kingjam.app`
- [ ] 應用程式網域有 `www.kingjam.app`
- [ ] 應用程式網域有 `api.kingjam.app`
- [ ] 未加 `https://` 或路徑
- [ ] OAuth 重新導向 URI 為 `https://api.kingjam.app/oauth/meta/callback`
- [ ] 已按「儲存變更」
- [ ] 已清除快取或使用無痕模式重試

---

## 六、若仍無法載入

1. **確認應用程式**：確認編輯的是正確的 Meta 應用程式（與 FACEBOOK_APP_ID 相同）
2. **應用程式模式**：測試模式／正式上線皆可，網域設定需正確
3. **改用無痕模式**：排除舊快取或擴充套件干擾
4. **檢查網域**：確認 `api.kingjam.app` 可正常開啟、無 SSL 錯誤
