from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, social_auth, blog, social, video

app = FastAPI(title="King Jam AI API", version="1.0.0")

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


@app.get("/")
def read_root():
    return {"message": "Welcome to King Jam AI - System Operational 🚀"}


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "backend"}
