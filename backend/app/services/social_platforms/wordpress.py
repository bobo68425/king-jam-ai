"""
WordPress REST API 整合服務

支援功能：
- Application Password 認證
- 文章發布（草稿、排程、立即發布）
- 媒體上傳
- 分類與標籤管理
- 特色圖片設定
"""

import os
import ssl
import certifi
import base64
import aiohttp
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from datetime import datetime
from enum import Enum

# SSL 上下文 - 使用 certifi 的憑證
def get_ssl_context():
    """取得 SSL 上下文，使用 certifi 憑證"""
    ssl_context = ssl.create_default_context(cafile=certifi.where())
    return ssl_context


class WordPressPostStatus(str, Enum):
    """WordPress 文章狀態"""
    DRAFT = "draft"          # 草稿
    PENDING = "pending"      # 待審核
    PUBLISH = "publish"      # 已發布
    FUTURE = "future"        # 排程發布
    PRIVATE = "private"      # 私人


@dataclass
class WordPressConfig:
    """WordPress 站點配置"""
    site_url: str                    # WordPress 網站網址 (例如: https://example.com)
    username: str                    # 使用者名稱
    app_password: str                # 應用程式密碼 (Application Password)
    api_version: str = "wp/v2"       # REST API 版本
    
    @property
    def api_base_url(self) -> str:
        return f"{self.site_url.rstrip('/')}/wp-json/{self.api_version}"
    
    @property
    def auth_header(self) -> str:
        """產生 Basic Auth 標頭"""
        credentials = f"{self.username}:{self.app_password}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return f"Basic {encoded}"


@dataclass
class WordPressPost:
    """WordPress 文章"""
    title: str
    content: str
    status: WordPressPostStatus = WordPressPostStatus.DRAFT
    excerpt: str = ""                # 摘要
    slug: str = ""                   # 網址別名
    categories: List[int] = None     # 分類 ID 列表
    tags: List[int] = None           # 標籤 ID 列表
    featured_media: int = 0          # 特色圖片 ID
    date: Optional[datetime] = None  # 發布日期 (排程用)
    meta: Dict[str, Any] = None      # 自訂欄位
    format: str = "standard"         # 文章格式
    

@dataclass
class WordPressMedia:
    """WordPress 媒體"""
    id: int
    source_url: str
    title: str
    alt_text: str = ""


@dataclass
class WordPressCategory:
    """WordPress 分類"""
    id: int
    name: str
    slug: str
    parent: int = 0
    count: int = 0


@dataclass
class WordPressTag:
    """WordPress 標籤"""
    id: int
    name: str
    slug: str
    count: int = 0


@dataclass
class PublishResult:
    """發布結果"""
    success: bool
    post_id: Optional[int] = None
    post_url: Optional[str] = None
    error_message: Optional[str] = None
    raw_response: Optional[Dict] = None


class WordPressService:
    """
    WordPress REST API 服務
    
    使用說明：
    1. 在 WordPress 後台啟用 Application Passwords (WP 5.6+)
    2. 生成一組 Application Password
    3. 使用 site_url, username, app_password 建立連線
    """
    
    def __init__(self, config: WordPressConfig):
        self.config = config
        self._session: Optional[aiohttp.ClientSession] = None
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """取得 HTTP Session"""
        if self._session is None or self._session.closed:
            # 使用 TCPConnector 配置 SSL
            connector = aiohttp.TCPConnector(ssl=get_ssl_context())
            self._session = aiohttp.ClientSession(
                connector=connector,
                headers={
                    "Authorization": self.config.auth_header,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                }
            )
        return self._session
    
    async def close(self):
        """關閉 Session"""
        if self._session and not self._session.closed:
            await self._session.close()
    
    async def _request(
        self,
        method: str,
        endpoint: str,
        data: Dict = None,
        params: Dict = None,
        is_upload: bool = False
    ) -> Dict[str, Any]:
        """
        發送 API 請求
        
        Args:
            method: HTTP 方法
            endpoint: API 端點 (例如: /posts)
            data: 請求數據
            params: 查詢參數
            is_upload: 是否為檔案上傳
        
        Returns:
            API 回應
        """
        session = await self._get_session()
        url = f"{self.config.api_base_url}{endpoint}"
        
        try:
            if is_upload:
                # 檔案上傳使用 multipart/form-data
                async with session.request(method, url, data=data, params=params) as response:
                    result = await response.json()
                    if response.status >= 400:
                        error_msg = result.get("message", str(result))
                        raise Exception(f"WordPress API Error [{response.status}]: {error_msg}")
                    return result
            else:
                async with session.request(method, url, json=data, params=params) as response:
                    result = await response.json()
                    if response.status >= 400:
                        error_msg = result.get("message", str(result))
                        raise Exception(f"WordPress API Error [{response.status}]: {error_msg}")
                    return result
                    
        except aiohttp.ClientError as e:
            raise Exception(f"網路連線錯誤: {str(e)}")
    
    # ==================== 驗證 ====================
    
    async def verify_connection(self) -> Dict[str, Any]:
        """
        驗證 WordPress 連線
        
        Returns:
            站點資訊
        """
        import aiohttp
        
        try:
            # 先測試站點是否可連線（不需認證）
            site_url = f"{self.config.site_url.rstrip('/')}/wp-json"
            
            print(f"[WordPress] 測試連線: {site_url}")
            print(f"[WordPress] 使用者: {self.config.username}")
            
            # 使用新的 session 不帶認證，只測試 REST API 是否可用
            try:
                connector = aiohttp.TCPConnector(ssl=get_ssl_context())
                async with aiohttp.ClientSession(connector=connector) as test_session:
                    async with test_session.get(site_url, timeout=aiohttp.ClientTimeout(total=15)) as response:
                        content_type = response.headers.get("Content-Type", "")
                        print(f"[WordPress] Response Status: {response.status}")
                        print(f"[WordPress] Content-Type: {content_type}")
                        
                        if response.status != 200:
                            return {
                                "success": False,
                                "error": f"無法連接 WordPress 站點 (HTTP {response.status})"
                            }
                        
                        # 讀取回應內容
                        body_text = await response.text()
                        
                        # 嘗試解析 JSON（即使 Content-Type 不正確）
                        import json
                        try:
                            site_info = json.loads(body_text)
                            print(f"[WordPress] Successfully parsed JSON response")
                        except json.JSONDecodeError:
                            # 如果不是 JSON，檢查是否是 HTML
                            if "<!DOCTYPE" in body_text or "<html" in body_text.lower():
                                if "wp-login" in body_text or "登入" in body_text:
                                    return {
                                        "success": False,
                                        "error": "WordPress REST API 需要登入才能存取。請檢查是否有安全外掛阻擋 REST API"
                                    }
                                return {
                                    "success": False,
                                    "error": f"WordPress REST API 回傳 HTML 而非 JSON。\n\n可能原因：\n1. REST API 被停用\n2. 安全外掛阻擋\n3. 固定連結未設定\n\n請在瀏覽器訪問 {site_url} 確認 API 狀態"
                                }
                            return {
                                "success": False,
                                "error": f"WordPress REST API 回傳無法解析的內容"
                            }
                        
            except aiohttp.ClientError as e:
                return {
                    "success": False,
                    "error": f"網路連線錯誤: {str(e)}"
                }
            except Exception as e:
                return {
                    "success": False,
                    "error": f"無法連接 WordPress 站點: {str(e)}"
                }
            
            # 測試認證 - 使用帶認證的 session
            try:
                session = await self._get_session()
                auth_url = f"{self.config.api_base_url}/users/me?context=edit"
                
                async with session.get(auth_url) as auth_response:
                    auth_body = await auth_response.text()
                    
                    if auth_response.status == 401:
                        print(f"[WordPress] Auth failed: {auth_body[:200]}")
                        
                        suggestions = [
                            "1. 確認使用者名稱正確（是登入帳號，不是 Email）",
                            "2. 確認應用程式密碼正確（保留空格，如：xxxx xxxx xxxx xxxx）",
                            "3. 確認 WordPress 版本 >= 5.6",
                            "4. 在 WordPress 後台重新生成應用程式密碼",
                            "5. 檢查是否有安全外掛阻擋"
                        ]
                        return {
                            "success": False,
                            "error": "認證失敗：使用者名稱或應用程式密碼不正確。\n\n建議：\n" + "\n".join(suggestions)
                        }
                    
                    if auth_response.status != 200:
                        return {
                            "success": False,
                            "error": f"認證失敗 (HTTP {auth_response.status})"
                        }
                    
                    # 嘗試解析 JSON（即使 Content-Type 不正確）
                    try:
                        user_info = json.loads(auth_body)
                    except json.JSONDecodeError:
                        return {
                            "success": False,
                            "error": "無法解析使用者資訊"
                        }
                    
            except Exception as auth_error:
                error_str = str(auth_error)
                print(f"[WordPress] 認證錯誤: {error_str}")
                return {
                    "success": False,
                    "error": f"認證過程發生錯誤: {error_str}"
                }
            
            return {
                "success": True,
                "site_name": site_info.get("name", ""),
                "site_description": site_info.get("description", ""),
                "site_url": site_info.get("url", self.config.site_url),
                "user_id": user_info.get("id"),
                "user_name": user_info.get("name"),
                "user_slug": user_info.get("slug"),
                "user_avatar": user_info.get("avatar_urls", {}).get("96", ""),
                "capabilities": list(user_info.get("capabilities", {}).keys())[:10]  # 只取前 10 個權限
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    # ==================== 文章管理 ====================
    
    async def create_post(self, post: WordPressPost) -> PublishResult:
        """
        建立文章
        
        Args:
            post: WordPressPost 物件
        
        Returns:
            PublishResult
        """
        try:
            data = {
                "title": post.title,
                "content": post.content,
                "status": post.status.value,
                "excerpt": post.excerpt,
                "format": post.format,
            }
            
            if post.slug:
                data["slug"] = post.slug
            
            if post.categories:
                data["categories"] = post.categories
            
            if post.tags:
                data["tags"] = post.tags
            
            if post.featured_media:
                data["featured_media"] = post.featured_media
                print(f"[WordPress] 設定特色圖片 ID: {post.featured_media}")
            else:
                print(f"[WordPress] 注意：未設定特色圖片 (featured_media={post.featured_media})")
            
            print(f"[WordPress] 發送文章資料: {data}")
            
            if post.date and post.status == WordPressPostStatus.FUTURE:
                # 排程發布需要 ISO 8601 格式
                data["date"] = post.date.isoformat()
            
            if post.meta:
                data["meta"] = post.meta
            
            result = await self._request("POST", "/posts", data=data)
            
            return PublishResult(
                success=True,
                post_id=result.get("id"),
                post_url=result.get("link"),
                raw_response=result
            )
            
        except Exception as e:
            return PublishResult(
                success=False,
                error_message=str(e)
            )
    
    async def update_post(self, post_id: int, updates: Dict[str, Any]) -> PublishResult:
        """
        更新文章
        
        Args:
            post_id: 文章 ID
            updates: 要更新的欄位
        
        Returns:
            PublishResult
        """
        try:
            result = await self._request("POST", f"/posts/{post_id}", data=updates)
            
            return PublishResult(
                success=True,
                post_id=result.get("id"),
                post_url=result.get("link"),
                raw_response=result
            )
            
        except Exception as e:
            return PublishResult(
                success=False,
                error_message=str(e)
            )
    
    async def get_post(self, post_id: int) -> Optional[Dict]:
        """取得文章"""
        try:
            return await self._request("GET", f"/posts/{post_id}")
        except Exception:
            return None
    
    async def get_posts(
        self,
        status: str = "any",
        per_page: int = 10,
        page: int = 1,
        search: str = "",
        categories: List[int] = None,
        tags: List[int] = None
    ) -> List[Dict]:
        """
        取得文章列表
        """
        params = {
            "status": status,
            "per_page": per_page,
            "page": page,
        }
        
        if search:
            params["search"] = search
        if categories:
            params["categories"] = ",".join(map(str, categories))
        if tags:
            params["tags"] = ",".join(map(str, tags))
        
        try:
            return await self._request("GET", "/posts", params=params)
        except Exception:
            return []
    
    async def delete_post(self, post_id: int, force: bool = False) -> bool:
        """
        刪除文章
        
        Args:
            post_id: 文章 ID
            force: 是否永久刪除 (False = 移至垃圾桶)
        """
        try:
            await self._request("DELETE", f"/posts/{post_id}", params={"force": force})
            return True
        except Exception:
            return False
    
    # ==================== 媒體管理 ====================
    
    async def upload_media(
        self,
        file_data: bytes,
        filename: str,
        mime_type: str = "image/jpeg",
        title: str = "",
        alt_text: str = "",
        caption: str = ""
    ) -> Optional[WordPressMedia]:
        """
        上傳媒體檔案
        
        Args:
            file_data: 檔案二進位資料
            filename: 檔案名稱
            mime_type: MIME 類型
            title: 標題
            alt_text: 替代文字
            caption: 說明文字
        
        Returns:
            WordPressMedia 或 None
        """
        try:
            url = f"{self.config.api_base_url}/media"
            
            # 建立 FormData
            form_data = aiohttp.FormData()
            form_data.add_field(
                "file",
                file_data,
                filename=filename,
                content_type=mime_type
            )
            
            if title:
                form_data.add_field("title", title)
            if alt_text:
                form_data.add_field("alt_text", alt_text)
            if caption:
                form_data.add_field("caption", caption)
            
            # 媒體上傳需要獨立的 session，不能使用預設的 Content-Type: application/json
            # 讓 aiohttp 自動設定 multipart/form-data
            headers = {
                "Authorization": self.config.auth_header,
                "Accept": "application/json",
            }
            
            connector = aiohttp.TCPConnector(ssl=get_ssl_context())
            async with aiohttp.ClientSession(connector=connector) as upload_session:
                async with upload_session.post(url, data=form_data, headers=headers) as response:
                    # 嘗試解析回應
                    try:
                        result = await response.json()
                    except Exception as json_err:
                        text = await response.text()
                        print(f"[WordPress] 媒體上傳回應無法解析為 JSON: {json_err}")
                        print(f"[WordPress] 回應內容: {text[:500]}...")
                        return None
                    
                    if response.status >= 400:
                        print(f"[WordPress] 媒體上傳失敗 (HTTP {response.status}): {result}")
                        return None
                    
                    print(f"[WordPress] 媒體上傳成功: ID={result.get('id')}, URL={result.get('source_url')}")
                    
                    return WordPressMedia(
                        id=result.get("id"),
                        source_url=result.get("source_url"),
                        title=result.get("title", {}).get("rendered", ""),
                        alt_text=result.get("alt_text", "")
                    )
                
        except Exception as e:
            print(f"[WordPress] 媒體上傳錯誤: {e}")
            return None
    
    async def upload_media_from_url(
        self,
        image_url: str,
        title: str = "",
        alt_text: str = ""
    ) -> Optional[WordPressMedia]:
        """
        從 URL 或 Base64 Data URL 上傳媒體
        
        支援兩種格式：
        1. HTTP/HTTPS URL (例如: https://example.com/image.jpg)
        2. Base64 Data URL (例如: data:image/png;base64,...)
        """
        try:
            # 處理 Base64 Data URL
            if image_url.startswith("data:"):
                import base64
                import re
                
                # 解析 Data URL: data:image/png;base64,xxxxx
                match = re.match(r'data:([^;]+);base64,(.+)', image_url)
                if not match:
                    print(f"[WordPress] 無效的 Data URL 格式")
                    return None
                
                content_type = match.group(1)
                base64_data = match.group(2)
                file_data = base64.b64decode(base64_data)
                
                # 根據 MIME 類型決定副檔名
                ext_map = {
                    "image/jpeg": "jpg",
                    "image/jpg": "jpg",
                    "image/png": "png",
                    "image/gif": "gif",
                    "image/webp": "webp",
                }
                ext = ext_map.get(content_type, "jpg")
                filename = f"cover-{title[:20].replace(' ', '-')}.{ext}" if title else f"cover.{ext}"
                
                print(f"[WordPress] 上傳 Base64 圖片: {filename}, 大小: {len(file_data)} bytes")
                
                return await self.upload_media(
                    file_data=file_data,
                    filename=filename,
                    mime_type=content_type,
                    title=title,
                    alt_text=alt_text
                )
            
            # 處理普通 HTTP URL
            connector = aiohttp.TCPConnector(ssl=get_ssl_context())
            async with aiohttp.ClientSession(connector=connector) as session:
                async with session.get(image_url) as response:
                    if response.status != 200:
                        print(f"[WordPress] 無法下載圖片，狀態碼: {response.status}")
                        return None
                    
                    file_data = await response.read()
                    content_type = response.headers.get("Content-Type", "image/jpeg")
                    
                    # 從 URL 提取檔名
                    filename = image_url.split("/")[-1].split("?")[0]
                    if not filename:
                        filename = "image.jpg"
                    
                    print(f"[WordPress] 上傳 URL 圖片: {filename}, 大小: {len(file_data)} bytes")
                    
                    return await self.upload_media(
                        file_data=file_data,
                        filename=filename,
                        mime_type=content_type,
                        title=title,
                        alt_text=alt_text
                    )
                    
        except Exception as e:
            import traceback
            print(f"[WordPress] 從 URL 上傳失敗: {e}")
            traceback.print_exc()
            return None
    
    # ==================== 分類管理 ====================
    
    async def get_categories(self, per_page: int = 100) -> List[WordPressCategory]:
        """取得所有分類"""
        try:
            result = await self._request("GET", "/categories", params={"per_page": per_page})
            return [
                WordPressCategory(
                    id=cat.get("id"),
                    name=cat.get("name"),
                    slug=cat.get("slug"),
                    parent=cat.get("parent", 0),
                    count=cat.get("count", 0)
                )
                for cat in result
            ]
        except Exception:
            return []
    
    async def create_category(self, name: str, parent: int = 0) -> Optional[WordPressCategory]:
        """建立分類"""
        try:
            result = await self._request("POST", "/categories", data={
                "name": name,
                "parent": parent
            })
            return WordPressCategory(
                id=result.get("id"),
                name=result.get("name"),
                slug=result.get("slug"),
                parent=result.get("parent", 0)
            )
        except Exception:
            return None
    
    async def get_or_create_category(self, name: str) -> Optional[int]:
        """取得或建立分類，返回 ID"""
        categories = await self.get_categories()
        for cat in categories:
            if cat.name.lower() == name.lower():
                return cat.id
        
        new_cat = await self.create_category(name)
        return new_cat.id if new_cat else None
    
    # ==================== 標籤管理 ====================
    
    async def get_tags(self, per_page: int = 100) -> List[WordPressTag]:
        """取得所有標籤"""
        try:
            result = await self._request("GET", "/tags", params={"per_page": per_page})
            return [
                WordPressTag(
                    id=tag.get("id"),
                    name=tag.get("name"),
                    slug=tag.get("slug"),
                    count=tag.get("count", 0)
                )
                for tag in result
            ]
        except Exception:
            return []
    
    async def create_tag(self, name: str) -> Optional[WordPressTag]:
        """建立標籤"""
        try:
            result = await self._request("POST", "/tags", data={"name": name})
            return WordPressTag(
                id=result.get("id"),
                name=result.get("name"),
                slug=result.get("slug")
            )
        except Exception:
            return None
    
    async def get_or_create_tags(self, tag_names: List[str]) -> List[int]:
        """取得或建立多個標籤，返回 ID 列表"""
        existing_tags = await self.get_tags()
        tag_map = {tag.name.lower(): tag.id for tag in existing_tags}
        
        result_ids = []
        for name in tag_names:
            name_lower = name.lower().strip()
            if name_lower in tag_map:
                result_ids.append(tag_map[name_lower])
            else:
                new_tag = await self.create_tag(name)
                if new_tag:
                    result_ids.append(new_tag.id)
        
        return result_ids
    
    # ==================== 便捷方法 ====================
    
    async def publish_blog_post(
        self,
        title: str,
        content: str,
        excerpt: str = "",
        category_names: List[str] = None,
        tag_names: List[str] = None,
        featured_image_url: str = None,
        status: WordPressPostStatus = WordPressPostStatus.DRAFT,
        scheduled_date: datetime = None
    ) -> PublishResult:
        """
        發布部落格文章（高階便捷方法）
        
        Args:
            title: 文章標題
            content: 文章內容 (HTML)
            excerpt: 摘要
            category_names: 分類名稱列表 (會自動建立不存在的分類)
            tag_names: 標籤名稱列表 (會自動建立不存在的標籤)
            featured_image_url: 特色圖片 URL
            status: 發布狀態
            scheduled_date: 排程發布時間
        
        Returns:
            PublishResult
        """
        try:
            # 1. 處理分類
            category_ids = []
            if category_names:
                for name in category_names:
                    cat_id = await self.get_or_create_category(name)
                    if cat_id:
                        category_ids.append(cat_id)
            
            # 2. 處理標籤
            tag_ids = []
            if tag_names:
                tag_ids = await self.get_or_create_tags(tag_names)
            
            # 3. 處理特色圖片
            featured_media_id = 0
            if featured_image_url:
                print(f"[WordPress] 開始上傳特色圖片...")
                print(f"[WordPress] 圖片類型: {'Base64 Data URL' if featured_image_url.startswith('data:') else 'HTTP URL'}")
                print(f"[WordPress] 圖片長度: {len(featured_image_url)} 字元")
                
                media = await self.upload_media_from_url(
                    featured_image_url,
                    title=title,
                    alt_text=title
                )
                if media:
                    featured_media_id = media.id
                    print(f"[WordPress] 特色圖片上傳成功！Media ID: {featured_media_id}")
                else:
                    print(f"[WordPress] 特色圖片上傳失敗，將不設定特色圖片")
            else:
                print(f"[WordPress] 未提供特色圖片 URL")
            
            # 4. 決定發布狀態
            final_status = status
            if scheduled_date and scheduled_date > datetime.now():
                final_status = WordPressPostStatus.FUTURE
            
            # 5. 建立文章
            post = WordPressPost(
                title=title,
                content=content,
                status=final_status,
                excerpt=excerpt,
                categories=category_ids if category_ids else None,
                tags=tag_ids if tag_ids else None,
                featured_media=featured_media_id,
                date=scheduled_date
            )
            
            return await self.create_post(post)
            
        except Exception as e:
            return PublishResult(
                success=False,
                error_message=str(e)
            )


# ==================== 工廠函數 ====================

def create_wordpress_service(
    site_url: str,
    username: str,
    app_password: str
) -> WordPressService:
    """
    建立 WordPress 服務實例
    
    Args:
        site_url: WordPress 網站網址
        username: 使用者名稱
        app_password: 應用程式密碼
    
    Returns:
        WordPressService 實例
    """
    config = WordPressConfig(
        site_url=site_url,
        username=username,
        app_password=app_password
    )
    return WordPressService(config)
