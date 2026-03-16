"""merge all heads

Revision ID: 20260316_merge
Revises: ('20260123_orders', '20260204_newebpay', '20260208_funding', '20260208_yearly', '20260204_phone_2fa', '20260121_prompts', '20260316_reports', '20260302_tracking', '20260118_withdrawal_risk', 'add_extra_settings_wp', '20260125_locale', '20260117_metrics')
Create Date: 2026-03-16 21:00:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260316_merge'
down_revision = (
    '20260123_orders',
    '20260204_newebpay',
    '20260208_funding',
    '20260208_yearly',
    '20260204_phone_2fa',
    '20260121_prompts',
    '20260316_reports',
    '20260302_tracking',
    '20260118_withdrawal_risk',
    'add_extra_settings_wp',
    '20260125_locale',
    '20260117_metrics'
)
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
