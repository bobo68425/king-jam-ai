"use client";

/**
 * Tools Panel - 左側工具列 (改進版)
 * 提供添加元素、選擇工具等功能
 * 
 * 改進：
 * - 添加形狀下拉選單
 * - 優化視覺層次和分組
 * - 擴展工具提示顯示快捷鍵
 * - 添加工具標籤
 */

import React, { useState, useCallback, useEffect } from "react";
import { fabric } from "fabric";
import { 
  MousePointer2, 
  Type, 
  Image as ImageIcon, 
  Square, 
  Circle, 
  Triangle,
  Minus,
  Star,
  Hand,
  Upload,
  Shapes,
  Sparkles,
  LayoutTemplate,
  Hexagon,
  Heart,
  ArrowRight,
  Pentagon,
  Octagon,
  Diamond,
  ChevronDown,
  Plus,
  PanelLeft,
  PanelLeftClose,
  Undo2,
  Redo2,
  Eraser,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { backgroundRemovalService } from "@/lib/services/background-removal-service";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useDesignStudioStore, ExtendedFabricObject } from "@/stores/design-studio-store";
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";
import { useShortcutDisplay } from "@/lib/utils/keyboard";

export default function ToolsPanel() {
  const { 
    canvas, 
    activeTool, 
    setActiveTool,
    addLayer,
    canvasWidth,
    canvasHeight,
    leftPanelOpen,
    setLeftPanelOpen,
    undo,
    redo,
    historyIndex,
    history,
  } = useDesignStudioStore();

  const [shapesOpen, setShapesOpen] = useState(false);
  const [isRemovingBackground, setIsRemovingBackground] = useState(false);
  
  // 快捷鍵顯示（避免 hydration 問題）
  const { formatShortcut } = useShortcutDisplay();

  // 生成唯一 ID
  const generateId = () => uuidv4().slice(0, 8);

  // 添加文字
  const addText = () => {
    if (!canvas) return;
    
    const id = generateId();
    const text = new fabric.IText("雙擊編輯文字", {
      left: canvasWidth / 2,
      top: canvasHeight / 2,
      originX: "center",
      originY: "center",
      fontFamily: "Noto Sans TC",
      fontSize: 48,
      fill: "#FFFFFF",
      fontWeight: "bold",
      shadow: new fabric.Shadow({
        color: "rgba(0,0,0,0.5)",
        blur: 10,
        offsetX: 2,
        offsetY: 2,
      }),
    });
    
    (text as ExtendedFabricObject).id = id;
    (text as ExtendedFabricObject).name = `文字 ${id}`;
    
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
    
    addLayer({
      id,
      name: `文字 ${id}`,
      type: "text",
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: "source-over",
      fabricObject: text,
    });
  };

  // 通用形狀添加函數
  const addShape = (shapeType: string) => {
    if (!canvas) return;
    
    const id = generateId();
    let shape: fabric.Object | null = null;
    let name = "";

    switch (shapeType) {
      case "rectangle":
        shape = new fabric.Rect({
          left: canvasWidth / 2,
          top: canvasHeight / 2,
          originX: "center",
          originY: "center",
          width: 200,
          height: 150,
          fill: "#6366F1",
          rx: 8,
          ry: 8,
          stroke: "#4F46E5",
          strokeWidth: 2,
        });
        name = "矩形";
        break;

      case "circle":
        shape = new fabric.Circle({
          left: canvasWidth / 2,
          top: canvasHeight / 2,
          originX: "center",
          originY: "center",
          radius: 80,
          fill: "#EC4899",
          stroke: "#DB2777",
          strokeWidth: 2,
        });
        name = "圓形";
        break;

      case "triangle":
        shape = new fabric.Triangle({
          left: canvasWidth / 2,
          top: canvasHeight / 2,
          originX: "center",
          originY: "center",
          width: 150,
          height: 130,
          fill: "#10B981",
          stroke: "#059669",
          strokeWidth: 2,
        });
        name = "三角形";
        break;

      case "line":
        shape = new fabric.Line([
          canvasWidth / 2 - 100,
          canvasHeight / 2,
          canvasWidth / 2 + 100,
          canvasHeight / 2,
        ], {
          stroke: "#F59E0B",
          strokeWidth: 4,
          strokeLineCap: "round",
        });
        name = "直線";
        break;

      case "star":
        const starPoints = [];
        const outerRadius = 80;
        const innerRadius = 40;
        const spikes = 5;
        
        for (let i = 0; i < spikes * 2; i++) {
          const radius = i % 2 === 0 ? outerRadius : innerRadius;
          const angle = (Math.PI / spikes) * i - Math.PI / 2;
          starPoints.push({
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
          });
        }
        
        shape = new fabric.Polygon(starPoints, {
          left: canvasWidth / 2,
          top: canvasHeight / 2,
          originX: "center",
          originY: "center",
          fill: "#F59E0B",
          stroke: "#D97706",
          strokeWidth: 2,
        });
        name = "星形";
        break;

      case "heart":
        // 心形路徑
        const heartPath = "M 0 -30 C -25 -60 -60 -30 -60 0 C -60 30 -30 60 0 80 C 30 60 60 30 60 0 C 60 -30 25 -60 0 -30 Z";
        shape = new fabric.Path(heartPath, {
          left: canvasWidth / 2,
          top: canvasHeight / 2,
          originX: "center",
          originY: "center",
          fill: "#EF4444",
          stroke: "#DC2626",
          strokeWidth: 2,
          scaleX: 1.5,
          scaleY: 1.5,
        });
        name = "愛心";
        break;

      case "arrow":
        const arrowPath = "M 0 20 L 60 20 L 60 0 L 100 35 L 60 70 L 60 50 L 0 50 Z";
        shape = new fabric.Path(arrowPath, {
          left: canvasWidth / 2,
          top: canvasHeight / 2,
          originX: "center",
          originY: "center",
          fill: "#8B5CF6",
          stroke: "#7C3AED",
          strokeWidth: 2,
        });
        name = "箭頭";
        break;

      case "hexagon":
        const hexPoints = [];
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          hexPoints.push({
            x: Math.cos(angle) * 70,
            y: Math.sin(angle) * 70,
          });
        }
        shape = new fabric.Polygon(hexPoints, {
          left: canvasWidth / 2,
          top: canvasHeight / 2,
          originX: "center",
          originY: "center",
          fill: "#06B6D4",
          stroke: "#0891B2",
          strokeWidth: 2,
        });
        name = "六邊形";
        break;

      case "diamond":
        const diamondPoints = [
          { x: 0, y: -70 },
          { x: 50, y: 0 },
          { x: 0, y: 70 },
          { x: -50, y: 0 },
        ];
        shape = new fabric.Polygon(diamondPoints, {
          left: canvasWidth / 2,
          top: canvasHeight / 2,
          originX: "center",
          originY: "center",
          fill: "#14B8A6",
          stroke: "#0D9488",
          strokeWidth: 2,
        });
        name = "菱形";
        break;
    }

    if (shape) {
      (shape as ExtendedFabricObject).id = id;
      (shape as ExtendedFabricObject).name = `${name} ${id}`;
      
      canvas.add(shape);
      canvas.setActiveObject(shape);
      canvas.renderAll();
      
      addLayer({
        id,
        name: `${name} ${id}`,
        type: "shape",
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: "source-over",
        fabricObject: shape,
      });
    }
    
    setShapesOpen(false);
  };

  // 上傳圖片
  const handleUploadImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !canvas) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        fabric.Image.fromURL(dataUrl, (img) => {
          const id = generateId();
          
          // 縮放圖片以適應畫布
          const maxSize = Math.min(canvasWidth, canvasHeight) * 0.8;
          const scale = Math.min(maxSize / (img.width || 1), maxSize / (img.height || 1));
          
          img.set({
            left: canvasWidth / 2,
            top: canvasHeight / 2,
            originX: "center",
            originY: "center",
            scaleX: scale,
            scaleY: scale,
          });
          
          (img as ExtendedFabricObject).id = id;
          (img as ExtendedFabricObject).name = `圖片 ${id}`;
          
          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();
          
          addLayer({
            id,
            name: `圖片 ${id}`,
            type: "image",
            visible: true,
            locked: false,
            opacity: 1,
            blendMode: "source-over",
            fabricObject: img,
          });
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // 圖片去背功能
  const handleRemoveBackground = useCallback(async () => {
    if (!canvas) {
      toast.error("畫布未初始化");
      return;
    }

    const activeObject = canvas.getActiveObject();
    
    if (!activeObject) {
      toast.error("請先選取一張圖片");
      return;
    }

    // 檢查是否為圖片物件
    if (activeObject.type !== "image") {
      toast.error("去背功能僅適用於圖片物件");
      return;
    }

    // 確認扣點
    const confirmed = window.confirm("去背功能將扣除 1 點，確定要繼續嗎？");
    if (!confirmed) {
      return;
    }

    const fabricImage = activeObject as fabric.Image;

    // 確保物件有有效的 canvas 引用
    if (!fabricImage.canvas) {
      toast.error("無法處理此圖片，請重新選取");
      return;
    }

    setIsRemovingBackground(true);
    toast.loading("正在處理去背...", { id: "remove-bg" });

    try {
      // 取得圖片 Base64 - 使用 canvas.toDataURL 來避免 getRetinaScaling 錯誤
      let dataUrl: string;
      try {
        dataUrl = fabricImage.toDataURL({
          format: "png",
          quality: 1,
          multiplier: 1,
        });
      } catch (toDataUrlError) {
        console.error("toDataURL 失敗，嘗試替代方案:", toDataUrlError);
        // 替代方案：使用原始圖片來源
        const imgElement = fabricImage.getElement() as HTMLImageElement;
        if (imgElement && imgElement.src) {
          dataUrl = imgElement.src;
        } else {
          throw new Error("無法取得圖片資料");
        }
      }

      // 調用去背 API
      const result = await backgroundRemovalService.removeBackground({
        imageBase64: dataUrl,
        outputType: 1, // PNG 透明背景
        returnType: 2, // Base64
      });

      if (!result.success || !result.image) {
        throw new Error("去背處理失敗");
      }

      // 處理返回的 Base64 圖片
      let imageData = result.image;
      if (!imageData.startsWith("data:")) {
        imageData = `data:image/png;base64,${imageData}`;
      }

      // 載入去背後的圖片並替換原圖
      fabric.Image.fromURL(imageData, (newImg) => {
        if (!newImg) {
          toast.error("無法載入去背後的圖片", { id: "remove-bg" });
          return;
        }

        // 保留原始位置和變換
        newImg.set({
          left: fabricImage.left,
          top: fabricImage.top,
          scaleX: fabricImage.scaleX,
          scaleY: fabricImage.scaleY,
          angle: fabricImage.angle,
          originX: fabricImage.originX,
          originY: fabricImage.originY,
          flipX: fabricImage.flipX,
          flipY: fabricImage.flipY,
          opacity: fabricImage.opacity,
        });

        // 複製自定義屬性
        const extFabricImage = fabricImage as ExtendedFabricObject;
        const extNewImg = newImg as ExtendedFabricObject;
        
        // 從 store 找到對應的圖層
        const { layers, updateLayer } = useDesignStudioStore.getState();
        const existingLayer = layers.find(l => l.fabricObject === fabricImage || l.id === extFabricImage.id);
        
        if (existingLayer) {
          // 使用現有圖層的 ID
          extNewImg.id = existingLayer.id;
          extNewImg.name = (existingLayer.name || '圖片') + " (已去背)";
        } else {
          // 沒有找到圖層，使用原始 ID 或生成新的
          extNewImg.id = extFabricImage.id || `img_${Date.now()}`;
          extNewImg.name = (extFabricImage.name || '圖片') + " (已去背)";
        }

        // 替換物件
        canvas.remove(fabricImage);
        canvas.add(newImg);
        canvas.setActiveObject(newImg);
        canvas.renderAll();

        // 更新圖層
        if (existingLayer) {
          updateLayer(existingLayer.id, {
            name: extNewImg.name,
            fabricObject: newImg,
          });
          console.log("[去背] 圖層已更新:", existingLayer.id);
        } else {
          // 如果沒有找到圖層，新增一個
          const { addLayer } = useDesignStudioStore.getState();
          addLayer({
            id: extNewImg.id!,
            name: extNewImg.name!,
            type: "image",
            visible: true,
            locked: false,
            opacity: newImg.opacity || 1,
            blendMode: "source-over",
            fabricObject: newImg,
          });
          console.log("[去背] 新增圖層:", extNewImg.id);
        }

        toast.success("去背完成！", { id: "remove-bg" });
      }, { crossOrigin: "anonymous" });

    } catch (error) {
      console.error("去背失敗:", error);
      toast.error(error instanceof Error ? error.message : "去背處理失敗", { id: "remove-bg" });
    } finally {
      setIsRemovingBackground(false);
    }
  }, [canvas]);

  // 監聽去背快捷鍵事件
  useEffect(() => {
    const handleTriggerRemoveBackground = () => {
      if (!isRemovingBackground) {
        handleRemoveBackground();
      }
    };

    window.addEventListener('triggerRemoveBackground', handleTriggerRemoveBackground);
    return () => {
      window.removeEventListener('triggerRemoveBackground', handleTriggerRemoveBackground);
    };
  }, [isRemovingBackground, handleRemoveBackground]);

  // 形狀選項列表
  const shapeOptions = [
    { id: "rectangle", icon: Square, label: "矩形", color: "#6366F1" },
    { id: "circle", icon: Circle, label: "圓形", color: "#EC4899" },
    { id: "triangle", icon: Triangle, label: "三角形", color: "#10B981" },
    { id: "star", icon: Star, label: "星形", color: "#F59E0B" },
    { id: "heart", icon: Heart, label: "愛心", color: "#EF4444" },
    { id: "hexagon", icon: Hexagon, label: "六邊形", color: "#06B6D4" },
    { id: "diamond", icon: Diamond, label: "菱形", color: "#14B8A6" },
    { id: "arrow", icon: ArrowRight, label: "箭頭", color: "#8B5CF6" },
    { id: "line", icon: Minus, label: "直線", color: "#F59E0B" },
  ];

  // 工具按鈕組件（改進版）
  const ToolButton = ({ 
    icon: Icon, 
    label, 
    shortcut,
    onClick, 
    active = false,
    disabled = false,
  }: { 
    icon: React.ElementType; 
    label: string; 
    shortcut?: string;
    onClick: () => void; 
    active?: boolean;
    disabled?: boolean;
  }) => (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClick}
            disabled={disabled}
            className={cn(
              "w-11 h-11 p-0 rounded-xl transition-all duration-200",
              active 
                ? "bg-indigo-500/20 text-indigo-500 dark:text-indigo-400 border border-indigo-500/50 shadow-lg shadow-indigo-500/20" 
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700/50",
              disabled && "opacity-40 cursor-not-allowed"
            )}
          >
            <Icon className="w-5 h-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent 
          side="right" 
          className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 flex items-center gap-2"
        >
          <span className="text-sm font-medium text-slate-800 dark:text-white">{label}</span>
          {shortcut && (
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              {shortcut}
            </kbd>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  // 分組標題
  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium px-2 mb-1">
      {children}
    </div>
  );

  return (
    <div className="w-[72px] flex-shrink-0 bg-slate-100 dark:bg-slate-900/95 backdrop-blur-sm border-r border-slate-200 dark:border-slate-700/50 flex flex-col items-center py-3 gap-1 z-20 relative">
      {/* 面板開關 */}
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLeftPanelOpen(!leftPanelOpen)}
              className="w-11 h-9 p-0 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700/50 mb-1"
            >
              {leftPanelOpen ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeft className="w-4 h-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <span className="text-xs text-slate-800 dark:text-white">{leftPanelOpen ? "收合面板" : "展開面板"}</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Separator className="my-1 w-10 bg-slate-300 dark:bg-slate-700/50" />

      {/* 復原/重做 */}
      <div className="flex gap-0.5 mb-1">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={undo}
                disabled={historyIndex <= 0}
                className={cn(
                  "w-8 h-8 p-0 rounded-lg transition-all",
                  historyIndex <= 0 
                    ? "text-slate-400 dark:text-slate-600 cursor-not-allowed" 
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700/50"
                )}
              >
                <Undo2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-800 dark:text-white">復原</span>
                <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px] text-slate-500 dark:text-slate-400">{formatShortcut('cmd+z')}</kbd>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                className={cn(
                  "w-8 h-8 p-0 rounded-lg transition-all",
                  historyIndex >= history.length - 1
                    ? "text-slate-400 dark:text-slate-600 cursor-not-allowed" 
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700/50"
                )}
              >
                <Redo2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-800 dark:text-white">重做</span>
                <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px] text-slate-500 dark:text-slate-400">{formatShortcut('cmd+shift+z')}</kbd>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Separator className="my-1 w-10 bg-slate-300 dark:bg-slate-700/50" />
      
      {/* 選取工具組 */}
      <SectionLabel>工具</SectionLabel>
      
      <ToolButton
        icon={MousePointer2}
        label="選取"
        shortcut="V"
        onClick={() => setActiveTool("select")}
        active={activeTool === "select"}
      />
      
      <ToolButton
        icon={Hand}
        label="平移"
        shortcut="H"
        onClick={() => setActiveTool("pan")}
        active={activeTool === "pan"}
      />
      
      <Separator className="my-2 w-10 bg-slate-300 dark:bg-slate-700/50" />
      
      {/* 添加元素組 */}
      <SectionLabel>添加</SectionLabel>
      
      <ToolButton
        icon={Type}
        label="文字"
        shortcut="T"
        onClick={addText}
      />
      
      <ToolButton
        icon={Upload}
        label="上傳圖片"
        shortcut="U"
        onClick={handleUploadImage}
      />
      
      {/* 形狀下拉選單 */}
      <DropdownMenu open={shapesOpen} onOpenChange={setShapesOpen}>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "w-11 h-11 p-0 rounded-xl transition-all duration-200 relative",
                    shapesOpen 
                      ? "bg-indigo-500/20 text-indigo-500 dark:text-indigo-400 border border-indigo-500/50" 
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700/50"
                  )}
                >
                  <Shapes className="w-5 h-5" />
                  <ChevronDown className="w-2.5 h-2.5 absolute bottom-1.5 right-1.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <span className="text-sm font-medium text-slate-800 dark:text-white">形狀</span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <DropdownMenuContent 
          side="right" 
          align="start"
          className="w-48 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 p-2"
        >
          <DropdownMenuLabel className="text-xs text-slate-500 dark:text-slate-400 font-normal">
            選擇形狀
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-slate-200 dark:bg-slate-700" />
          
          <div className="grid grid-cols-3 gap-1 p-1">
            {shapeOptions.map((shape) => (
              <button
                key={shape.id}
                onClick={() => addShape(shape.id)}
                className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors group"
              >
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${shape.color}20` }}
                >
                  <shape.icon className="w-4 h-4" style={{ color: shape.color }} />
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white">
                  {shape.label}
                </span>
              </button>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      
      <Separator className="my-2 w-10 bg-slate-300 dark:bg-slate-700/50" />
      
      {/* 進階功能 */}
      <SectionLabel>功能</SectionLabel>
      
      <ToolButton
        icon={LayoutTemplate}
        label="範本庫"
        onClick={() => {
          // 觸發模板面板
          const event = new CustomEvent('openTemplates');
          window.dispatchEvent(event);
        }}
      />
      
      <ToolButton
        icon={Sparkles}
        label="AI 生成"
        shortcut={formatShortcut('cmd+g')}
        onClick={() => {
          // 提示用戶使用其他引擎生成圖片後導入
          toast.info("AI 生成圖片", {
            description: "請使用「社群圖文」或「部落格」引擎生成圖片，再從「圖庫」導入編輯",
            duration: 5000,
          });
        }}
      />

      {/* 去背功能 */}
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveBackground}
              disabled={isRemovingBackground}
              className={cn(
                "w-11 h-11 p-0 rounded-xl transition-all duration-200",
                isRemovingBackground 
                  ? "bg-pink-500/20 text-pink-500 dark:text-pink-400 border border-pink-500/50" 
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700/50"
              )}
            >
              {isRemovingBackground ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Eraser className="w-5 h-5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent 
            side="right" 
            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 flex items-center gap-2"
          >
            <span className="text-sm font-medium text-slate-800 dark:text-white">圖片去背</span>
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              {formatShortcut('cmd+b')}
            </kbd>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* 底部空間 */}
      <div className="flex-1" />

      {/* 版本資訊 */}
      <div className="text-[9px] text-slate-500 dark:text-slate-600 text-center px-2">
        v2.0
      </div>
    </div>
  );
}
