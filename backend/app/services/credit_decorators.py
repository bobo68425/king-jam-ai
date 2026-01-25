"""
點數消耗裝飾器
提供便捷的方式在生成引擎中整合點數檢查和消耗
"""

import functools
import logging
from typing import Optional, Callable, Any
from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, GenerationHistory
from app.services.credit_service import (
    CreditService, 
    FeatureCode, 
    TransactionType
)

logger = logging.getLogger(__name__)


class InsufficientCreditsError(Exception):
    """點數不足錯誤"""
    def __init__(self, required: int, current: int):
        self.required = required
        self.current = current
        super().__init__(f"點數不足（需要 {required}，目前 {current}）")


def require_credits(feature_code: FeatureCode):
    """
    點數檢查裝飾器
    
    在執行前檢查點數是否足夠，執行後自動扣除點數
    
    使用方式：
    ```python
    @router.post("/generate")
    @require_credits(FeatureCode.RENDER_VEO_FAST)
    async def generate_video(
        request: GenerateRequest,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
    ):
        # 執行生成邏輯
        # 點數會在成功後自動扣除
        return result
    ```
    
    注意：此裝飾器假設被裝飾的函數有 `db` 和 `current_user` 參數
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # 取得必要參數
            db = kwargs.get("db")
            current_user = kwargs.get("current_user")
            request = kwargs.get("request")
            
            if not db or not current_user:
                raise ValueError(
                    "require_credits 裝飾器需要函數有 'db' 和 'current_user' 參數"
                )
            
            credit_service = CreditService(db)
            
            # 檢查點數
            cost = credit_service.get_feature_cost(feature_code, current_user.tier)
            balance = credit_service.get_balance(current_user.id)
            
            if balance < cost:
                raise HTTPException(
                    status_code=402,  # Payment Required
                    detail={
                        "error": "點數不足",
                        "required": cost,
                        "current": balance,
                        "feature": feature_code.value
                    }
                )
            
            # 執行原函數
            result = await func(*args, **kwargs)
            
            # 成功後扣除點數
            ip_address = None
            if request and hasattr(request, 'client') and request.client:
                ip_address = request.client.host
            
            # 嘗試取得 reference_id（如果結果中有）
            reference_id = None
            reference_type = None
            if isinstance(result, dict):
                if "history_id" in result:
                    reference_type = "generation_history"
                    reference_id = result["history_id"]
                elif "id" in result:
                    reference_type = "generation_history"
                    reference_id = result["id"]
            
            consume_result = credit_service.consume(
                user_id=current_user.id,
                feature_code=feature_code,
                description=f"使用 {feature_code.value}",
                reference_type=reference_type,
                reference_id=reference_id,
                ip_address=ip_address
            )
            
            if not consume_result.success:
                logger.error(
                    f"[Credit] 扣除點數失敗（用戶 #{current_user.id}）: {consume_result.error}"
                )
                # 這裡不拋出錯誤，因為生成已經完成
                # 但應該記錄下來供後續處理
            
            # 如果結果是 dict，加入點數資訊
            if isinstance(result, dict):
                result["credits_used"] = cost
                result["remaining_credits"] = consume_result.balance if consume_result.success else balance - cost
            
            return result
        
        return wrapper
    return decorator


def consume_credits_manually(
    db: Session,
    user: User,
    feature_code: FeatureCode,
    reference_type: Optional[str] = None,
    reference_id: Optional[int] = None,
    description: Optional[str] = None,
    ip_address: Optional[str] = None,
    check_only: bool = False
) -> dict:
    """
    手動消耗點數（用於不方便使用裝飾器的情況）
    
    Args:
        db: 資料庫 Session
        user: 用戶對象
        feature_code: 功能代碼
        reference_type: 關聯資源類型
        reference_id: 關聯資源 ID
        description: 描述
        ip_address: IP 位址
        check_only: 是否只檢查不扣除
        
    Returns:
        {
            "success": bool,
            "cost": int,
            "balance_before": int,
            "balance_after": int,
            "transaction_id": int or None,
            "error": str or None
        }
    """
    credit_service = CreditService(db)
    
    cost = credit_service.get_feature_cost(feature_code, user.tier)
    balance = credit_service.get_balance(user.id)
    
    if check_only:
        return {
            "success": balance >= cost,
            "cost": cost,
            "balance_before": balance,
            "balance_after": balance - cost if balance >= cost else balance,
            "transaction_id": None,
            "error": None if balance >= cost else f"點數不足（需要 {cost}，目前 {balance}）"
        }
    
    if balance < cost:
        return {
            "success": False,
            "cost": cost,
            "balance_before": balance,
            "balance_after": balance,
            "transaction_id": None,
            "error": f"點數不足（需要 {cost}，目前 {balance}）"
        }
    
    result = credit_service.consume(
        user_id=user.id,
        feature_code=feature_code,
        description=description or f"使用 {feature_code.value}",
        reference_type=reference_type,
        reference_id=reference_id,
        ip_address=ip_address
    )
    
    return {
        "success": result.success,
        "cost": cost,
        "balance_before": balance,
        "balance_after": result.balance if result.success else balance,
        "transaction_id": result.transaction_id,
        "error": result.error
    }


def check_and_reserve_credits(
    db: Session,
    user: User,
    feature_code: FeatureCode
) -> dict:
    """
    檢查並預留點數（用於長時間任務）
    
    這是一個簡化版本，實際上可以實作更複雜的預留機制
    目前只是檢查餘額是否足夠
    
    Returns:
        {
            "sufficient": bool,
            "cost": int,
            "balance": int,
            "error": str or None
        }
    """
    credit_service = CreditService(db)
    
    cost = credit_service.get_feature_cost(feature_code, user.tier)
    balance = credit_service.get_balance(user.id)
    
    sufficient = balance >= cost
    
    return {
        "sufficient": sufficient,
        "cost": cost,
        "balance": balance,
        "error": None if sufficient else f"點數不足（需要 {cost}，目前 {balance}）"
    }


def update_history_credits(
    db: Session,
    history_id: int,
    credits_used: int
):
    """
    更新生成歷史的點數消耗記錄
    """
    history = db.query(GenerationHistory).filter(
        GenerationHistory.id == history_id
    ).first()
    
    if history:
        history.credits_used = credits_used
        db.commit()
