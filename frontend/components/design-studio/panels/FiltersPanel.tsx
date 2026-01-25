"use client";

/**
 * Filters Panel - 濾鏡面板
 * 提供精緻有質感的圖片濾鏡效果
 */

import React, { useState } from "react";
import { fabric } from "fabric";
import { 
  Sparkles, 
  Sun, 
  Moon, 
  Contrast, 
  Droplets,
  Camera,
  Palette,
  Sunset,
  CloudSun,
  Star,
  Heart,
  Flame,
  Snowflake,
  Leaf,
  Coffee,
  Wine,
  Gem,
  Zap,
  Film,
  ImageIcon,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDesignStudioStore } from "@/stores/design-studio-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// 濾鏡分類
const FILTER_CATEGORIES = [
  { id: "popular", label: "熱門", icon: Star },
  { id: "mood", label: "氛圍", icon: Heart },
  { id: "vintage", label: "復古", icon: Film },
  { id: "color", label: "色調", icon: Palette },
  { id: "artistic", label: "藝術", icon: Gem },
];

// 精緻濾鏡預設 - 更多選項和更精緻的參數
const PRESET_FILTERS = [
  // 熱門濾鏡
  {
    id: "original",
    name: "原圖",
    category: "popular",
    preview: "linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)",
    filters: [],
  },
  {
    id: "enhance",
    name: "自動增強",
    category: "popular",
    preview: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    filters: [
      { type: "Contrast", contrast: 0.15 },
      { type: "Saturation", saturation: 0.15 },
      { type: "Brightness", brightness: 0.05 },
    ],
  },
  {
    id: "vivid",
    name: "鮮豔",
    category: "popular",
    preview: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    filters: [
      { type: "Saturation", saturation: 0.4 },
      { type: "Contrast", contrast: 0.1 },
      { type: "Brightness", brightness: 0.05 },
    ],
  },
  {
    id: "clarity",
    name: "清晰",
    category: "popular",
    preview: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    filters: [
      { type: "Contrast", contrast: 0.25 },
      { type: "Brightness", brightness: -0.05 },
    ],
  },
  
  // 氛圍濾鏡
  {
    id: "dreamy",
    name: "夢幻",
    category: "mood",
    preview: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
    filters: [
      { type: "Brightness", brightness: 0.15 },
      { type: "Saturation", saturation: -0.15 },
      { type: "Contrast", contrast: -0.1 },
    ],
  },
  {
    id: "romantic",
    name: "浪漫",
    category: "mood",
    preview: "linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)",
    filters: [
      { type: "Brightness", brightness: 0.1 },
      { type: "Saturation", saturation: 0.1 },
    ],
  },
  {
    id: "moody",
    name: "情緒",
    category: "mood",
    preview: "linear-gradient(135deg, #2c3e50 0%, #4ca1af 100%)",
    filters: [
      { type: "Contrast", contrast: 0.3 },
      { type: "Saturation", saturation: -0.2 },
      { type: "Brightness", brightness: -0.1 },
    ],
  },
  {
    id: "dramatic",
    name: "戲劇",
    category: "mood",
    preview: "linear-gradient(135deg, #000000 0%, #434343 100%)",
    filters: [
      { type: "Contrast", contrast: 0.4 },
      { type: "Brightness", brightness: -0.15 },
      { type: "Saturation", saturation: 0.1 },
    ],
  },
  {
    id: "calm",
    name: "寧靜",
    category: "mood",
    preview: "linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)",
    filters: [
      { type: "Saturation", saturation: -0.25 },
      { type: "Brightness", brightness: 0.1 },
      { type: "Contrast", contrast: -0.05 },
    ],
  },
  {
    id: "cozy",
    name: "溫馨",
    category: "mood",
    preview: "linear-gradient(135deg, #f5af19 0%, #f12711 100%)",
    filters: [
      { type: "Brightness", brightness: 0.08 },
      { type: "Saturation", saturation: 0.2 },
    ],
  },
  
  // 復古濾鏡
  {
    id: "vintage",
    name: "復古",
    category: "vintage",
    preview: "linear-gradient(135deg, #c9b18c 0%, #8b7355 100%)",
    filters: [
      { type: "Sepia" },
      { type: "Brightness", brightness: -0.05 },
      { type: "Contrast", contrast: 0.1 },
    ],
  },
  {
    id: "retro",
    name: "懷舊",
    category: "vintage",
    preview: "linear-gradient(135deg, #d4a574 0%, #b8860b 100%)",
    filters: [
      { type: "Sepia" },
      { type: "Saturation", saturation: -0.3 },
      { type: "Contrast", contrast: 0.15 },
    ],
  },
  {
    id: "film",
    name: "底片",
    category: "vintage",
    preview: "linear-gradient(135deg, #3a6073 0%, #16222a 100%)",
    filters: [
      { type: "Contrast", contrast: 0.2 },
      { type: "Saturation", saturation: -0.15 },
      { type: "Brightness", brightness: -0.05 },
    ],
  },
  {
    id: "polaroid",
    name: "拍立得",
    category: "vintage",
    preview: "linear-gradient(135deg, #fffde4 0%, #005aa7 100%)",
    filters: [
      { type: "Brightness", brightness: 0.1 },
      { type: "Saturation", saturation: -0.1 },
      { type: "Contrast", contrast: 0.05 },
    ],
  },
  {
    id: "aged",
    name: "老照片",
    category: "vintage",
    preview: "linear-gradient(135deg, #8e7c57 0%, #5c4a32 100%)",
    filters: [
      { type: "Sepia" },
      { type: "Brightness", brightness: -0.15 },
      { type: "Contrast", contrast: 0.2 },
      { type: "Saturation", saturation: -0.2 },
    ],
  },
  {
    id: "faded",
    name: "褪色",
    category: "vintage",
    preview: "linear-gradient(135deg, #ddd6c6 0%, #b5ad9e 100%)",
    filters: [
      { type: "Brightness", brightness: 0.2 },
      { type: "Saturation", saturation: -0.4 },
      { type: "Contrast", contrast: -0.1 },
    ],
  },
  
  // 色調濾鏡
  {
    id: "warm",
    name: "暖陽",
    category: "color",
    preview: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
    filters: [
      { type: "Brightness", brightness: 0.08 },
      { type: "Saturation", saturation: 0.15 },
    ],
  },
  {
    id: "cool",
    name: "冷調",
    category: "color",
    preview: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
    filters: [
      { type: "Brightness", brightness: 0.05 },
      { type: "Saturation", saturation: -0.1 },
    ],
  },
  {
    id: "golden",
    name: "金黃",
    category: "color",
    preview: "linear-gradient(135deg, #f7971e 0%, #ffd200 100%)",
    filters: [
      { type: "Brightness", brightness: 0.1 },
      { type: "Saturation", saturation: 0.25 },
    ],
  },
  {
    id: "ocean",
    name: "海洋",
    category: "color",
    preview: "linear-gradient(135deg, #667db6 0%, #0082c8 50%, #0082c8 50%, #667db6 100%)",
    filters: [
      { type: "Saturation", saturation: 0.1 },
      { type: "Contrast", contrast: 0.1 },
    ],
  },
  {
    id: "forest",
    name: "森林",
    category: "color",
    preview: "linear-gradient(135deg, #134e5e 0%, #71b280 100%)",
    filters: [
      { type: "Saturation", saturation: 0.15 },
      { type: "Contrast", contrast: 0.05 },
      { type: "Brightness", brightness: -0.05 },
    ],
  },
  {
    id: "sunset",
    name: "日落",
    category: "color",
    preview: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    filters: [
      { type: "Brightness", brightness: 0.05 },
      { type: "Saturation", saturation: 0.3 },
      { type: "Contrast", contrast: 0.1 },
    ],
  },
  
  // 藝術濾鏡
  {
    id: "bw",
    name: "黑白",
    category: "artistic",
    preview: "linear-gradient(135deg, #000000 0%, #ffffff 100%)",
    filters: [
      { type: "Grayscale" },
      { type: "Contrast", contrast: 0.15 },
    ],
  },
  {
    id: "noir",
    name: "黑色電影",
    category: "artistic",
    preview: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
    filters: [
      { type: "Grayscale" },
      { type: "Contrast", contrast: 0.4 },
      { type: "Brightness", brightness: -0.1 },
    ],
  },
  {
    id: "highkey",
    name: "高調",
    category: "artistic",
    preview: "linear-gradient(135deg, #ffffff 0%, #e8e8e8 100%)",
    filters: [
      { type: "Brightness", brightness: 0.25 },
      { type: "Contrast", contrast: -0.15 },
      { type: "Saturation", saturation: -0.1 },
    ],
  },
  {
    id: "lowkey",
    name: "低調",
    category: "artistic",
    preview: "linear-gradient(135deg, #232526 0%, #414345 100%)",
    filters: [
      { type: "Brightness", brightness: -0.2 },
      { type: "Contrast", contrast: 0.3 },
    ],
  },
  {
    id: "chrome",
    name: "鍍鉻",
    category: "artistic",
    preview: "linear-gradient(135deg, #bdc3c7 0%, #2c3e50 100%)",
    filters: [
      { type: "Grayscale" },
      { type: "Contrast", contrast: 0.5 },
      { type: "Brightness", brightness: 0.05 },
    ],
  },
  {
    id: "pop",
    name: "普普藝術",
    category: "artistic",
    preview: "linear-gradient(135deg, #ff0844 0%, #ffb199 100%)",
    filters: [
      { type: "Saturation", saturation: 0.6 },
      { type: "Contrast", contrast: 0.3 },
      { type: "Brightness", brightness: 0.1 },
    ],
  },
];

export default function FiltersPanel() {
  const { canvas, layers, selectedObjectIds } = useDesignStudioStore();
  const [activeCategory, setActiveCategory] = useState("popular");
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);

  // 獲取選中的圖片
  const selectedLayer = layers.find((l) => selectedObjectIds.includes(l.id));
  const selectedObject = selectedLayer?.fabricObject;
  const isImage = selectedLayer?.type === "image";

  // 過濾當前分類的濾鏡
  const filteredPresets = PRESET_FILTERS.filter(
    (p) => activeCategory === "all" || p.category === activeCategory
  );

  // 套用濾鏡預設
  const applyPresetFilter = (preset: typeof PRESET_FILTERS[0]) => {
    if (!canvas || !selectedObject || !isImage) {
      toast.error("請先選擇一張圖片");
      return;
    }

    const img = selectedObject as fabric.Image;
    
    // 清除現有濾鏡
    img.filters = [];

    // 添加新濾鏡
    preset.filters.forEach((filterConfig) => {
      let filter: fabric.ImageFilter | null = null;
      
      switch (filterConfig.type) {
        case "Grayscale":
          filter = new fabric.Image.filters.Grayscale();
          break;
        case "Sepia":
          filter = new fabric.Image.filters.Sepia();
          break;
        case "Brightness":
          filter = new fabric.Image.filters.Brightness({
            brightness: (filterConfig as any).brightness || 0,
          });
          break;
        case "Contrast":
          filter = new fabric.Image.filters.Contrast({
            contrast: (filterConfig as any).contrast || 0,
          });
          break;
        case "Saturation":
          filter = new fabric.Image.filters.Saturation({
            saturation: (filterConfig as any).saturation || 0,
          });
          break;
        case "Invert":
          filter = new fabric.Image.filters.Invert();
          break;
        case "Noise":
          filter = new fabric.Image.filters.Noise({
            noise: (filterConfig as any).noise || 0,
          });
          break;
        case "Blur":
          filter = new fabric.Image.filters.Blur({
            blur: (filterConfig as any).blur || 0,
          });
          break;
      }

      if (filter) {
        img.filters!.push(filter);
      }
    });

    img.applyFilters();
    canvas.renderAll();
    setActiveFilterId(preset.id);
    
    if (preset.id !== "original") {
      toast.success(`已套用「${preset.name}」濾鏡`);
    }
  };

  // 重置濾鏡
  const resetFilters = () => {
    if (!canvas || !selectedObject || !isImage) return;
    
    const img = selectedObject as fabric.Image;
    img.filters = [];
    img.applyFilters();
    canvas.renderAll();
    setActiveFilterId("original");
    toast.success("已重置濾鏡");
  };

  // 調整單一濾鏡值
  const adjustFilter = (filterType: string, value: number) => {
    if (!canvas || !selectedObject || !isImage) return;

    const img = selectedObject as fabric.Image;
    
    // 找到或創建對應濾鏡
    let existingFilterIndex = img.filters?.findIndex(
      (f: any) => f.type === filterType
    ) ?? -1;

    if (value === 0 && existingFilterIndex !== -1) {
      img.filters?.splice(existingFilterIndex, 1);
    } else if (value !== 0) {
      let filter: fabric.ImageFilter | null = null;

      switch (filterType) {
        case "Brightness":
          filter = new fabric.Image.filters.Brightness({ brightness: value });
          break;
        case "Contrast":
          filter = new fabric.Image.filters.Contrast({ contrast: value });
          break;
        case "Saturation":
          filter = new fabric.Image.filters.Saturation({ saturation: value });
          break;
        case "Blur":
          filter = new fabric.Image.filters.Blur({ blur: value });
          break;
        case "Noise":
          filter = new fabric.Image.filters.Noise({ noise: value * 500 });
          break;
      }

      if (filter) {
        if (existingFilterIndex !== -1) {
          img.filters![existingFilterIndex] = filter;
        } else {
          img.filters = img.filters || [];
          img.filters.push(filter);
        }
      }
    }

    img.applyFilters();
    canvas.renderAll();
    setActiveFilterId(null); // 手動調整時清除預設選中
  };

  // 獲取當前濾鏡值
  const getFilterValue = (filterType: string): number => {
    if (!selectedObject || !isImage) return 0;
    
    const img = selectedObject as fabric.Image;
    const filter = img.filters?.find((f: any) => f.type === filterType) as any;
    
    if (!filter) return 0;
    
    switch (filterType) {
      case "Brightness": return filter.brightness || 0;
      case "Contrast": return filter.contrast || 0;
      case "Saturation": return filter.saturation || 0;
      case "Blur": return filter.blur || 0;
      case "Noise": return (filter.noise || 0) / 500;
      default: return 0;
    }
  };

  if (!isImage) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-slate-700/50">
          <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            濾鏡特效
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-slate-500 text-sm">
            <Camera className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">選取圖片以套用濾鏡</p>
            <p className="text-xs mt-1 text-slate-600">
              支援 30+ 種專業濾鏡效果
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            濾鏡特效
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-7 px-2 text-xs text-slate-400 hover:text-white"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            重置
          </Button>
        </div>
      </div>

      <Tabs defaultValue="presets" className="flex-1 flex flex-col">
        <TabsList className="mx-3 mt-2 grid grid-cols-2 bg-slate-800/50 h-8">
          <TabsTrigger value="presets" className="text-xs">
            <ImageIcon className="w-3 h-3 mr-1" />
            濾鏡預設
          </TabsTrigger>
          <TabsTrigger value="adjust" className="text-xs">
            <Contrast className="w-3 h-3 mr-1" />
            手動調整
          </TabsTrigger>
        </TabsList>

        {/* 濾鏡預設 */}
        <TabsContent value="presets" className="flex-1 flex flex-col mt-0">
          {/* 分類標籤 */}
          <div className="flex gap-1 p-2 overflow-x-auto border-b border-slate-700/30">
            {FILTER_CATEGORIES.map((cat) => (
              <Button
                key={cat.id}
                variant={activeCategory === cat.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "h-7 text-[10px] whitespace-nowrap px-2",
                  activeCategory === cat.id 
                    ? "bg-indigo-500 text-white" 
                    : "text-slate-400 hover:text-white"
                )}
              >
                <cat.icon className="w-3 h-3 mr-1" />
                {cat.label}
              </Button>
            ))}
          </div>

          {/* 濾鏡網格 */}
          <ScrollArea className="flex-1 p-2">
            <div className="grid grid-cols-3 gap-2">
              {filteredPresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyPresetFilter(preset)}
                  className={cn(
                    "group relative rounded-xl overflow-hidden transition-all hover:scale-105",
                    activeFilterId === preset.id
                      ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-900"
                      : "hover:ring-1 hover:ring-slate-600"
                  )}
                >
                  {/* 預覽背景 */}
                  <div 
                    className="aspect-square"
                    style={{ background: preset.preview }}
                  >
                    {/* 選中標記 */}
                    {activeFilterId === preset.id && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  {/* 名稱標籤 */}
                  <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-[10px] text-white font-medium text-center truncate">
                      {preset.name}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* 手動調整 */}
        <TabsContent value="adjust" className="flex-1 mt-0">
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-5">
              {/* 亮度 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Sun className="w-4 h-4 text-amber-400" />
                    亮度
                  </span>
                  <span className="text-xs text-indigo-400 font-mono w-12 text-right">
                    {Math.round(getFilterValue("Brightness") * 100)}%
                  </span>
                </div>
                <Slider
                  value={[getFilterValue("Brightness") * 100]}
                  min={-100}
                  max={100}
                  step={1}
                  onValueChange={([v]) => adjustFilter("Brightness", v / 100)}
                  className="[&_[role=slider]]:bg-amber-400"
                />
              </div>

              {/* 對比度 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Contrast className="w-4 h-4 text-blue-400" />
                    對比度
                  </span>
                  <span className="text-xs text-indigo-400 font-mono w-12 text-right">
                    {Math.round(getFilterValue("Contrast") * 100)}%
                  </span>
                </div>
                <Slider
                  value={[getFilterValue("Contrast") * 100]}
                  min={-100}
                  max={100}
                  step={1}
                  onValueChange={([v]) => adjustFilter("Contrast", v / 100)}
                  className="[&_[role=slider]]:bg-blue-400"
                />
              </div>

              {/* 飽和度 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Palette className="w-4 h-4 text-pink-400" />
                    飽和度
                  </span>
                  <span className="text-xs text-indigo-400 font-mono w-12 text-right">
                    {Math.round(getFilterValue("Saturation") * 100)}%
                  </span>
                </div>
                <Slider
                  value={[getFilterValue("Saturation") * 100]}
                  min={-100}
                  max={100}
                  step={1}
                  onValueChange={([v]) => adjustFilter("Saturation", v / 100)}
                  className="[&_[role=slider]]:bg-pink-400"
                />
              </div>

              <Separator className="bg-slate-700/50" />

              {/* 模糊 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Droplets className="w-4 h-4 text-cyan-400" />
                    模糊
                  </span>
                  <span className="text-xs text-indigo-400 font-mono w-12 text-right">
                    {Math.round(getFilterValue("Blur") * 100)}%
                  </span>
                </div>
                <Slider
                  value={[getFilterValue("Blur") * 100]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([v]) => adjustFilter("Blur", v / 100)}
                  className="[&_[role=slider]]:bg-cyan-400"
                />
              </div>

              {/* 噪點 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    噪點
                  </span>
                  <span className="text-xs text-indigo-400 font-mono w-12 text-right">
                    {Math.round(getFilterValue("Noise") * 100)}%
                  </span>
                </div>
                <Slider
                  value={[getFilterValue("Noise") * 100]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([v]) => adjustFilter("Noise", v / 100)}
                  className="[&_[role=slider]]:bg-purple-400"
                />
              </div>

              <Separator className="bg-slate-700/50" />

              {/* 快速重置按鈕 */}
              <Button
                variant="outline"
                size="sm"
                onClick={resetFilters}
                className="w-full bg-slate-800/50 border-slate-700 hover:bg-slate-700"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-2" />
                重置所有調整
              </Button>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
