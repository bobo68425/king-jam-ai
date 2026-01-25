"""
媒體上傳 API 端點
"""
import os
import uuid
import shutil
import base64
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.routers.auth import get_current_user
from app.models import User

router = APIRouter(prefix="/upload", tags=["upload"])

# 設定上傳目錄
UPLOAD_DIR = "/app/static/uploads"
SCENE_IMAGES_DIR = "/app/static/uploads/scenes"
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime", "video/mpeg"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
MAX_SCENE_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB per scene image


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


# ============================================================
# 場景圖片上傳 API - 用於自訂影片場景
# ============================================================

def ensure_scene_images_dir():
    """確保場景圖片目錄存在"""
    os.makedirs(SCENE_IMAGES_DIR, exist_ok=True)


@router.post("/scene-image")
async def upload_scene_image(
    file: UploadFile = File(...),
    scene_index: int = Form(0),
    project_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    """
    上傳單一場景圖片
    
    - scene_index: 場景編號 (0-based)
    - project_id: 專案 ID（可選，用於關聯）
    - 支援格式: JPG, PNG, WebP
    - 最大文件大小: 10MB
    - 返回可用於影片生成的圖片資訊
    """
    ensure_scene_images_dir()
    
    # 檢查文件類型
    content_type = file.content_type or ""
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"不支援的圖片格式: {content_type}。支援: JPG, PNG, GIF, WebP"
        )
    
    # 讀取文件並檢查大小
    contents = await file.read()
    if len(contents) > MAX_SCENE_IMAGE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"圖片大小超過限制 (最大 {MAX_SCENE_IMAGE_SIZE // 1024 // 1024}MB)"
        )
    
    # 生成唯一文件名
    ext = os.path.splitext(file.filename or "image")[1].lower() or ".jpg"
    if ext not in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
        ext = ".jpg"
    
    proj_id = project_id or uuid.uuid4().hex[:8]
    filename = f"{current_user.id}_{proj_id}_scene{scene_index}{ext}"
    file_path = os.path.join(SCENE_IMAGES_DIR, filename)
    
    # 保存文件
    try:
        with open(file_path, "wb") as f:
            f.write(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存圖片失敗: {str(e)}")
    
    # 構建 URL 和 Base64
    url = f"/upload/scene-image/{filename}"
    base64_data = f"data:{content_type};base64,{base64.b64encode(contents).decode()}"
    
    return {
        "success": True,
        "scene_index": scene_index,
        "project_id": proj_id,
        "url": url,
        "filename": filename,
        "base64": base64_data,
        "size": len(contents),
        "content_type": content_type
    }


@router.post("/scene-images")
async def upload_scene_images(
    files: List[UploadFile] = File(...),
    project_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    """
    批次上傳多個場景圖片
    
    - 按上傳順序作為場景 1, 2, 3...
    - 支援格式: JPG, PNG, WebP
    - 每張最大 10MB
    - 返回所有圖片的資訊列表
    """
    ensure_scene_images_dir()
    
    if len(files) > 10:
        raise HTTPException(
            status_code=400,
            detail="最多只能上傳 10 張場景圖片"
        )
    
    proj_id = project_id or uuid.uuid4().hex[:8]
    results = []
    
    for i, file in enumerate(files):
        content_type = file.content_type or ""
        if content_type not in ALLOWED_IMAGE_TYPES:
            results.append({
                "success": False,
                "scene_index": i,
                "error": f"不支援的格式: {content_type}"
            })
            continue
        
        contents = await file.read()
        if len(contents) > MAX_SCENE_IMAGE_SIZE:
            results.append({
                "success": False,
                "scene_index": i,
                "error": "圖片太大 (最大 10MB)"
            })
            continue
        
        # 生成文件名
        ext = os.path.splitext(file.filename or "image")[1].lower() or ".jpg"
        if ext not in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
            ext = ".jpg"
        
        filename = f"{current_user.id}_{proj_id}_scene{i}{ext}"
        file_path = os.path.join(SCENE_IMAGES_DIR, filename)
        
        try:
            with open(file_path, "wb") as f:
                f.write(contents)
            
            url = f"/upload/scene-image/{filename}"
            base64_data = f"data:{content_type};base64,{base64.b64encode(contents).decode()}"
            
            results.append({
                "success": True,
                "scene_index": i,
                "url": url,
                "filename": filename,
                "base64": base64_data,
                "size": len(contents)
            })
        except Exception as e:
            results.append({
                "success": False,
                "scene_index": i,
                "error": str(e)
            })
    
    return {
        "project_id": proj_id,
        "total": len(files),
        "success_count": sum(1 for r in results if r.get("success")),
        "images": results
    }


@router.get("/scene-image/{filename}")
async def get_scene_image(filename: str):
    """獲取場景圖片"""
    from fastapi.responses import FileResponse
    
    file_path = os.path.join(SCENE_IMAGES_DIR, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="圖片不存在")
    
    # 安全檢查
    real_path = os.path.realpath(file_path)
    if not real_path.startswith(os.path.realpath(SCENE_IMAGES_DIR)):
        raise HTTPException(status_code=403, detail="無權訪問")
    
    return FileResponse(file_path)


@router.delete("/scene-images/{project_id}")
async def delete_scene_images(
    project_id: str,
    current_user: User = Depends(get_current_user)
):
    """刪除專案的所有場景圖片"""
    ensure_scene_images_dir()
    
    prefix = f"{current_user.id}_{project_id}_scene"
    deleted = []
    
    for filename in os.listdir(SCENE_IMAGES_DIR):
        if filename.startswith(prefix):
            try:
                os.remove(os.path.join(SCENE_IMAGES_DIR, filename))
                deleted.append(filename)
            except:
                pass
    
    return {
        "success": True,
        "deleted_count": len(deleted),
        "deleted_files": deleted
    }
