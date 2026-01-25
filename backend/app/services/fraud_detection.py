"""
詐騙偵測服務
防止同 IP / 同裝置指紋的多帳號互相推薦獲取獎金

功能：
- IP 地址追蹤
- 裝置指紋追蹤
- 風險評分計算
- 自動標記可疑帳號
- 暫停獎金發放
"""

import os
import logging
import hashlib
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
from enum import Enum

from sqlalchemy import Column, Integer, String, DateTime, Boolean, JSON, ForeignKey, Text, Float, and_, or_, func
from sqlalchemy.orm import Session, relationship

from app.database import Base, SessionLocal
from app.models import User

logger = logging.getLogger(__name__)


# ============================================================
# 資料模型
# ============================================================

class RiskLevel(str, Enum):
    LOW = "low"           # 正常
    MEDIUM = "medium"     # 需關注
    HIGH = "high"         # 高風險
    BLOCKED = "blocked"   # 已封鎖


class DeviceFingerprint(Base):
    """裝置指紋記錄"""
    __tablename__ = "device_fingerprints"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    fingerprint_hash = Column(String(64), index=True)  # SHA-256 hash
    fingerprint_data = Column(JSON, nullable=True)     # 原始指紋資料
    ip_address = Column(String(45), index=True)        # IPv4/IPv6
    user_agent = Column(Text, nullable=True)
    first_seen_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    last_seen_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    login_count = Column(Integer, default=1)
    
    # 關聯
    user = relationship("User", backref="device_fingerprints")


class IPAddressLog(Base):
    """IP 地址登入記錄"""
    __tablename__ = "ip_address_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    ip_address = Column(String(45), index=True)
    ip_hash = Column(String(64), index=True)  # 用於快速比對
    country = Column(String(2), nullable=True)
    city = Column(String(100), nullable=True)
    isp = Column(String(200), nullable=True)
    is_vpn = Column(Boolean, default=False)
    is_proxy = Column(Boolean, default=False)
    is_datacenter = Column(Boolean, default=False)
    first_seen_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    last_seen_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    login_count = Column(Integer, default=1)
    
    user = relationship("User", backref="ip_logs")


class FraudAlert(Base):
    """詐騙警報記錄"""
    __tablename__ = "fraud_alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    alert_type = Column(String(50), index=True)  # same_device, same_ip, self_referral, etc.
    risk_level = Column(String(20), default=RiskLevel.MEDIUM.value)
    risk_score = Column(Float, default=0.0)
    related_user_ids = Column(JSON, default=list)  # 關聯的可疑用戶
    evidence = Column(JSON, default=dict)          # 證據
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(Integer, nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    user = relationship("User", backref="fraud_alerts")


class UserRiskProfile(Base):
    """用戶風險檔案"""
    __tablename__ = "user_risk_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True)
    risk_level = Column(String(20), default=RiskLevel.LOW.value)
    risk_score = Column(Float, default=0.0)
    referral_bonus_blocked = Column(Boolean, default=False)  # 推薦獎金暫停
    withdrawal_blocked = Column(Boolean, default=False)      # 提現暫停
    account_restricted = Column(Boolean, default=False)      # 帳號限制
    block_reason = Column(Text, nullable=True)
    last_checked_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", backref="risk_profile", uselist=False)


# ============================================================
# 詐騙偵測服務
# ============================================================

class FraudDetectionService:
    """
    詐騙偵測服務
    
    偵測策略：
    1. 同裝置多帳號 (Same Device, Multiple Accounts)
    2. 同 IP 多帳號 (Same IP, Multiple Accounts)
    3. 自我推薦 (Self Referral)
    4. 推薦環 (Referral Ring)
    5. VPN/Proxy 使用
    """
    
    # 風險閾值
    THRESHOLDS = {
        "same_device_accounts": 2,    # 同裝置超過 2 個帳號
        "same_ip_accounts": 3,        # 同 IP 超過 3 個帳號（考慮家庭/公司）
        "same_ip_referrals": 1,       # 同 IP 帳號互相推薦
        "referral_ring_size": 3,      # 推薦環最小大小
        "vpn_risk_score": 30,         # VPN 使用增加的風險分數
        "datacenter_risk_score": 50,  # 機房 IP 增加的風險分數
    }
    
    # 風險分數對應等級
    RISK_LEVELS = {
        0: RiskLevel.LOW,
        30: RiskLevel.MEDIUM,
        60: RiskLevel.HIGH,
        90: RiskLevel.BLOCKED,
    }
    
    def __init__(self, db: Session):
        self.db = db
    
    def record_login(
        self,
        user_id: int,
        ip_address: str,
        fingerprint: Optional[str] = None,
        fingerprint_data: Optional[Dict] = None,
        user_agent: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        記錄登入並檢測風險
        
        Args:
            user_id: 用戶 ID
            ip_address: IP 地址
            fingerprint: 裝置指紋 hash
            fingerprint_data: 裝置指紋原始資料
            user_agent: User-Agent
        
        Returns:
            風險評估結果
        """
        result = {
            "user_id": user_id,
            "risk_detected": False,
            "risk_level": RiskLevel.LOW.value,
            "risk_score": 0,
            "alerts": [],
        }
        
        try:
            # 1. 記錄 IP
            ip_result = self._record_ip(user_id, ip_address)
            
            # 2. 記錄裝置指紋
            fp_result = None
            if fingerprint:
                fp_result = self._record_fingerprint(
                    user_id, fingerprint, fingerprint_data, ip_address, user_agent
                )
            
            # 3. 執行風險檢測
            risk_assessment = self._assess_risk(user_id, ip_address, fingerprint)
            
            result["risk_detected"] = risk_assessment["risk_detected"]
            result["risk_level"] = risk_assessment["risk_level"]
            result["risk_score"] = risk_assessment["risk_score"]
            result["alerts"] = risk_assessment["alerts"]
            
            # 4. 更新用戶風險檔案
            self._update_risk_profile(
                user_id,
                risk_assessment["risk_level"],
                risk_assessment["risk_score"],
                risk_assessment["should_block_referral"],
            )
            
            self.db.commit()
            
        except Exception as e:
            logger.error(f"[FraudDetection] 記錄登入失敗: {e}")
            self.db.rollback()
        
        return result
    
    def _record_ip(self, user_id: int, ip_address: str) -> Dict:
        """記錄 IP 地址"""
        ip_hash = hashlib.sha256(ip_address.encode()).hexdigest()
        
        existing = self.db.query(IPAddressLog).filter(
            IPAddressLog.user_id == user_id,
            IPAddressLog.ip_hash == ip_hash,
        ).first()
        
        if existing:
            existing.last_seen_at = datetime.utcnow()
            existing.login_count += 1
            return {"new": False, "record": existing}
        else:
            new_log = IPAddressLog(
                user_id=user_id,
                ip_address=ip_address,
                ip_hash=ip_hash,
            )
            self.db.add(new_log)
            return {"new": True, "record": new_log}
    
    def _record_fingerprint(
        self,
        user_id: int,
        fingerprint: str,
        fingerprint_data: Optional[Dict],
        ip_address: str,
        user_agent: Optional[str],
    ) -> Dict:
        """記錄裝置指紋"""
        fp_hash = hashlib.sha256(fingerprint.encode()).hexdigest()
        
        existing = self.db.query(DeviceFingerprint).filter(
            DeviceFingerprint.user_id == user_id,
            DeviceFingerprint.fingerprint_hash == fp_hash,
        ).first()
        
        if existing:
            existing.last_seen_at = datetime.utcnow()
            existing.login_count += 1
            existing.ip_address = ip_address
            return {"new": False, "record": existing}
        else:
            new_fp = DeviceFingerprint(
                user_id=user_id,
                fingerprint_hash=fp_hash,
                fingerprint_data=fingerprint_data,
                ip_address=ip_address,
                user_agent=user_agent,
            )
            self.db.add(new_fp)
            return {"new": True, "record": new_fp}
    
    def _assess_risk(
        self,
        user_id: int,
        ip_address: str,
        fingerprint: Optional[str],
    ) -> Dict:
        """評估風險"""
        risk_score = 0
        alerts = []
        should_block_referral = False
        
        # 1. 檢查同 IP 多帳號
        ip_risk = self._check_same_ip_accounts(user_id, ip_address)
        if ip_risk["detected"]:
            risk_score += ip_risk["score"]
            alerts.append(ip_risk["alert"])
            if ip_risk.get("block_referral"):
                should_block_referral = True
        
        # 2. 檢查同裝置多帳號
        if fingerprint:
            device_risk = self._check_same_device_accounts(user_id, fingerprint)
            if device_risk["detected"]:
                risk_score += device_risk["score"]
                alerts.append(device_risk["alert"])
                if device_risk.get("block_referral"):
                    should_block_referral = True
        
        # 3. 檢查同 IP/裝置互相推薦
        referral_risk = self._check_suspicious_referrals(user_id, ip_address, fingerprint)
        if referral_risk["detected"]:
            risk_score += referral_risk["score"]
            alerts.extend(referral_risk["alerts"])
            should_block_referral = True
        
        # 計算風險等級
        risk_level = RiskLevel.LOW
        for threshold, level in sorted(self.RISK_LEVELS.items(), reverse=True):
            if risk_score >= threshold:
                risk_level = level
                break
        
        return {
            "risk_detected": len(alerts) > 0,
            "risk_level": risk_level.value,
            "risk_score": risk_score,
            "alerts": alerts,
            "should_block_referral": should_block_referral,
        }
    
    def _check_same_ip_accounts(self, user_id: int, ip_address: str) -> Dict:
        """檢查同 IP 多帳號"""
        ip_hash = hashlib.sha256(ip_address.encode()).hexdigest()
        
        # 查詢同 IP 的其他帳號（30 天內）
        cutoff = datetime.utcnow() - timedelta(days=30)
        
        same_ip_users = self.db.query(IPAddressLog.user_id).filter(
            IPAddressLog.ip_hash == ip_hash,
            IPAddressLog.user_id != user_id,
            IPAddressLog.last_seen_at >= cutoff,
        ).distinct().all()
        
        other_user_ids = [u[0] for u in same_ip_users]
        
        if len(other_user_ids) >= self.THRESHOLDS["same_ip_accounts"]:
            return {
                "detected": True,
                "score": 40,
                "block_referral": len(other_user_ids) >= self.THRESHOLDS["same_ip_referrals"] + 2,
                "alert": {
                    "type": "same_ip_multiple_accounts",
                    "message": f"同 IP 發現 {len(other_user_ids) + 1} 個帳號",
                    "related_users": other_user_ids,
                    "ip_address": ip_address,
                }
            }
        
        return {"detected": False}
    
    def _check_same_device_accounts(self, user_id: int, fingerprint: str) -> Dict:
        """檢查同裝置多帳號"""
        fp_hash = hashlib.sha256(fingerprint.encode()).hexdigest()
        
        # 查詢同指紋的其他帳號
        cutoff = datetime.utcnow() - timedelta(days=90)
        
        same_fp_users = self.db.query(DeviceFingerprint.user_id).filter(
            DeviceFingerprint.fingerprint_hash == fp_hash,
            DeviceFingerprint.user_id != user_id,
            DeviceFingerprint.last_seen_at >= cutoff,
        ).distinct().all()
        
        other_user_ids = [u[0] for u in same_fp_users]
        
        if len(other_user_ids) >= self.THRESHOLDS["same_device_accounts"]:
            return {
                "detected": True,
                "score": 60,  # 同裝置比同 IP 更嚴重
                "block_referral": True,
                "alert": {
                    "type": "same_device_multiple_accounts",
                    "message": f"同裝置發現 {len(other_user_ids) + 1} 個帳號",
                    "related_users": other_user_ids,
                    "fingerprint": fp_hash[:16] + "...",
                }
            }
        
        return {"detected": False}
    
    def _check_suspicious_referrals(
        self,
        user_id: int,
        ip_address: str,
        fingerprint: Optional[str],
    ) -> Dict:
        """檢查可疑的推薦關係"""
        alerts = []
        total_score = 0
        
        # 獲取用戶
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"detected": False, "alerts": [], "score": 0}
        
        # 1. 檢查推薦人是否使用同 IP/裝置
        if user.referred_by:
            # referred_by 是推薦碼（字符串），需要先查找推薦者
            referrer = self.db.query(User).filter(
                User.referral_code == user.referred_by
            ).first()
            
            if not referrer:
                return {"detected": False, "alerts": [], "score": 0}
            
            referrer_id = referrer.id
            
            # 同 IP 檢查
            ip_hash = hashlib.sha256(ip_address.encode()).hexdigest()
            referrer_same_ip = self.db.query(IPAddressLog).filter(
                IPAddressLog.user_id == referrer_id,
                IPAddressLog.ip_hash == ip_hash,
            ).first()
            
            if referrer_same_ip:
                alerts.append({
                    "type": "same_ip_referral",
                    "message": f"用戶與推薦人使用同一 IP 地址",
                    "related_users": [referrer_id],
                    "severity": "high",
                })
                total_score += 70
                
                # 記錄詐騙警報
                self._create_fraud_alert(
                    user_id=user_id,
                    alert_type="same_ip_referral",
                    risk_level=RiskLevel.HIGH,
                    risk_score=70,
                    related_user_ids=[referrer_id],
                    evidence={
                        "ip_address": ip_address,
                        "referrer_id": referrer_id,
                    }
                )
            
            # 同裝置檢查
            if fingerprint:
                fp_hash = hashlib.sha256(fingerprint.encode()).hexdigest()
                referrer_same_device = self.db.query(DeviceFingerprint).filter(
                    DeviceFingerprint.user_id == referrer_id,
                    DeviceFingerprint.fingerprint_hash == fp_hash,
                ).first()
                
                if referrer_same_device:
                    alerts.append({
                        "type": "same_device_referral",
                        "message": f"用戶與推薦人使用同一裝置",
                        "related_users": [referrer_id],
                        "severity": "critical",
                    })
                    total_score += 90
                    
                    # 記錄詐騙警報
                    self._create_fraud_alert(
                        user_id=user_id,
                        alert_type="same_device_referral",
                        risk_level=RiskLevel.BLOCKED,
                        risk_score=90,
                        related_user_ids=[referrer_id],
                        evidence={
                            "fingerprint": fp_hash[:16],
                            "referrer_id": referrer_id,
                        }
                    )
        
        return {
            "detected": len(alerts) > 0,
            "alerts": alerts,
            "score": total_score,
        }
    
    def _create_fraud_alert(
        self,
        user_id: int,
        alert_type: str,
        risk_level: RiskLevel,
        risk_score: float,
        related_user_ids: List[int],
        evidence: Dict,
    ):
        """創建詐騙警報"""
        alert = FraudAlert(
            user_id=user_id,
            alert_type=alert_type,
            risk_level=risk_level.value,
            risk_score=risk_score,
            related_user_ids=related_user_ids,
            evidence=evidence,
        )
        self.db.add(alert)
        
        logger.warning(
            f"[FraudDetection] 🚨 詐騙警報 - 用戶 #{user_id}, "
            f"類型: {alert_type}, 風險等級: {risk_level.value}"
        )
    
    def _update_risk_profile(
        self,
        user_id: int,
        risk_level: str,
        risk_score: float,
        block_referral: bool,
    ):
        """更新用戶風險檔案"""
        profile = self.db.query(UserRiskProfile).filter(
            UserRiskProfile.user_id == user_id
        ).first()
        
        if not profile:
            profile = UserRiskProfile(
                user_id=user_id,
                risk_level=RiskLevel.LOW.value,
                risk_score=0,
            )
            self.db.add(profile)
        
        # 確保有預設值
        current_risk_score = profile.risk_score if profile.risk_score is not None else 0
        current_risk_level = profile.risk_level if profile.risk_level else RiskLevel.LOW.value
        
        # 只更新為更嚴重的等級
        level_order = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.BLOCKED]
        current_level = RiskLevel(current_risk_level)
        new_level = RiskLevel(risk_level)
        
        if level_order.index(new_level) > level_order.index(current_level):
            profile.risk_level = risk_level
            profile.risk_score = max(current_risk_score, risk_score)
        
        if block_referral:
            profile.referral_bonus_blocked = True
            profile.block_reason = f"系統安全驗證中，請聯繫客服協助處理"
        
        profile.last_checked_at = datetime.utcnow()
    
    def check_referral_eligibility(self, user_id: int) -> Tuple[bool, str]:
        """
        檢查用戶是否有資格獲得推薦獎金
        
        Returns:
            (is_eligible, reason)
        """
        profile = self.db.query(UserRiskProfile).filter(
            UserRiskProfile.user_id == user_id
        ).first()
        
        if not profile:
            return True, "OK"
        
        if profile.referral_bonus_blocked:
            return False, profile.block_reason or "推薦獎金已暫停"
        
        if profile.risk_level == RiskLevel.BLOCKED.value:
            return False, "帳號風險等級過高"
        
        if profile.risk_level == RiskLevel.HIGH.value:
            return False, "帳號處於高風險狀態，推薦獎金暫緩發放"
        
        return True, "OK"
    
    def get_user_risk_info(self, user_id: int) -> Dict:
        """獲取用戶風險資訊"""
        profile = self.db.query(UserRiskProfile).filter(
            UserRiskProfile.user_id == user_id
        ).first()
        
        alerts = self.db.query(FraudAlert).filter(
            FraudAlert.user_id == user_id,
            FraudAlert.is_resolved == False,
        ).all()
        
        return {
            "user_id": user_id,
            "risk_level": profile.risk_level if profile else RiskLevel.LOW.value,
            "risk_score": profile.risk_score if profile else 0,
            "referral_bonus_blocked": profile.referral_bonus_blocked if profile else False,
            "pending_alerts": len(alerts),
            "alerts": [
                {
                    "type": a.alert_type,
                    "level": a.risk_level,
                    "created_at": a.created_at.isoformat(),
                }
                for a in alerts
            ],
        }
    
    def resolve_alert(
        self,
        alert_id: int,
        resolved_by: int,
        resolution_note: str,
        unblock_user: bool = False,
    ) -> bool:
        """解決詐騙警報"""
        alert = self.db.query(FraudAlert).filter(
            FraudAlert.id == alert_id
        ).first()
        
        if not alert:
            return False
        
        alert.is_resolved = True
        alert.resolved_by = resolved_by
        alert.resolved_at = datetime.utcnow()
        alert.resolution_note = resolution_note
        
        if unblock_user:
            profile = self.db.query(UserRiskProfile).filter(
                UserRiskProfile.user_id == alert.user_id
            ).first()
            
            if profile:
                profile.referral_bonus_blocked = False
                profile.risk_level = RiskLevel.LOW.value
                profile.block_reason = None
        
        self.db.commit()
        return True


# 便捷函數
def get_fraud_detection_service(db: Session) -> FraudDetectionService:
    return FraudDetectionService(db)
