"""LTX-2.3 點數定價調整（每段至少 30 點才有利潤）

Revision ID: 20260311_ltx
Revises: credit_constraints_001
Create Date: 2026-03-11

"""
from alembic import op

revision = "20260311_ltx"
down_revision = "credit_constraints_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        UPDATE credit_pricing SET credits_cost = 30 WHERE feature_code = 'v3_ltx_fast';
    """)
    op.execute("""
        UPDATE credit_pricing SET credits_cost = 35 WHERE feature_code = 'v3_ltx_fast_1080p';
    """)


def downgrade() -> None:
    op.execute("""
        UPDATE credit_pricing SET credits_cost = 10 WHERE feature_code = 'v3_ltx_fast';
    """)
    op.execute("""
        UPDATE credit_pricing SET credits_cost = 20 WHERE feature_code = 'v3_ltx_fast_1080p';
    """)
