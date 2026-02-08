"""
直接 SQL 遷移（多個 Alembic heads 時由 GitHub Actions 呼叫）
需設定環境變數 DATABASE_URL。
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
            # NewebPay 欄位
            conn.execute(
                text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'newebpay_merchant_order_no') THEN
                        ALTER TABLE orders ADD COLUMN newebpay_merchant_order_no VARCHAR(30);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'newebpay_trade_no') THEN
                        ALTER TABLE orders ADD COLUMN newebpay_trade_no VARCHAR(30);
                    END IF;
                END $$;
                """)
            )
            conn.commit()
            # 訂閱方案年繳欄位（僅當表存在時）
            conn.execute(
                text("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscription_plans') THEN
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscription_plans' AND column_name = 'price_yearly') THEN
                            ALTER TABLE subscription_plans ADD COLUMN price_yearly NUMERIC(10, 2);
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscription_plans' AND column_name = 'yearly_discount_percent') THEN
                            ALTER TABLE subscription_plans ADD COLUMN yearly_discount_percent NUMERIC(5, 2);
                        END IF;
                    END IF;
                END $$;
                """)
            )
            conn.commit()
            # 僅當表存在且已有 price_monthly 時更新年繳預設值
            conn.execute(
                text("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscription_plans') THEN
                        UPDATE subscription_plans
                        SET price_yearly = ROUND(price_monthly * 12 * 0.8, 0), yearly_discount_percent = 20
                        WHERE plan_code IN ('basic', 'pro', 'enterprise') AND (price_yearly IS NULL OR yearly_discount_percent IS NULL);
                    END IF;
                END $$;
                """)
            )
            conn.commit()
        print("✅ SQL 遷移完成")
    except Exception as e:
        print(f"❌ 遷移失敗: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
