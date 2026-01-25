"""Prompt Registry System

Create tables for Prompt management with versioning support.

Revision ID: 20260121_prompts
Create Date: 2026-01-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

# revision identifiers, used by Alembic.
revision = '20260121_prompts'
down_revision = None  # Will be set automatically by Alembic chain
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ============================================================
    # Prompts 主表
    # ============================================================
    op.create_table(
        'prompts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('slug', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('generation_type', sa.String(50), nullable=False),
        sa.Column('supported_models', JSON, server_default='[]'),
        sa.Column('default_model', sa.String(100), nullable=True),
        sa.Column('tags', JSON, server_default='[]'),
        sa.Column('usage_count', sa.Integer(), server_default='0'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('is_system', sa.Boolean(), server_default='false'),
        sa.Column('is_public', sa.Boolean(), server_default='true'),
        sa.Column('current_version_id', sa.Integer(), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_index('idx_prompt_category', 'prompts', ['category'])
    op.create_index('idx_prompt_type', 'prompts', ['generation_type'])
    op.create_index('idx_prompt_active', 'prompts', ['is_active'])
    op.create_index('idx_prompt_slug', 'prompts', ['slug'], unique=True)
    op.create_index('idx_prompt_name', 'prompts', ['name'])

    # ============================================================
    # Prompt Versions 版本表
    # ============================================================
    op.create_table(
        'prompt_versions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('prompt_id', sa.Integer(), sa.ForeignKey('prompts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('version_tag', sa.String(50), nullable=True),
        sa.Column('positive_template', sa.Text(), nullable=False),
        sa.Column('negative_template', sa.Text(), nullable=True),
        sa.Column('model_config', JSON, server_default='{}'),
        sa.Column('variables', JSON, server_default='[]'),
        sa.Column('output_format', JSON, server_default='{}'),
        sa.Column('examples', JSON, server_default='[]'),
        sa.Column('system_prompt', sa.Text(), nullable=True),
        sa.Column('changelog', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('is_draft', sa.Boolean(), server_default='false'),
        sa.Column('reviewed_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('avg_rating', sa.Numeric(3, 2), server_default='0'),
        sa.Column('total_ratings', sa.Integer(), server_default='0'),
        sa.Column('success_rate', sa.Numeric(5, 4), server_default='0'),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_index('idx_prompt_version', 'prompt_versions', ['prompt_id', 'version_number'])
    op.create_index('idx_prompt_version_active', 'prompt_versions', ['prompt_id', 'is_active'])

    # ============================================================
    # Prompt Usage Logs 使用記錄表
    # ============================================================
    op.create_table(
        'prompt_usage_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('prompt_id', sa.Integer(), sa.ForeignKey('prompts.id'), nullable=False),
        sa.Column('version_id', sa.Integer(), sa.ForeignKey('prompt_versions.id'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('model_used', sa.String(100), nullable=True),
        sa.Column('input_variables', JSON, server_default='{}'),
        sa.Column('rendered_prompt', sa.Text(), nullable=True),
        sa.Column('generation_id', sa.Integer(), sa.ForeignKey('generation_history.id'), nullable=True),
        sa.Column('execution_time_ms', sa.Integer(), nullable=True),
        sa.Column('tokens_used', sa.Integer(), nullable=True),
        sa.Column('user_rating', sa.Integer(), nullable=True),
        sa.Column('user_feedback', sa.Text(), nullable=True),
        sa.Column('is_success', sa.Boolean(), server_default='true'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_index('idx_usage_prompt', 'prompt_usage_logs', ['prompt_id'])
    op.create_index('idx_usage_version', 'prompt_usage_logs', ['version_id'])
    op.create_index('idx_usage_user', 'prompt_usage_logs', ['user_id'])
    op.create_index('idx_usage_created', 'prompt_usage_logs', ['created_at'])


def downgrade() -> None:
    op.drop_table('prompt_usage_logs')
    op.drop_table('prompt_versions')
    op.drop_table('prompts')
