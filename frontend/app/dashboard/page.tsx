"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Coins, 
  TrendingUp, 
  TrendingDown,
  Calendar, 
  Image as ImageIcon, 
  FileText, 
  Video,
  Share2,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Zap,
  BarChart3,
  PlusCircle,
  Timer,
  AlertTriangle,
  Flame,
  X
} from "lucide-react";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";

interface UserInfo {
  id: number;
  email: string;
  full_name?: string | null;
  tier: string;
  credits: number;
  is_active: boolean;
}

interface CreditBalance {
  balance: number;
  tier: string;
  is_consistent: boolean;
}

interface UsageStats {
  total_earned: number;
  total_spent: number;
  balance: number;
  by_type: Record<string, { count: number; amount: number }>;
}

interface GenerationHistoryItem {
  id: number;
  generation_type: string;
  status: string;
  credits_used: number;
  created_at: string;
  input_params: Record<string, any>;
  output_data: Record<string, any>;
  thumbnail_url?: string;
}

interface ScheduledPost {
  id: number;
  content_type: string;
  title?: string;
  caption?: string;
  scheduled_at: string;
  status: string;
  platform?: string;
}

interface SocialAccount {
  id: number;
  platform: string;
  platform_username?: string;
  is_active: boolean;
}

interface ExpiringCredits {
  promo_expiring: number;
  promo_expires_at: string | null;
  promo_days_left: number;
  sub_expiring: number;
  sub_expires_at: string | null;
  sub_days_left: number;
  total_expiring: number;
  has_expiring: boolean;
  urgency: "low" | "medium" | "high" | "critical";
  message: string | null;
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [recentHistory, setRecentHistory] = useState<GenerationHistoryItem[]>([]);
  const [upcomingPosts, setUpcomingPosts] = useState<ScheduledPost[]>([]);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [expiringCredits, setExpiringCredits] = useState<ExpiringCredits | null>(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("您好");  // 預設問候語，避免 hydration 錯誤

  // 在客戶端掛載後計算問候語
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("早安");
    else if (hour < 18) setGreeting("午安");
    else setGreeting("晚安");
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // 並行請求所有數據
        const [userRes, creditsRes, statsRes, historyRes, postsRes, accountsRes, expiringRes] = await Promise.allSettled([
          api.get<UserInfo>("/auth/me"),
          api.get<CreditBalance>("/credits/balance"),
          api.get<UsageStats>("/credits/usage-stats?days=30"),
          api.get<{ items: GenerationHistoryItem[] }>("/history?limit=5"),
          api.get<{ posts: ScheduledPost[] }>("/scheduler/posts?status=pending&limit=5"),
          api.get<{ accounts: SocialAccount[] }>("/scheduler/accounts"),
          api.get<ExpiringCredits>("/credits/expiring"),
        ]);

        if (userRes.status === "fulfilled") setUser(userRes.value.data);
        if (creditsRes.status === "fulfilled") setCreditBalance(creditsRes.value.data);
        if (statsRes.status === "fulfilled") setUsageStats(statsRes.value.data);
        if (historyRes.status === "fulfilled") setRecentHistory(historyRes.value.data.items || []);
        if (postsRes.status === "fulfilled") setUpcomingPosts(postsRes.value.data.posts || []);
        if (accountsRes.status === "fulfilled") setSocialAccounts(accountsRes.value.data.accounts || []);
        if (expiringRes.status === "fulfilled") setExpiringCredits(expiringRes.value.data);
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // 問候語現在通過 useState + useEffect 處理，避免 hydration 錯誤

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "social_image": return <ImageIcon className="h-4 w-4 text-pink-400" />;
      case "blog_post": return <FileText className="h-4 w-4 text-blue-400" />;
      case "short_video": return <Video className="h-4 w-4 text-purple-400" />;
      default: return <Sparkles className="h-4 w-4 text-amber-400" />;
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case "social_image": return "社群圖文";
      case "blog_post": return "部落格";
      case "short_video": return "短影片";
      default: return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-0">完成</Badge>;
      case "pending":
        return <Badge className="bg-amber-500/20 text-amber-400 border-0">待發布</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-400 border-0">失敗</Badge>;
      case "processing":
        return <Badge className="bg-blue-500/20 text-blue-400 border-0">處理中</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // 計算本月消耗
  const monthlySpent = usageStats?.total_spent || 0;
  const generationCount = Object.values(usageStats?.by_type || {}).reduce((sum, item) => {
    if (item.amount < 0) return sum + item.count;
    return sum;
  }, 0);

  // 關閉點數到期提示
  const [showExpiringAlert, setShowExpiringAlert] = useState(true);

  // 點數到期提示樣式
  const getUrgencyStyles = (urgency: string) => {
    switch (urgency) {
      case "critical":
        return {
          bg: "bg-gradient-to-r from-red-500/20 via-red-500/30 to-red-500/20",
          border: "border-red-500/50",
          text: "text-red-400",
          icon: <AlertTriangle className="h-5 w-5 text-red-400 animate-pulse" />,
          glow: "shadow-red-500/30",
        };
      case "high":
        return {
          bg: "bg-gradient-to-r from-orange-500/20 via-amber-500/30 to-orange-500/20",
          border: "border-orange-500/50",
          text: "text-orange-400",
          icon: <Flame className="h-5 w-5 text-orange-400 animate-bounce" />,
          glow: "shadow-orange-500/30",
        };
      case "medium":
        return {
          bg: "bg-gradient-to-r from-amber-500/10 via-yellow-500/20 to-amber-500/10",
          border: "border-amber-500/40",
          text: "text-amber-400",
          icon: <Timer className="h-5 w-5 text-amber-400" />,
          glow: "shadow-amber-500/20",
        };
      default:
        return {
          bg: "bg-slate-800/50",
          border: "border-slate-700",
          text: "text-slate-400",
          icon: <Clock className="h-5 w-5 text-slate-400" />,
          glow: "",
        };
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 🔥 點數到期倒數提示 - FOMO Banner */}
      {!loading && expiringCredits?.has_expiring && showExpiringAlert && (
        <div 
          className={`
            relative overflow-hidden rounded-xl border p-4 
            ${getUrgencyStyles(expiringCredits.urgency).bg}
            ${getUrgencyStyles(expiringCredits.urgency).border}
            shadow-lg ${getUrgencyStyles(expiringCredits.urgency).glow}
            animate-in slide-in-from-top-2 duration-500
          `}
        >
          {/* 背景動畫效果 */}
          {expiringCredits.urgency === "critical" && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-500/10 to-transparent animate-pulse" />
          )}
          
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`
                flex items-center justify-center w-12 h-12 rounded-full
                ${expiringCredits.urgency === "critical" ? "bg-red-500/20 ring-2 ring-red-500/50" : 
                  expiringCredits.urgency === "high" ? "bg-orange-500/20 ring-2 ring-orange-500/50" :
                  "bg-amber-500/20"}
              `}>
                {getUrgencyStyles(expiringCredits.urgency).icon}
              </div>
              
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={`font-semibold ${getUrgencyStyles(expiringCredits.urgency).text}`}>
                    {expiringCredits.urgency === "critical" ? "⚠️ 點數即將到期！" :
                     expiringCredits.urgency === "high" ? "🔥 把握最後機會！" :
                     "📅 點數到期提醒"}
                  </h3>
                  {expiringCredits.urgency !== "low" && (
                    <Badge className={`
                      ${expiringCredits.urgency === "critical" ? "bg-red-500/30 text-red-300 animate-pulse" :
                        expiringCredits.urgency === "high" ? "bg-orange-500/30 text-orange-300" :
                        "bg-amber-500/30 text-amber-300"}
                      border-0
                    `}>
                      {expiringCredits.total_expiring.toLocaleString()} 點即將到期
                    </Badge>
                  )}
                </div>
                
                <div className="mt-1 text-sm text-slate-300 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {expiringCredits.promo_expiring > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-pink-400" />
                      優惠點數 {expiringCredits.promo_expiring.toLocaleString()} 點
                      <span className={`font-medium ${expiringCredits.promo_days_left <= 1 ? "text-red-400" : "text-amber-400"}`}>
                        ({expiringCredits.promo_days_left <= 0 ? "今天" : `${expiringCredits.promo_days_left} 天後`}到期)
                      </span>
                    </span>
                  )}
                  {expiringCredits.sub_expiring > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      月費點數 {expiringCredits.sub_expiring.toLocaleString()} 點
                      <span className={`font-medium ${expiringCredits.sub_days_left <= 1 ? "text-red-400" : "text-amber-400"}`}>
                        ({expiringCredits.sub_days_left <= 0 ? "今天" : `${expiringCredits.sub_days_left} 天後`}月底歸零)
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Link href="/dashboard/video">
                <Button 
                  size="sm"
                  className={`
                    ${expiringCredits.urgency === "critical" ? 
                      "bg-red-500 hover:bg-red-600 animate-pulse" :
                      expiringCredits.urgency === "high" ?
                      "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600" :
                      "bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600"}
                    text-white shadow-lg
                  `}
                >
                  <Sparkles className="mr-1 h-4 w-4" />
                  立即使用
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-white"
                onClick={() => setShowExpiringAlert(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* 倒數進度條 */}
          {expiringCredits.urgency !== "low" && (
            <div className="mt-3 relative">
              <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${
                    expiringCredits.urgency === "critical" ? "bg-red-500 animate-pulse" :
                    expiringCredits.urgency === "high" ? "bg-gradient-to-r from-orange-500 to-amber-500" :
                    "bg-gradient-to-r from-amber-500 to-yellow-500"
                  }`}
                  style={{ 
                    width: `${Math.max(5, Math.min(100, 
                      expiringCredits.urgency === "critical" ? 15 :
                      expiringCredits.urgency === "high" ? 35 :
                      60
                    ))}%` 
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500 text-right">
                過期後點數將自動歸零，無法退還
              </p>
            </div>
          )}
        </div>
      )}

      {/* 歡迎區塊 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {greeting}，{user?.full_name || user?.email?.split("@")[0] || "創作者"} 👋
          </h1>
          <p className="text-slate-400 mt-1">
            歡迎回到 King Jam AI，今天想創作什麼內容呢？
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/credits">
            <Button variant="outline" className="border-slate-700 hover:bg-slate-800">
              <Coins className="mr-2 h-4 w-4 text-amber-400" />
              購買點數
            </Button>
          </Link>
          <Link href="/dashboard/video">
            <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500">
              <Sparkles className="mr-2 h-4 w-4" />
              開始創作
            </Button>
          </Link>
        </div>
      </div>

      {/* 數據概覽卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* 點數餘額 */}
        <Link href="/dashboard/credits" className="block group">
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 overflow-hidden relative h-full transition-all duration-200 group-hover:border-amber-500/50 group-hover:shadow-lg group-hover:shadow-amber-500/10">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full -translate-y-1/2 translate-x-1/2 transition-transform group-hover:scale-110" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 group-hover:text-amber-400 transition-colors">點數餘額</CardTitle>
              <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/30 transition-colors">
                <Coins className="h-4 w-4 text-amber-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {loading ? "--" : (creditBalance?.balance || user?.credits || 0).toLocaleString()}
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
                {creditBalance?.tier === "free" ? "免費版" : creditBalance?.tier || "免費版"}
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* 本月消耗 */}
        <Link href="/dashboard/history" className="block group">
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 overflow-hidden relative h-full transition-all duration-200 group-hover:border-purple-500/50 group-hover:shadow-lg group-hover:shadow-purple-500/10">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/2 transition-transform group-hover:scale-110" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 group-hover:text-purple-400 transition-colors">本月消耗</CardTitle>
              <div className="h-8 w-8 rounded-full bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                <TrendingDown className="h-4 w-4 text-purple-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {loading ? "--" : monthlySpent.toLocaleString()}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                已生成 {generationCount} 個內容
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* 待發布排程 */}
        <Link href="/dashboard/scheduler" className="block group">
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 overflow-hidden relative h-full transition-all duration-200 group-hover:border-blue-500/50 group-hover:shadow-lg group-hover:shadow-blue-500/10">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2 transition-transform group-hover:scale-110" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 group-hover:text-blue-400 transition-colors">待發布排程</CardTitle>
              <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                <Calendar className="h-4 w-4 text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {loading ? "--" : upcomingPosts.length}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {upcomingPosts.length > 0 
                  ? `最近：${format(new Date(upcomingPosts[0]?.scheduled_at), "MM/dd HH:mm", { locale: zhTW })}`
                  : "尚無排程"
                }
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* 已連結帳號 */}
        <Link href="/dashboard/accounts" className="block group">
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 overflow-hidden relative h-full transition-all duration-200 group-hover:border-emerald-500/50 group-hover:shadow-lg group-hover:shadow-emerald-500/10">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2 transition-transform group-hover:scale-110" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 group-hover:text-emerald-400 transition-colors">社群帳號</CardTitle>
              <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/30 transition-colors">
                <Share2 className="h-4 w-4 text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {loading ? "--" : socialAccounts.filter(a => a.is_active).length}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {socialAccounts.length > 0 ? "已連結平台" : "尚未連結帳號"}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 主要內容區 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 最近生成記錄 */}
        <Card className="lg:col-span-2 bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white">最近生成記錄</CardTitle>
              <CardDescription className="text-slate-400">您最近創作的內容</CardDescription>
            </div>
            <Link href="/dashboard/history">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                查看全部 <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-slate-700/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : recentHistory.length === 0 ? (
              <div className="text-center py-8">
                <Sparkles className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                <p className="text-slate-400 mb-4">尚無生成記錄</p>
                <Link href="/dashboard/social">
                  <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    開始第一次創作
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-lg bg-slate-600/50 flex items-center justify-center">
                      {getTypeIcon(item.generation_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white truncate">
                          {item.input_params?.topic || item.input_params?.title || getTypeName(item.generation_type)}
                        </span>
                        {getStatusBadge(item.status)}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {format(new Date(item.created_at), "MM/dd HH:mm", { locale: zhTW })}
                        {item.credits_used > 0 && ` • 消耗 ${item.credits_used} 點`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 快速操作 */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">快速開始</CardTitle>
            <CardDescription className="text-slate-400">選擇您想要創作的內容類型</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/dashboard/social" className="block">
              <div className="p-4 rounded-lg bg-gradient-to-r from-pink-500/10 to-rose-500/10 border border-pink-500/20 hover:border-pink-500/40 transition-all group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-pink-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ImageIcon className="h-5 w-5 text-pink-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">社群圖文</h4>
                    <p className="text-xs text-slate-400">IG / FB 貼文圖片</p>
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/dashboard/blog" className="block">
              <div className="p-4 rounded-lg bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-all group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileText className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">部落格文章</h4>
                    <p className="text-xs text-slate-400">SEO 優化長文</p>
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/dashboard/video" className="block">
              <div className="p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 hover:border-purple-500/40 transition-all group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Video className="h-5 w-5 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-white flex items-center gap-2">
                      短影片生成
                      <Badge className="bg-amber-500/20 text-amber-400 border-0 text-[10px]">HOT</Badge>
                    </h4>
                    <p className="text-xs text-slate-400">TikTok / Reels</p>
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/dashboard/scheduler" className="block">
              <div className="p-4 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 hover:border-emerald-500/40 transition-all group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Calendar className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">排程上架</h4>
                    <p className="text-xs text-slate-400">自動發布管理</p>
                  </div>
                </div>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* 待發布排程 */}
      {upcomingPosts.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white">即將發布</CardTitle>
              <CardDescription className="text-slate-400">您的排程貼文</CardDescription>
            </div>
            <Link href="/dashboard/scheduler">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                管理排程 <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {upcomingPosts.slice(0, 3).map((post) => (
                <div
                  key={post.id}
                  className="p-4 rounded-lg bg-slate-700/30 border border-slate-600/50"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {getTypeIcon(post.content_type)}
                    <span className="text-sm font-medium text-white truncate">
                      {post.title || post.caption?.slice(0, 30) || getTypeName(post.content_type)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Clock className="h-3 w-3" />
                    {format(new Date(post.scheduled_at), "MM/dd HH:mm", { locale: zhTW })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
