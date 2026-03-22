# King Jam AI — Video Engine v3.0 Renderer
# Optimized for Google Cloud Run
# ============================================================

# Stage 1: Build stage (install ALL deps including dev)
FROM node:20-slim AS builder

# Install Chromium + CJK fonts (required by Remotion)
RUN apt-get update && \
  apt-get install -y --no-install-recommends \
  chromium \
  fonts-noto-cjk \
  fonts-noto-cjk-extra \
  fonts-noto-color-emoji \
  libnss3 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libgbm1 \
  libpango-1.0-0 \
  libcairo2 \
  libasound2 \
  curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install ALL dependencies (including devDependencies for TypeScript build)
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Compile TypeScript
RUN npx tsc --outDir dist

# Pre-bundle Remotion for faster cold starts
ENV REMOTION_CHROME_EXECUTABLE=/usr/bin/chromium
RUN npx remotion bundle src/index.ts --out-dir remotion-bundle

# Stage 2: Production (slim image)
FROM node:20-slim AS runner

# Install only runtime system dependencies
RUN apt-get update && \
  apt-get install -y --no-install-recommends \
  chromium \
  fonts-noto-cjk \
  fonts-noto-cjk-extra \
  fonts-noto-color-emoji \
  libnss3 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libgbm1 \
  libpango-1.0-0 \
  libcairo2 \
  libasound2 \
  curl \
  && rm -rf /var/lib/apt/lists/*

# Chromium environment
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROME_PATH=/usr/bin/chromium

# Remotion environment
ENV REMOTION_CHROME_EXECUTABLE=/usr/bin/chromium
ENV NODE_ENV=production

WORKDIR /app

# Copy only what we need from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/remotion-bundle ./remotion-bundle
COPY --from=builder /app/package.json ./

# Create output directories
RUN mkdir -p /tmp/renders

# Cloud Run uses PORT env
ENV PORT=8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start render server
CMD ["node", "dist/render-server.js"]
