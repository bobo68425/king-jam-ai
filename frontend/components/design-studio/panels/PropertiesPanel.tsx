"use client";

/**
 * Properties Panel - 右側屬性面板 (改進版)
 * 根據選中物件類型動態顯示對應控制項
 * 
 * 改進：
 * - 優化顏色選擇器，更大更易用
 * - 簡化操作流程，減少 Tab 切換
 * - 添加快速預設值
 * - 更友善的空狀態提示
 * - 修復陰影功能
 * - 改進位置/尺寸更新
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { fabric } from "fabric";
import { useDesignStudioStore, ExtendedFabricObject } from "@/stores/design-studio-store";

// 物件屬性介面
interface ObjectProperties {
  left: number;
  top: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  opacity: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  textAlign: string;
  underline: boolean;
  lineHeight: number;
  charSpacing: number;
  flipX: boolean;
  flipY: boolean;
  shadow: fabric.Shadow | null;
  rx: number;
  ry: number;
}

// 擴展 Fabric IText 類型
interface ExtendedIText extends fabric.IText {
  id?: string;
  name?: string;
}
import { 
  Settings2, 
  Type, 
  Palette, 
  Move,
  RotateCcw,
  Square,
  Image as ImageIcon,
  Layers2,
  Sun,
  Blend,
  Filter,
  Sparkles,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  MousePointer2,
  Pipette,
  RefreshCw,
  Link,
  Unlink,
  Copy,
  Trash2,
  FlipHorizontal,
  FlipVertical,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
// 使用上方已導入的 useDesignStudioStore
import { BLEND_MODE_OPTIONS, BlendMode } from "@/stores/design-studio-store";
import { cn } from "@/lib/utils";

// 預設顏色 - 擴充版
const PRESET_COLORS = [
  // 基本色
  "#FFFFFF", "#000000", "#F8FAFC", "#64748B",
  // 紅色系
  "#EF4444", "#DC2626", "#FCA5A5", "#FEE2E2",
  // 橙色系
  "#F97316", "#EA580C", "#FDBA74", "#FED7AA",
  // 黃色系
  "#EAB308", "#CA8A04", "#FDE047", "#FEF9C3",
  // 綠色系
  "#22C55E", "#16A34A", "#86EFAC", "#DCFCE7",
  // 藍色系
  "#3B82F6", "#2563EB", "#93C5FD", "#DBEAFE",
  // 紫色系
  "#8B5CF6", "#7C3AED", "#C4B5FD", "#EDE9FE",
  // 粉色系
  "#EC4899", "#DB2777", "#F9A8D4", "#FCE7F3",
];

// 漸層預設
const GRADIENT_PRESETS = [
  { id: "sunset", colors: ["#FF6B6B", "#FFE66D"], label: "日落" },
  { id: "ocean", colors: ["#667eea", "#764ba2"], label: "海洋" },
  { id: "forest", colors: ["#11998e", "#38ef7d"], label: "森林" },
  { id: "fire", colors: ["#f12711", "#f5af19"], label: "火焰" },
];

// 字體列表
const FONT_FAMILIES = [
  { name: "Noto Sans TC", label: "思源黑體", type: "sans" },
  { name: "Noto Serif TC", label: "思源宋體", type: "serif" },
  { name: "LXGW WenKai TC", label: "霞鶩文楷", type: "handwriting" },
  { name: "ZCOOL QingKe HuangYou", label: "站酷黃油體", type: "display" },
  { name: "Montserrat", label: "Montserrat", type: "sans" },
  { name: "Playfair Display", label: "Playfair", type: "serif" },
  { name: "Bebas Neue", label: "Bebas Neue", type: "display" },
  { name: "Inter", label: "Inter", type: "sans" },
];

// 字體大小預設
const FONT_SIZE_PRESETS = [12, 14, 16, 18, 24, 32, 48, 64, 72, 96, 128];

export default function PropertiesPanel() {
  const {
    canvas,
    layers,
    selectedObjectIds,
    updateLayer,
    removeLayer,
    addLayer,
    canvasWidth,
    canvasHeight,
    pushHistory,
  } = useDesignStudioStore();

  // 選中的物件屬性
  const [objectProps, setObjectProps] = useState<Partial<ObjectProperties>>({});
  const [openSections, setOpenSections] = useState({
    text: true,
    fill: true,
    stroke: true,
    position: true,
    effects: false,
  });
  const [lockAspectRatio, setLockAspectRatio] = useState(false);
  
  // 獲取選中的圖層
  const selectedLayer = layers.find((l) => selectedObjectIds.includes(l.id));
  const selectedObject = selectedLayer?.fabricObject;

  // 更新屬性的輔助函數
  const updateProps = useCallback(() => {
    if (!selectedObject) {
      setObjectProps({});
      return;
    }
    
    // 計算實際尺寸（考慮縮放）
    const boundingRect = selectedObject.getBoundingRect(true);
    
    setObjectProps({
      // 位置與大小
      left: Math.round(selectedObject.left || 0),
      top: Math.round(selectedObject.top || 0),
      width: Math.round(boundingRect.width),
      height: Math.round(boundingRect.height),
      angle: Math.round(selectedObject.angle || 0),
      scaleX: selectedObject.scaleX || 1,
      scaleY: selectedObject.scaleY || 1,
      flipX: selectedObject.flipX || false,
      flipY: selectedObject.flipY || false,
      // 樣式
      fill: selectedObject.fill as string || "#FFFFFF",
      stroke: selectedObject.stroke as string || "",
      strokeWidth: selectedObject.strokeWidth || 0,
      opacity: Math.round((selectedObject.opacity || 1) * 100),
      // 文字專屬 (IText 類型)
      text: (selectedObject as fabric.IText).text || "",
      fontFamily: (selectedObject as fabric.IText).fontFamily || "Noto Sans TC",
      fontSize: (selectedObject as fabric.IText).fontSize || 24,
      fontWeight: String((selectedObject as fabric.IText).fontWeight || "normal"),
      fontStyle: (selectedObject as fabric.IText).fontStyle || "normal",
      textAlign: (selectedObject as fabric.IText).textAlign || "left",
      underline: (selectedObject as fabric.IText).underline || false,
      lineHeight: (selectedObject as fabric.IText).lineHeight || 1.16,
      charSpacing: (selectedObject as fabric.IText).charSpacing || 0,
      // 陰影
      shadow: selectedObject.shadow,
      // 圓角（形狀 Rect 類型）
      rx: (selectedObject as fabric.Rect).rx || 0,
      ry: (selectedObject as fabric.Rect).ry || 0,
    });
  }, [selectedObject]);

  // 監聽選中物件變化
  useEffect(() => {
    if (!selectedObject) {
      setObjectProps({});
      return;
    }

    updateProps();

    // 監聽物件修改
    selectedObject.on("modified", updateProps);
    selectedObject.on("scaling", updateProps);
    selectedObject.on("moving", updateProps);
    selectedObject.on("rotating", updateProps);

    return () => {
      selectedObject.off("modified", updateProps);
      selectedObject.off("scaling", updateProps);
      selectedObject.off("moving", updateProps);
      selectedObject.off("rotating", updateProps);
    };
  }, [selectedObject, updateProps]);

  // 防抖計時器引用
  const historyTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 保存歷史記錄的輔助函數
  const saveHistoryState = useCallback((action: 'modify' | 'style' = 'modify') => {
    if (!canvas || !selectedObject || !selectedLayer) return;
    
    // 定義需要包含在 JSON 中的自定義屬性
    const customProperties = [
      "id",
      "name",
      "blendMode",
      "globalCompositeOperation",
      "lockUniScaling",
      "isGrid",
      "isGuide",
      "selectable",
      "evented"
    ];
    
    pushHistory({
      json: JSON.stringify(canvas.toJSON(customProperties)),
      timestamp: Date.now(),
      action,
      objectIds: [selectedLayer.id],
    });
  }, [canvas, selectedObject, selectedLayer, pushHistory]);
  
  // 帶防抖的歷史記錄保存（用於滑桿等連續操作）
  const saveHistoryDebounced = useCallback((action: 'modify' | 'style' = 'modify') => {
    if (historyTimerRef.current) {
      clearTimeout(historyTimerRef.current);
    }
    historyTimerRef.current = setTimeout(() => {
      saveHistoryState(action);
      historyTimerRef.current = null;
    }, 300);
  }, [saveHistoryState]);

  // 清理計時器
  useEffect(() => {
    return () => {
      if (historyTimerRef.current) {
        clearTimeout(historyTimerRef.current);
      }
    };
  }, []);

  // 更新物件屬性（帶歷史記錄）
  const updateObjectProp = useCallback((key: string, value: string | number | boolean | fabric.Shadow | null, saveHistory: boolean = true) => {
    if (!selectedObject || !canvas) return;
    
    selectedObject.set(key, value as unknown);
    selectedObject.setCoords();
    canvas.renderAll();
    
    // 更新本地狀態
    setObjectProps((prev) => ({ ...prev, [key]: value }));
    
    // 保存歷史（對於連續輸入如滑桿使用防抖）
    if (saveHistory) {
      saveHistoryDebounced('style');
    }
  }, [selectedObject, canvas, saveHistoryDebounced]);

  // 更新位置（帶歷史記錄）
  const updatePosition = useCallback((axis: 'left' | 'top', value: number) => {
    if (!selectedObject || !canvas) return;
    
    selectedObject.set(axis, value);
    selectedObject.setCoords();
    canvas.renderAll();
    setObjectProps((prev) => ({ ...prev, [axis]: value }));
    
    // 使用防抖保存歷史（連續輸入時）
    saveHistoryDebounced('modify');
  }, [selectedObject, canvas, saveHistoryDebounced]);

  // 更新尺寸（保持等比或不保持，帶歷史記錄）
  const updateSize = useCallback((dimension: 'width' | 'height', value: number) => {
    if (!selectedObject || !canvas) return;
    
    const currentWidth = (selectedObject.width || 1) * (selectedObject.scaleX || 1);
    const currentHeight = (selectedObject.height || 1) * (selectedObject.scaleY || 1);
    const aspectRatio = currentWidth / currentHeight;
    
    if (dimension === 'width') {
      const newScaleX = value / (selectedObject.width || 1);
      selectedObject.set('scaleX', newScaleX);
      
      if (lockAspectRatio) {
        const newHeight = value / aspectRatio;
        const newScaleY = newHeight / (selectedObject.height || 1);
        selectedObject.set('scaleY', newScaleY);
      }
    } else {
      const newScaleY = value / (selectedObject.height || 1);
      selectedObject.set('scaleY', newScaleY);
      
      if (lockAspectRatio) {
        const newWidth = value * aspectRatio;
        const newScaleX = newWidth / (selectedObject.width || 1);
        selectedObject.set('scaleX', newScaleX);
      }
    }
    
    selectedObject.setCoords();
    canvas.renderAll();
    updateProps();
    
    // 使用防抖保存歷史
    saveHistoryDebounced('modify');
  }, [selectedObject, canvas, lockAspectRatio, updateProps, saveHistoryDebounced]);

  // 更新混合模式（帶歷史記錄）
  const updateBlendMode = useCallback((blendMode: BlendMode) => {
    if (!selectedLayer || !selectedObject || !canvas) return;
    
    (selectedObject as fabric.Object & { globalCompositeOperation?: string }).globalCompositeOperation = blendMode;
    canvas.renderAll();
    updateLayer(selectedLayer.id, { blendMode });
    
    // 立即保存歷史（離散操作）
    saveHistoryState('style');
  }, [selectedLayer, selectedObject, canvas, updateLayer, saveHistoryState]);

  // 更新透明度（帶歷史記錄）
  const updateOpacity = useCallback((opacity: number) => {
    if (!selectedLayer || !selectedObject || !canvas) return;
    
    const normalizedOpacity = opacity / 100;
    selectedObject.set("opacity", normalizedOpacity);
    canvas.renderAll();
    updateLayer(selectedLayer.id, { opacity: normalizedOpacity });
    setObjectProps((prev) => ({ ...prev, opacity }));
    
    // 使用防抖保存歷史（滑桿操作）
    saveHistoryDebounced('style');
  }, [selectedLayer, selectedObject, canvas, updateLayer, saveHistoryDebounced]);

  // 更新陰影（帶歷史記錄）
  const updateShadow = useCallback((shadowProps: { color?: string; blur?: number; offsetX?: number; offsetY?: number } | null, immediate: boolean = false) => {
    if (!selectedObject || !canvas) return;
    
    if (shadowProps === null) {
      selectedObject.set('shadow', null);
    } else {
      const currentShadow = selectedObject.shadow as fabric.Shadow | null;
      const newShadow = new fabric.Shadow({
        color: shadowProps.color ?? currentShadow?.color ?? 'rgba(0,0,0,0.5)',
        blur: shadowProps.blur ?? currentShadow?.blur ?? 10,
        offsetX: shadowProps.offsetX ?? currentShadow?.offsetX ?? 5,
        offsetY: shadowProps.offsetY ?? currentShadow?.offsetY ?? 5,
      });
      selectedObject.set('shadow', newShadow);
    }
    
    canvas.renderAll();
    setObjectProps((prev) => ({ ...prev, shadow: selectedObject.shadow }));
    
    // 保存歷史（開關陰影用立即，滑桿用防抖）
    if (immediate) {
      saveHistoryState('style');
    } else {
      saveHistoryDebounced('style');
    }
  }, [selectedObject, canvas, saveHistoryState, saveHistoryDebounced]);

  // 翻轉物件（帶歷史記錄）
  const flipObject = useCallback((direction: 'horizontal' | 'vertical') => {
    if (!selectedObject || !canvas) return;
    
    if (direction === 'horizontal') {
      selectedObject.set('flipX', !selectedObject.flipX);
    } else {
      selectedObject.set('flipY', !selectedObject.flipY);
    }
    
    canvas.renderAll();
    updateProps();
    
    // 立即保存歷史（離散操作）
    saveHistoryState('modify');
  }, [selectedObject, canvas, updateProps, saveHistoryState]);

  // 複製物件
  const duplicateObject = useCallback(() => {
    if (!selectedObject || !canvas) return;
    
    selectedObject.clone((cloned: fabric.Object) => {
      cloned.set({
        left: (selectedObject.left || 0) + 20,
        top: (selectedObject.top || 0) + 20,
      });
      
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const extCloned = cloned as ExtendedFabricObject;
      const extSelected = selectedObject as ExtendedFabricObject;
      extCloned.id = id;
      extCloned.name = `${extSelected.name || '物件'} (複製)`;
      
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.renderAll();
      
      addLayer({
        id,
        name: extCloned.name || '複製物件',
        type: selectedLayer?.type || 'shape',
        visible: true,
        locked: false,
        opacity: cloned.opacity || 1,
        blendMode: 'source-over',
        fabricObject: cloned,
      });
    });
  }, [selectedObject, canvas, selectedLayer, addLayer]);

  // 刪除物件
  const deleteObject = useCallback(() => {
    if (!selectedObject || !canvas || !selectedLayer) return;
    
    canvas.remove(selectedObject);
    canvas.renderAll();
    removeLayer(selectedLayer.id);
  }, [selectedObject, canvas, selectedLayer, removeLayer]);

  // 切換 section 展開狀態
  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // 沒有選中物件時的提示
  if (!selectedObject) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-slate-700/50">
          <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-indigo-400" />
            屬性
          </h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-4">
            <MousePointer2 className="w-8 h-8 text-slate-600" />
          </div>
          <h4 className="text-sm font-medium text-slate-400 mb-2">尚未選取物件</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            點選畫布上的物件<br />即可在此編輯屬性
          </p>
          
          <div className="mt-6 pt-6 border-t border-slate-700/50 w-full">
            <p className="text-[10px] text-slate-600 mb-3">快捷鍵提示</p>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="flex items-center gap-1.5 text-slate-500">
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">V</kbd>
                <span>選取</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500">
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">T</kbd>
                <span>文字</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500">
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">⌘D</kbd>
                <span>複製</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500">
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Del</kbd>
                <span>刪除</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isTextObject = selectedLayer?.type === "text";
  const isImageObject = selectedLayer?.type === "image";

  // Section 標題組件
  const SectionHeader = ({ 
    icon: Icon, 
    title, 
    isOpen, 
    onToggle 
  }: { 
    icon: React.ElementType; 
    title: string; 
    isOpen: boolean; 
    onToggle: () => void;
  }) => (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-3 hover:bg-slate-800/30 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-medium text-slate-300">{title}</span>
      </div>
      <div className={cn(
        "w-5 h-5 rounded flex items-center justify-center transition-transform",
        isOpen ? "rotate-180" : ""
      )}>
        <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </button>
  );

  // 顏色選擇器組件
  const ColorPicker = ({ 
    value, 
    onChange, 
    label 
  }: { 
    value: string; 
    onChange: (color: string) => void;
    label: string;
  }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-slate-400">{label}</Label>
        <div className="flex items-center gap-2">
          <div 
            className="w-6 h-6 rounded-lg border-2 border-slate-600"
            style={{ backgroundColor: value }}
          />
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-24 h-7 bg-slate-800/50 border-slate-700 text-xs font-mono"
          />
        </div>
      </div>
      
      {/* 大型顏色選擇器 */}
      <div className="flex gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-12 rounded-xl border-2 border-slate-600 cursor-pointer bg-transparent"
        />
        <div className="flex-1 grid grid-cols-8 gap-1">
          {PRESET_COLORS.slice(0, 16).map((color) => (
            <button
              key={color}
              className={cn(
                "w-full aspect-square rounded-md border transition-all hover:scale-110",
                value === color 
                  ? "border-indigo-500 ring-2 ring-indigo-500/30" 
                  : "border-transparent hover:border-slate-500"
              )}
              style={{ backgroundColor: color }}
              onClick={() => onChange(color)}
            />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-slate-900/50 overflow-hidden">
      {/* 標題 */}
      <div className="p-4 border-b border-slate-700/50 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-indigo-400" />
            {selectedLayer?.name || "屬性"}
          </h3>
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full",
            isTextObject ? "bg-blue-500/20 text-blue-400" :
            isImageObject ? "bg-green-500/20 text-green-400" :
            "bg-purple-500/20 text-purple-400"
          )}>
            {isTextObject ? "文字" : isImageObject ? "圖片" : "形狀"}
          </span>
        </div>
      </div>

      {/* 屬性面板內容 */}
      <div className="flex-1 overflow-y-auto">
        <div className="pb-4">
          {/* 文字專屬設定 */}
          {isTextObject && (
            <Collapsible open={openSections.text} onOpenChange={() => toggleSection('text')}>
              <CollapsibleTrigger asChild>
                <div>
                  <SectionHeader 
                    icon={Type} 
                    title="文字" 
                    isOpen={openSections.text}
                    onToggle={() => toggleSection('text')}
                  />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3 space-y-4">
                  {/* 文字內容 */}
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-400">內容</Label>
                    <Input
                      value={objectProps.text || ""}
                      onChange={(e) => updateObjectProp("text", e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-sm"
                      placeholder="輸入文字..."
                    />
                  </div>

                  {/* 字體選擇 */}
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-400">字體</Label>
                    <Select
                      value={objectProps.fontFamily}
                      onValueChange={(v) => updateObjectProp("fontFamily", v)}
                    >
                      <SelectTrigger className="bg-slate-800/50 border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 max-h-[200px]">
                        {FONT_FAMILIES.map((font) => (
                          <SelectItem 
                            key={font.name} 
                            value={font.name}
                            className="text-sm"
                          >
                            <span style={{ fontFamily: font.name }}>{font.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* 字體大小 */}
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-400">大小</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={objectProps.fontSize || 24}
                        onChange={(e) => updateObjectProp("fontSize", parseInt(e.target.value))}
                        className="w-20 bg-slate-800/50 border-slate-700 text-sm"
                      />
                      <div className="flex-1 flex flex-wrap gap-1">
                        {FONT_SIZE_PRESETS.slice(0, 6).map((size) => (
                          <button
                            key={size}
                            onClick={() => updateObjectProp("fontSize", size)}
                            className={cn(
                              "px-2 py-1 text-[10px] rounded-md transition-colors",
                              objectProps.fontSize === size
                                ? "bg-indigo-500/20 text-indigo-400"
                                : "bg-slate-800/50 text-slate-500 hover:text-slate-300"
                            )}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 文字樣式按鈕 */}
                  <div className="flex gap-1">
                    <Button
                      variant={objectProps.fontWeight === "bold" ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateObjectProp("fontWeight", objectProps.fontWeight === "bold" ? "normal" : "bold")}
                      className="flex-1 h-9"
                    >
                      <Bold className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={objectProps.fontStyle === "italic" ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateObjectProp("fontStyle", objectProps.fontStyle === "italic" ? "normal" : "italic")}
                      className="flex-1 h-9"
                    >
                      <Italic className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={objectProps.underline ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateObjectProp("underline", !objectProps.underline)}
                      className="flex-1 h-9"
                    >
                      <Underline className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* 對齊 */}
                  <div className="flex gap-1">
                    {[
                      { value: "left", icon: AlignLeft },
                      { value: "center", icon: AlignCenter },
                      { value: "right", icon: AlignRight },
                    ].map(({ value, icon: Icon }) => (
                      <Button
                        key={value}
                        variant={objectProps.textAlign === value ? "default" : "outline"}
                        size="sm"
                        onClick={() => updateObjectProp("textAlign", value)}
                        className="flex-1 h-9"
                      >
                        <Icon className="w-4 h-4" />
                      </Button>
                    ))}
                  </div>

                  {/* 行高與字距 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] text-slate-500">行高</Label>
                        <span className="text-[10px] text-indigo-400">{objectProps.lineHeight?.toFixed(2) || "1.16"}</span>
                      </div>
                      <Slider
                        value={[objectProps.lineHeight || 1.16]}
                        min={0.5}
                        max={3}
                        step={0.05}
                        onValueChange={([v]) => updateObjectProp("lineHeight", v)}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] text-slate-500">字距</Label>
                        <span className="text-[10px] text-indigo-400">{objectProps.charSpacing || 0}</span>
                      </div>
                      <Slider
                        value={[objectProps.charSpacing || 0]}
                        min={-200}
                        max={800}
                        step={10}
                        onValueChange={([v]) => updateObjectProp("charSpacing", v)}
                      />
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          <Separator className="bg-slate-700/50" />

          {/* 填充色 */}
          {!isImageObject && (
            <Collapsible open={openSections.fill} onOpenChange={() => toggleSection('fill')}>
              <CollapsibleTrigger asChild>
                <div>
                  <SectionHeader 
                    icon={Palette} 
                    title="填充" 
                    isOpen={openSections.fill}
                    onToggle={() => toggleSection('fill')}
                  />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3">
                  <ColorPicker 
                    value={objectProps.fill || "#FFFFFF"} 
                    onChange={(color) => updateObjectProp("fill", color)}
                    label="顏色"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          <Separator className="bg-slate-700/50" />

          {/* 邊框 */}
          <Collapsible open={openSections.stroke} onOpenChange={() => toggleSection('stroke')}>
            <CollapsibleTrigger asChild>
              <div>
                <SectionHeader 
                  icon={Square} 
                  title="邊框" 
                  isOpen={openSections.stroke}
                  onToggle={() => toggleSection('stroke')}
                />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3 space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={objectProps.stroke || "#000000"}
                    onChange={(e) => updateObjectProp("stroke", e.target.value)}
                    className="w-10 h-10 rounded-lg border-2 border-slate-600 cursor-pointer"
                  />
                  <div className="flex-1 space-y-1">
                    <Label className="text-[10px] text-slate-500">粗細</Label>
                    <div className="flex items-center gap-2">
                      <Slider
                        value={[objectProps.strokeWidth || 0]}
                        min={0}
                        max={20}
                        step={1}
                        onValueChange={([v]) => updateObjectProp("strokeWidth", v)}
                        className="flex-1"
                      />
                      <span className="text-xs text-slate-400 w-8 text-right">
                        {objectProps.strokeWidth || 0}px
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator className="bg-slate-700/50" />

          {/* 位置 */}
          <Collapsible open={openSections.position} onOpenChange={() => toggleSection('position')}>
            <CollapsibleTrigger asChild>
              <div>
                <SectionHeader 
                  icon={Move} 
                  title="位置與大小" 
                  isOpen={openSections.position}
                  onToggle={() => toggleSection('position')}
                />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3 space-y-3">
                {/* 快速操作按鈕 */}
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={duplicateObject}
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    複製
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => flipObject('horizontal')}
                    title="水平翻轉"
                  >
                    <FlipHorizontal className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => flipObject('vertical')}
                    title="垂直翻轉"
                  >
                    <FlipVertical className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-red-400 hover:text-red-300 hover:border-red-500/50"
                    onClick={deleteObject}
                    title="刪除"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>

                {/* 位置 */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-500">X 位置</Label>
                    <Input
                      type="number"
                      value={objectProps.left || 0}
                      onChange={(e) => updatePosition("left", parseInt(e.target.value) || 0)}
                      className="h-8 bg-slate-800/50 border-slate-700 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-500">Y 位置</Label>
                    <Input
                      type="number"
                      value={objectProps.top || 0}
                      onChange={(e) => updatePosition("top", parseInt(e.target.value) || 0)}
                      className="h-8 bg-slate-800/50 border-slate-700 text-sm"
                    />
                  </div>
                </div>

                {/* 尺寸 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-slate-500">尺寸</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-6 w-6 p-0",
                        lockAspectRatio ? "text-indigo-400" : "text-slate-500"
                      )}
                      onClick={() => setLockAspectRatio(!lockAspectRatio)}
                      title={lockAspectRatio ? "解除等比鎖定" : "鎖定等比縮放"}
                    >
                      {lockAspectRatio ? <Link className="w-3 h-3" /> : <Unlink className="w-3 h-3" />}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-500">寬度</Label>
                      <Input
                        type="number"
                        value={objectProps.width || 0}
                        onChange={(e) => updateSize("width", parseInt(e.target.value) || 1)}
                        className="h-8 bg-slate-800/50 border-slate-700 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-500">高度</Label>
                      <Input
                        type="number"
                        value={objectProps.height || 0}
                        onChange={(e) => updateSize("height", parseInt(e.target.value) || 1)}
                        className="h-8 bg-slate-800/50 border-slate-700 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* 旋轉 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-slate-500">旋轉角度</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={objectProps.angle || 0}
                        onChange={(e) => updateObjectProp("angle", parseInt(e.target.value) || 0)}
                        className="w-16 h-6 bg-slate-800/50 border-slate-700 text-xs text-center"
                      />
                      <span className="text-xs text-slate-500">°</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-6 h-6 p-0"
                        onClick={() => updateObjectProp("angle", 0)}
                        title="重置旋轉"
                      >
                        <RefreshCw className="w-3 h-3 text-slate-500" />
                      </Button>
                    </div>
                  </div>
                  <Slider
                    value={[objectProps.angle || 0]}
                    min={-180}
                    max={180}
                    step={1}
                    onValueChange={([v]) => updateObjectProp("angle", v)}
                  />
                  {/* 快速旋轉按鈕 */}
                  <div className="flex gap-1">
                    {[-90, -45, 0, 45, 90].map((angle) => (
                      <Button
                        key={angle}
                        variant="outline"
                        size="sm"
                        className={cn(
                          "flex-1 text-[10px] h-6",
                          objectProps.angle === angle ? "bg-indigo-500/20 border-indigo-500/50" : ""
                        )}
                        onClick={() => updateObjectProp("angle", angle)}
                      >
                        {angle}°
                      </Button>
                    ))}
                  </div>
                </div>

                {/* 快速對齊 */}
                <div className="space-y-2">
                  <Label className="text-[10px] text-slate-500">快速對齊到畫布</Label>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { label: "↖", pos: "tl" },
                      { label: "↑", pos: "tc" },
                      { label: "↗", pos: "tr" },
                      { label: "←", pos: "ml" },
                      { label: "●", pos: "mc" },
                      { label: "→", pos: "mr" },
                      { label: "↙", pos: "bl" },
                      { label: "↓", pos: "bc" },
                      { label: "↘", pos: "br" },
                    ].map(({ label, pos }) => (
                      <Button
                        key={pos}
                        variant="outline"
                        size="sm"
                        className="text-[10px] h-7 bg-slate-800/30"
                        onClick={() => {
                          if (!canvas || !selectedObject) return;
                          
                          const objWidth = objectProps.width || 0;
                          const objHeight = objectProps.height || 0;
                          
                          let left = 0, top = 0;
                          
                          // 水平位置
                          if (pos.endsWith('l')) left = 0;
                          else if (pos.endsWith('c')) left = (canvasWidth - objWidth) / 2;
                          else if (pos.endsWith('r')) left = canvasWidth - objWidth;
                          
                          // 垂直位置
                          if (pos.startsWith('t')) top = 0;
                          else if (pos.startsWith('m')) top = (canvasHeight - objHeight) / 2;
                          else if (pos.startsWith('b')) top = canvasHeight - objHeight;
                          
                          selectedObject.set({ left, top, originX: 'left', originY: 'top' });
                          selectedObject.setCoords();
                          canvas.renderAll();
                          updateProps();
                          
                          // 保存歷史
                          saveHistoryState('modify');
                        }}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator className="bg-slate-700/50" />

          {/* 特效 */}
          <Collapsible open={openSections.effects} onOpenChange={() => toggleSection('effects')}>
            <CollapsibleTrigger asChild>
              <div>
                <SectionHeader 
                  icon={Sparkles} 
                  title="特效" 
                  isOpen={openSections.effects}
                  onToggle={() => toggleSection('effects')}
                />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3 space-y-4">
                {/* 透明度 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-slate-400 flex items-center gap-1">
                      <Sun className="w-3.5 h-3.5" />
                      透明度
                    </Label>
                    <span className="text-xs text-indigo-400 font-mono">{objectProps.opacity || 100}%</span>
                  </div>
                  <Slider
                    value={[objectProps.opacity || 100]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={([v]) => updateOpacity(v)}
                  />
                </div>

                {/* 混合模式 */}
                <div className="space-y-2">
                  <Label className="text-xs text-slate-400 flex items-center gap-1">
                    <Blend className="w-3.5 h-3.5" />
                    混合模式
                  </Label>
                  <Select
                    value={selectedLayer?.blendMode || "source-over"}
                    onValueChange={(v) => updateBlendMode(v as BlendMode)}
                  >
                    <SelectTrigger className="bg-slate-800/50 border-slate-700 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 max-h-[200px]">
                      {BLEND_MODE_OPTIONS.map((mode) => (
                        <SelectItem key={mode.id} value={mode.id} className="text-sm">
                          <div className="flex items-center gap-2">
                            <span>{mode.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 陰影 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-slate-400 flex items-center gap-1">
                      <Layers2 className="w-3.5 h-3.5" />
                      陰影
                    </Label>
                    <Button
                      variant={objectProps.shadow ? "default" : "outline"}
                      size="sm"
                      className="h-6 text-[10px]"
                      onClick={() => {
                        if (objectProps.shadow) {
                          updateShadow(null, true);
                        } else {
                          updateShadow({
                            color: "rgba(0,0,0,0.5)",
                            blur: 10,
                            offsetX: 5,
                            offsetY: 5,
                          }, true);
                        }
                      }}
                    >
                      {objectProps.shadow ? "開啟" : "關閉"}
                    </Button>
                  </div>
                  
                  {objectProps.shadow && (
                    <div className="space-y-3 p-3 bg-slate-800/30 rounded-lg">
                      {/* 陰影顏色 */}
                      <div className="flex items-center gap-2">
                        <Label className="text-[10px] text-slate-500 w-12">顏色</Label>
                        <input
                          type="color"
                          value={(objectProps.shadow as fabric.Shadow)?.color?.toString().replace(/rgba?\([^)]+\)/, '#000000') || "#000000"}
                          onChange={(e) => updateShadow({ color: e.target.value })}
                          className="w-8 h-8 rounded border border-slate-600 cursor-pointer"
                        />
                        <Slider
                          value={[parseInt(((objectProps.shadow as fabric.Shadow)?.color?.toString().match(/[\d.]+(?=\))/)?.[0] || '0.5') as string) * 100 || 50]}
                          min={0}
                          max={100}
                          step={5}
                          className="flex-1"
                          onValueChange={([v]) => {
                            const currentColor = (objectProps.shadow as fabric.Shadow)?.color?.toString() || 'rgba(0,0,0,0.5)';
                            const rgbMatch = currentColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                            if (rgbMatch) {
                              updateShadow({ color: `rgba(${rgbMatch[1]},${rgbMatch[2]},${rgbMatch[3]},${v / 100})` });
                            }
                          }}
                        />
                      </div>
                      
                      {/* X/Y 偏移 */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-500">X 偏移</span>
                            <span className="text-[10px] text-indigo-400">{(objectProps.shadow as fabric.Shadow)?.offsetX || 0}</span>
                          </div>
                          <Slider
                            value={[(objectProps.shadow as fabric.Shadow)?.offsetX || 5]}
                            min={-50}
                            max={50}
                            step={1}
                            onValueChange={([v]) => updateShadow({ offsetX: v })}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-500">Y 偏移</span>
                            <span className="text-[10px] text-indigo-400">{(objectProps.shadow as fabric.Shadow)?.offsetY || 0}</span>
                          </div>
                          <Slider
                            value={[(objectProps.shadow as fabric.Shadow)?.offsetY || 5]}
                            min={-50}
                            max={50}
                            step={1}
                            onValueChange={([v]) => updateShadow({ offsetY: v })}
                          />
                        </div>
                      </div>
                      
                      {/* 模糊 */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500">模糊程度</span>
                          <span className="text-[10px] text-indigo-400">{(objectProps.shadow as fabric.Shadow)?.blur || 0}px</span>
                        </div>
                        <Slider
                          value={[(objectProps.shadow as fabric.Shadow)?.blur || 10]}
                          min={0}
                          max={50}
                          step={1}
                          onValueChange={([v]) => updateShadow({ blur: v })}
                        />
                      </div>
                      
                      {/* 快速預設 */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500">快速效果</span>
                        <div className="grid grid-cols-3 gap-1">
                          {[
                            { label: "輕柔", blur: 15, offsetX: 0, offsetY: 4 },
                            { label: "標準", blur: 10, offsetX: 5, offsetY: 5 },
                            { label: "強烈", blur: 20, offsetX: 8, offsetY: 8 },
                          ].map((preset) => (
                            <Button
                              key={preset.label}
                              variant="outline"
                              size="sm"
                              className="text-[10px] h-6"
                              onClick={() => updateShadow({
                                blur: preset.blur,
                                offsetX: preset.offsetX,
                                offsetY: preset.offsetY,
                              })}
                            >
                              {preset.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}
