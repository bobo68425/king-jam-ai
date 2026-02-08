"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft, MessageCircle, Users, Heart,
  Star, Sparkles, ExternalLink, Crown,
  Lightbulb, BookOpen, Megaphone, Gift,
  ArrowRight, CheckCircle, Clock, MessageSquare,
  ThumbsUp, Share2, Flame, TrendingUp
} from "lucide-react";

// ============================================================
// 社群頻道資料
// ============================================================

const communityChannels = [
  {
    id: "facebook-group",
    platform: "Facebook",
    name: "King Jam AI 創作者社群",
    description: "最活躍的中文 AI 創作社群！分享創作心得、提問交流、獲取最新消息。",
    members: "2,580+",
    url: "#",
    icon: Users,
    color: "from-blue-500 to-blue-600",
    badge: "最活躍",
    features: [
      "每日創作分享",
      "新手提問專區",
      "官方公告與更新",
      "會員專屬活動",
    ],
  },
  {
    id: "line-group",
    platform: "LINE 社群",
    name: "King Jam AI 交流群",
    description: "即時交流、快速提問，和其他創作者一起成長。",
    members: "1,200+",
    url: "#",
    icon: MessageCircle,
    color: "from-green-500 to-emerald-600",
    badge: "即時交流",
    features: [
      "即時問答",
      "功能更新通知",
      "創作靈感分享",
      "限時優惠資訊",
    ],
  },
  {
    id: "discord",
    platform: "Discord",
    name: "King Jam AI Server",
    description: "分類頻道、語音交流，適合深度討論和技術交流。",
    members: "890+",
    url: "#",
    icon: MessageSquare,
    color: "from-indigo-500 to-purple-600",
    badge: "深度交流",
    features: [
      "分類頻道討論",
      "語音交流室",
      "教學資源分享",
      "Bug 回報專區",
    ],
  },
];

// 熱門討論話題
const hotTopics = [
  {
    title: "如何寫出讓 AI 生成高品質文章的提示詞？",
    author: "陳小明",
    replies: 42,
    likes: 128,
    category: "技巧分享",
    hot: true,
  },
  {
    title: "專業版 vs 企業版，怎麼選？看完這篇就懂了",
    author: "王美玲",
    replies: 35,
    likes: 96,
    category: "方案討論",
    hot: true,
  },
  {
    title: "用 King Jam AI 一週產出 30 篇貼文的工作流程分享",
    author: "李志豪",
    replies: 28,
    likes: 87,
    category: "經驗分享",
    hot: false,
  },
  {
    title: "短影音生成實測：從腳本到成品只要 5 分鐘",
    author: "張雅琪",
    replies: 23,
    likes: 74,
    category: "功能實測",
    hot: false,
  },
  {
    title: "品牌資產包設定技巧，讓每次生成都像量身訂做",
    author: "林大偉",
    replies: 19,
    likes: 65,
    category: "技巧分享",
    hot: false,
  },
  {
    title: "推薦獎勵月入 NT$5,000 的秘訣",
    author: "黃小芳",
    replies: 31,
    likes: 112,
    category: "推薦計畫",
    hot: true,
  },
];

const categoryColors: Record<string, string> = {
  "技巧分享": "bg-blue-500/20 text-blue-400",
  "方案討論": "bg-amber-500/20 text-amber-400",
  "經驗分享": "bg-purple-500/20 text-purple-400",
  "功能實測": "bg-emerald-500/20 text-emerald-400",
  "推薦計畫": "bg-pink-500/20 text-pink-400",
};

// 社群活動
const events = [
  {
    title: "每月創作挑戰",
    description: "每月設定主題，用 AI 創作參賽。優勝者可獲得 1,000 免費點數！",
    icon: Flame,
    status: "進行中",
    statusColor: "text-emerald-400",
  },
  {
    title: "創作者專訪",
    description: "邀請優秀創作者分享使用心得和工作流程，每月兩次直播。",
    icon: Star,
    status: "每月舉辦",
    statusColor: "text-amber-400",
  },
  {
    title: "新功能搶先體驗",
    description: "社群成員優先體驗新功能，提供寶貴回饋幫助我們改進。",
    icon: Sparkles,
    status: "不定期",
    statusColor: "text-purple-400",
  },
];

// ============================================================
// 元件
// ============================================================

export default function CommunityPage() {
  return (
    <div className="space-y-8 pb-8">
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
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Users className="w-4 h-4 text-amber-400" />
          <span className="text-sm text-amber-300 font-medium">社群討論</span>
        </div>
      </div>

      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 mb-4 shadow-lg shadow-amber-500/25">
          <Users className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">加入創作者社群</h1>
        <p className="text-slate-400">
          與數千名 AI 創作者交流心得、分享技巧、一起成長
        </p>
      </div>

      {/* Community Channels */}
      <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        {communityChannels.map((channel) => {
          const Icon = channel.icon;
          return (
            <div
              key={channel.id}
              className="rounded-xl bg-slate-800/50 border border-slate-700/50 overflow-hidden hover:border-slate-600 transition-all group"
            >
              {/* Header */}
              <div className={`p-6 bg-gradient-to-br ${channel.color} relative`}>
                <div className="absolute top-3 right-3">
                  <span className="px-2 py-1 bg-white/20 backdrop-blur-sm rounded text-xs text-white font-medium">
                    {channel.badge}
                  </span>
                </div>
                <Icon className="w-10 h-10 text-white mb-3" />
                <h3 className="text-lg font-bold text-white">{channel.name}</h3>
                <p className="text-white/70 text-sm mt-1">{channel.platform}</p>
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                <p className="text-sm text-slate-400">{channel.description}</p>

                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Users className="w-4 h-4" />
                  <span>{channel.members} 成員</span>
                </div>

                <div className="space-y-1.5">
                  {channel.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs text-slate-400">{f}</span>
                    </div>
                  ))}
                </div>

                <a
                  href={channel.url}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-white text-sm font-medium transition-colors mt-2"
                >
                  加入社群
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hot Topics */}
      <div className="max-w-3xl mx-auto">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-orange-400" />
          熱門討論話題
        </h2>
        <div className="space-y-3">
          {hotTopics.map((topic, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1 shrink-0 w-10">
                  <ThumbsUp className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-400">{topic.likes}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {topic.hot && (
                      <Flame className="w-3.5 h-3.5 text-orange-400" />
                    )}
                    <h3 className="text-sm font-medium text-white truncate">{topic.title}</h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className={`px-2 py-0.5 rounded ${categoryColors[topic.category] || "bg-slate-700 text-slate-400"}`}>
                      {topic.category}
                    </span>
                    <span>{topic.author}</span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />
                      {topic.replies} 則回覆
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Events */}
      <div className="max-w-3xl mx-auto">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-purple-400" />
          社群活動
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {events.map((event, idx) => {
            const Icon = event.icon;
            return (
              <div key={idx} className="p-5 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{event.title}</h3>
                    <span className={`text-xs ${event.statusColor}`}>{event.status}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{event.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Community Guidelines */}
      <div className="max-w-3xl mx-auto">
        <div className="rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            社群守則
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-emerald-400">我們歡迎</h3>
              <div className="space-y-2">
                {[
                  "分享 AI 創作心得和成果",
                  "提出功能建議和改進意見",
                  "互相幫助解答問題",
                  "分享有價值的行銷知識",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-sm text-slate-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-red-400">請勿</h3>
              <div className="space-y-2">
                {[
                  "發布廣告或垃圾訊息",
                  "攻擊或騷擾其他成員",
                  "分享違反著作權的內容",
                  "洩露他人個人資訊",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                      <span className="text-red-400 text-xs font-bold">✕</span>
                    </span>
                    <span className="text-sm text-slate-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
