#!/usr/bin/env bash
# =============================================================================
# King Jam AI — 資料庫遷移（本機 Docker）
# =============================================================================
# 正式資料庫若為 Railway / 其他託管 Postgres：請在該平台 shell 或 CI
# 對可連線的環境執行：alembic upgrade head（並設定 DATABASE_URL）。
# =============================================================================

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "在 backend 容器內執行 Alembic（需先 docker compose up -d）…"
if docker compose ps backend 2>/dev/null | grep -q backend; then
  docker compose exec -T backend python -m alembic upgrade head
elif docker-compose ps backend 2>/dev/null | grep -q backend; then
  docker-compose exec -T backend python -m alembic upgrade head
else
  echo "找不到運行中的 backend 容器。請先："
  echo "  docker compose up -d"
  echo "或於本機 backend 目錄設定 DATABASE_URL 後："
  echo "  cd backend && alembic upgrade head"
  exit 1
fi

echo "遷移完成。"
