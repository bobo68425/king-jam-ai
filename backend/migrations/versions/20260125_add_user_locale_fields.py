"""add user locale fields

Revision ID: 20260125_locale
Revises: 
Create Date: 2026-01-25

添加用戶國籍/地區欄位，用於個性化內容生成
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260125_locale'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 添加國籍/地區相關欄位到 users 表
    op.add_column('users', sa.Column('country', sa.String(50), nullable=True, comment='用戶自填國籍/地區'))
    op.add_column('users', sa.Column('address_country', sa.String(50), nullable=True, comment='地址國籍'))
    op.add_column('users', sa.Column('register_ip_country', sa.String(50), nullable=True, comment='註冊時IP國籍'))
    op.add_column('users', sa.Column('register_ip', sa.String(45), nullable=True, comment='註冊時IP地址'))
    op.add_column('users', sa.Column('last_ip_country', sa.String(50), nullable=True, comment='最後活動IP國籍'))
    op.add_column('users', sa.Column('preferred_language', sa.String(10), nullable=True, server_default='zh-TW', comment='偏好語言'))


def downgrade() -> None:
    op.drop_column('users', 'preferred_language')
    op.drop_column('users', 'last_ip_country')
    op.drop_column('users', 'register_ip')
    op.drop_column('users', 'register_ip_country')
    op.drop_column('users', 'address_country')
    op.drop_column('users', 'country')
