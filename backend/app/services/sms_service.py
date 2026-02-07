"""
簡訊發送服務
支援多家簡訊商，適用於台灣市場

支援的簡訊商：
1. Twilio - 國際知名，價格較高但穩定
2. 每客簡訊 (Mitake) - 台灣本土，價格實惠
3. 三竹簡訊 (Mitake SMS) - 台灣本土大廠
4. AWS SNS - 適合已用 AWS 的用戶
5. Console (開發測試用)

環境變數設定：
- SMS_PROVIDER: twilio / mitake / sms_get / aws_sns / console (預設 console)
- TWILIO_ACCOUNT_SID: Twilio Account SID
- TWILIO_AUTH_TOKEN: Twilio Auth Token
- TWILIO_FROM_NUMBER: Twilio 發送號碼
- MITAKE_USERNAME: 每客簡訊帳號
- MITAKE_PASSWORD: 每客簡訊密碼
- SMS_GET_USERNAME: 三竹簡訊帳號
- SMS_GET_PASSWORD: 三竹簡訊密碼
"""

import os
import re
import random
import logging
import aiohttp
import hashlib
from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# ============================================================
# 配置
# ============================================================

SMS_PROVIDER = os.getenv("SMS_PROVIDER", "console")

# Twilio 設定
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")  # 主帳戶 Auth Token
TWILIO_API_KEY_SID = os.getenv("TWILIO_API_KEY_SID", "")  # API Key SID (SK...)
TWILIO_API_KEY_SECRET = os.getenv("TWILIO_API_KEY_SECRET", "")  # API Key Secret
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "")

# 每客簡訊 (Mitake) 設定
MITAKE_USERNAME = os.getenv("MITAKE_USERNAME", "")
MITAKE_PASSWORD = os.getenv("MITAKE_PASSWORD", "")
MITAKE_API_URL = os.getenv("MITAKE_API_URL", "https://smsapi.mitake.com.tw/api/mtk/SmSend")

# 三竹簡訊 (SMS Get) 設定
SMS_GET_USERNAME = os.getenv("SMS_GET_USERNAME", "")
SMS_GET_PASSWORD = os.getenv("SMS_GET_PASSWORD", "")
SMS_GET_API_URL = os.getenv("SMS_GET_API_URL", "https://api.smsget.com.tw/api/send")

# AWS SNS 設定
AWS_SNS_REGION = os.getenv("AWS_SNS_REGION", "ap-northeast-1")

# OTP 設定
OTP_LENGTH = 6
OTP_EXPIRE_MINUTES = 10
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_COOLDOWN = 60  # 重發冷卻時間（秒）


# ============================================================
# 資料類別
# ============================================================

@dataclass
class SMSResult:
    """簡訊發送結果"""
    success: bool
    message_id: Optional[str] = None
    error: Optional[str] = None
    provider: Optional[str] = None
    cost: Optional[float] = None  # 費用（如有）


# ============================================================
# 簡訊服務類別
# ============================================================

class SMSService:
    """統一的簡訊發送服務"""
    
    def __init__(self, provider: str = None):
        self.provider = provider or SMS_PROVIDER
        logger.info(f"[SMS] 初始化簡訊服務，提供商: {self.provider}")
    
    def generate_otp(self, length: int = OTP_LENGTH) -> str:
        """生成 OTP 驗證碼"""
        return ''.join([str(random.randint(0, 9)) for _ in range(length)])
    
    def format_phone_number(self, phone: str, country_code: str = "+886") -> str:
        """
        格式化電話號碼
        
        支援格式：
        - 0912345678 → +886912345678
        - 912345678 → +886912345678
        - +886912345678 → +886912345678
        """
        # 移除所有非數字字符（除了開頭的+）
        phone = re.sub(r'[^\d+]', '', phone)
        
        # 如果已經是國際格式
        if phone.startswith('+'):
            return phone
        
        # 移除開頭的 0
        if phone.startswith('0'):
            phone = phone[1:]
        
        # 加上國碼
        return f"{country_code}{phone}"
    
    def validate_phone_number(self, phone: str) -> Tuple[bool, str]:
        """
        驗證電話號碼格式
        
        Returns:
            (是否有效, 錯誤訊息或格式化後的號碼)
        """
        formatted = self.format_phone_number(phone)
        
        # 台灣手機號碼驗證 (+8869xxxxxxxx)
        if formatted.startswith('+886'):
            if re.match(r'^\+8869\d{8}$', formatted):
                return True, formatted
            else:
                return False, "請輸入有效的台灣手機號碼"
        
        # 其他國家號碼（基本格式檢查）
        if re.match(r'^\+\d{10,15}$', formatted):
            return True, formatted
        
        return False, "電話號碼格式不正確"
    
    async def send(
        self,
        phone: str,
        message: str,
        sender_id: str = "KingJamAI"
    ) -> SMSResult:
        """
        發送簡訊
        
        Args:
            phone: 電話號碼
            message: 簡訊內容
            sender_id: 發送者名稱（部分服務商支援）
        """
        # 格式化電話號碼
        is_valid, result = self.validate_phone_number(phone)
        if not is_valid:
            return SMSResult(success=False, error=result)
        
        formatted_phone = result
        
        # 根據 provider 選擇發送方式
        if self.provider == "twilio":
            return await self._send_twilio(formatted_phone, message)
        elif self.provider == "mitake":
            return await self._send_mitake(formatted_phone, message)
        elif self.provider == "sms_get":
            return await self._send_sms_get(formatted_phone, message)
        elif self.provider == "aws_sns":
            return await self._send_aws_sns(formatted_phone, message)
        else:
            # Console 模式（開發測試）
            return await self._send_console(formatted_phone, message)
    
    async def send_otp(
        self,
        phone: str,
        otp: str = None
    ) -> Tuple[SMSResult, str]:
        """
        發送 OTP 驗證碼
        
        Returns:
            (發送結果, OTP 碼)
        """
        if otp is None:
            otp = self.generate_otp()
        
        message = f"【King Jam AI】您的驗證碼是 {otp}，{OTP_EXPIRE_MINUTES} 分鐘內有效。請勿告知他人。"
        
        result = await self.send(phone, message)
        return result, otp
    
    # ==================== Twilio ====================
    
    async def _send_twilio(self, phone: str, message: str) -> SMSResult:
        """
        使用 Twilio 發送簡訊
        
        支援兩種認證方式：
        1. Account SID + Auth Token（傳統方式）
        2. API Key SID + API Key Secret（更安全，推薦）
        """
        if not TWILIO_ACCOUNT_SID:
            return SMSResult(success=False, error="Twilio Account SID 未設定")
        
        if not TWILIO_FROM_NUMBER:
            return SMSResult(success=False, error="Twilio 發送號碼未設定")
        
        # 選擇認證方式：優先使用 API Key
        if TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET:
            auth_user = TWILIO_API_KEY_SID
            auth_pass = TWILIO_API_KEY_SECRET
            auth_method = "API Key"
        elif TWILIO_AUTH_TOKEN:
            auth_user = TWILIO_ACCOUNT_SID
            auth_pass = TWILIO_AUTH_TOKEN
            auth_method = "Auth Token"
        else:
            return SMSResult(success=False, error="Twilio 認證資訊未設定（需要 Auth Token 或 API Key）")
        
        try:
            url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json"
            
            async with aiohttp.ClientSession() as session:
                auth = aiohttp.BasicAuth(auth_user, auth_pass)
                data = {
                    "To": phone,
                    "From": TWILIO_FROM_NUMBER,
                    "Body": message,
                }
                
                async with session.post(url, data=data, auth=auth) as resp:
                    result = await resp.json()
                    
                    if resp.status == 201:
                        logger.info(f"[SMS] Twilio 發送成功 ({auth_method}): {phone}")
                        return SMSResult(
                            success=True,
                            message_id=result.get("sid"),
                            provider="twilio"
                        )
                    else:
                        error = result.get("message", "發送失敗")
                        logger.error(f"[SMS] Twilio 發送失敗: {error}")
                        return SMSResult(success=False, error=error, provider="twilio")
                        
        except Exception as e:
            logger.error(f"[SMS] Twilio 錯誤: {e}")
            return SMSResult(success=False, error=str(e), provider="twilio")
    
    # ==================== 每客簡訊 (Mitake) ====================
    
    async def _send_mitake(self, phone: str, message: str) -> SMSResult:
        """使用每客簡訊發送"""
        if not MITAKE_USERNAME or not MITAKE_PASSWORD:
            return SMSResult(success=False, error="每客簡訊設定不完整")
        
        try:
            # 將國際格式轉為台灣格式 (+886912345678 → 0912345678)
            local_phone = phone
            if phone.startswith('+886'):
                local_phone = '0' + phone[4:]
            
            params = {
                "username": MITAKE_USERNAME,
                "password": MITAKE_PASSWORD,
                "dstaddr": local_phone,
                "smbody": message,
                "encoding": "UTF8",
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(MITAKE_API_URL, params=params) as resp:
                    result = await resp.text()
                    
                    # 每客回傳格式: [msgid]\nstatuscode=x
                    if "statuscode=1" in result or "statuscode=4" in result:
                        # 1=已送達, 4=已送出
                        msg_id = result.split('\n')[0] if '\n' in result else None
                        logger.info(f"[SMS] 每客簡訊發送成功: {local_phone}")
                        return SMSResult(
                            success=True,
                            message_id=msg_id,
                            provider="mitake"
                        )
                    else:
                        logger.error(f"[SMS] 每客簡訊發送失敗: {result}")
                        return SMSResult(success=False, error=result, provider="mitake")
                        
        except Exception as e:
            logger.error(f"[SMS] 每客簡訊錯誤: {e}")
            return SMSResult(success=False, error=str(e), provider="mitake")
    
    # ==================== 三竹簡訊 (SMS Get) ====================
    
    async def _send_sms_get(self, phone: str, message: str) -> SMSResult:
        """使用三竹簡訊發送"""
        if not SMS_GET_USERNAME or not SMS_GET_PASSWORD:
            return SMSResult(success=False, error="三竹簡訊設定不完整")
        
        try:
            # 將國際格式轉為台灣格式
            local_phone = phone
            if phone.startswith('+886'):
                local_phone = '0' + phone[4:]
            
            data = {
                "username": SMS_GET_USERNAME,
                "password": SMS_GET_PASSWORD,
                "mobile": local_phone,
                "message": message,
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(SMS_GET_API_URL, data=data) as resp:
                    result = await resp.json()
                    
                    if result.get("success"):
                        logger.info(f"[SMS] 三竹簡訊發送成功: {local_phone}")
                        return SMSResult(
                            success=True,
                            message_id=result.get("msgid"),
                            provider="sms_get"
                        )
                    else:
                        error = result.get("error", "發送失敗")
                        logger.error(f"[SMS] 三竹簡訊發送失敗: {error}")
                        return SMSResult(success=False, error=error, provider="sms_get")
                        
        except Exception as e:
            logger.error(f"[SMS] 三竹簡訊錯誤: {e}")
            return SMSResult(success=False, error=str(e), provider="sms_get")
    
    # ==================== AWS SNS ====================
    
    async def _send_aws_sns(self, phone: str, message: str) -> SMSResult:
        """使用 AWS SNS 發送簡訊"""
        try:
            import boto3
            
            client = boto3.client('sns', region_name=AWS_SNS_REGION)
            
            response = client.publish(
                PhoneNumber=phone,
                Message=message,
                MessageAttributes={
                    'AWS.SNS.SMS.SMSType': {
                        'DataType': 'String',
                        'StringValue': 'Transactional'  # 交易型簡訊（OTP 等）
                    }
                }
            )
            
            logger.info(f"[SMS] AWS SNS 發送成功: {phone}")
            return SMSResult(
                success=True,
                message_id=response.get('MessageId'),
                provider="aws_sns"
            )
            
        except ImportError:
            return SMSResult(success=False, error="boto3 未安裝", provider="aws_sns")
        except Exception as e:
            logger.error(f"[SMS] AWS SNS 錯誤: {e}")
            return SMSResult(success=False, error=str(e), provider="aws_sns")
    
    # ==================== Console (開發測試) ====================
    
    async def _send_console(self, phone: str, message: str) -> SMSResult:
        """Console 模式（僅輸出到日誌）"""
        logger.info(f"[SMS Console] 發送至 {phone}: {message}")
        print(f"\n{'='*50}")
        print(f"📱 SMS 測試模式")
        print(f"收件者: {phone}")
        print(f"內容: {message}")
        print(f"{'='*50}\n")
        
        return SMSResult(
            success=True,
            message_id=f"console_{datetime.utcnow().timestamp()}",
            provider="console"
        )


# ============================================================
# OTP 管理器
# ============================================================

class OTPManager:
    """
    OTP 驗證碼管理器
    
    使用 Redis 或內存存儲 OTP 狀態
    """
    
    def __init__(self, redis_client=None):
        self.redis = redis_client
        self._memory_store: Dict[str, Dict] = {}  # 內存備用存儲
    
    def _get_key(self, phone: str) -> str:
        """生成存儲鍵"""
        return f"otp:{hashlib.md5(phone.encode()).hexdigest()}"
    
    async def store_otp(
        self,
        phone: str,
        otp: str,
        expire_minutes: int = OTP_EXPIRE_MINUTES
    ) -> bool:
        """存儲 OTP"""
        key = self._get_key(phone)
        data = {
            "otp": otp,
            "created_at": datetime.utcnow().isoformat(),
            "attempts": 0,
            "verified": False,
        }
        
        if self.redis:
            try:
                import json
                await self.redis.setex(key, expire_minutes * 60, json.dumps(data))
                return True
            except Exception as e:
                logger.warning(f"[OTP] Redis 存儲失敗，使用內存: {e}")
        
        # 使用內存存儲
        self._memory_store[key] = {
            **data,
            "expires_at": datetime.utcnow() + timedelta(minutes=expire_minutes)
        }
        return True
    
    async def verify_otp(self, phone: str, otp: str) -> Tuple[bool, str]:
        """
        驗證 OTP
        
        Returns:
            (是否驗證成功, 錯誤訊息)
        """
        key = self._get_key(phone)
        
        # 嘗試從 Redis 獲取
        data = None
        if self.redis:
            try:
                import json
                raw = await self.redis.get(key)
                if raw:
                    data = json.loads(raw)
            except Exception as e:
                logger.warning(f"[OTP] Redis 讀取失敗: {e}")
        
        # 從內存獲取
        if not data and key in self._memory_store:
            stored = self._memory_store[key]
            if datetime.utcnow() < stored.get("expires_at", datetime.min):
                data = stored
            else:
                del self._memory_store[key]
        
        if not data:
            return False, "驗證碼已過期或不存在，請重新獲取"
        
        # 檢查嘗試次數
        if data.get("attempts", 0) >= OTP_MAX_ATTEMPTS:
            return False, f"驗證失敗次數過多，請 {OTP_RESEND_COOLDOWN} 秒後重試"
        
        # 更新嘗試次數
        data["attempts"] = data.get("attempts", 0) + 1
        
        # 驗證
        if data.get("otp") == otp:
            data["verified"] = True
            # 更新存儲
            if self.redis:
                try:
                    import json
                    ttl = await self.redis.ttl(key)
                    if ttl > 0:
                        await self.redis.setex(key, ttl, json.dumps(data))
                except:
                    pass
            elif key in self._memory_store:
                self._memory_store[key] = data
                
            return True, "驗證成功"
        else:
            # 更新失敗次數
            if self.redis:
                try:
                    import json
                    ttl = await self.redis.ttl(key)
                    if ttl > 0:
                        await self.redis.setex(key, ttl, json.dumps(data))
                except:
                    pass
            elif key in self._memory_store:
                self._memory_store[key] = data
                
            remaining = OTP_MAX_ATTEMPTS - data["attempts"]
            return False, f"驗證碼錯誤，還有 {remaining} 次嘗試機會"
    
    async def can_resend(self, phone: str) -> Tuple[bool, int]:
        """
        檢查是否可以重發 OTP
        
        Returns:
            (是否可重發, 剩餘等待秒數)
        """
        key = self._get_key(phone)
        
        data = None
        if self.redis:
            try:
                import json
                raw = await self.redis.get(key)
                if raw:
                    data = json.loads(raw)
            except:
                pass
        
        if not data and key in self._memory_store:
            data = self._memory_store.get(key)
        
        if not data:
            return True, 0
        
        created_at = datetime.fromisoformat(data.get("created_at", datetime.min.isoformat()))
        elapsed = (datetime.utcnow() - created_at).total_seconds()
        
        if elapsed < OTP_RESEND_COOLDOWN:
            return False, int(OTP_RESEND_COOLDOWN - elapsed)
        
        return True, 0
    
    async def clear_otp(self, phone: str):
        """清除 OTP（驗證成功後調用）"""
        key = self._get_key(phone)
        
        if self.redis:
            try:
                await self.redis.delete(key)
            except:
                pass
        
        if key in self._memory_store:
            del self._memory_store[key]


# ============================================================
# 便捷函數
# ============================================================

_sms_service: Optional[SMSService] = None
_otp_manager: Optional[OTPManager] = None


def get_sms_service() -> SMSService:
    """取得簡訊服務實例"""
    global _sms_service
    if _sms_service is None:
        _sms_service = SMSService()
    return _sms_service


def get_otp_manager(redis_client=None) -> OTPManager:
    """取得 OTP 管理器實例"""
    global _otp_manager
    if _otp_manager is None:
        _otp_manager = OTPManager(redis_client)
    return _otp_manager
