"use client";

/**
 * Gallery Panel - 跨引擎圖庫面板
 * 顯示來自其他引擎生成的圖片，可導入到畫布編輯
 */

import React, { useState, useEffect, useCallback } from "react";
import { fabric } from "fabric";
import { 
  Image as ImageIcon, 
  Trash2, 
  Download, 
  RefreshCw,
  LayoutGrid,
  List,
  Search,
  Filter,
  PenTool,
  Share2,
  Video,
  Layers,
  Upload,
  Plus,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useDesignStudioStore } from "@/stores/design-studio-store";
import { 
  sharedGalleryService, 
  type SharedImage, 
  type ImageSource,
} from "@/lib/services/shared-gallery-service";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

// 來源配置
const SOURCE_CONFIG: Record<ImageSource, { label: string; icon: React.ElementType; color: string }> = {
  social: { label: "社群圖文", icon: Share2, color: "bg-pink-500" },
  blog: { label: "部落格", icon: PenTool, color: "bg-blue-500" },
  video: { label: "短影音", icon: Video, color: "bg-purple-500" },
  "design-studio": { label: "圖片編輯室", icon: Layers, color: "bg-indigo-500" },
  upload: { label: "上傳", icon: Upload, color: "bg-slate-500" },
};

export default function GalleryPanel() {
  const { 
    canvas, 
    addLayer,
    canvasWidth,
    canvasHeight,
  } = useDesignStudioStore();

  const [images, setImages] = useState<SharedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSource, setFilterSource] = useState<ImageSource | "all">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // 載入圖片
  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const allImages = await sharedGalleryService.getAllImages();
      setImages(allImages);
    } catch (error) {
      console.error("載入圖庫失敗:", error);
      toast.error("載入圖庫失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  // 過濾圖片
  const filteredImages = images.filter(img => {
    const matchesSearch = img.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSource = filterSource === "all" || img.source === filterSource;
    return matchesSearch && matchesSource;
  });

  // 將圖片導入到畫布
  const importToCanvas = useCallback((image: SharedImage) => {
    if (!canvas) {
      toast.error("畫布未初始化");
      return;
    }

    fabric.Image.fromURL(image.dataUrl, (img) => {
      const id = uuidv4().slice(0, 8);
      
      // 縮放圖片以適應畫布
      const maxSize = Math.min(canvasWidth, canvasHeight) * 0.8;
      const scale = Math.min(
        maxSize / (img.width || 1), 
        maxSize / (img.height || 1),
        1 // 不放大
      );
      
      img.set({
        left: canvasWidth / 2,
        top: canvasHeight / 2,
        originX: "center",
        originY: "center",
        scaleX: scale,
        scaleY: scale,
      });
      
      (img as any).id = id;
      (img as any).name = image.name;
      
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      
      addLayer({
        id,
        name: image.name,
        type: "image",
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: "source-over",
        fabricObject: img,
      });

      toast.success(`已導入「${image.name}」`);
    }, { crossOrigin: "anonymous" });
  }, [canvas, canvasWidth, canvasHeight, addLayer]);

  // 刪除圖片
  const handleDelete = async (id: string) => {
    try {
      await sharedGalleryService.deleteImage(id);
      setImages(prev => prev.filter(img => img.id !== id));
      toast.success("已刪除圖片");
    } catch (error) {
      toast.error("刪除失敗");
    }
    setDeleteConfirm(null);
  };

  // 下載圖片
  const handleDownload = (image: SharedImage) => {
    const link = document.createElement("a");
    link.download = `${image.name}.png`;
    link.href = image.dataUrl;
    link.click();
    toast.success("已下載圖片");
  };

  // 格式化日期
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("zh-TW", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  return (
    <div className="flex flex-col h-full">
      {/* 標題和操作 */}
      <div className="px-3 py-2 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-white">跨引擎圖庫</h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadImages}
              className="w-7 h-7 p-0 text-slate-400 hover:text-white"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              className="w-7 h-7 p-0 text-slate-400 hover:text-white"
            >
              {viewMode === "grid" ? (
                <List className="w-3.5 h-3.5" />
              ) : (
                <LayoutGrid className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
        </div>

        {/* 搜尋和篩選 */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋圖片..."
              className="h-8 pl-7 text-xs bg-slate-800/50 border-slate-700"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 bg-slate-800/50 border-slate-700"
              >
                <Filter className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-slate-800 border-slate-700">
              <DropdownMenuLabel className="text-xs text-slate-400">
                按來源篩選
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-700" />
              <DropdownMenuItem 
                onClick={() => setFilterSource("all")}
                className={cn(filterSource === "all" && "bg-slate-700")}
              >
                全部
              </DropdownMenuItem>
              {Object.entries(SOURCE_CONFIG).map(([source, config]) => (
                <DropdownMenuItem
                  key={source}
                  onClick={() => setFilterSource(source as ImageSource)}
                  className={cn(filterSource === source && "bg-slate-700")}
                >
                  <config.icon className="w-4 h-4 mr-2" />
                  {config.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 圖片列表 */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-slate-500 mx-auto mb-2" />
              <p className="text-xs text-slate-500">載入中...</p>
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="text-center py-8">
              <ImageIcon className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400 mb-1">
                {searchTerm || filterSource !== "all" ? "沒有符合的圖片" : "圖庫是空的"}
              </p>
              <p className="text-xs text-slate-500">
                從其他引擎生成圖片後，可在這裡找到
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 gap-2">
              {filteredImages.map((image) => {
                const config = SOURCE_CONFIG[image.source];
                return (
                  <div
                    key={image.id}
                    className="group relative bg-slate-800/50 rounded-lg overflow-hidden border border-slate-700/50 hover:border-indigo-500/50 transition-colors"
                  >
                    {/* 縮圖 */}
                    <div 
                      className="aspect-square cursor-pointer"
                      onClick={() => importToCanvas(image)}
                    >
                      <img
                        src={image.thumbnail || image.dataUrl}
                        alt={image.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* 來源標籤 */}
                    <div className="absolute top-1 left-1">
                      <Badge className={cn("text-[9px] px-1.5 py-0.5", config.color)}>
                        {config.label}
                      </Badge>
                    </div>

                    {/* 操作按鈕 */}
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(image)}
                        className="w-6 h-6 p-0 bg-black/50 hover:bg-black/70 text-white"
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirm(image.id)}
                        className="w-6 h-6 p-0 bg-black/50 hover:bg-red-500/70 text-white"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>

                    {/* 名稱 */}
                    <div className="p-1.5">
                      <p className="text-xs text-slate-300 truncate">{image.name}</p>
                      <p className="text-[10px] text-slate-500">
                        {image.width} × {image.height}
                      </p>
                    </div>

                    {/* Hover 導入提示 */}
                    <div 
                      className="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      onClick={() => importToCanvas(image)}
                    >
                      <div className="bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                        <Plus className="w-3.5 h-3.5" />
                        導入畫布
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // 列表視圖
            <div className="space-y-1">
              {filteredImages.map((image) => {
                const config = SOURCE_CONFIG[image.source];
                return (
                  <div
                    key={image.id}
                    className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-indigo-500/50 transition-colors cursor-pointer group"
                    onClick={() => importToCanvas(image)}
                  >
                    {/* 縮圖 */}
                    <img
                      src={image.thumbnail || image.dataUrl}
                      alt={image.name}
                      className="w-12 h-12 rounded object-cover"
                    />

                    {/* 資訊 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{image.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge className={cn("text-[9px] px-1.5 py-0", config.color)}>
                          {config.label}
                        </Badge>
                        <span className="text-[10px] text-slate-500">
                          {image.width} × {image.height}
                        </span>
                      </div>
                    </div>

                    {/* 操作 */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(image);
                        }}
                        className="w-7 h-7 p-0 text-slate-400 hover:text-white"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(image.id);
                        }}
                        className="w-7 h-7 p-0 text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 統計 */}
      <div className="px-3 py-2 border-t border-slate-700/50 text-xs text-slate-500">
        {filteredImages.length} 張圖片
        {filterSource !== "all" && ` (${SOURCE_CONFIG[filterSource].label})`}
      </div>

      {/* 刪除確認對話框 */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              確定刪除？
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              此操作無法復原，圖片將從圖庫中永久刪除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              className="bg-slate-800 border-slate-700 hover:bg-slate-700"
            >
              取消
            </Button>
            <Button
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-red-500 hover:bg-red-600"
            >
              刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
