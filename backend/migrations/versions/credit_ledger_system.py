"""Add credit ledger system

Revision ID: credit_ledger_001
Revises: b2c3d4e5f6g7_add_generation_history
Create Date: 2026-01-11

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'credit_ledger_001'
down_revision = 'b2c3d4e5f6g7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 建立點數交易記錄表
    op.create_table(
        'credit_transactions',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('transaction_type', sa.String(50), nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('balance_before', sa.Integer(), nullable=False),
        sa.Column('balance_after', sa.Integer(), nullable=False),
        sa.Column('reference_type', sa.String(50), nullable=True),
        sa.Column('reference_id', sa.Integer(), nullable=True),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('extra_data', sa.JSON(), default=dict),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
        sa.CheckConstraint('amount != 0', name='ck_amount_not_zero'),
    )
    
    # 建立索引
    op.create_index(
        'idx_credit_tx_user_created',
        'credit_transactions',
        ['user_id', 'created_at']
    )
    op.create_index(
        'idx_credit_tx_type',
        'credit_transactions',
        ['transaction_type']
    )
    op.create_index(
        'idx_credit_tx_ref',
        'credit_transactions',
        ['reference_type', 'reference_id']
    )
    
    # 建立點數定價表
    op.create_table(
        'credit_pricing',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('feature_code', sa.String(50), nullable=False, unique=True),
        sa.Column('feature_name', sa.String(100), nullable=False),
        sa.Column('tier', sa.String(20), nullable=True),
        sa.Column('credits_cost', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    
    op.create_index(
        'idx_pricing_feature_tier',
        'credit_pricing',
        ['feature_code', 'tier']
    )
    
    # 建立點數方案表
    op.create_table(
        'credit_packages',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('package_code', sa.String(50), nullable=False, unique=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('credits_amount', sa.Integer(), nullable=False),
        sa.Column('bonus_credits', sa.Integer(), default=0),
        sa.Column('price_twd', sa.Numeric(10, 2), nullable=False),
        sa.Column('original_price_twd', sa.Numeric(10, 2), nullable=True),
        sa.Column('validity_days', sa.Integer(), nullable=True),
        sa.Column('is_popular', sa.Boolean(), default=False),
        sa.Column('sort_order', sa.Integer(), default=0),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    
    # 插入預設定價
    op.execute("""
        INSERT INTO credit_pricing (feature_code, feature_name, credits_cost, is_active, description) VALUES
        ('social_image_basic', '社群圖文（基本）', 5, true, '基本社群圖文生成'),
        ('social_image_premium', '社群圖文（進階）', 10, true, '進階社群圖文生成，含高品質圖片'),
        ('blog_post_basic', '部落格文章（基本）', 10, true, '基本部落格文章生成'),
        ('blog_post_premium', '部落格文章（進階）', 20, true, '進階部落格文章生成，含 SEO 優化'),
        ('short_video_basic', '短影片（基本）', 20, true, '基本短影片生成'),
        ('short_video_premium', '短影片（進階）', 40, true, '進階短影片生成，含特效'),
        ('veo_video_8s', 'Veo 影片（8 秒）', 100, true, 'Veo 2.0 AI 影片生成（8 秒）'),
        ('veo_video_15s', 'Veo 影片（15 秒）', 180, true, 'Veo 2.0 AI 影片生成（15 秒）'),
        ('veo_video_30s', 'Veo 影片（30 秒）', 300, true, 'Veo 2.0 AI 影片生成（30 秒）')
    """)
    
    # 插入預設點數方案
    op.execute("""
        INSERT INTO credit_packages (package_code, name, credits_amount, bonus_credits, price_twd, original_price_twd, is_popular, sort_order, description) VALUES
        ('starter', '入門方案', 100, 0, 99, null, false, 1, '適合初次體驗'),
        ('basic', '基本方案', 300, 30, 249, 299, false, 2, '適合輕度使用'),
        ('standard', '標準方案', 600, 100, 449, 549, true, 3, '最受歡迎的選擇'),
        ('pro', '專業方案', 1500, 300, 999, 1299, false, 4, '適合重度使用'),
        ('enterprise', '企業方案', 5000, 1500, 2999, 4499, false, 5, '適合團隊使用')
    """)


def downgrade() -> None:
    op.drop_table('credit_packages')
    op.drop_table('credit_pricing')
    op.drop_table('credit_transactions')
