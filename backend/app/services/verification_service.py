"""
身份認證服務
提供身份認證狀態檢查功能
"""

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models import User, IdentityVerification


class VerificationService:
    """身份認證服務"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def is_verified(self, user_id: int) -> bool:
        """
        檢查用戶是否已完成身份認證
        
        Args:
            user_id: 用戶 ID
            
        Returns:
            bool: 是否已認證
        """
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return False
        return user.is_identity_verified
    
    def get_verification_status(self, user_id: int) -> dict:
        """
        獲取用戶的認證狀態詳情
        
        Args:
            user_id: 用戶 ID
            
        Returns:
            dict: 認證狀態資訊
        """
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return {
                "is_verified": False,
                "status": None,
                "message": "用戶不存在"
            }
        
        verification = self.db.query(IdentityVerification).filter(
            IdentityVerification.user_id == user_id
        ).first()
        
        if not verification:
            return {
                "is_verified": False,
                "status": None,
                "message": "尚未提交身份認證"
            }
        
        status_messages = {
            "pending": "身份認證審核中，請耐心等候",
            "reviewing": "身份認證審核中，請耐心等候",
            "approved": "身份認證已通過",
            "rejected": f"身份認證未通過：{verification.reject_reason or '請重新提交'}",
        }
        
        return {
            "is_verified": user.identity_verified,
            "status": verification.status,
            "message": status_messages.get(verification.status, "狀態異常"),
            "can_resubmit": verification.status == "rejected",
        }
    
    def require_verification(self, user_id: int) -> None:
        """
        要求用戶必須完成身份認證
        
        如果用戶未完成認證，會拋出 HTTP 403 錯誤
        
        Args:
            user_id: 用戶 ID
            
        Raises:
            HTTPException: 用戶未完成身份認證
        """
        status_info = self.get_verification_status(user_id)
        
        if not status_info["is_verified"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "identity_not_verified",
                    "message": status_info["message"],
                    "status": status_info["status"],
                    "redirect": "/dashboard/verification"
                }
            )


def get_verification_service(db: Session) -> VerificationService:
    """獲取身份認證服務實例"""
    return VerificationService(db)
