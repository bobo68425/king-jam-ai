"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Book, ChevronLeft, ChevronRight, ChevronDown,
  Rocket, PenTool, Image as ImageIcon, Video, Calendar,
  Share2, BarChart3, Crown, Coins, Wallet, Gift,
  Shield, Palette, Settings, User, Bell, History,
  Layers, Search, CheckCircle, ArrowRight, Lightbulb,
  Monitor, Smartphone, Globe, Zap, Star, Clock,
  MousePointer, FileText, HelpCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";

// ============================================================
// 手冊章節資料
// ============================================================

const chapters = [
  {
    id: "overview",
    icon: Rocket,
    title: "平台總覽",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    gradient: "from-purple-500 to-indigo-500",
    sections: [
      {
        title: "King Jam AI 是什麼？",
        content: `King Jam AI 是一站式智慧內容創作平台，專為自媒體創作者、品牌行銷人員和企業團隊打造。

透過先進的 AI 技術，您可以快速生成高品質的部落格文章、社群圖文和短影音，並透過排程功能自動發布到多個社群平台。

**核心價值：**
• 節省 80% 的內容創作時間
• AI 輔助生成，品質媲美專業創作
• 一站式管理多個社群平台
• 數據驅動，持續優化內容策略`,
      },
      {
        title: "系統需求",
        content: `**支援瀏覽器：**
• Google Chrome（建議，最佳體驗）
• Mozilla Firefox
• Apple Safari
• Microsoft Edge

**裝置支援：**
• 桌面電腦：Windows / macOS / Linux
• 平板電腦：iPad / Android 平板
• 手機：iPhone / Android（建議使用桌面版以獲得完整功能）

**網路需求：**
• 穩定的網路連線
• 影片生成建議使用 Wi-Fi 環境`,
      },
      {
        title: "註冊與登入",
        content: `**註冊方式：**
1. Email 註冊：輸入電子郵件和密碼即可
2. Google 快速登入：一鍵使用 Google 帳號
3. Facebook 快速登入：一鍵使用 Facebook 帳號

**註冊福利：**
• 免費獲得 100 點體驗點數
• 自動成為免費版會員
• 取得專屬推薦碼

**登入方式：**
• Email + 密碼登入
• Google 帳號登入
• Facebook 帳號登入`,
      },
      {
        title: "儀表板導覽",
        content: `登入後您會看到儀表板，這是您的工作中心：

**左側選單（四大區塊）：**
1. **總覽** — 儀表板首頁，顯示點數餘額、最近生成、快捷操作
2. **AI 生成引擎** — 部落格文章、社群圖文、短影音生成、圖片編輯室
3. **發布管理** — 排程上架、社群帳號、成效洞察
4. **會員中心** — 會員資料、通知中心、身份認證、訂閱管理、點數錢包、購買點數、推薦獎勵、生成紀錄、帳號設定、品牌資產包

**頂部導覽列：**
• 點數餘額顯示
• 通知圖示
• 個人選單（快速前往會員資料、帳號設定、登出）`,
      },
    ],
  },
  {
    id: "ai-engine",
    icon: Zap,
    title: "AI 生成引擎",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    gradient: "from-blue-500 to-cyan-500",
    sections: [
      {
        title: "部落格文章",
        content: `**功能路徑：** AI 生成引擎 → 部落格文章

**操作步驟：**
1. 點擊「新增文章」
2. 輸入文章主題或關鍵字
3. 選擇文章風格（專業、輕鬆、教學、新聞等）
4. 選擇文章長度（短文 300 字 / 中文 800 字 / 長文 1500+ 字）
5. 點擊「生成」，等待 AI 完成
6. 檢視並編輯生成結果
7. 發布或排程發布

**點數消耗：** 5-20 點（依文章長度）

**技巧：**
• 提供具體的主題和目標受眾，品質更好
• 使用品牌資產包中的語調設定，風格更一致
• 可以對生成結果進行多次修改和重新生成`,
      },
      {
        title: "社群圖文",
        content: `**功能路徑：** AI 生成引擎 → 社群圖文

**操作步驟：**
1. 描述您想要的圖文內容
2. 選擇目標平台（Facebook / Instagram / LINE 等）
3. 選擇風格（簡約、活潑、專業、文青等）
4. 點擊「生成」
5. AI 會同時生成圖片和搭配文案
6. 下載圖片或直接發布

**點數消耗：** 10-50 點（依品質等級）

**尺寸自動適配：**
• Facebook 貼文：1200 x 630
• Instagram 貼文：1080 x 1080
• Instagram 限動：1080 x 1920
• LINE 圖片訊息：依規格自動調整`,
      },
      {
        title: "短影音生成",
        content: `**功能路徑：** AI 生成引擎 → 短影音生成
**方案需求：** 入門版以上

**操作步驟：**
1. 輸入影片主題或腳本
2. 選擇影片風格和時長
3. 可上傳素材或使用 AI 生成素材
4. 點擊「生成」
5. 等待渲染完成（通常 1-5 分鐘）
6. 預覽、下載或直接發布

**點數消耗：** 150-350 點

**支援格式：**
• MP4 格式
• 直式（9:16）適用 Reels / Shorts / TikTok
• 橫式（16:9）適用 YouTube
• 正方形（1:1）適用 Facebook / Instagram`,
      },
      {
        title: "圖片編輯室（PRO）",
        content: `**功能路徑：** AI 生成引擎 → 圖片編輯室
**方案需求：** 專業版以上

**功能特色：**
• AI 智慧修圖：自動調整亮度、對比、色彩
• 背景移除：一鍵去背
• 風格轉換：將照片轉為插畫、油畫、水彩等風格
• 文字添加：在圖片上添加文字和浮水印
• 裁切調整：快速裁切為各平台適用尺寸

**使用技巧：**
• 上傳高解析度原圖效果更好
• 去背功能對人物主體效果最佳
• 可與社群圖文功能搭配使用`,
      },
    ],
  },
  {
    id: "publishing",
    icon: Calendar,
    title: "發布管理",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    gradient: "from-emerald-500 to-green-500",
    sections: [
      {
        title: "連接社群帳號",
        content: `**功能路徑：** 發布管理 → 社群帳號

**連接步驟：**
1. 點擊「連接新帳號」
2. 選擇平台（Facebook / Instagram / YouTube 等）
3. 系統跳轉至該平台的授權頁面
4. 登入並允許 King Jam AI 存取
5. 授權完成後自動返回

**注意事項：**
• Facebook 需要管理員權限才能連接粉專
• Instagram 需先轉換為商業帳號或創作者帳號
• 授權不會影響您的帳號安全，您可隨時解除連接
• 不同方案支援不同數量的帳號連接`,
      },
      {
        title: "排程上架",
        content: `**功能路徑：** 發布管理 → 排程上架
**方案需求：** 專業版以上

**操作步驟：**
1. 選擇已生成的內容（文章、圖文或影片）
2. 選擇要發布的平台和帳號
3. 設定發布日期和時間
4. 確認預覽
5. 點擊「排程」

**功能特色：**
• 日曆視圖：直觀查看所有排程
• 批次排程：一次設定多則貼文
• 最佳時段建議：AI 分析您的受眾活躍時段
• 排程修改：隨時編輯或取消已排程的內容`,
      },
      {
        title: "成效洞察",
        content: `**功能路徑：** 發布管理 → 成效洞察

**數據指標：**
• 觸及率：內容被看到的次數
• 互動率：按讚、留言、分享的比例
• 點擊率：連結被點擊的比例
• 粉絲增長：追蹤者數量變化
• 最佳貼文：表現最好的內容排名

**分析維度：**
• 按平台分析
• 按內容類型分析（文章 / 圖文 / 影片）
• 按時間範圍分析（7天 / 30天 / 自訂）
• 趨勢圖表

**應用建議：**
• 定期查看哪類內容最受歡迎
• 根據最佳時段調整發布排程
• 分析互動模式，優化內容策略`,
      },
    ],
  },
  {
    id: "member",
    icon: User,
    title: "會員中心",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    gradient: "from-amber-500 to-orange-500",
    sections: [
      {
        title: "身份認證",
        content: `**功能路徑：** 會員中心 → 身份認證

身份認證是提領獎金點數的必要條件。

**認證步驟：**
1. 手機號碼驗證：輸入手機號碼，接收並輸入驗證碼
2. 填寫真實姓名
3. 填寫身分證字號

**認證須知：**
• 所有資料經加密處理，僅用於身份核實
• 認證完成後即可使用獎金提領功能
• 每個帳號只能認證一次，請確保資料正確`,
      },
      {
        title: "訂閱管理",
        content: `**功能路徑：** 會員中心 → 訂閱管理

**頁面功能：**
• 查看目前訂閱方案和到期日
• 瀏覽所有方案比較
• 直接升級（彈出結帳對話框，支援月繳/年繳切換）
• 降級至免費版
• 查看訂閱付款紀錄

**升級流程：**
1. 選擇想要的方案，點擊「立即訂閱」
2. 在結帳對話框中選擇月繳或年繳
3. 確認金額後點擊「前往付款」
4. 完成付款後立即生效`,
      },
      {
        title: "點數錢包",
        content: `**功能路徑：** 會員中心 → 點數錢包

**頁面功能：**
• 查看各類點數餘額（PROMO / SUB / PAID / BONUS）
• 查看點數使用歷史
• 點數消耗明細
• 點數到期提醒

**點數使用順序：**
系統會優先扣除即將到期的點數：
1. 活動點數（PROMO）— 最先使用
2. 月費點數（SUB）— 當月有效
3. 購買點數（PAID）— 永久有效
4. 獎金點數（BONUS）— 永久有效`,
      },
      {
        title: "購買點數",
        content: `**功能路徑：** 會員中心 → 購買點數

提供多種點數套餐，依需求選購：

**購買步驟：**
1. 選擇點數套餐
2. 點擊「立即購買」
3. 確認訂單金額
4. 選擇付款方式（信用卡 / ATM / 超商）
5. 完成付款，點數即時入帳

**付款安全：**
• 由綠界科技（ECPay）處理，安全有保障
• 支援 Visa / MasterCard / JCB 信用卡
• 支援 ATM 轉帳和超商代碼繳費`,
      },
      {
        title: "推薦獎勵",
        content: `**功能路徑：** 會員中心 → 推薦獎勵

**推薦方式：**
• 複製推薦碼分享給朋友
• 使用推薦連結直接分享

**獎勵機制：**
• 被推薦人首次付費 → 您獲得訂單金額 10-20% 獎金點數
• 獎金比例依夥伴等級而定
• 銅牌 10% → 銀牌 15% → 金牌 20%

**夥伴等級升級條件：**
• 銀牌：推薦 10 人 + 累積收益 NT$5,000
• 金牌：推薦 50 人 + 累積收益 NT$50,000

**獎金提領：**
• 累積滿 3,000 獎金點數可提領
• 需完成身份認證
• 審核約 3-5 個工作天`,
      },
      {
        title: "品牌資產包",
        content: `**功能路徑：** 會員中心 → 品牌資產包

**可設定項目：**
• 品牌 Logo 上傳
• 品牌主色 / 輔色設定
• 品牌語調（專業、親切、活潑、文青等）
• 常用關鍵字和標籤
• 品牌簡介和核心價值
• 目標受眾描述

**使用效果：**
• AI 生成內容時自動套用品牌風格
• 確保所有內容風格一致
• 減少每次生成時重複設定的時間

**注意：** 企業版支援多個品牌資產包`,
      },
    ],
  },
];

// ============================================================
// 元件
// ============================================================

export default function ManualPage() {
  const [activeChapter, setActiveChapter] = useState(chapters[0].id);
  const [activeSection, setActiveSection] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const currentChapter = chapters.find(c => c.id === activeChapter) || chapters[0];
  const currentSection = currentChapter.sections[activeSection];

  // 搜尋
  const searchResults = searchQuery
    ? chapters.flatMap(ch =>
        ch.sections
          .filter(s =>
            s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.content.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .map(s => ({ chapter: ch, section: s, sectionIndex: ch.sections.indexOf(s) }))
      )
    : [];

  const navigateToSection = (chapterId: string, sectionIndex: number) => {
    setActiveChapter(chapterId);
    setActiveSection(sectionIndex);
    setSearchQuery("");
  };

  // 上一節 / 下一節
  const goNext = () => {
    if (activeSection < currentChapter.sections.length - 1) {
      setActiveSection(activeSection + 1);
    } else {
      const idx = chapters.findIndex(c => c.id === activeChapter);
      if (idx < chapters.length - 1) {
        setActiveChapter(chapters[idx + 1].id);
        setActiveSection(0);
      }
    }
  };

  const goPrev = () => {
    if (activeSection > 0) {
      setActiveSection(activeSection - 1);
    } else {
      const idx = chapters.findIndex(c => c.id === activeChapter);
      if (idx > 0) {
        const prevChapter = chapters[idx - 1];
        setActiveChapter(prevChapter.id);
        setActiveSection(prevChapter.sections.length - 1);
      }
    }
  };

  const isFirst = activeChapter === chapters[0].id && activeSection === 0;
  const isLast = activeChapter === chapters[chapters.length - 1].id &&
    activeSection === currentChapter.sections.length - 1;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/help"
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          幫助中心
        </Link>
        <div className="flex-1" />
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
          <Book className="w-4 h-4 text-indigo-400" />
          <span className="text-sm text-indigo-300 font-medium">使用手冊</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          type="text"
          placeholder="搜尋手冊內容..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 rounded-lg"
        />
        {searchQuery && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-20 max-h-64 overflow-y-auto">
            {searchResults.map((r, i) => (
              <button
                key={i}
                onClick={() => navigateToSection(r.chapter.id, r.sectionIndex)}
                className="w-full text-left px-4 py-3 hover:bg-slate-700/50 transition-colors border-b border-slate-700/50 last:border-0"
              >
                <p className="text-sm text-white">{r.section.title}</p>
                <p className="text-xs text-slate-500">{r.chapter.title}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-6">
        {/* Sidebar - 章節目錄 */}
        <div className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-6 space-y-2">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-3">目錄</h3>
            {chapters.map((ch) => {
              const Icon = ch.icon;
              const isActive = ch.id === activeChapter;
              return (
                <div key={ch.id}>
                  <button
                    onClick={() => { setActiveChapter(ch.id); setActiveSection(0); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      isActive ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? ch.color : ""}`} />
                    <span className="text-sm font-medium">{ch.title}</span>
                  </button>
                  {isActive && (
                    <div className="ml-7 mt-1 space-y-0.5">
                      {ch.sections.map((sec, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveSection(idx)}
                          className={`w-full text-left px-3 py-1.5 text-xs rounded transition-colors ${
                            idx === activeSection
                              ? "text-indigo-400 bg-indigo-500/10"
                              : "text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          {sec.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Mobile Chapter Selector */}
          <div className="lg:hidden mb-4">
            <select
              value={activeChapter}
              onChange={(e) => { setActiveChapter(e.target.value); setActiveSection(0); }}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
            >
              {chapters.map(ch => (
                <option key={ch.id} value={ch.id}>{ch.title}</option>
              ))}
            </select>
          </div>

          {/* Chapter Title */}
          <div className="flex items-center gap-3 mb-6">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${currentChapter.gradient} flex items-center justify-center`}>
              <currentChapter.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{currentSection.title}</h1>
              <p className="text-sm text-slate-500">{currentChapter.title} · {activeSection + 1} / {currentChapter.sections.length}</p>
            </div>
          </div>

          {/* Content */}
          <div className="prose prose-invert max-w-none">
            <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-6 md:p-8">
              {currentSection.content.split("\n").map((line, i) => {
                if (line.startsWith("**") && line.endsWith("**")) {
                  return <h3 key={i} className="text-lg font-semibold text-white mt-6 mb-3 first:mt-0">{line.replace(/\*\*/g, "")}</h3>;
                }
                if (line.startsWith("**") && line.includes("**")) {
                  const parts = line.split("**");
                  return (
                    <p key={i} className="text-slate-300 mb-2">
                      {parts.map((part, j) =>
                        j % 2 === 1
                          ? <strong key={j} className="text-white font-semibold">{part}</strong>
                          : <span key={j}>{part}</span>
                      )}
                    </p>
                  );
                }
                if (line.startsWith("• ")) {
                  return (
                    <div key={i} className="flex items-start gap-2 ml-2 mb-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      <span className="text-sm text-slate-300">{line.substring(2)}</span>
                    </div>
                  );
                }
                if (/^\d+\.\s/.test(line)) {
                  const num = line.match(/^(\d+)\./)?.[1];
                  const text = line.replace(/^\d+\.\s*/, "");
                  return (
                    <div key={i} className="flex items-start gap-3 ml-2 mb-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center shrink-0 mt-0.5 font-semibold">{num}</span>
                      <span className="text-sm text-slate-300">{text}</span>
                    </div>
                  );
                }
                if (line.trim() === "") {
                  return <div key={i} className="h-3" />;
                }
                return <p key={i} className="text-slate-300 text-sm leading-relaxed mb-2">{line}</p>;
              })}
            </div>
          </div>

          {/* Section Tabs (Mobile) */}
          <div className="lg:hidden mt-4 flex gap-2 overflow-x-auto pb-2">
            {currentChapter.sections.map((sec, idx) => (
              <button
                key={idx}
                onClick={() => setActiveSection(idx)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  idx === activeSection
                    ? "bg-indigo-500/20 text-indigo-400"
                    : "bg-slate-800/50 text-slate-500 hover:text-white"
                }`}
              >
                {sec.title}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={goPrev}
              disabled={isFirst}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                isFirst ? "text-slate-600 cursor-not-allowed" : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              上一節
            </button>
            <span className="text-xs text-slate-600">
              {chapters.findIndex(c => c.id === activeChapter) + 1} / {chapters.length} 章
            </span>
            <button
              onClick={goNext}
              disabled={isLast}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                isLast ? "text-slate-600 cursor-not-allowed" : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              下一節
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
