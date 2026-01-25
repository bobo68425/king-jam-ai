"use client";

/**
 * Layers Panel - 圖層管理面板
 * 類似 Photoshop 的圖層系統，支援拖曳排序
 */

import React, { useRef, useState } from "react";
import { fabric } from "fabric";
import { ExtendedFabricObject } from "@/stores/design-studio-store";
import { 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  Trash2, 
  Copy, 
  ChevronUp, 
  ChevronDown,
  Type,
  Image as ImageIcon,
  Square,
  Layers,
  MoreVertical,
  Plus,
  Upload,
  FileImage,
  PenTool,
  Circle,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDesignStudioStore, LayerData, ObjectType } from "@/stores/design-studio-store";
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";

// 物件類型圖示
const TypeIcon = ({ type }: { type: ObjectType }) => {
  switch (type) {
    case "text":
      return <Type className="w-4 h-4 text-blue-400" />;
    case "image":
      return <ImageIcon className="w-4 h-4 text-green-400" />;
    case "shape":
      return <Square className="w-4 h-4 text-purple-400" />;
    default:
      return <Layers className="w-4 h-4 text-slate-400" />;
  }
};

export default function LayersPanel() {
  const {
    canvas,
    layers,
    selectedObjectIds,
    setSelectedObjects,
    updateLayer,
    removeLayer,
    reorderLayers,
    addLayer,
    canvasWidth,
    canvasHeight,
  } = useDesignStudioStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 拖曳排序狀態
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // 生成唯一 ID
  const generateId = () => uuidv4().slice(0, 8);

  // 添加文字圖層
  const addTextLayer = () => {
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
    
    toast.success("已新增文字圖層");
  };

  // 添加矩形圖層
  const addRectLayer = () => {
    if (!canvas) return;
    
    const id = generateId();
    const rect = new fabric.Rect({
      left: canvasWidth / 2,
      top: canvasHeight / 2,
      originX: "center",
      originY: "center",
      width: 200,
      height: 150,
      fill: "#6366F1",
      rx: 8,
      ry: 8,
    });
    
    (rect as ExtendedFabricObject).id = id;
    (rect as ExtendedFabricObject).name = `矩形 ${id}`;
    
    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.renderAll();
    
    addLayer({
      id,
      name: `矩形 ${id}`,
      type: "shape",
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: "source-over",
      fabricObject: rect,
    });
    
    toast.success("已新增矩形圖層");
  };

  // 添加圓形圖層
  const addCircleLayer = () => {
    if (!canvas) return;
    
    const id = generateId();
    const circle = new fabric.Circle({
      left: canvasWidth / 2,
      top: canvasHeight / 2,
      originX: "center",
      originY: "center",
      radius: 80,
      fill: "#EC4899",
    });
    
    (circle as ExtendedFabricObject).id = id;
    (circle as ExtendedFabricObject).name = `圓形 ${id}`;
    
    canvas.add(circle);
    canvas.setActiveObject(circle);
    canvas.renderAll();
    
    addLayer({
      id,
      name: `圓形 ${id}`,
      type: "shape",
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: "source-over",
      fabricObject: circle,
    });
    
    toast.success("已新增圓形圖層");
  };

  // 上傳圖片
  const handleUploadImage = () => {
    fileInputRef.current?.click();
  };

  // 處理圖片上傳
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canvas) return;
    
    // 檢查檔案類型
    if (!file.type.startsWith("image/")) {
      toast.error("請選擇圖片檔案");
      return;
    }

    // 檢查檔案大小（限制 10MB）
    if (file.size > 10 * 1024 * 1024) {
      toast.error("圖片大小不能超過 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      fabric.Image.fromURL(dataUrl, (img) => {
        const id = generateId();
        
        // 縮放圖片以適應畫布
        const maxSize = Math.min(canvasWidth, canvasHeight) * 0.8;
        const scale = Math.min(
          maxSize / (img.width || 1), 
          maxSize / (img.height || 1),
          1 // 不放大小圖片
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
        
        toast.success("圖片已匯入");
      });
    };
    reader.readAsDataURL(file);
    
    // 清空 input 以便重複上傳同一檔案
    e.target.value = "";
  };

  // 從 URL 匯入圖片
  const importFromURL = () => {
    const url = prompt("請輸入圖片網址：");
    if (!url || !canvas) return;

    // 簡單的 URL 驗證
    try {
      new URL(url);
    } catch {
      toast.error("請輸入有效的網址");
      return;
    }

    toast.loading("正在載入圖片...");

    fabric.Image.fromURL(
      url,
      (img) => {
        if (!img || !img.width) {
          toast.dismiss();
          toast.error("無法載入圖片，請確認網址正確");
          return;
        }

        const id = generateId();
        
        // 縮放圖片以適應畫布
        const maxSize = Math.min(canvasWidth, canvasHeight) * 0.8;
        const scale = Math.min(
          maxSize / (img.width || 1), 
          maxSize / (img.height || 1),
          1
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
        
        toast.dismiss();
        toast.success("圖片已匯入");
      },
      { crossOrigin: "anonymous" }
    );
  };

  // 選取圖層
  const handleSelectLayer = (layer: LayerData) => {
    if (!canvas || !layer.fabricObject) return;
    
    canvas.setActiveObject(layer.fabricObject);
    canvas.renderAll();
    setSelectedObjects([layer.id]);
  };

  // 切換可見性
  const toggleVisibility = (layer: LayerData) => {
    if (!canvas || !layer.fabricObject) return;
    
    const newVisible = !layer.visible;
    layer.fabricObject.set("visible", newVisible);
    canvas.renderAll();
    updateLayer(layer.id, { visible: newVisible });
  };

  // 切換鎖定
  const toggleLock = (layer: LayerData) => {
    if (!canvas || !layer.fabricObject) return;
    
    const newLocked = !layer.locked;
    layer.fabricObject.set({
      selectable: !newLocked,
      evented: !newLocked,
    });
    canvas.renderAll();
    updateLayer(layer.id, { locked: newLocked });
  };

  // 刪除圖層
  const deleteLayer = (layer: LayerData) => {
    if (!canvas || !layer.fabricObject) return;
    
    canvas.remove(layer.fabricObject);
    canvas.renderAll();
    removeLayer(layer.id);
  };

  // 複製圖層
  const duplicateLayer = (layer: LayerData) => {
    if (!canvas || !layer.fabricObject) return;
    
    layer.fabricObject.clone((cloned: fabric.Object) => {
      const newId = `${layer.id}-copy`;
      const extCloned = cloned as ExtendedFabricObject;
      cloned.set({
        left: (cloned.left || 0) + 20,
        top: (cloned.top || 0) + 20,
      });
      extCloned.id = newId;
      extCloned.name = `${layer.name} 副本`;
      
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.renderAll();
      
      // 添加到圖層
      const index = layers.findIndex((l) => l.id === layer.id);
      const newLayer: LayerData = {
        id: newId,
        name: `${layer.name} 副本`,
        type: layer.type,
        visible: true,
        locked: false,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        fabricObject: cloned,
      };
      
      // 插入到原圖層上方
      useDesignStudioStore.setState((state) => ({
        layers: [
          ...state.layers.slice(0, index),
          newLayer,
          ...state.layers.slice(index),
        ],
      }));
    });
  };

  // 上移圖層
  const moveLayerUp = (index: number) => {
    if (index === 0 || !canvas) return;
    
    const layer = layers[index];
    if (layer.fabricObject) {
      layer.fabricObject.bringForward();
      canvas.renderAll();
    }
    
    reorderLayers(index, index - 1);
  };

  // 下移圖層
  const moveLayerDown = (index: number) => {
    if (index === layers.length - 1 || !canvas) return;
    
    const layer = layers[index];
    if (layer.fabricObject) {
      layer.fabricObject.sendBackwards();
      canvas.renderAll();
    }
    
    reorderLayers(index, index + 1);
  };

  // ========================================
  // 拖曳排序處理
  // ========================================
  
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    
    // 設定拖曳時的外觀
    const target = e.target as HTMLElement;
    target.style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    
    // 更新圖層順序
    const draggedLayer = layers[draggedIndex];
    if (draggedLayer?.fabricObject && canvas) {
      // 計算 Fabric.js 中的 z-index 變化
      const objects = canvas.getObjects().filter((obj) => !(obj as ExtendedFabricObject).isGrid);
      const fabricIndex = objects.indexOf(draggedLayer.fabricObject);
      
      if (draggedIndex < dropIndex) {
        // 向下移動（在畫布上實際上是向後移動）
        for (let i = 0; i < dropIndex - draggedIndex; i++) {
          draggedLayer.fabricObject.sendBackwards();
        }
      } else {
        // 向上移動（在畫布上實際上是向前移動）
        for (let i = 0; i < draggedIndex - dropIndex; i++) {
          draggedLayer.fabricObject.bringForward();
        }
      }
      canvas.renderAll();
    }
    
    reorderLayers(draggedIndex, dropIndex);
    setDraggedIndex(null);
    setDragOverIndex(null);
    
    toast.success("圖層順序已更新");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 隱藏的檔案上傳 input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* 標題 */}
      <div className="p-3 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            圖層
          </h3>
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500 mr-2">{layers.length} 個</span>
            
            {/* 新增圖層下拉選單 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-7 h-7 p-0 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="bg-slate-800 border-slate-700 w-48"
              >
                <DropdownMenuItem
                  onClick={addTextLayer}
                  className="text-xs cursor-pointer"
                >
                  <Type className="w-4 h-4 mr-2 text-blue-400" />
                  新增文字
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={addRectLayer}
                  className="text-xs cursor-pointer"
                >
                  <Square className="w-4 h-4 mr-2 text-purple-400" />
                  新增矩形
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={addCircleLayer}
                  className="text-xs cursor-pointer"
                >
                  <Circle className="w-4 h-4 mr-2 text-pink-400" />
                  新增圓形
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-700" />
                <DropdownMenuItem
                  onClick={handleUploadImage}
                  className="text-xs cursor-pointer"
                >
                  <Upload className="w-4 h-4 mr-2 text-green-400" />
                  上傳圖片
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={importFromURL}
                  className="text-xs cursor-pointer"
                >
                  <FileImage className="w-4 h-4 mr-2 text-cyan-400" />
                  從網址匯入
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* 快速操作按鈕 */}
      <div className="p-2 border-b border-slate-700/50 flex gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={addTextLayer}
          className="flex-1 h-8 text-xs bg-slate-800/50 border-slate-700 hover:bg-indigo-500/20 hover:border-indigo-500/50"
        >
          <Type className="w-3.5 h-3.5 mr-1" />
          文字
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleUploadImage}
          className="flex-1 h-8 text-xs bg-slate-800/50 border-slate-700 hover:bg-green-500/20 hover:border-green-500/50"
        >
          <Upload className="w-3.5 h-3.5 mr-1" />
          圖片
        </Button>
      </div>
      
      {/* 圖層列表 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {layers.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>尚無圖層</p>
            <p className="text-xs mt-1">點擊上方按鈕新增</p>
          </div>
        ) : (
          layers.map((layer, index) => {
            const isSelected = selectedObjectIds.includes(layer.id);
            const isDragging = draggedIndex === index;
            const isDragOver = dragOverIndex === index;
            
            return (
              <div
                key={layer.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onClick={() => handleSelectLayer(layer)}
                className={cn(
                  "group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all",
                  isSelected
                    ? "bg-indigo-500/20 border border-indigo-500/50"
                    : "hover:bg-slate-800/50 border border-transparent",
                  layer.locked && "opacity-60",
                  isDragging && "opacity-50 scale-95",
                  isDragOver && "border-indigo-400 border-dashed bg-indigo-500/10"
                )}
              >
                <TooltipProvider delayDuration={400}>
                  {/* 拖曳手柄 */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
                        <GripVertical className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="bg-slate-800 border-slate-700 text-xs">
                      拖曳排序
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                {/* 類型圖示 */}
                <TypeIcon type={layer.type} />
                
                {/* 名稱 */}
                <span className="flex-1 text-xs text-slate-300 truncate">
                  {layer.name}
                </span>
                
                {/* 操作按鈕 */}
                <TooltipProvider delayDuration={300}>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* 可見性 */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleVisibility(layer);
                          }}
                          className="p-1 rounded hover:bg-slate-700"
                        >
                          {layer.visible ? (
                            <Eye className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-slate-800 border-slate-700 text-xs">
                        {layer.visible ? "隱藏圖層" : "顯示圖層"}
                      </TooltipContent>
                    </Tooltip>
                    
                    {/* 鎖定 */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLock(layer);
                          }}
                          className="p-1 rounded hover:bg-slate-700"
                        >
                          {layer.locked ? (
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                          ) : (
                            <Unlock className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-slate-800 border-slate-700 text-xs">
                        {layer.locked ? "解鎖圖層" : "鎖定圖層"}
                      </TooltipContent>
                    </Tooltip>
                    
                    {/* 更多選項 */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 rounded hover:bg-slate-700"
                      >
                        <MoreVertical className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      align="end" 
                      className="bg-slate-800 border-slate-700"
                    >
                      <DropdownMenuItem
                        onClick={() => moveLayerUp(index)}
                        disabled={index === 0}
                        className="text-xs"
                      >
                        <ChevronUp className="w-3.5 h-3.5 mr-2" />
                        上移一層
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => moveLayerDown(index)}
                        disabled={index === layers.length - 1}
                        className="text-xs"
                      >
                        <ChevronDown className="w-3.5 h-3.5 mr-2" />
                        下移一層
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => duplicateLayer(layer)}
                        className="text-xs"
                      >
                        <Copy className="w-3.5 h-3.5 mr-2" />
                        複製圖層
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deleteLayer(layer)}
                        className="text-xs text-red-400 focus:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" />
                        刪除圖層
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  </div>
                </TooltipProvider>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
