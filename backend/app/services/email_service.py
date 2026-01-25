"""
電子郵件服務
統一管理所有郵件發送功能

支援：
- SMTP (Gmail, 自訂 SMTP)
- SendGrid
- AWS SES

環境變數設定：
- EMAIL_PROVIDER: smtp / sendgrid / ses / console (預設 console)
- SMTP_HOST: SMTP 伺服器地址
- SMTP_PORT: SMTP 埠號（預設 587）
- SMTP_USER: SMTP 用戶名
- SMTP_PASSWORD: SMTP 密碼
- SMTP_FROM_EMAIL: 寄件人地址
- SMTP_FROM_NAME: 寄件人名稱
- SENDGRID_API_KEY: SendGrid API 金鑰
- AWS_SES_REGION: AWS SES 區域
"""

import os
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Any, List
from datetime import datetime
from jinja2 import Template

logger = logging.getLogger(__name__)

# ============================================================
# 郵件配置
# ============================================================

EMAIL_PROVIDER = os.getenv("EMAIL_PROVIDER", "console")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "service@kingjam.app")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "King Jam AI")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
AWS_SES_REGION = os.getenv("AWS_SES_REGION", "ap-northeast-1")

FRONTEND_URL = os.getenv("FRONTEND_URL", "https://kingjam.app")


# ============================================================
# 郵件模板
# ============================================================

BASE_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f8fafc;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .card {
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            padding: 30px;
            text-align: center;
        }
        .header img {
            width: 60px;
            height: 60px;
            border-radius: 12px;
        }
        .header h1 {
            color: white;
            margin: 15px 0 0 0;
            font-size: 24px;
        }
        .content {
            padding: 30px;
        }
        .content h2 {
            color: #1e293b;
            margin-top: 0;
        }
        .content p {
            color: #475569;
            line-height: 1.6;
        }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white !important;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
        }
        .button:hover {
            opacity: 0.9;
        }
        .code-box {
            background: #f1f5f9;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 20px 0;
        }
        .code {
            font-size: 32px;
            font-weight: bold;
            color: #6366f1;
            letter-spacing: 8px;
        }
        .info-box {
            background: #eff6ff;
            border-left: 4px solid #3b82f6;
            padding: 15px;
            margin: 20px 0;
            border-radius: 0 8px 8px 0;
        }
        .warning-box {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            margin: 20px 0;
            border-radius: 0 8px 8px 0;
        }
        .success-box {
            background: #dcfce7;
            border-left: 4px solid #22c55e;
            padding: 15px;
            margin: 20px 0;
            border-radius: 0 8px 8px 0;
        }
        .footer {
            padding: 20px 30px;
            background: #f8fafc;
            text-align: center;
            border-top: 1px solid #e2e8f0;
        }
        .footer p {
            color: #94a3b8;
            font-size: 12px;
            margin: 5px 0;
        }
        .footer a {
            color: #6366f1;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="header">
                <h1>King Jam AI</h1>
            </div>
            <div class="content">
                {{ content }}
            </div>
            <div class="footer">
                <p>此郵件由 King Jam AI 自動發送，請勿直接回覆。</p>
                <p>如有任何問題，請聯繫 <a href="mailto:service@kingjam.app">service@kingjam.app</a></p>
                <p style="margin-top: 15px;">
                    <a href="{{ frontend_url }}">前往 King Jam AI</a> | 
                    <a href="{{ frontend_url }}/dashboard/profile">通知設定</a>
                </p>
            </div>
        </div>
    </div>
</body>
</html>
"""

# 驗證碼模板
VERIFICATION_CODE_TEMPLATE = """
<h2>驗證您的帳號</h2>
<p>{{ greeting }}</p>
<p>請使用以下驗證碼完成驗證：</p>
<div class="code-box">
    <div class="code">{{ code }}</div>
</div>
<p>此驗證碼將在 <strong>10 分鐘</strong>後失效。</p>
<div class="warning-box">
    <strong>安全提醒：</strong>如果您沒有請求此驗證碼，請忽略此郵件。請勿將驗證碼分享給任何人。
</div>
"""

# 歡迎郵件模板
WELCOME_TEMPLATE = """
<h2>歡迎加入 King Jam AI！ 🎉</h2>
<p>{{ greeting }}</p>
<p>感謝您註冊 King Jam AI！您已經獲得 <strong>100 點</strong>免費點數，可以開始體驗我們的 AI 內容創作服務。</p>
<div class="success-box">
    <strong>新手福利：</strong>完成新手任務可以獲得更多免費點數！
</div>
<p>您可以使用 King Jam AI：</p>
<ul>
    <li>🤖 AI 智能文章生成</li>
    <li>🎬 AI 短影片製作</li>
    <li>🎨 社群圖文設計</li>
    <li>📅 智能排程發布</li>
    <li>📊 數據分析報表</li>
</ul>
<p style="text-align: center;">
    <a href="{{ frontend_url }}/dashboard" class="button">開始使用</a>
</p>
"""

# 密碼重設模板
PASSWORD_RESET_TEMPLATE = """
<h2>重設您的密碼</h2>
<p>{{ greeting }}</p>
<p>您已請求重設密碼。請點擊下方按鈕設定新密碼：</p>
<p style="text-align: center;">
    <a href="{{ reset_url }}" class="button">重設密碼</a>
</p>
<p>或複製以下連結至瀏覽器：</p>
<p style="word-break: break-all; color: #6366f1;">{{ reset_url }}</p>
<p>此連結將在 <strong>1 小時</strong>後失效。</p>
<div class="warning-box">
    <strong>安全提醒：</strong>如果您沒有請求重設密碼，請立即聯繫客服，您的帳號可能有安全風險。
</div>
"""

# 付款成功模板
PAYMENT_SUCCESS_TEMPLATE = """
<h2>付款成功 ✓</h2>
<p>{{ greeting }}</p>
<p>您的訂單已完成付款，詳細資訊如下：</p>
<div class="info-box">
    <p><strong>訂單編號：</strong>{{ order_no }}</p>
    <p><strong>商品名稱：</strong>{{ item_name }}</p>
    <p><strong>付款金額：</strong>NT${{ amount }}</p>
    <p><strong>獲得點數：</strong>{{ credits }} 點</p>
    <p><strong>付款時間：</strong>{{ paid_at }}</p>
</div>
<p>您的點數已經入帳，可以立即使用！</p>
<p style="text-align: center;">
    <a href="{{ frontend_url }}/dashboard/credits" class="button">查看點數錢包</a>
</p>
"""

# 點數不足提醒模板
LOW_CREDITS_TEMPLATE = """
<h2>點數餘額不足提醒</h2>
<p>{{ greeting }}</p>
<p>您的點數餘額已不足 <strong>{{ threshold }} 點</strong>，目前餘額為 <strong>{{ balance }} 點</strong>。</p>
<p>為了確保您能繼續使用 AI 內容創作服務，建議您儘快購買點數。</p>
<p style="text-align: center;">
    <a href="{{ frontend_url }}/dashboard/pricing" class="button">購買點數</a>
</p>
"""

# 排程發布通知模板
SCHEDULE_NOTIFICATION_TEMPLATE = """
<h2>{{ title }}</h2>
<p>{{ greeting }}</p>
<div class="{{ box_class }}">
    {{ message }}
</div>
{% if post_url %}
<p style="text-align: center;">
    <a href="{{ post_url }}" class="button">查看貼文</a>
</p>
{% endif %}
<p style="text-align: center;">
    <a href="{{ frontend_url }}/dashboard/scheduler" class="button">查看排程管理</a>
</p>
"""

# 安全警告模板
SECURITY_ALERT_TEMPLATE = """
<h2>⚠️ 安全警告</h2>
<p>{{ greeting }}</p>
<div class="warning-box">
    <p><strong>{{ alert_type }}</strong></p>
    <p>{{ message }}</p>
    <p><strong>時間：</strong>{{ timestamp }}</p>
    <p><strong>IP 位址：</strong>{{ ip_address }}</p>
    {% if location %}
    <p><strong>位置：</strong>{{ location }}</p>
    {% endif %}
</div>
<p>如果這是您本人操作，請忽略此郵件。如果不是，請立即：</p>
<ol>
    <li>變更您的密碼</li>
    <li>啟用雙重認證</li>
    <li>聯繫客服協助</li>
</ol>
<p style="text-align: center;">
    <a href="{{ frontend_url }}/dashboard/profile" class="button">前往帳號設定</a>
</p>
"""

# 通用通知模板
GENERAL_NOTIFICATION_TEMPLATE = """
<h2>{{ title }}</h2>
<p>{{ greeting }}</p>
{{ content }}
{% if action_url %}
<p style="text-align: center;">
    <a href="{{ action_url }}" class="button">{{ action_text }}</a>
</p>
{% endif %}
"""


# ============================================================
# 郵件服務類
# ============================================================

class EmailService:
    """統一郵件發送服務"""
    
    def __init__(self):
        self.provider = EMAIL_PROVIDER
        self.from_email = SMTP_FROM_EMAIL
        self.from_name = SMTP_FROM_NAME
        self.frontend_url = FRONTEND_URL
    
    def send(
        self,
        to: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        發送郵件
        
        Args:
            to: 收件人郵箱
            subject: 郵件主題
            html_content: HTML 內容
            text_content: 純文字內容（可選）
        
        Returns:
            {"success": True/False, "message": ..., "error": ...}
        """
        logger.info(f"[Email] 發送郵件到 {to}, 主題: {subject}")
        
        # 包裝內容到基礎模板
        full_html = Template(BASE_TEMPLATE).render(
            content=html_content,
            frontend_url=self.frontend_url
        )
        
        if self.provider == "console":
            return self._send_console(to, subject, full_html)
        elif self.provider == "smtp":
            return self._send_smtp(to, subject, full_html, text_content)
        elif self.provider == "sendgrid":
            return self._send_sendgrid(to, subject, full_html, text_content)
        elif self.provider == "ses":
            return self._send_ses(to, subject, full_html, text_content)
        else:
            return {"success": False, "error": f"未知的郵件服務: {self.provider}"}
    
    def _send_console(self, to: str, subject: str, html: str) -> Dict[str, Any]:
        """開發模式：輸出到控制台"""
        logger.info(f"[Email][Console] ══════════════════════════════════")
        logger.info(f"[Email][Console] To: {to}")
        logger.info(f"[Email][Console] Subject: {subject}")
        logger.info(f"[Email][Console] Content Preview: {html[:300]}...")
        logger.info(f"[Email][Console] ══════════════════════════════════")
        return {"success": True, "message": "郵件已輸出到控制台（開發模式）"}
    
    def _send_smtp(
        self,
        to: str,
        subject: str,
        html: str,
        text: Optional[str] = None
    ) -> Dict[str, Any]:
        """透過 SMTP 發送"""
        try:
            if not SMTP_USER or not SMTP_PASSWORD:
                return {"success": False, "error": "SMTP 設定不完整"}
            
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{self.from_name} <{self.from_email}>"
            msg["To"] = to
            
            if text:
                msg.attach(MIMEText(text, "plain", "utf-8"))
            msg.attach(MIMEText(html, "html", "utf-8"))
            
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(self.from_email, to, msg.as_string())
            
            logger.info(f"[Email][SMTP] 郵件已發送到 {to}")
            return {"success": True}
            
        except Exception as e:
            logger.error(f"[Email][SMTP] 發送失敗: {e}")
            return {"success": False, "error": str(e)}
    
    def _send_sendgrid(
        self,
        to: str,
        subject: str,
        html: str,
        text: Optional[str] = None
    ) -> Dict[str, Any]:
        """透過 SendGrid 發送"""
        try:
            import sendgrid
            from sendgrid.helpers.mail import Mail, Content
            
            if not SENDGRID_API_KEY:
                return {"success": False, "error": "SendGrid API Key 未設定"}
            
            sg = sendgrid.SendGridAPIClient(api_key=SENDGRID_API_KEY)
            
            from_email = f"{self.from_name} <{self.from_email}>"
            message = Mail(
                from_email=from_email,
                to_emails=to,
                subject=subject,
            )
            message.add_content(Content("text/html", html))
            if text:
                message.add_content(Content("text/plain", text))
            
            response = sg.send(message)
            
            if response.status_code in [200, 201, 202]:
                logger.info(f"[Email][SendGrid] 郵件已發送到 {to}")
                return {"success": True}
            else:
                return {"success": False, "error": f"SendGrid 錯誤: {response.status_code}"}
                
        except ImportError:
            return {"success": False, "error": "請安裝 sendgrid 套件: pip install sendgrid"}
        except Exception as e:
            logger.error(f"[Email][SendGrid] 發送失敗: {e}")
            return {"success": False, "error": str(e)}
    
    def _send_ses(
        self,
        to: str,
        subject: str,
        html: str,
        text: Optional[str] = None
    ) -> Dict[str, Any]:
        """透過 AWS SES 發送"""
        try:
            import boto3
            
            client = boto3.client("ses", region_name=AWS_SES_REGION)
            
            body = {"Html": {"Data": html, "Charset": "UTF-8"}}
            if text:
                body["Text"] = {"Data": text, "Charset": "UTF-8"}
            
            response = client.send_email(
                Source=f"{self.from_name} <{self.from_email}>",
                Destination={"ToAddresses": [to]},
                Message={
                    "Subject": {"Data": subject, "Charset": "UTF-8"},
                    "Body": body
                }
            )
            
            logger.info(f"[Email][SES] 郵件已發送到 {to}, MessageId: {response['MessageId']}")
            return {"success": True, "message_id": response["MessageId"]}
            
        except ImportError:
            return {"success": False, "error": "請安裝 boto3 套件: pip install boto3"}
        except Exception as e:
            logger.error(f"[Email][SES] 發送失敗: {e}")
            return {"success": False, "error": str(e)}
    
    # ============================================================
    # 預設郵件模板方法
    # ============================================================
    
    def send_verification_code(
        self,
        to: str,
        code: str,
        user_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """發送驗證碼郵件"""
        greeting = f"您好，{user_name}！" if user_name else "您好！"
        content = Template(VERIFICATION_CODE_TEMPLATE).render(
            greeting=greeting,
            code=code
        )
        return self.send(to, "【King Jam AI】您的驗證碼", content)
    
    def send_welcome(
        self,
        to: str,
        user_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """發送歡迎郵件"""
        greeting = f"親愛的 {user_name}，" if user_name else "親愛的用戶，"
        content = Template(WELCOME_TEMPLATE).render(
            greeting=greeting,
            frontend_url=self.frontend_url
        )
        return self.send(to, "【King Jam AI】歡迎加入！", content)
    
    def send_password_reset(
        self,
        to: str,
        reset_token: str,
        user_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """發送密碼重設郵件"""
        greeting = f"您好，{user_name}！" if user_name else "您好！"
        reset_url = f"{self.frontend_url}/reset-password?token={reset_token}"
        content = Template(PASSWORD_RESET_TEMPLATE).render(
            greeting=greeting,
            reset_url=reset_url
        )
        return self.send(to, "【King Jam AI】重設密碼", content)
    
    def send_payment_success(
        self,
        to: str,
        order_no: str,
        item_name: str,
        amount: float,
        credits: int,
        paid_at: datetime,
        user_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """發送付款成功郵件"""
        greeting = f"您好，{user_name}！" if user_name else "您好！"
        content = Template(PAYMENT_SUCCESS_TEMPLATE).render(
            greeting=greeting,
            order_no=order_no,
            item_name=item_name,
            amount=f"{amount:,.0f}",
            credits=f"{credits:,}",
            paid_at=paid_at.strftime("%Y/%m/%d %H:%M"),
            frontend_url=self.frontend_url
        )
        return self.send(to, "【King Jam AI】付款成功通知", content)
    
    def send_low_credits_alert(
        self,
        to: str,
        balance: int,
        threshold: int = 100,
        user_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """發送點數不足提醒"""
        greeting = f"您好，{user_name}！" if user_name else "您好！"
        content = Template(LOW_CREDITS_TEMPLATE).render(
            greeting=greeting,
            balance=balance,
            threshold=threshold,
            frontend_url=self.frontend_url
        )
        return self.send(to, "【King Jam AI】點數餘額不足提醒", content)
    
    def send_schedule_notification(
        self,
        to: str,
        notification_type: str,  # success, failed, upcoming
        title: str,
        message: str,
        post_url: Optional[str] = None,
        user_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """發送排程通知"""
        greeting = f"您好，{user_name}！" if user_name else "您好！"
        
        box_class = {
            "success": "success-box",
            "failed": "warning-box",
            "upcoming": "info-box"
        }.get(notification_type, "info-box")
        
        content = Template(SCHEDULE_NOTIFICATION_TEMPLATE).render(
            greeting=greeting,
            title=title,
            message=message,
            box_class=box_class,
            post_url=post_url,
            frontend_url=self.frontend_url
        )
        return self.send(to, f"【King Jam AI】{title}", content)
    
    def send_security_alert(
        self,
        to: str,
        alert_type: str,
        message: str,
        ip_address: str,
        timestamp: datetime,
        location: Optional[str] = None,
        user_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """發送安全警告"""
        greeting = f"您好，{user_name}！" if user_name else "您好！"
        content = Template(SECURITY_ALERT_TEMPLATE).render(
            greeting=greeting,
            alert_type=alert_type,
            message=message,
            ip_address=ip_address,
            timestamp=timestamp.strftime("%Y/%m/%d %H:%M:%S"),
            location=location,
            frontend_url=self.frontend_url
        )
        return self.send(to, f"【King Jam AI】安全警告 - {alert_type}", content)
    
    def send_notification(
        self,
        to: str,
        title: str,
        content_html: str,
        action_url: Optional[str] = None,
        action_text: str = "查看詳情",
        user_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """發送通用通知郵件"""
        greeting = f"您好，{user_name}！" if user_name else "您好！"
        content = Template(GENERAL_NOTIFICATION_TEMPLATE).render(
            greeting=greeting,
            title=title,
            content=content_html,
            action_url=action_url,
            action_text=action_text
        )
        return self.send(to, f"【King Jam AI】{title}", content)


# ============================================================
# 單例實例
# ============================================================

_email_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    """取得郵件服務實例"""
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service


# ============================================================
# 便捷函數
# ============================================================

async def send_email(
    to: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None
) -> Dict[str, Any]:
    """非同步發送郵件"""
    service = get_email_service()
    return service.send(to, subject, html_content, text_content)


def send_email_sync(
    to: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None
) -> Dict[str, Any]:
    """同步發送郵件"""
    service = get_email_service()
    return service.send(to, subject, html_content, text_content)
