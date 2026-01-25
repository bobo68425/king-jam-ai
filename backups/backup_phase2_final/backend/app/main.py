from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
import os

from app.routers import auth, social_auth, blog, social, video, scheduler, upload, oauth, history

app = FastAPI(title="King Jam AI API", version="1.0.0")

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
    "http://localhost:3000",  # Next.js 前端網址
    "http://127.0.0.1:3000",
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

# 確保上傳目錄存在
UPLOAD_DIR = "/app/static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 靜態文件服務 - 用於提供上傳的媒體文件
app.mount("/static", StaticFiles(directory="/app/static"), name="static")


@app.get("/")
def read_root():
    return {"message": "Welcome to King Jam AI - System Operational 🚀"}


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "backend"}
