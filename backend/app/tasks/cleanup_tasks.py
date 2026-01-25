"""
媒體清理任務
定時清理過期檔案，控制儲存成本
"""

import logging
from datetime import datetime
from typing import Dict, Any

from app.celery_app import celery_app
from app.services.lifecycle_manager import lifecycle_manager

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.tasks.cleanup_tasks.cleanup_expired_media",
    queue="queue_default",
    bind=True,
    max_retries=1,
    soft_time_limit=1800,  # 30 分鐘
    time_limit=2100,  # 35 分鐘
)
def cleanup_expired_media(self, dry_run: bool = False) -> Dict[str, Any]:
    """
    清理過期媒體任務
    
    建議排程：每天凌晨 4 點執行
    
    Args:
        dry_run: 若為 True，只統計不實際刪除
    
    Returns:
        清理報告
    """
    logger.info(f"[Cleanup] 開始執行媒體清理任務 (dry_run={dry_run})")
    
    try:
        report = lifecycle_manager.cleanup_expired_media(dry_run=dry_run)
        
        # 記錄結果
        if report.get("success"):
            logger.info(
                f"[Cleanup] 清理完成 - "
                f"本地: {report['local_files_cleaned']} 檔案 ({report['local_bytes_freed'] / 1024 / 1024:.2f} MB), "
                f"雲端: {report['cloud_files_cleaned']} 檔案, "
                f"DB: {report['db_records_updated']} 筆"
            )
        else:
            logger.error(f"[Cleanup] 清理失敗: {report.get('errors')}")
        
        return report
        
    except Exception as e:
        logger.error(f"[Cleanup] 任務執行失敗: {e}")
        raise self.retry(exc=e, countdown=300)  # 5 分鐘後重試


@celery_app.task(
    name="app.tasks.cleanup_tasks.get_storage_stats",
    queue="queue_default",
)
def get_storage_stats() -> Dict[str, Any]:
    """
    獲取儲存統計
    """
    return lifecycle_manager.get_storage_stats()


@celery_app.task(
    name="app.tasks.cleanup_tasks.cleanup_local_temp_files",
    queue="queue_default",
    bind=True,
)
def cleanup_local_temp_files(self) -> Dict[str, Any]:
    """
    清理本地臨時檔案
    
    包括：
    - FFmpeg 臨時檔案
    - TTS 臨時音檔
    - 未完成的上傳
    """
    import os
    import glob
    from pathlib import Path
    
    result = {
        "deleted": 0,
        "bytes_freed": 0,
        "details": [],
    }
    
    temp_patterns = [
        "/app/static/videos/temp_*",
        "/app/static/videos/*.part",
        "/app/output/*.mp3",
        "/app/output/*.wav",
        "/tmp/ffmpeg_*",
        "/tmp/tts_*",
    ]
    
    for pattern in temp_patterns:
        for filepath in glob.glob(pattern):
            try:
                if os.path.isfile(filepath):
                    age_hours = (datetime.now().timestamp() - os.path.getmtime(filepath)) / 3600
                    
                    # 只清理超過 24 小時的臨時檔案
                    if age_hours > 24:
                        size = os.path.getsize(filepath)
                        os.remove(filepath)
                        result["deleted"] += 1
                        result["bytes_freed"] += size
                        result["details"].append({
                            "file": filepath,
                            "age_hours": round(age_hours, 1),
                        })
            except Exception as e:
                logger.warning(f"清理臨時檔案失敗 {filepath}: {e}")
    
    logger.info(f"[Cleanup] 臨時檔案清理完成 - {result['deleted']} 檔案")
    return result
