# Cloudflare R2 設定指南

## 為什麼選擇 R2？

| 優勢 | 說明 |
|------|------|
| **流量免費** | 下載/串流影片完全免費 (AWS S3 要 $0.09/GB) |
| **S3 相容** | 使用標準 boto3 SDK |
| **全球 CDN** | 內建 Cloudflare 全球網路 |
| **低儲存成本** | $0.015/GB/月 |

---

## 設定步驟

### 1. 登入 Cloudflare

前往 [https://dash.cloudflare.com/](https://dash.cloudflare.com/)

### 2. 創建 R2 Bucket

1. 左側選單 → **R2 Object Storage**
2. 點擊 **Create bucket**
3. 設定：
   - Bucket name: `kingjam-media`
   - Location: `Asia Pacific`
4. 點擊 **Create bucket**

### 3. 開啟公開存取

1. 進入 bucket → **Settings**
2. **Public access** → **Allow Access**
3. 記下 Public URL:
   ```
   https://pub-xxxxxxxxx.r2.dev
   ```

### 4. 創建 API Token

1. R2 主頁 → **Manage R2 API Tokens**
2. **Create API token**
3. 設定：
   - Token name: `kingjam-backend`
   - Permissions: `Object Read & Write`
   - Bucket: `kingjam-media`
4. 記下憑證：
   - Access Key ID
   - Secret Access Key
   - Endpoint URL

---

## 環境變數設定

### 方法 1：直接編輯 docker-compose.yml

```yaml
environment:
  # 雲端儲存 (Cloudflare R2)
  - CLOUD_STORAGE_PROVIDER=r2
  - R2_ENDPOINT_URL=https://xxxxxxxx.r2.cloudflarestorage.com
  - R2_ACCESS_KEY_ID=your_access_key_id
  - R2_SECRET_ACCESS_KEY=your_secret_access_key
  - R2_BUCKET_NAME=kingjam-media
  - R2_PUBLIC_URL=https://pub-xxxxxxxxx.r2.dev
```

### 方法 2：使用 .env 檔案

創建 `.env` 檔案（專案根目錄）：

```bash
R2_ENDPOINT_URL=https://xxxxxxxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=kingjam-media
R2_PUBLIC_URL=https://pub-xxxxxxxxx.r2.dev
```

docker-compose.yml 會自動讀取 `.env` 中的變數。

---

## 測試連接

重啟服務後，執行測試：

```bash
# 進入後端容器
docker-compose exec backend python

# 測試 R2 連接
>>> from app.services.cloud_storage import cloud_storage
>>> cloud_storage.is_configured()
True

# 測試上傳
>>> result = cloud_storage.upload_bytes(
...     b"test content",
...     user_id=1,
...     file_type="test",
...     filename="test.txt"
... )
>>> print(result)
{'success': True, 'key': 'test/1/2026/01/xxx.txt', 'url': 'https://...'}
```

---

## CORS 設定（如需前端直傳）

如果要讓前端直接上傳到 R2（繞過後端），需設定 CORS：

1. 進入 bucket → **Settings** → **CORS policy**
2. 添加規則：

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 費用估算

假設每月：
- 生成 500 個影片（平均 50MB）= 25GB 儲存
- 用戶觀看 10,000 次 = 500GB 流量

| 項目 | R2 費用 | S3 費用 |
|------|---------|---------|
| 儲存 | $0.38 | $0.58 |
| 流量 | **$0** | **$45** |
| **總計** | **$0.38/月** | **$45.58/月** |

---

## 生命週期規則（可選）

自動刪除舊檔案以節省成本：

1. bucket → **Settings** → **Object lifecycle rules**
2. 添加規則：
   - 刪除 90 天前的檔案
   - 或移至 Infrequent Access 類別

---

## 安全建議

1. **不要將 Secret Key 提交到 Git**
2. **使用最小權限原則** - 只給需要的 bucket 權限
3. **定期輪換 API Token**
4. **監控用量** - 設定用量警報
