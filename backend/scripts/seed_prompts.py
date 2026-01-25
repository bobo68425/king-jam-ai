"""
Prompt 種子資料腳本
==================

將平台現有的所有 AI 引擎 Prompt 整合到 Prompt Registry 資料庫中。

使用方式:
    docker-compose exec backend python scripts/seed_prompts.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.models import Prompt, PromptVersion

# ============================================================
# Prompt 定義
# ============================================================

SEED_PROMPTS = [
    # ============================================================
    # 1. 部落格文章生成
    # ============================================================
    {
        "name": "部落格文章生成器",
        "slug": "blog-article-generator",
        "description": "專業級部落格文章生成，支援多種語氣風格。可生成 SEO 友善的 HTML 格式文章。",
        "category": "blog",
        "generation_type": "copywriting",
        "supported_models": ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"],
        "default_model": "gemini-2.5-flash",
        "tags": ["熱門", "部落格", "SEO", "文章"],
        "is_system": True,
        "is_public": True,
        "positive_template": """你是一位頂尖的內容策略專家，曾為《紐約時報》、《Forbes》、《商業周刊》等權威媒體撰稿。
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
- 適當使用列表 (ul/li) 和引言區塊 (blockquote) 增加視覺層次""",
        "negative_template": None,
        "model_config": {
            "temperature": 0.8,
            "max_tokens": 4000,
            "top_p": 0.95
        },
        "variables": [
            {"name": "topic", "label": "文章主題", "type": "text", "required": True, "placeholder": "例如：如何提升工作效率"},
            {"name": "tone_instructions", "label": "語氣風格指導", "type": "textarea", "required": False},
            # 國籍/地區相關變數（自動注入）
            {"name": "user_country", "label": "用戶國家", "type": "text", "required": False, "default": "台灣", "auto_inject": True},
            {"name": "user_language", "label": "用戶語言", "type": "text", "required": False, "default": "繁體中文", "auto_inject": True},
            {"name": "user_culture", "label": "用戶文化", "type": "text", "required": False, "default": "台灣華人文化", "auto_inject": True},
            {"name": "content_style", "label": "內容風格", "type": "text", "required": False, "default": "親切、活潑、帶有台灣在地用語", "auto_inject": True}
        ],
        "system_prompt": "你是專業的內容創作者，擅長撰寫高品質的部落格文章。"
    },
    
    # ============================================================
    # 2. 部落格封面圖生成
    # ============================================================
    {
        "name": "部落格封面圖生成器",
        "slug": "blog-cover-image-generator",
        "description": "為部落格文章生成專業級封面圖片，支援多種視覺風格和品質設定。",
        "category": "image_prompt",
        "generation_type": "image",
        "supported_models": ["imagen-3.0-generate-002", "imagen-3.0-fast-generate-001"],
        "default_model": "imagen-3.0-generate-002",
        "tags": ["熱門", "封面", "圖片", "部落格"],
        "is_system": True,
        "is_public": True,
        "positive_template": """[ABSOLUTE CRITICAL RULE - ZERO TEXT ALLOWED]:
⛔ DO NOT include ANY text, words, letters, characters, or typography in the image.
⛔ NO Chinese characters (中文/漢字/繁體/簡體) - absolutely forbidden.
⛔ NO English text, NO Japanese, NO Korean, NO text in ANY language.
⛔ NO numbers, NO watermarks, NO logos, NO labels, NO captions.
⛔ The image must be 100% PURE VISUAL with ZERO readable content.
⛔ If you add any text, the image will be rejected.

[UNIQUENESS RULE]: This image MUST be visually distinctive and specifically relevant to this exact topic: "{{topic}}". Do NOT use generic, stock-photo-style imagery. Create something an art director would be proud of.

{{visual_description}}

{{quality_boosters}}
{{style_instructions}}

=== VISUAL DESIGN ===
MOOD & ATMOSPHERE: {{mood}}
COLOR PALETTE: {{colors}}
LIGHTING DESIGN: {{lighting}}
COMPOSITION: {{composition}}
TEXTURE & DETAILS: {{texture}}
{{cinematic_section}}

=== TECHNICAL SPECS ===
Format: 16:9 horizontal wide format blog cover
Quality: {{quality}}

=== QUALITY REQUIREMENTS ===
- Award-winning visual quality (think National Geographic, Vogue, museum exhibition)
- Sharp focus with beautiful bokeh where appropriate
- Rich, nuanced colors matching the topic mood
- Cinematic lighting with dimensional depth
- Clean, polished aesthetic with subtle imperfections for authenticity
- High contrast and visual impact
- Emotionally engaging composition that tells a story
- Each image should feel like a unique piece of art
- ABSOLUTELY NO TEXT IN THE IMAGE""",
        "negative_template": """text, words, letters, characters, typography, watermark, logo, caption, label, 
Chinese text, Japanese text, Korean text, any written language,
numbers, signs, banners, UI elements, buttons,
blurry, low quality, pixelated, grainy, noisy,
oversaturated, HDR artifacts, over-processed,
AI generated look, synthetic, plastic textures,
uncanny valley, unrealistic, CGI look, 3D render appearance""",
        "model_config": {
            "width": 1792,
            "height": 1024,
            "guidance_scale": 7.5,
            "num_inference_steps": 50
        },
        "variables": [
            {"name": "topic", "label": "主題", "type": "text", "required": True},
            {"name": "visual_description", "label": "視覺描述", "type": "textarea", "required": True},
            {"name": "mood", "label": "氛圍", "type": "text", "required": False, "default": "professional, inspiring"},
            {"name": "colors", "label": "色彩", "type": "text", "required": False, "default": "warm earth tones"},
            {"name": "lighting", "label": "燈光", "type": "text", "required": False, "default": "soft natural light"},
            {"name": "composition", "label": "構圖", "type": "text", "required": False, "default": "rule of thirds"},
            {"name": "texture", "label": "質感", "type": "text", "required": False, "default": "cinematic film grain"},
            {"name": "quality", "label": "品質", "type": "select", "required": False, "default": "ultra", "options": ["standard", "high", "ultra"]},
            {"name": "quality_boosters", "label": "品質強化", "type": "textarea", "required": False},
            {"name": "style_instructions", "label": "風格指導", "type": "textarea", "required": False},
            {"name": "cinematic_section", "label": "電影感設定", "type": "textarea", "required": False},
            # 國籍/地區相關變數（自動注入）
            {"name": "user_country", "label": "用戶國家", "type": "text", "required": False, "default": "台灣", "auto_inject": True},
            {"name": "user_language", "label": "用戶語言", "type": "text", "required": False, "default": "繁體中文", "auto_inject": True},
            {"name": "user_culture", "label": "用戶文化", "type": "text", "required": False, "default": "台灣華人文化", "auto_inject": True},
            {"name": "regional_aesthetic", "label": "地區美學風格", "type": "text", "required": False, "default": "亞洲都會時尚風格", "auto_inject": True}
        ]
    },
    
    # ============================================================
    # 3. 社群圖文生成
    # ============================================================
    {
        "name": "社群貼文圖片生成器",
        "slug": "social-media-image-generator",
        "description": "為 Instagram、Facebook、LINE 等社群平台生成專業圖片，確保真實攝影質感。",
        "category": "social_media",
        "generation_type": "image",
        "supported_models": ["imagen-3.0-generate-002", "imagen-3.0-fast-generate-001"],
        "default_model": "imagen-3.0-generate-002",
        "tags": ["熱門", "社群", "Instagram", "Facebook"],
        "is_system": True,
        "is_public": True,
        "positive_template": """[ABSOLUTE CRITICAL - ZERO TEXT RULE]:
⛔ DO NOT include ANY text, words, letters, characters anywhere in the image.
⛔ NO Chinese text (中文/漢字/繁體/簡體) - absolutely forbidden.
⛔ NO English, NO Japanese, NO Korean, NO text in ANY language.
⛔ NO numbers, logos, watermarks, captions, labels, signs.
⛔ PURE VISUAL ONLY - if any text appears, the image will be rejected.

[AUTHENTICITY RULE]:
This must look like a REAL photograph, NOT AI generated, NOT CGI, NOT 3D render.

═══ VISUAL SUBJECT ═══
{{visual_description}}

═══ AUTHENTICITY (CRITICAL) ═══
- Shot by professional human photographer on high-end camera
- Natural film grain and subtle lens imperfections
- Genuine lighting with natural falloff and shadows
- Real textures, organic materials, authentic atmosphere
- NOT artificial, NOT synthetic, NOT computer generated

═══ STYLE DIRECTION ═══
Mood: {{mood}}
Colors: {{colors}} (natural, true-to-life, not hyper-saturated)
Lighting: {{lighting}} (authentic, not artificially perfect)
Composition: {{composition}}
Aspect ratio: {{aspect_ratio}}
Quality: {{quality}}, shot on Hasselblad / Sony A7R V

═══ QUALITY REQUIREMENTS ═══
- Professional photography with natural imperfections
- Sharp focus with organic bokeh
- Rich but natural colors (not oversaturated)
- Subtle film grain, analog warmth
- Real-world lighting, not CGI lighting

═══ MUST AVOID ═══
- ANY text, words, letters, characters, typography in ANY language
- Chinese characters (中文), Japanese, Korean, or any written language
- Numbers, logos, watermarks, captions, labels, signs, banners
- AI generated look, synthetic appearance, plastic textures
- Overly smooth, unnaturally perfect, uncanny valley
- Hyper-saturated colors, HDR artifacts, over-processed
- CGI look, 3D render appearance, video game graphics""",
        "negative_template": """text, words, letters, Chinese text, Japanese text, watermark, logo,
AI generated, CGI, 3D render, synthetic, plastic, artificial,
oversaturated, HDR, over-processed, blurry, low quality""",
        "model_config": {
            "width": 1024,
            "height": 1024,
            "guidance_scale": 7.0
        },
        "variables": [
            {"name": "visual_description", "label": "視覺描述", "type": "textarea", "required": True, "placeholder": "描述圖片主題和內容"},
            {"name": "mood", "label": "氛圍", "type": "text", "required": False, "default": "engaging, vibrant"},
            {"name": "colors", "label": "色彩", "type": "text", "required": False, "default": "warm, inviting"},
            {"name": "lighting", "label": "燈光", "type": "text", "required": False, "default": "soft natural daylight"},
            {"name": "composition", "label": "構圖", "type": "text", "required": False, "default": "centered, balanced"},
            {"name": "aspect_ratio", "label": "比例", "type": "select", "required": False, "default": "1:1", "options": ["1:1", "4:5", "9:16", "16:9"]},
            {"name": "quality", "label": "品質", "type": "select", "required": False, "default": "high", "options": ["standard", "high", "ultra"]},
            # 國籍/地區相關變數（自動注入）
            {"name": "user_country", "label": "用戶國家", "type": "text", "required": False, "default": "台灣", "auto_inject": True},
            {"name": "user_language", "label": "用戶語言", "type": "text", "required": False, "default": "繁體中文", "auto_inject": True},
            {"name": "user_culture", "label": "用戶文化", "type": "text", "required": False, "default": "台灣華人文化", "auto_inject": True},
            {"name": "regional_aesthetic", "label": "地區美學風格", "type": "text", "required": False, "default": "亞洲都會時尚風格", "auto_inject": True}
        ]
    },
    
    # ============================================================
    # 4. 社群文案生成
    # ============================================================
    {
        "name": "社群貼文文案生成器",
        "slug": "social-media-caption-generator",
        "description": "為各大社群平台生成吸睛文案，包含適合的 Hashtag 和表情符號。",
        "category": "social_media",
        "generation_type": "copywriting",
        "supported_models": ["gemini-2.0-flash", "gemini-1.5-pro", "gpt-4o"],
        "default_model": "gemini-2.0-flash",
        "tags": ["熱門", "社群", "文案", "Hashtag"],
        "is_system": True,
        "is_public": True,
        "positive_template": """你是專業社群小編，請為「{{topic}}」撰寫 {{platform}} 貼文。

平台特性：{{platform_description}}

用戶地區：{{user_country}}
語言文化：{{user_language}}（{{user_culture}}）

文案風格要求：
- 語氣：{{tone}}
- 字數限制：{{char_limit}} 字以內
- 目標受眾：{{target_audience}}
- 內容風格：{{content_style}}
- Hashtag 風格：{{hashtag_style}}

{{keywords_section}}
{{product_info_section}}

創作規則：
- 第一句話要能在動態牆上就抓住眼球
- 內容要有價值感，不要太推銷
- 適當使用表情符號增加親和力
- 結尾加上 5-10 個相關 Hashtag
- 考慮平台演算法偏好
- 使用符合用戶地區文化的用語和熱門標籤

⚠️ 重要輸出規則：
- 直接輸出最終貼文內容，就像要直接發布到社群媒體上
- 絕對不要任何前言、標題、編號、說明、括號註解
- 不要輸出「主文案」「Hashtag」等標籤或分類
- 不要輸出任何括號內的說明（如「已在文案中運用」）
- 不要解釋你做了什麼，只要輸出成品""",
        "negative_template": None,
        "model_config": {
            "temperature": 0.85,
            "max_tokens": 1000
        },
        "variables": [
            {"name": "topic", "label": "主題", "type": "text", "required": True},
            {"name": "platform", "label": "平台", "type": "select", "required": True, "options": ["Instagram", "Facebook", "LINE", "Threads", "Twitter/X"]},
            {"name": "platform_description", "label": "平台特性說明", "type": "textarea", "required": False},
            {"name": "tone", "label": "語氣風格", "type": "select", "required": False, "default": "engaging", "options": ["engaging", "professional", "humorous", "inspirational", "casual"]},
            {"name": "char_limit", "label": "字數上限", "type": "number", "required": False, "default": 300, "min": 50, "max": 2000},
            {"name": "target_audience", "label": "目標受眾", "type": "text", "required": False, "default": "一般大眾"},
            {"name": "keywords_section", "label": "關鍵字區塊", "type": "textarea", "required": False},
            {"name": "product_info_section", "label": "產品資訊區塊", "type": "textarea", "required": False},
            {"name": "user_country", "label": "用戶國家", "type": "text", "required": False, "default": "台灣", "auto_inject": True},
            {"name": "user_language", "label": "用戶語言", "type": "text", "required": False, "default": "繁體中文", "auto_inject": True},
            {"name": "user_culture", "label": "用戶文化", "type": "text", "required": False, "default": "台灣文化", "auto_inject": True},
            {"name": "content_style", "label": "內容風格", "type": "text", "required": False, "default": "親切、活潑、帶有台灣在地用語", "auto_inject": True},
            {"name": "hashtag_style", "label": "Hashtag風格", "type": "text", "required": False, "default": "中英混搭，包含台灣熱門標籤", "auto_inject": True}
        ]
    },
    
    # ============================================================
    # 5. AI 導演 - 影片腳本生成
    # ============================================================
    {
        "name": "AI 導演 - 影片腳本生成器",
        "slug": "ai-director-video-script",
        "description": "AI 導演引擎，將模糊需求轉換為結構化的影片腳本，包含場景視覺、旁白、配樂指令。",
        "category": "video_script",
        "generation_type": "copywriting",
        "supported_models": ["gemini-2.0-flash", "gemini-1.5-pro"],
        "default_model": "gemini-2.0-flash",
        "tags": ["熱門", "影片", "腳本", "AI導演"],
        "is_system": True,
        "is_public": True,
        "positive_template": """# 🎬 AI 導演引擎 - 品牌影片腳本生成

你是頂尖的品牌影片導演，曾為 Apple、Nike、國際精品執導廣告。你的任務是將客戶的想法轉化為完整的影片腳本。

## 🏢 品牌基因
- **品牌名稱**：{{brand_name}}
- **品牌標語**：{{tagline}}
- **產業類別**：{{industry}}
- **品牌個性**：{{personality}}
- **語氣風格**：{{tone_of_voice}}
- **品牌主色**：{{primary_color}}
- **品牌輔色**：{{secondary_color}}
- **視覺風格**：{{visual_style}}
- **目標受眾**：{{target_audience}}
- **核心訊息**：{{key_messages}}
- **禁忌主題**：{{forbidden_themes}}

{{avatar_section}}

## 📋 影片需求
- **主題/概念**：{{topic}}
- **目標時長**：{{duration}} 秒
- **影片格式**：{{format}}
- **核心訊息**：{{key_message}}
- **參考風格**：{{reference_style}}

## 🎨 導演指導原則

1. **品牌一致性**：所有視覺元素必須呼應品牌色彩和風格
2. **情感弧線**：每支影片都要有起承轉合的情感旅程
3. **視覺衝擊**：開頭 3 秒必須有強烈的視覺 hook
4. **敘事節奏**：根據時長選擇適合的節奏（短片快節奏，長片有呼吸空間）
5. **受眾共鳴**：每個場景都要讓目標受眾感到被理解

## 📤 輸出格式
請以 JSON 格式輸出影片腳本：
{
  "title": "吸引人的影片標題",
  "description": "詳細描述整支影片的視覺敘事和情感弧線",
  "overall_style": "整體視覺風格（例如：cinematic commercial with warm tones）",
  "music_genre": "配樂風格（upbeat/emotional/energetic/calm/epic/minimal/inspirational）",
  "scenes": [
    {
      "scene_number": 1,
      "scene_type": "hook/problem/solution/demonstration/cta",
      "duration_seconds": 5,
      "visual_prompt": "【必須是專業英文提示詞】格式：[Camera Move] + [Subject] + [Action] + [Environment] + [Lighting] + [Mood]",
      "visual_style": "cinematic/moody/vibrant/minimal/luxurious/documentary",
      "camera_movement": "dolly_in/dolly_out/tracking/crane_up/crane_down/static/orbit/handheld/steadicam",
      "narration_text": "繁體中文旁白，自然口語，符合品牌語氣",
      "voice_emotion": "excited/calm/curious/urgent/warm/confident/inspiring",
      "text_overlay": "螢幕文字（選填，用於強調重點）",
      "text_position": "top/center/bottom",
      "text_animation": "fade_in/slide_up/pop/typewriter/none",
      "background_music_mood": "upbeat/emotional/energetic/calm/epic/minimal",
      "sound_effects": ["whoosh", "pop", "ambient", "impact", "transition"]
    }
  ]
}

## ✍️ Visual Prompt 撰寫指南（極其重要！）

### 優秀範例：
❌ 不好：「A product on a table」
✅ 好：「Slow cinematic dolly in on sleek smart watch resting on marble surface, morning sunlight creating long shadows, steam from nearby coffee cup drifting through frame, shallow depth of field with soft bokeh, premium advertising aesthetic, 8K quality」

### 必須包含的元素：
1. **鏡頭動作**：Slow dolly in / Smooth tracking left / Crane shot descending / Orbit around / Push in / Pull back
2. **主體描述**：詳細描述畫面主角（人物姿態、產品角度、物件細節）
3. **動作動詞**：resting, floating, rotating, walking, pouring, revealing, emerging
4. **環境細節**：場景、背景、前景元素、空間感
5. **光線設計**：Golden hour / Soft diffused / Dramatic rim lighting / Neon glow / Natural window light
6. **技術標籤**：Shallow depth of field / 8K / Cinematic color grading / Film grain / Professional lighting
7. **情緒氛圍**：Premium / Warm / Energetic / Peaceful / Luxurious / Inspiring""",
        "negative_template": None,
        "model_config": {
            "temperature": 0.9,
            "max_tokens": 4000
        },
        "variables": [
            {"name": "brand_name", "label": "品牌名稱", "type": "text", "required": True},
            {"name": "tagline", "label": "品牌標語", "type": "text", "required": False},
            {"name": "industry", "label": "產業類別", "type": "text", "required": False, "default": "綜合"},
            {"name": "personality", "label": "品牌個性", "type": "select", "required": False, "default": "friendly", "options": ["friendly", "professional", "playful", "luxurious", "innovative", "trustworthy"]},
            {"name": "tone_of_voice", "label": "語氣風格", "type": "text", "required": False, "default": "親切專業"},
            {"name": "primary_color", "label": "品牌主色", "type": "text", "required": False, "default": "#6366F1"},
            {"name": "secondary_color", "label": "品牌輔色", "type": "text", "required": False, "default": "#8B5CF6"},
            {"name": "visual_style", "label": "視覺風格", "type": "text", "required": False, "default": "modern, clean"},
            {"name": "target_audience", "label": "目標受眾", "type": "text", "required": False, "default": "一般大眾"},
            {"name": "key_messages", "label": "核心訊息", "type": "textarea", "required": False},
            {"name": "forbidden_themes", "label": "禁忌主題", "type": "textarea", "required": False},
            {"name": "avatar_section", "label": "角色設定區塊", "type": "textarea", "required": False},
            {"name": "topic", "label": "影片主題", "type": "textarea", "required": True, "placeholder": "描述你想要的影片內容"},
            {"name": "duration", "label": "時長（秒）", "type": "select", "required": False, "default": "15", "options": ["5", "8", "10", "15", "30", "60"]},
            {"name": "format", "label": "影片格式", "type": "select", "required": False, "default": "9:16", "options": ["9:16", "16:9", "1:1"]},
            {"name": "key_message", "label": "核心訊息", "type": "text", "required": False},
            {"name": "reference_style", "label": "參考風格", "type": "text", "required": False},
            # 國籍/地區相關變數（自動注入）
            {"name": "user_country", "label": "用戶國家", "type": "text", "required": False, "default": "台灣", "auto_inject": True},
            {"name": "user_language", "label": "用戶語言", "type": "text", "required": False, "default": "繁體中文", "auto_inject": True},
            {"name": "user_culture", "label": "用戶文化", "type": "text", "required": False, "default": "台灣華人文化", "auto_inject": True},
            {"name": "content_style", "label": "內容風格", "type": "text", "required": False, "default": "親切、活潑、帶有台灣在地用語", "auto_inject": True},
            {"name": "regional_aesthetic", "label": "地區美學風格", "type": "text", "required": False, "default": "亞洲都會時尚風格", "auto_inject": True}
        ]
    },
    
    # ============================================================
    # 6. 影片視覺生成 (Veo)
    # ============================================================
    {
        "name": "Veo 影片視覺生成",
        "slug": "veo-video-visual-prompt",
        "description": "Google Veo 影片生成引擎的專業視覺提示詞，生成電影級品質影片。",
        "category": "video_prompt",
        "generation_type": "video",
        "supported_models": ["veo-001", "veo-002"],
        "default_model": "veo-002",
        "tags": ["影片", "Veo", "電影級"],
        "is_system": True,
        "is_public": True,
        "positive_template": """Cinematic masterpiece: {{camera_move}} elegantly revealing {{main_subject}}.

═══════════════════════════════════════════════════════════════
VISUAL DIRECTION
═══════════════════════════════════════════════════════════════

SCENE AESTHETIC:
{{visual_style}}
Overall mood: {{style}}, premium commercial production quality
Art direction reference: {{style_reference}}
Visual storytelling approach: Emotion-driven, visually immersive

CINEMATOGRAPHY:
- Camera movement: {{camera_move}}, buttery smooth, professionally stabilized
- Lens choice: Premium cinema lens with beautiful rendering, minimal distortion
- Depth of field: Shallow with creamy circular bokeh, subject isolation
- Focus: Rack focus transitions, always tack sharp on subject
- Framing: Rule of thirds, golden ratio, intentional negative space

LIGHTING MASTERCLASS:
{{lighting_style}}
- Key light: Soft, flattering, three-dimensional
- Fill light: Subtle shadow detail without flatness
- Rim/hair light: Elegant subject separation
- Practical lights: Motivated, adds depth and realism
- Color temperature harmony: {{color_grade}}

ATMOSPHERE & EMOTIONAL RESONANCE:
{{atmosphere}}
Story context: {{description}}
Emotional journey: Build anticipation → Reveal → Satisfaction

═══════════════════════════════════════════════════════════════
TECHNICAL EXCELLENCE
═══════════════════════════════════════════════════════════════

FORMAT & RESOLUTION:
- Aspect ratio: {{aspect_ratio}}, perfectly composed
- Resolution: 4K+ with cinematic clarity
- Frame rate: Smooth 24fps cinematic motion

COLOR & TONE:
{{color_grade}}
- Rich, nuanced color palette
- Cinematic LUT styling
- Skin tones: Natural, flattering

AUDIO ATMOSPHERE:
- Music vibe: {{music_vibe}}
- Ambient soundscape suggestion
- Professional mixing quality implied

═══════════════════════════════════════════════════════════════
REGIONAL & CULTURAL CONTEXT
═══════════════════════════════════════════════════════════════

Target audience region: {{user_country}}
Language context: {{user_language}}
Cultural aesthetic: {{user_culture}}
Regional style notes: {{regional_aesthetic}}
Content localization: Adapt visual elements to resonate with {{user_country}} audience

═══════════════════════════════════════════════════════════════
QUALITY BENCHMARKS
═══════════════════════════════════════════════════════════════

MUST ACHIEVE:
✓ Apple commercial production value
✓ Vogue/GQ editorial visual standard
✓ Award-winning cinematography
✓ Emotional resonance in every frame
✓ Premium, aspirational aesthetic
✓ Authentic human connection
✓ Cultural relevance for {{user_country}} market

MOTION QUALITY (CRITICAL):
- Frame consistency: Every frame must flow perfectly, no stuttering or lag
- Camera stability: Professional gimbal-smooth, zero jitters
- Motion: Fluid 24fps, no dropped frames, natural velocity
- Temporal coherence: Perfect visual consistency across all frames

ABSOLUTELY AVOID (ZERO TOLERANCE):
✗ STUTTERING, LAG, or choppy motion - highest priority to avoid
✗ Frame drops, skipped frames, jerky movement
✗ Frozen frames or motion discontinuity
✗ Stock footage aesthetic
✗ Generic corporate video look
✗ Flat, uninteresting lighting
✗ Cheap motion graphics
✗ Over-processed, artificial colors
✗ Culturally inappropriate elements for target region""",
        "negative_template": """stuttering, lag, choppy motion, frame drops, jerky movement, frozen frames,
cheap, amateur, low budget, stock footage, corporate video,
flat lighting, boring composition, generic, cliché,
over-processed, artificial, fake, CGI look, uncanny valley,
shaky camera, jitter, out of focus, poor quality, flickering""",
        "model_config": {
            "duration_seconds": 8,
            "fps": 24,
            "aspect_ratio": "9:16"
        },
        "variables": [
            {"name": "camera_move", "label": "鏡頭運動", "type": "select", "required": True, "options": ["Slow dolly in", "Smooth tracking", "Crane shot", "Orbit around", "Static with subtle motion", "Handheld intimate", "Steadicam follow"]},
            {"name": "main_subject", "label": "主體描述", "type": "textarea", "required": True},
            {"name": "visual_style", "label": "視覺風格", "type": "textarea", "required": True},
            {"name": "style", "label": "整體風格", "type": "text", "required": False, "default": "cinematic, premium"},
            {"name": "style_reference", "label": "風格參考", "type": "text", "required": False, "default": "Apple commercial, high fashion editorial"},
            {"name": "lighting_style", "label": "燈光風格", "type": "textarea", "required": False},
            {"name": "color_grade", "label": "調色風格", "type": "text", "required": False, "default": "Warm cinematic with rich shadows"},
            {"name": "atmosphere", "label": "氛圍描述", "type": "textarea", "required": False},
            {"name": "description", "label": "場景描述", "type": "textarea", "required": True},
            {"name": "aspect_ratio", "label": "畫面比例", "type": "select", "required": False, "default": "9:16", "options": ["9:16", "16:9", "1:1"]},
            {"name": "music_vibe", "label": "配樂氛圍", "type": "select", "required": False, "default": "modern contemporary", "options": ["upbeat energetic", "emotional cinematic", "calm ambient", "epic orchestral", "minimal electronic", "inspirational"]},
            # 國籍/地區相關變數（自動注入）
            {"name": "user_country", "label": "用戶國家", "type": "text", "required": False, "default": "台灣", "auto_inject": True},
            {"name": "user_language", "label": "用戶語言", "type": "text", "required": False, "default": "繁體中文", "auto_inject": True},
            {"name": "user_culture", "label": "用戶文化", "type": "text", "required": False, "default": "台灣華人文化", "auto_inject": True},
            {"name": "content_style", "label": "內容風格", "type": "text", "required": False, "default": "親切、活潑、帶有台灣在地用語", "auto_inject": True},
            {"name": "regional_aesthetic", "label": "地區美學風格", "type": "text", "required": False, "default": "亞洲都會時尚風格", "auto_inject": True}
        ]
    },
    
    # ============================================================
    # 7. 圖片分析 (Vision)
    # ============================================================
    {
        "name": "參考圖片分析器",
        "slug": "reference-image-analyzer",
        "description": "使用 Gemini Vision 分析參考圖片，提取視覺元素用於生成新圖片。",
        "category": "image_prompt",
        "generation_type": "copywriting",
        "supported_models": ["gemini-2.0-flash", "gemini-1.5-pro"],
        "default_model": "gemini-2.0-flash",
        "tags": ["分析", "Vision", "參考圖"],
        "is_system": True,
        "is_public": True,
        "positive_template": """請分析這張圖片，提供一個詳細的視覺描述（80-120字），包含：

1. 主體：畫面中的主要元素是什麼？
2. 構圖：如何安排畫面元素？（例如：居中、三分法、對稱）
3. 色調：主要的顏色和色彩氛圍？
4. 光線：光線的方向、強度、類型？
5. 風格：整體的藝術風格或攝影風格？
6. 情緒：傳達什麼樣的情感或氛圍？

請用繁體中文回答，描述要具體且適合用於生成類似風格的新圖片。
不要包含任何與圖片內文字相關的描述。""",
        "negative_template": None,
        "model_config": {
            "temperature": 0.5,
            "max_tokens": 500
        },
        "variables": []
    },
    
    # ============================================================
    # 8. 視覺設計 AI (主題視覺生成)
    # ============================================================
    {
        "name": "主題視覺設計器",
        "slug": "topic-visual-designer",
        "description": "根據文章主題自動生成獨特的視覺設計方案，包含色彩、構圖、燈光建議。",
        "category": "image_prompt",
        "generation_type": "copywriting",
        "supported_models": ["gemini-2.5-flash", "gemini-2.0-flash"],
        "default_model": "gemini-2.5-flash",
        "tags": ["設計", "視覺", "自動化"],
        "is_system": True,
        "is_public": True,
        "positive_template": """作為頂尖視覺設計師，為這篇部落格文章設計一個【獨一無二】的封面圖。

文章主題：{{topic}}

【重要規則】
1. 必須根據這個【具體主題】設計視覺，不要用泛用的通用意象
2. 避免陳腔濫調和老套畫面
3. 用隱喻/象徵手法表達主題核心精神
4. 參考高端藝術攝影、美術館級作品的美學
5. 每次生成都要不同，避免重複

【視覺風格參考】
- 大師級的光影戲劇性
- 現代極簡藝術攝影
- 抽象概念攝影（光、影、材質的詩意表達）
- 自然界的神聖秩序（黃金比例、分形幾何）
- 建築空間的莊嚴感

請分析文章主題，用 JSON 格式回答（只輸出 JSON）：
{
    "visual_subject": "一個具體、獨特、能象徵這篇文章核心概念的畫面（80字內）",
    "symbolic_meaning": "這個畫面如何象徵文章主題",
    "color_palette": "5個適合這個主題情緒的顏色（用英文）",
    "mood": "情緒氛圍（用英文）",
    "art_style": "具體的藝術風格參考",
    "lighting": "光線設計細節",
    "composition": "構圖與景深建議",
    "unique_element": "一個讓這張圖片獨特難忘的視覺元素"
}""",
        "negative_template": None,
        "model_config": {
            "temperature": 0.9,
            "max_tokens": 1000
        },
        "variables": [
            {"name": "topic", "label": "文章主題", "type": "textarea", "required": True, "placeholder": "輸入文章的標題或主題"},
            # 國籍/地區相關變數（自動注入）
            {"name": "user_country", "label": "用戶國家", "type": "text", "required": False, "default": "台灣", "auto_inject": True},
            {"name": "user_language", "label": "用戶語言", "type": "text", "required": False, "default": "繁體中文", "auto_inject": True},
            {"name": "user_culture", "label": "用戶文化", "type": "text", "required": False, "default": "台灣華人文化", "auto_inject": True},
            {"name": "regional_aesthetic", "label": "地區美學風格", "type": "text", "required": False, "default": "亞洲都會時尚風格", "auto_inject": True}
        ],
        "output_format": {
            "type": "json",
            "schema": {
                "visual_subject": "string",
                "symbolic_meaning": "string",
                "color_palette": "string",
                "mood": "string",
                "art_style": "string",
                "lighting": "string",
                "composition": "string",
                "unique_element": "string"
            }
        }
    },
]


def seed_prompts():
    """將種子 Prompt 資料寫入資料庫"""
    db = SessionLocal()
    
    try:
        created_count = 0
        updated_count = 0
        
        for prompt_data in SEED_PROMPTS:
            # 檢查是否已存在
            existing = db.query(Prompt).filter(Prompt.slug == prompt_data["slug"]).first()
            
            if existing:
                # 更新已存在的 Prompt 版本
                if existing.current_version_id:
                    version = db.query(PromptVersion).filter(PromptVersion.id == existing.current_version_id).first()
                    if version:
                        new_variables = prompt_data.get("variables", [])
                        new_positive = prompt_data.get("positive_template", "")
                        
                        # 更新 variables（如果有新的）
                        if new_variables:
                            version.variables = new_variables
                        
                        # 更新 positive_template（如果有新的）
                        if new_positive:
                            version.positive_template = new_positive
                        
                        print(f"🔄 更新: {prompt_data['name']} (slug: {prompt_data['slug']}) - variables 和 template 已更新")
                    else:
                        print(f"⏭️  已存在但找不到版本: {prompt_data['name']} (slug: {prompt_data['slug']})")
                else:
                    print(f"⏭️  已存在但無版本 ID: {prompt_data['name']} (slug: {prompt_data['slug']})")
                updated_count += 1
                continue
            
            # 準備版本資料
            version_data = {
                "positive_template": prompt_data.pop("positive_template"),
                "negative_template": prompt_data.pop("negative_template", None),
                "model_config": prompt_data.pop("model_config", {}),
                "variables": prompt_data.pop("variables", []),
                "system_prompt": prompt_data.pop("system_prompt", None),
                "output_format": prompt_data.pop("output_format", {}),
            }
            
            # 創建 Prompt
            prompt = Prompt(
                **prompt_data,
                is_active=True,
            )
            db.add(prompt)
            db.flush()  # 取得 prompt.id
            
            # 創建初始版本
            version = PromptVersion(
                prompt_id=prompt.id,
                version_number=1,
                version_tag="v1.0.0",
                positive_template=version_data["positive_template"],
                negative_template=version_data["negative_template"],
                model_config=version_data["model_config"],
                variables=version_data["variables"],
                system_prompt=version_data["system_prompt"],
                output_format=version_data["output_format"] or {},
                examples=[],
                changelog="初始版本 - 從平台現有引擎遷移",
                is_active=True,
                is_draft=False,
            )
            db.add(version)
            db.flush()
            
            # 設定當前版本
            prompt.current_version_id = version.id
            
            print(f"✅ 創建: {prompt_data['name']} (slug: {prompt_data['slug']})")
            created_count += 1
        
        db.commit()
        
        print("\n" + "=" * 50)
        print(f"✨ 完成！")
        print(f"   - 新建 Prompt: {created_count} 個")
        print(f"   - 已存在（跳過）: {updated_count} 個")
        print("=" * 50)
        
    except Exception as e:
        db.rollback()
        print(f"❌ 錯誤: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 50)
    print("🌱 Prompt Registry 種子資料載入")
    print("=" * 50)
    print()
    
    seed_prompts()
