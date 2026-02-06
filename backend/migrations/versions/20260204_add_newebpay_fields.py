"""新增藍新金流欄位

Revision ID: 20260204_newebpay
Revises: 
Create Date: 2026-02-04

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


# revision identifiers, used by Alembic.
revision = '20260204_newebpay'
down_revision = None
branch_labels = None
depends_on = None


def column_exists(table_name: str, column_name: str) -> bool:
    """檢查欄位是否已存在"""
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    # 新增藍新金流欄位到 orders 表（如果不存在）
    if not column_exists('orders', 'newebpay_merchant_order_no'):
        op.add_column('orders', sa.Column('newebpay_merchant_order_no', sa.String(30), nullable=True))
    
    if not column_exists('orders', 'newebpay_trade_no'):
        op.add_column('orders', sa.Column('newebpay_trade_no', sa.String(30), nullable=True))


def downgrade() -> None:
    if column_exists('orders', 'newebpay_trade_no'):
        op.drop_column('orders', 'newebpay_trade_no')
    
    if column_exists('orders', 'newebpay_merchant_order_no'):
        op.drop_column('orders', 'newebpay_merchant_order_no')
