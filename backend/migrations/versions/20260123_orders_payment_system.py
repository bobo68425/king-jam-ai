"""訂單與支付系統

Revision ID: 20260123_orders
Revises: 
Create Date: 2026-01-23

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260123_orders'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 建立訂單表
    op.create_table(
        'orders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('order_no', sa.String(50), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('order_type', sa.String(20), nullable=False),
        sa.Column('item_code', sa.String(50), nullable=False),
        sa.Column('item_name', sa.String(100), nullable=False),
        sa.Column('item_description', sa.Text(), nullable=True),
        sa.Column('quantity', sa.Integer(), default=1),
        sa.Column('unit_price', sa.Numeric(10, 2), nullable=False),
        sa.Column('total_amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('currency', sa.String(3), default='TWD'),
        sa.Column('subscription_months', sa.Integer(), nullable=True),
        sa.Column('credits_amount', sa.Integer(), nullable=True),
        sa.Column('bonus_credits', sa.Integer(), nullable=True),
        sa.Column('payment_provider', sa.String(20), nullable=True),
        sa.Column('payment_method', sa.String(50), nullable=True),
        sa.Column('provider_order_id', sa.String(100), nullable=True),
        sa.Column('provider_transaction_id', sa.String(100), nullable=True),
        sa.Column('provider_response', sa.JSON(), nullable=True),
        sa.Column('stripe_payment_intent_id', sa.String(100), nullable=True),
        sa.Column('stripe_checkout_session_id', sa.String(100), nullable=True),
        sa.Column('stripe_subscription_id', sa.String(100), nullable=True),
        sa.Column('ecpay_merchant_trade_no', sa.String(20), nullable=True),
        sa.Column('ecpay_trade_no', sa.String(20), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, default='pending'),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('refund_amount', sa.Numeric(10, 2), nullable=True),
        sa.Column('refund_reason', sa.Text(), nullable=True),
        sa.Column('refunded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('referrer_id', sa.Integer(), nullable=True),
        sa.Column('referral_bonus', sa.Numeric(10, 2), nullable=True),
        sa.Column('referral_processed', sa.Boolean(), default=False),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['referrer_id'], ['users.id']),
    )
    
    # 建立索引
    op.create_index('idx_order_no', 'orders', ['order_no'], unique=True)
    op.create_index('idx_order_user', 'orders', ['user_id'])
    op.create_index('idx_order_status', 'orders', ['status'])
    op.create_index('idx_order_payment_provider', 'orders', ['payment_provider'])
    op.create_index('idx_order_created', 'orders', ['created_at'])
    op.create_index('idx_order_ecpay_no', 'orders', ['ecpay_merchant_trade_no'])
    op.create_index('idx_order_stripe_session', 'orders', ['stripe_checkout_session_id'])
    
    # 建立支付日誌表
    op.create_table(
        'payment_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('status_before', sa.String(20), nullable=True),
        sa.Column('status_after', sa.String(20), nullable=True),
        sa.Column('provider', sa.String(20), nullable=True),
        sa.Column('provider_response', sa.JSON(), nullable=True),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('extra_data', sa.JSON(), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id']),
    )
    
    op.create_index('idx_payment_log_order', 'payment_logs', ['order_id'])
    op.create_index('idx_payment_log_created', 'payment_logs', ['created_at'])


def downgrade() -> None:
    op.drop_table('payment_logs')
    op.drop_table('orders')
