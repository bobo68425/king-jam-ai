"""credit categories v2 and withdrawal system

Revision ID: d4e5f6g7h8i9
Revises: c3d4e5f6g7h8
Create Date: 2026-01-11

點數類別重塑：
- PROMO: 優惠點數（短效期，新手任務、行銷活動）
- SUB: 月費點數（當月有效，訂閱方案）
- PAID: 購買點數（永久，可退款）
- BONUS: 獎金點數（永久，可提領現金）

新增提領系統
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'd4e5f6g7h8i9'
down_revision = 'c3d4e5f6g7h8'
branch_labels = None
depends_on = None


def upgrade():
    # ========================================
    # 1. 重命名用戶點數欄位
    # ========================================
    
    # 將 credits_monthly 重命名為 credits_sub
    op.alter_column('users', 'credits_monthly', new_column_name='credits_sub')
    
    # 將 credits_purchased 重命名為 credits_paid
    op.alter_column('users', 'credits_purchased', new_column_name='credits_paid')
    
    # ========================================
    # 2. 更新交易記錄中的類別名稱
    # ========================================
    
    # monthly -> sub
    op.execute("""
        UPDATE credit_transactions 
        SET credit_category = 'sub'
        WHERE credit_category = 'monthly'
    """)
    
    # purchased -> paid
    op.execute("""
        UPDATE credit_transactions 
        SET credit_category = 'paid'
        WHERE credit_category = 'purchased'
    """)
    
    # ========================================
    # 3. 建立提領申請表
    # ========================================
    
    op.create_table(
        'withdrawal_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('credits_amount', sa.Integer(), nullable=False),
        sa.Column('amount_twd', sa.Numeric(10, 2), nullable=False),
        sa.Column('exchange_rate', sa.Numeric(5, 4), server_default='0.10'),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('bank_code', sa.String(10), nullable=True),
        sa.Column('bank_name', sa.String(50), nullable=True),
        sa.Column('account_number', sa.String(50), nullable=True),
        sa.Column('account_holder', sa.String(50), nullable=True),
        sa.Column('reviewed_by', sa.Integer(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('review_note', sa.Text(), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('transfer_reference', sa.String(100), nullable=True),
        sa.Column('transferred_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('credit_transaction_id', sa.Integer(), nullable=True),
        sa.Column('user_note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['reviewed_by'], ['users.id']),
        sa.ForeignKeyConstraint(['credit_transaction_id'], ['credit_transactions.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('credits_amount >= 3000', name='ck_min_withdrawal'),
        sa.CheckConstraint('amount_twd >= 300', name='ck_min_amount_twd'),
    )
    
    op.create_index('idx_withdrawal_user_status', 'withdrawal_requests', ['user_id', 'status'])
    op.create_index('idx_withdrawal_created', 'withdrawal_requests', ['created_at'])
    op.create_index('ix_withdrawal_requests_id', 'withdrawal_requests', ['id'])
    
    # ========================================
    # 4. 建立提領設定表
    # ========================================
    
    op.create_table(
        'withdrawal_config',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('exchange_rate', sa.Numeric(5, 4), server_default='0.10'),
        sa.Column('min_credits', sa.Integer(), server_default='3000'),
        sa.Column('max_credits_per_request', sa.Integer(), server_default='100000'),
        sa.Column('max_credits_per_month', sa.Integer(), server_default='300000'),
        sa.Column('fee_type', sa.String(20), server_default='fixed'),
        sa.Column('fee_amount', sa.Numeric(10, 2), server_default='0'),
        sa.Column('fee_percentage', sa.Numeric(5, 4), server_default='0'),
        sa.Column('auto_approve_threshold', sa.Integer(), server_default='0'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('terms_and_conditions', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    
    # 插入預設設定
    op.execute("""
        INSERT INTO withdrawal_config (
            exchange_rate, min_credits, max_credits_per_request, 
            max_credits_per_month, fee_type, fee_amount, fee_percentage,
            auto_approve_threshold, is_active, terms_and_conditions
        ) VALUES (
            0.10, 3000, 100000, 300000, 'fixed', 0, 0, 0, true,
            '1. 獎金點數（BONUS）可申請提領為現金。
2. 最低提領門檻：3,000 點（等值 NT$ 300）。
3. 匯率：10 點 = NT$ 1。
4. 提領申請需經人工審核，約 3-5 個工作天處理。
5. 每月最高提領上限：300,000 點（NT$ 30,000）。
6. 提領金額將匯入您指定的銀行帳戶，請確保帳戶資訊正確。
7. 如有異常交易或違反使用條款，本平台保留拒絕提領之權利。'
        )
    """)


def downgrade():
    # 刪除提領相關表
    op.drop_table('withdrawal_config')
    op.drop_index('idx_withdrawal_created', 'withdrawal_requests')
    op.drop_index('idx_withdrawal_user_status', 'withdrawal_requests')
    op.drop_index('ix_withdrawal_requests_id', 'withdrawal_requests')
    op.drop_table('withdrawal_requests')
    
    # 還原欄位名稱
    op.alter_column('users', 'credits_sub', new_column_name='credits_monthly')
    op.alter_column('users', 'credits_paid', new_column_name='credits_purchased')
    
    # 還原交易類別
    op.execute("""
        UPDATE credit_transactions 
        SET credit_category = 'monthly'
        WHERE credit_category = 'sub'
    """)
    
    op.execute("""
        UPDATE credit_transactions 
        SET credit_category = 'purchased'
        WHERE credit_category = 'paid'
    """)
