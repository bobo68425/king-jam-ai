from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
import os

from app.routers import auth, social_auth, blog, social, video, scheduler, upload, oauth, history, tasks, credits, referral, verification, users, notifications, wordpress, admin, insights, analytics, queue_monitor, brand_kit, prompts, design_studio, payment, account, campaigns, admin_notifications, assistant, phone_verification

app = FastAPI(title="King Jam AI API", version="1.0.1")  # 2026-02-03 更新

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

origins = [
    "http://localhost:3000",  # Next.js 開發環境
    "http://localhost:3001",  # Next.js 開發環境 (備用 port)
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "https://kingjam.app",    # 正式網域
    "https://www.kingjam.app",
    "http://kingjam.app",
    "http://www.kingjam.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(social_auth.router)
app.include_router(blog.router)
app.include_router(social.router)
app.include_router(video.router)
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
        # 建立 subscription_plans 表（若不存在）
        db.execute(text("""
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
        db.commit()
        # 寫入預設訂閱方案（若不存在）
        db.execute(text("""
            INSERT INTO subscription_plans (plan_code, name, tier, price_monthly, monthly_credits, features, is_popular, sort_order, is_active, description)
            VALUES
                ('free',       '免費版', 'free',        0,    0, '["註冊贈送 100 點","基本 AI 文章生成","社群圖文設計"]',                          FALSE, 0, TRUE, '適合個人嘗試體驗'),
                ('basic',      '入門版', 'basic',     299,    0, '["基本功能無廣告","AI 文章生成","社群圖文設計","單平台發布","Email 客服支援"]',       FALSE, 1, TRUE, '適合輕度使用者'),
                ('pro',        '專業版', 'pro',       699, 1000, '["每月 1,000 點","全部 AI 功能解鎖","AI 短影片生成","智能排程發布","多平台同步","優先客服支援"]', TRUE,  2, TRUE, '適合自媒體創作者'),
                ('enterprise', '企業版', 'enterprise',3699, 5000, '["每月 5,000 點","全部專業版功能","API 存取權限","團隊協作功能","專屬客戶經理","客製化需求","優先技術支援","SLA 保證"]', FALSE, 3, TRUE, '適合品牌與團隊')
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
        db.close()
        print("[Startup] ✅ subscription_plans 已初始化")
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
    """手動觸發 DB 初始化（建表 + seed 訂閱方案）"""
    from app.database import SessionLocal
    from sqlalchemy import text
    results = []
    try:
        db = SessionLocal()
        db.execute(text("""
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
        db.commit()
        results.append("table created or exists")

        db.execute(text("""
            INSERT INTO subscription_plans (plan_code, name, tier, price_monthly, monthly_credits, features, is_popular, sort_order, is_active, description)
            VALUES
                ('free',       '免費版', 'free',        0,    0, '["註冊贈送 100 點","基本 AI 文章生成","社群圖文設計"]',                          FALSE, 0, TRUE, '適合個人嘗試體驗'),
                ('basic',      '入門版', 'basic',     299,    0, '["基本功能無廣告","AI 文章生成","社群圖文設計","單平台發布","Email 客服支援"]',       FALSE, 1, TRUE, '適合輕度使用者'),
                ('pro',        '專業版', 'pro',       699, 1000, '["每月 1,000 點","全部 AI 功能解鎖","AI 短影片生成","智能排程發布","多平台同步","優先客服支援"]', TRUE,  2, TRUE, '適合自媒體創作者'),
                ('enterprise', '企業版', 'enterprise',3699, 5000, '["每月 5,000 點","全部專業版功能","API 存取權限","團隊協作功能","專屬客戶經理","客製化需求","優先技術支援","SLA 保證"]', FALSE, 3, TRUE, '適合品牌與團隊')
            ON CONFLICT (plan_code) DO NOTHING;
        """))
        db.commit()
        results.append("plans seeded")

        db.execute(text("""
            UPDATE subscription_plans
            SET price_yearly = ROUND(price_monthly * 12 * 0.8, 0), yearly_discount_percent = 20
            WHERE plan_code IN ('basic','pro','enterprise') AND (price_yearly IS NULL OR yearly_discount_percent IS NULL);
        """))
        db.commit()
        results.append("yearly prices set")

        row = db.execute(text("SELECT count(*) FROM subscription_plans")).fetchone()
        count = row[0] if row else 0
        db.close()
        return {"status": "ok", "actions": results, "total_plans": count}
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
