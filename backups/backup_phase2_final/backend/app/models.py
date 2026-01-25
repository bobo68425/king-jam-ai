from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(String, unique=True, index=True, nullable=True)  # 客戶編號，用於行銷追蹤
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)
    full_name = Column(String, nullable=True)
    provider = Column(String, default="local")
    social_id = Column(String, nullable=True, index=True)
    is_active = Column(Boolean, default=True)
    tier = Column(String, default="free")
    credits = Column(Integer, default=100)
    referral_code = Column(String, unique=True, nullable=True)  # 推薦碼
    referred_by = Column(String, nullable=True)  # 被誰推薦（存推薦碼）
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # --- 關聯 ---
    posts = relationship("Post", back_populates="owner")
    social_accounts = relationship("SocialAccount", back_populates="owner")
    scheduled_posts = relationship("ScheduledPost", back_populates="owner")


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    content = Column(Text)
    status = Column(String, default="draft")  # draft, published
    
    user_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="posts")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# ============================================================
# 第二階段：排程上架引擎
# ============================================================

class SocialAccount(Base):
    """用戶連結的社群帳號"""
    __tablename__ = "social_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # 平台資訊
    platform = Column(String, nullable=False)  # instagram, facebook, tiktok, linkedin, threads, youtube, xiaohongshu
    platform_user_id = Column(String, nullable=True)  # 平台上的用戶 ID
    platform_username = Column(String, nullable=True)  # 平台上的用戶名稱
    platform_avatar = Column(String, nullable=True)  # 頭像 URL
    
    # OAuth 認證
    access_token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=True)
    token_expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # 狀態
    is_active = Column(Boolean, default=True)
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User", back_populates="social_accounts")
    scheduled_posts = relationship("ScheduledPost", back_populates="social_account")


class ScheduledPost(Base):
    """排程發布的內容"""
    __tablename__ = "scheduled_posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    social_account_id = Column(Integer, ForeignKey("social_accounts.id"), nullable=True)
    
    # 內容類型
    content_type = Column(String, nullable=False)  # social_image, blog_post, short_video
    
    # 發布內容
    title = Column(String, nullable=True)
    caption = Column(Text, nullable=True)  # 文案
    media_urls = Column(JSON, default=list)  # 圖片/影片 URL 列表
    hashtags = Column(JSON, default=list)  # Hashtag 列表
    
    # 排程設定
    scheduled_at = Column(DateTime(timezone=True), nullable=False, index=True)
    timezone = Column(String, default="Asia/Taipei")
    
    # 發布狀態
    status = Column(String, default="pending", index=True)  # pending, queued, publishing, published, failed, cancelled
    
    # 發布結果
    published_at = Column(DateTime(timezone=True), nullable=True)
    platform_post_id = Column(String, nullable=True)  # 發布後平台返回的貼文 ID
    platform_post_url = Column(String, nullable=True)  # 發布後的貼文連結
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    
    # 額外設定
    settings = Column(JSON, default=dict)  # 平台特定設定
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User", back_populates="scheduled_posts")
    social_account = relationship("SocialAccount", back_populates="scheduled_posts")
    publish_logs = relationship("PublishLog", back_populates="scheduled_post")


class PublishLog(Base):
    """發布日誌記錄"""
    __tablename__ = "publish_logs"

    id = Column(Integer, primary_key=True, index=True)
    scheduled_post_id = Column(Integer, ForeignKey("scheduled_posts.id"), nullable=False)
    
    # 操作類型
    action = Column(String, nullable=False)  # created, queued, publishing, published, failed, retried, cancelled
    
    # 詳細資訊
    message = Column(Text, nullable=True)
    details = Column(JSON, default=dict)  # 額外資訊
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    scheduled_post = relationship("ScheduledPost", back_populates="publish_logs")


# ============================================================
# 生成歷史紀錄（資料持久化）
# ============================================================

class GenerationHistory(Base):
    """
    生成歷史紀錄 - 取代 LocalStorage
    用於稽核、客訴查證、資產管理
    """
    __tablename__ = "generation_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # 生成類型
    generation_type = Column(String, nullable=False, index=True)  # social_image, short_video, blog_post
    
    # 生成狀態
    status = Column(String, default="completed", index=True)  # pending, processing, completed, failed
    
    # 生成參數（輸入）
    input_params = Column(JSON, default=dict)  # 存儲所有輸入參數
    # 例如：{
    #   "topic": "新品上市",
    #   "platform": "instagram",
    #   "quality": "premium",
    #   "duration": "15",
    #   "aspect_ratio": "9:16",
    #   ...
    # }
    
    # 生成結果（輸出）
    output_data = Column(JSON, default=dict)  # 存儲生成結果
    # 例如：{
    #   "caption": "...",
    #   "hashtags": [...],
    #   "script": {...},
    #   ...
    # }
    
    # 媒體資產 - 本地路徑
    media_local_path = Column(String, nullable=True)  # /app/static/videos/xxx.mp4
    
    # 媒體資產 - 雲端儲存（R2/S3）
    media_cloud_url = Column(String, nullable=True)  # https://xxx.r2.cloudflarestorage.com/xxx.mp4
    media_cloud_key = Column(String, nullable=True)  # videos/user_1/2026/01/xxx.mp4
    media_cloud_provider = Column(String, nullable=True)  # r2, s3, gcs
    
    # 縮圖（用於列表展示）
    thumbnail_url = Column(String, nullable=True)
    
    # 點數消耗
    credits_used = Column(Integer, default=0)
    
    # 錯誤資訊（如果失敗）
    error_message = Column(Text, nullable=True)
    error_details = Column(JSON, default=dict)
    
    # 元數據
    generation_duration_ms = Column(Integer, nullable=True)  # 生成耗時（毫秒）
    file_size_bytes = Column(Integer, nullable=True)  # 檔案大小
    
    # 時間戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 軟刪除
    is_deleted = Column(Boolean, default=False, index=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # 關聯
    owner = relationship("User", backref="generation_history")