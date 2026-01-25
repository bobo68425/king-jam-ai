"""
PicWish 去背服務
使用 PicWish Background Removal API
文檔: https://picwish.com/background-removal-api-doc
"""

import os
import time
import base64
import httpx
from typing import Optional
from fastapi import HTTPException

# API 配置
PICWISH_API_KEY = os.getenv("PICWISH_API_KEY", "")
PICWISH_BASE_URL = "https://techhk.aoscdn.com/api/tasks/visual/segmentation"

# 超時設定
POLLING_INTERVAL = 1  # 秒
POLLING_TIMEOUT = 30  # 秒


class PicWishService:
    """PicWish 去背服務"""
    
    def __init__(self):
        self.api_key = PICWISH_API_KEY
        self.base_url = PICWISH_BASE_URL
    
    def _get_headers(self) -> dict:
        """取得 API 請求標頭"""
        if not self.api_key:
            raise HTTPException(
                status_code=500,
                detail="PicWish API Key 未設定，請在環境變數中設定 PICWISH_API_KEY"
            )
        return {"X-API-KEY": self.api_key}
    
    async def remove_background_sync(
        self,
        image_base64: Optional[str] = None,
        image_url: Optional[str] = None,
        output_type: int = 1,  # 1: PNG with transparency, 2: JPG with white bg
        return_type: int = 1,  # 1: URL, 2: Base64
    ) -> dict:
        """
        同步方式去背（適合小圖片，快速回應）
        
        Args:
            image_base64: Base64 編碼的圖片
            image_url: 圖片 URL
            output_type: 輸出類型 (1=PNG透明背景, 2=JPG白色背景)
            return_type: 返回類型 (1=URL, 2=Base64)
        
        Returns:
            dict: 包含去背結果的字典
        """
        headers = self._get_headers()
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            form_data = {
                "sync": "1",
                "output_type": str(output_type),
                "return_type": str(return_type),
            }
            
            files = None
            
            if image_base64:
                # 從 Base64 解碼並作為檔案上傳
                # 移除可能的 data URI 前綴
                if "," in image_base64:
                    image_base64 = image_base64.split(",")[1]
                
                image_bytes = base64.b64decode(image_base64)
                files = {"image_file": ("image.png", image_bytes, "image/png")}
            elif image_url:
                form_data["image_url"] = image_url
            else:
                raise HTTPException(
                    status_code=400,
                    detail="必須提供 image_base64 或 image_url"
                )
            
            try:
                response = await client.post(
                    self.base_url,
                    headers=headers,
                    data=form_data,
                    files=files,
                )
                
                result = response.json()
                
                if result.get("status") != 200:
                    raise HTTPException(
                        status_code=400,
                        detail=f"PicWish API 錯誤: {result.get('message', '未知錯誤')}"
                    )
                
                data = result.get("data", {})
                state = data.get("state", 0)
                
                if state == 1:
                    # 成功
                    return {
                        "success": True,
                        "image": data.get("image"),  # URL 或 Base64
                        "width": data.get("image_width"),
                        "height": data.get("image_height"),
                    }
                elif state < 0:
                    raise HTTPException(
                        status_code=400,
                        detail=f"去背處理失敗: {result.get('message', '未知錯誤')}"
                    )
                else:
                    # 仍在處理中，這種情況在同步模式下不應發生
                    raise HTTPException(
                        status_code=500,
                        detail="同步請求超時，請稍後再試"
                    )
                    
            except httpx.HTTPError as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"網路請求失敗: {str(e)}"
                )
    
    async def remove_background_async(
        self,
        image_base64: Optional[str] = None,
        image_url: Optional[str] = None,
        output_type: int = 1,
        return_type: int = 1,
    ) -> dict:
        """
        非同步方式去背（適合大圖片，更穩定）
        使用輪詢方式取得結果
        
        Args:
            image_base64: Base64 編碼的圖片
            image_url: 圖片 URL
            output_type: 輸出類型 (1=PNG透明背景, 2=JPG白色背景)
            return_type: 返回類型 (1=URL, 2=Base64)
        
        Returns:
            dict: 包含去背結果的字典
        """
        headers = self._get_headers()
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            # 步驟 1: 創建任務
            form_data = {
                "sync": "0",
                "output_type": str(output_type),
                "return_type": str(return_type),
            }
            
            files = None
            
            if image_base64:
                if "," in image_base64:
                    image_base64 = image_base64.split(",")[1]
                
                image_bytes = base64.b64decode(image_base64)
                files = {"image_file": ("image.png", image_bytes, "image/png")}
            elif image_url:
                form_data["image_url"] = image_url
            else:
                raise HTTPException(
                    status_code=400,
                    detail="必須提供 image_base64 或 image_url"
                )
            
            try:
                # 創建任務
                response = await client.post(
                    self.base_url,
                    headers=headers,
                    data=form_data,
                    files=files,
                )
                
                result = response.json()
                
                if result.get("status") != 200:
                    raise HTTPException(
                        status_code=400,
                        detail=f"PicWish API 錯誤: {result.get('message', '未知錯誤')}"
                    )
                
                task_id = result.get("data", {}).get("task_id")
                if not task_id:
                    raise HTTPException(
                        status_code=500,
                        detail="無法取得任務 ID"
                    )
                
                # 步驟 2: 輪詢結果
                start_time = time.time()
                
                while time.time() - start_time < POLLING_TIMEOUT:
                    await asyncio.sleep(POLLING_INTERVAL)
                    
                    poll_response = await client.get(
                        f"{self.base_url}/{task_id}",
                        headers=headers,
                    )
                    
                    poll_result = poll_response.json()
                    
                    if poll_result.get("status") != 200:
                        continue  # 繼續輪詢
                    
                    data = poll_result.get("data", {})
                    state = data.get("state", 0)
                    
                    if state == 1:
                        # 成功
                        return {
                            "success": True,
                            "image": data.get("image"),
                            "width": data.get("image_width"),
                            "height": data.get("image_height"),
                        }
                    elif state < 0:
                        raise HTTPException(
                            status_code=400,
                            detail=f"去背處理失敗: {poll_result.get('message', '未知錯誤')}"
                        )
                    # state == 0 表示仍在處理中，繼續輪詢
                
                # 超時
                raise HTTPException(
                    status_code=408,
                    detail="去背處理超時，請稍後再試"
                )
                
            except httpx.HTTPError as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"網路請求失敗: {str(e)}"
                )


# 需要導入 asyncio
import asyncio

# 創建服務實例
picwish_service = PicWishService()
