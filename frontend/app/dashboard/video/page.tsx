"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import api from "@/lib/api";
import { Player } from "@remotion/player";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Film, Download, Sparkles, Play, X, Pause,
  ArrowRight, Clock, Zap, ChevronRight, Volume2, VolumeX,
  Wand2, Video, ImageIcon, Mic, ChevronDown, Monitor,
  Layers, Box, Target, MessageSquare, Type, Palette,
  TrendingUp, Heart, Gift, Smile, Settings2, GripVertical,
  RefreshCw, Copy, Check, Shuffle, Star, Eye, Edit3,
  History, Trash2, RotateCcw, Upload, Plus, Image as ImageLucide,
  ChevronUp, AlertCircle, CheckCircle2, ArrowDown, ArrowUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ScheduleDialog, ScheduleContent } from "@/components/schedule-dialog";
import { useRouter } from "next/navigation";
import { setPendingImageForEditor, getPendingImageForEngine } from "@/lib/services/shared-gallery-service";
import { useCredits } from "@/lib/credits-context";

// ============================================================
// 類型定義
// ============================================================

interface Scene {
  scene_number: number;
  scene_type: string;
  duration_seconds: number;
  visual_prompt: string;
  narration_text: string;
}

interface VideoScript {
  project_id: string;
  title: string;
  description: string;
  total_duration: number;
  color_palette: string[];
  scenes: Scene[];
  credits_used: number;
}

// 歷史記錄（從 API 載入）
interface HistoryRecord {
  id: number;  // API 返回的是數字 ID
  prompt: string;
  model: string;
  aspectRatio: string;
  duration: string;
  goal: string;
  title?: string;
  createdAt: string;
  // API 額外欄位
  credits_used?: number;
  video_url?: string;
  media_cloud_url?: string;
}

interface QueueStatus {
  queue_length: number;
  active_tasks: number;
  your_position: number | null;
  estimated_wait_seconds: number;
  estimated_wait_minutes: number;
  estimated_wait_display: string;
  system_load: "low" | "medium" | "high" | "busy";
  is_busy: boolean;
  suggested_model: string | null;
  message: string | null;
}

// Storyboard 預覽相關類型
interface StoryboardScene {
  scene_index: number;
  title: string;
  narration: string;
  visual_prompt: string;
  duration_seconds: number;
  thumbnail_url?: string;
  thumbnail_base64?: string;
  audio_url?: string;
  audio_base64?: string;  // base64 編碼的音訊（預覽時生成）
  audio_duration?: number;
  subtitle_text: string;
  subtitle_start: number;
  subtitle_end: number;
}

interface StoryboardPreview {
  project_id: string;
  title: string;
  description: string;
  format: string;
  total_duration: number;
  scenes: StoryboardScene[];
  preview_video_url?: string;
  voice_id: string;
  primary_color: string;
  secondary_color: string;
  preview_credits_used: number;
  estimated_render_credits: number;
  srt_subtitles?: string;
}

interface TTSVoice {
  value: string;
  label: string;
  gender: "male" | "female";
  locale: string;
  style?: string;
}

interface SubtitleStyle {
  fontSize: number;
  fontColor: string;
  outlineColor: string;
  outlineWidth: number;
  position: "bottom" | "center" | "top";
  fontFamily: string;
}

// ============================================================
// 配置
// ============================================================

const QUICK_TEMPLATES = [
  { id: "product", label: "產品展示", prompt: "新品開箱與功能展示影片，突出產品特色與使用體驗", icon: "📦", color: "from-orange-500 to-rose-500" },
  { id: "brand", label: "品牌故事", prompt: "品牌創立故事與理念，傳遞品牌價值觀", icon: "📖", color: "from-violet-500 to-purple-500" },
  { id: "tutorial", label: "教學內容", prompt: "步驟式教學指南，清晰易懂的操作演示", icon: "📚", color: "from-cyan-500 to-blue-500" },
  { id: "promo", label: "促銷活動", prompt: "限時優惠促銷活動，緊迫感行銷", icon: "🔥", color: "from-pink-500 to-rose-500" },
  { id: "lifestyle", label: "生活風格", prompt: "生活方式與使用場景，療癒氛圍", icon: "✨", color: "from-emerald-500 to-teal-500" },
  { id: "viral", label: "爆款內容", prompt: "病毒式傳播內容，引發討論與分享", icon: "🚀", color: "from-amber-500 to-orange-500" },
];

// 渲染模型 - 分組顯示
const MODEL_GROUPS = [
  {
    name: "Kling v2.1",
    description: "高性價比",
    models: [
      { value: "kling", label: "720p", duration: "5秒", durationSec: 5, baseCost: 30, badge: "💰省" },
      { value: "kling-10s", label: "720p", duration: "10秒", durationSec: 10, baseCost: 55, badge: "💰省" },
      { value: "kling-pro", label: "1080p", duration: "5秒", durationSec: 5, baseCost: 50, badge: null },
      { value: "kling-pro-10s", label: "1080p", duration: "10秒", durationSec: 10, baseCost: 90, badge: "推薦" },
    ]
  },
  {
    name: "Google Veo",
    description: "頂級品質",
    models: [
      { value: "premium", label: "Fast", duration: "8秒", durationSec: 8, baseCost: 200, badge: null },
      { value: "ultra", label: "Pro", duration: "8秒", durationSec: 8, baseCost: 350, badge: "⭐頂級" },
    ]
  },
];

// 扁平化模型列表（供其他邏輯使用）
const MODELS = MODEL_GROUPS.flatMap(g => g.models.map(m => ({ ...m, group: g.name })));

const ASPECT_RATIOS = [
  { value: "9:16", label: "9:16", desc: "直式", icon: "📱" },
  { value: "16:9", label: "16:9", desc: "橫式", icon: "🖥️" },
  { value: "1:1", label: "1:1", desc: "方形", icon: "⬜" },
];


const SCRIPT_GOALS = [
  { value: "awareness", label: "品牌曝光", icon: Target, color: "from-pink-500 to-rose-500" },
  { value: "engagement", label: "互動參與", icon: MessageSquare, color: "from-cyan-500 to-blue-500" },
  { value: "conversion", label: "轉換銷售", icon: TrendingUp, color: "from-emerald-500 to-teal-500" },
  { value: "viral", label: "爆款短片", icon: Zap, color: "from-amber-500 to-orange-500" },
  { value: "lifestyle", label: "生活趣味", icon: Smile, color: "from-lime-500 to-green-500" },
  { value: "emotional", label: "情緒傳遞", icon: Heart, color: "from-red-500 to-pink-500" },
  { value: "festive", label: "節慶祝福", icon: Gift, color: "from-fuchsia-500 to-purple-500" },
  { value: "education", label: "知識傳遞", icon: Layers, color: "from-violet-500 to-purple-500" },
];

const TONES = ["專業穩重", "親切友善", "活力動感", "優雅質感", "趣味幽默"];

const SCENE_COLORS: Record<string, string> = {
  hook: "bg-gradient-to-r from-rose-500 to-pink-500",
  problem: "bg-gradient-to-r from-amber-500 to-orange-500",
  solution: "bg-gradient-to-r from-emerald-500 to-teal-500",
  demonstration: "bg-gradient-to-r from-sky-500 to-blue-500",
  cta: "bg-gradient-to-r from-violet-500 to-purple-500",
};

const INSPIRATION_GALLERY = [
  { id: 1, prompt: "咖啡店新品拿鐵上市，溫暖療癒的氛圍", category: "餐飲", likes: 128 },
  { id: 2, prompt: "科技產品開箱，極簡專業風格", category: "科技", likes: 256 },
  { id: 3, prompt: "美妝教學步驟，清新自然妝容", category: "美妝", likes: 89 },
  { id: 4, prompt: "健身APP功能展示，活力動感", category: "健康", likes: 167 },
  { id: 5, prompt: "手作甜點製作過程，療癒美食", category: "美食", likes: 203 },
  { id: 6, prompt: "電商限時優惠，緊迫感促銷", category: "電商", likes: 145 },
];

// TTS 語音列表（已驗證可用）
const TTS_VOICES: TTSVoice[] = [
  // 繁體中文（台灣）
  { value: "zh-TW-HsiaoChenNeural", label: "曉臻", gender: "female", locale: "zh-TW", style: "親切正式" },
  { value: "zh-TW-HsiaoYuNeural", label: "曉雨", gender: "female", locale: "zh-TW", style: "溫柔甜美" },
  { value: "zh-TW-YunJheNeural", label: "雲哲", gender: "male", locale: "zh-TW", style: "專業穩重" },
  // 簡體中文
  { value: "zh-CN-XiaoxiaoNeural", label: "曉曉", gender: "female", locale: "zh-CN", style: "溫暖知性" },
  { value: "zh-CN-XiaoyiNeural", label: "曉伊", gender: "female", locale: "zh-CN", style: "活潑卡通" },
  { value: "zh-CN-YunyangNeural", label: "雲揚", gender: "male", locale: "zh-CN", style: "專業新聞" },
  { value: "zh-CN-YunjianNeural", label: "雲健", gender: "male", locale: "zh-CN", style: "熱情解說" },
  { value: "zh-CN-YunxiNeural", label: "雲希", gender: "male", locale: "zh-CN", style: "陽光活力" },
  // 粵語
  { value: "zh-HK-HiuMaanNeural", label: "曉曼", gender: "female", locale: "zh-HK", style: "粵語女聲" },
  { value: "zh-HK-WanLungNeural", label: "雲龍", gender: "male", locale: "zh-HK", style: "粵語男聲" },
  // 英文
  { value: "en-US-JennyNeural", label: "Jenny", gender: "female", locale: "en-US", style: "美式女聲" },
  { value: "en-US-GuyNeural", label: "Guy", gender: "male", locale: "en-US", style: "美式男聲" },
  { value: "en-GB-SoniaNeural", label: "Sonia", gender: "female", locale: "en-GB", style: "英式女聲" },
  // 日文
  { value: "ja-JP-NanamiNeural", label: "七海", gender: "female", locale: "ja-JP", style: "日語女聲" },
  { value: "ja-JP-KeitaNeural", label: "圭太", gender: "male", locale: "ja-JP", style: "日語男聲" },
  // 韓文
  { value: "ko-KR-SunHiNeural", label: "善熙", gender: "female", locale: "ko-KR", style: "韓語女聲" },
  { value: "ko-KR-InJoonNeural", label: "仁俊", gender: "male", locale: "ko-KR", style: "韓語男聲" },
];

// 背景音樂庫（免費版權音樂）
interface MusicTrack {
  id: string;
  name: string;
  genre: string;
  mood: string;
  duration: string;
  source: string;
  url: string;
  previewUrl?: string;  // 前端試聽用的 URL
  attribution?: string;
}

// Mixkit 免費商用音樂庫（含預覽 URL）
const MUSIC_LIBRARY: MusicTrack[] = [
  // ⭐ Mixkit 免費商用音樂（免費、無需署名）
  // 來源：https://mixkit.co - 可用於商業項目
  // previewUrl: 用於前端試聽, url: 用於渲染時的風格選擇
  {
    id: "style-upbeat",
    name: "🎵 活力動感",
    genre: "流行/電子",
    mood: "upbeat",
    duration: "30秒+",
    source: "Mixkit",
    url: "style:upbeat",
    previewUrl: "https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3",
    attribution: "Mixkit License - 免費商用"
  },
  {
    id: "style-inspiring",
    name: "🌟 勵志振奮",
    genre: "流行/古典",
    mood: "inspirational",
    duration: "30秒+",
    source: "Mixkit",
    url: "style:inspirational",
    previewUrl: "https://assets.mixkit.co/music/preview/mixkit-spirit-of-the-game-132.mp3",
    attribution: "Mixkit License - 免費商用"
  },
  {
    id: "style-calm",
    name: "🌊 悠閒放鬆",
    genre: "Lo-Fi/氛圍",
    mood: "calm",
    duration: "30秒+",
    source: "Mixkit",
    url: "style:calm",
    previewUrl: "https://assets.mixkit.co/music/preview/mixkit-serene-view-443.mp3",
    attribution: "Mixkit License - 免費商用"
  },
  {
    id: "style-epic",
    name: "🎬 電影史詩",
    genre: "電影配樂",
    mood: "epic",
    duration: "30秒+",
    source: "Mixkit",
    url: "style:epic",
    previewUrl: "https://assets.mixkit.co/music/preview/mixkit-epic-orchestra-transition-2290.mp3",
    attribution: "Mixkit License - 免費商用"
  },
  {
    id: "style-emotional",
    name: "💕 情感鋼琴",
    genre: "鋼琴/古典",
    mood: "emotional",
    duration: "30秒+",
    source: "Mixkit",
    url: "style:emotional",
    previewUrl: "https://assets.mixkit.co/music/preview/mixkit-piano-reflections-22.mp3",
    attribution: "Mixkit License - 免費商用"
  },
  {
    id: "style-tech",
    name: "🔮 科技電子",
    genre: "電子/合成",
    mood: "minimal",
    duration: "30秒+",
    source: "Mixkit",
    url: "style:minimal",
    previewUrl: "https://assets.mixkit.co/music/preview/mixkit-deep-urban-623.mp3",
    attribution: "Mixkit License - 免費商用"
  },
  {
    id: "style-corporate",
    name: "🏢 企業形象",
    genre: "流行/勵志",
    mood: "corporate",
    duration: "30秒+",
    source: "Mixkit",
    url: "style:corporate",
    previewUrl: "https://assets.mixkit.co/music/preview/mixkit-driving-ambition-32.mp3",
    attribution: "Mixkit License - 免費商用"
  },
  {
    id: "style-faith",
    name: "🕊️ 信仰靈性",
    genre: "靈感/盼望",
    mood: "faith",
    duration: "30秒+",
    source: "Mixkit",
    url: "style:faith",
    previewUrl: "https://assets.mixkit.co/music/preview/mixkit-spirit-of-the-game-132.mp3",
    attribution: "Mixkit License - 免費商用"
  },

  // 無音樂
  { id: "none", name: "🔇 無背景音樂", genre: "-", mood: "-", duration: "-", source: "-", url: "" },
];

// 音樂分類
const MUSIC_MOODS = [
  { id: "all", label: "全部", icon: "🎵" },
  { id: "upbeat", label: "輕快活力", icon: "⚡" },
  { id: "calm", label: "平靜舒緩", icon: "🌊" },
  { id: "emotional", label: "情感觸動", icon: "💕" },
  { id: "epic", label: "史詩壯闘", icon: "🎬" },
  { id: "minimal", label: "極簡電子", icon: "🔲" },
  { id: "inspirational", label: "勵志向上", icon: "🌟" },
  { id: "faith", label: "信仰靈性", icon: "🕊️" },
];

// 字幕樣式預設
const SUBTITLE_STYLES = [
  { id: "none", name: "無字幕", icon: "🚫" },
  { id: "minimal", name: "極簡白字", fontColor: "#FFFFFF", outlineColor: "#000000", fontSize: 42, position: "bottom" as const },
  { id: "bold", name: "粗體醒目", fontColor: "#FFFFFF", outlineColor: "#000000", fontSize: 52, position: "bottom" as const },
  { id: "neon", name: "霓虹發光", fontColor: "#00FF88", outlineColor: "#FF00FF", fontSize: 48, position: "bottom" as const },
  { id: "classic", name: "經典黃字", fontColor: "#FFFF00", outlineColor: "#000000", fontSize: 46, position: "bottom" as const },
  { id: "center", name: "置中大字", fontColor: "#FFFFFF", outlineColor: "#000000", fontSize: 56, position: "center" as const },
];

// 字幕字體選項
const SUBTITLE_FONTS = [
  { value: "Noto Sans TC", label: "思源黑體" },
  { value: "Noto Serif TC", label: "思源宋體" },
  { value: "Arial", label: "Arial" },
  { value: "Impact", label: "Impact" },
];

// 預覽成本配置
const PREVIEW_COST = {
  thumbnail: 2,  // 每場景縮圖
  tts: 1,        // 每場景 TTS
  preview_video: 5, // 快速預覽影片
};

// ============================================================
// 主組件
// ============================================================

export default function VideoPage() {
  const router = useRouter();
  const { refreshCredits } = useCredits();

  // 客戶端掛載狀態（防止 hydration 錯誤）
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 檢查是否有從圖片編輯室導入的圖片
  useEffect(() => {
    if (!mounted) return;

    const checkPendingImage = async () => {
      const pendingImage = await getPendingImageForEngine('video');
      if (pendingImage) {
        // 短影音暫時只提示用戶，未來可以整合到場景圖片
        toast.success(`已從圖片編輯室導入「${pendingImage.name || '設計作品'}」`, {
          description: "圖片已保存到圖庫，可在自訂場景中使用",
          duration: 5000,
        });
      }
    };

    checkPendingImage();
  }, [mounted]);

  // 核心狀態
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("kling");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [duration, setDuration] = useState("8");
  const [selectedGoal, setSelectedGoal] = useState("awareness");
  const [selectedTone, setSelectedTone] = useState("專業穩重");

  // 版本切換
  const [activeVersion, setActiveVersion] = useState<"2.0" | "3.0">("2.0");

  // v3.0 引擎狀態
  const [v3Mode, setV3Mode] = useState<"t2v" | "i2v" | "s2v" | "sadtalker">("t2v");

  // 讀取/儲存 Tab 狀態到 LocalStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedVersion = localStorage.getItem("kingjam_vid_version");
      if (savedVersion === "2.0" || savedVersion === "3.0") setActiveVersion(savedVersion);

      const savedMode = localStorage.getItem("kingjam_vid_v3mode");
      if (savedMode === "t2v" || savedMode === "i2v" || savedMode === "s2v" || savedMode === "sadtalker") setV3Mode(savedMode);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("kingjam_vid_version", activeVersion);
    }
  }, [activeVersion]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("kingjam_vid_v3mode", v3Mode);
    }
  }, [v3Mode]);
  const [v3Prompt, setV3Prompt] = useState("科技領域的前瞻創新，將重新定義未來的可能。");
  const [v3Style, setV3Style] = useState("tech_startup");
  const [v3Voice, setV3Voice] = useState("alloy");
  const [v3AspectRatio, setV3AspectRatio] = useState("9:16");
  const [v3Duration, setV3Duration] = useState(30);
  const [v3ScenesCount, setV3ScenesCount] = useState(3);
  const [v3RefImage, setV3RefImage] = useState("");
  const [v3AudioUrl, setV3AudioUrl] = useState("");
  const [v3NegPrompt, setV3NegPrompt] = useState("");
  const [v3Loading, setV3Loading] = useState(false);
  const [v3Result, setV3Result] = useState<any>(null);
  const [v3Error, setV3Error] = useState<string | null>(null);
  const [v3Scenes, setV3Scenes] = useState<any[]>([]);
  const [v3EditingIdx, setV3EditingIdx] = useState<number | null>(null);
  const [v3ShowAdvanced, setV3ShowAdvanced] = useState(false);
  const [v3VideoGenerating, setV3VideoGenerating] = useState(false);
  const [v3VideoJobs, setV3VideoJobs] = useState<any[]>([]);
  const [v3VideoProgress, setV3VideoProgress] = useState<string>("");
  const [v3SynthesisProgress, setV3SynthesisProgress] = useState("");
  const [v3Synthesizing, setV3Synthesizing] = useState(false);
  const [v3FinalVideoUrl, setV3FinalVideoUrl] = useState<string | null>(null);
  const [isV3Canceling, setIsV3Canceling] = useState(false);
  const v3CancelRef = useRef(false);

  const handleCancelV3 = () => {
    v3CancelRef.current = true;
    setIsV3Canceling(true);
    toast.info("正在停止生成，請稍候...");
  };

  const handleV3SynthesizeVideo = async () => {
    if (v3Scenes.length === 0 || !v3Scenes.every((s: any) => s.videoUrl)) {
      toast.error("請確認所有場景皆已生成影片片段");
      return;
    }
    setV3Synthesizing(true);
    setV3SynthesisProgress("生成語音旁白...");
    setV3FinalVideoUrl(null);
    v3CancelRef.current = false;
    setIsV3Canceling(false);
    try {
      // 1. 生成配音與字幕
      const fullText = v3Scenes.map((s: any) => s.narration).join(" ");
      const ttsRes = await api.post("/video/v3/tts", {
        text: fullText || "無旁白",
        voice: v3Voice || "alloy",
        model: "tts-1-hd",
        speed: "normal",
        fps: 30
      });
      const { audio_url, subtitles } = ttsRes.data;

      setV3SynthesisProgress("提交雲端渲染...");

      // 2. 構建 Remotion Props
      const props = {
        script: {
          projectId: "v3_demo",
          title: v3Prompt || "AI Video",
          description: v3Prompt || "AI Generated Video",
          totalDurationInFrames: v3Scenes.reduce((acc: number, s: any) => acc + (s.durationInFrames || 150), 0),
          fps: 30,
          width: 1080,
          height: 1920,
          aspectRatio: "9:16"
        },
        scenes: v3Scenes.map((s: any, idx: number) => ({
          index: idx,
          type: s.type || "story",
          durationInFrames: s.durationInFrames || 150,
          videoUrl: s.videoUrl,
          narration: s.narration,
          visualPrompt: s.visualPrompt,
          transition: s.transition || "fade"
        })),
        audioUrl: audio_url,
        subtitles: subtitles,
        theme: {
          id: "default",
          name: "Default",
          category: "Basic",
          colors: { primary: "#00e5ff", secondary: "#7000ff", accent: "#ff00e5", bg: "#000000", text: "#ffffff" },
          fonts: { title: "Inter", body: "Inter", accent: "Inter" },
          transitions: ["fade"],
          progressBarStyle: "gradient",
          subtitlePreset: { fontSize: 40, fontColor: "#fff", outlineColor: "#000", outlineWidth: 3, position: "center", fontFamily: "Inter" },
          musicMood: "minimal",
          animationIntensity: "moderate"
        },
        showProgressBar: true,
        showWatermark: true,
        musicUrl: "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3",
        musicVolume: 0.3
      };

      // 3. 提交渲染請求
      const renderRes = await api.post("/video/v3/render", {
        props,
        output_format: "mp4",
        quality: "medium"
      });
      const jobId = renderRes.data.jobId;

      setV3SynthesisProgress("雲端合成中... (0%)");

      // 4. 輪詢狀態
      let attempts = 0;
      while (attempts < 120) {
        if (v3CancelRef.current) {
          toast.error("合成已中斷");
          setV3SynthesisProgress("已暫停/取消合成");
          setV3Synthesizing(false);
          setIsV3Canceling(false);
          v3CancelRef.current = false;
          return;
        }

        attempts++;
        await new Promise(r => setTimeout(r, 5000));
        const statusRes = await api.get(`/video/v3/render/status/${jobId}`);
        const status = statusRes.data;
        if (status.status === "done" && status.videoUrl) {
          const finalUrl = status.videoUrl.startsWith('http') ? status.videoUrl : `https://kingjam-video-renderer-811364632967.asia-east1.run.app${status.videoUrl}`;
          setV3FinalVideoUrl(finalUrl);
          setV3SynthesisProgress("✅ 合成完成");
          toast.success("影片合成完成！");

          // 加入歷史紀錄 (支援發布與排程)
          try {
            await api.post("/history", {
              generation_type: "short_video",
              status: "completed",
              input_params: {
                project_id: "v3_demo",
                title: v3Prompt || "AI 影片",
                prompt: v3Prompt || "AI 影片",
                model: "Remotion (v3)",
                aspect_ratio: v3AspectRatio,
                duration: "30"
              },
              output_data: {
                caption: `AI Video: ${v3Prompt}`,
                video_url: finalUrl,
                title: v3Prompt || "AI 影片"
              },
              media_cloud_url: finalUrl,
              credits_used: 15
            });
            loadHistory(); // 重新載入歷史列表
          } catch (e) {
            console.error("保存合成紀錄失敗", e);
          }
          break;
        } else if (status.status === "error") {
          throw new Error(status.error || "未知渲染錯誤");
        } else {
          setV3SynthesisProgress(`雲端合成中... (${Math.round((status.progress || 0) * 100)}%)`);
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || "";
      toast.error(`影片合成失敗: ${msg}`);
      setV3SynthesisProgress("❌ 合成失敗");
    } finally {
      setV3Synthesizing(false);
    }
  };

  const handleV3Generate = async () => {
    if (!v3Prompt.trim()) {
      toast.error("請輸入影片主題");
      return;
    }
    setV3Loading(true);
    setV3Error(null);
    setV3Result(null);
    try {
      const res = await api.post("/video/v3/api/generate-video", {
        mode: v3Mode,
        script: v3Prompt,
        style_id: v3Style,
        voice: v3Voice,
        duration: v3Duration,
        scenes_count: v3Mode === "sadtalker" ? 1 : v3ScenesCount, // SadTalker 只有 1 個播報場景
        aspect_ratio: v3AspectRatio,
        ref_image_url: (v3Mode === "i2v" || v3Mode === "sadtalker") ? v3RefImage || undefined : undefined,
        audio_url: (v3Mode === "s2v" || v3Mode === "sadtalker") ? v3AudioUrl || undefined : undefined,
        negative_prompt: v3NegPrompt || undefined,
      });
      setV3Result(res.data);
      setV3Scenes(res.data.scenes ? [...res.data.scenes] : []);
      setV3EditingIdx(null);
      const modeLabels: Record<string, string> = { t2v: "文字生成", i2v: "圖片生成", s2v: "語音驅動", sadtalker: "數字人播報" };
      toast.success(`🎬 ${modeLabels[v3Mode] || v3Mode} 完成！${res.data.scenes?.length || 0} 個場景`);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err.message || "生成失敗";
      setV3Error(msg);
      toast.error(`生成失敗: ${msg}`);
    } finally {
      setV3Loading(false);
    }
  };

  const handleV3GenerateClips = async () => {
    if (v3Scenes.length === 0) {
      toast.error("請先生成腳本");
      return;
    }
    setV3VideoGenerating(true);
    setV3VideoProgress("提交場景到 AI 影片引擎...");
    setV3VideoJobs([]);
    v3CancelRef.current = false;
    setIsV3Canceling(false);

    try {
      const clipRes = await api.post("/video/v3/api/generate-clips", {
        scenes: v3Scenes,
        aspect_ratio: v3AspectRatio,
        model_preference: v3Mode === "sadtalker" ? "sadtalker" : "auto",
      });
      const jobs = clipRes.data.jobs || [];
      setV3VideoJobs(jobs);
      toast.success(`🎬 ${clipRes.data.submitted} 個場景已提交到 AI 影片引擎`);

      const validJobs = jobs.filter((j: any) => j.request_id);
      if (validJobs.length === 0) {
        toast.error("所有場景提交失敗");
        setV3VideoGenerating(false);
        return;
      }

      let attempts = 0;
      const maxAttempts = 180; // 5 min -> 15 min to accommodate LTX rendering
      const pollInterval = 5000;

      while (attempts < maxAttempts) {
        if (v3CancelRef.current) {
          toast.error("影片生成已中斷");
          setV3VideoProgress("已暫停/取消生成");
          setV3VideoGenerating(false);
          setIsV3Canceling(false);
          v3CancelRef.current = false;
          return;
        }

        attempts++;
        setV3VideoProgress(`影片生成中... (${attempts * 5}s)`);
        await new Promise(r => setTimeout(r, pollInterval));

        try {
          const statusRes = await api.post("/video/v3/api/check-clips", {
            jobs: validJobs.map((j: any) => ({ request_id: j.request_id, model: j.model })),
          });

          console.log("[Video Generation] Polling API Response:", statusRes.data);

          const statuses = statusRes.data.statuses || [];
          const completedCount = statuses.filter((s: any) => s.status === "completed" || s.status === "COMPLETED").length;
          const errorCount = statuses.filter((s: any) => s.status === "error" || s.status === "failed" || s.status === "ERROR").length;
          const isQueuing = statuses.some((s: any) => s.status === "queuing" || s.status === "pending" || s.status === "processing");

          if (isQueuing) {
            setV3VideoProgress(`影片生成中... ${completedCount}/${validJobs.length} (正在處理中)`);
          } else {
            setV3VideoProgress(`影片生成中... ${completedCount}/${validJobs.length} 完成`);
          }

          const updatedScenes = [...v3Scenes];
          statuses.forEach((s: any, idx: number) => {
            if ((s.status === "completed" || s.status === "COMPLETED") && s.video_url) {
              const sceneIdx = validJobs[idx]?.index;
              if (sceneIdx !== undefined && updatedScenes[sceneIdx]) {
                updatedScenes[sceneIdx] = { ...updatedScenes[sceneIdx], videoUrl: s.video_url };
              }
            }
          });
          setV3Scenes(updatedScenes);

          // 嚴格判定：只有當完成 + 錯誤 = 總數時才退出
          const isRealAllDone = (completedCount + errorCount) >= validJobs.length;

          if (isRealAllDone) {
            const successClips = statuses.filter((s: any) => s.status === "completed" || s.status === "COMPLETED");
            toast.success(`🎉 ${successClips.length} 個影片片段生成完成！`);
            setV3VideoProgress(`✅ ${successClips.length}/${validJobs.length} 完成`);

            // 將每一個成功生成的片段加入歷史紀錄
            for (let i = 0; i < successClips.length; i++) {
              const clip = successClips[i];
              const sceneIdx = validJobs[i]?.index;
              const sceneDetail = sceneIdx !== undefined ? updatedScenes[sceneIdx] : null;
              try {
                await api.post("/history", {
                  generation_type: "short_video",
                  status: "completed",
                  input_params: {
                    project_id: "v3_clips",
                    title: sceneDetail?.narration ? `場景片段: ${sceneDetail.narration.substring(0, 15)}...` : "AI 影片片段",
                    prompt: sceneDetail?.visualPrompt || "AI 影片片段",
                    model: "LTX-2 (A100)",
                    aspect_ratio: v3AspectRatio,
                    duration: "5"
                  },
                  output_data: {
                    caption: sceneDetail?.narration || "AI 影片片段",
                    video_url: clip.video_url,
                    title: sceneDetail?.narration ? `場景片段: ${sceneDetail.narration.substring(0, 15)}...` : "AI 影片片段"
                  },
                  media_cloud_url: clip.video_url,
                  credits_used: 5
                });
              } catch (e) {
                console.error("保存片段紀錄失敗", e);
              }
            }
            loadHistory();
            break;
          }
        } catch (pollErr) {
          console.error("Polling error:", pollErr);
          // 輪詢失敗不中斷，繼續下一次嘗試
        }
      }

      if (attempts >= maxAttempts) {
        toast.error("部分場景生成超時");
        setV3VideoProgress("⏱️ 超時");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err.message || "提交失敗";
      toast.error(`影片生成失敗: ${msg}`);
      setV3VideoProgress("");
    } finally {
      setV3VideoGenerating(false);
    }
  };


  // 下拉選單
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // 生成狀態
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VideoScript | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // AI 腳本
  const [scriptGenerating, setScriptGenerating] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);
  const [scriptTopic, setScriptTopic] = useState("");

  // 歷史記錄
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // 排程上架狀態
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleContent, setScheduleContent] = useState<ScheduleContent | null>(null);

  // 自訂場景圖片（基礎合成用）
  const [customImages, setCustomImages] = useState<{ [key: number]: { file: File; preview: string; base64: string } }>({});
  const [uploadingImage, setUploadingImage] = useState<number | null>(null);
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  // 佇列狀態
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [loadingQueueStatus, setLoadingQueueStatus] = useState(false);

  // ============================================================
  // Storyboard 低成本預覽狀態
  // ============================================================
  const [showPreviewMode, setShowPreviewMode] = useState(false);
  const [storyboardPreview, setStoryboardPreview] = useState<StoryboardPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);

  // TTS 語音設定
  const [selectedVoice, setSelectedVoice] = useState("zh-TW-HsiaoChenNeural");
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  const [playingSceneIndex, setPlayingSceneIndex] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 背景音樂設定（預設使用 Pixabay 專業音樂）
  const [selectedMusic, setSelectedMusic] = useState("style-inspiring");
  const [musicMoodFilter, setMusicMoodFilter] = useState("all");
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const [playingMusicId, setPlayingMusicId] = useState<string | null>(null); // 追蹤正在播放的音樂 ID
  const [musicVolume, setMusicVolume] = useState(30); // 0-100
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);

  // 自訂音樂上傳
  const [customMusicFile, setCustomMusicFile] = useState<File | null>(null);
  const [customMusicUrl, setCustomMusicUrl] = useState<string | null>(null);
  const [customMusicName, setCustomMusicName] = useState<string>("");
  const customMusicInputRef = useRef<HTMLInputElement>(null);

  // 字幕樣式設定
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>({
    fontSize: 46,
    fontColor: "#FFFFFF",
    outlineColor: "#000000",
    outlineWidth: 3,
    position: "bottom",
    fontFamily: "Noto Sans TC",
  });
  const [selectedSubtitlePreset, setSelectedSubtitlePreset] = useState("minimal");

  // 場景編輯
  const [editingSceneIndex, setEditingSceneIndex] = useState<number | null>(null);
  const [editedScenes, setEditedScenes] = useState<StoryboardScene[]>([]);
  const [modifiedScenes, setModifiedScenes] = useState<Set<number>>(new Set()); // 追蹤已修改旁白的場景
  const [regeneratingTTS, setRegeneratingTTS] = useState<number | null>(null); // 正在重新生成 TTS 的場景索引

  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 計算點數
  const currentModel = MODELS.find(m => m.value === model);

  // 腳本生成成本（根據時長）
  const SCRIPT_COST_MAP: Record<number, number> = {
    5: 10,   // 5 秒
    8: 15,   // 8 秒 (Veo)
    10: 15,  // 10 秒 (Kling)
    15: 20,  // 15 秒
    30: 30,  // 30 秒
    60: 50,  // 60 秒
  };
  const modelDuration = currentModel?.durationSec || 8;
  const scriptCost = SCRIPT_COST_MAP[modelDuration] || 15;

  // 渲染成本：直接使用模型的基礎成本
  const renderCost = currentModel?.baseCost || 50;

  // 總成本 = 腳本 + 渲染（分兩次扣除）
  const creditCost = scriptCost + renderCost;

  // 從 API 載入歷史記錄
  const loadHistory = async () => {
    try {
      const res = await api.get("/history", {
        params: { generation_type: "short_video", page: 1, page_size: 50 }
      });

      console.log("[loadHistory] API 原始回應:", res.data.items?.[0]);

      // 轉換 API 回應格式
      // 注意：後端可能使用 topic 而非 prompt
      const records: HistoryRecord[] = res.data.items.map((item: any) => ({
        id: item.id,
        prompt: item.input_params?.topic || item.input_params?.prompt || item.output_data?.title || "",
        model: item.input_params?.model || "veo-3-fast",
        aspectRatio: item.input_params?.aspectRatio || item.input_params?.aspect_ratio || "9:16",
        duration: item.input_params?.duration || String(item.input_params?.duration_seconds) || "8",
        goal: item.input_params?.goal || "product_showcase",
        title: item.input_params?.title || item.output_data?.title,
        createdAt: item.created_at,
        credits_used: item.credits_used,
        video_url: item.output_data?.video_url,
        media_cloud_url: item.media_cloud_url,
      }));

      console.log("[loadHistory] 轉換後記錄:", records[0]);

      setHistory(records);
    } catch (e) {
      console.error("載入歷史記錄失敗:", e);
    }
  };

  // 初始載入歷史記錄
  useEffect(() => {
    loadHistory();
  }, []);

  // === 頁面重整狀態保存與恢復 ===
  // 注意：只保存輕量設定，不保存大型數據（避免 QuotaExceededError）
  const SESSION_STATE_KEY = 'videoPageState';

  // 恢復頁面狀態（頁面載入時執行一次）
  useEffect(() => {
    if (!mounted) return;

    try {
      const savedState = sessionStorage.getItem(SESSION_STATE_KEY);
      if (savedState) {
        const state = JSON.parse(savedState);
        // 恢復設定
        if (state.prompt) setPrompt(state.prompt);
        if (state.scriptTopic) setScriptTopic(state.scriptTopic);
        if (state.model) setModel(state.model);
        if (state.aspectRatio) setAspectRatio(state.aspectRatio);
        if (state.duration) setDuration(state.duration);
        if (state.selectedGoal) setSelectedGoal(state.selectedGoal);
        if (state.selectedTone) setSelectedTone(state.selectedTone);
        if (state.selectedVoice) setSelectedVoice(state.selectedVoice);
        if (state.selectedMusic) setSelectedMusic(state.selectedMusic);
        // 恢復腳本文本（輕量數據）
        if (state.generatedScript) setGeneratedScript(state.generatedScript);
      }
    } catch (e) {
      console.error('恢復影片頁面狀態失敗:', e);
      sessionStorage.removeItem(SESSION_STATE_KEY);
    }
  }, [mounted]);

  // 保存頁面狀態（當關鍵狀態變更時）- 只保存輕量設定
  useEffect(() => {
    if (!mounted) return;

    const stateToSave = {
      prompt,
      scriptTopic,
      model,
      aspectRatio,
      duration,
      selectedGoal,
      selectedTone,
      selectedVoice,
      selectedMusic,
      // 只保存腳本文本，不保存 result/storyboardPreview（可能含大型數據）
      generatedScript,
    };

    try {
      sessionStorage.setItem(SESSION_STATE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.error('保存影片頁面狀態失敗:', e);
      try {
        sessionStorage.removeItem(SESSION_STATE_KEY);
      } catch { }
    }
  }, [mounted, prompt, scriptTopic, model, aspectRatio, duration, selectedGoal, selectedTone, selectedVoice, selectedMusic, generatedScript]);

  // 載入佇列狀態
  const loadQueueStatus = useCallback(async () => {
    setLoadingQueueStatus(true);
    try {
      const res = await api.get("/video/queue-status", {
        params: { model }
      });
      setQueueStatus(res.data);
    } catch (e) {
      console.error("載入佇列狀態失敗:", e);
      // 設置預設值
      setQueueStatus({
        queue_length: 0,
        active_tasks: 0,
        your_position: null,
        estimated_wait_seconds: 90,
        estimated_wait_minutes: 1.5,
        estimated_wait_display: "約 1-2 分鐘",
        system_load: "medium",
        is_busy: false,
        suggested_model: null,
        message: null,
      });
    } finally {
      setLoadingQueueStatus(false);
    }
  }, [model]);

  // 當模型變更或初始載入時，獲取佇列狀態
  useEffect(() => {
    loadQueueStatus();
  }, [loadQueueStatus]);

  // 定期更新佇列狀態（每 30 秒）
  useEffect(() => {
    const interval = setInterval(() => {
      loadQueueStatus();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadQueueStatus]);

  // 追蹤模型變更並重新生成腳本
  const previousModelRef = useRef<string>(model);

  useEffect(() => {
    // 檢查模型是否變更
    if (previousModelRef.current !== model) {
      const prevModel = previousModelRef.current;
      previousModelRef.current = model;

      // 如果彈窗打開且有腳本結果，重新生成腳本
      if (showModal && result && !rendering && !scriptGenerating) {
        const prevModelInfo = MODELS.find(m => m.value === prevModel);
        const newModelInfo = MODELS.find(m => m.value === model);

        // 只有當模型時長不同時才重新生成
        if (prevModelInfo?.durationSec !== newModelInfo?.durationSec) {
          toast.info(`🔄 模型已切換為 ${newModelInfo?.label}，正在重新生成腳本...`, {
            duration: 2000,
          });

          // 重新生成腳本
          (async () => {
            setScriptGenerating(true);
            try {
              const topic = result.title || prompt.trim();
              const actualDuration = String(newModelInfo?.durationSec || 8);

              const response = await api.post("/video/generate", {
                topic,
                platform: "tiktok",
                duration: actualDuration,
                format: aspectRatio,
                goal: selectedGoal,
              });

              const script = response.data;
              let scriptText = `【${script.title}】\n`;
              scriptText += `${script.description}\n\n`;
              scriptText += `📋 場景規劃 (${script.total_duration}秒):\n`;
              script.scenes.forEach((scene: Scene, idx: number) => {
                scriptText += `\n${idx + 1}. ${scene.scene_type.toUpperCase()} (${scene.duration_seconds}秒)\n`;
                scriptText += `   ${scene.narration_text}\n`;
              });

              setGeneratedScript(scriptText);
              setResult(script);

              // 如果有預覽模式的資料，也需要清除
              if (storyboardPreview) {
                setStoryboardPreview(null);
                setEditedScenes([]);
                setShowPreviewMode(false);
              }

              toast.success(`✅ 腳本已更新為 ${newModelInfo?.label} (${actualDuration}秒)`);
              loadHistory(); // 刷新歷史記錄
            } catch (error: any) {
              toast.error(error.response?.data?.detail || "腳本重新生成失敗");
            } finally {
              setScriptGenerating(false);
            }
          })();
        }
      }
    }
  }, [model, showModal, result, rendering, scriptGenerating, prompt, aspectRatio, selectedGoal, storyboardPreview]);

  // 注意：歷史記錄由後端 API 自動建立，前端只需刷新列表

  // 套用歷史記錄（只填充參數，可手動調整後再生成）
  const applyHistory = (record: HistoryRecord) => {
    console.log("[applyHistory] 開始套用:", record);

    try {
      setPrompt(record.prompt || "");
      setModel(record.model || "veo-3-fast");
      setAspectRatio(record.aspectRatio || "9:16");
      setDuration(record.duration || "8");
      setSelectedGoal(record.goal || "awareness");
      setShowHistory(false);

      console.log("[applyHistory] 狀態已更新");

      // 滾動到頂部並聚焦輸入框
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select(); // 選取文字方便編輯
      }, 300);

      toast.success("已套用參數，可調整後再生成", {
        description: "修改提示詞或參數後，點擊「生成」按鈕",
        duration: 3000,
      });

      console.log("[applyHistory] 完成");
    } catch (error) {
      console.error("[applyHistory] 錯誤:", error);
      toast.error("套用參數失敗");
    }
  };

  // 刪除歷史記錄（調用 API）
  const deleteHistory = async (id: number) => {
    try {
      await api.delete(`/history/${id}`);
      setHistory(prev => prev.filter(h => h.id !== id));
      toast.success("已刪除");
    } catch (e) {
      console.error("刪除歷史記錄失敗:", e);
      toast.error("刪除失敗");
    }
  };

  // 清空所有歷史（逐一刪除）
  const clearAllHistory = async () => {
    try {
      for (const record of history) {
        await api.delete(`/history/${record.id}`);
      }
      setHistory([]);
      toast.success("已清空歷史記錄");
    } catch (e) {
      console.error("清空歷史記錄失敗:", e);
      toast.error("清空失敗");
    }
  };

  // 點擊外部關閉下拉選單
  useEffect(() => {
    const handleClickOutside = () => setOpenDropdown(null);
    if (openDropdown) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [openDropdown]);

  // 組件卸載時清理 Blob URL
  useEffect(() => {
    return () => {
      if (videoUrl && videoUrl.startsWith("blob:")) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  // 處理圖片上傳
  const handleImageUpload = useCallback(async (sceneIndex: number, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('請上傳圖片檔案');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('圖片大小不能超過 10MB');
      return;
    }

    setUploadingImage(sceneIndex);

    try {
      // 讀取檔案為 Base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const preview = URL.createObjectURL(file);

        setCustomImages(prev => ({
          ...prev,
          [sceneIndex]: { file, preview, base64 }
        }));

        toast.success(`場景 ${sceneIndex + 1} 圖片已上傳`);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('圖片上傳錯誤:', error);
      toast.error('圖片上傳失敗');
    } finally {
      setUploadingImage(null);
    }
  }, []);

  // 移除自訂圖片
  const removeCustomImage = (sceneIndex: number) => {
    setCustomImages(prev => {
      const newImages = { ...prev };
      if (newImages[sceneIndex]?.preview) {
        URL.revokeObjectURL(newImages[sceneIndex].preview);
      }
      delete newImages[sceneIndex];
      return newImages;
    });
    toast.success('已移除自訂圖片');
  };

  // 清理所有自訂圖片
  const clearAllCustomImages = () => {
    Object.values(customImages).forEach(img => {
      if (img.preview) URL.revokeObjectURL(img.preview);
    });
    setCustomImages({});
  };

  // 清理自訂圖片記憶體
  useEffect(() => {
    return () => {
      Object.values(customImages).forEach(img => {
        if (img.preview) URL.revokeObjectURL(img.preview);
      });
    };
  }, []);

  // 套用模板
  const applyTemplate = (templatePrompt: string) => {
    setPrompt(templatePrompt);
    inputRef.current?.focus();
    toast.success("已套用模板");
  };

  // 隨機靈感
  const randomInspiration = () => {
    const random = INSPIRATION_GALLERY[Math.floor(Math.random() * INSPIRATION_GALLERY.length)];
    setPrompt(random.prompt);
    inputRef.current?.focus();
    toast.success("已套用靈感");
  };

  // 生成腳本（調用後端 API）
  const handleGenerateScript = async () => {
    const topic = scriptTopic.trim() || prompt.trim();
    if (!topic) {
      toast.error("請輸入影片主題");
      return;
    }

    setScriptGenerating(true);

    try {
      // 使用模型定義的時長
      const actualDuration = String(currentModel?.durationSec || 8);

      // 調用後端 API
      const response = await api.post("/video/generate", {
        topic,
        platform: "tiktok",
        duration: actualDuration,
        format: aspectRatio,
        goal: selectedGoal,
      });

      // 從回應中提取腳本摘要
      const script = response.data;
      let scriptText = `【${script.title}】\n`;
      scriptText += `${script.description}\n\n`;
      scriptText += `📋 場景規劃 (${script.total_duration}秒):\n`;
      script.scenes.forEach((scene: Scene, idx: number) => {
        scriptText += `\n${idx + 1}. ${scene.scene_type.toUpperCase()} (${scene.duration_seconds}秒)\n`;
        scriptText += `   ${scene.narration_text}\n`;
      });

      setGeneratedScript(scriptText);
      setResult(script);
      toast.success("腳本生成成功！");
      // 即時更新導覽列點數
      refreshCredits();

    } catch (error: any) {
      toast.error(error.response?.data?.detail || "腳本生成失敗");
    } finally {
      setScriptGenerating(false);
    }
  };

  // 應用腳本到輸入框
  const applyScriptToPrompt = () => {
    if (generatedScript) {
      setPrompt(generatedScript);
      setGeneratedScript(null);
      setScriptTopic("");
      inputRef.current?.focus();
      toast.success("已套用腳本");
    }
  };

  // ============================================================
  // Storyboard 低成本預覽功能
  // ============================================================

  // 生成 Storyboard 預覽
  const handleGeneratePreview = async () => {
    if (!result) {
      toast.error("請先生成腳本");
      return;
    }

    setPreviewLoading(true);
    setPreviewProgress(0);
    setShowPreviewMode(true);

    const interval = setInterval(() => {
      setPreviewProgress(prev => prev >= 90 ? prev : prev + Math.random() * 15);
    }, 500);

    try {
      const response = await api.post("/video/preview", {
        script: result,
        voice_id: selectedVoice,
        generate_thumbnails: true,
        generate_audio: true,
        generate_preview_video: false,
      });

      setPreviewProgress(100);
      setStoryboardPreview(response.data);
      setEditedScenes(response.data.scenes);
      setModifiedScenes(new Set()); // 新預覽生成後清除已修改狀態
      setRegeneratingTTS(null);

      // 自動保存縮圖到跨引擎圖庫
      if (response.data.scenes?.length > 0) {
        import("@/lib/services/shared-gallery-service").then(({ sharedGalleryService }) => {
          response.data.scenes.forEach((scene: StoryboardScene, idx: number) => {
            if (scene.thumbnail_base64) {
              sharedGalleryService.addImageFromDataUrl(scene.thumbnail_base64, {
                name: `短影音場景 ${idx + 1}: ${scene.title}`,
                source: "video",
                sourceId: `video-${response.data.project_id}-scene-${idx}`,
                metadata: {
                  projectId: response.data.project_id,
                  sceneIndex: idx,
                  title: scene.title,
                  visual_prompt: scene.visual_prompt,
                },
              }).catch(console.error);
            }
          });
        });
      }

      toast.success("🎬 Storyboard 預覽已生成！", {
        description: `消耗 ${response.data.preview_credits_used} 點，完整渲染預估 ${response.data.estimated_render_credits} 點`,
      });
      // 即時更新導覽列點數
      refreshCredits();

    } catch (error: any) {
      toast.error(error.response?.data?.detail || "預覽生成失敗");
      setShowPreviewMode(false);
    } finally {
      clearInterval(interval);
      setPreviewLoading(false);
    }
  };

  // TTS 語音試聽
  const handlePlayTTS = async (text?: string, sceneIndex?: number) => {
    // 如果正在播放，停止
    if (isPlayingTTS && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlayingTTS(false);
      setPlayingSceneIndex(null);
      return;
    }

    setIsPlayingTTS(true);
    if (sceneIndex !== undefined) setPlayingSceneIndex(sceneIndex);

    try {
      // 檢查是否有預生成的場景音訊（來自低成本預覽）
      const sceneAudioBase64 = sceneIndex !== undefined ? editedScenes[sceneIndex]?.audio_base64 : null;

      if (sceneAudioBase64 && sceneAudioBase64.startsWith('data:audio/')) {
        // 使用預生成的音訊（免費，已在預覽時生成）
        console.log('[TTS] 使用預生成音訊, 長度:', sceneAudioBase64.length);

        // 將 base64 轉換為 Blob，以獲得更好的瀏覽器相容性
        try {
          const base64Data = sceneAudioBase64.split(',')[1];
          const mimeType = sceneAudioBase64.split(';')[0].split(':')[1] || 'audio/mpeg';
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: mimeType });
          const audioUrl = URL.createObjectURL(blob);

          const audio = new Audio(audioUrl);
          audioRef.current = audio;

          audio.onended = () => {
            setIsPlayingTTS(false);
            setPlayingSceneIndex(null);
            URL.revokeObjectURL(audioUrl);
          };

          audio.onerror = (e) => {
            console.error('[TTS] 播放錯誤:', e);
            setIsPlayingTTS(false);
            setPlayingSceneIndex(null);
            URL.revokeObjectURL(audioUrl);
            toast.error("語音播放失敗，嘗試重新生成");
          };

          await audio.play();
          return;
        } catch (decodeError) {
          console.error('[TTS] base64 解碼失敗:', decodeError);
          // 解碼失敗，繼續使用即時生成
        }
      }

      // 沒有預生成音訊或解碼失敗，使用即時生成（免費試聽）
      const sceneNarration = sceneIndex !== undefined ? editedScenes[sceneIndex]?.narration : null;
      const testText = sceneNarration || text || "你好，歡迎使用 King Jam AI 智慧內容創作平台。這是語音試聽範例。";

      console.log('[TTS] 使用即時生成, 文字:', testText.substring(0, 50) + '...');

      const response = await api.post("/video/tts/preview", {
        voice_id: selectedVoice,
        text: testText,
      }, {
        responseType: "blob",
      });

      const audioUrl = URL.createObjectURL(response.data);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlayingTTS(false);
        setPlayingSceneIndex(null);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setIsPlayingTTS(false);
        setPlayingSceneIndex(null);
        URL.revokeObjectURL(audioUrl);
        toast.error("語音播放失敗");
      };

      await audio.play();

    } catch (error: any) {
      console.error('[TTS] 錯誤:', error);
      setIsPlayingTTS(false);
      setPlayingSceneIndex(null);
      toast.error("TTS 試聽失敗: " + (error?.message || "未知錯誤"));
    }
  };

  // 停止 TTS 播放
  const stopTTS = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlayingTTS(false);
    setPlayingSceneIndex(null);
  };

  // 播放背景音樂試聽（通過後端生成）
  const handlePlayMusic = async (track: MusicTrack) => {
    // 如果正在播放，停止
    if (musicAudioRef.current) {
      musicAudioRef.current.pause();
      musicAudioRef.current = null;

      // 如果點擊的是同一首，只停止不重新播放
      if (playingMusicId === track.id) {
        setIsPlayingMusic(false);
        setPlayingMusicId(null);
        return;
      }
    }

    // 無音樂選項
    if (!track.url || track.id === "none") {
      toast.info("已選擇無背景音樂");
      setSelectedMusic(track.id);
      return;
    }

    // 設定選中並開始載入
    setSelectedMusic(track.id);
    setIsPlayingMusic(true);
    setPlayingMusicId(track.id);

    toast.loading(`🎵 載入 ${track.name}...`, { id: "music-preview" });

    try {
      // 通過後端生成預覽音樂
      const response = await api.post("/video/music/preview", {
        style: track.mood,
      }, {
        responseType: "arraybuffer",  // 使用 arraybuffer 而非 blob
        timeout: 20000,
      });

      toast.dismiss("music-preview");

      // 檢查數據
      if (!response.data || response.data.byteLength === 0) {
        throw new Error("音訊數據為空");
      }

      console.log('[Music] 收到音訊:', response.data.byteLength, 'bytes');

      // 轉換為 base64 data URL（更可靠的播放方式）
      const base64 = btoa(
        new Uint8Array(response.data).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      const dataUrl = `data:audio/wav;base64,${base64}`;

      // 創建並播放音頻
      const audio = new Audio(dataUrl);
      audio.volume = musicVolume / 100;
      musicAudioRef.current = audio;

      audio.onended = () => {
        setIsPlayingMusic(false);
        setPlayingMusicId(null);
      };

      audio.onerror = () => {
        console.error('[Music] 音訊播放錯誤');
        setIsPlayingMusic(false);
        setPlayingMusicId(null);
      };

      // 直接播放
      audio.play()
        .then(() => {
          toast.success(`🎵 正在播放: ${track.name}`, { duration: 2000 });
        })
        .catch((e) => {
          console.error('[Music] 播放失敗:', e);
          setIsPlayingMusic(false);
          setPlayingMusicId(null);
          toast.error("播放失敗，請再點一次");
        });

      // 15秒後自動停止
      setTimeout(() => {
        if (musicAudioRef.current) {
          musicAudioRef.current.pause();
          musicAudioRef.current = null;
          setIsPlayingMusic(false);
          setPlayingMusicId(null);
        }
      }, 15000);

    } catch (error: any) {
      console.error('[Music] 試聽錯誤:', error);
      toast.dismiss("music-preview");
      setIsPlayingMusic(false);
      setPlayingMusicId(null);
      toast.error("預覽載入失敗", { duration: 2000 });
    }
  };

  // 停止音樂播放
  const stopMusic = () => {
    if (musicAudioRef.current) {
      musicAudioRef.current.pause();
      musicAudioRef.current = null;
    }
    setIsPlayingMusic(false);
    setPlayingMusicId(null);
  };

  // 處理自訂音樂上傳
  const handleCustomMusicUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 檢查檔案類型
    const allowedTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/m4a'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|aac|m4a)$/i)) {
      toast.error("請上傳有效的音樂檔案（MP3, WAV, OGG, AAC, M4A）");
      return;
    }

    // 檢查檔案大小（最大 20MB）
    if (file.size > 20 * 1024 * 1024) {
      toast.error("音樂檔案不能超過 20MB");
      return;
    }

    // 釋放舊的 URL
    if (customMusicUrl) {
      URL.revokeObjectURL(customMusicUrl);
    }

    // 創建新的 blob URL
    const url = URL.createObjectURL(file);
    setCustomMusicFile(file);
    setCustomMusicUrl(url);
    setCustomMusicName(file.name);
    setSelectedMusic("custom");

    toast.success(`✅ 已上傳音樂：${file.name}`);
  };

  // 播放自訂音樂預覽
  const handlePlayCustomMusic = () => {
    // 如果正在播放，停止
    if (musicAudioRef.current) {
      musicAudioRef.current.pause();
      musicAudioRef.current = null;

      if (playingMusicId === "custom") {
        setIsPlayingMusic(false);
        setPlayingMusicId(null);
        return;
      }
    }

    if (!customMusicUrl) {
      toast.error("請先上傳音樂檔案");
      return;
    }

    setIsPlayingMusic(true);
    setPlayingMusicId("custom");

    const audio = new Audio(customMusicUrl);
    audio.volume = musicVolume / 100;
    musicAudioRef.current = audio;

    audio.onended = () => {
      setIsPlayingMusic(false);
      setPlayingMusicId(null);
    };

    audio.onerror = () => {
      setIsPlayingMusic(false);
      setPlayingMusicId(null);
      toast.error("音樂播放失敗");
    };

    audio.play()
      .then(() => {
        toast.success(`🎵 正在播放: ${customMusicName}`, { duration: 2000 });
      })
      .catch(() => {
        setIsPlayingMusic(false);
        setPlayingMusicId(null);
        toast.error("播放失敗");
      });

    // 15秒後自動停止
    setTimeout(() => {
      if (musicAudioRef.current) {
        musicAudioRef.current.pause();
        musicAudioRef.current = null;
        setIsPlayingMusic(false);
        setPlayingMusicId(null);
      }
    }, 15000);
  };

  // 移除自訂音樂
  const removeCustomMusic = () => {
    if (customMusicUrl) {
      URL.revokeObjectURL(customMusicUrl);
    }
    setCustomMusicFile(null);
    setCustomMusicUrl(null);
    setCustomMusicName("");
    if (selectedMusic === "custom") {
      setSelectedMusic("style-inspiring");
    }
    // 清除 input
    if (customMusicInputRef.current) {
      customMusicInputRef.current.value = "";
    }
    toast.info("已移除自訂音樂");
  };

  // 過濾音樂列表
  const filteredMusic = musicMoodFilter === "all"
    ? MUSIC_LIBRARY
    : MUSIC_LIBRARY.filter(m => m.mood === musicMoodFilter || m.id === "none");

  // 更新場景旁白
  const updateSceneNarration = (sceneIndex: number, newNarration: string) => {
    setEditedScenes(prev => prev.map((scene, idx) =>
      idx === sceneIndex ? { ...scene, narration: newNarration, subtitle_text: newNarration } : scene
    ));
  };

  // 更新場景欄位（通用）
  const updateSceneField = (sceneIndex: number, field: keyof StoryboardScene, value: any) => {
    setEditedScenes(prev => prev.map((scene, idx) => {
      if (idx !== sceneIndex) return scene;

      // 特殊處理：旁白同步到字幕，並標記需要重新生成 TTS
      if (field === 'narration') {
        // 標記該場景已修改旁白
        setModifiedScenes(prev => new Set(prev).add(sceneIndex));
        // 清除舊的音訊，提示用戶需要重新生成
        return { ...scene, narration: value, subtitle_text: value, audio_base64: undefined };
      }

      // 特殊處理：時長變更需要更新字幕時間
      if (field === 'duration_seconds') {
        const newDuration = Math.max(1, Math.min(30, Number(value)));
        return { ...scene, duration_seconds: newDuration };
      }

      return { ...scene, [field]: value };
    }));
  };

  // 重新生成單一場景的 TTS 語音
  const regenerateSceneTTS = async (sceneIndex: number) => {
    const scene = editedScenes[sceneIndex];
    if (!scene?.narration) {
      toast.error("請先輸入旁白文字");
      return;
    }

    setRegeneratingTTS(sceneIndex);

    try {
      // 調用 TTS API 生成語音
      const response = await api.post("/video/tts/preview", {
        voice_id: selectedVoice,
        text: scene.narration,
      }, {
        responseType: "blob",
      });

      // 將 blob 轉換為 base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;

        // 更新場景的音訊
        setEditedScenes(prev => prev.map((s, idx) => {
          if (idx !== sceneIndex) return s;
          return { ...s, audio_base64: base64data };
        }));

        // 從已修改列表中移除
        setModifiedScenes(prev => {
          const newSet = new Set(prev);
          newSet.delete(sceneIndex);
          return newSet;
        });

        setRegeneratingTTS(null);
        toast.success(`場景 ${sceneIndex + 1} 語音已重新生成`);
      };
      reader.readAsDataURL(response.data);

    } catch (error: any) {
      console.error('[TTS Regenerate] 錯誤:', error);
      setRegeneratingTTS(null);
      toast.error("語音重新生成失敗: " + (error?.message || "未知錯誤"));
    }
  };

  // 刪除場景
  const deleteScene = (sceneIndex: number) => {
    if (editedScenes.length <= 1) {
      toast.error("至少需要保留一個場景");
      return;
    }
    setEditedScenes(prev => prev
      .filter((_, idx) => idx !== sceneIndex)
      .map((s, i) => ({ ...s, scene_index: i }))
    );
    setEditingSceneIndex(null);
    toast.success("已刪除場景");
  };

  // 複製場景
  const duplicateScene = (sceneIndex: number) => {
    const sceneToCopy = editedScenes[sceneIndex];
    const newScene: StoryboardScene = {
      ...sceneToCopy,
      scene_index: sceneIndex + 1,
      title: `${sceneToCopy.title} (副本)`,
    };
    setEditedScenes(prev => {
      const newScenes = [...prev];
      newScenes.splice(sceneIndex + 1, 0, newScene);
      return newScenes.map((s, i) => ({ ...s, scene_index: i }));
    });
    toast.success("已複製場景");
  };

  // 場景排序（上移）
  const moveSceneUp = (index: number) => {
    if (index === 0) return;
    setEditedScenes(prev => {
      const newScenes = [...prev];
      [newScenes[index - 1], newScenes[index]] = [newScenes[index], newScenes[index - 1]];
      return newScenes.map((s, i) => ({ ...s, scene_index: i }));
    });
  };

  // 場景排序（下移）
  const moveSceneDown = (index: number) => {
    if (index === editedScenes.length - 1) return;
    setEditedScenes(prev => {
      const newScenes = [...prev];
      [newScenes[index], newScenes[index + 1]] = [newScenes[index + 1], newScenes[index]];
      return newScenes.map((s, i) => ({ ...s, scene_index: i }));
    });
  };

  // 應用字幕預設樣式
  const applySubtitlePreset = (presetId: string) => {
    setSelectedSubtitlePreset(presetId);
    const preset = SUBTITLE_STYLES.find(s => s.id === presetId);
    if (preset && preset.id !== "none") {
      setSubtitleStyle(prev => ({
        ...prev,
        fontSize: preset.fontSize || prev.fontSize,
        fontColor: preset.fontColor || prev.fontColor,
        outlineColor: preset.outlineColor || prev.outlineColor,
        position: preset.position || prev.position,
      }));
    }
  };

  // 計算預覽成本
  const calculatePreviewCost = () => {
    if (!result) return 0;
    const sceneCount = result.scenes.length;
    return (sceneCount * PREVIEW_COST.thumbnail) + (sceneCount * PREVIEW_COST.tts);
  };

  // 將檔案轉換為 base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // 移除 data:audio/xxx;base64, 前綴，只保留 base64 內容
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  // 從預覽進入完整渲染
  const handleRenderFromPreview = async () => {
    if (!storyboardPreview) return;

    // 根據選擇的音樂獲取 music_genre 和 music_url
    let musicGenre = "upbeat";
    let musicUrl: string | null = null;
    let customMusicBase64: string | null = null;

    if (selectedMusic === "custom" && customMusicFile) {
      // 使用自訂音樂
      musicGenre = "custom";
      try {
        customMusicBase64 = await fileToBase64(customMusicFile);
      } catch (e) {
        console.error("[Music] 轉換自訂音樂失敗:", e);
        toast.error("自訂音樂處理失敗，將使用預設音樂");
      }
    } else {
      const selectedMusicTrack = MUSIC_LIBRARY.find(m => m.id === selectedMusic);
      musicGenre = selectedMusicTrack?.mood || "upbeat";
      musicUrl = selectedMusicTrack?.id === "none" ? null : (selectedMusicTrack?.url || null);
    }

    // 更新 result 的場景為編輯後的場景，並加入音樂設定
    const updatedScript = {
      ...result,
      scenes: editedScenes.map((scene, idx) => ({
        scene_number: idx + 1,
        scene_type: scene.title.toLowerCase().replace(/\s/g, '_'),
        duration_seconds: scene.duration_seconds,
        visual_prompt: scene.visual_prompt,
        narration_text: scene.narration,
      })),
      music_genre: musicGenre,
      music_url: musicUrl,
      music_volume: musicVolume / 100,
      tts_voice: selectedVoice,
      subtitle_style: selectedSubtitlePreset !== "none" ? subtitleStyle : null,
      custom_music_base64: customMusicBase64,
      custom_music_name: customMusicFile?.name || null,
    };

    setResult(updatedScript as VideoScript);
    setShowPreviewMode(false);
    setShowModal(true);

    // 自動觸發渲染
    setTimeout(() => {
      handleRender();
    }, 500);
  };

  // 清理預覽狀態
  const closePreviewMode = () => {
    stopTTS();
    setShowPreviewMode(false);
    setStoryboardPreview(null);
    setEditedScenes([]);
    setEditingSceneIndex(null);
    setModifiedScenes(new Set());
    setRegeneratingTTS(null);
  };

  // 生成影片
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("請輸入影片內容描述");
      return;
    }

    setLoading(true);
    setResult(null);
    setVideoUrl(null);
    setOpenDropdown(null);

    try {
      // 使用模型定義的時長
      const actualDuration = String(currentModel?.durationSec || 8);

      const requestData = {
        topic: prompt,
        platform: "tiktok",
        duration: actualDuration,
        format: aspectRatio,
        goal: selectedGoal,
      };

      console.log("[Video] 發送生成請求:", requestData);

      const response = await api.post("/video/generate", requestData);

      console.log("[Video] 生成回應:", response.data);

      setResult(response.data);
      setShowModal(true);
      // 後端已自動建立歷史紀錄，這裡只刷新列表
      loadHistory();
      toast.success("腳本已生成！");
    } catch (error: any) {
      console.error("[Video] 生成錯誤:", error);
      console.error("[Video] 錯誤詳情:", error.response?.data);

      const errorMsg = error.response?.data?.detail || error.message || "生成失敗";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // 渲染影片
  const handleRender = async () => {
    if (!result) return;
    setRendering(true);
    setRenderProgress(0);

    // 刷新佇列狀態以顯示最新等待時間
    loadQueueStatus();

    const interval = setInterval(() => {
      setRenderProgress(prev => prev >= 95 ? prev : prev + Math.random() * 6);
    }, 1500);

    try {
      // 直接使用模型值作為品質參數（後端會識別）
      const quality = model;  // kling, kling-10s, kling-pro, kling-pro-10s, premium, ultra

      // 獲取音樂設定
      let musicGenre = "upbeat";
      let musicUrl: string | null = null;
      let customMusicBase64: string | null = null;
      let customMusicNameForRender: string | null = null;

      // 檢查 result 中是否已有自訂音樂（從 handleRenderFromPreview 傳來）
      if ((result as any).custom_music_base64) {
        musicGenre = "custom";
        customMusicBase64 = (result as any).custom_music_base64;
        customMusicNameForRender = (result as any).custom_music_name;
      } else if (selectedMusic === "custom" && customMusicFile) {
        // 直接從界面選擇的自訂音樂
        musicGenre = "custom";
        try {
          customMusicBase64 = await fileToBase64(customMusicFile);
          customMusicNameForRender = customMusicFile.name;
        } catch (e) {
          console.error("[Music] 轉換自訂音樂失敗:", e);
        }
      } else {
        const selectedMusicTrack = MUSIC_LIBRARY.find(m => m.id === selectedMusic);
        musicGenre = selectedMusicTrack?.mood || "upbeat";
        musicUrl = selectedMusicTrack?.id === "none" ? null : (selectedMusicTrack?.url || null);
      }

      // 使用當前選擇的參數覆蓋腳本中的設定（包含音樂和 TTS）
      const updatedScript = {
        ...result,
        format: aspectRatio,  // 使用當前選擇的比例
        total_duration: currentModel?.durationSec || 8,  // 使用模型定義的時長
        // 音訊設定
        music_genre: musicGenre,
        music_url: musicUrl,
        music_volume: musicVolume / 100,
        tts_voice: selectedVoice,
        subtitle_style: selectedSubtitlePreset !== "none" ? subtitleStyle : null,
        custom_music_base64: customMusicBase64,
        custom_music_name: customMusicNameForRender,
      };

      console.log(`[Video] 渲染參數: 模型=${model}, 品質=${quality}, 比例=${aspectRatio}, 時長=${updatedScript.total_duration}秒`);
      console.log(`[Video] 音樂設定: ${customMusicNameForRender || musicGenre}, 自訂=${!!customMusicBase64}, URL=${musicUrl ? '有' : '無'}, 音量=${musicVolume}%`);

      // 準備自訂圖片資料（僅基礎合成使用）
      const customImagesData = quality === "standard" && Object.keys(customImages).length > 0
        ? Object.entries(customImages).map(([index, img]) => ({
          scene_index: parseInt(index),
          image_base64: img.base64
        }))
        : undefined;

      if (customImagesData && customImagesData.length > 0) {
        console.log(`[Video] 使用 ${customImagesData.length} 張自訂圖片`);
      }

      const response = await api.post("/video/render", {
        project_id: result.project_id,
        script: updatedScript,
        quality,
        custom_images: customImagesData
      });
      setRenderProgress(100);

      if (response.data.video_url) {
        let finalUrl = response.data.video_url;

        // 後端 API 地址
        const API_BASE = "http://localhost:8000";

        // 如果是後端 URL，使用後端地址
        if (finalUrl.startsWith("/video/")) {
          finalUrl = `${API_BASE}${finalUrl}`;
          console.log(`[Video] 使用串流 URL: ${finalUrl}`);
        }
        // 如果是 base64 格式（備用方案），轉換為 Blob URL
        else if (finalUrl.startsWith("data:video")) {
          try {
            const fetchResponse = await fetch(finalUrl);
            const blob = await fetchResponse.blob();
            finalUrl = URL.createObjectURL(blob);
            console.log(`[Video] 已轉換為 Blob URL，大小: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
          } catch (e) {
            console.error("[Video] Blob 轉換失敗:", e);
            toast.error("影片載入失敗，請重試");
            setVideoUrl(null);
            return;
          }
        }

        setVideoUrl(finalUrl);
        toast.success("🎬 影片生成完成！", {
          description: "⚠️ 影片保留 7 天（排程上架 30 天），請及時下載",
          duration: 8000,
        });
        // 即時更新導覽列點數
        refreshCredits();
      }
    } catch (error: any) {
      console.error("[Video] 渲染錯誤:", error);
      toast.error(error.response?.data?.detail || "生成失敗");
    } finally {
      clearInterval(interval);
      setRendering(false);
    }
  };

  const handleClose = () => {
    // 釋放 Blob URL 記憶體
    if (videoUrl && videoUrl.startsWith("blob:")) {
      URL.revokeObjectURL(videoUrl);
      console.log("[Video] 已釋放 Blob URL 記憶體");
    }
    // 清理自訂圖片
    clearAllCustomImages();
    setShowModal(false);
    setResult(null);
    setVideoUrl(null);
    setPrompt("");
  };

  // ============================================================
  // 渲染
  // ============================================================

  // 防止 hydration 錯誤：等待客戶端掛載
  if (!mounted) {
    return (
      <div className="min-h-screen -m-4 lg:-m-6 bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-pink-500 mx-auto mb-4" />
          <p className="text-slate-400">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen -m-4 lg:-m-6 bg-slate-950">

      {/* ==================== Hero 區域 ==================== */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950" />
        <div className="absolute top-20 left-1/4 w-[600px] h-[600px] bg-pink-600/10 rounded-full blur-[180px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-violet-600/8 rounded-full blur-[150px]" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 pt-16 pb-12">

          {/* 版本切換 Tab */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center p-1 rounded-full bg-slate-800/80 border border-slate-700/50 mb-6">
              <button
                onClick={() => setActiveVersion("2.0")}
                className={cn(
                  "relative flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300",
                  activeVersion === "2.0"
                    ? "bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-lg shadow-pink-500/25"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                <Sparkles className="w-3.5 h-3.5" />
                v2.0 引擎
              </button>
              <button
                onClick={() => setActiveVersion("3.0")}
                className={cn(
                  "relative flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300",
                  activeVersion === "3.0"
                    ? "bg-gradient-to-r from-cyan-600 to-blue-500 text-white shadow-lg shadow-cyan-500/25"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                <Zap className="w-3.5 h-3.5" />
                v3.0 引擎
                <span className="flex h-5 items-center rounded-full bg-cyan-400/20 px-2 text-[10px] font-semibold text-cyan-300">
                  開發中
                </span>
              </button>
            </div>

            {activeVersion === "2.0" ? (
              <>
                <h1 className="text-5xl md:text-6xl font-light text-white mb-4 tracking-tight">
                  Create
                  <span className="bg-gradient-to-r from-pink-400 via-rose-400 to-orange-400 bg-clip-text text-transparent"> stunning </span>
                  videos
                </h1>
                <p className="text-lg text-slate-400 max-w-xl mx-auto">
                  輸入創意，AI 自動生成專業級短影音
                </p>
              </>
            ) : (
              <>
                <h1 className="text-5xl md:text-6xl font-light text-white mb-4 tracking-tight">
                  Next-Gen
                  <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent"> AI Video </span>
                  Engine
                </h1>
                <p className="text-lg text-slate-400 max-w-xl mx-auto">
                  全新 3.0 引擎，更強大的 AI 影片生成體驗
                </p>
              </>
            )}
          </div>

          {/* 主輸入區域 - 僅在 v2.0 模式顯示 */}
          {activeVersion === "2.0" && (
            <>
              {/* 主輸入區域 */}
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-pink-600/30 via-rose-600/30 to-orange-600/30 rounded-3xl blur-xl opacity-50" />
                <div className="relative bg-slate-900/95 backdrop-blur-xl rounded-3xl border border-slate-700/50 overflow-hidden shadow-2xl">

                  {/* 快速模板 + 歷史記錄 */}
                  <div className="px-5 py-4 border-b border-slate-800/50">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      <span className="text-xs text-slate-500 shrink-0">快速模板</span>
                      {QUICK_TEMPLATES.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => applyTemplate(template.prompt)}
                          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 hover:border-slate-600 transition-all text-xs text-slate-300 hover:text-white"
                        >
                          <span>{template.icon}</span>
                          <span>{template.label}</span>
                        </button>
                      ))}
                      <button
                        onClick={randomInspiration}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pink-600/10 hover:bg-pink-600/20 border border-pink-500/20 transition-all text-xs text-pink-300"
                      >
                        <Shuffle className="w-3.5 h-3.5" />
                        <span>隨機</span>
                      </button>

                      {/* 歷史記錄按鈕 */}
                      {history.length > 0 && (
                        <button
                          onClick={() => setShowHistory(!showHistory)}
                          className={cn(
                            "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-xs",
                            showHistory
                              ? "bg-cyan-600/20 border-cyan-500/30 text-cyan-300"
                              : "bg-slate-800/60 border-slate-700/50 text-slate-400 hover:text-slate-300"
                          )}
                        >
                          <History className="w-3.5 h-3.5" />
                          <span>歷史 ({history.length})</span>
                        </button>
                      )}
                    </div>

                    {/* 歷史記錄面板 */}
                    {showHistory && history.length > 0 && (
                      <div className="mt-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 max-h-64 overflow-y-auto">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-slate-400 flex items-center gap-1.5">
                            <History className="w-3 h-3" />
                            生成歷史記錄
                          </span>
                          <button
                            onClick={clearAllHistory}
                            className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                            清空
                          </button>
                        </div>
                        <div className="space-y-2">
                          {history.map((record) => {
                            const modelInfo = MODELS.find(m => m.value === record.model);
                            const goalInfo = SCRIPT_GOALS.find(g => g.value === record.goal);
                            return (
                              <div
                                key={record.id}
                                className="group flex items-start gap-3 p-2.5 rounded-lg bg-slate-900/50 hover:bg-slate-800/50 border border-slate-700/30 transition-all"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-slate-300 truncate mb-1">
                                    {record.title || record.prompt.slice(0, 50)}
                                  </p>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                    <span className="flex items-center gap-1">
                                      <Box className="w-3 h-3" />
                                      {modelInfo?.label || record.model}
                                    </span>
                                    <span>{record.aspectRatio}</span>
                                    <span>{record.duration}秒</span>
                                    {goalInfo && <span>{goalInfo.label}</span>}
                                  </div>
                                  <span className="text-[10px] text-slate-600 block mt-1">
                                    {new Date(record.createdAt).toLocaleString("zh-TW", {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit"
                                    })}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      console.log("[RotateCcw] 按鈕被點擊, record:", record.id);
                                      e.preventDefault();
                                      e.stopPropagation();
                                      applyHistory(record);
                                    }}
                                    className="p-2 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-400 transition-colors cursor-pointer"
                                    title="套用參數（可調整後再生成）"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      console.log("[Delete] 按鈕被點擊, record:", record.id);
                                      e.preventDefault();
                                      e.stopPropagation();
                                      deleteHistory(record.id);
                                    }}
                                    className="p-2 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 transition-colors cursor-pointer"
                                    title="刪除此記錄"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <textarea
                    ref={inputRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="描述你想要的影片內容，例如：咖啡店新品上市，營造溫暖療癒的氛圍，突出拿鐵的細膩奶泡..."
                    rows={4}
                    className="w-full px-6 py-5 bg-transparent text-white text-lg placeholder:text-slate-500 focus:outline-none resize-none"
                  />

                  {/* 工具欄 */}
                  <div className="flex flex-wrap items-center gap-2 px-5 py-4 bg-slate-900/50 border-t border-slate-800/50">

                    {/* 模型選擇 - 分組網格 */}
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setOpenDropdown(openDropdown === "model" ? null : "model")}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-sm",
                          openDropdown === "model"
                            ? "bg-cyan-600/20 border-cyan-500/50 text-cyan-300"
                            : "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600"
                        )}
                      >
                        <Box className="w-4 h-4" />
                        <span>{currentModel?.label} {currentModel?.duration}</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      {openDropdown === "model" && (
                        <div className="absolute bottom-full left-0 mb-2 bg-slate-800/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden p-2.5">
                          <div className="flex gap-3">
                            {MODEL_GROUPS.map((group) => (
                              <div key={group.name} className="min-w-[160px]">
                                <div className="flex items-center gap-1 mb-1.5 px-0.5">
                                  <span className="text-[10px] font-semibold text-cyan-400">{group.name}</span>
                                  <span className="text-[9px] text-slate-500">({group.description})</span>
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                  {group.models.map((m) => (
                                    <button
                                      key={m.value}
                                      onClick={() => { setModel(m.value); setOpenDropdown(null); }}
                                      className={cn(
                                        "relative flex flex-col items-center px-2 py-1.5 rounded-md text-[10px] transition-all min-w-[72px]",
                                        model === m.value
                                          ? "bg-cyan-600/30 border border-cyan-500/50 text-cyan-300 shadow-sm"
                                          : "bg-slate-700/40 border border-slate-600/30 text-slate-300 hover:bg-slate-600/50 hover:border-slate-500/50"
                                      )}
                                    >
                                      {m.badge && (
                                        <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-[7px] px-1 py-0 rounded-full font-medium">{m.badge}</span>
                                      )}
                                      <div className="font-semibold text-[11px]">{m.label}</div>
                                      <div className="text-[9px] text-slate-400">{m.duration}</div>
                                      <div className="text-[9px] text-pink-400 font-medium">{m.baseCost}點</div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 比例選擇 */}
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setOpenDropdown(openDropdown === "ratio" ? null : "ratio")}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-sm",
                          "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600"
                        )}
                      >
                        <Monitor className="w-4 h-4" />
                        <span>{aspectRatio}</span>
                      </button>
                      {openDropdown === "ratio" && (
                        <div className="absolute bottom-full left-0 mb-2 w-36 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                          {ASPECT_RATIOS.map((r) => (
                            <button
                              key={r.value}
                              onClick={() => { setAspectRatio(r.value); setOpenDropdown(null); }}
                              className={cn(
                                "w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors",
                                aspectRatio === r.value ? "bg-slate-600/50 text-white" : "text-slate-300 hover:bg-slate-700"
                              )}
                            >
                              <span className="flex items-center gap-2">
                                <span>{r.icon}</span>
                                <span>{r.label}</span>
                              </span>
                              <span className="text-xs text-slate-500">{r.desc}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>


                    <div className="flex-1" />

                    {/* 點數顯示 */}
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-pink-600/10 to-rose-600/10 border border-pink-500/20">
                      <Sparkles className="w-4 h-4 text-pink-400" />
                      <span className="text-sm text-pink-300 font-semibold">{creditCost}</span>
                      <span className="text-xs text-pink-400/60">點</span>
                    </div>

                    {/* 生成按鈕 */}
                    <Button
                      onClick={handleGenerate}
                      disabled={loading || !prompt.trim()}
                      className={cn(
                        "rounded-xl px-6 h-10 transition-all font-medium",
                        loading
                          ? "bg-slate-700"
                          : "bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 shadow-lg shadow-pink-600/30"
                      )}
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4 mr-2" />
                          生成影片
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <p className="text-center text-sm text-slate-600 mt-4">
                  ⌘ + Enter 快速生成 · 支援 TikTok、Reels、Shorts
                </p>

                {/* 佇列狀態顯示 */}
                {queueStatus && (
                  <div className={cn(
                    "mt-4 p-4 rounded-xl border transition-all",
                    queueStatus.system_load === "busy"
                      ? "bg-amber-900/20 border-amber-500/30"
                      : queueStatus.system_load === "high"
                        ? "bg-orange-900/20 border-orange-500/30"
                        : "bg-slate-800/50 border-slate-700/50"
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* 狀態指示燈 */}
                        <div className={cn(
                          "w-2.5 h-2.5 rounded-full animate-pulse",
                          queueStatus.system_load === "busy" ? "bg-amber-400" :
                            queueStatus.system_load === "high" ? "bg-orange-400" :
                              queueStatus.system_load === "medium" ? "bg-blue-400" :
                                "bg-emerald-400"
                        )} />
                        <div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-300">
                              預估等待時間：<span className="font-semibold text-white">{queueStatus.estimated_wait_display}</span>
                            </span>
                          </div>
                          {queueStatus.queue_length > 0 && (
                            <p className="text-xs text-slate-500 mt-0.5 ml-6">
                              前方還有 {queueStatus.queue_length} 個任務排隊中
                            </p>
                          )}
                        </div>
                      </div>

                      {/* 系統負載標籤 */}
                      <Badge className={cn(
                        "text-xs",
                        queueStatus.system_load === "busy"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                          : queueStatus.system_load === "high"
                            ? "bg-orange-500/20 text-orange-300 border-orange-500/30"
                            : queueStatus.system_load === "medium"
                              ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                              : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      )}>
                        {queueStatus.system_load === "busy" ? "系統繁忙" :
                          queueStatus.system_load === "high" ? "負載較高" :
                            queueStatus.system_load === "medium" ? "正常" :
                              "閒置中"}
                      </Badge>
                    </div>

                    {/* 建議訊息 */}
                    {queueStatus.is_busy && queueStatus.suggested_model && (
                      <div className="mt-3 pt-3 border-t border-amber-500/20">
                        <p className="text-xs text-amber-300/80">
                          💡 系統繁忙，建議使用 <button
                            onClick={() => setModel(queueStatus.suggested_model!)}
                            className="underline hover:text-amber-200 transition-colors"
                          >
                            {queueStatus.suggested_model === "kling" ? "Kling 720p 5秒" : queueStatus.suggested_model}
                          </button> 以縮短等待時間
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ==================== v2.0 剩餘內容 ==================== */}
      {activeVersion === "2.0" && (
        <>
          {/* ==================== AI 腳本引擎 ==================== */}
          <section className="py-20 px-6 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/50 to-slate-950" />

            <div className="relative max-w-5xl mx-auto">
              <div className="text-center mb-12">
                <Badge className="bg-gradient-to-r from-cyan-600/20 to-blue-600/20 text-cyan-300 border-cyan-500/20 mb-4">
                  <Wand2 className="w-3 h-3 mr-1.5" />
                  Director Engine
                </Badge>
                <h2 className="text-3xl font-light text-white mb-3">
                  AI 腳本生成引擎
                </h2>
                <p className="text-slate-400">設定目標與風格，AI 自動產生專業腳本結構</p>
              </div>

              <div className="grid lg:grid-cols-5 gap-8">
                {/* 左側：設定區 */}
                <div className="lg:col-span-2 space-y-6">
                  {/* 主題輸入 */}
                  <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800">
                    <label className="text-sm text-slate-400 mb-3 block">影片主題</label>
                    <input
                      type="text"
                      value={scriptTopic}
                      onChange={(e) => setScriptTopic(e.target.value)}
                      placeholder="例如：咖啡店新品上市"
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-pink-500/50 transition-colors"
                    />
                  </div>

                  {/* 目標選擇 */}
                  <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800">
                    <label className="text-sm text-slate-400 mb-3 block">影片目標</label>
                    <div className="grid grid-cols-2 gap-2">
                      {SCRIPT_GOALS.slice(0, 6).map((goal) => {
                        const Icon = goal.icon;
                        return (
                          <button
                            key={goal.value}
                            onClick={() => setSelectedGoal(goal.value)}
                            className={cn(
                              "flex items-center gap-2 p-3 rounded-xl border transition-all text-left",
                              selectedGoal === goal.value
                                ? `bg-gradient-to-r ${goal.color} border-transparent text-white shadow-lg`
                                : "bg-slate-800/30 border-slate-700 text-slate-300 hover:border-slate-600"
                            )}
                          >
                            <Icon className="w-4 h-4" />
                            <span className="text-sm">{goal.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 風格調性 */}
                  <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800">
                    <label className="text-sm text-slate-400 mb-3 block">風格調性</label>
                    <div className="flex flex-wrap gap-2">
                      {TONES.map((tone) => (
                        <button
                          key={tone}
                          onClick={() => setSelectedTone(tone)}
                          className={cn(
                            "px-4 py-2 rounded-xl border text-sm transition-all",
                            selectedTone === tone
                              ? "bg-pink-600 border-pink-500 text-white"
                              : "bg-slate-800/30 border-slate-700 text-slate-300 hover:border-slate-600"
                          )}
                        >
                          {selectedTone === tone && <Check className="w-3 h-3 inline mr-1" />}
                          {tone}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 生成按鈕 */}
                  <Button
                    onClick={handleGenerateScript}
                    disabled={scriptGenerating}
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
                  >
                    {scriptGenerating ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        AI 正在創作...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-5 h-5 mr-2" />
                        生成專業腳本
                      </>
                    )}
                  </Button>
                </div>

                {/* 右側：預覽區 */}
                <div className="lg:col-span-3">
                  <div className="h-full p-6 rounded-2xl bg-slate-900/50 border border-slate-800 flex flex-col min-h-[450px]">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-white flex items-center gap-2">
                        <Film className="w-5 h-5 text-pink-400" />
                        腳本預覽
                      </h3>
                      {generatedScript && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(generatedScript);
                              toast.success("已複製");
                            }}
                            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                          >
                            <Copy className="w-4 h-4 text-slate-400" />
                          </button>
                          <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/20">
                            <Check className="w-3 h-3 mr-1" />
                            已生成
                          </Badge>
                        </div>
                      )}
                    </div>

                    {generatedScript ? (
                      <div className="flex-1 flex flex-col">
                        <div className="flex-1 p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 mb-4 overflow-auto">
                          <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                            {generatedScript}
                          </pre>
                        </div>
                        <div className="flex gap-3">
                          <Button
                            onClick={() => { setGeneratedScript(null); handleGenerateScript(); }}
                            variant="outline"
                            className="flex-1 border-slate-700"
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            重新生成
                          </Button>
                          <Button
                            onClick={applyScriptToPrompt}
                            className="flex-[2] bg-gradient-to-r from-emerald-600 to-teal-600"
                          >
                            <ArrowRight className="w-4 h-4 mr-2" />
                            套用並生成影片
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                        <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mb-4">
                          <Wand2 className="w-8 h-8 text-slate-500" />
                        </div>
                        <h4 className="text-lg text-white font-medium mb-2">準備生成腳本</h4>
                        <p className="text-slate-500 text-sm max-w-xs">
                          設定影片目標與風格，AI 將自動產生包含開場、內容、CTA 的完整腳本
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ==================== 靈感畫廊 ==================== */}
          <section className="py-20 px-6 bg-slate-900/50">
            <div className="max-w-5xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-light text-white">靈感畫廊</h2>
                  <p className="text-slate-500 text-sm mt-1">探索熱門提示詞</p>
                </div>
                <button
                  onClick={randomInspiration}
                  className="text-sm text-pink-400 hover:text-pink-300 flex items-center gap-1.5 transition-colors"
                >
                  <Shuffle className="w-4 h-4" />
                  隨機靈感
                </button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {INSPIRATION_GALLERY.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => applyTemplate(item.prompt)}
                    className="group relative p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-pink-500/30 transition-all text-left"
                  >
                    <Badge className="mb-3 bg-slate-800 text-slate-400 border-slate-700">
                      {item.category}
                    </Badge>
                    <p className="text-sm text-slate-300 leading-relaxed mb-4">{item.prompt}</p>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-xs text-pink-400">
                        <Heart className="w-3 h-3" />
                        {item.likes}
                      </span>
                      <span className="text-xs text-slate-500 group-hover:text-pink-400 transition-colors flex items-center gap-1">
                        使用 <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ==================== 結果彈窗 ==================== */}
          {showModal && result && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
              <div className="relative w-full max-w-5xl max-h-[90vh] overflow-auto bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl animate-in zoom-in-95 duration-300">
                <button
                  onClick={handleClose}
                  className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>

                <div className="flex flex-col lg:flex-row">
                  {/* 左側：預覽 */}
                  <div className="lg:w-1/2 p-8 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
                    <div className="relative w-full max-w-xs aspect-[9/16] rounded-3xl overflow-hidden bg-slate-800 border border-slate-700 shadow-xl">
                      {videoUrl ? (
                        <video
                          src={videoUrl}
                          controls
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            console.error("[Video] 播放錯誤:", e);
                            toast.error("影片載入失敗，請嘗試下載後播放");
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
                          <h3 className="text-lg font-medium text-white text-center mb-2">{result.title}</h3>
                          <p className="text-sm text-slate-500 mb-4">{result.total_duration}秒 · {result.scenes.length}場景</p>

                          <div className="w-full space-y-2 mb-6">
                            {result.scenes.map((scene, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <div className={cn(
                                  "w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-medium",
                                  SCENE_COLORS[scene.scene_type] || "bg-slate-600"
                                )}>
                                  {idx + 1}
                                </div>
                                <div className="flex-1 text-xs text-slate-400 truncate">
                                  {scene.narration_text || `場景 ${idx + 1}`}
                                </div>
                              </div>
                            ))}
                          </div>

                          {rendering && (
                            <div className="w-full space-y-3">
                              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all duration-500"
                                  style={{ width: `${renderProgress}%` }}
                                />
                              </div>
                              <p className="text-center text-xs text-slate-500">
                                AI 創作中 {Math.round(renderProgress)}%
                              </p>
                              {/* 預估等待時間 */}
                              {queueStatus && (
                                <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>預估等待：{queueStatus.estimated_wait_display}</span>
                                  {queueStatus.queue_length > 0 && (
                                    <span className="text-slate-500">
                                      （前方 {queueStatus.queue_length} 任務）
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 mt-6">
                      {videoUrl ? (
                        <>
                          <Button
                            onClick={async () => {
                              const filename = `kingjam-video-${Date.now()}.mp4`;
                              const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

                              // 構建下載 URL
                              let downloadUrl = videoUrl;

                              // 如果是相對路徑，添加 API 基礎 URL
                              if (!videoUrl.startsWith("http")) {
                                downloadUrl = `${API_URL}${videoUrl}`;
                              }

                              // 判斷是否為雲端 URL（需要代理下載）
                              const isCloudUrl = videoUrl.includes("storage.googleapis.com") ||
                                videoUrl.includes("storage.cloud.google.com");

                              if (isCloudUrl) {
                                // 雲端檔案使用代理下載
                                downloadUrl = `${API_URL}/video/download-proxy?url=${encodeURIComponent(videoUrl)}&filename=${encodeURIComponent(filename)}`;
                              }

                              // 使用 <a> 標籤觸發下載（最可靠的方式）
                              const link = document.createElement("a");
                              link.href = downloadUrl;
                              link.download = filename;
                              link.target = "_blank";
                              link.rel = "noopener noreferrer";
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);

                              toast.success("下載已開始", {
                                description: "如果下載未開始，請檢查瀏覽器是否阻擋彈出視窗",
                              });
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            下載影片
                          </Button>
                          {/* 排程上架按鈕 */}
                          <Button
                            onClick={() => {
                              setScheduleContent({
                                type: "short_video",
                                title: result?.title || prompt.slice(0, 50),
                                caption: prompt,
                                media_urls: videoUrl ? [videoUrl] : [],
                                hashtags: [],
                                originalData: result
                              });
                              setShowScheduleDialog(true);
                            }}
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500"
                          >
                            <Clock className="w-4 h-4 mr-2" />
                            排程上架
                          </Button>
                        </>
                      ) : (
                        <div className="flex items-center gap-3">
                          {/* 低成本預覽按鈕 */}
                          <Button
                            onClick={handleGeneratePreview}
                            disabled={rendering || previewLoading}
                            variant="outline"
                            className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
                          >
                            {previewLoading ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Eye className="w-4 h-4 mr-2" />
                            )}
                            低成本預覽
                            <span className="ml-2 px-1.5 py-0.5 rounded bg-cyan-500/20 text-[10px]">
                              {calculatePreviewCost()} 點
                            </span>
                          </Button>

                          {/* 直接渲染按鈕 */}
                          <Button
                            onClick={handleRender}
                            disabled={rendering}
                            className="bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 px-8"
                          >
                            {rendering ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Film className="w-4 h-4 mr-2" />}
                            {rendering ? "生成中..." : "直接渲染"}
                            <span className="ml-2 px-1.5 py-0.5 rounded bg-white/20 text-[10px]">
                              {renderCost} 點
                            </span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 右側：詳情 */}
                  <div className="lg:w-1/2 p-8 space-y-6 border-l border-slate-800">
                    {!videoUrl && !rendering && (
                      <div>
                        <h4 className="text-sm text-slate-400 mb-4 flex items-center gap-2">
                          <Zap className="w-4 h-4" />
                          選擇渲染模型
                          {scriptGenerating && (
                            <span className="flex items-center gap-1 text-xs text-amber-400">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              重新生成腳本中...
                            </span>
                          )}
                        </h4>
                        <div className="space-y-3">
                          {MODEL_GROUPS.map((group) => (
                            <div key={group.name}>
                              <div className="text-xs text-cyan-400 font-medium mb-2">{group.name} <span className="text-slate-500">({group.description})</span></div>
                              <div className="grid grid-cols-2 gap-2">
                                {group.models.map((m) => (
                                  <button
                                    key={m.value}
                                    onClick={() => setModel(m.value)}
                                    disabled={scriptGenerating}
                                    className={cn(
                                      "relative flex items-center gap-3 p-3 rounded-xl border transition-all",
                                      model === m.value
                                        ? "bg-pink-600/10 border-pink-500/50"
                                        : "bg-slate-800/50 border-slate-700 hover:border-slate-600",
                                      scriptGenerating && "opacity-50 cursor-not-allowed",
                                      model === m.value && scriptGenerating && "animate-pulse"
                                    )}
                                  >
                                    {m.badge && (
                                      <span className="absolute -top-1.5 -right-1.5 bg-pink-500 text-white text-[8px] px-1.5 py-0.5 rounded-full">{m.badge}</span>
                                    )}
                                    <div className="flex-1 text-left">
                                      <div className="text-white font-medium text-sm flex items-center gap-2">
                                        {m.label}
                                        {model === m.value && scriptGenerating && (
                                          <Loader2 className="w-3 h-3 animate-spin text-pink-400" />
                                        )}
                                      </div>
                                      <div className="text-[10px] text-slate-500">{m.duration}</div>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-pink-400 font-medium text-sm">{m.baseCost}</span>
                                      <span className="text-[10px] text-slate-500">點</span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        {scriptGenerating && (
                          <p className="text-xs text-amber-400/70 mt-3 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            模型時長不同，正在根據新模型重新生成場景腳本...
                          </p>
                        )}
                      </div>
                    )}

                    {/* 基礎合成的自訂圖片上傳區 */}
                    {model === "standard" && !videoUrl && !rendering && (
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm text-slate-400 flex items-center gap-2">
                            <ImageLucide className="w-4 h-4" />
                            自訂場景圖片
                            <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/20 text-[10px]">
                              可選
                            </Badge>
                          </h4>
                          {Object.keys(customImages).length > 0 && (
                            <button
                              onClick={clearAllCustomImages}
                              className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                            >
                              清空全部
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mb-3">
                          上傳自己的圖片取代 AI 生成，讓影片更符合品牌風格
                        </p>
                        <div className="grid grid-cols-4 gap-2">
                          {result.scenes.map((scene, idx) => (
                            <div key={idx} className="relative group">
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={el => { fileInputRefs.current[idx] = el; }}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImageUpload(idx, file);
                                  e.target.value = '';
                                }}
                              />
                              {customImages[idx] ? (
                                // 已上傳的圖片
                                <div className="relative aspect-[9/16] rounded-lg overflow-hidden border-2 border-emerald-500/50">
                                  <img
                                    src={customImages[idx].preview}
                                    alt={`場景 ${idx + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => fileInputRefs.current[idx]?.click()}
                                      className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                                      title="更換圖片"
                                    >
                                      <RefreshCw className="w-3 h-3 text-white" />
                                    </button>
                                    <button
                                      onClick={() => removeCustomImage(idx)}
                                      className="p-1.5 rounded-full bg-red-500/50 hover:bg-red-500/70 transition-colors"
                                      title="移除"
                                    >
                                      <X className="w-3 h-3 text-white" />
                                    </button>
                                  </div>
                                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                                    <span className="text-[10px] text-white font-medium">場景 {idx + 1}</span>
                                  </div>
                                </div>
                              ) : (
                                // 上傳按鈕
                                <button
                                  onClick={() => fileInputRefs.current[idx]?.click()}
                                  disabled={uploadingImage === idx}
                                  className={cn(
                                    "w-full aspect-[9/16] rounded-lg border-2 border-dashed transition-all flex flex-col items-center justify-center gap-1",
                                    uploadingImage === idx
                                      ? "border-pink-500/50 bg-pink-500/10"
                                      : "border-slate-700 hover:border-slate-500 hover:bg-slate-800/50"
                                  )}
                                >
                                  {uploadingImage === idx ? (
                                    <Loader2 className="w-4 h-4 text-pink-400 animate-spin" />
                                  ) : (
                                    <>
                                      <Plus className="w-4 h-4 text-slate-500" />
                                      <span className="text-[10px] text-slate-500">場景 {idx + 1}</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        {Object.keys(customImages).length > 0 && (
                          <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            已上傳 {Object.keys(customImages).length} 張自訂圖片
                          </p>
                        )}
                      </div>
                    )}

                    <div>
                      <h4 className="text-sm text-slate-400 mb-4 flex items-center gap-2">
                        <Volume2 className="w-4 h-4" />
                        場景腳本
                      </h4>
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                        {result.scenes.map((scene, idx) => (
                          <div key={idx} className="p-4 rounded-xl bg-slate-800/30 border border-slate-800">
                            <div className="flex items-center gap-3 mb-2">
                              <div className={cn(
                                "w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-medium",
                                SCENE_COLORS[scene.scene_type] || "bg-slate-600"
                              )}>
                                {idx + 1}
                              </div>
                              <span className="text-xs text-slate-500">{scene.duration_seconds}秒</span>
                              {customImages[idx] && (
                                <Badge className="bg-emerald-600/20 text-emerald-400 border-0 text-[9px]">
                                  自訂圖片
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-300 leading-relaxed">
                              {scene.narration_text || "（無旁白）"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== Storyboard 低成本預覽面板 ==================== */}
          {showPreviewMode && (
            <div className="fixed inset-0 z-50 flex bg-slate-950 animate-in fade-in duration-300">
              {/* 左側：預覽面板 */}
              <div className="w-2/3 border-r border-slate-800 flex flex-col">
                {/* 標題列 */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={closePreviewMode}
                      className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                    <div>
                      <h2 className="text-lg font-medium text-white flex items-center gap-2">
                        <Eye className="w-5 h-5 text-cyan-400" />
                        Storyboard 預覽
                      </h2>
                      <p className="text-xs text-slate-500">低成本確認模式 · 修改後再渲染</p>
                    </div>
                  </div>

                  {/* 成本對比 */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-slate-500">預覽已使用</p>
                      <p className="text-sm font-medium text-cyan-400">
                        {storyboardPreview?.preview_credits_used || calculatePreviewCost()} 點
                      </p>
                    </div>
                    <div className="w-px h-8 bg-slate-700" />
                    <div className="text-right">
                      <p className="text-xs text-slate-500">完整渲染</p>
                      <p className="text-sm font-medium text-pink-400">
                        {storyboardPreview?.estimated_render_credits || renderCost} 點
                      </p>
                    </div>
                  </div>
                </div>

                {/* 場景時間軸 */}
                <div className="flex-1 overflow-auto p-6">
                  {previewLoading ? (
                    <div className="h-full flex flex-col items-center justify-center">
                      <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                        <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
                      </div>
                      <p className="text-white font-medium mb-2">正在生成 Storyboard 預覽</p>
                      <p className="text-sm text-slate-500 mb-4">生成縮圖與 TTS 語音中...</p>
                      <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                          style={{ width: `${previewProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : storyboardPreview ? (
                    <div className="space-y-4">
                      {/* 標題 */}
                      <div className="text-center mb-6">
                        <h3 className="text-xl font-medium text-white mb-1">{storyboardPreview.title}</h3>
                        <p className="text-sm text-slate-400">{storyboardPreview.description}</p>
                        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-slate-500">
                          <span>{storyboardPreview.total_duration}秒</span>
                          <span>·</span>
                          <span>{editedScenes.length} 場景</span>
                          <span>·</span>
                          <span>{storyboardPreview.format}</span>
                        </div>
                      </div>

                      {/* 場景卡片 */}
                      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {editedScenes.map((scene, idx) => (
                          <div
                            key={scene.scene_index}
                            className={cn(
                              "relative rounded-xl overflow-hidden border-2 transition-all",
                              editingSceneIndex === idx
                                ? "border-cyan-500 shadow-lg shadow-cyan-500/20"
                                : "border-slate-700 hover:border-slate-600"
                            )}
                          >
                            {/* 縮圖 */}
                            <div className="aspect-[9/16] bg-slate-800 relative">
                              {scene.thumbnail_base64 ? (
                                <img
                                  src={scene.thumbnail_base64}
                                  alt={`場景 ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ImageIcon className="w-8 h-8 text-slate-600" />
                                </div>
                              )}

                              {/* 場景序號 */}
                              <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/60 text-white text-xs font-medium">
                                {idx + 1}
                              </div>

                              {/* 時長 */}
                              <div className="absolute top-2 right-2 px-2 py-1 rounded-md bg-black/60 text-white text-xs">
                                {scene.duration_seconds}s
                              </div>

                              {/* 操作按鈕 */}
                              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                                {/* 播放 TTS */}
                                <button
                                  onClick={() => handlePlayTTS(scene.narration, idx)}
                                  disabled={isPlayingTTS && playingSceneIndex !== idx}
                                  className={cn(
                                    "p-2 rounded-lg transition-all",
                                    playingSceneIndex === idx
                                      ? "bg-cyan-500 text-white"
                                      : "bg-black/60 text-white hover:bg-black/80"
                                  )}
                                >
                                  {playingSceneIndex === idx ? (
                                    <Pause className="w-4 h-4" />
                                  ) : (
                                    <Volume2 className="w-4 h-4" />
                                  )}
                                </button>

                                {/* 排序按鈕 */}
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => moveSceneUp(idx)}
                                    disabled={idx === 0}
                                    className="p-1.5 rounded bg-black/60 text-white hover:bg-black/80 disabled:opacity-30"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => moveSceneDown(idx)}
                                    disabled={idx === editedScenes.length - 1}
                                    className="p-1.5 rounded bg-black/60 text-white hover:bg-black/80 disabled:opacity-30"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* 場景資訊與編輯 */}
                            <div className="p-3 bg-slate-900">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-slate-500">{scene.title}</span>
                                <div className="flex items-center gap-1">
                                  {scene.thumbnail_base64 && (
                                    <button
                                      onClick={() => {
                                        setPendingImageForEditor({
                                          imageUrl: scene.thumbnail_base64!,
                                          source: "video",
                                          sourceId: `video-scene-${idx}`,
                                          name: `場景 ${idx + 1}: ${scene.title}`,
                                          metadata: {
                                            sceneIndex: idx,
                                            title: scene.title,
                                            visual_prompt: scene.visual_prompt,
                                            narration: scene.narration,
                                          },
                                        });
                                        router.push("/dashboard/design-studio");
                                        toast.info("正在開啟圖片編輯室...");
                                      }}
                                      className="p-1 rounded hover:bg-indigo-900/50 transition-colors"
                                      title="在圖片編輯室開啟"
                                    >
                                      <Palette className="w-3 h-3 text-indigo-400" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => duplicateScene(idx)}
                                    className="p-1 rounded hover:bg-slate-800 transition-colors"
                                    title="複製場景"
                                  >
                                    <Copy className="w-3 h-3 text-slate-400" />
                                  </button>
                                  <button
                                    onClick={() => deleteScene(idx)}
                                    className="p-1 rounded hover:bg-red-900/50 transition-colors"
                                    title="刪除場景"
                                  >
                                    <Trash2 className="w-3 h-3 text-red-400" />
                                  </button>
                                  <button
                                    onClick={() => setEditingSceneIndex(editingSceneIndex === idx ? null : idx)}
                                    className={cn(
                                      "p-1 rounded transition-colors",
                                      editingSceneIndex === idx
                                        ? "bg-cyan-600 text-white"
                                        : "hover:bg-slate-800 text-slate-400"
                                    )}
                                    title="編輯場景"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              {editingSceneIndex === idx ? (
                                <div className="space-y-3">
                                  {/* 場景標題 */}
                                  <div>
                                    <label className="text-[10px] text-slate-500 block mb-1">場景標題</label>
                                    <input
                                      type="text"
                                      value={scene.title}
                                      onChange={(e) => updateSceneField(idx, 'title', e.target.value)}
                                      className="w-full px-2 py-1.5 text-xs text-white bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-cyan-500"
                                      placeholder="輸入場景標題..."
                                    />
                                  </div>

                                  {/* 時長 */}
                                  <div>
                                    <label className="text-[10px] text-slate-500 block mb-1">時長（秒）</label>
                                    <input
                                      type="number"
                                      min={1}
                                      max={30}
                                      value={scene.duration_seconds}
                                      onChange={(e) => updateSceneField(idx, 'duration_seconds', e.target.value)}
                                      className="w-full px-2 py-1.5 text-xs text-white bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-cyan-500"
                                    />
                                  </div>

                                  {/* 視覺描述 */}
                                  <div>
                                    <label className="text-[10px] text-slate-500 block mb-1">視覺描述 (AI 生成畫面用)</label>
                                    <textarea
                                      value={scene.visual_prompt}
                                      onChange={(e) => updateSceneField(idx, 'visual_prompt', e.target.value)}
                                      className="w-full h-16 px-2 py-1.5 text-xs text-white bg-slate-800 border border-slate-700 rounded-lg resize-none focus:outline-none focus:border-cyan-500"
                                      placeholder="描述這個場景的視覺內容..."
                                    />
                                  </div>

                                  {/* 旁白 */}
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <label className="text-[10px] text-slate-500">旁白文字 (TTS 語音用)</label>
                                      {modifiedScenes.has(idx) && (
                                        <span className="text-[10px] text-amber-400 flex items-center gap-1">
                                          <AlertCircle className="w-3 h-3" />
                                          已修改，需重新生成語音
                                        </span>
                                      )}
                                    </div>
                                    <textarea
                                      value={scene.narration}
                                      onChange={(e) => updateSceneField(idx, 'narration', e.target.value)}
                                      className={cn(
                                        "w-full h-16 px-2 py-1.5 text-xs text-white bg-slate-800 border rounded-lg resize-none focus:outline-none focus:border-cyan-500",
                                        modifiedScenes.has(idx) ? "border-amber-500/50" : "border-slate-700"
                                      )}
                                      placeholder="輸入旁白文字..."
                                    />
                                    {/* 重新生成 TTS 按鈕 */}
                                    <div className="flex items-center gap-2 mt-2">
                                      <button
                                        onClick={() => regenerateSceneTTS(idx)}
                                        disabled={regeneratingTTS !== null || !scene.narration}
                                        className={cn(
                                          "flex-1 py-1.5 text-xs rounded-lg transition-all flex items-center justify-center gap-1.5",
                                          modifiedScenes.has(idx)
                                            ? "bg-amber-600 hover:bg-amber-500 text-white"
                                            : "bg-slate-700 hover:bg-slate-600 text-slate-300"
                                        )}
                                      >
                                        {regeneratingTTS === idx ? (
                                          <>
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            生成中...
                                          </>
                                        ) : (
                                          <>
                                            <RefreshCw className="w-3 h-3" />
                                            {modifiedScenes.has(idx) ? "重新生成語音" : "更新語音"}
                                          </>
                                        )}
                                      </button>
                                      <button
                                        onClick={() => handlePlayTTS(scene.narration, idx)}
                                        disabled={isPlayingTTS || !scene.narration}
                                        className="p-1.5 rounded-lg bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 transition-colors disabled:opacity-50"
                                        title="試聽語音"
                                      >
                                        {playingSceneIndex === idx ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <Volume2 className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    </div>
                                  </div>

                                  {/* 完成編輯按鈕 */}
                                  <button
                                    onClick={() => setEditingSceneIndex(null)}
                                    className="w-full py-1.5 text-xs text-cyan-400 border border-cyan-500/50 rounded-lg hover:bg-cyan-500/10 transition-colors"
                                  >
                                    <Check className="w-3 h-3 inline mr-1" />
                                    完成編輯
                                  </button>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-300 line-clamp-3">
                                  {scene.narration || "（無旁白）"}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center">
                      <AlertCircle className="w-12 h-12 text-slate-500 mb-4" />
                      <p className="text-slate-400">請先生成腳本後再預覽</p>
                    </div>
                  )}
                </div>

                {/* 底部操作列 */}
                {storyboardPreview && (
                  <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>預覽已生成，確認後可進行完整渲染</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        onClick={closePreviewMode}
                        className="border-slate-700"
                      >
                        返回修改
                      </Button>
                      <Button
                        onClick={handleRenderFromPreview}
                        className="bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500"
                      >
                        <Film className="w-4 h-4 mr-2" />
                        確認並渲染影片
                        <span className="ml-2 px-2 py-0.5 rounded bg-white/20 text-xs">
                          {storyboardPreview.estimated_render_credits} 點
                        </span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* 右側：設定面板 */}
              <div className="w-1/3 bg-slate-900 overflow-auto">
                <div className="p-6 space-y-6">
                  {/* TTS 語音設定 */}
                  <div className="rounded-xl border border-slate-800 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-800">
                      <h4 className="text-sm font-medium text-white flex items-center gap-2">
                        <Mic className="w-4 h-4 text-cyan-400" />
                        TTS 語音設定
                      </h4>
                    </div>
                    <div className="p-4 space-y-4">
                      {/* 語言分類 */}
                      {Object.entries(
                        TTS_VOICES.reduce((acc, voice) => {
                          const locale = voice.locale;
                          if (!acc[locale]) acc[locale] = [];
                          acc[locale].push(voice);
                          return acc;
                        }, {} as Record<string, TTSVoice[]>)
                      ).map(([locale, voices]) => (
                        <div key={locale}>
                          <p className="text-xs text-slate-500 mb-2">
                            {locale === "zh-TW" ? "繁體中文" :
                              locale === "zh-CN" ? "簡體中文" :
                                locale === "zh-HK" ? "粵語" :
                                  locale === "en-US" ? "美式英語" :
                                    locale === "en-GB" ? "英式英語" :
                                      locale === "ja-JP" ? "日語" :
                                        locale === "ko-KR" ? "韓語" : locale}
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {voices.map((voice) => (
                              <button
                                key={voice.value}
                                onClick={() => setSelectedVoice(voice.value)}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all text-sm",
                                  selectedVoice === voice.value
                                    ? "bg-cyan-600/20 border-cyan-500/50 text-cyan-300"
                                    : "bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600"
                                )}
                              >
                                <span className={voice.gender === "female" ? "text-pink-400" : "text-blue-400"}>
                                  {voice.gender === "female" ? "♀" : "♂"}
                                </span>
                                <div>
                                  <p className="font-medium">{voice.label}</p>
                                  <p className="text-[10px] text-slate-500">{voice.style}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}

                      {/* 試聽按鈕 */}
                      <Button
                        onClick={() => handlePlayTTS()}
                        disabled={isPlayingTTS}
                        variant="outline"
                        className="w-full border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
                      >
                        {isPlayingTTS ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            播放中...
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-4 h-4 mr-2" />
                            試聽語音
                          </>
                        )}
                      </Button>
                      <p className="text-[10px] text-slate-500 text-center">
                        💡 試聽免費，不扣點數
                      </p>
                    </div>
                  </div>

                  {/* 背景音樂設定 */}
                  <div className="rounded-xl border border-slate-800 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-800">
                      <h4 className="text-sm font-medium text-white flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-amber-400" />
                        背景音樂
                      </h4>
                    </div>
                    <div className="p-4 space-y-4">
                      {/* 自訂音樂上傳 */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            ref={customMusicInputRef}
                            type="file"
                            accept="audio/*,.mp3,.wav,.ogg,.aac,.m4a"
                            onChange={handleCustomMusicUpload}
                            className="hidden"
                            id="custom-music-upload"
                          />
                          <label
                            htmlFor="custom-music-upload"
                            className={cn(
                              "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed cursor-pointer transition-all",
                              customMusicFile
                                ? "border-green-500/50 bg-green-500/10 text-green-300"
                                : "border-slate-600 hover:border-amber-500/50 text-slate-400 hover:text-amber-300"
                            )}
                          >
                            <Upload className="w-4 h-4" />
                            <span className="text-xs">
                              {customMusicFile ? "更換音樂檔案" : "上傳自訂音樂"}
                            </span>
                          </label>
                        </div>

                        {/* 已上傳的自訂音樂 */}
                        {customMusicFile && (
                          <div
                            onClick={() => setSelectedMusic("custom")}
                            className={cn(
                              "flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all",
                              selectedMusic === "custom"
                                ? "bg-green-600/20 border-green-500/50"
                                : "bg-slate-800/50 border-slate-700 hover:border-green-500/30"
                            )}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlayCustomMusic();
                                }}
                                className={cn(
                                  "p-1.5 rounded-md transition-all shrink-0",
                                  playingMusicId === "custom"
                                    ? "bg-green-500 text-white animate-pulse"
                                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                )}
                                title="試聽自訂音樂"
                              >
                                {playingMusicId === "custom" ? (
                                  <Pause className="w-3 h-3" />
                                ) : (
                                  <Play className="w-3 h-3" />
                                )}
                              </button>
                              <div className="min-w-0 flex-1">
                                <p className={cn(
                                  "text-xs font-medium truncate",
                                  selectedMusic === "custom" ? "text-green-300" : "text-slate-300"
                                )}>
                                  🎵 {customMusicName}
                                </p>
                                <p className="text-[10px] text-slate-500 truncate">
                                  自訂上傳 · {(customMusicFile.size / 1024 / 1024).toFixed(1)} MB
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {selectedMusic === "custom" && (
                                <Check className="w-4 h-4 text-green-400 shrink-0" />
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeCustomMusic();
                                }}
                                className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all"
                                title="移除"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <div className="flex-1 h-px bg-slate-700" />
                        <span>或選擇預設音樂</span>
                        <div className="flex-1 h-px bg-slate-700" />
                      </div>

                      {/* 情緒分類篩選 */}
                      <div className="flex flex-wrap gap-1">
                        {MUSIC_MOODS.map((mood) => (
                          <button
                            key={mood.id}
                            onClick={() => setMusicMoodFilter(mood.id)}
                            className={cn(
                              "px-2 py-1 rounded-md text-xs transition-all",
                              musicMoodFilter === mood.id
                                ? "bg-amber-600/30 text-amber-300 border border-amber-500/50"
                                : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-600"
                            )}
                          >
                            {mood.icon} {mood.label}
                          </button>
                        ))}
                      </div>

                      {/* 音樂列表 */}
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {filteredMusic.map((track) => (
                          <div
                            key={track.id}
                            onClick={() => setSelectedMusic(track.id)}
                            className={cn(
                              "flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all",
                              selectedMusic === track.id
                                ? "bg-amber-600/20 border-amber-500/50"
                                : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                            )}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlayMusic(track);
                                }}
                                disabled={track.id === "none"}
                                className={cn(
                                  "p-1.5 rounded-md transition-all shrink-0",
                                  playingMusicId === track.id
                                    ? "bg-amber-500 text-white animate-pulse"
                                    : "bg-slate-700 text-slate-300 hover:bg-slate-600",
                                  track.id === "none" && "opacity-30 cursor-not-allowed"
                                )}
                                title={track.previewUrl ? "點擊試聽" : "渲染時套用"}
                              >
                                {playingMusicId === track.id ? (
                                  <Pause className="w-3 h-3" />
                                ) : (
                                  <Play className="w-3 h-3" />
                                )}
                              </button>
                              <div className="min-w-0 flex-1">
                                <p className={cn(
                                  "text-xs font-medium truncate",
                                  selectedMusic === track.id ? "text-amber-300" : "text-slate-300"
                                )}>
                                  {track.name}
                                </p>
                                <p className="text-[10px] text-slate-500 truncate">
                                  {track.source} · {track.genre} · {track.duration}
                                </p>
                              </div>
                            </div>
                            {selectedMusic === track.id && (
                              <Check className="w-4 h-4 text-amber-400 shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>

                      {/* 音量控制 */}
                      {selectedMusic !== "none" && (
                        <div>
                          <label className="text-xs text-slate-500 mb-2 block">背景音樂音量</label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={musicVolume}
                            onChange={(e) => setMusicVolume(parseInt(e.target.value))}
                            className="w-full accent-amber-500"
                          />
                          <div className="flex justify-between text-[10px] text-slate-500">
                            <span>靜音</span>
                            <span>{musicVolume}%</span>
                            <span>最大</span>
                          </div>
                        </div>
                      )}

                      <p className="text-[10px] text-slate-500">
                        🎵 AI 生成音樂自動配合影片長度，Pixabay 音樂為免費版權
                      </p>
                    </div>
                  </div>

                  {/* 字幕樣式設定 */}
                  <div className="rounded-xl border border-slate-800 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-800">
                      <h4 className="text-sm font-medium text-white flex items-center gap-2">
                        <Type className="w-4 h-4 text-pink-400" />
                        字幕樣式
                      </h4>
                    </div>
                    <div className="p-4 space-y-4">
                      {/* 預設樣式 */}
                      <div className="grid grid-cols-3 gap-2">
                        {SUBTITLE_STYLES.map((style) => (
                          <button
                            key={style.id}
                            onClick={() => applySubtitlePreset(style.id)}
                            className={cn(
                              "px-3 py-2 rounded-lg border text-center transition-all text-xs",
                              selectedSubtitlePreset === style.id
                                ? "bg-pink-600/20 border-pink-500/50 text-pink-300"
                                : "bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600"
                            )}
                          >
                            {style.icon || style.name}
                          </button>
                        ))}
                      </div>

                      {selectedSubtitlePreset !== "none" && (
                        <>
                          {/* 字體大小 */}
                          <div>
                            <label className="text-xs text-slate-500 mb-2 block">字體大小</label>
                            <input
                              type="range"
                              min="32"
                              max="72"
                              value={subtitleStyle.fontSize}
                              onChange={(e) => setSubtitleStyle(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                              className="w-full accent-pink-500"
                            />
                            <div className="flex justify-between text-[10px] text-slate-500">
                              <span>小</span>
                              <span>{subtitleStyle.fontSize}px</span>
                              <span>大</span>
                            </div>
                          </div>

                          {/* 顏色選擇 */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-slate-500 mb-2 block">文字顏色</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={subtitleStyle.fontColor}
                                  onChange={(e) => setSubtitleStyle(prev => ({ ...prev, fontColor: e.target.value }))}
                                  className="w-8 h-8 rounded border border-slate-700 cursor-pointer"
                                />
                                <input
                                  type="text"
                                  value={subtitleStyle.fontColor}
                                  onChange={(e) => setSubtitleStyle(prev => ({ ...prev, fontColor: e.target.value }))}
                                  className="flex-1 px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs text-slate-500 mb-2 block">描邊顏色</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={subtitleStyle.outlineColor}
                                  onChange={(e) => setSubtitleStyle(prev => ({ ...prev, outlineColor: e.target.value }))}
                                  className="w-8 h-8 rounded border border-slate-700 cursor-pointer"
                                />
                                <input
                                  type="text"
                                  value={subtitleStyle.outlineColor}
                                  onChange={(e) => setSubtitleStyle(prev => ({ ...prev, outlineColor: e.target.value }))}
                                  className="flex-1 px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white"
                                />
                              </div>
                            </div>
                          </div>

                          {/* 字幕位置 */}
                          <div>
                            <label className="text-xs text-slate-500 mb-2 block">字幕位置</label>
                            <div className="grid grid-cols-3 gap-2">
                              {(["top", "center", "bottom"] as const).map((pos) => (
                                <button
                                  key={pos}
                                  onClick={() => setSubtitleStyle(prev => ({ ...prev, position: pos }))}
                                  className={cn(
                                    "px-3 py-2 rounded-lg border text-xs transition-all",
                                    subtitleStyle.position === pos
                                      ? "bg-pink-600/20 border-pink-500/50 text-pink-300"
                                      : "bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600"
                                  )}
                                >
                                  {pos === "top" ? "頂部" : pos === "center" ? "中間" : "底部"}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* 字體選擇 */}
                          <div>
                            <label className="text-xs text-slate-500 mb-2 block">字體</label>
                            <div className="grid grid-cols-2 gap-2">
                              {SUBTITLE_FONTS.map((font) => (
                                <button
                                  key={font.value}
                                  onClick={() => setSubtitleStyle(prev => ({ ...prev, fontFamily: font.value }))}
                                  className={cn(
                                    "px-3 py-2 rounded-lg border text-xs transition-all",
                                    subtitleStyle.fontFamily === font.value
                                      ? "bg-pink-600/20 border-pink-500/50 text-pink-300"
                                      : "bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600"
                                  )}
                                  style={{ fontFamily: font.value }}
                                >
                                  {font.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {/* 字幕預覽 */}
                      <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                        <p className="text-[10px] text-slate-500 mb-2">預覽效果</p>
                        <div
                          className="text-center"
                          style={{
                            fontFamily: subtitleStyle.fontFamily,
                            fontSize: `${Math.min(subtitleStyle.fontSize * 0.5, 28)}px`,
                            color: subtitleStyle.fontColor,
                            textShadow: `
                          -${subtitleStyle.outlineWidth}px -${subtitleStyle.outlineWidth}px 0 ${subtitleStyle.outlineColor},
                          ${subtitleStyle.outlineWidth}px -${subtitleStyle.outlineWidth}px 0 ${subtitleStyle.outlineColor},
                          -${subtitleStyle.outlineWidth}px ${subtitleStyle.outlineWidth}px 0 ${subtitleStyle.outlineColor},
                          ${subtitleStyle.outlineWidth}px ${subtitleStyle.outlineWidth}px 0 ${subtitleStyle.outlineColor}
                        `,
                          }}
                        >
                          {selectedSubtitlePreset === "none" ? "（無字幕）" : "這是字幕預覽文字"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 成本說明 */}
                  <div className="rounded-xl border border-slate-800 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-800">
                      <h4 className="text-sm font-medium text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        成本節省說明
                      </h4>
                    </div>
                    <div className="p-4">
                      <div className="space-y-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">傳統方式（直接渲染）</span>
                          <span className="text-red-400 line-through">{storyboardPreview?.estimated_render_credits || renderCost} 點/次</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">低成本預覽</span>
                          <span className="text-cyan-400">{storyboardPreview?.preview_credits_used || calculatePreviewCost()} 點</span>
                        </div>
                        <div className="border-t border-slate-800 pt-3">
                          <p className="text-slate-500">
                            💡 先預覽確認再渲染，避免不滿意重做的浪費。
                            假設修改 3 次：
                          </p>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-center">
                              <p className="text-red-400 font-medium">{(storyboardPreview?.estimated_render_credits || renderCost) * 3} 點</p>
                              <p className="text-[10px] text-slate-500">傳統方式</p>
                            </div>
                            <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-center">
                              <p className="text-emerald-400 font-medium">
                                {(storyboardPreview?.preview_credits_used || calculatePreviewCost()) * 3 + (storyboardPreview?.estimated_render_credits || renderCost)} 點
                              </p>
                              <p className="text-[10px] text-slate-500">低成本預覽</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 操作按鈕區 */}
                  <div className="pt-4 space-y-3">
                    {!storyboardPreview ? (
                      // 尚未生成預覽時的按鈕
                      <Button
                        onClick={handleGeneratePreview}
                        disabled={!result || previewLoading}
                        className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
                      >
                        {previewLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            生成中...
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4 mr-2" />
                            生成低成本預覽
                            <span className="ml-2 px-2 py-0.5 rounded bg-white/20 text-xs">
                              {calculatePreviewCost()} 點
                            </span>
                          </>
                        )}
                      </Button>
                    ) : (
                      // 已生成預覽後的按鈕
                      <>
                        <Button
                          onClick={handleRenderFromPreview}
                          className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500"
                        >
                          <Film className="w-4 h-4 mr-2" />
                          確認並渲染影片
                          <span className="ml-2 px-2 py-0.5 rounded bg-white/20 text-xs">
                            {storyboardPreview.estimated_render_credits} 點
                          </span>
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setStoryboardPreview(null);
                            setEditedScenes([]);
                            setModifiedScenes(new Set());
                            setRegeneratingTTS(null);
                          }}
                          className="w-full border-slate-700 text-slate-300"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          重新生成預覽
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      onClick={closePreviewMode}
                      className="w-full text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4 mr-2" />
                      關閉預覽
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 排程上架對話框 */}
          <ScheduleDialog
            open={showScheduleDialog}
            onClose={() => {
              setShowScheduleDialog(false);
              setScheduleContent(null);
            }}
            content={scheduleContent}
            onSuccess={() => {
              handleClose();
            }}
          />
        </>
      )}

      {activeVersion === "3.0" && (
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 左側：控制面板 */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold text-white flex items-center">
                  <Zap className="w-6 h-6 mr-3 text-cyan-400" />
                  v3.0 引擎 <span className="ml-3 px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-medium">BETA</span>
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setActiveVersion("2.0")} className="text-slate-400 hover:text-white">
                  返回 2.0
                </Button>
              </div>
              <p className="text-slate-400 text-sm">
                全新架構：支援 T2V / I2V / S2V 多模式生成、專業級運鏡與 AI 配音。
              </p>

              {/* === 生成模式 Tabs === */}
              <div className="flex bg-slate-800/80 rounded-xl p-1 gap-1">
                {([
                  { id: "t2v", label: "文字生成", icon: "✍️", desc: "Text to Video" },
                  { id: "i2v", label: "圖片生成", icon: "🖼️", desc: "Image to Video" },
                  { id: "s2v", label: "語音驅動", icon: "🎤", desc: "Speech to Video" },
                  { id: "sadtalker", label: "數字人播報", icon: "👤", desc: "Digital Avatar" },
                ] as const).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setV3Mode(tab.id)}
                    className={`flex-1 flex flex-col items-center py-2.5 px-2 rounded-lg text-xs font-medium transition-all ${v3Mode === tab.id
                      ? "bg-cyan-500/20 text-cyan-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-300 hover:bg-slate-700/50"
                      }`}
                  >
                    <span className="text-base mb-0.5">{tab.icon}</span>
                    <span>{tab.label}</span>
                    <span className="text-[9px] text-slate-600 mt-0.5">{tab.desc}</span>
                  </button>
                ))}
              </div>

              <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50 space-y-4">
                {/* Prompt 區 */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">
                    {v3Mode === "t2v" ? "🎬 影片描述 (Prompt)" : v3Mode === "i2v" ? "🎬 動態描述" : v3Mode === "sadtalker" ? "🎬 播報講稿 (可選)" : "🎬 畫面描述"}
                  </label>
                  <textarea
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors resize-none h-20"
                    placeholder={v3Mode === "t2v" ? "描述你想要的影片內容、風格、氛圍..." : v3Mode === "i2v" ? "描述圖片要如何動起來..." : v3Mode === "sadtalker" ? "在此輸入播報講稿，將用於生成字幕..." : "描述人物在語音驅動下的畫面..."}
                    value={v3Prompt}
                    onChange={(e) => setV3Prompt(e.target.value)}
                  />
                </div>

                {/* I2V 與 SadTalker 模式：參考圖片上傳 */}
                {(v3Mode === "i2v" || v3Mode === "sadtalker") && (
                  <div>
                    <label className="text-xs text-slate-400 block mb-1.5">🖼️ 參考圖片 (Avatar 臉部來源)</label>
                    {v3RefImage ? (
                      <div className="relative bg-slate-900 border border-slate-700 rounded-xl p-2">
                        <img src={v3RefImage.startsWith("/") ? `https://api.kingjam.app${v3RefImage}` : v3RefImage} alt="參考圖" className="w-full h-32 object-contain rounded-lg bg-black" />
                        <button
                          onClick={() => setV3RefImage("")}
                          className="absolute top-3 right-3 bg-red-500/80 hover:bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <p className="text-[10px] text-emerald-400 mt-1.5 text-center">✅ 已上傳</p>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-28 bg-slate-900 border-2 border-dashed border-slate-700 hover:border-cyan-500/50 rounded-xl cursor-pointer transition-colors">
                        <Upload className="w-5 h-5 text-slate-500 mb-1" />
                        <span className="text-xs text-slate-500">點擊或拖放圖片上傳</span>
                        <span className="text-[10px] text-slate-600 mt-0.5">JPG / PNG / WebP</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const formData = new FormData();
                            formData.append("file", file);
                            try {
                              toast.loading("上傳中...", { id: "v3uploadI" });
                              const res = await api.post("/upload/media", formData, { headers: { "Content-Type": "multipart/form-data" } });
                              setV3RefImage(res.data.url);
                              toast.success("圖片上傳成功！", { id: "v3uploadI" });
                            } catch (err: any) {
                              toast.error(`上傳失敗: ${err?.response?.data?.detail || err.message}`, { id: "v3uploadI" });
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                )}

                {/* S2V 與 SadTalker 模式：語音上傳 */}
                {(v3Mode === "s2v" || v3Mode === "sadtalker") && (
                  <div>
                    <label className="text-xs text-slate-400 block mb-1.5">🎤 語音 / 音頻檔案 (驅動口型用)</label>
                    {v3AudioUrl ? (
                      <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 flex items-center gap-3">
                        <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                          <Mic className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm truncate">已上傳音頻</p>
                          <p className="text-[10px] text-emerald-400">✅ 準備就緒</p>
                        </div>
                        <button
                          onClick={() => setV3AudioUrl("")}
                          className="text-slate-500 hover:text-red-400 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-28 bg-slate-900 border-2 border-dashed border-slate-700 hover:border-cyan-500/50 rounded-xl cursor-pointer transition-colors">
                        <Mic className="w-5 h-5 text-slate-500 mb-1" />
                        <span className="text-xs text-slate-500">點擊或拖放音頻上傳</span>
                        <span className="text-[10px] text-slate-600 mt-0.5">MP3 / WAV / OGG / M4A</span>
                        <input
                          type="file"
                          accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/m4a,audio/x-m4a,audio/mp4"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const formData = new FormData();
                            formData.append("file", file);
                            try {
                              toast.loading("上傳中...", { id: "v3uploadA" });
                              const res = await api.post("/upload/media", formData, { headers: { "Content-Type": "multipart/form-data" } });
                              setV3AudioUrl(res.data.url);
                              toast.success("音頻上傳成功！", { id: "v3uploadA" });
                            } catch (err: any) {
                              toast.error(`上傳失敗: ${err?.response?.data?.detail || err.message}`, { id: "v3uploadA" });
                            }
                          }}
                        />
                      </label>
                    )}
                    <p className="text-[10px] text-slate-600 mt-1">AI 將根據音訊驅動角色口型與表情</p>
                  </div>
                )}

                {/* 比例 + 時長 + 場景數 */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1.5">
                      📐 比例
                      {v3Mode === "sadtalker" && <span className="text-cyan-400 ml-1 text-[10px]">(源自圖片)</span>}
                    </label>
                    <div className="flex gap-1">
                      {(["9:16", "16:9", "1:1"] as const).map(r => (
                        <button
                          key={r}
                          onClick={() => setV3AspectRatio(r)}
                          disabled={v3Mode === "sadtalker"}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${v3Mode === "sadtalker"
                            ? "bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700/50"
                            : v3AspectRatio === r
                              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                              : "bg-slate-900 text-slate-500 border border-slate-700 hover:text-slate-300"
                            }`}
                        >
                          <div className="flex flex-col items-center leading-tight">
                            <span className="text-[9px] opacity-60 mb-0.5">
                              {r === "9:16" ? "720x1280" : r === "16:9" ? "1280x720" : "720x720"}
                            </span>
                            <span>
                              {r === "9:16" ? "竪屏" : r === "16:9" ? "橫屏" : "方形"}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1.5">
                      ⏱️ 時長
                      <span className="text-cyan-400 ml-1">
                        {v3Mode === "sadtalker" ? "依語音長度決定" : `${v3Duration}s`}
                      </span>
                    </label>
                    <input
                      type="range" min={10} max={120} step={5}
                      value={v3Duration}
                      onChange={e => setV3Duration(Number(e.target.value))}
                      disabled={v3Mode === "sadtalker"}
                      className={`w-full h-1.5 rounded-lg appearance-none outline-none ${v3Mode === "sadtalker" ? "bg-slate-800 cursor-not-allowed" : "bg-slate-700 cursor-pointer accent-cyan-500"}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1.5">
                      🎞️ 場景
                      <span className="text-cyan-400 ml-1">
                        {v3Mode === "sadtalker" ? "固定 1 鏡到底" : v3ScenesCount}
                      </span>
                    </label>
                    <input
                      type="range" min={2} max={8} step={1}
                      value={v3Mode === "sadtalker" ? 1 : v3ScenesCount}
                      onChange={e => setV3ScenesCount(Number(e.target.value))}
                      disabled={v3Mode === "sadtalker"}
                      className={`w-full h-1.5 rounded-lg appearance-none outline-none ${v3Mode === "sadtalker" ? "bg-slate-800 cursor-not-allowed" : "bg-slate-700 cursor-pointer accent-cyan-500"}`}
                    />
                  </div>
                </div>

                {/* 風格 + 配音 */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-slate-400 block mb-1.5">🎨 風格模板</label>
                    <select
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                      value={v3Style}
                      onChange={(e) => setV3Style(e.target.value)}
                    >
                      <option value="tech_startup">科技新創</option>
                      <option value="corporate">企業形象</option>
                      <option value="cyberpunk">霓虹賽博</option>
                      <option value="food">美食饗宴</option>
                      <option value="travel">旅行探索</option>
                      <option value="fitness">健身動感</option>
                      <option value="fashion">時尚潮流</option>
                      <option value="knowledge">知識解說</option>
                      <option value="retro_film">復古膠片</option>
                      <option value="minimal_bw">極簡黑白</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-slate-400 block mb-1.5">🎙️ AI 配音</label>
                    <select
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                      value={v3Voice}
                      onChange={(e) => setV3Voice(e.target.value)}
                    >
                      <option value="alloy">Alloy (中性)</option>
                      <option value="nova">Nova (女性活力)</option>
                      <option value="echo">Echo (男性穩重)</option>
                      <option value="onyx">Onyx (男性深沉)</option>
                      <option value="shimmer">Shimmer (女性溫柔)</option>
                      <option value="fable">Fable (敘事風)</option>
                    </select>
                  </div>
                </div>

                {/* 進階選項 */}
                <button
                  onClick={() => setV3ShowAdvanced(!v3ShowAdvanced)}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <Settings2 className="w-3 h-3" />
                  進階選項
                  {v3ShowAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {v3ShowAdvanced && (
                  <div className="space-y-3 bg-slate-900/50 rounded-xl p-3 border border-slate-800">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">🚫 負面提示 (Negative Prompt)</label>
                      <input
                        type="text"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                        placeholder="模糊、低品質、變形..."
                        value={v3NegPrompt}
                        onChange={e => setV3NegPrompt(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* 生成按鈕 */}
                <Button
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl py-6 font-medium shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                  onClick={handleV3Generate}
                  disabled={v3Loading || !v3Prompt.trim()}
                >
                  {v3Loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 生成中...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> 開始產生腳本與運鏡</>
                  )}
                </Button>

                {/* 錯誤訊息 */}
                {v3Error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    {v3Error}
                  </div>
                )}

                {/* 可編輯場景列表 */}
                {v3Scenes.length > 0 && (
                  <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-400 font-medium text-sm">
                        <CheckCircle2 className="w-4 h-4" />
                        腳本編輯 · {v3Scenes.length} 場景
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          variant="ghost" size="sm"
                          className="text-slate-400 hover:text-white h-7 px-2 text-xs"
                          onClick={() => { setV3Scenes([]); setV3Result(null); }}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" /> 重新生成
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                      {v3Scenes.map((scene: any, i: number) => (
                        <div key={i} className={`bg-slate-900/60 border rounded-lg p-3 space-y-2 transition-colors ${v3EditingIdx === i ? 'border-cyan-500/50 ring-1 ring-cyan-500/20' : 'border-slate-700/30'
                          }`}>
                          {/* 場景頭部 */}
                          <div className="flex items-center gap-2 text-xs">
                            <select
                              className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-medium uppercase text-xs border-none focus:outline-none cursor-pointer"
                              value={scene.type}
                              onChange={(e) => {
                                const updated = [...v3Scenes];
                                updated[i] = { ...updated[i], type: e.target.value };
                                setV3Scenes(updated);
                              }}
                            >
                              <option value="hook">HOOK</option>
                              <option value="problem">PROBLEM</option>
                              <option value="solution">SOLUTION</option>
                              <option value="benefit">BENEFIT</option>
                              <option value="cta">CTA</option>
                              <option value="story">STORY</option>
                              <option value="demo">DEMO</option>
                            </select>
                            <span className="text-slate-500">場景 {i + 1}</span>
                            <div className="ml-auto flex items-center gap-1">
                              <Button
                                variant="ghost" size="sm"
                                className="h-6 w-6 p-0 text-slate-500 hover:text-cyan-400"
                                onClick={() => setV3EditingIdx(v3EditingIdx === i ? null : i)}
                              >
                                <Edit3 className="w-3 h-3" />
                              </Button>
                              {v3Scenes.length > 2 && (
                                <Button
                                  variant="ghost" size="sm"
                                  className="h-6 w-6 p-0 text-slate-500 hover:text-red-400"
                                  onClick={() => setV3Scenes(v3Scenes.filter((_: any, idx: number) => idx !== i))}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* 展開編輯 or 摺疊預覽 */}
                          {v3EditingIdx === i ? (
                            <div className="space-y-2">
                              {/* 旁白 */}
                              <div>
                                <label className="text-[10px] text-slate-500 block mb-0.5">🎙️ 旁白</label>
                                <textarea
                                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm resize-none h-16 focus:outline-none focus:border-cyan-500"
                                  value={scene.narration}
                                  onChange={(e) => {
                                    const updated = [...v3Scenes];
                                    updated[i] = { ...updated[i], narration: e.target.value };
                                    setV3Scenes(updated);
                                  }}
                                />
                              </div>
                              {/* 視覺提示 */}
                              <div>
                                <label className="text-[10px] text-slate-500 block mb-0.5">📹 Visual Prompt</label>
                                <textarea
                                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-300 text-xs resize-none h-16 focus:outline-none focus:border-cyan-500"
                                  value={scene.visualPrompt}
                                  onChange={(e) => {
                                    const updated = [...v3Scenes];
                                    updated[i] = { ...updated[i], visualPrompt: e.target.value };
                                    setV3Scenes(updated);
                                  }}
                                />
                              </div>
                              {/* 運鏡 + 轉場 */}
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <label className="text-[10px] text-slate-500 block mb-0.5">🎬 運鏡</label>
                                  <select
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-white text-xs focus:outline-none focus:border-cyan-500"
                                    value={scene.cameraMove}
                                    onChange={(e) => {
                                      const updated = [...v3Scenes];
                                      updated[i] = { ...updated[i], cameraMove: e.target.value };
                                      setV3Scenes(updated);
                                    }}
                                  >
                                    <option value="static">Static</option>
                                    <option value="pan-left">Pan Left</option>
                                    <option value="pan-right">Pan Right</option>
                                    <option value="zoom-in">Zoom In</option>
                                    <option value="zoom-out">Zoom Out</option>
                                    <option value="dolly-forward">Dolly Forward</option>
                                    <option value="tilt-up">Tilt Up</option>
                                    <option value="orbit">Orbit</option>
                                  </select>
                                </div>
                                <div className="flex-1">
                                  <label className="text-[10px] text-slate-500 block mb-0.5">↔ 轉場</label>
                                  <select
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-white text-xs focus:outline-none focus:border-cyan-500"
                                    value={scene.transition}
                                    onChange={(e) => {
                                      const updated = [...v3Scenes];
                                      updated[i] = { ...updated[i], transition: e.target.value };
                                      setV3Scenes(updated);
                                    }}
                                  >
                                    <option value="fade">Fade</option>
                                    <option value="slide-left">Slide Left</option>
                                    <option value="slide-right">Slide Right</option>
                                    <option value="zoom-in">Zoom In</option>
                                    <option value="dissolve">Dissolve</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* 摺疊預覽模式 */
                            <div className="cursor-pointer" onClick={() => setV3EditingIdx(i)}>
                              <div className="flex items-center gap-2 text-xs text-slate-600 mb-1">
                                <span>🎬 {scene.cameraMove}</span>
                                <span>↔ {scene.transition}</span>
                                {scene.emotion && <span className="text-purple-400">💭 {scene.emotion}</span>}
                                {scene.videoUrl && (
                                  <a
                                    href={scene.videoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-auto flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Play className="w-3 h-3" /> 已生成
                                  </a>
                                )}
                              </div>
                              <p className="text-white text-sm leading-relaxed">🎙️ {scene.narration}</p>
                              <p className="text-slate-500 text-xs italic mt-1 line-clamp-2">📹 {scene.visualPrompt}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* 新增場景 */}
                    <Button
                      variant="ghost" size="sm"
                      className="w-full border border-dashed border-slate-700 text-slate-500 hover:text-cyan-400 hover:border-cyan-500/50 rounded-lg h-8 text-xs"
                      onClick={() => setV3Scenes([...v3Scenes, {
                        index: v3Scenes.length,
                        type: "story",
                        durationInFrames: 300,
                        narration: "",
                        visualPrompt: "",
                        cameraMove: "static",
                        transition: "fade",
                      }])}
                    >
                      <Plus className="w-3 h-3 mr-1" /> 新增場景
                    </Button>

                    {/* 下一步按鈕 */}
                    {v3VideoProgress && (
                      <div className="flex items-center gap-2 text-xs text-cyan-400 bg-cyan-500/10 rounded-lg px-3 py-2">
                        {v3VideoGenerating && <Loader2 className="w-3 h-3 animate-spin" />}
                        {v3VideoProgress}
                      </div>
                    )}
                    {v3VideoGenerating ? (
                      <div className="flex gap-2 w-full mt-2">
                        <Button
                          className="flex-1 bg-slate-800 text-white border border-slate-700 rounded-xl py-5 font-medium disabled:opacity-50"
                          disabled
                        >
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> 影片生成中...
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          className="bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 border border-red-500/30 rounded-xl py-5 px-6"
                          onClick={handleCancelV3}
                          disabled={isV3Canceling}
                          title="暫停/取消生成"
                        >
                          {isV3Canceling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        className="w-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl py-5 font-medium disabled:opacity-50 mt-2"
                        onClick={handleV3GenerateClips}
                        disabled={v3Scenes.length === 0}
                      >
                        <ArrowRight className="w-4 h-4 mr-2" /> 第 2 步：生成 AI 影片素材
                      </Button>
                    )}

                    {/* 合成最終影片按鈕 */}
                    {v3SynthesisProgress && (
                      <div className="flex items-center gap-2 text-xs text-purple-400 bg-purple-500/10 rounded-lg px-3 py-2 mt-2">
                        {v3Synthesizing && <Loader2 className="w-3 h-3 animate-spin" />}
                        {v3SynthesisProgress}
                      </div>
                    )}
                    {v3Synthesizing ? (
                      <div className="flex gap-2 w-full mt-2">
                        <Button
                          className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 opacity-70 text-white rounded-xl py-5 font-medium shadow-lg shadow-purple-500/20 disabled:opacity-50"
                          disabled
                        >
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> 雲端合成中...
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          className="bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 border border-red-500/30 rounded-xl py-5 px-6"
                          onClick={handleCancelV3}
                          disabled={isV3Canceling}
                          title="暫停/取消合成"
                        >
                          {isV3Canceling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl py-5 font-medium shadow-lg shadow-purple-500/20 disabled:opacity-50 mt-2"
                        onClick={handleV3SynthesizeVideo}
                        disabled={v3Scenes.length === 0 || !v3Scenes.every(s => s.videoUrl)}
                      >
                        <Play className="w-4 h-4 mr-2" /> 第 3 步：合成最終配音與影片
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 右側：Remotion 預覽窗格 */}
            <div className="lg:sticky lg:top-8 h-fit">
              <div className="flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-3xl rounded-[2rem] border border-white/5 p-4 sm:p-8 relative overflow-hidden shadow-2xl min-h-[600px]">
                {/* 裝飾性背景光暈 */}
                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-cyan-500/10 rounded-full blur-[80px]" />
                <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px]" />

                <div className="w-full max-w-[320px] aspect-[9/16] relative group rounded-[1.5rem] overflow-hidden shadow-[0_0_60px_-15px_rgba(0,0,0,0.8)] ring-1 ring-white/10 bg-black isolate my-auto">
                  <div className="absolute inset-0 z-20 pointer-events-none rounded-[1.5rem] ring-inset ring-1 ring-white/10" />

                  {/* 由於目前無法直接跨目錄 import ShortVideo (需設定 Monorepo)，此處先用 Placeholder */}
                  {/* 未來部署時將透過 component={ShortVideo} 載入組件 */}
                  {/* 動態渲染第一個已生成的影片，或是播放清單，若有最終合成影片則優先顯示 */}
                  {v3FinalVideoUrl ? (
                    <div className="w-full h-full flex flex-col relative bg-transparent">
                      <video
                        src={v3FinalVideoUrl}
                        controls
                        autoPlay
                        loop
                        className="w-full h-full object-cover rounded-[1.5rem]"
                      />
                      <div className="absolute top-4 inset-x-4 flex justify-between items-start z-10 pointer-events-none">
                        <div className="bg-gradient-to-r from-purple-600/90 to-indigo-600/90 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-medium text-white shadow-lg shadow-purple-500/30 flex items-center gap-1.5 ring-1 ring-white/20">
                          <Sparkles className="w-3 h-3" /> 最終合成影片
                        </div>
                      </div>
                    </div>
                  ) : v3Scenes.some(s => s.videoUrl) ? (
                    <div className="w-full h-full flex flex-col relative bg-transparent">
                      <video
                        src={v3Scenes.find(s => s.videoUrl)?.videoUrl}
                        controls
                        autoPlay
                        loop
                        className="w-full h-full object-cover rounded-[1.5rem]"
                      />
                      <div className="absolute top-4 inset-x-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide z-10 pointer-events-none">
                        {(v3VideoGenerating || v3Synthesizing) && (
                          <div className="bg-emerald-500/20 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] text-emerald-300 font-medium ring-1 ring-emerald-500/30 flex items-center gap-1.5 shrink-0 animate-pulse">
                            <Loader2 className="w-3 h-3 animate-spin" /> {(v3VideoProgress || v3SynthesisProgress)?.replace('...', '') || '處理中'}
                          </div>
                        )}
                        {v3Scenes.filter(s => s.videoUrl).length > 0 && (
                          <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] text-white/90 ring-1 ring-white/10 shrink-0">
                            目前素材: {v3Scenes.filter(s => s.videoUrl).length} 個片段
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* 預設的未生成 Placeholder UI */
                    <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center relative shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]">
                      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.8)_100%)] z-0" />

                      {/* Grid 網格佈景 */}
                      <div className="absolute inset-0 z-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
                      <div className="absolute inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_20%,transparent_100%)]" />

                      {/* 當正在生成時顯示掃描光束 */}
                      {(v3VideoGenerating || v3Synthesizing) && (
                        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-cyan-500/0 via-cyan-500/10 to-cyan-400/30 z-10 animate-[scan_3s_ease-in-out_infinite_alternate] border-b border-cyan-400/50" />
                      )}

                      {/* Mock Player UI */}
                      <div className={`relative z-20 flex flex-col items-center transition-all duration-700 ${(v3VideoGenerating || v3Synthesizing) ? 'scale-105 opacity-90' : 'group-hover:scale-105'}`}>
                        {/* 發光的播放按鈕 */}
                        <div className="relative">
                          <div className={`absolute -inset-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full blur-xl opacity-20 ${(v3VideoGenerating || v3Synthesizing) ? 'animate-pulse' : 'group-hover:opacity-40'} transition-opacity`} />
                          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center backdrop-blur-xl border border-white/20 mb-6 cursor-pointer hover:bg-white/10 hover:border-white/30 transition-all shadow-2xl relative z-10">
                            {v3VideoGenerating || v3Synthesizing ? (
                              <div className="relative flex items-center justify-center">
                                <div className="absolute w-12 h-12 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
                                <div className="w-8 h-8 rounded-full bg-cyan-500/20 blur-sm animate-pulse" />
                              </div>
                            ) : (
                              <Play className="w-8 h-8 text-white ml-2 opacity-90 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                            )}
                          </div>
                        </div>

                        <span className="text-sm font-semibold text-white tracking-[0.2em] uppercase opacity-90 drop-shadow-md">
                          {v3Synthesizing ? "Synthesizing" : v3VideoGenerating ? "Generating" : "Preview Area"}
                        </span>
                        <span className="text-xs text-slate-400 mt-3 bg-black/50 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/5 font-medium tracking-wide">
                          {v3Synthesizing ? "Rendering final composition..." : v3VideoGenerating ? "AI is rendering your scenes..." : "Video will appear here"}
                        </span>
                      </div>

                      {/* 下方現代化播放條 Mockup */}
                      <div className="absolute bottom-6 inset-x-6 z-20">
                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mb-2 px-1">
                          <span>00:00</span>
                          <span>{v3Scenes.length ? `00:${('0' + (v3Scenes.reduce((acc, s) => acc + parseInt(s.durationInFrames || 150) / 30, 0))).slice(-2)}` : '00:00'}</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden backdrop-blur-sm group-hover:h-2 transition-all cursor-pointer relative">
                          {v3Scenes.length > 0 && !v3VideoGenerating && !v3Synthesizing && (
                            // 畫出場景節點
                            <div className="absolute inset-0 flex">
                              {v3Scenes.map((s, idx) => (
                                <div key={idx} className="h-full border-r border-black/50" style={{ width: `${100 / v3Scenes.length}%` }} />
                              ))}
                            </div>
                          )}

                          <div className={`h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full relative transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(6,182,212,0.5)] ${v3Synthesizing ? 'w-5/6 animate-pulse' : v3VideoGenerating ? 'w-1/3' : 'w-0'}`}>
                            <div className="absolute top-0 bottom-0 right-0 w-8 bg-gradient-to-l from-white/40 to-transparent" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 實際整合時的程式碼範例：
                <Player
                  component={ShortVideo}
                  durationInFrames={450}
                  compositionWidth={1080}
                  compositionHeight={1920}
                  fps={30}
                  style={{ width: "100%", height: "100%" }}
                  controls
                  inputProps={{ ...mockProps }}
                />
                */}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
