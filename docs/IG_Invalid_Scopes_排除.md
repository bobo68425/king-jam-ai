# Instagram Invalid Scopes 排除指南

當出現 **「Invalid Scopes: instagram_basic」** 時，代表後端未使用 Facebook Login for Business 的 Configuration，而是用了不支援的 scope 參數。

---

## 必須完成：設定 META_CONFIG_ID

### 步驟 1：取得 Configuration ID

1. 前往 https://developers.facebook.com/
2. 選擇你的應用程式
3. 左側選單 **Facebook 登入** → **Configurations**
4. 找到登入資料版本為「**Instagram 圖形 API**」的 Configuration
5. 複製其 **Configuration ID**（一串數字，例如 `1234567890123456`）

若尚未建立：
- 點 **Create configuration**
- 登入資料版本選擇 **Instagram 圖形 API**
- 完成後續步驟（權限等）後建立

### 步驟 2：新增 GitHub Secret

1. 前往 https://github.com/bobo68425/king-jam-ai
2. **Settings** → **Secrets and variables** → **Actions**
3. 點 **New repository secret**
4. Name：`META_CONFIG_ID`
5. Value：貼上步驟 1 的 Configuration ID
6. 點 **Add secret**

### 步驟 3：觸發部署

META_CONFIG_ID 只有在**部署時**才會寫入 Cloud Run，必須重新部署後才會生效。

- 推送任何 `backend/` 變更到 main，或
- 到 **Actions** 手動執行「Deploy Backend to Cloud Run」

### 步驟 4：驗證

部署完成後，再次嘗試連結 Instagram。若 META_CONFIG_ID 正確，不應再出現 Invalid Scopes。

---

## 檢查清單

- [ ] Meta 後台已建立 Configuration（登入資料版本：Instagram 圖形 API）
- [ ] GitHub Secrets 已新增 `META_CONFIG_ID`，值為 Configuration ID
- [ ] 已重新部署後端
- [ ] 部署完成後再試連結 Instagram
