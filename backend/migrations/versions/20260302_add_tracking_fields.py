"""加入影片成效追蹤所需的欄位

Revision ID: 20260302_tracking
Revises: None
Create Date: 2026-03-02

"""
from alembic import op
import sqlalchemy as sa


revision = "20260302_tracking"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 針對 generation_history 表格加入 fb_pixel_id, ga_measurement_id, custom_script
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'generation_history' AND column_name = 'fb_pixel_id'
            ) THEN
                ALTER TABLE generation_history ADD COLUMN fb_pixel_id VARCHAR(50);
            END IF;
            
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'generation_history' AND column_name = 'ga_measurement_id'
            ) THEN
                ALTER TABLE generation_history ADD COLUMN ga_measurement_id VARCHAR(50);
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'generation_history' AND column_name = 'custom_script'
            ) THEN
                ALTER TABLE generation_history ADD COLUMN custom_script TEXT;
            END IF;
        END $$;
    """)

def downgrade() -> None:
    op.execute("ALTER TABLE generation_history DROP COLUMN IF EXISTS fb_pixel_id;")
    op.execute("ALTER TABLE generation_history DROP COLUMN IF EXISTS ga_measurement_id;")
    op.execute("ALTER TABLE generation_history DROP COLUMN IF EXISTS custom_script;")
