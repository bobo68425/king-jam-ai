# =============================================================================
# King Jam AI - Railway 部署 Dockerfile
# 適用於 Build Context = Repo 根目錄（無需設定 Root Directory）
# =============================================================================

FROM python:3.10-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 安裝系統套件
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    ca-certificates \
    ffmpeg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 安裝 Python 依賴
# 使用通配符以支援不同的 Build Context（根目錄或 backend 子目錄）
COPY requirements.txt* backend/requirements.txt* ./
RUN pip install --no-cache-dir -r requirements.txt

# 複製 backend 應用程式代碼
COPY . .

# 建立非 root 用戶
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# 建立必要目錄
RUN mkdir -p /app/static/uploads /app/static/videos /app/static/thumbnails

EXPOSE 8080

CMD ["python", "start.py"]
