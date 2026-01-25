"use client";

/**
 * Top Toolbar - 頂部工具列
 * 包含檔案操作、Undo/Redo、畫布設定等
 */

import React, { useState, useEffect, useCallback } from "react";
import { 
  Undo2, 
  Redo2, 
  Download, 
  Upload, 
  Save,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Ruler,
  Magnet,
  Settings,
  FileJson,
  Image as ImageIcon,
  ChevronDown,
  PanelLeftClose,
  PanelRightClose,
  Keyboard,
  FilePlus,
  FolderOpen,
  SaveAll,
  History,
  CheckCircle,
  Circle,
  Loader2,
  AlertCircle,
  File,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { fabric } from "fabric";
import { useDesignStudioStore, CANVAS_PRESETS, ExtendedFabricObject } from "@/stores/design-studio-store";

// IndexedDB 專案類型
interface IndexedDBProject {
  id: string;
  name: string;
  thumbnail?: string;
  updatedAt: Date;
  size?: number;
  canvasWidth?: number;
  canvasHeight?: number;
}
import { useFileStore, STORAGE_SIZE_OPTIONS } from "@/stores/file-store";
import { storageService } from "@/lib/services/storage-service";
import { localFileService } from "@/lib/services/local-file-service";
import { toast } from "sonner";
import { 
  HardDrive, 
  Database,
  Trash2,
  ImagePlus,
  Images,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { sharedGalleryService, setPendingImageForEngine, type TargetEngine } from "@/lib/services/shared-gallery-service";
import { useRouter } from "next/navigation";
import { Share2, PenTool, Video } from "lucide-react";
import {
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";

export default function TopToolbar() {
  const {
    canvas,
    templateName,
    setTemplateName,
    canvasWidth,
    canvasHeight,
    setCanvasSize,
    canvasBackgroundColor,
    setCanvasBackground,
    zoom,
    setZoom,
    showGrid,
    showRulers,
    snapToGrid,
    toggleGrid,
    toggleRulers,
    toggleSnapToGrid,
    undo,
    redo,
    history,
    historyIndex,
    exportToSchema,
    leftPanelOpen,
    rightPanelOpen,
    toggleLeftPanel,
    toggleRightPanel,
  } = useDesignStudioStore();

  const {
    currentProject,
    setCurrentProject,
    saveStatus,
    setSaveStatus,
    markAsSaved,
    markAsModified,
    hasUnsavedChanges,
    openDialog,
    storageMode,
    setStorageMode,
    maxStorageSize,
    setMaxStorageSize,
  } = useFileStore();

  const router = useRouter();

  const [showSizeDialog, setShowSizeDialog] = useState(false);
  const [showStorageDialog, setShowStorageDialog] = useState(false);
  const [customWidth, setCustomWidth] = useState(canvasWidth.toString());
  const [customHeight, setCustomHeight] = useState(canvasHeight.toString());
  const [storageStats, setStorageStats] = useState({ usedSpace: 0, maxSpace: maxStorageSize, projectCount: 0, percentUsed: 0 });
  const [indexedDBProjects, setIndexedDBProjects] = useState<IndexedDBProject[]>([]);

  // 載入儲存統計
  useEffect(() => {
    const loadStats = async () => {
      const stats = await storageService.getStorageStats();
      setStorageStats(stats);
      const projects = await storageService.getAllProjects();
      setIndexedDBProjects(projects);
    };
    if (showStorageDialog) {
      loadStats();
    }
  }, [showStorageDialog, maxStorageSize]);

  // 監聽畫布變化來標記未保存
  useEffect(() => {
    if (!canvas) return;
    
    const handleModified = () => {
      markAsModified();
    };
    
    canvas.on('object:modified', handleModified);
    canvas.on('object:added', handleModified);
    canvas.on('object:removed', handleModified);
    
    return () => {
      canvas.off('object:modified', handleModified);
      canvas.off('object:added', handleModified);
      canvas.off('object:removed', handleModified);
    };
  }, [canvas, markAsModified]);

  // 保存專案
  const handleSave = useCallback(async () => {
    if (!canvas) return;
    
    setSaveStatus('saving');
    try {
      const projectName = currentProject?.name || templateName || '未命名專案';
      
      if (storageMode === 'indexeddb') {
        // 保存到 IndexedDB
        const result = await storageService.saveProjectToIndexedDB(
          canvas,
          projectName,
          canvasWidth,
          canvasHeight,
          canvasBackgroundColor,
          currentProject?.id
        );
        
        if (result.success) {
          setCurrentProject({
            id: result.id,
            name: projectName,
            createdAt: currentProject?.createdAt || new Date(),
            updatedAt: new Date(),
          });
          markAsSaved();
          if (result.warning) {
            toast.warning(result.warning);
          } else {
            toast.success('專案已保存到瀏覽器');
          }
        } else {
          setSaveStatus('error');
          toast.error(result.warning || '保存失敗');
        }
      } else {
        // 保存到本地檔案
        const success = await localFileService.saveProject(
          canvas,
          projectName,
          canvasWidth,
          canvasHeight,
          canvasBackgroundColor
        );
        
        if (success) {
          markAsSaved();
          toast.success('專案已保存到本地');
        }
      }
    } catch (error) {
      console.error('保存失敗:', error);
      setSaveStatus('error');
      toast.error('保存失敗');
    }
  }, [canvas, currentProject, templateName, canvasWidth, canvasHeight, canvasBackgroundColor, storageMode, setSaveStatus, markAsSaved, setCurrentProject]);

  // 開啟專案
  const handleOpen = useCallback(async () => {
    if (!canvas) return;
    
    try {
      if (storageMode === 'indexeddb') {
        // 開啟 IndexedDB 專案列表對話框
        openDialog('open-project');
      } else {
        // 從本地檔案開啟
        const project = await localFileService.openProject();
        if (!project) return;
        
        await localFileService.loadProjectToCanvas(
          project,
          canvas,
          setCanvasSize,
          setCanvasBackground
        );
        
        setTemplateName(project.name);
        setCurrentProject({
          id: Date.now().toString(),
          name: project.name,
          createdAt: new Date(project.createdAt),
          updatedAt: new Date(project.updatedAt),
        });
        markAsSaved();
        toast.success(`已開啟專案：${project.name}`);
      }
    } catch (error) {
      console.error('開啟失敗:', error);
      toast.error(error instanceof Error ? error.message : '開啟專案失敗');
    }
  }, [canvas, storageMode, setCanvasSize, setCanvasBackground, setTemplateName, setCurrentProject, markAsSaved, openDialog]);
  
  // 從 IndexedDB 載入專案
  const loadFromIndexedDB = useCallback(async (projectId: string) => {
    if (!canvas) return;
    
    try {
      const project = await storageService.loadProjectFromIndexedDB(
        projectId,
        canvas,
        setCanvasSize,
        setCanvasBackground
      );
      
      if (project) {
        setTemplateName(project.name);
        setCurrentProject({
          id: project.id,
          name: project.name,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        });
        markAsSaved();
        openDialog('none');
        toast.success(`已開啟專案：${project.name}`);
      }
    } catch (error) {
      console.error('載入專案失敗:', error);
      toast.error('載入專案失敗');
    }
  }, [canvas, setCanvasSize, setCanvasBackground, setTemplateName, setCurrentProject, markAsSaved, openDialog]);

  // 開啟圖片檔案作為新專案
  const handleOpenImage = useCallback(async () => {
    if (!canvas) return;
    
    // 檢查未保存的變更
    if (hasUnsavedChanges) {
      if (!confirm('有未保存的變更，確定要開啟新圖片嗎？')) {
        return;
      }
    }
    
    try {
      const imageData = await localFileService.openImageAsProject();
      if (!imageData) return; // 用戶取消
      
      // 清除現有物件（保留網格和參考線）
      const objectsToRemove = canvas.getObjects().filter((obj) => {
        const extObj = obj as ExtendedFabricObject;
        return !extObj.isGrid && !extObj.isGuide;
      });
      objectsToRemove.forEach(obj => canvas.remove(obj));
      
      // 設定畫布尺寸為圖片尺寸
      setCanvasSize(imageData.width, imageData.height);
      setCanvasBackground('#FFFFFF');
      
      // 將圖片載入到畫布
      fabric.Image.fromURL(imageData.dataUrl, (img) => {
        // 設定圖片屬性
        img.set({
          left: 0,
          top: 0,
          originX: 'left',
          originY: 'top',
          selectable: true,
          evented: true,
        });
        
        // 添加自定義屬性
        (img as ExtendedFabricObject).id = `img-${Date.now()}`;
        (img as ExtendedFabricObject).name = imageData.name;
        
        canvas.add(img);
        canvas.renderAll();
        
        // 更新專案資訊
        setTemplateName(imageData.name);
        setCurrentProject({
          id: Date.now().toString(),
          name: imageData.name,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        markAsModified(); // 標記為有修改（因為是新開啟的圖片）
        
        toast.success(`已開啟圖片：${imageData.name} (${imageData.width} × ${imageData.height})`);
      }, { crossOrigin: 'anonymous' });
    } catch (error) {
      console.error('開啟圖片失敗:', error);
      toast.error(error instanceof Error ? error.message : '開啟圖片失敗');
    }
  }, [canvas, hasUnsavedChanges, setCanvasSize, setCanvasBackground, setTemplateName, setCurrentProject, markAsModified]);

  // 新建專案
  const handleNew = useCallback(() => {
    if (hasUnsavedChanges) {
      if (!confirm('有未保存的變更，確定要新建專案嗎？')) {
        return;
      }
    }
    
    if (!canvas) return;
    
    // 清除畫布（保留網格和參考線）
    const objectsToRemove = canvas.getObjects().filter((obj) => {
      const extObj = obj as ExtendedFabricObject;
      return !extObj.isGrid && !extObj.isGuide;
    });
    objectsToRemove.forEach(obj => canvas.remove(obj));
    
    // 重置設定
    setCanvasSize(1080, 1080);
    setCanvasBackground('#FFFFFF');
    setTemplateName('未命名專案');
    setCurrentProject(null);
    markAsSaved();
    
    canvas.renderAll();
    toast.success('已建立新專案');
  }, [canvas, hasUnsavedChanges, setCanvasSize, setCanvasBackground, setTemplateName, setCurrentProject, markAsSaved]);

  // 匯出 PNG
  const exportPNG = useCallback((transparent: boolean = false) => {
    if (!canvas) return;
    
    // 臨時隱藏網格和參考線
    const hiddenObjects: fabric.Object[] = [];
    canvas.getObjects().forEach((obj) => {
      const extObj = obj as ExtendedFabricObject;
      if (extObj.isGrid || extObj.isGuide) {
        obj.visible = false;
        hiddenObjects.push(obj);
      }
    });
    
    if (transparent) {
      // 透明背景匯出
      // 保存當前背景
      const currentBg = canvas.backgroundColor;
      
      // 直接設置 backgroundColor 屬性為空（同步）
      canvas.backgroundColor = '' as string;
      canvas.renderAll();
      
      // 使用 requestAnimationFrame 確保畫布已更新
      requestAnimationFrame(() => {
        const dataUrl = canvas.toDataURL({
          format: "png",
          quality: 1,
          multiplier: 2,
        });
        
        // 恢復背景
        canvas.backgroundColor = currentBg;
        
        // 恢復網格和參考線
        hiddenObjects.forEach(obj => obj.visible = true);
        canvas.renderAll();
        
        // 下載
        const link = document.createElement("a");
        link.download = `${templateName || "design"}-transparent-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        
        toast.success("已匯出透明背景 PNG");
      });
    } else {
      // 一般匯出（含背景）
      const dataUrl = canvas.toDataURL({
        format: "png",
        quality: 1,
        multiplier: 2,
      });
      
      // 恢復網格和參考線
      hiddenObjects.forEach(obj => obj.visible = true);
      canvas.renderAll();
      
      const link = document.createElement("a");
      link.download = `${templateName || "design"}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      
      toast.success("已匯出 PNG 圖片");
    }
  }, [canvas, templateName]);

  // 匯出 JSON Schema
  const exportJSON = useCallback(() => {
    const schema = exportToSchema();
    if (!schema) {
      toast.error("匯出失敗");
      return;
    }
    
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `${templateName || "template"}-${Date.now()}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success("已匯出 JSON 模板");
  }, [exportToSchema, templateName]);

  // 導出到圖庫
  const exportToGallery = useCallback(async () => {
    if (!canvas) return;
    
    // 臨時隱藏網格和參考線
    const hiddenObjects: fabric.Object[] = [];
    canvas.getObjects().forEach((obj) => {
      const extObj = obj as ExtendedFabricObject;
      if (extObj.isGrid || extObj.isGuide) {
        obj.visible = false;
        hiddenObjects.push(obj);
      }
    });
    
    canvas.renderAll();
    
    const dataUrl = canvas.toDataURL({
      format: "png",
      quality: 1,
      multiplier: 1,
    });
    
    // 恢復網格和參考線
    hiddenObjects.forEach(obj => obj.visible = true);
    canvas.renderAll();
    
    try {
      await sharedGalleryService.addImageFromDataUrl(dataUrl, {
        name: templateName || "設計作品",
        source: "design-studio",
        metadata: {
          canvasWidth,
          canvasHeight,
          backgroundColor: canvasBackgroundColor,
        },
      });
      toast.success("已導出到圖庫，其他引擎可使用此圖片");
    } catch (error) {
      console.error("導出到圖庫失敗:", error);
      toast.error("導出失敗");
    }
  }, [canvas, templateName, canvasWidth, canvasHeight, canvasBackgroundColor]);

  // 導出並返回指定引擎
  const exportAndReturnToEngine = useCallback(async (targetEngine: TargetEngine) => {
    if (!canvas) return;
    
    // 臨時隱藏網格和參考線
    const hiddenObjects: fabric.Object[] = [];
    canvas.getObjects().forEach((obj) => {
      const extObj = obj as ExtendedFabricObject;
      if (extObj.id === 'grid' || extObj.id === 'horizontal-guide' || extObj.id === 'vertical-guide') {
        if (obj.visible) {
          hiddenObjects.push(obj);
          obj.visible = false;
        }
      }
    });
    canvas.renderAll();
    
    const dataUrl = canvas.toDataURL({
      format: "png",
      quality: 1,
      multiplier: 1,
    });
    
    // 恢復網格和參考線
    hiddenObjects.forEach(obj => obj.visible = true);
    canvas.renderAll();
    
    try {
      // 同時儲存到圖庫
      await sharedGalleryService.addImageFromDataUrl(dataUrl, {
        name: templateName || "設計作品",
        source: "design-studio",
        metadata: {
          canvasWidth,
          canvasHeight,
          backgroundColor: canvasBackgroundColor,
          exportedTo: targetEngine,
        },
      });
      
      // 設定待導入的圖片（async，使用 IndexedDB 存儲）
      await setPendingImageForEngine({
        dataUrl,
        targetEngine,
        name: templateName || "設計作品",
        width: canvasWidth,
        height: canvasHeight,
        metadata: {
          backgroundColor: canvasBackgroundColor,
        },
      });
      
      const engineNames = {
        social: "社群圖文",
        blog: "部落格",
        video: "短影音",
      };
      
      toast.success(`正在導向 ${engineNames[targetEngine]}...`);
      
      // 跳轉到目標引擎
      const routes = {
        social: "/dashboard/social",
        blog: "/dashboard/blog",
        video: "/dashboard/video",
      };
      
      router.push(routes[targetEngine]);
    } catch (error) {
      console.error("導出失敗:", error);
      toast.error("導出失敗");
    }
  }, [canvas, templateName, canvasWidth, canvasHeight, canvasBackgroundColor, router]);

  // 鍵盤快捷鍵
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;
      
      // Ctrl/Cmd + N: 新建專案
      if (cmdKey && e.key === 'n') {
        e.preventDefault();
        handleNew();
      }
      // Ctrl/Cmd + O: 開啟專案
      else if (cmdKey && e.key === 'o') {
        e.preventDefault();
        handleOpen();
      }
      // Ctrl/Cmd + I: 開啟圖片
      else if (cmdKey && e.key === 'i') {
        e.preventDefault();
        handleOpenImage();
      }
      // Ctrl/Cmd + S: 保存
      else if (cmdKey && !e.shiftKey && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      // Ctrl/Cmd + Shift + S: 另存新檔（同保存）
      else if (cmdKey && e.shiftKey && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      // Ctrl/Cmd + E: 匯出 PNG
      else if (cmdKey && e.key === 'e') {
        e.preventDefault();
        exportPNG(false);
      }
      // Ctrl/Cmd + Shift + E: 匯出透明 PNG
      else if (cmdKey && e.shiftKey && e.key === 'e') {
        e.preventDefault();
        exportPNG(true);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNew, handleOpen, handleOpenImage, handleSave, exportPNG]);

  // 保存狀態圖示
  const SaveStatusIcon = () => {
    switch (saveStatus) {
      case 'saved':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'saving':
        return <Loader2 className="w-3 h-3 text-yellow-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-3 h-3 text-red-500" />;
      default:
        return <Circle className="w-3 h-3 text-slate-500" />;
    }
  };

  // 應用自訂尺寸
  const applyCustomSize = () => {
    const w = parseInt(customWidth);
    const h = parseInt(customHeight);
    if (w > 0 && h > 0) {
      setCanvasSize(w, h);
      setShowSizeDialog(false);
      toast.success(`畫布尺寸已更改為 ${w} x ${h}`);
    }
  };

  // 按預設尺寸分類
  const presetsByCategory = CANVAS_PRESETS.reduce((acc, preset) => {
    if (!acc[preset.category]) acc[preset.category] = [];
    acc[preset.category].push(preset);
    return acc;
  }, {} as Record<string, typeof CANVAS_PRESETS>);

  return (
    <div className="h-12 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50 flex items-center justify-between px-4">
      {/* 左側：檔案選單 & 專案名稱 */}
      <div className="flex items-center gap-3">
        {/* 切換左側面板 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleLeftPanel}
          className="w-8 h-8 p-0 text-slate-400 hover:text-white"
        >
          <PanelLeftClose className={`w-4 h-4 transition-transform ${!leftPanelOpen ? "rotate-180" : ""}`} />
        </Button>

        <Separator orientation="vertical" className="h-6 bg-slate-700" />

        {/* 檔案選單 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-slate-300 hover:text-white hover:bg-slate-800"
            >
              <File className="w-4 h-4 mr-1" />
              檔案
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-slate-800 border-slate-700 w-56">
            {/* 儲存模式指示 */}
            <DropdownMenuLabel className="text-slate-400 text-xs flex items-center gap-2">
              {storageMode === 'indexeddb' ? (
                <>
                  <Database className="w-3 h-3" />
                  瀏覽器儲存
                </>
              ) : (
                <>
                  <HardDrive className="w-3 h-3" />
                  本地檔案
                </>
              )}
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={handleNew} className="cursor-pointer">
              <FilePlus className="w-4 h-4 mr-2" />
              新建專案
              <DropdownMenuShortcut>⌘N</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleOpen} className="cursor-pointer">
              <FolderOpen className="w-4 h-4 mr-2" />
              開啟專案
              <DropdownMenuShortcut>⌘O</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleOpenImage} className="cursor-pointer">
              <ImagePlus className="w-4 h-4 mr-2" />
              開啟圖片
              <DropdownMenuShortcut>⌘I</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-700" />
            <DropdownMenuItem onClick={handleSave} className="cursor-pointer">
              <Save className="w-4 h-4 mr-2" />
              保存專案
              <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-700" />
            <DropdownMenuLabel className="text-slate-400 text-xs">匯出</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => exportPNG(false)} className="cursor-pointer">
              <ImageIcon className="w-4 h-4 mr-2" />
              匯出 PNG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportPNG(true)} className="cursor-pointer">
              <ImageIcon className="w-4 h-4 mr-2 text-purple-400" />
              匯出透明 PNG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              if (!canvas) return;
              storageService.exportJPG(canvas, templateName || 'design');
              toast.success('已匯出 JPG 圖片');
            }} className="cursor-pointer">
              <ImageIcon className="w-4 h-4 mr-2" />
              匯出 JPG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              if (!canvas) return;
              storageService.exportSVG(canvas, templateName || 'design');
              toast.success('已匯出 SVG 圖片');
            }} className="cursor-pointer">
              <FileJson className="w-4 h-4 mr-2" />
              匯出 SVG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={async () => {
              if (!canvas) return;
              await storageService.exportPDF(canvas, templateName || 'design');
              toast.success('已匯出 PDF');
            }} className="cursor-pointer">
              <Download className="w-4 h-4 mr-2" />
              匯出 PDF
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-700" />
            <DropdownMenuItem onClick={exportJSON} className="cursor-pointer">
              <FileJson className="w-4 h-4 mr-2" />
              匯出 JSON 模板
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportToGallery} className="cursor-pointer">
              <Images className="w-4 h-4 mr-2 text-indigo-400" />
              導出到圖庫
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer">
                <Share2 className="w-4 h-4 mr-2 text-green-400" />
                導回引擎
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="bg-slate-800 border-slate-700">
                <DropdownMenuItem onClick={() => exportAndReturnToEngine('social')} className="cursor-pointer">
                  <ImageIcon className="w-4 h-4 mr-2 text-pink-400" />
                  社群圖文
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportAndReturnToEngine('blog')} className="cursor-pointer">
                  <PenTool className="w-4 h-4 mr-2 text-blue-400" />
                  部落格文章
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportAndReturnToEngine('video')} className="cursor-pointer">
                  <Video className="w-4 h-4 mr-2 text-purple-400" />
                  短影音生成
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator className="bg-slate-700" />
            <DropdownMenuItem onClick={() => setShowStorageDialog(true)} className="cursor-pointer">
              <Settings className="w-4 h-4 mr-2" />
              儲存設定
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-6 bg-slate-700" />

        {/* 專案名稱 + 保存狀態 */}
        <div className="flex items-center gap-2">
          <Input
            value={currentProject?.name || templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="w-40 h-8 bg-transparent border-transparent text-sm font-medium hover:bg-slate-800/50 focus:bg-slate-800 focus:border-slate-600"
          />
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center">
                  <SaveStatusIcon />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-slate-800 border-slate-700">
                <div className="text-xs">
                  {saveStatus === 'saved' && '已保存'}
                  {saveStatus === 'saving' && '保存中...'}
                  {saveStatus === 'error' && '保存失敗'}
                  {saveStatus === 'unsaved' && '有未保存的變更'}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <Separator orientation="vertical" className="h-6 bg-slate-700" />

        {/* Undo/Redo */}
        <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={undo}
                  disabled={historyIndex <= 0}
                  className="w-8 h-8 p-0 text-slate-400 hover:text-white disabled:opacity-30"
                >
                  <Undo2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-slate-800 border-slate-700">
                <div className="text-xs">
                  <div className="font-medium">復原</div>
                  <div className="text-slate-400 flex items-center gap-1 mt-0.5">
                    <kbd className="px-1 py-0.5 bg-slate-700 rounded text-[10px]">⌘Z</kbd>
                  </div>
                  {history[historyIndex]?.description && (
                    <div className="text-slate-500 mt-1 pt-1 border-t border-slate-700">
                      目前: {history[historyIndex]?.description}
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
            
            {/* 歷史記錄指示器 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-[10px] text-slate-500 font-mono min-w-[32px] text-center cursor-default">
                  {historyIndex + 1}/{history.length}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-slate-800 border-slate-700">
                <div className="text-xs">
                  步驟 {historyIndex + 1} / 共 {history.length} 步
                </div>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={redo}
                  disabled={historyIndex >= history.length - 1}
                  className="w-8 h-8 p-0 text-slate-400 hover:text-white disabled:opacity-30"
                >
                  <Redo2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-slate-800 border-slate-700">
                <div className="text-xs">
                  <div className="font-medium">重做</div>
                  <div className="text-slate-400 flex items-center gap-1 mt-0.5">
                    <kbd className="px-1 py-0.5 bg-slate-700 rounded text-[10px]">⌘⇧Z</kbd>
                  </div>
                  {history[historyIndex + 1]?.description && (
                    <div className="text-slate-500 mt-1 pt-1 border-t border-slate-700">
                      下一步: {history[historyIndex + 1]?.description}
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {/* 中間：畫布設定 */}
      <div className="flex items-center gap-2">
        {/* 畫布尺寸 */}
        <Dialog open={showSizeDialog} onOpenChange={setShowSizeDialog}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs bg-slate-800/50 border-slate-700 hover:bg-slate-700"
            >
              {canvasWidth} × {canvasHeight}
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white">畫布尺寸</DialogTitle>
            </DialogHeader>
            
            {/* 預設尺寸 */}
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {Object.entries(presetsByCategory).map(([category, presets]) => (
                <div key={category}>
                  <Label className="text-xs text-slate-400 mb-2 block">{category}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {presets.map((preset) => (
                      <Button
                        key={preset.id}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCanvasSize(preset.width, preset.height);
                          setCustomWidth(preset.width.toString());
                          setCustomHeight(preset.height.toString());
                          setShowSizeDialog(false);
                          toast.success(`已套用 ${preset.name}`);
                        }}
                        className={`justify-start text-xs h-auto py-2 ${
                          canvasWidth === preset.width && canvasHeight === preset.height
                            ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300"
                            : "bg-slate-800/50 border-slate-700"
                        }`}
                      >
                        <div className="text-left">
                          <div>{preset.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {preset.width} × {preset.height}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
              
              {/* 自訂尺寸 */}
              <div>
                <Label className="text-xs text-slate-400 mb-2 block">自訂尺寸</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(e.target.value)}
                    className="w-24 bg-slate-800/50 border-slate-700 text-sm"
                    placeholder="寬"
                  />
                  <span className="text-slate-500">×</span>
                  <Input
                    type="number"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(e.target.value)}
                    className="w-24 bg-slate-800/50 border-slate-700 text-sm"
                    placeholder="高"
                  />
                  <Button size="sm" onClick={applyCustomSize}>
                    套用
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 背景色 */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  value={canvasBackgroundColor}
                  onChange={(e) => setCanvasBackground(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-slate-600 hover:border-slate-500 transition-colors"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-slate-800 border-slate-700">
              <div className="text-xs">
                <div>背景顏色</div>
                <div className="text-slate-500 font-mono">{canvasBackgroundColor}</div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Separator orientation="vertical" className="h-6 bg-slate-700" />

        {/* 縮放 */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom(zoom - 0.1)}
            className="w-8 h-8 p-0 text-slate-400 hover:text-white"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs font-mono text-slate-400 w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom(zoom + 0.1)}
            className="w-8 h-8 p-0 text-slate-400 hover:text-white"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6 bg-slate-700" />

        {/* 顯示選項 */}
        <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleGrid}
                  className={`w-8 h-8 p-0 ${showGrid ? "text-indigo-400" : "text-slate-400"} hover:text-white`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-slate-800 border-slate-700">
                <div className="text-xs">顯示網格 {showGrid ? "(開啟)" : "(關閉)"}</div>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleRulers}
                  className={`w-8 h-8 p-0 ${showRulers ? "text-indigo-400" : "text-slate-400"} hover:text-white`}
                >
                  <Ruler className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-slate-800 border-slate-700">
                <div className="text-xs">顯示尺規 {showRulers ? "(開啟)" : "(關閉)"}</div>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSnapToGrid}
                  className={`w-8 h-8 p-0 ${snapToGrid ? "text-indigo-400" : "text-slate-400"} hover:text-white`}
                >
                  <Magnet className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-slate-800 border-slate-700">
                <div className="text-xs">對齊網格 {snapToGrid ? "(開啟)" : "(關閉)"}</div>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {/* 右側：快捷鍵 & 匯出 & 面板切換 */}
      <div className="flex items-center gap-2">
        {/* 快捷鍵說明 */}
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-8 h-8 p-0 text-slate-400 hover:text-white"
            >
              <Keyboard className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-indigo-400" />
                鍵盤快捷鍵
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              {/* 檔案操作 */}
              <div>
                <h4 className="text-xs text-slate-400 mb-2 font-medium">檔案操作</h4>
                <div className="space-y-1.5">
                  <ShortcutRow keys={["⌘", "N"]} desc="新建專案" />
                  <ShortcutRow keys={["⌘", "O"]} desc="開啟專案" />
                  <ShortcutRow keys={["⌘", "S"]} desc="保存" />
                  <ShortcutRow keys={["⌘", "⇧", "S"]} desc="另存新檔" />
                  <ShortcutRow keys={["⌘", "E"]} desc="匯出圖片" />
                </div>
              </div>
              
              {/* 基本操作 */}
              <div>
                <h4 className="text-xs text-slate-400 mb-2 font-medium">基本操作</h4>
                <div className="space-y-1.5">
                  <ShortcutRow keys={["⌘", "Z"]} desc="復原" />
                  <ShortcutRow keys={["⌘", "⇧", "Z"]} desc="重做" />
                  <ShortcutRow keys={["⌘", "A"]} desc="全選" />
                  <ShortcutRow keys={["⌘", "D"]} desc="複製物件" />
                  <ShortcutRow keys={["Delete"]} desc="刪除物件" />
                  <ShortcutRow keys={["Esc"]} desc="取消選取" />
                </div>
              </div>
              
              {/* 移動物件 */}
              <div>
                <h4 className="text-xs text-slate-400 mb-2 font-medium">移動物件</h4>
                <div className="space-y-1.5">
                  <ShortcutRow keys={["↑", "↓", "←", "→"]} desc="微調位置 (1px)" />
                  <ShortcutRow keys={["⇧", "方向鍵"]} desc="快速移動 (10px)" />
                </div>
              </div>
              
              {/* 縮放操作 */}
              <div>
                <h4 className="text-xs text-slate-400 mb-2 font-medium">縮放操作</h4>
                <div className="space-y-1.5">
                  <ShortcutRow keys={["⇧", "拖曳角落"]} desc="等比例縮放" />
                  <ShortcutRow keys={["⌥", "拖曳"]} desc="從中心縮放" />
                  <ShortcutRow keys={["⇧", "⌥", "拖曳"]} desc="從中心等比縮放" />
                </div>
              </div>
              
              {/* 畫布操作 */}
              <div>
                <h4 className="text-xs text-slate-400 mb-2 font-medium">畫布操作</h4>
                <div className="space-y-1.5">
                  <ShortcutRow keys={["⌘", "滾輪"]} desc="縮放畫布" />
                  <ShortcutRow keys={["雙擊空白"]} desc="適應螢幕" />
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Separator orientation="vertical" className="h-6 bg-slate-700" />
        
        {/* 匯出選單 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              size="sm" 
              className="h-8 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
            >
              <Download className="w-4 h-4 mr-1" />
              匯出
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
            <DropdownMenuLabel className="text-xs text-slate-400">匯出格式</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-700" />
            <DropdownMenuItem onClick={() => exportPNG(false)} className="cursor-pointer">
              <ImageIcon className="w-4 h-4 mr-2 text-green-400" />
              PNG 圖片 (2x)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportPNG(true)} className="cursor-pointer">
              <ImageIcon className="w-4 h-4 mr-2 text-purple-400" />
              透明背景 PNG (2x)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportJSON} className="cursor-pointer">
              <FileJson className="w-4 h-4 mr-2 text-blue-400" />
              JSON 模板
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-6 bg-slate-700" />

        {/* 切換右側面板 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleRightPanel}
          className="w-8 h-8 p-0 text-slate-400 hover:text-white"
        >
          <PanelRightClose className={`w-4 h-4 transition-transform ${!rightPanelOpen ? "rotate-180" : ""}`} />
        </Button>
      </div>

      {/* 儲存設定對話框 */}
      <Dialog open={showStorageDialog} onOpenChange={setShowStorageDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Settings className="w-5 h-5" />
              儲存設定
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* 儲存模式切換 */}
            <div className="space-y-3">
              <Label className="text-sm text-slate-300">儲存模式</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setStorageMode('local')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    storageMode === 'local'
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <HardDrive className={`w-8 h-8 mx-auto mb-2 ${
                    storageMode === 'local' ? 'text-indigo-400' : 'text-slate-500'
                  }`} />
                  <div className="text-sm font-medium text-white">本地檔案</div>
                  <div className="text-xs text-slate-400 mt-1">儲存為 .jam 檔案</div>
                </button>
                <button
                  onClick={() => setStorageMode('indexeddb')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    storageMode === 'indexeddb'
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <Database className={`w-8 h-8 mx-auto mb-2 ${
                    storageMode === 'indexeddb' ? 'text-indigo-400' : 'text-slate-500'
                  }`} />
                  <div className="text-sm font-medium text-white">瀏覽器儲存</div>
                  <div className="text-xs text-slate-400 mt-1">IndexedDB</div>
                </button>
              </div>
            </div>

            {/* IndexedDB 空間設定 */}
            {storageMode === 'indexeddb' && (
              <div className="space-y-3 p-4 bg-slate-800/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-slate-300">空間上限</Label>
                  <select
                    value={maxStorageSize}
                    onChange={(e) => setMaxStorageSize(Number(e.target.value))}
                    className="bg-slate-800 border-slate-600 rounded px-3 py-1 text-sm text-white"
                  >
                    {STORAGE_SIZE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">已使用空間</span>
                    <span className="text-white">
                      {storageService.formatSize(storageStats.usedSpace)} / {storageService.formatSize(maxStorageSize)}
                    </span>
                  </div>
                  <Progress 
                    value={storageStats.percentUsed} 
                    className="h-2"
                  />
                  <div className="text-xs text-slate-500">
                    {storageStats.projectCount} 個專案
                  </div>
                </div>

                {/* 專案列表 */}
                {indexedDBProjects.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <Label className="text-xs text-slate-400">已儲存的專案</Label>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {indexedDBProjects.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2 bg-slate-800 rounded text-xs">
                          <div className="flex items-center gap-2">
                            {p.thumbnail && (
                              <img src={p.thumbnail} className="w-8 h-8 rounded object-cover" alt="" />
                            )}
                            <div>
                              <div className="text-white">{p.name}</div>
                              <div className="text-slate-500">{storageService.formatSize(p.size)}</div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-6 h-6 p-0 text-red-400 hover:text-red-300"
                            onClick={async () => {
                              await storageService.deleteProject(p.id);
                              const projects = await storageService.getAllProjects();
                              setIndexedDBProjects(projects);
                              const stats = await storageService.getStorageStats();
                              setStorageStats(stats);
                              toast.success('已刪除專案');
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 清除所有資料 */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 text-red-400 border-red-400/30 hover:bg-red-500/10"
                  onClick={async () => {
                    if (confirm('確定要清除所有瀏覽器儲存的專案嗎？此操作無法復原。')) {
                      await storageService.clearAllProjects();
                      setIndexedDBProjects([]);
                      setStorageStats({ usedSpace: 0, maxSpace: maxStorageSize, projectCount: 0, percentUsed: 0 });
                      toast.success('已清除所有專案');
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  清除所有資料
                </Button>
              </div>
            )}

            {/* 說明 */}
            <div className="text-xs text-slate-500 space-y-1">
              <p><strong>本地檔案：</strong>專案儲存為 .jam 檔案，可自由備份和分享。</p>
              <p><strong>瀏覽器儲存：</strong>專案儲存在瀏覽器中，清除瀏覽器資料會遺失。</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* IndexedDB 專案列表對話框 */}
      <Dialog open={useFileStore.getState().activeDialog === 'open-project'} onOpenChange={(open) => !open && openDialog('none')}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              開啟專案
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            {indexedDBProjects.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>尚無儲存的專案</p>
              </div>
            ) : (
              <div className="grid gap-3 max-h-[60vh] overflow-y-auto">
                {indexedDBProjects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => loadFromIndexedDB(p.id)}
                    className="flex items-center gap-4 p-3 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors text-left"
                  >
                    {p.thumbnail ? (
                      <img src={p.thumbnail} className="w-16 h-16 rounded object-cover" alt="" />
                    ) : (
                      <div className="w-16 h-16 rounded bg-slate-700 flex items-center justify-center">
                        <File className="w-6 h-6 text-slate-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium truncate">{p.name}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        {p.canvasWidth} × {p.canvasHeight}px
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        更新於 {new Date(p.updatedAt).toLocaleString('zh-TW')}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      {storageService.formatSize(p.size)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 快捷鍵顯示組件
function ShortcutRow({ keys, desc }: { keys: string[]; desc: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-300">{desc}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <kbd
            key={i}
            className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-400 font-mono min-w-[24px] text-center"
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  );
}
