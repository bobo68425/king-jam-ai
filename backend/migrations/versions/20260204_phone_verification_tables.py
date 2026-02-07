"""add phone verification and 2FA tables

Revision ID: 20260204_phone_2fa
Revises: 
Create Date: 2026-02-04

手機驗證與雙重認證資料表：
- phone_verifications: 手機號碼驗證記錄
- two_factor_auth: 雙重認證設定 (TOTP)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260204_phone_2fa'
down_revision = None  # 可獨立執行
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 檢查表是否已存在，避免重複創建
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()
    
    # 1. 手機驗證記錄表
    if 'phone_verifications' not in existing_tables:
        op.create_table(
            'phone_verifications',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False),
            sa.Column('phone_number', sa.String(20), nullable=False, index=True),
            sa.Column('country_code', sa.String(5), nullable=True, default='+886'),
            sa.Column('is_verified', sa.Boolean(), default=False),
            sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('otp_attempts', sa.Integer(), default=0),  # OTP 嘗試次數
            sa.Column('last_otp_sent_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('otp_daily_count', sa.Integer(), default=0),  # 當日發送次數
            sa.Column('otp_daily_reset_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        )
        
        # 創建索引
        op.create_index(
            'ix_phone_verifications_phone',
            'phone_verifications',
            ['phone_number', 'is_verified']
        )
    
    # 2. 雙重認證設定表 (TOTP - Google Authenticator 等)
    if 'two_factor_auth' not in existing_tables:
        op.create_table(
            'two_factor_auth',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False),
            sa.Column('totp_secret', sa.String(64), nullable=True),  # TOTP 密鑰（加密存儲）
            sa.Column('is_totp_enabled', sa.Boolean(), default=False),
            sa.Column('backup_codes', sa.JSON(), nullable=True),  # 備用恢復碼
            sa.Column('backup_codes_used', sa.JSON(), default=list),  # 已使用的備用碼
            sa.Column('enabled_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        )
    
    # 3. OTP 發送記錄表（用於追蹤和防濫用）
    if 'otp_send_logs' not in existing_tables:
        op.create_table(
            'otp_send_logs',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True),
            sa.Column('phone_number', sa.String(20), nullable=False, index=True),
            sa.Column('otp_type', sa.String(20), default='phone_verify'),  # phone_verify, login, withdrawal
            sa.Column('provider', sa.String(20), nullable=True),  # twilio, mitake, etc.
            sa.Column('message_id', sa.String(100), nullable=True),  # 簡訊商回傳的 ID
            sa.Column('status', sa.String(20), default='sent'),  # sent, delivered, failed
            sa.Column('ip_address', sa.String(45), nullable=True),
            sa.Column('user_agent', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        
        # 創建索引以便查詢每日發送統計
        op.create_index(
            'ix_otp_send_logs_daily',
            'otp_send_logs',
            ['phone_number', 'created_at']
        )


def downgrade() -> None:
    op.drop_index('ix_otp_send_logs_daily', 'otp_send_logs')
    op.drop_table('otp_send_logs')
    op.drop_table('two_factor_auth')
    op.drop_index('ix_phone_verifications_phone', 'phone_verifications')
    op.drop_table('phone_verifications')
