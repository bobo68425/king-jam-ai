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
    # Minimax — 高品質且快速 (取代已棄用的 Luma)
    "minimax": "fal-ai/minimax/video-01",
    # Kling — 高性價比
    "kling": "fal-ai/kling-video/v1/standard/text-to-video",
    "kling_img2vid": "fal-ai/kling-video/v1/standard/image-to-video",
    # SadTalker — 數字人播報 (極低成本 S2V)
    "sadtalker": "fal-ai/sadtalker",
}

# 關鍵字 → 模型選擇規則
MODEL_SELECTION_RULES = {
    # 動態人物、複雜場景 → Wan 2.1
    "wan21": ["人物", "角色", "對話", "表演", "舞蹈", "運動", "動作", "character", "person", "dance"],
    # 電影感、風景、質感 → Minimax
    "minimax": ["電影", "風景", "自然", "航拍", "城市", "夜景", "cinematic", "landscape", "scenic"],
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
    
    # 由於 fal.ai 近期對 Luma 棄用、Minimax 下游服務不穩定 (Downstream unavailable)
    # 且 Wan 2.1 的結果取得 API 目前回傳 404 Path not found (官方伺服器端 BUG)
    # 我們在此強制所有請求都退回到唯一完全穩定運作的 Kling 模型
    best = "kling" 
    
    logger.info(f"[fal] Prompt 分析: '{prompt[:30]}...' → 因其他模型官方 API 不穩定，強制回退使用模型 {best}")
    return FAL_MODELS[best]


async def generate_scene_clip(
    prompt: str = "",
    duration: int = 5,
    aspect_ratio: str = "9:16",
    model_preference: str = "auto",
    webhook_url: Optional[str] = None,
    reference_image_url: Optional[str] = None,
    audio_url: Optional[str] = None,
    quality_prompt: str = "",
    negative_prompt: str = "",
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

    if model_preference == "sadtalker" or "sadtalker" in model_id:
        # SadTalker 數字人模式
        model_id = FAL_MODELS["sadtalker"]
        if not reference_image_url or not audio_url:
            raise ValueError("SadTalker 模式必須同時提供 reference_image_url 與 audio_url")
        
        input_data: Dict[str, Any] = {
            "source_image_url": reference_image_url,
            "driven_audio_url": audio_url,
            "still": True
        }
    else:
        # 既有的 T2V / I2V 邏輯
        # 如果有參考圖片，使用 image-to-video 版本
        if reference_image_url:
            if "wan" in model_id:
                model_id = FAL_MODELS["wan21_img2vid"]
            elif "kling" in model_id:
                model_id = FAL_MODELS["kling_img2vid"]
        
        # 自動加上質量提示詞與強制寫入 Negative Prompt
        enhanced_prompt = prompt.strip()
        if quality_prompt:
            if enhanced_prompt and not enhanced_prompt.endswith(","):
                enhanced_prompt += ", "
            enhanced_prompt += quality_prompt

        # 構建模型特定請求參數 (fal.ai 各模型 schema 不同)
        input_data: Dict[str, Any] = {
            "prompt": enhanced_prompt,
        }
        if negative_prompt:
            input_data["negative_prompt"] = negative_prompt
        
        if "wan" in model_id:
            # Wan 2.1: 支持 num_frames, resolution, aspect_ratio
            input_data["num_frames"] = min(duration * 24, 81)  # Wan 2.1 1.3b 最多 81 frames
            input_data["resolution"] = "480p"
            input_data["aspect_ratio"] = aspect_ratio
            if reference_image_url:
                input_data["image_url"] = reference_image_url
        elif "minimax" in model_id:
            # Minimax: 不額外傳參數，預設只吃 prompt
            pass
        elif "kling" in model_id:
            # Kling: 接受 duration, aspect_ratio
            input_data["duration"] = str(min(duration, 5))
            input_data["aspect_ratio"] = aspect_ratio
            if reference_image_url:
                input_data["image_url"] = reference_image_url
    
    # 使用 Queue API 異步提交 — 直接傳入 input_data (不要包在 "input" key 裡)
    api_url = f"https://queue.fal.run/{model_id}"
    
    headers = {
        "Authorization": f"Key {FAL_KEY}",
        "Content-Type": "application/json",
    }
    
    # fal.ai Queue API: 直接在 body 傳入參數
    payload = dict(input_data)
    
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
    查詢 fal.ai 任務狀態並取得結果
    """
    import httpx
    
    # fal.ai queue polling url 需要的是基礎 app 名稱 (如 fal-ai/wan)，而不是完整路徑
    base_app_id = model_id
    if "fal-ai/wan" in model_id:
        base_app_id = "fal-ai/wan"
    elif "fal-ai/kling" in model_id:
        base_app_id = "fal-ai/kling-video"
    elif "fal-ai/sadtalker" in model_id:
        base_app_id = "fal-ai/sadtalker"
        
    # Step 1: 查詢狀態
    status_url = f"https://queue.fal.run/{base_app_id}/requests/{request_id}/status"
    headers = {"Authorization": f"Key {FAL_KEY}"}
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(status_url, headers=headers)
        response.raise_for_status()
        result = response.json()
    
    status = result.get("status", "unknown")
    logger.info(f"[fal] 狀態查詢: {request_id} → {status}")
    
    if status == "COMPLETED":
        video_url = None
        
        # 使用 REST GET 取得結果
        # fal.ai docs: GET /requests/{id} 返回 { status, response: { video: { url } } }
        result_url = f"https://queue.fal.run/{base_app_id}/requests/{request_id}"
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(result_url, headers=headers)
                logger.info(f"[fal] result GET status={resp.status_code}")
                
                if resp.status_code == 200:
                    output = resp.json()
                    logger.info(f"[fal] result output keys: {list(output.keys())}")
                    
                    # 新格式: { "response": { "video": { "url": "..." } } }
                    if "response" in output and isinstance(output["response"], dict):
                        inner = output["response"]
                        if "video" in inner:
                            video_url = inner["video"].get("url")
                    # 舊格式: { "video": { "url": "..." } }
                    elif "video" in output:
                        video_url = output["video"].get("url")
                    # 嘗試其他可能格式
                    elif "data" in output:
                        data = output["data"]
                        if isinstance(data, dict) and "video" in data:
                            video_url = data["video"].get("url")
                    
                    if not video_url:
                        # 記錄完整輸出以便調試
                        import json
                        logger.warning(f"[fal] 無法從結果中取得 video_url, 完整輸出: {json.dumps(output, ensure_ascii=False)[:500]}")
                else:
                    logger.warning(f"[fal] result GET 失敗: {resp.status_code} - {resp.text[:200]}")
        except Exception as e:
            logger.warning(f"[fal] result GET 異常: {e}")
        
        if video_url:
            logger.info(f"[fal] ✅ 影片生成完成: {video_url[:100]}")
        
        return {
            "request_id": request_id,
            "status": "completed",
            "video_url": video_url,
        }
    
    elif status == "FAILED":
        return {
            "request_id": request_id,
            "status": "failed",
            "error": result.get("error", "Unknown error"),
        }
    
    return {
        "request_id": request_id,
        "status": status.lower(),
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
