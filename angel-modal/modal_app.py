import os
import modal
from datetime import datetime

# Modal App Definition
app = modal.App("kingjam-angel-tasks")

# Environment setup
image = modal.Image.debian_slim().pip_install("redis")

# Constants matching user request
GPU_COST_PER_HOUR = 0.6  # 假設 L4 GPU 每小時 0.6 美元
SALES_TAX_RATE = 0.05    # 5% 營業稅
DIVIDEND_RATE = 0.01     # 1% 每位天使分紅

@app.function(
    image=image,
    schedule=modal.Cron("0 0 1 * *"), 
    secrets=[modal.Secret.from_name("upstash-secrets")]
)
def calculate_monthly_dividend():
    import redis
    
    # 建立 Redis 連線
    r = redis.Redis(
        host=os.environ["UPSTASH_HOST"], 
        password=os.environ["UPSTASH_TOKEN"], 
        port=os.environ["UPSTASH_PORT"], 
        decode_responses=True
    )

    # 1. 抓取上個月營收 (假設每筆訂單都會 HINCRBY monthly_revenue)
    # 注意：這裡預期應用程式邏輯會更新此 key
    total_revenue = float(r.get("stats:monthly_revenue") or 0)
    
    # 2. 抓取上個月 Modal GPU 使用量 (透過系統日誌或自定義計數器)
    # 這裡簡化為從 Redis 讀取累計的推論秒數
    total_inference_seconds = float(r.get("stats:total_inference_seconds") or 0)
    gpu_cost = (total_inference_seconds / 3600) * GPU_COST_PER_HOUR
    
    # 3. 計算淨利與稅金
    tax_amount = total_revenue * SALES_TAX_RATE
    net_profit = total_revenue - gpu_cost - tax_amount
    
    # 4. 計算單一天使應得金額
    angel_dividend = max(0, net_profit * DIVIDEND_RATE)

    # 5. 更新天使專屬數據集，供前端讀取
    # 儲存報告到 Redis，方便後端 /angel/stats 讀取（如果需要的話）
    report_key = f"angel:report:{datetime.now().strftime('%Y-%m')}"
    r.hset(report_key, mapping={
        "revenue": total_revenue,
        "gpu_cost": gpu_cost,
        "tax": tax_amount,
        "net_profit": net_profit,
        "dividend_per_angel": angel_dividend,
        "calculated_at": datetime.now().isoformat()
    })
    
    # 重置本月計數器（可選，視乎業務需求）
    # r.set("stats:monthly_revenue", 0)
    # r.set("stats:total_inference_seconds", 0)
    
    print(f"✅ {datetime.now().strftime('%Y-%m')} 利潤結算完成：NT$ {net_profit}")
    return {
        "report_key": report_key,
        "net_profit": net_profit,
        "angel_dividend": angel_dividend
    }

@app.local_entrypoint()
def test_calc():
    """本地測試入口"""
    print("正在執行本地測試...")
    res = calculate_monthly_dividend.local()
    print(f"測試結果: {res}")
