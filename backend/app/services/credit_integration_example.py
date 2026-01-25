"""
點數帳本整合範例
================

展示如何將 CreditService 整合到現有的生成引擎中。
這個檔案提供了整合模式的參考，不需要直接使用。

整合步驟：
1. 替換直接操作 user.credits 為使用 CreditService
2. 加入交易記錄
3. 關聯生成歷史記錄

以下是 video.py 的修改範例：
"""


# ============================================================
# 方式一：在 API 端點中直接使用 CreditService
# ============================================================

"""
# 原本的程式碼（video.py）：

@router.post("/generate", response_model=VideoScriptResponse)
async def generate_video_script(
    request: VideoGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. 計算並檢查點數
    cost = COST_TABLE.get(request.duration, 50)
    if current_user.credits < cost:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"點數不足！需要 {cost} 點，目前餘額 {current_user.credits} 點"
        )
    
    # ... 生成邏輯 ...
    
    # 6. 扣除點數
    current_user.credits -= cost
    db.commit()
    
    return VideoScriptResponse(...)


# =====================================================
# 改為使用 CreditService 的版本：
# =====================================================

from app.services.credit_service import CreditService, FeatureCode

@router.post("/generate", response_model=VideoScriptResponse)
async def generate_video_script(
    request: Request,  # 加入 Request 取得 IP
    form: VideoGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    credit_service = CreditService(db)
    
    # 1. 決定功能代碼
    duration_feature_map = {
        "8": FeatureCode.SHORT_VIDEO_BASIC,
        "15": FeatureCode.SHORT_VIDEO_BASIC,
        "30": FeatureCode.SHORT_VIDEO_PREMIUM,
        "60": FeatureCode.SHORT_VIDEO_PREMIUM,
    }
    feature_code = duration_feature_map.get(form.duration, FeatureCode.SHORT_VIDEO_BASIC)
    
    # 2. 檢查餘額（會自動從 CreditPricing 表取得價格）
    if not credit_service.check_balance(current_user.id, feature_code):
        cost = credit_service.get_feature_cost(feature_code, current_user.tier)
        balance = credit_service.get_balance(current_user.id)
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "點數不足",
                "required": cost,
                "current": balance,
                "feature": feature_code.value
            }
        )
    
    # 3. 生成內容...
    # (原本的生成邏輯)
    
    # 4. 建立生成歷史記錄
    from app.models import GenerationHistory
    history = GenerationHistory(
        user_id=current_user.id,
        generation_type="short_video",
        status="completed",
        input_params={
            "topic": form.topic,
            "duration": form.duration,
            "platform": form.platform,
        },
        output_data={
            "script": script.model_dump() if script else None,
        }
    )
    db.add(history)
    db.commit()
    db.refresh(history)
    
    # 5. 扣除點數（使用帳本系統）
    ip_address = request.client.host if request.client else None
    result = credit_service.consume(
        user_id=current_user.id,
        feature_code=feature_code,
        description=f"生成 {form.duration} 秒影片腳本：{form.topic[:50]}",
        reference_type="generation_history",
        reference_id=history.id,
        ip_address=ip_address
    )
    
    if not result.success:
        # 理論上不會發生（因為已經檢查過），但還是處理一下
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=result.error
        )
    
    # 更新歷史記錄的點數消耗
    cost = credit_service.get_feature_cost(feature_code, current_user.tier)
    history.credits_used = cost
    db.commit()
    
    return VideoScriptResponse(
        # ... 其他欄位 ...
        credits_used=cost,
    )
"""


# ============================================================
# 方式二：使用 consume_credits_manually 函數（更簡潔）
# ============================================================

"""
from app.services.credit_decorators import consume_credits_manually

@router.post("/generate", response_model=VideoScriptResponse)
async def generate_video_script(
    request: Request,
    form: VideoGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. 決定功能代碼
    feature_code = FeatureCode.SHORT_VIDEO_BASIC  # 或根據 duration 決定
    
    # 2. 先檢查餘額
    check_result = consume_credits_manually(
        db=db,
        user=current_user,
        feature_code=feature_code,
        check_only=True  # 只檢查，不扣除
    )
    
    if not check_result["success"]:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=check_result
        )
    
    # 3. 生成內容...
    # (原本的生成邏輯)
    
    # 4. 成功後扣除點數
    ip_address = request.client.host if request.client else None
    consume_result = consume_credits_manually(
        db=db,
        user=current_user,
        feature_code=feature_code,
        description=f"生成影片腳本：{form.topic}",
        reference_type="generation_history",
        reference_id=history.id,
        ip_address=ip_address
    )
    
    return VideoScriptResponse(
        # ...
        credits_used=consume_result["cost"],
    )
"""


# ============================================================
# 方式三：Veo 影片的特殊處理（高成本）
# ============================================================

"""
# Veo 影片因為成本高，需要更嚴格的處理

@router.post("/render", response_model=RenderVideoResponse)
async def render_video(
    request: Request,
    form: RenderVideoRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    credit_service = CreditService(db)
    
    # 根據品質和時長決定功能代碼
    quality = form.quality
    duration = form.script.get("total_duration", 8)
    
    if quality in ["premium", "ultra"]:
        # Veo 影片
        if duration <= 8:
            feature_code = FeatureCode.VEO_VIDEO_8S
        elif duration <= 15:
            feature_code = FeatureCode.VEO_VIDEO_15S
        else:
            feature_code = FeatureCode.VEO_VIDEO_30S
    else:
        # 標準影片
        if duration <= 15:
            feature_code = FeatureCode.SHORT_VIDEO_BASIC
        else:
            feature_code = FeatureCode.SHORT_VIDEO_PREMIUM
    
    # 檢查餘額
    cost = credit_service.get_feature_cost(feature_code, current_user.tier)
    balance = credit_service.get_balance(current_user.id)
    
    if balance < cost:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "點數不足",
                "required": cost,
                "current": balance,
                "feature": feature_code.value,
                "quality": quality,
                "tip": f"Veo {duration}秒影片需要 {cost} 點"
            }
        )
    
    # 建立歷史記錄
    history = GenerationHistory(
        user_id=current_user.id,
        generation_type="short_video",
        status="processing",
        input_params={
            "quality": quality,
            "duration": duration,
            "script_id": form.project_id,
        }
    )
    db.add(history)
    db.commit()
    db.refresh(history)
    
    try:
        # 執行渲染
        result = await video_generator.generate_video(form.script, quality=quality)
        
        # 成功：扣除點數
        ip_address = request.client.host if request.client else None
        consume_result = credit_service.consume(
            user_id=current_user.id,
            feature_code=feature_code,
            description=f"渲染 {quality} 品質 {duration}秒影片",
            reference_type="generation_history",
            reference_id=history.id,
            metadata={
                "quality": quality,
                "duration": duration,
                "video_url": result.video_url,
            },
            ip_address=ip_address
        )
        
        # 更新歷史記錄
        history.status = "completed"
        history.credits_used = cost
        history.media_local_path = result.video_path
        history.output_data = {
            "video_url": result.video_url,
            "thumbnail_url": result.thumbnail_url,
        }
        db.commit()
        
        return RenderVideoResponse(
            video_url=result.video_url,
            credits_used=cost,
            # ...
        )
        
    except Exception as e:
        # 失敗：不扣點數，但記錄錯誤
        history.status = "failed"
        history.error_message = str(e)
        db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"影片渲染失敗：{str(e)}"
        )
"""


# ============================================================
# 快速遷移腳本：將現有用戶餘額轉為初始交易記錄
# ============================================================

def migrate_existing_credits():
    """
    將現有用戶的 credits 餘額轉換為初始交易記錄
    執行一次即可
    
    使用方式：
    python -c "from app.services.credit_integration_example import migrate_existing_credits; migrate_existing_credits()"
    """
    from app.database import SessionLocal
    from app.models import User, CreditTransaction
    from datetime import datetime
    import pytz
    
    db = SessionLocal()
    
    try:
        # 找出所有有餘額但沒有交易記錄的用戶
        users = db.query(User).filter(User.credits > 0).all()
        
        for user in users:
            # 檢查是否已有交易記錄
            existing = db.query(CreditTransaction).filter(
                CreditTransaction.user_id == user.id
            ).first()
            
            if existing:
                print(f"用戶 {user.id} 已有交易記錄，跳過")
                continue
            
            # 建立初始交易記錄
            tx = CreditTransaction(
                user_id=user.id,
                transaction_type="initial_grant",
                amount=user.credits,
                balance_before=0,
                balance_after=user.credits,
                description="系統遷移：現有餘額轉換",
                metadata={"migration": True, "original_credits": user.credits}
            )
            db.add(tx)
            print(f"用戶 {user.id} 建立初始記錄：{user.credits} 點")
        
        db.commit()
        print("遷移完成！")
        
    except Exception as e:
        db.rollback()
        print(f"遷移失敗：{e}")
    finally:
        db.close()


# ============================================================
# 點數餘額審計工具
# ============================================================

def audit_all_users():
    """
    審計所有用戶的點數餘額是否與交易記錄一致
    
    使用方式：
    python -c "from app.services.credit_integration_example import audit_all_users; audit_all_users()"
    """
    from app.database import SessionLocal
    from app.models import User
    from app.services.credit_service import CreditService
    
    db = SessionLocal()
    credit_service = CreditService(db)
    
    try:
        users = db.query(User).all()
        
        consistent_count = 0
        inconsistent_count = 0
        
        for user in users:
            balance, is_consistent = credit_service.get_verified_balance(user.id)
            
            if is_consistent:
                consistent_count += 1
            else:
                inconsistent_count += 1
                print(f"⚠️ 用戶 {user.id} ({user.email}): 餘額不一致！User.credits={user.credits}, 計算餘額={balance}")
        
        print(f"\n審計完成：")
        print(f"  ✅ 一致：{consistent_count} 位用戶")
        print(f"  ❌ 不一致：{inconsistent_count} 位用戶")
        
    finally:
        db.close()
