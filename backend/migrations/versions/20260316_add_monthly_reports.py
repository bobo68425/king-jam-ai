"""add monthly_reports and dividend_records

Revision ID: 20260316_reports
Revises: 20260316_angel
Create Date: 2026-03-16 13:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260316_reports'
down_revision = '20260316_angel'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 創建 dividend_records 表 (如果不存在)
    # 注意：如果已經存在，這層級的 migration 可能會失敗，所以我們先 check
    # 但 Alembic 通常建議直接定義
    op.create_table('dividend_records',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('dividend_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='completed', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_dividend_records_id'), 'dividend_records', ['id'], unique=False)
    op.create_index(op.f('ix_dividend_records_user_id'), 'dividend_records', ['user_id'], unique=False)

    # 創建 monthly_reports 表
    op.create_table('monthly_reports',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('year_month', sa.String(length=7), nullable=False),
        sa.Column('revenue', sa.Numeric(precision=12, scale=2), server_default=sa.text('0'), nullable=True),
        sa.Column('expenses', sa.Numeric(precision=12, scale=2), server_default=sa.text('0'), nullable=True),
        sa.Column('net_profit', sa.Numeric(precision=12, scale=2), server_default=sa.text('0'), nullable=True),
        sa.Column('withholding_tax', sa.Numeric(precision=12, scale=2), server_default=sa.text('0'), nullable=True),
        sa.Column('distributable_profit', sa.Numeric(precision=12, scale=2), server_default=sa.text('0'), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='draft', nullable=True),
        sa.Column('metadata_json', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('settled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_monthly_reports_id'), 'monthly_reports', ['id'], unique=False)
    op.create_index(op.f('ix_monthly_reports_year_month'), 'monthly_reports', ['year_month'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_monthly_reports_year_month'), table_name='monthly_reports')
    op.drop_index(op.f('ix_monthly_reports_id'), table_name='monthly_reports')
    op.drop_table('monthly_reports')
    op.drop_index(op.f('ix_dividend_records_user_id'), table_name='dividend_records')
    op.drop_index(op.f('ix_dividend_records_id'), table_name='dividend_records')
    op.drop_table('dividend_records')
