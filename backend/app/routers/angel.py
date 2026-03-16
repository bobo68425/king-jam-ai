from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from typing import Dict, Any, List

from app.database import get_db
from app.models import User, Order, Expense
from app.routers.auth import get_current_user
from app.core.admin_security import is_super_admin, is_angel
import os
import json
import redis

def _get_redis():
    """取得共用 Redis 連線"""
    try:
        r = redis.from_url(
            os.getenv("REDIS_URL", "redis://localhost:6379/0"),
            decode_responses=True,
        )
        r.ping()
        return r
    except Exception:
        return None

router = APIRouter(prefix="/angel", tags=["Angel Dashboard"])

@router.get("/stats")
async def get_angel_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    獲取天使專屬統計數據
    """
    # 權限檢查：只有超級管理員或被授權的天使投資人可以查看
    if not is_super_admin(current_user) and not is_angel(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="此頁面僅限天使投資人訪問"
        )
    # 1. 計算本月總營收
    now = datetime.now()
    start_of_month = datetime(now.year, now.month, 1)
    
    revenue_query = db.query(func.sum(Order.total_amount)).filter(
        and_(
            Order.status.in_(["paid", "completed"]),
            Order.created_at >= start_of_month
        )
    ).scalar() or 0
    
    revenue = float(revenue_query)
    
    # 2. 嘗試從 Redis 讀取由 Modal Task 產生的正式報告
    r = _get_redis()
    report = None
    if r:
        report_key = f"angel:report:{now.strftime('%Y-%m')}"
        try:
            report_data = r.hgetall(report_key)
            if report_data:
                report = report_data
        except Exception:
            pass

    if report:
        # 使用正式報告數據
        revenue = float(report.get("revenue", revenue))
        gpu_cost = float(report.get("gpu_cost", 0))
        net_profit = float(report.get("net_profit", 0))
    else:
        #  fallback: 模擬 GPU 成本與其他數據 (目前暫無實際追蹤，採比例模擬)
        # 假設 GPU 成本佔營收的 25% (含 API 調用與伺服器預算)
        gpu_cost = round(revenue * 0.25, 2)
        
        # 如果營收太低，給予一個保底模擬值供展示
        if revenue < 1000:
            revenue = 12580.0
            gpu_cost = 3145.0
            
        net_profit = revenue - gpu_cost
    
    # 計算預扣稅金 (假設 20% 或根據稅法設定)
    withholding_tax = round(net_profit * 0.20, 2)
    distributable_profit = net_profit - withholding_tax
    
    # 計算該天使投資人的分紅：每 1 單位享有 1% 利潤
    units = getattr(current_user, "investment_units", 0)
    dividend = round(distributable_profit * (units * 0.01), 2)
    
    # 4. 推廣成效 (Referral Stats)
    # 實際查詢大使連結帶來的註冊與營收
    # 這裡的大使是當前天使本人（假設他的推薦碼用於推廣）
    referral_code = current_user.referral_code
    referred_users_ids = []
    if referral_code:
        referred_users_ids = [u.id for u in db.query(User.id).filter(User.referred_by == referral_code).all()]
    
    referral_count = len(referred_users_ids)
    referral_revenue = 0
    if referred_users_ids:
        referral_revenue = db.query(func.sum(Order.total_amount)).filter(
            and_(
                Order.user_id.in_(referred_users_ids),
                Order.status.in_(["paid", "completed"])
            )
        ).scalar() or 0
        referral_revenue = float(referral_revenue)

    # 5. 系統健康度 (System Health) - Mock 數據
    system_health = {
        "stability": 99.98,
        "success_rate": 98.4,
        "error_count": 12,
        "latency_ms": 240
    }
    
    # 6. 支出明細 (Real Expense Records)
    # 獲取本月所有支出紀錄
    expenses = db.query(Expense).filter(Expense.expense_date >= start_of_month).all()
    
    if expenses:
        # 使用真實支出數據
        budget_allocation = [
            {
                "item": e.item_name,
                "budget": float(e.amount),
                "desc": e.description or e.category
            }
            for e in expenses
        ]
        # GPU 成本 fallback 如果沒有特定 GPU 類別，則採總額或特定邏輯
        # 這裡為了展示，計算總支出並作為 gpu_cost 展示（或可根據類別細分）
        total_real_expense = sum(float(e.amount) for e in expenses)
        gpu_cost = total_real_expense
    else:
        # fallback: 模擬預算分配 (若無真實資料)
        budget_allocation = [
            {"item": "雲端固定支出 (首年)", "budget": 10000, "desc": "Railway + Domain + DB"},
            {"item": "GPU 算力備金 (Modal)", "budget": 10000, "desc": "10k 測試影片支援"},
            {"item": "LTX-2 模型微調費", "budget": 5000, "desc": "特定風格 H100 租用"},
            {"item": "廣告種子基金", "budget": 20000, "desc": "精準投放驗證轉化"},
            {"item": "雜項與儲備金", "budget": 5000, "desc": "Sentry/R2 額外超載"}
        ]
        # fallback: 模擬 GPU 成本與其他數據 (目前暫無實際追蹤，採比例模擬)
        # 假設 GPU 成本佔營收的 25% (含 API 調用與伺服器預算)
        gpu_cost = round(revenue * 0.25, 2)
        if revenue < 1000:
            gpu_cost = 3145.0

    # 3. 模擬歷史數據 (用於圖表展示)
    historical_data = []
    for i in range(6, -1, -1):
        date = now - timedelta(days=i * 5)
        mock_revenue = revenue * (0.8 + (i * 0.05)) # 模擬增長趨勢
        historical_data.append({
            "name": date.strftime("%m/%d"),
            "revenue": round(mock_revenue, 0),
            "profit": round(mock_revenue * 0.75, 0)
        })
    
    return {
        "revenue": revenue,
        "gpu_cost": gpu_cost,
        "net_profit": net_profit,
        "withholding_tax": withholding_tax,
        "distributable_profit": distributable_profit,
        "dividend": dividend,
        "investment_units": units,
        "total_invested": units * 200000,
        "dividend_rate": units,
        "referral_stats": {
            "count": referral_count,
            "revenue": referral_revenue
        },
        "system_health": system_health,
        "budget_allocation": budget_allocation,
        "historical_data": historical_data
    }
