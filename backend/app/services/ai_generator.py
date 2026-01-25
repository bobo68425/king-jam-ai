import os
import google.generativeai as genai
from fastapi import HTTPException
from typing import Literal, Optional
from sqlalchemy.orm import Session

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

# 語氣風格詳細設定
TONE_STYLES = {
    # 基礎風格
    "professional": {
        "name": "專業正式",
        "voice": "權威且專業的商業語氣，使用精準的用詞和清晰的邏輯結構",
        "structure": "論點明確、數據支持、結論有力",
        "audience": "企業決策者、專業人士",
        "examples": "如《哈佛商業評論》的分析文章"
    },
    "casual": {
        "name": "輕鬆隨性",
        "voice": "像朋友聊天一樣自然，偶爾加入口語化表達",
        "structure": "自由流暢、故事導向、輕鬆閱讀",
        "audience": "一般大眾、年輕族群",
        "examples": "如生活部落客的日常分享"
    },
    "friendly": {
        "name": "親切友善",
        "voice": "溫暖且具同理心，像一位關心你的好朋友",
        "structure": "循序漸進、貼心提醒、鼓勵行動",
        "audience": "需要引導的新手、猶豫的消費者",
        "examples": "如品牌客服的溫馨回覆"
    },
    "humorous": {
        "name": "幽默風趣",
        "voice": "機智幽默、輕鬆詼諧，適時加入有趣的比喻或雙關語",
        "structure": "開場有梗、內容有料、結尾有笑點",
        "audience": "喜歡輕鬆內容的讀者",
        "examples": "如脫口秀風格的評論"
    },
    "educational": {
        "name": "教育科普",
        "voice": "清晰易懂、循序漸進，像一位耐心的老師",
        "structure": "概念說明、實例演示、總結複習",
        "audience": "學習者、求知慾強的讀者",
        "examples": "如 TED-Ed 的科普影片腳本"
    },
    
    # 進階風格
    "storytelling": {
        "name": "故事敘述",
        "voice": "富有情感的敘事者，用故事傳遞訊息",
        "structure": "開場設懸念、發展有衝突、結局有啟發",
        "audience": "喜歡故事的讀者",
        "examples": "如《紐約客》的人物專訪"
    },
    "inspiring": {
        "name": "激勵人心",
        "voice": "充滿正能量和鼓勵，讓人燃起希望和動力",
        "structure": "困境描述、轉折突破、成功啟示",
        "audience": "需要鼓勵的人、追求成長的讀者",
        "examples": "如 TED 演講的勵志風格"
    },
    "analytical": {
        "name": "分析評論",
        "voice": "客觀理性、深入剖析，提供獨特見解",
        "structure": "現象觀察、原因分析、未來預測",
        "audience": "產業觀察者、投資人、決策者",
        "examples": "如《經濟學人》的深度報導"
    },
    "conversational": {
        "name": "對話式",
        "voice": "像與讀者對話，直接用「你」稱呼，互動感強",
        "structure": "提問開場、回答解惑、引導思考",
        "audience": "需要互動感的讀者",
        "examples": "如 FAQ 或問答專欄"
    },
    "luxury": {
        "name": "高端奢華",
        "voice": "優雅精緻、品味卓越，用詞講究、意象豐富",
        "structure": "意境營造、細節描繪、價值昇華",
        "audience": "高端客群、品味人士",
        "examples": "如精品品牌的文案風格"
    },
    
    # 特殊風格
    "minimalist": {
        "name": "極簡精煉",
        "voice": "言簡意賅、直擊重點，沒有廢話",
        "structure": "重點條列、精簡段落、快速總結",
        "audience": "忙碌的專業人士、快速瀏覽者",
        "examples": "如 bullet point 式的摘要"
    },
    "emotional": {
        "name": "感性動人",
        "voice": "細膩感性、觸動人心，引發情感共鳴",
        "structure": "情境描繪、情感連結、心靈觸動",
        "audience": "感性的讀者、需要被理解的人",
        "examples": "如暖心散文或品牌感人故事"
    },
    "authoritative": {
        "name": "權威專家",
        "voice": "專業權威、見解深刻，展現領域專業度",
        "structure": "專業論述、研究引用、權威結論",
        "audience": "尋求專業意見的讀者",
        "examples": "如專家專欄或白皮書"
    },
    "trendy": {
        "name": "潮流時尚",
        "voice": "跟上時代、使用流行語，年輕有活力",
        "structure": "熱門開場、潮流連結、社群友善",
        "audience": "Z世代、年輕族群",
        "examples": "如時尚雜誌或潮流媒體"
    },
    "faith": {
        "name": "信仰靈性",
        "voice": "溫柔堅定、充滿盼望，帶有屬靈的深度",
        "structure": "真理闡述、生命見證、信仰應用",
        "audience": "信仰者、追尋靈性的人",
        "examples": "如靈修文章或生命見證"
    },
}

def get_tone_instructions(tone: str) -> str:
    """根據語氣風格生成詳細的寫作指導"""
    style = TONE_STYLES.get(tone, TONE_STYLES["professional"])
    return f"""
### 語氣風格：{style['name']}
- **聲音特質**：{style['voice']}
- **文章結構**：{style['structure']}
- **目標讀者**：{style['audience']}
- **參考風格**：{style['examples']}
"""

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

# 備用 Prompt（當資料庫無法讀取時使用）
FALLBACK_BLOG_PROMPT = """你是一位頂尖的內容策略專家，曾為《紐約時報》、《Forbes》、《商業周刊》等權威媒體撰稿。
你擅長根據不同風格需求，創作出引人入勝且具有獨特價值的內容。

## 📝 創作任務
**主題**：{{topic}}
{{tone_instructions}}

## 🎯 寫作框架

### 開場 (Hook)
- 使用令人驚訝的數據、反直覺的觀點、或引人共鳴的場景開場
- 前 50 字必須抓住讀者注意力
- 根據語氣風格調整開場方式（專業風格用數據，故事風格用場景，幽默風格用趣事）

### 正文結構
- 根據語氣風格選擇適合的敘事結構
- 每個段落都有明確的核心論點
- 使用具體案例、數據、專家引言增加可信度
- 適時加入比喻和類比，讓抽象概念具象化

### 收尾 (Call to Action)
- 總結核心價值
- 給讀者一個可立即執行的行動建議
- 留下思考的餘韻或情感共鳴

## ✨ 品質標準
1. **風格一致**：全文貫徹所選的語氣風格，不要混用
2. **深度**：不只說「是什麼」，更要說「為什麼」和「怎麼做」
3. **獨特性**：提供獨到見解，避免老生常談
4. **可讀性**：句子簡潔有力，段落間邏輯清晰
5. **價值感**：讀完後讓人覺得「學到了東西」或「被觸動」
6. **SEO 友善**：自然融入關鍵字，標題層次分明

## 📐 輸出格式
- 直接輸出 HTML 格式 (h1, h2, h3, p, ul, li, strong, em, blockquote)
- h1 作為主標題（只能有一個）
- h2 作為章節標題
- h3 作為小節標題
- 不要包含 html, head, body 標籤
- 不要使用 Markdown 代碼區塊符號
- 文章長度：800-1500 字
- 至少包含 3 個 h2 主要段落
- 適當使用列表 (ul/li) 和引言區塊 (blockquote) 增加視覺層次
"""

# 3. 定義生成函式
async def generate_blog_post(
    topic: str, 
    tone: str = "professional", 
    model_key: str = "gemini-2.5-flash",
    db: Optional[Session] = None
) -> str:
    """
    呼叫 Gemini 生成部落格文章
    
    Args:
        topic: 文章主題
        tone: 語氣風格
        model_key: 使用的模型
        db: 資料庫連線（可選，用於從 Prompt Registry 讀取）
    """
    try:
        # 驗證模型是否可用
        if model_key not in AVAILABLE_MODELS:
            raise ValueError(f"Unknown model: {model_key}. Available models: {list(AVAILABLE_MODELS.keys())}")
        
        # 獲取模型 ID
        model_id = AVAILABLE_MODELS[model_key]["model_id"]
        model = genai.GenerativeModel(model_id)
        
        # 取得語氣風格詳細指導
        tone_instructions = get_tone_instructions(tone)
        
        # 嘗試從資料庫獲取 Prompt
        prompt = None
        if db:
            try:
                from app.services.prompt_service import get_prompt_by_slug
                result = await get_prompt_by_slug(
                    db=db,
                    slug="blog-article-generator",
                    variables={
                        "topic": topic,
                        "tone_instructions": tone_instructions
                    },
                    fallback_prompt=FALLBACK_BLOG_PROMPT
                )
                prompt = result["positive"]
                if result.get("from_db"):
                    print(f"[BlogGenerator] ✓ 使用資料庫 Prompt (ID: {result.get('prompt_id')})")
                else:
                    print("[BlogGenerator] ⚠️ 使用備用 Prompt")
            except Exception as e:
                print(f"[BlogGenerator] 從資料庫獲取 Prompt 失敗: {e}")
        
        # 如果沒有從資料庫獲取到，使用備用 Prompt
        if not prompt:
            prompt = FALLBACK_BLOG_PROMPT.replace("{{topic}}", topic).replace("{{tone_instructions}}", tone_instructions)
            print("[BlogGenerator] 使用內建備用 Prompt")

        # 發送請求
        response = await model.generate_content_async(prompt)
        
        if not response or not response.text:
            raise Exception("Empty response from Gemini API")
        
        return response.text

    except Exception as e:
        error_msg = str(e)
        print(f"Gemini API Error: {error_msg}")
        # 返回更詳細的錯誤訊息以便調試
        raise HTTPException(status_code=500, detail=f"AI generation failed: {error_msg}")