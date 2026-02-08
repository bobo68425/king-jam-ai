"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft, Code, Copy, CheckCircle, Search,
  Key, Globe, Shield, Zap, FileText, Terminal,
  ChevronDown, ChevronRight, Lock, AlertTriangle,
  ExternalLink, BookOpen
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// ============================================================
// API 文件資料
// ============================================================

const apiSections = [
  {
    id: "overview",
    title: "概述",
    icon: BookOpen,
    content: `King Jam AI 提供 RESTful API，讓企業版用戶可以透過程式化方式存取 AI 生成功能。

**基本資訊：**
• Base URL：\`https://api.kingjam.app\`
• 認證方式：Bearer Token
• 回應格式：JSON
• 速率限制：100 次/分鐘（企業版）`,
  },
  {
    id: "auth",
    title: "認證",
    icon: Key,
    content: `所有 API 請求需在 Header 中攜帶 Bearer Token。

**取得 Token：**
使用 Email 和密碼向 /auth/login 端點請求 Token。

**Token 有效期：**
• Access Token：24 小時
• 過期後需重新登入取得新 Token`,
  },
];

const apiEndpoints = [
  {
    id: "auth-login",
    category: "認證",
    method: "POST",
    path: "/auth/login",
    description: "用戶登入，取得 JWT Token",
    requiresAuth: false,
    requestBody: `{
  "email": "user@example.com",
  "password": "your_password"
}`,
    responseBody: `{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "full_name": "王小明",
    "tier": "enterprise"
  }
}`,
  },
  {
    id: "credits-balance",
    category: "點數",
    method: "GET",
    path: "/credits/balance",
    description: "查詢點數餘額",
    requiresAuth: true,
    requestBody: null,
    responseBody: `{
  "total": 5280,
  "breakdown": {
    "promo": 0,
    "sub": 1000,
    "paid": 3780,
    "bonus": 500
  },
  "tier": "pro",
  "subscription_expires_at": "2026-03-08T00:00:00Z"
}`,
  },
  {
    id: "blog-generate",
    category: "AI 生成",
    method: "POST",
    path: "/blog/generate",
    description: "AI 生成部落格文章",
    requiresAuth: true,
    requestBody: `{
  "topic": "2026 年 AI 行銷趨勢",
  "style": "professional",
  "length": "medium",
  "language": "zh-TW",
  "keywords": ["AI", "行銷", "趨勢"]
}`,
    responseBody: `{
  "success": true,
  "article": {
    "title": "2026 年 AI 行銷趨勢：5 大關鍵策略",
    "content": "...(文章內容)...",
    "word_count": 850,
    "seo_description": "..."
  },
  "credits_used": 10
}`,
  },
  {
    id: "social-generate",
    category: "AI 生成",
    method: "POST",
    path: "/social/generate",
    description: "AI 生成社群圖文",
    requiresAuth: true,
    requestBody: `{
  "prompt": "咖啡店新品上市推廣貼文",
  "platform": "instagram",
  "style": "modern",
  "include_image": true
}`,
    responseBody: `{
  "success": true,
  "post": {
    "caption": "...(文案內容)...",
    "image_url": "https://...",
    "hashtags": ["#咖啡", "#新品上市", "..."]
  },
  "credits_used": 25
}`,
  },
  {
    id: "payment-products",
    category: "產品",
    method: "GET",
    path: "/payment/products",
    description: "取得所有可購買的產品列表",
    requiresAuth: false,
    requestBody: null,
    responseBody: `{
  "success": true,
  "credit_packages": [
    {
      "code": "starter",
      "name": "入門包",
      "price": 150,
      "credits_amount": 500,
      "bonus_credits": 50
    }
  ],
  "subscription_plans": [
    {
      "code": "pro",
      "name": "專業版",
      "price": 699,
      "monthly_credits": 1000,
      "price_yearly": 6710
    }
  ]
}`,
  },
  {
    id: "history-list",
    category: "紀錄",
    method: "GET",
    path: "/history?limit=20&offset=0",
    description: "查詢生成紀錄",
    requiresAuth: true,
    requestBody: null,
    responseBody: `{
  "items": [
    {
      "id": 123,
      "type": "blog",
      "title": "AI 行銷趨勢",
      "credits_used": 10,
      "created_at": "2026-02-08T12:00:00Z"
    }
  ],
  "total": 45
}`,
  },
];

const methodColors: Record<string, string> = {
  GET: "bg-emerald-500/20 text-emerald-400",
  POST: "bg-blue-500/20 text-blue-400",
  PUT: "bg-amber-500/20 text-amber-400",
  DELETE: "bg-red-500/20 text-red-400",
};

// ============================================================
// 元件
// ============================================================

export default function APIDocsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("已複製到剪貼簿");
  };

  const filteredEndpoints = apiEndpoints.filter(ep =>
    !searchQuery ||
    ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ep.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ep.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = [...new Set(filteredEndpoints.map(ep => ep.category))];

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
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
          <Code className="w-4 h-4 text-green-400" />
          <span className="text-sm text-green-300 font-medium">API 文件</span>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-white mb-2">API 文件</h1>
        <p className="text-slate-400">
          企業版專屬功能 — 透過 API 整合 King Jam AI 到您的工作流程
        </p>
      </div>

      {/* Plan Notice */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 font-medium text-sm">企業版專屬功能</p>
            <p className="text-amber-200/70 text-sm mt-1">
              API 存取權限僅限企業版方案用戶。如需升級，請前往
              <a href="/dashboard/subscription" className="text-amber-300 hover:text-amber-200 underline ml-1">訂閱管理</a>。
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          type="text"
          placeholder="搜尋 API 端點..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 rounded-lg"
        />
      </div>

      {/* Overview Sections */}
      <div className="grid md:grid-cols-2 gap-4">
        {apiSections.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.id} className="p-5 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-indigo-400" />
                </div>
                <h3 className="font-semibold text-white">{section.title}</h3>
              </div>
              <div className="space-y-2">
                {section.content.split("\n").map((line, i) => {
                  if (line.startsWith("**") && line.includes("**")) {
                    return (
                      <p key={i} className="text-sm text-white font-semibold mt-3 first:mt-0">
                        {line.replace(/\*\*/g, "")}
                      </p>
                    );
                  }
                  if (line.startsWith("• ")) {
                    const text = line.substring(2);
                    // Handle inline code
                    const parts = text.split(/`([^`]+)`/);
                    return (
                      <div key={i} className="flex items-start gap-2 ml-1">
                        <span className="text-slate-500 mt-0.5">•</span>
                        <span className="text-xs text-slate-400">
                          {parts.map((part, j) =>
                            j % 2 === 1
                              ? <code key={j} className="px-1.5 py-0.5 bg-slate-700 rounded text-indigo-300 font-mono text-xs">{part}</code>
                              : <span key={j}>{part}</span>
                          )}
                        </span>
                      </div>
                    );
                  }
                  if (line.trim() === "") return <div key={i} className="h-2" />;
                  return <p key={i} className="text-xs text-slate-400">{line}</p>;
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Start */}
      <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Terminal className="w-5 h-5 text-green-400" />
          <h3 className="font-semibold text-white">快速開始</h3>
        </div>
        <div className="relative">
          <pre className="bg-slate-900 rounded-lg p-4 text-sm text-slate-300 overflow-x-auto font-mono leading-relaxed">
{`# 1. 登入取得 Token
curl -X POST https://api.kingjam.app/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"you@example.com","password":"xxx"}'

# 2. 使用 Token 呼叫 API
curl https://api.kingjam.app/credits/balance \\
  -H "Authorization: Bearer YOUR_TOKEN"`}
          </pre>
          <button
            onClick={() => copyToClipboard(`curl -X POST https://api.kingjam.app/auth/login \\\n  -H "Content-Type: application/json" \\\n  -d '{"email":"you@example.com","password":"xxx"}'`)}
            className="absolute top-3 right-3 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <Copy className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Endpoints */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-slate-400" />
          API 端點一覽
        </h2>

        {categories.map(cat => (
          <div key={cat} className="mb-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">{cat}</h3>
            <div className="space-y-3">
              {filteredEndpoints
                .filter(ep => ep.category === cat)
                .map(ep => {
                  const isExpanded = expandedEndpoint === ep.id;
                  return (
                    <div
                      key={ep.id}
                      className="rounded-xl bg-slate-800/50 border border-slate-700/50 overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedEndpoint(isExpanded ? null : ep.id)}
                        className="w-full flex items-center gap-3 p-4 hover:bg-slate-800/80 transition-colors"
                      >
                        <span className={`px-2 py-1 rounded text-xs font-bold font-mono ${methodColors[ep.method]}`}>
                          {ep.method}
                        </span>
                        <code className="text-sm text-slate-300 font-mono">{ep.path}</code>
                        {ep.requiresAuth && (
                          <Lock className="w-3 h-3 text-amber-400" />
                        )}
                        <span className="text-xs text-slate-500 ml-auto mr-2 hidden sm:inline">{ep.description}</span>
                        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>

                      {isExpanded && (
                        <div className="border-t border-slate-700/50 p-4 space-y-4">
                          <p className="text-sm text-slate-400">{ep.description}</p>

                          {ep.requiresAuth && (
                            <div className="flex items-center gap-2 text-xs text-amber-400">
                              <Lock className="w-3 h-3" />
                              需要 Bearer Token 認證
                            </div>
                          )}

                          {ep.requestBody && (
                            <div>
                              <p className="text-xs font-semibold text-slate-500 mb-2">Request Body</p>
                              <div className="relative">
                                <pre className="bg-slate-900 rounded-lg p-3 text-xs text-green-300 overflow-x-auto font-mono">
                                  {ep.requestBody}
                                </pre>
                                <button
                                  onClick={() => copyToClipboard(ep.requestBody!)}
                                  className="absolute top-2 right-2 p-1.5 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
                                >
                                  <Copy className="w-3 h-3 text-slate-400" />
                                </button>
                              </div>
                            </div>
                          )}

                          <div>
                            <p className="text-xs font-semibold text-slate-500 mb-2">Response</p>
                            <div className="relative">
                              <pre className="bg-slate-900 rounded-lg p-3 text-xs text-blue-300 overflow-x-auto font-mono">
                                {ep.responseBody}
                              </pre>
                              <button
                                onClick={() => copyToClipboard(ep.responseBody)}
                                className="absolute top-2 right-2 p-1.5 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
                              >
                                <Copy className="w-3 h-3 text-slate-400" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      {/* Error Codes */}
      <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-5">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          常見錯誤碼
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left text-xs text-slate-500 pb-2 pr-4">狀態碼</th>
                <th className="text-left text-xs text-slate-500 pb-2 pr-4">說明</th>
                <th className="text-left text-xs text-slate-500 pb-2">處理方式</th>
              </tr>
            </thead>
            <tbody className="text-slate-400">
              <tr className="border-b border-slate-700/30">
                <td className="py-2 pr-4"><code className="text-red-400">401</code></td>
                <td className="py-2 pr-4">未認證或 Token 過期</td>
                <td className="py-2 text-xs">重新登入取得新 Token</td>
              </tr>
              <tr className="border-b border-slate-700/30">
                <td className="py-2 pr-4"><code className="text-red-400">403</code></td>
                <td className="py-2 pr-4">無權限（非企業版）</td>
                <td className="py-2 text-xs">升級至企業版方案</td>
              </tr>
              <tr className="border-b border-slate-700/30">
                <td className="py-2 pr-4"><code className="text-amber-400">422</code></td>
                <td className="py-2 pr-4">請求參數格式錯誤</td>
                <td className="py-2 text-xs">檢查請求格式和必填欄位</td>
              </tr>
              <tr className="border-b border-slate-700/30">
                <td className="py-2 pr-4"><code className="text-amber-400">429</code></td>
                <td className="py-2 pr-4">請求過於頻繁</td>
                <td className="py-2 text-xs">降低請求頻率或等待後重試</td>
              </tr>
              <tr>
                <td className="py-2 pr-4"><code className="text-red-400">500</code></td>
                <td className="py-2 pr-4">伺服器內部錯誤</td>
                <td className="py-2 text-xs">聯繫客服 service@kingjam.app</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
