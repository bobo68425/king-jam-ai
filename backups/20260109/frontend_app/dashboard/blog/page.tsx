"use client";

import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, Wand2, History, FileText, Trash2, Copy, Check, X, 
  Image as ImageIcon, Sparkles, Download, ChevronDown, ChevronUp,
  RefreshCw, Zap, CheckCircle2, Circle, ArrowRight, Upload, ImagePlus,
  Code, Clock, Eye
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// 定義 Post 介面
interface Post {
  id: number;
  title: string;
  content: string;
  created_at: string;
  cover_image?: string;
}

// 語氣選項
const TONE_OPTIONS = [
  { value: "professional", label: "專業正式" },
  { value: "casual", label: "輕鬆隨性" },
  { value: "friendly", label: "親切友善" },
  { value: "humorous", label: "幽默風趣" },
  { value: "educational", label: "教育科普" },
];

// 圖片品質選項
const IMAGE_QUALITY_OPTIONS = [
  { value: "draft", label: "⚡ 快速", cost: 5 },
  { value: "standard", label: "✨ 標準", cost: 10 },
  { value: "premium", label: "💎 高級", cost: 20 },
];

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
  // 文章生成狀態
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("professional");
  const [loading, setLoading] = useState(false);
  const [currentPost, setCurrentPost] = useState<Post | null>(null);
  const [history, setHistory] = useState<Post[]>([]);
  const [copied, setCopied] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // 圖片生成狀態
  const [imageLoading, setImageLoading] = useState(false);
  const [imageQuality, setImageQuality] = useState("standard");
  const [customPrompt, setCustomPrompt] = useState("");
  const [showImageOptions, setShowImageOptions] = useState(false);

  // 參考圖片狀態
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // 一鍵生成狀態
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [autoStep, setAutoStep] = useState<"article" | "image" | null>(null);

  // localStorage keys for persisting state
  const STORAGE_KEY = "blog_current_post";
  const STORAGE_SETTINGS_KEY = "blog_settings";

  // 從 localStorage 恢復工作狀態
  useEffect(() => {
    try {
      // 恢復當前文章
      const savedPost = localStorage.getItem(STORAGE_KEY);
      if (savedPost) {
        setCurrentPost(JSON.parse(savedPost));
      }
      
      // 恢復設定
      const savedSettings = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        if (settings.topic) setTopic(settings.topic);
        if (settings.tone) setTone(settings.tone);
        if (settings.imageQuality) setImageQuality(settings.imageQuality);
        if (settings.customPrompt) setCustomPrompt(settings.customPrompt);
      }
    } catch (e) {
      console.error("Failed to restore blog state", e);
    }
  }, []);

  // 儲存當前文章到 localStorage
  useEffect(() => {
    if (currentPost) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentPost));
      } catch (e) {
        console.error("Failed to save blog state", e);
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [currentPost]);

  // 儲存設定到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify({
        topic,
        tone,
        imageQuality,
        customPrompt
      }));
    } catch (e) {
      console.error("Failed to save blog settings", e);
    }
  }, [topic, tone, imageQuality, customPrompt]);

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
    fetchHistory();
  }, [fetchHistory]);

  // 參考圖片處理
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('請選擇圖片檔案');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('圖片大小不能超過 10MB');
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
        alert('請選擇圖片檔案');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('圖片大小不能超過 10MB');
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

  // 生成文章
  const handleGenerate = async (topicOverride?: string) => {
    const targetTopic = topicOverride || topic;
    if (!targetTopic.trim()) return;
    setLoading(true);
    
    try {
      const res = await api.post("/blog/generate", {
        topic: targetTopic.trim(),
        tone: tone
      });
      setCurrentPost({ ...res.data, cover_image: undefined });
      fetchHistory();
      if (!topicOverride) setTopic("");
      return res.data;
    } catch (error: any) {
      alert(error.response?.data?.detail || "生成失敗");
      return null;
    } finally {
      setLoading(false);
    }
  };

  // 生成封面圖片
  const handleGenerateImage = async (postTitle?: string) => {
    const targetTitle = postTitle || currentPost?.title;
    if (!targetTitle) {
      alert("請先生成或選擇一篇文章");
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
      
      const res = await api.post("/blog/generate-image", formData);
      
      setCurrentPost(prev => prev ? { ...prev, cover_image: res.data.image_url } : null);
      return res.data;
    } catch (error: any) {
      alert(error.response?.data?.detail || "圖片生成失敗");
      return null;
    } finally {
      setImageLoading(false);
    }
  };

  // 一鍵生成（文章 + 圖片）
  const handleAutoGenerate = async () => {
    if (!topic.trim()) return;
    
    setAutoGenerating(true);
    setAutoStep("article");
    
    try {
      // Step 1: 生成文章
      const article = await handleGenerate(topic);
      if (!article) {
        setAutoGenerating(false);
        setAutoStep(null);
        return;
      }
      
      // Step 2: 生成圖片
      setAutoStep("image");
      await handleGenerateImage(article.title);
      
      setTopic("");
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
      alert("複製失敗");
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
      alert("下載失敗");
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
      alert(error.response?.data?.detail || "刪除失敗");
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
    } catch (error: any) {
      alert(error.response?.data?.detail || "清除失敗");
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
      alert("複製失敗");
    }
  };

  const isAnyLoading = loading || imageLoading || autoGenerating;

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      
      {/* --- 左側：主要工作區 --- */}
      <div className="flex flex-col gap-4">
        
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
            <div className="flex gap-3">
              <Input 
                placeholder="輸入文章主題..." 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isAnyLoading}
                className="flex-1 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:border-indigo-500"
              />
              <Select value={tone} onValueChange={setTone} disabled={isAnyLoading}>
                <SelectTrigger className="w-[130px] bg-slate-800 border-slate-600 text-white">
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
            <div className="flex gap-3">
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
        <Card className="overflow-hidden flex flex-col bg-slate-900 border-slate-700">
          <CardHeader className="border-b border-slate-700 py-3 bg-slate-800 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center text-white">
                <FileText className="w-4 h-4 mr-2 text-indigo-400"/>
                {currentPost ? currentPost.title : "文章預覽"}
                {currentPost?.cover_image && (
                  <Badge className="ml-2 text-xs bg-green-500/20 text-green-400 border-0">
                    <CheckCircle2 className="w-3 h-3 mr-1"/>
                    已完成
                  </Badge>
                )}
              </CardTitle>
              {currentPost && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-8 px-3 text-slate-400 hover:text-white hover:bg-slate-700"
                    title="複製純文字"
                  >
                    {copied ? (
                      <><Check className="w-4 h-4 mr-1.5 text-green-400"/>已複製</>
                    ) : (
                      <><Copy className="w-4 h-4 mr-1.5"/>複製</>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyHtml}
                    className="h-8 px-3 text-slate-400 hover:text-white hover:bg-slate-700"
                    title="複製 HTML 原始碼"
                  >
                    <Code className="w-4 h-4 mr-1.5"/>原始碼
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
                              未生成
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

                        {showImageOptions && (
                          <div className="space-y-4 mb-4">
                            {/* 參考圖片上傳 - 滿版置頂 */}
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
                                  <label htmlFor="reference-image-upload" className="cursor-pointer block p-8">
                                    <div className="flex flex-col items-center justify-center">
                                      <div className={cn(
                                        "w-16 h-16 mb-4 rounded-full flex items-center justify-center transition-all",
                                        isDragging ? "bg-amber-500/30 scale-110" : "bg-slate-700/80"
                                      )}>
                                        <Upload className={cn(
                                          "w-8 h-8 transition-all",
                                          isDragging ? "text-amber-400 animate-bounce" : "text-slate-400"
                                        )}/>
                                      </div>
                                      <p className="text-base text-slate-200 font-medium mb-1">
                                        {isDragging ? "放開以上傳圖片" : "拖放圖片到此處"}
                                      </p>
                                      <p className="text-sm text-slate-400 mb-3">
                                        或 <span className="text-amber-400 hover:underline">點擊選擇檔案</span>
                                      </p>
                                      <div className="flex items-center gap-4 text-xs text-slate-500">
                                        <span>JPG、PNG、WebP</span>
                                        <span>•</span>
                                        <span>最大 10MB</span>
                                      </div>
                                      <p className="text-xs text-slate-500 mt-3 bg-slate-800/50 px-3 py-1.5 rounded-full">
                                        💡 AI 將分析此圖片的風格、色調與構圖
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

                            {/* 自訂視覺描述 */}
                            <div>
                              <label className="text-xs text-slate-400 mb-1.5 block">自訂視覺描述 (選填)</label>
                              <Textarea
                                placeholder="描述想要的畫面風格、構圖、色調..."
                                value={customPrompt}
                                onChange={(e) => setCustomPrompt(e.target.value)}
                                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 min-h-[60px] text-sm"
                              />
                            </div>
                          </div>
                        )}

                        {!showImageOptions && (
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
                      {/* 參考圖片上傳 - 滿版置頂 */}
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
                                  "w-14 h-14 mb-3 rounded-full flex items-center justify-center transition-all",
                                  isDragging ? "bg-amber-500/30 scale-110" : "bg-slate-700/80"
                                )}>
                                  <Upload className={cn(
                                    "w-7 h-7 transition-all",
                                    isDragging ? "text-amber-400 animate-bounce" : "text-slate-400"
                                  )}/>
                                </div>
                                <p className="text-sm text-slate-200 font-medium mb-1">
                                  {isDragging ? "放開以上傳圖片" : "拖放圖片到此處"}
                                </p>
                                <p className="text-xs text-slate-400 mb-2">
                                  或 <span className="text-amber-400">點擊選擇檔案</span>
                                </p>
                                <p className="text-xs text-slate-500 bg-slate-800/50 px-3 py-1 rounded-full">
                                  💡 AI 將分析此圖片的風格、色調與構圖
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

                      {/* 自訂視覺描述 */}
                      <div>
                        <label className="text-xs text-slate-400 mb-1.5 block">自訂視覺描述 (選填)</label>
                        <Textarea
                          placeholder="描述想要的畫面風格、構圖、色調..."
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 min-h-[60px] text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 文章內容 */}
                <div className="p-6 md:p-8">
                  <article 
                    className="prose prose-slate max-w-none dark:prose-invert
                      prose-headings:font-bold prose-headings:text-white prose-headings:border-b prose-headings:border-slate-700 prose-headings:pb-2 prose-headings:mb-4
                      prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
                      prose-p:text-slate-300 prose-p:leading-relaxed
                      prose-strong:text-white prose-strong:font-semibold
                      prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline
                      prose-ul:text-slate-300 prose-ol:text-slate-300
                      prose-li:marker:text-indigo-400
                      prose-blockquote:border-indigo-500 prose-blockquote:bg-slate-800/50 prose-blockquote:py-1 prose-blockquote:not-italic
                      prose-code:text-amber-400 prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
                      prose-pre:bg-slate-800 prose-pre:border prose-pre:border-slate-700"
                    dangerouslySetInnerHTML={{ __html: currentPost.content }} 
                  />
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
      <Card className="flex flex-col h-fit max-h-[calc(100vh-8rem)] sticky top-4 overflow-hidden bg-slate-900 border-slate-700">
        <CardHeader className="py-3 border-b border-slate-700 bg-slate-800 shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center text-white">
              <History className="w-4 h-4 mr-2 text-slate-400"/>
              歷史紀錄
              {history.length > 0 && (
                <span className="ml-2 text-xs bg-slate-600 text-slate-300 px-2 py-0.5 rounded-full">
                  {history.length}
                </span>
              )}
            </CardTitle>
            {history.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearHistory}
                className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                title="清除所有紀錄"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-2">
              {history.map((post) => (
                <div 
                  key={post.id}
                  onClick={() => setCurrentPost({ ...post, cover_image: undefined })}
                  className={cn(
                    "group p-3 rounded-lg cursor-pointer text-sm border transition-all",
                    currentPost?.id === post.id 
                      ? "bg-indigo-900/40 border-indigo-500 ring-1 ring-indigo-500/50" 
                      : "bg-slate-800 border-slate-700 hover:border-slate-600"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium truncate text-white flex-1">
                      {post.title}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDeletePost(post.id, e)}
                      disabled={deletingId === post.id}
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 hover:bg-transparent transition-opacity"
                    >
                      {deletingId === post.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <X className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-indigo-300 bg-indigo-900/50 px-1.5 py-0.5 rounded">
                        文章
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(post.created_at).toLocaleDateString("zh-TW")}
                    </span>
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-slate-500">
                  <History className="w-8 h-8 mb-2 opacity-20"/>
                  <p className="text-xs">尚無歷史紀錄</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
