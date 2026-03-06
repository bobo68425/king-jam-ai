import os
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool
from sqlalchemy.orm import sessionmaker, declarative_base

# 從環境變數讀取資料庫 URL (對應 docker-compose.yml)
# 注意：Docker 內部我們用 postgresql://... 但 SQLAlchemy 建議明確指定 driver
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://kingjam:kingjam_pass@db:5432/kingjam_db")

# 修正 Railway 等平台預設提供的 postgres:// 為 SQLAlchemy 支援的 postgresql://
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# 如果 DATABASE_URL 為空或無效，使用暫時的 SQLite 資料庫位址以讓 docker build 階段或尚未設定環境變數時可以通過 import
if not DATABASE_URL or not DATABASE_URL.startswith(("postgresql://", "sqlite://", "mysql://")):
    print(f"⚠️ [database.py] Invalid DATABASE_URL detected: '{DATABASE_URL}'. Falling back to sqlite:///:memory: for initialization purposes.")
    DATABASE_URL = "sqlite:///:memory:"

# ============================================================
# 連接池配置（優化高併發性能，針對 Cloud Run 水平擴展）
# ============================================================
POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "5"))           # 基礎連接池大小 (調小以適應多實例)
MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "10"))    # 額外可創建的連接數 (調小以防止耗盡連線數)
POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "30"))    # 等待連接的超時時間（秒）
POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "1800"))  # 連接回收時間（秒），防止連接過期

# SQLite 不支援某些 pool 參數，需做判斷
engine_kwargs = {
    "echo": False
}

if DATABASE_URL.startswith("postgresql://"):
    engine_kwargs.update({
        "poolclass": QueuePool,
        "pool_size": POOL_SIZE,
        "max_overflow": MAX_OVERFLOW,
        "pool_timeout": POOL_TIMEOUT,
        "pool_recycle": POOL_RECYCLE,
        "pool_pre_ping": True,
    })

# 建立資料庫引擎
engine = create_engine(DATABASE_URL, **engine_kwargs)

# 建立 Session 工廠 (之後每個 API request 都會從這裡拿一個 session)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 建立 Base 類別 (所有的 Model 都要繼承它)
Base = declarative_base()

# Dependency: 給 FastAPI 用的 Dependency Injection
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
