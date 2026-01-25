"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Type,
  Palette,
  Sparkles,
  Move,
  Download,
  RotateCcw,
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Upload,
  Image as ImageIcon,
  Scissors,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

// 字型庫
const FONTS = [
  // ===== 繁體中文字型 =====
  // 黑體系列
  { name: "Noto Sans TC", label: "思源黑體", category: "sans-serif" },
  { name: "Zen Kaku Gothic New", label: "禪角黑體", category: "sans-serif" },
  { name: "M PLUS 1p", label: "M+ 黑體", category: "sans-serif" },
  { name: "M PLUS Rounded 1c", label: "M+ 圓體", category: "sans-serif" },
  { name: "Zen Maru Gothic", label: "禪丸黑體", category: "sans-serif" },
  { name: "Kosugi Maru", label: "小杉圓體", category: "sans-serif" },
  { name: "BIZ UDGothic", label: "商用哥德體", category: "sans-serif" },
  // 宋體/明體系列
  { name: "Noto Serif TC", label: "思源宋體", category: "serif" },
  { name: "Zen Old Mincho", label: "禪老明朝", category: "serif" },
  { name: "Shippori Mincho", label: "書鋪明朝", category: "serif" },
  { name: "Zen Antique", label: "禪古典體", category: "serif" },
  { name: "Zen Antique Soft", label: "禪古典柔", category: "serif" },
  // 楷體/書法系列
  { name: "LXGW WenKai TC", label: "霞鶩文楷", category: "handwriting" },
  { name: "Ma Shan Zheng", label: "馬善政楷書", category: "handwriting" },
  { name: "Klee One", label: "克利體", category: "handwriting" },
  { name: "Yuji Syuku", label: "雀酌書法", category: "handwriting" },
  { name: "Yuji Mai", label: "雀舞書法", category: "handwriting" },
  { name: "Yuji Boku", label: "雀墨書法", category: "handwriting" },
  { name: "Kaisei Decol", label: "開成德體", category: "handwriting" },
  { name: "Kaisei Tokumin", label: "開成特明", category: "handwriting" },
  // 手寫/可愛系列
  { name: "Zhi Mang Xing", label: "芝麻星體", category: "handwriting" },
  { name: "Long Cang", label: "龍藏體", category: "handwriting" },
  { name: "Liu Jian Mao Cao", label: "流劍毛草", category: "handwriting" },
  { name: "Hachi Maru Pop", label: "八丸流行", category: "handwriting" },
  { name: "Yusei Magic", label: "遊星魔法", category: "handwriting" },
  { name: "Zen Kurenaido", label: "禪紅體", category: "handwriting" },
  // 創意/展示系列
  { name: "ZCOOL QingKe HuangYou", label: "站酷黃油體", category: "display" },
  { name: "ZCOOL KuaiLe", label: "站酷快樂體", category: "display" },
  { name: "Reggae One", label: "雷鬼體", category: "display" },
  { name: "RocknRoll One", label: "搖滾體", category: "display" },
  { name: "Rampart One", label: "壁壘體", category: "display" },
  { name: "Stick", label: "棒體", category: "display" },
  { name: "DotGothic16", label: "點陣16", category: "display" },
  { name: "Dela Gothic One", label: "德拉黑體", category: "display" },
  { name: "Mochiy Pop One", label: "麻糬流行", category: "display" },
  { name: "Mochiy Pop P One", label: "麻糬流行P", category: "display" },
  { name: "Potta One", label: "波塔體", category: "display" },
  { name: "Train One", label: "列車體", category: "display" },
  // ===== 英文經典 =====
  { name: "Montserrat", label: "Montserrat", category: "sans-serif" },
  { name: "Playfair Display", label: "Playfair", category: "serif" },
  { name: "Bebas Neue", label: "Bebas Neue", category: "display" },
  { name: "Pacifico", label: "Pacifico", category: "handwriting" },
  { name: "Oswald", label: "Oswald", category: "sans-serif" },
  { name: "Dancing Script", label: "Dancing Script", category: "handwriting" },
  // ===== 高級特效字型 =====
  { name: "Bangers", label: "Bangers 漫畫", category: "display" },
  { name: "Cinzel", label: "Cinzel 電影", category: "serif" },
  { name: "Abril Fatface", label: "Abril Fatface", category: "display" },
  { name: "Righteous", label: "Righteous", category: "display" },
  { name: "Permanent Marker", label: "Permanent Marker", category: "handwriting" },
  { name: "Anton", label: "Anton 粗體", category: "sans-serif" },
  { name: "Archivo Black", label: "Archivo Black", category: "sans-serif" },
  { name: "Bungee", label: "Bungee 遊戲", category: "display" },
];

// 特效預設
const TEXT_EFFECTS = [
  { id: "none", label: "無特效", icon: "✨" },
  { id: "shadow", label: "陰影", icon: "🌑" },
  { id: "outline", label: "描邊", icon: "⭕" },
  { id: "glow", label: "發光", icon: "💫" },
  { id: "neon", label: "霓虹", icon: "🌈" },
  { id: "emboss", label: "浮雕", icon: "🗿" },
  { id: "retro", label: "復古", icon: "📺" },
  { id: "gradient", label: "漸層", icon: "🎨" },
  // 高級特效
  { id: "3d", label: "3D立體", icon: "🎲" },
  { id: "metallic", label: "金屬", icon: "🪙" },
  { id: "glass", label: "玻璃", icon: "🔮" },
  { id: "fire", label: "火焰", icon: "🔥" },
  { id: "frost", label: "冰霜", icon: "❄️" },
  { id: "comic", label: "漫畫", icon: "💥" },
  { id: "vintage", label: "懷舊", icon: "📷" },
  { id: "cinematic", label: "電影", icon: "🎬" },
];

// 預設顏色
const PRESET_COLORS = [
  "#FFFFFF", "#000000", "#FF0000", "#FF6600", "#FFCC00", "#00FF00",
  "#00CCFF", "#0066FF", "#9933FF", "#FF3399", "#FF69B4", "#FFD700",
];

// 漸層預設
const GRADIENT_PRESETS = [
  { id: "sunset", label: "日落", colors: ["#FF6B6B", "#FFE66D"] },
  { id: "ocean", label: "海洋", colors: ["#667eea", "#764ba2"] },
  { id: "forest", label: "森林", colors: ["#11998e", "#38ef7d"] },
  { id: "fire", label: "火焰", colors: ["#f12711", "#f5af19"] },
  { id: "purple", label: "紫羅蘭", colors: ["#8E2DE2", "#4A00E0"] },
  { id: "gold", label: "金色", colors: ["#FFD700", "#FFA500"] },
  { id: "silver", label: "銀色", colors: ["#C0C0C0", "#FFFFFF"] },
  { id: "rainbow", label: "彩虹", colors: ["#FF0000", "#FF7F00", "#FFFF00", "#00FF00", "#0000FF", "#8B00FF"] },
];

// 混合模式 (Blend Mode) - 雜誌感文字效果
const BLEND_MODES = [
  { 
    id: "source-over", 
    label: "Normal", 
    desc: "預設模式", 
    icon: "🎨",
    preview: "正常顯示文字"
  },
  { 
    id: "multiply", 
    label: "Multiply", 
    desc: "正片疊底", 
    icon: "🌑",
    preview: "深色文字融入亮背景"
  },
  { 
    id: "screen", 
    label: "Screen", 
    desc: "濾色", 
    icon: "✨",
    preview: "發光文字 / 霓虹燈效果"
  },
  { 
    id: "overlay", 
    label: "Overlay", 
    desc: "疊加", 
    icon: "🎭",
    preview: "增加對比度，質感佳"
  },
  { 
    id: "darken", 
    label: "Darken", 
    desc: "變暗", 
    icon: "🌙",
    preview: "只保留較暗的像素"
  },
  { 
    id: "lighten", 
    label: "Lighten", 
    desc: "變亮", 
    icon: "☀️",
    preview: "只保留較亮的像素"
  },
  { 
    id: "color-dodge", 
    label: "Color Dodge", 
    desc: "顏色加亮", 
    icon: "💫",
    preview: "強烈發光效果"
  },
  { 
    id: "color-burn", 
    label: "Color Burn", 
    desc: "顏色加深", 
    icon: "🔥",
    preview: "深沉濃烈效果"
  },
  { 
    id: "hard-light", 
    label: "Hard Light", 
    desc: "強光", 
    icon: "💡",
    preview: "強烈對比效果"
  },
  { 
    id: "soft-light", 
    label: "Soft Light", 
    desc: "柔光", 
    icon: "🕯️",
    preview: "柔和光線效果"
  },
  { 
    id: "difference", 
    label: "Difference", 
    desc: "差異化", 
    icon: "🔄",
    preview: "反轉色彩效果"
  },
  { 
    id: "exclusion", 
    label: "Exclusion", 
    desc: "排除", 
    icon: "⚡",
    preview: "柔和反轉效果"
  },
];

// 文字風格範本（類似剪映）
const TEXT_STYLE_TEMPLATES = [
  {
    id: "title-bold",
    name: "醒目標題",
    preview: "標題",
    category: "標題",
    style: {
      font: "Noto Sans TC",
      fontSize: 80,
      color: "#FFFFFF",
      bold: true,
      italic: false,
      effect: "shadow",
      effectColor: "#000000",
      effectSize: 6,
      gradientPreset: null,
    }
  },
  {
    id: "title-elegant",
    name: "優雅標題",
    preview: "優雅",
    category: "標題",
    style: {
      font: "Noto Serif TC",
      fontSize: 72,
      color: "#F5F5DC",
      bold: false,
      italic: false,
      effect: "shadow",
      effectColor: "#8B4513",
      effectSize: 4,
      gradientPreset: null,
    }
  },
  {
    id: "neon-pink",
    name: "粉紅霓虹",
    preview: "霓虹",
    category: "霓虹",
    style: {
      font: "ZCOOL KuaiLe",
      fontSize: 64,
      color: "#FF1493",
      bold: true,
      italic: false,
      effect: "neon",
      effectColor: "#FF69B4",
      effectSize: 8,
      gradientPreset: null,
    }
  },
  {
    id: "neon-blue",
    name: "藍色霓虹",
    preview: "電光",
    category: "霓虹",
    style: {
      font: "Bebas Neue",
      fontSize: 72,
      color: "#00FFFF",
      bold: true,
      italic: false,
      effect: "neon",
      effectColor: "#0080FF",
      effectSize: 10,
      gradientPreset: null,
    }
  },
  {
    id: "gold-luxury",
    name: "奢華金字",
    preview: "奢華",
    category: "質感",
    style: {
      font: "Noto Serif TC",
      fontSize: 68,
      color: "#FFD700",
      bold: true,
      italic: false,
      effect: "glow",
      effectColor: "#FFA500",
      effectSize: 6,
      gradientPreset: null,
    }
  },
  {
    id: "outline-white",
    name: "白色描邊",
    preview: "描邊",
    category: "描邊",
    style: {
      font: "Noto Sans TC",
      fontSize: 64,
      color: "#FFFFFF",
      bold: true,
      italic: false,
      effect: "outline",
      effectColor: "#000000",
      effectSize: 4,
      gradientPreset: null,
    }
  },
  {
    id: "outline-colorful",
    name: "彩色描邊",
    preview: "彩色",
    category: "描邊",
    style: {
      font: "ZCOOL QingKe HuangYou",
      fontSize: 64,
      color: "#FFFF00",
      bold: true,
      italic: false,
      effect: "outline",
      effectColor: "#FF0000",
      effectSize: 5,
      gradientPreset: null,
    }
  },
  {
    id: "retro-style",
    name: "復古風格",
    preview: "復古",
    category: "復古",
    style: {
      font: "Oswald",
      fontSize: 72,
      color: "#FFE4B5",
      bold: true,
      italic: false,
      effect: "retro",
      effectColor: "#8B4513",
      effectSize: 4,
      gradientPreset: null,
    }
  },
  {
    id: "gradient-sunset",
    name: "日落漸層",
    preview: "日落",
    category: "漸層",
    style: {
      font: "Montserrat",
      fontSize: 64,
      color: "#FF6B6B",
      bold: true,
      italic: false,
      effect: "gradient",
      effectColor: "#FFE66D",
      effectSize: 0,
      gradientPreset: "sunset",
    }
  },
  {
    id: "gradient-ocean",
    name: "海洋漸層",
    preview: "海洋",
    category: "漸層",
    style: {
      font: "Noto Sans TC",
      fontSize: 64,
      color: "#667eea",
      bold: true,
      italic: false,
      effect: "gradient",
      effectColor: "#764ba2",
      effectSize: 0,
      gradientPreset: "ocean",
    }
  },
  {
    id: "handwrite-casual",
    name: "手寫隨性",
    preview: "手寫",
    category: "手寫",
    style: {
      font: "LXGW WenKai TC",
      fontSize: 56,
      color: "#FFFFFF",
      bold: false,
      italic: false,
      effect: "shadow",
      effectColor: "#333333",
      effectSize: 3,
      gradientPreset: null,
    }
  },
  {
    id: "handwrite-brush",
    name: "毛筆書法",
    preview: "書法",
    category: "手寫",
    style: {
      font: "Ma Shan Zheng",
      fontSize: 72,
      color: "#1A1A1A",
      bold: false,
      italic: false,
      effect: "none",
      effectColor: "#000000",
      effectSize: 0,
      gradientPreset: null,
    }
  },
  {
    id: "cute-pop",
    name: "可愛糖果",
    preview: "可愛",
    category: "可愛",
    style: {
      font: "ZCOOL KuaiLe",
      fontSize: 60,
      color: "#FF69B4",
      bold: true,
      italic: false,
      effect: "outline",
      effectColor: "#FFFFFF",
      effectSize: 4,
      gradientPreset: null,
    }
  },
  {
    id: "cute-bubble",
    name: "泡泡字",
    preview: "泡泡",
    category: "可愛",
    style: {
      font: "ZCOOL QingKe HuangYou",
      fontSize: 64,
      color: "#87CEEB",
      bold: true,
      italic: false,
      effect: "glow",
      effectColor: "#FFFFFF",
      effectSize: 8,
      gradientPreset: null,
    }
  },
  {
    id: "modern-minimal",
    name: "現代極簡",
    preview: "極簡",
    category: "現代",
    style: {
      font: "Montserrat",
      fontSize: 56,
      color: "#FFFFFF",
      bold: false,
      italic: false,
      effect: "none",
      effectColor: "#000000",
      effectSize: 0,
      gradientPreset: null,
    }
  },
  {
    id: "modern-tech",
    name: "科技感",
    preview: "科技",
    category: "現代",
    style: {
      font: "Bebas Neue",
      fontSize: 72,
      color: "#00FF00",
      bold: true,
      italic: false,
      effect: "glow",
      effectColor: "#00FF00",
      effectSize: 6,
      gradientPreset: null,
    }
  },
  {
    id: "fire-hot",
    name: "火焰熱情",
    preview: "火焰",
    category: "特效",
    style: {
      font: "Oswald",
      fontSize: 72,
      color: "#FF4500",
      bold: true,
      italic: false,
      effect: "gradient",
      effectColor: "#FFD700",
      effectSize: 0,
      gradientPreset: "fire",
    }
  },
  {
    id: "ice-cool",
    name: "冰霜冷酷",
    preview: "冰霜",
    category: "特效",
    style: {
      font: "Noto Sans TC",
      fontSize: 64,
      color: "#E0FFFF",
      bold: true,
      italic: false,
      effect: "glow",
      effectColor: "#00CED1",
      effectSize: 8,
      gradientPreset: null,
    }
  },
  // ========== 高級特效範本 ==========
  {
    id: "premium-3d-hero",
    name: "3D 英雄",
    preview: "HERO",
    category: "高級",
    style: {
      font: "Bebas Neue",
      fontSize: 90,
      color: "#FFFFFF",
      bold: true,
      italic: false,
      effect: "3d",
      effectColor: "#333333",
      effectSize: 8,
      gradientPreset: null,
    }
  },
  {
    id: "premium-metallic-gold",
    name: "黃金質感",
    preview: "GOLD",
    category: "高級",
    style: {
      font: "Playfair Display",
      fontSize: 72,
      color: "#FFD700",
      bold: true,
      italic: false,
      effect: "metallic",
      effectColor: "#8B6914",
      effectSize: 3,
      gradientPreset: null,
    }
  },
  {
    id: "premium-glass",
    name: "玻璃透明",
    preview: "GLASS",
    category: "高級",
    style: {
      font: "Montserrat",
      fontSize: 68,
      color: "rgba(255,255,255,0.9)",
      bold: true,
      italic: false,
      effect: "glass",
      effectColor: "#FFFFFF",
      effectSize: 4,
      gradientPreset: null,
    }
  },
  {
    id: "premium-fire-blaze",
    name: "烈焰燃燒",
    preview: "FIRE",
    category: "高級",
    style: {
      font: "Oswald",
      fontSize: 80,
      color: "#FF4500",
      bold: true,
      italic: false,
      effect: "fire",
      effectColor: "#FFD700",
      effectSize: 6,
      gradientPreset: null,
    }
  },
  {
    id: "premium-frost-ice",
    name: "極地冰封",
    preview: "ICE",
    category: "高級",
    style: {
      font: "Noto Sans TC",
      fontSize: 72,
      color: "#B0E0E6",
      bold: true,
      italic: false,
      effect: "frost",
      effectColor: "#00BFFF",
      effectSize: 5,
      gradientPreset: null,
    }
  },
  {
    id: "premium-comic-pop",
    name: "漫畫爆破",
    preview: "POW!",
    category: "高級",
    style: {
      font: "Bangers",
      fontSize: 80,
      color: "#FFFF00",
      bold: true,
      italic: false,
      effect: "comic",
      effectColor: "#FF0000",
      effectSize: 4,
      gradientPreset: null,
    }
  },
  {
    id: "premium-vintage-photo",
    name: "復古相片",
    preview: "1970",
    category: "高級",
    style: {
      font: "Playfair Display",
      fontSize: 64,
      color: "#D4A574",
      bold: false,
      italic: true,
      effect: "vintage",
      effectColor: "#8B4513",
      effectSize: 4,
      gradientPreset: null,
    }
  },
  {
    id: "premium-cinematic-epic",
    name: "電影史詩",
    preview: "EPIC",
    category: "高級",
    style: {
      font: "Cinzel",
      fontSize: 76,
      color: "#F4E4BA",
      bold: true,
      italic: false,
      effect: "cinematic",
      effectColor: "#000000",
      effectSize: 5,
      gradientPreset: null,
    }
  },
  {
    id: "premium-3d-shadow",
    name: "3D 長陰影",
    preview: "DEPTH",
    category: "高級",
    style: {
      font: "Montserrat",
      fontSize: 72,
      color: "#E74C3C",
      bold: true,
      italic: false,
      effect: "3d",
      effectColor: "#C0392B",
      effectSize: 12,
      gradientPreset: null,
    }
  },
  {
    id: "premium-chrome",
    name: "鉻金屬",
    preview: "CHROME",
    category: "高級",
    style: {
      font: "Bebas Neue",
      fontSize: 80,
      color: "#C0C0C0",
      bold: true,
      italic: false,
      effect: "metallic",
      effectColor: "#808080",
      effectSize: 2,
      gradientPreset: null,
    }
  },
  {
    id: "premium-comic-action",
    name: "動作漫畫",
    preview: "BANG!",
    category: "高級",
    style: {
      font: "Bangers",
      fontSize: 88,
      color: "#FF6B6B",
      bold: true,
      italic: false,
      effect: "comic",
      effectColor: "#2C3E50",
      effectSize: 5,
      gradientPreset: null,
    }
  },
  {
    id: "premium-frost-winter",
    name: "冬日冰晶",
    preview: "WINTER",
    category: "高級",
    style: {
      font: "Noto Serif TC",
      fontSize: 68,
      color: "#E0FFFF",
      bold: false,
      italic: false,
      effect: "frost",
      effectColor: "#4169E1",
      effectSize: 6,
      gradientPreset: null,
    }
  },
];

// 範本分類
const TEMPLATE_CATEGORIES = ["全部", "標題", "霓虹", "質感", "描邊", "漸層", "手寫", "可愛", "現代", "特效", "復古", "高級"];

interface TextLayer {
  id: string;
  text: string;
  font: string;
  fontSize: number;
  color: string;
  x: number;
  y: number;
  align: "left" | "center" | "right";
  bold: boolean;
  italic: boolean;
  effect: string;
  effectColor: string;
  effectSize: number;
  gradientPreset: string | null;
  rotation: number;
  opacity: number;
  blendMode: GlobalCompositeOperation; // 混合模式
}

interface ImageTextEditorProps {
  imageUrl?: string;
  onExport?: (dataUrl: string) => void;
  width?: number;
  height?: number;
}

export default function ImageTextEditor({
  imageUrl: initialImageUrl,
  onExport,
  width = 1024,
  height = 1024,
}: ImageTextEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageUrl, setImageUrl] = useState(initialImageUrl || "");
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragLayerId, setDragLayerId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // 文字圖層
  const [layers, setLayers] = useState<TextLayer[]>([
    {
      id: "1",
      text: "標題文字",
      font: "Noto Sans TC",
      fontSize: 72,
      color: "#FFFFFF",
      x: 50,
      y: 50,
      align: "center",
      bold: true,
      italic: false,
      effect: "shadow",
      effectColor: "#000000",
      effectSize: 4,
      gradientPreset: null,
      rotation: 0,
      opacity: 100,
      blendMode: "source-over",
    },
  ]);
  const [activeLayerId, setActiveLayerId] = useState("1");
  const [templateCategory, setTemplateCategory] = useState("全部");

  const activeLayer = layers.find((l) => l.id === activeLayerId);

  // 套用文字風格範本
  const applyTextTemplate = useCallback((templateId: string) => {
    const template = TEXT_STYLE_TEMPLATES.find(t => t.id === templateId);
    if (!template) {
      console.error("找不到範本:", templateId);
      return;
    }
    if (!activeLayerId) {
      console.error("沒有選中的圖層");
      toast.error("請先選擇一個文字圖層");
      return;
    }
    
    console.log("套用範本:", template.name, "到圖層:", activeLayerId);
    
    // 直接更新 layers 狀態，確保即時生效
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id === activeLayerId) {
          return {
            ...l,
            font: template.style.font,
            fontSize: template.style.fontSize,
            color: template.style.color,
            bold: template.style.bold,
            italic: template.style.italic,
            effect: template.style.effect,
            effectColor: template.style.effectColor,
            effectSize: template.style.effectSize,
            gradientPreset: template.style.gradientPreset,
          };
        }
        return l;
      })
    );
    
    toast.success(`已套用「${template.name}」風格`);
  }, [activeLayerId]);

  // 篩選後的範本
  const filteredTemplates = templateCategory === "全部" 
    ? TEXT_STYLE_TEMPLATES 
    : TEXT_STYLE_TEMPLATES.filter(t => t.category === templateCategory);

  // 載入 Google Fonts
  useEffect(() => {
    // 1. 先添加 preconnect 加速連線
    const preconnect1 = document.createElement("link");
    preconnect1.rel = "preconnect";
    preconnect1.href = "https://fonts.googleapis.com";
    preconnect1.id = "google-fonts-preconnect-1";
    
    const preconnect2 = document.createElement("link");
    preconnect2.rel = "preconnect";
    preconnect2.href = "https://fonts.gstatic.com";
    preconnect2.crossOrigin = "anonymous";
    preconnect2.id = "google-fonts-preconnect-2";
    
    if (!document.getElementById("google-fonts-preconnect-1")) {
      document.head.appendChild(preconnect1);
    }
    if (!document.getElementById("google-fonts-preconnect-2")) {
      document.head.appendChild(preconnect2);
    }

    // 2. Google Fonts API v2 格式
    const fontParams = FONTS.map((f) => {
      const fontName = f.name.replace(/ /g, "+");
      // 根據字體類型設定不同權重
      if (f.category === "handwriting" || f.category === "display") {
        return `family=${fontName}`;
      }
      return `family=${fontName}:wght@400;700`;
    }).join("&");
    
    const link = document.createElement("link");
    link.href = `https://fonts.googleapis.com/css2?${fontParams}&display=swap`;
    link.rel = "stylesheet";
    link.id = "image-editor-fonts";
    
    // 避免重複載入
    const existingLink = document.getElementById("image-editor-fonts");
    if (existingLink) {
      existingLink.remove();
    }
    
    document.head.appendChild(link);

    console.log("🔤 開始載入字體...", FONTS.length, "種字體");

    // 使用 FontFaceSet API 檢測字體載入狀態
    link.onload = () => {
      // 等待所有字體實際載入完成
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
          setFontsLoaded(true);
          console.log("✅ 所有字體載入完成！共", FONTS.length, "種");
        });
      } else {
        // 備援方案
        setTimeout(() => setFontsLoaded(true), 1000);
      }
    };

    link.onerror = () => {
      console.error("❌ 字體載入失敗，使用系統預設字體");
      setFontsLoaded(true); // 仍然允許使用，只是會降級到系統字體
    };

    return () => {
      const linkToRemove = document.getElementById("image-editor-fonts");
      if (linkToRemove) {
        linkToRemove.remove();
      }
    };
  }, []);

  // 載入圖片
  useEffect(() => {
    if (!imageUrl) {
      setLoadedImage(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setLoadedImage(img);
    };
    img.onerror = () => {
      toast.error("圖片載入失敗");
      setLoadedImage(null);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // 繪製 Canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 清空畫布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 繪製背景圖片或預設背景
    if (loadedImage) {
      // 計算等比例縮放
      const scale = Math.min(
        canvas.width / loadedImage.width,
        canvas.height / loadedImage.height
      );
      const x = (canvas.width - loadedImage.width * scale) / 2;
      const y = (canvas.height - loadedImage.height * scale) / 2;
      ctx.drawImage(
        loadedImage,
        x,
        y,
        loadedImage.width * scale,
        loadedImage.height * scale
      );
    } else {
      // 預設漸層背景
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, "#1a1a2e");
      gradient.addColorStop(0.5, "#16213e");
      gradient.addColorStop(1, "#0f3460");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 網格提示
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= canvas.width; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i <= canvas.height; i += 50) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
      }
    }

    // 繪製多行文字的輔助函數
    const drawMultilineText = (
      text: string,
      baseX: number,
      baseY: number,
      lineHeight: number,
      method: "fill" | "stroke" = "fill"
    ) => {
      const lines = text.split("\n");
      const totalHeight = (lines.length - 1) * lineHeight;
      const startY = baseY - totalHeight / 2;
      
      lines.forEach((line, idx) => {
        const lineY = startY + idx * lineHeight;
        if (method === "fill") {
          ctx.fillText(line, baseX, lineY);
        } else {
          ctx.strokeText(line, baseX, lineY);
        }
      });
    };

    // 計算多行文字的最大寬度
    const getMultilineWidth = (text: string) => {
      const lines = text.split("\n");
      return Math.max(...lines.map(line => ctx.measureText(line).width));
    };

    // 繪製每個文字圖層
    layers.forEach((layer) => {
      ctx.save();

      // 位置轉換（百分比 -> 像素）
      const x = (layer.x / 100) * canvas.width;
      const y = (layer.y / 100) * canvas.height;
      const lineHeight = layer.fontSize * 1.3; // 行高為字體大小的 1.3 倍

      // 旋轉
      ctx.translate(x, y);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.translate(-x, -y);

      // 透明度
      ctx.globalAlpha = layer.opacity / 100;
      
      // 混合模式 (Blend Mode) - 雜誌感效果
      ctx.globalCompositeOperation = layer.blendMode || "source-over";

      // 字型設定
      const fontStyle = `${layer.italic ? "italic" : ""} ${layer.bold ? "bold" : ""} ${layer.fontSize}px "${layer.font}", sans-serif`;
      ctx.font = fontStyle;
      ctx.textAlign = layer.align;
      ctx.textBaseline = "middle";

      // 特效處理
      switch (layer.effect) {
        case "shadow":
          ctx.shadowColor = layer.effectColor;
          ctx.shadowBlur = layer.effectSize * 2;
          ctx.shadowOffsetX = layer.effectSize;
          ctx.shadowOffsetY = layer.effectSize;
          break;
        case "glow":
          ctx.shadowColor = layer.effectColor;
          ctx.shadowBlur = layer.effectSize * 4;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          break;
        case "neon":
          // 多層發光
          for (let i = 3; i >= 1; i--) {
            ctx.shadowColor = layer.effectColor;
            ctx.shadowBlur = layer.effectSize * i * 3;
            ctx.fillStyle = layer.effectColor;
            drawMultilineText(layer.text, x, y, lineHeight);
          }
          ctx.shadowBlur = 0;
          break;
        case "emboss":
          // 浮雕效果
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          drawMultilineText(layer.text, x - 2, y - 2, lineHeight);
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          drawMultilineText(layer.text, x + 2, y + 2, lineHeight);
          break;
        case "retro":
          // 復古多層陰影
          const retroColors = ["#FF6B6B", "#4ECDC4", "#45B7D1"];
          retroColors.forEach((color, i) => {
            ctx.fillStyle = color;
            drawMultilineText(layer.text, x + (i + 1) * 3, y + (i + 1) * 3, lineHeight);
          });
          break;
        case "outline":
          ctx.strokeStyle = layer.effectColor;
          ctx.lineWidth = layer.effectSize;
          ctx.lineJoin = "round";
          ctx.miterLimit = 2;
          drawMultilineText(layer.text, x, y, lineHeight, "stroke");
          break;
        
        // ===== 高級特效 =====
        case "3d":
          // 3D 立體效果 - 多層堆疊產生深度
          const depth3d = layer.effectSize;
          for (let i = depth3d; i > 0; i--) {
            const shade = Math.floor(60 + (i / depth3d) * 40);
            ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
            drawMultilineText(layer.text, x + i, y + i, lineHeight);
          }
          // 頂層高光
          ctx.fillStyle = "#FFFFFF";
          drawMultilineText(layer.text, x - 1, y - 1, lineHeight);
          break;
        
        case "metallic":
          // 金屬質感 - 漸層 + 反光線
          const metallicGradient = ctx.createLinearGradient(
            x, y - layer.fontSize / 2, x, y + layer.fontSize / 2
          );
          metallicGradient.addColorStop(0, "#D4AF37");
          metallicGradient.addColorStop(0.3, "#FFE766");
          metallicGradient.addColorStop(0.5, "#FFFFFF");
          metallicGradient.addColorStop(0.7, "#FFE766");
          metallicGradient.addColorStop(1, "#B8860B");
          ctx.fillStyle = metallicGradient;
          // 金屬邊框
          ctx.strokeStyle = "#8B6914";
          ctx.lineWidth = 2;
          ctx.lineJoin = "round";
          drawMultilineText(layer.text, x, y, lineHeight, "stroke");
          break;
        
        case "glass":
          // 玻璃效果 - 半透明 + 反光
          ctx.shadowColor = "rgba(255, 255, 255, 0.5)";
          ctx.shadowBlur = 10;
          ctx.shadowOffsetX = -2;
          ctx.shadowOffsetY = -2;
          // 內部高光
          const glassGradient = ctx.createLinearGradient(
            x, y - layer.fontSize / 2, x, y + layer.fontSize / 2
          );
          glassGradient.addColorStop(0, "rgba(255, 255, 255, 0.8)");
          glassGradient.addColorStop(0.5, "rgba(255, 255, 255, 0.2)");
          glassGradient.addColorStop(1, "rgba(255, 255, 255, 0.6)");
          ctx.fillStyle = glassGradient;
          break;
        
        case "fire":
          // 火焰效果 - 多層發光 + 漸層
          for (let i = 4; i >= 1; i--) {
            ctx.shadowColor = i > 2 ? "#FF4500" : "#FFD700";
            ctx.shadowBlur = layer.effectSize * i * 2;
            ctx.fillStyle = i > 2 ? "#FF6347" : "#FFA500";
            drawMultilineText(layer.text, x, y - i * 2, lineHeight);
          }
          ctx.shadowBlur = 0;
          // 火焰漸層
          const fireGradient = ctx.createLinearGradient(
            x, y + layer.fontSize / 2, x, y - layer.fontSize / 2
          );
          fireGradient.addColorStop(0, "#FF0000");
          fireGradient.addColorStop(0.5, "#FF6600");
          fireGradient.addColorStop(1, "#FFFF00");
          ctx.fillStyle = fireGradient;
          break;
        
        case "frost":
          // 冰霜效果 - 藍色發光 + 結晶感
          ctx.shadowColor = "#00BFFF";
          ctx.shadowBlur = layer.effectSize * 3;
          // 外層冰霜
          ctx.strokeStyle = "rgba(200, 240, 255, 0.8)";
          ctx.lineWidth = layer.effectSize;
          ctx.lineJoin = "round";
          drawMultilineText(layer.text, x, y, lineHeight, "stroke");
          // 冰霜漸層
          const frostGradient = ctx.createLinearGradient(
            x, y - layer.fontSize / 2, x, y + layer.fontSize / 2
          );
          frostGradient.addColorStop(0, "#E0FFFF");
          frostGradient.addColorStop(0.5, "#87CEEB");
          frostGradient.addColorStop(1, "#B0E0E6");
          ctx.fillStyle = frostGradient;
          break;
        
        case "comic":
          // 漫畫風格 - 粗描邊 + 半調網點效果
          // 黃色爆炸背景暗示（可選）
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = layer.effectSize + 4;
          ctx.lineJoin = "round";
          drawMultilineText(layer.text, x, y, lineHeight, "stroke");
          // 白色內描邊
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = layer.effectSize + 2;
          drawMultilineText(layer.text, x, y, lineHeight, "stroke");
          // 彩色描邊
          ctx.strokeStyle = layer.effectColor;
          ctx.lineWidth = layer.effectSize;
          drawMultilineText(layer.text, x, y, lineHeight, "stroke");
          break;
        
        case "vintage":
          // 懷舊照片風格 - 褪色 + 噪點感
          ctx.shadowColor = "rgba(139, 69, 19, 0.6)";
          ctx.shadowBlur = layer.effectSize * 2;
          ctx.shadowOffsetX = 3;
          ctx.shadowOffsetY = 3;
          // 褪色效果
          const vintageGradient = ctx.createLinearGradient(
            x - 100, y, x + 100, y
          );
          vintageGradient.addColorStop(0, "#D4A574");
          vintageGradient.addColorStop(0.5, "#E8D4B8");
          vintageGradient.addColorStop(1, "#C9A86C");
          ctx.fillStyle = vintageGradient;
          break;
        
        case "cinematic":
          // 電影風格 - 寬銀幕感 + 暗角
          // 底層陰影
          ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
          ctx.shadowBlur = layer.effectSize * 3;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 4;
          // 電影金色漸層
          const cinematicGradient = ctx.createLinearGradient(
            x, y - layer.fontSize / 2, x, y + layer.fontSize / 2
          );
          cinematicGradient.addColorStop(0, "#F4E4BA");
          cinematicGradient.addColorStop(0.5, "#FFFFFF");
          cinematicGradient.addColorStop(1, "#D4AF37");
          ctx.fillStyle = cinematicGradient;
          // 細緻邊框
          ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
          ctx.lineWidth = 1;
          drawMultilineText(layer.text, x, y, lineHeight, "stroke");
          break;
      }

      // 填充文字（漸層或純色）
      if (layer.effect === "gradient" && layer.gradientPreset) {
        const preset = GRADIENT_PRESETS.find((p) => p.id === layer.gradientPreset);
        if (preset) {
          const textWidth = getMultilineWidth(layer.text);
          const lines = layer.text.split("\n");
          const totalHeight = lines.length * lineHeight;
          const gradient = ctx.createLinearGradient(
            x - textWidth / 2,
            y - totalHeight / 2,
            x + textWidth / 2,
            y + totalHeight / 2
          );
          preset.colors.forEach((color, i) => {
            gradient.addColorStop(i / (preset.colors.length - 1), color);
          });
          ctx.fillStyle = gradient;
        } else {
          ctx.fillStyle = layer.color;
        }
      } else {
        ctx.fillStyle = layer.color;
      }

      drawMultilineText(layer.text, x, y, lineHeight);

      // 選中狀態標記
      if (layer.id === activeLayerId) {
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#00BFFF";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        const textWidth = getMultilineWidth(layer.text);
        const lines = layer.text.split("\n");
        const totalHeight = lines.length * lineHeight;
        let boxX = x - textWidth / 2;
        if (layer.align === "left") boxX = x;
        if (layer.align === "right") boxX = x - textWidth;
        ctx.strokeRect(
          boxX - 10,
          y - totalHeight / 2 - 10,
          textWidth + 20,
          totalHeight + 20
        );
        ctx.setLineDash([]);
      }

      ctx.restore();
    });
  }, [layers, loadedImage, activeLayerId]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas, fontsLoaded]);

  // 更新圖層屬性
  const updateLayer = (id: string, updates: Partial<TextLayer>) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
    );
  };

  // 新增圖層
  const addLayer = () => {
    const newId = Date.now().toString();
    setLayers((prev) => [
      ...prev,
      {
        id: newId,
        text: "新文字",
        font: "Noto Sans TC",
        fontSize: 48,
        color: "#FFFFFF",
        x: 50,
        y: 30 + prev.length * 15,
        align: "center",
        bold: false,
        italic: false,
        effect: "none",
        effectColor: "#000000",
        effectSize: 3,
        gradientPreset: null,
        rotation: 0,
        opacity: 100,
        blendMode: "source-over",
      },
    ]);
    setActiveLayerId(newId);
  };

  // 刪除圖層
  const deleteLayer = (id: string) => {
    if (layers.length <= 1) {
      toast.error("至少保留一個文字圖層");
      return;
    }
    setLayers((prev) => prev.filter((l) => l.id !== id));
    if (activeLayerId === id) {
      setActiveLayerId(layers[0].id === id ? layers[1]?.id : layers[0].id);
    }
  };

  // 複製圖層
  const duplicateLayer = (id: string) => {
    const layer = layers.find((l) => l.id === id);
    if (!layer) return;
    const newId = Date.now().toString();
    setLayers((prev) => [
      ...prev,
      { ...layer, id: newId, y: Math.min(layer.y + 10, 95) },
    ]);
    setActiveLayerId(newId);
  };

  // 移動圖層順序
  const moveLayerUp = (id: string) => {
    const idx = layers.findIndex((l) => l.id === id);
    if (idx <= 0) return;
    const newLayers = [...layers];
    [newLayers[idx - 1], newLayers[idx]] = [newLayers[idx], newLayers[idx - 1]];
    setLayers(newLayers);
  };

  const moveLayerDown = (id: string) => {
    const idx = layers.findIndex((l) => l.id === id);
    if (idx < 0 || idx >= layers.length - 1) return;
    const newLayers = [...layers];
    [newLayers[idx], newLayers[idx + 1]] = [newLayers[idx + 1], newLayers[idx]];
    setLayers(newLayers);
  };

  // 分割多行文字為獨立圖層
  const splitLinesToLayers = (id: string) => {
    const layer = layers.find((l) => l.id === id);
    if (!layer) return;
    
    const lines = layer.text.split("\n").filter(line => line.trim());
    if (lines.length <= 1) {
      toast.info("只有一行文字，無需分割");
      return;
    }
    
    const lineHeight = layer.fontSize * 1.3;
    const totalHeight = (lines.length - 1) * lineHeight;
    const startYOffset = -totalHeight / 2;
    
    // 計算每行在畫布上的 Y 位置百分比
    const newLayers: TextLayer[] = lines.map((line, idx) => {
      const yOffset = startYOffset + idx * lineHeight;
      // 將像素偏移轉換為百分比（假設畫布高度為 1024）
      const yPercent = layer.y + (yOffset / 1024) * 100;
      
      return {
        ...layer,
        id: `${Date.now()}-${idx}`,
        text: line,
        y: Math.max(5, Math.min(95, yPercent)),
      };
    });
    
    // 移除原圖層，添加新圖層
    setLayers(prev => {
      const filtered = prev.filter(l => l.id !== id);
      const insertIdx = prev.findIndex(l => l.id === id);
      return [
        ...filtered.slice(0, insertIdx),
        ...newLayers,
        ...filtered.slice(insertIdx)
      ];
    });
    
    setActiveLayerId(newLayers[0].id);
    toast.success(`已分割為 ${lines.length} 個獨立圖層，可分別調整大小`);
  };

  // 匯出圖片
  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 取消選中狀態重繪
    const prevActiveId = activeLayerId;
    setActiveLayerId("");

    setTimeout(() => {
      const dataUrl = canvas.toDataURL("image/png", 1.0);
      
      if (onExport) {
        onExport(dataUrl);
      } else {
        // 下載圖片
        const link = document.createElement("a");
        link.download = `titled-image-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
      }
      
      toast.success("圖片已匯出！");
      setActiveLayerId(prevActiveId);
    }, 100);
  };

  // 重置
  const handleReset = () => {
    setLayers([
      {
        id: "1",
        text: "標題文字",
        font: "Noto Sans TC",
        fontSize: 72,
        color: "#FFFFFF",
        x: 50,
        y: 50,
        align: "center",
        bold: true,
        italic: false,
        effect: "shadow",
        effectColor: "#000000",
        effectSize: 4,
        gradientPreset: null,
        rotation: 0,
        opacity: 100,
        blendMode: "source-over",
      },
    ]);
    setActiveLayerId("1");
  };

  // 滑鼠拖曳
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // 檢查是否點擊到某個圖層
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      ctx.font = `${layer.italic ? "italic" : ""} ${layer.bold ? "bold" : ""} ${layer.fontSize}px "${layer.font}", sans-serif`;
      
      // 計算多行文字的寬度和高度
      const lines = layer.text.split("\n");
      const textWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
      const lineHeight = layer.fontSize * 1.3;
      const textHeight = lines.length * lineHeight;

      const layerX = (layer.x / 100) * canvas.width;
      const layerY = (layer.y / 100) * canvas.height;

      let boxX = layerX - textWidth / 2;
      if (layer.align === "left") boxX = layerX;
      if (layer.align === "right") boxX = layerX - textWidth;

      if (
        mouseX >= boxX - 10 &&
        mouseX <= boxX + textWidth + 10 &&
        mouseY >= layerY - textHeight / 2 - 10 &&
        mouseY <= layerY + textHeight / 2 + 10
      ) {
        setIsDragging(true);
        setDragLayerId(layer.id);
        setActiveLayerId(layer.id);
        setDragOffset({
          x: mouseX - layerX,
          y: mouseY - layerY,
        });
        return;
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragLayerId) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const newX = ((mouseX - dragOffset.x) / canvas.width) * 100;
    const newY = ((mouseY - dragOffset.y) / canvas.height) * 100;

    updateLayer(dragLayerId, {
      x: Math.max(0, Math.min(100, newX)),
      y: Math.max(0, Math.min(100, newY)),
    });
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
    setDragLayerId(null);
  };

  // 上傳圖片
  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("請上傳圖片檔案");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* 左側：Canvas 預覽 */}
      <div className="lg:col-span-7 space-y-3">
        {/* 畫布區域 */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 p-1">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-transparent to-pink-500/20 pointer-events-none" />
          <div className="relative bg-slate-950 rounded-xl overflow-hidden shadow-2xl">
            <canvas
              ref={canvasRef}
              width={width}
              height={height}
              className="w-full h-auto cursor-move"
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
            />
            {/* 浮動提示 */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-full text-[11px] text-slate-300 flex items-center gap-2">
              <Move className="h-3 w-3" />
              拖曳文字調整位置
            </div>
          </div>
        </div>

        {/* 圖片來源 & 操作按鈕 */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Input
              placeholder="貼上圖片網址..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="bg-slate-800/80 border-slate-700 h-11 pl-4 pr-12 rounded-xl text-sm"
            />
            <label className="absolute right-1 top-1/2 -translate-y-1/2 cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUploadImage}
              />
              <div className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                <Upload className="h-4 w-4 text-slate-400" />
              </div>
            </label>
          </div>
          <Button 
            variant="outline" 
            onClick={handleReset}
            className="h-11 px-4 rounded-xl border-slate-700 hover:bg-slate-800"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button 
            onClick={handleExport}
            className="h-11 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium shadow-lg shadow-purple-500/25"
          >
            <Download className="h-4 w-4 mr-2" />
            匯出
          </Button>
        </div>
      </div>

      {/* 右側：控制面板 */}
      <div className="lg:col-span-5 space-y-3">
        {/* 圖層列表 - 更緊湊 */}
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Type className="h-3.5 w-3.5" />
              文字圖層
            </span>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={addLayer}
              className="h-7 w-7 p-0 rounded-lg hover:bg-purple-500/20 hover:text-purple-400"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
            {layers.map((layer, idx) => (
              <div
                key={layer.id}
                className={`group p-2 rounded-lg cursor-pointer transition-all ${
                  layer.id === activeLayerId
                    ? "bg-gradient-to-r from-purple-500/30 to-pink-500/30 border border-purple-500/50"
                    : "bg-slate-900/50 hover:bg-slate-800/80 border border-transparent"
                }`}
                onClick={() => setActiveLayerId(layer.id)}
              >
                <div className="flex items-center gap-2">
                  {/* 顏色預覽 */}
                  <div 
                    className="w-4 h-4 rounded-full border border-slate-600 flex-shrink-0"
                    style={{ backgroundColor: layer.color }}
                  />
                  {/* 文字預覽 */}
                  <span 
                    className="text-xs truncate flex-1 text-slate-300" 
                    style={{ fontFamily: layer.font }}
                  >
                    {layer.text.split("\n")[0] || "空白"}
                  </span>
                  {/* 操作按鈕 - hover 時顯示 */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="p-1 hover:bg-slate-700 rounded"
                      onClick={(e) => { e.stopPropagation(); duplicateLayer(layer.id); }}
                    >
                      <Copy className="h-3 w-3 text-slate-400" />
                    </button>
                    <button
                      className="p-1 hover:bg-red-500/20 rounded"
                      onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }}
                    >
                      <Trash2 className="h-3 w-3 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 編輯面板 */}
        {activeLayer && (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <Tabs defaultValue="templates" className="w-full">
              {/* 標籤頁 - 更現代的設計 */}
              <div className="bg-slate-900/50 p-1">
                <TabsList className="grid w-full grid-cols-5 bg-transparent gap-1">
                  <TabsTrigger 
                    value="templates" 
                    className="text-[11px] data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white rounded-lg py-2"
                  >
                    <Wand2 className="h-3 w-3 mr-1" />
                    範本
                  </TabsTrigger>
                  <TabsTrigger 
                    value="text" 
                    className="text-[11px] data-[state=active]:bg-slate-700 rounded-lg py-2"
                  >
                    <Type className="h-3 w-3 mr-1" />
                    文字
                  </TabsTrigger>
                  <TabsTrigger 
                    value="style" 
                    className="text-[11px] data-[state=active]:bg-slate-700 rounded-lg py-2"
                  >
                    <Palette className="h-3 w-3 mr-1" />
                    顏色
                  </TabsTrigger>
                  <TabsTrigger 
                    value="effects" 
                    className="text-[11px] data-[state=active]:bg-slate-700 rounded-lg py-2"
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    特效
                  </TabsTrigger>
                  <TabsTrigger 
                    value="position" 
                    className="text-[11px] data-[state=active]:bg-slate-700 rounded-lg py-2"
                  >
                    <Move className="h-3 w-3 mr-1" />
                    位置
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="p-3">
                {/* 文字風格範本 */}
                <TabsContent value="templates" className="mt-0 space-y-3">
                  {/* 分類篩選 - 滾動式 */}
                  <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                    {TEMPLATE_CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setTemplateCategory(cat)}
                        className={`px-3 py-1.5 text-[11px] rounded-full whitespace-nowrap transition-all flex-shrink-0 ${
                          templateCategory === cat
                            ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25"
                            : "bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  
                  {/* 範本網格 - 更好看的卡片 */}
                  <div className="grid grid-cols-3 gap-2 max-h-[320px] overflow-y-auto pr-1">
                    {filteredTemplates.map(template => {
                      const isPremium = template.category === "高級";
                      const getPreviewStyle = () => {
                        const baseStyle: React.CSSProperties = {
                          fontFamily: template.style.font,
                          color: template.style.color,
                          fontWeight: template.style.bold ? "bold" : "normal",
                          fontStyle: template.style.italic ? "italic" : "normal",
                        };
                        
                        // 根據特效類型調整預覽樣式
                        switch (template.style.effect) {
                          case "shadow":
                            baseStyle.textShadow = `2px 2px 4px ${template.style.effectColor}`;
                            break;
                          case "glow":
                            baseStyle.textShadow = `0 0 10px ${template.style.effectColor}`;
                            break;
                          case "neon":
                            baseStyle.textShadow = `0 0 8px ${template.style.effectColor}, 0 0 16px ${template.style.effectColor}`;
                            break;
                          case "outline":
                            baseStyle.WebkitTextStroke = `1.5px ${template.style.effectColor}`;
                            break;
                          case "3d":
                            baseStyle.textShadow = `1px 1px #555, 2px 2px #444, 3px 3px #333, 4px 4px #222`;
                            break;
                          case "metallic":
                            baseStyle.background = `linear-gradient(180deg, #D4AF37 0%, #FFE766 30%, #FFF 50%, #FFE766 70%, #B8860B 100%)`;
                            baseStyle.WebkitBackgroundClip = "text";
                            baseStyle.WebkitTextFillColor = "transparent";
                            baseStyle.filter = "drop-shadow(1px 1px 1px rgba(0,0,0,0.5))";
                            break;
                          case "glass":
                            baseStyle.background = `linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.8) 100%)`;
                            baseStyle.WebkitBackgroundClip = "text";
                            baseStyle.WebkitTextFillColor = "transparent";
                            baseStyle.textShadow = `-1px -1px 2px rgba(255,255,255,0.5)`;
                            break;
                          case "fire":
                            baseStyle.background = `linear-gradient(180deg, #FFFF00 0%, #FF6600 50%, #FF0000 100%)`;
                            baseStyle.WebkitBackgroundClip = "text";
                            baseStyle.WebkitTextFillColor = "transparent";
                            baseStyle.textShadow = `0 0 10px #FF4500, 0 0 20px #FF6347`;
                            break;
                          case "frost":
                            baseStyle.background = `linear-gradient(180deg, #E0FFFF 0%, #87CEEB 50%, #B0E0E6 100%)`;
                            baseStyle.WebkitBackgroundClip = "text";
                            baseStyle.WebkitTextFillColor = "transparent";
                            baseStyle.textShadow = `0 0 8px #00BFFF`;
                            break;
                          case "comic":
                            baseStyle.WebkitTextStroke = `2px #000`;
                            baseStyle.textShadow = `3px 3px 0 #000`;
                            break;
                          case "vintage":
                            baseStyle.background = `linear-gradient(90deg, #D4A574 0%, #E8D4B8 50%, #C9A86C 100%)`;
                            baseStyle.WebkitBackgroundClip = "text";
                            baseStyle.WebkitTextFillColor = "transparent";
                            baseStyle.textShadow = `2px 2px 4px rgba(139,69,19,0.5)`;
                            break;
                          case "cinematic":
                            baseStyle.background = `linear-gradient(180deg, #F4E4BA 0%, #FFF 50%, #D4AF37 100%)`;
                            baseStyle.WebkitBackgroundClip = "text";
                            baseStyle.WebkitTextFillColor = "transparent";
                            baseStyle.textShadow = `0 3px 6px rgba(0,0,0,0.5)`;
                            break;
                        }
                        
                        return baseStyle;
                      };

                      return (
                        <button
                          key={template.id}
                          onClick={() => applyTextTemplate(template.id)}
                          className={`group relative aspect-square rounded-xl border transition-all overflow-hidden ${
                            isPremium 
                              ? "border-amber-500/40 bg-[#CCCCCC] hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/20" 
                              : "border-slate-600/40 bg-[#CCCCCC] hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/20"
                          }`}
                        >
                          {/* 高級標籤 */}
                          {isPremium && (
                            <div className="absolute top-1.5 right-1.5 z-10">
                              <span className="px-1.5 py-0.5 text-[8px] font-bold bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-full">
                                PRO
                              </span>
                            </div>
                          )}
                          
                          {/* 預覽文字 - 置中偏上 */}
                          <div className="absolute inset-0 flex items-center justify-center pb-5">
                            <span
                              className="text-2xl leading-none drop-shadow-lg"
                              style={getPreviewStyle()}
                            >
                              {template.preview}
                            </span>
                          </div>
                          
                          {/* 名稱標籤 - 底部白色文字 */}
                          <div className="absolute bottom-0 inset-x-0 p-2">
                            <span 
                              className="text-[11px] font-semibold block text-center"
                              style={{ color: "#FFFFFF" }}
                            >
                              {template.name}
                            </span>
                          </div>
                          
                          {/* Hover 效果 */}
                          <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors rounded-xl" />
                        </button>
                      );
                    })}
                  </div>
                </TabsContent>

                {/* 文字設定 */}
                <TabsContent value="text" className="mt-0 space-y-4">
                  {/* 文字輸入 */}
                  <div>
                    <Textarea
                      value={activeLayer.text}
                      onChange={(e) =>
                        updateLayer(activeLayerId, { text: e.target.value })
                      }
                      rows={3}
                      placeholder="輸入文字內容..."
                      className="bg-slate-900/50 border-slate-700 resize-none rounded-xl text-sm"
                    />
                    {activeLayer.text.includes("\n") && (
                      <button
                        onClick={() => splitLinesToLayers(activeLayerId)}
                        className="mt-2 w-full py-2 text-[11px] rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 text-purple-300 hover:from-purple-500/20 hover:to-pink-500/20 flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Scissors className="h-3 w-3" />
                        分割成獨立圖層
                      </button>
                    )}
                  </div>
                  
                  {/* 字型選擇 - 網格式 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-[11px] text-slate-500">字型</Label>
                      {!fontsLoaded && (
                        <div className="flex items-center gap-1.5 text-[10px] text-amber-400">
                          <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                          <span>載入字體中...</span>
                        </div>
                      )}
                      {fontsLoaded && (
                        <span className="text-[10px] text-emerald-400">✓ {FONTS.length} 種字體</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                      {FONTS.map((font) => {
                        const isPremiumFont = ["Bangers", "Cinzel", "Abril Fatface", "Righteous", "Permanent Marker", "Anton", "Archivo Black", "Bungee"].includes(font.name);
                        return (
                          <button
                            key={font.name}
                            onClick={() => updateLayer(activeLayerId, { font: font.name })}
                            className={`p-2 rounded-lg text-left transition-all relative ${
                              activeLayer.font === font.name
                                ? isPremiumFont 
                                  ? "bg-amber-500/20 border border-amber-500/50"
                                  : "bg-purple-500/20 border border-purple-500/50"
                                : isPremiumFont
                                  ? "bg-gradient-to-r from-slate-900/50 to-amber-950/30 border border-amber-800/20 hover:border-amber-600/50"
                                  : "bg-slate-900/50 border border-transparent hover:bg-slate-800"
                            }`}
                          >
                            {isPremiumFont && (
                              <span className="absolute top-1 right-1 px-1 py-0.5 text-[6px] font-bold bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded">
                                PRO
                              </span>
                            )}
                            <span 
                              className={`text-sm block truncate ${isPremiumFont ? "text-amber-100" : ""}`}
                              style={{ fontFamily: fontsLoaded ? font.name : "inherit" }}
                            >
                              {font.label}
                            </span>
                            <span 
                              className={`text-[10px] block truncate ${isPremiumFont ? "text-amber-300/60" : "text-slate-500"}`}
                              style={{ fontFamily: fontsLoaded ? font.name : "inherit" }}
                            >
                              文字預覽 ABC
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* 字體大小 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-[11px] text-slate-500">字體大小</Label>
                      <span className="text-xs font-mono text-purple-400">{activeLayer.fontSize}px</span>
                    </div>
                    <Slider
                      value={[activeLayer.fontSize]}
                      min={12}
                      max={200}
                      step={1}
                      onValueChange={([v]) =>
                        updateLayer(activeLayerId, { fontSize: v })
                      }
                      className="mt-2"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={activeLayer.bold ? "default" : "outline"}
                      onClick={() =>
                        updateLayer(activeLayerId, { bold: !activeLayer.bold })
                      }
                    >
                      <Bold className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant={activeLayer.italic ? "default" : "outline"}
                      onClick={() =>
                        updateLayer(activeLayerId, { italic: !activeLayer.italic })
                      }
                    >
                      <Italic className="h-4 w-4" />
                    </Button>
                    <div className="flex-1" />
                    <Button
                      size="sm"
                      variant={activeLayer.align === "left" ? "default" : "outline"}
                      onClick={() => updateLayer(activeLayerId, { align: "left" })}
                    >
                      <AlignLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant={activeLayer.align === "center" ? "default" : "outline"}
                      onClick={() => updateLayer(activeLayerId, { align: "center" })}
                    >
                      <AlignCenter className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant={activeLayer.align === "right" ? "default" : "outline"}
                      onClick={() => updateLayer(activeLayerId, { align: "right" })}
                    >
                      <AlignRight className="h-4 w-4" />
                    </Button>
                  </div>
                </TabsContent>

                {/* 顏色設定 */}
                <TabsContent value="style" className="mt-0 space-y-4">
                  {/* 顏色選擇器 */}
                  <div>
                    <Label className="text-[11px] text-slate-500 mb-2 block">文字顏色</Label>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <input
                          type="color"
                          value={activeLayer.color}
                          onChange={(e) =>
                            updateLayer(activeLayerId, { color: e.target.value })
                          }
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <div 
                          className="w-10 h-10 rounded-xl border-2 border-slate-600 cursor-pointer shadow-lg"
                          style={{ backgroundColor: activeLayer.color }}
                        />
                      </div>
                      <Input
                        value={activeLayer.color}
                        onChange={(e) =>
                          updateLayer(activeLayerId, { color: e.target.value })
                        }
                        className="flex-1 bg-slate-900/50 border-slate-700 rounded-xl text-sm font-mono"
                      />
                    </div>
                    {/* 預設顏色 */}
                    <div className="grid grid-cols-6 gap-1.5 mt-3">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          className={`aspect-square rounded-lg transition-all ${
                            activeLayer.color === color
                              ? "ring-2 ring-purple-500 ring-offset-2 ring-offset-slate-900 scale-105"
                              : "hover:scale-105"
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => updateLayer(activeLayerId, { color })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* 透明度 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-[11px] text-slate-500">透明度</Label>
                      <span className="text-xs font-mono text-purple-400">{activeLayer.opacity}%</span>
                    </div>
                    <Slider
                      value={[activeLayer.opacity]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={([v]) =>
                        updateLayer(activeLayerId, { opacity: v })
                      }
                    />
                  </div>
                </TabsContent>

                {/* 特效設定 */}
                <TabsContent value="effects" className="mt-0 space-y-4">
                  {/* 混合模式 (Blend Mode) - 雜誌感 */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="text-[11px] text-slate-500">混合模式</Label>
                      <span className="px-1.5 py-0.5 text-[8px] font-medium bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 rounded-full border border-purple-500/30">
                        雜誌感
                      </span>
                    </div>
                    <Select
                      value={activeLayer.blendMode || "source-over"}
                      onValueChange={(value) => updateLayer(activeLayerId, { blendMode: value as GlobalCompositeOperation })}
                    >
                      <SelectTrigger className="bg-slate-900/50 border-slate-700 rounded-xl text-sm">
                        <SelectValue placeholder="選擇混合模式" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700 max-h-[300px]">
                        {BLEND_MODES.map((mode) => (
                          <SelectItem 
                            key={mode.id} 
                            value={mode.id}
                            className="cursor-pointer hover:bg-slate-800"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{mode.icon}</span>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">{mode.label}</span>
                                <span className="text-[10px] text-slate-400">{mode.desc}</span>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* 混合模式預覽說明 */}
                    {activeLayer.blendMode && activeLayer.blendMode !== "source-over" && (
                      <div className="mt-2 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                        <p className="text-[10px] text-purple-300">
                          💡 {BLEND_MODES.find(m => m.id === activeLayer.blendMode)?.preview || ""}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 基礎特效 */}
                  <div>
                    <Label className="text-[11px] text-slate-500 mb-2 block">基礎特效</Label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {TEXT_EFFECTS.slice(0, 8).map((effect) => (
                        <button
                          key={effect.id}
                          onClick={() => updateLayer(activeLayerId, { effect: effect.id })}
                          className={`p-2 rounded-xl flex flex-col items-center transition-all ${
                            activeLayer.effect === effect.id
                              ? "bg-gradient-to-br from-purple-500/30 to-pink-500/30 border border-purple-500/50"
                              : "bg-slate-900/50 border border-transparent hover:bg-slate-800"
                          }`}
                        >
                          <span className="text-xl">{effect.icon}</span>
                          <span className="text-[9px] mt-1 text-slate-400">{effect.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* 高級特效 */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="text-[11px] text-slate-500">高級特效</Label>
                      <span className="px-1.5 py-0.5 text-[8px] font-bold bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-full">
                        PRO
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {TEXT_EFFECTS.slice(8).map((effect) => (
                        <button
                          key={effect.id}
                          onClick={() => updateLayer(activeLayerId, { effect: effect.id })}
                          className={`p-2 rounded-xl flex flex-col items-center transition-all relative ${
                            activeLayer.effect === effect.id
                              ? "bg-gradient-to-br from-amber-500/30 to-yellow-500/30 border border-amber-500/50"
                              : "bg-gradient-to-br from-slate-900/50 to-amber-950/30 border border-amber-800/30 hover:border-amber-600/50 hover:bg-amber-900/20"
                          }`}
                        >
                          <span className="text-xl">{effect.icon}</span>
                          <span className="text-[9px] mt-1 text-amber-200/80">{effect.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {activeLayer.effect !== "none" && activeLayer.effect !== "gradient" && (
                    <>
                      <div>
                        <Label className="text-xs text-slate-400">特效顏色</Label>
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="color"
                            value={activeLayer.effectColor}
                            onChange={(e) =>
                              updateLayer(activeLayerId, {
                                effectColor: e.target.value,
                              })
                            }
                            className="h-8 w-8 rounded cursor-pointer"
                          />
                          <Input
                            value={activeLayer.effectColor}
                            onChange={(e) =>
                              updateLayer(activeLayerId, {
                                effectColor: e.target.value,
                              })
                            }
                            className="flex-1 bg-slate-800 border-slate-700"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-400">
                          特效強度: {activeLayer.effectSize}
                        </Label>
                        <Slider
                          value={[activeLayer.effectSize]}
                          min={1}
                          max={20}
                          step={1}
                          onValueChange={([v]) =>
                            updateLayer(activeLayerId, { effectSize: v })
                          }
                          className="mt-2"
                        />
                      </div>
                    </>
                  )}

                  {activeLayer.effect === "gradient" && (
                    <div>
                      <Label className="text-xs text-slate-400">漸層預設</Label>
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {GRADIENT_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            className={`h-8 rounded border-2 transition-all ${
                              activeLayer.gradientPreset === preset.id
                                ? "border-blue-500 scale-105"
                                : "border-transparent hover:border-slate-500"
                            }`}
                            style={{
                              background: `linear-gradient(to right, ${preset.colors.join(", ")})`,
                            }}
                            onClick={() =>
                              updateLayer(activeLayerId, {
                                gradientPreset: preset.id,
                              })
                            }
                            title={preset.label}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* 位置設定 */}
                <TabsContent value="position" className="mt-0 space-y-4">
                  {/* 快速位置 */}
                  <div>
                    <Label className="text-[11px] text-slate-500 mb-2 block">快速定位</Label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { label: "左上", x: 15, y: 15 },
                        { label: "上", x: 50, y: 15 },
                        { label: "右上", x: 85, y: 15 },
                        { label: "左", x: 15, y: 50 },
                        { label: "中", x: 50, y: 50 },
                        { label: "右", x: 85, y: 50 },
                        { label: "左下", x: 15, y: 85 },
                        { label: "下", x: 50, y: 85 },
                        { label: "右下", x: 85, y: 85 },
                      ].map((pos) => (
                        <button
                          key={pos.label}
                          onClick={() => updateLayer(activeLayerId, { x: pos.x, y: pos.y })}
                          className={`py-2 rounded-lg text-[11px] transition-all ${
                            Math.abs(activeLayer.x - pos.x) < 5 && Math.abs(activeLayer.y - pos.y) < 5
                              ? "bg-purple-500/30 border border-purple-500/50 text-purple-300"
                              : "bg-slate-900/50 border border-transparent hover:bg-slate-800 text-slate-400"
                          }`}
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* 精確調整 */}
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <Label className="text-[11px] text-slate-500">水平 X</Label>
                        <span className="text-[10px] font-mono text-purple-400">{activeLayer.x.toFixed(0)}%</span>
                      </div>
                      <Slider
                        value={[activeLayer.x]}
                        min={0}
                        max={100}
                        step={1}
                        onValueChange={([v]) => updateLayer(activeLayerId, { x: v })}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <Label className="text-[11px] text-slate-500">垂直 Y</Label>
                        <span className="text-[10px] font-mono text-purple-400">{activeLayer.y.toFixed(0)}%</span>
                      </div>
                      <Slider
                        value={[activeLayer.y]}
                        min={0}
                        max={100}
                        step={1}
                        onValueChange={([v]) => updateLayer(activeLayerId, { y: v })}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <Label className="text-[11px] text-slate-500">旋轉</Label>
                        <span className="text-[10px] font-mono text-purple-400">{activeLayer.rotation}°</span>
                      </div>
                      <Slider
                        value={[activeLayer.rotation]}
                        min={-180}
                        max={180}
                        step={1}
                        onValueChange={([v]) => updateLayer(activeLayerId, { rotation: v })}
                      />
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}
