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
  X,
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

  const [showTemplates, setShowTemplates] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<"properties" | "filters">("properties");
  const [activeLeftTab, setActiveLeftTab] = useState<string>("layers");

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
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length > 0) {
          activeObjects.forEach((obj: fabric.Object) => {
            canvas.remove(obj);
            const extObj = obj as ExtendedFabricObject;
            if (extObj.id) {
              useDesignStudioStore.getState().removeLayer(extObj.id);
            }
          });
          canvas.discardActiveObject();
          canvas.renderAll();
        }
      }
      // Escape = 取消選取
      if (e.key === "Escape" && canvas) {
        canvas.discardActiveObject();
        canvas.renderAll();
        useDesignStudioStore.getState().clearSelection();
        setShowTemplates(false);
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
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canvas]);

  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">
      {/* 頂部工具列 */}
      <TopToolbar />

      {/* 主體內容 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左側工具列 */}
        <ToolsPanel />

        {/* 左側面板 */}
        <div 
          className={cn(
            "bg-slate-900/95 backdrop-blur-sm border-r border-slate-700/50 transition-all duration-300 overflow-hidden flex flex-col",
            leftPanelOpen ? "w-64" : "w-0"
          )}
        >
          {leftPanelOpen && (
            <Tabs value={activeLeftTab} onValueChange={setActiveLeftTab} className="flex-1 flex flex-col min-h-0">
              <TabsList className="mx-2 mt-2 grid grid-cols-4 bg-slate-800/50 h-9 shrink-0">
                <TabsTrigger value="layers" className="text-xs data-[state=active]:bg-indigo-500">
                  <Layers className="w-3.5 h-3.5 mr-1" />
                  圖層
                </TabsTrigger>
                <TabsTrigger value="gallery" className="text-xs data-[state=active]:bg-indigo-500">
                  <Images className="w-3.5 h-3.5 mr-1" />
                  圖庫
                </TabsTrigger>
                <TabsTrigger 
                  value="templates" 
                  className="text-xs data-[state=active]:bg-indigo-500"
                  onClick={() => setShowTemplates(true)}
                >
                  <LayoutTemplate className="w-3.5 h-3.5 mr-1" />
                  模板
                </TabsTrigger>
                <TabsTrigger value="assets" className="text-xs data-[state=active]:bg-indigo-500">
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
                <TemplatesPanel onClose={() => setShowTemplates(false)} />
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
            "bg-slate-900/95 backdrop-blur-sm border-l border-slate-700/50 transition-all duration-300 overflow-hidden flex flex-col",
            rightPanelOpen ? "w-72" : "w-0"
          )}
        >
          {rightPanelOpen && (
            <Tabs value={activeRightTab} onValueChange={(v) => setActiveRightTab(v as "properties" | "filters")} className="flex-1 flex flex-col min-h-0">
              <TabsList className="mx-2 mt-2 grid grid-cols-2 bg-slate-800/50 h-9 shrink-0">
                <TabsTrigger value="properties" className="text-xs data-[state=active]:bg-indigo-500">
                  <Settings2 className="w-3.5 h-3.5 mr-1" />
                  屬性
                </TabsTrigger>
                <TabsTrigger value="filters" className="text-xs data-[state=active]:bg-indigo-500">
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

      {/* 底部狀態列 */}
      <div className="h-7 bg-slate-900/95 backdrop-blur-sm border-t border-slate-700/50 flex items-center justify-between px-4">
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Palette className="w-3 h-3" />
            圖片編輯室
          </span>
          <span>|</span>
          <span>Fabric.js v5.3</span>
          <span>|</span>
          <span>{layers.length} 個圖層</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] mr-1">V</kbd>
            選取
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] mr-1">T</kbd>
            文字
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] mr-1">⌘Z</kbd>
            復原
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] mr-1">Del</kbd>
            刪除
          </span>
        </div>
      </div>

      {/* 模板側邊抽屜（全屏覆蓋） */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex">
          {/* 背景遮罩 */}
          <div 
            className="flex-1 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowTemplates(false)}
          />
          
          {/* 模板面板 */}
          <div className="w-96 bg-slate-900 border-l border-slate-700 shadow-2xl animate-in slide-in-from-right">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <LayoutTemplate className="w-5 h-5 text-indigo-400" />
                模板庫
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTemplates(false)}
                className="w-8 h-8 p-0 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="h-[calc(100vh-65px)]">
              <TemplatesPanel onClose={() => setShowTemplates(false)} />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
