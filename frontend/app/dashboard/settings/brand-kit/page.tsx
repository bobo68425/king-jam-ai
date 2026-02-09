"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Palette, 
  Upload, 
  Image as ImageIcon, 
  Type, 
  Mic, 
  Save,
  Plus,
  Trash2,
  Check,
  Star,
  Eye,
  RefreshCw,
  Sparkles,
  User,
  Volume2,
  VolumeX,
  Loader2,
  Play,
  Square
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import api from "@/lib/api";

interface BrandKit {
  id: number;
  name: string;
  description: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string | null;
  background_color: string;
  text_color: string;
  color_palette: string[];
  logo_url: string | null;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  logo_icon_url: string | null;
  heading_font: string;
  body_font: string;
  font_style: string;
  visual_style: string;
  image_style: string;
  brand_voice: string;
  preferred_tts_voice: string;
  tagline: string | null;
  key_messages: string[];
  tone_of_voice: string[];
  industry: string | null;
  is_active: boolean;
  is_default: boolean;
  assets: any[];
  reference_images: any[];
  // IP 角色設定
  character_personality?: string | null;
  character_age_group?: string | null;
  character_traits?: string[];
}

// ============================================================
// 視覺風格 - 涵蓋各類品牌、企業、IP 需求
// ============================================================
const VISUAL_STYLES = [
  // 現代商業
  { value: "modern_minimalist", label: "現代簡約", category: "商業", description: "乾淨線條、留白空間、適合科技與新創品牌", icon: "◻️" },
  { value: "corporate_professional", label: "商務專業", category: "商業", description: "穩重可信、適合金融、法律、顧問公司", icon: "💼" },
  { value: "tech_futuristic", label: "科技未來", category: "商業", description: "漸變色彩、幾何元素、適合 AI、SaaS、科技公司", icon: "🚀" },
  { value: "startup_bold", label: "新創大膽", category: "商業", description: "鮮明對比、打破常規、適合新創與創新品牌", icon: "💡" },
  
  // 優雅高端
  { value: "luxury_elegant", label: "奢華精緻", category: "高端", description: "金色點綴、襯線字體、適合精品與高端品牌", icon: "✨" },
  { value: "premium_refined", label: "高端雅致", category: "高端", description: "深色調、金屬質感、適合豪車、珠寶、美妝", icon: "💎" },
  { value: "boutique_artisan", label: "精品匠心", category: "高端", description: "手工質感、細膩紋理、適合手工藝品與精品店", icon: "🎨" },
  
  // 生活風格
  { value: "lifestyle_warm", label: "生活溫馨", category: "生活", description: "自然色調、溫暖感覺、適合居家、咖啡廳品牌", icon: "🏠" },
  { value: "natural_organic", label: "自然有機", category: "生活", description: "大地色系、環保元素、適合有機食品、環保品牌", icon: "🌿" },
  { value: "wellness_calm", label: "療癒放鬆", category: "生活", description: "柔和色彩、圓潤造型、適合 SPA、瑜伽、健康品牌", icon: "🧘" },
  { value: "foodie_appetizing", label: "美食誘人", category: "生活", description: "暖色調、食材元素、適合餐廳、食品品牌", icon: "🍽️" },
  
  // 活力年輕
  { value: "playful_colorful", label: "活潑繽紛", category: "年輕", description: "多彩配色、圓角設計、適合兒童、教育品牌", icon: "🎈" },
  { value: "youth_trendy", label: "潮流時尚", category: "年輕", description: "街頭元素、螢光配色、適合潮牌、年輕受眾", icon: "🔥" },
  { value: "gaming_dynamic", label: "電競動感", category: "年輕", description: "霓虹光效、銳利線條、適合遊戲、電競品牌", icon: "🎮" },
  { value: "social_viral", label: "社群爆款", category: "年輕", description: "吸睛設計、迷因友善、適合 KOL、社群行銷", icon: "📱" },
  
  // 創意藝術
  { value: "artistic_creative", label: "藝術創意", category: "創意", description: "手繪元素、不規則形狀、適合設計工作室", icon: "🖌️" },
  { value: "retro_vintage", label: "復古懷舊", category: "創意", description: "舊報風格、復古色調、適合懷舊主題品牌", icon: "📻" },
  { value: "grunge_edgy", label: "粗獷前衛", category: "創意", description: "做舊質感、暗色調、適合音樂、次文化品牌", icon: "🎸" },
  { value: "pop_art", label: "普普藝術", category: "創意", description: "漫畫風格、高飽和色、適合藝術展覽、潮流品牌", icon: "💥" },
  
  // 專業領域
  { value: "medical_clinical", label: "醫療專業", category: "專業", description: "潔淨色調、信任感、適合醫療、健康機構", icon: "🏥" },
  { value: "education_academic", label: "教育學術", category: "專業", description: "知識感、書卷氣、適合學校、線上課程", icon: "📚" },
  { value: "legal_authoritative", label: "法律權威", category: "專業", description: "莊重穩重、深色調、適合律師事務所", icon: "⚖️" },
  { value: "financial_trustworthy", label: "金融穩健", category: "專業", description: "藍色調、數據視覺化、適合銀行、投資公司", icon: "📊" },
  
  // IP 角色風格 - 基礎類型
  { value: "anime_kawaii", label: "動漫可愛", category: "IP 風格", description: "日系風格、大眼角色、適合萌系 IP", icon: "🌸" },
  { value: "mascot_friendly", label: "吉祥物風", category: "IP 風格", description: "圓潤造型、親切表情、企業吉祥物", icon: "🐻" },
  { value: "chibi_deform", label: "Q版變形", category: "IP 風格", description: "2-3 頭身、誇張表情、可愛周邊", icon: "🎀" },
  { value: "vtuber_live2d", label: "虛擬偶像", category: "IP 風格", description: "VTuber 風格、動態表情、直播用", icon: "🎤" },
  { value: "realistic_character", label: "寫實角色", category: "IP 風格", description: "真人比例、細膩質感、代言人風", icon: "👤" },
  { value: "fantasy_magical", label: "奇幻魔法", category: "IP 風格", description: "夢幻色彩、神秘元素、遊戲 IP", icon: "🧙" },
  { value: "superhero_epic", label: "英雄史詩", category: "IP 風格", description: "動態構圖、電影感、漫威風格", icon: "🦸" },
  { value: "pixel_retro", label: "像素復古", category: "IP 風格", description: "8-bit 風格、懷舊遊戲、NFT", icon: "👾" },
  
  // IP 角色 - 動物與生物
  { value: "animal_anthro", label: "動物擬人", category: "IP 生物", description: "獸人風格、人形動物、Furry", icon: "🦊" },
  { value: "animal_cute", label: "萌寵可愛", category: "IP 生物", description: "貓狗兔等、療癒系、寵物品牌", icon: "🐱" },
  { value: "monster_friendly", label: "友善怪獸", category: "IP 生物", description: "可愛怪物、寶可夢風、兒童友善", icon: "👻" },
  { value: "monster_cool", label: "帥氣怪獸", category: "IP 生物", description: "酷炫設計、戰鬥系、遊戲 Boss", icon: "🐉" },
  { value: "robot_mecha", label: "機器人機甲", category: "IP 生物", description: "機械風格、變形金剛、科幻", icon: "🤖" },
  { value: "mythical_creature", label: "神話生物", category: "IP 生物", description: "龍鳳麒麟、傳說生物、東方奇幻", icon: "🐲" },
  
  // IP 角色 - 職業人設
  { value: "doctor_medical", label: "醫護人員", category: "IP 職業", description: "醫生護士、白袍形象、醫療衛教", icon: "👨‍⚕️" },
  { value: "teacher_educator", label: "教師學者", category: "IP 職業", description: "知識形象、眼鏡書卷、教育平台", icon: "👩‍🏫" },
  { value: "chef_culinary", label: "廚師美食", category: "IP 職業", description: "廚師帽圍裙、料理達人、餐飲品牌", icon: "👨‍🍳" },
  { value: "engineer_tech", label: "工程師科技", category: "IP 職業", description: "程式碼眼鏡、科技宅、IT 公司", icon: "👩‍💻" },
  { value: "athlete_sports", label: "運動員健身", category: "IP 職業", description: "運動裝備、活力形象、健身品牌", icon: "🏃" },
  { value: "artist_creative", label: "藝術家創作", category: "IP 職業", description: "畫筆顏料、創意形象、藝文機構", icon: "👩‍🎨" },
  { value: "business_professional", label: "商務白領", category: "IP 職業", description: "西裝領帶、專業形象、金融企業", icon: "👔" },
  { value: "farmer_agriculture", label: "農夫小農", category: "IP 職業", description: "田園風格、有機農業、食農教育", icon: "👨‍🌾" },
  { value: "scientist_researcher", label: "科學家研究", category: "IP 職業", description: "實驗室風格、探索精神、科普教育", icon: "🔬" },
  { value: "delivery_service", label: "外送服務", category: "IP 職業", description: "外送員形象、快速服務、物流平台", icon: "🛵" },
  
  // IP 角色 - 特殊人設
  { value: "idol_star", label: "偶像明星", category: "IP 人設", description: "閃亮造型、舞台魅力、娛樂偶像", icon: "⭐" },
  { value: "gaming_streamer", label: "遊戲實況", category: "IP 人設", description: "電競風格、耳機麥克風、直播主", icon: "🎮" },
  { value: "influencer_kol", label: "網紅 KOL", category: "IP 人設", description: "時尚潮流、自拍風格、社群經營", icon: "📸" },
  { value: "student_youth", label: "學生青春", category: "IP 人設", description: "校園制服、青春活力、教育產品", icon: "🎒" },
  { value: "office_worker", label: "上班族日常", category: "IP 人設", description: "OL 小資、職場共鳴、生活品牌", icon: "💼" },
  { value: "parent_family", label: "家長親子", category: "IP 人設", description: "溫馨家庭、育兒形象、親子品牌", icon: "👨‍👩‍👧" },
  { value: "senior_elder", label: "銀髮長輩", category: "IP 人設", description: "智慧形象、親切長者、銀髮產業", icon: "👴" },
  { value: "fairy_princess", label: "精靈公主", category: "IP 人設", description: "夢幻童話、優雅高貴、女性向", icon: "👸" },
  { value: "warrior_knight", label: "戰士騎士", category: "IP 人設", description: "盔甲武器、英勇形象、冒險遊戲", icon: "⚔️" },
  { value: "ninja_assassin", label: "忍者刺客", category: "IP 人設", description: "神秘黑暗、敏捷形象、動作遊戲", icon: "🥷" },
  { value: "wizard_mage", label: "法師魔導", category: "IP 人設", description: "魔法杖帽、神秘力量、奇幻世界", icon: "🧙‍♂️" },
  { value: "pirate_adventure", label: "海盜冒險", category: "IP 人設", description: "航海風格、尋寶探險、冒險故事", icon: "🏴‍☠️" },
  
  // 地域文化
  { value: "chinese_traditional", label: "中式傳統", category: "文化", description: "水墨元素、紅金配色、適合傳統品牌", icon: "🏮" },
  { value: "japanese_zen", label: "日式禪意", category: "文化", description: "侘寂美學、留白空間、適合日系品牌", icon: "🎋" },
  { value: "european_classic", label: "歐式古典", category: "文化", description: "巴洛克元素、華麗裝飾、適合歐洲風格品牌", icon: "🏰" },
  { value: "nordic_scandinavian", label: "北歐極簡", category: "文化", description: "功能主義、自然材質、適合家居設計品牌", icon: "🏔️" },
];

// ============================================================
// 圖片風格 - 多元視覺呈現方式
// ============================================================
const IMAGE_STYLES = [
  // 攝影類
  { value: "photography_lifestyle", label: "生活攝影", category: "攝影", description: "自然光線、真實場景" },
  { value: "photography_product", label: "產品攝影", category: "攝影", description: "專業打光、細節特寫" },
  { value: "photography_portrait", label: "人像攝影", category: "攝影", description: "模特展示、情境拍攝" },
  { value: "photography_aerial", label: "航拍視角", category: "攝影", description: "俯瞰全景、大氣場景" },
  { value: "photography_macro", label: "微距特寫", category: "攝影", description: "細節放大、質感呈現" },
  
  // 插畫類
  { value: "illustration_flat", label: "扁平插畫", category: "插畫", description: "簡潔向量、幾何造型" },
  { value: "illustration_hand_drawn", label: "手繪插畫", category: "插畫", description: "溫暖筆觸、人情味" },
  { value: "illustration_watercolor", label: "水彩風格", category: "插畫", description: "柔和暈染、藝術感" },
  { value: "illustration_line_art", label: "線條藝術", category: "插畫", description: "極簡線條、優雅俐落" },
  { value: "illustration_isometric", label: "等距插畫", category: "插畫", description: "3D 視角、科技感" },
  
  // 3D 渲染
  { value: "3d_realistic", label: "寫實 3D", category: "3D", description: "逼真材質、光影效果" },
  { value: "3d_stylized", label: "風格化 3D", category: "3D", description: "卡通渲染、獨特美學" },
  { value: "3d_product", label: "產品 3D", category: "3D", description: "商品展示、旋轉視圖" },
  { value: "3d_architectural", label: "建築 3D", category: "3D", description: "空間呈現、室內設計" },
  { value: "3d_character", label: "角色 3D", category: "3D", description: "IP 角色、虛擬形象" },
  
  // AI 生成風格
  { value: "ai_photorealistic", label: "AI 超寫實", category: "AI", description: "照片級真實感" },
  { value: "ai_digital_art", label: "AI 數位藝術", category: "AI", description: "獨特藝術風格" },
  { value: "ai_concept_art", label: "AI 概念藝術", category: "AI", description: "創意概念視覺化" },
  { value: "ai_anime", label: "AI 動漫風", category: "AI", description: "日系動漫風格" },
  
  // 特殊風格
  { value: "collage_mixed", label: "拼貼混搭", category: "特殊", description: "多元素組合、創意表達" },
  { value: "gradient_abstract", label: "漸層抽象", category: "特殊", description: "色彩流動、現代感" },
  { value: "typography_focused", label: "字體主導", category: "特殊", description: "文字藝術、排版設計" },
  { value: "infographic", label: "資訊圖表", category: "特殊", description: "數據視覺化、教育性" },
];

// ============================================================
// 品牌聲音 - 文案語調與溝通風格
// ============================================================
const BRAND_VOICES = [
  // 專業系
  { value: "professional_authoritative", label: "專業權威", description: "專家口吻、數據導向、建立信任" },
  { value: "professional_consultative", label: "顧問式", description: "提供建議、解決問題、引導決策" },
  { value: "professional_educational", label: "教育知識", description: "分享知識、深入淺出、啟發思考" },
  
  // 親和系
  { value: "friendly_warm", label: "溫暖親切", description: "像朋友聊天、拉近距離" },
  { value: "friendly_supportive", label: "支持鼓勵", description: "正向積極、陪伴成長" },
  { value: "friendly_conversational", label: "對話式", description: "輕鬆自然、互動感強" },
  
  // 活力系
  { value: "energetic_enthusiastic", label: "熱情洋溢", description: "充滿活力、感染力強" },
  { value: "energetic_motivational", label: "激勵人心", description: "鼓舞行動、創造動力" },
  { value: "energetic_playful", label: "俏皮有趣", description: "幽默詼諧、輕鬆愉快" },
  
  // 高端系
  { value: "luxury_sophisticated", label: "高雅精緻", description: "品味獨到、講究細節" },
  { value: "luxury_exclusive", label: "尊榮專屬", description: "VIP 待遇、稀缺感" },
  { value: "luxury_aspirational", label: "嚮往生活", description: "夢想藍圖、理想生活" },
  
  // 創新系
  { value: "innovative_visionary", label: "前瞻願景", description: "引領趨勢、改變未來" },
  { value: "innovative_disruptive", label: "顛覆創新", description: "打破常規、大膽革新" },
  { value: "innovative_curious", label: "好奇探索", description: "提問引導、激發好奇" },
  
  // 真誠系
  { value: "authentic_transparent", label: "真誠透明", description: "坦誠溝通、不加修飾" },
  { value: "authentic_storytelling", label: "故事敘述", description: "分享故事、情感連結" },
  { value: "authentic_empathetic", label: "同理心", description: "理解痛點、感同身受" },
  
  // 行動系
  { value: "action_urgent", label: "緊迫行動", description: "限時限量、促使決策" },
  { value: "action_bold", label: "大膽直接", description: "強烈號召、明確指令" },
  { value: "action_inspiring", label: "啟發行動", description: "描繪願景、激發渴望" },
];

// ============================================================
// TTS 語音選項 (Microsoft Edge TTS - 免費可用)
// 參考: https://learn.microsoft.com/azure/ai-services/speech-service/language-support
// 注意: 只包含已確認可用的語音
// ============================================================
const TTS_VOICES = [
  // ============================================================
  // 繁體中文（台灣）- 官方驗證可用 ✓
  // ============================================================
  { value: "zh-TW-HsiaoChenNeural", label: "曉臻（女，親切正式）", locale: "zh-TW", gender: "female", verified: true },
  { value: "zh-TW-HsiaoYuNeural", label: "曉雨（女，溫柔甜美）", locale: "zh-TW", gender: "female", verified: true },
  { value: "zh-TW-YunJheNeural", label: "雲哲（男，專業穩重）", locale: "zh-TW", gender: "male", verified: true },
  
  // ============================================================
  // 簡體中文 - 官方驗證可用 ✓
  // ============================================================
  { value: "zh-CN-XiaoxiaoNeural", label: "曉曉（女，溫暖知性）", locale: "zh-CN", gender: "female", verified: true },
  { value: "zh-CN-XiaoyiNeural", label: "曉伊（女，活潑卡通）", locale: "zh-CN", gender: "female", verified: true },
  { value: "zh-CN-YunyangNeural", label: "雲揚（男，專業新聞）", locale: "zh-CN", gender: "male", verified: true },
  { value: "zh-CN-YunjianNeural", label: "雲健（男，熱情解說）", locale: "zh-CN", gender: "male", verified: true },
  { value: "zh-CN-YunxiNeural", label: "雲希（男，陽光活力）", locale: "zh-CN", gender: "male", verified: true },
  { value: "zh-CN-YunxiaNeural", label: "雲夏（男，可愛童聲）", locale: "zh-CN", gender: "male", verified: true },
  
  // ============================================================
  // 簡體中文 - 方言語音 ✓
  // ============================================================
  { value: "zh-CN-liaoning-XiaobeiNeural", label: "曉北（女，東北方言）", locale: "zh-CN", gender: "female", verified: true },
  { value: "zh-CN-shaanxi-XiaoniNeural", label: "曉妮（女，陝西方言）", locale: "zh-CN", gender: "female", verified: true },
  
  // ============================================================
  // 粵語（香港）- 官方驗證可用 ✓
  // ============================================================
  { value: "zh-HK-HiuMaanNeural", label: "曉曼（女，粵語親切）", locale: "zh-HK", gender: "female", verified: true },
  { value: "zh-HK-HiuGaaiNeural", label: "曉佳（女，粵語活潑）", locale: "zh-HK", gender: "female", verified: true },
  { value: "zh-HK-WanLungNeural", label: "雲龍（男，粵語穩重）", locale: "zh-HK", gender: "male", verified: true },
  
  // ============================================================
  // 英文 - 官方驗證可用 ✓
  // ============================================================
  { value: "en-US-JennyNeural", label: "Jenny（女，美式親切）", locale: "en-US", gender: "female", verified: true },
  { value: "en-US-GuyNeural", label: "Guy（男，美式專業）", locale: "en-US", gender: "male", verified: true },
  { value: "en-US-AriaNeural", label: "Aria（女，美式自然）", locale: "en-US", gender: "female", verified: true },
  { value: "en-GB-SoniaNeural", label: "Sonia（女，英式優雅）", locale: "en-GB", gender: "female", verified: true },
  { value: "en-GB-RyanNeural", label: "Ryan（男，英式專業）", locale: "en-GB", gender: "male", verified: true },
  
  // ============================================================
  // 日文 - 官方驗證可用 ✓
  // ============================================================
  { value: "ja-JP-NanamiNeural", label: "七海（女，日語親切）", locale: "ja-JP", gender: "female", verified: true },
  { value: "ja-JP-KeitaNeural", label: "慶太（男，日語專業）", locale: "ja-JP", gender: "male", verified: true },
  
  // ============================================================
  // 韓文 - 官方驗證可用 ✓
  // ============================================================
  { value: "ko-KR-SunHiNeural", label: "선희（女，韓語親切）", locale: "ko-KR", gender: "female", verified: true },
  { value: "ko-KR-InJoonNeural", label: "인준（男，韓語穩重）", locale: "ko-KR", gender: "male", verified: true },
];

// ============================================================
// 字體風格 - 品牌個性表達
// 標記 ✓ = Google Fonts 可用（免費商用）
// 標記 ⚙ = 系統字型（需確認用戶設備）
// ============================================================
const FONT_STYLES = [
  { 
    value: "modern_sans", 
    label: "現代無襯線", 
    description: "乾淨俐落、科技感", 
    fonts: ["Inter", "Roboto", "Open Sans"],  // ✓ 全部 Google Fonts
    googleFonts: ["Inter", "Roboto", "Open+Sans"],
    available: true
  },
  { 
    value: "classic_serif", 
    label: "經典襯線", 
    description: "傳統權威、書卷氣", 
    fonts: ["Playfair Display", "Merriweather", "Lora"],  // ✓ 全部 Google Fonts
    googleFonts: ["Playfair+Display", "Merriweather", "Lora"],
    available: true
  },
  { 
    value: "elegant_thin", 
    label: "優雅纖細", 
    description: "精緻高端、時尚感", 
    fonts: ["Cormorant Garamond", "Libre Baskerville", "Crimson Text"],  // ✓ 全部 Google Fonts
    googleFonts: ["Cormorant+Garamond", "Libre+Baskerville", "Crimson+Text"],
    available: true
  },
  { 
    value: "bold_impact", 
    label: "粗獷有力", 
    description: "強烈衝擊、運動感", 
    fonts: ["Oswald", "Anton", "Bebas Neue"],  // ✓ 全部 Google Fonts
    googleFonts: ["Oswald", "Anton", "Bebas+Neue"],
    available: true
  },
  { 
    value: "playful_rounded", 
    label: "圓潤俏皮", 
    description: "親和力、年輕活潑", 
    fonts: ["Nunito", "Quicksand", "Comfortaa"],  // ✓ 全部 Google Fonts
    googleFonts: ["Nunito", "Quicksand", "Comfortaa"],
    available: true
  },
  { 
    value: "handwritten", 
    label: "手寫風格", 
    description: "人情味、獨特個性", 
    fonts: ["Caveat", "Dancing Script", "Pacifico"],  // ✓ 全部 Google Fonts
    googleFonts: ["Caveat", "Dancing+Script", "Pacifico"],
    available: true
  },
  { 
    value: "tech_mono", 
    label: "科技等寬", 
    description: "程式風、極客感", 
    fonts: ["JetBrains Mono", "Fira Code", "Source Code Pro"],  // ✓ 全部 Google Fonts
    googleFonts: ["JetBrains+Mono", "Fira+Code", "Source+Code+Pro"],
    available: true
  },
  { 
    value: "chinese_noto", 
    label: "思源系列", 
    description: "開源免費、繁簡日韓支援", 
    fonts: ["Noto Sans TC", "Noto Serif TC", "Noto Sans SC"],  // ✓ Google Fonts 開源
    googleFonts: ["Noto+Sans+TC", "Noto+Serif+TC", "Noto+Sans+SC"],
    available: true
  },
  { 
    value: "chinese_rounded", 
    label: "圓體可愛", 
    description: "親和力、適合年輕品牌", 
    fonts: ["LXGW WenKai TC", "Noto Sans TC"],  // ✓ 開源字型
    googleFonts: ["LXGW+WenKai+TC", "Noto+Sans+TC"],
    available: true
  },
  { 
    value: "japanese_noto", 
    label: "日式思源", 
    description: "日系風格、精緻感", 
    fonts: ["Noto Sans JP", "Noto Serif JP", "M PLUS Rounded 1c"],  // ✓ Google Fonts
    googleFonts: ["Noto+Sans+JP", "Noto+Serif+JP", "M+PLUS+Rounded+1c"],
    available: true
  },
];

// ============================================================
// IP 角色性格特徵 - 定義角色個性與表現方式
// ============================================================
const CHARACTER_PERSONALITIES = [
  // 正向活力
  { value: "cheerful_optimistic", label: "開朗樂觀", category: "正向", description: "總是笑容滿面、傳遞正能量" },
  { value: "energetic_lively", label: "活潑好動", category: "正向", description: "精力充沛、愛玩愛鬧" },
  { value: "friendly_approachable", label: "親切友善", category: "正向", description: "容易親近、讓人放鬆" },
  { value: "brave_courageous", label: "勇敢無畏", category: "正向", description: "敢於挑戰、不怕困難" },
  { value: "passionate_enthusiastic", label: "熱情洋溢", category: "正向", description: "充滿熱忱、感染他人" },
  
  // 智慧穩重
  { value: "wise_knowledgeable", label: "睿智博學", category: "智慧", description: "知識淵博、值得信賴" },
  { value: "calm_composed", label: "沉穩冷靜", category: "智慧", description: "處變不驚、穩定軍心" },
  { value: "thoughtful_considerate", label: "體貼細心", category: "智慧", description: "善解人意、關心他人" },
  { value: "responsible_reliable", label: "負責可靠", category: "智慧", description: "說到做到、值得依賴" },
  { value: "patient_gentle", label: "耐心溫和", category: "智慧", description: "循循善誘、不急不躁" },
  
  // 創意個性
  { value: "creative_imaginative", label: "創意無限", category: "創意", description: "天馬行空、點子多多" },
  { value: "curious_explorer", label: "好奇探索", category: "創意", description: "愛問為什麼、勇於嘗試" },
  { value: "quirky_unique", label: "古靈精怪", category: "創意", description: "特立獨行、與眾不同" },
  { value: "artistic_aesthetic", label: "藝術氣質", category: "創意", description: "追求美感、品味獨到" },
  { value: "dreamy_romantic", label: "夢幻浪漫", category: "創意", description: "充滿幻想、追求美好" },
  
  // 俏皮可愛
  { value: "cute_adorable", label: "萌萌可愛", category: "可愛", description: "讓人想保護、療癒系" },
  { value: "mischievous_playful", label: "調皮搗蛋", category: "可愛", description: "愛惡作劇、天真無邪" },
  { value: "shy_bashful", label: "害羞靦腆", category: "可愛", description: "容易臉紅、內向可愛" },
  { value: "innocent_pure", label: "天真純潔", category: "可愛", description: "單純善良、不諳世事" },
  { value: "clumsy_ditzy", label: "迷糊冒失", category: "可愛", description: "常出錯但可愛、令人發噱" },
  
  // 酷炫帥氣
  { value: "cool_aloof", label: "冷酷帥氣", category: "酷炫", description: "外冷內熱、有距離感" },
  { value: "confident_charismatic", label: "自信魅力", category: "酷炫", description: "散發光芒、領袖氣質" },
  { value: "mysterious_enigmatic", label: "神秘莫測", category: "酷炫", description: "難以捉摸、引人好奇" },
  { value: "rebellious_edgy", label: "叛逆不羈", category: "酷炫", description: "不按牌理、我行我素" },
  { value: "stoic_serious", label: "嚴肅認真", category: "酷炫", description: "一板一眼、專注目標" },
  
  // 搞笑幽默
  { value: "funny_comedic", label: "搞笑幽默", category: "幽默", description: "天生笑匠、逗人開心" },
  { value: "witty_clever", label: "機智風趣", category: "幽默", description: "反應快速、妙語如珠" },
  { value: "sarcastic_ironic", label: "諷刺吐槽", category: "幽默", description: "毒舌但可愛、吐槽擔當" },
  { value: "goofy_silly", label: "傻萌逗趣", category: "幽默", description: "傻里傻氣、無厘頭" },
  { value: "dramatic_theatrical", label: "戲劇誇張", category: "幽默", description: "表情豐富、反應強烈" },
  
  // 特殊屬性
  { value: "tsundere", label: "傲嬌", category: "特殊", description: "口是心非、嘴硬心軟" },
  { value: "kuudere", label: "冷嬌", category: "特殊", description: "外表冷淡、內心溫柔" },
  { value: "dandere", label: "文靜嬌", category: "特殊", description: "安靜內向、熟了會開朗" },
  { value: "yandere", label: "病嬌", category: "特殊", description: "過度執著、危險魅力" },
  { value: "genki", label: "元氣系", category: "特殊", description: "活力滿點、永遠元氣" },
  { value: "chuunibyou", label: "中二病", category: "特殊", description: "幻想自己有特殊能力" },
];

// ============================================================
// IP 角色年齡設定
// ============================================================
const CHARACTER_AGE_GROUPS = [
  { value: "baby_infant", label: "嬰幼兒", description: "0-3 歲、極度可愛、無害", icon: "👶" },
  { value: "child_kid", label: "兒童", description: "4-12 歲、天真活潑、好奇心", icon: "🧒" },
  { value: "teenager_youth", label: "青少年", description: "13-19 歲、青春活力、校園", icon: "👦" },
  { value: "young_adult", label: "年輕成人", description: "20-35 歲、成熟但有活力", icon: "🧑" },
  { value: "middle_aged", label: "中年", description: "36-55 歲、穩重有經驗", icon: "🧔" },
  { value: "senior_elderly", label: "銀髮長者", description: "56+ 歲、智慧慈祥", icon: "👴" },
  { value: "ageless_immortal", label: "永恆不老", description: "神話角色、精靈、神仙", icon: "🧚" },
  { value: "ambiguous", label: "年齡模糊", description: "Q版或非人類、不明確", icon: "❓" },
];

// ============================================================
// 產業分類 - 幫助系統更好理解品牌需求
// ============================================================
const INDUSTRIES = [
  // 科技與網路
  { value: "tech_saas", label: "軟體 SaaS", category: "科技" },
  { value: "tech_ai", label: "人工智慧", category: "科技" },
  { value: "tech_fintech", label: "金融科技", category: "科技" },
  { value: "tech_ecommerce", label: "電商平台", category: "科技" },
  { value: "tech_gaming", label: "遊戲娛樂", category: "科技" },
  { value: "tech_hardware", label: "硬體設備", category: "科技" },
  
  // 消費品與零售
  { value: "retail_fashion", label: "時尚服飾", category: "零售" },
  { value: "retail_beauty", label: "美妝保養", category: "零售" },
  { value: "retail_food", label: "食品飲料", category: "零售" },
  { value: "retail_home", label: "居家用品", category: "零售" },
  { value: "retail_luxury", label: "精品奢侈品", category: "零售" },
  { value: "retail_sports", label: "運動用品", category: "零售" },
  
  // 服務業
  { value: "service_restaurant", label: "餐飲美食", category: "服務" },
  { value: "service_hospitality", label: "旅遊住宿", category: "服務" },
  { value: "service_fitness", label: "健身運動", category: "服務" },
  { value: "service_spa", label: "美容 SPA", category: "服務" },
  { value: "service_education", label: "教育培訓", category: "服務" },
  { value: "service_consulting", label: "顧問諮詢", category: "服務" },
  
  // 專業領域
  { value: "professional_medical", label: "醫療健康", category: "專業" },
  { value: "professional_legal", label: "法律服務", category: "專業" },
  { value: "professional_finance", label: "金融保險", category: "專業" },
  { value: "professional_realestate", label: "房地產", category: "專業" },
  { value: "professional_accounting", label: "會計稅務", category: "專業" },
  
  // 創意與媒體
  { value: "creative_agency", label: "廣告代理", category: "創意" },
  { value: "creative_design", label: "設計工作室", category: "創意" },
  { value: "creative_media", label: "媒體內容", category: "創意" },
  { value: "creative_photography", label: "攝影工作室", category: "創意" },
  { value: "creative_kol", label: "KOL/創作者", category: "創意" },
  
  // IP 與娛樂
  { value: "ip_character", label: "IP 角色", category: "IP" },
  { value: "ip_animation", label: "動畫製作", category: "IP" },
  { value: "ip_merchandise", label: "周邊商品", category: "IP" },
  { value: "ip_event", label: "展演活動", category: "IP" },
  
  // 非營利與政府
  { value: "npo_charity", label: "公益慈善", category: "非營利" },
  { value: "npo_environment", label: "環境保育", category: "非營利" },
  { value: "gov_public", label: "政府機關", category: "公部門" },
  { value: "gov_cultural", label: "文化單位", category: "公部門" },
  
  // 其他
  { value: "other_personal", label: "個人品牌", category: "其他" },
  { value: "other_startup", label: "新創公司", category: "其他" },
  { value: "other_general", label: "一般企業", category: "其他" },
];

export default function BrandKitPage() {
  const [brandKits, setBrandKits] = useState<BrandKit[]>([]);
  const [selectedKit, setSelectedKit] = useState<BrandKit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // 表單狀態
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    primary_color: "#6366F1",
    secondary_color: "#8B5CF6",
    accent_color: "",
    background_color: "#FFFFFF",
    text_color: "#1F2937",
    color_palette: [] as string[],
    heading_font: "Noto Sans TC",
    body_font: "Noto Sans TC",
    font_style: "modern",
    visual_style: "modern",
    image_style: "photography",
    brand_voice: "friendly",
    preferred_tts_voice: "zh-TW-HsiaoChenNeural",
    tagline: "",
    key_messages: [] as string[],
    tone_of_voice: [] as string[],
    industry: "",
    is_default: false,
    // IP 角色設定
    character_personality: "" as string,
    character_age_group: "" as string,
    character_traits: [] as string[],
  });

  const [newMessage, setNewMessage] = useState("");
  const [newTone, setNewTone] = useState("");
  const [newColor, setNewColor] = useState("#6366F1");
  
  // TTS 試聽狀態
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  const [ttsAudio, setTtsAudio] = useState<HTMLAudioElement | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);

  // TTS 試聽功能
  const playTTSPreview = async (voiceId: string) => {
    // 如果正在播放，停止
    if (isPlayingTTS && ttsAudio) {
      ttsAudio.pause();
      ttsAudio.currentTime = 0;
      setIsPlayingTTS(false);
      setTtsAudio(null);
      return;
    }
    
    setIsPlayingTTS(true);
    setTtsError(null);
    
    try {
      const response = await api.post("/video/tts/preview", {
        voice_id: voiceId,
        text: "" // 使用預設文字
      }, {
        responseType: "blob"
      });
      
      // 創建音頻 URL
      const audioBlob = new Blob([response.data], { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // 創建並播放音頻
      const audio = new Audio(audioUrl);
      setTtsAudio(audio);
      
      audio.onended = () => {
        setIsPlayingTTS(false);
        setTtsAudio(null);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = () => {
        setIsPlayingTTS(false);
        setTtsAudio(null);
        setTtsError("播放失敗");
        URL.revokeObjectURL(audioUrl);
      };
      
      await audio.play();
    } catch (error) {
      console.error("TTS preview failed:", error);
      setIsPlayingTTS(false);
      setTtsError("語音生成失敗，請稍後再試");
    }
  };
  
  // 停止 TTS 播放
  const stopTTSPreview = () => {
    if (ttsAudio) {
      ttsAudio.pause();
      ttsAudio.currentTime = 0;
      setTtsAudio(null);
    }
    setIsPlayingTTS(false);
  };

  // 載入品牌包
  const loadBrandKits = useCallback(async () => {
    try {
      const response = await api.get("/brand-kit");
      setBrandKits(response.data.brand_kits);
      
      // 選擇預設或第一個
      const defaultKit = response.data.brand_kits.find((k: BrandKit) => k.is_default);
      if (defaultKit) {
        setSelectedKit(defaultKit);
        populateForm(defaultKit);
      } else if (response.data.brand_kits.length > 0) {
        setSelectedKit(response.data.brand_kits[0]);
        populateForm(response.data.brand_kits[0]);
      }
    } catch (error) {
      console.error("Failed to load brand kits:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBrandKits();
  }, [loadBrandKits]);

  const populateForm = (kit: BrandKit) => {
    setFormData({
      name: kit.name,
      description: kit.description || "",
      primary_color: kit.primary_color,
      secondary_color: kit.secondary_color,
      accent_color: kit.accent_color || "",
      background_color: kit.background_color,
      text_color: kit.text_color,
      color_palette: kit.color_palette || [],
      heading_font: kit.heading_font,
      body_font: kit.body_font,
      font_style: kit.font_style,
      visual_style: kit.visual_style,
      image_style: kit.image_style,
      brand_voice: kit.brand_voice,
      preferred_tts_voice: kit.preferred_tts_voice,
      tagline: kit.tagline || "",
      key_messages: kit.key_messages || [],
      tone_of_voice: kit.tone_of_voice || [],
      industry: kit.industry || "",
      is_default: kit.is_default,
      // IP 角色設定
      character_personality: (kit as any).character_personality || "",
      character_age_group: (kit as any).character_age_group || "",
      character_traits: (kit as any).character_traits || [],
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        colors: {
          primary: formData.primary_color,
          secondary: formData.secondary_color,
          accent: formData.accent_color || null,
          background: formData.background_color,
          text: formData.text_color,
          palette: formData.color_palette,
        },
        fonts: {
          heading: formData.heading_font,
          body: formData.body_font,
          style: formData.font_style,
        },
        visual_style: formData.visual_style,
        image_style: formData.image_style,
        voice: {
          voice_style: formData.brand_voice,
          tts_voice: formData.preferred_tts_voice,
        },
        tagline: formData.tagline || null,
        key_messages: formData.key_messages,
        tone_of_voice: formData.tone_of_voice,
        industry: formData.industry || null,
        is_default: formData.is_default,
        // IP 角色設定
        character_personality: formData.character_personality || null,
        character_age_group: formData.character_age_group || null,
        character_traits: formData.character_traits,
      };

      if (selectedKit) {
        await api.put(`/brand-kit/${selectedKit.id}`, payload);
      } else {
        await api.post("/brand-kit", payload);
      }

      await loadBrandKits();
      toast.success("品牌包已儲存！");
    } catch (error) {
      console.error("Failed to save:", error);
      toast.error("儲存失敗，請稍後再試");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const response = await api.post("/brand-kit", {
        name: "新品牌包",
        colors: {
          primary: "#6366F1",
          secondary: "#8B5CF6",
          background: "#FFFFFF",
          text: "#1F2937",
          palette: [],
        },
        fonts: {
          heading: "Noto Sans TC",
          body: "Noto Sans TC",
          style: "modern",
        },
        visual_style: "modern",
        image_style: "photography",
        voice: {
          voice_style: "friendly",
          tts_voice: "zh-TW-HsiaoChenNeural",
        },
        key_messages: [],
        tone_of_voice: [],
      });

      await loadBrandKits();
      setSelectedKit(response.data);
      populateForm(response.data);
    } catch (error) {
      console.error("Failed to create:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedKit) return;
    if (!confirm("確定要刪除這個品牌包嗎？")) return;

    try {
      await api.delete(`/brand-kit/${selectedKit.id}`);
      await loadBrandKits();
      setSelectedKit(null);
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    if (!selectedKit || !e.target.files?.[0]) return;

    const file = e.target.files[0];
    const formDataUpload = new FormData();
    formDataUpload.append("file", file);
    formDataUpload.append("asset_type", type);

    try {
      await api.post(`/brand-kit/${selectedKit.id}/assets`, formDataUpload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await loadBrandKits();
    } catch (error) {
      console.error("Failed to upload:", error);
      toast.error("上傳失敗");
    }
  };

  const addKeyMessage = () => {
    if (newMessage.trim()) {
      setFormData(prev => ({
        ...prev,
        key_messages: [...prev.key_messages, newMessage.trim()]
      }));
      setNewMessage("");
    }
  };

  const removeKeyMessage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      key_messages: prev.key_messages.filter((_, i) => i !== index)
    }));
  };

  const addTone = () => {
    if (newTone.trim()) {
      setFormData(prev => ({
        ...prev,
        tone_of_voice: [...prev.tone_of_voice, newTone.trim()]
      }));
      setNewTone("");
    }
  };

  const removeTone = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tone_of_voice: prev.tone_of_voice.filter((_, i) => i !== index)
    }));
  };

  const addPaletteColor = () => {
    if (newColor && !formData.color_palette.includes(newColor)) {
      setFormData(prev => ({
        ...prev,
        color_palette: [...prev.color_palette, newColor]
      }));
    }
  };

  const removePaletteColor = (index: number) => {
    setFormData(prev => ({
      ...prev,
      color_palette: prev.color_palette.filter((_, i) => i !== index)
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Palette className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">品牌資產包</h1>
          </div>
          <p className="text-slate-400 text-sm mt-1 ml-[52px]">
            設定品牌色彩、Logo 和風格，讓 AI 生成的內容保持品牌一致性
          </p>
        </div>
        <div className="flex gap-2 ml-[52px] sm:ml-0">
          <Button
            variant="outline"
            onClick={handleCreate}
            disabled={isCreating}
            className="border-slate-700 hover:bg-slate-800 text-slate-300"
          >
            <Plus className="w-4 h-4 mr-2" />
            新增
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "儲存中..." : "儲存變更"}
          </Button>
        </div>
      </div>

      {/* Brand Kit Selector */}
      {brandKits.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {brandKits.map(kit => (
            <Button
              key={kit.id}
              variant={selectedKit?.id === kit.id ? "default" : "outline"}
              onClick={() => {
                setSelectedKit(kit);
                populateForm(kit);
              }}
              className={selectedKit?.id === kit.id 
                ? "bg-indigo-600 text-white" 
                : "border-slate-700 hover:bg-slate-800 text-slate-300"
              }
            >
              {kit.is_default && <Star className="w-4 h-4 mr-1 fill-yellow-400 text-yellow-400" />}
              {kit.name}
            </Button>
          ))}
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="colors" className="space-y-6">
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
          <TabsList className="bg-slate-800/80 border border-slate-700 backdrop-blur-sm inline-flex w-auto h-auto p-1">
            {[
              { value: "colors", icon: Palette, label: "色彩" },
              { value: "logo", icon: ImageIcon, label: "Logo" },
              { value: "typography", icon: Type, label: "字型" },
              { value: "voice", icon: Mic, label: "品牌聲音" },
              { value: "style", icon: Eye, label: "視覺風格" },
              { value: "character", icon: Sparkles, label: "IP 角色" },
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="data-[state=active]:!bg-indigo-600 data-[state=active]:!text-white dark:data-[state=active]:!bg-indigo-600 dark:data-[state=active]:!text-white data-[state=active]:shadow-md text-slate-400 dark:text-slate-400 hover:text-slate-200 !flex-none !overflow-visible items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap"
              >
                <tab.icon className="w-4 h-4 shrink-0" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Colors Tab */}
        <TabsContent value="colors" className="space-y-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">基本資訊</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">品牌名稱</Label>
                  <Input
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="我的品牌"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">產業類別</Label>
                  <Select
                    value={formData.industry}
                    onValueChange={value => setFormData(prev => ({ ...prev, industry: value }))}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue placeholder="選擇產業..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 max-h-[300px]">
                      {Object.entries(
                        INDUSTRIES.reduce((acc, ind) => {
                          if (!acc[ind.category]) acc[ind.category] = [];
                          acc[ind.category].push(ind);
                          return acc;
                        }, {} as Record<string, typeof INDUSTRIES>)
                      ).map(([category, items]) => (
                        <SelectGroup key={category}>
                          <SelectLabel className="text-slate-400 text-xs px-2 py-1">{category}</SelectLabel>
                          {items.map(ind => (
                            <SelectItem key={ind.value} value={ind.value}>
                              {ind.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">品牌標語</Label>
                <Input
                  value={formData.tagline}
                  onChange={e => setFormData(prev => ({ ...prev, tagline: e.target.value }))}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="一句話描述你的品牌..."
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">品牌描述</Label>
                <Textarea
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="詳細描述你的品牌定位和價值主張..."
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_default}
                  onCheckedChange={checked => setFormData(prev => ({ ...prev, is_default: checked }))}
                />
                <Label className="text-slate-300">設為預設品牌包</Label>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">品牌色彩</CardTitle>
              <CardDescription>設定品牌的主要配色，將自動應用於生成的內容</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">主色</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.primary_color}
                      onChange={e => setFormData(prev => ({ ...prev, primary_color: e.target.value }))}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <Input
                      value={formData.primary_color}
                      onChange={e => setFormData(prev => ({ ...prev, primary_color: e.target.value }))}
                      className="bg-slate-800 border-slate-700 text-white flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">副色</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.secondary_color}
                      onChange={e => setFormData(prev => ({ ...prev, secondary_color: e.target.value }))}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <Input
                      value={formData.secondary_color}
                      onChange={e => setFormData(prev => ({ ...prev, secondary_color: e.target.value }))}
                      className="bg-slate-800 border-slate-700 text-white flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">強調色</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.accent_color || "#EC4899"}
                      onChange={e => setFormData(prev => ({ ...prev, accent_color: e.target.value }))}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <Input
                      value={formData.accent_color}
                      onChange={e => setFormData(prev => ({ ...prev, accent_color: e.target.value }))}
                      className="bg-slate-800 border-slate-700 text-white flex-1"
                      placeholder="#EC4899"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">背景色</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.background_color}
                      onChange={e => setFormData(prev => ({ ...prev, background_color: e.target.value }))}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <Input
                      value={formData.background_color}
                      onChange={e => setFormData(prev => ({ ...prev, background_color: e.target.value }))}
                      className="bg-slate-800 border-slate-700 text-white flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">文字色</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.text_color}
                      onChange={e => setFormData(prev => ({ ...prev, text_color: e.target.value }))}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <Input
                      value={formData.text_color}
                      onChange={e => setFormData(prev => ({ ...prev, text_color: e.target.value }))}
                      className="bg-slate-800 border-slate-700 text-white flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* Color Palette */}
              <div className="space-y-2">
                <Label className="text-slate-300">完整調色盤</Label>
                <div className="flex flex-wrap gap-2">
                  {formData.color_palette.map((color, i) => (
                    <div key={i} className="flex items-center gap-1 bg-slate-800 rounded-lg px-2 py-1">
                      <div
                        className="w-6 h-6 rounded"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-slate-300 text-sm">{color}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePaletteColor(i)}
                        className="h-6 w-6 p-0 hover:bg-red-500/20"
                      >
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newColor}
                      onChange={e => setNewColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addPaletteColor}
                      className="border-slate-700 hover:bg-slate-800"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label className="text-slate-300">預覽</Label>
                <div
                  className="rounded-lg p-6 border"
                  style={{
                    backgroundColor: formData.background_color,
                    borderColor: formData.primary_color,
                  }}
                >
                  <h3
                    className="text-xl font-bold mb-2"
                    style={{ color: formData.primary_color }}
                  >
                    {formData.name || "品牌名稱"}
                  </h3>
                  <p style={{ color: formData.text_color }}>
                    {formData.tagline || "這是品牌標語的預覽效果"}
                  </p>
                  <div className="flex gap-2 mt-4">
                    <button
                      className="px-4 py-2 rounded-lg text-white"
                      style={{ backgroundColor: formData.primary_color }}
                    >
                      主要按鈕
                    </button>
                    <button
                      className="px-4 py-2 rounded-lg"
                      style={{
                        backgroundColor: formData.secondary_color,
                        color: formData.background_color,
                      }}
                    >
                      次要按鈕
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logo Tab */}
        <TabsContent value="logo" className="space-y-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Logo 資產</CardTitle>
              <CardDescription>上傳不同版本的 Logo，用於各種背景場景</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { type: "logo", label: "主要 Logo", current: selectedKit?.logo_url },
                  { type: "logo_light", label: "淺色背景版", current: selectedKit?.logo_light_url },
                  { type: "logo_dark", label: "深色背景版", current: selectedKit?.logo_dark_url },
                  { type: "logo_icon", label: "圖示版", current: selectedKit?.logo_icon_url },
                ].map(item => (
                  <div key={item.type} className="space-y-2">
                    <Label className="text-slate-300">{item.label}</Label>
                    <div className="aspect-square rounded-lg border-2 border-dashed border-slate-700 flex items-center justify-center bg-slate-800 relative overflow-hidden">
                      {item.current ? (
                        <img
                          src={item.current}
                          alt={item.label}
                          className="w-full h-full object-contain p-4"
                        />
                      ) : (
                        <div className="text-center text-slate-500">
                          <Upload className="w-8 h-8 mx-auto mb-2" />
                          <p className="text-sm">點擊上傳</p>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => handleLogoUpload(e, item.type)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">參考圖（風格遷移）</CardTitle>
              <CardDescription>
                上傳品牌風格參考圖，AI 將學習這些圖片的配色和風格
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {selectedKit?.reference_images?.map((ref, i) => (
                  <div key={i} className="aspect-square rounded-lg border border-slate-700 overflow-hidden relative">
                    <img src={ref.url} alt={`參考圖 ${i + 1}`} className="w-full h-full object-cover" />
                    <Badge className="absolute bottom-2 left-2 bg-black/70">
                      {ref.type === "style" ? "風格" : ref.type === "color" ? "配色" : "排版"}
                    </Badge>
                  </div>
                ))}
                <div className="aspect-square rounded-lg border-2 border-dashed border-slate-700 flex items-center justify-center bg-slate-800 relative">
                  <div className="text-center text-slate-500">
                    <Plus className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">新增參考圖</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => handleLogoUpload(e, "reference")}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Typography Tab */}
        <TabsContent value="typography" className="space-y-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">字型設定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">標題字型</Label>
                  <Input
                    value={formData.heading_font}
                    onChange={e => setFormData(prev => ({ ...prev, heading_font: e.target.value }))}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="Noto Sans TC"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">內文字型</Label>
                  <Input
                    value={formData.body_font}
                    onChange={e => setFormData(prev => ({ ...prev, body_font: e.target.value }))}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="Noto Sans TC"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label className="text-slate-300">字型風格</Label>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                    {FONT_STYLES.map(style => (
                      <button
                        key={style.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, font_style: style.value }))}
                        className={`p-3 rounded-lg border text-left transition-all duration-200 ${
                          formData.font_style === style.value
                            ? "border-emerald-500 bg-emerald-500/20 ring-2 ring-emerald-500/50"
                            : "border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800"
                        }`}
                      >
                        <div className={`font-medium text-sm ${formData.font_style === style.value ? "text-emerald-300" : "text-slate-200"}`}>
                          {style.label}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {style.description}
                        </div>
                        <div className="text-xs text-slate-600 mt-1 truncate">
                          {style.fonts.slice(0, 2).join(", ")}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Voice Tab */}
        <TabsContent value="voice" className="space-y-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">品牌聲音</CardTitle>
              <CardDescription>定義品牌的語調和溝通風格，影響文案生成的表達方式</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 品牌聲音風格 - 卡片式選擇 */}
              <div className="space-y-3">
                <Label className="text-slate-300 text-sm font-medium">品牌聲音風格</Label>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-2">
                  {BRAND_VOICES.map(voice => (
                    <button
                      key={voice.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, brand_voice: voice.value }))}
                      className={`p-3 rounded-lg border text-left transition-all duration-200 ${
                        formData.brand_voice === voice.value
                          ? "border-purple-500 bg-purple-500/20 ring-2 ring-purple-500/50"
                          : "border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800"
                      }`}
                    >
                      <div className={`font-medium text-sm ${formData.brand_voice === voice.value ? "text-purple-300" : "text-slate-200"}`}>
                        {voice.label}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {voice.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* TTS 語音 - 分組下拉選單 */}
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <Label className="text-slate-300 text-sm font-medium">TTS 語音（影片旁白）</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.preferred_tts_voice}
                    onValueChange={value => {
                      setFormData(prev => ({ ...prev, preferred_tts_voice: value }));
                      stopTTSPreview(); // 切換時停止播放
                    }}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white flex-1">
                      <SelectValue placeholder="選擇語音..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 max-h-[300px]">
                      {Object.entries(
                        TTS_VOICES.reduce((acc, voice) => {
                          if (!acc[voice.locale]) acc[voice.locale] = [];
                          acc[voice.locale].push(voice);
                          return acc;
                        }, {} as Record<string, typeof TTS_VOICES>)
                      ).map(([locale, voices]) => (
                        <SelectGroup key={locale}>
                          <SelectLabel className="text-purple-400 text-xs px-2 py-1.5 font-semibold">
                            {locale === "zh-TW" ? "繁體中文（台灣）" :
                             locale === "zh-CN" ? "簡體中文" :
                             locale === "zh-HK" ? "粵語（香港）" :
                             locale === "en-US" ? "英文（美式）" :
                             locale === "en-GB" ? "英文（英式）" :
                             locale === "ja-JP" ? "日文" :
                             locale === "ko-KR" ? "韓文" : locale}
                          </SelectLabel>
                          {voices.map(voice => (
                            <SelectItem key={voice.value} value={voice.value} className="py-2">
                              <div className="flex items-center gap-2">
                                <span className={voice.gender === "female" ? "text-pink-400" : "text-blue-400"}>
                                  {voice.gender === "female" ? "♀" : "♂"}
                                </span>
                                <span className="text-white">{voice.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* 試聽按鈕 */}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => playTTSPreview(formData.preferred_tts_voice)}
                    disabled={!formData.preferred_tts_voice}
                    className={`border-slate-700 hover:bg-slate-800 w-12 h-10 ${
                      isPlayingTTS ? "bg-purple-600/20 border-purple-500" : ""
                    }`}
                    title={isPlayingTTS ? "停止試聽" : "試聽語音"}
                  >
                    {isPlayingTTS ? (
                      <Square className="w-4 h-4 text-purple-400 fill-purple-400" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                
                {/* 當前選擇預覽與試聽狀態 */}
                {formData.preferred_tts_voice && (
                  <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-400">已選擇：</span>
                        <span className="text-purple-400 font-medium">
                          {TTS_VOICES.find(v => v.value === formData.preferred_tts_voice)?.label}
                        </span>
                      </div>
                      {isPlayingTTS && (
                        <div className="flex items-center gap-2 text-xs text-purple-400">
                          <div className="flex gap-0.5">
                            <span className="w-1 h-3 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: "0ms" }} />
                            <span className="w-1 h-4 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
                            <span className="w-1 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
                            <span className="w-1 h-5 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: "450ms" }} />
                            <span className="w-1 h-3 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: "600ms" }} />
                          </div>
                          <span>播放中...</span>
                        </div>
                      )}
                    </div>
                    {ttsError && (
                      <p className="text-xs text-red-400 mt-2">{ttsError}</p>
                    )}
                  </div>
                )}
                
                {/* 試聽提示 */}
                <p className="text-xs text-slate-500">
                  💡 點擊右側按鈕可試聽語音效果（免費，不扣點）
                </p>
              </div>

              {/* Key Messages */}
              <div className="space-y-2">
                <Label className="text-slate-300">關鍵訊息</Label>
                <div className="flex flex-wrap gap-2">
                  {formData.key_messages.map((msg, i) => (
                    <Badge key={i} className="bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 py-1">
                      {msg}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeKeyMessage(i)}
                        className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addKeyMessage()}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="輸入關鍵訊息..."
                  />
                  <Button onClick={addKeyMessage} className="bg-slate-700 hover:bg-slate-600">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Tone of Voice */}
              <div className="space-y-2">
                <Label className="text-slate-300">語調關鍵字</Label>
                <div className="flex flex-wrap gap-2">
                  {formData.tone_of_voice.map((tone, i) => (
                    <Badge key={i} className="bg-purple-600/20 text-purple-300 border border-purple-500/30 py-1">
                      {tone}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTone(i)}
                        className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newTone}
                    onChange={e => setNewTone(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addTone()}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="例如：親切、專業、創新..."
                  />
                  <Button onClick={addTone} className="bg-slate-700 hover:bg-slate-600">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Style Tab */}
        <TabsContent value="style" className="space-y-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">視覺風格</CardTitle>
              <CardDescription>定義品牌的視覺呈現風格，影響所有生成內容的視覺基調</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 整體視覺風格 - 卡片式選擇器 */}
              <div className="space-y-3">
                <Label className="text-slate-300 text-sm font-medium">整體視覺風格</Label>
                <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
                  {Object.entries(
                    VISUAL_STYLES.reduce((acc, style) => {
                      if (!acc[style.category]) acc[style.category] = [];
                      acc[style.category].push(style);
                      return acc;
                    }, {} as Record<string, typeof VISUAL_STYLES>)
                  ).map(([category, styles]) => (
                    <div key={category} className="space-y-2">
                      <h4 className="text-xs font-semibold text-indigo-400/80 uppercase tracking-wider px-1 sticky top-0 bg-slate-900 py-2 z-10 border-b border-slate-800">{category}</h4>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                        {styles.map(style => (
                          <button
                            key={style.value}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, visual_style: style.value }))}
                            className={`p-3 rounded-lg border text-left transition-all duration-200 group ${
                              formData.visual_style === style.value
                                ? "border-indigo-500 bg-indigo-500/20 ring-2 ring-indigo-500/50"
                                : "border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800"
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <span className="text-xl">{style.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className={`font-medium text-sm ${formData.visual_style === style.value ? "text-indigo-300" : "text-slate-200"}`}>
                                  {style.label}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5 line-clamp-2 group-hover:text-slate-400">
                                  {style.description}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 圖片風格 - 分類下拉選單 */}
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <Label className="text-slate-300 text-sm font-medium">圖片生成風格</Label>
                <Select
                  value={formData.image_style}
                  onValueChange={value => setFormData(prev => ({ ...prev, image_style: value }))}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="選擇圖片風格..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 max-h-[350px]">
                    {Object.entries(
                      IMAGE_STYLES.reduce((acc, style) => {
                        if (!acc[style.category]) acc[style.category] = [];
                        acc[style.category].push(style);
                        return acc;
                      }, {} as Record<string, typeof IMAGE_STYLES>)
                    ).map(([category, styles]) => (
                      <SelectGroup key={category}>
                        <SelectLabel className="text-indigo-400 text-xs px-2 py-1.5 font-semibold">{category}</SelectLabel>
                        {styles.map(style => (
                          <SelectItem key={style.value} value={style.value} className="py-2">
                            <div className="flex flex-col">
                              <span className="text-white">{style.label}</span>
                              <span className="text-xs text-slate-500">{style.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                {/* 當前選擇預覽 */}
                {formData.image_style && (
                  <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-slate-400">已選擇：</span>
                      <span className="text-indigo-400 font-medium">
                        {IMAGE_STYLES.find(s => s.value === formData.image_style)?.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {IMAGE_STYLES.find(s => s.value === formData.image_style)?.description}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Character Tab - IP 角色設定 */}
        <TabsContent value="character" className="space-y-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                IP 角色設定
              </CardTitle>
              <CardDescription>
                定義品牌 IP 角色的外觀、性格與特徵，適用於吉祥物、虛擬代言人、遊戲角色等
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 角色年齡組 */}
              <div className="space-y-3">
                <Label className="text-slate-300 text-sm font-medium">角色年齡設定</Label>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {CHARACTER_AGE_GROUPS.map(age => (
                    <button
                      key={age.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, character_age_group: age.value }))}
                      className={`p-3 rounded-lg border text-left transition-all duration-200 ${
                        formData.character_age_group === age.value
                          ? "border-amber-500 bg-amber-500/20 ring-2 ring-amber-500/50"
                          : "border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{age.icon}</span>
                        <div>
                          <div className={`font-medium text-sm ${formData.character_age_group === age.value ? "text-amber-300" : "text-slate-200"}`}>
                            {age.label}
                          </div>
                          <div className="text-xs text-slate-500">{age.description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 角色性格 */}
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <Label className="text-slate-300 text-sm font-medium">角色性格特徵</Label>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {Object.entries(
                    CHARACTER_PERSONALITIES.reduce((acc, p) => {
                      if (!acc[p.category]) acc[p.category] = [];
                      acc[p.category].push(p);
                      return acc;
                    }, {} as Record<string, typeof CHARACTER_PERSONALITIES>)
                  ).map(([category, personalities]) => (
                    <div key={category} className="space-y-2">
                      <h4 className="text-xs font-semibold text-amber-400/80 uppercase tracking-wider px-1 sticky top-0 bg-slate-900 py-2 z-10 border-b border-slate-800">{category}</h4>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                        {personalities.map(p => (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, character_personality: p.value }))}
                            className={`p-3 rounded-lg border text-left transition-all duration-200 ${
                              formData.character_personality === p.value
                                ? "border-amber-500 bg-amber-500/20 ring-2 ring-amber-500/50"
                                : "border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800"
                            }`}
                          >
                            <div className={`font-medium text-sm ${formData.character_personality === p.value ? "text-amber-300" : "text-slate-200"}`}>
                              {p.label}
                            </div>
                            <div className="text-xs text-slate-500 mt-1 line-clamp-1">
                              {p.description}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 額外特徵標籤 */}
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <Label className="text-slate-300 text-sm font-medium">額外特徵標籤</Label>
                <div className="flex flex-wrap gap-2">
                  {formData.character_traits.map((trait, i) => (
                    <Badge key={i} className="bg-amber-600/20 text-amber-300 border border-amber-500/30 py-1">
                      {trait}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newTraits = [...formData.character_traits];
                          newTraits.splice(i, 1);
                          setFormData(prev => ({ ...prev, character_traits: newTraits }));
                        }}
                        className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="輸入特徵（如：戴眼鏡、愛吃甜食、會魔法...）"
                    className="bg-slate-800 border-slate-700 text-white flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const input = e.currentTarget;
                        const value = input.value.trim();
                        if (value && !formData.character_traits.includes(value)) {
                          setFormData(prev => ({
                            ...prev,
                            character_traits: [...prev.character_traits, value]
                          }));
                          input.value = "";
                        }
                        e.preventDefault();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const input = document.querySelector('input[placeholder*="輸入特徵"]') as HTMLInputElement;
                      const value = input?.value?.trim();
                      if (value && !formData.character_traits.includes(value)) {
                        setFormData(prev => ({
                          ...prev,
                          character_traits: [...prev.character_traits, value]
                        }));
                        if (input) input.value = "";
                      }
                    }}
                    className="border-slate-700 hover:bg-slate-800"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  添加角色的獨特特徵，如外觀特點、喜好、技能等，讓 AI 更好地理解角色設定
                </p>
              </div>

              {/* 快速特徵選擇 */}
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <Label className="text-slate-300 text-sm font-medium">快速添加常用特徵</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    "戴眼鏡", "貓耳", "兔耳", "翅膀", "尾巴", "帽子", "圍巾",
                    "愛吃甜食", "愛喝咖啡", "愛睡覺", "工作狂",
                    "會做料理", "會彈吉他", "會魔法", "會程式設計",
                    "怕黑", "怕蟲", "路痴", "健忘",
                    "雙馬尾", "短髮", "長髮", "金髮", "黑髮", "彩虹髮",
                    "紅瞳", "藍瞳", "異色瞳"
                  ].filter(t => !formData.character_traits.includes(t)).map(trait => (
                    <button
                      key={trait}
                      type="button"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        character_traits: [...prev.character_traits, trait]
                      }))}
                      className="px-3 py-1 text-xs rounded-full border border-slate-700 bg-slate-800/50 text-slate-400 hover:border-amber-500/50 hover:text-amber-400 transition-colors"
                    >
                      + {trait}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 角色設定摘要 */}
          {(formData.character_age_group || formData.character_personality || formData.character_traits.length > 0) && (
            <Card className="bg-gradient-to-br from-amber-900/20 to-orange-900/20 border-amber-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-amber-300 text-sm flex items-center gap-2">
                  <User className="w-4 h-4" />
                  角色設定摘要
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 text-sm">
                  {formData.character_age_group && (
                    <span className="px-2 py-1 bg-amber-500/20 rounded text-amber-300">
                      {CHARACTER_AGE_GROUPS.find(a => a.value === formData.character_age_group)?.icon}{" "}
                      {CHARACTER_AGE_GROUPS.find(a => a.value === formData.character_age_group)?.label}
                    </span>
                  )}
                  {formData.character_personality && (
                    <span className="px-2 py-1 bg-amber-500/20 rounded text-amber-300">
                      {CHARACTER_PERSONALITIES.find(p => p.value === formData.character_personality)?.label}
                    </span>
                  )}
                  {formData.character_traits.map((trait, i) => (
                    <span key={i} className="px-2 py-1 bg-slate-700/50 rounded text-slate-300">
                      {trait}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Button */}
      {selectedKit && (
        <div className="pt-6 border-t border-slate-800">
          <Button
            variant="destructive"
            onClick={handleDelete}
            className="bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            刪除此品牌包
          </Button>
        </div>
      )}
    </div>
  );
}
