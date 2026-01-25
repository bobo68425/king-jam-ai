#!/usr/bin/env python3
"""
影片 Worker 自動擴展腳本

功能：
- 監控影片佇列長度
- 當佇列 > 10 時自動擴展 Worker
- 當佇列為空且多餘 Worker 閒置時自動縮減
- 支援 Docker Compose 和 Kubernetes

使用方式：
  python scripts/video_autoscaler.py --mode monitor  # 持續監控
  python scripts/video_autoscaler.py --mode scale --replicas 3  # 手動擴展
  python scripts/video_autoscaler.py --mode status  # 查看狀態

環境變數：
  VIDEO_REDIS_URL: 影片 Redis 連接 URL
  MIN_WORKERS: 最小 Worker 數（預設 1）
  MAX_WORKERS: 最大 Worker 數（預設 5）
  SCALE_UP_THRESHOLD: 擴展閾值（預設 10）
  SCALE_DOWN_THRESHOLD: 縮減閾值（預設 0）
  CHECK_INTERVAL: 檢查間隔秒數（預設 60）
"""

import os
import sys
import time
import json
import argparse
import subprocess
import logging
from datetime import datetime
from typing import Dict, Optional, Tuple

# 添加專案路徑
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import redis

# ============================================================
# 配置
# ============================================================
VIDEO_REDIS_URL = os.getenv("VIDEO_REDIS_URL", "redis://localhost:6380/0")
MIN_WORKERS = int(os.getenv("MIN_WORKERS", "1"))
MAX_WORKERS = int(os.getenv("MAX_WORKERS", "5"))
SCALE_UP_THRESHOLD = int(os.getenv("SCALE_UP_THRESHOLD", "10"))
SCALE_DOWN_THRESHOLD = int(os.getenv("SCALE_DOWN_THRESHOLD", "0"))
CHECK_INTERVAL = int(os.getenv("CHECK_INTERVAL", "60"))
COOLDOWN_PERIOD = int(os.getenv("COOLDOWN_PERIOD", "300"))  # 擴縮容冷卻期（秒）

# 日誌配置
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)


class VideoAutoscaler:
    """影片 Worker 自動擴展器"""
    
    def __init__(self):
        self.redis_client = self._connect_redis()
        self.last_scale_time = 0
        self.current_replicas = MIN_WORKERS
        
    def _connect_redis(self) -> redis.Redis:
        """連接 Redis"""
        try:
            client = redis.from_url(VIDEO_REDIS_URL, decode_responses=True)
            client.ping()
            logger.info(f"✅ 已連接影片 Redis: {VIDEO_REDIS_URL}")
            return client
        except Exception as e:
            logger.error(f"❌ 無法連接影片 Redis: {e}")
            raise
    
    def get_queue_stats(self) -> Dict:
        """獲取佇列統計"""
        stats = {
            "queue_length": 0,
            "active_tasks": 0,
            "reserved_tasks": 0,
            "workers": [],
            "timestamp": datetime.now().isoformat()
        }
        
        try:
            # 獲取佇列長度（Celery 使用 list）
            queue_length = self.redis_client.llen("queue_video")
            stats["queue_length"] = queue_length
            
            # 獲取活躍任務（從 Celery task meta）
            active_keys = self.redis_client.keys("celery-task-meta-*")
            stats["active_tasks"] = len(active_keys)
            
            # 獲取 Worker 資訊（從 Celery worker heartbeat）
            worker_keys = self.redis_client.keys("celery@*")
            for key in worker_keys:
                if "video" in key.lower():
                    stats["workers"].append(key)
            
        except Exception as e:
            logger.error(f"獲取佇列統計失敗: {e}")
        
        return stats
    
    def get_current_replicas(self) -> int:
        """獲取當前 Worker 副本數"""
        try:
            result = subprocess.run(
                ["docker", "compose", "ps", "--format", "json", "celery-worker-video"],
                capture_output=True,
                text=True,
                cwd=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            )
            if result.returncode == 0:
                containers = result.stdout.strip().split("\n")
                running = sum(1 for c in containers if c and "running" in c.lower())
                return max(running, 1)
        except Exception as e:
            logger.warning(f"獲取副本數失敗: {e}")
        
        return self.current_replicas
    
    def scale_workers(self, replicas: int) -> bool:
        """擴展 Worker 數量"""
        # 限制範圍
        replicas = max(MIN_WORKERS, min(MAX_WORKERS, replicas))
        
        # 檢查冷卻期
        if time.time() - self.last_scale_time < COOLDOWN_PERIOD:
            remaining = COOLDOWN_PERIOD - (time.time() - self.last_scale_time)
            logger.info(f"⏳ 冷卻期中，剩餘 {remaining:.0f} 秒")
            return False
        
        current = self.get_current_replicas()
        if current == replicas:
            logger.info(f"ℹ️ 副本數已是 {replicas}，無需調整")
            return True
        
        try:
            logger.info(f"🔄 擴展 Video Worker: {current} → {replicas}")
            
            result = subprocess.run(
                ["docker", "compose", "up", "-d", "--scale", f"celery-worker-video={replicas}"],
                capture_output=True,
                text=True,
                cwd=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            )
            
            if result.returncode == 0:
                self.current_replicas = replicas
                self.last_scale_time = time.time()
                logger.info(f"✅ 擴展成功！當前 {replicas} 個 Video Worker")
                
                # 發送通知（可選）
                self._send_notification(f"Video Worker 已擴展至 {replicas} 個實例")
                return True
            else:
                logger.error(f"❌ 擴展失敗: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"❌ 擴展異常: {e}")
            return False
    
    def calculate_desired_replicas(self, queue_length: int) -> int:
        """計算期望的副本數"""
        if queue_length <= SCALE_DOWN_THRESHOLD:
            return MIN_WORKERS
        
        if queue_length > SCALE_UP_THRESHOLD:
            # 每 10 個任務增加 1 個 Worker
            extra_workers = (queue_length - SCALE_UP_THRESHOLD) // 10 + 1
            return min(MIN_WORKERS + extra_workers, MAX_WORKERS)
        
        return self.current_replicas
    
    def _send_notification(self, message: str):
        """發送通知（可接入 Slack/Line）"""
        # TODO: 接入告警通知
        logger.info(f"📢 {message}")
    
    def monitor(self):
        """持續監控並自動擴縮"""
        logger.info("🚀 開始監控影片佇列...")
        logger.info(f"   配置: MIN={MIN_WORKERS}, MAX={MAX_WORKERS}, 擴展閾值={SCALE_UP_THRESHOLD}")
        
        while True:
            try:
                stats = self.get_queue_stats()
                queue_length = stats["queue_length"]
                current = self.get_current_replicas()
                desired = self.calculate_desired_replicas(queue_length)
                
                logger.info(
                    f"📊 佇列: {queue_length} | "
                    f"Workers: {current}/{MAX_WORKERS} | "
                    f"期望: {desired}"
                )
                
                if desired != current:
                    self.scale_workers(desired)
                
            except Exception as e:
                logger.error(f"監控異常: {e}")
            
            time.sleep(CHECK_INTERVAL)
    
    def status(self) -> Dict:
        """獲取完整狀態"""
        stats = self.get_queue_stats()
        stats["current_replicas"] = self.get_current_replicas()
        stats["min_workers"] = MIN_WORKERS
        stats["max_workers"] = MAX_WORKERS
        stats["scale_up_threshold"] = SCALE_UP_THRESHOLD
        stats["scale_down_threshold"] = SCALE_DOWN_THRESHOLD
        return stats


def main():
    parser = argparse.ArgumentParser(description="影片 Worker 自動擴展器")
    parser.add_argument(
        "--mode",
        choices=["monitor", "scale", "status"],
        default="status",
        help="運行模式"
    )
    parser.add_argument(
        "--replicas",
        type=int,
        default=None,
        help="手動指定副本數（僅 scale 模式）"
    )
    
    args = parser.parse_args()
    
    autoscaler = VideoAutoscaler()
    
    if args.mode == "monitor":
        autoscaler.monitor()
    
    elif args.mode == "scale":
        if args.replicas is None:
            print("錯誤: scale 模式需要指定 --replicas")
            sys.exit(1)
        success = autoscaler.scale_workers(args.replicas)
        sys.exit(0 if success else 1)
    
    elif args.mode == "status":
        status = autoscaler.status()
        print(json.dumps(status, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
