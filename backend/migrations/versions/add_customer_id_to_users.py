"""add customer_id and referral fields to users

Revision ID: a1b2c3d4e5f6
Revises: 6913b5192b9d
Create Date: 2026-01-11

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '6913b5192b9d'
branch_labels = None
depends_on = None


def upgrade():
    # 添加客戶編號欄位
    op.add_column('users', sa.Column('customer_id', sa.String(), nullable=True))
    op.create_index(op.f('ix_users_customer_id'), 'users', ['customer_id'], unique=True)
    
    # 添加推薦碼欄位
    op.add_column('users', sa.Column('referral_code', sa.String(), nullable=True))
    op.create_index(op.f('ix_users_referral_code'), 'users', ['referral_code'], unique=True)
    
    # 添加被推薦人欄位
    op.add_column('users', sa.Column('referred_by', sa.String(), nullable=True))


def downgrade():
    op.drop_index(op.f('ix_users_referral_code'), table_name='users')
    op.drop_column('users', 'referred_by')
    op.drop_column('users', 'referral_code')
    op.drop_index(op.f('ix_users_customer_id'), table_name='users')
    op.drop_column('users', 'customer_id')
