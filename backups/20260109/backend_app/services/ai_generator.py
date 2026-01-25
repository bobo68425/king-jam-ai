import os
import google.generativeai as genai
from fastapi import HTTPException
from typing import Literal

# 1. 設定 API Key
GOOGLE_GEMINI_KEY = os.getenv("GOOGLE_GEMINI_KEY")

if not GOOGLE_GEMINI_KEY:
    # 這是為了防止開發者忘記設 Key
    print("Warning: GOOGLE_GEMINI_KEY is not set.")
else:
    genai.configure(api_key=GOOGLE_GEMINI_KEY)

# 2. 定義可用的模型和對應的點數成本
AVAILABLE_MODELS = {
    "gemini-2.5-flash": {
        "model_id": "models/gemini-2.5-flash",
        "cost": 3,  # 點數成本
        "name": "Gemini 2.5 Flash",
        "description": "快速且經濟，適合一般內容生成"
    },
    "gemini-2.5-pro": {
        "model_id": "models/gemini-2.5-pro",
        "cost": 10,  # 點數成本
        "name": "Gemini 2.5 Pro",
        "description": "更強大且準確，適合高品質內容"
    },
    "gemini-pro-latest": {
        "model_id": "models/gemini-pro-latest",
        "cost": 5,  # 點數成本
        "name": "Gemini Pro Latest",
        "description": "穩定版本，平衡速度與品質"
    },
    "gemini-flash-latest": {
        "model_id": "models/gemini-flash-latest",
        "cost": 2,  # 點數成本
        "name": "Gemini Flash Latest",
        "description": "最新 Flash 版本，速度最快"
    }
}

# 定義模型類型的 Literal 類型
ModelType = Literal["gemini-2.5-flash", "gemini-2.5-pro", "gemini-pro-latest", "gemini-flash-latest"]

def get_model_cost(model_key: str) -> int:
    """獲取指定模型的點數成本"""
    if model_key not in AVAILABLE_MODELS:
        raise ValueError(f"Unknown model: {model_key}")
    return AVAILABLE_MODELS[model_key]["cost"]

def get_available_models():
    """獲取所有可用模型的資訊"""
    return {
        key: {
            "name": value["name"],
            "description": value["description"],
            "cost": value["cost"]
        }
        for key, value in AVAILABLE_MODELS.items()
    }

# 3. 定義生成函式
async def generate_blog_post(topic: str, tone: str = "professional", model_key: str = "gemini-2.5-flash") -> str:
    """
    呼叫 Gemini 1.5 Flash 生成部落格文章
    """
    try:
        # 驗證模型是否可用
        if model_key not in AVAILABLE_MODELS:
            raise ValueError(f"Unknown model: {model_key}. Available models: {list(AVAILABLE_MODELS.keys())}")
        
        # 獲取模型 ID
        model_id = AVAILABLE_MODELS[model_key]["model_id"]
        model = genai.GenerativeModel(model_id)
        
        # 3. 組合 Prompt (提示詞工程)
        prompt = f"""
        你是一位專業的 SEO 內容行銷專家。
        請根據以下主題撰寫一篇完整的部落格文章。
        
        主題：{topic}
        語氣：{tone}
        格式：請直接輸出 HTML 格式 (包含 <h2>, <p>, <ul> 等標籤)，不要包含 <html> 或 <body> 標籤，也不要 Markdown 代碼區塊符號。
        要求：
        1. 標題要吸引人。
        2. 內容要有深度，至少 3 個段落。
        3. 包含一個總結。
        """

        # 4. 發送請求
        response = await model.generate_content_async(prompt)
        
        if not response or not response.text:
            raise Exception("Empty response from Gemini API")
        
        return response.text

    except Exception as e:
        error_msg = str(e)
        print(f"Gemini API Error: {error_msg}")
        # 返回更詳細的錯誤訊息以便調試
        raise HTTPException(status_code=500, detail=f"AI generation failed: {error_msg}")