"use client";

import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3, TrendingUp, Eye, Users, Heart, MessageCircle,
  Share2, Sparkles, RefreshCw, Loader2, Calendar, Globe,
  ArrowUp, ArrowDown, Minus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ==================== 類型定義 ====================
interface PerformanceSummary {
  period_days: number;
  total_impressions: number;
  total_reach: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_saves: number;
  total_clicks: number;
  total_views: number;
  avg_engagement_rate: number;
  total_posts_tracked: number;
}

interface PlatformBreakdown {
  platform: string;
  total_impressions: number;
  total_reach: number;
  total_likes: number;
  total_comments: number;
  avg_engagement_rate: number;
  post_count: number;
}

// ==================== 配置常數 ====================
const PLATFORMS: Record<string, { name: string; icon: string; color: string }> = {
  instagram: { name: "Instagram", icon: "📸", color: "from-purple-500 to-pink-500" },
  facebook: { name: "Facebook", icon: "📘", color: "from-blue-600 to-blue-400" },
  tiktok: { name: "TikTok", icon: "🎵", color: "from-slate-800 to-slate-600" },
  threads: { name: "Threads", icon: "🧵", color: "from-slate-700 to-slate-500" },
  linkedin: { name: "LinkedIn", icon: "💼", color: "from-blue-700 to-blue-500" },
  youtube: { name: "YouTube", icon: "📺", color: "from-red-600 to-red-400" },
  wordpress: { name: "WordPress", icon: "📝", color: "from-blue-500 to-cyan-500" },
};

const TIME_RANGES = [
  { value: "7", label: "過去 7 天" },
  { value: "14", label: "過去 14 天" },
  { value: "30", label: "過去 30 天" },
  { value: "90", label: "過去 90 天" },
];

// ==================== 主組件 ====================
export default function AnalyticsPage() {
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [platforms, setPlatforms] = useState<PlatformBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [timeRange, setTimeRange] = useState("30");

  // 載入數據
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, platformsRes] = await Promise.all([
        api.get(`/scheduler/performance/summary?days=${timeRange}`),
        api.get(`/scheduler/performance/platforms?days=${timeRange}`),
      ]);
      setSummary(summaryRes.data);
      setPlatforms(platformsRes.data);
    } catch (error: any) {
      toast.error("載入數據失敗");
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 同步所有數據
  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const res = await api.post("/scheduler/performance/sync-all");
      toast.success(`同步完成: ${res.data.success} 成功, ${res.data.failed} 失敗`);
      fetchData();
    } catch (error: any) {
      toast.error("同步失敗");
    } finally {
      setSyncing(false);
    }
  };

  // 格式化數字
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toLocaleString();
  };

  // ==================== 渲染 ====================
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            成效分析
          </h1>
          <p className="text-slate-400 mt-1">追蹤您的內容在各社群平台的表現</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px] bg-slate-800 border-slate-600 text-white">
              <Calendar className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {TIME_RANGES.map((range) => (
                <SelectItem
                  key={range.value}
                  value={range.value}
                  className="text-slate-200 focus:bg-slate-700 focus:text-white"
                >
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleSyncAll}
            disabled={syncing}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
          >
            {syncing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                同步中...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                同步數據
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 整體摘要 */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-slate-400">總曝光</span>
              </div>
              <p className="text-2xl font-bold text-white">{formatNumber(summary.total_impressions)}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-slate-400">總觸及</span>
              </div>
              <p className="text-2xl font-bold text-white">{formatNumber(summary.total_reach)}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-emerald-300">平均互動率</span>
              </div>
              <p className="text-2xl font-bold text-emerald-400">{summary.avg_engagement_rate.toFixed(2)}%</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                <span className="text-xs text-slate-400">追蹤貼文</span>
              </div>
              <p className="text-2xl font-bold text-white">{summary.total_posts_tracked}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 互動詳情 */}
      {summary && (
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="border-b border-slate-700">
            <CardTitle className="text-white flex items-center gap-2">
              <Heart className="w-5 h-5 text-pink-400" />
              互動總覽
            </CardTitle>
            <CardDescription className="text-slate-400">
              過去 {summary.period_days} 天的總互動數據
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 text-center">
                <Heart className="w-6 h-6 text-pink-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{formatNumber(summary.total_likes)}</p>
                <p className="text-xs text-slate-400 mt-1">按讚</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 text-center">
                <MessageCircle className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{formatNumber(summary.total_comments)}</p>
                <p className="text-xs text-slate-400 mt-1">留言</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 text-center">
                <Share2 className="w-6 h-6 text-green-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{formatNumber(summary.total_shares)}</p>
                <p className="text-xs text-slate-400 mt-1">分享</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 text-center">
                <Sparkles className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{formatNumber(summary.total_saves)}</p>
                <p className="text-xs text-slate-400 mt-1">收藏</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 text-center">
                <Globe className="w-6 h-6 text-violet-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{formatNumber(summary.total_clicks)}</p>
                <p className="text-xs text-slate-400 mt-1">點擊</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 平台分解 */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="border-b border-slate-700">
          <CardTitle className="text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-400" />
            各平台表現
          </CardTitle>
          <CardDescription className="text-slate-400">
            各社群平台的成效分解
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {platforms.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>尚無平台數據</p>
              <p className="text-sm mt-1">發布內容後，成效數據將會顯示在這裡</p>
            </div>
          ) : (
            <div className="space-y-4">
              {platforms.map((platform) => {
                const config = PLATFORMS[platform.platform] || {
                  name: platform.platform,
                  icon: "📊",
                  color: "from-slate-600 to-slate-500",
                };
                return (
                  <div
                    key={platform.platform}
                    className="p-4 rounded-xl bg-slate-800/50 border border-slate-700"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg bg-gradient-to-br", config.color)}>
                          <span className="text-lg">{config.icon}</span>
                        </div>
                        <div>
                          <h3 className="font-medium text-white">{config.name}</h3>
                          <p className="text-xs text-slate-400">{platform.post_count} 篇貼文</p>
                        </div>
                      </div>
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-0">
                        {platform.avg_engagement_rate.toFixed(2)}% 互動率
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-slate-400">曝光</p>
                        <p className="text-lg font-semibold text-white">{formatNumber(platform.total_impressions)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">觸及</p>
                        <p className="text-lg font-semibold text-white">{formatNumber(platform.total_reach)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">按讚</p>
                        <p className="text-lg font-semibold text-white">{formatNumber(platform.total_likes)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">留言</p>
                        <p className="text-lg font-semibold text-white">{formatNumber(platform.total_comments)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
