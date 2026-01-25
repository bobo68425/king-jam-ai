"""
雲端儲存服務
支援 Cloudflare R2 (推薦) 和 AWS S3

R2 優勢：
- 影片流量零費用（egress free）
- S3 相容 API
- 全球 CDN
"""
import os
import boto3
from botocore.config import Config
from typing import Optional, BinaryIO
from datetime import datetime
import mimetypes
import hashlib


class CloudStorageService:
    """
    雲端儲存服務
    使用 S3 相容 API，同時支援 R2 和 S3
    """
    
    def __init__(self):
        self.provider = os.getenv("CLOUD_STORAGE_PROVIDER", "r2")  # r2 或 s3
        
        if self.provider == "r2":
            # Cloudflare R2 設定
            self.endpoint_url = os.getenv("R2_ENDPOINT_URL")  # https://<account_id>.r2.cloudflarestorage.com
            self.access_key = os.getenv("R2_ACCESS_KEY_ID")
            self.secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
            self.bucket_name = os.getenv("R2_BUCKET_NAME", "kingjam-media")
            self.public_url = os.getenv("R2_PUBLIC_URL")  # https://media.kingjam.ai 或 R2 公開 URL
        else:
            # AWS S3 設定
            self.endpoint_url = None
            self.access_key = os.getenv("AWS_ACCESS_KEY_ID")
            self.secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
            self.bucket_name = os.getenv("S3_BUCKET_NAME", "kingjam-media")
            self.region = os.getenv("AWS_REGION", "ap-northeast-1")
            self.public_url = os.getenv("S3_PUBLIC_URL")  # CloudFront URL 或 S3 公開 URL
        
        self._client = None
    
    @property
    def client(self):
        """懶加載 S3 客戶端"""
        if self._client is None:
            if not self.access_key or not self.secret_key:
                raise ValueError("雲端儲存憑證未設定")
            
            config = Config(
                signature_version='s3v4',
                s3={'addressing_style': 'path'}  # R2 需要 path style
            )
            
            self._client = boto3.client(
                's3',
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                config=config,
                region_name=getattr(self, 'region', 'auto')
            )
        
        return self._client
    
    def _generate_key(self, user_id: int, file_type: str, original_filename: str) -> str:
        """
        生成雲端儲存的檔案 key
        格式: {type}/{user_id}/{year}/{month}/{hash}_{filename}
        """
        now = datetime.utcnow()
        
        # 生成唯一 hash
        unique_str = f"{user_id}_{now.timestamp()}_{original_filename}"
        file_hash = hashlib.md5(unique_str.encode()).hexdigest()[:8]
        
        # 獲取副檔名
        ext = os.path.splitext(original_filename)[1] or self._guess_extension(file_type)
        
        # 構建 key
        key = f"{file_type}/{user_id}/{now.year}/{now.month:02d}/{file_hash}_{now.strftime('%H%M%S')}{ext}"
        
        return key
    
    def _guess_extension(self, file_type: str) -> str:
        """根據類型猜測副檔名"""
        type_map = {
            "videos": ".mp4",
            "images": ".png",
            "thumbnails": ".jpg",
            "audio": ".mp3",
        }
        return type_map.get(file_type, "")
    
    def upload_file(
        self,
        file_path: str,
        user_id: int,
        file_type: str = "videos",
        original_filename: Optional[str] = None
    ) -> dict:
        """
        上傳本地檔案到雲端
        
        Args:
            file_path: 本地檔案路徑
            user_id: 用戶 ID
            file_type: 檔案類型 (videos, images, thumbnails, audio)
            original_filename: 原始檔名
        
        Returns:
            {
                "success": True,
                "key": "videos/1/2026/01/abc123_120000.mp4",
                "url": "https://media.kingjam.ai/videos/1/2026/01/abc123_120000.mp4",
                "size": 12345678
            }
        """
        try:
            if not os.path.exists(file_path):
                return {"success": False, "error": "檔案不存在"}
            
            # 生成 key
            filename = original_filename or os.path.basename(file_path)
            key = self._generate_key(user_id, file_type, filename)
            
            # 獲取檔案大小
            file_size = os.path.getsize(file_path)
            
            # 獲取 content type
            content_type, _ = mimetypes.guess_type(file_path)
            content_type = content_type or "application/octet-stream"
            
            # 上傳
            with open(file_path, 'rb') as f:
                self.client.upload_fileobj(
                    f,
                    self.bucket_name,
                    key,
                    ExtraArgs={
                        'ContentType': content_type,
                        'CacheControl': 'public, max-age=31536000',  # 1 年快取
                    }
                )
            
            # 構建公開 URL
            if self.public_url:
                url = f"{self.public_url.rstrip('/')}/{key}"
            else:
                url = f"{self.endpoint_url}/{self.bucket_name}/{key}"
            
            return {
                "success": True,
                "key": key,
                "url": url,
                "size": file_size,
                "provider": self.provider
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def upload_bytes(
        self,
        data: bytes,
        user_id: int,
        file_type: str = "videos",
        filename: str = "file",
        content_type: Optional[str] = None
    ) -> dict:
        """
        上傳 bytes 資料到雲端
        """
        try:
            key = self._generate_key(user_id, file_type, filename)
            
            if not content_type:
                content_type, _ = mimetypes.guess_type(filename)
                content_type = content_type or "application/octet-stream"
            
            self.client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=data,
                ContentType=content_type,
                CacheControl='public, max-age=31536000',
            )
            
            if self.public_url:
                url = f"{self.public_url.rstrip('/')}/{key}"
            else:
                url = f"{self.endpoint_url}/{self.bucket_name}/{key}"
            
            return {
                "success": True,
                "key": key,
                "url": url,
                "size": len(data),
                "provider": self.provider
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def delete_file(self, key: str) -> bool:
        """刪除雲端檔案"""
        try:
            self.client.delete_object(
                Bucket=self.bucket_name,
                Key=key
            )
            return True
        except Exception as e:
            print(f"刪除雲端檔案失敗: {e}")
            return False
    
    def get_signed_url(self, key: str, expires_in: int = 3600) -> str:
        """
        生成預簽名 URL（用於私有檔案）
        
        Args:
            key: 檔案 key
            expires_in: 過期時間（秒），預設 1 小時
        """
        try:
            url = self.client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': key
                },
                ExpiresIn=expires_in
            )
            return url
        except Exception as e:
            print(f"生成預簽名 URL 失敗: {e}")
            return ""
    
    def file_exists(self, key: str) -> bool:
        """檢查檔案是否存在"""
        try:
            self.client.head_object(
                Bucket=self.bucket_name,
                Key=key
            )
            return True
        except:
            return False
    
    def is_configured(self) -> bool:
        """檢查是否已設定雲端儲存"""
        return bool(self.access_key and self.secret_key)


# 全域實例
cloud_storage = CloudStorageService()


# ============================================================
# 工具函數
# ============================================================

def upload_video_to_cloud(
    local_path: str,
    user_id: int,
    delete_local: bool = False
) -> dict:
    """
    上傳影片到雲端並可選刪除本地檔案
    """
    if not cloud_storage.is_configured():
        return {
            "success": False,
            "error": "雲端儲存未設定",
            "local_path": local_path
        }
    
    result = cloud_storage.upload_file(
        file_path=local_path,
        user_id=user_id,
        file_type="videos"
    )
    
    if result["success"] and delete_local:
        try:
            os.remove(local_path)
        except:
            pass
    
    return result


def upload_image_to_cloud(
    local_path: str,
    user_id: int,
    delete_local: bool = False
) -> dict:
    """
    上傳圖片到雲端
    """
    if not cloud_storage.is_configured():
        return {
            "success": False,
            "error": "雲端儲存未設定",
            "local_path": local_path
        }
    
    result = cloud_storage.upload_file(
        file_path=local_path,
        user_id=user_id,
        file_type="images"
    )
    
    if result["success"] and delete_local:
        try:
            os.remove(local_path)
        except:
            pass
    
    return result
