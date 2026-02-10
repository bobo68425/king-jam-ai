"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, Clock, Plus, Trash2, RefreshCw, ChevronLeft, ChevronRight,
  Image as ImageIcon, FileText, Video, Send, CheckCircle2, XCircle, 
  AlertCircle, Loader2, MoreHorizontal, Eye, Edit, Link2, Unlink,
  Sparkles, Layers, FolderOpen, ChevronDown, ChevronUp, Play, Hash,
  Upload, X, Settings, ExternalLink, Zap, SquareStack, Lightbulb, TrendingUp
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

interface SocialAccount {
  id: number;
  platform: string;
  platform_username: string | null;
  platform_avatar: string | null;
  is_active: boolean;
  extra_settings?: {
    site_url?: string;
    site_name?: string;
    ga4_property_id?: string;
    [key: string]: any;
  };
}

interface CalendarEvent {
  id: number;
  title: string;
  start: string;
  status: string;
  content_type: string;
  platform: string | null;
}

interface Stats {
  total_scheduled: number;
  pending: number;
  published: number;
  failed: number;
  today_count: number;
  this_week_count: number;
}

// 智慧排程建議類型
interface TimeSlotSuggestion {
  time: string;
  day_of_week: number;
  score: number;
  reason: string;
}

interface SmartScheduleResponse {
  suggested_slots: TimeSlotSuggestion[];
  platform_tips: Record<string, string>;
  next_available_slots: string[];
}

// 歷史記錄 API 回應類型（輕量版列表）
interface HistoryApiItem {
  id: number;
  user_id: number;
  generation_type: string;
  status: string;
  input_params: Record<string, any>;
  output_data?: Record<string, any>;  // 列表 API 不含此欄位
  output_caption?: string;  // 列表 API 回傳的輕量 caption
  media_local_path: string | null;
  media_cloud_url: string | null;
  media_cloud_key: string | null;
  thumbnail_url: string | null;
  credits_used: number;
  error_message: string | null;
  generation_duration_ms: number | null;
  file_size_bytes: number | null;
  created_at: string;
}

// 社群圖文歷史記錄類型（從 API 轉換）
interface SocialHistoryRecord {
  id: string;
  timestamp: number;
  platform: string;
  quality: string;
  topic: string;
  caption: string;
  image_url?: string;
  keywords?: string;
  product_info?: string;
  image_prompt?: string;
}

// 短影音歷史記錄類型（從 API 轉換）
interface VideoHistoryRecord {
  id: string;
  timestamp: number;
  prompt: string;
  duration: string;
  aspectRatio: string;
  quality: string;
  model: string;
  videoUrl?: string;
  scenes?: any[];
}

// 部落格文章類型
interface BlogPost {
  id: number;
  title: string;
  content: string;
  summary: string;
  cover_image_url: string | null;
  created_at: string;
}

// ==================== 配置常數 ====================
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "待發布", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Clock },
  queued: { label: "排隊中", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Clock },
  publishing: { label: "發布中", color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30", icon: Loader2 },
  published: { label: "已發布", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle2 },
  failed: { label: "失敗", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle },
  cancelled: { label: "已取消", color: "bg-slate-500/20 text-slate-400 border-slate-500/30", icon: XCircle },
};

const CONTENT_TYPES = [
  { value: "social_image", label: "社群圖文", icon: ImageIcon, color: "from-pink-500 to-rose-500" },
  { value: "blog_post", label: "部落格文章", icon: FileText, color: "from-blue-500 to-cyan-500" },
  { value: "short_video", label: "短影音", icon: Video, color: "from-purple-500 to-indigo-500" },
];

const PLATFORMS: Record<string, { name: string; icon: string; color: string; hasCost?: boolean; costNote?: string }> = {
  instagram: { name: "Instagram", icon: "📸", color: "from-purple-500 to-pink-500" },
  facebook: { name: "Facebook", icon: "📘", color: "from-blue-600 to-blue-400" },
  tiktok: { name: "TikTok", icon: "🎵", color: "from-slate-900 to-slate-700" },
  threads: { name: "Threads", icon: "🧵", color: "from-slate-800 to-slate-600" },
  linkedin: { name: "LinkedIn", icon: "💼", color: "from-blue-700 to-blue-500" },
  youtube: { name: "YouTube", icon: "📺", color: "from-red-600 to-red-400" },
  xiaohongshu: { name: "小紅書", icon: "📕", color: "from-red-500 to-rose-400" },
  line: { 
    name: "LINE", 
    icon: "💬", 
    color: "from-green-500 to-emerald-400",
    hasCost: true,
    costNote: "溫馨提醒：發文會使用LINE用戶帳號免費發文500則的額度"
  },
};

// API 轉換：將 API 資料轉換為前端格式
function convertSocialHistory(item: HistoryApiItem): SocialHistoryRecord {
  return {
    id: String(item.id),
    timestamp: new Date(item.created_at).getTime(),
    platform: item.input_params?.platform || "instagram",
    quality: item.input_params?.quality || "standard",
    topic: item.input_params?.topic || "",
    caption: item.output_caption || item.output_data?.caption || "",
    image_url: item.thumbnail_url || item.media_cloud_url || item.output_data?.image_url || "",
    keywords: item.input_params?.keywords || "",
    product_info: item.input_params?.productInfo || "",
    image_prompt: item.input_params?.imagePrompt || "",
  };
}

function convertVideoHistory(item: HistoryApiItem): VideoHistoryRecord {
  return {
    id: String(item.id),
    timestamp: new Date(item.created_at).getTime(),
    prompt: item.input_params?.prompt || "",
    duration: item.input_params?.duration || "8",
    aspectRatio: item.input_params?.aspectRatio || "9:16",
    quality: item.input_params?.quality || "standard",
    model: item.input_params?.model || "veo-fast",
    videoUrl: item.media_cloud_url || item.output_data?.video_url || "",
  };
}

// ==================== 主組件 ====================
export default function SchedulerPage() {
  const router = useRouter();
  
  // 基本狀態
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 日曆狀態 - 使用 null 初始化避免 SSR hydration 錯誤
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // 客戶端設置當前日期
  useEffect(() => {
    setCurrentDate(new Date());
  }, []);
  
  // 新增排程狀態
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createMode, setCreateMode] = useState<"select" | "manual">("select");
  const [newPost, setNewPost] = useState({
    content_type: "social_image",
    title: "",
    caption: "",
    media_urls: [] as string[],
    hashtags: [] as string[],
    scheduled_at: "",
    social_account_id: null as number | null,
  });
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([]);
  
  // 已生成內容狀態
  const [socialHistory, setSocialHistory] = useState<SocialHistoryRecord[]>([]);
  const [videoHistory, setVideoHistory] = useState<VideoHistoryRecord[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [selectedContent, setSelectedContent] = useState<any>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>("social");
  
  // 篩選狀態
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [contentTypeFilter, setContentTypeFilter] = useState<string>("all");
  
  // 批量排程狀態
  const [batchMode, setBatchMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [batchScheduling, setBatchScheduling] = useState(false);
  
  // 智慧排程建議狀態
  const [smartSuggestions, setSmartSuggestions] = useState<SmartScheduleResponse | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // ==================== 載入資料 ====================
  const fetchData = useCallback(async () => {
    try {
      const [postsRes, accountsRes, statsRes] = await Promise.all([
        api.get("/scheduler/posts"),
        api.get("/scheduler/accounts"),
        api.get("/scheduler/stats"),
      ]);
      setPosts(postsRes.data);
      setAccounts(accountsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error("載入資料失敗:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCalendarEvents = useCallback(async () => {
    if (!currentDate) return;  // 等待客戶端初始化
    
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    try {
      const res = await api.get("/scheduler/calendar", {
        params: {
          start: start.toISOString(),
          end: end.toISOString(),
        }
      });
      setCalendarEvents(res.data);
    } catch (error) {
      console.error("載入日曆事件失敗:", error);
    }
  }, [currentDate]);

  // 載入已生成內容（從 API）
  const loadGeneratedContent = useCallback(async () => {
    console.log("[Scheduler] 開始載入已生成內容...");
    
    // 載入社群圖文歷史（從 API）
    try {
      const res = await api.get("/history", {
        params: {
          generation_type: "social_image",
          status: "completed",
          page_size: 50
        }
      });
      console.log("[Scheduler] 社群圖文 API 響應:", res.data);
      const items: HistoryApiItem[] = res.data?.items || [];
      const converted = items.map(convertSocialHistory);
      console.log("[Scheduler] 社群圖文轉換後:", converted.length, "條");
      setSocialHistory(converted);
    } catch (e) {
      console.error("[Scheduler] 載入社群圖文歷史失敗:", e);
    }

    // 載入短影音歷史（從 API）
    try {
      const res = await api.get("/history", {
        params: {
          generation_type: "short_video",
          status: "completed",
          page_size: 50
        }
      });
      console.log("[Scheduler] 短影音 API 響應:", res.data);
      const items: HistoryApiItem[] = res.data?.items || [];
      const converted = items.map(convertVideoHistory);
      console.log("[Scheduler] 短影音轉換後:", converted.length, "條");
      setVideoHistory(converted);
    } catch (e) {
      console.error("[Scheduler] 載入短影音歷史失敗:", e);
    }

    // 載入部落格文章
    try {
      const res = await api.get("/blog/posts");
      console.log("[Scheduler] 部落格文章 API 響應:", res.data?.length || 0, "條");
      setBlogPosts(res.data || []);
    } catch (e) {
      console.error("[Scheduler] 載入部落格文章失敗:", e);
    }
  }, []);

  // 載入智慧排程建議
  const fetchSmartSuggestions = useCallback(async (platform?: string) => {
    setLoadingSuggestions(true);
    try {
      const params = new URLSearchParams();
      if (platform) params.append("platform", platform);
      params.append("count", "5");
      
      const res = await api.get(`/scheduler/smart-schedule?${params}`);
      setSmartSuggestions(res.data);
    } catch (error) {
      console.error("載入智慧排程建議失敗:", error);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    loadGeneratedContent();
  }, [fetchData, loadGeneratedContent]);

  useEffect(() => {
    fetchCalendarEvents();
  }, [fetchCalendarEvents]);

  // ==================== 操作函數 ====================
  const handleCreatePost = async () => {
    if (!newPost.scheduled_at) {
      toast.error("請選擇排程時間");
      return;
    }
    if (!newPost.caption && !newPost.title) {
      toast.error("請輸入內容或選擇已生成的內容");
      return;
    }

    setCreating(true);
    try {
      await api.post("/scheduler/posts", {
        ...newPost,
        scheduled_at: new Date(newPost.scheduled_at).toISOString(),
        timezone: "Asia/Taipei",
      });
      toast.success("排程已建立");
      setShowCreateForm(false);
      resetForm();
      fetchData();
      fetchCalendarEvents();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "建立失敗");
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setNewPost({
      content_type: "social_image",
      title: "",
      caption: "",
      media_urls: [],
      hashtags: [],
      scheduled_at: "",
      social_account_id: null,
    });
    setSelectedContent(null);
    setCreateMode("select");
    setUploadPreviews([]);
  };

  // 圖片上傳處理
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newPreviews: string[] = [];
    const newUrls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // 驗證文件類型
        if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
          toast.error(`${file.name} 不是支援的媒體格式`);
          continue;
        }

        // 驗證文件大小 (最大 50MB)
        if (file.size > 50 * 1024 * 1024) {
          toast.error(`${file.name} 超過 50MB 限制`);
          continue;
        }

        // 創建本地預覽
        const reader = new FileReader();
        const previewPromise = new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const preview = await previewPromise;
        newPreviews.push(preview);

        // 上傳到服務器
        const formData = new FormData();
        formData.append("file", file);

        try {
          const response = await api.post("/upload/media", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          if (response.data?.url) {
            newUrls.push(response.data.url);
          } else {
            // 如果沒有服務器返回 URL，使用 base64
            newUrls.push(preview);
          }
        } catch (uploadError) {
          // 上傳失敗時使用 base64 作為備用
          console.warn("上傳失敗，使用本地預覽:", uploadError);
          newUrls.push(preview);
        }
      }

      setUploadPreviews((prev) => [...prev, ...newPreviews]);
      setNewPost((prev) => ({
        ...prev,
        media_urls: [...prev.media_urls, ...newUrls],
      }));

      if (newUrls.length > 0) {
        toast.success(`已添加 ${newUrls.length} 個媒體文件`);
      }
    } catch (error) {
      console.error("上傳錯誤:", error);
      toast.error("上傳失敗，請重試");
    } finally {
      setUploading(false);
      // 清空 input 以允許重複選擇相同文件
      e.target.value = "";
    }
  };

  // 移除已上傳的媒體
  const handleRemoveMedia = (index: number) => {
    setUploadPreviews((prev) => prev.filter((_, i) => i !== index));
    setNewPost((prev) => ({
      ...prev,
      media_urls: prev.media_urls.filter((_, i) => i !== index),
    }));
  };

  const handleCancelPost = async (postId: number) => {
    try {
      await api.post(`/scheduler/posts/${postId}/cancel`);
      toast.success("排程已取消");
      fetchData();
      fetchCalendarEvents();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "取消失敗");
    }
  };

  const handleRetryPost = async (postId: number) => {
    try {
      await api.post(`/scheduler/posts/${postId}/retry`);
      toast.success("已加入重試佇列");
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "重試失敗");
    }
  };

  const handleDeletePost = async (postId: number) => {
    if (!confirm("確定要刪除此排程嗎？")) return;
    
    try {
      await api.delete(`/scheduler/posts/${postId}`);
      toast.success("排程已刪除");
      fetchData();
      fetchCalendarEvents();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "刪除失敗");
    }
  };

  // 選擇已生成內容
  const handleSelectContent = (type: string, content: any) => {
    setSelectedContent({ type, data: content });
    
    if (type === "social") {
      setNewPost({
        ...newPost,
        content_type: "social_image",
        title: content.topic || "",
        caption: content.caption || "",
        media_urls: content.image_url ? [content.image_url] : [],
        hashtags: content.keywords ? content.keywords.split(",").map((k: string) => k.trim()) : [],
      });
    } else if (type === "video") {
      setNewPost({
        ...newPost,
        content_type: "short_video",
        title: content.prompt?.slice(0, 50) || "短影音",
        caption: content.prompt || "",
        media_urls: content.videoUrl ? [content.videoUrl] : [],
        hashtags: [],
      });
    } else if (type === "blog") {
      setNewPost({
        ...newPost,
        content_type: "blog_post",
        title: content.title || "",
        caption: content.summary || content.content?.slice(0, 200) || "",
        media_urls: content.cover_image_url ? [content.cover_image_url] : [],
        hashtags: [],
      });
    }
  };

  // 批量選擇切換
  const toggleBatchSelect = (itemId: string, type: string) => {
    const key = `${type}:${itemId}`;
    const newSelected = new Set(selectedItems);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedItems(newSelected);
  };

  // 全選/取消全選
  const toggleSelectAll = (type: string, items: any[]) => {
    const typeItems = items.map(item => `${type}:${item.id}`);
    const allSelected = typeItems.every(key => selectedItems.has(key));
    
    const newSelected = new Set(selectedItems);
    if (allSelected) {
      typeItems.forEach(key => newSelected.delete(key));
    } else {
      typeItems.forEach(key => newSelected.add(key));
    }
    setSelectedItems(newSelected);
  };

  // 批量排程處理
  const handleBatchSchedule = async () => {
    if (selectedItems.size === 0) {
      toast.error("請先選擇要排程的內容");
      return;
    }

    if (!smartSuggestions || smartSuggestions.next_available_slots.length === 0) {
      toast.error("請先載入排程建議時段");
      return;
    }

    setBatchScheduling(true);
    
    try {
      const items: any[] = [];
      const slots = smartSuggestions.next_available_slots;
      let slotIndex = 0;

      selectedItems.forEach((key) => {
        const [type, id] = key.split(":");
        let content: any = null;

        if (type === "social") {
          content = socialHistory.find(h => h.id === id);
          if (content) {
            items.push({
              content_type: "social_image",
              title: content.topic || "",
              caption: content.caption || "",
              media_urls: content.image_url ? [content.image_url] : [],
              hashtags: content.keywords ? content.keywords.split(",").map((k: string) => k.trim()) : [],
              scheduled_at: slots[slotIndex % slots.length],
            });
            slotIndex++;
          }
        } else if (type === "video") {
          content = videoHistory.find(h => h.id === id);
          if (content) {
            items.push({
              content_type: "short_video",
              title: content.prompt?.slice(0, 50) || "短影音",
              caption: content.prompt || "",
              media_urls: content.videoUrl ? [content.videoUrl] : [],
              hashtags: [],
              scheduled_at: slots[slotIndex % slots.length],
            });
            slotIndex++;
          }
        } else if (type === "blog") {
          content = blogPosts.find(h => h.id === parseInt(id));
          if (content) {
            items.push({
              content_type: "blog_post",
              title: content.title || "",
              caption: content.summary || content.content?.slice(0, 200) || "",
              media_urls: content.cover_image_url ? [content.cover_image_url] : [],
              hashtags: [],
              scheduled_at: slots[slotIndex % slots.length],
            });
            slotIndex++;
          }
        }
      });

      if (items.length === 0) {
        toast.error("沒有有效的內容可排程");
        return;
      }

      const response = await api.post("/scheduler/posts/batch", {
        items,
        timezone: "Asia/Taipei",
      });

      const { success_count, failed_count, errors } = response.data;

      if (success_count > 0) {
        toast.success(`成功建立 ${success_count} 個排程`);
        fetchData();
        fetchCalendarEvents();
        setSelectedItems(new Set());
        setBatchMode(false);
      }

      if (failed_count > 0) {
        toast.error(`${failed_count} 個排程建立失敗`);
        console.error("批量排程錯誤:", errors);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "批量排程失敗");
    } finally {
      setBatchScheduling(false);
    }
  };

  // 使用智慧建議時段
  const applySmartSlot = (slotTime: string) => {
    const date = new Date(slotTime);
    // 格式化為 datetime-local 輸入格式
    const formatted = date.toISOString().slice(0, 16);
    setNewPost({ ...newPost, scheduled_at: formatted });
    toast.success("已套用建議時段");
  };

  // ==================== 日曆輔助函數 ====================
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days = [];
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const getEventsForDate = (date: Date) => {
    return calendarEvents.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const filteredPosts = posts.filter(post => {
    // 本週篩選：檢查 scheduled_at 是否在本週內
    if (statusFilter === "this_week") {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay()); // 本週日
      weekStart.setHours(0, 0, 0, 0);
      const postDate = new Date(post.scheduled_at);
      if (postDate < weekStart) return false;
    } else if (statusFilter !== "all" && post.status !== statusFilter) {
      return false;
    }
    if (contentTypeFilter !== "all" && post.content_type !== contentTypeFilter) return false;
    return true;
  });

  const prevMonth = () => {
    if (!currentDate) return;
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };
  const nextMonth = () => {
    if (!currentDate) return;
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  // 格式化時間
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("zh-TW", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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
    <div className="space-y-6 min-w-0 overflow-x-hidden">
      {/* 頁面標題 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            排程上架引擎
          </h1>
          <p className="text-slate-400 mt-1">從各引擎已生成內容中選擇，自動排程發布到社群平台</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* 批量模式切換 */}
          <Button
            variant={batchMode ? "default" : "outline"}
            onClick={() => {
              setBatchMode(!batchMode);
              if (!batchMode) {
                loadGeneratedContent();
                fetchSmartSuggestions();
              } else {
                setSelectedItems(new Set());
              }
            }}
            className={cn(
              batchMode 
                ? "bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700" 
                : "border-slate-600 text-slate-300 hover:bg-slate-800"
            )}
          >
            <SquareStack className="w-4 h-4 mr-2" />
            {batchMode ? "退出批量" : "批量排程"}
          </Button>
          <Button
            onClick={() => {
              setShowCreateForm(true);
              loadGeneratedContent();
              fetchSmartSuggestions();
            }}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            新增排程
          </Button>
        </div>
      </div>

      {/* 批量排程操作欄 */}
      {batchMode && (
        <Card className="bg-gradient-to-r from-orange-900/30 to-amber-900/30 border-orange-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-orange-500/20">
                  <SquareStack className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-white font-medium">批量排程模式</p>
                  <p className="text-sm text-slate-400">
                    已選擇 <span className="text-orange-400 font-bold">{selectedItems.size}</span> 個內容
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* 智慧排程建議預覽 */}
                {smartSuggestions && selectedItems.size > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg">
                    <Lightbulb className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs text-slate-300">
                      將自動分配到 {Math.min(selectedItems.size, smartSuggestions.next_available_slots.length)} 個最佳時段
                    </span>
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedItems(new Set());
                  }}
                  className="border-slate-600 text-slate-300"
                  disabled={selectedItems.size === 0}
                >
                  清除選擇
                </Button>
                <Button
                  onClick={handleBatchSchedule}
                  disabled={selectedItems.size === 0 || batchScheduling}
                  className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700"
                >
                  {batchScheduling ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      排程中...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      一鍵智慧排程
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 統計卡片 - 可點擊篩選 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
          <Card 
            className={cn(
              "bg-slate-800/50 border-slate-700 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg min-w-0",
              statusFilter === "pending" && "ring-2 ring-yellow-500 border-yellow-500/50"
            )}
            onClick={() => {
              setStatusFilter(statusFilter === "pending" ? "all" : "pending");
              // 滾動到排程列表
              document.getElementById("schedule-list")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">待發布</p>
                  <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
                </div>
                <Clock className={cn("w-8 h-8", statusFilter === "pending" ? "text-yellow-400" : "text-yellow-400/30")} />
              </div>
              {statusFilter === "pending" && (
                <p className="text-[10px] text-yellow-400/70 mt-2">點擊取消篩選</p>
              )}
            </CardContent>
          </Card>
          <Card 
            className={cn(
              "bg-slate-800/50 border-slate-700 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg min-w-0",
              statusFilter === "published" && "ring-2 ring-green-500 border-green-500/50"
            )}
            onClick={() => {
              setStatusFilter(statusFilter === "published" ? "all" : "published");
              document.getElementById("schedule-list")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">已發布</p>
                  <p className="text-2xl font-bold text-green-400">{stats.published}</p>
                </div>
                <CheckCircle2 className={cn("w-8 h-8 flex-shrink-0", statusFilter === "published" ? "text-green-400" : "text-green-400/30")} />
              </div>
              {statusFilter === "published" && (
                <p className="text-[10px] text-green-400/70 mt-2">點擊取消篩選</p>
              )}
            </CardContent>
          </Card>
          <Card 
            className={cn(
              "bg-slate-800/50 border-slate-700 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg min-w-0",
              statusFilter === "failed" && "ring-2 ring-red-500 border-red-500/50"
            )}
            onClick={() => {
              setStatusFilter(statusFilter === "failed" ? "all" : "failed");
              document.getElementById("schedule-list")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">失敗</p>
                  <p className="text-2xl font-bold text-red-400">{stats.failed}</p>
                </div>
                <XCircle className={cn("w-8 h-8 flex-shrink-0", statusFilter === "failed" ? "text-red-400" : "text-red-400/30")} />
              </div>
              {statusFilter === "failed" && (
                <p className="text-[10px] text-red-400/70 mt-2">點擊取消篩選</p>
              )}
            </CardContent>
          </Card>
          <Card 
            className={cn(
              "bg-slate-800/50 border-slate-700 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg min-w-0",
              statusFilter === "this_week" && "ring-2 ring-indigo-500 border-indigo-500/50"
            )}
            onClick={() => {
              setStatusFilter(statusFilter === "this_week" ? "all" : "this_week");
              document.getElementById("schedule-list")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">本週排程</p>
                  <p className="text-2xl font-bold text-indigo-400">{stats.this_week_count}</p>
                </div>
                <Calendar className={cn("w-8 h-8 flex-shrink-0", statusFilter === "this_week" ? "text-indigo-400" : "text-indigo-400/30")} />
              </div>
              {statusFilter === "this_week" && (
                <p className="text-[10px] text-indigo-400/70 mt-2">點擊取消篩選</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 已生成內容總覽 - 批量模式時展開顯示所有內容 */}
      <Card className={cn(
        "border transition-all duration-300",
        batchMode 
          ? "bg-gradient-to-br from-orange-900/20 via-slate-900 to-amber-900/20 border-orange-500/30"
          : "bg-gradient-to-br from-slate-900 via-indigo-900/20 to-slate-900 border-indigo-500/30"
      )}>
        <CardHeader className="border-b border-slate-700/50">
          <CardTitle className="text-white flex items-center gap-2">
            <Sparkles className={cn("w-5 h-5", batchMode ? "text-orange-400" : "text-indigo-400")} />
            已生成內容庫
            {batchMode && (
              <Badge className="ml-2 bg-orange-500/20 text-orange-300 animate-pulse">
                選擇模式
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {batchMode 
              ? "點選內容進行批量排程，系統將自動分配最佳發文時段" 
              : "從各引擎生成的內容中快速選取進行排程"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {batchMode ? (
            // 批量模式 - 展開所有內容供選擇
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {/* 社群圖文列表 */}
              {socialHistory.length > 0 && (
                <div className="border border-pink-500/30 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-pink-900/20 to-rose-900/20">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500">
                        <ImageIcon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-white font-medium text-sm">社群圖文</span>
                      <Badge className="bg-pink-500/20 text-pink-300">{socialHistory.length}</Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSelectAll("social", socialHistory)}
                      className="text-xs text-pink-400 hover:text-pink-300"
                    >
                      {socialHistory.every(h => selectedItems.has(`social:${h.id}`)) ? "取消全選" : "全選"}
                    </Button>
                  </div>
                  <div className="p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {socialHistory.slice(0, 12).map((item) => {
                      const isSelected = selectedItems.has(`social:${item.id}`);
                      return (
                        <button
                          key={item.id}
                          onClick={() => toggleBatchSelect(item.id, "social")}
                          className={cn(
                            "relative p-2 rounded-lg border transition-all text-left",
                            isSelected 
                              ? "border-pink-500 bg-pink-500/10 ring-2 ring-pink-500/30" 
                              : "border-slate-700 hover:border-pink-500/50 bg-slate-800/50"
                          )}
                        >
                          {isSelected && (
                            <div className="absolute -top-2 -right-2 p-1 rounded-full bg-pink-500">
                              <CheckCircle2 className="w-3 h-3 text-white" />
                            </div>
                          )}
                          {item.image_url && (
                            <img src={item.image_url} alt="" className="w-full aspect-square rounded object-cover mb-2" />
                          )}
                          <p className="text-xs text-white truncate">{item.topic || "社群貼文"}</p>
                          <p className="text-[10px] text-slate-500">{formatTime(item.timestamp)}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 短影音列表 */}
              {videoHistory.length > 0 && (
                <div className="border border-purple-500/30 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-900/20 to-indigo-900/20">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500">
                        <Video className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-white font-medium text-sm">短影音</span>
                      <Badge className="bg-purple-500/20 text-purple-300">{videoHistory.length}</Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSelectAll("video", videoHistory)}
                      className="text-xs text-purple-400 hover:text-purple-300"
                    >
                      {videoHistory.every(h => selectedItems.has(`video:${h.id}`)) ? "取消全選" : "全選"}
                    </Button>
                  </div>
                  <div className="p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {videoHistory.slice(0, 12).map((item) => {
                      const isSelected = selectedItems.has(`video:${item.id}`);
                      return (
                        <button
                          key={item.id}
                          onClick={() => toggleBatchSelect(item.id, "video")}
                          className={cn(
                            "relative p-2 rounded-lg border transition-all text-left",
                            isSelected 
                              ? "border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/30" 
                              : "border-slate-700 hover:border-purple-500/50 bg-slate-800/50"
                          )}
                        >
                          {isSelected && (
                            <div className="absolute -top-2 -right-2 p-1 rounded-full bg-purple-500">
                              <CheckCircle2 className="w-3 h-3 text-white" />
                            </div>
                          )}
                          <div className="w-full aspect-square rounded bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center mb-2">
                            <Play className="w-6 h-6 text-white" />
                          </div>
                          <p className="text-xs text-white truncate">{item.prompt?.slice(0, 20) || "短影音"}...</p>
                          <p className="text-[10px] text-slate-500">{formatTime(item.timestamp)}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 部落格文章列表 */}
              {blogPosts.length > 0 && (
                <div className="border border-blue-500/30 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-900/20 to-cyan-900/20">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
                        <FileText className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-white font-medium text-sm">部落格文章</span>
                      <Badge className="bg-blue-500/20 text-blue-300">{blogPosts.length}</Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSelectAll("blog", blogPosts)}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      {blogPosts.every(h => selectedItems.has(`blog:${h.id}`)) ? "取消全選" : "全選"}
                    </Button>
                  </div>
                  <div className="p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {blogPosts.slice(0, 12).map((item) => {
                      const isSelected = selectedItems.has(`blog:${item.id}`);
                      return (
                        <button
                          key={item.id}
                          onClick={() => toggleBatchSelect(String(item.id), "blog")}
                          className={cn(
                            "relative p-2 rounded-lg border transition-all text-left",
                            isSelected 
                              ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30" 
                              : "border-slate-700 hover:border-blue-500/50 bg-slate-800/50"
                          )}
                        >
                          {isSelected && (
                            <div className="absolute -top-2 -right-2 p-1 rounded-full bg-blue-500">
                              <CheckCircle2 className="w-3 h-3 text-white" />
                            </div>
                          )}
                          {item.cover_image_url ? (
                            <img src={item.cover_image_url} alt="" className="w-full aspect-square rounded object-cover mb-2" />
                          ) : (
                            <div className="w-full aspect-square rounded bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center mb-2">
                              <FileText className="w-6 h-6 text-white" />
                            </div>
                          )}
                          <p className="text-xs text-white truncate">{item.title}</p>
                          <p className="text-[10px] text-slate-500">{new Date(item.created_at).toLocaleDateString("zh-TW")}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {socialHistory.length === 0 && videoHistory.length === 0 && blogPosts.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>尚無已生成的內容</p>
                  <p className="text-sm mt-1">請先使用其他引擎生成內容</p>
                </div>
              )}
            </div>
          ) : (
            // 一般模式 - 簡潔的卡片總覽
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
              {/* 社群圖文 */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-pink-500/20 min-w-0">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500">
                    <ImageIcon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-white font-medium">社群圖文</span>
                  <Badge className="ml-auto bg-pink-500/20 text-pink-300">{socialHistory.length}</Badge>
                </div>
                <p className="text-xs text-slate-400 mb-2">已生成的社群媒體貼文與圖片</p>
                {socialHistory.length > 0 && (
                  <div className="text-xs text-pink-400">
                    最新: {formatTime(socialHistory[0]?.timestamp)}
                  </div>
                )}
              </div>

              {/* 短影音 */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-purple-500/20 min-w-0">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex-shrink-0">
                    <Video className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-white font-medium truncate">短影音</span>
                  <Badge className="ml-auto bg-purple-500/20 text-purple-300 flex-shrink-0">{videoHistory.length}</Badge>
                </div>
                <p className="text-xs text-slate-400 mb-2">AI 生成的短影音內容</p>
                {videoHistory.length > 0 && (
                  <div className="text-xs text-purple-400 truncate">
                    最新: {formatTime(videoHistory[0]?.timestamp)}
                  </div>
                )}
              </div>

              {/* 部落格 */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-blue-500/20 min-w-0">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-white font-medium">部落格文章</span>
                  <Badge className="ml-auto bg-blue-500/20 text-blue-300">{blogPosts.length}</Badge>
                </div>
                <p className="text-xs text-slate-400 mb-2">已發布的部落格文章</p>
                {blogPosts.length > 0 && (
                  <div className="text-xs text-blue-400">
                    最新: {blogPosts[0]?.title?.slice(0, 15)}...
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
        {/* 日曆視圖 - 精簡版 */}
        <Card className="lg:col-span-2 bg-slate-900 border-slate-700 min-w-0">
          <CardHeader className="border-b border-slate-700 py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2 text-base">
                <Calendar className="w-4 h-4 text-indigo-400" />
                排程日曆
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setCurrentDate(new Date())}
                  className="text-xs text-slate-400 hover:text-white h-7 px-2"
                >
                  今天
                </Button>
                <div className="flex items-center">
                  <Button variant="ghost" size="sm" onClick={prevMonth} className="text-slate-400 hover:text-white h-7 w-7 p-0">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-white font-medium min-w-[80px] text-center text-sm">
                    {currentDate ? `${currentDate.getFullYear()}/${currentDate.getMonth() + 1}` : "..."}
                  </span>
                  <Button variant="ghost" size="sm" onClick={nextMonth} className="text-slate-400 hover:text-white h-7 w-7 p-0">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            {/* 星期標題 */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {["日", "一", "二", "三", "四", "五", "六"].map((day, idx) => (
                <div 
                  key={day} 
                  className={cn(
                    "text-center text-[10px] font-medium py-1",
                    idx === 0 && "text-rose-400",
                    idx === 6 && "text-blue-400",
                    idx !== 0 && idx !== 6 && "text-slate-500"
                  )}
                >
                  {day}
                </div>
              ))}
            </div>
            {/* 日期格子 */}
            <div className="grid grid-cols-7 gap-1">
              {currentDate && getDaysInMonth(currentDate).map((date, index) => {
                if (!date) {
                  return <div key={index} className="aspect-square" />;
                }
                
                const events = getEventsForDate(date);
                const today = new Date();
                const isToday = date.toDateString() === today.toDateString();
                const todayStart = new Date(today);
                todayStart.setHours(0, 0, 0, 0);
                const isPast = date < todayStart;
                const dayOfWeek = date.getDay();
                
                return (
                  <button
                    key={index}
                    onClick={() => {
                      if (events.length > 0) {
                        setSelectedDate(date);
                      }
                    }}
                    className={cn(
                      "aspect-square rounded-md flex flex-col items-center justify-center transition-all text-xs relative",
                      isToday && "bg-indigo-500 text-white font-bold",
                      isPast && !isToday && "text-slate-600",
                      !isPast && !isToday && "hover:bg-slate-800 text-slate-400",
                      !isPast && !isToday && dayOfWeek === 0 && "text-rose-400/70",
                      !isPast && !isToday && dayOfWeek === 6 && "text-blue-400/70",
                      events.length > 0 && !isToday && "bg-slate-800/50 font-semibold cursor-pointer",
                      events.length === 0 && "cursor-default"
                    )}
                  >
                    {date.getDate()}
                    {events.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5">
                        {events.slice(0, 3).map((event, i) => (
                          <div
                            key={i}
                            className={cn(
                              "w-1 h-1 rounded-full",
                              event.status === "published" && "bg-green-500",
                              event.status === "pending" && "bg-yellow-500",
                              event.status === "failed" && "bg-red-500",
                              !["published", "pending", "failed"].includes(event.status) && "bg-slate-500"
                            )}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            
            {/* 圖例和統計 */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/50">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                  待發布
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  已發布
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  失敗
                </div>
              </div>
              <span className="text-[10px] text-slate-500">
                本月 {calendarEvents.length} 個排程
              </span>
            </div>
          </CardContent>
        </Card>
        
        {/* 排程詳情彈窗 */}
        {selectedDate && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedDate(null)}>
            <Card className="w-full max-w-lg bg-slate-900 border-slate-700 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <CardHeader className="border-b border-slate-700 py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2 text-base">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                      <Calendar className="w-4 h-4 text-white" />
                    </div>
                    {selectedDate.toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDate(null)}
                    className="text-slate-400 hover:text-white h-8 w-8 p-0"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {(() => {
                  const dayEvents = getEventsForDate(selectedDate);
                  if (dayEvents.length === 0) {
                    return (
                      <div className="text-center py-8 text-slate-500">
                        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">這天沒有排程</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
                          onClick={() => {
                            const dateStr = selectedDate.toISOString().slice(0, 10) + "T12:00";
                            setNewPost({ ...newPost, scheduled_at: dateStr });
                            setSelectedDate(null);
                            setShowCreateForm(true);
                            loadGeneratedContent();
                            fetchSmartSuggestions();
                          }}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          新增排程
                        </Button>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {dayEvents.map((event) => {
                        const statusConfig = STATUS_CONFIG[event.status];
                        const StatusIcon = statusConfig?.icon || Clock;
                        const contentType = CONTENT_TYPES.find(t => t.value === event.content_type);
                        const ContentIcon = contentType?.icon || FileText;
                        const eventDate = new Date(event.start);
                        
                        return (
                          <div
                            key={event.id}
                            className={cn(
                              "group flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer",
                              "bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-indigo-500/50"
                            )}
                            onClick={() => {
                              setSelectedDate(null);
                              router.push(`/dashboard/scheduler/${event.id}`);
                            }}
                          >
                            {/* 內容類型圖標 */}
                            <div className={cn(
                              "p-2.5 rounded-xl bg-gradient-to-br flex-shrink-0",
                              contentType?.color || "from-slate-600 to-slate-700"
                            )}>
                              <ContentIcon className="w-5 h-5 text-white" />
                            </div>
                            
                            {/* 內容資訊 */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate mb-1">
                                {event.title || "無標題"}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-slate-400">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {eventDate.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                                <span>{contentType?.label}</span>
                              </div>
                            </div>
                            
                            {/* 狀態和箭頭 */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge className={cn("text-xs", statusConfig?.color)}>
                                <StatusIcon className={cn("w-3 h-3 mr-1", event.status === "publishing" && "animate-spin")} />
                                {statusConfig?.label}
                              </Badge>
                              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* 新增排程按鈕 */}
                      <Button
                        variant="outline"
                        className="w-full border-dashed border-slate-600 text-slate-400 hover:text-white hover:border-indigo-500 hover:bg-indigo-500/10"
                        onClick={() => {
                          const dateStr = selectedDate.toISOString().slice(0, 10) + "T12:00";
                          setNewPost({ ...newPost, scheduled_at: dateStr });
                          setSelectedDate(null);
                          setShowCreateForm(true);
                          loadGeneratedContent();
                          fetchSmartSuggestions();
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        在這天新增排程
                      </Button>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        )}

        {/* 連結帳號 */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="border-b border-slate-700">
            <CardTitle className="text-white flex items-center gap-2">
              <Link2 className="w-5 h-5 text-indigo-400" />
              連結帳號
            </CardTitle>
            <CardDescription className="text-slate-400">
              管理您的社群帳號連結
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {/* 已連結帳號摘要 */}
            {accounts.length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                <Unlink className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">尚未連結任何帳號</p>
              </div>
            ) : (
              <div className="space-y-2">
                {accounts.slice(0, 5).map(account => {
                  const platform = PLATFORMS[account.platform];
                  const isWordpress = account.platform === "wordpress";
                  const hasGA4 = isWordpress && account.extra_settings?.ga4_property_id;
                  return (
                    <div
                      key={account.id}
                      className="p-2.5 bg-slate-800/50 rounded-lg"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{platform?.icon || "📱"}</span>
                          <div>
                            <span className="text-white text-sm">{platform?.name || account.platform}</span>
                            {isWordpress && account.extra_settings?.site_name && (
                              <p className="text-xs text-slate-500">{account.extra_settings.site_name}</p>
                            )}
                          </div>
                          {platform?.hasCost && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded" title={platform.costNote}>
                              ℹ️
                            </span>
                          )}
                        </div>
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          account.is_active ? "bg-green-400" : "bg-red-400"
                        )} />
                      </div>
                      {/* WordPress GA4 設定按鈕 */}
                      {isWordpress && (
                        <div className="mt-2 pt-2 border-t border-slate-700/50">
                          <button
                            onClick={() => router.push("/dashboard/settings/ga4")}
                            className={cn(
                              "w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors",
                              hasGA4 
                                ? "bg-green-500/10 text-green-400 hover:bg-green-500/20" 
                                : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                            )}
                          >
                            <span className="flex items-center gap-1.5">
                              <TrendingUp className="w-3 h-3" />
                              {hasGA4 ? "GA4 已連接" : "設定 GA4 獲取瀏覽數據"}
                            </span>
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {accounts.length > 5 && (
                  <p className="text-xs text-slate-500 text-center">
                    +{accounts.length - 5} 個其他帳號
                  </p>
                )}
              </div>
            )}
            
            {/* 前往設定按鈕 */}
            <Button
              variant="outline"
              className="w-full border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={() => router.push("/dashboard/settings")}
            >
              <Settings className="w-4 h-4 mr-2" />
              前往帳號設定
              <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
            </Button>

            {/* 支援平台預覽 */}
            <div className="pt-3 border-t border-slate-700/50">
              <p className="text-xs text-slate-500 mb-2">支援平台</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(PLATFORMS).slice(0, 6).map(([id, platform]) => (
                  <span 
                    key={id} 
                    className={cn("text-lg relative", platform.hasCost && "mr-1")} 
                    title={platform.hasCost ? `${platform.name} - ${platform.costNote}` : platform.name}
                  >
                    {platform.icon}
                    {platform.hasCost && (
                      <span className="absolute -top-1 -right-2 text-[8px]">ℹ️</span>
                    )}
                  </span>
                ))}
                <span className="text-xs text-slate-500 self-center ml-1">+2</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 排程列表 */}
      <Card id="schedule-list" className="bg-slate-900 border-slate-700">
        <CardHeader className="border-b border-slate-700">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              排程列表
              {statusFilter !== "all" && (
                <Badge className={cn(
                  "text-xs",
                  statusFilter === "pending" && "bg-yellow-500/20 text-yellow-400",
                  statusFilter === "published" && "bg-green-500/20 text-green-400",
                  statusFilter === "failed" && "bg-red-500/20 text-red-400",
                  statusFilter === "this_week" && "bg-indigo-500/20 text-indigo-400"
                )}>
                  {statusFilter === "pending" && "待發布"}
                  {statusFilter === "published" && "已發布"}
                  {statusFilter === "failed" && "失敗"}
                  {statusFilter === "this_week" && "本週"}
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px] bg-slate-800 border-slate-600 text-white">
                  <SelectValue placeholder="狀態篩選" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="all" className="text-white">全部狀態</SelectItem>
                  <SelectItem value="pending" className="text-white">待發布</SelectItem>
                  <SelectItem value="published" className="text-white">已發布</SelectItem>
                  <SelectItem value="failed" className="text-white">失敗</SelectItem>
                  <SelectItem value="this_week" className="text-white">本週排程</SelectItem>
                </SelectContent>
              </Select>
              <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
                <SelectTrigger className="w-[130px] bg-slate-800 border-slate-600 text-white">
                  <SelectValue placeholder="內容類型" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="all" className="text-white">全部類型</SelectItem>
                  {CONTENT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value} className="text-white">
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredPosts.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>尚無排程</p>
              <Button
                variant="outline"
                className="mt-4 border-slate-600 text-slate-300"
                onClick={() => {
                  setShowCreateForm(true);
                  loadGeneratedContent();
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                建立第一個排程
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {filteredPosts.map(post => {
                const statusConfig = STATUS_CONFIG[post.status];
                const StatusIcon = statusConfig?.icon || Clock;
                const contentType = CONTENT_TYPES.find(t => t.value === post.content_type);
                const ContentIcon = contentType?.icon || FileText;
                // 判斷發布類型
                const publishType = post.settings?.publish_type || 
                  (post.status === "published" ? "immediate" : "scheduled");
                const isImmediate = publishType === "immediate";
                
                return (
                  <div key={post.id} className="p-4 hover:bg-slate-800/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={cn("p-2 rounded-lg bg-gradient-to-br", contentType?.color || "from-slate-600 to-slate-700")}>
                          <ContentIcon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <button
                              onClick={() => router.push(`/dashboard/scheduler/${post.id}`)}
                              className="text-white font-medium truncate hover:text-indigo-400 transition-colors text-left"
                            >
                              {post.title || post.caption?.slice(0, 50) || "無標題"}
                            </button>
                            <Badge className={cn("text-xs", statusConfig?.color)}>
                              <StatusIcon className={cn("w-3 h-3 mr-1", post.status === "publishing" && "animate-spin")} />
                              {statusConfig?.label}
                            </Badge>
                            {/* 發布類型標籤 */}
                            <Badge className={cn(
                              "text-xs",
                              isImmediate 
                                ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" 
                                : "bg-violet-500/20 text-violet-400 border-violet-500/30"
                            )}>
                              {isImmediate ? (
                                <>
                                  <Zap className="w-3 h-3 mr-1" />
                                  直接發布
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3 mr-1" />
                                  排程上架
                                </>
                              )}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-400 truncate">{post.caption}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(post.scheduled_at).toLocaleString("zh-TW")}
                            </span>
                            {contentType && (
                              <span className="flex items-center gap-1">
                                <Layers className="w-3 h-3" />
                                {contentType.label}
                              </span>
                            )}
                            {post.media_urls?.length > 0 && (
                              <span className="flex items-center gap-1">
                                <ImageIcon className="w-3 h-3" />
                                {post.media_urls.length} 個媒體
                              </span>
                            )}
                          </div>
                          {post.error_message && (
                            <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {post.error_message}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {post.status === "failed" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRetryPost(post.id)}
                            className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        )}
                        {(post.status === "pending" || post.status === "queued") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelPost(post.id)}
                            className="text-slate-400 hover:text-slate-300"
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePost(post.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 新增排程彈窗 - 重新設計 */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="w-full max-w-4xl bg-slate-900 border-slate-700 my-8">
            <CardHeader className="border-b border-slate-700">
              <CardTitle className="text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                新增排程
              </CardTitle>
              <CardDescription className="text-slate-400">
                從已生成的內容中選擇，或手動輸入新內容
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {/* 模式切換標籤 */}
              <div className="flex border-b border-slate-700">
                <button
                  onClick={() => setCreateMode("select")}
                  className={cn(
                    "flex-1 py-3 px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2",
                    createMode === "select"
                      ? "bg-indigo-600/20 text-indigo-400 border-b-2 border-indigo-500"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  )}
                >
                  <FolderOpen className="w-4 h-4" />
                  從已生成內容選擇
                </button>
                <button
                  onClick={() => setCreateMode("manual")}
                  className={cn(
                    "flex-1 py-3 px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2",
                    createMode === "manual"
                      ? "bg-indigo-600/20 text-indigo-400 border-b-2 border-indigo-500"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  )}
                >
                  <Edit className="w-4 h-4" />
                  手動輸入
                </button>
              </div>

              <div className="p-4">
                {createMode === "select" ? (
                  <div className="space-y-4">
                    {/* 內容選擇區 - 三個引擎的內容 */}
                    <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto pr-2">
                      
                      {/* 社群圖文歷史 */}
                      <div className="border border-pink-500/30 rounded-xl overflow-hidden">
                        <button
                          onClick={() => setExpandedSection(expandedSection === "social" ? null : "social")}
                          className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-pink-900/20 to-rose-900/20 hover:from-pink-900/30 hover:to-rose-900/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500">
                              <ImageIcon className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-white font-medium">社群圖文</span>
                            <Badge className="bg-pink-500/20 text-pink-300">{socialHistory.length}</Badge>
                          </div>
                          {expandedSection === "social" ? (
                            <ChevronUp className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          )}
                        </button>
                        {expandedSection === "social" && (
                          <div className="p-4 space-y-2 bg-slate-800/30">
                            {socialHistory.length === 0 ? (
                              <p className="text-slate-500 text-sm text-center py-4">尚無生成記錄</p>
                            ) : (
                              socialHistory.slice(0, 10).map((item) => (
                                <button
                                  key={item.id}
                                  onClick={() => handleSelectContent("social", item)}
                                  className={cn(
                                    "w-full text-left p-3 rounded-lg border transition-all",
                                    selectedContent?.data?.id === item.id
                                      ? "border-pink-500 bg-pink-500/10"
                                      : "border-slate-700 hover:border-pink-500/50 hover:bg-slate-800"
                                  )}
                                >
                                  <div className="flex items-start gap-3">
                                    {item.image_url && (
                                      <img
                                        src={item.image_url}
                                        alt=""
                                        className="w-16 h-16 rounded-lg object-cover"
                                      />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-white font-medium truncate">{item.topic || "社群貼文"}</span>
                                        <Badge className="text-xs bg-slate-700 text-slate-300">{item.platform}</Badge>
                                      </div>
                                      <p className="text-xs text-slate-400 line-clamp-2">{item.caption}</p>
                                      <p className="text-xs text-slate-500 mt-1">{formatTime(item.timestamp)}</p>
                                    </div>
                                    {selectedContent?.data?.id === item.id && (
                                      <CheckCircle2 className="w-5 h-5 text-pink-400 flex-shrink-0" />
                                    )}
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      {/* 短影音歷史 */}
                      <div className="border border-purple-500/30 rounded-xl overflow-hidden">
                        <button
                          onClick={() => setExpandedSection(expandedSection === "video" ? null : "video")}
                          className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-purple-900/20 to-indigo-900/20 hover:from-purple-900/30 hover:to-indigo-900/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500">
                              <Video className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-white font-medium">短影音</span>
                            <Badge className="bg-purple-500/20 text-purple-300">{videoHistory.length}</Badge>
                          </div>
                          {expandedSection === "video" ? (
                            <ChevronUp className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          )}
                        </button>
                        {expandedSection === "video" && (
                          <div className="p-4 space-y-2 bg-slate-800/30">
                            {videoHistory.length === 0 ? (
                              <p className="text-slate-500 text-sm text-center py-4">尚無生成記錄</p>
                            ) : (
                              videoHistory.slice(0, 10).map((item) => (
                                <button
                                  key={item.id}
                                  onClick={() => handleSelectContent("video", item)}
                                  className={cn(
                                    "w-full text-left p-3 rounded-lg border transition-all",
                                    selectedContent?.data?.id === item.id
                                      ? "border-purple-500 bg-purple-500/10"
                                      : "border-slate-700 hover:border-purple-500/50 hover:bg-slate-800"
                                  )}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                                      <Play className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-white font-medium truncate">{item.prompt?.slice(0, 40) || "短影音"}...</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <Badge className="text-xs bg-slate-700 text-slate-300">{item.duration}</Badge>
                                        <Badge className="text-xs bg-slate-700 text-slate-300">{item.quality}</Badge>
                                      </div>
                                      <p className="text-xs text-slate-500 mt-1">{formatTime(item.timestamp)}</p>
                                    </div>
                                    {selectedContent?.data?.id === item.id && (
                                      <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0" />
                                    )}
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      {/* 部落格文章 */}
                      <div className="border border-blue-500/30 rounded-xl overflow-hidden">
                        <button
                          onClick={() => setExpandedSection(expandedSection === "blog" ? null : "blog")}
                          className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-900/20 to-cyan-900/20 hover:from-blue-900/30 hover:to-cyan-900/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
                              <FileText className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-white font-medium">部落格文章</span>
                            <Badge className="bg-blue-500/20 text-blue-300">{blogPosts.length}</Badge>
                          </div>
                          {expandedSection === "blog" ? (
                            <ChevronUp className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          )}
                        </button>
                        {expandedSection === "blog" && (
                          <div className="p-4 space-y-2 bg-slate-800/30">
                            {blogPosts.length === 0 ? (
                              <p className="text-slate-500 text-sm text-center py-4">尚無文章</p>
                            ) : (
                              blogPosts.slice(0, 10).map((item) => (
                                <button
                                  key={item.id}
                                  onClick={() => handleSelectContent("blog", item)}
                                  className={cn(
                                    "w-full text-left p-3 rounded-lg border transition-all",
                                    selectedContent?.data?.id === item.id
                                      ? "border-blue-500 bg-blue-500/10"
                                      : "border-slate-700 hover:border-blue-500/50 hover:bg-slate-800"
                                  )}
                                >
                                  <div className="flex items-start gap-3">
                                    {item.cover_image_url && (
                                      <img
                                        src={item.cover_image_url}
                                        alt=""
                                        className="w-16 h-16 rounded-lg object-cover"
                                      />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-white font-medium truncate">{item.title}</p>
                                      <p className="text-xs text-slate-400 line-clamp-2 mt-1">{item.summary}</p>
                                      <p className="text-xs text-slate-500 mt-1">
                                        {new Date(item.created_at).toLocaleDateString("zh-TW")}
                                      </p>
                                    </div>
                                    {selectedContent?.data?.id === item.id && (
                                      <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
                                    )}
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 已選擇的內容預覽 - 增強版 */}
                    {selectedContent && (
                      <div className="mt-4 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                            <span className="text-indigo-400 font-medium">已選擇內容預覽</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedContent(null);
                              resetForm();
                            }}
                            className="text-slate-400 hover:text-white h-6 px-2"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                        
                        <div className="flex gap-4">
                          {/* 媒體預覽 */}
                          {newPost.media_urls.length > 0 && (
                            <div className="flex-shrink-0">
                              {newPost.content_type === "short_video" ? (
                                <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                                  <Play className="w-8 h-8 text-white" />
                                </div>
                              ) : (
                                <img 
                                  src={newPost.media_urls[0]} 
                                  alt="預覽" 
                                  className="w-24 h-24 rounded-lg object-cover border border-slate-600"
                                />
                              )}
                            </div>
                          )}
                          
                          {/* 文字內容預覽 */}
                          <div className="flex-1 min-w-0">
                            {newPost.title && (
                              <h4 className="text-white font-medium mb-1 truncate">{newPost.title}</h4>
                            )}
                            <p className="text-slate-400 text-sm line-clamp-2">{newPost.caption}</p>
                            
                            {/* Hashtags */}
                            {newPost.hashtags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {newPost.hashtags.slice(0, 5).map((tag, i) => (
                                  <Badge key={i} className="bg-slate-700/50 text-slate-300 text-xs">
                                    #{tag}
                                  </Badge>
                                ))}
                                {newPost.hashtags.length > 5 && (
                                  <Badge className="bg-slate-700/50 text-slate-400 text-xs">
                                    +{newPost.hashtags.length - 5}
                                  </Badge>
                                )}
                              </div>
                            )}
                            
                            {/* 內容類型標籤 */}
                            <div className="flex items-center gap-2 mt-2">
                              <Badge className={cn(
                                "text-xs",
                                newPost.content_type === "social_image" && "bg-pink-500/20 text-pink-300",
                                newPost.content_type === "short_video" && "bg-purple-500/20 text-purple-300",
                                newPost.content_type === "blog_post" && "bg-blue-500/20 text-blue-300"
                              )}>
                                {CONTENT_TYPES.find(t => t.value === newPost.content_type)?.label}
                              </Badge>
                              {newPost.media_urls.length > 1 && (
                                <span className="text-xs text-slate-500">
                                  +{newPost.media_urls.length - 1} 個媒體
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* 手動輸入模式 */
                  <div className="space-y-4">
                    {/* 內容類型 */}
                    <div>
                      <label className="text-sm text-slate-300 mb-2 block">內容類型</label>
                      <Select
                        value={newPost.content_type}
                        onValueChange={(v) => setNewPost({ ...newPost, content_type: v })}
                      >
                        <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-600">
                          {CONTENT_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value} className="text-white">
                              <div className="flex items-center gap-2">
                                <type.icon className="w-4 h-4" />
                                {type.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 標題 */}
                    <div>
                      <label className="text-sm text-slate-300 mb-2 block">標題（選填）</label>
                      <Input
                        value={newPost.title}
                        onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                        placeholder="輸入標題..."
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    </div>

                    {/* 文案 */}
                    <div>
                      <label className="text-sm text-slate-300 mb-2 block">文案內容</label>
                      <Textarea
                        value={newPost.caption}
                        onChange={(e) => setNewPost({ ...newPost, caption: e.target.value })}
                        placeholder="輸入文案..."
                        className="bg-slate-800 border-slate-600 text-white min-h-[120px]"
                      />
                    </div>

                    {/* Hashtags */}
                    <div>
                      <label className="text-sm text-slate-300 mb-2 block flex items-center gap-2">
                        <Hash className="w-4 h-4" />
                        標籤（逗號分隔）
                      </label>
                      <Input
                        value={newPost.hashtags.join(", ")}
                        onChange={(e) => setNewPost({ 
                          ...newPost, 
                          hashtags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) 
                        })}
                        placeholder="例如: 行銷, 品牌, 社群..."
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    </div>

                    {/* 媒體上傳 */}
                    <div>
                      <label className="text-sm text-slate-300 mb-2 block flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        上傳媒體（圖片/影片）
                      </label>
                      
                      {/* 已上傳的媒體預覽 */}
                      {uploadPreviews.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-3">
                          {uploadPreviews.map((preview, index) => (
                            <div key={index} className="relative group">
                              {preview.startsWith("data:video") ? (
                                <div className="aspect-square rounded-lg bg-slate-800 flex items-center justify-center border border-slate-600">
                                  <Video className="w-8 h-8 text-purple-400" />
                                </div>
                              ) : (
                                <img
                                  src={preview}
                                  alt={`預覽 ${index + 1}`}
                                  className="aspect-square w-full rounded-lg object-cover border border-slate-600"
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveMedia(index)}
                                className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 上傳區域 */}
                      <label
                        className={cn(
                          "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors",
                          uploading 
                            ? "border-indigo-500 bg-indigo-500/10" 
                            : "border-slate-600 hover:border-indigo-500 hover:bg-slate-800/50"
                        )}
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          {uploading ? (
                            <>
                              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-2" />
                              <p className="text-sm text-indigo-400">上傳中...</p>
                            </>
                          ) : (
                            <>
                              <Upload className="w-8 h-8 text-slate-400 mb-2" />
                              <p className="text-sm text-slate-400">
                                <span className="font-semibold text-indigo-400">點擊上傳</span> 或拖放文件
                              </p>
                              <p className="text-xs text-slate-500 mt-1">PNG, JPG, GIF, MP4（最大 50MB）</p>
                            </>
                          )}
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*,video/*"
                          multiple
                          onChange={handleImageUpload}
                          disabled={uploading}
                        />
                      </label>
                      
                      {newPost.media_urls.length > 0 && (
                        <p className="text-xs text-slate-500 mt-2">
                          已添加 {newPost.media_urls.length} 個媒體文件
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* 排程時間 - 兩種模式共用 */}
                <div className="mt-6 pt-4 border-t border-slate-700">
                  <label className="text-sm text-slate-300 mb-2 block flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    排程發布時間
                  </label>
                  <Input
                    type="datetime-local"
                    value={newPost.scheduled_at}
                    onChange={(e) => setNewPost({ ...newPost, scheduled_at: e.target.value })}
                    className="bg-slate-800 border-slate-600 text-white"
                    min={new Date().toISOString().slice(0, 16)}
                  />
                  
                  {/* 智慧排程建議 */}
                  <div className="mt-4 p-4 bg-gradient-to-r from-yellow-900/20 to-amber-900/20 rounded-xl border border-yellow-500/30">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="w-4 h-4 text-yellow-400" />
                      <span className="text-yellow-400 font-medium text-sm">智慧時段建議</span>
                      {loadingSuggestions && (
                        <Loader2 className="w-3 h-3 animate-spin text-yellow-400 ml-auto" />
                      )}
                    </div>
                    
                    {smartSuggestions ? (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-400 mb-2">
                          {smartSuggestions.platform_tips?.content_tip || "點選下方時段自動填入"}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {smartSuggestions.next_available_slots.slice(0, 4).map((slot, idx) => {
                            const date = new Date(slot);
                            const isSelected = newPost.scheduled_at === date.toISOString().slice(0, 16);
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => applySmartSlot(slot)}
                                className={cn(
                                  "px-3 py-2 rounded-lg text-xs transition-all flex items-center gap-2",
                                  isSelected
                                    ? "bg-yellow-500 text-black"
                                    : "bg-slate-800 text-slate-300 hover:bg-yellow-500/20 hover:text-yellow-300 border border-slate-700"
                                )}
                              >
                                <TrendingUp className="w-3 h-3" />
                                <span>
                                  {date.toLocaleDateString("zh-TW", { weekday: "short", month: "short", day: "numeric" })}
                                  {" "}
                                  {date.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                                {smartSuggestions.suggested_slots[idx] && (
                                  <Badge className="bg-green-500/20 text-green-400 text-[10px]">
                                    {smartSuggestions.suggested_slots[idx].score}分
                                  </Badge>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {smartSuggestions.suggested_slots[0]?.reason && (
                          <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {smartSuggestions.suggested_slots[0].reason}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fetchSmartSuggestions()}
                          disabled={loadingSuggestions}
                          className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                        >
                          {loadingSuggestions ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              分析中...
                            </>
                          ) : (
                            <>
                              <Zap className="w-3 h-3 mr-1" />
                              取得建議時段
                            </>
                          )}
                        </Button>
                        <span className="text-xs text-slate-500">根據最佳發文時段推薦</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 按鈕 */}
                <div className="flex justify-end gap-3 pt-6">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowCreateForm(false);
                      resetForm();
                    }}
                    className="text-slate-400"
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleCreatePost}
                    disabled={creating || (!newPost.caption && !newPost.title)}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        建立中...
                      </>
                    ) : (
                      <>
                        <Calendar className="w-4 h-4 mr-2" />
                        建立排程
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
