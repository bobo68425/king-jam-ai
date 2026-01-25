"""Add content_metrics and metrics_sync_logs tables

Revision ID: 20260117_metrics
Revises: 
Create Date: 2026-01-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260117_metrics'
down_revision = None  # Update this to your latest migration
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create content_metrics table
    op.create_table(
        'content_metrics',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('post_id', sa.Integer(), nullable=True),
        sa.Column('scheduled_post_id', sa.Integer(), nullable=True),
        sa.Column('platform', sa.String(length=50), nullable=False),
        sa.Column('platform_post_id', sa.String(length=255), nullable=True),
        sa.Column('platform_post_url', sa.String(length=500), nullable=True),
        sa.Column('metric_date', sa.DateTime(timezone=True), nullable=False),
        
        # Exposure metrics
        sa.Column('impressions', sa.Integer(), default=0),
        sa.Column('reach', sa.Integer(), default=0),
        sa.Column('views', sa.Integer(), default=0),
        
        # Engagement metrics
        sa.Column('likes', sa.Integer(), default=0),
        sa.Column('comments', sa.Integer(), default=0),
        sa.Column('shares', sa.Integer(), default=0),
        sa.Column('saves', sa.Integer(), default=0),
        sa.Column('clicks', sa.Integer(), default=0),
        sa.Column('engagement_rate', sa.Numeric(precision=5, scale=4), default=0),
        
        # Video metrics
        sa.Column('watch_time_seconds', sa.Integer(), default=0),
        sa.Column('avg_watch_time_seconds', sa.Numeric(precision=10, scale=2), default=0),
        sa.Column('video_completion_rate', sa.Numeric(precision=5, scale=4), default=0),
        
        # GA4 metrics
        sa.Column('page_sessions', sa.Integer(), default=0),
        sa.Column('page_users', sa.Integer(), default=0),
        sa.Column('page_bounce_rate', sa.Numeric(precision=5, scale=4), default=0),
        sa.Column('avg_session_duration', sa.Numeric(precision=10, scale=2), default=0),
        
        # Conversion metrics
        sa.Column('conversions', sa.Integer(), default=0),
        sa.Column('conversion_value', sa.Numeric(precision=12, scale=2), default=0),
        
        # Follower metrics
        sa.Column('followers_gained', sa.Integer(), default=0),
        sa.Column('followers_lost', sa.Integer(), default=0),
        sa.Column('net_followers', sa.Integer(), default=0),
        
        # Raw data
        sa.Column('raw_data', sa.JSON(), default=dict),
        
        # Sync status
        sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sync_status', sa.String(length=20), default='pending'),
        sa.Column('sync_error', sa.Text(), nullable=True),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.text('now()')),
        
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ),
        sa.ForeignKeyConstraint(['scheduled_post_id'], ['scheduled_posts.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for content_metrics
    op.create_index('idx_metrics_post', 'content_metrics', ['post_id'])
    op.create_index('idx_metrics_scheduled', 'content_metrics', ['scheduled_post_id'])
    op.create_index('idx_metrics_platform', 'content_metrics', ['platform'])
    op.create_index('idx_metrics_date', 'content_metrics', ['metric_date'])
    op.create_index('idx_metrics_user_date', 'content_metrics', ['user_id', 'metric_date'])
    op.create_index('ix_content_metrics_id', 'content_metrics', ['id'])
    
    # Create metrics_sync_logs table
    op.create_table(
        'metrics_sync_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('sync_type', sa.String(length=50), nullable=False),
        sa.Column('platform', sa.String(length=50), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, default='running'),
        sa.Column('total_posts', sa.Integer(), default=0),
        sa.Column('success_count', sa.Integer(), default=0),
        sa.Column('failed_count', sa.Integer(), default=0),
        sa.Column('skipped_count', sa.Integer(), default=0),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('error_details', sa.JSON(), default=dict),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.Column('celery_task_id', sa.String(length=255), nullable=True),
        
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_index('ix_metrics_sync_logs_id', 'metrics_sync_logs', ['id'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_metrics_user_date', table_name='content_metrics')
    op.drop_index('idx_metrics_date', table_name='content_metrics')
    op.drop_index('idx_metrics_platform', table_name='content_metrics')
    op.drop_index('idx_metrics_scheduled', table_name='content_metrics')
    op.drop_index('idx_metrics_post', table_name='content_metrics')
    op.drop_index('ix_content_metrics_id', table_name='content_metrics')
    op.drop_index('ix_metrics_sync_logs_id', table_name='metrics_sync_logs')
    
    # Drop tables
    op.drop_table('metrics_sync_logs')
    op.drop_table('content_metrics')
