from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
import logging
import os

from app.routers import auth, social_auth, blog, social, video, video_v3, scheduler, upload, oauth, history, tasks, credits, referral, verification, users, notifications, wordpress, admin, insights, analytics, queue_monitor, brand_kit, prompts, design_studio, payment, account, campaigns, admin_notifications, assistant, phone_verification, line_webhook, line_chat, funding

logger = logging.getLogger(__name__)

origins = [
    "http://localhost:3000",  # Next.js 開發環境
    "http://localhost:3001",  # Next.js 開發環境 (備用 port)
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "https://kingjam.app",    # 正式網域
    "https://www.kingjam.app",
    "http://kingjam.app",
    "http://www.kingjam.app",
    "https://kingjam-frontend-wck4tgzywa-de.a.run.app",  # Cloud Run staging
    "https://kingjam-api-wck4tgzywa-de.a.run.app",       # Cloud Run API (internal)
]

import sentry_sdk

app = FastAPI(title="King Jam AI API", version="1.0.6")  # Instagram Login, Meta Webhook

# ============================================================
# Sentry 錯誤監控初始化
# ============================================================
sentry_dsn = os.getenv("SENTRY_DSN")
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        traces_sample_rate=0.2,
        profiles_sample_rate=0.2,
    )
    logger.info("[Sentry] ✅ 已成功初始化 Sentry 錯誤監控")

def _cors_headers(origin: str):
    """回傳 CORS 標頭，確保錯誤回應也能被前端讀取"""
    if origin in origins:
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    return {}


class CORSEnforceMiddleware(BaseHTTPMiddleware):
    """確保所有回應都帶有 CORS 標頭（含 500 錯誤）"""
    async def dispatch(self, request, call_next):
        origin = request.headers.get("origin", "")
        try:
            response = await call_next(request)
            if origin and "Access-Control-Allow-Origin" not in response.headers:
                for k, v in _cors_headers(origin).items():
                    response.headers[k] = v
            return response
        except Exception as e:
            logger.exception(f"[CORSEnforce] 未處理的例外: {e}")
            return JSONResponse(
                status_code=500,
                content={"detail": str(e)},
                headers=_cors_headers(origin),
            )


# 先加入 CORS 補強（最先加入 = 最外層 = 最後處理 response）
app.add_middleware(CORSEnforceMiddleware)

# 全域例外處理：確保未處理的 500 錯誤也回傳 JSON 與 CORS 標頭
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    from fastapi import HTTPException
    if isinstance(exc, HTTPException):
        origin = request.headers.get("origin", "")
        # HTTPException 由 FastAPI 處理，補上 CORS 標頭
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=_cors_headers(origin),
        )
    origin = request.headers.get("origin", "")
    logger.exception(f"[Global] 未處理的例外: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers=_cors_headers(origin),
    )


# 添加 validation error 詳細日誌
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print(f"[Validation Error] URL: {request.url}")
    print(f"[Validation Error] Method: {request.method}")
    print(f"[Validation Error] Errors: {exc.errors()}")
    try:
        body = await request.body()
        print(f"[Validation Error] Body: {body.decode()[:500]}")
    except:
        pass
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()}
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gzip 壓縮 — 回應大於 500 bytes 時自動壓縮
app.add_middleware(GZipMiddleware, minimum_size=500)

app.include_router(auth.router)
app.include_router(social_auth.router)
app.include_router(blog.router)
app.include_router(social.router)
app.include_router(video.router)
try:
    app.include_router(video_v3.router)
except Exception as e:
    import traceback
    print(f"[main] ❌ video_v3 router failed: {e}")
    traceback.print_exc()
app.include_router(scheduler.router)
app.include_router(upload.router)
app.include_router(oauth.router)
app.include_router(history.router)
app.include_router(tasks.router)
app.include_router(credits.router)
app.include_router(referral.router)
app.include_router(verification.router)
app.include_router(users.router)
app.include_router(notifications.router)
app.include_router(wordpress.router)
app.include_router(admin.router)
app.include_router(insights.router)
app.include_router(analytics.router)
app.include_router(queue_monitor.router)
app.include_router(brand_kit.router)
app.include_router(prompts.router)
app.include_router(design_studio.router)
app.include_router(payment.router)
app.include_router(account.router)
app.include_router(campaigns.router)
app.include_router(admin_notifications.router)
app.include_router(assistant.router)
app.include_router(phone_verification.router)
app.include_router(line_webhook.router)
app.include_router(line_chat.router)
app.include_router(funding.router)

# 確保上傳目錄存在 - 支援 Docker 和本地開發
if os.path.exists("/app/static"):
    STATIC_DIR = "/app/static"
else:
    # 本地開發環境
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    STATIC_DIR = os.path.join(BASE_DIR, "static")

UPLOAD_DIR = os.path.join(STATIC_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "identity"), exist_ok=True)

# 靜態文件服務 - 用於提供上傳的媒體文件
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.on_event("startup")
def _auto_init_db():
    """後端啟動時自動確認核心表與資料存在"""
    from app.database import SessionLocal
    from sqlalchemy import text
    try:
        db = SessionLocal()

        # ── 1. subscription_plans 表 ──
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS subscription_plans (
                id SERIAL PRIMARY KEY,
                plan_code VARCHAR(50) NOT NULL UNIQUE,
                name VARCHAR(100) NOT NULL,
                tier VARCHAR(20) NOT NULL,
                price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
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
        db.commit()

        # 確保年繳欄位存在（表可能已存在但缺欄位）
        db.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscription_plans' AND column_name='price_yearly') THEN
                    ALTER TABLE subscription_plans ADD COLUMN price_yearly NUMERIC(10,2);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscription_plans' AND column_name='yearly_discount_percent') THEN
                    ALTER TABLE subscription_plans ADD COLUMN yearly_discount_percent NUMERIC(5,2);
                END IF;
            END $$;
        """))
        db.commit()

        # 寫入預設訂閱方案
        db.execute(text("""
            INSERT INTO subscription_plans (plan_code, name, tier, price_monthly, monthly_credits, features, is_popular, sort_order, is_active, description)
            VALUES
                ('free',       '免費版', 'free',        0,    0, '["註冊贈送 100 點","基本 AI 文章生成","社群圖文設計","洞察引擎（僅 WordPress）"]',                          FALSE, 0, TRUE, '適合個人嘗試體驗'),
                ('basic',      '入門版', 'basic',     299,  300, '["每月 300 點","基本功能無廣告","AI 文章生成","社群圖文設計","單平台發布","洞察引擎（僅 WordPress）","Email 客服支援"]',       FALSE, 1, TRUE, '適合輕度使用者'),
                ('pro',        '專業版', 'pro',       699, 1000, '["每月 1,000 點","全部 AI 功能解鎖","完整成效洞察引擎","GA4 流量分析整合","AI 短影片生成","智能排程發布","多平台同步","優先客服支援"]', TRUE,  2, TRUE, '適合自媒體創作者'),
                ('enterprise', '企業版', 'enterprise',3699, 5000, '["每月 5,000 點","全部專業版功能","完整成效洞察引擎","API 存取權限","團隊協作功能","專屬客戶經理","客製化需求","優先技術支援","SLA 保證"]', FALSE, 3, TRUE, '適合品牌與團隊')
            ON CONFLICT (plan_code) DO NOTHING;
        """))
        db.commit()

        # 年繳預設值
        db.execute(text("""
            UPDATE subscription_plans
            SET price_yearly = ROUND(price_monthly * 12 * 0.8, 0), yearly_discount_percent = 20
            WHERE plan_code IN ('basic','pro','enterprise') AND (price_yearly IS NULL OR yearly_discount_percent IS NULL);
        """))
        db.commit()
        # 入門版點數：確保 basic 為 300 點
        db.execute(text("""
            UPDATE subscription_plans SET monthly_credits = 300
            WHERE plan_code = 'basic';
        """))
        db.commit()
        print("[Startup] ✅ subscription_plans 已初始化")

        # ── 2. orders 表 ──
        db.execute(text("""
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
        db.commit()

        # orders 索引
        for idx_sql in [
            "CREATE INDEX IF NOT EXISTS idx_order_user ON orders(user_id);",
            "CREATE INDEX IF NOT EXISTS idx_order_status ON orders(status);",
            "CREATE INDEX IF NOT EXISTS idx_order_payment_provider ON orders(payment_provider);",
            "CREATE INDEX IF NOT EXISTS idx_order_created ON orders(created_at);",
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_orders_order_no ON orders(order_no);",
        ]:
            db.execute(text(idx_sql))
        db.commit()
        print("[Startup] ✅ orders 表已初始化")

        # ── 3. payment_logs 表 ──
        db.execute(text("""
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
        db.commit()

        for idx_sql in [
            "CREATE INDEX IF NOT EXISTS idx_payment_log_order ON payment_logs(order_id);",
            "CREATE INDEX IF NOT EXISTS idx_payment_log_created ON payment_logs(created_at);",
        ]:
            db.execute(text(idx_sql))
        db.commit()
        print("[Startup] ✅ payment_logs 表已初始化")

        # ── 4. 募資行銷活動表 ──
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS funding_projects (
                id SERIAL PRIMARY KEY,
                project_code VARCHAR(50) NOT NULL UNIQUE,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                target_plan_code VARCHAR(50) NOT NULL,
                subscription_months INTEGER NOT NULL DEFAULT 6,
                fundraising_platform VARCHAR(50),
                platform_url VARCHAR(255),
                is_active BOOLEAN DEFAULT TRUE,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ
            );
        """))
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS funding_tiers (
                id SERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL REFERENCES funding_projects(id) ON DELETE CASCADE,
                tier_code VARCHAR(50) NOT NULL,
                tier_name VARCHAR(100) NOT NULL,
                fundraising_price_twd NUMERIC(10,2) NOT NULL,
                original_price_twd NUMERIC(10,2),
                is_active BOOLEAN DEFAULT TRUE,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ
            );
        """))
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS sales_codes (
                id SERIAL PRIMARY KEY,
                code VARCHAR(32) NOT NULL UNIQUE,
                tier_id INTEGER NOT NULL REFERENCES funding_tiers(id) ON DELETE CASCADE,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                redeemer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                redeemed_at TIMESTAMPTZ,
                order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
                expires_at TIMESTAMPTZ,
                external_order_id VARCHAR(100),
                notes TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ
            );
        """))
        for idx_sql in [
            "CREATE INDEX IF NOT EXISTS ix_funding_projects_project_code ON funding_projects(project_code);",
            "CREATE INDEX IF NOT EXISTS ix_funding_tiers_project_id ON funding_tiers(project_id);",
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_code_code ON sales_codes(code);",
            "CREATE INDEX IF NOT EXISTS idx_sales_code_status ON sales_codes(status);",
            "CREATE INDEX IF NOT EXISTS idx_sales_code_tier ON sales_codes(tier_id);",
        ]:
            db.execute(text(idx_sql))
        db.commit()
        print("[Startup] ✅ funding_projects / funding_tiers / sales_codes 表已初始化")

        # 募資專案種子資料（若尚無專案則寫入）
        from app.models import FundingProject, FundingTier
        if db.query(FundingProject).count() == 0:
            FUNDING_DATA = [
                ("blogger", "部落客專案", "適合部落格寫作者", "basic", 6, [("super_early_bird", "超早鳥", 999, 1794), ("early_bird", "早鳥", 1299, 1794)]),
                ("self_media", "自媒體專案", "適合社群、影音創作者", "pro", 6, [("super_early_bird", "超早鳥", 2999, 4194), ("early_bird", "早鳥", 3499, 4194)]),
                ("super_editor", "超級小編專案", "適合一人多工小編", "pro", 6, [("super_early_bird", "超早鳥", 2999, 4194), ("early_bird", "早鳥", 3499, 4194)]),
                ("startup_boss", "新創老闆專案", "適合新創團隊", "enterprise", 6, [("super_early_bird", "超早鳥", 14999, 22194), ("early_bird", "早鳥", 18999, 22194)]),
            ]
            for sort, (code, name, desc, plan, months, tiers) in enumerate(FUNDING_DATA, 1):
                p = FundingProject(project_code=code, name=name, description=desc, target_plan_code=plan, subscription_months=months, sort_order=sort)
                db.add(p)
                db.flush()
                for j, (tcode, tname, price, orig) in enumerate(tiers, 1):
                    t = FundingTier(project_id=p.id, tier_code=tcode, tier_name=tname, fundraising_price_twd=price, original_price_twd=orig, sort_order=j)
                    db.add(t)
            db.commit()
            print("[Startup] ✅ 募資專案種子資料已寫入")

        # ── 5. users 表: 預付訂閱欄位（募資按月發放）
        db.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='prepaid_sub_months_remaining') THEN
                    ALTER TABLE users ADD COLUMN prepaid_sub_months_remaining INTEGER DEFAULT 0;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='prepaid_sub_credits_per_month') THEN
                    ALTER TABLE users ADD COLUMN prepaid_sub_credits_per_month INTEGER DEFAULT 0;
                END IF;
            END $$;
        """))
        db.commit()

        # ── 6. notifications 表: 建立與新增 priority 欄位 ──
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                notification_type VARCHAR(20) NOT NULL DEFAULT 'system',
                title VARCHAR(200) NOT NULL,
                message TEXT NOT NULL,
                data JSONB,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                read_at TIMESTAMPTZ,
                priority VARCHAR(20) NOT NULL DEFAULT 'general'
            );
        """))
        db.commit()
        db.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='priority') THEN
                    ALTER TABLE notifications ADD COLUMN priority VARCHAR(20) NOT NULL DEFAULT 'general';
                    CREATE INDEX IF NOT EXISTS idx_notification_priority ON notifications(priority);
                END IF;
            END $$;
        """))
        db.commit()
        print("[Startup] ✅ notifications.priority 欄位已確認")

        # ── 7. line_messages 表（LINE 客服對話）──
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS line_messages (
                id SERIAL PRIMARY KEY,
                line_user_id VARCHAR(50) NOT NULL,
                display_name VARCHAR(200),
                avatar_url VARCHAR(500),
                direction VARCHAR(10) NOT NULL,
                message_type VARCHAR(20) NOT NULL DEFAULT 'text',
                content TEXT,
                line_message_id VARCHAR(50),
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """))
        for idx_sql in [
            "CREATE INDEX IF NOT EXISTS idx_line_msg_user ON line_messages(line_user_id);",
            "CREATE INDEX IF NOT EXISTS idx_line_msg_created ON line_messages(created_at);",
            "CREATE INDEX IF NOT EXISTS idx_line_msg_user_created ON line_messages(line_user_id, created_at);",
            "CREATE INDEX IF NOT EXISTS idx_line_msg_unread ON line_messages(line_user_id, is_read);",
        ]:
            db.execute(text(idx_sql))
        db.commit()
        print("[Startup] ✅ line_messages 表已初始化")

        db.close()
    except Exception as e:
        print(f"[Startup] ⚠️ DB 自動初始化跳過: {e}")


@app.get("/")
def read_root():
    return {"message": "Welcome to King Jam AI - System Operational 🚀"}


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "backend"}


@app.get("/health/init-db")
def init_db_endpoint():
    """手動觸發 DB 初始化（建表 + seed）"""
    from app.database import SessionLocal
    from sqlalchemy import text
    results = []
    try:
        db = SessionLocal()

        # subscription_plans
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS subscription_plans (
                id SERIAL PRIMARY KEY,
                plan_code VARCHAR(50) NOT NULL UNIQUE,
                name VARCHAR(100) NOT NULL,
                tier VARCHAR(20) NOT NULL,
                price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
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
        db.commit()
        results.append("subscription_plans ok")

        # 確保年繳欄位存在
        db.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscription_plans' AND column_name='price_yearly') THEN
                    ALTER TABLE subscription_plans ADD COLUMN price_yearly NUMERIC(10,2);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscription_plans' AND column_name='yearly_discount_percent') THEN
                    ALTER TABLE subscription_plans ADD COLUMN yearly_discount_percent NUMERIC(5,2);
                END IF;
            END $$;
        """))
        db.commit()
        results.append("yearly columns ok")

        db.execute(text("""
            INSERT INTO subscription_plans (plan_code, name, tier, price_monthly, monthly_credits, features, is_popular, sort_order, is_active, description)
            VALUES
                ('free',       '免費版', 'free',        0,    0, '["註冊贈送 100 點","基本 AI 文章生成","社群圖文設計","洞察引擎（僅 WordPress）"]',                          FALSE, 0, TRUE, '適合個人嘗試體驗'),
                ('basic',      '入門版', 'basic',     299,  300, '["每月 300 點","基本功能無廣告","AI 文章生成","社群圖文設計","單平台發布","洞察引擎（僅 WordPress）","Email 客服支援"]',       FALSE, 1, TRUE, '適合輕度使用者'),
                ('pro',        '專業版', 'pro',       699, 1000, '["每月 1,000 點","全部 AI 功能解鎖","完整成效洞察引擎","GA4 流量分析整合","AI 短影片生成","智能排程發布","多平台同步","優先客服支援"]', TRUE,  2, TRUE, '適合自媒體創作者'),
                ('enterprise', '企業版', 'enterprise',3699, 5000, '["每月 5,000 點","全部專業版功能","完整成效洞察引擎","API 存取權限","團隊協作功能","專屬客戶經理","客製化需求","優先技術支援","SLA 保證"]', FALSE, 3, TRUE, '適合品牌與團隊')
            ON CONFLICT (plan_code) DO NOTHING;
        """))
        db.commit()
        results.append("plans seeded")

        db.execute(text("""
            UPDATE subscription_plans
            SET price_yearly = ROUND(price_monthly * 12 * 0.8, 0), yearly_discount_percent = 20
            WHERE plan_code IN ('basic','pro','enterprise') AND (price_yearly IS NULL OR yearly_discount_percent IS NULL);
        """))
        db.execute(text("UPDATE subscription_plans SET monthly_credits = 300 WHERE plan_code = 'basic';"))
        db.commit()
        results.append("yearly prices ok")

        # orders
        db.execute(text("""
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
        db.commit()
        for idx_sql in [
            "CREATE INDEX IF NOT EXISTS idx_order_user ON orders(user_id);",
            "CREATE INDEX IF NOT EXISTS idx_order_status ON orders(status);",
            "CREATE INDEX IF NOT EXISTS idx_order_payment_provider ON orders(payment_provider);",
            "CREATE INDEX IF NOT EXISTS idx_order_created ON orders(created_at);",
        ]:
            db.execute(text(idx_sql))
        db.commit()
        results.append("orders ok")

        # payment_logs
        try:
            db.execute(text("""
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
            db.commit()
            results.append("payment_logs ok")
        except Exception as e:
            db.rollback()
            results.append(f"payment_logs error: {e}")

        # users.prepaid_sub
        try:
            db.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='prepaid_sub_months_remaining') THEN
                        ALTER TABLE users ADD COLUMN prepaid_sub_months_remaining INTEGER DEFAULT 0;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='prepaid_sub_credits_per_month') THEN
                        ALTER TABLE users ADD COLUMN prepaid_sub_credits_per_month INTEGER DEFAULT 0;
                    END IF;
                END $$;
            """))
            db.commit()
            results.append("users.prepaid_sub ok")
        except Exception as e:
            db.rollback()
            results.append(f"users.prepaid_sub error: {e}")

        # notifications (建立資料表 + 確保 priority 欄位)
        try:
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS notifications (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    notification_type VARCHAR(20) NOT NULL DEFAULT 'system',
                    title VARCHAR(200) NOT NULL,
                    message TEXT NOT NULL,
                    data JSONB,
                    is_read BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    read_at TIMESTAMPTZ,
                    priority VARCHAR(20) NOT NULL DEFAULT 'general'
                );
            """))
            db.commit()
            
            db.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='priority') THEN
                        ALTER TABLE notifications ADD COLUMN priority VARCHAR(20) NOT NULL DEFAULT 'general';
                        CREATE INDEX IF NOT EXISTS idx_notification_priority ON notifications(priority);
                    END IF;
                END $$;
            """))
            db.commit()
            results.append("notifications.priority ok")
        except Exception as e:
            db.rollback()
            results.append(f"notifications.priority error: {e}")

        row = db.execute(text("SELECT count(*) FROM subscription_plans")).fetchone()
        plan_count = row[0] if row else 0
        row2 = db.execute(text("SELECT count(*) FROM orders")).fetchone()
        order_count = row2[0] if row2 else 0
        db.close()
        return {"status": "ok", "actions": results, "total_plans": plan_count, "total_orders": order_count}
    except Exception as e:
        return {"status": "error", "actions": results, "error": str(e)}


@app.get("/health/db")
def health_check_db():
    """健康檢查（含資料庫連線），用於排查 DB 連線問題"""
    import os as _os
    from app.database import SessionLocal
    db_url = _os.getenv("DATABASE_URL", "(not set)")
    # 遮蔽密碼
    safe_url = db_url
    if "@" in db_url:
        parts = db_url.split("@", 1)
        user_part = parts[0].rsplit(":", 1)
        safe_url = user_part[0] + ":***@" + parts[1]
    try:
        db = SessionLocal()
        db.execute(__import__("sqlalchemy").text("SELECT 1"))
        db.close()
        return {"status": "ok", "db": "connected", "database_url": safe_url}
    except Exception as e:
        return {"status": "error", "db": "failed", "database_url": safe_url, "error": str(e)}

# Redeployed on Wed Feb  4 00:14:11 CST 2026


# ============================================================
# 內建排程掃描器（不依賴 Celery — 直接在 FastAPI process 內執行）
# ============================================================
import asyncio

async def _scan_and_publish_pending():
    """掃描並發布待排程的貼文（每 5 分鐘一次）"""
    import pytz
    from datetime import datetime, timedelta
    from app.database import SessionLocal
    from app.models import ScheduledPost, PublishLog, SocialAccount
    from sqlalchemy import and_

    while True:
        try:
            await asyncio.sleep(300)  # 每 5 分鐘
            print("[InProcessScheduler] 🔍 掃描待發布排程...")

            db = SessionLocal()
            try:
                now = datetime.now(pytz.UTC)
                buffer_time = now + timedelta(minutes=5)

                pending_posts = db.query(ScheduledPost).filter(
                    ScheduledPost.status.in_(["pending", "queued"]),
                    ScheduledPost.scheduled_at <= buffer_time
                ).all()

                if not pending_posts:
                    print("[InProcessScheduler] ✅ 無待發布排程")
                    continue

                print(f"[InProcessScheduler] 📋 找到 {len(pending_posts)} 個待發布排程")

                for post in pending_posts:
                    try:
                        # 取得社群帳號
                        if not post.social_account_id:
                            print(f"[InProcessScheduler] ⚠️ 排程 #{post.id} 無綁定社群帳號，跳過")
                            post.status = "failed"
                            post.error_message = "未綁定社群帳號"
                            db.commit()
                            continue

                        social_account = db.query(SocialAccount).filter(
                            SocialAccount.id == post.social_account_id
                        ).first()

                        if not social_account or not social_account.is_active:
                            post.status = "failed"
                            post.error_message = "社群帳號不存在或已停用"
                            db.commit()
                            continue

                        # 更新狀態
                        post.status = "publishing"
                        db.commit()

                        # 取得發布器
                        from app.tasks.scheduler_tasks import get_platform_publisher, _get_best_content_type
                        from app.services.social_platforms.base import PublishContent, ContentType

                        platform_publisher = get_platform_publisher(social_account.platform, account=social_account)
                        if not platform_publisher:
                            post.status = "published"
                            post.published_at = datetime.utcnow()
                            log = PublishLog(
                                scheduled_post_id=post.id, action="published",
                                message=f"已記錄（{social_account.platform} 自動發布尚未實作）"
                            )
                            db.add(log)
                            db.commit()
                            print(f"[InProcessScheduler] ⚠️ 排程 #{post.id}: {social_account.platform} 無發布器")
                            continue

                        # 準備內容
                        publish_content_type = _get_best_content_type(
                            platform=social_account.platform,
                            content_type=post.content_type,
                            has_media=bool(post.media_urls)
                        )
                        content = PublishContent(
                            content_type=publish_content_type,
                            caption=post.caption or "",
                            media_urls=post.media_urls or [],
                            hashtags=post.hashtags or [],
                        )

                        # 執行發布
                        print(f"[InProcessScheduler] 🚀 發布排程 #{post.id}: platform={social_account.platform}")
                        result = await platform_publisher.publish(
                            access_token=social_account.access_token,
                            content=content
                        )

                        if result.success:
                            post.status = "published"
                            post.published_at = datetime.utcnow()
                            post.platform_post_id = result.platform_post_id
                            post.platform_post_url = result.platform_post_url
                            log = PublishLog(
                                scheduled_post_id=post.id, action="published",
                                message=f"發布成功 → {social_account.platform}",
                                details={"platform": social_account.platform}
                            )
                            db.add(log)
                            print(f"[InProcessScheduler] ✅ 排程 #{post.id} 發布成功")
                        else:
                            post.status = "failed"
                            post.error_message = result.error_message
                            log = PublishLog(
                                scheduled_post_id=post.id, action="error",
                                message=f"發布失敗: {result.error_message[:200]}"
                            )
                            db.add(log)
                            print(f"[InProcessScheduler] ❌ 排程 #{post.id} 發布失敗: {result.error_message}")

                        db.commit()

                    except Exception as post_err:
                        print(f"[InProcessScheduler] ❌ 排程 #{post.id} 例外: {post_err}")
                        try:
                            post.status = "failed"
                            post.error_message = str(post_err)[:500]
                            db.commit()
                        except Exception:
                            db.rollback()

            finally:
                db.close()

        except Exception as e:
            print(f"[InProcessScheduler] ❌ 掃描迴圈例外: {e}")
            await asyncio.sleep(60)  # 出錯後等 1 分鐘再試


@app.on_event("startup")
async def _start_in_process_scheduler():
    """啟動內建排程掃描器"""
    print("[InProcessScheduler] 🟢 啟動內建排程掃描器（每 5 分鐘）")
    asyncio.create_task(_scan_and_publish_pending())
