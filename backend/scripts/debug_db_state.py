
import os
from sqlalchemy import create_engine, text

def check_db():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not set")
        return
        
    engine = create_engine(db_url)
    try:
        with engine.connect() as conn:
            # Check alembic_version
            try:
                result = conn.execute(text("SELECT version_num FROM alembic_version"))
                versions = [row[0] for row in result]
                print(f"Current alembic_versions: {versions}")
            except Exception as e:
                print(f"alembic_version table error: {e}")
                
            # Check existing tables
            try:
                result = conn.execute(text("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'"))
                tables = [row[0] for row in result]
                print(f"Existing tables: {tables}")
            except Exception as e:
                print(f"pg_tables error: {e}")
                
    except Exception as e:
        print(f"Connection error: {e}")

if __name__ == "__main__":
    check_db()
