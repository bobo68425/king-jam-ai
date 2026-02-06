"""新增藍新金流欄位

Revision ID: 20260204_newebpay
Revises: 
Create Date: 2026-02-04

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260204_newebpay'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 新增藍新金流欄位到 orders 表
    op.add_column('orders', sa.Column('newebpay_merchant_order_no', sa.String(30), nullable=True))
    op.add_column('orders', sa.Column('newebpay_trade_no', sa.String(30), nullable=True))


def downgrade() -> None:
    op.drop_column('orders', 'newebpay_trade_no')
    op.drop_column('orders', 'newebpay_merchant_order_no')
