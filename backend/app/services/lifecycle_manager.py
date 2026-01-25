"""
媒體檔案生命週期管理服務
自動清理過期檔案，控制儲存成本

保留期限：
- 短影片（非排程）: 7 天
- 圖片（非排程）: 14 天
- 排程媒體: 30 天
- 縮圖: 與原檔案相同
"""

import os
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from pathlib import Path

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import GenerationHistory, ScheduledPost

logger = logging.getLogger(__name__)


class MediaLifecycleManager:
    """
    媒體檔案生命週期管理器
    
    功能：
    - 自動清理過期的本地檔案
    - 自動清理過期的雲端檔案
    - 更新資料庫記錄
    - 生成清理報告
    """
    
    # 保留期限配置（天）
    RETENTION_POLICIES = {
        "short_video": 7,       # 短影片
        "social_image": 14,     # 社群圖片
        "blog_post": 14,        # 部落格圖片
        "scheduled": 30,        # 排程媒體
        "thumbnail": None,      # 縮圖跟隨原檔案
    }
    
    # 本地目錄配置
    LOCAL_DIRS = {
        "videos": "/app/static/videos",
        "thumbnails": "/app/static/thumbnails",
        "uploads": "/app/static/uploads",
    }
    
    def __init__(self):
        self._cloud_storage = None
    
    @property
    def cloud_storage(self):
        """懶加載雲端儲存服務"""
        if self._cloud_storage is None:
            try:
                from app.services.cloud_storage import cloud_storage
                self._cloud_storage = cloud_storage
            except ImportError:
                logger.warning("雲端儲存服務未配置")
        return self._cloud_storage
    
    def get_retention_days(self, generation_type: str, is_scheduled: bool = False) -> int:
        """
        獲取保留天數
        
        Args:
            generation_type: 生成類型 (short_video, social_image, blog_post)
            is_scheduled: 是否為排程媒體
        """
        if is_scheduled:
            return self.RETENTION_POLICIES["scheduled"]
        return self.RETENTION_POLICIES.get(generation_type, 7)
    
    def cleanup_expired_media(self, dry_run: bool = False) -> Dict:
        """
        清理所有過期媒體
        
        Args:
            dry_run: 若為 True，只統計不實際刪除
        
        Returns:
            清理報告
        """
        logger.info(f"[Lifecycle] 開始清理過期媒體 (dry_run={dry_run})")
        
        report = {
            "start_time": datetime.utcnow().isoformat(),
            "dry_run": dry_run,
            "local_files_cleaned": 0,
            "local_bytes_freed": 0,
            "cloud_files_cleaned": 0,
            "db_records_updated": 0,
            "errors": [],
            "details": [],
        }
        
        db = SessionLocal()
        
        try:
            # 1. 清理過期的生成歷史檔案
            history_result = self._cleanup_generation_history(db, dry_run)
            report["local_files_cleaned"] += history_result["local_deleted"]
            report["local_bytes_freed"] += history_result["bytes_freed"]
            report["cloud_files_cleaned"] += history_result["cloud_deleted"]
            report["db_records_updated"] += history_result["db_updated"]
            report["details"].extend(history_result["details"])
            if history_result.get("errors"):
                report["errors"].extend(history_result["errors"])
            
            # 2. 清理過期的排程媒體
            scheduled_result = self._cleanup_scheduled_media(db, dry_run)
            report["local_files_cleaned"] += scheduled_result["local_deleted"]
            report["local_bytes_freed"] += scheduled_result["bytes_freed"]
            report["cloud_files_cleaned"] += scheduled_result["cloud_deleted"]
            report["db_records_updated"] += scheduled_result["db_updated"]
            report["details"].extend(scheduled_result["details"])
            if scheduled_result.get("errors"):
                report["errors"].extend(scheduled_result["errors"])
            
            # 3. 清理孤立的本地檔案（無資料庫記錄）
            orphan_result = self._cleanup_orphan_files(dry_run)
            report["local_files_cleaned"] += orphan_result["deleted"]
            report["local_bytes_freed"] += orphan_result["bytes_freed"]
            report["details"].extend(orphan_result["details"])
            
            report["end_time"] = datetime.utcnow().isoformat()
            report["success"] = True
            
            logger.info(
                f"[Lifecycle] 清理完成 - 本地: {report['local_files_cleaned']} 檔案 "
                f"({report['local_bytes_freed'] / 1024 / 1024:.2f} MB), "
                f"雲端: {report['cloud_files_cleaned']} 檔案"
            )
            
        except Exception as e:
            logger.error(f"[Lifecycle] 清理失敗: {e}")
            report["success"] = False
            report["errors"].append(str(e))
        finally:
            db.close()
        
        return report
    
    def _cleanup_generation_history(self, db: Session, dry_run: bool) -> Dict:
        """清理過期的生成歷史檔案"""
        result = {
            "local_deleted": 0,
            "cloud_deleted": 0,
            "bytes_freed": 0,
            "db_updated": 0,
            "details": [],
            "errors": [],
        }
        
        now = datetime.utcnow()
        
        # 遍歷不同類型的保留期限
        for gen_type, days in [
            ("short_video", self.RETENTION_POLICIES["short_video"]),
            ("social_image", self.RETENTION_POLICIES["social_image"]),
            ("blog_post", self.RETENTION_POLICIES["blog_post"]),
        ]:
            if days is None:
                continue
            
            cutoff_date = now - timedelta(days=days)
            
            # 查詢過期記錄
            expired_records = db.query(GenerationHistory).filter(
                and_(
                    GenerationHistory.generation_type == gen_type,
                    GenerationHistory.created_at < cutoff_date,
                    GenerationHistory.is_deleted == False,
                    or_(
                        GenerationHistory.media_local_path.isnot(None),
                        GenerationHistory.media_cloud_key.isnot(None),
                    )
                )
            ).all()
            
            for record in expired_records:
                try:
                    detail = {
                        "id": record.id,
                        "type": gen_type,
                        "created_at": record.created_at.isoformat(),
                        "age_days": (now - record.created_at).days,
                    }
                    
                    # 刪除本地檔案
                    if record.media_local_path and os.path.exists(record.media_local_path):
                        file_size = os.path.getsize(record.media_local_path)
                        if not dry_run:
                            os.remove(record.media_local_path)
                            record.media_local_path = None
                        result["local_deleted"] += 1
                        result["bytes_freed"] += file_size
                        detail["local_file"] = record.media_local_path
                        detail["file_size"] = file_size
                    
                    # 刪除縮圖
                    if record.thumbnail_url:
                        thumb_path = self._url_to_local_path(record.thumbnail_url)
                        if thumb_path and os.path.exists(thumb_path):
                            thumb_size = os.path.getsize(thumb_path)
                            if not dry_run:
                                os.remove(thumb_path)
                                record.thumbnail_url = None
                            result["bytes_freed"] += thumb_size
                    
                    # 刪除雲端檔案
                    if record.media_cloud_key and self.cloud_storage:
                        if not dry_run:
                            success = self.cloud_storage.delete_file(record.media_cloud_key)
                            if success:
                                record.media_cloud_key = None
                                record.media_cloud_url = None
                        result["cloud_deleted"] += 1
                        detail["cloud_key"] = record.media_cloud_key
                    
                    # 標記為已清理（但不刪除記錄）
                    if not dry_run:
                        if not record.output_data:
                            record.output_data = {}
                        record.output_data["media_expired"] = True
                        record.output_data["expired_at"] = now.isoformat()
                        result["db_updated"] += 1
                    
                    result["details"].append(detail)
                    
                except Exception as e:
                    result["errors"].append(f"Record {record.id}: {str(e)}")
            
            if not dry_run:
                db.commit()
        
        return result
    
    def _cleanup_scheduled_media(self, db: Session, dry_run: bool) -> Dict:
        """清理過期的排程媒體"""
        result = {
            "local_deleted": 0,
            "cloud_deleted": 0,
            "bytes_freed": 0,
            "db_updated": 0,
            "details": [],
            "errors": [],
        }
        
        now = datetime.utcnow()
        cutoff_date = now - timedelta(days=self.RETENTION_POLICIES["scheduled"])
        
        # 查詢已發布或失敗的過期排程
        expired_posts = db.query(ScheduledPost).filter(
            and_(
                ScheduledPost.created_at < cutoff_date,
                ScheduledPost.status.in_(["published", "failed"]),
            )
        ).all()
        
        for post in expired_posts:
            try:
                settings = post.settings or {}
                
                # 檢查是否有媒體
                media_url = settings.get("media_url") or settings.get("image_url")
                media_cloud_key = settings.get("media_cloud_key")
                
                if not media_url and not media_cloud_key:
                    continue
                
                detail = {
                    "id": post.id,
                    "status": post.status,
                    "created_at": post.created_at.isoformat(),
                    "age_days": (now - post.created_at).days,
                }
                
                # 刪除本地檔案
                local_path = self._url_to_local_path(media_url) if media_url else None
                if local_path and os.path.exists(local_path):
                    file_size = os.path.getsize(local_path)
                    if not dry_run:
                        os.remove(local_path)
                    result["local_deleted"] += 1
                    result["bytes_freed"] += file_size
                    detail["local_file"] = local_path
                
                # 刪除雲端檔案
                if media_cloud_key and self.cloud_storage:
                    if not dry_run:
                        success = self.cloud_storage.delete_file(media_cloud_key)
                        if success:
                            settings["media_cloud_key"] = None
                            settings["media_cloud_url"] = None
                            post.settings = settings
                    result["cloud_deleted"] += 1
                    detail["cloud_key"] = media_cloud_key
                
                if not dry_run:
                    result["db_updated"] += 1
                
                result["details"].append(detail)
                
            except Exception as e:
                result["errors"].append(f"ScheduledPost {post.id}: {str(e)}")
        
        if not dry_run:
            db.commit()
        
        return result
    
    def _cleanup_orphan_files(self, dry_run: bool) -> Dict:
        """
        清理孤立的本地檔案
        （超過 7 天且無資料庫記錄的檔案）
        """
        result = {
            "deleted": 0,
            "bytes_freed": 0,
            "details": [],
        }
        
        now = datetime.utcnow()
        orphan_threshold = timedelta(days=7)
        
        for dir_name, dir_path in self.LOCAL_DIRS.items():
            if not os.path.exists(dir_path):
                continue
            
            for filename in os.listdir(dir_path):
                filepath = os.path.join(dir_path, filename)
                
                if not os.path.isfile(filepath):
                    continue
                
                try:
                    # 獲取檔案修改時間
                    mtime = datetime.fromtimestamp(os.path.getmtime(filepath))
                    age = now - mtime
                    
                    # 只清理超過閾值的檔案
                    if age < orphan_threshold:
                        continue
                    
                    file_size = os.path.getsize(filepath)
                    
                    if not dry_run:
                        os.remove(filepath)
                    
                    result["deleted"] += 1
                    result["bytes_freed"] += file_size
                    result["details"].append({
                        "file": filepath,
                        "age_days": age.days,
                        "size": file_size,
                    })
                    
                except Exception as e:
                    logger.warning(f"清理孤立檔案失敗 {filepath}: {e}")
        
        return result
    
    def _url_to_local_path(self, url: str) -> Optional[str]:
        """將 URL 轉換為本地路徑"""
        if not url:
            return None
        
        # 處理相對路徑
        if url.startswith("/video/download/"):
            return f"/app/static/videos/{url.split('/')[-1]}"
        elif url.startswith("/static/videos/"):
            return f"/app{url}"
        elif url.startswith("/static/thumbnails/"):
            return f"/app{url}"
        elif url.startswith("/static/uploads/"):
            return f"/app{url}"
        
        return None
    
    def get_storage_stats(self) -> Dict:
        """獲取儲存統計"""
        stats = {
            "local": {
                "videos": {"count": 0, "size": 0},
                "thumbnails": {"count": 0, "size": 0},
                "uploads": {"count": 0, "size": 0},
                "total_size": 0,
            },
            "db": {
                "short_video": {"total": 0, "expired": 0, "with_media": 0},
                "social_image": {"total": 0, "expired": 0, "with_media": 0},
                "blog_post": {"total": 0, "expired": 0, "with_media": 0},
            },
        }
        
        now = datetime.utcnow()
        
        # 統計本地檔案
        for dir_name, dir_path in self.LOCAL_DIRS.items():
            if os.path.exists(dir_path):
                for filename in os.listdir(dir_path):
                    filepath = os.path.join(dir_path, filename)
                    if os.path.isfile(filepath):
                        size = os.path.getsize(filepath)
                        stats["local"][dir_name]["count"] += 1
                        stats["local"][dir_name]["size"] += size
                        stats["local"]["total_size"] += size
        
        # 統計資料庫記錄
        db = SessionLocal()
        try:
            for gen_type, days in self.RETENTION_POLICIES.items():
                if gen_type in ["scheduled", "thumbnail"] or days is None:
                    continue
                
                cutoff = now - timedelta(days=days)
                
                total = db.query(GenerationHistory).filter(
                    GenerationHistory.generation_type == gen_type,
                    GenerationHistory.is_deleted == False,
                ).count()
                
                expired = db.query(GenerationHistory).filter(
                    GenerationHistory.generation_type == gen_type,
                    GenerationHistory.is_deleted == False,
                    GenerationHistory.created_at < cutoff,
                ).count()
                
                with_media = db.query(GenerationHistory).filter(
                    GenerationHistory.generation_type == gen_type,
                    GenerationHistory.is_deleted == False,
                    or_(
                        GenerationHistory.media_local_path.isnot(None),
                        GenerationHistory.media_cloud_key.isnot(None),
                    )
                ).count()
                
                stats["db"][gen_type] = {
                    "total": total,
                    "expired": expired,
                    "with_media": with_media,
                }
        finally:
            db.close()
        
        # 格式化大小
        stats["local"]["total_size_mb"] = round(stats["local"]["total_size"] / 1024 / 1024, 2)
        
        return stats


# 全局實例
lifecycle_manager = MediaLifecycleManager()
