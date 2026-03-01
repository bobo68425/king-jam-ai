"""
生成歷史紀錄 API
取代 LocalStorage，提供完整的資料持久化和稽核功能
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.models import User, GenerationHistory
from app.routers.auth import get_current_user

router = APIRouter(prefix="/history", tags=["Generation History"])


# ============================================================
# Schemas
# ============================================================

class HistoryCreate(BaseModel):
    """創建歷史紀錄"""
    generation_type: str  # social_image, short_video, blog_post
    status: str = "completed"
    input_params: dict = {}
    output_data: dict = {}
    media_local_path: Optional[str] = None
    media_cloud_url: Optional[str] = None
    media_cloud_key: Optional[str] = None
    thumbnail_url: Optional[str] = None
    credits_used: int = 0
    error_message: Optional[str] = None
    error_details: dict = {}
    generation_duration_ms: Optional[int] = None
    file_size_bytes: Optional[int] = None


class HistoryUpdate(BaseModel):
    """更新歷史紀錄（例如：上傳雲端後更新 URL）"""
    status: Optional[str] = None
    media_cloud_url: Optional[str] = None
    media_cloud_key: Optional[str] = None
    media_cloud_provider: Optional[str] = None
    thumbnail_url: Optional[str] = None
    error_message: Optional[str] = None
    error_details: Optional[dict] = None


class HistoryResponse(BaseModel):
    """歷史紀錄回應（完整版，用於單筆查詢）"""
    id: int
    user_id: int
    generation_type: str
    status: str
    input_params: dict
    output_data: dict
    media_local_path: Optional[str]
    media_cloud_url: Optional[str]
    media_cloud_key: Optional[str]
    thumbnail_url: Optional[str]
    credits_used: int
    error_message: Optional[str]
    generation_duration_ms: Optional[int]
    file_size_bytes: Optional[int]
    
    # Tracking fields
    fb_pixel_id: Optional[str] = None
    ga_measurement_id: Optional[str] = None
    custom_script: Optional[str] = None
    
    created_at: datetime
    
    class Config:
        from_attributes = True


class HistoryListItem(BaseModel):
    """歷史紀錄列表項目（輕量版，不含 base64 圖片資料）"""
    id: int
    user_id: int
    generation_type: str
    status: str
    input_params: dict
    # output_data 不在列表回傳 —— 可能包含巨大的 base64 圖片
    # 僅回傳 caption 等輕量文字資訊
    output_caption: Optional[str] = None
    media_local_path: Optional[str]
    media_cloud_url: Optional[str]  # 會被清理，不回傳 base64
    media_cloud_key: Optional[str]
    thumbnail_url: Optional[str]
    credits_used: int
    error_message: Optional[str]
    generation_duration_ms: Optional[int]
    file_size_bytes: Optional[int]
    created_at: datetime
    # 分組鍵：同一組的紀錄共享相同 group_key（例如 blog_post + blog_image）
    group_key: Optional[str] = None


class HistoryListResponse(BaseModel):
    """歷史紀錄列表回應"""
    items: List[HistoryListItem]
    total: int
    page: int
    page_size: int
    has_more: bool


class HistoryStats(BaseModel):
    """統計資訊"""
    total_generations: int
    total_credits_used: int
    by_type: dict  # {"social_image": 10, "short_video": 5, ...}
    by_status: dict  # {"completed": 14, "failed": 1}

class TrackingUpdate(BaseModel):
    """更新追蹤設定"""
    fb_pixel_id: Optional[str] = None
    ga_measurement_id: Optional[str] = None
    custom_script: Optional[str] = None

class PublicHistoryResponse(BaseModel):
    """公開歷史紀錄回應（隱藏 user_id 與 input 等敏感細節）"""
    id: int
    generation_type: str
    output_data: dict
    media_cloud_url: Optional[str]
    thumbnail_url: Optional[str]
    fb_pixel_id: Optional[str] = None
    ga_measurement_id: Optional[str] = None
    custom_script: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# ============================================================
# API Endpoints
# ============================================================

@router.post("", response_model=HistoryResponse)
async def create_history(
    data: HistoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    創建生成歷史紀錄
    每次生成內容後調用，用於記錄和稽核
    """
    history = GenerationHistory(
        user_id=current_user.id,
        generation_type=data.generation_type,
        status=data.status,
        input_params=data.input_params,
        output_data=data.output_data,
        media_local_path=data.media_local_path,
        media_cloud_url=data.media_cloud_url,
        media_cloud_key=data.media_cloud_key,
        thumbnail_url=data.thumbnail_url,
        credits_used=data.credits_used,
        error_message=data.error_message,
        error_details=data.error_details,
        generation_duration_ms=data.generation_duration_ms,
        file_size_bytes=data.file_size_bytes,
    )
    
    db.add(history)
    db.commit()
    db.refresh(history)
    
    return history


@router.get("", response_model=HistoryListResponse)
async def list_history(
    generation_type: Optional[str] = Query(None, description="過濾類型: social_image, short_video, blog_post"),
    status: Optional[str] = Query(None, description="過濾狀態: completed, failed, processing"),
    page: int = Query(1, ge=1, description="頁碼"),
    page_size: int = Query(20, ge=1, le=100, description="每頁數量"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取生成歷史紀錄列表（輕量版）
    不回傳 output_data 以避免巨大的 base64 圖片資料拖慢回應
    """
    query = db.query(GenerationHistory).filter(
        GenerationHistory.user_id == current_user.id,
        GenerationHistory.is_deleted == False
    )
    
    if generation_type:
        query = query.filter(GenerationHistory.generation_type == generation_type)
    
    if status:
        query = query.filter(GenerationHistory.status == status)
    
    # 計算總數
    total = query.count()
    
    # 分頁查詢
    items = query.order_by(desc(GenerationHistory.created_at)) \
                 .offset((page - 1) * page_size) \
                 .limit(page_size) \
                 .all()
    
    # 轉為輕量回應：不含巨大的 output_data，且清理 base64 data URL
    light_items = []
    for item in items:
        # 提取 caption（從 output_data 中提取文字，不含圖片）
        output = item.output_data or {}
        input_p = item.input_params or {}
        caption = output.get("caption", "")
        
        # 清理 media_cloud_url：如果是 base64 data URL 則替換為空
        cloud_url = item.media_cloud_url
        if cloud_url and cloud_url.startswith("data:"):
            cloud_url = None  # base64 不是有效的雲端 URL
        
        # 計算 group_key：讓同一次生成的圖、影、文能被前端分組
        group_key = None
        if item.generation_type in ("blog_post", "blog_image"):
            post_id = output.get("post_id") or input_p.get("post_id")
            if post_id:
                group_key = f"blog_{post_id}"
        elif item.generation_type in ("video_script", "short_video"):
            project_id = output.get("project_id") or input_p.get("project_id")
            if project_id:
                group_key = f"video_{project_id}"
        # 沒有 group_key 的紀錄各自獨立
        
        light_items.append(HistoryListItem(
            id=item.id,
            user_id=item.user_id,
            generation_type=item.generation_type,
            status=item.status,
            input_params=input_p,
            output_caption=caption,
            media_local_path=item.media_local_path,
            media_cloud_url=cloud_url,
            media_cloud_key=item.media_cloud_key,
            thumbnail_url=item.thumbnail_url,
            credits_used=item.credits_used,
            error_message=item.error_message,
            generation_duration_ms=item.generation_duration_ms,
            file_size_bytes=item.file_size_bytes,
            created_at=item.created_at,
            group_key=group_key,
        ))
    
    return HistoryListResponse(
        items=light_items,
        total=total,
        page=page,
        page_size=page_size,
        has_more=(page * page_size) < total
    )


@router.get("/stats", response_model=HistoryStats)
async def get_history_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取生成統計資訊
    用於儀表板展示
    """
    from sqlalchemy import func
    
    base_query = db.query(GenerationHistory).filter(
        GenerationHistory.user_id == current_user.id,
        GenerationHistory.is_deleted == False
    )
    
    # 總生成數
    total_generations = base_query.count()
    
    # 總消耗點數
    total_credits = db.query(func.sum(GenerationHistory.credits_used)).filter(
        GenerationHistory.user_id == current_user.id,
        GenerationHistory.is_deleted == False
    ).scalar() or 0
    
    # 按類型統計
    type_stats = db.query(
        GenerationHistory.generation_type,
        func.count(GenerationHistory.id)
    ).filter(
        GenerationHistory.user_id == current_user.id,
        GenerationHistory.is_deleted == False
    ).group_by(GenerationHistory.generation_type).all()
    
    by_type = {t: c for t, c in type_stats}
    
    # 按狀態統計
    status_stats = db.query(
        GenerationHistory.status,
        func.count(GenerationHistory.id)
    ).filter(
        GenerationHistory.user_id == current_user.id,
        GenerationHistory.is_deleted == False
    ).group_by(GenerationHistory.status).all()
    
    by_status = {s: c for s, c in status_stats}
    
    return HistoryStats(
        total_generations=total_generations,
        total_credits_used=total_credits,
        by_type=by_type,
        by_status=by_status
    )


@router.get("/{history_id}", response_model=HistoryResponse)
async def get_history(
    history_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取單筆歷史紀錄詳情
    """
    history = db.query(GenerationHistory).filter(
        GenerationHistory.id == history_id,
        GenerationHistory.user_id == current_user.id,
        GenerationHistory.is_deleted == False
    ).first()
    
    if not history:
        raise HTTPException(status_code=404, detail="紀錄不存在")
    
    return history


@router.patch("/{history_id}", response_model=HistoryResponse)
async def update_history(
    history_id: int,
    data: HistoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    更新歷史紀錄
    例如：上傳到雲端後更新 URL
    """
    history = db.query(GenerationHistory).filter(
        GenerationHistory.id == history_id,
        GenerationHistory.user_id == current_user.id,
        GenerationHistory.is_deleted == False
    ).first()
    
    if not history:
        raise HTTPException(status_code=404, detail="紀錄不存在")
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(history, key, value)
    
    db.commit()
    db.refresh(history)
    
    return history


@router.delete("/{history_id}")
async def delete_history(
    history_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    軟刪除歷史紀錄
    資料仍保留用於稽核，只是不再顯示給用戶
    """
    history = db.query(GenerationHistory).filter(
        GenerationHistory.id == history_id,
        GenerationHistory.user_id == current_user.id,
        GenerationHistory.is_deleted == False
    ).first()
    
    if not history:
        raise HTTPException(status_code=404, detail="紀錄不存在")
    
    history.is_deleted = True
    history.deleted_at = datetime.utcnow()
    
    db.commit()
    
    return {"message": "紀錄已刪除"}


# ============================================================
# 管理員專用 API（用於客訴查證）
# ============================================================

@router.get("/admin/search")
async def admin_search_history(
    user_id: Optional[int] = None,
    customer_id: Optional[str] = None,
    generation_type: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    管理員搜尋歷史紀錄
    用於客訴查證和稽核
    TODO: 加入管理員權限檢查
    """
    # 暫時檢查是否為管理員（之後可以改用角色系統）
    if current_user.tier != "admin" and current_user.email != "admin@kingjam.ai":
        raise HTTPException(status_code=403, detail="需要管理員權限")
    
    query = db.query(GenerationHistory)
    
    if user_id:
        query = query.filter(GenerationHistory.user_id == user_id)
    
    if customer_id:
        # 透過 customer_id 查找用戶
        user = db.query(User).filter(User.customer_id == customer_id).first()
        if user:
            query = query.filter(GenerationHistory.user_id == user.id)
        else:
            return {"items": [], "total": 0}
    
    if generation_type:
        query = query.filter(GenerationHistory.generation_type == generation_type)
    
    if status:
        query = query.filter(GenerationHistory.status == status)
    
    if start_date:
        query = query.filter(GenerationHistory.created_at >= start_date)
    
    if end_date:
        query = query.filter(GenerationHistory.created_at <= end_date)
    
    total = query.count()
    
    items = query.order_by(desc(GenerationHistory.created_at)) \
                 .offset((page - 1) * page_size) \
                 .limit(page_size) \
                 .all()
    
    return {
        "items": [
            {
                "id": h.id,
                "user_id": h.user_id,
                "generation_type": h.generation_type,
                "status": h.status,
                "credits_used": h.credits_used,
                "error_message": h.error_message,
                "created_at": h.created_at,
                "is_deleted": h.is_deleted,
            }
            for h in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size
    }

# ============================================================
# Public API (無須驗證)
# ============================================================

@router.get("/public/{history_id}", response_model=PublicHistoryResponse)
async def get_public_history(
    history_id: int,
    db: Session = Depends(get_db)
):
    """
    取得公開的影片/紀錄資料 (不需驗證，用於 /v/[id] 播放頁面)
    """
    history = db.query(GenerationHistory).filter(
        GenerationHistory.id == history_id,
        GenerationHistory.is_deleted == False
    ).first()
    
    if not history:
        raise HTTPException(status_code=404, detail="內容不存在或已被移除")
        
    return history

# ============================================================
# Tracking 追蹤設定 API
# ============================================================
import bleach

@router.get("/{history_id}/tracking", response_model=TrackingUpdate)
async def get_tracking_settings(
    history_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    取得影片/渲染紀錄的追蹤設定 (Pixel IDs 和自訂追蹤腳本)
    """
    history = db.query(GenerationHistory).filter(
        GenerationHistory.id == history_id,
        GenerationHistory.user_id == current_user.id,
        GenerationHistory.is_deleted == False
    ).first()
    
    if not history:
        raise HTTPException(status_code=404, detail="紀錄不存在")
        
    return {
        "fb_pixel_id": history.fb_pixel_id,
        "ga_measurement_id": history.ga_measurement_id,
        "custom_script": history.custom_script
    }

@router.put("/{history_id}/tracking", response_model=TrackingUpdate)
async def update_tracking_settings(
    history_id: int,
    data: TrackingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    更新影片/渲染紀錄的追蹤設定
    對 custom_script 實施 XSS 清理保護，防止惡意攻擊
    """
    history = db.query(GenerationHistory).filter(
        GenerationHistory.id == history_id,
        GenerationHistory.user_id == current_user.id,
        GenerationHistory.is_deleted == False
    ).first()
    
    if not history:
        raise HTTPException(status_code=404, detail="紀錄不存在")
        
    # XSS Sanitization for custom_script
    if data.custom_script is not None:
        if data.custom_script.strip() == "":
            history.custom_script = ""
        else:
            # 放行標準的 script 和 noscript，供 GA / FB Pixel 使用
            # 移除惡意的 onEvent 綁定如 onload, onerror 避免直接注入攻擊
            allowed_tags = ['script', 'noscript', 'img', 'iframe', 'div']
            allowed_attributes = {
                'script': ['src', 'type', 'async', 'defer', 'charset', 'id', 'crossorigin'],
                'noscript': [],
                'img': ['src', 'height', 'width', 'style', 'alt'],
                'iframe': ['src', 'height', 'width', 'style', 'frameborder'],
                'div': ['id', 'class', 'style']
            }
            # bleach 用於清除危險的 DOM XSS 標籤，保留合理範圍內的追蹤標籤
            sanitized_script = bleach.clean(
                data.custom_script,
                tags=allowed_tags,
                attributes=allowed_attributes,
                strip=True
            )
            history.custom_script = sanitized_script
    
    # 儲存純粹的 ID
    if data.fb_pixel_id is not None:
        # 強制清理掉不小心貼上的 script 標籤，只保留數字字元
        import re
        clean_fb_id = re.sub(r'[^\d]', '', data.fb_pixel_id)
        history.fb_pixel_id = clean_fb_id if clean_fb_id else None
        
    if data.ga_measurement_id is not None:
        # GA4 ID 格式為 G-XXXXXXX
        import re
        clean_ga_id = re.sub(r'[^a-zA-Z0-9-]', '', data.ga_measurement_id).upper()
        history.ga_measurement_id = clean_ga_id if clean_ga_id else None
        
    db.commit()
    db.refresh(history)
    
    return {
        "fb_pixel_id": history.fb_pixel_id,
        "ga_measurement_id": history.ga_measurement_id,
        "custom_script": history.custom_script
    }
