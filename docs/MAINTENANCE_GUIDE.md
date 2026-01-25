# King Jam AI 維護與更新指南

## 目錄

1. [更新部署流程](#一更新部署流程)
2. [CI/CD 自動化](#二cicd-自動化)
3. [新增引擎/功能](#三新增引擎功能)
4. [資料庫遷移](#四資料庫遷移)
5. [版本管理策略](#五版本管理策略)
6. [監控與告警](#六監控與告警)
7. [回滾策略](#七回滾策略)

---

## 一、更新部署流程

### 1.1 整體架構

```
┌─────────────────────────────────────────────────────────────────┐
│                      開發與部署流程                              │
└─────────────────────────────────────────────────────────────────┘

  開發環境                     測試環境                    生產環境
┌──────────┐              ┌──────────────┐            ┌──────────────┐
│ 本地開發  │  git push   │   Staging    │  審核通過  │  Production  │
│ Docker   │ ──────────▶ │  Cloud Run   │ ────────▶ │  Cloud Run   │
│ Compose  │              │  (預覽版)    │            │  (正式版)    │
└──────────┘              └──────────────┘            └──────────────┘
     │                           │                          │
     ▼                           ▼                          ▼
┌──────────┐              ┌──────────────┐            ┌──────────────┐
│ localhost│              │staging.      │            │kingjam.app   │
│:3000/8000│              │kingjam.app   │            │api.kingjam   │
└──────────┘              └──────────────┘            └──────────────┘
```

### 1.2 手動部署（快速更新）

```bash
# ============================================
# 方法 1: 使用部署腳本（推薦）
# ============================================
cd /Users/jamestsai/Desktop/king-jam-ai/deploy

# 設定環境
export GCP_PROJECT_ID=your-project-id
export GCP_REGION=asia-east1

# 執行部署
./deploy-backend.sh

# ============================================
# 方法 2: 使用 Cloud Build（CI/CD）
# ============================================
cd /Users/jamestsai/Desktop/king-jam-ai/backend

# 觸發建置和部署
gcloud builds submit --config=cloudbuild.yaml .

# ============================================
# 方法 3: 直接 gcloud 部署
# ============================================
gcloud run deploy kingjam-api \
    --source . \
    --region asia-east1 \
    --platform managed
```

### 1.3 前端部署（Vercel）

```bash
# Vercel 自動部署
# 只需 push 到 GitHub，Vercel 自動建置

# 手動觸發部署
vercel --prod

# 或使用 Vercel CLI
cd frontend
vercel deploy --prod
```

---

## 二、CI/CD 自動化

### 2.1 GitHub Actions 配置

建立 `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GCP

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
  workflow_dispatch:  # 允許手動觸發

env:
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  REGION: asia-east1
  SERVICE: kingjam-api

jobs:
  # =============================================
  # 階段 1: 測試
  # =============================================
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.10'
      
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest
      
      - name: Run tests
        run: |
          cd backend
          pytest tests/ -v

  # =============================================
  # 階段 2: 建置並部署到 Staging
  # =============================================
  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    environment: staging
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Google Auth
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2
      
      - name: Deploy to Staging
        run: |
          cd backend
          gcloud run deploy kingjam-api-staging \
            --source . \
            --region $REGION \
            --platform managed \
            --allow-unauthenticated \
            --tag staging
      
      - name: Smoke Test
        run: |
          STAGING_URL=$(gcloud run services describe kingjam-api-staging \
            --region $REGION --format='value(status.url)')
          curl -f $STAGING_URL/health

  # =============================================
  # 階段 3: 部署到生產（需手動審核）
  # =============================================
  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production  # 需要審核
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Google Auth
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2
      
      - name: Deploy to Production
        run: |
          cd backend
          gcloud builds submit --config=cloudbuild.yaml .
      
      - name: Verify Deployment
        run: |
          sleep 30
          curl -f https://api.kingjam.app/health
```

### 2.2 設置 GitHub Secrets

在 GitHub Repository Settings > Secrets 設置：

| Secret Name | 說明 |
|-------------|------|
| `GCP_PROJECT_ID` | GCP 專案 ID |
| `GCP_SA_KEY` | 服務帳戶 JSON 金鑰 |

### 2.3 觸發部署的方式

```
┌─────────────────────────────────────────────────────────────────┐
│                      觸發部署方式                                │
└─────────────────────────────────────────────────────────────────┘

1. 自動觸發（推薦）
   └── git push main → 自動測試 → Staging → 審核 → Production

2. 手動觸發
   └── GitHub Actions → Run workflow → 選擇分支 → 部署

3. 緊急部署（跳過審核）
   └── ./deploy-backend.sh 直接部署

4. 回滾
   └── gcloud run services update-traffic → 切換版本
```

---

## 三、新增引擎/功能

### 3.1 新增 AI 引擎的標準流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    新增引擎開發流程                              │
└─────────────────────────────────────────────────────────────────┘

步驟 1: 建立分支
    └── git checkout -b feature/new-engine-xxx

步驟 2: 開發引擎
    ├── backend/app/services/xxx_engine.py     # 引擎邏輯
    ├── backend/app/routers/xxx.py              # API 路由
    └── backend/app/schemas.py                  # 資料模型

步驟 3: 新增 Prompt 模板
    └── backend/scripts/seed_prompts.py         # 新增模板

步驟 4: 資料庫遷移（如需要）
    └── alembic revision --autogenerate -m "add xxx table"

步驟 5: 本地測試
    └── docker-compose up → 功能測試

步驟 6: 提交 PR
    └── git push → 開 Pull Request → Code Review

步驟 7: 合併並部署
    └── Merge → 自動部署到 Staging → 審核 → Production
```

### 3.2 新增引擎範例：Sora 影片引擎

```python
# backend/app/services/sora_engine.py
"""
Sora 影片生成引擎
"""
from typing import Optional
import httpx

class SoraEngine:
    """OpenAI Sora 影片生成引擎"""
    
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.base_url = "https://api.openai.com/v1/videos"
    
    async def generate_video(
        self,
        prompt: str,
        duration: int = 10,
        aspect_ratio: str = "16:9"
    ) -> dict:
        """
        生成影片
        
        Args:
            prompt: 影片描述
            duration: 影片長度（秒）
            aspect_ratio: 畫面比例
        
        Returns:
            {"video_url": "...", "status": "completed"}
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.base_url,
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "prompt": prompt,
                    "duration": duration,
                    "aspect_ratio": aspect_ratio
                }
            )
            return response.json()
```

### 3.3 整合到現有容錯架構

```python
# backend/app/services/video_generator.py

# 在現有的多模型容錯架構中新增 Sora
async def generate_video_with_fallback(self, prompt: str, quality: str):
    """
    多模型容錯影片生成
    """
    # 1. 嘗試 Veo 3
    try:
        return await self._generate_with_veo(prompt, quality)
    except Exception as e:
        logger.warning(f"Veo 失敗: {e}")
    
    # 2. 嘗試 Sora（新增）
    try:
        return await self._generate_with_sora(prompt, quality)
    except Exception as e:
        logger.warning(f"Sora 失敗: {e}")
    
    # 3. 嘗試 Kling
    try:
        return await self._generate_with_kling(prompt, quality)
    except Exception as e:
        logger.warning(f"Kling 失敗: {e}")
    
    # 4. 最終 Fallback: Imagen + FFmpeg
    return await self._generate_with_imagen_fallback(prompt)
```

### 3.4 新增前端頁面

```typescript
// frontend/app/dashboard/new-feature/page.tsx

"use client";

import { useState } from "react";
import axios from "axios";

export default function NewFeaturePage() {
  const [loading, setLoading] = useState(false);
  
  const handleGenerate = async () => {
    setLoading(true);
    try {
      const response = await axios.post("/api/new-feature/generate", {
        // 參數
      });
      // 處理結果
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      {/* UI 組件 */}
    </div>
  );
}
```

---

## 四、資料庫遷移

### 4.1 遷移流程

```
┌─────────────────────────────────────────────────────────────────┐
│                     資料庫遷移流程                               │
└─────────────────────────────────────────────────────────────────┘

本地開發:
  1. 修改 models.py
  2. alembic revision --autogenerate -m "描述"
  3. alembic upgrade head
  4. 測試功能

部署到生產:
  1. 部署新版本代碼
  2. 執行遷移腳本（Cloud Run Job）
  3. 驗證遷移結果
```

### 4.2 生產環境遷移命令

```bash
# 方法 1: 透過 Cloud Run Job
gcloud run jobs create kingjam-migration \
    --image asia-east1-docker.pkg.dev/PROJECT_ID/kingjam-repo/kingjam-api:latest \
    --region asia-east1 \
    --command "alembic,upgrade,head" \
    --vpc-connector kingjam-connector

gcloud run jobs execute kingjam-migration --region asia-east1

# 方法 2: 透過 Cloud SQL Proxy 本地執行
cloud_sql_proxy -instances=PROJECT:asia-east1:kingjam-db=tcp:5432 &
DATABASE_URL=postgresql://kingjam:PASSWORD@localhost:5432/kingjam_db \
  alembic upgrade head
```

### 4.3 遷移最佳實踐

```python
# 1. 始終使用 nullable=True 新增欄位
Column("new_field", String(100), nullable=True)

# 2. 分階段遷移大變更
# Phase 1: 新增欄位
# Phase 2: 資料轉移
# Phase 3: 移除舊欄位

# 3. 準備回滾腳本
def downgrade():
    op.drop_column("users", "new_field")
```

---

## 五、版本管理策略

### 5.1 分支策略

```
main (生產環境)
  │
  ├── develop (開發整合)
  │     │
  │     ├── feature/video-engine-v2
  │     ├── feature/new-payment-method
  │     └── bugfix/fix-credit-calculation
  │
  └── hotfix/critical-security-fix (緊急修復)
```

### 5.2 版本號規則

```
v{主版本}.{次版本}.{修訂版本}

主版本: 重大架構變更、不相容 API 變更
次版本: 新功能、向後相容的功能增加
修訂版本: Bug 修復、小幅優化

範例:
- v1.0.0 → v1.1.0 (新增 Sora 引擎)
- v1.1.0 → v1.1.1 (修復影片卡頓問題)
- v1.1.1 → v2.0.0 (API 重構)
```

### 5.3 發布流程

```bash
# 1. 建立發布分支
git checkout -b release/v1.2.0 develop

# 2. 更新版本號
echo "1.2.0" > VERSION

# 3. 最終測試
./deploy/smoke-test.sh

# 4. 合併到 main
git checkout main
git merge release/v1.2.0

# 5. 打標籤
git tag -a v1.2.0 -m "Release v1.2.0: 新增 Sora 引擎"
git push origin v1.2.0

# 6. 自動觸發生產部署
```

---

## 六、監控與告警

### 6.1 監控指標

```yaml
# 關鍵監控指標
metrics:
  - name: 請求延遲
    target: P95 < 500ms
    alert: P95 > 1000ms
  
  - name: 錯誤率
    target: < 0.1%
    alert: > 1%
  
  - name: CPU 使用率
    target: < 70%
    alert: > 85%
  
  - name: 記憶體使用率
    target: < 80%
    alert: > 90%
```

### 6.2 設置告警

```bash
# Cloud Monitoring 告警策略
gcloud alpha monitoring policies create \
    --policy-from-file=monitoring-policy.yaml
```

### 6.3 日誌查詢

```bash
# 查看錯誤日誌
gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" \
    --limit 50 --format json

# 即時日誌
gcloud run services logs tail kingjam-api --region=asia-east1
```

---

## 七、回滾策略

### 7.1 快速回滾

```bash
# 1. 查看所有版本
gcloud run revisions list --service kingjam-api --region asia-east1

# 2. 回滾到前一版本
gcloud run services update-traffic kingjam-api \
    --region asia-east1 \
    --to-revisions kingjam-api-00023-abc=100

# 3. 驗證回滾
curl -f https://api.kingjam.app/health
```

### 7.2 金絲雀部署（漸進式發布）

```bash
# 1. 部署新版本，但只導入 10% 流量
gcloud run deploy kingjam-api \
    --image NEW_IMAGE \
    --region asia-east1 \
    --tag canary \
    --no-traffic

gcloud run services update-traffic kingjam-api \
    --region asia-east1 \
    --to-tags canary=10

# 2. 監控 10 分鐘，確認無問題

# 3. 逐步增加流量
gcloud run services update-traffic kingjam-api \
    --region asia-east1 \
    --to-tags canary=50

# 4. 完全切換
gcloud run services update-traffic kingjam-api \
    --region asia-east1 \
    --to-tags canary=100
```

### 7.3 回滾檢查清單

```
□ 確認問題原因
□ 評估影響範圍
□ 執行回滾命令
□ 驗證服務恢復
□ 通知相關人員
□ 記錄事件報告
```

---

## 附錄：常用命令速查

```bash
# ==================== 部署相關 ====================
# 部署後端
./deploy/deploy-backend.sh

# 查看服務狀態
gcloud run services describe kingjam-api --region asia-east1

# 查看日誌
gcloud run services logs read kingjam-api --region asia-east1

# ==================== 資料庫相關 ====================
# 執行遷移
alembic upgrade head

# 新增遷移
alembic revision --autogenerate -m "描述"

# 回滾遷移
alembic downgrade -1

# ==================== 版本管理 ====================
# 查看所有版本
gcloud run revisions list --service kingjam-api

# 回滾版本
gcloud run services update-traffic kingjam-api --to-revisions REVISION=100

# ==================== 監控相關 ====================
# 查看錯誤
gcloud logging read "severity>=ERROR" --limit 50

# 查看指標
gcloud monitoring dashboards list
```

---

*最後更新: 2026-01-24*
