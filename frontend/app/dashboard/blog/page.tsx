"use client";

import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Loader2, Wand2, History, FileText, Trash2, Copy, Check, X, 
  Image as ImageIcon, Sparkles, Download, ChevronDown, ChevronUp,
  RefreshCw, Zap, CheckCircle2, Circle, ArrowRight, Upload, ImagePlus,
  Code, Clock, Eye, Edit3, Save, RotateCcw, Maximize2, Minimize2,
  Globe, Send, ExternalLink, Link2, Settings2, AlertTriangle, CheckSquare, Type,
  Palette
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ScheduleDialog, ScheduleContent } from "@/components/schedule-dialog";
import ImageTextEditor from "@/components/image-text-editor";
import { useRouter } from "next/navigation";
import { setPendingImageForEditor, getPendingImageForEngine } from "@/lib/services/shared-gallery-service";
import { useCredits } from "@/lib/credits-context";

// 定義 Post 介面
interface Post {
  id: number;
  title: string;
  content: string;
  created_at: string;
  cover_image?: string;
}

// WordPress 站點介面
interface WordPressSite {
  id: number;
  site_url: string;
  site_name: string | null;
  username: string;
  avatar_url: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
}

// WordPress 分類介面
interface WordPressCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
}

// 語氣風格選項 - 豐富多元
const TONE_OPTIONS = [
  // 基礎風格
  { value: "professional", label: "💼 專業正式", desc: "商業報告、企業文案" },
  { value: "casual", label: "☕ 輕鬆隨性", desc: "生活分享、日常隨筆" },
  { value: "friendly", label: "🤝 親切友善", desc: "社群互動、品牌故事" },
  { value: "humorous", label: "😄 幽默風趣", desc: "趣味內容、輕鬆話題" },
  { value: "educational", label: "📚 教育科普", desc: "知識分享、教學指南" },
  
  // 進階風格
  { value: "storytelling", label: "📖 故事敘述", desc: "品牌故事、人物專訪" },
  { value: "inspiring", label: "✨ 激勵人心", desc: "勵志文章、成功案例" },
  { value: "analytical", label: "📊 分析評論", desc: "市場分析、產業觀察" },
  { value: "conversational", label: "💬 對話式", desc: "問答形式、讀者互動" },
  { value: "luxury", label: "👑 高端奢華", desc: "精品品牌、頂級服務" },
  
  // 特殊風格
  { value: "minimalist", label: "🎯 極簡精煉", desc: "重點摘要、快速閱讀" },
  { value: "emotional", label: "💝 感性動人", desc: "情感連結、暖心故事" },
  { value: "authoritative", label: "🏛️ 權威專家", desc: "專業見解、深度報導" },
  { value: "trendy", label: "🔥 潮流時尚", desc: "流行趨勢、年輕族群" },
  { value: "faith", label: "🕊️ 信仰靈性", desc: "靈修分享、生命見證" },
];

// 圖片品質選項
const IMAGE_QUALITY_OPTIONS = [
  { value: "draft", label: "⚡ 快速", cost: 5 },
  { value: "standard", label: "✨ 標準", cost: 10 },
  { value: "premium", label: "💎 高級", cost: 20 },
];

// 快速提示詞模板 - 分類組織
const QUICK_PROMPT_CATEGORIES = [
  {
    category: "風格",
    icon: "🎨",
    prompts: [
      { label: "簡約極簡", prompt: "minimalist, clean design, white space, modern aesthetic, Scandinavian style" },
      { label: "科技未來", prompt: "futuristic, tech vibes, neon accents, holographic, cyberpunk atmosphere" },
      { label: "復古懷舊", prompt: "vintage, retro aesthetic, film grain, nostalgic, 70s 80s style" },
      { label: "奢華高端", prompt: "luxury, premium, elegant, gold accents, sophisticated, high-end" },
      { label: "創意藝術", prompt: "artistic, creative, colorful, abstract elements, gallery quality" },
      { label: "手繪插畫", prompt: "hand-drawn illustration, watercolor, sketch style, artistic strokes" },
    ]
  },
  {
    category: "場景",
    icon: "🏞️",
    prompts: [
      { label: "自然風光", prompt: "natural scenery, outdoor, fresh air, green nature, landscape" },
      { label: "城市街景", prompt: "urban cityscape, modern architecture, street view, metropolitan" },
      { label: "海邊沙灘", prompt: "beach, ocean waves, sandy shore, seaside, tropical paradise" },
      { label: "山林森林", prompt: "mountain forest, misty woods, tall trees, hiking trail" },
      { label: "咖啡廳", prompt: "cozy cafe, coffee shop ambiance, latte art, wooden interior" },
      { label: "圖書館", prompt: "library, bookshelves, reading corner, quiet study space" },
    ]
  },
  {
    category: "氛圍",
    icon: "✨",
    prompts: [
      { label: "溫馨居家", prompt: "cozy home, warm lighting, comfortable interior, hygge" },
      { label: "商務專業", prompt: "corporate, professional, business environment, clean office" },
      { label: "浪漫夢幻", prompt: "romantic, dreamy, soft focus, pastel colors, fairy tale" },
      { label: "活力動感", prompt: "energetic, dynamic, vibrant colors, motion blur, action" },
      { label: "寧靜平和", prompt: "peaceful, calm, serene, zen garden, meditation" },
      { label: "神秘暗黑", prompt: "mysterious, dark atmosphere, moody lighting, dramatic shadows" },
    ]
  },
  {
    category: "光線",
    icon: "💡",
    prompts: [
      { label: "金色時光", prompt: "golden hour, warm sunset lighting, orange glow, magic hour" },
      { label: "清晨日出", prompt: "sunrise, early morning light, soft dawn, fresh start" },
      { label: "霓虹夜景", prompt: "neon lights, night scene, city lights, glowing signs" },
      { label: "柔和逆光", prompt: "backlight, soft rim lighting, silhouette, halo effect" },
      { label: "工作室光", prompt: "studio lighting, professional photography, softbox, even light" },
      { label: "自然窗光", prompt: "natural window light, indoor daylight, soft shadows" },
    ]
  },
  {
    category: "主題",
    icon: "📚",
    prompts: [
      { label: "美食料理", prompt: "food photography, delicious cuisine, gourmet, appetizing" },
      { label: "健康運動", prompt: "fitness, wellness, healthy lifestyle, sports, active" },
      { label: "旅行探索", prompt: "travel, adventure, exploration, wanderlust, journey" },
      { label: "教育學習", prompt: "education, learning, books, knowledge, study" },
      { label: "音樂藝術", prompt: "music, instruments, concert, artistic performance" },
      { label: "信仰靈性", prompt: "spiritual, peaceful, sacred light, divine atmosphere, hope" },
    ]
  },
  {
    category: "質感",
    icon: "🔮",
    prompts: [
      { label: "電影感", prompt: "cinematic, film look, anamorphic, movie still, 35mm" },
      { label: "雜誌封面", prompt: "magazine cover, editorial, fashion photography, glossy" },
      { label: "3D渲染", prompt: "3D render, octane, blender, CGI, realistic render" },
      { label: "航拍視角", prompt: "aerial view, drone shot, bird's eye view, top down" },
      { label: "微距特寫", prompt: "macro photography, close-up details, bokeh background" },
      { label: "長曝光", prompt: "long exposure, light trails, smooth water, motion blur" },
    ]
  }
];

// 扁平化為簡單陣列（向後相容）
const QUICK_PROMPTS = QUICK_PROMPT_CATEGORIES.flatMap(cat => cat.prompts);

// 步驟指示器組件
function StepIndicator({ 
  currentStep, 
  hasArticle, 
  hasImage 
}: { 
  currentStep: number; 
  hasArticle: boolean; 
  hasImage: boolean;
}) {
  const steps = [
    { label: "生成文章", completed: hasArticle },
    { label: "封面圖片", completed: hasImage },
    { label: "準備發布", completed: hasArticle && hasImage },
  ];

  return (
    <div className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-800/50 rounded-lg">
      {steps.map((step, index) => (
        <div key={index} className="flex items-center">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
            step.completed 
              ? "bg-green-500/20 text-green-400" 
              : currentStep === index + 1
                ? "bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/50"
                : "bg-slate-700/50 text-slate-500"
          )}>
            {step.completed ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <Circle className="w-3.5 h-3.5" />
            )}
            {step.label}
          </div>
          {index < steps.length - 1 && (
            <ArrowRight className={cn(
              "w-4 h-4 mx-1",
              step.completed ? "text-green-500" : "text-slate-600"
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function BlogPage() {
  const router = useRouter();
  const { refreshCredits } = useCredits();
  
  // 客戶端掛載狀態（防止 Hydration 錯誤）
  const [isMounted, setIsMounted] = useState(false);
  
  // 文章生成狀態
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("professional");
  const [loading, setLoading] = useState(false);
  const [currentPost, setCurrentPost] = useState<Post | null>(null);
  const [history, setHistory] = useState<Post[]>([]);
  const [copied, setCopied] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // 圖片生成狀態
  const [imageLoading, setImageLoading] = useState(false);
  const [imageQuality, setImageQuality] = useState("standard");
  const [customPrompt, setCustomPrompt] = useState("");
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [imageSourceMode, setImageSourceMode] = useState<"upload" | "generate">("generate");

  // 參考圖片狀態
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // 直接上傳封面圖狀態
  const [uploadedCover, setUploadedCover] = useState<File | null>(null);
  const [uploadedCoverPreview, setUploadedCoverPreview] = useState<string | null>(null);
  const [isUploadDragging, setIsUploadDragging] = useState(false);

  // 一鍵生成狀態
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [autoStep, setAutoStep] = useState<"article" | "image" | null>(null);
  
  // 排程上架狀態
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleContent, setScheduleContent] = useState<ScheduleContent | null>(null);
  
  // 圖片標題編輯器
  const [showImageEditor, setShowImageEditor] = useState(false);

  // WordPress 發布狀態
  const [showWordPressDialog, setShowWordPressDialog] = useState(false);
  const [wordPressSites, setWordPressSites] = useState<WordPressSite[]>([]);
  const [selectedWpSite, setSelectedWpSite] = useState<number | null>(null);
  const [wpCategories, setWpCategories] = useState<WordPressCategory[]>([]);
  const [selectedWpCategories, setSelectedWpCategories] = useState<string[]>([]);
  const [wpPublishStatus, setWpPublishStatus] = useState<"draft" | "publish" | "future">("draft");
  const [wpScheduledAt, setWpScheduledAt] = useState("");
  const [wpPublishing, setWpPublishing] = useState(false);
  const [loadingWpSites, setLoadingWpSites] = useState(false);
  const [loadingWpCategories, setLoadingWpCategories] = useState(false);

  // 編輯模式狀態
  const [viewMode, setViewMode] = useState<"preview" | "source">("preview");
  const [editContent, setEditContent] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // localStorage keys for persisting state
  const STORAGE_KEY = "blog_current_post";
  const STORAGE_SETTINGS_KEY = "blog_settings";

  // 客戶端掛載後才執行
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 檢查是否有從圖片編輯室導入的圖片
  useEffect(() => {
    if (!isMounted) return;
    
    const checkPendingImage = async () => {
      const pendingImage = await getPendingImageForEngine('blog');
      if (!pendingImage) return;
      
      // 檢查是否有保存的文章狀態（從同一篇文章跳轉到編輯室再返回）
      const savedStateStr = localStorage.getItem('blogPostStateForReturn');
      
      if (savedStateStr) {
        try {
          const savedState = JSON.parse(savedStateStr);
          
          // 檢查是否過期（10 分鐘內有效）
          if (Date.now() - savedState.timestamp < 10 * 60 * 1000) {
            // 恢復文章狀態，並更新封面圖
            setCurrentPost({
              id: savedState.postId || 0,
              title: savedState.postTitle || "",
              content: savedState.postContent || "",
              created_at: new Date().toISOString(),
              cover_image: pendingImage.dataUrl, // 用編輯後的圖片替換
            });
            if (savedState.topic) setTopic(savedState.topic);
            if (savedState.tone) setTone(savedState.tone);
            if (savedState.imageQuality) setImageQuality(savedState.imageQuality);
            if (savedState.customPrompt) setCustomPrompt(savedState.customPrompt);
            
            toast.success("已返回原文章，封面圖已更新", { duration: 3000 });
          } else {
            // 狀態過期，當作新圖片處理
            setCurrentPost(prev => prev 
              ? { ...prev, cover_image: pendingImage.dataUrl }
              : { id: 0, title: "", content: "", created_at: new Date().toISOString(), cover_image: pendingImage.dataUrl }
            );
            toast.success(`已從圖片編輯室導入「${pendingImage.name || '設計作品'}」作為封面圖`, { duration: 4000 });
          }
        } catch (e) {
          // 解析失敗，當作新圖片處理
          setCurrentPost(prev => prev 
            ? { ...prev, cover_image: pendingImage.dataUrl }
            : { id: 0, title: "", content: "", created_at: new Date().toISOString(), cover_image: pendingImage.dataUrl }
          );
          toast.success(`已從圖片編輯室導入「${pendingImage.name || '設計作品'}」作為封面圖`, { duration: 4000 });
        }
        
        // 清除保存的狀態
        localStorage.removeItem('blogPostStateForReturn');
      } else {
        // 沒有保存的狀態，當作新圖片處理
        setCurrentPost(prev => prev 
          ? { ...prev, cover_image: pendingImage.dataUrl }
          : { id: 0, title: "", content: "", created_at: new Date().toISOString(), cover_image: pendingImage.dataUrl }
        );
        toast.success(`已從圖片編輯室導入「${pendingImage.name || '設計作品'}」作為封面圖`, { duration: 4000 });
      }
    };
    
    checkPendingImage();
  }, [isMounted]);

  // 從 localStorage 恢復工作狀態（僅在客戶端掛載後）
  useEffect(() => {
    if (!isMounted) return;
    
    try {
      // 檢查並清理過大的數據（超過 100KB 的舊數據可能是 base64 圖片）
      const savedPost = localStorage.getItem(STORAGE_KEY);
      if (savedPost) {
        // 如果數據太大（可能包含 base64 圖片），清理它
        if (savedPost.length > 100000) {
          console.warn("Clearing oversized localStorage data");
          localStorage.removeItem(STORAGE_KEY);
        } else {
        setCurrentPost(JSON.parse(savedPost));
        }
      }
      
      // 恢復設定（不恢復 customPrompt，每次都從空白開始，讓 AI 智能生成）
      const savedSettings = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        if (settings.topic) setTopic(settings.topic);
        if (settings.tone) setTone(settings.tone);
        if (settings.imageQuality) setImageQuality(settings.imageQuality);
        // 🔑 不恢復 customPrompt - 每次生成都應該讓 AI 根據新主題智能生成
        // if (settings.customPrompt) setCustomPrompt(settings.customPrompt);
      }
    } catch (e) {
      console.error("Failed to restore blog state", e);
      // 出錯時清理可能損壞的數據
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [isMounted]);

  // 儲存當前文章到 localStorage（僅在客戶端掛載後）
  // 排除 cover_image 以避免超出 localStorage 配額
  useEffect(() => {
    if (!isMounted) return;
    
    if (currentPost) {
      try {
        // 只儲存必要字段，排除可能很大的 cover_image
        const postToSave = {
          id: currentPost.id,
          title: currentPost.title,
          content: currentPost.content,
          created_at: currentPost.created_at,
          // 只保存 URL 字串，不保存 base64 數據
          cover_image: currentPost.cover_image?.startsWith('http') ? currentPost.cover_image : undefined
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(postToSave));
      } catch (e) {
        // QuotaExceededError - 嘗試清理舊數據
        console.warn("localStorage quota exceeded, clearing old data...", e);
        try {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(STORAGE_SETTINGS_KEY);
        } catch {
          // 忽略清理錯誤
        }
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [currentPost, isMounted]);

  // 儲存設定到 localStorage（僅在客戶端掛載後）
  useEffect(() => {
    if (!isMounted) return;
    
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify({
        topic,
        tone,
        imageQuality
        // 🔑 不儲存 customPrompt - 避免上次的風格描述影響新圖片
      }));
    } catch (e) {
      console.error("Failed to save blog settings", e);
    }
  }, [topic, tone, imageQuality, isMounted]);

  // 同步編輯內容
  useEffect(() => {
    if (currentPost) {
      setEditContent(currentPost.content);
      setHasUnsavedChanges(false);
    }
  }, [currentPost?.id, currentPost?.content]);

  // 處理編輯內容變更
  const handleContentChange = (newContent: string) => {
    setEditContent(newContent);
    setHasUnsavedChanges(newContent !== currentPost?.content);
  };

  // 保存編輯的內容
  const handleSaveContent = () => {
    if (!currentPost) return;
    setCurrentPost({ ...currentPost, content: editContent });
    setHasUnsavedChanges(false);
  };

  // 取消編輯
  const handleCancelEdit = () => {
    if (currentPost) {
      setEditContent(currentPost.content);
      setHasUnsavedChanges(false);
    }
    setViewMode("preview");
  };

  // 格式化 HTML（美化原始碼）
  const formatHtml = (html: string): string => {
    // 簡單的 HTML 格式化
    let formatted = html
      .replace(/></g, '>\n<')
      .replace(/(<\/?(h[1-6]|p|div|ul|ol|li|blockquote|pre|table|tr|td|th|thead|tbody|section|article|header|footer|nav|aside)[^>]*>)/gi, '\n$1\n')
      .replace(/\n\s*\n/g, '\n')
      .trim();
    
    // 添加縮進
    const lines = formatted.split('\n');
    let indent = 0;
    const indentSize = 2;
    
    return lines.map(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return '';
      
      // 結束標籤減少縮進
      if (trimmedLine.match(/^<\/(h[1-6]|div|ul|ol|li|blockquote|pre|table|tr|td|th|thead|tbody|section|article|header|footer|nav|aside)/i)) {
        indent = Math.max(0, indent - indentSize);
      }
      
      const indentedLine = ' '.repeat(indent) + trimmedLine;
      
      // 開始標籤增加縮進（自閉合標籤除外）
      if (trimmedLine.match(/^<(h[1-6]|div|ul|ol|blockquote|pre|table|thead|tbody|section|article|header|footer|nav|aside)[^>]*>$/i) && 
          !trimmedLine.match(/\/>$/)) {
        indent += indentSize;
      }
      
      return indentedLine;
    }).filter(line => line.trim()).join('\n');
  };

  // 計算當前步驟
  const getCurrentStep = () => {
    if (!currentPost) return 1;
    if (!currentPost.cover_image) return 2;
    return 3;
  };

  // 載入歷史紀錄
  const fetchHistory = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await api.get("/blog/posts");
      setHistory(res.data);
    } catch (error: any) {
      if (error.response?.status !== 401) {
        console.error("Failed to fetch history", error);
      }
    }
  }, []);

  useEffect(() => {
    if (isMounted) {
      fetchHistory();
    }
  }, [fetchHistory, isMounted]);

  // WordPress 相關函數
  const fetchWordPressSites = useCallback(async () => {
    setLoadingWpSites(true);
    try {
      const res = await api.get("/wordpress/sites");
      setWordPressSites(res.data);
      // 如果只有一個站點，自動選擇
      if (res.data.length === 1) {
        setSelectedWpSite(res.data[0].id);
        fetchWpCategories(res.data[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch WordPress sites:", error);
    } finally {
      setLoadingWpSites(false);
    }
  }, []);

  const fetchWpCategories = async (siteId: number) => {
    setLoadingWpCategories(true);
    try {
      const res = await api.get(`/wordpress/sites/${siteId}/categories`);
      setWpCategories(res.data);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
      setWpCategories([]);
    } finally {
      setLoadingWpCategories(false);
    }
  };

  const handleOpenWordPressDialog = () => {
    if (!currentPost) {
      toast.error("請先生成文章");
      return;
    }
    setShowWordPressDialog(true);
    fetchWordPressSites();
    // 重置選項
    setSelectedWpCategories([]);
    setWpPublishStatus("draft");
    setWpScheduledAt("");
  };

  const handleWpSiteChange = (siteId: number) => {
    setSelectedWpSite(siteId);
    setWpCategories([]);
    setSelectedWpCategories([]);
    fetchWpCategories(siteId);
  };

  const handleWordPressPublish = async () => {
    if (!currentPost || !selectedWpSite) {
      toast.error("請選擇 WordPress 站點");
      return;
    }

    // 排程發布需要有時間
    if (wpPublishStatus === "future" && !wpScheduledAt) {
      toast.error("排程發布需要設定發布時間");
      return;
    }

    setWpPublishing(true);
    try {
      const payload = {
        title: currentPost.title,
        content: currentPost.content,
        excerpt: currentPost.content.replace(/<[^>]*>/g, "").substring(0, 200) + "...",
        status: wpPublishStatus,
        categories: selectedWpCategories,
        tags: [],
        featured_image_url: currentPost.cover_image || null,
        scheduled_at: wpPublishStatus === "future" ? new Date(wpScheduledAt).toISOString() : null,
      };

      const res = await api.post(`/wordpress/sites/${selectedWpSite}/publish`, payload);

      if (res.data.success) {
        const statusText = {
          draft: "草稿",
          publish: "已發布",
          future: "已排程"
        };
        toast.success(`文章${statusText[wpPublishStatus]}成功！`, {
          description: res.data.post_url ? (
            <a href={res.data.post_url} target="_blank" rel="noopener noreferrer" className="underline">
              查看文章 →
            </a>
          ) : undefined
        });
        setShowWordPressDialog(false);
      } else {
        toast.error(res.data.error_message || "發布失敗");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "WordPress 發布失敗");
    } finally {
      setWpPublishing(false);
    }
  };

  // 參考圖片處理
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('請選擇圖片檔案');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('圖片大小不能超過 10MB');
        return;
      }
      setReferenceImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveReferenceImage = () => {
    setReferenceImage(null);
    setReferenceImagePreview(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('請選擇圖片檔案');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('圖片大小不能超過 10MB');
        return;
      }
      setReferenceImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // 直接上傳封面圖處理
  const handleCoverUploadSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetCoverImage(file);
    }
  };

  const handleCoverUploadDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsUploadDragging(true);
  };

  const handleCoverUploadDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsUploadDragging(false);
  };

  const handleCoverUploadDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsUploadDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetCoverImage(file);
    }
  };

  const validateAndSetCoverImage = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('請選擇圖片檔案');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('圖片大小不能超過 10MB');
      return;
    }
    setUploadedCover(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadedCoverPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveUploadedCover = () => {
    setUploadedCover(null);
    setUploadedCoverPreview(null);
  };

  // 套用上傳的封面圖
  const handleApplyUploadedCover = async () => {
    if (!uploadedCoverPreview || !currentPost) {
      toast.error("請先上傳圖片並選擇文章");
      return;
    }
    
    setImageLoading(true);
    try {
      // 上傳到後端
      const formData = new FormData();
      if (uploadedCover) {
        formData.append("file", uploadedCover);
      }
      
      const res = await api.post("/upload/media", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      // 更新文章封面
      const imageUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${res.data.url}`;
      setCurrentPost(prev => prev ? { ...prev, cover_image: imageUrl } : null);
      
      // 清空上傳狀態
      handleRemoveUploadedCover();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "上傳失敗");
    } finally {
      setImageLoading(false);
    }
  };

  // 清除工作區狀態（開始新生成前）
  const clearWorkspaceState = () => {
    setCurrentPost(null);           // 清除當前文章
    setEditContent("");             // 清除編輯內容
    setHasUnsavedChanges(false);    // 重置未保存狀態
    setViewMode("preview");         // 重置為預覽模式
    setShowImageOptions(false);     // 收起圖片選項
    setCustomPrompt("");            // 🔑 清除自訂圖片描述，讓 AI 根據新主題智能生成
    // 清除參考圖片
    setReferenceImage(null);
    setReferenceImagePreview(null);
    // 清除上傳的封面
    setUploadedCover(null);
    setUploadedCoverPreview(null);
  };

  // 生成文章
  const handleGenerate = async (topicOverride?: string) => {
    const targetTopic = topicOverride || topic;
    if (!targetTopic.trim()) return;
    
    // 🔑 開始新生成前，先清除上一則文章的狀態
    clearWorkspaceState();
    
    setLoading(true);
    
    try {
      const res = await api.post("/blog/generate", {
        topic: targetTopic.trim(),
        tone: tone
      });
      setCurrentPost({ ...res.data, cover_image: undefined });
      fetchHistory();
      if (!topicOverride) setTopic("");
      // 即時更新導覽列點數
      refreshCredits();
      return res.data;
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "生成失敗");
      return null;
    } finally {
      setLoading(false);
    }
  };

  // 生成封面圖片
  const handleGenerateImage = async (postTitle?: string, postId?: number) => {
    const targetTitle = postTitle || currentPost?.title;
    const targetPostId = postId || currentPost?.id;
    if (!targetTitle) {
      toast.error("請先生成或選擇一篇文章");
      return null;
    }
    
    setImageLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('topic', targetTitle);
      formData.append('style', tone);
      formData.append('quality', imageQuality);
      if (customPrompt.trim()) {
        formData.append('custom_prompt', customPrompt.trim());
      }
      if (referenceImage) {
        formData.append('reference_image', referenceImage);
      }
      // 傳送文章 ID，讓後端自動更新封面圖片
      if (targetPostId) {
        formData.append('post_id', String(targetPostId));
      }
      
      const res = await api.post("/blog/generate-image", formData);
      
      setCurrentPost(prev => prev ? { ...prev, cover_image: res.data.image_url } : null);

      // 自動保存到跨引擎圖庫
      if (res.data.image_url) {
        import("@/lib/services/shared-gallery-service").then(({ sharedGalleryService }) => {
          sharedGalleryService.addImageFromUrl(res.data.image_url, {
            name: `${targetTitle} 封面圖`,
            source: "blog",
            sourceId: `blog-${targetPostId || Date.now()}`,
            metadata: {
              title: targetTitle,
              tone,
              quality: imageQuality,
            },
          }).catch(console.error);
        });
      }

      // 即時更新導覽列點數
      refreshCredits();
      return res.data;
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "圖片生成失敗");
      return null;
    } finally {
      setImageLoading(false);
    }
  };

  // 根據主題生成預設圖片描述
  const generateDefaultImagePrompt = (articleTopic: string): string => {
    // 清空舊的自訂描述，讓後端 AI 根據主題智能生成
    // 或者提供一個基於主題的建議描述
    return `關於「${articleTopic}」的專業封面圖片，高品質、有質感、符合主題氛圍`;
  };

  // 一鍵生成（文章 + 圖片）
  const handleAutoGenerate = async () => {
    if (!topic.trim()) return;
    
    // 🔑 開始新生成前，先清除所有狀態（包括自訂描述，由 clearWorkspaceState 處理）
    clearWorkspaceState();
    
    setAutoGenerating(true);
    setAutoStep("article");
    
    try {
      // Step 1: 生成文章（handleGenerate 會再次調用 clearWorkspaceState，這是安全的）
      const res = await api.post("/blog/generate", {
        topic: topic.trim(),
        tone: tone
      });
      
      if (!res.data) {
        setAutoGenerating(false);
        setAutoStep(null);
        return;
      }
      
      setCurrentPost({ ...res.data, cover_image: undefined });
      fetchHistory();
      
      // Step 2: 生成圖片（此時 customPrompt 為空，後端會根據 article.title 智能生成）
      setAutoStep("image");
      
      const formData = new FormData();
      formData.append('topic', res.data.title);
      formData.append('style', tone);
      formData.append('quality', imageQuality);
      // 傳送文章 ID，讓後端自動更新封面圖片
      formData.append('post_id', String(res.data.id));
      // customPrompt 為空，不傳送，讓後端智能生成
      
      const imgRes = await api.post("/blog/generate-image", formData);
      setCurrentPost(prev => prev ? { ...prev, cover_image: imgRes.data.image_url } : null);

      // 自動保存到跨引擎圖庫
      if (imgRes.data.image_url) {
        import("@/lib/services/shared-gallery-service").then(({ sharedGalleryService }) => {
          sharedGalleryService.addImageFromUrl(imgRes.data.image_url, {
            name: `${res.data.title} 封面圖`,
            source: "blog",
            sourceId: `blog-${res.data.id}`,
            metadata: {
              title: res.data.title,
              tone,
              quality: imageQuality,
            },
          }).catch(console.error);
        });
      }
      
      // 生成完成後，將預設提示詞填入欄位供使用者參考/修改
      setCustomPrompt(generateDefaultImagePrompt(res.data.title));
      
      setTopic("");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "生成失敗");
    } finally {
      setAutoGenerating(false);
      setAutoStep(null);
    }
  };

  // Enter 鍵生成
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !loading && !autoGenerating && topic.trim()) {
      e.preventDefault();
      handleGenerate();
    }
  };

  // 複製文章內容
  const handleCopy = async () => {
    if (!currentPost) return;
    
    try {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = currentPost.content;
      const textContent = tempDiv.textContent || tempDiv.innerText || "";
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("複製失敗");
    }
  };

  // 下載圖片
  const handleDownloadImage = async () => {
    if (!currentPost?.cover_image) return;
    
    try {
      const link = document.createElement("a");
      link.href = currentPost.cover_image;
      link.download = `${currentPost.title}-cover-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      toast.error("下載失敗");
    }
  };

  // 在圖片編輯室開啟
  const handleOpenInDesignStudio = async () => {
    if (!currentPost?.cover_image) {
      toast.error("沒有可編輯的圖片");
      return;
    }

    // 保存當前文章狀態到 localStorage（用於編輯後返回）
    // 注意：不保存圖片數據，只保存元數據
    const blogPostState = {
      postId: currentPost.id,
      postTitle: currentPost.title,
      postContent: currentPost.content,
      topic,
      tone,
      imageQuality,
      customPrompt,
      timestamp: Date.now(),
    };
    localStorage.setItem('blogPostStateForReturn', JSON.stringify(blogPostState));

    try {
      await setPendingImageForEditor({
        imageUrl: currentPost.cover_image,
        source: "blog",
        sourceId: `blog-${currentPost.id}`,
        name: `${currentPost.title} 封面圖`,
        metadata: {
          title: currentPost.title,
          content: currentPost.content?.substring(0, 200),
          tone,
        },
      });

      router.push("/dashboard/design-studio");
      toast.info("正在開啟圖片編輯室...");
    } catch (error) {
      console.error("Failed to prepare image for editor:", error);
      toast.error("準備圖片失敗");
    }
  };

  // 刪除單篇文章
  const handleDeletePost = async (postId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const confirmed = window.confirm("確定要刪除這篇文章嗎？");
    if (!confirmed) return;
    
    setDeletingId(postId);
    try {
      await api.delete(`/blog/posts/${postId}`);
      setHistory(prev => prev.filter(p => p.id !== postId));
      if (currentPost?.id === postId) {
        setCurrentPost(null);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "刪除失敗");
    } finally {
      setDeletingId(null);
    }
  };

  // 清除所有歷史紀錄
  const handleClearHistory = async () => {
    const confirmed = window.confirm(
      "⚠️ 警告：此操作將永久刪除所有歷史紀錄！\n\n刪除後無法恢復，確定要繼續嗎？"
    );
    if (!confirmed) return;
    
    try {
      await api.delete("/blog/posts/clear");
      setHistory([]);
      setCurrentPost(null);
      setSelectedIds(new Set());
      setIsSelectionMode(false);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "清除失敗");
    }
  };

  // 切換選擇模式
  const toggleSelectionMode = () => {
    if (isSelectionMode) {
      setSelectedIds(new Set());
    }
    setIsSelectionMode(!isSelectionMode);
  };

  // 切換單個文章的選擇狀態
  const toggleSelectPost = (postId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  // 全選/取消全選
  const toggleSelectAll = () => {
    if (selectedIds.size === history.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(history.map(p => p.id)));
    }
  };

  // 批量刪除
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    
    const confirmed = window.confirm(
      `確定要刪除選取的 ${selectedIds.size} 篇文章嗎？\n\n刪除後無法恢復。`
    );
    if (!confirmed) return;
    
    setIsBatchDeleting(true);
    try {
      await api.post("/blog/posts/batch-delete", {
        post_ids: Array.from(selectedIds)
      });
      setHistory(prev => prev.filter(p => !selectedIds.has(p.id)));
      if (currentPost && selectedIds.has(currentPost.id)) {
        setCurrentPost(null);
      }
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      toast.success(`已刪除 ${selectedIds.size} 篇文章`);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "批量刪除失敗");
    } finally {
      setIsBatchDeleting(false);
    }
  };

  // 計算字數
  const getWordCount = (html: string) => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    const text = tempDiv.textContent || tempDiv.innerText || "";
    return text.replace(/\s/g, "").length;
  };

  // 計算預估閱讀時間
  const getReadTime = (html: string) => {
    const words = getWordCount(html);
    const minutes = Math.ceil(words / 400); // 中文約 400 字/分鐘
    return minutes < 1 ? "< 1" : minutes.toString();
  };

  // 取得圖片品質費用
  const getImageCost = () => IMAGE_QUALITY_OPTIONS.find(o => o.value === imageQuality)?.cost || 10;

  // 計算總費用
  const getTotalCost = () => 5 + getImageCost();

  // 複製 HTML 原始碼
  const handleCopyHtml = async () => {
    if (!currentPost) return;
    try {
      await navigator.clipboard.writeText(currentPost.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("複製失敗");
    }
  };

  const isAnyLoading = loading || imageLoading || autoGenerating;

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-[1fr_320px] gap-6">
      
      {/* --- 左側：主要工作區 --- */}
      <div className="flex flex-col gap-4 min-w-0">
        
        {/* 步驟指示器 */}
        <StepIndicator 
          currentStep={getCurrentStep()} 
          hasArticle={!!currentPost} 
          hasImage={!!currentPost?.cover_image} 
        />

        {/* 文章生成輸入區 */}
        <Card className="shrink-0 bg-slate-900 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white">AI Blog 文章生成器</CardTitle>
            <CardDescription className="text-slate-400">
              輸入主題，自動生成 SEO 優化文章與封面圖片，完成後可排程發布
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input 
                placeholder="輸入文章主題..." 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isAnyLoading}
                className="flex-1 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:border-indigo-500"
              />
              <Select value={tone} onValueChange={setTone} disabled={isAnyLoading}>
                <SelectTrigger className="w-full sm:w-[130px] bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {TONE_OPTIONS.map(opt => (
                    <SelectItem 
                      key={opt.value} 
                      value={opt.value}
                      className="text-white hover:bg-slate-700 focus:bg-slate-700"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* 生成按鈕組 */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                variant="outline"
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
                onClick={() => handleGenerate()}
                disabled={isAnyLoading || !topic.trim()}
              >
                {loading && !autoGenerating ? (
                  <><Loader2 className="animate-spin w-4 h-4 mr-2"/>生成中...</>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2"/>
                    僅生成文章
                    <Badge variant="outline" className="ml-2 text-[10px] border-slate-500 text-slate-400 px-1.5 py-0">
                      5點
                    </Badge>
                  </>
                )}
              </Button>
              <Button 
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                onClick={handleAutoGenerate}
                disabled={isAnyLoading || !topic.trim()}
              >
                {autoGenerating ? (
                  <>
                    <Loader2 className="animate-spin w-4 h-4 mr-2"/>
                    {autoStep === "article" ? "生成文章中..." : "生成圖片中..."}
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2"/>
                    一鍵生成全部
                    <Badge className="ml-2 text-[10px] bg-white/20 border-0 px-1.5 py-0">
                      {getTotalCost()}點
                    </Badge>
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 文章預覽區 */}
        <Card className="overflow-hidden flex flex-col bg-slate-900 border-slate-700 min-w-0">
          <CardHeader className="border-b border-slate-700 py-3 bg-slate-800 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2 text-white min-w-0">
                <FileText className="w-4 h-4 shrink-0 text-indigo-400"/>
                <span className="truncate">{currentPost ? currentPost.title : "文章預覽"}</span>
                {currentPost?.cover_image && (
                  <Badge className="shrink-0 text-xs bg-green-500/20 text-green-400 border-0">
                    <CheckCircle2 className="w-3 h-3 mr-1"/>
                    已完成
                  </Badge>
                )}
              </CardTitle>
              {currentPost && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-8 px-2 sm:px-3 text-slate-400 hover:text-white hover:bg-slate-700"
                    title="複製純文字"
                  >
                    {copied ? (
                      <><Check className="w-4 h-4 sm:mr-1.5 text-green-400"/><span className="hidden sm:inline">已複製</span></>
                    ) : (
                      <><Copy className="w-4 h-4 sm:mr-1.5"/><span className="hidden sm:inline">複製</span></>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyHtml}
                    className="h-8 px-2 sm:px-3 text-slate-400 hover:text-white hover:bg-slate-700"
                    title="複製 HTML 原始碼"
                  >
                    <Code className="w-4 h-4 sm:mr-1.5"/><span className="hidden sm:inline">原始碼</span>
                  </Button>
                  {/* 排程上架按鈕 */}
                  <Button
                    size="sm"
                    onClick={() => {
                      // 從 HTML 中提取純文字摘要
                      const tempDiv = document.createElement("div");
                      tempDiv.innerHTML = currentPost.content;
                      const textContent = tempDiv.textContent || tempDiv.innerText || "";
                      const summary = textContent.slice(0, 200);
                      
                      setScheduleContent({
                        type: "blog_post",
                        title: currentPost.title,
                        caption: summary,
                        media_urls: currentPost.cover_image ? [currentPost.cover_image] : [],
                        hashtags: [],
                        originalData: currentPost
                      });
                      setShowScheduleDialog(true);
                    }}
                    className="h-8 px-2 sm:px-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white"
                  >
                    <Clock className="w-4 h-4 sm:mr-1.5"/><span className="hidden sm:inline">排程上架</span>
                  </Button>
                  
                  {/* WordPress 發布按鈕 */}
                  <Button
                    size="sm"
                    onClick={handleOpenWordPressDialog}
                    className="h-8 px-2 sm:px-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white"
                  >
                    <Globe className="w-4 h-4 sm:mr-1.5"/><span className="hidden sm:inline">WordPress</span>
                  </Button>
                </div>
              )}
            </div>
            {currentPost && (
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5"/>
                  {getWordCount(currentPost.content)} 字
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5"/>
                  約 {getReadTime(currentPost.content)} 分鐘閱讀
                </span>
              </div>
            )}
          </CardHeader>

          <CardContent className="p-0 bg-slate-900">
            {(loading || (autoGenerating && autoStep === "article")) ? (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
                <div className="relative">
                  <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl animate-pulse"></div>
                  <Loader2 className="w-14 h-14 animate-spin text-indigo-500 relative z-10"/>
                </div>
                <p className="mt-5 text-sm font-medium">AI 正在撰寫文章...</p>
                <p className="text-xs text-slate-500 mt-1">預計 10-30 秒</p>
                {autoGenerating && (
                  <Badge className="mt-4 bg-indigo-500/20 text-indigo-400 border-0">
                    步驟 1/2: 生成文章
                  </Badge>
                )}
              </div>
            ) : currentPost ? (
              <div className="flex flex-col">
                {/* 封面圖片區 */}
                <div className="border-b border-slate-700">
                  {currentPost.cover_image ? (
                    <div className="relative group w-full">
                      <div className="w-full aspect-video overflow-hidden bg-slate-800">
                        <img 
                          src={currentPost.cover_image} 
                          alt="封面圖片" 
                          className={cn(
                            "w-full h-full object-cover transition-all duration-300",
                            imageLoading && "blur-sm scale-105"
                          )}
                        />
                      </div>
                      
                      {/* 重新生成時的載入覆蓋層 */}
                      {imageLoading && (
                        <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                          <div className="relative">
                            <div className="absolute inset-0 bg-amber-500/30 rounded-full blur-xl animate-pulse"></div>
                            <Loader2 className="w-14 h-14 animate-spin text-amber-500 relative z-10"/>
                          </div>
                          <p className="mt-4 text-base font-medium text-white">正在重新生成圖片...</p>
                          <p className="text-sm text-slate-400 mt-1">預計 30-90 秒</p>
                          <div className="mt-4 flex items-center gap-2">
                            <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                        </div>
                      )}
                      
                      <div className={cn(
                        "absolute top-3 right-3 flex gap-2 transition-opacity",
                        imageLoading ? "opacity-0" : "opacity-0 group-hover:opacity-100"
                      )}>
                        <Button
                          size="sm"
                          onClick={handleDownloadImage}
                          className="h-8 bg-black/70 hover:bg-black/90 text-white border-0"
                        >
                          <Download className="w-4 h-4 mr-1"/>下載
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleOpenInDesignStudio}
                          className="h-8 bg-indigo-600/80 hover:bg-indigo-600 text-white border-0"
                        >
                          <Palette className="w-4 h-4 mr-1"/>編輯
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setShowImageEditor(true)}
                          className="h-8 bg-purple-600/80 hover:bg-purple-600 text-white border-0"
                        >
                          <Type className="w-4 h-4 mr-1"/>加標題
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleGenerateImage()}
                          disabled={imageLoading}
                          className="h-8 bg-black/70 hover:bg-black/90 text-white border-0"
                        >
                          {imageLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin"/>
                          ) : (
                            <><RefreshCw className="w-4 h-4 mr-1"/>重新生成</>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setShowImageOptions(!showImageOptions)}
                          className="h-8 bg-black/70 hover:bg-black/90 text-white border-0"
                        >
                          <ChevronDown className="w-4 h-4"/>
                        </Button>
                      </div>
                      <Badge className={cn(
                        "absolute bottom-3 left-3 bg-black/70 text-white border-0 transition-opacity",
                        imageLoading && "opacity-0"
                      )}>
                        16:9 封面圖片
                      </Badge>
                    </div>
                  ) : imageLoading || (autoGenerating && autoStep === "image") ? (
                    <div className="w-full min-h-[250px] bg-slate-800 flex flex-col items-center justify-center text-center">
                      <div className="relative">
                        <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-xl animate-pulse"></div>
                        <Loader2 className="w-12 h-12 animate-spin text-amber-500 relative z-10"/>
                      </div>
                      <p className="mt-4 text-sm text-slate-400">AI 正在繪製封面圖片...</p>
                      <p className="text-xs text-slate-500 mt-1">預計 30-90 秒</p>
                      {autoGenerating && (
                        <Badge className="mt-3 bg-amber-500/20 text-amber-400 border-0">
                          步驟 2/2: 生成圖片
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-800/30">
                      <div className={cn(
                        "border-2 border-dashed rounded-lg transition-all p-4",
                        showImageOptions ? "border-amber-500/50 bg-amber-500/5" : "border-slate-600"
                      )}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center text-slate-300">
                            <ImageIcon className="w-5 h-5 mr-2 text-amber-400"/>
                            <span className="font-medium">封面圖片</span>
                            <Badge variant="outline" className="ml-2 text-xs border-slate-600 text-slate-500">
                              未設定
                            </Badge>
                          </div>
                          <button
                            onClick={() => setShowImageOptions(!showImageOptions)}
                            className="text-xs text-slate-400 hover:text-white flex items-center"
                          >
                            {showImageOptions ? "收起" : "更多選項"}
                            {showImageOptions ? <ChevronUp className="w-4 h-4 ml-1"/> : <ChevronDown className="w-4 h-4 ml-1"/>}
                          </button>
                        </div>

                        {/* 模式選擇器 */}
                        <div className="flex gap-2 mb-4">
                          <button
                            onClick={() => setImageSourceMode("upload")}
                            className={cn(
                              "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all",
                              imageSourceMode === "upload"
                                ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                                : "bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white"
                            )}
                          >
                            <Upload className="w-4 h-4" />
                            上傳照片
                          </button>
                          <button
                            onClick={() => setImageSourceMode("generate")}
                            className={cn(
                              "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all",
                              imageSourceMode === "generate"
                                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30"
                                : "bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white"
                            )}
                          >
                            <Sparkles className="w-4 h-4" />
                            AI 生成
                          </button>
                        </div>

                        {/* 上傳照片模式 */}
                        {imageSourceMode === "upload" && (
                          <div className="space-y-4">
                            {uploadedCoverPreview ? (
                              <div className="relative w-full rounded-xl overflow-hidden border border-indigo-500/30 bg-slate-800 group shadow-lg shadow-indigo-500/5">
                                <div className="aspect-video w-full overflow-hidden">
                                  <img 
                                    src={uploadedCoverPreview} 
                                    alt="上傳的封面圖片" 
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                  />
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"/>
                                <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-between items-end">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-sm text-white font-medium truncate max-w-[200px]">
                                      {uploadedCover?.name}
                                    </span>
                                    <span className="text-xs text-slate-300">
                                      {uploadedCover && formatFileSize(uploadedCover.size)}
                                    </span>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={handleRemoveUploadedCover}
                                      className="h-8 bg-black/50 hover:bg-red-500/20 text-white border-slate-600 hover:border-red-500/50"
                                    >
                                      <Trash2 className="w-4 h-4"/>
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={handleApplyUploadedCover}
                                      disabled={imageLoading}
                                      className="h-8 bg-indigo-500 hover:bg-indigo-600 text-white"
                                    >
                                      {imageLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin"/>
                                      ) : (
                                        <>套用為封面</>
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div
                                onDragOver={handleCoverUploadDragOver}
                                onDragLeave={handleCoverUploadDragLeave}
                                onDrop={handleCoverUploadDrop}
                                className={cn(
                                  "relative w-full rounded-xl border-2 border-dashed transition-all overflow-hidden",
                                  isUploadDragging 
                                    ? "border-indigo-400 bg-indigo-500/10 scale-[1.01]" 
                                    : "border-slate-600 hover:border-indigo-500/50 hover:bg-slate-800/30"
                                )}
                              >
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleCoverUploadSelect}
                                  className="hidden"
                                  id="cover-image-upload"
                                />
                                <label htmlFor="cover-image-upload" className="cursor-pointer block p-8">
                                  <div className="flex flex-col items-center justify-center">
                                    <div className={cn(
                                      "w-14 h-14 mb-4 rounded-full flex items-center justify-center transition-all",
                                      isUploadDragging ? "bg-indigo-500/30 scale-110" : "bg-slate-700/80"
                                    )}>
                                      <Upload className={cn(
                                        "w-7 h-7 transition-all",
                                        isUploadDragging ? "text-indigo-400 animate-bounce" : "text-slate-400"
                                      )}/>
                                    </div>
                                    <p className="text-sm text-slate-200 font-medium mb-1">
                                      {isUploadDragging ? "放開以上傳圖片" : "拖放或點擊上傳封面照片"}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      支援 JPG、PNG、WebP，最大 10MB
                                    </p>
                                    <p className="text-xs text-indigo-400 mt-2">
                                      建議尺寸：16:9 (1920×1080)
                                    </p>
                                  </div>
                                </label>
                              </div>
                            )}
                          </div>
                        )}

                        {/* AI 生成模式 */}
                        {imageSourceMode === "generate" && showImageOptions && (
                          <div className="space-y-4 mb-4">
                            {/* 🎨 自訂圖片提示詞 - 最顯眼位置 */}
                            <div className="p-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-lg border border-amber-500/30">
                              <div className="flex items-center justify-between mb-2">
                                <label className="text-sm text-amber-300 font-medium flex items-center gap-2">
                                  <Wand2 className="w-4 h-4"/>
                                  自訂圖片描述
                                </label>
                                <div className="flex items-center gap-2">
                                  {currentPost && (
                                    <button
                                      type="button"
                                      onClick={() => setCustomPrompt(generateDefaultImagePrompt(currentPost.title))}
                                      className="text-xs px-2 py-1 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 transition-all flex items-center gap-1"
                                      title="根據文章主題自動填入建議描述"
                                    >
                                      <Sparkles className="w-3 h-3"/>
                                      使用智能建議
                                    </button>
                                  )}
                                  {customPrompt && (
                                    <button
                                      type="button"
                                      onClick={() => setCustomPrompt("")}
                                      className="text-xs px-2 py-1 rounded bg-slate-700/50 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all"
                                    >
                                      清空
                                    </button>
                                  )}
                                </div>
                              </div>
                              <Textarea
                                placeholder="留空則由 AI 根據文章主題智能生成；或自行描述想要的畫面..."
                                value={customPrompt}
                                onChange={(e) => setCustomPrompt(e.target.value)}
                                className="bg-slate-800/80 border-slate-600 text-white placeholder:text-slate-500 min-h-[70px] text-sm mb-3"
                              />
                              {/* 提示文字 */}
                              <p className="text-xs text-slate-500 mb-3">
                                💡 <span className="text-amber-400/80">留空</span> = AI 會根據「{currentPost?.title || topic || '文章主題'}」智能生成最適合的封面風格
                              </p>
                              {/* 快速提示詞標籤 - 分類顯示 */}
                              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                                {QUICK_PROMPT_CATEGORIES.map((category) => (
                                  <div key={category.category} className="space-y-1.5">
                                    <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                                      <span>{category.icon}</span>
                                      <span>{category.category}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {category.prompts.map((item) => (
                                        <button
                                          key={item.label}
                                          type="button"
                                          onClick={() => setCustomPrompt(prev => prev ? `${prev}, ${item.prompt}` : item.prompt)}
                                          className="text-[11px] px-2 py-0.5 rounded-full bg-slate-700/60 hover:bg-amber-500/30 text-slate-400 hover:text-amber-300 border border-slate-600/50 hover:border-amber-500/50 transition-all"
                                        >
                                          + {item.label}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* 參考圖片上傳 */}
                            <div className="w-full">
                              <div className="flex items-center justify-between mb-2">
                                <label className="text-xs text-slate-300 flex items-center gap-1.5 font-medium">
                                  <ImagePlus className="w-4 h-4 text-amber-400"/>
                                  參考圖片
                                  <span className="text-slate-500 font-normal">(選填)</span>
                                </label>
                                {referenceImagePreview && (
                                  <button
                                    onClick={handleRemoveReferenceImage}
                                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3"/>
                                    移除圖片
                                  </button>
                                )}
                              </div>
                              {referenceImagePreview ? (
                                <div className="relative w-full rounded-xl overflow-hidden border border-amber-500/30 bg-slate-800 group shadow-lg shadow-amber-500/5">
                                  <div className="aspect-[21/9] w-full overflow-hidden">
                                    <img 
                                      src={referenceImagePreview} 
                                      alt="參考圖片" 
                                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    />
                                  </div>
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"/>
                                  <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-between items-end">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-sm text-white font-medium truncate max-w-[200px]">
                                        {referenceImage?.name}
                                      </span>
                                      <span className="text-xs text-slate-300">
                                        {referenceImage && formatFileSize(referenceImage.size)}
                                      </span>
                                    </div>
                                    <Badge className="bg-amber-500 text-white border-0 text-xs px-3 py-1">
                                      ✓ 風格參考已設定
                                    </Badge>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  onDragOver={handleDragOver}
                                  onDragLeave={handleDragLeave}
                                  onDrop={handleDrop}
                                  className={cn(
                                    "relative w-full rounded-xl border-2 border-dashed transition-all overflow-hidden",
                                    isDragging 
                                      ? "border-amber-400 bg-amber-500/10 scale-[1.01]" 
                                      : "border-slate-600 hover:border-amber-500/50 hover:bg-slate-800/30"
                                  )}
                                >
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageSelect}
                                    className="hidden"
                                    id="reference-image-upload"
                                  />
                                  <label htmlFor="reference-image-upload" className="cursor-pointer block p-6">
                                    <div className="flex flex-col items-center justify-center">
                                      <div className={cn(
                                        "w-12 h-12 mb-3 rounded-full flex items-center justify-center transition-all",
                                        isDragging ? "bg-amber-500/30 scale-110" : "bg-slate-700/80"
                                      )}>
                                        <Upload className={cn(
                                          "w-6 h-6 transition-all",
                                          isDragging ? "text-amber-400 animate-bounce" : "text-slate-400"
                                        )}/>
                                      </div>
                                      <p className="text-sm text-slate-200 font-medium mb-1">
                                        {isDragging ? "放開以上傳圖片" : "拖放或點擊上傳參考圖片"}
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        AI 將分析圖片的風格、色調與構圖
                                      </p>
                                    </div>
                                  </label>
                                </div>
                              )}
                            </div>

                            {/* 品質選擇與生成按鈕 */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-slate-400 mb-1.5 block">品質</label>
                                <Select value={imageQuality} onValueChange={setImageQuality}>
                                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-slate-800 border-slate-600">
                                    {IMAGE_QUALITY_OPTIONS.map(opt => (
                                      <SelectItem 
                                        key={opt.value} 
                                        value={opt.value}
                                        className="text-white hover:bg-slate-700 focus:bg-slate-700"
                                      >
                                        {opt.label} ({opt.cost}點)
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex items-end">
                                <Button 
                                  className="w-full h-9 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                                  onClick={() => handleGenerateImage()}
                                  disabled={imageLoading}
                                >
                                  <Sparkles className="w-4 h-4 mr-2"/>生成圖片
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {imageSourceMode === "generate" && !showImageOptions && (
                          <Button 
                            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                            onClick={() => handleGenerateImage()}
                            disabled={imageLoading}
                          >
                            <Sparkles className="w-4 h-4 mr-2"/>生成封面圖片 ({getImageCost()}點)
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 重新生成選項 */}
                {currentPost.cover_image && showImageOptions && (
                  <div className="p-4 bg-slate-800/30 border-b border-slate-700">
                    <div className="space-y-4">
                      {/* 🎨 自訂圖片提示詞 - 最顯眼位置 */}
                      <div className="p-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-lg border border-amber-500/30">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm text-amber-300 font-medium flex items-center gap-2">
                            <Wand2 className="w-4 h-4"/>
                            自訂圖片描述
                          </label>
                          <div className="flex items-center gap-2">
                            {currentPost && (
                              <button
                                type="button"
                                onClick={() => setCustomPrompt(generateDefaultImagePrompt(currentPost.title))}
                                className="text-xs px-2 py-1 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 transition-all flex items-center gap-1"
                                title="根據文章主題自動填入建議描述"
                              >
                                <Sparkles className="w-3 h-3"/>
                                使用智能建議
                              </button>
                            )}
                            {customPrompt && (
                              <button
                                type="button"
                                onClick={() => setCustomPrompt("")}
                                className="text-xs px-2 py-1 rounded bg-slate-700/50 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all"
                              >
                                清空
                              </button>
                            )}
                          </div>
                        </div>
                        <Textarea
                          placeholder="留空則由 AI 根據文章主題智能生成；或自行描述想要的畫面..."
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          className="bg-slate-800/80 border-slate-600 text-white placeholder:text-slate-500 min-h-[70px] text-sm mb-3"
                        />
                        {/* 提示文字 */}
                        <p className="text-xs text-slate-500 mb-3">
                          💡 <span className="text-amber-400/80">留空</span> = AI 會根據「{currentPost?.title || '文章主題'}」智能生成最適合的封面風格
                        </p>
                        {/* 快速提示詞標籤 - 分類顯示 */}
                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                          {QUICK_PROMPT_CATEGORIES.map((category) => (
                            <div key={category.category} className="space-y-1.5">
                              <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                                <span>{category.icon}</span>
                                <span>{category.category}</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {category.prompts.map((item) => (
                                  <button
                                    key={item.label}
                                    type="button"
                                    onClick={() => setCustomPrompt(prev => prev ? `${prev}, ${item.prompt}` : item.prompt)}
                                    className="text-[11px] px-2 py-0.5 rounded-full bg-slate-700/60 hover:bg-amber-500/30 text-slate-400 hover:text-amber-300 border border-slate-600/50 hover:border-amber-500/50 transition-all"
                                  >
                                    + {item.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 參考圖片上傳 */}
                      <div className="w-full">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-slate-300 flex items-center gap-1.5 font-medium">
                            <ImagePlus className="w-4 h-4 text-amber-400"/>
                            參考圖片
                            <span className="text-slate-500 font-normal">(選填)</span>
                          </label>
                          {referenceImagePreview && (
                            <button
                              onClick={handleRemoveReferenceImage}
                              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 className="w-3 h-3"/>
                              移除圖片
                            </button>
                          )}
                        </div>
                        {referenceImagePreview ? (
                          <div className="relative w-full rounded-xl overflow-hidden border border-amber-500/30 bg-slate-800 group shadow-lg shadow-amber-500/5">
                            <div className="aspect-[21/9] w-full overflow-hidden">
                              <img 
                                src={referenceImagePreview} 
                                alt="參考圖片" 
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"/>
                            <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-between items-end">
                              <div className="flex flex-col gap-1">
                                <span className="text-sm text-white font-medium truncate max-w-[200px]">
                                  {referenceImage?.name}
                                </span>
                                <span className="text-xs text-slate-300">
                                  {referenceImage && formatFileSize(referenceImage.size)}
                                </span>
                              </div>
                              <Badge className="bg-amber-500 text-white border-0 text-xs px-3 py-1">
                                ✓ 風格參考已設定
                              </Badge>
                            </div>
                          </div>
                        ) : (
                          <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={cn(
                              "relative w-full rounded-xl border-2 border-dashed transition-all overflow-hidden",
                              isDragging 
                                ? "border-amber-400 bg-amber-500/10 scale-[1.01]" 
                                : "border-slate-600 hover:border-amber-500/50 hover:bg-slate-800/30"
                            )}
                          >
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageSelect}
                              className="hidden"
                              id="reference-image-upload-2"
                            />
                            <label htmlFor="reference-image-upload-2" className="cursor-pointer block p-6">
                              <div className="flex flex-col items-center justify-center">
                                <div className={cn(
                                  "w-12 h-12 mb-3 rounded-full flex items-center justify-center transition-all",
                                  isDragging ? "bg-amber-500/30 scale-110" : "bg-slate-700/80"
                                )}>
                                  <Upload className={cn(
                                    "w-6 h-6 transition-all",
                                    isDragging ? "text-amber-400 animate-bounce" : "text-slate-400"
                                  )}/>
                                </div>
                                <p className="text-sm text-slate-200 font-medium mb-1">
                                  {isDragging ? "放開以上傳圖片" : "拖放或點擊上傳參考圖片"}
                                </p>
                                <p className="text-xs text-slate-500">
                                  AI 將分析圖片的風格、色調與構圖
                                </p>
                              </div>
                            </label>
                          </div>
                        )}
                      </div>

                      {/* 品質選擇與重新生成按鈕 */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-slate-400 mb-1.5 block">品質</label>
                          <Select value={imageQuality} onValueChange={setImageQuality} disabled={imageLoading}>
                            <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-600">
                              {IMAGE_QUALITY_OPTIONS.map(opt => (
                                <SelectItem 
                                  key={opt.value} 
                                  value={opt.value}
                                  className="text-white hover:bg-slate-700 focus:bg-slate-700"
                                >
                                  {opt.label} ({opt.cost}點)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end">
                          <Button 
                            className="w-full h-9 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white disabled:opacity-50"
                            onClick={() => handleGenerateImage()}
                            disabled={imageLoading}
                          >
                            {imageLoading ? (
                              <><Loader2 className="w-4 h-4 mr-2 animate-spin"/>生成中...</>
                            ) : (
                              <><RefreshCw className="w-4 h-4 mr-2"/>重新生成</>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 文章內容 - 預覽/原始碼切換 */}
                <div className="border-t border-slate-700">
                  {/* 工具列 */}
                  <div className="flex items-center justify-between px-4 py-2 bg-slate-800/50 border-b border-slate-700">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setViewMode("preview")}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                          viewMode === "preview"
                            ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                            : "text-slate-400 hover:text-white hover:bg-slate-700"
                        )}
                      >
                        <Eye className="w-4 h-4" />
                        預覽
                      </button>
                      <button
                        onClick={() => {
                          setViewMode("source");
                          if (!editContent && currentPost) {
                            setEditContent(currentPost.content);
                          }
                        }}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                          viewMode === "source"
                            ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30"
                            : "text-slate-400 hover:text-white hover:bg-slate-700"
                        )}
                      >
                        <Code className="w-4 h-4" />
                        原始碼
                      </button>
                    </div>
                    
                    {viewMode === "source" && (
                      <div className="flex items-center gap-2">
                        {hasUnsavedChanges && (
                          <Badge className="bg-amber-500/20 text-amber-400 border-0 text-xs">
                            未保存變更
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditContent(formatHtml(editContent))}
                          className="h-7 px-2 text-slate-400 hover:text-white"
                          title="格式化 HTML"
                        >
                          <Wand2 className="w-3.5 h-3.5 mr-1" />
                          格式化
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCancelEdit}
                          className="h-7 px-2 text-slate-400 hover:text-white"
                          disabled={!hasUnsavedChanges}
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" />
                          取消
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveContent}
                          disabled={!hasUnsavedChanges}
                          className="h-7 bg-green-600 hover:bg-green-700 text-white"
                        >
                          <Save className="w-3.5 h-3.5 mr-1" />
                          保存
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* 內容區域 */}
                  {viewMode === "preview" ? (
                    <div className="p-4 sm:p-6 md:p-10 lg:p-12 bg-gradient-to-b from-slate-900 to-slate-950">
                      {/* 專業文章預覽容器 - 模擬真實部落格排版 */}
                      <div className="max-w-3xl mx-auto w-full">
                        <article 
                          className="blog-article-preview break-words"
                          dangerouslySetInnerHTML={{ __html: currentPost.content }} 
                        />
                        
                        {/* SEO 預覽提示 */}
                        <div className="mt-10 pt-6 border-t border-slate-700/50">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded-full border border-green-500/20">
                              ✓ SEO 優化
                            </span>
                            <span>標題層級正確 • 段落結構清晰 • 適合搜尋引擎索引</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4">
                      <div className="relative">
                        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                          <span className="text-xs text-slate-500 bg-slate-800/80 px-2 py-1 rounded">
                            HTML
                          </span>
                        </div>
                        <textarea
                          value={editContent}
                          onChange={(e) => handleContentChange(e.target.value)}
                          className={cn(
                            "w-full min-h-[500px] p-4 rounded-lg font-mono text-sm leading-relaxed",
                            "bg-slate-950 border border-slate-700 text-slate-300",
                            "focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50",
                            "placeholder:text-slate-600 resize-y"
                          )}
                          placeholder="在此編輯 HTML 原始碼..."
                          spellCheck={false}
                        />
                      </div>
                      
                      {/* HTML 編輯提示 */}
                      <div className="mt-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                        <p className="text-xs text-slate-400 flex items-start gap-2">
                          <span className="text-amber-400 mt-0.5">💡</span>
                          <span>
                            <strong className="text-slate-300">編輯提示：</strong>
                            您可以直接修改 HTML 標籤來調整文章格式。常用標籤：
                            <code className="mx-1 px-1.5 py-0.5 bg-slate-700 rounded text-amber-400">&lt;h2&gt;</code>標題、
                            <code className="mx-1 px-1.5 py-0.5 bg-slate-700 rounded text-amber-400">&lt;p&gt;</code>段落、
                            <code className="mx-1 px-1.5 py-0.5 bg-slate-700 rounded text-amber-400">&lt;strong&gt;</code>粗體、
                            <code className="mx-1 px-1.5 py-0.5 bg-slate-700 rounded text-amber-400">&lt;ul&gt;&lt;li&gt;</code>列表
                          </span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
                <div className="relative">
                  <div className="absolute inset-0 bg-slate-500/10 rounded-full blur-2xl"></div>
                  <Wand2 className="w-16 h-16 opacity-20 relative z-10"/>
                </div>
                <p className="mt-4 text-center">輸入主題開始生成<br/>或從右側選擇歷史文章</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* --- 右側：歷史紀錄 Sidebar --- */}
      <Card className="hidden lg:flex flex-col max-h-[calc(100vh-8rem)] sticky top-4 overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 border-slate-700/50 shadow-xl">
        {/* 標題區域 - 漸層背景 */}
        <CardHeader className="py-4 px-4 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/80 to-slate-900/80 backdrop-blur shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20">
                <History className="w-4 h-4 text-violet-400"/>
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-white">
                  歷史紀錄
                </CardTitle>
                {history.length > 0 && (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isSelectionMode && selectedIds.size > 0 
                      ? `已選取 ${selectedIds.size} / ${history.length} 篇` 
                      : `共 ${history.length} 篇文章`}
                  </p>
                )}
              </div>
            </div>
            {history.length > 0 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSelectionMode}
                  className={cn(
                    "h-8 w-8 p-0 rounded-lg transition-all",
                    isSelectionMode 
                      ? "text-violet-400 bg-violet-500/20 hover:bg-violet-500/30 ring-1 ring-violet-500/30" 
                      : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                  )}
                  title={isSelectionMode ? "取消選擇" : "批量選擇"}
                >
                  <CheckSquare className="w-4 h-4" />
                </Button>
                {!isSelectionMode && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearHistory}
                    className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                    title="清除所有紀錄"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
          {/* 批量操作工具列 - 動畫滑入 */}
          {isSelectionMode && history.length > 0 && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/50 animate-in slide-in-from-top-2 duration-200">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSelectAll}
                className="h-8 px-3 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg"
              >
                <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
                {selectedIds.size === history.length ? "取消全選" : "全選"}
              </Button>
              <Button
                size="sm"
                onClick={handleBatchDelete}
                disabled={selectedIds.size === 0 || isBatchDeleting}
                className={cn(
                  "h-8 px-3 text-xs font-medium rounded-lg transition-all",
                  selectedIds.size > 0
                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                    : "bg-slate-700/50 text-slate-500"
                )}
              >
                {isBatchDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                )}
                刪除 {selectedIds.size > 0 && `(${selectedIds.size})`}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full max-h-[calc(100vh-16rem)]">
            <div className="p-3 space-y-2">
              {history.map((post, index) => (
                <div 
                  key={post.id}
                  onClick={() => isSelectionMode ? toggleSelectPost(post.id, { stopPropagation: () => {} } as React.MouseEvent) : setCurrentPost(post)}
                  style={{ animationDelay: `${index * 30}ms` }}
                  className={cn(
                    "group relative rounded-xl cursor-pointer transition-all duration-200 animate-in fade-in-0 slide-in-from-right-2",
                    "border overflow-hidden",
                    isSelectionMode && selectedIds.has(post.id)
                      ? "bg-violet-500/10 border-violet-500/50 ring-2 ring-violet-500/20 shadow-lg shadow-violet-500/5"
                      : currentPost?.id === post.id && !isSelectionMode
                        ? "bg-indigo-500/10 border-indigo-500/50 ring-2 ring-indigo-500/20 shadow-lg shadow-indigo-500/5" 
                        : "bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600/50 hover:shadow-md"
                  )}
                >
                  <div className="flex gap-3 p-3">
                    {/* 選擇模式下的 Checkbox */}
                    {isSelectionMode && (
                      <div 
                        onClick={(e) => toggleSelectPost(post.id, e)}
                        className={cn(
                          "mt-1 w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all cursor-pointer",
                          selectedIds.has(post.id) 
                            ? "bg-gradient-to-br from-violet-500 to-indigo-500 shadow-lg shadow-violet-500/30" 
                            : "border-2 border-slate-500/50 hover:border-violet-400/50 hover:bg-violet-500/10"
                        )}
                      >
                        {selectedIds.has(post.id) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                    )}
                    
                    {/* 封面縮圖 */}
                    {!isSelectionMode && (
                      <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600/30">
                        {post.cover_image ? (
                          <img 
                            src={post.cover_image} 
                            alt="" 
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileText className="w-6 h-6 text-slate-500" />
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium text-sm text-white leading-tight line-clamp-2 group-hover:text-indigo-200 transition-colors">
                            {post.title}
                          </h4>
                          {!isSelectionMode && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => handleDeletePost(post.id, e)}
                              disabled={deletingId === post.id}
                              className="h-6 w-6 p-0 -mt-0.5 -mr-1 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all shrink-0"
                            >
                              {deletingId === post.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <X className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1.5">
                          {post.cover_image ? (
                            <span className="inline-flex items-center text-[10px] text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
                              <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                              完整
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded-md border border-amber-500/20">
                              <AlertTriangle className="w-2.5 h-2.5 mr-1" />
                              無圖
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(post.created_at).toLocaleDateString("zh-TW", {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* 選中狀態的發光效果 */}
                  {(isSelectionMode && selectedIds.has(post.id)) || (currentPost?.id === post.id && !isSelectionMode) ? (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute -inset-px bg-gradient-to-r from-violet-500/10 via-transparent to-indigo-500/10 rounded-xl" />
                    </div>
                  ) : null}
                </div>
              ))}
              
              {/* 空狀態 - 更精緻的設計 */}
              {history.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <div className="relative mb-4">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-indigo-500/20 rounded-full blur-2xl scale-150" />
                    <div className="relative p-4 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50">
                      <History className="w-10 h-10 text-slate-500"/>
                    </div>
                  </div>
                  <h4 className="text-sm font-medium text-slate-300 mb-1">尚無歷史紀錄</h4>
                  <p className="text-xs text-slate-500 text-center">
                    輸入主題開始生成您的第一篇文章
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 排程上架彈窗 */}
      <ScheduleDialog
        open={showScheduleDialog}
        onClose={() => {
          setShowScheduleDialog(false);
          setScheduleContent(null);
        }}
        content={scheduleContent}
        onSuccess={() => {
          toast.success("文章已加入排程！");
        }}
      />

      {/* WordPress 發布彈窗 */}
      {isMounted && showWordPressDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="w-full max-w-xl bg-slate-900 border-slate-700 my-8 animate-in zoom-in-95 duration-300">
            <CardHeader className="border-b border-slate-700">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500">
                    <Globe className="w-5 h-5 text-white" />
                  </div>
                  發布到 WordPress
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowWordPressDialog(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <CardDescription className="text-slate-400">
                選擇 WordPress 站點並設定發布選項
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-5">
              {/* 文章預覽 */}
              {currentPost && (
                <div className="flex gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                  {currentPost.cover_image && (
                    <img
                      src={currentPost.cover_image}
                      alt="封面"
                      className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <h4 className="text-white font-medium text-sm mb-1 line-clamp-2">{currentPost.title}</h4>
                    <p className="text-slate-400 text-xs line-clamp-2">
                      {currentPost.content.replace(/<[^>]*>/g, "").substring(0, 100)}...
                    </p>
                  </div>
                </div>
              )}

              {/* WordPress 站點選擇 */}
              <div>
                <label className="text-sm text-slate-300 mb-2 block flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  選擇 WordPress 站點
                </label>
                {loadingWpSites ? (
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    載入站點中...
                  </div>
                ) : wordPressSites.length === 0 ? (
                  <div className="p-4 bg-amber-900/20 rounded-xl border border-amber-500/30 text-center">
                    <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                    <p className="text-amber-400 text-sm font-medium mb-1">尚未連接 WordPress 站點</p>
                    <p className="text-slate-400 text-xs mb-3">請先在社群帳號管理中連接您的 WordPress</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                      onClick={() => window.location.href = "/dashboard/accounts"}
                    >
                      <Settings2 className="w-4 h-4 mr-1.5" />
                      前往設定
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {wordPressSites.map((site) => (
                      <button
                        key={site.id}
                        type="button"
                        onClick={() => handleWpSiteChange(site.id)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg border transition-all",
                          selectedWpSite === site.id
                            ? "bg-blue-500/20 border-blue-500/50"
                            : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                        )}
                      >
                        {site.avatar_url ? (
                          <img src={site.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                            <Globe className="w-5 h-5 text-white" />
                          </div>
                        )}
                        <div className="flex-1 text-left">
                          <div className="text-white text-sm font-medium">{site.site_name || site.site_url}</div>
                          <div className="text-slate-400 text-xs">{site.site_url}</div>
                        </div>
                        {selectedWpSite === site.id && (
                          <CheckCircle2 className="w-5 h-5 text-blue-400" />
                        )}
                        {!site.is_active && (
                          <Badge className="bg-red-500/20 text-red-400 text-[10px]">連線失效</Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 分類選擇 */}
              {selectedWpSite && (
                <div>
                  <label className="text-sm text-slate-300 mb-2 block">
                    文章分類
                  </label>
                  {loadingWpCategories ? (
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      載入分類中...
                    </div>
                  ) : wpCategories.length === 0 ? (
                    <p className="text-slate-500 text-sm">此站點無分類</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {wpCategories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setSelectedWpCategories((prev) =>
                              prev.includes(cat.name)
                                ? prev.filter((c) => c !== cat.name)
                                : [...prev, cat.name]
                            );
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs transition-all border",
                            selectedWpCategories.includes(cat.name)
                              ? "bg-blue-500/30 border-blue-500/50 text-blue-300"
                              : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                          )}
                        >
                          {cat.name}
                          {cat.count > 0 && (
                            <span className="ml-1 text-slate-500">({cat.count})</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 發布狀態選擇 */}
              {selectedWpSite && (
                <div>
                  <label className="text-sm text-slate-300 mb-2 block">
                    發布方式
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setWpPublishStatus("draft")}
                      className={cn(
                        "p-3 rounded-lg border text-center transition-all",
                        wpPublishStatus === "draft"
                          ? "bg-slate-700/50 border-slate-500"
                          : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                      )}
                    >
                      <Edit3 className="w-5 h-5 mx-auto mb-1 text-slate-400" />
                      <span className="text-sm text-slate-300">儲存草稿</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWpPublishStatus("publish")}
                      className={cn(
                        "p-3 rounded-lg border text-center transition-all",
                        wpPublishStatus === "publish"
                          ? "bg-green-500/20 border-green-500/50"
                          : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                      )}
                    >
                      <Send className="w-5 h-5 mx-auto mb-1 text-green-400" />
                      <span className="text-sm text-slate-300">立即發布</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWpPublishStatus("future")}
                      className={cn(
                        "p-3 rounded-lg border text-center transition-all",
                        wpPublishStatus === "future"
                          ? "bg-amber-500/20 border-amber-500/50"
                          : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                      )}
                    >
                      <Clock className="w-5 h-5 mx-auto mb-1 text-amber-400" />
                      <span className="text-sm text-slate-300">排程發布</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 排程時間 */}
              {wpPublishStatus === "future" && selectedWpSite && (
                <div>
                  <label className="text-sm text-slate-300 mb-2 block flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    排程發布時間
                  </label>
                  <Input
                    type="datetime-local"
                    value={wpScheduledAt}
                    onChange={(e) => setWpScheduledAt(e.target.value)}
                    className="bg-slate-800 border-slate-600 text-white"
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>
              )}

              {/* 按鈕 */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowWordPressDialog(false)}
                  className="text-slate-400"
                >
                  取消
                </Button>
                <Button
                  onClick={handleWordPressPublish}
                  disabled={wpPublishing || !selectedWpSite || (wpPublishStatus === "future" && !wpScheduledAt)}
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white"
                >
                  {wpPublishing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      發布中...
                    </>
                  ) : (
                    <>
                      {wpPublishStatus === "draft" && <Edit3 className="w-4 h-4 mr-2" />}
                      {wpPublishStatus === "publish" && <Send className="w-4 h-4 mr-2" />}
                      {wpPublishStatus === "future" && <Clock className="w-4 h-4 mr-2" />}
                      {wpPublishStatus === "draft" && "儲存草稿"}
                      {wpPublishStatus === "publish" && "立即發布"}
                      {wpPublishStatus === "future" && "確認排程"}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 圖片標題編輯器彈窗 */}
      <Dialog open={showImageEditor} onOpenChange={setShowImageEditor}>
        <DialogContent className="max-w-[95vw] w-[1400px] max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Type className="h-5 w-5 text-purple-400" />
              封面圖片標題編輯器
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <ImageTextEditor 
              imageUrl={currentPost?.cover_image} 
              onExport={(dataUrl) => {
                // 更新封面圖片為編輯後的版本
                if (currentPost) {
                  setCurrentPost({ ...currentPost, cover_image: dataUrl });
                }
                setShowImageEditor(false);
                toast.success("封面圖片已更新！");
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
