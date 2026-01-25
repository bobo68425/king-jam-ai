"use client";

/**
 * AssetPanel - 素材庫面板
 * 管理用戶上傳的圖片素材，支援拖放到畫布
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Upload, 
  Search, 
  Trash2, 
  MoreVertical, 
  Image as ImageIcon,
  Edit2,
  HardDrive,
  FolderOpen
} from 'lucide-react';
import { useDesignStudioStore } from '@/stores/design-studio-store';
import { toast } from 'sonner';
import { assetService } from '@/lib/services/asset-service';
import { formatFileSize } from '@/lib/db/design-studio-db';
import type { Asset } from '@/lib/db/design-studio-db';
import { fabric } from 'fabric';

export function AssetPanel() {
  const { canvas, addLayer } = useDesignStudioStore();
  
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [storageUsed, setStorageUsed] = useState('0 KB');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 載入素材列表
  const loadAssets = useCallback(async () => {
    setIsLoading(true);
    try {
      const allAssets = await assetService.getAllAssets();
      setAssets(allAssets);
      
      const storage = await assetService.getTotalStorageUsed();
      setStorageUsed(storage);
    } catch (error) {
      console.error('載入素材失敗:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // 過濾素材
  const filteredAssets = searchQuery
    ? assets.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : assets;

  // 處理檔案上傳
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    try {
      const result = await assetService.uploadImages(files);
      
      if (result.failed.length > 0) {
        const errors = result.failed.map(f => `${f.file.name}: ${f.error}`).join('\n');
        toast.error(`部分檔案上傳失敗:\n${errors}`);
      }
      
      loadAssets();
    } catch (error) {
      console.error('上傳失敗:', error);
      toast.error('上傳失敗');
    } finally {
      setIsUploading(false);
    }
  };

  // 拖放處理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    
    const files = e.dataTransfer.files;
    handleFileSelect(files);
  };

  // 將素材添加到畫布
  const addToCanvas = async (asset: Asset) => {
    if (!canvas || !asset.dataUrl) return;
    
    try {
      fabric.Image.fromURL(asset.dataUrl, (img) => {
        // 縮放圖片以適應畫布
        const maxSize = Math.min(canvas.width!, canvas.height!) * 0.5;
        const scale = Math.min(
          maxSize / (img.width || 1),
          maxSize / (img.height || 1),
          1
        );
        
        img.set({
          left: (canvas.width! - (img.width || 0) * scale) / 2,
          top: (canvas.height! - (img.height || 0) * scale) / 2,
          scaleX: scale,
          scaleY: scale,
        });
        
        // 設定 ID
        const id = `img-${Date.now()}`;
        (img as any).id = id;
        (img as any).name = asset.name;
        
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        
        // 添加到圖層
        addLayer({
          id,
          name: asset.name,
          type: 'image',
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: 'source-over',
          fabricObject: img
        });
      });
    } catch (error) {
      console.error('添加圖片到畫布失敗:', error);
    }
  };

  // 刪除素材
  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此素材？')) return;
    
    try {
      await assetService.deleteAsset(id);
      loadAssets();
    } catch (error) {
      console.error('刪除失敗:', error);
    }
  };

  // 重命名
  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    
    try {
      await assetService.renameAsset(id, editName);
      setEditingId(null);
      loadAssets();
    } catch (error) {
      console.error('重命名失敗:', error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 標題和上傳 */}
      <div className="p-3 border-b space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="font-medium flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            素材庫
          </h3>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <HardDrive className="w-3 h-3" />
            {storageUsed}
          </div>
        </div>
        
        {/* 上傳區域 */}
        <div
          className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer
            ${isDraggingOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">
            {isUploading ? '上傳中...' : '拖放或點擊上傳圖片'}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            支援 JPG, PNG, GIF, WebP, SVG
          </div>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
        
        {/* 搜尋 */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜尋素材..."
            className="pl-8 h-8"
          />
        </div>
      </div>
      
      {/* 素材列表 */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            載入中...
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {searchQuery ? '找不到符合的素材' : '尚無素材，上傳圖片開始'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredAssets.map(asset => (
              <div
                key={asset.id}
                className="group relative aspect-square bg-muted rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                onClick={() => addToCanvas(asset)}
              >
                {/* 縮圖 */}
                {asset.thumbnail ? (
                  <img
                    src={asset.thumbnail}
                    alt={asset.name}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                
                {/* 懸停資訊 */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                  {editingId === asset.id ? (
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => handleRename(asset.id)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRename(asset.id)}
                      autoFocus
                      className="h-6 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="text-white text-xs truncate">{asset.name}</div>
                  )}
                  <div className="text-white/70 text-[10px]">
                    {asset.width}×{asset.height} · {formatFileSize(asset.size)}
                  </div>
                </div>
                
                {/* 操作選單 */}
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="secondary" size="icon" className="h-6 w-6">
                        <MoreVertical className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(asset.id);
                        setEditName(asset.name);
                      }}>
                        <Edit2 className="w-3 h-3 mr-2" />
                        重命名
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(asset.id);
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="w-3 h-3 mr-2" />
                        刪除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AssetPanel;
