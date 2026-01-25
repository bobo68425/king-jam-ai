"""
Token 管理任務
- 自動刷新即將過期的 Token
- Token 有效性檢查
- 過期通知
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import pytz

from app.celery_app import celery_app, BaseTaskWithRetry
from app.database import SessionLocal
from app.models import SocialAccount, User

logger = logging.getLogger(__name__)


# Token 刷新提前時間（小時）
TOKEN_REFRESH_THRESHOLD_HOURS = 24


@celery_app.task(
    name="app.tasks.token_tasks.refresh_token_urgent",
    base=BaseTaskWithRetry,
    bind=True,
    queue="queue_high",  # 高優先級佇列
)
def refresh_token_urgent(self, social_account_id: int) -> Dict[str, Any]:
    """
    緊急刷新單一帳號的 Token
    用於發布前發現 Token 過期時
    
    Args:
        social_account_id: 社群帳號 ID
        
    Returns:
        刷新結果
    """
    logger.info(f"[Token] 緊急刷新帳號 #{social_account_id} 的 Token")
    return refresh_token_sync(social_account_id)


@celery_app.task(name="app.tasks.token_tasks.refresh_all_expiring_tokens")
def refresh_all_expiring_tokens():
    """
    批次刷新所有即將過期的 Token
    每小時執行一次
    """
    logger.info("[Token] 開始檢查即將過期的 Token...")
    
    db = SessionLocal()
    try:
        now = datetime.now(pytz.UTC)
        threshold = now + timedelta(hours=TOKEN_REFRESH_THRESHOLD_HOURS)
        
        # 找出即將過期的帳號（有 refresh_token 的）
        expiring_accounts = db.query(SocialAccount).filter(
            SocialAccount.is_active == True,
            SocialAccount.token_expires_at.isnot(None),
            SocialAccount.token_expires_at <= threshold,
            SocialAccount.refresh_token.isnot(None),
            SocialAccount.refresh_token != "",
        ).all()
        
        logger.info(f"[Token] 找到 {len(expiring_accounts)} 個即將過期的帳號")
        
        results = {
            "total": len(expiring_accounts),
            "success": 0,
            "failed": 0,
            "no_refresh_token": 0,
            "details": []
        }
        
        for account in expiring_accounts:
            try:
                result = refresh_token_sync(account.id)
                
                if result.get("success"):
                    results["success"] += 1
                else:
                    results["failed"] += 1
                    
                    # 如果是因為沒有 refresh_token
                    if "refresh_token" in result.get("error", "").lower():
                        results["no_refresh_token"] += 1
                        # 發送通知請求用戶重新授權
                        from app.tasks.notification_tasks import send_token_expiry_warning
                        send_token_expiry_warning.delay(
                            user_id=account.user_id,
                            social_account_id=account.id,
                            platform=account.platform,
                            expires_at=account.token_expires_at.isoformat() if account.token_expires_at else None
                        )
                
                results["details"].append({
                    "account_id": account.id,
                    "platform": account.platform,
                    "success": result.get("success"),
                    "error": result.get("error")
                })
                
            except Exception as e:
                logger.error(f"[Token] 帳號 #{account.id} 刷新失敗: {e}")
                results["failed"] += 1
                results["details"].append({
                    "account_id": account.id,
                    "platform": account.platform,
                    "success": False,
                    "error": str(e)
                })
        
        logger.info(f"[Token] 刷新完成: 成功 {results['success']}, 失敗 {results['failed']}")
        return results
        
    except Exception as e:
        logger.error(f"[Token] 批次刷新失敗: {e}")
        raise
    finally:
        db.close()


@celery_app.task(name="app.tasks.token_tasks.check_token_validity")
def check_token_validity(social_account_id: int) -> Dict[str, Any]:
    """
    檢查 Token 有效性
    
    Args:
        social_account_id: 社群帳號 ID
        
    Returns:
        檢查結果
    """
    logger.info(f"[Token] 檢查帳號 #{social_account_id} 的 Token 有效性")
    
    db = SessionLocal()
    try:
        account = db.query(SocialAccount).filter(
            SocialAccount.id == social_account_id
        ).first()
        
        if not account:
            return {"valid": False, "error": "帳號不存在"}
        
        if not account.is_active:
            return {"valid": False, "error": "帳號已停用"}
        
        if not account.access_token:
            return {"valid": False, "error": "無 Access Token"}
        
        # 檢查過期時間
        now = datetime.now(pytz.UTC)
        
        if account.token_expires_at:
            if account.token_expires_at < now:
                return {
                    "valid": False,
                    "error": "Token 已過期",
                    "expired_at": account.token_expires_at.isoformat(),
                    "can_refresh": bool(account.refresh_token)
                }
            
            # 計算剩餘時間
            remaining = account.token_expires_at - now
            
            return {
                "valid": True,
                "expires_at": account.token_expires_at.isoformat(),
                "remaining_hours": remaining.total_seconds() / 3600,
                "needs_refresh": remaining.total_seconds() < TOKEN_REFRESH_THRESHOLD_HOURS * 3600
            }
        
        # 沒有過期時間，假設有效
        return {"valid": True, "expires_at": None}
        
    except Exception as e:
        logger.error(f"[Token] 檢查失敗: {e}")
        return {"valid": False, "error": str(e)}
    finally:
        db.close()


def refresh_token_sync(social_account_id: int) -> Dict[str, Any]:
    """
    同步刷新 Token（供其他任務直接調用）
    
    Args:
        social_account_id: 社群帳號 ID
        
    Returns:
        刷新結果
    """
    db = SessionLocal()
    try:
        account = db.query(SocialAccount).filter(
            SocialAccount.id == social_account_id
        ).first()
        
        if not account:
            return {"success": False, "error": "帳號不存在"}
        
        if not account.refresh_token:
            return {"success": False, "error": "無 Refresh Token，需要用戶重新授權"}
        
        # 根據平台調用對應的刷新邏輯
        platform = account.platform.lower()
        
        if platform in ["instagram", "facebook"]:
            result = _refresh_meta_token(account)
        elif platform == "tiktok":
            result = _refresh_tiktok_token(account)
        elif platform == "youtube":
            result = _refresh_google_token(account)
        elif platform == "linkedin":
            result = _refresh_linkedin_token(account)
        elif platform == "line":
            result = _refresh_line_token(account)
        else:
            return {"success": False, "error": f"不支援的平台: {platform}"}
        
        if result.get("success"):
            # 更新資料庫
            account.access_token = result["access_token"]
            if result.get("refresh_token"):
                account.refresh_token = result["refresh_token"]
            if result.get("expires_at"):
                account.token_expires_at = result["expires_at"]
            account.last_sync_at = datetime.now(pytz.UTC)
            
            db.commit()
            
            logger.info(f"[Token] 帳號 #{social_account_id} ({platform}) Token 刷新成功")
            return {"success": True}
        else:
            # 刷新失敗，可能需要用戶重新授權
            account.is_active = False  # 標記為需要重新授權
            db.commit()
            
            logger.warning(f"[Token] 帳號 #{social_account_id} ({platform}) Token 刷新失敗: {result.get('error')}")
            return result
            
    except Exception as e:
        logger.error(f"[Token] 刷新錯誤: {e}")
        db.rollback()
        return {"success": False, "error": str(e)}
    finally:
        db.close()


# ============================================================
# 各平台 Token 刷新實作
# ============================================================

def _refresh_meta_token(account: SocialAccount) -> Dict[str, Any]:
    """
    刷新 Meta (Facebook/Instagram) Token
    
    Meta 的 Long-lived Token 有效期為 60 天
    可用 Refresh Token 換取新的 Long-lived Token
    """
    import os
    import httpx
    
    app_id = os.getenv("FACEBOOK_APP_ID")
    app_secret = os.getenv("FACEBOOK_APP_SECRET")
    
    if not app_id or not app_secret:
        return {"success": False, "error": "Meta App 設定不完整"}
    
    try:
        # Meta 使用 access_token 自行刷新
        url = "https://graph.facebook.com/v18.0/oauth/access_token"
        params = {
            "grant_type": "fb_exchange_token",
            "client_id": app_id,
            "client_secret": app_secret,
            "fb_exchange_token": account.access_token
        }
        
        response = httpx.get(url, params=params, timeout=30)
        data = response.json()
        
        if "access_token" in data:
            expires_in = data.get("expires_in", 60 * 24 * 60 * 60)  # 預設 60 天
            expires_at = datetime.now(pytz.UTC) + timedelta(seconds=expires_in)
            
            return {
                "success": True,
                "access_token": data["access_token"],
                "expires_at": expires_at
            }
        else:
            return {"success": False, "error": data.get("error", {}).get("message", "刷新失敗")}
            
    except Exception as e:
        return {"success": False, "error": str(e)}


def _refresh_tiktok_token(account: SocialAccount) -> Dict[str, Any]:
    """
    刷新 TikTok Token
    
    TikTok 需要使用 refresh_token 來換取新的 access_token
    """
    import os
    import httpx
    
    client_key = os.getenv("TIKTOK_CLIENT_KEY")
    client_secret = os.getenv("TIKTOK_CLIENT_SECRET")
    
    if not client_key or not client_secret:
        return {"success": False, "error": "TikTok App 設定不完整"}
    
    if not account.refresh_token:
        return {"success": False, "error": "無 Refresh Token"}
    
    try:
        url = "https://open.tiktokapis.com/v2/oauth/token/"
        data = {
            "client_key": client_key,
            "client_secret": client_secret,
            "grant_type": "refresh_token",
            "refresh_token": account.refresh_token
        }
        
        response = httpx.post(url, data=data, timeout=30)
        result = response.json()
        
        if "access_token" in result:
            expires_in = result.get("expires_in", 86400)  # 預設 1 天
            expires_at = datetime.now(pytz.UTC) + timedelta(seconds=expires_in)
            
            return {
                "success": True,
                "access_token": result["access_token"],
                "refresh_token": result.get("refresh_token", account.refresh_token),
                "expires_at": expires_at
            }
        else:
            return {"success": False, "error": result.get("error_description", "刷新失敗")}
            
    except Exception as e:
        return {"success": False, "error": str(e)}


def _refresh_google_token(account: SocialAccount) -> Dict[str, Any]:
    """
    刷新 Google (YouTube) Token
    
    使用標準 OAuth2 refresh_token 流程
    """
    import os
    import httpx
    
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    
    if not client_id or not client_secret:
        return {"success": False, "error": "Google App 設定不完整"}
    
    if not account.refresh_token:
        return {"success": False, "error": "無 Refresh Token"}
    
    try:
        url = "https://oauth2.googleapis.com/token"
        data = {
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "refresh_token",
            "refresh_token": account.refresh_token
        }
        
        response = httpx.post(url, data=data, timeout=30)
        result = response.json()
        
        if "access_token" in result:
            expires_in = result.get("expires_in", 3600)  # 預設 1 小時
            expires_at = datetime.now(pytz.UTC) + timedelta(seconds=expires_in)
            
            return {
                "success": True,
                "access_token": result["access_token"],
                # Google 通常不會返回新的 refresh_token
                "expires_at": expires_at
            }
        else:
            return {"success": False, "error": result.get("error_description", "刷新失敗")}
            
    except Exception as e:
        return {"success": False, "error": str(e)}


def _refresh_linkedin_token(account: SocialAccount) -> Dict[str, Any]:
    """
    刷新 LinkedIn Token
    
    LinkedIn 的 access_token 有效期為 60 天
    refresh_token 有效期為 1 年
    """
    import os
    import httpx
    
    client_id = os.getenv("LINKEDIN_CLIENT_ID")
    client_secret = os.getenv("LINKEDIN_CLIENT_SECRET")
    
    if not client_id or not client_secret:
        return {"success": False, "error": "LinkedIn App 設定不完整"}
    
    if not account.refresh_token:
        return {"success": False, "error": "無 Refresh Token"}
    
    try:
        url = "https://www.linkedin.com/oauth/v2/accessToken"
        data = {
            "grant_type": "refresh_token",
            "refresh_token": account.refresh_token,
            "client_id": client_id,
            "client_secret": client_secret
        }
        
        response = httpx.post(url, data=data, timeout=30)
        result = response.json()
        
        if "access_token" in result:
            expires_in = result.get("expires_in", 60 * 24 * 60 * 60)  # 預設 60 天
            expires_at = datetime.now(pytz.UTC) + timedelta(seconds=expires_in)
            
            return {
                "success": True,
                "access_token": result["access_token"],
                "refresh_token": result.get("refresh_token", account.refresh_token),
                "expires_at": expires_at
            }
        else:
            return {"success": False, "error": result.get("error_description", "刷新失敗")}
            
    except Exception as e:
        return {"success": False, "error": str(e)}


def _refresh_line_token(account: SocialAccount) -> Dict[str, Any]:
    """
    刷新 LINE Token
    
    LINE Login 的 access_token 有效期為 30 天
    refresh_token 有效期為 90 天
    """
    import os
    import httpx
    
    client_id = os.getenv("LINE_CHANNEL_ID")
    client_secret = os.getenv("LINE_CHANNEL_SECRET")
    
    if not client_id or not client_secret:
        return {"success": False, "error": "LINE Channel 設定不完整"}
    
    if not account.refresh_token:
        return {"success": False, "error": "無 Refresh Token"}
    
    try:
        url = "https://api.line.me/oauth2/v2.1/token"
        data = {
            "grant_type": "refresh_token",
            "refresh_token": account.refresh_token,
            "client_id": client_id,
            "client_secret": client_secret
        }
        
        response = httpx.post(url, data=data, timeout=30)
        result = response.json()
        
        if "access_token" in result:
            expires_in = result.get("expires_in", 30 * 24 * 60 * 60)  # 預設 30 天
            expires_at = datetime.now(pytz.UTC) + timedelta(seconds=expires_in)
            
            return {
                "success": True,
                "access_token": result["access_token"],
                "refresh_token": result.get("refresh_token", account.refresh_token),
                "expires_at": expires_at
            }
        else:
            return {"success": False, "error": result.get("error_description", "刷新失敗")}
            
    except Exception as e:
        return {"success": False, "error": str(e)}
