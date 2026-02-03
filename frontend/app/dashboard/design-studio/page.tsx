"use client";

/**
 * Design Studio - 專業級圖片設計編輯器
 * 對標 Canva Pro 的設計工具
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
            cloned.set({
              left: (cloned.left || 0) + 20,
              top: (cloned.top || 0) + 20,
            });
            canvas.add(cloned);
            canvas.setActiveObject(cloned);
            canvas.renderAll();
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

  return (
    <div className="h-screen flex flex-col bg-slate-950 dark:bg-slate-950 overflow-hidden">
      {/* 頂部工具列 */}
      <TopToolbar />

      {/* 主體內容 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左側工具列 */}
        <ToolsPanel />

        {/* 左側面板 */}
        <div 
          className={cn(
            "bg-white dark:bg-slate-900/95 backdrop-blur-sm border-r border-slate-200 dark:border-slate-700/50 transition-all duration-300 flex flex-col flex-shrink-0",
            leftPanelOpen ? "w-[200px] sm:w-64 overflow-y-auto" : "w-0 overflow-hidden"
          )}
        >
          {leftPanelOpen && (
            <Tabs value={activeLeftTab} onValueChange={setActiveLeftTab} className="flex-1 flex flex-col min-h-0">
              <TabsList className="mx-2 mt-2 grid grid-cols-4 bg-slate-800/50 dark:bg-slate-800/50 h-9 shrink-0">
                <TabsTrigger value="layers" className="text-[10px] sm:text-xs px-1 sm:px-2 data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
                  <Layers className="w-3.5 h-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">圖層</span>
                </TabsTrigger>
                <TabsTrigger value="gallery" className="text-[10px] sm:text-xs px-1 sm:px-2 data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
                  <Images className="w-3.5 h-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">圖庫</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="templates" 
                  className="text-[10px] sm:text-xs px-1 sm:px-2 data-[state=active]:bg-indigo-500 data-[state=active]:text-white"
                >
                  <LayoutTemplate className="w-3.5 h-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">模板</span>
                </TabsTrigger>
                <TabsTrigger value="assets" className="text-[10px] sm:text-xs px-1 sm:px-2 data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
                  <FolderOpen className="w-3.5 h-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">素材</span>
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

        {/* 右側面板 */}
        <div 
          className={cn(
            "bg-white dark:bg-slate-900/95 backdrop-blur-sm border-l border-slate-200 dark:border-slate-700/50 transition-all duration-300 flex flex-col flex-shrink-0",
            rightPanelOpen ? "w-[200px] sm:w-72 overflow-y-auto" : "w-0 overflow-hidden"
          )}
        >
          {rightPanelOpen && (
            <Tabs value={activeRightTab} onValueChange={(v) => setActiveRightTab(v as "properties" | "filters")} className="flex-1 flex flex-col min-h-0">
              <TabsList className="mx-2 mt-2 grid grid-cols-2 bg-slate-100 dark:bg-slate-800/50 h-9 shrink-0">
                <TabsTrigger value="properties" className="text-[10px] sm:text-xs px-1 sm:px-2 data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
                  <Settings2 className="w-3.5 h-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">屬性</span>
                </TabsTrigger>
                <TabsTrigger value="filters" className="text-[10px] sm:text-xs px-1 sm:px-2 data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
                  <Sparkles className="w-3.5 h-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">濾鏡</span>
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

      {/* 底部狀態列 */}
      <div className="h-7 bg-slate-100 dark:bg-slate-900/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-700/50 flex items-center justify-between px-2 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-slate-600 dark:text-slate-500">
          <span className="flex items-center gap-1">
            <Palette className="w-3 h-3" />
            <span className="hidden sm:inline">圖片編輯室</span>
          </span>
          <span className="hidden sm:inline">|</span>
          <span className="hidden sm:inline">Fabric.js v5.3</span>
          <span className="hidden sm:inline">|</span>
          <span>{layers.length} 個圖層</span>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-xs text-slate-600 dark:text-slate-500">
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


    </div>
  );
}
