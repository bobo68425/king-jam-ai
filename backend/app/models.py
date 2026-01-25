from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON, Numeric, Index, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from decimal import Decimal
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(String, unique=True, index=True, nullable=True)  # 客戶編號，用於行銷追蹤
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)
    full_name = Column(String, nullable=True)
    avatar = Column(String, nullable=True)  # 用戶頭像 URL
    provider = Column(String, default="local")
    social_id = Column(String, nullable=True, index=True)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)  # 管理員權限
    tier = Column(String, default="free")
    
    # 點數餘額（總計）
    credits = Column(Integer, default=100)
    
    # 點數分類餘額（按消耗順序排列）
    # 消耗順序：PROMO -> SUB -> PAID -> BONUS
    credits_promo = Column(Integer, default=100)     # 優惠點數 (PROMO) - 新手任務、行銷活動、補償，有效期短（新用戶預設100）
    credits_sub = Column(Integer, default=0)         # 月費點數 (SUB) - 訂閱方案每月發放，當月有效
    credits_paid = Column(Integer, default=0)        # 購買點數 (PAID) - 刷卡儲值，永久有效，可退款
    credits_bonus = Column(Integer, default=0)       # 獎金點數 (BONUS) - 推薦分潤，永久有效，可提領現金
    
    referral_code = Column(String, unique=True, nullable=True)  # 推薦碼
    referred_by = Column(String, nullable=True)  # 被誰推薦（存推薦碼）
    
    # 夥伴推薦系統
    partner_tier = Column(String(20), default="bronze")  # bronze, silver, gold
    total_referrals = Column(Integer, default=0)  # 累積推薦數
    total_referral_revenue = Column(Numeric(12, 2), default=0)  # 累積推薦收益（TWD）
    
    # 訂閱方案
    subscription_plan = Column(String(20), default="free")  # free, basic, pro, enterprise
    subscription_expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # 身份認證狀態
    is_identity_verified = Column(Boolean, default=False)  # 是否已完成身份認證
    identity_verified_at = Column(DateTime(timezone=True), nullable=True)  # 認證通過時間
    
    # 國籍/地區設定（用於個性化內容生成）
    # 注意：這些欄位需要執行資料庫遷移後才會生效
    # 遷移命令：docker-compose exec backend alembic upgrade head
    # country = Column(String(50), nullable=True)              # 用戶自填國籍/地區 (如 "台灣", "香港", "日本")
    # address_country = Column(String(50), nullable=True)      # 地址國籍
    # register_ip_country = Column(String(50), nullable=True)  # 註冊時 IP 國籍
    # register_ip = Column(String(45), nullable=True)          # 註冊時 IP 地址
    # last_ip_country = Column(String(50), nullable=True)      # 最後活動 IP 國籍
    # preferred_language = Column(String(10), default="zh-TW") # 偏好語言
    
    # 通知設定 (JSON)
    notification_settings = Column(JSON, default=dict)  # email_marketing, email_updates, email_security, email_referral
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # --- 關聯 ---
    posts = relationship("Post", back_populates="owner")
    social_accounts = relationship("SocialAccount", back_populates="owner")
    scheduled_posts = relationship("ScheduledPost", back_populates="owner")
    credit_transactions = relationship("CreditTransaction", back_populates="user", order_by="desc(CreditTransaction.created_at)")


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    content = Column(Text)
    status = Column(String, default="draft")  # draft, published
    cover_image = Column(Text, nullable=True)  # 封面圖片 URL (可能是 base64)
    
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
    
    # 額外設定（JSON 格式，用於存放平台特定設定）
    extra_settings = Column(JSON, default=dict)  # WordPress: site_url, site_name, username, etc.
    
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


# ============================================================
# 點數帳本系統 (Credit Ledger System)
# ============================================================

class CreditTransaction(Base):
    """
    點數交易記錄 - 雙式記帳
    每筆點數變動都會產生一筆記錄，確保可追溯性
    """
    __tablename__ = "credit_transactions"
    
    # 加入約束確保資料完整性
    __table_args__ = (
        Index("idx_credit_tx_user_created", "user_id", "created_at"),
        Index("idx_credit_tx_type", "transaction_type"),
        Index("idx_credit_tx_category", "credit_category"),
        Index("idx_credit_tx_ref", "reference_type", "reference_id"),
        CheckConstraint("amount != 0", name="ck_amount_not_zero"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # 點數類別（按消耗順序：PROMO -> SUB -> PAID -> BONUS）
    credit_category = Column(String(20), nullable=False, default="paid")
    # 可能的值：
    # - promo: 優惠點數 (PROMO) - 新手任務、行銷活動、補償，7-30天有效，純消耗不可退
    # - sub: 月費點數 (SUB) - 訂閱方案每月發放，當月有效，月底歸零
    # - paid: 購買點數 (PAID) - 刷卡儲值，永久有效，可申請退款
    # - bonus: 獎金點數 (BONUS) - 推薦分潤，永久有效，可提領現金（最後扣除）
    
    # 交易類型
    transaction_type = Column(String(50), nullable=False)
    # 可能的值：
    # - initial_grant: 註冊贈送
    # - purchase: 購買點數
    # - referral_bonus: 推薦獎勵
    # - consume_social_image: 消耗 - 社群圖文
    # - consume_blog_post: 消耗 - 部落格文章
    # - consume_short_video: 消耗 - 短影片
    # - consume_veo_video: 消耗 - Veo 影片 (高成本)
    # - refund: 退款
    # - admin_adjustment: 管理員調整
    # - promo_credit: 活動贈送
    # - subscription_grant: 訂閱方案贈送
    # - monthly_grant: 每月分配
    
    # 金額（正數為增加，負數為扣除）
    amount = Column(Integer, nullable=False)
    
    # 交易前後餘額（用於驗證和追溯）
    balance_before = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)
    
    # 關聯的資源（用於追溯）
    reference_type = Column(String(50), nullable=True)  # generation_history, order, subscription, etc.
    reference_id = Column(Integer, nullable=True)
    
    # 描述
    description = Column(String(255), nullable=True)
    
    # 額外資訊
    extra_data = Column(JSON, default=dict)
    # 例如：{
    #   "generation_type": "short_video",
    #   "quality": "premium",
    #   "duration": 15,
    #   "model": "veo-2.0",
    #   "order_id": "ord_xxx",
    #   "promo_code": "NEWYEAR2026"
    # }
    
    # IP 位址（安全審計）
    ip_address = Column(String(45), nullable=True)
    
    # 時間戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # T+14 冷卻期：BONUS 點數需等待 14 天才能提領
    # 只有 BONUS 類別需要設定此欄位
    available_at = Column(DateTime(timezone=True), nullable=True, index=True)
    # None = 立即可用（非 BONUS 類別）
    # 日期 = 該日期後才能提領（BONUS 類別）
    
    # 關聯
    user = relationship("User", back_populates="credit_transactions")


class CreditPricing(Base):
    """
    點數定價表 - 各功能消耗的點數
    允許動態調整定價而不需要改程式碼
    """
    __tablename__ = "credit_pricing"
    
    __table_args__ = (
        Index("idx_pricing_feature_tier", "feature_code", "tier"),
    )

    id = Column(Integer, primary_key=True, index=True)
    
    # 功能代碼
    feature_code = Column(String(50), nullable=False, unique=True)
    # 可能的值：
    # - social_image_basic
    # - social_image_premium
    # - blog_post_basic
    # - blog_post_premium
    # - short_video_basic
    # - short_video_premium
    # - veo_video_8s
    # - veo_video_15s
    # - veo_video_30s
    
    # 功能名稱（顯示用）
    feature_name = Column(String(100), nullable=False)
    
    # 適用的用戶等級（null 表示所有等級）
    tier = Column(String(20), nullable=True)  # free, pro, enterprise
    
    # 消耗點數
    credits_cost = Column(Integer, nullable=False)
    
    # 是否啟用
    is_active = Column(Boolean, default=True)
    
    # 說明
    description = Column(Text, nullable=True)
    
    # 時間戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class SubscriptionPlan(Base):
    """
    訂閱方案
    """
    __tablename__ = "subscription_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    plan_code = Column(String(50), nullable=False, unique=True)
    name = Column(String(100), nullable=False)
    tier = Column(String(20), nullable=False)  # free, basic, pro, enterprise
    price_monthly = Column(Numeric(10, 2), nullable=False, default=0)
    monthly_credits = Column(Integer, nullable=False, default=0)
    features = Column(JSON, default=list)
    is_popular = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class CreditPackage(Base):
    """
    點數方案 - 可購買的點數組合
    """
    __tablename__ = "credit_packages"

    id = Column(Integer, primary_key=True, index=True)
    
    # 方案代碼
    package_code = Column(String(50), nullable=False, unique=True)
    
    # 方案名稱
    name = Column(String(100), nullable=False)
    
    # 點數數量
    credits_amount = Column(Integer, nullable=False)
    
    # 贈送點數
    bonus_credits = Column(Integer, default=0)
    
    # 價格（新台幣）
    price_twd = Column(Numeric(10, 2), nullable=False)
    
    # 原價（用於顯示折扣）
    original_price_twd = Column(Numeric(10, 2), nullable=True)
    
    # 有效期限（天數，null 表示永久）
    validity_days = Column(Integer, nullable=True)
    
    # 是否為熱門方案
    is_popular = Column(Boolean, default=False)
    
    # 排序順序
    sort_order = Column(Integer, default=0)
    
    # 是否啟用
    is_active = Column(Boolean, default=True)
    
    # 說明
    description = Column(Text, nullable=True)
    
    # 時間戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# ============================================================
# 獎金提領系統 (Withdrawal System)
# ============================================================

class WithdrawalRequest(Base):
    """
    獎金提領申請
    
    規則：
    - 匯率：10 點 = NT$ 1 元
    - 最低提領門檻：3,000 點（NT$ 300）
    - 只能提領 BONUS 類別的點數
    - 狀態流轉：pending -> reviewing -> approved/rejected -> completed/cancelled
    """
    __tablename__ = "withdrawal_requests"
    
    __table_args__ = (
        Index("idx_withdrawal_user_status", "user_id", "status"),
        Index("idx_withdrawal_created", "created_at"),
        CheckConstraint("credits_amount >= 3000", name="ck_min_withdrawal"),
        CheckConstraint("amount_twd >= 300", name="ck_min_amount_twd"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # 提領金額
    credits_amount = Column(Integer, nullable=False)  # 提領點數（最低 3000）
    amount_twd = Column(Numeric(10, 2), nullable=False)  # 換算金額 (credits / 10)
    exchange_rate = Column(Numeric(5, 4), default=0.10)  # 匯率 (1點 = 0.10 TWD)
    
    # 狀態流轉
    status = Column(String(20), nullable=False, default="pending", index=True)
    # 可能的值：
    # - pending: 申請中（等待審核）
    # - reviewing: 審核中（人工審核）
    # - approved: 已核准（等待匯款）
    # - rejected: 已駁回
    # - completed: 已完成（已匯款）
    # - cancelled: 已取消（用戶自行取消）
    
    # 風控標記
    is_first_withdrawal = Column(Boolean, default=False)  # 是否為首次提領
    requires_manual_review = Column(Boolean, default=False)  # 是否需要人工審核
    risk_level = Column(String(20), default="low")  # low, medium, high
    risk_notes = Column(Text, nullable=True)  # 風險備註
    
    # 收款資訊
    bank_code = Column(String(10), nullable=True)  # 銀行代碼
    bank_name = Column(String(50), nullable=True)  # 銀行名稱
    account_number = Column(String(50), nullable=True)  # 帳號（加密儲存）
    account_holder = Column(String(50), nullable=True)  # 戶名
    
    # 審核資訊
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_note = Column(Text, nullable=True)  # 審核備註
    rejection_reason = Column(Text, nullable=True)  # 駁回原因
    
    # 匯款資訊
    transfer_reference = Column(String(100), nullable=True)  # 轉帳序號
    transferred_at = Column(DateTime(timezone=True), nullable=True)  # 匯款時間
    
    # 關聯的點數交易（扣除 BONUS 點數時產生）
    credit_transaction_id = Column(Integer, ForeignKey("credit_transactions.id"), nullable=True)
    
    # 使用者備註
    user_note = Column(Text, nullable=True)
    
    # 時間戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 關聯
    user = relationship("User", foreign_keys=[user_id], backref="withdrawal_requests")
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    credit_transaction = relationship("CreditTransaction")


class WithdrawalConfig(Base):
    """
    提領系統設定
    """
    __tablename__ = "withdrawal_config"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # 匯率設定
    exchange_rate = Column(Numeric(5, 4), default=0.10)  # 1點 = 0.10 TWD
    
    # 門檻設定
    min_credits = Column(Integer, default=3000)  # 最低提領點數
    max_credits_per_request = Column(Integer, default=100000)  # 單次最高
    max_credits_per_month = Column(Integer, default=300000)  # 每月最高
    
    # 手續費設定
    fee_type = Column(String(20), default="fixed")  # fixed, percentage, tiered
    fee_amount = Column(Numeric(10, 2), default=0)  # 固定手續費
    fee_percentage = Column(Numeric(5, 4), default=0)  # 百分比手續費
    
    # 審核設定
    auto_approve_threshold = Column(Integer, default=0)  # 自動核准門檻（0=全部需審核）
    
    # 冷卻期設定（風控）
    cooling_period_days = Column(Integer, default=14)  # T+14 冷卻期（天）
    first_withdrawal_manual_review = Column(Boolean, default=True)  # 首次提領需人工審核
    high_amount_threshold = Column(Integer, default=50000)  # 高額提領門檻（需人工審核）
    
    # 是否啟用
    is_active = Column(Boolean, default=True)
    
    # 說明文字
    terms_and_conditions = Column(Text, nullable=True)
    
    # 時間戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# ============================================================
# 品牌資產包 (Brand Kit)
# ============================================================

class BrandKit(Base):
    """
    品牌資產包 - 記住企業的品牌色與風格
    
    功能：
    - 儲存品牌色彩、Logo、字型偏好
    - 提供參考圖供 ControlNet 風格遷移
    - 自動應用於社群圖文、影片生成
    """
    __tablename__ = "brand_kits"
    
    __table_args__ = (
        Index("idx_brand_kit_user", "user_id"),
        Index("idx_brand_kit_active", "user_id", "is_active"),
    )
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # 基本資訊
    name = Column(String(100), nullable=False, default="我的品牌")
    description = Column(Text, nullable=True)
    
    # 品牌色彩
    primary_color = Column(String(20), default="#6366F1")  # 主色
    secondary_color = Column(String(20), default="#8B5CF6")  # 副色
    accent_color = Column(String(20), nullable=True)  # 強調色
    background_color = Column(String(20), default="#FFFFFF")  # 背景色
    text_color = Column(String(20), default="#1F2937")  # 文字色
    
    # 完整調色盤（JSON）
    color_palette = Column(JSON, default=list)  # ["#6366F1", "#8B5CF6", "#EC4899", ...]
    
    # Logo 資產
    logo_url = Column(String(500), nullable=True)  # Logo 圖片 URL
    logo_light_url = Column(String(500), nullable=True)  # 淺色背景 Logo
    logo_dark_url = Column(String(500), nullable=True)  # 深色背景 Logo
    logo_icon_url = Column(String(500), nullable=True)  # 圖示版 Logo
    
    # 字型偏好
    heading_font = Column(String(100), default="Noto Sans TC")  # 標題字型
    body_font = Column(String(100), default="Noto Sans TC")  # 內文字型
    font_style = Column(String(50), default="modern")  # modern, classic, playful, elegant
    
    # 視覺風格
    visual_style = Column(String(50), default="modern")  # modern, minimalist, bold, elegant, playful
    image_style = Column(String(50), default="photography")  # photography, illustration, 3d, flat
    filter_preset = Column(String(50), nullable=True)  # 濾鏡預設
    
    # 參考圖（用於 ControlNet 風格遷移）
    reference_images = Column(JSON, default=list)  # [{"url": "...", "type": "style|color|layout"}, ...]
    
    # 品牌聲音（用於 TTS）
    brand_voice = Column(String(50), default="friendly")  # friendly, professional, energetic, calm
    preferred_tts_voice = Column(String(100), default="zh-TW-HsiaoChenNeural")
    
    # 品牌訊息
    tagline = Column(String(200), nullable=True)  # 品牌標語
    key_messages = Column(JSON, default=list)  # 關鍵訊息
    tone_of_voice = Column(JSON, default=list)  # 語調關鍵字 ["親切", "專業", "創新"]
    forbidden_words = Column(JSON, default=list)  # 禁用詞彙
    
    # 目標受眾
    target_audience = Column(JSON, default=dict)  # {"age": "25-45", "interests": [...]}
    industry = Column(String(100), nullable=True)
    
    # 狀態
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)  # 是否為預設品牌包
    
    # IP 角色設定
    character_personality = Column(String(100), nullable=True)  # 角色性格特徵
    character_age_group = Column(String(50), nullable=True)  # 角色年齡組
    character_traits = Column(JSON, default=list)  # 角色額外特徵標籤 ["戴眼鏡", "愛吃甜食", ...]
    
    # 時間戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 關聯
    user = relationship("User", backref="brand_kits")


class BrandKitAsset(Base):
    """
    品牌資產檔案
    
    儲存 Logo、參考圖等圖片檔案
    """
    __tablename__ = "brand_kit_assets"
    
    id = Column(Integer, primary_key=True, index=True)
    brand_kit_id = Column(Integer, ForeignKey("brand_kits.id", ondelete="CASCADE"), nullable=False)
    
    # 資產類型
    asset_type = Column(String(50), nullable=False)  # logo, logo_light, logo_dark, logo_icon, reference, pattern
    
    # 檔案資訊
    filename = Column(String(255), nullable=False)
    file_url = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=True)  # bytes
    mime_type = Column(String(100), nullable=True)
    
    # 圖片尺寸
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    
    # 額外資訊（用於參考圖）
    extra_data = Column(JSON, default=dict)  # {"style_weight": 0.8, "color_weight": 0.5, ...}
    
    # 排序
    sort_order = Column(Integer, default=0)
    
    # 時間戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 關聯
    brand_kit = relationship("BrandKit", backref="assets")


# ============================================================
# 站內通知
# ============================================================

class Notification(Base):
    """站內通知"""
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # 通知類型: system, credit, referral, security, content
    notification_type = Column(String(20), nullable=False, default="system")
    
    # 通知內容
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    
    # 額外數據（JSON）
    data = Column(JSON, nullable=True)
    
    # 狀態
    is_read = Column(Boolean, default=False)
    
    # 時間戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    read_at = Column(DateTime(timezone=True), nullable=True)
    
    # 關聯
    user = relationship("User", backref="notifications")


class NotificationTemplate(Base):
    """通知模板"""
    __tablename__ = "notification_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # 模板基本資訊
    name = Column(String(100), nullable=False)  # 模板名稱
    code = Column(String(50), unique=True, nullable=False, index=True)  # 模板代碼
    description = Column(Text, nullable=True)  # 模板說明
    
    # 通知內容
    notification_type = Column(String(20), nullable=False, default="system")
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    
    # 預設操作連結
    action_url = Column(String(500), nullable=True)
    action_text = Column(String(50), nullable=True)
    
    # 變數說明（JSON 格式，記錄可用的變數）
    variables = Column(JSON, default=list)  # [{"name": "user_name", "description": "用戶名稱"}, ...]
    
    # 分類標籤
    category = Column(String(50), nullable=True)  # system, marketing, transactional
    
    # 狀態
    is_active = Column(Boolean, default=True)
    is_system = Column(Boolean, default=False)  # 系統預設模板，不可刪除
    
    # 創建者
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # 時間戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 關聯
    creator = relationship("User", backref="created_templates")


# ============================================================
# 內容成效分析 (Content Metrics)
# ============================================================

class ContentMetrics(Base):
    """
    內容成效指標
    追蹤發布內容在各平台的表現數據
    """
    __tablename__ = "content_metrics"
    
    __table_args__ = (
        Index("idx_metrics_post", "post_id"),
        Index("idx_metrics_scheduled", "scheduled_post_id"),
        Index("idx_metrics_platform", "platform"),
        Index("idx_metrics_date", "metric_date"),
        Index("idx_metrics_user_date", "user_id", "metric_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # 關聯的內容（二擇一）
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=True)  # 部落格文章
    scheduled_post_id = Column(Integer, ForeignKey("scheduled_posts.id"), nullable=True)  # 排程社群貼文
    
    # 平台資訊
    platform = Column(String(50), nullable=False)  # instagram, facebook, youtube, wordpress, etc.
    platform_post_id = Column(String(255), nullable=True)  # 平台上的貼文 ID
    platform_post_url = Column(String(500), nullable=True)  # 貼文連結
    
    # 指標日期（每日快照）
    metric_date = Column(DateTime(timezone=True), nullable=False, index=True)
    
    # ===== 曝光指標 =====
    impressions = Column(Integer, default=0)  # 曝光數
    reach = Column(Integer, default=0)  # 觸及人數
    views = Column(Integer, default=0)  # 觀看數（影片）
    
    # ===== 互動指標 =====
    likes = Column(Integer, default=0)  # 按讚數
    comments = Column(Integer, default=0)  # 留言數
    shares = Column(Integer, default=0)  # 分享數
    saves = Column(Integer, default=0)  # 收藏數
    clicks = Column(Integer, default=0)  # 點擊數
    
    # ===== 互動率計算 =====
    engagement_rate = Column(Numeric(5, 4), default=0)  # 互動率 (likes+comments+shares+saves) / impressions
    
    # ===== 影片專屬指標 =====
    watch_time_seconds = Column(Integer, default=0)  # 總觀看時間（秒）
    avg_watch_time_seconds = Column(Numeric(10, 2), default=0)  # 平均觀看時間
    video_completion_rate = Column(Numeric(5, 4), default=0)  # 完播率
    
    # ===== 網站流量指標 (GA4) =====
    page_sessions = Column(Integer, default=0)  # 頁面工作階段
    page_users = Column(Integer, default=0)  # 頁面使用者數
    page_bounce_rate = Column(Numeric(5, 4), default=0)  # 跳出率
    avg_session_duration = Column(Numeric(10, 2), default=0)  # 平均停留時間（秒）
    
    # ===== 轉換指標 =====
    conversions = Column(Integer, default=0)  # 轉換數
    conversion_value = Column(Numeric(12, 2), default=0)  # 轉換價值
    
    # ===== 粉絲變化 =====
    followers_gained = Column(Integer, default=0)  # 獲得粉絲數
    followers_lost = Column(Integer, default=0)  # 流失粉絲數
    net_followers = Column(Integer, default=0)  # 淨增粉絲 (gained - lost)
    
    # ===== 原始數據 =====
    raw_data = Column(JSON, default=dict)  # 平台返回的原始 JSON 數據
    
    # ===== 同步狀態 =====
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    sync_status = Column(String(20), default="pending")  # pending, synced, failed
    sync_error = Column(Text, nullable=True)
    
    # 時間戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 關聯
    user = relationship("User", backref="content_metrics")
    post = relationship("Post", backref="metrics")
    scheduled_post = relationship("ScheduledPost", backref="metrics")


class MetricsSyncLog(Base):
    """
    指標同步日誌
    追蹤每次數據同步的執行狀況
    """
    __tablename__ = "metrics_sync_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # 同步類型
    sync_type = Column(String(50), nullable=False)  # daily_fetch, manual_refresh, backfill
    
    # 同步範圍
    platform = Column(String(50), nullable=True)  # 特定平台或 null 表示全部
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # 特定用戶或 null 表示全部
    
    # 同步結果
    status = Column(String(20), nullable=False, default="running")  # running, completed, failed, partial
    
    # 統計數據
    total_posts = Column(Integer, default=0)  # 處理的貼文總數
    success_count = Column(Integer, default=0)  # 成功數
    failed_count = Column(Integer, default=0)  # 失敗數
    skipped_count = Column(Integer, default=0)  # 跳過數
    
    # 錯誤資訊
    error_message = Column(Text, nullable=True)
    error_details = Column(JSON, default=dict)
    
    # 執行時間
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    
    # Celery 任務資訊
    celery_task_id = Column(String(255), nullable=True)


# ============================================================
# Prompt Registry System (Prompt 管理系統)
# ============================================================

class Prompt(Base):
    """
    Prompt 主表 - 存儲 Prompt 的基本資訊
    
    支援：
    - 文案生成 (copywriting)
    - 圖片生成 (image)
    - 影片生成 (video)
    - TTS 語音 (tts)
    """
    __tablename__ = "prompts"
    
    __table_args__ = (
        Index("idx_prompt_category", "category"),
        Index("idx_prompt_type", "generation_type"),
        Index("idx_prompt_active", "is_active"),
        Index("idx_prompt_search", "name", "category", "generation_type"),
    )
    
    id = Column(Integer, primary_key=True, index=True)
    
    # 基本資訊
    name = Column(String(200), nullable=False, index=True)  # Prompt 名稱
    slug = Column(String(200), unique=True, nullable=False, index=True)  # URL 友善的識別碼
    description = Column(Text, nullable=True)  # 說明描述
    
    # 分類
    category = Column(String(50), nullable=False, index=True)
    # 可能的值：
    # - social_media: 社群媒體文案
    # - blog: 部落格文章
    # - marketing: 行銷文案
    # - product: 產品描述
    # - video_script: 影片腳本
    # - image_prompt: 圖片生成
    # - video_prompt: 影片生成
    # - tts_prompt: 語音合成
    
    # 生成類型
    generation_type = Column(String(50), nullable=False, index=True)
    # 可能的值：
    # - copywriting: 文案生成 (GPT/Gemini)
    # - image: 圖片生成 (Flux/DALL-E/Imagen)
    # - video: 影片生成 (Veo/Runway)
    # - tts: 語音合成 (Edge TTS/ElevenLabs)
    
    # 適用模型 (JSON 陣列)
    supported_models = Column(JSON, default=list)
    # 例如：["gpt-4o", "gemini-2.0-flash", "gemini-1.5-pro"]
    # 例如：["flux-schnell", "flux-dev", "dall-e-3"]
    
    # 預設模型
    default_model = Column(String(100), nullable=True)
    
    # 標籤 (用於搜尋和分類)
    tags = Column(JSON, default=list)  # ["熱門", "行銷", "電商", ...]
    
    # 使用統計
    usage_count = Column(Integer, default=0)  # 使用次數
    
    # 狀態
    is_active = Column(Boolean, default=True)  # 是否啟用
    is_system = Column(Boolean, default=False)  # 是否為系統預設
    is_public = Column(Boolean, default=True)  # 是否公開（非系統 Prompt 可設為私有）
    
    # 當前生效版本
    current_version_id = Column(Integer, nullable=True)  # 指向 PromptVersion.id
    
    # 創建者
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # 時間戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 關聯
    versions = relationship("PromptVersion", back_populates="prompt", order_by="desc(PromptVersion.version_number)")
    creator = relationship("User", backref="created_prompts")


class PromptVersion(Base):
    """
    Prompt 版本表 - 支援版本控制
    
    每次修改 Prompt 內容時建立新版本，保留歷史記錄
    """
    __tablename__ = "prompt_versions"
    
    __table_args__ = (
        Index("idx_prompt_version", "prompt_id", "version_number"),
        Index("idx_prompt_version_active", "prompt_id", "is_active"),
    )
    
    id = Column(Integer, primary_key=True, index=True)
    prompt_id = Column(Integer, ForeignKey("prompts.id", ondelete="CASCADE"), nullable=False)
    
    # 版本號 (自動遞增)
    version_number = Column(Integer, nullable=False, default=1)
    version_tag = Column(String(50), nullable=True)  # 可選的版本標籤，如 "v1.0", "stable", "beta"
    
    # ========== 正向提示詞 ==========
    positive_template = Column(Text, nullable=False)
    # 支援變數替換，使用 {{variable}} 格式
    # 例如：
    # """
    # 你是一位專業的 {{industry}} 行銷文案撰寫專家。
    # 請為 {{brand_name}} 撰寫一篇關於 {{topic}} 的 {{platform}} 貼文。
    # 
    # 目標受眾：{{target_audience}}
    # 風格：{{tone}}
    # 字數限制：{{word_limit}}
    # """
    
    # ========== 負向提示詞（主要用於圖片/影片生成）==========
    negative_template = Column(Text, nullable=True)
    # 例如：
    # "blurry, low quality, distorted, watermark, text, logo, ugly, deformed"
    
    # ========== 模型配置 ==========
    model_config = Column(JSON, default=dict)
    # 結構範例：
    # {
    #   "temperature": 0.7,
    #   "max_tokens": 2000,
    #   "top_p": 0.9,
    #   "top_k": 40,
    #   "presence_penalty": 0,
    #   "frequency_penalty": 0,
    #   
    #   # 圖片生成特有
    #   "width": 1024,
    #   "height": 1024,
    #   "guidance_scale": 7.5,
    #   "num_inference_steps": 28,
    #   "seed": null,
    #   
    #   # 影片生成特有
    #   "duration_seconds": 8,
    #   "fps": 24,
    #   "aspect_ratio": "16:9"
    # }
    
    # ========== 變數定義 ==========
    variables = Column(JSON, default=list)
    # 結構範例：
    # [
    #   {
    #     "name": "topic",
    #     "label": "主題",
    #     "type": "text",
    #     "required": true,
    #     "placeholder": "請輸入文章主題",
    #     "default": null
    #   },
    #   {
    #     "name": "platform",
    #     "label": "平台",
    #     "type": "select",
    #     "options": ["Instagram", "Facebook", "LinkedIn"],
    #     "required": true,
    #     "default": "Instagram"
    #   },
    #   {
    #     "name": "tone",
    #     "label": "語調",
    #     "type": "select",
    #     "options": ["專業", "親切", "幽默", "正式"],
    #     "required": false,
    #     "default": "親切"
    #   }
    # ]
    
    # ========== 輸出格式 ==========
    output_format = Column(JSON, default=dict)
    # 定義期望的輸出結構
    # {
    #   "type": "json",  // text, json, markdown
    #   "schema": {
    #     "caption": "string",
    #     "hashtags": "array",
    #     "call_to_action": "string"
    #   }
    # }
    
    # ========== 範例輸入/輸出（Few-shot Learning）==========
    examples = Column(JSON, default=list)
    # [
    #   {
    #     "input": {"topic": "新品上市", "platform": "Instagram"},
    #     "output": "🎉 重磅消息！我們的最新產品終於來了..."
    #   }
    # ]
    
    # ========== 系統提示詞（用於對話型模型）==========
    system_prompt = Column(Text, nullable=True)
    # 例如："你是 King Jam AI 的專業文案助理，專精於社群媒體行銷..."
    
    # ========== 版本資訊 ==========
    changelog = Column(Text, nullable=True)  # 版本變更說明
    
    # 狀態
    is_active = Column(Boolean, default=True)
    is_draft = Column(Boolean, default=False)  # 草稿狀態
    
    # 審核
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    
    # 效能統計
    avg_rating = Column(Numeric(3, 2), default=0)  # 平均評分 (0-5)
    total_ratings = Column(Integer, default=0)  # 評分次數
    success_rate = Column(Numeric(5, 4), default=0)  # 成功率
    
    # 創建者
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # 時間戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 關聯
    prompt = relationship("Prompt", back_populates="versions")
    creator = relationship("User", foreign_keys=[created_by], backref="created_prompt_versions")
    reviewer = relationship("User", foreign_keys=[reviewed_by])


class PromptUsageLog(Base):
    """
    Prompt 使用記錄 - 追蹤每次使用情況
    
    用於：
    - 使用統計
    - 效能分析
    - A/B 測試
    """
    __tablename__ = "prompt_usage_logs"
    
    __table_args__ = (
        Index("idx_usage_prompt", "prompt_id"),
        Index("idx_usage_version", "version_id"),
        Index("idx_usage_user", "user_id"),
        Index("idx_usage_created", "created_at"),
    )
    
    id = Column(Integer, primary_key=True, index=True)
    
    prompt_id = Column(Integer, ForeignKey("prompts.id"), nullable=False)
    version_id = Column(Integer, ForeignKey("prompt_versions.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # 使用的模型
    model_used = Column(String(100), nullable=True)
    
    # 輸入變數
    input_variables = Column(JSON, default=dict)
    
    # 最終生成的 Prompt（變數替換後）
    rendered_prompt = Column(Text, nullable=True)
    
    # 生成結果
    generation_id = Column(Integer, ForeignKey("generation_history.id"), nullable=True)
    
    # 執行統計
    execution_time_ms = Column(Integer, nullable=True)  # 執行時間（毫秒）
    tokens_used = Column(Integer, nullable=True)  # Token 使用量
    
    # 用戶評分
    user_rating = Column(Integer, nullable=True)  # 1-5 星
    user_feedback = Column(Text, nullable=True)
    
    # 結果狀態
    is_success = Column(Boolean, default=True)
    error_message = Column(Text, nullable=True)
    
    # 時間戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 關聯
    prompt = relationship("Prompt", backref="usage_logs")
    version = relationship("PromptVersion", backref="usage_logs")
    user = relationship("User", backref="prompt_usage_logs")
    generation = relationship("GenerationHistory", backref="prompt_usage")


# ============================================================
# 訂單與金流系統
# ============================================================

class Order(Base):
    """
    訂單記錄
    
    支援：
    - 訂閱方案購買
    - 點數套餐購買
    - 綠界 (ECPay) 付款
    - Stripe 付款
    """
    __tablename__ = "orders"
    
    __table_args__ = (
        Index("idx_order_user", "user_id"),
        Index("idx_order_status", "status"),
        Index("idx_order_payment_provider", "payment_provider"),
        Index("idx_order_created", "created_at"),
    )
    
    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, nullable=False, index=True)  # 訂單編號
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # 訂單類型
    order_type = Column(String(20), nullable=False)  # subscription, credits
    
    # 商品資訊
    item_code = Column(String(50), nullable=False)  # plan_code 或 package_code
    item_name = Column(String(100), nullable=False)
    item_description = Column(Text, nullable=True)
    quantity = Column(Integer, default=1)
    
    # 金額
    unit_price = Column(Numeric(10, 2), nullable=False)  # 單價
    total_amount = Column(Numeric(10, 2), nullable=False)  # 總金額
    currency = Column(String(3), default="TWD")
    
    # 訂閱專用
    subscription_months = Column(Integer, nullable=True)  # 訂閱月數
    
    # 點數專用
    credits_amount = Column(Integer, nullable=True)  # 點數數量
    bonus_credits = Column(Integer, nullable=True)  # 贈送點數
    
    # 支付資訊
    payment_provider = Column(String(20), nullable=True)  # ecpay, stripe
    payment_method = Column(String(50), nullable=True)  # credit_card, atm, cvs, etc.
    
    # 第三方支付資訊
    provider_order_id = Column(String(100), nullable=True)  # 金流商訂單編號
    provider_transaction_id = Column(String(100), nullable=True)  # 金流商交易編號
    provider_response = Column(JSON, nullable=True)  # 金流商回傳資料
    
    # Stripe 專用
    stripe_payment_intent_id = Column(String(100), nullable=True)
    stripe_checkout_session_id = Column(String(100), nullable=True)
    stripe_subscription_id = Column(String(100), nullable=True)
    
    # 綠界專用
    ecpay_merchant_trade_no = Column(String(20), nullable=True)
    ecpay_trade_no = Column(String(20), nullable=True)
    
    # 訂單狀態
    status = Column(String(20), nullable=False, default="pending")
    # pending: 待付款
    # processing: 處理中
    # paid: 已付款
    # completed: 已完成（點數/訂閱已發放）
    # failed: 付款失敗
    # cancelled: 已取消
    # refunded: 已退款
    
    # 付款時間
    paid_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # 退款
    refund_amount = Column(Numeric(10, 2), nullable=True)
    refund_reason = Column(Text, nullable=True)
    refunded_at = Column(DateTime(timezone=True), nullable=True)
    
    # 推薦人分潤
    referrer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    referral_bonus = Column(Numeric(10, 2), nullable=True)  # 推薦人獲得的獎金
    referral_processed = Column(Boolean, default=False)
    
    # IP 和裝置
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    
    # 時間戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)  # 訂單過期時間
    
    # 關聯
    user = relationship("User", foreign_keys=[user_id], backref="orders")
    referrer = relationship("User", foreign_keys=[referrer_id], backref="referred_orders")


class PaymentLog(Base):
    """
    支付日誌 - 記錄所有支付相關的操作
    """
    __tablename__ = "payment_logs"
    
    __table_args__ = (
        Index("idx_payment_log_order", "order_id"),
        Index("idx_payment_log_created", "created_at"),
    )
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    
    # 操作類型
    action = Column(String(50), nullable=False)
    # create_order, payment_callback, payment_success, payment_failed,
    # refund_request, refund_success, credits_granted, subscription_activated
    
    # 狀態變更
    status_before = Column(String(20), nullable=True)
    status_after = Column(String(20), nullable=True)
    
    # 金流商資訊
    provider = Column(String(20), nullable=True)
    provider_response = Column(JSON, nullable=True)
    
    # 詳細資訊
    message = Column(Text, nullable=True)
    extra_data = Column(JSON, nullable=True)
    
    # IP
    ip_address = Column(String(45), nullable=True)
    
    # 時間戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 關聯
    order = relationship("Order", backref="payment_logs")


class RefundRequest(Base):
    """
    PAID 點數退款申請
    
    退款規則：
    - 只退購買的基本點數（不含贈送）
    - 退款金額 = 剩餘 PAID 點數 × 購買價格 × 75%
    - 用戶申請後需管理員審核
    """
    __tablename__ = "refund_requests"
    
    __table_args__ = (
        Index("idx_refund_user", "user_id"),
        Index("idx_refund_status", "status"),
        Index("idx_refund_created", "created_at"),
    )
    
    id = Column(Integer, primary_key=True, index=True)
    request_no = Column(String(50), unique=True, nullable=False, index=True)  # 申請編號
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # 退款點數資訊
    credits_amount = Column(Integer, nullable=False)  # 申請退款的 PAID 點數
    price_per_credit = Column(Numeric(10, 4), nullable=False)  # 購買時每點價格
    refund_rate = Column(Numeric(5, 2), nullable=False, default=0.75)  # 退款比例 (75%)
    
    # 退款金額
    refund_amount = Column(Numeric(10, 2), nullable=False)  # 退款金額 = 點數 × 價格 × 比例
    currency = Column(String(3), default="TWD")
    
    # 原始訂單資訊（可選，用於追溯）
    original_order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    
    # 退款方式
    refund_method = Column(String(20), nullable=True)  # original（原路退回）, bank_transfer
    bank_code = Column(String(10), nullable=True)
    bank_name = Column(String(50), nullable=True)
    account_number = Column(String(50), nullable=True)
    account_name = Column(String(100), nullable=True)
    
    # 申請狀態
    status = Column(String(20), nullable=False, default="pending")
    # pending: 待審核
    # approved: 已批准（等待退款）
    # processing: 退款處理中
    # completed: 已完成
    # rejected: 已拒絕
    # cancelled: 已取消
    
    # 申請原因
    reason = Column(Text, nullable=True)
    
    # 審核資訊
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_note = Column(Text, nullable=True)
    reject_reason = Column(Text, nullable=True)
    
    # 退款處理資訊
    processed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    process_note = Column(Text, nullable=True)
    
    # 金流退款資訊
    provider_refund_id = Column(String(100), nullable=True)  # 金流商退款編號
    provider_response = Column(JSON, nullable=True)
    
    # IP 和裝置
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    
    # 時間戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # 關聯
    user = relationship("User", foreign_keys=[user_id], backref="refund_requests")
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    processor = relationship("User", foreign_keys=[processed_by])
    original_order = relationship("Order", backref="refund_requests")


# ============================================================
# 身份認證系統 (KYC - Know Your Customer)
# ============================================================

class IdentityVerification(Base):
    """
    身份證認證申請
    
    用於：
    - 提領審核前需完成身份認證
    - 高風險操作需實名認證
    - KYC 合規要求
    """
    __tablename__ = "identity_verifications"
    
    __table_args__ = (
        Index("idx_identity_user", "user_id"),
        Index("idx_identity_status", "status"),
        {"extend_existing": True}
    )
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    
    # 基本資料（匹配現有資料庫結構）
    real_name = Column(String(50), nullable=True)
    id_number = Column(String(10), nullable=True)
    id_number_hash = Column(String(64), nullable=True)
    birth_date = Column(DateTime, nullable=True)
    
    # 身份證照片
    id_front_image = Column(String(255), nullable=True)
    id_back_image = Column(String(255), nullable=True)
    selfie_image = Column(String(255), nullable=True)
    
    # 認證狀態
    status = Column(String(20), default="pending")
    # pending, reviewing, approved, rejected
    
    # 審核資訊
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)  # 駁回原因
    
    # 時間戳
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 關聯
    user = relationship("User", foreign_keys=[user_id], backref="identity_verification")
    reviewer = relationship("User", foreign_keys=[reviewed_by])


# IdentityVerificationLog 模型已移除（資料庫中不存在此表）