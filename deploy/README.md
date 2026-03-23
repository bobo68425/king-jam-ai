# King Jam AI — 部署說明

正式環境以 **Vercel（或同類前端託管）** + **Railway（或同類 API／DB 託管）** 為主；**不包含** GCP Cloud Run、Cloud SQL、Cloud Run 網域對應或 Cloud Run Jobs 腳本（已自 repo 移除）。

## 文件

| 檔案 | 說明 |
|------|------|
| [部署線上.md](./部署線上.md) | 上線流程與檢查 |
| [部署失敗排查.md](./部署失敗排查.md) | 常見錯誤 |
| [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) | 上線檢查清單 |
| [smoke-test.sh](./smoke-test.sh) | 部署後冒煙測試 |
| [run-migrations.sh](./run-migrations.sh) | 本機 Docker 執行 Alembic |
| [go-live.sh](./go-live.sh) | 上線前檢查與確認 |

## 本機開發（Docker）

```bash
docker compose up -d
# 遷移
./deploy/run-migrations.sh
```

詳見專案根目錄 `SETUP.md`。

## 環境變數

複製 `.env.example`（根目錄與 `backend`）並在託管平台設定對應變數；機密請用平台內建 Secrets，勿提交 git。

## 架構（概念）

```
使用者 → CDN / 前端託管 → Next.js
              ↓ API
        後端託管 (FastAPI) → 託管 Postgres / Redis
              ↓
        R2 或其他物件儲存（若已設定）
```

## 已移除的 GCP 腳本（可從 git 歷史找回）

- `gcp-setup.sh`、`domain-setup.sh`、`setup-secrets.sh`、`setup-github-actions.sh`
- 根目錄 `cloudbuild.yaml`
- `ltx-video-inference/deploy.sh`（Cloud Run GPU 部署）

若仍需在 GCP 跑單一服務（例如 GPU 推論），請另建獨立 repo 或文件，勿與本專案預設部署混用。
