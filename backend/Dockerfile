FROM python:3.10-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# 安裝編譯所需的系統依賴、FFmpeg 和 curl（健康檢查用）
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev ffmpeg curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# 啟動命令（支援環境變數配置）
# 開發模式: WORKERS=1, RELOAD=true (預設)
# 高併發模式: WORKERS=4, RELOAD=false
ENV WORKERS=1
ENV RELOAD=true

# 使用啟動腳本支持多種模式
CMD if [ "$RELOAD" = "true" ]; then \
        uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload; \
    else \
        uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers $WORKERS; \
    fi