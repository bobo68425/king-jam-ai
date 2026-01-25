"""add credit consistency constraints

Revision ID: credit_constraints_001
Revises: fraud_detection_001
Create Date: 2026-01-14

新增資料庫層級的點數一致性保護：
1. CHECK 約束確保類別總和 = 總餘額
2. 觸發器在每次更新時驗證一致性
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'credit_constraints_001'
down_revision = 'fraud_detection_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 0. 先修復現有數據的不一致問題
    # 將 credits 更新為各類別的總和
    op.execute("""
        UPDATE users 
        SET credits = COALESCE(credits_promo, 0) + 
                      COALESCE(credits_sub, 0) + 
                      COALESCE(credits_paid, 0) + 
                      COALESCE(credits_bonus, 0)
        WHERE credits IS DISTINCT FROM (
            COALESCE(credits_promo, 0) + 
            COALESCE(credits_sub, 0) + 
            COALESCE(credits_paid, 0) + 
            COALESCE(credits_bonus, 0)
        )
    """)
    
    # 1. 新增 CHECK 約束：確保各類別餘額都不為負
    # 注意：PostgreSQL 使用 op.execute 執行原生 SQL
    
    # 確保各類別餘額 >= 0
    op.execute("""
        ALTER TABLE users 
        ADD CONSTRAINT chk_credits_promo_non_negative 
        CHECK (COALESCE(credits_promo, 0) >= 0)
    """)
    
    op.execute("""
        ALTER TABLE users 
        ADD CONSTRAINT chk_credits_sub_non_negative 
        CHECK (COALESCE(credits_sub, 0) >= 0)
    """)
    
    op.execute("""
        ALTER TABLE users 
        ADD CONSTRAINT chk_credits_paid_non_negative 
        CHECK (COALESCE(credits_paid, 0) >= 0)
    """)
    
    op.execute("""
        ALTER TABLE users 
        ADD CONSTRAINT chk_credits_bonus_non_negative 
        CHECK (COALESCE(credits_bonus, 0) >= 0)
    """)
    
    op.execute("""
        ALTER TABLE users 
        ADD CONSTRAINT chk_credits_total_non_negative 
        CHECK (COALESCE(credits, 0) >= 0)
    """)
    
    # 2. 新增 CHECK 約束：確保類別總和 = 總餘額
    # 這是最重要的約束，防止帳務不平
    op.execute("""
        ALTER TABLE users 
        ADD CONSTRAINT chk_credits_category_sum_equals_total
        CHECK (
            COALESCE(credits, 0) = 
            COALESCE(credits_promo, 0) + 
            COALESCE(credits_sub, 0) + 
            COALESCE(credits_paid, 0) + 
            COALESCE(credits_bonus, 0)
        )
    """)
    
    # 3. 建立觸發器函數：在更新 credits 相關欄位時記錄日誌
    op.execute("""
        CREATE OR REPLACE FUNCTION log_credit_changes()
        RETURNS TRIGGER AS $$
        BEGIN
            -- 只在點數相關欄位有變化時觸發
            IF (OLD.credits IS DISTINCT FROM NEW.credits) OR
               (OLD.credits_promo IS DISTINCT FROM NEW.credits_promo) OR
               (OLD.credits_sub IS DISTINCT FROM NEW.credits_sub) OR
               (OLD.credits_paid IS DISTINCT FROM NEW.credits_paid) OR
               (OLD.credits_bonus IS DISTINCT FROM NEW.credits_bonus) THEN
                
                -- 記錄到 PostgreSQL 日誌（可供審計）
                RAISE NOTICE 'Credit change for user %: total % -> %, promo % -> %, sub % -> %, paid % -> %, bonus % -> %',
                    NEW.id,
                    OLD.credits, NEW.credits,
                    OLD.credits_promo, NEW.credits_promo,
                    OLD.credits_sub, NEW.credits_sub,
                    OLD.credits_paid, NEW.credits_paid,
                    OLD.credits_bonus, NEW.credits_bonus;
            END IF;
            
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # 4. 建立觸發器
    op.execute("""
        DROP TRIGGER IF EXISTS trg_log_credit_changes ON users;
        CREATE TRIGGER trg_log_credit_changes
        AFTER UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION log_credit_changes();
    """)
    
    # 5. 在 credit_transactions 表新增索引以加速一致性查詢
    # 使用 IF NOT EXISTS 避免重複建立
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_credit_transactions_user_category
        ON credit_transactions (user_id, credit_category)
    """)
    
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_credit_transactions_created_at
        ON credit_transactions (created_at)
    """)


def downgrade() -> None:
    # 移除索引
    op.execute("DROP INDEX IF EXISTS ix_credit_transactions_created_at")
    op.execute("DROP INDEX IF EXISTS ix_credit_transactions_user_category")
    
    # 移除觸發器
    op.execute("DROP TRIGGER IF EXISTS trg_log_credit_changes ON users")
    op.execute("DROP FUNCTION IF EXISTS log_credit_changes()")
    
    # 移除約束
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_credits_category_sum_equals_total")
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_credits_total_non_negative")
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_credits_bonus_non_negative")
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_credits_paid_non_negative")
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_credits_sub_non_negative")
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_credits_promo_non_negative")
