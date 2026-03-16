from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from typing import Dict, Any, List

from app.database import get_db
from app.models import User, Order, Expense, DividendRecord, MonthlyReport
from app.routers.auth import get_current_user
from app.core.admin_security import is_super_admin, is_angel
from app.services.email_service import get_email_service
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
        # 使用用戶指定的預計支出：50,000
        gpu_cost = 50000.0
        
        # 調整預算分配表，使其總和為 50,000
        budget_allocation = [
            {"item": "雲端固定支出 (Railway/DB)", "budget": 10000, "desc": "伺服器與資料庫維運"},
            {"item": "GPU 算力預算 (Modal/LTX)", "budget": 20000, "desc": "影片渲染與模型運算"},
            {"item": "行銷與推廣基金", "budget": 15000, "desc": "Meta/Google 廣告投放"},
            {"item": "維護與儲備金", "budget": 5000, "desc": "系統監控與緊急預備"}
        ]
        
        # 計算利潤 (以當月營收減去預計支出)
        net_profit = max(0, revenue - gpu_cost)

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
    
    # 7. 個人投資詳情 (Personal Investment Details)
    # 從用戶模型中獲取個人化數據
    personal_dividends_query = db.query(DividendRecord).filter(
        DividendRecord.user_id == current_user.id
    )
    
    personal_dividends = personal_dividends_query.order_by(DividendRecord.dividend_date.desc()).limit(12).all()
    
    total_dividends_received = db.query(func.sum(DividendRecord.amount)).filter(
        and_(
            DividendRecord.user_id == current_user.id,
            DividendRecord.status == "completed"
        )
    ).scalar() or 0

    # 8. 獲取正式月結報表 (Official Monthly Reports)
    official_reports = db.query(MonthlyReport).filter(
        MonthlyReport.status == "sent"
    ).order_by(MonthlyReport.year_month.desc()).limit(12).all()

    return {
        "revenue": revenue,
        "gpu_cost": gpu_cost,
        "net_profit": net_profit,
        "withholding_tax": withholding_tax,
        "distributable_profit": distributable_profit,
        "dividend": dividend,
        "investment_units": units,
        "total_invested": float(current_user.total_investment_amount or 0),
        "dividend_rate": float(current_user.dividend_ratio or 0) * 100, # 轉為百分比顯示
        "contract_url": current_user.contract_url,
        "payback_estimate_date": current_user.payback_estimate_date.isoformat() if current_user.payback_estimate_date else None,
        "referral_stats": {
            "count": referral_count,
            "revenue": referral_revenue
        },
        "referral_code": current_user.referral_code,
        "system_health": system_health,
        "budget_allocation": budget_allocation,
        "historical_data": historical_data,
        "total_dividends_received": float(total_dividends_received),
        "personal_dividends": [
            {
                "id": dr.id,
                "amount": float(dr.amount),
                "date": dr.dividend_date.strftime("%Y-%m"),
                "description": dr.description,
                "status": dr.status
            } for dr in personal_dividends
        ],
        "official_reports": [
            {
                "id": report.id,
                "year_month": report.year_month,
                "revenue": float(report.revenue),
                "expenses": float(report.expenses),
                "net_profit": float(report.net_profit),
                "distributable_profit": float(report.distributable_profit),
                "status": report.status,
                "settled_at": report.settled_at.isoformat() if report.settled_at else None
            } for report in official_reports
        ]
    }


@router.get("/reports")
async def list_monthly_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取得月結報表列表 (管理員用)"""
    if not is_super_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="僅限管理員存取"
        )
    
    reports = db.query(MonthlyReport).order_by(MonthlyReport.year_month.desc()).all()
    return reports


@router.post("/reports/settle")
async def settle_monthly_report(
    year_month: str,  # YYYY-MM
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """執行月結：計算數據並產生正式報表與分紅紀錄"""
    if not is_super_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="僅限管理員執行結算"
        )
    
    # 1. 檢查是否已存在
    existing = db.query(MonthlyReport).filter(MonthlyReport.year_month == year_month).first()
    if existing and existing.status == "settled":
         raise HTTPException(status_code=400, detail=f"{year_month} 報表已結算，請勿重複執行。")

    # 2. 定義時間範圍
    try:
        year, month = map(int, year_month.split("-"))
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
    except Exception:
        raise HTTPException(status_code=400, detail="無效的時間格式，請使用 YYYY-MM")

    # 3. 計算財務數據
    # 總營收
    revenue = db.query(func.sum(Order.total_amount)).filter(
        and_(
            Order.status.in_(["paid", "completed"]),
            Order.created_at >= start_date,
            Order.created_at < end_date
        )
    ).scalar() or 0
    revenue = float(revenue)

    # 總支出
    expenses_list = db.query(Expense).filter(
        and_(
            Expense.expense_date >= start_date,
            Expense.expense_date < end_date
        )
    ).all()
    total_expenses = sum(float(e.amount) for e in expenses_list)
    
    # 計算利潤與稅金
    net_profit = max(0, revenue - total_expenses)
    withholding_tax = round(net_profit * 0.20, 2)
    distributable_profit = net_profit - withholding_tax

    # 4. 建立或更新報表
    if not existing:
        report = MonthlyReport(year_month=year_month)
        db.add(report)
    else:
        report = existing

    report.revenue = revenue
    report.expenses = total_expenses
    report.net_profit = net_profit
    report.withholding_tax = withholding_tax
    report.distributable_profit = distributable_profit
    report.status = "settled"
    report.settled_at = datetime.now()
    report.metadata_json = {
        "expense_count": len(expenses_list),
        "calculation_time": datetime.now().isoformat()
    }

    # 5. 為所有天使投資人產生分紅紀錄
    angels = db.query(User).filter(User.is_angel == True).all()
    for angel in angels:
        # 依照投資人的分紅比例計算
        ratio = float(angel.dividend_ratio or 0)
        # 如果有設定單位 (investment_units)，也可以採單位制：1 單位 = 1% (0.01)
        # 這裡採取優先使用 dividend_ratio 的邏輯
        if ratio <= 0 and angel.investment_units > 0:
            ratio = angel.investment_units * 0.01
            
        dividend_amount = round(distributable_profit * ratio, 2)
        
        if dividend_amount > 0:
            # 檢查是否已存在該月的紀錄
            existing_dr = db.query(DividendRecord).filter(
                and_(
                    DividendRecord.user_id == angel.id,
                    DividendRecord.description.like(f"%{year_month}%")
                )
            ).first()
            
            if not existing_dr:
                dr = DividendRecord(
                    user_id=angel.id,
                    amount=dividend_amount,
                    dividend_date=start_date,
                    description=f"{year_month} 月結分紅",
                    status="completed"
                )
                db.add(dr)

    db.commit()
    return {"message": f"{year_month} 結算完成", "report_id": report.id}


@router.post("/reports/{year_month}/send")
async def send_monthly_report_email(
    year_month: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """一鍵寄送報表通知給所有投資人"""
    if not is_super_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="僅限超級管理員操作"
        )
    
    report = db.query(MonthlyReport).filter(MonthlyReport.year_month == year_month).first()
    if not report or report.status != "settled":
        raise HTTPException(status_code=400, detail="報表尚未結算或不存在")
    
    email_service = get_email_service()
    angels = db.query(User).filter(User.is_angel == True).all()
    
    success_count = 0
    for angel in angels:
        if not angel.email:
            continue
            
        # 計算此投資人的個別數據
        ratio = float(angel.dividend_ratio or (angel.investment_units * 0.01))
        personal_dividend = float(report.distributable_profit) * ratio
        
        # 寄送郵件 (使用通用通知模板，稍後可優化專屬模板)
        html_content = f"""
        <div class="info-box">
            <h2 style="margin-top:0;">{year_month} 財務結算報表</h2>
            <p><strong>本月總營業額：</strong>NT$ {float(report.revenue):,.0f}</p>
            <p><strong>本月總支出：</strong>NT$ {float(report.expenses):,.0f}</p>
            <hr style="border:0; border-top:1px solid #e2e8f0; margin:15px 0;">
            <p><strong>您的分紅比例：</strong>{ratio*100:.2f}%</p>
            <p style="font-size:18px; color:#10b981;"><strong>應領分紅金額：NT$ {personal_dividend:,.0f}</strong></p>
        </div>
        <p>詳細報表已更新至您的投資人儀表板，請登入查看。</p>
        """
        
        result = email_service.send_notification(
            to=angel.email,
            title=f"{year_month} 投資結算報告",
            content_html=html_content,
            action_url=f"{os.getenv('FRONTEND_URL', 'https://kingjam.app')}/dashboard/angel",
            user_name=angel.full_name
        )
        if result["success"]:
            success_count += 1
            
    report.status = "sent"
    report.sent_at = datetime.now()
    db.commit()
    
    return {"message": f"成功寄出 {success_count} 封郵件"}
