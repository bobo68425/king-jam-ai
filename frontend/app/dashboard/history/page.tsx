"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Image as ImageIcon,
  FileText,
  Video,
  Sparkles,
  Clock,
  Coins,
  Search,
  Filter,
  Download,
  ExternalLink,
  RefreshCw,
  Trash2,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  LayoutGrid,
  List,
  Play,
  Eye
} from "lucide-react";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";

interface GenerationHistoryItem {
  id: number;
  generation_type: string;
  status: string;
  input_params: Record<string, any>;
  output_data?: Record<string, any>;  // 列表 API 不含此欄位（避免巨大 base64）
  output_caption?: string;  // 列表 API 回傳的輕量 caption
  media_local_path: string | null;
  media_cloud_url: string | null;
  thumbnail_url: string | null;
  credits_used: number;
  generation_duration_ms: number | null;
  file_size_bytes: number | null;
  error_message: string | null;
  created_at: string;
  updated_at?: string | null;
}

interface HistoryResponse {
  items: GenerationHistoryItem[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

type ViewMode = "grid" | "list";

export default function HistoryPage() {
  const [history, setHistory] = useState<GenerationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [isMounted, setIsMounted] = useState(false);  // 追蹤客戶端掛載狀態

  // 客戶端掛載後設定標記（避免 hydration 錯誤）
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 從 localStorage 讀取檢視模式偏好（客戶端載入後）
  useEffect(() => {
    const saved = localStorage.getItem("history_view_mode");
    if (saved === "list" || saved === "grid") {
      setViewMode(saved);
    }
  }, []);

  // 儲存檢視模式偏好
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("history_view_mode", mode);
  };

  useEffect(() => {
    fetchHistory(1, true);
  }, [typeFilter, statusFilter]);

  const fetchHistory = async (pageNum: number, reset: boolean = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        page_size: "20",
      });
      
      if (typeFilter !== "all") {
        params.append("generation_type", typeFilter);
      }
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      const res = await api.get<HistoryResponse>(`/history?${params.toString()}`);
      
      if (reset) {
        setHistory(res.data.items);
      } else {
        setHistory(prev => [...prev, ...res.data.items]);
      }
      
      setTotal(res.data.total);
      setPage(res.data.page);
      setHasMore(res.data.has_more);
    } catch (error) {
      console.error("Failed to fetch history", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchHistory(page + 1, false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "social_image":
        return <ImageIcon className="h-5 w-5 text-pink-400" />;
      case "blog_post":
        return <FileText className="h-5 w-5 text-blue-400" />;
      case "blog_image":
        return <ImageIcon className="h-5 w-5 text-cyan-400" />;
      case "short_video":
        return <Video className="h-5 w-5 text-purple-400" />;
      case "video_script":
        return <FileText className="h-5 w-5 text-indigo-400" />;
      default:
        return <Sparkles className="h-5 w-5 text-amber-400" />;
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case "social_image": return "社群圖文";
      case "blog_post": return "部落格文章";
      case "blog_image": return "部落格封面";
      case "short_video": return "短影片";
      case "video_script": return "影片腳本";
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "social_image": return "bg-pink-500/20 text-pink-400";
      case "blog_post": return "bg-blue-500/20 text-blue-400";
      case "blog_image": return "bg-cyan-500/20 text-cyan-400";
      case "short_video": return "bg-purple-500/20 text-purple-400";
      case "video_script": return "bg-indigo-500/20 text-indigo-400";
      default: return "bg-slate-500/20 text-slate-400";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-0">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            完成
          </Badge>
        );
      case "processing":
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border-0">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            處理中
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border-0">
            <Clock className="h-3 w-3 mr-1" />
            等待中
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-0">
            <XCircle className="h-3 w-3 mr-1" />
            失敗
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "--";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return "--";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // 檔案保留期限（天）
  const RETENTION_DAYS: Record<string, number> = {
    short_video: 7,
    social_image: 14,
    blog_post: 14,
  };

  // 計算剩餘保存時間（只在客戶端計算，避免 hydration 錯誤）
  const getExpirationInfo = (item: GenerationHistoryItem): { 
    expiresAt: Date | null; 
    daysRemaining: number | null;
    isExpired: boolean;
    text: string;
  } => {
    const retentionDays = RETENTION_DAYS[item.generation_type];
    if (!retentionDays) {
      return { expiresAt: null, daysRemaining: null, isExpired: false, text: "永久保存" };
    }

    // SSR 時返回固定值，避免 hydration 錯誤
    if (!isMounted) {
      return { expiresAt: null, daysRemaining: null, isExpired: false, text: "計算中..." };
    }

    const createdAt = new Date(item.created_at);
    const expiresAt = new Date(createdAt.getTime() + retentionDays * 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const isExpired = daysRemaining <= 0;

    let text: string;
    if (isExpired) {
      text = "已過期";
    } else if (daysRemaining <= 1) {
      const hoursRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (60 * 60 * 1000));
      text = hoursRemaining <= 24 ? `剩餘 ${hoursRemaining} 小時` : `剩餘 1 天`;
    } else if (daysRemaining <= 3) {
      text = `剩餘 ${daysRemaining} 天`;
    } else {
      text = `保存至 ${format(expiresAt, "MM/dd")}`;
    }

    return { expiresAt, daysRemaining, isExpired, text };
  };

  // 獲取完整的媒體 URL（處理相對路徑）
  const getFullUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    // 如果已經是完整 URL 或 base64，直接返回
    if (url.startsWith("http") || url.startsWith("data:")) return url;
    // 如果是相對路徑，加上後端 API 基礎 URL
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    return `${apiBase}${url.startsWith("/") ? url : `/${url}`}`;
  };

  // 獲取圖片/媒體 URL（優先順序：thumbnail_url > media_cloud_url）
  // 注意：列表 API 不再回傳 output_data（避免巨大 base64），改用 thumbnail_url 和 media_cloud_url
  const getMediaUrl = (item: GenerationHistoryItem): string | null => {
    // 對於短影片，優先使用 media_cloud_url
    if (item.generation_type === "short_video") {
      const videoUrl = item.media_cloud_url || item.output_data?.video_url;
      return getFullUrl(videoUrl);
    }
    // 其他類型
    if (item.thumbnail_url) return getFullUrl(item.thumbnail_url);
    if (item.media_cloud_url) return getFullUrl(item.media_cloud_url);
    // fallback: 如果有 output_data（例如從詳情 API 載入的完整資料）
    if (item.output_data?.image_url) return getFullUrl(item.output_data.image_url);
    if (item.output_data?.video_url) return getFullUrl(item.output_data.video_url);
    return null;
  };

  // 檢查是否有可顯示的媒體
  const hasMedia = (item: GenerationHistoryItem): boolean => {
    return !!(getMediaUrl(item));
  };

  // 下載處理
  const handleDownload = async (item: GenerationHistoryItem) => {
    const url = getMediaUrl(item);
    if (!url) {
      // 媒體檔案沒有 URL 時顯示提醒
      toast.warning("檔案已過期或丟失", {
        description: "檔案保留期限：短影片 7 天、圖片 14 天、已排程 30 天。如需長期保存，請於生成後立即下載。",
        duration: 6000,
      });
      return;
    }

    try {
      const isVideo = item.generation_type === "short_video";
      const topic = item.input_params?.topic || item.input_params?.prompt || item.generation_type;
      
      // 如果是 base64 格式
      if (url.startsWith("data:")) {
        const link = document.createElement("a");
        link.href = url;
        const ext = url.includes("image/png") ? "png" : url.includes("image/jpeg") ? "jpg" : "png";
        const filename = `${topic}_${item.id}.${ext}`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (isVideo) {
        // 影片下載 - 使用 fetch 獲取檔案後下載
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error("下載失敗");
          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = `${topic}_${item.id}.mp4`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        } catch (fetchError) {
          // 如果 fetch 失敗，用開新視窗的方式
          console.warn("Fetch 下載失敗，嘗試直接開啟:", fetchError);
          window.open(url, "_blank");
        }
      } else {
        // 圖片 - 嘗試 fetch 下載
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error("下載失敗");
          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = blobUrl;
          const ext = blob.type.includes("png") ? "png" : blob.type.includes("jpeg") ? "jpg" : "png";
          link.download = `${topic}_${item.id}.${ext}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        } catch (fetchError) {
          // 如果 fetch 失敗，開新視窗
          window.open(url, "_blank");
        }
      }
    } catch (error) {
      console.error("下載失敗:", error);
    }
  };

  // 預覽處理
  const handlePreview = (item: GenerationHistoryItem) => {
    const title = item.input_params?.topic || item.input_params?.title || item.output_data?.title || "預覽";
    
    // 部落格文章特殊處理
    if (item.generation_type === "blog_post") {
      const postId = item.output_data?.post_id;
      if (postId) {
        // 跳轉到部落格編輯頁面查看文章
        window.open(`/dashboard/blog?post=${postId}`, "_blank");
      } else {
        // 顯示文章資訊
        const newWindow = window.open("", "_blank");
        if (newWindow) {
          newWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>${title}</title>
              <style>
                body { margin: 0; padding: 40px; background: #0f172a; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
                .container { max-width: 800px; margin: 0 auto; }
                h1 { color: #fff; margin-bottom: 20px; }
                .info { background: #1e293b; padding: 20px; border-radius: 12px; }
                .label { color: #94a3b8; font-size: 14px; margin-bottom: 4px; }
                .value { color: #fff; font-size: 16px; margin-bottom: 16px; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>📝 ${title}</h1>
                <div class="info">
                  <div class="label">內容長度</div>
                  <div class="value">${item.output_data?.content_length || 0} 字</div>
                  <div class="label">生成時間</div>
                  <div class="value">${new Date(item.created_at).toLocaleString("zh-TW")}</div>
                  <div class="label">消耗點數</div>
                  <div class="value">${item.credits_used} 點</div>
                </div>
              </div>
            </body>
            </html>
          `);
        }
      }
      return;
    }

    const url = getMediaUrl(item);
    
    // 如果沒有媒體 URL
    if (!url) {
      // 媒體檔案沒有 URL 時顯示過期提醒（短影片或社群圖文）
      if (item.generation_type === "short_video" || item.generation_type === "social_image") {
        toast.warning("檔案已過期或丟失", {
          description: "檔案保留期限：短影片 7 天、圖片 14 天、已排程 30 天。如需長期保存，請於生成後立即下載。",
          duration: 6000,
        });
        return;
      }
      
      // 其他類型顯示生成資訊
      const newWindow = window.open("", "_blank");
      if (newWindow) {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${title}</title>
            <style>
              body { margin: 0; padding: 40px; background: #0f172a; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
              .container { max-width: 800px; margin: 0 auto; }
              h1 { color: #fff; margin-bottom: 20px; }
              .info { background: #1e293b; padding: 20px; border-radius: 12px; }
              .label { color: #94a3b8; font-size: 14px; margin-bottom: 4px; }
              .value { color: #fff; font-size: 16px; margin-bottom: 16px; }
              pre { background: #0f172a; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>${title}</h1>
              <div class="info">
                <div class="label">類型</div>
                <div class="value">${getTypeName(item.generation_type)}</div>
                <div class="label">生成時間</div>
                <div class="value">${new Date(item.created_at).toLocaleString("zh-TW")}</div>
                <div class="label">消耗點數</div>
                <div class="value">${item.credits_used} 點</div>
                <div class="label">輸入參數</div>
                <pre>${JSON.stringify(item.input_params, null, 2)}</pre>
              </div>
            </div>
          </body>
          </html>
        `);
      }
      return;
    }

    // 如果是 base64 或普通 URL，開新視窗顯示
    const newWindow = window.open("", "_blank");
    if (newWindow) {
      const isVideo = item.generation_type === "short_video" || url.includes("video");
      
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${title}</title>
          <style>
            body { margin: 0; padding: 20px; background: #0f172a; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
            img, video { max-width: 100%; max-height: 90vh; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
          </style>
        </head>
        <body>
          ${isVideo 
            ? `<video src="${url}" controls autoplay style="max-width: 100%;"></video>`
            : `<img src="${url}" alt="${title}" />`
          }
        </body>
        </html>
      `);
    }
  };

  const filteredHistory = history.filter(item => {
    if (!searchQuery) return true;
    const topic = item.input_params?.topic || item.input_params?.title || "";
    return topic.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex flex-col gap-6">
      {/* 頁面標題 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">生成紀錄</h1>
          <p className="text-slate-400 mt-1">
            查看您所有的 AI 生成內容（共 {total} 筆）
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 檢視模式切換 */}
          <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleViewModeChange("grid")}
              className={`h-8 px-3 ${
                viewMode === "grid"
                  ? "bg-indigo-600 text-white hover:bg-indigo-500"
                  : "text-slate-400 hover:text-white hover:bg-slate-700"
              }`}
              title="格狀檢視"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleViewModeChange("list")}
              className={`h-8 px-3 ${
                viewMode === "list"
                  ? "bg-indigo-600 text-white hover:bg-indigo-500"
                  : "text-slate-400 hover:text-white hover:bg-slate-700"
              }`}
              title="列表檢視"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchHistory(1, true)}
            className="border-slate-700 hover:bg-slate-800"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            重新整理
          </Button>
        </div>
      </div>

      {/* 篩選器 */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* 搜尋 */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="搜尋主題..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-700/50 border-slate-600 text-white"
              />
            </div>
            
            {/* 類型篩選 */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-[180px] bg-slate-700/50 border-slate-600 text-white">
                <SelectValue placeholder="內容類型" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">全部類型</SelectItem>
                <SelectItem value="social_image">社群圖文</SelectItem>
                <SelectItem value="blog_post">部落格文章</SelectItem>
                <SelectItem value="blog_image">部落格封面</SelectItem>
                <SelectItem value="short_video">短影片</SelectItem>
                <SelectItem value="video_script">影片腳本</SelectItem>
              </SelectContent>
            </Select>

            {/* 狀態篩選 */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px] bg-slate-700/50 border-slate-600 text-white">
                <SelectValue placeholder="狀態" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">全部狀態</SelectItem>
                <SelectItem value="completed">已完成</SelectItem>
                <SelectItem value="processing">處理中</SelectItem>
                <SelectItem value="pending">等待中</SelectItem>
                <SelectItem value="failed">失敗</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 歷史列表 */}
      {loading ? (
        viewMode === "grid" ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i} className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-4">
                  <div className="h-40 bg-slate-700/50 rounded-lg animate-pulse mb-4" />
                  <div className="h-4 bg-slate-700/50 rounded animate-pulse mb-2" />
                  <div className="h-3 bg-slate-700/50 rounded animate-pulse w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-0">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-4 p-4 border-b border-slate-700 last:border-0">
                  <div className="w-16 h-16 bg-slate-700/50 rounded-lg animate-pulse flex-shrink-0" />
                  <div className="flex-1">
                    <div className="h-4 bg-slate-700/50 rounded animate-pulse mb-2 w-1/3" />
                    <div className="h-3 bg-slate-700/50 rounded animate-pulse w-1/4" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )
      ) : filteredHistory.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-16 text-center">
            <Sparkles className="h-16 w-16 mx-auto text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">尚無生成紀錄</h3>
            <p className="text-slate-400 mb-6">開始創作您的第一個 AI 內容吧！</p>
            <Button className="bg-indigo-600 hover:bg-indigo-500">
              <Sparkles className="mr-2 h-4 w-4" />
              開始創作
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 格狀檢視 */}
          {viewMode === "grid" && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredHistory.map((item) => (
                <Card
                  key={item.id}
                  className="bg-slate-800/50 border-slate-700 overflow-hidden group hover:border-slate-600 transition-all"
                >
                  {/* 縮圖/預覽 */}
                  <div className="relative h-40 bg-slate-700/50">
                    {(() => {
                      const mediaUrl = getMediaUrl(item);
                      const isMediaType = item.generation_type === "short_video" || item.generation_type === "social_image";
                      const isExpired = isMediaType && !mediaUrl;
                      
                      if (isExpired) {
                        return (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-red-500/10">
                            {item.generation_type === "short_video" ? (
                              <Play className="h-8 w-8 text-red-400/50 mb-2" />
                            ) : (
                              <ImageIcon className="h-8 w-8 text-red-400/50 mb-2" />
                            )}
                            <span className="text-xs text-red-400">檔案已過期</span>
                          </div>
                        );
                      }
                      
                      if (mediaUrl) {
                        if (item.generation_type === "short_video") {
                          return (
                            <div className="w-full h-full flex items-center justify-center bg-purple-500/10">
                              <Play className="h-10 w-10 text-purple-400" />
                            </div>
                          );
                        }
                        return (
                          <img
                            src={mediaUrl}
                            alt="縮圖"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        );
                      }
                      return (
                        <div className="w-full h-full flex items-center justify-center">
                          {getTypeIcon(item.generation_type)}
                        </div>
                      );
                    })()}
                    
                    {/* 類型標籤 */}
                    <div className="absolute top-2 left-2 flex gap-1">
                      <Badge className={`${getTypeColor(item.generation_type)} border-0`}>
                        {getTypeName(item.generation_type)}
                      </Badge>
                      {(item.generation_type === "short_video" || item.generation_type === "social_image") && !getMediaUrl(item) && (
                        <Badge className="bg-red-500/80 text-white border-0">
                          已過期
                        </Badge>
                      )}
                    </div>

                    {/* 操作按鈕 */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      {hasMedia(item) && (
                        <Button 
                          size="icon" 
                          variant="secondary" 
                          className="h-8 w-8"
                          onClick={() => handleDownload(item)}
                          title="下載"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      <Button 
                        size="icon" 
                        variant="secondary" 
                        className="h-8 w-8"
                        onClick={() => handlePreview(item)}
                        title="預覽"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <CardContent className="p-4">
                    {/* 標題 */}
                    <h3 className="font-medium text-white truncate mb-2">
                      {item.input_params?.topic || item.input_params?.title || getTypeName(item.generation_type)}
                    </h3>

                    {/* 狀態和元數據 */}
                    <div className="flex items-center justify-between mb-3">
                      {getStatusBadge(item.status)}
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Coins className="h-3 w-3" />
                        {item.credits_used} 點
                      </div>
                    </div>

                    {/* 時間和詳情 */}
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(item.created_at), "MM/dd HH:mm", { locale: zhTW })}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.generation_duration_ms && (
                          <span>耗時 {formatDuration(item.generation_duration_ms)}</span>
                        )}
                        {item.file_size_bytes && (
                          <span>{formatFileSize(item.file_size_bytes)}</span>
                        )}
                      </div>
                    </div>

                    {/* 保存期限提示 */}
                    {(item.generation_type === "short_video" || item.generation_type === "social_image") && hasMedia(item) && (
                      <div className={`mt-2 text-xs flex items-center gap-1 ${
                        getExpirationInfo(item).daysRemaining !== null && getExpirationInfo(item).daysRemaining! <= 3
                          ? "text-amber-400"
                          : "text-slate-500"
                      }`}>
                        <Clock className="h-3 w-3" />
                        {getExpirationInfo(item).text}
                      </div>
                    )}

                    {/* 錯誤訊息 */}
                    {item.status === "failed" && item.error_message && (
                      <div className="mt-3 p-2 rounded bg-red-500/10 border border-red-500/20">
                        <p className="text-xs text-red-400 truncate">
                          {item.error_message}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* 列表檢視 */}
          {viewMode === "list" && (
            <Card className="bg-slate-800/50 border-slate-700 overflow-hidden">
              {/* 表頭 */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-slate-900/50 border-b border-slate-700 text-xs font-medium text-slate-400">
                <div className="col-span-1">預覽</div>
                <div className="col-span-3">標題</div>
                <div className="col-span-2">類型</div>
                <div className="col-span-2">狀態</div>
                <div className="col-span-2">時間</div>
                <div className="col-span-1 text-right">點數</div>
                <div className="col-span-1 text-right">操作</div>
              </div>
              
              {/* 列表項目 */}
              <div className="divide-y divide-slate-700">
                {filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    className="group hover:bg-slate-700/30 transition-colors"
                  >
                    {/* 桌面版 */}
                    <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 items-center">
                      {/* 預覽縮圖 */}
                      <div className="col-span-1">
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-700/50 flex-shrink-0">
                          {(() => {
                            const mediaUrl = getMediaUrl(item);
                            const isMediaType = item.generation_type === "short_video" || item.generation_type === "social_image";
                            const isExpired = isMediaType && !mediaUrl;
                            
                            if (isExpired) {
                              return (
                                <div className="w-full h-full flex items-center justify-center bg-red-500/20">
                                  {item.generation_type === "short_video" ? (
                                    <Play className="h-4 w-4 text-red-400/50" />
                                  ) : (
                                    <ImageIcon className="h-4 w-4 text-red-400/50" />
                                  )}
                                </div>
                              );
                            }
                            
                            if (mediaUrl) {
                              if (item.generation_type === "short_video") {
                                return (
                                  <div className="w-full h-full flex items-center justify-center bg-purple-500/20">
                                    <Play className="h-4 w-4 text-purple-400" />
                                  </div>
                                );
                              }
                              return (
                                <img
                                  src={mediaUrl}
                                  alt="縮圖"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                              );
                            }
                            return (
                              <div className="w-full h-full flex items-center justify-center">
                                {getTypeIcon(item.generation_type)}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* 標題 */}
                      <div className="col-span-3">
                        <h3 className="font-medium text-white truncate">
                          {item.input_params?.topic || item.input_params?.title || getTypeName(item.generation_type)}
                        </h3>
                        {item.input_params?.platform && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {item.input_params.platform}
                          </p>
                        )}
                      </div>

                      {/* 類型 */}
                      <div className="col-span-2 flex gap-1">
                        <Badge className={`${getTypeColor(item.generation_type)} border-0`}>
                          {getTypeName(item.generation_type)}
                        </Badge>
                        {(item.generation_type === "short_video" || item.generation_type === "social_image") && !getMediaUrl(item) && (
                          <Badge className="bg-red-500/80 text-white border-0 text-[10px]">
                            已過期
                          </Badge>
                        )}
                      </div>

                      {/* 狀態 */}
                      <div className="col-span-2">
                        {getStatusBadge(item.status)}
                      </div>

                      {/* 時間 */}
                      <div className="col-span-2 text-sm text-slate-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(item.created_at), "yyyy/MM/dd HH:mm", { locale: zhTW })}
                        </div>
                        {item.generation_duration_ms && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            耗時 {formatDuration(item.generation_duration_ms)}
                          </div>
                        )}
                        {/* 保存期限 */}
                        {(item.generation_type === "short_video" || item.generation_type === "social_image") && hasMedia(item) && (
                          <div className={`text-xs mt-0.5 flex items-center gap-1 ${
                            getExpirationInfo(item).daysRemaining !== null && getExpirationInfo(item).daysRemaining! <= 3
                              ? "text-amber-400"
                              : "text-slate-500"
                          }`}>
                            <Clock className="h-3 w-3" />
                            {getExpirationInfo(item).text}
                          </div>
                        )}
                      </div>

                      {/* 點數 */}
                      <div className="col-span-1 text-right">
                        <div className="flex items-center justify-end gap-1 text-sm text-amber-400">
                          <Coins className="h-3 w-3" />
                          {item.credits_used}
                        </div>
                        {item.file_size_bytes && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            {formatFileSize(item.file_size_bytes)}
                          </div>
                        )}
                      </div>

                      {/* 操作 */}
                      <div className="col-span-1 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {hasMedia(item) && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-slate-400 hover:text-white"
                            onClick={() => handleDownload(item)}
                            title="下載"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-slate-400 hover:text-white"
                          onClick={() => handlePreview(item)}
                          title="預覽"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* 手機版 */}
                    <div className="md:hidden p-4">
                      <div className="flex items-start gap-3">
                        {/* 縮圖 */}
                        <div 
                          className="relative w-16 h-16 rounded-lg overflow-hidden bg-slate-700/50 flex-shrink-0 cursor-pointer"
                          onClick={() => handlePreview(item)}
                        >
                          {(() => {
                            const mediaUrl = getMediaUrl(item);
                            if (mediaUrl) {
                              if (item.generation_type === "short_video") {
                                return (
                                  <div className="w-full h-full flex items-center justify-center bg-purple-500/20">
                                    <Play className="h-5 w-5 text-purple-400" />
                                  </div>
                                );
                              }
                              return (
                                <img
                                  src={mediaUrl}
                                  alt="縮圖"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                              );
                            }
                            return (
                              <div className="w-full h-full flex items-center justify-center">
                                {getTypeIcon(item.generation_type)}
                              </div>
                            );
                          })()}
                        </div>

                        {/* 內容 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-medium text-white truncate">
                              {item.input_params?.topic || item.input_params?.title || getTypeName(item.generation_type)}
                            </h3>
                            <div className="flex items-center gap-1 text-xs text-amber-400 flex-shrink-0">
                              <Coins className="h-3 w-3" />
                              {item.credits_used}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <Badge className={`${getTypeColor(item.generation_type)} border-0 text-xs`}>
                              {getTypeName(item.generation_type)}
                            </Badge>
                            {getStatusBadge(item.status)}
                          </div>

                          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                            <span>{format(new Date(item.created_at), "MM/dd HH:mm", { locale: zhTW })}</span>
                            {item.generation_duration_ms && (
                              <span>耗時 {formatDuration(item.generation_duration_ms)}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 錯誤訊息 */}
                      {item.status === "failed" && item.error_message && (
                        <div className="mt-3 p-2 rounded bg-red-500/10 border border-red-500/20">
                          <p className="text-xs text-red-400 truncate">
                            {item.error_message}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* 載入更多 */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loadingMore}
                className="border-slate-600"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    載入中...
                  </>
                ) : (
                  "載入更多"
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
