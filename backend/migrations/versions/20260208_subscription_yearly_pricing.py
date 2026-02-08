"""訂閱方案年繳價格與折扣

Revision ID: 20260208_yearly
Revises: None
Create Date: 2026-02-08

"""
from alembic import op
import sqlalchemy as sa


revision = "20260208_yearly"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'subscription_plans' AND column_name = 'price_yearly'
            ) THEN
                ALTER TABLE subscription_plans ADD COLUMN price_yearly NUMERIC(10, 2);
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'subscription_plans' AND column_name = 'yearly_discount_percent'
            ) THEN
                ALTER TABLE subscription_plans ADD COLUMN yearly_discount_percent NUMERIC(5, 2);
            END IF;
        END $$;
    """)
    # 設定年繳價格與折扣（約 2 個月免費 = 8 折，20% 折扣）
    op.execute("""
        UPDATE subscription_plans
        SET
            price_yearly = ROUND(price_monthly * 12 * 0.8, 0),
            yearly_discount_percent = 20
        WHERE plan_code IN ('basic', 'pro', 'enterprise')
          AND (price_yearly IS NULL OR yearly_discount_percent IS NULL);
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE subscription_plans DROP COLUMN IF EXISTS price_yearly;")
    op.execute("ALTER TABLE subscription_plans DROP COLUMN IF EXISTS yearly_discount_percent;")
