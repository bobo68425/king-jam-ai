"""
雲端儲存服務
支援 Google Cloud Storage (GCS)、Cloudflare R2 和 AWS S3

GCS 優勢：
- 與 GCP 整合，使用服務帳戶自動認證
- 全球 CDN

R2 優勢：
- 影片流量零費用（egress free）
- S3 相容 API
"""
import os
import boto3
from botocore.config import Config
from typing import Optional, BinaryIO
from datetime import datetime
import mimetypes
import hashlib

# GCS 支援
try:
    from google.cloud import storage as gcs_storage
    GCS_AVAILABLE = True
except ImportError:
    GCS_AVAILABLE = False
    print("[CloudStorage] google-cloud-storage 未安裝，GCS 功能不可用")


class CloudStorageService:
    """
    雲端儲存服務
    支援 GCS、R2 和 S3
    """
    
    def __init__(self):
        # 優先使用 GCS（如果有設定 bucket）
        self.gcs_bucket_name = os.getenv("GCS_BUCKET_NAME")
        
        if self.gcs_bucket_name and GCS_AVAILABLE:
            self.provider = "gcs"
            self.bucket_name = self.gcs_bucket_name
            self.public_url = f"https://storage.googleapis.com/{self.bucket_name}"
            self._gcs_client = None
            self._gcs_bucket = None
            print(f"[CloudStorage] 使用 GCS: {self.bucket_name}")
        else:
            # 回退到 R2 或 S3
            self.provider = os.getenv("CLOUD_STORAGE_PROVIDER", "r2")  # r2 或 s3
            
            if self.provider == "r2":
                # Cloudflare R2 設定
                self.endpoint_url = os.getenv("R2_ENDPOINT_URL")
                self.access_key = os.getenv("R2_ACCESS_KEY_ID")
                self.secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
                self.bucket_name = os.getenv("R2_BUCKET_NAME", "kingjam-media")
                self.public_url = os.getenv("R2_PUBLIC_URL")
            else:
                # AWS S3 設定
                self.endpoint_url = None
                self.access_key = os.getenv("AWS_ACCESS_KEY_ID")
                self.secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
                self.bucket_name = os.getenv("S3_BUCKET_NAME", "kingjam-media")
                self.region = os.getenv("AWS_REGION", "ap-northeast-1")
                self.public_url = os.getenv("S3_PUBLIC_URL")
        
        self._client = None
    
    @property
    def gcs_client(self):
        """懶加載 GCS 客戶端"""
        if self._gcs_client is None and GCS_AVAILABLE:
            self._gcs_client = gcs_storage.Client()
        return self._gcs_client
    
    @property
    def gcs_bucket(self):
        """懶加載 GCS bucket"""
        if self._gcs_bucket is None and self.gcs_client:
            self._gcs_bucket = self.gcs_client.bucket(self.bucket_name)
        return self._gcs_bucket
    
    @property
    def client(self):
        """懶加載 S3 客戶端（用於 R2/S3）"""
        if self._client is None and self.provider != "gcs":
            if not self.access_key or not self.secret_key:
                raise ValueError("雲端儲存憑證未設定")
            
            config = Config(
                signature_version='s3v4',
                s3={'addressing_style': 'path'}
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
            "avatars": ".jpg",
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
                "url": "https://storage.googleapis.com/bucket/videos/...",
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
            
            # 根據 provider 上傳
            if self.provider == "gcs":
                # GCS 上傳
                blob = self.gcs_bucket.blob(key)
                blob.upload_from_filename(
                    file_path,
                    content_type=content_type
                )
                blob.cache_control = "public, max-age=31536000"
                blob.patch()
                url = f"https://storage.googleapis.com/{self.bucket_name}/{key}"
                print(f"[CloudStorage] ✅ GCS 上傳成功: {key}")
            else:
                # S3/R2 上傳
                with open(file_path, 'rb') as f:
                    self.client.upload_fileobj(
                        f,
                        self.bucket_name,
                        key,
                        ExtraArgs={
                            'ContentType': content_type,
                            'CacheControl': 'public, max-age=31536000',
                        }
                    )
                
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
            print(f"[CloudStorage] ❌ 上傳失敗: {e}")
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
            
            # 根據 provider 上傳
            if self.provider == "gcs":
                # GCS 上傳
                import io
                blob = self.gcs_bucket.blob(key)
                blob.upload_from_file(
                    io.BytesIO(data),
                    content_type=content_type
                )
                blob.cache_control = "public, max-age=31536000"
                blob.patch()
                url = f"https://storage.googleapis.com/{self.bucket_name}/{key}"
                print(f"[CloudStorage] ✅ GCS bytes 上傳成功: {key}")
            else:
                # S3/R2 上傳
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
            print(f"[CloudStorage] ❌ bytes 上傳失敗: {e}")
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
        if self.provider == "gcs":
            return bool(self.gcs_bucket_name and GCS_AVAILABLE)
        return bool(getattr(self, 'access_key', None) and getattr(self, 'secret_key', None))


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
