"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Calendar, Clock, ArrowLeft, Image as ImageIcon, FileText, Video, 
  CheckCircle2, XCircle, AlertCircle, Loader2, RefreshCw, Trash2,
  Eye, Edit, ExternalLink, TrendingUp, Users, Heart, MessageCircle,
  Share2, BarChart3, Play, Send, Link2, Globe, Hash, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ==================== 類型定義 ====================
interface ScheduledPost {
  id: number;
  user_id: number;
  social_account_id: number | null;
  content_type: string;
  title: string | null;
  caption: string | null;
  media_urls: string[];
  hashtags: string[];
  scheduled_at: string;
  timezone: string;
  status: string;
  published_at: string | null;
  platform_post_url: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  settings?: {
    platform?: string;
    publish_type?: "immediate" | "scheduled";
    [key: string]: any;
  };
}

interface PostInsights {
  impressions: number;
  reach: number;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  saves: number;
  views: number;
  engagement_rate: number;
  watch_time_seconds: number;
  avg_watch_time_seconds: number;
  video_completion_rate: number;
  followers_gained: number;
  net_followers: number;
  platform: string | null;
  metric_date: string | null;
  last_synced_at: string | null;
  sync_status: string;
  note?: string | null;
  data_source?: string;
  ga4_connected?: boolean;
}

// ==================== 配置常數 ====================
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any; description: string }> = {
  pending: { 
    label: "待發布", 
    color: "text-yellow-400", 
    bgColor: "bg-yellow-500/20 border-yellow-500/30",
    icon: Clock,
    description: "排程已設定，等待發布時間"
  },
  queued: { 
    label: "排隊中", 
    color: "text-blue-400", 
    bgColor: "bg-blue-500/20 border-blue-500/30",
    icon: Clock,
    description: "已加入發布佇列，即將發布"
  },
  publishing: { 
    label: "發布中", 
    color: "text-indigo-400", 
    bgColor: "bg-indigo-500/20 border-indigo-500/30",
    icon: Loader2,
    description: "正在發布到社群平台"
  },
  published: { 
    label: "已發布", 
    color: "text-green-400", 
    bgColor: "bg-green-500/20 border-green-500/30",
    icon: CheckCircle2,
    description: "已成功發布到社群平台"
  },
  failed: { 
    label: "發布失敗", 
    color: "text-red-400", 
    bgColor: "bg-red-500/20 border-red-500/30",
    icon: XCircle,
    description: "發布過程中發生錯誤"
  },
  cancelled: { 
    label: "已取消", 
    color: "text-slate-400", 
    bgColor: "bg-slate-500/20 border-slate-500/30",
    icon: XCircle,
    description: "排程已被取消"
  },
};

const CONTENT_TYPES: Record<string, { label: string; icon: any; color: string; route: string }> = {
  social_image: { label: "社群圖文", icon: ImageIcon, color: "from-pink-500 to-rose-500", route: "/dashboard/social" },
  blog_post: { label: "部落格文章", icon: FileText, color: "from-blue-500 to-cyan-500", route: "/dashboard/blog" },
  short_video: { label: "短影音", icon: Video, color: "from-purple-500 to-indigo-500", route: "/dashboard/video" },
};

const PLATFORMS: Record<string, { name: string; icon: string; color: string }> = {
  instagram: { name: "Instagram", icon: "📸", color: "from-purple-500 to-pink-500" },
  facebook: { name: "Facebook", icon: "📘", color: "from-blue-600 to-blue-400" },
  tiktok: { name: "TikTok", icon: "🎵", color: "from-slate-900 to-slate-700" },
  threads: { name: "Threads", icon: "🧵", color: "from-slate-800 to-slate-600" },
  linkedin: { name: "LinkedIn", icon: "💼", color: "from-blue-700 to-blue-500" },
  youtube: { name: "YouTube", icon: "📺", color: "from-red-600 to-red-400" },
  line: { name: "LINE", icon: "💬", color: "from-green-500 to-emerald-400" },
};

// ==================== 主組件 ====================
export default function ScheduleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params.id as string;
  
  const [post, setPost] = useState<ScheduledPost | null>(null);
  const [insights, setInsights] = useState<PostInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState({
    title: "",
    caption: "",
    scheduled_at: "",
  });

  // 載入排程資料
  const fetchPost = useCallback(async () => {
    try {
      const res = await api.get(`/scheduler/posts/${postId}`);
      setPost(res.data);
      setEditData({
        title: res.data.title || "",
        caption: res.data.caption || "",
        scheduled_at: res.data.scheduled_at ? new Date(res.data.scheduled_at).toISOString().slice(0, 16) : "",
      });
      
      // 如果已發布，嘗試載入成效數據
      if (res.data.status === "published") {
        try {
          const insightsRes = await api.get(`/scheduler/posts/${postId}/insights`);
          setInsights(insightsRes.data);
        } catch (e) {
          // 成效數據可能不存在，忽略錯誤
          console.log("No insights available");
        }
      }
    } catch (error: any) {
      toast.error("載入失敗");
      router.push("/dashboard/scheduler");
    } finally {
      setLoading(false);
    }
  }, [postId, router]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  // 操作函數
  const handleSave = async () => {
    if (!post) return;
    setSaving(true);
    try {
      await api.put(`/scheduler/posts/${post.id}`, {
        title: editData.title,
        caption: editData.caption,
        scheduled_at: new Date(editData.scheduled_at).toISOString(),
      });
      toast.success("已儲存變更");
      setEditing(false);
      fetchPost();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!post || !confirm("確定要取消此排程嗎？")) return;
    try {
      await api.post(`/scheduler/posts/${post.id}/cancel`);
      toast.success("排程已取消");
      fetchPost();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "取消失敗");
    }
  };

  const handleRetry = async () => {
    if (!post) return;
    try {
      await api.post(`/scheduler/posts/${post.id}/retry`);
      toast.success("已加入重試佇列");
      fetchPost();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "重試失敗");
    }
  };

  const handleDelete = async () => {
    if (!post || !confirm("確定要刪除此排程嗎？此操作無法復原。")) return;
    try {
      await api.delete(`/scheduler/posts/${post.id}`);
      toast.success("排程已刪除");
      router.push("/dashboard/scheduler");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "刪除失敗");
    }
  };

  const handlePublishNow = async () => {
    if (!post || !confirm("確定要立即發布嗎？")) return;
    try {
      const res = await api.post(`/scheduler/posts/${post.id}/publish-now`);
      const data = res.data;
      if (data.platform_post_url) {
        toast.success(
          `發布成功！已發布至 ${data.platform || "社群平台"}`,
          { duration: 6000 }
        );
      } else {
        toast.success("發布成功");
      }
      // 重新載入貼文資料（包含 platform_post_url 和更新後的狀態）
      fetchPost();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "發布失敗");
    }
  };

  // ==================== 渲染 ====================
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-slate-500" />
        <p className="text-slate-400">找不到此排程</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/dashboard/scheduler")}
        >
          返回排程列表
        </Button>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[post.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;
  const contentType = CONTENT_TYPES[post.content_type] || CONTENT_TYPES.social_image;
  const ContentIcon = contentType.icon;
  const platform = post.settings?.platform ? PLATFORMS[post.settings.platform] : null;
  const isPublished = post.status === "published";
  const isPending = post.status === "pending" || post.status === "queued";
  const isFailed = post.status === "failed";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* 頂部導航 */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard/scheduler")}
          className="text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回排程列表
        </Button>
        
        <div className="flex items-center gap-2">
          {isPending && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(!editing)}
                className="border-slate-600 text-slate-300"
              >
                <Edit className="w-4 h-4 mr-2" />
                {editing ? "取消編輯" : "編輯"}
              </Button>
              <Button
                size="sm"
                onClick={handlePublishNow}
                className="bg-gradient-to-r from-indigo-600 to-purple-600"
              >
                <Send className="w-4 h-4 mr-2" />
                立即發布
              </Button>
            </>
          )}
          {isFailed && (
            <Button
              size="sm"
              onClick={handleRetry}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              重試發布
            </Button>
          )}
        </div>
      </div>

      {/* 狀態卡片 */}
      <Card className={cn("border-2", statusConfig.bgColor)}>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className={cn("p-4 rounded-2xl", statusConfig.bgColor)}>
              <StatusIcon className={cn("w-8 h-8", statusConfig.color, post.status === "publishing" && "animate-spin")} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h2 className={cn("text-2xl font-bold", statusConfig.color)}>{statusConfig.label}</h2>
                {isPublished && post.published_at && (
                  <span className="text-sm text-slate-400">
                    {new Date(post.published_at).toLocaleString("zh-TW")}
                  </span>
                )}
              </div>
              <p className="text-slate-400">{statusConfig.description}</p>
              {post.error_message && (
                <p className="text-red-400 text-sm mt-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {post.error_message}
                </p>
              )}
            </div>
            {isPublished && post.platform_post_url && (
              <Button
                variant="outline"
                onClick={() => window.open(post.platform_post_url!, "_blank")}
                className="border-green-500/30 text-green-400 hover:bg-green-500/10"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                查看貼文
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左側：內容預覽 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 內容卡片 */}
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="border-b border-slate-700">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <div className={cn("p-2 rounded-lg bg-gradient-to-br", contentType.color)}>
                    <ContentIcon className="w-4 h-4 text-white" />
                  </div>
                  內容預覽
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(contentType.route)}
                  className="text-slate-400 hover:text-white"
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  前往 {contentType.label} 引擎
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">標題</label>
                    <Input
                      value={editData.title}
                      onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                      className="bg-slate-800 border-slate-600 text-white"
                      placeholder="輸入標題..."
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">文案</label>
                    <Textarea
                      value={editData.caption}
                      onChange={(e) => setEditData({ ...editData, caption: e.target.value })}
                      className="bg-slate-800 border-slate-600 text-white min-h-[150px]"
                      placeholder="輸入文案..."
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setEditing(false)}>取消</Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      儲存變更
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* 標題 */}
                  {post.title && (
                    <h3 className="text-xl font-bold text-white mb-4">{post.title}</h3>
                  )}
                  
                  {/* 媒體預覽 */}
                  {post.media_urls && post.media_urls.length > 0 && (
                    <div className="mb-4">
                      {post.content_type === "short_video" ? (
                        <div className="relative aspect-[9/16] max-w-[300px] mx-auto rounded-xl overflow-hidden bg-slate-800">
                          <video
                            src={post.media_urls[0]}
                            className="w-full h-full object-cover"
                            controls
                            poster={post.media_urls[0].replace(".mp4", "_thumb.jpg")}
                          />
                        </div>
                      ) : (
                        <div className={cn(
                          "grid gap-2",
                          post.media_urls.length === 1 && "grid-cols-1",
                          post.media_urls.length === 2 && "grid-cols-2",
                          post.media_urls.length >= 3 && "grid-cols-2 md:grid-cols-3"
                        )}>
                          {post.media_urls.map((url, idx) => (
                            <img
                              key={idx}
                              src={url}
                              alt={`媒體 ${idx + 1}`}
                              className="w-full aspect-square object-cover rounded-lg"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* 文案 */}
                  {post.caption && (
                    <div className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {post.caption}
                    </div>
                  )}
                  
                  {/* Hashtags */}
                  {post.hashtags && post.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-700">
                      {post.hashtags.map((tag, idx) => (
                        <Badge key={idx} className="bg-indigo-500/20 text-indigo-300 border-0">
                          <Hash className="w-3 h-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* 成效洞察（已發布才顯示） */}
          {isPublished && (
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-emerald-400" />
                      成效洞察
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      此貼文的互動數據
                      {insights?.last_synced_at && (
                        <span className="ml-2 text-xs">
                          (最後更新: {new Date(insights.last_synced_at).toLocaleString("zh-TW")})
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await api.post(`/scheduler/posts/${post.id}/sync-metrics`);
                        toast.success("成效數據同步中...");
                        setTimeout(fetchPost, 2000);
                      } catch {
                        toast.error("同步失敗");
                      }
                    }}
                    className="border-slate-600 text-slate-300 hover:bg-slate-800"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    更新數據
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {insights ? (
                  <div className="space-y-6">
                    {/* 數據來源提示 */}
                    {insights.data_source && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">
                          數據來源: <span className="text-slate-400">{insights.data_source}</span>
                        </span>
                        {!insights.ga4_connected && contentType.label === "部落格文章" && (
                          <span className="text-amber-400">
                            連接 GA4 以獲取瀏覽數據
                          </span>
                        )}
                      </div>
                    )}
                    {insights.note && (
                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          {insights.note}
                        </span>
                        {!insights.ga4_connected && contentType.label === "部落格文章" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push("/dashboard/settings/ga4")}
                            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 ml-4"
                          >
                            設定 GA4
                          </Button>
                        )}
                      </div>
                    )}
                    
                    {/* 核心指標 */}
                    <div>
                      <h4 className="text-sm font-medium text-slate-400 mb-3">核心指標</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                          <div className="flex items-center gap-2 mb-2">
                            <Eye className="w-4 h-4 text-blue-400" />
                            <span className="text-xs text-slate-400">曝光次數</span>
                          </div>
                          <p className="text-2xl font-bold text-white">
                            {insights.ga4_connected === false && insights.impressions === 0 ? "N/A" : insights.impressions.toLocaleString()}
                          </p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="w-4 h-4 text-purple-400" />
                            <span className="text-xs text-slate-400">觸及人數</span>
                          </div>
                          <p className="text-2xl font-bold text-white">
                            {insights.ga4_connected === false && insights.reach === 0 ? "N/A" : insights.reach.toLocaleString()}
                          </p>
                        </div>
                        <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30">
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs text-emerald-300">互動率</span>
                          </div>
                          <p className="text-2xl font-bold text-emerald-400">
                            {insights.ga4_connected === false && !insights.engagement_rate ? "N/A" : `${insights.engagement_rate?.toFixed(2) || "0.00"}%`}
                          </p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="w-4 h-4 text-indigo-400" />
                            <span className="text-xs text-slate-400">新增粉絲</span>
                          </div>
                          <p className="text-2xl font-bold text-white">
                            {insights.ga4_connected === false && insights.net_followers === 0 ? "N/A" : (insights.net_followers > 0 ? "+" : "") + insights.net_followers}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* 互動指標 */}
                    <div>
                      <h4 className="text-sm font-medium text-slate-400 mb-3">互動詳情</h4>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                          <div className="flex items-center gap-2 mb-2">
                            <Heart className="w-4 h-4 text-pink-400" />
                            <span className="text-xs text-slate-400">按讚</span>
                          </div>
                          <p className="text-xl font-bold text-white">
                            {insights.ga4_connected === false && insights.likes === 0 ? "N/A" : insights.likes.toLocaleString()}
                          </p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                          <div className="flex items-center gap-2 mb-2">
                            <MessageCircle className="w-4 h-4 text-cyan-400" />
                            <span className="text-xs text-slate-400">留言</span>
                          </div>
                          <p className="text-xl font-bold text-white">
                            {insights.ga4_connected === false && insights.comments === 0 ? "N/A" : insights.comments.toLocaleString()}
                          </p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                          <div className="flex items-center gap-2 mb-2">
                            <Share2 className="w-4 h-4 text-green-400" />
                            <span className="text-xs text-slate-400">分享</span>
                          </div>
                          <p className="text-xl font-bold text-white">
                            {insights.ga4_connected === false && insights.shares === 0 ? "N/A" : insights.shares.toLocaleString()}
                          </p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-4 h-4 text-amber-400" />
                            <span className="text-xs text-slate-400">收藏</span>
                          </div>
                          <p className="text-xl font-bold text-white">
                            {insights.ga4_connected === false && insights.saves === 0 ? "N/A" : insights.saves.toLocaleString()}
                          </p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                          <div className="flex items-center gap-2 mb-2">
                            <Link2 className="w-4 h-4 text-violet-400" />
                            <span className="text-xs text-slate-400">點擊</span>
                          </div>
                          <p className="text-xl font-bold text-white">
                            {insights.ga4_connected === false && insights.clicks === 0 ? "N/A" : insights.clicks.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* 影片指標（僅短影音顯示） */}
                    {post.content_type === "short_video" && insights.views > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-slate-400 mb-3">影片表現</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                            <div className="flex items-center gap-2 mb-2">
                              <Play className="w-4 h-4 text-red-400" />
                              <span className="text-xs text-slate-400">觀看次數</span>
                            </div>
                            <p className="text-xl font-bold text-white">{insights.views.toLocaleString()}</p>
                          </div>
                          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                            <div className="flex items-center gap-2 mb-2">
                              <Clock className="w-4 h-4 text-orange-400" />
                              <span className="text-xs text-slate-400">總觀看時長</span>
                            </div>
                            <p className="text-xl font-bold text-white">
                              {Math.floor(insights.watch_time_seconds / 60)}分{insights.watch_time_seconds % 60}秒
                            </p>
                          </div>
                          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                            <div className="flex items-center gap-2 mb-2">
                              <Clock className="w-4 h-4 text-yellow-400" />
                              <span className="text-xs text-slate-400">平均觀看</span>
                            </div>
                            <p className="text-xl font-bold text-white">
                              {insights.avg_watch_time_seconds?.toFixed(1) || 0}秒
                            </p>
                          </div>
                          <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
                            <div className="flex items-center gap-2 mb-2">
                              <TrendingUp className="w-4 h-4 text-purple-400" />
                              <span className="text-xs text-purple-300">完播率</span>
                            </div>
                            <p className="text-xl font-bold text-purple-400">
                              {insights.video_completion_rate?.toFixed(1) || 0}%
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>成效數據尚未更新</p>
                    <p className="text-sm mt-1">點擊上方「更新數據」按鈕同步最新數據</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* 右側：發布設定 */}
        <div className="space-y-6">
          {/* 排程資訊 */}
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="border-b border-slate-700">
              <CardTitle className="text-white flex items-center gap-2 text-base">
                <Clock className="w-4 h-4 text-indigo-400" />
                排程設定
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* 內容類型 */}
              <div>
                <p className="text-xs text-slate-500 mb-1">內容類型</p>
                <div className="flex items-center gap-2">
                  <div className={cn("p-1.5 rounded-lg bg-gradient-to-br", contentType.color)}>
                    <ContentIcon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-white">{contentType.label}</span>
                </div>
              </div>
              
              {/* 發布平台 */}
              {platform && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">發布平台</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{platform.icon}</span>
                    <span className="text-white">{platform.name}</span>
                  </div>
                </div>
              )}
              
              {/* 排程時間 */}
              <div>
                <p className="text-xs text-slate-500 mb-1">排程時間</p>
                {editing ? (
                  <Input
                    type="datetime-local"
                    value={editData.scheduled_at}
                    onChange={(e) => setEditData({ ...editData, scheduled_at: e.target.value })}
                    className="bg-slate-800 border-slate-600 text-white"
                    min={new Date().toISOString().slice(0, 16)}
                  />
                ) : (
                  <p className="text-white font-medium">
                    {new Date(post.scheduled_at).toLocaleString("zh-TW", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      weekday: "long",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </p>
                )}
              </div>
              
              {/* 時區 */}
              <div>
                <p className="text-xs text-slate-500 mb-1">時區</p>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-300">{post.timezone}</span>
                </div>
              </div>
              
              {/* 建立時間 */}
              <div>
                <p className="text-xs text-slate-500 mb-1">建立時間</p>
                <p className="text-slate-300 text-sm">
                  {new Date(post.created_at).toLocaleString("zh-TW")}
                </p>
              </div>
              
              {/* 重試次數（失敗時顯示） */}
              {post.retry_count > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">重試次數</p>
                  <Badge className="bg-red-500/20 text-red-400 border-0">
                    {post.retry_count} 次
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 操作按鈕 */}
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="border-b border-slate-700">
              <CardTitle className="text-white text-base">操作</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {isPending && (
                <>
                  <Button
                    variant="outline"
                    className="w-full justify-start border-slate-600 text-slate-300 hover:bg-slate-800"
                    onClick={handleCancel}
                  >
                    <XCircle className="w-4 h-4 mr-2 text-yellow-400" />
                    取消排程
                  </Button>
                </>
              )}
              {isFailed && (
                <Button
                  variant="outline"
                  className="w-full justify-start border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                  onClick={handleRetry}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  重試發布
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full justify-start border-red-500/30 text-red-400 hover:bg-red-500/10"
                onClick={handleDelete}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                刪除排程
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
