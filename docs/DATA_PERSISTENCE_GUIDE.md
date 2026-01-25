# 資料持久化架構指南

## 概述

本次更新將 LocalStorage 歷史紀錄遷移到 PostgreSQL + Cloudflare R2，解決以下問題：

1. **影片資產遺失風險**：用戶換電腦/清快取後，花點數生成的影片不見
2. **無法稽核**：客訴時無法查證生成紀錄
3. **儲存成本**：R2 影片流量零費用

---

## 架構變更

### 1. 資料庫模型 (`GenerationHistory`)

```python
# backend/app/models.py
class GenerationHistory:
    id: int
    user_id: int
    generation_type: str  # social_image, short_video, blog_post
    status: str           # pending, processing, completed, failed
    input_params: JSON    # 所有輸入參數
    output_data: JSON     # 生成結果
    media_local_path: str # 本地路徑
    media_cloud_url: str  # R2 公開 URL
    media_cloud_key: str  # R2 檔案 key
    credits_used: int     # 消耗點數
    error_message: str    # 錯誤訊息
    created_at: datetime
    is_deleted: bool      # 軟刪除
```

### 2. API 端點 (`/history`)

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/history` | 創建紀錄 |
| GET | `/history` | 列表（支援分頁、過濾） |
| GET | `/history/stats` | 統計資訊 |
| GET | `/history/{id}` | 單筆詳情 |
| PATCH | `/history/{id}` | 更新（如：雲端 URL） |
| DELETE | `/history/{id}` | 軟刪除 |
| GET | `/history/admin/search` | 管理員搜尋（客訴查證） |

### 3. 雲端儲存服務 (`CloudStorageService`)

```python
# backend/app/services/cloud_storage.py
cloud_storage.upload_file(local_path, user_id, file_type)
cloud_storage.upload_bytes(data, user_id, file_type, filename)
cloud_storage.delete_file(key)
cloud_storage.get_signed_url(key, expires_in)
```

---

## 設定 Cloudflare R2

### 步驟 1: 創建 R2 Bucket

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 進入 R2 服務
3. 創建 Bucket: `kingjam-media`
4. 設定公開存取（或使用自訂域名）

### 步驟 2: 創建 API Token

1. R2 → Manage R2 API Tokens
2. 創建 Token，權限選擇 `Object Read & Write`
3. 記下：
   - Access Key ID
   - Secret Access Key
   - Endpoint URL: `https://<account_id>.r2.cloudflarestorage.com`

### 步驟 3: 設定環境變數

創建 `.env` 檔案：

```bash
R2_ENDPOINT_URL=https://xxxxxxxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=kingjam-media
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
```

或修改 `docker-compose.yml` 直接填入。

---

## 前端整合指南

### 社群圖文 (`/dashboard/social/page.tsx`)

**移除 LocalStorage：**

```typescript
// 刪除這些
const HISTORY_KEY = "social-generation-history";
const MAX_HISTORY = 20;
localStorage.getItem(HISTORY_KEY);
localStorage.setItem(HISTORY_KEY, ...);
```

**替換為 API 調用：**

```typescript
// 載入歷史紀錄
const loadHistory = async () => {
  const res = await api.get("/history", {
    params: { generation_type: "social_image", page: 1, page_size: 20 }
  });
  setHistory(res.data.items);
};

// 生成後儲存紀錄
const handleGenerate = async () => {
  // ... 生成邏輯 ...
  
  // 儲存到資料庫
  await api.post("/history", {
    generation_type: "social_image",
    status: "completed",
    input_params: {
      topic, platform, quality, ...
    },
    output_data: {
      caption, hashtags, image_url, ...
    },
    media_cloud_url: result.image_url,
    credits_used: creditsUsed,
  });
  
  // 重新載入歷史
  loadHistory();
};

// 刪除紀錄
const deleteHistory = async (id: number) => {
  await api.delete(`/history/${id}`);
  loadHistory();
};
```

### 短影音 (`/dashboard/video/page.tsx`)

**同樣移除 LocalStorage，改用 API：**

```typescript
// 載入歷史
const loadHistory = async () => {
  const res = await api.get("/history", {
    params: { generation_type: "short_video", page: 1, page_size: 20 }
  });
  setHistory(res.data.items);
};

// 生成後儲存
await api.post("/history", {
  generation_type: "short_video",
  status: result.success ? "completed" : "failed",
  input_params: {
    prompt, duration, quality, aspectRatio, ...
  },
  output_data: {
    script: result.script,
    video_url: result.video_url,
  },
  media_local_path: result.local_path,
  media_cloud_url: result.cloud_url,
  credits_used: creditsUsed,
  error_message: result.error,
});
```

---

## 後端整合（影片生成後自動上傳雲端）

修改 `backend/app/routers/video.py`：

```python
from app.services.cloud_storage import upload_video_to_cloud
from app.models import GenerationHistory

@router.post("/video/render")
async def render_video(...):
    # 生成影片
    result = await video_generator.generate_video(...)
    
    # 上傳到 R2
    cloud_result = upload_video_to_cloud(
        local_path=result["local_path"],
        user_id=current_user.id,
        delete_local=False  # 可選：刪除本地檔案
    )
    
    # 記錄到資料庫
    history = GenerationHistory(
        user_id=current_user.id,
        generation_type="short_video",
        status="completed",
        input_params={...},
        output_data={...},
        media_local_path=result["local_path"],
        media_cloud_url=cloud_result.get("url"),
        media_cloud_key=cloud_result.get("key"),
        media_cloud_provider="r2",
        credits_used=credits_used,
    )
    db.add(history)
    db.commit()
    
    return {
        "video_url": cloud_result.get("url") or result["video_url"],
        "history_id": history.id,
        ...
    }
```

---

## 執行步驟

### 1. 執行 Migration

```bash
docker-compose exec backend alembic upgrade head
```

### 2. 重建後端容器（安裝 boto3）

```bash
docker-compose down
docker-compose up -d --build
```

### 3. 設定 R2 憑證

編輯 `.env` 或 `docker-compose.yml`

### 4. 測試 API

```bash
# 創建紀錄
curl -X POST http://localhost:8000/history \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"generation_type": "social_image", "input_params": {"topic": "test"}}'

# 查詢紀錄
curl http://localhost:8000/history?generation_type=social_image \
  -H "Authorization: Bearer <token>"
```

### 5. 修改前端（參考上方指南）

---

## 客訴查證流程

當用戶說「我生成失敗但被扣點」：

1. 取得用戶 `customer_id`
2. 管理員調用 API：
   ```bash
   GET /history/admin/search?customer_id=KJ2601-00001&status=failed
   ```
3. 查看 `error_message` 和 `input_params`
4. 根據紀錄決定是否退點

---

## 成本估算

| 項目 | Cloudflare R2 | AWS S3 |
|------|---------------|--------|
| 儲存 | $0.015/GB/月 | $0.023/GB/月 |
| 上傳 | 免費 | $0.005/1000 請求 |
| 下載（流量） | **免費** | $0.09/GB |
| CDN | 內建 | 需額外 CloudFront |

假設每月 1000 個影片（平均 50MB）：
- 儲存：50GB × $0.015 = **$0.75/月**
- 流量：免費

---

## 注意事項

1. **不要立即刪除 LocalStorage 程式碼**，先確認 API 運作正常
2. **保留本地檔案**作為備份，R2 上傳成功後可選擇刪除
3. **設定 R2 生命週期規則**，自動刪除 N 天前的檔案（可選）
4. **監控 R2 用量**，避免超出預算
