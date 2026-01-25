"use client";

import { useState } from "react";
import { 
  HelpCircle, Book, MessageCircle, Mail, Phone,
  ChevronDown, ChevronRight, Search, ExternalLink,
  Video, FileText, Zap, Shield, CreditCard, Users,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// FAQ 資料
const faqCategories = [
  {
    id: "getting-started",
    icon: Sparkles,
    title: "開始使用",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    questions: [
      {
        q: "如何開始使用 King Jam AI？",
        a: "註冊帳號後，您將獲得 200 點免費活動點數。您可以立即使用這些點數來體驗我們的 AI 生成功能，包括部落格文章、社群圖文和短影音生成。"
      },
      {
        q: "支援哪些瀏覽器？",
        a: "我們支援最新版本的 Chrome、Firefox、Safari 和 Edge 瀏覽器。建議使用 Chrome 以獲得最佳體驗。"
      },
      {
        q: "如何連接我的社群帳號？",
        a: "前往「社群帳號」頁面，點擊「連接帳號」按鈕，選擇您要連接的平台（Facebook、Instagram、YouTube 等），並按照指示完成授權。"
      },
    ]
  },
  {
    id: "credits",
    icon: CreditCard,
    title: "點數與付費",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    questions: [
      {
        q: "點數如何計算？",
        a: "不同功能消耗不同點數：部落格文章 5-20 點、社群圖文 10-50 點、短影音 150-350 點。具體費用請參考「點數錢包」頁面的定價說明。"
      },
      {
        q: "點數會過期嗎？",
        a: "活動點數（PROMO）有效期較短，月費點數（SUB）當月有效，購買點數（PAID）永久有效，獎金點數（BONUS）永久有效且可提領現金。"
      },
      {
        q: "如何購買更多點數？",
        a: "前往「點數錢包」頁面，選擇適合您的點數包或訂閱方案進行購買。我們接受信用卡和多種支付方式。"
      },
      {
        q: "獎金點數如何提領？",
        a: "累積滿 3,000 獎金點數（等值 NT$300）即可申請提領。需完成手機認證和身份認證後，前往「會員資料」申請提領。"
      },
    ]
  },
  {
    id: "ai-generation",
    icon: Zap,
    title: "AI 生成功能",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    questions: [
      {
        q: "生成的內容是否有版權問題？",
        a: "透過 King Jam AI 生成的內容，您擁有完整的使用權。但建議避免使用可能涉及他人智慧財產權的素材作為輸入。"
      },
      {
        q: "如何提升生成品質？",
        a: "提供更詳細的提示詞、選擇適合的風格和品質等級，都能提升生成效果。建議先使用標準品質測試，滿意後再使用高級品質。"
      },
      {
        q: "生成失敗會扣點嗎？",
        a: "如果因系統問題導致生成失敗，點數會自動退還。如果是因為內容違規被系統拒絕，則不會退還。"
      },
    ]
  },
  {
    id: "referral",
    icon: Users,
    title: "推薦獎勵",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    questions: [
      {
        q: "推薦獎勵如何運作？",
        a: "分享您的專屬推薦碼給朋友，當他們註冊並完成首次付費，您將獲得該筆訂單金額 10-20% 的獎金點數（依您的夥伴等級而定）。"
      },
      {
        q: "如何升級夥伴等級？",
        a: "銅牌夥伴升級銀牌需 10 人推薦 + NT$5,000 累積收益；銀牌升金牌需 50 人推薦 + NT$50,000 累積收益。"
      },
      {
        q: "獎金何時發放？",
        a: "被推薦人完成付費後，獎金點數會在 24 小時內自動發放到您的帳戶。"
      },
    ]
  },
  {
    id: "security",
    icon: Shield,
    title: "帳號安全",
    color: "text-rose-400",
    bgColor: "bg-rose-500/10",
    questions: [
      {
        q: "如何啟用雙重認證？",
        a: "前往「會員資料」頁面的安全認證區塊，點擊設定 Authenticator App，使用 Google Authenticator 或 Authy 掃描 QR Code 完成設定。"
      },
      {
        q: "忘記密碼怎麼辦？",
        a: "在登入頁面點擊「忘記密碼」，輸入您的電子郵件，我們會發送密碼重設連結給您。"
      },
      {
        q: "如何變更電子郵件？",
        a: "前往「會員資料」頁面的帳號資訊區塊，點擊變更電子郵件，輸入新郵箱並完成驗證。"
      },
    ]
  },
];

// 快速連結
const quickLinks = [
  { icon: Book, label: "使用手冊", href: "#", color: "text-blue-400" },
  { icon: Video, label: "教學影片", href: "#", color: "text-purple-400" },
  { icon: FileText, label: "API 文件", href: "#", color: "text-green-400" },
  { icon: MessageCircle, label: "社群討論", href: "#", color: "text-amber-400" },
];

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

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-4">
          <HelpCircle className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">幫助中心</h1>
        <p className="text-slate-400">
          找不到答案？瀏覽常見問題或聯繫我們的客服團隊
        </p>
      </div>

      {/* Search */}
      <div className="max-w-xl mx-auto">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <Input
            type="text"
            placeholder="搜尋常見問題..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
        {quickLinks.map((link, idx) => {
          const Icon = link.icon;
          return (
            <a
              key={idx}
              href={link.href}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 hover:bg-slate-800 transition-all group"
            >
              <Icon className={`w-6 h-6 ${link.color} group-hover:scale-110 transition-transform`} />
              <span className="text-sm text-slate-300">{link.label}</span>
            </a>
          );
        })}
      </div>

      {/* FAQ Categories */}
      <div className="max-w-3xl mx-auto space-y-4">
        {filteredCategories.map((category) => {
          const Icon = category.icon;
          const isExpanded = expandedCategory === category.id;
          
          return (
            <div 
              key={category.id}
              className="rounded-xl bg-slate-800/50 border border-slate-700/50 overflow-hidden"
            >
              {/* Category Header */}
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : category.id)}
                className="w-full flex items-center gap-4 p-4 hover:bg-slate-800/80 transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl ${category.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${category.color}`} />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-semibold text-white">{category.title}</h3>
                  <p className="text-sm text-slate-500">{category.questions.length} 個問題</p>
                </div>
                <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
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
                            <p className="text-sm text-slate-400 leading-relaxed">{item.a}</p>
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
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <Mail className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h3 className="font-medium text-white">電子郵件</h3>
                <p className="text-sm text-slate-400">service@kingjam.app</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
            
            <a
              href="#"
              className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-purple-500/50 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="font-medium text-white">線上客服</h3>
                <p className="text-sm text-slate-400">週一至週五 9:00-18:00</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
