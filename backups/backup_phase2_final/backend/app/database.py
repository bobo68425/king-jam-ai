import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# 從環境變數讀取資料庫 URL (對應 docker-compose.yml)
# 注意：Docker 內部我們用 postgresql://... 但 SQLAlchemy 建議明確指定 driver
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://kingjam:kingjam_pass@db:5432/kingjam_db")

# 建立資料庫引擎
engine = create_engine(DATABASE_URL)

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