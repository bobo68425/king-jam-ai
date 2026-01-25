"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, Sparkles, Play, Clock, Film, Palette, 
  User, MessageSquare, Volume2, ChevronDown, ChevronUp,
  Check, Copy, Download, Wand2, Clapperboard, Music,
  Eye, Settings2, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ============================================================
// 類型定義
// ============================================================

interface Scene {
  scene_number: number;
  scene_type: string;
  duration_seconds: number;
  visual_prompt: string;
  visual_style: string;
  camera_movement: string;
  narration_text: string;
  voice_emotion: string;
  text_overlay: string | null;
  text_position: string;
  text_animation: string;
  background_music_mood: string;
  sound_effects: string[];
}

interface VideoScript {
  project_id: string;
  title: string;
  description: string;
  format: string;
  total_duration: number;
  overall_style: string;
  color_palette: string[];
  music_genre: string;
  target_platform: string;
  scenes: Scene[];
  credits_used: number;
}

interface Platform {
  id: string;
  name: string;
  icon: string;
  format: string;
  max_duration: number;
}

interface BrandTemplate {
  id: string;
  name: string;
  industry: string;
  personality: string;
  visual_style: string;
  primary_color: string;
  secondary_color: string;
}

// ============================================================
// 常量配置
// ============================================================

const SCENE_TYPE_CONFIG: Record<string, { name: string; icon: string; color: string }> = {
  hook: { name: "開場吸引", icon: "🎯", color: "bg-red-500" },
  problem: { name: "問題描述", icon: "❓", color: "bg-orange-500" },
  solution: { name: "解決方案", icon: "💡", color: "bg-green-500" },
  demonstration: { name: "產品展示", icon: "🎬", color: "bg-blue-500" },
  testimonial: { name: "見證分享", icon: "⭐", color: "bg-yellow-500" },
  cta: { name: "行動呼籲", icon: "🚀", color: "bg-purple-500" },
  transition: { name: "過場", icon: "➡️", color: "bg-slate-500" },
};

const DURATION_OPTIONS = [
  { value: "15", label: "15 秒", credits: 20, desc: "快速短片" },
  { value: "30", label: "30 秒", credits: 30, desc: "標準短片" },
  { value: "60", label: "60 秒", credits: 50, desc: "完整短片" },
];

// 渲染品質選項
// 注意：Veo 只支持 8 秒影片，標準模式支持任意長度
const QUALITY_OPTIONS = [
  { 
    value: "standard", 
    label: "標準", 
    desc: "Imagen + FFmpeg",
    features: ["AI 生成圖片", "背景音樂", "場景轉場", "自訂長度"],
    costs: { "15": 50, "30": 80, "60": 120 },
    icon: "📹",
    duration: "自訂",
  },
  { 
    value: "premium", 
    label: "高級", 
    desc: "Veo 3 Fast",
    features: ["AI 影片生成", "流暢動態", "原生音頻"],
    costs: { "8": 200 },  // Veo 固定 8 秒
    icon: "🎬",
    badge: "推薦",
    duration: "8秒",
    veo: true,
  },
  { 
    value: "ultra", 
    label: "頂級", 
    desc: "Veo 3 最高品質",
    features: ["頂級畫質", "原生音頻", "1080p", "電影級"],
    costs: { "8": 350 },  // Veo 固定 8 秒
    icon: "🎥",
    badge: "最佳",
    duration: "8秒",
    veo: true,
  },
];

const GOAL_OPTIONS = [
  { value: "awareness", label: "品牌曝光", icon: "👁️" },
  { value: "engagement", label: "互動參與", icon: "💬" },
  { value: "conversion", label: "轉換購買", icon: "💰" },
];

const PERSONALITY_OPTIONS = [
  { value: "professional", label: "專業權威", icon: "👔" },
  { value: "friendly", label: "親切友善", icon: "😊" },
  { value: "luxurious", label: "奢華高端", icon: "✨" },
  { value: "playful", label: "活潑有趣", icon: "🎉" },
  { value: "minimalist", label: "極簡現代", icon: "◻️" },
  { value: "innovative", label: "創新前衛", icon: "🚀" },
  { value: "trustworthy", label: "可信賴", icon: "🤝" },
  { value: "energetic", label: "活力充沛", icon: "⚡" },
];

// ============================================================
// 主組件
// ============================================================

export default function VideoPage() {
  // 狀態管理
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [result, setResult] = useState<VideoScript | null>(null);
  
  // 影片生成狀態
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStep, setRenderStep] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [renderQuality, setRenderQuality] = useState("standard");  // 渲染品質
  
  // 平台和模板數據
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [brandTemplates, setBrandTemplates] = useState<BrandTemplate[]>([]);
  
  // 表單狀態 - 基本設定
  const [topic, setTopic] = useState("");
  const [goal, setGoal] = useState("awareness");
  const [platform, setPlatform] = useState("tiktok");
  const [duration, setDuration] = useState("30");
  
  // 表單狀態 - 產品資訊
  const [productName, setProductName] = useState("");
  const [productFeatures, setProductFeatures] = useState("");
  const [keyMessage, setKeyMessage] = useState("");
  
  // 表單狀態 - 品牌設定
  const [showBrandSettings, setShowBrandSettings] = useState(false);
  const [brandTemplate, setBrandTemplate] = useState("");
  const [brandName, setBrandName] = useState("");
  const [brandIndustry, setBrandIndustry] = useState("");
  const [brandPersonality, setBrandPersonality] = useState("friendly");
  const [brandTone, setBrandTone] = useState("親切、專業、有溫度");
  const [primaryColor, setPrimaryColor] = useState("#6366F1");
  const [secondaryColor, setSecondaryColor] = useState("#8B5CF6");
  const [targetAudience, setTargetAudience] = useState("25-45歲都市專業人士");
  
  // 場景展開狀態
  const [expandedScene, setExpandedScene] = useState<number | null>(null);
  
  // 載入平台和模板數據
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [platformsRes, templatesRes] = await Promise.all([
          api.get("/video/platforms"),
          api.get("/video/templates"),
        ]);
        setPlatforms(platformsRes.data.platforms);
        setBrandTemplates(templatesRes.data.templates);
      } catch (error) {
        console.error("載入配置失敗", error);
      }
    };
    fetchData();
  }, []);

  // 套用品牌模板
  const applyBrandTemplate = (templateId: string) => {
    const template = brandTemplates.find(t => t.id === templateId);
    if (template) {
      setBrandTemplate(templateId);
      setBrandIndustry(template.industry);
      setBrandPersonality(template.personality);
      setPrimaryColor(template.primary_color);
      setSecondaryColor(template.secondary_color);
      toast.success(`已套用「${template.industry}」模板`);
    }
  };

  // 生成腳本
  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error("請輸入影片主題");
      return;
    }

    console.log("[VideoPage] 開始生成腳本");
    
    setLoading(true);
    setResult(null);
    setVideoUrl(null);
    setPreviewImage(null);
    setLoadingStep("🎬 AI 導演正在構思腳本...");

    try {
      const requestData: any = {
        topic,
        goal,
        platform,
        duration,
        format: "9:16",
      };

      // 產品資訊
      if (productName) requestData.product_name = productName;
      if (productFeatures) {
        requestData.product_features = productFeatures.split(",").map(f => f.trim());
      }
      if (keyMessage) requestData.key_message = keyMessage;

      // 品牌設定
      if (brandName || brandIndustry) {
        requestData.brand = {
          brand_name: brandName || "我的品牌",
          industry: brandIndustry || "綜合",
          personality: brandPersonality,
          tone_of_voice: brandTone,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          target_audience: targetAudience,
          key_messages: keyMessage ? [keyMessage] : [],
          forbidden_themes: [],
        };
      } else if (brandTemplate) {
        requestData.brand_template = brandTemplate;
      }

      console.log("[VideoPage] 發送請求:", requestData);
      setLoadingStep("✍️ 撰寫場景分鏡...");
      
      const response = await api.post("/video/generate", requestData);
      
      console.log("[VideoPage] 腳本生成回應:", response.data);
      setLoadingStep("🎨 完成視覺設計...");
      
      setResult(response.data);
      toast.success("🎬 腳本生成完成！請點擊「生成完整影片」來生成影片");
    } catch (error: any) {
      console.error("[VideoPage] 腳本生成錯誤:", error);
      const message = error.response?.data?.detail || error.message || "生成失敗";
      if (error.response?.status === 402) {
        toast.error("點數不足！請充值後再試");
      } else {
        toast.error(`生成失敗: ${message}`);
      }
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  // 複製場景 Prompt
  const copyVisualPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("視覺 Prompt 已複製！");
    } catch {
      toast.error("複製失敗");
    }
  };

  // 計算當前選擇的點數消耗
  const getCurrentCost = () => {
    return DURATION_OPTIONS.find(d => d.value === duration)?.credits || 50;
  };

  // 渲染影片點數（根據品質）
  const getRenderCost = () => {
    const qualityOption = QUALITY_OPTIONS.find(q => q.value === renderQuality);
    if (qualityOption) {
      // Veo 模式固定 8 秒價格
      if (qualityOption.veo) {
        return qualityOption.costs["8"] || 200;
      }
      // 標準模式根據時長
      return qualityOption.costs[duration as keyof typeof qualityOption.costs] || 80;
    }
    return 80;
  };
  
  // 獲取實際影片長度（Veo 固定 8 秒）
  const getActualDuration = () => {
    const qualityOption = QUALITY_OPTIONS.find(q => q.value === renderQuality);
    return qualityOption?.veo ? "8" : duration;
  };

  // 生成預覽圖片
  const handleGeneratePreview = async () => {
    if (!result) {
      toast.error("請先生成腳本");
      return;
    }
    
    console.log("[VideoPage] 生成預覽", result.project_id);
    
    setPreviewLoading(true);
    try {
      const response = await api.post("/video/render-preview", {
        project_id: result.project_id,
        script: result
      });
      
      console.log("[VideoPage] 預覽回應:", response.data);
      
      if (response.data.preview_image) {
        setPreviewImage(response.data.preview_image);
        toast.success(`預覽圖片已生成！消耗 ${response.data.credits_used} 點`);
      } else {
        toast.warning("預覽生成完成，但沒有圖片");
      }
    } catch (error: any) {
      console.error("[VideoPage] 預覽錯誤:", error);
      const message = error.response?.data?.detail || error.message || "預覽生成失敗";
      toast.error(`預覽失敗: ${message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  // 渲染完整影片
  const handleRenderVideo = async () => {
    if (!result) {
      toast.error("請先生成腳本");
      return;
    }
    
    console.log("[VideoPage] 開始渲染影片", result);
    
    setRendering(true);
    setRenderProgress(0);
    setRenderStep("準備中...");
    setVideoUrl(null);
    
    // 模擬進度更新
    const progressInterval = setInterval(() => {
      setRenderProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 8;
      });
    }, 1500);
    
    try {
      setRenderStep("🖼️ 生成場景圖片...");
      setRenderProgress(10);
      
      console.log("[VideoPage] 發送渲染請求:", {
        project_id: result.project_id,
        scenes_count: result.scenes?.length
      });
      
      const response = await api.post("/video/render", {
        project_id: result.project_id,
        script: result,
        quality: renderQuality
      });
      
      console.log("[VideoPage] 渲染回應:", response.data);
      
      setRenderStep("🎬 影片合成完成！");
      setRenderProgress(100);
      
      // 檢查是否有圖片序列
      if (response.data.scene_images && response.data.scene_images.length > 0) {
        // 如果沒有完整影片，使用第一張圖作為預覽
        setVideoUrl(response.data.video_url || response.data.scene_images[0]);
        toast.success(`🎉 場景圖片生成完成！共 ${response.data.scene_images.length} 張`);
      } else if (response.data.video_url) {
        setVideoUrl(response.data.video_url);
        toast.success(`🎉 影片生成完成！消耗 ${response.data.credits_used} 點`);
      } else {
        toast.warning("影片生成完成，但沒有影片內容");
      }
    } catch (error: any) {
      console.error("[VideoPage] 渲染錯誤:", error);
      const message = error.response?.data?.detail || error.message || "影片生成失敗";
      if (error.response?.status === 402) {
        toast.error("點數不足！請充值後再試");
      } else {
        toast.error(`生成失敗: ${message}`);
      }
    } finally {
      clearInterval(progressInterval);
      setRendering(false);
    }
  };

  // 下載影片
  const handleDownloadVideo = () => {
    if (!videoUrl) return;
    
    const link = document.createElement("a");
    link.href = videoUrl;
    link.download = `kingjam-video-${result?.project_id || Date.now()}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("影片下載中...");
  };

  // 導出 JSON
  const handleExportJson = () => {
    if (!result) return;
    
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `script-${result.project_id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("腳本 JSON 已下載");
  };

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-5 gap-4 lg:gap-6 min-h-[calc(100vh-8rem)]">
      
      {/* ============ 左側：控制面板 ============ */}
      <div className="lg:col-span-2 space-y-4 lg:overflow-y-auto lg:pr-2">
        
        {/* 標題區 */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 shadow-lg shadow-pink-500/20">
            <Clapperboard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-pink-400 via-rose-400 to-orange-400 bg-clip-text text-transparent">
              AI 導演引擎
            </h2>
            <p className="text-sm text-muted-foreground">
              智能生成短影音腳本與分鏡
            </p>
          </div>
        </div>

        {/* 主要設定卡片 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Film className="w-4 h-4 text-pink-500" />
              影片設定
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {/* 影片主題 */}
            <div className="space-y-2">
              <Label>影片主題 *</Label>
              <Textarea
                placeholder="例如：介紹我們的新款智能手錶，強調健康監測功能..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={2}
                className="resize-none"
              />
              {/* 快速主題建議 */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "🛍️ 產品開箱", topic: "開箱分享最新購入的好物" },
                  { label: "📚 知識分享", topic: "3個你不知道的生活小技巧" },
                  { label: "🎯 品牌故事", topic: "我們為什麼創立這個品牌" },
                  { label: "⭐ 使用教學", topic: "手把手教你如何使用我們的產品" },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setTopic(item.topic)}
                    className="px-2 py-1 text-xs bg-slate-800/50 hover:bg-pink-600/30 border border-slate-700 hover:border-pink-500 rounded-full transition-all"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 目標平台 */}
            <div className="space-y-2">
              <Label>目標平台</Label>
              <div className="grid grid-cols-3 gap-2">
                {platforms.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlatform(p.id)}
                    className={cn(
                      "flex flex-col items-center p-2 rounded-lg border transition-all",
                      platform === p.id
                        ? "bg-pink-600/20 border-pink-500 text-white"
                        : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                    )}
                  >
                    <span className="text-lg">{p.icon}</span>
                    <span className="text-[10px] mt-1 truncate w-full text-center">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 渲染品質 - 移到設定區域 */}
            <div className="space-y-2">
              <Label>渲染品質</Label>
              <div className="grid grid-cols-3 gap-2">
                {QUALITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRenderQuality(option.value)}
                    className={cn(
                      "relative flex flex-col items-center p-3 rounded-lg border transition-all",
                      renderQuality === option.value
                        ? "bg-gradient-to-br from-pink-600 to-rose-600 border-pink-500 text-white"
                        : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                    )}
                  >
                    {option.badge && (
                      <Badge className="absolute -top-2 -right-2 text-[10px] bg-pink-500">
                        {option.badge}
                      </Badge>
                    )}
                    <span className="text-lg">{option.icon}</span>
                    <span className="text-sm font-semibold">{option.label}</span>
                    <span className="text-[10px] opacity-70">{option.desc}</span>
                    {option.duration && (
                      <span className="text-[10px] text-pink-300 mt-1">{option.duration}</span>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                {QUALITY_OPTIONS.find(q => q.value === renderQuality)?.features.join(" • ")}
              </p>
            </div>

            {/* 影片長度 */}
            <div className="space-y-2">
              <Label>影片長度</Label>
              
              {/* Veo 品質時顯示固定 8 秒提示 */}
              {(renderQuality === "premium" || renderQuality === "ultra") ? (
                <div className="p-4 rounded-lg border border-pink-500/50 bg-pink-600/10">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-pink-600 to-rose-600">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-white">8 秒</div>
                      <div className="text-xs text-slate-400">
                        Veo 模型固定生成 8 秒高品質影片
                      </div>
                    </div>
                    <Badge className="ml-auto bg-pink-500 text-white">
                      {renderQuality === "ultra" ? "頂級" : "高級"}
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDuration(opt.value)}
                      className={cn(
                        "relative flex flex-col items-center p-3 rounded-lg border transition-all",
                        duration === opt.value
                          ? "bg-gradient-to-br from-pink-600 to-rose-600 border-pink-500 text-white"
                          : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                      )}
                    >
                      <Clock className="w-5 h-5 mb-1" />
                      <span className="text-sm font-semibold">{opt.label}</span>
                      <span className="text-xs opacity-70">{opt.desc}</span>
                      <Badge 
                        className={cn(
                          "absolute -top-2 -right-2 text-[10px]",
                          duration === opt.value ? "bg-white text-pink-600" : "bg-slate-700"
                        )}
                      >
                        {opt.credits}點
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 影片目標 */}
            <div className="space-y-2">
              <Label>影片目標</Label>
              <div className="grid grid-cols-3 gap-2">
                {GOAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGoal(opt.value)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 p-2 rounded-lg border text-sm transition-all",
                      goal === opt.value
                        ? "bg-pink-600/20 border-pink-500 text-white"
                        : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                    )}
                  >
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 產品資訊（可選） */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-pink-500" />
              產品資訊
              <Badge variant="secondary" className="text-xs">選填</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>產品名稱</Label>
              <Input
                placeholder="例如：智能健康手錶 Pro"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>產品特色</Label>
              <Input
                placeholder="用逗號分隔，例如：24小時心率監測, 睡眠追蹤, 7天續航"
                value={productFeatures}
                onChange={(e) => setProductFeatures(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>核心訊息</Label>
              <Input
                placeholder="你最想傳達的一句話"
                value={keyMessage}
                onChange={(e) => setKeyMessage(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 品牌設定（可折疊） */}
        <Card>
          <button
            type="button"
            onClick={() => setShowBrandSettings(!showBrandSettings)}
            className="w-full"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Palette className="w-4 h-4 text-pink-500" />
                  品牌基因設定
                  <Badge variant="secondary" className="text-xs">
                    {brandName || brandTemplate ? "已設定" : "選填"}
                  </Badge>
                </CardTitle>
                {showBrandSettings ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </CardHeader>
          </button>
          
          {showBrandSettings && (
            <CardContent className="space-y-4 pt-0">
              {/* 快速模板 */}
              <div className="space-y-2">
                <Label>快速套用模板</Label>
                <div className="grid grid-cols-3 gap-2">
                  {brandTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => applyBrandTemplate(template.id)}
                      className={cn(
                        "flex flex-col items-center p-2 rounded-lg border text-xs transition-all",
                        brandTemplate === template.id
                          ? "border-pink-500 bg-pink-600/20"
                          : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                      )}
                    >
                      <div 
                        className="w-6 h-6 rounded-full mb-1"
                        style={{ background: `linear-gradient(135deg, ${template.primary_color}, ${template.secondary_color})` }}
                      />
                      <span>{template.industry}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 品牌名稱和產業 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>品牌名稱</Label>
                  <Input
                    placeholder="你的品牌名稱"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>所屬產業</Label>
                  <Input
                    placeholder="例如：科技、餐飲"
                    value={brandIndustry}
                    onChange={(e) => setBrandIndustry(e.target.value)}
                  />
                </div>
              </div>

              {/* 品牌性格 */}
              <div className="space-y-2">
                <Label>品牌性格</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {PERSONALITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setBrandPersonality(opt.value)}
                      className={cn(
                        "flex flex-col items-center p-1.5 rounded-lg border text-[10px] transition-all",
                        brandPersonality === opt.value
                          ? "border-pink-500 bg-pink-600/20 text-white"
                          : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                      )}
                    >
                      <span className="text-base">{opt.icon}</span>
                      <span className="truncate w-full text-center">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 品牌色彩 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>主色調</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer"
                    />
                    <Input
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>輔助色</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer"
                    />
                    <Input
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* 語氣和受眾 */}
              <div className="space-y-2">
                <Label>說話語氣</Label>
                <Input
                  placeholder="例如：親切、專業、有溫度"
                  value={brandTone}
                  onChange={(e) => setBrandTone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>目標受眾</Label>
                <Input
                  placeholder="例如：25-45歲都市專業人士"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                />
              </div>
            </CardContent>
          )}
        </Card>

        {/* 生成按鈕 */}
        <div className="relative group">
          <Button
            className={cn(
              "w-full h-14 transition-all duration-300",
              loading
                ? "bg-gradient-to-r from-pink-600 via-rose-600 to-pink-600 bg-[length:200%_100%] animate-shimmer"
                : "bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500"
            )}
            onClick={handleGenerate}
            disabled={loading || !topic}
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{loadingStep || "生成中..."}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Wand2 className="w-5 h-5" />
                <span className="font-semibold">開始生成腳本</span>
                <Badge className="bg-white/20">-{getCurrentCost()} 點</Badge>
              </div>
            )}
          </Button>
          {!loading && topic && (
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-pink-600 via-rose-600 to-orange-600 blur-xl opacity-30 group-hover:opacity-50 transition-opacity" />
          )}
        </div>
      </div>

      {/* ============ 右側：腳本預覽 ============ */}
      <div className="lg:col-span-3 space-y-4">
        
        {/* 結果區域 */}
        {result ? (
          <div className="space-y-4">
            {/* 腳本標題 */}
            <Card className="bg-gradient-to-br from-pink-950/50 to-rose-950/50 border-pink-500/30">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white">{result.title}</h3>
                    <p className="text-sm text-slate-400 mt-1">{result.description}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge className="bg-pink-600">{result.target_platform}</Badge>
                      <Badge variant="outline">{result.format}</Badge>
                      <Badge variant="outline">{result.total_duration}秒</Badge>
                      <Badge variant="secondary">{result.scenes.length} 個場景</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-8 h-8 rounded-full"
                      style={{ background: `linear-gradient(135deg, ${result.color_palette[0]}, ${result.color_palette[1]})` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 時間軸預覽 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Play className="w-4 h-4 text-pink-500" />
                  場景時間軸
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-1 h-8 rounded-lg overflow-hidden">
                  {result.scenes.map((scene, idx) => {
                    const widthPercent = (scene.duration_seconds / result.total_duration) * 100;
                    const config = SCENE_TYPE_CONFIG[scene.scene_type] || SCENE_TYPE_CONFIG.transition;
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "flex items-center justify-center text-xs font-medium text-white cursor-pointer hover:opacity-80 transition-opacity",
                          config.color
                        )}
                        style={{ width: `${widthPercent}%` }}
                        onClick={() => setExpandedScene(expandedScene === idx ? null : idx)}
                        title={`${config.name} - ${scene.duration_seconds}秒`}
                      >
                        {widthPercent > 15 && (
                          <span>{config.icon}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2 text-xs text-slate-400">
                  <span>0s</span>
                  <span>{result.total_duration}s</span>
                </div>
              </CardContent>
            </Card>

            {/* 場景列表 */}
            <div className="space-y-3">
              {result.scenes.map((scene, idx) => {
                const config = SCENE_TYPE_CONFIG[scene.scene_type] || SCENE_TYPE_CONFIG.transition;
                const isExpanded = expandedScene === idx;
                
                return (
                  <Card 
                    key={idx}
                    className={cn(
                      "transition-all",
                      isExpanded ? "ring-2 ring-pink-500" : ""
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedScene(isExpanded ? null : idx)}
                      className="w-full text-left"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center text-lg",
                              config.color
                            )}>
                              {config.icon}
                            </div>
                            <div>
                              <CardTitle className="text-sm flex items-center gap-2">
                                場景 {scene.scene_number}: {config.name}
                                <Badge variant="outline" className="text-xs">
                                  {scene.duration_seconds}秒
                                </Badge>
                              </CardTitle>
                              <CardDescription className="text-xs line-clamp-1">
                                {scene.narration_text || "無旁白"}
                              </CardDescription>
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </CardHeader>
                    </button>
                    
                    {isExpanded && (
                      <CardContent className="pt-0 space-y-4">
                        {/* 視覺 Prompt */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs flex items-center gap-1">
                              <Eye className="w-3 h-3" /> 視覺 Prompt
                            </Label>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => copyVisualPrompt(scene.visual_prompt)}
                            >
                              <Copy className="w-3 h-3 mr-1" /> 複製
                            </Button>
                          </div>
                          <div className="p-3 bg-slate-800 rounded-lg text-xs text-slate-300 font-mono">
                            {scene.visual_prompt}
                          </div>
                        </div>

                        {/* 旁白文字 */}
                        {scene.narration_text && (
                          <div className="space-y-2">
                            <Label className="text-xs flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" /> 旁白文字
                            </Label>
                            <div className="p-3 bg-slate-800 rounded-lg text-sm">
                              "{scene.narration_text}"
                              <Badge className="ml-2 text-[10px]">{scene.voice_emotion}</Badge>
                            </div>
                          </div>
                        )}

                        {/* 文字疊加 */}
                        {scene.text_overlay && (
                          <div className="space-y-2">
                            <Label className="text-xs">螢幕文字</Label>
                            <div className="p-3 bg-slate-800 rounded-lg text-sm flex items-center justify-between">
                              <span>{scene.text_overlay}</span>
                              <Badge variant="outline" className="text-xs">{scene.text_position}</Badge>
                            </div>
                          </div>
                        )}

                        {/* 其他設定 */}
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="p-2 bg-slate-800 rounded-lg text-center">
                            <div className="text-slate-400">鏡頭</div>
                            <div className="font-medium">{scene.camera_movement}</div>
                          </div>
                          <div className="p-2 bg-slate-800 rounded-lg text-center">
                            <div className="text-slate-400">配樂</div>
                            <div className="font-medium">{scene.background_music_mood}</div>
                          </div>
                          <div className="p-2 bg-slate-800 rounded-lg text-center">
                            <div className="text-slate-400">音效</div>
                            <div className="font-medium">{scene.sound_effects.join(", ") || "無"}</div>
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* 預覽和生成區 */}
            <Card className="border-pink-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-4 h-4 text-pink-500" />
                  影片生成
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 預覽圖 */}
                {(previewImage || videoUrl) && (
                  <div className="relative aspect-[9/16] max-h-[300px] rounded-lg overflow-hidden bg-slate-800">
                    {videoUrl ? (
                      <video
                        src={videoUrl}
                        controls
                        className="w-full h-full object-contain"
                        poster={previewImage || undefined}
                      />
                    ) : previewImage ? (
                      <img
                        src={previewImage}
                        alt="Preview"
                        className="w-full h-full object-contain"
                      />
                    ) : null}
                    {previewImage && !videoUrl && (
                      <div className="absolute bottom-2 left-2 right-2">
                        <Badge className="bg-black/60 text-white text-xs">
                          場景 1 預覽
                        </Badge>
                      </div>
                    )}
                  </div>
                )}
                
                {/* 當前渲染品質顯示 */}
                {!videoUrl && !rendering && (
                  <div className="p-3 rounded-lg border border-slate-700 bg-slate-800/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {QUALITY_OPTIONS.find(q => q.value === renderQuality)?.icon}
                        </span>
                        <div>
                          <div className="text-sm font-medium text-white">
                            {QUALITY_OPTIONS.find(q => q.value === renderQuality)?.label}品質
                          </div>
                          <div className="text-xs text-slate-400">
                            {QUALITY_OPTIONS.find(q => q.value === renderQuality)?.desc}
                            {(renderQuality === "premium" || renderQuality === "ultra") && " • 固定 8 秒"}
                          </div>
                        </div>
                      </div>
                      <Badge className="bg-pink-600 text-white">
                        {getRenderCost()} 點
                      </Badge>
                    </div>
                  </div>
                )}
                
                {/* 渲染進度 */}
                {rendering && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">{renderStep}</span>
                      <span className="text-white font-mono">{Math.round(renderProgress)}%</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all duration-500"
                        style={{ width: `${renderProgress}%` }}
                      />
                    </div>
                  </div>
                )}
                
                {/* 操作按鈕 */}
                <div className="flex flex-col gap-2">
                  {!videoUrl ? (
                    <>
                      <Button
                        onClick={handleGeneratePreview}
                        disabled={previewLoading || rendering}
                        variant="outline"
                        className="w-full"
                      >
                        {previewLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            生成預覽中...
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4 mr-2" />
                            預覽第一場景 (-10 點)
                          </>
                        )}
                      </Button>
                      
                      <Button
                        onClick={handleRenderVideo}
                        disabled={rendering}
                        className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500"
                      >
                        {rendering ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            生成中...
                          </>
                        ) : (
                          <>
                            <Film className="w-4 h-4 mr-2" />
                            生成完整影片 (-{getRenderCost()} 點)
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={handleDownloadVideo}
                        className="w-full bg-emerald-600 hover:bg-emerald-500"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        下載影片
                      </Button>
                      
                      <Button
                        onClick={handleRenderVideo}
                        disabled={rendering}
                        variant="outline"
                        className="w-full"
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        重新生成
                      </Button>
                    </>
                  )}
                </div>
                
                {/* 點數資訊 */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-700 text-sm">
                  <span className="text-slate-400">腳本生成消耗</span>
                  <span className="text-white font-semibold">{result.credits_used} 點</span>
                </div>
              </CardContent>
            </Card>

            {/* 導出選項 */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-400">
                    腳本 ID: <span className="text-white font-mono text-xs">{result.project_id.slice(0, 8)}...</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleExportJson}>
                    <Download className="w-4 h-4 mr-1" />
                    導出 JSON
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* 空狀態 */
          <Card className="h-full min-h-[400px] flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
            <div className="text-center space-y-4 p-8">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-pink-600/20 to-rose-600/20 flex items-center justify-center">
                <Clapperboard className="w-10 h-10 text-pink-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">AI 導演引擎</h3>
                <p className="text-sm text-slate-400 mt-1 max-w-sm">
                  輸入影片主題和品牌設定，AI 將自動生成專業的分鏡腳本，
                  包含視覺提示、旁白、音效等完整指令。
                </p>
              </div>
              <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-1">
                  <Film className="w-4 h-4" />
                  <span>場景分鏡</span>
                </div>
                <div className="flex items-center gap-1">
                  <Volume2 className="w-4 h-4" />
                  <span>旁白設計</span>
                </div>
                <div className="flex items-center gap-1">
                  <Music className="w-4 h-4" />
                  <span>配樂建議</span>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
