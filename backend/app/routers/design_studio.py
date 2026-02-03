"""
圖片設計室 API 路由
包含去背等圖片處理功能
使用本地 rembg 進行去背（免費開源方案）
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from app.services.rembg_service import rembg_service
from app.services.credit_service import CreditService, TransactionType
from app.routers.auth import get_current_user
from app.database import get_db
from app.models import User

router = APIRouter(prefix="/api/design-studio", tags=["design-studio"])

# 去背功能消耗點數
BACKGROUND_REMOVAL_COST = 1


class RemoveBackgroundRequest(BaseModel):
    """去背請求模型"""
    image_base64: Optional[str] = None  # Base64 編碼的圖片（含或不含 data URI 前綴）
    image_url: Optional[str] = None      # 圖片 URL
    output_type: int = 1                  # 1=PNG透明背景, 2=JPG白色背景
    return_type: int = 2                  # 1=URL, 2=Base64（本地服務只支援 Base64）
    use_async: bool = False               # 保留參數但本地服務不需要


class RemoveBackgroundResponse(BaseModel):
    """去背回應模型"""
    success: bool
    image: str           # 去背後的圖片（Base64）
    width: Optional[int] = None
    height: Optional[int] = None


@router.post("/remove-background", response_model=RemoveBackgroundResponse)
async def remove_background(
    request: RemoveBackgroundRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    圖片去背 API（消耗 1 點）
    
    使用本地 rembg（開源 U2Net 模型）進行去背處理
    
    支援兩種輸入方式：
    - image_base64: 直接傳送 Base64 編碼的圖片
    - image_url: 傳送圖片的公開 URL
    
    參數說明：
    - output_type: 1=PNG透明背景（預設）, 2=JPG白色背景
    - return_type: 固定為 Base64 返回
    """
    if not request.image_base64 and not request.image_url:
        raise HTTPException(
            status_code=400,
            detail="必須提供 image_base64 或 image_url"
        )
    
    # 扣除點數
    credit_service = CreditService(db)
    consume_result = credit_service.consume_direct(
        user_id=current_user.id,
        cost=BACKGROUND_REMOVAL_COST,
        transaction_type=TransactionType.CONSUME_BACKGROUND_REMOVAL,
        description="圖片去背",
        metadata={}
    )
    
    if not consume_result.success:
        raise HTTPException(
            status_code=402,  # Payment Required
            detail=f"點數不足：需要 {BACKGROUND_REMOVAL_COST} 點，目前餘額 {consume_result.balance} 點"
        )
    
    try:
        result = await rembg_service.remove_background(
            image_base64=request.image_base64,
            image_url=request.image_url,
            output_type=request.output_type,
            return_type=request.return_type,
        )
        
        return RemoveBackgroundResponse(
            success=result["success"],
            image=result["image"],
            width=result.get("width"),
            height=result.get("height"),
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"去背處理失敗: {str(e)}"
        )


@router.get("/api-status")
async def check_api_status():
    """
    檢查去背服務狀態
    """
    is_available = rembg_service.is_available()
    
    return {
        "service": "rembg",
        "available": is_available,
        "message": "本地去背服務（rembg）已就緒" if is_available else "rembg 未安裝，請執行: pip install rembg[gpu]"
    }
