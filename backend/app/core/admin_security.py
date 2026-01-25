"""
超級管理員安全機制
- 唯一頭號管理員：bobo68425@gmail.com
- 敏感操作需要二次密碼驗證
"""

import bcrypt
from fastapi import HTTPException, status
from typing import Optional

# ============================================================
# 超級管理員設定
# ============================================================

# 唯一的超級管理員 Email
SUPER_ADMIN_EMAIL = "bobo68425@gmail.com"

# 二次驗證密碼（加密儲存）
# 原始密碼：TJ03080425
_SECONDARY_PASSWORD_HASH = bcrypt.hashpw(
    "TJ03080425".encode('utf-8'), 
    bcrypt.gensalt()
).decode('utf-8')


# ============================================================
# 權限檢查函數
# ============================================================

def is_super_admin(user) -> bool:
    """
    檢查是否為超級管理員
    
    只有 bobo68425@gmail.com 是超級管理員
    """
    return user.email == SUPER_ADMIN_EMAIL and user.is_admin


def require_super_admin(user) -> None:
    """
    要求超級管理員權限
    
    非超級管理員將拋出 403 錯誤
    """
    if not is_super_admin(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="此操作僅限頭號管理員執行"
        )


def verify_secondary_password(password: str) -> bool:
    """
    驗證二次密碼
    
    Returns:
        True: 密碼正確
        False: 密碼錯誤
    """
    try:
        return bcrypt.checkpw(
            password.encode('utf-8'),
            _SECONDARY_PASSWORD_HASH.encode('utf-8')
        )
    except Exception:
        return False


def require_secondary_password(password: Optional[str]) -> None:
    """
    要求二次密碼驗證
    
    密碼錯誤或未提供將拋出 403 錯誤
    """
    if not password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="此操作需要二次密碼驗證"
        )
    
    if not verify_secondary_password(password):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="二次密碼錯誤"
        )


# ============================================================
# 敏感操作類型
# ============================================================

SENSITIVE_OPERATIONS = [
    "toggle_admin",        # 設定/取消管理員
    "adjust_credits",      # 調整點數
    "bulk_grant_credits",  # 批量贈送點數
    "approve_withdrawal",  # 審核提領
    "approve_refund",      # 審核退款
    "modify_pricing",      # 修改定價
    "delete_user",         # 刪除用戶
    "view_payment_logs",   # 查看金流日誌
    "export_users",        # 匯出用戶資料
]


def is_sensitive_operation(operation: str) -> bool:
    """檢查是否為敏感操作"""
    return operation in SENSITIVE_OPERATIONS
