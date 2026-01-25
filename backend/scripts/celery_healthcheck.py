#!/usr/bin/env python3
"""
Celery Worker 健康檢查腳本
用於 Docker healthcheck

用法: python celery_healthcheck.py [queue_name]
"""

import sys
import os

# 設置 Python 路徑
sys.path.insert(0, '/app')

def check_worker(queue_name: str = None) -> bool:
    """
    檢查指定佇列的 worker 是否在線
    """
    try:
        from app.celery_app import celery_app
        
        inspect = celery_app.control.inspect(timeout=5)
        ping_result = inspect.ping() or {}
        
        if not ping_result:
            print("ERROR: No workers responding")
            return False
        
        if queue_name:
            # 檢查特定佇列的 worker
            for worker_id in ping_result.keys():
                if queue_name in worker_id:
                    print(f"OK: {worker_id} is alive")
                    return True
            print(f"ERROR: No worker for queue {queue_name}")
            return False
        else:
            # 任意 worker 在線即可
            print(f"OK: {len(ping_result)} worker(s) alive")
            return True
            
    except Exception as e:
        print(f"ERROR: {e}")
        return False


if __name__ == "__main__":
    queue = sys.argv[1] if len(sys.argv) > 1 else None
    success = check_worker(queue)
    sys.exit(0 if success else 1)
