"""
通知任務
- 發送驗證碼郵件
- 即時通知
- 排程提醒
- Token 過期警告
"""

import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
import pytz

from app.celery_app import celery_app, BaseTaskWithRetry
from app.database import SessionLocal
from app.models import User, SocialAccount, ScheduledPost

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.tasks.notification_tasks.send_verification_email",
    base=BaseTaskWithRetry,
    bind=True,
    queue="queue_high",  # 高優先級
)
def send_verification_email(
    self,
    email: str,
    verification_code: str,
    user_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    發送驗證碼郵件
    
    Args:
        email: 收件人郵箱
        verification_code: 驗證碼
        user_name: 用戶名稱（可選）
    """
    logger.info(f"[Notification] 發送驗證碼到 {email}")
    
    try:
        # 這裡實作郵件發送邏輯
        # 可以使用 SendGrid, AWS SES, 或其他郵件服務
        
        subject = "【King Jam AI】您的驗證碼"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .code {{ 
                    font-size: 32px; 
                    font-weight: bold; 
                    color: #6366f1;
                    letter-spacing: 8px;
                    padding: 20px;
                    background: #f1f5f9;
                    border-radius: 8px;
                    text-align: center;
                    margin: 20px 0;
                }}
                .footer {{ color: #64748b; font-size: 12px; margin-top: 30px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <h1>驗證您的帳號</h1>
                <p>{'您好，' + user_name + '！' if user_name else '您好！'}</p>
                <p>請使用以下驗證碼完成驗證：</p>
                <div class="code">{verification_code}</div>
                <p>此驗證碼將在 10 分鐘後失效。</p>
                <p>如果您沒有請求此驗證碼，請忽略此郵件。</p>
                <div class="footer">
                    <p>此郵件由 King Jam AI 自動發送，請勿回覆。</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # 調用郵件發送服務
        result = _send_email(email, subject, html_content)
        
        if result["success"]:
            logger.info(f"[Notification] 驗證碼已發送到 {email}")
            return {"success": True}
        else:
            raise Exception(result.get("error", "郵件發送失敗"))
            
    except Exception as e:
        logger.error(f"[Notification] 發送驗證碼失敗: {e}")
        raise self.retry(exc=e)


@celery_app.task(
    name="app.tasks.notification_tasks.send_instant_notification",
    base=BaseTaskWithRetry,
    bind=True,
    queue="queue_high",
)
def send_instant_notification(
    self,
    user_id: int,
    title: str,
    message: str,
    notification_type: str = "content",
    data: Optional[Dict[str, Any]] = None,
    send_email: bool = False
) -> Dict[str, Any]:
    """
    發送即時通知（站內通知 + 可選郵件）
    
    Args:
        user_id: 用戶 ID
        title: 通知標題
        message: 通知內容
        notification_type: 通知類型 (system, credit, payment, security, referral, content, schedule, marketing)
        data: 額外數據
        send_email: 是否同時發送郵件（預設 False，內容生成通知太頻繁）
    """
    logger.info(f"[Notification] 發送即時通知給用戶 #{user_id}: {title}")
    
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            return {"success": False, "error": "用戶不存在"}
        
        # 1. 儲存站內通知到資料庫
        from app.models import Notification
        notification = Notification(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            message=message,
            data=data
        )
        db.add(notification)
        db.commit()
        logger.info(f"[Notification] 站內通知已儲存: ID={notification.id}")
        
        # 2. 可選：發送郵件通知
        if send_email and user.email:
            subject = f"【King Jam AI】{title}"
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
            </head>
            <body>
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2>{title}</h2>
                    <p>{message}</p>
                    <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
                        此郵件由 King Jam AI 自動發送
                    </p>
                </div>
            </body>
            </html>
            """
            
            _send_email(user.email, subject, html_content)
        
        return {"success": True, "notification_id": notification.id}
        
    except Exception as e:
        logger.error(f"[Notification] 發送即時通知失敗: {e}")
        db.rollback()
        raise self.retry(exc=e)
    finally:
        db.close()


@celery_app.task(name="app.tasks.notification_tasks.send_scheduled_reminder")
def send_scheduled_reminder(
    scheduled_post_id: int,
    reminder_type: str = "upcoming"
) -> Dict[str, Any]:
    """
    發送排程提醒
    
    Args:
        scheduled_post_id: 排程貼文 ID
        reminder_type: 提醒類型 (upcoming, published, failed)
    """
    logger.info(f"[Notification] 發送排程提醒: #{scheduled_post_id} ({reminder_type})")
    
    db = SessionLocal()
    try:
        post = db.query(ScheduledPost).filter(
            ScheduledPost.id == scheduled_post_id
        ).first()
        
        if not post:
            return {"success": False, "error": "排程不存在"}
        
        user = db.query(User).filter(User.id == post.user_id).first()
        
        if not user or not user.email:
            return {"success": False, "error": "用戶不存在或無郵箱"}
        
        # 根據提醒類型生成內容
        if reminder_type == "upcoming":
            title = "排程即將發布"
            message = f"您的排程「{post.title or post.caption[:30] + '...' if post.caption else '無標題'}」將在 {post.scheduled_at.strftime('%Y/%m/%d %H:%M')} 發布。"
        elif reminder_type == "published":
            title = "排程發布成功"
            message = f"您的排程「{post.title or post.caption[:30] + '...' if post.caption else '無標題'}」已成功發布。"
            if post.platform_post_url:
                message += f"\n\n查看貼文：{post.platform_post_url}"
        elif reminder_type == "failed":
            title = "排程發布失敗"
            message = f"您的排程「{post.title or post.caption[:30] + '...' if post.caption else '無標題'}」發布失敗。\n\n錯誤訊息：{post.error_message or '未知錯誤'}"
        else:
            return {"success": False, "error": f"未知的提醒類型: {reminder_type}"}
        
        # 發送郵件
        subject = f"【King Jam AI】{title}"
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
        </head>
        <body>
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2>{title}</h2>
                <p>{message.replace(chr(10), '<br>')}</p>
                <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
                    此郵件由 King Jam AI 自動發送
                </p>
            </div>
        </body>
        </html>
        """
        
        result = _send_email(user.email, subject, html_content)
        return result
        
    except Exception as e:
        logger.error(f"[Notification] 發送排程提醒失敗: {e}")
        raise
    finally:
        db.close()


@celery_app.task(name="app.tasks.notification_tasks.send_token_expiry_warning")
def send_token_expiry_warning(
    user_id: int,
    social_account_id: int,
    platform: str,
    expires_at: Optional[str] = None
) -> Dict[str, Any]:
    """
    發送 Token 過期警告
    
    Args:
        user_id: 用戶 ID
        social_account_id: 社群帳號 ID
        platform: 平台名稱
        expires_at: 過期時間（ISO 格式）
    """
    logger.info(f"[Notification] 發送 Token 過期警告給用戶 #{user_id}")
    
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user or not user.email:
            return {"success": False, "error": "用戶不存在或無郵箱"}
        
        account = db.query(SocialAccount).filter(
            SocialAccount.id == social_account_id
        ).first()
        
        platform_display = {
            "instagram": "Instagram",
            "facebook": "Facebook",
            "tiktok": "TikTok",
            "youtube": "YouTube",
            "linkedin": "LinkedIn",
            "line": "LINE",
        }.get(platform.lower(), platform)
        
        account_name = account.platform_username if account else platform_display
        
        title = f"{platform_display} 帳號需要重新授權"
        message = f"""
        您好，{user.full_name or '用戶'}！
        
        您的 {platform_display} 帳號 ({account_name}) 的授權即將過期或已過期。
        
        為了確保您的排程貼文能正常發布，請登入 King Jam AI 重新連結此帳號。
        
        如果您有任何問題，請聯繫我們的客服團隊。
        """
        
        subject = f"【King Jam AI】{title}"
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .alert {{ 
                    background: #fef3c7; 
                    border-left: 4px solid #f59e0b;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 4px;
                }}
                .button {{
                    display: inline-block;
                    background: #6366f1;
                    color: white;
                    padding: 12px 24px;
                    text-decoration: none;
                    border-radius: 6px;
                    margin-top: 20px;
                }}
                .footer {{ color: #64748b; font-size: 12px; margin-top: 30px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <h1>⚠️ {title}</h1>
                <p>您好，{user.full_name or '用戶'}！</p>
                <div class="alert">
                    <strong>{platform_display}</strong> 帳號 (<strong>{account_name}</strong>) 的授權即將過期或已過期。
                </div>
                <p>為了確保您的排程貼文能正常發布，請重新連結此帳號。</p>
                <a href="http://localhost:3000/dashboard/accounts" class="button">
                    重新連結帳號
                </a>
                <div class="footer">
                    <p>此郵件由 King Jam AI 自動發送，請勿回覆。</p>
                    <p>如果您有任何問題，請聯繫我們的客服團隊。</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        result = _send_email(user.email, subject, html_content)
        return result
        
    except Exception as e:
        logger.error(f"[Notification] 發送 Token 過期警告失敗: {e}")
        raise
    finally:
        db.close()


# ============================================================
# 郵件發送實作
# ============================================================

def _send_email(to: str, subject: str, html_content: str) -> Dict[str, Any]:
    """
    發送郵件
    
    可以對接：
    - SendGrid
    - AWS SES
    - Mailgun
    - SMTP
    """
    import os
    
    # 取得郵件服務配置
    email_provider = os.getenv("EMAIL_PROVIDER", "console")
    
    if email_provider == "console":
        # 開發模式：輸出到控制台
        logger.info(f"[Email] To: {to}")
        logger.info(f"[Email] Subject: {subject}")
        logger.info(f"[Email] Content: {html_content[:200]}...")
        return {"success": True, "message": "郵件已輸出到控制台（開發模式）"}
    
    elif email_provider == "sendgrid":
        return _send_via_sendgrid(to, subject, html_content)
    
    elif email_provider == "ses":
        return _send_via_aws_ses(to, subject, html_content)
    
    elif email_provider == "smtp":
        return _send_via_smtp(to, subject, html_content)
    
    else:
        return {"success": False, "error": f"未知的郵件服務: {email_provider}"}


def _send_via_sendgrid(to: str, subject: str, html_content: str) -> Dict[str, Any]:
    """透過 SendGrid 發送郵件"""
    import os
    
    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail
        
        api_key = os.getenv("SENDGRID_API_KEY")
        from_email = os.getenv("SENDGRID_FROM_EMAIL", "noreply@kingjam.ai")
        
        if not api_key:
            return {"success": False, "error": "SendGrid API Key 未設定"}
        
        sg = sendgrid.SendGridAPIClient(api_key=api_key)
        
        message = Mail(
            from_email=from_email,
            to_emails=to,
            subject=subject,
            html_content=html_content
        )
        
        response = sg.send(message)
        
        if response.status_code in [200, 201, 202]:
            return {"success": True}
        else:
            return {"success": False, "error": f"SendGrid 錯誤: {response.status_code}"}
            
    except ImportError:
        return {"success": False, "error": "請安裝 sendgrid 套件"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def _send_via_aws_ses(to: str, subject: str, html_content: str) -> Dict[str, Any]:
    """透過 AWS SES 發送郵件"""
    import os
    
    try:
        import boto3
        
        region = os.getenv("AWS_SES_REGION", "us-east-1")
        from_email = os.getenv("AWS_SES_FROM_EMAIL", "noreply@kingjam.ai")
        
        client = boto3.client("ses", region_name=region)
        
        response = client.send_email(
            Source=from_email,
            Destination={"ToAddresses": [to]},
            Message={
                "Subject": {"Data": subject},
                "Body": {"Html": {"Data": html_content}}
            }
        )
        
        return {"success": True, "message_id": response["MessageId"]}
        
    except ImportError:
        return {"success": False, "error": "請安裝 boto3 套件"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def _send_via_smtp(to: str, subject: str, html_content: str) -> Dict[str, Any]:
    """透過 SMTP 發送郵件"""
    import os
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    try:
        smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER")
        smtp_pass = os.getenv("SMTP_PASSWORD")
        from_email = os.getenv("SMTP_FROM_EMAIL", smtp_user)
        
        if not smtp_user or not smtp_pass:
            return {"success": False, "error": "SMTP 設定不完整"}
        
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_email
        msg["To"] = to
        
        msg.attach(MIMEText(html_content, "html"))
        
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(from_email, to, msg.as_string())
        
        return {"success": True}
        
    except Exception as e:
        return {"success": False, "error": str(e)}
