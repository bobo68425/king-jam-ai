"""add generation_history table

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-01-11

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6g7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'generation_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('generation_type', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('input_params', sa.JSON(), nullable=True),
        sa.Column('output_data', sa.JSON(), nullable=True),
        sa.Column('media_local_path', sa.String(), nullable=True),
        sa.Column('media_cloud_url', sa.String(), nullable=True),
        sa.Column('media_cloud_key', sa.String(), nullable=True),
        sa.Column('media_cloud_provider', sa.String(), nullable=True),
        sa.Column('thumbnail_url', sa.String(), nullable=True),
        sa.Column('credits_used', sa.Integer(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('error_details', sa.JSON(), nullable=True),
        sa.Column('generation_duration_ms', sa.Integer(), nullable=True),
        sa.Column('file_size_bytes', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_generation_history_id'), 'generation_history', ['id'], unique=False)
    op.create_index(op.f('ix_generation_history_user_id'), 'generation_history', ['user_id'], unique=False)
    op.create_index(op.f('ix_generation_history_generation_type'), 'generation_history', ['generation_type'], unique=False)
    op.create_index(op.f('ix_generation_history_status'), 'generation_history', ['status'], unique=False)
    op.create_index(op.f('ix_generation_history_created_at'), 'generation_history', ['created_at'], unique=False)
    op.create_index(op.f('ix_generation_history_is_deleted'), 'generation_history', ['is_deleted'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_generation_history_is_deleted'), table_name='generation_history')
    op.drop_index(op.f('ix_generation_history_created_at'), table_name='generation_history')
    op.drop_index(op.f('ix_generation_history_status'), table_name='generation_history')
    op.drop_index(op.f('ix_generation_history_generation_type'), table_name='generation_history')
    op.drop_index(op.f('ix_generation_history_user_id'), table_name='generation_history')
    op.drop_index(op.f('ix_generation_history_id'), table_name='generation_history')
    op.drop_table('generation_history')
