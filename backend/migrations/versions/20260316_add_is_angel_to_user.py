"""add is_angel to user

Revision ID: 20260316_angel
Revises: 20260311_ltx
Create Date: 2026-03-16 12:55:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260316_angel'
down_revision = '20260311_ltx'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 新增 is_angel 欄位，允許為空（稍後填寫預設值）
    op.add_column('users', sa.Column('is_angel', sa.Boolean(), nullable=True))
    op.create_index(op.f('ix_users_is_angel'), 'users', ['is_angel'], unique=False)
    
    # 為既有用戶設定預設值為 False
    op.execute("UPDATE users SET is_angel = false WHERE is_angel IS NULL")
    
    # 修改欄位為不可為空，並設定預設值
    op.alter_column('users', 'is_angel',
               existing_type=sa.Boolean(),
               nullable=False,
               server_default=sa.text('false'))


def downgrade() -> None:
    op.drop_index(op.f('ix_users_is_angel'), table_name='users')
    op.drop_column('users', 'is_angel')
