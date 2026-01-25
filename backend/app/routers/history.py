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
    """歷史紀錄回應"""
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
    created_at: datetime
    
    class Config:
        from_attributes = True


class HistoryListResponse(BaseModel):
    """歷史紀錄列表回應"""
    items: List[HistoryResponse]
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
    獲取生成歷史紀錄列表
    支援分頁和過濾
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
    
    return HistoryListResponse(
        items=items,
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
