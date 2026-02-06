"""新增藍新金流欄位

Revision ID: 20260204_newebpay
Revises: 
Create Date: 2026-02-04

此遷移使用直接 SQL 執行，以避免 Alembic 多頭問題
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '20260204_newebpay'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 使用 PostgreSQL 的 ADD COLUMN IF NOT EXISTS（需要 PG 9.6+）
    # 直接執行 SQL 以避免 Alembic 版本追蹤問題
    op.execute("""
        DO $$ 
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'orders' AND column_name = 'newebpay_merchant_order_no'
            ) THEN
                ALTER TABLE orders ADD COLUMN newebpay_merchant_order_no VARCHAR(30);
            END IF;
            
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'orders' AND column_name = 'newebpay_trade_no'
            ) THEN
                ALTER TABLE orders ADD COLUMN newebpay_trade_no VARCHAR(30);
            END IF;
        END $$;
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE orders DROP COLUMN IF EXISTS newebpay_trade_no;
        ALTER TABLE orders DROP COLUMN IF EXISTS newebpay_merchant_order_no;
    """)
