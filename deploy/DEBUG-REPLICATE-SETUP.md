# debug-replicate 啟用設定

用於檢查 **Replicate 服務引擎**（v2.0 引擎：Kling 影片、AI 圖像工坊）的 API 連線狀態。

## 端點

```
GET https://api.kingjam.app/video/v3/debug-replicate
```

## 啟用步驟

### 1. 取得 Replicate API Token

1. 登入 [Replicate](https://replicate.com)
2. 前往 [Account → API Tokens](https://replicate.com/account/api-tokens)
3. 建立新 Token 或複製既有 Token（格式：`r8_xxxxx`）

### 2. 設定 Railway 環境變數

1. 登入 [Railway Dashboard](https://railway.app)
2. 選擇 King Jam **後端**專案
3. 點選 **Variables** 頁籤
4. 新增或編輯：
   - **Key**: `REPLICATE_API_TOKEN`
   - **Value**: 你的 Replicate API Token
5. 儲存後 Railway 會自動重新部署

### 3. 部署程式碼

確保 `debug-replicate` 端點已包含在部署中：

```bash
git add backend/app/routers/video_v3.py
git commit -m "feat: add debug-replicate endpoint"
git push
```

（若已 commit，Railway 會依設定自動部署）

### 4. 驗證

部署完成後執行：

```bash
curl -s "https://api.kingjam.app/video/v3/debug-replicate"
```

**預期結果：**

| 狀況 | 回應 |
|------|------|
| ✅ 正常 | `{"status":"ok","account":"你的帳號"}` |
| ⚠️ 未設定 Token | `{"error":"REPLICATE_API_TOKEN 未設定"}` |
| ❌ Token 無效 | `{"error":"API 回傳 401","detail":"..."}` |
| ❌ 未部署 | `{"detail":"Not Found"}` |

## 相關服務

- **v2.0 引擎**：Kling AI 影片、AI 圖像工坊（text2img、img2img、portrait-enhance、rembg）
- **環境變數**：`REPLICATE_API_TOKEN`（與 `video_generator.py`、ComfyUI workflows 共用）
