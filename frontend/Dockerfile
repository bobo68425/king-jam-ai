# =============================================================================
# King Jam AI Frontend - 生產環境 Dockerfile
# 適用於 Google Cloud Run 部署
# 使用多階段建置優化映像檔大小
# =============================================================================

# -----------------------------------------------------------------------------
# 階段 1: 依賴安裝 (Dependencies)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

# 安裝 libc6-compat（某些套件需要）
RUN apk add --no-cache libc6-compat

WORKDIR /app

# 複製套件管理檔案
COPY package.json package-lock.json* ./

# 安裝依賴（使用 ci 確保一致性）
RUN npm ci --legacy-peer-deps

# -----------------------------------------------------------------------------
# 階段 2: 建置 (Builder)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# 複製依賴
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 設置建置時環境變數
ARG NEXT_PUBLIC_API_URL=https://api.kingjam.app
ARG NEXT_PUBLIC_SITE_URL=https://kingjam.app

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# 建置應用程式
RUN npm run build

# -----------------------------------------------------------------------------
# 階段 3: 運行 (Runner) - 最終輕量化映像
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# 設置生產環境
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 建立非 root 使用者（安全性最佳實踐）
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 設置正確的權限給 prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# 複製 standalone 輸出
# 自動追蹤並複製所需的檔案，大幅減少映像大小
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 複製 public 目錄到 standalone 輸出（重要：必須在 standalone 之後）
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# 切換到非 root 使用者
USER nextjs

# Cloud Run 使用 PORT 環境變數，預設 8080
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

EXPOSE 8080

# 健康檢查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/ || exit 1

# 啟動應用程式
# standalone 模式下使用 server.js
CMD ["node", "server.js"]
