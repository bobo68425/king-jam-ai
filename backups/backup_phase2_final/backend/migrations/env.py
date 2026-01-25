import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# -----------------------------------------------------------
# 關鍵修改：將 backend 目錄加入 python path，否則找不到 app
# -----------------------------------------------------------
sys.path.append(os.getcwd())

# 匯入我們的設定與 Models
from app.database import Base, DATABASE_URL
from app.models import User  # 必須匯入 User，Base.metadata 才會知道有這個表

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 將我們的 Base metadata 指定給 target_metadata
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = DATABASE_URL # 直接使用我們 database.py 裡的變數
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    # 將 config 中的 url 替換成我們的環境變數 URL
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = DATABASE_URL
    
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()