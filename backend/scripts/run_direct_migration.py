"""
直接 SQL 遷移（由 GitHub Actions 呼叫）
需設定環境變數 DATABASE_URL。

功能：
1. 建立 subscription_plans 表（若不存在）
2. 寫入預設訂閱方案（free / basic / pro / enterprise）
3. 加年繳欄位與預設值
4. orders 表加 NewebPay 欄位
"""
import os
import sys
from sqlalchemy import create_engine, text


def main():
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("❌ DATABASE_URL 未設定", file=sys.stderr)
        sys.exit(1)
    engine = create_engine(dsn)
    try:
        with engine.connect() as conn:
            # ── 1. 建立 subscription_plans 表 ──
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS subscription_plans (
                    id SERIAL PRIMARY KEY,
                    plan_code VARCHAR(50) NOT NULL UNIQUE,
                    name VARCHAR(100) NOT NULL,
                    tier VARCHAR(20) NOT NULL,
                    price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
                    price_yearly NUMERIC(10,2),
                    yearly_discount_percent NUMERIC(5,2),
                    monthly_credits INTEGER NOT NULL DEFAULT 0,
                    features JSONB DEFAULT '[]',
                    is_popular BOOLEAN DEFAULT FALSE,
                    sort_order INTEGER DEFAULT 0,
                    is_active BOOLEAN DEFAULT TRUE,
                    description TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ
                );
            """))
            conn.commit()
            print("  ✅ subscription_plans 表已確認")

            # ── 2. 寫入預設訂閱方案（若不存在） ──
            conn.execute(text("""
                INSERT INTO subscription_plans (plan_code, name, tier, price_monthly, monthly_credits, features, is_popular, sort_order, is_active, description)
                VALUES
                    ('free',       '免費版', 'free',       0,    0,    '["註冊贈送 100 點","基本 AI 文章生成","社群圖文設計"]',                          FALSE, 0, TRUE, '適合個人嘗試體驗'),
                    ('basic',      '入門版', 'basic',    299,  300,    '["每月 300 點","基本功能無廣告","AI 文章生成","社群圖文設計","單平台發布","洞察引擎（僅 WordPress）","Email 客服支援"]',       FALSE, 1, TRUE, '適合輕度使用者'),
                    ('pro',        '專業版', 'pro',      699, 1000,    '["每月 1,000 點","全部 AI 功能解鎖","AI 短影片生成","智能排程發布","多平台同步","優先客服支援"]', TRUE, 2, TRUE, '適合自媒體創作者'),
                    ('enterprise', '企業版', 'enterprise',3699, 5000,  '["每月 5,000 點","全部專業版功能","API 存取權限","團隊協作功能","專屬客戶經理","客製化需求","優先技術支援","SLA 保證"]', FALSE, 3, TRUE, '適合品牌與團隊')
                ON CONFLICT (plan_code) DO NOTHING;
            """))
            conn.commit()
            print("  ✅ 訂閱方案預設資料已確認")

            # ── 3. 年繳欄位與預設值 ──
            conn.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subscription_plans' AND column_name='price_yearly') THEN
                        ALTER TABLE subscription_plans ADD COLUMN price_yearly NUMERIC(10,2);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subscription_plans' AND column_name='yearly_discount_percent') THEN
                        ALTER TABLE subscription_plans ADD COLUMN yearly_discount_percent NUMERIC(5,2);
                    END IF;
                END $$;
            """))
            conn.commit()
            conn.execute(text("""
                UPDATE subscription_plans
                SET price_yearly = ROUND(price_monthly * 12 * 0.8, 0), yearly_discount_percent = 20
                WHERE plan_code IN ('basic','pro','enterprise') AND (price_yearly IS NULL OR yearly_discount_percent IS NULL);
            """))
            conn.commit()
            print("  ✅ 年繳欄位與預設值已確認")

            # ── 4. orders 表（完整建立） ──
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS orders (
                    id SERIAL PRIMARY KEY,
                    order_no VARCHAR(50) NOT NULL UNIQUE,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    order_type VARCHAR(20) NOT NULL,
                    item_code VARCHAR(50) NOT NULL,
                    item_name VARCHAR(100) NOT NULL,
                    item_description TEXT,
                    quantity INTEGER DEFAULT 1,
                    unit_price NUMERIC(10,2) NOT NULL,
                    total_amount NUMERIC(10,2) NOT NULL,
                    currency VARCHAR(3) DEFAULT 'TWD',
                    subscription_months INTEGER,
                    credits_amount INTEGER,
                    bonus_credits INTEGER,
                    payment_provider VARCHAR(20),
                    payment_method VARCHAR(50),
                    provider_order_id VARCHAR(100),
                    provider_transaction_id VARCHAR(100),
                    provider_response JSONB,
                    stripe_payment_intent_id VARCHAR(100),
                    stripe_checkout_session_id VARCHAR(100),
                    stripe_subscription_id VARCHAR(100),
                    ecpay_merchant_trade_no VARCHAR(20),
                    ecpay_trade_no VARCHAR(20),
                    newebpay_merchant_order_no VARCHAR(30),
                    newebpay_trade_no VARCHAR(30),
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    paid_at TIMESTAMPTZ,
                    completed_at TIMESTAMPTZ,
                    refund_amount NUMERIC(10,2),
                    refund_reason TEXT,
                    refunded_at TIMESTAMPTZ,
                    referrer_id INTEGER REFERENCES users(id),
                    referral_bonus NUMERIC(10,2),
                    referral_processed BOOLEAN DEFAULT FALSE,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ,
                    expires_at TIMESTAMPTZ
                );
            """))
            conn.commit()
            for idx_sql in [
                "CREATE INDEX IF NOT EXISTS idx_order_user ON orders(user_id);",
                "CREATE INDEX IF NOT EXISTS idx_order_status ON orders(status);",
                "CREATE INDEX IF NOT EXISTS idx_order_payment_provider ON orders(payment_provider);",
                "CREATE INDEX IF NOT EXISTS idx_order_created ON orders(created_at);",
            ]:
                conn.execute(text(idx_sql))
            conn.commit()
            print("  ✅ orders 表已確認")

            # ── 5. payment_logs 表 ──
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS payment_logs (
                    id SERIAL PRIMARY KEY,
                    order_id INTEGER NOT NULL REFERENCES orders(id),
                    action VARCHAR(50) NOT NULL,
                    status_before VARCHAR(20),
                    status_after VARCHAR(20),
                    provider VARCHAR(20),
                    provider_response JSONB,
                    message TEXT,
                    extra_data JSONB,
                    ip_address VARCHAR(45),
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
            """))
            conn.commit()
            print("  ✅ payment_logs 表已確認")

        print("✅ 全部遷移完成")
    except Exception as e:
        print(f"❌ 遷移失敗: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
