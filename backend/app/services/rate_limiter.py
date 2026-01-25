"""
任務速率限制服務
防止單一用戶佔用過多資源，預防 OOM

功能：
- 用戶級別並發任務限制
- 全局任務佇列長度限制
- 記憶體使用監控
"""

import logging
from typing import Optional
from datetime import datetime, timedelta
import redis
import os

logger = logging.getLogger(__name__)


class VideoTaskRateLimiter:
    """
    影片任務速率限制器
    
    使用 Redis 實現分布式限流
    """
    
    # 限制配置（測試期間放寬限制）
    MAX_CONCURRENT_PER_USER = 3  # 每用戶最大並發任務數
    MAX_TASKS_PER_HOUR_PER_USER = 50  # 每用戶每小時最大任務數
    MAX_GLOBAL_QUEUE_SIZE = 100  # 全局佇列最大長度
    TASK_TIMEOUT_SECONDS = 1800  # 任務超時時間（30分鐘）
    
    # Redis Key 前綴
    KEY_PREFIX = "video_rate_limit:"
    USER_CONCURRENT_KEY = KEY_PREFIX + "user_concurrent:{user_id}"
    USER_HOURLY_KEY = KEY_PREFIX + "user_hourly:{user_id}"
    GLOBAL_QUEUE_KEY = KEY_PREFIX + "global_queue"
    
    def __init__(self):
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self._redis: Optional[redis.Redis] = None
    
    @property
    def redis_client(self) -> redis.Redis:
        """懶加載 Redis 連接"""
        if self._redis is None:
            self._redis = redis.from_url(self.redis_url, decode_responses=True)
        return self._redis
    
    def can_submit_task(self, user_id: int) -> tuple[bool, str]:
        """
        檢查用戶是否可以提交新任務
        
        Returns:
            (can_submit, reason)
        """
        try:
            # 1. 檢查全局佇列長度
            global_queue_size = self.redis_client.scard(self.GLOBAL_QUEUE_KEY)
            if global_queue_size >= self.MAX_GLOBAL_QUEUE_SIZE:
                return False, f"系統繁忙，請稍後再試（佇列已滿：{global_queue_size}/{self.MAX_GLOBAL_QUEUE_SIZE}）"
            
            # 2. 檢查用戶並發任務數
            user_concurrent_key = self.USER_CONCURRENT_KEY.format(user_id=user_id)
            current_concurrent = self.redis_client.scard(user_concurrent_key)
            if current_concurrent >= self.MAX_CONCURRENT_PER_USER:
                return False, f"您有 {current_concurrent} 個影片正在處理中，請等待完成後再提交"
            
            # 3. 檢查用戶每小時限額
            user_hourly_key = self.USER_HOURLY_KEY.format(user_id=user_id)
            hourly_count = self.redis_client.get(user_hourly_key)
            if hourly_count and int(hourly_count) >= self.MAX_TASKS_PER_HOUR_PER_USER:
                return False, f"您本小時已提交 {hourly_count} 個影片任務，請稍後再試"
            
            return True, "OK"
            
        except redis.RedisError as e:
            logger.error(f"[RateLimiter] Redis 錯誤: {e}")
            # Redis 故障時允許通過（降級策略）
            return True, "OK"
    
    def register_task(self, user_id: int, task_id: str) -> bool:
        """
        註冊新任務
        
        Returns:
            是否成功註冊
        """
        try:
            pipe = self.redis_client.pipeline()
            
            # 1. 添加到用戶並發集合
            user_concurrent_key = self.USER_CONCURRENT_KEY.format(user_id=user_id)
            pipe.sadd(user_concurrent_key, task_id)
            pipe.expire(user_concurrent_key, self.TASK_TIMEOUT_SECONDS)
            
            # 2. 增加用戶每小時計數
            user_hourly_key = self.USER_HOURLY_KEY.format(user_id=user_id)
            pipe.incr(user_hourly_key)
            pipe.expire(user_hourly_key, 3600)  # 1小時過期
            
            # 3. 添加到全局佇列
            pipe.sadd(self.GLOBAL_QUEUE_KEY, task_id)
            pipe.expire(self.GLOBAL_QUEUE_KEY, self.TASK_TIMEOUT_SECONDS)
            
            pipe.execute()
            
            logger.info(f"[RateLimiter] 任務已註冊 - user={user_id}, task={task_id}")
            return True
            
        except redis.RedisError as e:
            logger.error(f"[RateLimiter] 註冊任務失敗: {e}")
            return False
    
    def complete_task(self, user_id: int, task_id: str) -> bool:
        """
        完成任務（釋放配額）
        """
        try:
            pipe = self.redis_client.pipeline()
            
            # 從用戶並發集合移除
            user_concurrent_key = self.USER_CONCURRENT_KEY.format(user_id=user_id)
            pipe.srem(user_concurrent_key, task_id)
            
            # 從全局佇列移除
            pipe.srem(self.GLOBAL_QUEUE_KEY, task_id)
            
            pipe.execute()
            
            logger.info(f"[RateLimiter] 任務已完成 - user={user_id}, task={task_id}")
            return True
            
        except redis.RedisError as e:
            logger.error(f"[RateLimiter] 完成任務失敗: {e}")
            return False
    
    def get_user_stats(self, user_id: int) -> dict:
        """
        獲取用戶任務統計
        """
        try:
            user_concurrent_key = self.USER_CONCURRENT_KEY.format(user_id=user_id)
            user_hourly_key = self.USER_HOURLY_KEY.format(user_id=user_id)
            
            concurrent = self.redis_client.scard(user_concurrent_key)
            hourly = self.redis_client.get(user_hourly_key) or 0
            global_queue = self.redis_client.scard(self.GLOBAL_QUEUE_KEY)
            
            return {
                "concurrent_tasks": concurrent,
                "max_concurrent": self.MAX_CONCURRENT_PER_USER,
                "hourly_tasks": int(hourly),
                "max_hourly": self.MAX_TASKS_PER_HOUR_PER_USER,
                "global_queue_size": global_queue,
                "max_global_queue": self.MAX_GLOBAL_QUEUE_SIZE,
            }
            
        except redis.RedisError as e:
            logger.error(f"[RateLimiter] 獲取統計失敗: {e}")
            return {}
    
    def get_system_status(self) -> dict:
        """
        獲取系統狀態
        """
        try:
            global_queue = self.redis_client.scard(self.GLOBAL_QUEUE_KEY)
            
            # 嘗試獲取記憶體信息
            memory_info = {}
            try:
                import psutil
                mem = psutil.virtual_memory()
                memory_info = {
                    "memory_percent": mem.percent,
                    "memory_available_gb": round(mem.available / (1024**3), 2),
                    "memory_total_gb": round(mem.total / (1024**3), 2),
                }
            except ImportError:
                pass
            
            return {
                "global_queue_size": global_queue,
                "max_global_queue": self.MAX_GLOBAL_QUEUE_SIZE,
                "queue_utilization": f"{(global_queue / self.MAX_GLOBAL_QUEUE_SIZE) * 100:.1f}%",
                **memory_info,
            }
            
        except redis.RedisError as e:
            logger.error(f"[RateLimiter] 獲取系統狀態失敗: {e}")
            return {}
    
    def get_global_count(self) -> int:
        """
        獲取全局佇列中的任務數
        """
        try:
            return self.redis_client.scard(self.GLOBAL_QUEUE_KEY) or 0
        except redis.RedisError as e:
            logger.error(f"[RateLimiter] 獲取全局計數失敗: {e}")
            return 0
    
    def get_user_task_count(self, user_id: int) -> int:
        """
        獲取用戶當前的並發任務數
        """
        try:
            user_concurrent_key = self.USER_CONCURRENT_KEY.format(user_id=user_id)
            return self.redis_client.scard(user_concurrent_key) or 0
        except redis.RedisError as e:
            logger.error(f"[RateLimiter] 獲取用戶任務數失敗: {e}")
            return 0


# 全局實例
video_rate_limiter = VideoTaskRateLimiter()
