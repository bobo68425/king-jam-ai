"use client";

/**
 * Layers Panel - 圖層管理面板 (優化版)
 * 類似 Photoshop 的圖層系統
 * 
 * 優化：
 * - 淺色/深色模式支持
 * - 圖層縮圖預覽
 * - 圖層重命名
 * - 更好的拖曳排序體驗
 * - 透明度快速調整
 * - 移到最上/最下功能
 */

import React, { useRef, useState, useCallback } from "react";
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
  ChevronsUp,
  ChevronsDown,
  Type,
  Image as ImageIcon,
  Square,
  Layers,
  MoreVertical,
  Plus,
  Upload,
  FileImage,
  Circle,
  GripVertical,
  Pencil,
  Check,
  X,
  Scissors,
  Link,
  Unlink,
  Group,
  Ungroup,
  FolderOpen,
  Folder,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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
const TypeIcon = ({ type, isExpanded }: { type: ObjectType; isExpanded?: boolean }) => {
  switch (type) {
    case "text":
      return <Type className="w-4 h-4 text-blue-500 dark:text-blue-400" />;
    case "image":
      return <ImageIcon className="w-4 h-4 text-green-500 dark:text-green-400" />;
    case "shape":
      return <Square className="w-4 h-4 text-purple-500 dark:text-purple-400" />;
    case "group":
      return isExpanded 
        ? <FolderOpen className="w-4 h-4 text-orange-500 dark:text-orange-400" />
        : <Folder className="w-4 h-4 text-orange-500 dark:text-orange-400" />;
    default:
      return <Layers className="w-4 h-4 text-slate-500 dark:text-slate-400" />;
  }
};

// 圖層縮圖組件 - 使用類型圖示代替實際縮圖以避免 Fabric.js 相容性問題
const LayerThumbnail = ({ layer, isExpanded }: { layer: LayerData; isExpanded?: boolean }) => {
  // 根據圖層類型和狀態顯示對應的視覺效果
  const getBackgroundColor = () => {
    if (!layer.visible) return "bg-slate-300 dark:bg-slate-600";
    switch (layer.type) {
      case "text":
        return "bg-blue-100 dark:bg-blue-900/30";
      case "image":
        return "bg-green-100 dark:bg-green-900/30";
      case "shape":
        return "bg-purple-100 dark:bg-purple-900/30";
      case "group":
        return "bg-orange-100 dark:bg-orange-900/30";
      default:
        return "bg-slate-200 dark:bg-slate-700/50";
    }
  };
  
  return (
    <div className={cn(
      "w-8 h-8 rounded flex items-center justify-center border transition-colors",
      getBackgroundColor(),
      layer.visible 
        ? "border-slate-300 dark:border-slate-600" 
        : "border-slate-400 dark:border-slate-500"
    )}>
      <TypeIcon type={layer.type} isExpanded={isExpanded} />
    </div>
  );
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
  
  // 重命名狀態
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  
  // 展開透明度調整的圖層
  const [expandedLayerId, setExpandedLayerId] = useState<string | null>(null);

  // 群組展開狀態（存儲已展開的群組 ID）
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // 切換群組展開/收合
  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

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
    
    if (!file.type.startsWith("image/")) {
      toast.error("請選擇圖片檔案");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("圖片大小不能超過 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      fabric.Image.fromURL(dataUrl, (img) => {
        const id = generateId();
        
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
        (img as ExtendedFabricObject).name = file.name.replace(/\.[^/.]+$/, "") || `圖片 ${id}`;
        
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        
        addLayer({
          id,
          name: (img as ExtendedFabricObject).name || `圖片 ${id}`,
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
    
    e.target.value = "";
  };

  // 從 URL 匯入圖片
  const importFromURL = () => {
    const url = prompt("請輸入圖片網址：");
    if (!url || !canvas) return;

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

  // 記錄最後點擊的圖層索引（用於 Shift 範圍選取）
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  // 選取圖層（支援多選）
  const handleSelectLayer = (layer: LayerData, index: number, e: React.MouseEvent) => {
    if (!canvas || !layer.fabricObject) return;
    // 確保 fabricObject 有綁定到 canvas
    if (!layer.fabricObject.canvas) return;
    
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;
    
    if (isCtrlOrCmd) {
      // Ctrl/Cmd + 點擊：切換選取狀態
      const isCurrentlySelected = selectedObjectIds.includes(layer.id);
      let newSelectedIds: string[];
      
      if (isCurrentlySelected) {
        // 取消選取
        newSelectedIds = selectedObjectIds.filter(id => id !== layer.id);
      } else {
        // 添加到選取
        newSelectedIds = [...selectedObjectIds, layer.id];
      }
      
      // 更新 Fabric.js 選取狀態
      if (newSelectedIds.length === 0) {
        canvas.discardActiveObject();
      } else if (newSelectedIds.length === 1) {
        const selectedLayer = layers.find(l => l.id === newSelectedIds[0]);
        if (selectedLayer?.fabricObject) {
          canvas.setActiveObject(selectedLayer.fabricObject);
        }
      } else {
        // 多選 - 創建 ActiveSelection
        const selectedObjects = layers
          .filter(l => newSelectedIds.includes(l.id) && l.fabricObject)
          .map(l => l.fabricObject!);
        const selection = new fabric.ActiveSelection(selectedObjects, { canvas });
        canvas.setActiveObject(selection);
      }
      
      canvas.renderAll();
      setSelectedObjects(newSelectedIds);
      setLastClickedIndex(index);
      
    } else if (isShift && lastClickedIndex !== null) {
      // Shift + 點擊：範圍選取
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const rangeIds = layers.slice(start, end + 1).map(l => l.id);
      
      // 更新 Fabric.js 選取狀態
      if (rangeIds.length === 1) {
        const selectedLayer = layers.find(l => l.id === rangeIds[0]);
        if (selectedLayer?.fabricObject) {
          canvas.setActiveObject(selectedLayer.fabricObject);
        }
      } else {
        const selectedObjects = layers
          .filter(l => rangeIds.includes(l.id) && l.fabricObject)
          .map(l => l.fabricObject!);
        const selection = new fabric.ActiveSelection(selectedObjects, { canvas });
        canvas.setActiveObject(selection);
      }
      
      canvas.renderAll();
      setSelectedObjects(rangeIds);
      
    } else {
      // 普通點擊：單選
      canvas.setActiveObject(layer.fabricObject);
      canvas.renderAll();
      setSelectedObjects([layer.id]);
      setLastClickedIndex(index);
    }
  };

  // 切換可見性
  const toggleVisibility = (layer: LayerData) => {
    if (!canvas || !layer.fabricObject) return;
    if (!layer.fabricObject.canvas) return;
    
    const newVisible = !layer.visible;
    layer.fabricObject.set("visible", newVisible);
    canvas.renderAll();
    updateLayer(layer.id, { visible: newVisible });
  };

  // 切換鎖定
  const toggleLock = (layer: LayerData) => {
    if (!canvas || !layer.fabricObject) return;
    if (!layer.fabricObject.canvas) return;
    
    const newLocked = !layer.locked;
    layer.fabricObject.set({
      selectable: !newLocked,
      evented: !newLocked,
    });
    canvas.renderAll();
    updateLayer(layer.id, { locked: newLocked });
  };

  // 刪除圖層（處理遮罩綁定）
  const deleteLayer = (layer: LayerData) => {
    if (!canvas) return;
    
    // 情況 1: 此圖層有遮罩 - 同時刪除遮罩圖層
    if (layer.clipMaskId) {
      const maskLayer = layers.find(l => l.id === layer.clipMaskId);
      if (maskLayer?.fabricObject) {
        canvas.remove(maskLayer.fabricObject);
        removeLayer(maskLayer.id);
      }
    }
    
    // 情況 2: 此圖層是遮罩 - 移除被遮罩圖層的 clipPath
    if (layer.isClipMask) {
      const maskedLayers = layers.filter(l => l.clipMaskId === layer.id);
      maskedLayers.forEach(maskedLayer => {
        if (maskedLayer.fabricObject) {
          maskedLayer.fabricObject.clipPath = undefined;
          maskedLayer.fabricObject.dirty = true;
          updateLayer(maskedLayer.id, { clipMaskId: undefined });
        }
      });
    }
    
    // 刪除此圖層
    if (layer.fabricObject) {
      if (layer.fabricObject.canvas) {
        canvas.remove(layer.fabricObject);
      }
    }
    
    canvas.renderAll();
    removeLayer(layer.id);
    toast.success("圖層已刪除");
  };

  // 複製圖層（處理遮罩綁定）
  const duplicateLayer = (layer: LayerData) => {
    if (!canvas || !layer.fabricObject) return;
    
    // 如果有遮罩，先複製遮罩物件
    let newMaskId: string | undefined;
    const maskLayer = layer.clipMaskId ? layers.find(l => l.id === layer.clipMaskId) : null;
    
    if (maskLayer?.fabricObject) {
      maskLayer.fabricObject.clone((clonedMask: fabric.Object) => {
        newMaskId = generateId();
        const extMask = clonedMask as ExtendedFabricObject;
        clonedMask.set({
          left: (clonedMask.left || 0) + 20,
          top: (clonedMask.top || 0) + 20,
        });
        extMask.id = newMaskId;
        extMask.name = `${maskLayer.name} 副本`;
        (extMask as any).isClipMask = true;
        (extMask as any).originalFill = (maskLayer.fabricObject as any).originalFill;
        (extMask as any).originalStroke = (maskLayer.fabricObject as any).originalStroke;
        (extMask as any).originalStrokeWidth = (maskLayer.fabricObject as any).originalStrokeWidth;
        (extMask as any).originalOpacity = (maskLayer.fabricObject as any).originalOpacity;
        
        canvas.add(clonedMask);
        
        const maskIndex = layers.findIndex((l) => l.id === maskLayer.id);
        const newMaskLayer: LayerData = {
          id: newMaskId!,
          name: `${maskLayer.name} 副本`,
          type: maskLayer.type,
          visible: true,
          locked: false,
          opacity: clonedMask.opacity || 1,
          blendMode: maskLayer.blendMode,
          fabricObject: clonedMask,
          isClipMask: true,
          originalMaskStyle: maskLayer.originalMaskStyle,
        };
        
        useDesignStudioStore.setState((state) => ({
          layers: [
            ...state.layers.slice(0, maskIndex),
            newMaskLayer,
            ...state.layers.slice(maskIndex),
          ],
        }));
      });
    }
    
    layer.fabricObject.clone((cloned: fabric.Object) => {
      const newId = generateId();
      const extCloned = cloned as ExtendedFabricObject;
      cloned.set({
        left: (cloned.left || 0) + 20,
        top: (cloned.top || 0) + 20,
      });
      extCloned.id = newId;
      extCloned.name = `${layer.name} 副本`;
      
      // 如果有遮罩，重建 clipPath
      if (newMaskId && maskLayer?.fabricObject) {
        (extCloned as any).clipMaskId = newMaskId;
        
        // 建立 clipPath（偏移量不變，因為都偏移 20）
        const clipProps = {
          left: 0,
          top: 0,
          scaleX: maskLayer.fabricObject.scaleX || 1,
          scaleY: maskLayer.fabricObject.scaleY || 1,
          angle: maskLayer.fabricObject.angle || 0,
          originX: 'center' as const,
          originY: 'center' as const,
          absolutePositioned: false,
        };
        
        let clipPath: fabric.Object | null = null;
        const maskType = maskLayer.fabricObject.type;
        
        if (maskType === 'circle') {
          clipPath = new fabric.Circle({
            radius: (maskLayer.fabricObject as fabric.Circle).radius,
            ...clipProps,
          });
        } else if (maskType === 'rect') {
          clipPath = new fabric.Rect({
            width: (maskLayer.fabricObject as fabric.Rect).width,
            height: (maskLayer.fabricObject as fabric.Rect).height,
            rx: (maskLayer.fabricObject as fabric.Rect).rx,
            ry: (maskLayer.fabricObject as fabric.Rect).ry,
            ...clipProps,
          });
        } else if (maskType === 'ellipse') {
          clipPath = new fabric.Ellipse({
            rx: (maskLayer.fabricObject as fabric.Ellipse).rx,
            ry: (maskLayer.fabricObject as fabric.Ellipse).ry,
            ...clipProps,
          });
        } else if (maskType === 'triangle') {
          clipPath = new fabric.Triangle({
            width: (maskLayer.fabricObject as fabric.Triangle).width,
            height: (maskLayer.fabricObject as fabric.Triangle).height,
            ...clipProps,
          });
        }
        
        if (clipPath) {
          cloned.clipPath = clipPath;
          cloned.dirty = true;
        }
      }
      
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.renderAll();
      
      const index = layers.findIndex((l) => l.id === layer.id);
      
      // 處理群組複製
      if (layer.isGroup) {
        (extCloned as any).isGroup = true;
        // 為群組內的物件更新 ID
        const newChildIds: string[] = [];
        if (cloned.type === 'group') {
          const groupObj = cloned as fabric.Group;
          groupObj.getObjects().forEach((childObj) => {
            const childId = generateId();
            (childObj as any).id = childId;
            newChildIds.push(childId);
          });
        }
        
        const newLayer: LayerData = {
          id: newId,
          name: `${layer.name} 副本`,
          type: 'group',
          visible: true,
          locked: false,
          opacity: layer.opacity,
          blendMode: layer.blendMode,
          fabricObject: cloned,
          isGroup: true,
          childIds: newChildIds,
        };
        
        useDesignStudioStore.setState((state) => ({
          layers: [
            ...state.layers.slice(0, index),
            newLayer,
            ...state.layers.slice(index),
          ],
        }));
      } else {
        const newLayer: LayerData = {
          id: newId,
          name: `${layer.name} 副本`,
          type: layer.type,
          visible: true,
          locked: false,
          opacity: layer.opacity,
          blendMode: layer.blendMode,
          fabricObject: cloned,
          clipMaskId: newMaskId,
        };
        
        useDesignStudioStore.setState((state) => ({
          layers: [
            ...state.layers.slice(0, index),
            newLayer,
            ...state.layers.slice(index),
          ],
        }));
      }
      
      toast.success("圖層已複製");
    });
  };

  // 上移圖層
  const moveLayerUp = (index: number) => {
    if (index === 0 || !canvas) return;
    
    const layer = layers[index];
    if (layer.fabricObject && layer.fabricObject.canvas) {
      try {
        if (typeof layer.fabricObject.bringForward === 'function') {
          layer.fabricObject.bringForward();
        }
        canvas.renderAll();
      } catch (err) {
        console.warn('上移圖層時發生錯誤:', err);
      }
    }
    
    reorderLayers(index, index - 1);
  };

  // 下移圖層
  const moveLayerDown = (index: number) => {
    if (index === layers.length - 1 || !canvas) return;
    
    const layer = layers[index];
    if (layer.fabricObject && layer.fabricObject.canvas) {
      try {
        if (typeof layer.fabricObject.sendBackwards === 'function') {
          layer.fabricObject.sendBackwards();
        }
        canvas.renderAll();
      } catch (err) {
        console.warn('下移圖層時發生錯誤:', err);
      }
    }
    
    reorderLayers(index, index + 1);
  };

  // 移到最上層
  const moveToTop = (index: number) => {
    if (index === 0 || !canvas) return;
    
    const layer = layers[index];
    if (layer.fabricObject && layer.fabricObject.canvas) {
      try {
        if (typeof layer.fabricObject.bringToFront === 'function') {
          layer.fabricObject.bringToFront();
        }
        canvas.renderAll();
      } catch (err) {
        console.warn('移至最上層時發生錯誤:', err);
      }
    }
    
    reorderLayers(index, 0);
    toast.success("已移至最上層");
  };

  // 移到最下層
  const moveToBottom = (index: number) => {
    if (index === layers.length - 1 || !canvas) return;
    
    const layer = layers[index];
    if (layer.fabricObject && layer.fabricObject.canvas) {
      try {
        if (typeof layer.fabricObject.sendToBack === 'function') {
          layer.fabricObject.sendToBack();
        }
        canvas.renderAll();
      } catch (err) {
        console.warn('移至最下層時發生錯誤:', err);
      }
    }
    
    reorderLayers(index, layers.length - 1);
    toast.success("已移至最下層");
  };

  // 更新透明度
  const updateOpacity = useCallback((layer: LayerData, opacity: number) => {
    if (!canvas || !layer.fabricObject) return;
    
    const normalizedOpacity = opacity / 100;
    layer.fabricObject.set("opacity", normalizedOpacity);
    canvas.renderAll();
    updateLayer(layer.id, { opacity: normalizedOpacity });
  }, [canvas, updateLayer]);

  // 開始重命名
  const startRenaming = (layer: LayerData) => {
    setEditingLayerId(layer.id);
    setEditingName(layer.name);
  };

  // 確認重命名
  const confirmRename = (layer: LayerData) => {
    if (editingName.trim()) {
      updateLayer(layer.id, { name: editingName.trim() });
      if (layer.fabricObject) {
        (layer.fabricObject as ExtendedFabricObject).name = editingName.trim();
      }
    }
    setEditingLayerId(null);
    setEditingName("");
  };

  // 取消重命名
  const cancelRename = () => {
    setEditingLayerId(null);
    setEditingName("");
  };

  // 設置剪裁遮罩（使上層圖層作為當前圖層的遮罩）
  const setClipMask = useCallback((layerIndex: number) => {
    if (!canvas || layerIndex === 0) return;
    
    const currentLayer = layers[layerIndex];
    const maskLayer = layers[layerIndex - 1]; // 上一個圖層作為遮罩
    
    if (!currentLayer.fabricObject || !maskLayer.fabricObject) return;
    
    const maskObj = maskLayer.fabricObject;
    const targetObj = currentLayer.fabricObject;
    
    // 獲取兩個物件的中心點
    const maskCenter = maskObj.getCenterPoint();
    const targetCenter = targetObj.getCenterPoint();
    
    // 計算遮罩相對於目標物件的偏移
    const offsetX = maskCenter.x - targetCenter.x;
    const offsetY = maskCenter.y - targetCenter.y;
    
    // 獲取目標物件的縮放比例（用於補償）
    const targetScaleX = targetObj.scaleX || 1;
    const targetScaleY = targetObj.scaleY || 1;
    
    // 根據遮罩物件類型創建 clipPath（使用相對位置）
    let clipPath: fabric.Object | null = null;
    
    // clipPath 的縮放需要除以目標物件的縮放來補償
    const clipProps = {
      left: offsetX / targetScaleX,
      top: offsetY / targetScaleY,
      scaleX: (maskObj.scaleX || 1) / targetScaleX,
      scaleY: (maskObj.scaleY || 1) / targetScaleY,
      angle: (maskObj.angle || 0) - (targetObj.angle || 0),
      originX: 'center' as const,
      originY: 'center' as const,
      absolutePositioned: false, // 使用相對位置，這樣會跟著目標物件移動
    };
    
    if (maskObj.type === 'circle') {
      const circle = maskObj as fabric.Circle;
      clipPath = new fabric.Circle({
        radius: circle.radius,
        ...clipProps,
      });
    } else if (maskObj.type === 'rect') {
      const rect = maskObj as fabric.Rect;
      clipPath = new fabric.Rect({
        width: rect.width,
        height: rect.height,
        rx: rect.rx,
        ry: rect.ry,
        ...clipProps,
      });
    } else if (maskObj.type === 'ellipse') {
      const ellipse = maskObj as fabric.Ellipse;
      clipPath = new fabric.Ellipse({
        rx: ellipse.rx,
        ry: ellipse.ry,
        ...clipProps,
      });
    } else if (maskObj.type === 'triangle') {
      const triangle = maskObj as fabric.Triangle;
      clipPath = new fabric.Triangle({
        width: triangle.width,
        height: triangle.height,
        ...clipProps,
      });
    } else if (maskObj.type === 'polygon') {
      const polygon = maskObj as fabric.Polygon;
      clipPath = new fabric.Polygon(polygon.points || [], {
        ...clipProps,
      });
    } else if (maskObj.type === 'path') {
      const path = maskObj as fabric.Path;
      clipPath = new fabric.Path(path.path || [], {
        ...clipProps,
      });
    } else if (maskObj.type === 'group') {
      // 對於群組，使用 clone 方法
      maskObj.clone((cloned: fabric.Object) => {
        cloned.set({
          ...clipProps,
        });
        targetObj.clipPath = cloned;
        targetObj.dirty = true;
        canvas.requestRenderAll();
      });
      // 繼續執行其他邏輯（隱藏遮罩物件等）
    } else {
      // 對於其他類型（如 image、polyline 等），嘗試使用 clone
      try {
        maskObj.clone((cloned: fabric.Object) => {
          cloned.set({
            ...clipProps,
          });
          targetObj.clipPath = cloned;
          targetObj.dirty = true;
          canvas.requestRenderAll();
        });
      } catch (err) {
        toast.error("此類型物件不支援作為遮罩");
        return;
      }
    }
    
    if (clipPath) {
      // 應用 clipPath
      targetObj.clipPath = clipPath;
      targetObj.dirty = true;
      
      // 保存遮罩物件的原始樣式
      const originalFill = maskObj.fill;
      const originalStroke = maskObj.stroke;
      const originalStrokeWidth = maskObj.strokeWidth;
      const originalOpacity = maskObj.opacity;
      
      // 將遮罩物件的顏色和邊框歸零（透明無邊框）
      maskObj.set({
        fill: 'transparent',
        stroke: 'transparent', 
        strokeWidth: 0,
        opacity: 0,
        selectable: false, // 不可選取
        evented: false, // 不響應事件
      });
      
      // 在 Fabric.js 物件上也保存遮罩關係（用於序列化）
      (targetObj as any).clipMaskId = maskLayer.id;
      (maskObj as any).isClipMask = true;
      (maskObj as any).originalFill = originalFill;
      (maskObj as any).originalStroke = originalStroke;
      (maskObj as any).originalStrokeWidth = originalStrokeWidth;
      (maskObj as any).originalOpacity = originalOpacity;
      
      canvas.requestRenderAll();
      
      // 更新圖層狀態
      updateLayer(currentLayer.id, { clipMaskId: maskLayer.id });
      updateLayer(maskLayer.id, { 
        isClipMask: true,
        originalMaskStyle: {
          fill: originalFill as any,
          stroke: originalStroke as any,
          strokeWidth: originalStrokeWidth || 0,
          opacity: originalOpacity || 1,
        }
      });
      
      toast.success(`已將「${maskLayer.name}」設為遮罩`);
    }
  }, [canvas, layers, updateLayer]);

  // 移除剪裁遮罩
  const removeClipMask = useCallback((layer: LayerData) => {
    if (!canvas || !layer.fabricObject || !layer.clipMaskId) return;
    
    // 移除 clipPath 和 Fabric.js 物件上的屬性
    layer.fabricObject.clipPath = undefined;
    layer.fabricObject.dirty = true;
    (layer.fabricObject as any).clipMaskId = undefined;
    
    // 找到遮罩圖層並更新狀態
    const maskLayer = layers.find(l => l.id === layer.clipMaskId);
    if (maskLayer) {
      // 檢查是否還有其他圖層使用這個遮罩
      const otherUsing = layers.some(l => l.id !== layer.id && l.clipMaskId === maskLayer.id);
      if (!otherUsing && maskLayer.fabricObject) {
        // 恢復遮罩物件的原始樣式
        if (maskLayer.originalMaskStyle) {
          maskLayer.fabricObject.set({
            fill: maskLayer.originalMaskStyle.fill,
            stroke: maskLayer.originalMaskStyle.stroke,
            strokeWidth: maskLayer.originalMaskStyle.strokeWidth,
            opacity: maskLayer.originalMaskStyle.opacity,
            selectable: true, // 恢復可選取
            evented: true, // 恢復事件響應
          });
        }
        
        // 清除 Fabric.js 物件上的遮罩屬性
        (maskLayer.fabricObject as any).isClipMask = undefined;
        (maskLayer.fabricObject as any).originalFill = undefined;
        (maskLayer.fabricObject as any).originalStroke = undefined;
        (maskLayer.fabricObject as any).originalStrokeWidth = undefined;
        (maskLayer.fabricObject as any).originalOpacity = undefined;
        
        updateLayer(maskLayer.id, { isClipMask: false, originalMaskStyle: undefined });
      }
    }
    
    canvas.requestRenderAll();
    updateLayer(layer.id, { clipMaskId: undefined });
    toast.success("已移除遮罩");
  }, [canvas, layers, updateLayer]);

  // 檢查圖層是否可以設置遮罩（需要有上層圖層）
  const canSetClipMask = useCallback((layerIndex: number): boolean => {
    return layerIndex > 0 && !layers[layerIndex].clipMaskId;
  }, [layers]);

  // ========== 群組功能 ==========
  
  // 建立群組
  const createGroup = useCallback(() => {
    if (!canvas || selectedObjectIds.length < 2) {
      toast.error("請選擇至少兩個圖層來建立群組");
      return;
    }
    
    // 獲取選中的圖層
    const selectedLayers = layers.filter(l => selectedObjectIds.includes(l.id));
    const objectsToGroup = selectedLayers
      .filter(l => l.fabricObject && !l.isGroup)
      .map(l => l.fabricObject!);
    
    if (objectsToGroup.length < 2) {
      toast.error("需要至少兩個有效物件來建立群組");
      return;
    }
    
    // 建立 Fabric.js 群組
    const group = new fabric.Group(objectsToGroup, {
      originX: 'center',
      originY: 'center',
    });
    
    // 從畫布移除原本的物件
    objectsToGroup.forEach(obj => canvas.remove(obj));
    
    // 添加群組到畫布
    const groupId = generateId();
    (group as any).id = groupId;
    (group as any).name = `群組 ${groupId.slice(0, 4)}`;
    (group as any).isGroup = true;
    
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.renderAll();
    
    // 獲取子圖層 ID
    const childIds = selectedLayers.map(l => l.id);
    
    // 更新圖層列表
    // 移除被群組的圖層
    const remainingLayers = layers.filter(l => !selectedObjectIds.includes(l.id));
    
    // 建立群組圖層
    const groupLayer: LayerData = {
      id: groupId,
      name: `群組 ${groupId.slice(0, 4)}`,
      type: 'group',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'source-over',
      fabricObject: group,
      isGroup: true,
      childIds: childIds,
    };
    
    // 插入群組圖層
    useDesignStudioStore.setState({
      layers: [groupLayer, ...remainingLayers],
      selectedObjectIds: [groupId],
    });
    
    setLastClickedIndex(0);
    
    toast.success("已建立群組");
  }, [canvas, layers, selectedObjectIds]);

  // 取消群組
  const ungroupLayers = useCallback((layer: LayerData) => {
    if (!canvas || !layer.fabricObject || !layer.isGroup) return;
    
    const group = layer.fabricObject as fabric.Group;
    const groupCenter = group.getCenterPoint();
    const groupAngle = group.angle || 0;
    const groupScaleX = group.scaleX || 1;
    const groupScaleY = group.scaleY || 1;
    
    // 獲取群組內的物件
    const objects = group.getObjects();
    
    // 取消群組並恢復物件
    group.toActiveSelection();
    canvas.discardActiveObject();
    
    // 建立新的圖層
    const newLayers: LayerData[] = [];
    objects.forEach((obj, index) => {
      const objId = (obj as any).id || generateId();
      const objName = (obj as any).name || `物件 ${index + 1}`;
      
      (obj as any).id = objId;
      (obj as any).name = objName;
      
      newLayers.push({
        id: objId,
        name: objName,
        type: obj.type === 'i-text' || obj.type === 'textbox' ? 'text' :
              obj.type === 'image' ? 'image' : 'shape',
        visible: obj.visible !== false,
        locked: !obj.selectable,
        opacity: obj.opacity || 1,
        blendMode: 'source-over',
        fabricObject: obj,
      });
    });
    
    canvas.renderAll();
    
    // 更新圖層列表
    const layerIndex = layers.findIndex(l => l.id === layer.id);
    const otherLayers = layers.filter(l => l.id !== layer.id);
    
    useDesignStudioStore.setState({
      layers: [
        ...otherLayers.slice(0, layerIndex),
        ...newLayers,
        ...otherLayers.slice(layerIndex),
      ],
      selectedObjectIds: newLayers.map(l => l.id),
    });
    
    toast.success("已取消群組");
  }, [canvas, layers]);

  // 檢查是否可以建立群組
  const canCreateGroup = selectedObjectIds.length >= 2 && 
    selectedObjectIds.every(id => {
      const layer = layers.find(l => l.id === id);
      return layer && !layer.isGroup && layer.fabricObject;
    });

  // 拖曳排序處理
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    
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
    
    const draggedLayer = layers[draggedIndex];
    if (draggedLayer?.fabricObject && canvas && draggedLayer.fabricObject.canvas) {
      try {
        if (draggedIndex < dropIndex) {
          for (let i = 0; i < dropIndex - draggedIndex; i++) {
            if (typeof draggedLayer.fabricObject.sendBackwards === 'function') {
              draggedLayer.fabricObject.sendBackwards();
            }
          }
        } else {
          for (let i = 0; i < draggedIndex - dropIndex; i++) {
            if (typeof draggedLayer.fabricObject.bringForward === 'function') {
              draggedLayer.fabricObject.bringForward();
            }
          }
        }
        canvas.renderAll();
      } catch (err) {
        console.warn('圖層排序時發生錯誤:', err);
      }
    }
    
    reorderLayers(draggedIndex, dropIndex);
    setDraggedIndex(null);
    setDragOverIndex(null);
    
    toast.success("圖層順序已更新");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-transparent">
      {/* 隱藏的檔案上傳 input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* 標題 */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-700/50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
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
                  className="w-7 h-7 p-0 text-slate-500 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-500/10"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 w-48"
              >
                <DropdownMenuItem
                  onClick={addTextLayer}
                  className="text-xs cursor-pointer"
                >
                  <Type className="w-4 h-4 mr-2 text-blue-500 dark:text-blue-400" />
                  新增文字
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={addRectLayer}
                  className="text-xs cursor-pointer"
                >
                  <Square className="w-4 h-4 mr-2 text-purple-500 dark:text-purple-400" />
                  新增矩形
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={addCircleLayer}
                  className="text-xs cursor-pointer"
                >
                  <Circle className="w-4 h-4 mr-2 text-pink-500 dark:text-pink-400" />
                  新增圓形
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-200 dark:bg-slate-700" />
                <DropdownMenuItem
                  onClick={handleUploadImage}
                  className="text-xs cursor-pointer"
                >
                  <Upload className="w-4 h-4 mr-2 text-green-500 dark:text-green-400" />
                  上傳圖片
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={importFromURL}
                  className="text-xs cursor-pointer"
                >
                  <FileImage className="w-4 h-4 mr-2 text-cyan-500 dark:text-cyan-400" />
                  從網址匯入
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* 快速操作按鈕 */}
      <div className="p-2 border-b border-slate-200 dark:border-slate-700/50 flex gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={addTextLayer}
          className="flex-1 h-8 text-xs bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 hover:border-indigo-300 dark:hover:border-indigo-500/50 text-slate-700 dark:text-slate-300"
        >
          <Type className="w-3.5 h-3.5 mr-1" />
          文字
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleUploadImage}
          className="flex-1 h-8 text-xs bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:bg-green-50 dark:hover:bg-green-500/20 hover:border-green-300 dark:hover:border-green-500/50 text-slate-700 dark:text-slate-300"
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
            <p className="text-xs mt-1 text-slate-400">點擊上方按鈕新增</p>
          </div>
        ) : (
          layers.map((layer, index) => {
            const isSelected = selectedObjectIds.includes(layer.id);
            const isDragging = draggedIndex === index;
            const isDragOver = dragOverIndex === index;
            const isEditing = editingLayerId === layer.id;
            const isExpanded = expandedLayerId === layer.id;
            
            return (
              <React.Fragment key={layer.id}>
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <div className="space-y-1">
                    <div
                      draggable={!isEditing}
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index)}
                      onClick={(e) => !isEditing && handleSelectLayer(layer, index, e)}
                      onDoubleClick={() => startRenaming(layer)}
                      className={cn(
                        "group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all",
                        isSelected
                          ? "bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-300 dark:border-indigo-500/50"
                          : "hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-transparent",
                        layer.locked && "opacity-60",
                        isDragging && "opacity-50 scale-95",
                        isDragOver && "border-indigo-400 border-dashed bg-indigo-50 dark:bg-indigo-500/10"
                      )}
                    >
                  <TooltipProvider delayDuration={400}>
                    {/* 拖曳手柄 */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
                          <GripVertical className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs">
                        拖曳排序
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  {/* 群組展開/收合按鈕 */}
                  {layer.isGroup ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleGroupExpanded(layer.id);
                      }}
                      className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      <ChevronRight 
                        className={cn(
                          "w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform",
                          expandedGroups.has(layer.id) && "rotate-90"
                        )} 
                      />
                    </button>
                  ) : (
                    <div className="w-4" /> // 佔位符保持對齊
                  )}
                  
                  {/* 縮圖 */}
                  <LayerThumbnail layer={layer} isExpanded={layer.isGroup && expandedGroups.has(layer.id)} />
                  
                  {/* 名稱 */}
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') confirmRename(layer);
                            if (e.key === 'Escape') cancelRename();
                          }}
                          className="h-6 text-xs bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-5 h-5 p-0 text-green-500"
                          onClick={() => confirmRename(layer)}
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-5 h-5 p-0 text-slate-400"
                          onClick={cancelRename}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {/* 遮罩指示 */}
                        <TooltipProvider delayDuration={300}>
                          {layer.clipMaskId && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center">
                                  <Link className="w-3 h-3 text-indigo-500" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                已設置剪裁遮罩
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {layer.isClipMask && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center">
                                  <Scissors className="w-3 h-3 text-orange-500" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                作為遮罩使用中
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </TooltipProvider>
                        <span className="text-xs text-slate-700 dark:text-slate-300 truncate">
                          {layer.name}
                        </span>
                        {layer.opacity < 1 && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {Math.round(layer.opacity * 100)}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* 操作按鈕 */}
                  {!isEditing && (
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
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                            >
                              {layer.visible ? (
                                <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                              ) : (
                                <EyeOff className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs">
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
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                            >
                              {layer.locked ? (
                                <Lock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                              ) : (
                                <Unlock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs">
                            {layer.locked ? "解鎖圖層" : "鎖定圖層"}
                          </TooltipContent>
                        </Tooltip>
                        
                        {/* 更多選項 */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                            >
                              <MoreVertical className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent 
                            align="end" 
                            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                          >
                            <DropdownMenuItem
                              onClick={() => startRenaming(layer)}
                              className="text-xs"
                            >
                              <Pencil className="w-3.5 h-3.5 mr-2" />
                              重新命名
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setExpandedLayerId(isExpanded ? null : layer.id)}
                              className="text-xs"
                            >
                              <Eye className="w-3.5 h-3.5 mr-2" />
                              調整透明度
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-slate-200 dark:bg-slate-700" />
                            <DropdownMenuItem
                              onClick={() => moveToTop(index)}
                              disabled={index === 0}
                              className="text-xs"
                            >
                              <ChevronsUp className="w-3.5 h-3.5 mr-2" />
                              移到最上層
                            </DropdownMenuItem>
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
                              onClick={() => moveToBottom(index)}
                              disabled={index === layers.length - 1}
                              className="text-xs"
                            >
                              <ChevronsDown className="w-3.5 h-3.5 mr-2" />
                              移到最下層
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-slate-200 dark:bg-slate-700" />
                            {/* 遮罩功能 */}
                            {layer.clipMaskId ? (
                              <DropdownMenuItem
                                onClick={() => removeClipMask(layer)}
                                className="text-xs"
                              >
                                <Unlink className="w-3.5 h-3.5 mr-2" />
                                移除遮罩
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => setClipMask(index)}
                                disabled={!canSetClipMask(index)}
                                className="text-xs"
                              >
                                <Scissors className="w-3.5 h-3.5 mr-2" />
                                建立剪裁遮罩
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator className="bg-slate-200 dark:bg-slate-700" />
                            {/* 群組功能 */}
                            {layer.isGroup ? (
                              <DropdownMenuItem
                                onClick={() => ungroupLayers(layer)}
                                className="text-xs"
                              >
                                <Ungroup className="w-3.5 h-3.5 mr-2" />
                                取消群組
                              </DropdownMenuItem>
                            ) : selectedObjectIds.length >= 2 && selectedObjectIds.includes(layer.id) ? (
                              <DropdownMenuItem
                                onClick={createGroup}
                                disabled={!canCreateGroup}
                                className="text-xs"
                              >
                                <Group className="w-3.5 h-3.5 mr-2" />
                                建立群組
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuSeparator className="bg-slate-200 dark:bg-slate-700" />
                            <DropdownMenuItem
                              onClick={() => duplicateLayer(layer)}
                              className="text-xs"
                            >
                              <Copy className="w-3.5 h-3.5 mr-2" />
                              複製圖層
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteLayer(layer)}
                              className="text-xs text-red-500 dark:text-red-400 focus:text-red-500 dark:focus:text-red-400"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" />
                              刪除圖層
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TooltipProvider>
                  )}
                </div>
                
                {/* 透明度調整面板 */}
                {isExpanded && (
                  <div 
                    className="ml-6 p-2 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-700/50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 w-12">透明度</span>
                      <Slider
                        value={[layer.opacity * 100]}
                        min={0}
                        max={100}
                        step={1}
                        onValueChange={([v]) => updateOpacity(layer, v)}
                        className="flex-1"
                      />
                      <span className="text-[10px] text-indigo-500 dark:text-indigo-400 w-8 text-right">
                        {Math.round(layer.opacity * 100)}%
                      </span>
                    </div>
                  </div>
                )}
                  </div>
                </ContextMenuTrigger>
                
                {/* 右鍵選單 */}
                <ContextMenuContent className="w-48 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                  <ContextMenuItem
                    onClick={() => toggleVisibility(layer)}
                    className="text-xs cursor-pointer"
                  >
                    {layer.visible ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5 mr-2" />
                        隱藏圖層
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5 mr-2" />
                        顯示圖層
                      </>
                    )}
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => toggleLock(layer)}
                    className="text-xs cursor-pointer"
                  >
                    {layer.locked ? (
                      <>
                        <Unlock className="w-3.5 h-3.5 mr-2" />
                        解除鎖定
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5 mr-2" />
                        鎖定圖層
                      </>
                    )}
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => startRenaming(layer)}
                    className="text-xs cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5 mr-2" />
                    重新命名
                  </ContextMenuItem>
                  <ContextMenuSeparator className="bg-slate-200 dark:bg-slate-700" />
                  
                  {/* 遮罩功能 */}
                  {layer.clipMaskId ? (
                    <ContextMenuItem
                      onClick={() => removeClipMask(layer)}
                      className="text-xs cursor-pointer"
                    >
                      <Unlink className="w-3.5 h-3.5 mr-2" />
                      移除遮罩
                    </ContextMenuItem>
                  ) : (
                    <ContextMenuItem
                      onClick={() => setClipMask(index)}
                      disabled={!canSetClipMask(index)}
                      className="text-xs cursor-pointer"
                    >
                      <Scissors className="w-3.5 h-3.5 mr-2" />
                      建立剪裁遮罩（使用上層圖層）
                    </ContextMenuItem>
                  )}
                  
                  <ContextMenuSeparator className="bg-slate-200 dark:bg-slate-700" />
                  
                  {/* 群組功能 */}
                  {layer.isGroup ? (
                    <ContextMenuItem
                      onClick={() => ungroupLayers(layer)}
                      className="text-xs cursor-pointer"
                    >
                      <Ungroup className="w-3.5 h-3.5 mr-2" />
                      取消群組
                    </ContextMenuItem>
                  ) : selectedObjectIds.length >= 2 && selectedObjectIds.includes(layer.id) ? (
                    <ContextMenuItem
                      onClick={createGroup}
                      disabled={!canCreateGroup}
                      className="text-xs cursor-pointer"
                    >
                      <Group className="w-3.5 h-3.5 mr-2" />
                      建立群組
                    </ContextMenuItem>
                  ) : null}
                  
                  <ContextMenuSeparator className="bg-slate-200 dark:bg-slate-700" />
                  <ContextMenuItem
                    onClick={() => moveToTop(index)}
                    disabled={index === 0}
                    className="text-xs cursor-pointer"
                  >
                    <ChevronsUp className="w-3.5 h-3.5 mr-2" />
                    移到最上層
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => moveLayerUp(index)}
                    disabled={index === 0}
                    className="text-xs cursor-pointer"
                  >
                    <ChevronUp className="w-3.5 h-3.5 mr-2" />
                    上移一層
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => moveLayerDown(index)}
                    disabled={index === layers.length - 1}
                    className="text-xs cursor-pointer"
                  >
                    <ChevronDown className="w-3.5 h-3.5 mr-2" />
                    下移一層
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => moveToBottom(index)}
                    disabled={index === layers.length - 1}
                    className="text-xs cursor-pointer"
                  >
                    <ChevronsDown className="w-3.5 h-3.5 mr-2" />
                    移到最下層
                  </ContextMenuItem>
                  <ContextMenuSeparator className="bg-slate-200 dark:bg-slate-700" />
                  <ContextMenuItem
                    onClick={() => duplicateLayer(layer)}
                    className="text-xs cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 mr-2" />
                    複製圖層
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => deleteLayer(layer)}
                    className="text-xs cursor-pointer text-red-500 dark:text-red-400 focus:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    刪除圖層
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
              
              {/* 群組子物件列表（展開時顯示） */}
              {layer.isGroup && expandedGroups.has(layer.id) && layer.fabricObject && (
                <div className="ml-4 pl-2 border-l-2 border-slate-200 dark:border-slate-700 space-y-1">
                  {(layer.fabricObject as fabric.Group).getObjects().map((childObj, childIndex) => {
                    const childId = (childObj as any).id || `child-${childIndex}`;
                    const childName = (childObj as any).name || `物件 ${childIndex + 1}`;
                    const childType = childObj.type === 'i-text' || childObj.type === 'textbox' ? 'text' :
                                     childObj.type === 'image' ? 'image' : 'shape';
                    
                    return (
                      <div
                        key={childId}
                        className={cn(
                          "flex items-center gap-2 p-1.5 rounded-lg transition-all",
                          "bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50",
                          "hover:bg-slate-100 dark:hover:bg-slate-700/50"
                        )}
                      >
                        <div className="w-4" /> {/* 縮進對齊 */}
                        <div className={cn(
                          "w-6 h-6 rounded flex items-center justify-center border transition-colors",
                          childType === 'text' ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" :
                          childType === 'image' ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" :
                          "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800"
                        )}>
                          <TypeIcon type={childType as ObjectType} />
                        </div>
                        <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate flex-1">
                          {childName}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700/50 rounded">
                          {childType === 'text' ? '文字' : childType === 'image' ? '圖片' : '形狀'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </React.Fragment>
            );
          })
        )}
      </div>
      
      {/* 底部提示 */}
      {layers.length > 0 && (
        <div className="p-2 border-t border-slate-200 dark:border-slate-700/50">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
            Ctrl+點擊多選 · Shift+點擊範圍選 · 點擊箭頭展開群組
          </p>
        </div>
      )}
    </div>
  );
}
