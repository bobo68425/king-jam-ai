"""提領風控升級 - T+14 冷卻期 & 首次提領人工審核

Revision ID: 20260118_withdrawal_risk
Revises: 
Create Date: 2026-01-18

功能說明：
1. T+14 冷卻期：BONUS 點數獲得後需等待 14 天才能提領（配合信用卡退款週期）
2. 首次提領人工審核：新用戶首次提領需要經過人工審核
3. 高額提領審核：超過門檻的提領需要人工審核
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic
revision = '20260118_withdrawal_risk'
down_revision = None  # 請根據實際情況設定
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. 在 credit_transactions 表添加 available_at 欄位（T+14 冷卻期）
    op.add_column(
        'credit_transactions',
        sa.Column('available_at', sa.DateTime(timezone=True), nullable=True, index=True,
                  comment='BONUS 點數可提領時間（T+14 冷卻期）')
    )
    op.create_index('idx_credit_tx_available_at', 'credit_transactions', ['available_at'])
    
    # 2. 在 withdrawal_requests 表添加風控欄位
    op.add_column(
        'withdrawal_requests',
        sa.Column('is_first_withdrawal', sa.Boolean(), nullable=True, default=False,
                  comment='是否為首次提領')
    )
    op.add_column(
        'withdrawal_requests',
        sa.Column('requires_manual_review', sa.Boolean(), nullable=True, default=False,
                  comment='是否需要人工審核')
    )
    op.add_column(
        'withdrawal_requests',
        sa.Column('risk_level', sa.String(20), nullable=True, default='low',
                  comment='風險等級：low, medium, high')
    )
    op.add_column(
        'withdrawal_requests',
        sa.Column('risk_notes', sa.Text(), nullable=True,
                  comment='風險備註')
    )
    
    # 3. 在 withdrawal_config 表添加風控設定欄位
    op.add_column(
        'withdrawal_config',
        sa.Column('cooling_period_days', sa.Integer(), nullable=True, default=14,
                  comment='BONUS 提領冷卻期（天），預設 14 天配合信用卡退款週期')
    )
    op.add_column(
        'withdrawal_config',
        sa.Column('first_withdrawal_manual_review', sa.Boolean(), nullable=True, default=True,
                  comment='首次提領是否需要人工審核')
    )
    op.add_column(
        'withdrawal_config',
        sa.Column('high_amount_threshold', sa.Integer(), nullable=True, default=50000,
                  comment='高額提領門檻（點數），超過此門檻需人工審核')
    )
    
    # 4. 更新現有的 withdrawal_config 記錄（如果有的話）
    op.execute("""
        UPDATE withdrawal_config 
        SET cooling_period_days = 14,
            first_withdrawal_manual_review = true,
            high_amount_threshold = 50000
        WHERE cooling_period_days IS NULL
    """)


def downgrade() -> None:
    # 移除 withdrawal_config 的風控設定欄位
    op.drop_column('withdrawal_config', 'high_amount_threshold')
    op.drop_column('withdrawal_config', 'first_withdrawal_manual_review')
    op.drop_column('withdrawal_config', 'cooling_period_days')
    
    # 移除 withdrawal_requests 的風控欄位
    op.drop_column('withdrawal_requests', 'risk_notes')
    op.drop_column('withdrawal_requests', 'risk_level')
    op.drop_column('withdrawal_requests', 'requires_manual_review')
    op.drop_column('withdrawal_requests', 'is_first_withdrawal')
    
    # 移除 credit_transactions 的 available_at 欄位
    op.drop_index('idx_credit_tx_available_at', table_name='credit_transactions')
    op.drop_column('credit_transactions', 'available_at')
