"""add credit categories to users and transactions

Revision ID: c3d4e5f6g7h8
Revises: c2d3e4f5g6h7
Create Date: 2026-01-11

新增點數類別：
- 用戶表新增各類別餘額欄位
- 交易表新增點數類別欄位
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c3d4e5f6g7h8'
down_revision = 'credit_ledger_001'
branch_labels = None
depends_on = None


def upgrade():
    # 新增用戶各類別點數餘額欄位
    op.add_column('users', sa.Column('credits_bonus', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('users', sa.Column('credits_monthly', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('users', sa.Column('credits_purchased', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('users', sa.Column('credits_promo', sa.Integer(), nullable=True, server_default='0'))
    
    # 新增交易表點數類別欄位
    op.add_column('credit_transactions', sa.Column('credit_category', sa.String(20), nullable=True, server_default='purchased'))
    
    # 建立索引
    op.create_index('idx_credit_tx_category', 'credit_transactions', ['credit_category'])
    
    # 更新現有用戶：將總點數設為購買點數（預設）
    op.execute("""
        UPDATE users 
        SET credits_purchased = COALESCE(credits, 0),
            credits_bonus = 0,
            credits_monthly = 0,
            credits_promo = 0
        WHERE credits_purchased IS NULL OR credits_purchased = 0
    """)
    
    # 更新現有交易記錄的類別
    # initial_grant, referral_bonus -> bonus
    op.execute("""
        UPDATE credit_transactions 
        SET credit_category = 'bonus'
        WHERE transaction_type IN ('initial_grant', 'referral_bonus')
    """)
    
    # subscription_grant, monthly_grant -> monthly
    op.execute("""
        UPDATE credit_transactions 
        SET credit_category = 'monthly'
        WHERE transaction_type IN ('subscription_grant', 'monthly_grant')
    """)
    
    # promo_credit -> promo
    op.execute("""
        UPDATE credit_transactions 
        SET credit_category = 'promo'
        WHERE transaction_type = 'promo_credit'
    """)
    
    # purchase -> purchased
    op.execute("""
        UPDATE credit_transactions 
        SET credit_category = 'purchased'
        WHERE transaction_type = 'purchase'
    """)
    
    # 消耗類型的交易 -> 預設 purchased
    op.execute("""
        UPDATE credit_transactions 
        SET credit_category = 'purchased'
        WHERE credit_category IS NULL
    """)
    
    # 設為 NOT NULL
    op.alter_column('credit_transactions', 'credit_category', nullable=False)


def downgrade():
    # 移除索引
    op.drop_index('idx_credit_tx_category', 'credit_transactions')
    
    # 移除欄位
    op.drop_column('credit_transactions', 'credit_category')
    op.drop_column('users', 'credits_promo')
    op.drop_column('users', 'credits_purchased')
    op.drop_column('users', 'credits_monthly')
    op.drop_column('users', 'credits_bonus')
