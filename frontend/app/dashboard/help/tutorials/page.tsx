"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft, Play, Clock, Eye, Star,
  Rocket, PenTool, Image as ImageIcon, Video,
  Calendar, Crown, Coins, Gift, Shield, Palette,
  Search, Filter, CheckCircle, BookOpen, Sparkles,
  BarChart3
} from "lucide-react";
import { Input } from "@/components/ui/input";

// ============================================================
// 教學影片資料
// ============================================================

const videoCategories = [
  { id: "all", label: "全部", icon: Sparkles },
  { id: "getting-started", label: "快速入門", icon: Rocket },
  { id: "ai-content", label: "AI 生成", icon: PenTool },
  { id: "publishing", label: "發布管理", icon: Calendar },
  { id: "billing", label: "訂閱付費", icon: Crown },
  { id: "advanced", label: "進階技巧", icon: Star },
];

const tutorials = [
  // 快速入門
  {
    id: "v1",
    category: "getting-started",
    title: "3 分鐘認識 King Jam AI",
    description: "快速了解平台核心功能與操作介面，帶您從零開始上手。",
    duration: "3:00",
    views: 12580,
    level: "入門",
    thumbnail: "from-purple-600 to-indigo-600",
    icon: Rocket,
    steps: [
      "註冊帳號並登入平台",
      "認識儀表板四大功能區塊",
      "使用免費 100 點體驗 AI 生成",
      "查看生成紀錄和點數餘額",
    ],
  },
  {
    id: "v2",
    category: "getting-started",
    title: "帳號設定與個人化",
    description: "設定會員資料、品牌資產包，讓 AI 更了解您的需求。",
    duration: "4:30",
    views: 8920,
    level: "入門",
    thumbnail: "from-blue-600 to-cyan-600",
    icon: Shield,
    steps: [
      "完善會員資料",
      "設定品牌資產包（Logo、色系、語調）",
      "連接社群帳號",
      "完成身份認證（解鎖提領功能）",
    ],
  },
  // AI 生成
  {
    id: "v3",
    category: "ai-content",
    title: "AI 部落格文章生成完整教學",
    description: "從選題到生成，教您如何用 AI 快速產出高品質部落格文章。",
    duration: "6:15",
    views: 15340,
    level: "入門",
    thumbnail: "from-blue-500 to-indigo-600",
    icon: PenTool,
    steps: [
      "選擇文章主題和風格",
      "撰寫高品質提示詞",
      "調整生成設定（長度、語調）",
      "編輯和潤飾 AI 生成結果",
      "發布或排程發布",
    ],
  },
  {
    id: "v4",
    category: "ai-content",
    title: "社群圖文設計一次學會",
    description: "教您用 AI 生成適合各平台的圖文內容，從 Facebook 到 Instagram。",
    duration: "5:45",
    views: 11200,
    level: "入門",
    thumbnail: "from-pink-500 to-purple-600",
    icon: ImageIcon,
    steps: [
      "描述圖文內容需求",
      "選擇目標平台和尺寸",
      "AI 生成圖片 + 文案",
      "微調和下載",
      "一鍵發布到社群平台",
    ],
  },
  {
    id: "v5",
    category: "ai-content",
    title: "短影音生成入門教學",
    description: "從腳本到成品，教您用 AI 製作吸睛的短影音內容。",
    duration: "8:20",
    views: 9870,
    level: "中級",
    thumbnail: "from-orange-500 to-red-600",
    icon: Video,
    steps: [
      "準備影片主題和腳本",
      "選擇影片風格和格式",
      "上傳素材或使用 AI 素材",
      "等待渲染完成",
      "預覽、編輯和發布",
    ],
  },
  {
    id: "v6",
    category: "ai-content",
    title: "圖片編輯室進階功能",
    description: "PRO 專屬功能：AI 修圖、去背、風格轉換全面解析。",
    duration: "7:00",
    views: 6540,
    level: "進階",
    thumbnail: "from-cyan-500 to-blue-600",
    icon: Palette,
    steps: [
      "上傳圖片到編輯室",
      "使用 AI 智慧修圖",
      "一鍵背景移除",
      "風格轉換（插畫、油畫等）",
      "添加文字和浮水印",
    ],
  },
  // 發布管理
  {
    id: "v7",
    category: "publishing",
    title: "排程發布完整攻略",
    description: "教您設定自動排程，讓內容在最佳時段自動發布。",
    duration: "5:00",
    views: 7650,
    level: "中級",
    thumbnail: "from-emerald-500 to-green-600",
    icon: Calendar,
    steps: [
      "連接社群帳號",
      "選擇要排程的內容",
      "設定發布日期和時間",
      "使用日曆視圖管理排程",
      "查看發布狀態和結果",
    ],
  },
  {
    id: "v8",
    category: "publishing",
    title: "成效洞察數據解讀",
    description: "學會看懂數據報表，用數據驅動內容策略優化。",
    duration: "6:30",
    views: 5430,
    level: "中級",
    thumbnail: "from-teal-500 to-emerald-600",
    icon: BarChart3,
    steps: [
      "認識主要數據指標",
      "分析不同平台表現",
      "找出最佳發布時段",
      "優化內容策略",
    ],
  },
  // 訂閱付費
  {
    id: "v9",
    category: "billing",
    title: "訂閱方案與購買點數指南",
    description: "了解四種方案差異，選擇最適合您的付費方式。",
    duration: "4:00",
    views: 10230,
    level: "入門",
    thumbnail: "from-amber-500 to-orange-600",
    icon: Crown,
    steps: [
      "比較免費版 / 入門版 / 專業版 / 企業版",
      "了解月繳 vs 年繳（省 20%）",
      "購買點數套餐",
      "管理訂閱和付款紀錄",
    ],
  },
  {
    id: "v10",
    category: "billing",
    title: "推薦獎勵賺取教學",
    description: "教您如何善用推薦計畫，邀請朋友一起使用並賺取獎金。",
    duration: "3:30",
    views: 8760,
    level: "入門",
    thumbnail: "from-pink-500 to-rose-600",
    icon: Gift,
    steps: [
      "取得專屬推薦碼和連結",
      "分享推薦連結",
      "查看推薦紀錄和獎金",
      "升級夥伴等級提高獎金比例",
      "獎金點數提領為現金",
    ],
  },
  // 進階技巧
  {
    id: "v11",
    category: "advanced",
    title: "提示詞撰寫高階技巧",
    description: "學會寫出優質提示詞，讓 AI 生成品質提升 200%。",
    duration: "10:00",
    views: 13400,
    level: "進階",
    thumbnail: "from-violet-500 to-purple-600",
    icon: Sparkles,
    steps: [
      "提示詞結構：角色 + 任務 + 條件 + 格式",
      "指定目標受眾和語調",
      "使用範例引導 AI",
      "迭代優化技巧",
      "常見錯誤和修正方法",
    ],
  },
  {
    id: "v12",
    category: "advanced",
    title: "品牌一致性內容策略",
    description: "運用品牌資產包 + AI 生成，打造一致的品牌內容體系。",
    duration: "7:30",
    views: 4980,
    level: "進階",
    thumbnail: "from-indigo-500 to-blue-600",
    icon: Palette,
    steps: [
      "設定完整的品牌資產包",
      "定義品牌內容策略",
      "批次生成系列內容",
      "跨平台內容適配",
      "用成效洞察持續優化",
    ],
  },
];

const levelColors: Record<string, string> = {
  "入門": "bg-green-500/20 text-green-400",
  "中級": "bg-amber-500/20 text-amber-400",
  "進階": "bg-purple-500/20 text-purple-400",
};

// ============================================================
// 元件
// ============================================================

export default function TutorialsPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null);

  const filtered = tutorials.filter(v => {
    const matchCat = activeCategory === "all" || v.category === activeCategory;
    const matchSearch = !searchQuery ||
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

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
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
          <Video className="w-4 h-4 text-purple-400" />
          <span className="text-sm text-purple-300 font-medium">教學影片</span>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-white mb-2">教學影片</h1>
        <p className="text-slate-400">
          {tutorials.length} 部教學影片，從入門到進階帶您精通平台所有功能
        </p>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            type="text"
            placeholder="搜尋教學影片..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 rounded-lg"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {videoCategories.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ${
                activeCategory === cat.id
                  ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                  : "bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:text-white hover:border-slate-600"
              }`}
            >
              <Icon className="w-4 h-4" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((video) => {
          const Icon = video.icon;
          const isExpanded = expandedVideo === video.id;

          return (
            <div
              key={video.id}
              className="rounded-xl bg-slate-800/50 border border-slate-700/50 overflow-hidden hover:border-slate-600 transition-all"
            >
              {/* Thumbnail */}
              <div className={`relative h-40 bg-gradient-to-br ${video.thumbnail} flex items-center justify-center`}>
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:bg-white/30 transition-colors">
                  <Play className="w-8 h-8 text-white ml-1" />
                </div>
                <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/60 rounded text-xs text-white font-mono">
                  {video.duration}
                </div>
                <div className="absolute top-3 left-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${levelColors[video.level]}`}>
                    {video.level}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white text-sm mb-1">{video.title}</h3>
                    <p className="text-xs text-slate-400 mb-2 line-clamp-2">{video.description}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {video.duration}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {video.views.toLocaleString()} 觀看
                      </span>
                    </div>
                  </div>
                </div>

                {/* Steps toggle */}
                <button
                  onClick={() => setExpandedVideo(isExpanded ? null : video.id)}
                  className="w-full mt-3 flex items-center justify-center gap-1 py-2 text-xs text-slate-500 hover:text-indigo-400 transition-colors border-t border-slate-700/50"
                >
                  <BookOpen className="w-3 h-3" />
                  {isExpanded ? "收起內容大綱" : "查看內容大綱"}
                </button>

                {isExpanded && (
                  <div className="mt-2 space-y-1.5">
                    {video.steps.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                        <span className="text-xs text-slate-400">{step}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Video className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">找不到符合條件的教學影片</p>
          <p className="text-slate-500 text-sm mt-1">試試其他分類或關鍵字</p>
        </div>
      )}

      {/* Coming Soon Note */}
      <div className="max-w-2xl mx-auto text-center p-6 rounded-xl bg-slate-800/30 border border-slate-700/30">
        <Sparkles className="w-6 h-6 text-purple-400 mx-auto mb-2" />
        <p className="text-sm text-slate-400">
          更多教學影片持續製作中，敬請期待！
          <br />
          有想看的教學主題？歡迎來信
          <a href="mailto:service@kingjam.app" className="text-indigo-400 hover:text-indigo-300 ml-1">service@kingjam.app</a>
          告訴我們
        </p>
      </div>
    </div>
  );
}
