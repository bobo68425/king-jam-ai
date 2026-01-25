"""Add extra_settings to social_accounts

Revision ID: add_extra_settings_wp
Revises: 
Create Date: 2026-01-13

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON


# revision identifiers, used by Alembic.
revision = 'add_extra_settings_wp'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # 新增 extra_settings 欄位到 social_accounts 表
    op.add_column(
        'social_accounts',
        sa.Column('extra_settings', JSON, nullable=True, default={})
    )


def downgrade():
    op.drop_column('social_accounts', 'extra_settings')
