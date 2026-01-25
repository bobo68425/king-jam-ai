# Google Cloud 金鑰設定

## 步驟

### 1. 放置服務帳戶金鑰

將您的 Google Cloud 服務帳戶 JSON 金鑰檔案放在這個資料夾，並命名為：

```
service-account.json
```

### 2. 設定環境變數

在專案根目錄創建 `.env` 檔案：

```bash
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
```

### 3. 確認 API 已啟用

在 Google Cloud Console 中確認以下 API 已啟用：
- Vertex AI API
- Generative Language API

### 4. 重啟服務

```bash
docker-compose down
docker-compose up -d --build
```

## 服務帳戶權限

服務帳戶需要以下角色：
- `roles/aiplatform.user` - Vertex AI 使用者
- `roles/ml.developer` - ML 開發者（可選）

## 注意事項

⚠️ **不要將 `service-account.json` 提交到 Git！**

此資料夾已加入 `.gitignore`。
