import os
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool
from sqlalchemy.orm import sessionmaker, declarative_base

# 從環境變數讀取資料庫 URL (對應 docker-compose.yml)
# 注意：Docker 內部我們用 postgresql://... 但 SQLAlchemy 建議明確指定 driver
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://kingjam:kingjam_pass@db:5432/kingjam_db")

# ============================================================
# 連接池配置（優化高併發性能）
# ============================================================
POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "20"))          # 基礎連接池大小
MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "30"))    # 額外可創建的連接數
POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "30"))    # 等待連接的超時時間（秒）
POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "1800"))  # 連接回收時間（秒），防止連接過期

# 建立資料庫引擎（使用 QueuePool 連接池）
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=POOL_SIZE,           # 連接池保持的連接數
    max_overflow=MAX_OVERFLOW,     # 超過 pool_size 後可額外創建的連接
    pool_timeout=POOL_TIMEOUT,     # 獲取連接的等待超時
    pool_recycle=POOL_RECYCLE,     # 自動回收超過此秒數的連接
    pool_pre_ping=True,            # 使用前檢測連接是否有效
    echo=False,                    # 設為 True 可查看 SQL 日誌（調試用）
)

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
