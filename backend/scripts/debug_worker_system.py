
import os
import sys
import time
from celery import Celery
from redis import Redis

# Ensure app path is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

def debug_worker():
    print("=== 🔍 Worker 系統全面查核 ===")
    
    # 1. 檢查環境變數
    print("\n[1] 檢查環境變數...")
    redis_url = os.getenv("REDIS_URL")
    video_redis_url = os.getenv("VIDEO_REDIS_URL")
    gcp_project = os.getenv("GOOGLE_CLOUD_PROJECT")
    
    print(f"  - REDIS_URL: {'已設定' if redis_url else '❌ 未設定'}")
    print(f"  - VIDEO_REDIS_URL: {'已設定' if video_redis_url else '⚠️ 未設定 (將使用預設)'}")
    print(f"  - GOOGLE_CLOUD_PROJECT: {gcp_project or '❌ 未設定'}")

    # 2. Redis 連通性測試
    if redis_url:
        print("\n[2] 測試 Redis 連通性...")
        try:
            r = Redis.from_url(redis_url, socket_timeout=5)
            if r.ping():
                print("  ✅ 主 Redis 連線成功")
                # 檢查是否有 Celery 相關 Key
                keys = r.keys("celery*")
                print(f"  - 發現 {len(keys)} 個 Celery 相關 Key")
                
                # 檢查任務排隊情況
                for q in ["queue_default", "queue_high", "queue_video", "queue_analytics"]:
                    length = r.llen(q)
                    if length > 0:
                        print(f"  ⚠️ 佇列 {q} 目前有 {length} 個任務在排隊 (可能無人接手)")
                    else:
                        print(f"  - 佇列 {q} 目前無排隊任務")
            else:
                print("  ❌ Redis Ping 失敗")
        except Exception as e:
            print(f"  ❌ Redis 連線出錯: {e}")

    # 3. Celery Worker 存活檢查
    print("\n[3] 檢查 Celery Worker 存活狀態...")
    try:
        from app.celery_app import celery_app
        inspect = celery_app.control.inspect(timeout=10)
        ping_result = inspect.ping()
        
        if ping_result:
            print(f"  ✅ 發現 {len(ping_result)} 個在線 Worker:")
            for worker, status in ping_result.items():
                print(f"    - {worker}: {status}")
                
            # 檢查活躍任務
            active = inspect.active()
            if active:
                for worker, tasks in active.items():
                    print(f"    - {worker} 正在處理 {len(tasks)} 個任務")
            else:
                print("    - 目前沒有正在執行的活躍任務")
        else:
            print("  ❌ 警告: 沒有任何 Worker 回應 Ping！(這是卡住的主因)")
    except Exception as e:
        print(f"  ❌ Celery Inspect 出錯: {e}")

    print("\n=== 查核結束 ===")

if __name__ == "__main__":
    debug_worker()
