"use client";

import { useState } from "react";
import {
  HelpCircle, Book, MessageCircle, Mail,
  ChevronDown, ChevronRight, Search, ExternalLink,
  Video, FileText, Zap, Shield, CreditCard, Users,
  Sparkles, PenTool, Image as ImageIcon, Calendar,
  Share2, BarChart3, Layers, Crown, Coins, Wallet,
  Gift, Settings, Bell, Palette, User, Rocket,
  CheckCircle, ArrowRight, Clock, AlertTriangle
} from "lucide-react";
import { Input } from "@/components/ui/input";

// ============================================================
// FAQ 資料（依平台最新功能結構整理）
// ============================================================

const faqCategories = [
  {
    id: "getting-started",
    icon: Rocket,
    title: "快速入門",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    questions: [
      {
        q: "如何開始使用 King Jam AI？",
        a: "註冊帳號後，您將獲得 100 點免費點數。您可以立即使用這些點數體驗 AI 生成功能，包括部落格文章、社群圖文和短影音生成。前往儀表板即可開始創作。"
      },
      {
        q: "平台有哪些主要功能？",
        a: "King Jam AI 提供四大核心功能：\n• AI 生成引擎：部落格文章、社群圖文、短影音生成、圖片編輯室\n• 發布管理：排程上架、社群帳號管理、成效洞察\n• 會員中心：訂閱管理、點數錢包、購買點數、推薦獎勵\n• 品牌資產包：儲存品牌素材與風格設定"
      },
      {
        q: "支援哪些瀏覽器？",
        a: "我們支援最新版本的 Chrome、Firefox、Safari 和 Edge 瀏覽器。建議使用 Chrome 以獲得最佳體驗。手機瀏覽器亦可正常使用。"
      },
      {
        q: "免費版可以使用哪些功能？",
        a: "免費版包含：基本 AI 文章生成、社群圖文設計、手動發布功能。註冊即贈 100 點體驗。如需 AI 短影片生成、智能排程發布、多平台同步等進階功能，請升級至入門版或以上方案。"
      },
    ]
  },
  {
    id: "ai-engine",
    icon: Zap,
    title: "AI 生成引擎",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    questions: [
      {
        q: "部落格文章生成如何使用？",
        a: "前往「AI 生成引擎 → 部落格文章」，輸入主題或關鍵字，選擇文章風格和長度，AI 會自動為您生成完整文章。您可以編輯修改後，直接發布到已連接的平台。"
      },
      {
        q: "社群圖文設計如何操作？",
        a: "前往「AI 生成引擎 → 社群圖文」，描述您想要的圖文內容，選擇適用平台（Facebook、Instagram 等），AI 將生成適合尺寸的圖片搭配文案。"
      },
      {
        q: "短影音生成需要多少點數？",
        a: "短影音生成依影片長度和品質而異，通常消耗 150-350 點。此功能需入門版以上方案才可使用。前往「AI 生成引擎 → 短影音生成」開始創作。"
      },
      {
        q: "圖片編輯室是什麼？",
        a: "圖片編輯室（PRO）是進階圖片編輯功能，支援 AI 智慧修圖、背景移除、風格轉換等。此為專業版以上方案專屬功能。"
      },
      {
        q: "生成的內容版權歸誰？",
        a: "透過 King Jam AI 生成的內容，您擁有完整的使用權，可用於商業用途。但建議避免使用可能涉及他人智慧財產權的素材作為輸入。"
      },
      {
        q: "如何提升生成品質？",
        a: "提供更詳細、具體的提示詞是關鍵。例如：指定目標受眾、語調風格、關鍵重點等。建議先用標準品質測試效果，滿意後再使用高級品質。您也可以在品牌資產包中設定品牌風格，讓 AI 更了解您的需求。"
      },
      {
        q: "生成失敗會扣點嗎？",
        a: "如果因系統問題導致生成失敗，點數會自動退還至您的帳戶。如果是因為內容違反使用規範被系統拒絕，則不會退還。"
      },
    ]
  },
  {
    id: "publishing",
    icon: Calendar,
    title: "發布管理",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    questions: [
      {
        q: "如何連接社群帳號？",
        a: "前往「發布管理 → 社群帳號」，點擊「連接帳號」按鈕，選擇您要連接的平台（Facebook、Instagram、YouTube 等），按照指示完成 OAuth 授權。連接後即可一鍵發布。"
      },
      {
        q: "排程上架如何使用？",
        a: "前往「發布管理 → 排程上架」，選擇已生成的內容，設定發布時間和目標平台，系統會自動在指定時間發布。此功能需專業版以上方案。"
      },
      {
        q: "支援哪些社群平台？",
        a: "目前支援 Facebook 粉專/社團、Instagram、YouTube 等主流平台。更多平台持續擴充中。連接的帳號數量依訂閱方案而異。"
      },
      {
        q: "成效洞察提供哪些數據？",
        a: "成效洞察（NEW）會追蹤您發布內容的互動數據，包括觸及率、按讚數、分享數、留言數等。幫助您了解哪些內容表現最好，優化創作策略。"
      },
      {
        q: "可以同時發布到多個平台嗎？",
        a: "可以！專業版以上方案支援多平台同步發布。在發布時勾選多個目標平台，內容會自動根據各平台的尺寸和格式要求做調整。"
      },
    ]
  },
  {
    id: "subscription",
    icon: Crown,
    title: "訂閱方案",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    questions: [
      {
        q: "有哪些訂閱方案？",
        a: "我們提供四種方案：\n• 免費版（NT$0）：基本功能體驗\n• 入門版（NT$299/月）：基本功能無廣告、單平台發布\n• 專業版（NT$699/月）：全功能解鎖、每月 1,000 點、多平台同步\n• 企業版（NT$3,699/月）：全功能 + API + 團隊協作、每月 5,000 點\n\n年繳可享 8 折優惠（省 20%）。"
      },
      {
        q: "如何升級或變更方案？",
        a: "前往「會員中心 → 訂閱管理」，選擇想要的方案，點擊「立即訂閱」，在彈出的結帳對話框中選擇月繳或年繳，確認後前往付款即可。升級立即生效。"
      },
      {
        q: "年繳方案有什麼優惠？",
        a: "所有付費方案的年繳都享有 20% 折扣（約等於 2 個月免費）。例如專業版月繳 NT$699/月，年繳只要 NT$6,710/年，等於每月只要 NT$559。在結帳時可自由切換月繳/年繳。"
      },
      {
        q: "如何取消訂閱？",
        a: "前往「訂閱管理」頁面，點擊「降級至免費版」。取消後您仍可使用服務至當期結束，之後自動降級為免費版。如需協助請聯繫 service@kingjam.app。"
      },
      {
        q: "升級方案如何計費？",
        a: "從低階方案升級到高階方案時，我們會按照剩餘天數計算差額。例如：入門版升級到專業版，只需補繳差價，不會重複收費。"
      },
    ]
  },
  {
    id: "credits",
    icon: Coins,
    title: "點數與付費",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    questions: [
      {
        q: "點數如何計算？",
        a: "不同功能消耗不同點數：\n• 部落格文章：5-20 點\n• 社群圖文：10-50 點\n• 短影音：150-350 點\n\n具體消耗依內容長度和品質等級而異。可在「點數錢包」查看詳細用量。"
      },
      {
        q: "點數有幾種類型？",
        a: "共四種類型：\n• 活動點數（PROMO）：促銷活動贈送，有效期較短\n• 月費點數（SUB）：訂閱方案每月贈送，當月有效，不累積至下月\n• 購買點數（PAID）：購買的點數，永久有效\n• 獎金點數（BONUS）：推薦獎勵獲得，永久有效，且可提領現金"
      },
      {
        q: "如何購買點數？",
        a: "前往「會員中心 → 購買點數」，選擇適合您的點數套餐，點擊「立即購買」完成付款。我們透過綠界科技（ECPay）處理付款，支援信用卡、ATM 轉帳、超商付款等方式。"
      },
      {
        q: "購買點數和訂閱方案的差別？",
        a: "購買點數是一次性購買，點數永久有效。訂閱方案是月/年繳制，除了每月贈送的點數外，還能解鎖進階功能（如短影音生成、排程發布、多平台同步等）。建議依使用頻率選擇最適合的方式。"
      },
      {
        q: "獎金點數如何提領為現金？",
        a: "累積滿 3,000 獎金點數（等值 NT$300）即可申請提領。需先完成身份認證，再前往「會員資料」頁面申請。提領審核約需 3-5 個工作天。"
      },
      {
        q: "可以退款嗎？",
        a: "首次訂閱後 7 天內，若未使用超過 100 點，可申請全額退款。購買的點數套餐一經使用則無法退款。詳情請參閱退款政策或聯繫客服。"
      },
    ]
  },
  {
    id: "referral",
    icon: Gift,
    title: "推薦獎勵",
    color: "text-pink-400",
    bgColor: "bg-pink-500/10",
    questions: [
      {
        q: "推薦獎勵如何運作？",
        a: "前往「會員中心 → 推薦獎勵」取得您的專屬推薦碼或推薦連結。分享給朋友，當他們註冊並完成首次付費，您將獲得該筆訂單金額 10-20% 的獎金點數（依您的夥伴等級而定）。"
      },
      {
        q: "夥伴等級如何升級？",
        a: "共三個等級：\n• 銅牌夥伴（所有人預設）：獎金比例 10%\n• 銀牌夥伴：推薦滿 10 人 + 累積收益 NT$5,000 → 獎金比例 15%\n• 金牌夥伴：推薦滿 50 人 + 累積收益 NT$50,000 → 獎金比例 20%"
      },
      {
        q: "獎金何時發放？",
        a: "被推薦人完成付費後，獎金點數會在 24 小時內自動發放到您的帳戶。可在「推薦獎勵」頁面查看推薦歷史和獎金明細。"
      },
      {
        q: "推薦碼可以用在年繳方案嗎？",
        a: "可以！推薦碼適用於所有付費方案，包括月繳和年繳。年繳訂單金額較高，對應的推薦獎金也更多。"
      },
    ]
  },
  {
    id: "verification",
    icon: Shield,
    title: "身份認證與帳號安全",
    color: "text-rose-400",
    bgColor: "bg-rose-500/10",
    questions: [
      {
        q: "為什麼要完成身份認證？",
        a: "完成身份認證後才能提領獎金點數為現金。身份認證也能提升帳號安全性，避免未經授權的操作。前往「會員中心 → 身份認證」進行認證。"
      },
      {
        q: "身份認證需要哪些資料？",
        a: "需提供：手機號碼驗證、真實姓名、身分證字號。所有資料均經過加密處理，僅用於身份核實和獎金提領。"
      },
      {
        q: "忘記密碼怎麼辦？",
        a: "在登入頁面點擊「忘記密碼」，輸入您的電子郵件，系統會發送密碼重設連結。連結有效期為 24 小時。如果未收到信件，請檢查垃圾郵件資料夾。"
      },
      {
        q: "支援第三方登入嗎？",
        a: "支援！您可以使用 Google 或 Facebook 帳號快速登入。如需綁定或解除綁定第三方帳號，請前往「帳號設定」進行操作。"
      },
      {
        q: "如何變更電子郵件或密碼？",
        a: "前往「會員中心 → 帳號設定」，可修改電子郵件、密碼等帳號資訊。變更電子郵件需完成新郵箱驗證。"
      },
    ]
  },
  {
    id: "brand-kit",
    icon: Palette,
    title: "品牌資產包",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    questions: [
      {
        q: "品牌資產包是什麼？",
        a: "品牌資產包讓您儲存品牌相關素材（Logo、配色、字體偏好、品牌口吻等），AI 在生成內容時會自動套用這些設定，確保所有內容都符合品牌風格。"
      },
      {
        q: "如何設定品牌資產包？",
        a: "前往「會員中心 → 品牌資產包」，上傳您的品牌 Logo、設定品牌色系、定義品牌語調和關鍵字。設定完成後，AI 生成內容時會自動參考這些設定。"
      },
      {
        q: "可以建立多個品牌嗎？",
        a: "企業版方案支援建立多個品牌資產包，適合管理多個品牌或子品牌的團隊。其他方案目前支援一個品牌資產包。"
      },
    ]
  },
];

// 快速功能導覽
const featureGuides = [
  {
    icon: PenTool,
    label: "寫文章",
    desc: "AI 部落格文章生成",
    href: "/dashboard/blog",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: ImageIcon,
    label: "做圖文",
    desc: "AI 社群圖文設計",
    href: "/dashboard/social",
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: Video,
    label: "拍短片",
    desc: "AI 短影音生成",
    href: "/dashboard/video",
    color: "from-orange-500 to-red-500",
  },
  {
    icon: Calendar,
    label: "排程發布",
    desc: "智能排程上架",
    href: "/dashboard/scheduler",
    color: "from-emerald-500 to-green-500",
  },
  {
    icon: Crown,
    label: "訂閱方案",
    desc: "升級解鎖更多功能",
    href: "/dashboard/subscription",
    color: "from-amber-500 to-yellow-500",
  },
  {
    icon: Coins,
    label: "購買點數",
    desc: "購買 AI 生成點數",
    href: "/dashboard/pricing",
    color: "from-indigo-500 to-violet-500",
  },
];

// ============================================================
// 元件
// ============================================================

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>("getting-started");
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  const toggleQuestion = (categoryId: string, index: number) => {
    const key = `${categoryId}-${index}`;
    setExpandedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // 搜尋過濾
  const filteredCategories = faqCategories.map(cat => ({
    ...cat,
    questions: cat.questions.filter(
      q => q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
           q.a.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(cat => cat.questions.length > 0 || !searchQuery);

  const totalQuestions = faqCategories.reduce((sum, c) => sum + c.questions.length, 0);

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-4 shadow-lg shadow-indigo-500/25">
          <HelpCircle className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">幫助中心</h1>
        <p className="text-slate-400">
          涵蓋 {faqCategories.length} 大分類、{totalQuestions} 個常見問題。找不到答案？直接聯繫我們的客服團隊
        </p>
      </div>

      {/* Search */}
      <div className="max-w-xl mx-auto">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <Input
            type="text"
            placeholder="搜尋常見問題...例如「點數」「訂閱」「短影音」"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 rounded-xl"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors text-sm"
            >
              清除
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="text-sm text-slate-500 mt-2 text-center">
            找到 {filteredCategories.reduce((sum, c) => sum + c.questions.length, 0)} 個相關問題
          </p>
        )}
      </div>

      {/* Quick Feature Guide */}
      {!searchQuery && (
        <div className="max-w-4xl mx-auto">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            快速功能導覽
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {featureGuides.map((item, idx) => {
              const Icon = item.icon;
              return (
                <a
                  key={idx}
                  href={item.href}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 hover:bg-slate-800 transition-all group"
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm font-medium text-white">{item.label}</span>
                  <span className="text-xs text-slate-500 text-center leading-tight">{item.desc}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* FAQ Categories */}
      <div className="max-w-3xl mx-auto space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Book className="w-5 h-5 text-indigo-400" />
          常見問題
        </h2>

        {filteredCategories.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">找不到符合「{searchQuery}」的問題</p>
            <p className="text-slate-500 text-sm mt-1">試試其他關鍵字，或直接聯繫客服</p>
          </div>
        )}

        {filteredCategories.map((category) => {
          const Icon = category.icon;
          const isExpanded = expandedCategory === category.id || !!searchQuery;
          
          return (
            <div 
              key={category.id}
              className="rounded-xl bg-slate-800/50 border border-slate-700/50 overflow-hidden"
            >
              {/* Category Header */}
              <button
                onClick={() => setExpandedCategory(isExpanded && !searchQuery ? null : category.id)}
                className="w-full flex items-center gap-4 p-4 hover:bg-slate-800/80 transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl ${category.bgColor} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 ${category.color}`} />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-semibold text-white">{category.title}</h3>
                  <p className="text-sm text-slate-500">{category.questions.length} 個問題</p>
                </div>
                <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
              </button>

              {/* Questions */}
              {isExpanded && (
                <div className="border-t border-slate-700/50">
                  {category.questions.map((item, idx) => {
                    const key = `${category.id}-${idx}`;
                    const isOpen = expandedQuestions.has(key);
                    
                    return (
                      <div key={idx} className="border-b border-slate-700/30 last:border-0">
                        <button
                          onClick={() => toggleQuestion(category.id, idx)}
                          className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-800/50 transition-colors"
                        >
                          <ChevronRight className={`w-4 h-4 mt-1 text-slate-500 transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
                          <span className="text-slate-200">{item.q}</span>
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4 pl-11">
                            <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">{item.a}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Platform Summary */}
      {!searchQuery && (
        <div className="max-w-3xl mx-auto">
          <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-400" />
              平台功能總覽
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider">AI 生成引擎</h3>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    部落格文章 - AI 長文生成
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    社群圖文 - 圖片 + 文案設計
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    短影音生成 - AI 影片製作
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    圖片編輯室 - PRO 進階修圖
                  </li>
                </ul>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider">發布管理</h3>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    排程上架 - 定時自動發布
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    社群帳號 - 多平台管理
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    成效洞察 - 數據分析報告
                  </li>
                </ul>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">會員中心</h3>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    身份認證 - 解鎖提領功能
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    訂閱管理 - 升級 / 降級方案
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    點數錢包 - 查看點數餘額
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    購買點數 - 點數套餐購買
                  </li>
                </ul>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-pink-400 uppercase tracking-wider">更多</h3>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    推薦獎勵 - 推薦賺獎金
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    品牌資產包 - 品牌風格設定
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    生成紀錄 - 歷史作品查看
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    通知中心 - 系統消息提醒
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contact Section */}
      <div className="max-w-3xl mx-auto">
        <div className="rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 p-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-white mb-2">還有其他問題？</h2>
            <p className="text-slate-400">我們的客服團隊隨時為您服務</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <a
              href="mailto:service@kingjam.app"
              className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-indigo-500/50 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
                <Mail className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="min-w-0">
                <h3 className="font-medium text-white">電子郵件客服</h3>
                <p className="text-sm text-slate-400 truncate">service@kingjam.app</p>
                <p className="text-xs text-slate-500 mt-0.5">通常 24 小時內回覆</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </a>
            
            <a
              href="#"
              className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-purple-500/50 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                <MessageCircle className="w-6 h-6 text-purple-400" />
              </div>
              <div className="min-w-0">
                <h3 className="font-medium text-white">線上客服</h3>
                <p className="text-sm text-slate-400">週一至週五 9:00-18:00</p>
                <p className="text-xs text-slate-500 mt-0.5">點擊右下角對話圖示</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </a>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
              <div className="text-xs text-slate-500">
                <p>客服回覆時間：週一至週五 09:00 - 18:00（國定假日除外）</p>
                <p className="mt-1">緊急問題請在郵件主旨標註【緊急】，我們會優先處理</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
