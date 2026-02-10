"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  BarChart3, TrendingUp, TrendingDown, Eye, Users, MousePointerClick,
  Share2, Heart, MessageCircle, Bookmark, ExternalLink, Calendar,
  ChevronDown, ChevronRight, RefreshCw, Download, Filter, ArrowUpRight, ArrowDownRight,
  Globe, Instagram, Facebook, Linkedin, Twitter, Youtube, Clock,
  Sparkles, Target, Zap, Activity, PieChart, LineChart as LineChartIcon,
  AlertCircle, CheckCircle2, Loader2, Link2, Settings, HelpCircle, Copy, X,
  MonitorSmartphone, Search, MousePointer, ArrowRight, BookOpen, Info
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
    <Card className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50 hover:border-slate-600/50 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/[0.03] to-transparent rounded-full -translate-y-1/2 translate-x-1/2 group-hover:from-white/[0.06] transition-all" />
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">{metric.title}</p>
            <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums">{metric.value}</p>
            <div className="flex items-center gap-1.5 mt-2">
              {isPositive ? (
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
              )}
              <span className={cn("text-xs font-semibold", isPositive ? "text-emerald-400" : "text-red-400")}>
                {isPositive ? "+" : ""}{metric.change}%
              </span>
              <span className="text-xs text-slate-500">{metric.changeLabel}</span>
            </div>
          </div>
          <div className={cn("p-2.5 rounded-xl shrink-0", metric.bgColor)}>
            <Icon className={cn("w-5 h-5", metric.color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SimpleBarChart({ data }: { data: Array<{ date: string; views?: number; impressions?: number }> }) {
  const sliced = data.slice(-7);
  const values = sliced.map(d => d.views || d.impressions || 0);
  const maxValue = Math.max(...values, 1);
  
  return (
    <div className="flex items-end justify-between gap-1.5 sm:gap-2 h-52 px-1">
      {sliced.map((item, index) => {
        const val = item.views || item.impressions || 0;
        const barH = Math.max((val / maxValue) * 150, 4);
        return (
          <div key={index} className="flex-1 flex flex-col items-center gap-1.5 group/bar">
            <span className="text-[10px] sm:text-xs text-slate-400 tabular-nums opacity-70 group-hover/bar:opacity-100 transition-opacity">
              {formatNumber(val)}
            </span>
            <div 
              className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg transition-all duration-500 group-hover/bar:from-indigo-500 group-hover/bar:to-indigo-300 group-hover/bar:shadow-lg group-hover/bar:shadow-indigo-500/20 cursor-pointer"
              style={{ height: `${barH}px` }}
            />
            <span className="text-[10px] sm:text-xs text-slate-500">{item.date.slice(-5)}</span>
          </div>
        );
      })}
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
      <div className="p-4 bg-slate-800/50 rounded-xl border border-red-500/20 hover:border-red-500/40 transition-all">
        <div className="flex items-center gap-3 mb-3">
          <div className={cn("p-2.5 rounded-xl bg-gradient-to-br opacity-50", platform.color)}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-white text-sm">{platformLabel}</h4>
            <p className="text-xs text-red-400 flex items-center gap-1 mt-0.5">
              <AlertCircle className="w-3 h-3" />
              連線錯誤
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-500">請重新連結帳號或稍後再試</p>
      </div>
    );
  }
  
  return (
    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-slate-600/50 hover:shadow-lg hover:shadow-black/20 transition-all duration-200 group">
      <div className="flex items-center gap-3 mb-4">
        <div className={cn("p-2.5 rounded-xl bg-gradient-to-br shadow-lg group-hover:scale-105 transition-transform", platform.color)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-white text-sm">{platformLabel}</h4>
          <p className="text-xs text-slate-400 truncate">
            {platform.username ? `@${platform.username}` : platform.followers > 0 ? `${formatNumber(platform.followers)} 粉絲` : "已連結"}
          </p>
        </div>
        {platform.trend !== 0 && (
          <Badge variant="secondary" className={cn(
            "text-[10px] shrink-0 px-1.5",
            platform.trend >= 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
          )}>
            {platform.trend >= 0 ? <ArrowUpRight className="w-3 h-3 inline mr-0.5" /> : <ArrowDownRight className="w-3 h-3 inline mr-0.5" />}
            {Math.abs(platform.trend)}%
          </Badge>
        )}
      </div>
      
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2.5 bg-slate-900/50 rounded-lg group-hover:bg-slate-900/70 transition-colors">
          <p className="text-base font-bold text-white tabular-nums">{formatNumber(platform.reach)}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">曝光</p>
        </div>
        <div className="text-center p-2.5 bg-slate-900/50 rounded-lg group-hover:bg-slate-900/70 transition-colors">
          <p className="text-base font-bold text-white tabular-nums">{platform.engagement}%</p>
          <p className="text-[10px] text-slate-500 mt-0.5">互動率</p>
        </div>
        <div className="text-center p-2.5 bg-slate-900/50 rounded-lg group-hover:bg-slate-900/70 transition-colors">
          <p className="text-base font-bold text-white tabular-nums">{platform.posts}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">貼文</p>
        </div>
      </div>
      
      {/* 粉絲數顯示 */}
      {platform.followers > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700/30 flex items-center justify-between">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Users className="w-3 h-3" />
            粉絲數
          </span>
          <span className="text-sm font-semibold text-white tabular-nums">{formatNumber(platform.followers)}</span>
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
    <div className="space-y-6 pb-8">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-slate-800 animate-pulse" />
        <div>
          <div className="h-6 w-36 bg-slate-800 rounded animate-pulse" />
          <div className="h-4 w-52 bg-slate-800/60 rounded animate-pulse mt-1.5" />
        </div>
      </div>
      {/* Metrics skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => (
          <Card key={i} className="bg-slate-900 border-slate-800">
            <CardContent className="p-5">
              <div className="h-3 w-16 bg-slate-800 rounded animate-pulse mb-3" />
              <div className="h-8 w-24 bg-slate-800 rounded animate-pulse mb-2" />
              <div className="h-3 w-20 bg-slate-800/60 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Chart skeleton */}
      <div className="grid lg:grid-cols-2 gap-6">
        {[1,2].map(i => (
          <Card key={i} className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="h-4 w-28 bg-slate-800 rounded animate-pulse mb-6" />
              <div className="flex items-end justify-between gap-2 h-40">
                {[40,65,35,80,55,70,45].map((h, j) => (
                  <div key={j} className="flex-1 bg-slate-800 rounded-t animate-pulse" style={{ height: `${h}%` }} />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Centered loading text */}
      <div className="flex flex-col items-center pt-4">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-slate-400 mt-3 text-sm">載入數據中...</p>
      </div>
    </div>
  );
}

function EmptyState({ message, action, icon: IconComponent }: { message: string; action?: React.ReactNode; icon?: React.ElementType }) {
  const Icon = IconComponent || BarChart3;
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="relative mb-3">
        <div className="absolute inset-0 bg-slate-500/10 rounded-full blur-lg" />
        <div className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/50 relative">
          <Icon className="w-7 h-7 text-slate-500" />
        </div>
      </div>
      <p className="text-sm text-slate-400 mb-0.5">{message}</p>
      <p className="text-xs text-slate-500 mb-3">開始發布內容以收集數據</p>
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
  
  // GA4 連接相關
  const [showGA4Tutorial, setShowGA4Tutorial] = useState(false);
  const [showGA4Setup, setShowGA4Setup] = useState(false);
  const [ga4PropertyId, setGa4PropertyId] = useState("");
  const [ga4Saving, setGa4Saving] = useState(false);
  const [ga4Expanded, setGa4Expanded] = useState(false);
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

  // Save GA4 Property ID
  const handleSavePropertyId = async () => {
    const pid = ga4PropertyId.trim();
    if (!pid) {
      toast.error("請輸入 GA4 Property ID");
      return;
    }
    if (!/^\d+$/.test(pid)) {
      toast.error("GA4 Property ID 只能包含數字");
      return;
    }
    setGa4Saving(true);
    try {
      await api.post("/insights/ga4/connect", { property_id: pid });
      toast.success("GA4 Property ID 已儲存，數據將開始同步");
      setShowGA4Setup(false);
      await fetchGA4Status();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "儲存失敗，請先完成 Google 帳號授權");
    } finally {
      setGa4Saving(false);
    }
  };

  // Disconnect GA4
  const handleDisconnectGA4 = async () => {
    if (!confirm("確定要解除 GA4 連結嗎？解除後將無法查看流量數據。")) return;
    try {
      // Find and deactivate GA4 account
      const res = await api.get("/scheduler/accounts");
      const ga4Account = res.data.find((a: any) => a.platform === "ga4");
      if (ga4Account) {
        await api.delete(`/scheduler/accounts/${ga4Account.id}`);
      }
      setGa4Status({ connected: false });
      setTrafficData(null);
      setTrafficSources([]);
      toast.success("已解除 GA4 連結");
    } catch (err) {
      toast.error("解除連結失敗");
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

  // Convert platform data（排除 GA4 等非社群平台）
  const NON_SOCIAL_PLATFORMS = ["ga4"];
  const platformsData: PlatformData[] = dashboardData?.platforms?.filter((p: any) => !NON_SOCIAL_PLATFORMS.includes(p.platform?.toLowerCase())).map((p: any) => ({
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
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20">
              <BarChart3 className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">成效洞察引擎</h1>
              <p className="text-sm text-slate-400 mt-0.5">追蹤您的內容表現與網站流量</p>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px] bg-slate-800/50 border-slate-700 h-9">
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
            className="border-slate-700 hover:bg-slate-800 h-9 w-9"
            title="重新載入數據"
          >
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
          </Button>

          <Button 
            variant="outline"
            size="sm"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="border-slate-700 hover:bg-slate-800 h-9"
            title="從各平台同步最新數據"
          >
            {isSyncing ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Activity className="w-4 h-4 mr-1.5" />
            )}
            {isSyncing ? "同步中..." : "同步數據"}
          </Button>
          
          <Button 
            variant="outline"
            size="sm"
            className="border-slate-700 hover:bg-slate-800 h-9"
            onClick={() => {
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
            <Download className="w-4 h-4 mr-1.5" />
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

      {/* GA4 Connection Section */}
      <Card className={cn(
        "border overflow-hidden transition-all duration-300",
        ga4Status.connected && ga4Status.property_id
          ? "bg-gradient-to-r from-emerald-500/5 to-teal-500/5 border-emerald-500/20"
          : ga4Status.connected
            ? "bg-gradient-to-r from-amber-500/5 to-orange-500/5 border-amber-500/20"
            : "bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5 border-indigo-500/20"
      )}>
        <CardContent className="p-0">
          {/* 主列 */}
          <div className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {/* 圖標 */}
              <div className={cn(
                "p-2.5 rounded-xl shrink-0",
                ga4Status.connected && ga4Status.property_id
                  ? "bg-emerald-500/20"
                  : ga4Status.connected
                    ? "bg-amber-500/20"
                    : "bg-indigo-500/20"
              )}>
                {ga4Status.connected && ga4Status.property_id ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : ga4Status.connected ? (
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                ) : (
                  <BarChart3 className="w-5 h-5 text-indigo-400" />
                )}
              </div>

              {/* 狀態文字 */}
              <div className="flex-1 min-w-0">
                {ga4Status.connected && ga4Status.property_id ? (
                  <>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">Google Analytics 4 已連結</p>
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[10px]">啟用中</Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Property ID: {ga4Status.property_id} · 數據自動同步中</p>
                  </>
                ) : ga4Status.connected ? (
                  <>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">Google 帳號已授權</p>
                      <Badge className="bg-amber-500/20 text-amber-400 border-0 text-[10px]">需設定 Property ID</Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">請設定 GA4 Property ID 以開始接收數據</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-white">串接 Google Analytics 4 以獲得更完整的數據分析</p>
                    <p className="text-xs text-slate-400 mt-0.5">追蹤網站流量、用戶行為、轉換漏斗等更多洞察指標</p>
                  </>
                )}
              </div>

              {/* 操作按鈕 */}
              <div className="flex items-center gap-2 shrink-0">
                {!ga4Status.connected ? (
                  <>
                    <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:text-white h-8 text-xs" onClick={() => setShowGA4Tutorial(true)}>
                      <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                      什麼是 GA4？
                    </Button>
                    <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 h-8 text-xs" onClick={handleConnectGA4}>
                      <Zap className="w-3.5 h-3.5 mr-1.5" />
                      立即串接
                    </Button>
                  </>
                ) : !ga4Status.property_id ? (
                  <>
                    <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:text-white h-8 text-xs" onClick={() => setShowGA4Tutorial(true)}>
                      <HelpCircle className="w-3.5 h-3.5 mr-1.5" />
                      教學
                    </Button>
                    <Button size="sm" className="bg-amber-600 hover:bg-amber-500 h-8 text-xs" onClick={() => { setGa4PropertyId(""); setShowGA4Setup(true); }}>
                      <Settings className="w-3.5 h-3.5 mr-1.5" />
                      設定 Property ID
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white h-8 text-xs" onClick={() => setGa4Expanded(!ga4Expanded)}>
                      <Settings className="w-3.5 h-3.5 mr-1" />
                      管理
                      <ChevronDown className={cn("w-3.5 h-3.5 ml-1 transition-transform", ga4Expanded && "rotate-180")} />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* 已連接展開管理面板 */}
            {ga4Status.connected && ga4Status.property_id && ga4Expanded && (
              <div className="mt-4 pt-3 border-t border-slate-700/30">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg text-xs">
                    <span className="text-slate-400">Property ID:</span>
                    <span className="text-white font-mono">{ga4Status.property_id}</span>
                    <button 
                      onClick={() => { navigator.clipboard.writeText(ga4Status.property_id || ""); toast.success("已複製"); }}
                      className="text-slate-500 hover:text-white transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <Button size="sm" variant="outline" className="border-slate-600 h-7 text-[11px]" onClick={() => { setGa4PropertyId(ga4Status.property_id || ""); setShowGA4Setup(true); }}>
                    更換 Property ID
                  </Button>
                  <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-7 text-[11px]" onClick={handleDisconnectGA4}>
                    解除連結
                  </Button>
                  <Button size="sm" variant="ghost" className="text-slate-400 h-7 text-[11px]" onClick={() => setShowGA4Tutorial(true)}>
                    <BookOpen className="w-3 h-3 mr-1" />
                    GA4 使用教學
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* 未連接時：快速介紹區塊 */}
          {!ga4Status.connected && (
            <div className="border-t border-slate-700/20 bg-slate-800/20 px-4 py-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { icon: Eye, label: "流量追蹤", desc: "即時掌握網站訪客數與瀏覽量", color: "text-blue-400" },
                  { icon: Search, label: "來源分析", desc: "了解用戶從哪裡找到您", color: "text-purple-400" },
                  { icon: MousePointer, label: "行為洞察", desc: "分析用戶在網站上的互動", color: "text-emerald-400" },
                ].map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div key={idx} className="flex items-start gap-2.5">
                      <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", item.color)} />
                      <div>
                        <p className="text-xs font-medium text-white">{item.label}</p>
                        <p className="text-[11px] text-slate-500">{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* GA4 教學彈窗 */}
      <Dialog open={showGA4Tutorial} onOpenChange={setShowGA4Tutorial}>
        <DialogContent className="sm:max-w-[600px] bg-slate-900 border-slate-700 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              什麼是 Google Analytics 4？
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              了解 GA4 如何幫助您洞察網站與社群平台的成效
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            {/* 簡介 */}
            <div className="p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
              <p className="text-sm text-slate-300 leading-relaxed">
                <span className="font-semibold text-white">Google Analytics 4 (GA4)</span> 是 Google 提供的免費網站分析工具。
                它能幫助您追蹤網站訪客行為、流量來源、用戶互動等重要數據，讓您做出更好的內容策略決策。
              </p>
            </div>

            {/* GA4 能做什麼 */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                GA4 能幫您做什麼？
              </h3>
              <div className="grid gap-3">
                {[
                  {
                    icon: Eye, color: "text-blue-400", bg: "bg-blue-500/10",
                    title: "網站流量監控",
                    desc: "即時查看網站訪客數、瀏覽量、工作階段數，了解您的網站有多少人在瀏覽。"
                  },
                  {
                    icon: Search, color: "text-purple-400", bg: "bg-purple-500/10",
                    title: "流量來源分析",
                    desc: "了解訪客從哪裡來：社群媒體（Facebook、Instagram）、搜尋引擎（Google）、直接訪問、或其他推薦連結。"
                  },
                  {
                    icon: MousePointer, color: "text-emerald-400", bg: "bg-emerald-500/10",
                    title: "用戶行為追蹤",
                    desc: "分析訪客在網站上的行為：最熱門的頁面、停留時間、跳出率等，找到最受歡迎的內容。"
                  },
                  {
                    icon: MonitorSmartphone, color: "text-cyan-400", bg: "bg-cyan-500/10",
                    title: "裝置與地區分布",
                    desc: "了解訪客使用什麼裝置（手機/電腦/平板）、來自哪個地區，優化您的內容策略。"
                  },
                  {
                    icon: Share2, color: "text-pink-400", bg: "bg-pink-500/10",
                    title: "社群平台成效回饋",
                    desc: "追蹤從社群平台導入的流量，評估每次發文帶來多少網站訪客，衡量社群經營的實際效果。"
                  },
                  {
                    icon: Target, color: "text-amber-400", bg: "bg-amber-500/10",
                    title: "轉換追蹤",
                    desc: "設定目標追蹤（如：填寫表單、完成購買），了解哪些內容真正帶來轉換。"
                  },
                ].map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div key={idx} className="flex gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/30">
                      <div className={cn("p-2 rounded-lg shrink-0 h-fit", item.bg)}>
                        <Icon className={cn("w-4 h-4", item.color)} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{item.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 串接步驟 */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-400" />
                如何串接 GA4？
              </h3>
              <div className="space-y-2.5">
                {[
                  { step: "1", title: "建立 GA4 資源", desc: "前往 Google Analytics 管理後台 → 建立帳戶 → 建立資源（選擇「網站」）" },
                  { step: "2", title: "安裝追蹤碼", desc: "將 GA4 提供的追蹤碼（gtag.js）安裝到您的網站 <head> 中，或使用 Google Tag Manager" },
                  { step: "3", title: "取得 Property ID", desc: "在 GA4 管理後台 → 資源設定 → 複製「資源 ID」（僅數字部分，例如：123456789）" },
                  { step: "4", title: "在此串接", desc: "點擊「立即串接」授權 Google 帳號，然後輸入 Property ID 即可開始接收數據" },
                ].map((item) => (
                  <div key={item.step} className="flex gap-3 items-start">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-white">{item.step}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 快速連結 */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="border-slate-600 text-slate-300 flex-1"
                onClick={() => window.open("https://analytics.google.com/", "_blank")}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                前往 Google Analytics
              </Button>
              {!ga4Status.connected ? (
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 flex-1" onClick={() => { setShowGA4Tutorial(false); handleConnectGA4(); }}>
                  <Zap className="w-3.5 h-3.5 mr-1.5" />
                  立即串接 GA4
                </Button>
              ) : !ga4Status.property_id ? (
                <Button size="sm" className="bg-amber-600 hover:bg-amber-500 flex-1" onClick={() => { setShowGA4Tutorial(false); setGa4PropertyId(""); setShowGA4Setup(true); }}>
                  <Settings className="w-3.5 h-3.5 mr-1.5" />
                  設定 Property ID
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-400 flex-1" onClick={() => setShowGA4Tutorial(false)}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  已完成串接
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* GA4 Property ID 設定彈窗 */}
      <Dialog open={showGA4Setup} onOpenChange={setShowGA4Setup}>
        <DialogContent className="sm:max-w-[480px] bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-400" />
              設定 GA4 Property ID
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              輸入您的 GA4 資源 ID 以開始接收網站分析數據
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* 如何取得 */}
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/30">
              <p className="text-xs font-medium text-slate-300 mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-400" />
                如何取得 Property ID？
              </p>
              <ol className="text-xs text-slate-400 space-y-1.5 ml-5 list-decimal">
                <li>前往 <a href="https://analytics.google.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Google Analytics</a> 管理後台</li>
                <li>點擊左下角「管理」齒輪圖標</li>
                <li>在「資源」欄位 → 「資源設定」</li>
                <li>複製「資源 ID」（僅數字部分，例如：<span className="font-mono text-white">123456789</span>）</li>
              </ol>
            </div>

            {/* 輸入 Property ID */}
            <div>
              <label className="text-sm text-slate-300 mb-1.5 block">Property ID</label>
              <div className="flex gap-2">
                <Input
                  placeholder="例如：123456789"
                  value={ga4PropertyId}
                  onChange={(e) => setGa4PropertyId(e.target.value.replace(/\D/g, ""))}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 font-mono"
                  onKeyDown={(e) => e.key === "Enter" && handleSavePropertyId()}
                />
                <Button 
                  onClick={handleSavePropertyId}
                  disabled={ga4Saving || !ga4PropertyId.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 shrink-0"
                >
                  {ga4Saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "儲存"}
                </Button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">Property ID 只包含數字，通常為 9-10 位數</p>
            </div>

            {/* 說明 */}
            <div className="p-3 bg-amber-500/5 rounded-lg border border-amber-500/15">
              <p className="text-xs text-amber-400/80 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>請確保此 GA4 資源已在您的網站上安裝追蹤碼（gtag.js），否則將無法收到數據。</span>
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <MetricCardComponent key={index} metric={metric} />
        ))}
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-800/50 border border-slate-700/50 p-1 h-11 w-full sm:w-auto">
          <TabsTrigger value="overview" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white px-4 py-2 whitespace-nowrap gap-2">
            <Activity className="w-4 h-4" />
            <span>總覽</span>
          </TabsTrigger>
          <TabsTrigger value="content" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white px-4 py-2 whitespace-nowrap gap-2">
            <PieChart className="w-4 h-4" />
            <span>內容表現</span>
          </TabsTrigger>
          <TabsTrigger value="traffic" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white px-4 py-2 whitespace-nowrap gap-2">
            <Globe className="w-4 h-4" />
            <span>流量分析</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Views Chart */}
            <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50 overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white flex items-center gap-2 text-base">
                      <Eye className="w-4.5 h-4.5 text-blue-400" />
                      觀看數趨勢
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">內容觀看數變化</CardDescription>
                  </div>
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 text-[10px]">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    即時數據
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                {chartData.length > 0 ? (
                  <SimpleBarChart data={chartData as Array<{ date: string; views?: number; impressions?: number }>} />
                ) : (
                  <EmptyState message="尚無觀看數據" />
                )}
              </CardContent>
            </Card>

            {/* Sessions Chart */}
            <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50 overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white flex items-center gap-2 text-base">
                      <Users className="w-4.5 h-4.5 text-emerald-400" />
                      網站工作階段
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">訪客數變化趨勢</CardDescription>
                  </div>
                  <Badge variant="secondary" className={cn(
                    "text-[10px]",
                    ga4Status.connected ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-500/20 text-slate-400"
                  )}>
                    {ga4Status.connected ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        GA4 已連結
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
              <CardContent className="pt-2">
                {trafficData?.daily && trafficData.daily.length > 0 ? (
                  <SimpleLineIndicator data={trafficData.daily as Array<{ date: string; sessions?: number; users?: number }>} />
                ) : chartData.length > 0 ? (
                  <SimpleLineIndicator data={chartData as Array<{ date: string; sessions?: number; users?: number }>} />
                ) : (
                  <EmptyState 
                    message={ga4Status.connected && ga4Status.property_id ? "載入 GA4 數據中..." : ga4Status.connected ? "請設定 Property ID 以查看數據" : "串接 GA4 以查看流量數據"}
                    action={!ga4Status.connected ? (
                      <Button size="sm" variant="outline" className="border-slate-600" onClick={handleConnectGA4}>
                        <Zap className="w-3.5 h-3.5 mr-1.5" />
                        串接 GA4
                      </Button>
                    ) : !ga4Status.property_id ? (
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-500" onClick={() => { setGa4PropertyId(""); setShowGA4Setup(true); }}>
                        <Settings className="w-3.5 h-3.5 mr-1.5" />
                        設定 Property ID
                      </Button>
                    ) : null}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Platform Performance */}
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2 text-base">
                    <Share2 className="w-4.5 h-4.5 text-pink-400" />
                    社群平台表現
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">各平台的觸及與互動數據</CardDescription>
                </div>
                {platformsData.length > 0 && (
                  <Badge variant="secondary" className="bg-slate-700/50 text-slate-400 text-[10px]">
                    {platformsData.length} 個平台
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {platformsData.length > 0 ? (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {platformsData.map((platform, index) => (
                    <PlatformCard key={index} platform={platform} />
                  ))}
                </div>
              ) : (
                <EmptyState 
                  message="尚未連結任何社群平台"
                  icon={Share2}
                  action={
                    <Button variant="outline" size="sm" className="border-slate-600" onClick={() => window.location.href = "/dashboard/accounts"}>
                      <Link2 className="w-3.5 h-3.5 mr-1.5" />
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
          {/* Content Type Distribution Summary */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { 
                label: "部落格文章", icon: Globe, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20",
                count: dashboardData?.publish_stats?.by_platform?.wordpress || 0, unit: "篇文章"
              },
              { 
                label: "社群圖文", icon: Share2, color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20",
                count: (dashboardData?.publish_stats?.by_platform?.instagram || 0) + (dashboardData?.publish_stats?.by_platform?.facebook || 0), unit: "篇貼文"
              },
              { 
                label: "短影音", icon: Youtube, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20",
                count: (dashboardData?.publish_stats?.by_platform?.youtube || 0) + (dashboardData?.publish_stats?.by_platform?.tiktok || 0), unit: "部影片"
              },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <Card key={idx} className={cn("bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50 hover:shadow-lg transition-all", item.border)}>
                  <CardContent className="p-4 sm:p-5 text-center">
                    <div className={cn("inline-flex p-2 rounded-xl mb-3", item.bg)}>
                      <Icon className={cn("w-5 h-5", item.color)} />
                    </div>
                    <p className="text-3xl sm:text-4xl font-bold text-white tabular-nums">{item.count}</p>
                    <p className="text-xs text-slate-400 mt-1">{item.label}</p>
                    <p className="text-[10px] text-slate-500">{item.unit}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Content Ranking */}
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-white flex items-center gap-2 text-base">
                    <Target className="w-4.5 h-4.5 text-amber-400" />
                    熱門內容排行
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">表現最佳的內容列表</CardDescription>
                </div>
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
            </CardHeader>
            <CardContent className="space-y-2">
              {contentPerformance.length > 0 ? (
                contentPerformance.slice(0, 10).map((content) => (
                  <ContentRow key={content.id} content={content} />
                ))
              ) : (
                <EmptyState message="尚無內容表現數據" icon={Target} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Traffic Tab */}
        <TabsContent value="traffic" className="space-y-6">
          {/* GA4 Key Metrics Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "總工作階段", value: trafficData?.totals?.sessions, icon: Activity, color: "text-indigo-400", bg: "bg-indigo-500/10" },
              { label: "總用戶數", value: trafficData?.totals?.users, icon: Users, color: "text-emerald-400", bg: "bg-emerald-500/10" },
              { label: "總瀏覽頁數", value: trafficData?.totals?.pageviews, icon: Eye, color: "text-blue-400", bg: "bg-blue-500/10" },
              { label: "新用戶數", value: trafficData?.totals?.new_users, icon: Sparkles, color: "text-amber-400", bg: "bg-amber-500/10" },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <Card key={idx} className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50">
                  <CardContent className="p-4 text-center">
                    <div className={cn("inline-flex p-2 rounded-lg mb-2", item.bg)}>
                      <Icon className={cn("w-4 h-4", item.color)} />
                    </div>
                    <p className="text-2xl font-bold text-white tabular-nums">
                      {item.value ? formatNumber(item.value) : "-"}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{item.label}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Traffic Sources */}
            <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2 text-base">
                  <PieChart className="w-4.5 h-4.5 text-purple-400" />
                  流量來源分布
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">網站訪客的來源管道</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {trafficSources.length > 0 ? (
                  trafficSources.slice(0, 8).map((source, index) => (
                    <TrafficSourceBar key={index} source={source} rank={index + 1} />
                  ))
                ) : (
                  <EmptyState 
                    message={ga4Status.connected && ga4Status.property_id ? "載入流量來源數據中..." : ga4Status.connected ? "請設定 Property ID 以查看數據" : "串接 GA4 以查看流量來源"}
                    icon={PieChart}
                    action={!ga4Status.connected ? (
                      <Button size="sm" variant="outline" className="border-slate-600" onClick={handleConnectGA4}>
                        <Zap className="w-3.5 h-3.5 mr-1.5" />
                        串接 GA4
                      </Button>
                    ) : !ga4Status.property_id ? (
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-500" onClick={() => { setGa4PropertyId(""); setShowGA4Setup(true); }}>
                        <Settings className="w-3.5 h-3.5 mr-1.5" />
                        設定 Property ID
                      </Button>
                    ) : null}
                  />
                )}
              </CardContent>
            </Card>

            {/* Device & Location */}
            <div className="space-y-6">
              <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Settings className="w-4 h-4 text-slate-400" />
                    裝置分布
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { label: "行動裝置", color: "text-blue-400", bg: "bg-blue-500/10",
                        svg: <><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></> },
                      { label: "桌面電腦", color: "text-purple-400", bg: "bg-purple-500/10",
                        svg: <><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></> },
                      { label: "平板電腦", color: "text-emerald-400", bg: "bg-emerald-500/10",
                        svg: <><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></> },
                    ].map((device, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-800/50 rounded-lg hover:bg-slate-800/70 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <div className={cn("p-1.5 rounded-lg", device.bg)}>
                            <svg className={cn("w-3.5 h-3.5", device.color)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              {device.svg}
                            </svg>
                          </div>
                          <span className="text-sm text-white">{device.label}</span>
                        </div>
                        <span className="text-sm font-semibold text-slate-400 tabular-nums">-</span>
                      </div>
                    ))}
                  </div>
                  {!ga4Status.connected && (
                    <p className="text-[10px] text-slate-500 text-center mt-3">串接 GA4 以查看裝置數據</p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Globe className="w-4 h-4 text-cyan-400" />
                    熱門地區
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { region: "台灣", flag: "🇹🇼" },
                      { region: "香港", flag: "🇭🇰" },
                      { region: "美國", flag: "🇺🇸" },
                      { region: "日本", flag: "🇯🇵" },
                    ].map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-2.5 bg-slate-800/50 rounded-lg hover:bg-slate-800/70 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">{item.flag}</span>
                          <span className="text-sm text-white">{item.region}</span>
                        </div>
                        <span className="text-sm font-semibold text-slate-400 tabular-nums">-</span>
                      </div>
                    ))}
                  </div>
                  {!ga4Status.connected && (
                    <p className="text-[10px] text-slate-500 text-center mt-3">串接 GA4 以查看地區數據</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
