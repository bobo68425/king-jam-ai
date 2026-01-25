"""
WordPress 整合 API

功能：
- WordPress 站點連接管理
- 文章發布（草稿、排程、立即發布）
- 分類與標籤管理
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import and_
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import json

from app.database import get_db
from app.models import User, SocialAccount, ScheduledPost, PublishLog
from app.routers.auth import get_current_user
from app.services.social_platforms.wordpress import (
    WordPressService,
    WordPressConfig,
    WordPressPostStatus,
    create_wordpress_service
)

router = APIRouter(prefix="/wordpress", tags=["WordPress Integration"])


# ============================================================
# Schemas
# ============================================================

class WordPressSiteConnect(BaseModel):
    """WordPress 站點連接請求"""
    site_url: str = Field(..., description="WordPress 網站網址", example="https://example.com")
    username: str = Field(..., description="使用者名稱")
    app_password: str = Field(..., description="應用程式密碼 (Application Password)")


class WordPressSiteResponse(BaseModel):
    """WordPress 站點回應"""
    id: int
    site_url: str
    site_name: Optional[str] = None
    username: str
    avatar_url: Optional[str] = None
    is_active: bool
    last_sync_at: Optional[datetime] = None
    created_at: datetime
    ga4_property_id: Optional[str] = None

    class Config:
        from_attributes = True


class WordPressPublishRequest(BaseModel):
    """WordPress 發布請求"""
    title: str = Field(..., description="文章標題")
    content: str = Field(..., description="文章內容 (HTML)")
    excerpt: str = Field("", description="摘要")
    status: str = Field("draft", description="發布狀態: draft, publish, future")
    categories: List[str] = Field(default=[], description="分類名稱列表")
    tags: List[str] = Field(default=[], description="標籤名稱列表")
    featured_image_url: Optional[str] = Field(None, description="特色圖片 URL")
    scheduled_at: Optional[datetime] = Field(None, description="排程發布時間")


class WordPressPublishResponse(BaseModel):
    """WordPress 發布回應"""
    success: bool
    post_id: Optional[int] = None
    post_url: Optional[str] = None
    error_message: Optional[str] = None


class CategoryResponse(BaseModel):
    """分類回應"""
    id: int
    name: str
    slug: str
    count: int = 0


class TagResponse(BaseModel):
    """標籤回應"""
    id: int
    name: str
    slug: str
    count: int = 0


# ============================================================
# Helper Functions
# ============================================================

def get_wordpress_service(account: SocialAccount) -> WordPressService:
    """從 SocialAccount 建立 WordPress 服務"""
    if account.platform != "wordpress":
        raise HTTPException(status_code=400, detail="非 WordPress 帳號")
    
    # 解析儲存的設定
    settings = account.extra_settings or {}
    site_url = settings.get("site_url") or account.platform_username
    username = settings.get("username", "")
    app_password = account.access_token
    
    if not all([site_url, username, app_password]):
        raise HTTPException(status_code=400, detail="WordPress 設定不完整")
    
    return create_wordpress_service(site_url, username, app_password)


# ============================================================
# 站點連接 API
# ============================================================

@router.post("/connect", response_model=WordPressSiteResponse)
async def connect_wordpress_site(
    request: WordPressSiteConnect,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    連接 WordPress 站點
    
    使用 Application Password 進行認證：
    1. 在 WordPress 後台 → 使用者 → 編輯個人資料 → 應用程式密碼
    2. 輸入名稱，點擊「新增應用程式密碼」
    3. 複製產生的密碼（只會顯示一次）
    """
    # 1. 清理輸入
    site_url = request.site_url.strip().rstrip("/")
    username = request.username.strip()
    # 應用程式密碼保留空格（WordPress 格式為 "xxxx xxxx xxxx xxxx"）
    app_password = request.app_password.strip()
    
    # 確保 URL 格式正確
    if not site_url.startswith("http"):
        site_url = "https://" + site_url
    
    print(f"[WordPress Connect] Site: {site_url}")
    print(f"[WordPress Connect] Username: {username}")
    print(f"[WordPress Connect] Password length: {len(app_password)}")
    
    # 2. 驗證連線
    wp_service = create_wordpress_service(
        site_url=site_url,
        username=username,
        app_password=app_password
    )
    
    try:
        verify_result = await wp_service.verify_connection()
    finally:
        await wp_service.close()
    
    if not verify_result.get("success"):
        error_msg = verify_result.get('error', '未知錯誤')
        print(f"[WordPress Connect] Failed: {error_msg}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    # 3. 檢查是否已存在相同站點
    existing = db.query(SocialAccount).filter(
        and_(
            SocialAccount.user_id == current_user.id,
            SocialAccount.platform == "wordpress",
            SocialAccount.platform_username == site_url
        )
    ).first()
    
    if existing:
        # 更新現有連線
        existing.access_token = app_password
        existing.platform_avatar = verify_result.get("user_avatar")
        existing.is_active = True
        existing.last_sync_at = datetime.utcnow()
        
        # 儲存額外設定
        extra_settings = existing.extra_settings or {}
        extra_settings.update({
            "site_url": site_url,
            "site_name": verify_result.get("site_name"),
            "username": username,
            "user_id": verify_result.get("user_id"),
        })
        existing.extra_settings = extra_settings
        
        db.commit()
        db.refresh(existing)
        
        return WordPressSiteResponse(
            id=existing.id,
            site_url=site_url,
            site_name=verify_result.get("site_name"),
            username=username,
            avatar_url=verify_result.get("user_avatar"),
            is_active=True,
            last_sync_at=existing.last_sync_at,
            created_at=existing.created_at
        )
    
    # 4. 建立新連線
    new_account = SocialAccount(
        user_id=current_user.id,
        platform="wordpress",
        platform_user_id=str(verify_result.get("user_id")),
        platform_username=site_url,  # 用 site_url 作為唯一識別
        platform_avatar=verify_result.get("user_avatar"),
        access_token=app_password,
        is_active=True,
        last_sync_at=datetime.utcnow()
    )
    
    db.add(new_account)
    db.commit()
    db.refresh(new_account)
    
    # 儲存額外設定到 JSON 欄位
    new_account.extra_settings = {
        "site_url": site_url,
        "site_name": verify_result.get("site_name"),
        "username": username,
        "user_id": verify_result.get("user_id"),
    }
    db.commit()
    
    return WordPressSiteResponse(
        id=new_account.id,
        site_url=site_url,
        site_name=verify_result.get("site_name"),
        username=username,
        avatar_url=verify_result.get("user_avatar"),
        is_active=True,
        last_sync_at=new_account.last_sync_at,
        created_at=new_account.created_at
    )


@router.get("/sites", response_model=List[WordPressSiteResponse])
async def get_wordpress_sites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取得已連接的 WordPress 站點列表"""
    accounts = db.query(SocialAccount).filter(
        and_(
            SocialAccount.user_id == current_user.id,
            SocialAccount.platform == "wordpress"
        )
    ).all()
    
    result = []
    for account in accounts:
        extra = account.extra_settings or {}
        result.append(WordPressSiteResponse(
            id=account.id,
            site_url=extra.get("site_url", account.platform_username),
            site_name=extra.get("site_name"),
            username=extra.get("username", ""),
            avatar_url=account.platform_avatar,
            is_active=account.is_active,
            last_sync_at=account.last_sync_at,
            created_at=account.created_at,
            ga4_property_id=extra.get("ga4_property_id")
        ))
    
    return result


@router.delete("/sites/{site_id}")
async def disconnect_wordpress_site(
    site_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """斷開 WordPress 站點連接"""
    account = db.query(SocialAccount).filter(
        and_(
            SocialAccount.id == site_id,
            SocialAccount.user_id == current_user.id,
            SocialAccount.platform == "wordpress"
        )
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="站點不存在")
    
    db.delete(account)
    db.commit()
    
    return {"message": "已斷開連接"}


@router.post("/sites/{site_id}/verify")
async def verify_wordpress_site(
    site_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """驗證 WordPress 站點連線狀態"""
    account = db.query(SocialAccount).filter(
        and_(
            SocialAccount.id == site_id,
            SocialAccount.user_id == current_user.id,
            SocialAccount.platform == "wordpress"
        )
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="站點不存在")
    
    extra = account.extra_settings or {}
    site_url = extra.get("site_url", account.platform_username)
    username = extra.get("username", "")
    
    wp_service = create_wordpress_service(
        site_url=site_url,
        username=username,
        app_password=account.access_token
    )
    
    try:
        result = await wp_service.verify_connection()
    finally:
        await wp_service.close()
    
    if result.get("success"):
        account.is_active = True
        account.last_sync_at = datetime.utcnow()
        db.commit()
        return {"status": "connected", "details": result}
    else:
        account.is_active = False
        db.commit()
        return {"status": "disconnected", "error": result.get("error")}


# ============================================================
# 文章發布 API
# ============================================================

@router.post("/sites/{site_id}/publish", response_model=WordPressPublishResponse)
async def publish_to_wordpress(
    site_id: int,
    request: WordPressPublishRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    發布文章到 WordPress
    
    支援三種發布模式：
    - draft: 儲存為草稿
    - publish: 立即發布
    - future: 排程發布（需提供 scheduled_at）
    """
    account = db.query(SocialAccount).filter(
        and_(
            SocialAccount.id == site_id,
            SocialAccount.user_id == current_user.id,
            SocialAccount.platform == "wordpress"
        )
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="站點不存在")
    
    if not account.is_active:
        raise HTTPException(status_code=400, detail="站點連線已失效，請重新連接")
    
    extra = account.extra_settings or {}
    site_url = extra.get("site_url", account.platform_username)
    username = extra.get("username", "")
    
    wp_service = create_wordpress_service(
        site_url=site_url,
        username=username,
        app_password=account.access_token
    )
    
    try:
        # 決定發布狀態
        status_map = {
            "draft": WordPressPostStatus.DRAFT,
            "publish": WordPressPostStatus.PUBLISH,
            "future": WordPressPostStatus.FUTURE,
            "pending": WordPressPostStatus.PENDING,
        }
        wp_status = status_map.get(request.status, WordPressPostStatus.DRAFT)
        
        # 發布文章
        result = await wp_service.publish_blog_post(
            title=request.title,
            content=request.content,
            excerpt=request.excerpt,
            category_names=request.categories if request.categories else None,
            tag_names=request.tags if request.tags else None,
            featured_image_url=request.featured_image_url,
            status=wp_status,
            scheduled_date=request.scheduled_at
        )
        
        # 如果發布成功且是立即發布，同步記錄到排程系統
        if result.success and request.status == "publish":
            try:
                # 建立已發布的排程記錄
                published_post = ScheduledPost(
                    user_id=current_user.id,
                    social_account_id=site_id,
                    content_type="blog_post",
                    title=request.title,
                    caption=request.excerpt or request.content[:500],
                    media_urls=[request.featured_image_url] if request.featured_image_url else [],
                    hashtags=request.tags or [],
                    scheduled_at=datetime.utcnow(),
                    timezone="Asia/Taipei",
                    status="published",
                    published_at=datetime.utcnow(),
                    platform_post_url=result.post_url,
                    settings={
                        "platform": "wordpress",
                        "wordpress_post_id": result.post_id,
                        "categories": request.categories,
                        "publish_type": "immediate",  # 標記為直接發布
                    }
                )
                db.add(published_post)
                db.flush()  # 先 flush 以獲取 published_post.id
                
                # 記錄發布日誌
                log = PublishLog(
                    scheduled_post_id=published_post.id,
                    action="published",
                    message=f"已成功發布到 WordPress: {result.post_url}"
                )
                db.add(log)
                db.commit()
                
                print(f"[WordPress] 已同步發布記錄到排程系統: post_id={published_post.id}")
            except Exception as e:
                print(f"[WordPress] 同步發布記錄失敗: {e}")
                # 不影響主要發布結果
        
        return WordPressPublishResponse(
            success=result.success,
            post_id=result.post_id,
            post_url=result.post_url,
            error_message=result.error_message
        )
        
    finally:
        await wp_service.close()


@router.post("/sites/{site_id}/schedule")
async def schedule_wordpress_post(
    site_id: int,
    request: WordPressPublishRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    排程發布到 WordPress（使用內部排程系統）
    
    這會將文章加入到排程佇列，在指定時間發布
    """
    if not request.scheduled_at:
        raise HTTPException(status_code=400, detail="需要提供排程時間")
    
    if request.scheduled_at <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="排程時間必須是未來時間")
    
    account = db.query(SocialAccount).filter(
        and_(
            SocialAccount.id == site_id,
            SocialAccount.user_id == current_user.id,
            SocialAccount.platform == "wordpress"
        )
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="站點不存在")
    
    # 建立排程記錄
    new_post = ScheduledPost(
        user_id=current_user.id,
        social_account_id=site_id,
        content_type="blog_post",
        title=request.title,
        caption=request.content,  # 存放完整 HTML 內容
        media_urls=[request.featured_image_url] if request.featured_image_url else [],
        hashtags=request.tags,
        scheduled_at=request.scheduled_at,
        timezone="Asia/Taipei",
        settings={
            "platform": "wordpress",
            "excerpt": request.excerpt,
            "categories": request.categories,
            "featured_image_url": request.featured_image_url,
            "publish_type": "scheduled",  # 標記為排程上架
        },
        status="pending"
    )
    
    db.add(new_post)
    db.commit()
    db.refresh(new_post)
    
    # 記錄日誌
    log = PublishLog(
        scheduled_post_id=new_post.id,
        action="created",
        message="WordPress 文章排程已建立"
    )
    db.add(log)
    db.commit()
    
    return {
        "success": True,
        "schedule_id": new_post.id,
        "scheduled_at": request.scheduled_at,
        "message": f"文章已排程於 {request.scheduled_at} 發布"
    }


# ============================================================
# 分類與標籤 API
# ============================================================

@router.get("/sites/{site_id}/categories", response_model=List[CategoryResponse])
async def get_wordpress_categories(
    site_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取得 WordPress 站點的分類列表"""
    account = db.query(SocialAccount).filter(
        and_(
            SocialAccount.id == site_id,
            SocialAccount.user_id == current_user.id,
            SocialAccount.platform == "wordpress"
        )
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="站點不存在")
    
    extra = account.extra_settings or {}
    site_url = extra.get("site_url", account.platform_username)
    username = extra.get("username", "")
    
    wp_service = create_wordpress_service(
        site_url=site_url,
        username=username,
        app_password=account.access_token
    )
    
    try:
        categories = await wp_service.get_categories()
        return [
            CategoryResponse(
                id=cat.id,
                name=cat.name,
                slug=cat.slug,
                count=cat.count
            )
            for cat in categories
        ]
    finally:
        await wp_service.close()


@router.get("/sites/{site_id}/tags", response_model=List[TagResponse])
async def get_wordpress_tags(
    site_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取得 WordPress 站點的標籤列表"""
    account = db.query(SocialAccount).filter(
        and_(
            SocialAccount.id == site_id,
            SocialAccount.user_id == current_user.id,
            SocialAccount.platform == "wordpress"
        )
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="站點不存在")
    
    extra = account.extra_settings or {}
    site_url = extra.get("site_url", account.platform_username)
    username = extra.get("username", "")
    
    wp_service = create_wordpress_service(
        site_url=site_url,
        username=username,
        app_password=account.access_token
    )
    
    try:
        tags = await wp_service.get_tags()
        return [
            TagResponse(
                id=tag.id,
                name=tag.name,
                slug=tag.slug,
                count=tag.count
            )
            for tag in tags
        ]
    finally:
        await wp_service.close()
