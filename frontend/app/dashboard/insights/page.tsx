"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  BarChart3, TrendingUp, TrendingDown, Eye, Users, MousePointerClick,
  Share2, Heart, MessageCircle, Bookmark, ExternalLink, Calendar,
  ChevronDown, RefreshCw, Download, Filter, ArrowUpRight, ArrowDownRight,
  Globe, Instagram, Facebook, Linkedin, Twitter, Youtube, Clock,
  Sparkles, Target, Zap, Activity, PieChart, LineChart as LineChartIcon,
  AlertCircle, CheckCircle2, Loader2, Link2, Settings
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { toast } from "sonner";

// ============================================================
// Types
// ============================================================

interface MetricCard {
  title: string;
  value: string;
  change: number;
  changeLabel: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

interface PlatformData {
  platform: string;
  icon: React.ElementType;
  color: string;
  username?: string;
  avatar?: string;
  followers: number;
  reach: number;
  engagement: number;
  posts: number;
  trend: number;
  metrics?: Record<string, number>;
  totals?: Record<string, number>;
  top_posts?: Array<{
    id: string;
    caption: string;
    type: string;
    metrics: Record<string, number>;
  }>;
  error?: string;
  ga4_property_id?: string | null;
}

interface ContentPerformance {
  id: number;
  title: string;
  platform: string;
  type: "blog" | "social" | "video";
  views: number;
  engagement: number;
  clicks: number;
  publishedAt: string;
  thumbnail?: string;
}

interface TrafficSource {
  source: string;
  medium?: string;
  sessions: number;
  users?: number;
  percentage: number;
  color: string;
}

interface DashboardData {
  period: {
    start: string;
    end: string;
    days: number;
  };
  summary: {
    total_posts: number;
    success_rate: number;
    total_impressions: number;
    total_engagement: number;
    total_followers: number;
    platforms_connected: number;
    // 額外的分析欄位
    total_reach?: number;
    total_likes?: number;
    total_comments?: number;
    avg_engagement_rate?: number;
    post_count?: number;
  };
  platforms: Array<{
    platform: string;
    username?: string;
    avatar?: string;
    metrics?: Record<string, number>;
    totals?: Record<string, number>;
    top_posts?: Array<{
      id: string;
      caption: string;
      type: string;
      metrics: Record<string, number>;
    }>;
    error?: string;
  }>;
  publish_stats?: {
    total: number;
    failed: number;
    success_rate: number;
    by_platform: Record<string, number>;
    daily: Array<{ date: string; count: number }>;
  };
  daily?: Array<{
    date: string;
    posts?: number;
    impressions?: number;
    engagement?: number;
    sessions?: number;
    users?: number;
    pageviews?: number;
  }>;
}

interface GA4Status {
  connected: boolean;
  property_id?: string;
}

// ============================================================
// Helper Functions
// ============================================================

const getPlatformIcon = (platform: string): React.ElementType => {
  const icons: Record<string, React.ElementType> = {
    instagram: Instagram,
    facebook: Facebook,
    linkedin: Linkedin,
    youtube: Youtube,
    twitter: Twitter,
    tiktok: Zap,
    threads: MessageCircle,
    xiaohongshu: Heart,
    wordpress: Globe,
    ga4: Globe,
  };
  return icons[platform.toLowerCase()] || Globe;
};

const getPlatformColor = (platform: string): string => {
  const colors: Record<string, string> = {
    instagram: "from-pink-500 to-purple-500",
    facebook: "from-blue-600 to-blue-500",
    linkedin: "from-blue-700 to-blue-600",
    youtube: "from-red-600 to-red-500",
    twitter: "from-sky-500 to-sky-400",
    tiktok: "from-slate-800 to-pink-500",
    threads: "from-slate-700 to-slate-500",
    xiaohongshu: "from-red-500 to-rose-400",
    wordpress: "from-blue-500 to-cyan-500",
    ga4: "from-emerald-500 to-teal-500",
  };
  return colors[platform.toLowerCase()] || "from-slate-600 to-slate-500";
};

const getPlatformLabel = (platform: string): string => {
  const labels: Record<string, string> = {
    instagram: "Instagram",
    facebook: "Facebook",
    linkedin: "LinkedIn",
    youtube: "YouTube",
    twitter: "X (Twitter)",
    tiktok: "TikTok",
    threads: "Threads",
    xiaohongshu: "小紅書",
    wordpress: "WordPress",
    ga4: "Google Analytics",
  };
  return labels[platform.toLowerCase()] || platform;
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "k";
  }
  return num.toLocaleString();
};

const getTrafficSourceColor = (index: number): string => {
  const colors = ["bg-emerald-500", "bg-blue-500", "bg-purple-500", "bg-amber-500", "bg-pink-500", "bg-cyan-500", "bg-red-500", "bg-slate-500"];
  return colors[index % colors.length];
};

// ============================================================
// Components
// ============================================================

function MetricCardComponent({ metric }: { metric: MetricCard }) {
  const Icon = metric.icon;
  const isPositive = metric.change >= 0;
  
  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50 hover:border-slate-600/50 transition-all duration-300 group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-400 mb-1">{metric.title}</p>
            <p className="text-3xl font-bold text-white">{metric.value}</p>
            <div className="flex items-center gap-1.5 mt-2">
              {isPositive ? (
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-red-400" />
              )}
              <span className={cn("text-sm font-medium", isPositive ? "text-emerald-400" : "text-red-400")}>
                {isPositive ? "+" : ""}{metric.change}%
              </span>
              <span className="text-xs text-slate-500">{metric.changeLabel}</span>
            </div>
          </div>
          <div className={cn("p-3 rounded-xl", metric.bgColor)}>
            <Icon className={cn("w-6 h-6", metric.color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SimpleBarChart({ data }: { data: Array<{ date: string; views?: number; impressions?: number }> }) {
  const values = data.map(d => d.views || d.impressions || 0);
  const maxValue = Math.max(...values, 1);
  
  return (
    <div className="flex items-end justify-between gap-2 h-48 px-2">
      {data.slice(-7).map((item, index) => (
        <div key={index} className="flex-1 flex flex-col items-center gap-2">
          <div className="w-full flex flex-col items-center gap-1">
            <span className="text-xs text-slate-400">{formatNumber(item.views || item.impressions || 0)}</span>
            <div 
              className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-md transition-all duration-500 hover:from-indigo-500 hover:to-indigo-300"
              style={{ height: `${((item.views || item.impressions || 0) / maxValue) * 140}px` }}
            />
          </div>
          <span className="text-xs text-slate-500">{item.date.slice(-5)}</span>
        </div>
      ))}
    </div>
  );
}

function SimpleLineIndicator({ data }: { data: Array<{ date: string; sessions?: number; users?: number }> }) {
  const values = data.map(d => d.sessions || d.users || 0);
  const maxValue = Math.max(...values, 1);
  const chartData = data.slice(-7);
  
  return (
    <div className="relative h-48 px-2">
      <svg className="w-full h-40" viewBox="0 0 280 120" preserveAspectRatio="none">
        {/* Grid lines */}
        {[0, 1, 2, 3, 4].map(i => (
          <line key={i} x1="0" y1={i * 30} x2="280" y2={i * 30} stroke="currentColor" className="text-slate-700/30" strokeWidth="1" />
        ))}
        
        {/* Line path */}
        <path
          d={chartData.map((item, index) => {
            const x = (index / Math.max(chartData.length - 1, 1)) * 280;
            const y = 120 - ((item.sessions || item.users || 0) / maxValue) * 110;
            return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
          }).join(' ')}
          fill="none"
          stroke="url(#lineGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Area fill */}
        <path
          d={`${chartData.map((item, index) => {
            const x = (index / Math.max(chartData.length - 1, 1)) * 280;
            const y = 120 - ((item.sessions || item.users || 0) / maxValue) * 110;
            return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
          }).join(' ')} L 280 120 L 0 120 Z`}
          fill="url(#areaGradient)"
        />
        
        {/* Dots */}
        {chartData.map((item, index) => {
          const x = (index / Math.max(chartData.length - 1, 1)) * 280;
          const y = 120 - ((item.sessions || item.users || 0) / maxValue) * 110;
          return (
            <circle key={index} cx={x} cy={y} r="4" fill="#10b981" stroke="white" strokeWidth="2" />
          );
        })}
        
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* X-axis labels */}
      <div className="flex justify-between px-0 mt-2">
        {chartData.map((item, index) => (
          <span key={index} className="text-xs text-slate-500">{item.date.slice(-5)}</span>
        ))}
      </div>
    </div>
  );
}

function PlatformCard({ platform }: { platform: PlatformData }) {
  const Icon = platform.icon;
  const platformLabel = getPlatformLabel(platform.platform);
  const isWordpress = platform.platform.toLowerCase() === "wordpress";
  const hasGA4 = isWordpress && !!platform.ga4_property_id;
  
  if (platform.error) {
    return (
      <div className="p-4 bg-slate-800/50 rounded-xl border border-red-500/30 hover:border-red-500/50 transition-all">
        <div className="flex items-center gap-3 mb-2">
          <div className={cn("p-2.5 rounded-xl bg-gradient-to-br", platform.color, "opacity-50")}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-white">{platformLabel}</h4>
            <p className="text-xs text-red-400">連線錯誤</p>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">請重新連結帳號或稍後再試</p>
      </div>
    );
  }
  
  return (
    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-slate-600/50 transition-all group">
      <div className="flex items-center gap-3 mb-4">
        <div className={cn("p-2.5 rounded-xl bg-gradient-to-br shadow-lg", platform.color)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-white">{platformLabel}</h4>
          <p className="text-xs text-slate-400 truncate">
            {platform.username ? `@${platform.username}` : `${formatNumber(platform.followers)} 粉絲`}
          </p>
        </div>
        {platform.trend !== 0 && (
          <Badge variant="secondary" className={cn(
            "text-xs shrink-0",
            platform.trend >= 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
          )}>
            {platform.trend >= 0 ? <ArrowUpRight className="w-3 h-3 inline" /> : <ArrowDownRight className="w-3 h-3 inline" />}
            {Math.abs(platform.trend)}%
          </Badge>
        )}
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-2 bg-slate-900/50 rounded-lg group-hover:bg-slate-900/70 transition-colors">
          <p className="text-lg font-bold text-white">{formatNumber(platform.reach)}</p>
          <p className="text-[10px] text-slate-500">曝光</p>
        </div>
        <div className="text-center p-2 bg-slate-900/50 rounded-lg group-hover:bg-slate-900/70 transition-colors">
          <p className="text-lg font-bold text-white">{platform.engagement}%</p>
          <p className="text-[10px] text-slate-500">互動率</p>
        </div>
        <div className="text-center p-2 bg-slate-900/50 rounded-lg group-hover:bg-slate-900/70 transition-colors">
          <p className="text-lg font-bold text-white">{platform.posts}</p>
          <p className="text-[10px] text-slate-500">貼文</p>
        </div>
      </div>
      
      {/* 粉絲數顯示 */}
      {platform.followers > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between">
          <span className="text-xs text-slate-500">粉絲數</span>
          <span className="text-sm font-semibold text-white">{formatNumber(platform.followers)}</span>
        </div>
      )}
      
      {/* WordPress GA4 設定按鈕 */}
      {isWordpress && (
        <a
          href="/dashboard/settings/ga4"
          className={cn(
            "mt-3 flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors",
            hasGA4
              ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30"
              : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30"
          )}
        >
          <span className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            {hasGA4 ? "GA4 已連接" : "設定 GA4 獲取瀏覽數據"}
          </span>
          <ExternalLink className="w-3 h-3 opacity-60" />
        </a>
      )}
    </div>
  );
}

function ContentRow({ content }: { content: ContentPerformance }) {
  const typeConfig = {
    blog: { icon: Globe, color: "text-blue-400", bg: "bg-blue-500/10", label: "部落格" },
    social: { icon: Share2, color: "text-pink-400", bg: "bg-pink-500/10", label: "社群" },
    video: { icon: Youtube, color: "text-red-400", bg: "bg-red-500/10", label: "影片" },
  };
  const config = typeConfig[content.type];
  const Icon = config.icon;
  const platformLabel = getPlatformLabel(content.platform);
  
  return (
    <div className="flex items-center gap-4 p-4 bg-slate-800/30 rounded-xl hover:bg-slate-800/50 transition-all duration-200 group border border-transparent hover:border-slate-700/50">
      <div className={cn("p-2.5 rounded-lg shrink-0", config.bg)}>
        <Icon className={cn("w-5 h-5", config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-white truncate group-hover:text-indigo-400 transition-colors">
          {content.title}
        </h4>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-slate-700/50">
            {platformLabel}
          </Badge>
          <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", config.bg, config.color)}>
            {config.label}
          </Badge>
          {content.publishedAt !== "-" && (
            <>
              <span className="text-slate-700">•</span>
              <span className="text-xs text-slate-500">{content.publishedAt}</span>
            </>
          )}
        </div>
      </div>
      <div className="hidden md:flex items-center gap-6 text-sm shrink-0">
        <div className="text-center min-w-[60px]">
          <p className="font-semibold text-white">{formatNumber(content.views)}</p>
          <p className="text-[10px] text-slate-500">觀看</p>
        </div>
        <div className="text-center min-w-[60px]">
          <p className="font-semibold text-white">{formatNumber(content.engagement)}</p>
          <p className="text-[10px] text-slate-500">互動</p>
        </div>
        <div className="text-center min-w-[60px]">
          <p className="font-semibold text-white">{formatNumber(content.clicks)}</p>
          <p className="text-[10px] text-slate-500">觸及</p>
        </div>
      </div>
      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" title="查看詳情">
        <ExternalLink className="w-4 h-4" />
      </Button>
    </div>
  );
}

function TrafficSourceBar({ source, rank }: { source: TrafficSource; rank?: number }) {
  const sourceIcons: Record<string, React.ElementType> = {
    "直接流量": Globe,
    "google": Globe,
    "facebook": Facebook,
    "instagram": Instagram,
    "linkedin": Linkedin,
    "twitter": Twitter,
    "youtube": Youtube,
  };
  const Icon = sourceIcons[source.source.toLowerCase()] || Link2;
  
  return (
    <div className="p-3 bg-slate-800/30 rounded-xl hover:bg-slate-800/50 transition-all group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          {rank && (
            <span className="text-xs font-bold text-slate-500 w-4">#{rank}</span>
          )}
          <div className={cn("p-1.5 rounded-lg", source.color.replace("bg-", "bg-").replace("-500", "-500/20"))}>
            <Icon className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm text-slate-300 font-medium">{source.source}</span>
          {source.medium && source.medium !== "(none)" && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-slate-700/50">
              {source.medium}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white">{formatNumber(source.sessions)}</span>
          <Badge variant="secondary" className={cn("text-[10px] px-1.5", source.color.replace("bg-", "bg-").replace("-500", "-500/20"), "text-white")}>
            {source.percentage.toFixed(1)}%
          </Badge>
        </div>
      </div>
      <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all duration-700 ease-out", source.color)}
          style={{ width: `${Math.min(source.percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="relative">
        <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl animate-pulse" />
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin relative" />
      </div>
      <p className="text-slate-400 mt-6">載入數據中...</p>
      <p className="text-slate-500 text-sm mt-1">正在從各平台同步最新數據</p>
    </div>
  );
}

function EmptyState({ message, action, icon: IconComponent }: { message: string; action?: React.ReactNode; icon?: React.ElementType }) {
  const Icon = IconComponent || BarChart3;
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="relative mb-4">
        <div className="absolute inset-0 bg-slate-500/10 rounded-full blur-lg" />
        <div className="p-4 rounded-full bg-slate-800/50 border border-slate-700/50 relative">
          <Icon className="w-8 h-8 text-slate-500" />
        </div>
      </div>
      <p className="text-slate-400 mb-1">{message}</p>
      <p className="text-slate-500 text-sm mb-4">開始發布內容以收集數據</p>
      {action}
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function InsightsPage() {
  const [timeRange, setTimeRange] = useState("30d");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [ga4Status, setGa4Status] = useState<GA4Status>({ connected: false });
  const [trafficData, setTrafficData] = useState<{
    totals?: Record<string, number>;
    daily?: Array<Record<string, number | string>>;
  } | null>(null);
  const [trafficSources, setTrafficSources] = useState<TrafficSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<{
    summary?: Record<string, number>;
    by_platform?: Array<Record<string, number | string>>;
    daily_trend?: Array<Record<string, number | string>>;
  } | null>(null);
  const [topPosts, setTopPosts] = useState<Array<Record<string, unknown>>>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch analytics data (from /analytics API - 持久化數據)
  const fetchAnalyticsData = useCallback(async () => {
    try {
      const days = parseInt(timeRange.replace("d", ""));
      const [overviewRes, topPostsRes] = await Promise.all([
        api.get(`/analytics/overview?days=${days}`),
        api.get(`/analytics/top-posts?days=${days}&limit=10`)
      ]);
      setAnalyticsData(overviewRes.data);
      setTopPosts(topPostsRes.data.top_posts || []);
    } catch (err) {
      console.error("Failed to fetch analytics data:", err);
    }
  }, [timeRange]);

  // Fetch dashboard data (from /insights API - 即時數據)
  const fetchDashboardData = useCallback(async () => {
    try {
      const days = parseInt(timeRange.replace("d", ""));
      const response = await api.get(`/insights/dashboard?days=${days}`);
      setDashboardData(response.data);
      setError(null);
    } catch (err: unknown) {
      console.error("Failed to fetch dashboard data:", err);
      // Try demo data fallback
      try {
        const demoResponse = await api.get("/insights/demo/dashboard");
        setDashboardData(demoResponse.data);
      } catch {
        setError("無法載入數據，請稍後再試");
      }
    }
  }, [timeRange]);

  // Fetch GA4 status
  const fetchGA4Status = useCallback(async () => {
    try {
      const response = await api.get("/insights/ga4/status");
      setGa4Status(response.data);
      
      if (response.data.connected && response.data.property_id) {
        // Fetch GA4 traffic data
        const days = parseInt(timeRange.replace("d", ""));
        const startDate = `${days}daysAgo`;
        
        const [trafficRes, sourcesRes] = await Promise.all([
          api.get(`/insights/ga4/traffic?start_date=${startDate}&end_date=today`),
          api.get(`/insights/ga4/sources?start_date=${startDate}&end_date=today`)
        ]);
        
        setTrafficData(trafficRes.data);
        
        // Process traffic sources
        const sources = sourcesRes.data.sources || [];
        const totalSessions = sources.reduce((sum: number, s: { sessions: number }) => sum + s.sessions, 0);
        setTrafficSources(sources.map((s: { source: string; medium?: string; sessions: number }, i: number) => ({
          source: s.source === "(direct)" ? "直接流量" : s.source,
          medium: s.medium,
          sessions: s.sessions,
          percentage: totalSessions > 0 ? (s.sessions / totalSessions) * 100 : 0,
          color: getTrafficSourceColor(i)
        })));
      }
    } catch (err) {
      console.error("Failed to fetch GA4 status:", err);
    }
  }, [timeRange]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchDashboardData(), fetchGA4Status(), fetchAnalyticsData()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchDashboardData, fetchGA4Status, fetchAnalyticsData]);

  // Refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchDashboardData(), fetchGA4Status(), fetchAnalyticsData()]);
    setIsRefreshing(false);
  };

  // Trigger manual sync (調用 Celery 任務同步最新數據)
  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await api.post("/analytics/sync", {});
      // 等待 3 秒讓同步任務開始處理
      await new Promise(resolve => setTimeout(resolve, 3000));
      // 重新載入數據
      await fetchAnalyticsData();
    } catch (err) {
      console.error("Failed to trigger sync:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Connect GA4
  const handleConnectGA4 = async () => {
    try {
      const response = await api.get("/insights/ga4/auth-url");
      window.location.href = response.data.auth_url;
    } catch (err) {
      console.error("Failed to get GA4 auth URL:", err);
      toast.error("無法取得 GA4 授權連結，請稍後再試");
    }
  };

  // Generate metrics from data (優先使用 analytics 持久化數據，fallback 到 insights 即時數據)
  const summaryData = analyticsData?.summary || dashboardData?.summary;
  const metrics: MetricCard[] = summaryData ? [
    {
      title: "總曝光數",
      value: formatNumber(summaryData.total_impressions || 0),
      change: 12.5,
      changeLabel: "vs 上期",
      icon: Eye,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "總觸及數",
      value: formatNumber(summaryData.total_reach || 0),
      change: 8.3,
      changeLabel: "vs 上期",
      icon: Users,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "總互動數",
      value: formatNumber((summaryData.total_likes || 0) + (summaryData.total_comments || 0)),
      change: 15.2,
      changeLabel: "vs 上期",
      icon: Heart,
      color: "text-pink-500",
      bgColor: "bg-pink-500/10",
    },
    {
      title: "平均互動率",
      value: `${summaryData.avg_engagement_rate || 0}%`,
      change: 0,
      changeLabel: `${summaryData.post_count || dashboardData?.summary?.total_posts || 0} 篇貼文`,
      icon: TrendingUp,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
  ] : [];

  // Convert platform data
  const platformsData: PlatformData[] = dashboardData?.platforms?.map((p: any) => ({
    platform: p.platform,
    icon: getPlatformIcon(p.platform),
    color: getPlatformColor(p.platform),
    username: p.username,
    avatar: p.avatar,
    followers: p.metrics?.follower_count || p.metrics?.page_fans || p.metrics?.subscribers || 0,
    reach: p.totals?.total_impressions || p.metrics?.impressions || p.metrics?.reach || 0,
    engagement: p.totals?.total_likes && p.totals?.total_impressions 
      ? Number(((p.totals.total_likes / p.totals.total_impressions) * 100).toFixed(1))
      : 0,
    posts: p.totals?.post_count || 0,
    trend: 0,
    metrics: p.metrics,
    totals: p.totals,
    top_posts: p.top_posts,
    error: p.error,
    ga4_property_id: p.ga4_property_id,
  })) || [];

  // Content performance from analytics API (優先) 或 insights API
  const contentPerformance: ContentPerformance[] = [];
  
  // 優先使用 /analytics/top-posts 的持久化數據
  if (topPosts.length > 0) {
    topPosts.forEach((post, index) => {
      contentPerformance.push({
        id: (post.id as number) || index,
        title: (post.title as string) || (post.caption as string) || "無標題",
        platform: (post.platform as string) || "unknown",
        type: (post.platform as string)?.toLowerCase() === "youtube" ? "video" : "social",
        views: (post.impressions as number) || 0,
        engagement: ((post.likes as number) || 0) + ((post.comments as number) || 0),
        clicks: (post.reach as number) || 0,
        publishedAt: (post.published_at as string)?.split("T")[0] || "-",
      });
    });
  } else {
    // Fallback: 使用 /insights API 的即時數據
    dashboardData?.platforms?.forEach((p, platformIndex) => {
      p.top_posts?.forEach((post, postIndex) => {
        contentPerformance.push({
          id: platformIndex * 100 + postIndex,
          title: post.caption || "無標題",
          platform: p.platform,
          type: post.type?.toLowerCase() === "video" ? "video" : "social",
          views: post.metrics?.impressions || 0,
          engagement: (post.metrics?.likes || 0) + (post.metrics?.comments || 0),
          clicks: post.metrics?.engagement || 0,
          publishedAt: "-",
        });
      });
    });
  }

  // Chart data (優先使用 analytics 的 daily_trend)
  const chartData = analyticsData?.daily_trend || dashboardData?.daily || trafficData?.daily || [];

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20">
              <BarChart3 className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">成效洞察引擎</h1>
              <p className="text-sm text-slate-400">追蹤您的內容表現與網站流量</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px] bg-slate-800/50 border-slate-700">
              <Calendar className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">過去 7 天</SelectItem>
              <SelectItem value="14d">過去 14 天</SelectItem>
              <SelectItem value="30d">過去 30 天</SelectItem>
              <SelectItem value="90d">過去 90 天</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="border-slate-700 hover:bg-slate-800"
            title="重新載入數據"
          >
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
          </Button>

          <Button 
            variant="outline"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="border-slate-700 hover:bg-slate-800"
            title="從各平台同步最新數據"
          >
            {isSyncing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Activity className="w-4 h-4 mr-2" />
            )}
            {isSyncing ? "同步中..." : "同步數據"}
          </Button>
          
          <Button 
            variant="outline" 
            className="border-slate-700 hover:bg-slate-800"
            onClick={() => {
              // 生成 CSV 報表
              const csvData = [
                ["指標", "數值"],
                ["總曝光數", summaryData?.total_impressions || 0],
                ["總觸及數", summaryData?.total_reach || 0],
                ["總互動數", (summaryData?.total_likes || 0) + (summaryData?.total_comments || 0)],
                ["平均互動率", `${summaryData?.avg_engagement_rate || 0}%`],
                ["總貼文數", summaryData?.post_count || summaryData?.total_posts || 0],
              ];
              platformsData.forEach(p => {
                csvData.push([`${p.platform} - 曝光`, p.reach]);
                csvData.push([`${p.platform} - 互動率`, `${p.engagement}%`]);
                csvData.push([`${p.platform} - 貼文數`, p.posts]);
              });
              const csv = csvData.map(row => row.join(",")).join("\n");
              const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `insights_report_${new Date().toISOString().split("T")[0]}.csv`;
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            匯出報表
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* GA4 Connection Banner */}
      {!ga4Status.connected ? (
        <Card className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border-indigo-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-indigo-500/20">
                <Sparkles className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">連結您的 Google Analytics 以獲得更完整的數據分析</p>
                <p className="text-xs text-slate-400 mt-0.5">整合 GA4 可追蹤網站流量來源、用戶行為等更多指標</p>
              </div>
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500" onClick={handleConnectGA4}>
                <Zap className="w-4 h-4 mr-1.5" />
                立即連結
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">Google Analytics 已連結</p>
                <p className="text-xs text-slate-400 mt-0.5">Property ID: {ga4Status.property_id}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <MetricCardComponent key={index} metric={metric} />
        ))}
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-800/50 border border-slate-700/50 p-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-indigo-600">
            <Activity className="w-4 h-4 mr-2" />
            總覽
          </TabsTrigger>
          <TabsTrigger value="content" className="data-[state=active]:bg-indigo-600">
            <PieChart className="w-4 h-4 mr-2" />
            內容表現
          </TabsTrigger>
          <TabsTrigger value="traffic" className="data-[state=active]:bg-indigo-600">
            <Globe className="w-4 h-4 mr-2" />
            流量分析
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Views Chart */}
            <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Eye className="w-5 h-5 text-blue-400" />
                      觀看數趨勢
                    </CardTitle>
                    <CardDescription>內容觀看數變化</CardDescription>
                  </div>
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    即時數據
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <SimpleBarChart data={chartData as Array<{ date: string; views?: number; impressions?: number }>} />
                ) : (
                  <EmptyState message="尚無觀看數據" />
                )}
              </CardContent>
            </Card>

            {/* Sessions Chart */}
            <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-emerald-400" />
                      網站工作階段
                    </CardTitle>
                    <CardDescription>訪客數變化趨勢</CardDescription>
                  </div>
                  <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">
                    {ga4Status.connected ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        GA4 連結
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3 mr-1" />
                        未連結
                      </>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {trafficData?.daily && trafficData.daily.length > 0 ? (
                  <SimpleLineIndicator data={trafficData.daily as Array<{ date: string; sessions?: number; users?: number }>} />
                ) : chartData.length > 0 ? (
                  <SimpleLineIndicator data={chartData as Array<{ date: string; sessions?: number; users?: number }>} />
                ) : (
                  <EmptyState 
                    message={ga4Status.connected ? "載入 GA4 數據中..." : "連結 GA4 以查看流量數據"}
                    action={!ga4Status.connected && (
                      <Button size="sm" onClick={handleConnectGA4}>
                        連結 GA4
                      </Button>
                    )}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Platform Performance */}
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-pink-400" />
                    社群平台表現
                  </CardTitle>
                  <CardDescription>各平台的觸及與互動數據</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {platformsData.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {platformsData.map((platform, index) => (
                    <PlatformCard key={index} platform={platform} />
                  ))}
                </div>
              ) : (
                <EmptyState 
                  message="尚未連結任何社群平台"
                  action={
                    <Button variant="outline" onClick={() => window.location.href = "/dashboard/profile"}>
                      前往連結帳號
                    </Button>
                  }
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-6">
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Target className="w-5 h-5 text-amber-400" />
                    熱門內容排行
                  </CardTitle>
                  <CardDescription>表現最佳的內容列表</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select defaultValue="views">
                    <SelectTrigger className="w-[120px] h-8 bg-slate-800/50 border-slate-700 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="views">依觀看數</SelectItem>
                      <SelectItem value="engagement">依互動數</SelectItem>
                      <SelectItem value="clicks">依點擊數</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {contentPerformance.length > 0 ? (
                contentPerformance.slice(0, 10).map((content) => (
                  <ContentRow key={content.id} content={content} />
                ))
              ) : (
                <EmptyState message="尚無內容表現數據" />
              )}
            </CardContent>
          </Card>

          {/* Content Type Distribution */}
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-400" />
                  部落格文章
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <p className="text-4xl font-bold text-white">
                    {dashboardData?.publish_stats?.by_platform?.wordpress || 0}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">已發布文章</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-pink-400" />
                  社群圖文
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <p className="text-4xl font-bold text-white">
                    {(dashboardData?.publish_stats?.by_platform?.instagram || 0) + 
                     (dashboardData?.publish_stats?.by_platform?.facebook || 0)}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">已發布貼文</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Youtube className="w-4 h-4 text-red-400" />
                  短影音
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <p className="text-4xl font-bold text-white">
                    {(dashboardData?.publish_stats?.by_platform?.youtube || 0) + 
                     (dashboardData?.publish_stats?.by_platform?.tiktok || 0)}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">已發布影片</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Traffic Tab */}
        <TabsContent value="traffic" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Traffic Sources */}
            <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-purple-400" />
                  流量來源分布
                </CardTitle>
                <CardDescription>網站訪客的來源管道</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {trafficSources.length > 0 ? (
                  trafficSources.slice(0, 8).map((source, index) => (
                    <TrafficSourceBar key={index} source={source} rank={index + 1} />
                  ))
                ) : (
                  <EmptyState 
                    message={ga4Status.connected ? "載入流量來源數據中..." : "連結 GA4 以查看流量來源"}
                    action={!ga4Status.connected && (
                      <Button size="sm" onClick={handleConnectGA4}>
                        連結 GA4
                      </Button>
                    )}
                  />
                )}
              </CardContent>
            </Card>

            {/* Key Metrics */}
            <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <LineChartIcon className="w-5 h-5 text-cyan-400" />
                  關鍵指標
                </CardTitle>
                <CardDescription>GA4 核心數據摘要</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-800/50 rounded-xl text-center">
                    <p className="text-3xl font-bold text-white">
                      {trafficData?.totals?.sessions ? formatNumber(trafficData.totals.sessions) : "-"}
                    </p>
                    <p className="text-sm text-slate-400 mt-1">總工作階段</p>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-xl text-center">
                    <p className="text-3xl font-bold text-white">
                      {trafficData?.totals?.users ? formatNumber(trafficData.totals.users) : "-"}
                    </p>
                    <p className="text-sm text-slate-400 mt-1">總用戶數</p>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-xl text-center">
                    <p className="text-3xl font-bold text-white">
                      {trafficData?.totals?.pageviews ? formatNumber(trafficData.totals.pageviews) : "-"}
                    </p>
                    <p className="text-sm text-slate-400 mt-1">總瀏覽頁數</p>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-xl text-center">
                    <p className="text-3xl font-bold text-white">
                      {trafficData?.totals?.new_users ? formatNumber(trafficData.totals.new_users) : "-"}
                    </p>
                    <p className="text-sm text-slate-400 mt-1">新用戶數</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Device & Location */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white text-base">裝置分布</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                          <line x1="12" y1="18" x2="12.01" y2="18"></line>
                        </svg>
                      </div>
                      <span className="text-sm text-white">行動裝置</span>
                    </div>
                    <span className="text-sm font-semibold text-white">-</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/10 rounded-lg">
                        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                          <line x1="8" y1="21" x2="16" y2="21"></line>
                          <line x1="12" y1="17" x2="12" y2="21"></line>
                        </svg>
                      </div>
                      <span className="text-sm text-white">桌面電腦</span>
                    </div>
                    <span className="text-sm font-semibold text-white">-</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
                          <line x1="12" y1="18" x2="12.01" y2="18"></line>
                        </svg>
                      </div>
                      <span className="text-sm text-white">平板電腦</span>
                    </div>
                    <span className="text-sm font-semibold text-white">-</span>
                  </div>
                </div>
                {!ga4Status.connected && (
                  <p className="text-xs text-slate-500 text-center mt-4">連結 GA4 以查看裝置數據</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white text-base">熱門地區</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { region: "台灣", flag: "🇹🇼" },
                    { region: "香港", flag: "🇭🇰" },
                    { region: "美國", flag: "🇺🇸" },
                    { region: "日本", flag: "🇯🇵" },
                  ].map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{item.flag}</span>
                        <span className="text-sm text-white">{item.region}</span>
                      </div>
                      <span className="text-sm font-semibold text-white">-</span>
                    </div>
                  ))}
                </div>
                {!ga4Status.connected && (
                  <p className="text-xs text-slate-500 text-center mt-4">連結 GA4 以查看地區數據</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
