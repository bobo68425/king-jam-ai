"use client";

/**
 * AI 生圖面板
 * 提供文字描述輸入、風格選擇、品質選擇
 * 生成後自動加入畫布
 */

import React, { useState, useCallback } from "react";
import { fabric } from "fabric";
import { v4 as uuidv4 } from "uuid";
import {
  Sparkles,
  Loader2,
  Camera,
  Palette,
  Brush,
  Box,
  Droplets,
  Layers,
  Gamepad2,
  PaintBucket,
  Grid3X3,
  Wand2,
  Coins,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useDesignStudioStore, ExtendedFabricObject } from "@/stores/design-studio-store";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// 風格選項
const STYLES = [
  { id: "realistic", name: "寫實攝影", icon: Camera, color: "#3b82f6" },
  { id: "illustration", name: "數位插畫", icon: Palette, color: "#8b5cf6" },
  { id: "3d", name: "3D 渲染", icon: Box, color: "#06b6d4" },
  { id: "watercolor", name: "水彩畫", icon: Droplets, color: "#14b8a6" },
  { id: "flat", name: "扁平設計", icon: Layers, color: "#f59e0b" },
  { id: "anime", name: "動漫風格", icon: Sparkles, color: "#ec4899" },
  { id: "oil_painting", name: "油畫", icon: Brush, color: "#d97706" },
  { id: "pixel", name: "像素風", icon: Grid3X3, color: "#10b981" },
];

// 品質選項
const QUALITIES = [
  { id: "draft", name: "快速", cost: 5, desc: "快速生成" },
  { id: "standard", name: "標準", cost: 10, desc: "推薦" },
  { id: "premium", name: "高級", cost: 20, desc: "最高品質" },
];

// 範例 Prompt
const EXAMPLE_PROMPTS = [
  "一隻可愛的柴犬坐在咖啡廳裡喝咖啡",
  "未來城市天際線，霓虹燈光，賽博朋克風格",
  "平靜的日落海灘，椰子樹剪影，金色天空",
  "簡約品牌 Logo 背景，漸層色彩，幾何圖案",
  "美味的蛋糕特寫，專業食物攝影",
  "太空探險，宇航員在星球表面行走",
];

export default function AiImagePanel() {
  const { canvas, canvasWidth, canvasHeight, addLayer } = useDesignStudioStore();

  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("realistic");
  const [quality, setQuality] = useState("standard");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);

  const selectedQuality = QUALITIES.find((q) => q.id === quality);

  // 生成圖片
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error("請輸入圖片描述");
      return;
    }
    if (!canvas) {
      toast.error("畫布尚未準備好");
      return;
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      toast.error("請先登入");
      return;
    }

    setIsGenerating(true);
    const toastId = toast.loading("AI 正在生成圖片...", {
      description: `風格：${STYLES.find((s) => s.id === style)?.name} | 品質：${selectedQuality?.name}`,
    });

    try {
      const res = await fetch(`${API_BASE_URL}/api/design-studio/generate-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          width: canvasWidth,
          height: canvasHeight,
          style,
          quality,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `生成失敗 (${res.status})`);
      }

      const data = await res.json();

      if (data.success && data.image) {
        // 儲存到歷史
        setGeneratedImages((prev) => [data.image, ...prev].slice(0, 10));

        // 加入畫布
        addImageToCanvas(data.image);

        toast.success("AI 圖片生成成功！", {
          id: toastId,
          description: `已消耗 ${data.cost} 點`,
        });
      } else {
        throw new Error("未收到圖片資料");
      }
    } catch (err: any) {
      console.error("[AI Image] Error:", err);
      toast.error(err.message || "AI 生圖失敗", { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, style, quality, canvas, canvasWidth, canvasHeight, selectedQuality, addLayer]);

  // 將圖片加入畫布
  const addImageToCanvas = useCallback(
    (dataUrl: string) => {
      if (!canvas) return;

      fabric.Image.fromURL(
        dataUrl,
        (img) => {
          const id = uuidv4();
          const maxSize = Math.min(canvasWidth, canvasHeight) * 0.9;
          const scale = Math.min(
            maxSize / (img.width || 1),
            maxSize / (img.height || 1)
          );

          img.set({
            left: canvasWidth / 2,
            top: canvasHeight / 2,
            originX: "center",
            originY: "center",
            scaleX: scale,
            scaleY: scale,
          });

          (img as ExtendedFabricObject).id = id;
          (img as ExtendedFabricObject).name = `AI 圖片`;

          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();

          addLayer({
            id,
            name: `AI 圖片`,
            type: "image",
            visible: true,
            locked: false,
            opacity: 1,
            blendMode: "source-over",
            fabricObject: img,
          });

          toast.success("已加入畫布");
        },
        { crossOrigin: "anonymous" }
      );
    },
    [canvas, canvasWidth, canvasHeight, addLayer]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 md:p-4 space-y-3 overflow-y-auto flex-1">
        {/* Prompt 輸入 */}
        <div>
          <label className="text-xs font-medium text-slate-300 mb-1.5 block">
            <Wand2 className="w-3.5 h-3.5 inline mr-1" />
            描述你想要的圖片
          </label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例如：一隻可愛的柴犬坐在咖啡廳裡..."
            className="min-h-[80px] md:min-h-[100px] bg-slate-800/50 border-slate-700 text-sm text-white placeholder:text-slate-500 resize-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
            disabled={isGenerating}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                handleGenerate();
              }
            }}
          />
          <p className="text-[10px] text-slate-500 mt-1">⌘+Enter 快速生成</p>
        </div>

        {/* 範例提示 */}
        <div>
          <p className="text-[10px] text-slate-500 mb-1.5">快速範例：</p>
          <div className="flex flex-wrap gap-1">
            {EXAMPLE_PROMPTS.slice(0, 4).map((ex, i) => (
              <button
                key={i}
                onClick={() => setPrompt(ex)}
                disabled={isGenerating}
                className="text-[10px] px-2 py-1 rounded-full bg-slate-800/80 text-slate-400 hover:text-indigo-400 hover:bg-slate-700/80 border border-slate-700/50 transition-all truncate max-w-[160px]"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* 風格選擇 */}
        <div>
          <label className="text-xs font-medium text-slate-300 mb-1.5 block">
            <Palette className="w-3.5 h-3.5 inline mr-1" />
            風格
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => setStyle(s.id)}
                disabled={isGenerating}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg border transition-all text-center",
                  style === s.id
                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-400"
                    : "border-slate-700/50 bg-slate-800/30 text-slate-400 hover:border-slate-600 hover:text-slate-300"
                )}
              >
                <s.icon className="w-4 h-4" style={{ color: style === s.id ? s.color : undefined }} />
                <span className="text-[10px] leading-tight">{s.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 品質選擇 */}
        <div>
          <label className="text-xs font-medium text-slate-300 mb-1.5 block">
            <Sparkles className="w-3.5 h-3.5 inline mr-1" />
            品質
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {QUALITIES.map((q) => (
              <button
                key={q.id}
                onClick={() => setQuality(q.id)}
                disabled={isGenerating}
                className={cn(
                  "flex flex-col items-center gap-0.5 p-2 rounded-lg border transition-all",
                  quality === q.id
                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-400"
                    : "border-slate-700/50 bg-slate-800/30 text-slate-400 hover:border-slate-600"
                )}
              >
                <span className="text-xs font-medium">{q.name}</span>
                <span className="text-[10px] flex items-center gap-0.5">
                  <Coins className="w-3 h-3" />
                  {q.cost} 點
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 畫布尺寸提示 */}
        <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/30 rounded-lg border border-slate-700/30">
          <ImagePlus className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="text-[10px] text-slate-500">
            將生成 {canvasWidth}×{canvasHeight} 比例的圖片
          </span>
        </div>

        {/* 生成按鈕 */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              AI 生成中...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4 mr-2" />
              生成圖片
              <span className="ml-2 text-xs opacity-75">({selectedQuality?.cost} 點)</span>
            </>
          )}
        </Button>

        {/* 已生成的圖片歷史 */}
        {generatedImages.length > 0 && (
          <div>
            <label className="text-xs font-medium text-slate-300 mb-1.5 block">
              最近生成
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {generatedImages.map((img, i) => (
                <button
                  key={i}
                  onClick={() => addImageToCanvas(img)}
                  className="aspect-square rounded-lg overflow-hidden border border-slate-700/50 hover:border-indigo-500/50 transition-all hover:scale-105 bg-slate-800/50"
                >
                  <img
                    src={img}
                    alt={`AI 生成 ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
