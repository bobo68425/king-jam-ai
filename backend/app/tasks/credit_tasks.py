"""
點數系統 Celery 任務

包括：
- 定期一致性檢查
- 自動修復帳務不平
- 月底月費點數歸零
"""

import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any

from celery import shared_task
from sqlalchemy import func, text

from app.celery_app import celery_app
from app.database import SessionLocal
from app.models import User, CreditTransaction
from app.services.credit_service import CreditService, TransactionManager

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.credit_tasks.check_credit_consistency")
def check_credit_consistency() -> Dict[str, Any]:
    """
    檢查所有用戶的點數一致性
    
    定期執行，發現不一致時發送告警
    """
    db = SessionLocal()
    report = {
        "checked_at": datetime.utcnow().isoformat(),
        "total_users": 0,
        "inconsistent_users": [],
        "success": True,
    }
    
    try:
        # 查詢所有有交易記錄的用戶
        users_with_transactions = db.query(
            CreditTransaction.user_id
        ).distinct().all()
        
        user_ids = [u[0] for u in users_with_transactions]
        report["total_users"] = len(user_ids)
        
        tx_manager = TransactionManager(db)
        
        for user_id in user_ids:
            if not tx_manager.verify_consistency(user_id):
                # 獲取詳細資訊
                user = db.query(User).filter(User.id == user_id).first()
                last_tx = db.query(CreditTransaction).filter(
                    CreditTransaction.user_id == user_id
                ).order_by(CreditTransaction.created_at.desc()).first()
                
                inconsistent_info = {
                    "user_id": user_id,
                    "user_credits": user.credits if user else None,
                    "last_tx_balance": last_tx.balance_after if last_tx else None,
                    "category_total": (
                        (user.credits_promo or 0) +
                        (user.credits_sub or 0) +
                        (user.credits_paid or 0) +
                        (user.credits_bonus or 0)
                    ) if user else None,
                }
                report["inconsistent_users"].append(inconsistent_info)
        
        if report["inconsistent_users"]:
            logger.warning(
                f"[CreditCheck] ⚠️ 發現 {len(report['inconsistent_users'])} 個用戶帳務不一致"
            )
            
            # 發送告警
            try:
                from app.services.monitoring import system_monitor, AlertLevel
                import asyncio
                
                loop = asyncio.get_event_loop()
                loop.run_until_complete(
                    system_monitor._send_alert(
                        level=AlertLevel.WARNING,
                        component="credit_system",
                        message=f"發現 {len(report['inconsistent_users'])} 個用戶帳務不一致，請檢查",
                    )
                )
            except Exception as alert_error:
                logger.error(f"[CreditCheck] 發送告警失敗: {alert_error}")
        else:
            logger.info(f"[CreditCheck] ✅ 所有 {report['total_users']} 個用戶帳務一致")
        
    except Exception as e:
        logger.error(f"[CreditCheck] ❌ 檢查失敗: {e}")
        report["success"] = False
        report["error"] = str(e)
    finally:
        db.close()
    
    return report


@celery_app.task(name="app.tasks.credit_tasks.repair_credit_inconsistency")
def repair_credit_inconsistency(user_id: int, dry_run: bool = True) -> Dict[str, Any]:
    """
    修復用戶帳務不一致
    
    策略：
    1. 從交易記錄重新計算餘額
    2. 更新 User 表的餘額欄位
    3. 記錄修復操作
    
    Args:
        user_id: 用戶 ID
        dry_run: True=只計算不實際修復, False=實際執行修復
    """
    db = SessionLocal()
    report = {
        "user_id": user_id,
        "dry_run": dry_run,
        "repaired": False,
        "before": {},
        "after": {},
    }
    
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            report["error"] = "用戶不存在"
            return report
        
        # 記錄修復前狀態
        report["before"] = {
            "credits": user.credits,
            "credits_promo": user.credits_promo,
            "credits_sub": user.credits_sub,
            "credits_paid": user.credits_paid,
            "credits_bonus": user.credits_bonus,
        }
        
        # 從交易記錄計算正確餘額
        category_totals = db.query(
            CreditTransaction.credit_category,
            func.sum(CreditTransaction.amount).label("total")
        ).filter(
            CreditTransaction.user_id == user_id
        ).group_by(CreditTransaction.credit_category).all()
        
        calculated = {
            "promo": 0,
            "sub": 0,
            "paid": 0,
            "bonus": 0,
        }
        
        for category, total in category_totals:
            if category in calculated:
                calculated[category] = max(0, total or 0)
        
        calculated_total = sum(calculated.values())
        
        report["calculated"] = {
            "credits": calculated_total,
            "credits_promo": calculated["promo"],
            "credits_sub": calculated["sub"],
            "credits_paid": calculated["paid"],
            "credits_bonus": calculated["bonus"],
        }
        
        # 檢查是否需要修復
        needs_repair = (
            user.credits != calculated_total or
            user.credits_promo != calculated["promo"] or
            user.credits_sub != calculated["sub"] or
            user.credits_paid != calculated["paid"] or
            user.credits_bonus != calculated["bonus"]
        )
        
        if not needs_repair:
            report["message"] = "用戶帳務已一致，無需修復"
            return report
        
        if dry_run:
            report["message"] = "需要修復（試運行模式，未實際執行）"
            report["after"] = report["calculated"]
            return report
        
        # 執行修復
        user.credits = calculated_total
        user.credits_promo = calculated["promo"]
        user.credits_sub = calculated["sub"]
        user.credits_paid = calculated["paid"]
        user.credits_bonus = calculated["bonus"]
        
        # 建立修復記錄
        repair_tx = CreditTransaction(
            user_id=user_id,
            credit_category="paid",  # 歸類到 paid
            transaction_type="admin_adjustment",
            amount=0,  # 修復操作不改變餘額總和
            balance_before=report["before"]["credits"],
            balance_after=calculated_total,
            description="系統自動修復帳務不一致",
            extra_data={
                "repair_type": "consistency_fix",
                "before": report["before"],
                "after": report["calculated"],
            }
        )
        db.add(repair_tx)
        
        db.commit()
        
        report["after"] = report["calculated"]
        report["repaired"] = True
        report["message"] = "帳務修復成功"
        
        logger.info(f"[CreditRepair] ✅ 用戶 #{user_id} 帳務已修復")
        
    except Exception as e:
        db.rollback()
        logger.error(f"[CreditRepair] ❌ 修復失敗: {e}")
        report["error"] = str(e)
    finally:
        db.close()
    
    return report


@celery_app.task(name="app.tasks.credit_tasks.grant_prepaid_subscription_credits")
def grant_prepaid_subscription_credits() -> Dict[str, Any]:
    """
    每月 1 號發放預付訂閱的月費點數（募資兌換等 6 個月方案）
    
    條件：prepaid_sub_months_remaining > 0 且訂閱尚未過期
    """
    db = SessionLocal()
    report = {
        "executed_at": datetime.utcnow().isoformat(),
        "users_processed": 0,
        "total_credits_granted": 0,
        "details": [],
    }
    try:
        credit_service = CreditService(db)
        now = datetime.utcnow()
        
        users = db.query(User).filter(
            User.prepaid_sub_months_remaining > 0,
            User.prepaid_sub_credits_per_month > 0,
            User.subscription_expires_at > now,
        ).all()
        
        for user in users:
            credits = user.prepaid_sub_credits_per_month or 0
            if credits <= 0:
                continue
            result = credit_service.grant_subscription(
                user_id=user.id,
                amount=credits,
            )
            if result.success:
                user.prepaid_sub_months_remaining = (user.prepaid_sub_months_remaining or 0) - 1
                if user.prepaid_sub_months_remaining <= 0:
                    user.prepaid_sub_months_remaining = 0
                    user.prepaid_sub_credits_per_month = 0
                report["users_processed"] += 1
                report["total_credits_granted"] += credits
                report["details"].append({
                    "user_id": user.id,
                    "credits_granted": credits,
                    "months_remaining": user.prepaid_sub_months_remaining,
                })
        
        db.commit()
        logger.info(
            f"[PrepaidGrant] ✅ 預付訂閱發放：{report['users_processed']} 用戶，"
            f"共 {report['total_credits_granted']} 點"
        )
    except Exception as e:
        logger.error(f"[PrepaidGrant] ❌ 執行失敗: {e}")
        db.rollback()
        report["error"] = str(e)
    finally:
        db.close()
    return report


@celery_app.task(name="app.tasks.credit_tasks.expire_monthly_sub_credits")
def expire_monthly_sub_credits() -> Dict[str, Any]:
    """
    月底歸零所有用戶的月費點數 (SUB)
    
    每月最後一天執行
    """
    db = SessionLocal()
    report = {
        "executed_at": datetime.utcnow().isoformat(),
        "users_processed": 0,
        "total_credits_expired": 0,
        "details": [],
    }
    
    try:
        credit_service = CreditService(db)
        
        # 查詢所有有 SUB 餘額的用戶
        users_with_sub = db.query(User).filter(
            User.credits_sub > 0
        ).all()
        
        for user in users_with_sub:
            sub_balance = user.credits_sub
            if sub_balance > 0:
                result = credit_service.expire_sub_credits(user.id)
                
                if result.success:
                    report["users_processed"] += 1
                    report["total_credits_expired"] += sub_balance
                    report["details"].append({
                        "user_id": user.id,
                        "expired_credits": sub_balance,
                    })
                else:
                    report["details"].append({
                        "user_id": user.id,
                        "error": result.error,
                    })
        
        logger.info(
            f"[CreditExpire] ✅ 月費點數歸零完成：{report['users_processed']} 用戶，"
            f"共 {report['total_credits_expired']} 點"
        )
        
    except Exception as e:
        logger.error(f"[CreditExpire] ❌ 執行失敗: {e}")
        report["error"] = str(e)
    finally:
        db.close()
    
    return report


@celery_app.task(name="app.tasks.credit_tasks.generate_daily_credit_report")
def generate_daily_credit_report() -> Dict[str, Any]:
    """
    生成每日點數報表
    
    統計當日的點數流動情況
    """
    db = SessionLocal()
    today = datetime.utcnow().date()
    yesterday = today - timedelta(days=1)
    
    report = {
        "date": yesterday.isoformat(),
        "generated_at": datetime.utcnow().isoformat(),
        "summary": {},
    }
    
    try:
        # 查詢昨日交易
        daily_stats = db.query(
            CreditTransaction.transaction_type,
            CreditTransaction.credit_category,
            func.count(CreditTransaction.id).label("count"),
            func.sum(CreditTransaction.amount).label("total")
        ).filter(
            func.date(CreditTransaction.created_at) == yesterday
        ).group_by(
            CreditTransaction.transaction_type,
            CreditTransaction.credit_category
        ).all()
        
        by_type = {}
        by_category = {}
        total_in = 0
        total_out = 0
        
        for tx_type, category, count, total in daily_stats:
            amount = total or 0
            
            if tx_type not in by_type:
                by_type[tx_type] = {"count": 0, "amount": 0}
            by_type[tx_type]["count"] += count
            by_type[tx_type]["amount"] += amount
            
            if category not in by_category:
                by_category[category] = {"in": 0, "out": 0}
            
            if amount > 0:
                by_category[category]["in"] += amount
                total_in += amount
            else:
                by_category[category]["out"] += abs(amount)
                total_out += abs(amount)
        
        report["summary"] = {
            "total_in": total_in,
            "total_out": total_out,
            "net": total_in - total_out,
            "by_type": by_type,
            "by_category": by_category,
        }
        
        logger.info(
            f"[CreditReport] 📊 {yesterday} 報表："
            f"收入 {total_in}，支出 {total_out}，淨額 {total_in - total_out}"
        )
        
    except Exception as e:
        logger.error(f"[CreditReport] ❌ 生成失敗: {e}")
        report["error"] = str(e)
    finally:
        db.close()
    
    return report
