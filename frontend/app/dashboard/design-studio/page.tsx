"use client";

/**
 * Design Studio - 專業級圖片設計編輯器
 * 對標 Canva Pro 的設計工具
 * 
 * 手機版：所有工具移至底部工具列，面板從底部滑出
 */

import React, { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { fabric } from "fabric";
import { 
  Loader2, 
  Palette, 
  LayoutTemplate, 
  Layers, 
  Settings2,
  Sparkles,
  FolderOpen,
  Images,
  MousePointer2,
  Type,
  Image as ImageIcon,
  Upload,
  Shapes,
  Square,
  Circle,
  Triangle,
  Star,
  Heart,
  Hexagon,
  Diamond,
  ArrowRight,
  Minus,
  Eraser,
  X,
  ChevronDown,
  Hand,
  MoreHorizontal,
  Undo2,
  Redo2,
  FilePlus,
  Save,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TopToolbar from "@/components/design-studio/panels/TopToolbar";
import ToolsPanel from "@/components/design-studio/panels/ToolsPanel";
import LayersPanel from "@/components/design-studio/panels/LayersPanel";
import PropertiesPanel from "@/components/design-studio/panels/PropertiesPanel";
import TemplatesPanel from "@/components/design-studio/panels/TemplatesPanel";
import FiltersPanel from "@/components/design-studio/panels/FiltersPanel";
import AssetPanel from "@/components/design-studio/panels/AssetPanel";
import GalleryPanel from "@/components/design-studio/panels/GalleryPanel";
import { useDesignStudioStore, ExtendedFabricObject } from "@/stores/design-studio-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useShortcutDisplay } from "@/lib/utils/keyboard";
import { getPendingImageForEditor, sharedGalleryService } from "@/lib/services/shared-gallery-service";
import { v4 as uuidv4 } from "uuid";
import { backgroundRemovalService } from "@/lib/services/background-removal-service";

// 動態載入 Canvas（避免 SSR 問題）
const CanvasStage = dynamic(
  () => import("@/components/design-studio/canvas/CanvasStage"),
  { 
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-slate-800/50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-2" />
          <p className="text-sm text-slate-400">載入畫布中...</p>
        </div>
      </div>
    ),
  }
);

export default function DesignStudioPage() {
  const { 
    leftPanelOpen, 
    rightPanelOpen,
    canvas,
    layers,
    addLayer,
    canvasWidth,
    canvasHeight,
    setCanvasSize,
    setCanvasBackground,
    setTemplateName,
  } = useDesignStudioStore();

  const [activeRightTab, setActiveRightTab] = useState<"properties" | "filters">("properties");
  const [activeLeftTab, setActiveLeftTab] = useState<string>("layers");
  
  // 手機版狀態
  const [mobilePanel, setMobilePanel] = useState<string | null>(null); // null | "layers" | "properties" | "templates" | "gallery" | "assets" | "filters" | "shapes" | "more"
  const [mobileShapesOpen, setMobileShapesOpen] = useState(false);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  
  // 快捷鍵顯示（避免 hydration 問題）
  const { formatShortcut, deleteKey } = useShortcutDisplay();

  // 處理從其他引擎傳來的待編輯圖片
  const handlePendingImage = useCallback(async () => {
    if (!canvas) return;

    const pendingImage = await getPendingImageForEditor();
    if (!pendingImage) return;

    try {
      // 載入圖片以取得尺寸
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("圖片載入失敗"));
        img.src = pendingImage.imageUrl;
      });

      // 清除現有物件（保留網格和參考線）
      const objectsToRemove = canvas.getObjects().filter((obj: fabric.Object) => {
        const extObj = obj as ExtendedFabricObject;
        return !extObj.isGrid && !extObj.isGuide;
      });
      objectsToRemove.forEach((obj: fabric.Object) => canvas.remove(obj));

      // 設定畫布尺寸為圖片尺寸
      setCanvasSize(img.width, img.height);
      setCanvasBackground("#FFFFFF");

      // 將圖片載入到畫布
      fabric.Image.fromURL(pendingImage.imageUrl, (fabricImg) => {
        const id = uuidv4().slice(0, 8);
        
        fabricImg.set({
          left: 0,
          top: 0,
          originX: "left",
          originY: "top",
          selectable: true,
          evented: true,
        });
        
        (fabricImg as ExtendedFabricObject).id = id;
        (fabricImg as ExtendedFabricObject).name = pendingImage.name || "導入的圖片";
        
        canvas.add(fabricImg);
        canvas.renderAll();
        
        addLayer({
          id,
          name: pendingImage.name || "導入的圖片",
          type: "image",
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "source-over",
          fabricObject: fabricImg,
        });

        // 同時保存到圖庫
        sharedGalleryService.addImageFromDataUrl(pendingImage.imageUrl, {
          name: pendingImage.name || "導入的圖片",
          source: pendingImage.source,
          sourceId: pendingImage.sourceId,
          metadata: pendingImage.metadata,
        }).catch(console.error);

        // 更新專案名稱
        setTemplateName(pendingImage.name || "編輯中的圖片");

        toast.success(`已載入「${pendingImage.name || "圖片"}」，可以開始編輯！`);
      }, { crossOrigin: "anonymous" });

    } catch (error) {
      console.error("載入待編輯圖片失敗:", error);
      toast.error("載入圖片失敗");
    }
  }, [canvas, setCanvasSize, setCanvasBackground, addLayer, setTemplateName]);

  // 頁面載入時檢查是否有待編輯的圖片
  useEffect(() => {
    if (canvas) {
      // 延遲執行以確保畫布已完全初始化
      const timer = setTimeout(() => {
        handlePendingImage();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [canvas, handlePendingImage]);

  // 鍵盤快捷鍵
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果正在輸入文字，不處理快捷鍵
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl/Cmd + Z = Undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        useDesignStudioStore.getState().undo();
      }
      // Ctrl/Cmd + Shift + Z = Redo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        useDesignStudioStore.getState().redo();
      }
      // Ctrl/Cmd + Y = Redo (alternative)
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        useDesignStudioStore.getState().redo();
      }
      // Delete/Backspace = 刪除選中物件
      if ((e.key === "Delete" || e.key === "Backspace") && canvas) {
        e.preventDefault();
        
        const { selectedObjectIds, layers, removeLayer } = useDesignStudioStore.getState();
        const activeObject = canvas.getActiveObject();
        
        // 優先使用 store 中的選取狀態（支援從圖層面板多選）
        if (selectedObjectIds.length > 0) {
          // 找到要刪除的物件
          const objectsToRemove = layers
            .filter(l => selectedObjectIds.includes(l.id) && l.fabricObject)
            .map(l => l.fabricObject!);
          
          // 先取消選取
          canvas.discardActiveObject();
          
          // 刪除所有選中的物件
          objectsToRemove.forEach((obj: fabric.Object) => {
            canvas.remove(obj);
          });
          
          canvas.renderAll();
        } else if (activeObject) {
          // 使用 Fabric.js 的選取狀態
          if (activeObject.type === 'activeSelection') {
            const activeSelection = activeObject as fabric.ActiveSelection;
            const objects = activeSelection.getObjects();
            
            canvas.discardActiveObject();
            
            objects.forEach((obj: fabric.Object) => {
              canvas.remove(obj);
            });
          } else {
            canvas.remove(activeObject);
            canvas.discardActiveObject();
          }
          
          canvas.renderAll();
        }
      }
      // Escape = 取消選取
      if (e.key === "Escape" && canvas) {
        canvas.discardActiveObject();
        canvas.renderAll();
        useDesignStudioStore.getState().clearSelection();
      }
      // T = 文字工具
      if (e.key === "t" || e.key === "T") {
        useDesignStudioStore.getState().setActiveTool("text");
      }
      // V = 選取工具
      if (e.key === "v" || e.key === "V") {
        useDesignStudioStore.getState().setActiveTool("select");
      }
      // Ctrl/Cmd + D = 複製
      if ((e.ctrlKey || e.metaKey) && e.key === "d" && canvas) {
        e.preventDefault();
        const activeObject = canvas.getActiveObject();
        if (activeObject) {
          activeObject.clone((cloned: fabric.Object) => {
            const newId = uuidv4();
            const origName = (activeObject as any).name || '物件';
            (cloned as any).id = newId;
            (cloned as any).name = `${origName} (複製)`;
            cloned.set({
              left: (cloned.left || 0) + 20,
              top: (cloned.top || 0) + 20,
            });
            canvas.add(cloned);
            canvas.setActiveObject(cloned);
            canvas.renderAll();
            // 建立對應圖層
            const { addLayer } = useDesignStudioStore.getState();
            let objType: 'text' | 'image' | 'shape' | 'group' = 'shape';
            if (cloned.type === 'i-text' || cloned.type === 'textbox' || cloned.type === 'text') objType = 'text';
            else if (cloned.type === 'image') objType = 'image';
            else if (cloned.type === 'group') objType = 'group';
            addLayer({
              id: newId,
              name: `${origName} (複製)`,
              type: objType,
              visible: true,
              locked: false,
              opacity: cloned.opacity || 1,
              blendMode: 'source-over',
              fabricObject: cloned,
            });
          });
        }
      }
      // Ctrl/Cmd + G = 建立群組
      if ((e.ctrlKey || e.metaKey) && e.key === "g" && !e.shiftKey && canvas) {
        e.preventDefault();
        const activeObject = canvas.getActiveObject();
        if (activeObject && activeObject.type === "activeSelection") {
          const activeSelection = activeObject as fabric.ActiveSelection;
          const objectsToGroup = activeSelection.getObjects();
          
          if (objectsToGroup.length >= 2) {
            const group = activeSelection.toGroup();
            const groupId = Math.random().toString(36).substring(2, 10);
            (group as any).id = groupId;
            (group as any).name = `群組 ${groupId.slice(0, 4)}`;
            (group as any).isGroup = true;
            
            const groupedIds = objectsToGroup.map(obj => (obj as any).id).filter(Boolean);
            const { layers, addLayer } = useDesignStudioStore.getState();
            const remainingLayers = layers.filter(l => !groupedIds.includes(l.id));
            
            useDesignStudioStore.setState({
              layers: [{
                id: groupId,
                name: `群組 ${groupId.slice(0, 4)}`,
                type: 'group',
                visible: true,
                locked: false,
                opacity: 1,
                blendMode: 'source-over',
                fabricObject: group,
                isGroup: true,
                childIds: groupedIds,
              }, ...remainingLayers],
              selectedObjectIds: [groupId],
            });
            
            canvas.renderAll();
          }
        }
      }
      // Ctrl/Cmd + Shift + G = 取消群組
      if ((e.ctrlKey || e.metaKey) && e.key === "g" && e.shiftKey && canvas) {
        e.preventDefault();
        const activeObject = canvas.getActiveObject();
        const { layers, selectedObjectIds } = useDesignStudioStore.getState();
        const selectedLayer = layers.find(l => selectedObjectIds.includes(l.id));
        
        if (activeObject && selectedLayer?.isGroup && activeObject.type === "group") {
          const group = activeObject as fabric.Group;
          const objects = group.getObjects();
          
          group.toActiveSelection();
          canvas.discardActiveObject();
          
          const newLayers: any[] = [];
          objects.forEach((obj, index) => {
            const objId = (obj as any).id || Math.random().toString(36).substring(2, 10);
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
          
          const layerIndex = layers.findIndex(l => l.id === selectedLayer.id);
          const otherLayers = layers.filter(l => l.id !== selectedLayer.id);
          
          useDesignStudioStore.setState({
            layers: [
              ...otherLayers.slice(0, layerIndex),
              ...newLayers,
              ...otherLayers.slice(layerIndex),
            ],
            selectedObjectIds: newLayers.map(l => l.id),
          });
          
          canvas.renderAll();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canvas]);

  // ======= 手機版工具函數 =======
  const generateId = () => uuidv4().slice(0, 8);

  const mobileAddText = () => {
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
      shadow: new fabric.Shadow({ color: "rgba(0,0,0,0.5)", blur: 10, offsetX: 2, offsetY: 2 }),
    });
    (text as ExtendedFabricObject).id = id;
    (text as ExtendedFabricObject).name = `文字 ${id}`;
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
    addLayer({ id, name: `文字 ${id}`, type: "text", visible: true, locked: false, opacity: 1, blendMode: "source-over", fabricObject: text });
    setMobilePanel(null);
  };

  const mobileUploadImage = () => {
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
          const maxSize = Math.min(canvasWidth, canvasHeight) * 0.8;
          const scale = Math.min(maxSize / (img.width || 1), maxSize / (img.height || 1));
          img.set({ left: canvasWidth / 2, top: canvasHeight / 2, originX: "center", originY: "center", scaleX: scale, scaleY: scale });
          (img as ExtendedFabricObject).id = id;
          (img as ExtendedFabricObject).name = `圖片 ${id}`;
          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();
          addLayer({ id, name: `圖片 ${id}`, type: "image", visible: true, locked: false, opacity: 1, blendMode: "source-over", fabricObject: img });
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
    setMobilePanel(null);
  };

  const mobileAddShape = (shapeType: string) => {
    if (!canvas) return;
    const id = generateId();
    let shape: fabric.Object | null = null;
    let name = "";
    const cx = canvasWidth / 2, cy = canvasHeight / 2;
    switch (shapeType) {
      case "rectangle": shape = new fabric.Rect({ left: cx, top: cy, originX: "center", originY: "center", width: 200, height: 150, fill: "#6366F1", rx: 8, ry: 8, stroke: "#4F46E5", strokeWidth: 2 }); name = "矩形"; break;
      case "circle": shape = new fabric.Circle({ left: cx, top: cy, originX: "center", originY: "center", radius: 80, fill: "#EC4899", stroke: "#DB2777", strokeWidth: 2 }); name = "圓形"; break;
      case "triangle": shape = new fabric.Triangle({ left: cx, top: cy, originX: "center", originY: "center", width: 150, height: 130, fill: "#10B981", stroke: "#059669", strokeWidth: 2 }); name = "三角形"; break;
      case "star": {
        const pts = [];
        for (let i = 0; i < 10; i++) { const r = i % 2 === 0 ? 80 : 40; const a = (Math.PI / 5) * i - Math.PI / 2; pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r }); }
        shape = new fabric.Polygon(pts, { left: cx, top: cy, originX: "center", originY: "center", fill: "#F59E0B", stroke: "#D97706", strokeWidth: 2 }); name = "星形"; break;
      }
      case "heart": shape = new fabric.Path("M 0 -30 C -25 -60 -60 -30 -60 0 C -60 30 -30 60 0 80 C 30 60 60 30 60 0 C 60 -30 25 -60 0 -30 Z", { left: cx, top: cy, originX: "center", originY: "center", fill: "#EF4444", stroke: "#DC2626", strokeWidth: 2, scaleX: 1.5, scaleY: 1.5 }); name = "愛心"; break;
      case "hexagon": {
        const hp = [];
        for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i - Math.PI / 2; hp.push({ x: Math.cos(a) * 70, y: Math.sin(a) * 70 }); }
        shape = new fabric.Polygon(hp, { left: cx, top: cy, originX: "center", originY: "center", fill: "#06B6D4", stroke: "#0891B2", strokeWidth: 2 }); name = "六邊形"; break;
      }
      case "diamond": shape = new fabric.Polygon([{ x: 0, y: -70 }, { x: 50, y: 0 }, { x: 0, y: 70 }, { x: -50, y: 0 }], { left: cx, top: cy, originX: "center", originY: "center", fill: "#14B8A6", stroke: "#0D9488", strokeWidth: 2 }); name = "菱形"; break;
      case "line": shape = new fabric.Line([cx - 100, cy, cx + 100, cy], { stroke: "#F59E0B", strokeWidth: 4, strokeLineCap: "round" }); name = "直線"; break;
      case "arrow": shape = new fabric.Path("M 0 20 L 60 20 L 60 0 L 100 35 L 60 70 L 60 50 L 0 50 Z", { left: cx, top: cy, originX: "center", originY: "center", fill: "#8B5CF6", stroke: "#7C3AED", strokeWidth: 2 }); name = "箭頭"; break;
    }
    if (shape) {
      (shape as ExtendedFabricObject).id = id;
      (shape as ExtendedFabricObject).name = `${name} ${id}`;
      canvas.add(shape);
      canvas.setActiveObject(shape);
      canvas.renderAll();
      addLayer({ id, name: `${name} ${id}`, type: "shape", visible: true, locked: false, opacity: 1, blendMode: "source-over", fabricObject: shape });
    }
    setMobilePanel(null);
  };

  const mobileRemoveBg = useCallback(async () => {
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();
    if (!activeObject || activeObject.type !== "image") { toast.error("請先選取一張圖片"); return; }
    if (!window.confirm("去背功能將扣除 1 點，確定？")) return;
    setIsRemovingBg(true);
    toast.loading("正在處理去背...", { id: "remove-bg-m" });
    try {
      const fabricImage = activeObject as fabric.Image;
      let dataUrl: string;
      try { dataUrl = fabricImage.toDataURL({ format: "png", quality: 1, multiplier: 1 }); } catch { const el = fabricImage.getElement() as HTMLImageElement; dataUrl = el?.src || ""; if (!dataUrl) throw new Error("無法取得圖片"); }
      const result = await backgroundRemovalService.removeBackground({ imageBase64: dataUrl, outputType: 1, returnType: 2 });
      if (!result.success || !result.image) throw new Error("去背失敗");
      let imageData = result.image;
      if (!imageData.startsWith("data:")) imageData = `data:image/png;base64,${imageData}`;
      fabric.Image.fromURL(imageData, (newImg) => {
        if (!newImg) { toast.error("載入失敗", { id: "remove-bg-m" }); return; }
        newImg.set({ left: fabricImage.left, top: fabricImage.top, scaleX: fabricImage.scaleX, scaleY: fabricImage.scaleY, angle: fabricImage.angle, originX: fabricImage.originX, originY: fabricImage.originY, flipX: fabricImage.flipX, flipY: fabricImage.flipY, opacity: fabricImage.opacity });
        const ext = fabricImage as ExtendedFabricObject;
        const newExt = newImg as ExtendedFabricObject;
        const { layers: ls, updateLayer: ul, addLayer: al } = useDesignStudioStore.getState();
        const layer = ls.find(l => l.fabricObject === fabricImage || l.id === ext.id);
        if (layer) { newExt.id = layer.id; newExt.name = (layer.name || "圖片") + " (已去背)"; } else { newExt.id = ext.id || `img_${Date.now()}`; newExt.name = (ext.name || "圖片") + " (已去背)"; }
        canvas.remove(fabricImage);
        canvas.add(newImg);
        canvas.setActiveObject(newImg);
        canvas.renderAll();
        if (layer) ul(layer.id, { name: newExt.name, fabricObject: newImg }); else al({ id: newExt.id!, name: newExt.name!, type: "image", visible: true, locked: false, opacity: 1, blendMode: "source-over", fabricObject: newImg });
        toast.success("去背完成！", { id: "remove-bg-m" });
      }, { crossOrigin: "anonymous" });
    } catch (e) { toast.error(e instanceof Error ? e.message : "去背失敗", { id: "remove-bg-m" }); } finally { setIsRemovingBg(false); }
  }, [canvas]);

  const closeMobilePanel = () => setMobilePanel(null);
  const toggleMobilePanel = (panel: string) => setMobilePanel(prev => prev === panel ? null : panel);

  // 手機形狀選項
  const mobileShapeOptions = [
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

  return (
    <div className="h-screen flex flex-col bg-slate-950 dark:bg-slate-950 overflow-hidden">
      {/* 頂部工具列 */}
      <TopToolbar />

      {/* 主體內容 - 手機版畫布佔滿剩餘空間 */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 左側工具列 - 桌面版 */}
        <div className="hidden md:flex">
          <ToolsPanel />
        </div>

        {/* 左側面板 - 桌面版 */}
        <div 
          className={cn(
            "hidden md:flex bg-white dark:bg-slate-900/95 backdrop-blur-sm border-r border-slate-200 dark:border-slate-700/50 transition-all duration-300 flex-col flex-shrink-0",
            leftPanelOpen ? "w-64 overflow-y-auto" : "w-0 overflow-hidden"
          )}
        >
          {leftPanelOpen && (
            <Tabs value={activeLeftTab} onValueChange={setActiveLeftTab} className="flex-1 flex flex-col min-h-0">
              <TabsList className="mx-2 mt-2 grid grid-cols-4 bg-slate-800/50 dark:bg-slate-800/50 h-9 shrink-0">
                <TabsTrigger value="layers" className="text-xs px-2 data-[state=active]:!bg-indigo-500 data-[state=active]:!text-white dark:data-[state=active]:!bg-indigo-500 dark:data-[state=active]:!text-white">
                  <Layers className="w-3.5 h-3.5 mr-1" />
                  圖層
                </TabsTrigger>
                <TabsTrigger value="gallery" className="text-xs px-2 data-[state=active]:!bg-indigo-500 data-[state=active]:!text-white dark:data-[state=active]:!bg-indigo-500 dark:data-[state=active]:!text-white">
                  <Images className="w-3.5 h-3.5 mr-1" />
                  圖庫
                </TabsTrigger>
                <TabsTrigger value="templates" className="text-xs px-2 data-[state=active]:!bg-indigo-500 data-[state=active]:!text-white dark:data-[state=active]:!bg-indigo-500 dark:data-[state=active]:!text-white">
                  <LayoutTemplate className="w-3.5 h-3.5 mr-1" />
                  模板
                </TabsTrigger>
                <TabsTrigger value="assets" className="text-xs px-2 data-[state=active]:!bg-indigo-500 data-[state=active]:!text-white dark:data-[state=active]:!bg-indigo-500 dark:data-[state=active]:!text-white">
                  <FolderOpen className="w-3.5 h-3.5 mr-1" />
                  素材
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="layers" className="flex-1 mt-0 min-h-0 overflow-hidden">
                <LayersPanel />
              </TabsContent>
              <TabsContent value="gallery" className="flex-1 mt-0 min-h-0 overflow-hidden">
                <GalleryPanel />
              </TabsContent>
              <TabsContent value="templates" className="flex-1 mt-0 min-h-0 overflow-hidden">
                <TemplatesPanel />
              </TabsContent>
              <TabsContent value="assets" className="flex-1 mt-0 min-h-0 overflow-hidden">
                <AssetPanel />
              </TabsContent>
            </Tabs>
          )}
        </div>

        {/* 中間畫布區域 */}
        <CanvasStage className="flex-1" />

        {/* 右側面板 - 桌面版 */}
        <div 
          className={cn(
            "hidden md:flex bg-white dark:bg-slate-900/95 backdrop-blur-sm border-l border-slate-200 dark:border-slate-700/50 transition-all duration-300 flex-col flex-shrink-0",
            rightPanelOpen ? "w-72 overflow-y-auto" : "w-0 overflow-hidden"
          )}
        >
          {rightPanelOpen && (
            <Tabs value={activeRightTab} onValueChange={(v) => setActiveRightTab(v as "properties" | "filters")} className="flex-1 flex flex-col min-h-0">
              <TabsList className="mx-2 mt-2 grid grid-cols-2 bg-slate-100 dark:bg-slate-800/50 h-9 shrink-0">
                <TabsTrigger value="properties" className="text-xs px-2 data-[state=active]:!bg-indigo-500 data-[state=active]:!text-white dark:data-[state=active]:!bg-indigo-500 dark:data-[state=active]:!text-white">
                  <Settings2 className="w-3.5 h-3.5 mr-1" />
                  屬性
                </TabsTrigger>
                <TabsTrigger value="filters" className="text-xs px-2 data-[state=active]:!bg-indigo-500 data-[state=active]:!text-white dark:data-[state=active]:!bg-indigo-500 dark:data-[state=active]:!text-white">
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  濾鏡
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="properties" className="flex-1 mt-0 min-h-0 overflow-hidden">
                <PropertiesPanel />
              </TabsContent>
              <TabsContent value="filters" className="flex-1 mt-0 min-h-0 overflow-hidden">
                <FiltersPanel />
              </TabsContent>
            </Tabs>
          )}
        </div>

      </div>

      {/* 底部狀態列 - 桌面版 */}
      <div className="hidden md:flex h-7 bg-slate-100 dark:bg-slate-900/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-700/50 items-center justify-between px-4">
        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-500">
          <span className="flex items-center gap-1">
            <Palette className="w-3 h-3" />
            圖片編輯室
          </span>
          <span>|</span>
          <span>Fabric.js v5.3</span>
          <span>|</span>
          <span>{layers.length} 個圖層</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-500">
          <span>
            <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded text-[10px] mr-1">V</kbd>
            選取
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded text-[10px] mr-1">T</kbd>
            文字
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded text-[10px] mr-1">{formatShortcut('cmd+z')}</kbd>
            復原
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded text-[10px] mr-1">{deleteKey}</kbd>
            刪除
          </span>
        </div>
      </div>

      {/* ===== 手機版底部滑出面板 (fixed，在工具列上方) ===== */}
      {mobilePanel && (
        <div className="md:hidden fixed inset-x-0 bottom-[88px] z-50 animate-in slide-in-from-bottom duration-200">
          {/* 點擊遮罩關閉面板 */}
          <div className="fixed inset-0 z-[-1]" onClick={closeMobilePanel} />
          <div className="bg-slate-900/98 backdrop-blur-xl border-t border-slate-700/50 rounded-t-2xl shadow-2xl max-h-[55vh] flex flex-col">
            {/* 面板頂部把手 + 關閉 */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 bg-slate-600 rounded-full" />
                <span className="text-sm font-medium text-white ml-2">
                  {mobilePanel === "layers" && "圖層"}
                  {mobilePanel === "properties" && "屬性"}
                  {mobilePanel === "filters" && "濾鏡"}
                  {mobilePanel === "templates" && "模板"}
                  {mobilePanel === "gallery" && "圖庫"}
                  {mobilePanel === "assets" && "素材"}
                  {mobilePanel === "shapes" && "形狀"}
                  {mobilePanel === "more" && "更多工具"}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={closeMobilePanel} className="w-8 h-8 p-0 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            {/* 面板內容 */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {mobilePanel === "layers" && <LayersPanel />}
              {mobilePanel === "properties" && <PropertiesPanel />}
              {mobilePanel === "filters" && <FiltersPanel />}
              {mobilePanel === "templates" && <TemplatesPanel />}
              {mobilePanel === "gallery" && <GalleryPanel />}
              {mobilePanel === "assets" && <AssetPanel />}
              
              {mobilePanel === "shapes" && (
                <div className="p-4">
                  <div className="grid grid-cols-3 gap-3">
                    {mobileShapeOptions.map(s => (
                      <button
                        key={s.id}
                        onClick={() => mobileAddShape(s.id)}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 transition-all active:scale-95"
                      >
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${s.color}20` }}>
                          <s.icon className="w-5 h-5" style={{ color: s.color }} />
                        </div>
                        <span className="text-xs text-slate-300">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {mobilePanel === "more" && (
                <div className="p-4 space-y-2">
                  {[
                    { icon: Hand, label: "平移工具", onClick: () => { useDesignStudioStore.getState().setActiveTool("pan"); closeMobilePanel(); } },
                    { icon: LayoutTemplate, label: "範本庫", onClick: () => setMobilePanel("templates") },
                    { icon: Images, label: "圖庫", onClick: () => setMobilePanel("gallery") },
                    { icon: FolderOpen, label: "素材", onClick: () => setMobilePanel("assets") },
                    { icon: Sparkles, label: "濾鏡", onClick: () => setMobilePanel("filters") },
                    { icon: Eraser, label: isRemovingBg ? "去背中..." : "圖片去背", onClick: () => { mobileRemoveBg(); closeMobilePanel(); }, disabled: isRemovingBg },
                  ].map((item, i) => (
                    <button
                      key={i}
                      onClick={item.onClick}
                      disabled={(item as any).disabled}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 text-left transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center">
                        <item.icon className="w-5 h-5 text-slate-300" />
                      </div>
                      <span className="text-sm text-slate-200">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== 手機版底部工具列 (fixed 浮動在最底層) ===== */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-slate-900/95 backdrop-blur-xl border-t border-slate-700/50" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {/* 第一行：復原/重做 + 快捷動作 */}
        <div className="flex items-center justify-between px-2 py-0.5 border-b border-slate-800/50">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="sm"
              onClick={() => useDesignStudioStore.getState().undo()}
              className="w-7 h-7 p-0 text-slate-400 hover:text-white"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={() => useDesignStudioStore.getState().redo()}
              className="w-7 h-7 p-0 text-slate-400 hover:text-white"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </Button>
          </div>
          <span className="text-[10px] text-slate-500">{layers.length} 個圖層</span>
        </div>

        {/* 第二行：主要工具列 */}
        <div className="flex items-center justify-around px-1 py-1.5">
          {[
            { 
              icon: MousePointer2, 
              label: "選取", 
              id: "select",
              active: useDesignStudioStore.getState().activeTool === "select",
              onClick: () => { useDesignStudioStore.getState().setActiveTool("select"); setMobilePanel(null); },
            },
            { icon: Type, label: "文字", id: "text", onClick: mobileAddText },
            { icon: Upload, label: "圖片", id: "image", onClick: mobileUploadImage },
            { icon: Shapes, label: "形狀", id: "shapes", onClick: () => toggleMobilePanel("shapes") },
            { icon: Layers, label: "圖層", id: "layers", onClick: () => toggleMobilePanel("layers") },
            { icon: Settings2, label: "屬性", id: "properties", onClick: () => toggleMobilePanel("properties") },
            { icon: MoreHorizontal, label: "更多", id: "more", onClick: () => toggleMobilePanel("more") },
          ].map((tool) => (
            <button
              key={tool.id}
              onClick={tool.onClick}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition-all active:scale-90",
                (tool as any).active || mobilePanel === tool.id
                  ? "text-indigo-400"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <tool.icon className="w-5 h-5" />
              <span className="text-[10px] leading-tight">{tool.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
