"""募資行銷活動模組

Revision ID: 20260208_funding
Revises: None
Create Date: 2026-02-08

"""
from alembic import op
import sqlalchemy as sa


revision = "20260208_funding"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 募資專案
    op.create_table(
        "funding_projects",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_code", sa.String(50), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("target_plan_code", sa.String(50), nullable=False),
        sa.Column("subscription_months", sa.Integer(), nullable=False, server_default="6"),
        sa.Column("fundraising_platform", sa.String(50), nullable=True),
        sa.Column("platform_url", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_funding_projects_project_code", "funding_projects", ["project_code"], unique=True)

    # 募資方案層級
    op.create_table(
        "funding_tiers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("tier_code", sa.String(50), nullable=False),
        sa.Column("tier_name", sa.String(100), nullable=False),
        sa.Column("fundraising_price_twd", sa.Numeric(10, 2), nullable=False),
        sa.Column("original_price_twd", sa.Numeric(10, 2), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["project_id"], ["funding_projects.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_funding_tiers_project_id", "funding_tiers", ["project_id"])

    # 銷售碼
    op.create_table(
        "sales_codes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(32), nullable=False),
        sa.Column("tier_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("redeemer_user_id", sa.Integer(), nullable=True),
        sa.Column("redeemed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("order_id", sa.Integer(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("external_order_id", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["tier_id"], ["funding_tiers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["redeemer_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="SET NULL"),
    )
    op.create_index("idx_sales_code_code", "sales_codes", ["code"], unique=True)
    op.create_index("idx_sales_code_status", "sales_codes", ["status"])
    op.create_index("idx_sales_code_tier", "sales_codes", ["tier_id"])


def downgrade() -> None:
    op.drop_table("sales_codes")
    op.drop_table("funding_tiers")
    op.drop_table("funding_projects")
