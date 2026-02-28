"""
fal.ai 影片片段生成服務
======================
使用 fal-client 異步生成 AI 影片片段
支持模型: Wan 2.1 / Luma / Kling (透過 fal.ai)
"""

import os
import logging
import uuid
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

FAL_KEY = os.getenv("FAL_KEY", "")

# fal.ai 模型配置
FAL_MODELS = {
    # Wan 2.1 — 最佳通用模型
    "wan21": "fal-ai/wan/v2.1/1.3b/text-to-video",
    "wan21_img2vid": "fal-ai/wan/v2.1/1.3b/image-to-video",
    # Luma — 高品質電影風格
    "luma": "fal-ai/luma-dream-machine",
    # Kling — 高性價比
    "kling": "fal-ai/kling-video/v2/master/text-to-video",
}

# 關鍵字 → 模型選擇規則
MODEL_SELECTION_RULES = {
    # 動態人物、複雜場景 → Wan 2.1
    "wan21": ["人物", "角色", "對話", "表演", "舞蹈", "運動", "動作", "character", "person", "dance"],
    # 電影感、風景、質感 → Luma
    "luma": ["電影", "風景", "自然", "航拍", "城市", "夜景", "cinematic", "landscape", "scenic"],
    # 產品展示、簡單場景 → Kling (高性價比)
    "kling": ["產品", "展示", "商品", "食物", "美食", "product", "food", "unboxing"],
}


def select_best_model(prompt: str, preference: str = "auto") -> str:
    """
    根據提示詞自動選擇最佳模型
    
    Args:
        prompt: 場景描述
        preference: 用戶偏好 (auto / wan21 / luma / kling)
    
    Returns:
        fal.ai model ID
    """
    if preference != "auto" and preference in FAL_MODELS:
        logger.info(f"[fal] 使用指定模型: {preference}")
        return FAL_MODELS[preference]
    
    prompt_lower = prompt.lower()
    
    # 基於關鍵字匹配
    scores = {model: 0 for model in FAL_MODELS}
    for model_key, keywords in MODEL_SELECTION_RULES.items():
        for kw in keywords:
            if kw in prompt_lower:
                scores[model_key] += 1
    
    # 選擇得分最高的，預設 Wan 2.1
    best = max(scores, key=scores.get)
    if scores[best] == 0:
        best = "wan21"  # 預設選擇
    
    logger.info(f"[fal] 自動選擇模型: {best} (scores: {scores})")
    return FAL_MODELS[best]


async def generate_scene_clip(
    prompt: str,
    duration: int = 5,
    aspect_ratio: str = "9:16",
    model_preference: str = "auto",
    webhook_url: Optional[str] = None,
    reference_image_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    異步生成 AI 影片片段
    
    使用 fal.ai Queue API + Webhook 機制:
    1. POST queue/submit → 返回 request_id
    2. fal.ai 完成後 POST webhook_url
    3. 或者直接輪詢 queue/status
    
    Args:
        prompt: 場景描述
        duration: 影片秒數
        aspect_ratio: 比例 (9:16 / 16:9 / 1:1)
        model_preference: 模型偏好 (auto / wan21 / luma / kling)
        webhook_url: Webhook 回調 URL
        reference_image_url: 參考圖片 (用於 image-to-video)
    
    Returns:
        { "request_id": str, "model": str, "status": "queued" }
    """
    import httpx
    
    if not FAL_KEY:
        raise ValueError("FAL_KEY 環境變數未設定")
    
    # 選擇模型
    model_id = select_best_model(prompt, model_preference)
    
    # 如果有參考圖片，使用 image-to-video 版本
    if reference_image_url and "wan" in model_id:
        model_id = FAL_MODELS["wan21_img2vid"]
    
    # 構建請求
    input_data: Dict[str, Any] = {
        "prompt": prompt,
        "num_frames": duration * 24,  # 假設 24fps
    }
    
    # 模型特定參數
    if "wan" in model_id:
        input_data["resolution"] = "720p" if aspect_ratio == "9:16" else "720p"
        input_data["aspect_ratio"] = aspect_ratio
        if reference_image_url:
            input_data["image_url"] = reference_image_url
    elif "luma" in model_id:
        input_data["aspect_ratio"] = aspect_ratio
    elif "kling" in model_id:
        input_data["duration"] = str(duration)
        input_data["aspect_ratio"] = aspect_ratio
    
    # 使用 Queue API 異步提交
    api_url = f"https://queue.fal.run/{model_id}"
    
    headers = {
        "Authorization": f"Key {FAL_KEY}",
        "Content-Type": "application/json",
    }
    
    payload: Dict[str, Any] = {"input": input_data}
    
    # 設定 Webhook (如果有提供)
    if webhook_url:
        payload["webhook_url"] = webhook_url
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(api_url, json=payload, headers=headers)
        response.raise_for_status()
        result = response.json()
    
    request_id = result.get("request_id", str(uuid.uuid4()))
    
    logger.info(f"[fal] 任務已提交: model={model_id}, request_id={request_id}")
    
    return {
        "request_id": request_id,
        "model": model_id,
        "status": "queued",
    }


async def check_scene_status(request_id: str, model_id: str) -> Dict[str, Any]:
    """
    查詢 fal.ai 任務狀態
    
    Returns:
        { "status": "queued" | "processing" | "completed" | "failed",
          "video_url": str | None, "error": str | None }
    """
    import httpx
    
    status_url = f"https://queue.fal.run/{model_id}/requests/{request_id}/status"
    
    headers = {"Authorization": f"Key {FAL_KEY}"}
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(status_url, headers=headers)
        response.raise_for_status()
        result = response.json()
    
    status = result.get("status", "unknown")
    
    if status == "COMPLETED":
        # 取得結果
        result_url = f"https://queue.fal.run/{model_id}/requests/{request_id}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(result_url, headers=headers)
            response.raise_for_status()
            output = response.json()
        
        video_url = None
        # 不同模型的輸出格式
        if "video" in output:
            video_url = output["video"].get("url")
        elif "output" in output and isinstance(output["output"], dict):
            video_url = output["output"].get("video", {}).get("url")
        
        return {
            "status": "completed",
            "video_url": video_url,
        }
    
    elif status == "FAILED":
        return {
            "status": "failed",
            "error": result.get("error", "Unknown error"),
        }
    
    return {
        "status": status.lower(),
        "video_url": None,
    }


async def handle_webhook(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    處理 fal.ai Webhook 回調
    
    fal.ai 任務完成後 POST 到我們的 Webhook URL:
    {
        "request_id": "...",
        "status": "COMPLETED",
        "payload": { "video": { "url": "..." } }
    }
    """
    request_id = payload.get("request_id", "")
    status = payload.get("status", "")
    
    if status == "COMPLETED":
        output = payload.get("payload", {})
        video_url = None
        
        if "video" in output:
            video_url = output["video"].get("url")
        
        logger.info(f"[fal] Webhook: 任務 {request_id} 完成, URL: {video_url}")
        return {
            "request_id": request_id,
            "status": "completed",
            "video_url": video_url,
        }
    
    elif status == "FAILED":
        error = payload.get("error", "Unknown")
        logger.error(f"[fal] Webhook: 任務 {request_id} 失敗: {error}")
        return {
            "request_id": request_id,
            "status": "failed",
            "error": error,
        }
    
    return {"request_id": request_id, "status": status.lower()}
