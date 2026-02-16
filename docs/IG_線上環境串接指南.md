# Instagram 線上環境串接指南

> **更新日期**：2026-02-16
> **狀態**：Redis 已修復 ✅ | Meta App 設定已驗證 ✅ | 公開權限待審查 ⚠️

本指南說明如何在線上環境正確配置 Instagram 整合。

## 1. 關鍵應用程式架構

我們的系統目前依賴兩個 Meta Apps，請確保環境變數對應正確：

| 用途 | App 名稱 | Meta App ID | 關鍵設定 |
|------|----------|-------------|----------|
| **Facebook Login** | **King Jam AI** | `2307913626397839` | 用於一般 FB 登入 (若有) |
| **Instagram Login** | **King Jam AIG** | `1207276628272799` | **核心 IG 功能來源**<br>Instagram App ID: `2470376900051701` |

### ⚠️ 環境變數檢查點
請確認 Cloud Run 或部署 Secrets 中的 `INSTAGRAM_APP_ID` 設定正確：
- `INSTAGRAM_APP_ID`: **`2470376900051701`** (必須是這個值！)
- `INSTAGRAM_APP_SECRET`: (對應 King Jam AIG 的 Secret)

---

## 2. Meta Dashboard 設定現況 (已驗證)

以下設定已在 2026-02-16 驗證無誤，**請勿隨意更動**：

### King Jam AIG (ID: 1207276628272799)
- **Instagram 商家登入設定 (Business Login Settings)**:
  - ✅ **Valid OAuth Redirect URIs**: `https://api.kingjam.app/oauth/meta/callback`
  - ✅ **Deauthorize Callback URL**: `https://api.kingjam.app/oauth/meta/deauthorize`
  - ✅ **Data Deletion Request URL**: `https://api.kingjam.app/oauth/meta/delete`

### King Jam AI (ID: 2307913626397839)
- **Facebook Login for Business**:
  - ✅ **Valid OAuth Redirect URIs**: `https://api.kingjam.app/oauth/meta/callback`

---

## 3. 權限與應用程式審查 (App Review)

目前 App 處於 **Live (上線)** 模式，但權限層級為 **Standard Access**。

### 權限狀態
| 權限名稱 | 目前層級 | 誰可以使用？ | 下一步 |
|----------|----------|--------------|--------|
| `instagram_business_basic` | Standard | 管理員/開發者/測試者 | 需申請 Advanced Access |
| `instagram_business_content_publish` | Standard | 管理員/開發者/測試者 | 需申請 Advanced Access |
| `instagram_business_manage_comments` | Standard | 管理員/開發者/測試者 | 需申請 Advanced Access |
| `instagram_business_manage_insights` | Standard | 管理員/開發者/測試者 | 需申請 Advanced Access |

### 🛑 限制說明
在取得 **Advanced Access** 之前：
1. **只有**被加入 App "Roles" (角色) 的 FB 帳號 (Admin, Developer, Tester) 可以成功授權。
2. **外部用戶**嘗試登入時會看到錯誤，或授權後無法使用功能。

### 🚀 申請 Advanced Access 步驟 (當準備好公開時)
1. 進入 [King Jam AIG Dashboard > App Review > Permissions and Features](https://developers.facebook.com/apps/1207276628272799/review-status/permissions/)。
2. 找到上述權限，點擊 "Request Advanced Access"。
3. 填寫使用情境說明、提供測試帳號與影片演示。
4. 提交審查 (通常需 3-5 個工作天)。

---

## 4. 用戶端操作流程 (User Guide)

用戶要串接 IG，必須遵循以下條件：

1. **IG 帳號類型**：必須是 **專業帳號** (Business 或 Creator)。
   - *如何檢查*：IG App > 設定 > 帳號 > 切換帳號類型。
2. **連結粉專 (Facebook Login 流程)**：
   - 若使用 "Connect Page" 流程，IG 帳號必須已連結到一個 Facebook 粉絲專頁。
3. **授權流程**：
   - 用戶在 King Jam AI 前端點擊 "Connect Instagram"。
   - 彈出 Meta 授權視窗。
   - **務必勾選**所有請求的權限 (尤其是「管理您的商家」、「代表您發佈貼文」)。
   - **務必勾選**要管理的 IG 帳號 (若有多個)。

## 5. 故障排除 (Troubleshooting)

若線上環境發生 `OAuth Exception` 或 `Permissions Missing`：

1. **檢查 Redis**：確認 Celery Worker 正常運作 (排程發文依賴它)。
2. **檢查 Token**：
   - 若是用戶修改了 IG 密碼，Token 會失效，需重新授權。
3. **檢查權限範圍**：
   - 使用 [Graph API Explorer](https://developers.facebook.com/tools/explorer/) 檢查 Access Token 是否包含 `instagram_business_content_publish`。
