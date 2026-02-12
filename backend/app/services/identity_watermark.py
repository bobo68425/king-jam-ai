"""
證件照浮水印服務
上傳時自動加上「僅供網站開通認證使用」浮水印，防止證件被盜用
"""

import os
import logging
from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger(__name__)

WATERMARK_TEXT = "僅供網站開通認證使用"

# 常見中文字體路徑（依序嘗試）
FONT_PATHS = [
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
]


def _get_font(size: int = 36):
    """取得支援中文的字體，若無則回傳預設"""
    for path in FONT_PATHS:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception as e:
                logger.warning(f"[Watermark] 載入字體失敗 {path}: {e}")
                continue
    try:
        return ImageFont.load_default()
    except Exception:
        return None


def add_watermark(input_path: str, output_path: str = None) -> str:
    """
    在圖片上加入半透明浮水印「僅供網站開通認證使用」
    
    Args:
        input_path: 輸入圖片路徑
        output_path: 輸出路徑，若為 None 則覆蓋原檔
    
    Returns:
        輸出檔案路徑
    """
    if output_path is None:
        output_path = input_path
    
    try:
        img = Image.open(input_path).convert("RGBA")
        width, height = img.size
        
        overlay = Image.new("RGBA", img.size, (255, 255, 255, 0))
        draw = ImageDraw.Draw(overlay)
        
        font_size = max(24, min(width, height) // 20)
        font = _get_font(size=font_size)
        
        if font is None:
            # 無字體時用斜線網格
            for i in range(0, width + height, 60):
                x1, y1 = min(i, width), max(0, i - width)
                x2, y2 = max(0, i - height), min(i, height)
                draw.line([(x1, y1), (x2, y2)], fill=(255, 255, 255, 40), width=2)
        else:
            try:
                bbox = draw.textbbox((0, 0), WATERMARK_TEXT, font=font)
            except (AttributeError, TypeError):
                bbox = [0, 0, font_size * len(WATERMARK_TEXT), font_size]
            tw = bbox[2] - bbox[0]
            th = bbox[3] - bbox[1]
            spacing = int(max(tw, th) * 2)
            
            for y in range(-height, height * 2, spacing):
                for x in range(-width, width * 2, spacing):
                    draw.text(
                        (x, y),
                        WATERMARK_TEXT,
                        font=font,
                        fill=(255, 255, 255, 50),
                        stroke_width=1,
                        stroke_fill=(0, 0, 0, 25),
                    )
            
            # 旋轉 45 度成為斜角浮水印（expand=True 後再裁切回原尺寸）
            overlay = overlay.rotate(-45, expand=True, resample=Image.BICUBIC)
            # 裁切至與原圖相同中心區域
            crop_x = (overlay.width - width) // 2
            crop_y = (overlay.height - height) // 2
            overlay = overlay.crop((crop_x, crop_y, crop_x + width, crop_y + height))
        
        out = Image.alpha_composite(img, overlay)
        
        if input_path.lower().endswith((".jpg", ".jpeg")):
            out = out.convert("RGB")
            out.save(output_path, "JPEG", quality=92)
        else:
            out.save(output_path, "PNG")
        
        return output_path
    except Exception as e:
        logger.exception(f"[Watermark] 浮水印處理失敗: {e}")
        raise
