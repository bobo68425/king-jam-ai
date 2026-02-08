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


@app.get("/")
def read_root():
    return {"message": "Welcome to King Jam AI - System Operational 🚀"}


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "backend"}


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
