"""
Rembg 去背服務
使用開源 rembg 庫進行本地圖片去背處理
https://github.com/danielgatis/rembg
"""

import base64
import io
import logging
from typing import Optional
from PIL import Image
from fastapi import HTTPException

logger = logging.getLogger(__name__)

# 延遲導入 rembg 以加快啟動速度
_rembg_session = None


def get_rembg_session():
    """
    延遲載入 rembg session（首次使用時載入模型）
    模型大小約 170MB，首次載入需要下載
    """
    global _rembg_session
    if _rembg_session is None:
        try:
            from rembg import new_session
            # 使用 u2net 模型（預設，效果最好）
            # 其他可選模型：u2netp (較小較快), u2net_human_seg (人像專用)
            _rembg_session = new_session("u2net")
            logger.info("Rembg 模型載入成功")
        except Exception as e:
            logger.error(f"載入 rembg 模型失敗: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"去背服務初始化失敗: {str(e)}"
            )
    return _rembg_session


class RembgService:
    """Rembg 本地去背服務"""
    
    async def remove_background(
        self,
        image_base64: Optional[str] = None,
        image_url: Optional[str] = None,
        output_type: int = 1,  # 1: PNG with transparency, 2: JPG with white bg
        return_type: int = 2,  # 1: URL (not supported), 2: Base64
    ) -> dict:
        """
        本地去背處理
        
        Args:
            image_base64: Base64 編碼的圖片
            image_url: 圖片 URL（會先下載）
            output_type: 輸出類型 (1=PNG透明背景, 2=JPG白色背景)
            return_type: 返回類型 (本地服務只支援 2=Base64)
        
        Returns:
            dict: 包含去背結果的字典
        """
        from rembg import remove
        
        # 取得圖片資料
        image_bytes = await self._get_image_bytes(image_base64, image_url)
        
        try:
            # 載入圖片
            input_image = Image.open(io.BytesIO(image_bytes))
            original_width, original_height = input_image.size
            
            # 執行去背
            session = get_rembg_session()
            output_image = remove(
                input_image,
                session=session,
                alpha_matting=True,  # 啟用 alpha matting 以獲得更好的邊緣
                alpha_matting_foreground_threshold=240,
                alpha_matting_background_threshold=10,
            )
            
            # 根據 output_type 處理輸出
            output_buffer = io.BytesIO()
            
            if output_type == 2:
                # JPG 白色背景
                # 創建白色背景
                white_bg = Image.new("RGBA", output_image.size, (255, 255, 255, 255))
                # 合成
                white_bg.paste(output_image, mask=output_image.split()[3] if output_image.mode == 'RGBA' else None)
                # 轉換為 RGB 並儲存為 JPG
                final_image = white_bg.convert("RGB")
                final_image.save(output_buffer, format="JPEG", quality=95)
                mime_type = "image/jpeg"
            else:
                # PNG 透明背景（預設）
                output_image.save(output_buffer, format="PNG")
                mime_type = "image/png"
            
            output_buffer.seek(0)
            
            # 轉換為 Base64
            result_base64 = base64.b64encode(output_buffer.getvalue()).decode("utf-8")
            
            # 添加 data URI 前綴
            result_with_prefix = f"data:{mime_type};base64,{result_base64}"
            
            return {
                "success": True,
                "image": result_with_prefix,
                "width": output_image.width,
                "height": output_image.height,
            }
            
        except Exception as e:
            logger.error(f"去背處理失敗: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"去背處理失敗: {str(e)}"
            )
    
    async def _get_image_bytes(
        self,
        image_base64: Optional[str] = None,
        image_url: Optional[str] = None,
    ) -> bytes:
        """取得圖片的二進制資料"""
        
        if image_base64:
            # 從 Base64 解碼
            try:
                # 移除可能的 data URI 前綴
                if "," in image_base64:
                    image_base64 = image_base64.split(",")[1]
                
                return base64.b64decode(image_base64)
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Base64 解碼失敗: {str(e)}"
                )
        
        elif image_url:
            # 從 URL 下載
            import httpx
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(image_url)
                    response.raise_for_status()
                    return response.content
            except httpx.HTTPError as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"無法下載圖片: {str(e)}"
                )
        
        else:
            raise HTTPException(
                status_code=400,
                detail="必須提供 image_base64 或 image_url"
            )
    
    def is_available(self) -> bool:
        """檢查服務是否可用"""
        try:
            # 嘗試導入 rembg
            import rembg
            return True
        except ImportError:
            return False


# 創建服務實例
rembg_service = RembgService()
