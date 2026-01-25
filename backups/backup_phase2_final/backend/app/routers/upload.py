"""
媒體上傳 API 端點
"""
import os
import uuid
import shutil
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import JSONResponse

from app.routers.auth import get_current_user
from app.models import User

router = APIRouter(prefix="/upload", tags=["upload"])

# 設定上傳目錄
UPLOAD_DIR = "/app/static/uploads"
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime", "video/mpeg"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


def ensure_upload_dir():
    """確保上傳目錄存在"""
    os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/media")
async def upload_media(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    上傳媒體文件（圖片或影片）
    
    - 支援格式: JPG, PNG, GIF, WebP, MP4, WebM
    - 最大文件大小: 50MB
    - 返回文件 URL
    """
    ensure_upload_dir()
    
    # 檢查文件類型
    content_type = file.content_type or ""
    if content_type not in ALLOWED_IMAGE_TYPES and content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"不支援的文件類型: {content_type}。支援的格式: JPG, PNG, GIF, WebP, MP4, WebM"
        )
    
    # 讀取文件內容並檢查大小
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"文件大小超過限制 (最大 {MAX_FILE_SIZE // 1024 // 1024}MB)"
        )
    
    # 生成唯一文件名
    ext = os.path.splitext(file.filename or "file")[1].lower() or (
        ".jpg" if content_type in ALLOWED_IMAGE_TYPES else ".mp4"
    )
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_id = uuid.uuid4().hex[:8]
    filename = f"{current_user.id}_{timestamp}_{unique_id}{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    # 保存文件
    try:
        with open(file_path, "wb") as f:
            f.write(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存文件失敗: {str(e)}")
    
    # 構建 URL
    url = f"/upload/media/{filename}"
    
    # 確定媒體類型
    media_type = "image" if content_type in ALLOWED_IMAGE_TYPES else "video"
    
    return {
        "success": True,
        "url": url,
        "filename": filename,
        "media_type": media_type,
        "size": len(contents),
        "content_type": content_type
    }


@router.get("/media/{filename}")
async def get_media(filename: str):
    """獲取上傳的媒體文件"""
    from fastapi.responses import FileResponse
    
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    # 安全檢查：確保文件在上傳目錄內
    real_path = os.path.realpath(file_path)
    if not real_path.startswith(os.path.realpath(UPLOAD_DIR)):
        raise HTTPException(status_code=403, detail="無權訪問此文件")
    
    return FileResponse(file_path)


@router.delete("/media/{filename}")
async def delete_media(
    filename: str,
    current_user: User = Depends(get_current_user)
):
    """刪除上傳的媒體文件"""
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    # 檢查文件是否屬於當前用戶
    if not filename.startswith(f"{current_user.id}_"):
        raise HTTPException(status_code=403, detail="無權刪除此文件")
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    try:
        os.remove(file_path)
        return {"success": True, "message": "文件已刪除"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"刪除文件失敗: {str(e)}")
