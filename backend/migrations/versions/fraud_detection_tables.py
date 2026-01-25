"""add fraud detection tables

Revision ID: fraud_detection_001
Revises: 
Create Date: 2026-01-14

詐騙偵測資料表：
- device_fingerprints: 裝置指紋記錄
- ip_address_logs: IP 地址登入記錄
- fraud_alerts: 詐騙警報
- user_risk_profiles: 用戶風險檔案
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'fraud_detection_001'
down_revision = 'd4e5f6g7h8i9'  # 依賴於最新的 credit_categories_v2
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. 裝置指紋記錄表
    op.create_table(
        'device_fingerprints',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), index=True),
        sa.Column('fingerprint_hash', sa.String(64), index=True),
        sa.Column('fingerprint_data', sa.JSON(), nullable=True),
        sa.Column('ip_address', sa.String(45), index=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('first_seen_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('login_count', sa.Integer(), default=1),
    )
    
    # 2. IP 地址登入記錄表
    op.create_table(
        'ip_address_logs',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), index=True),
        sa.Column('ip_address', sa.String(45), index=True),
        sa.Column('ip_hash', sa.String(64), index=True),
        sa.Column('country', sa.String(2), nullable=True),
        sa.Column('city', sa.String(100), nullable=True),
        sa.Column('isp', sa.String(200), nullable=True),
        sa.Column('is_vpn', sa.Boolean(), default=False),
        sa.Column('is_proxy', sa.Boolean(), default=False),
        sa.Column('is_datacenter', sa.Boolean(), default=False),
        sa.Column('first_seen_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('login_count', sa.Integer(), default=1),
    )
    
    # 3. 詐騙警報表
    op.create_table(
        'fraud_alerts',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), index=True),
        sa.Column('alert_type', sa.String(50), index=True),
        sa.Column('risk_level', sa.String(20), default='medium'),
        sa.Column('risk_score', sa.Float(), default=0.0),
        sa.Column('related_user_ids', sa.JSON(), default=list),
        sa.Column('evidence', sa.JSON(), default=dict),
        sa.Column('is_resolved', sa.Boolean(), default=False),
        sa.Column('resolved_by', sa.Integer(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolution_note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    
    # 4. 用戶風險檔案表
    op.create_table(
        'user_risk_profiles',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), unique=True, index=True),
        sa.Column('risk_level', sa.String(20), default='low'),
        sa.Column('risk_score', sa.Float(), default=0.0),
        sa.Column('referral_bonus_blocked', sa.Boolean(), default=False),
        sa.Column('withdrawal_blocked', sa.Boolean(), default=False),
        sa.Column('account_restricted', sa.Boolean(), default=False),
        sa.Column('block_reason', sa.Text(), nullable=True),
        sa.Column('last_checked_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # 創建複合索引以加速查詢
    op.create_index(
        'ix_device_fingerprints_user_fp',
        'device_fingerprints',
        ['user_id', 'fingerprint_hash']
    )
    op.create_index(
        'ix_ip_address_logs_user_ip',
        'ip_address_logs',
        ['user_id', 'ip_hash']
    )
    op.create_index(
        'ix_fraud_alerts_unresolved',
        'fraud_alerts',
        ['user_id', 'is_resolved']
    )


def downgrade() -> None:
    op.drop_index('ix_fraud_alerts_unresolved', 'fraud_alerts')
    op.drop_index('ix_ip_address_logs_user_ip', 'ip_address_logs')
    op.drop_index('ix_device_fingerprints_user_fp', 'device_fingerprints')
    
    op.drop_table('user_risk_profiles')
    op.drop_table('fraud_alerts')
    op.drop_table('ip_address_logs')
    op.drop_table('device_fingerprints')
