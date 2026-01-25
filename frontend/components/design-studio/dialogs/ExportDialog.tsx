"use client";

/**
 * ExportDialog - 匯出對話框
 * 支援 PNG、JPG、PDF 格式匯出
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, FileImage, FileText, Image } from 'lucide-react';
import { toast } from 'sonner';
import { useFileStore } from '@/stores/file-store';
import { useDesignStudioStore } from '@/stores/design-studio-store';
import { exportService, type ExportFormat, type ExportOptions } from '@/lib/services/export-service';

export function ExportDialog() {
  const { activeDialog, closeDialog, currentProject } = useFileStore();
  const { canvas, canvasWidth, canvasHeight } = useDesignStudioStore();
  
  const [format, setFormat] = useState<ExportFormat>('png');
  const [filename, setFilename] = useState('design');
  const [quality, setQuality] = useState(0.9);
  const [transparentBg, setTransparentBg] = useState(false);
  const [scale, setScale] = useState(1);
  const [pdfSize, setPdfSize] = useState<'a4' | 'a3' | 'letter' | 'custom'>('a4');
  const [pdfOrientation, setPdfOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [isExporting, setIsExporting] = useState(false);
  const [preview, setPreview] = useState<string>('');

  const isOpen = activeDialog === 'export';

  // 初始化檔名
  useEffect(() => {
    if (isOpen && currentProject) {
      setFilename(currentProject.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_'));
    }
  }, [isOpen, currentProject]);

  // 更新預覽
  useEffect(() => {
    if (isOpen && canvas) {
      const previewUrl = exportService.getPreview(canvas, format, {
        quality,
        transparentBg,
        scale
      });
      setPreview(previewUrl);
    }
  }, [isOpen, canvas, format, quality, transparentBg, scale]);

  // 估計檔案大小
  const estimatedSize = useMemo(() => {
    if (!canvas) return '0 KB';
    return exportService.estimateFileSize(canvas, format, {
      quality,
      transparentBg,
      scale
    });
  }, [canvas, format, quality, transparentBg, scale]);

  // 輸出尺寸
  const outputSize = useMemo(() => {
    const width = Math.round(canvasWidth * scale);
    const height = Math.round(canvasHeight * scale);
    return `${width} × ${height} px`;
  }, [canvasWidth, canvasHeight, scale]);

  // 匯出
  const handleExport = async () => {
    if (!canvas) return;
    
    setIsExporting(true);
    try {
      const options: ExportOptions = {
        format,
        quality,
        transparentBg,
        scale,
        pdfSize,
        pdfOrientation
      };
      
      const result = await exportService.export(canvas, filename, options);
      
      if (result.success) {
        closeDialog();
      } else {
        toast.error(`匯出失敗: ${result.error}`);
      }
    } catch (error) {
      console.error('匯出錯誤:', error);
      toast.error('匯出時發生錯誤');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            匯出圖片
          </DialogTitle>
          <DialogDescription>
            選擇格式和設定，將設計匯出為圖片或 PDF
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-6 py-4">
          {/* 左側：預覽 */}
          <div className="space-y-3">
            <Label>預覽</Label>
            <div 
              className="aspect-square bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgMjAgMTAgTSAxMCAwIEwgMTAgMjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2UwZTBlMCIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] 
              rounded-lg border overflow-hidden flex items-center justify-center"
            >
              {preview ? (
                <img
                  src={preview}
                  alt="Preview"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-muted-foreground text-sm">載入中...</div>
              )}
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>輸出尺寸: {outputSize}</div>
              <div>預估大小: {estimatedSize}</div>
            </div>
          </div>
          
          {/* 右側：設定 */}
          <div className="space-y-4">
            {/* 檔名 */}
            <div className="space-y-2">
              <Label htmlFor="filename">檔案名稱</Label>
              <Input
                id="filename"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="輸入檔案名稱"
              />
            </div>
            
            {/* 格式選擇 */}
            <Tabs value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="png" className="flex items-center gap-1">
                  <Image className="w-3 h-3" />
                  PNG
                </TabsTrigger>
                <TabsTrigger value="jpg" className="flex items-center gap-1">
                  <FileImage className="w-3 h-3" />
                  JPG
                </TabsTrigger>
                <TabsTrigger value="pdf" className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  PDF
                </TabsTrigger>
              </TabsList>
              
              {/* PNG 選項 */}
              <TabsContent value="png" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="transparent-bg">透明背景</Label>
                  <Switch
                    id="transparent-bg"
                    checked={transparentBg}
                    onCheckedChange={setTransparentBg}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>縮放比例</Label>
                    <span className="text-sm text-muted-foreground">{scale}x</span>
                  </div>
                  <Slider
                    value={[scale]}
                    onValueChange={([v]) => setScale(v)}
                    min={0.5}
                    max={3}
                    step={0.5}
                  />
                </div>
              </TabsContent>
              
              {/* JPG 選項 */}
              <TabsContent value="jpg" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>品質</Label>
                    <span className="text-sm text-muted-foreground">{Math.round(quality * 100)}%</span>
                  </div>
                  <Slider
                    value={[quality]}
                    onValueChange={([v]) => setQuality(v)}
                    min={0.1}
                    max={1}
                    step={0.1}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>縮放比例</Label>
                    <span className="text-sm text-muted-foreground">{scale}x</span>
                  </div>
                  <Slider
                    value={[scale]}
                    onValueChange={([v]) => setScale(v)}
                    min={0.5}
                    max={3}
                    step={0.5}
                  />
                </div>
              </TabsContent>
              
              {/* PDF 選項 */}
              <TabsContent value="pdf" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>紙張大小</Label>
                  <Select value={pdfSize} onValueChange={(v: any) => setPdfSize(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a4">A4 (210 × 297 mm)</SelectItem>
                      <SelectItem value="a3">A3 (297 × 420 mm)</SelectItem>
                      <SelectItem value="letter">Letter (8.5 × 11 in)</SelectItem>
                      <SelectItem value="custom">自訂（符合畫布）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>方向</Label>
                  <Select value={pdfOrientation} onValueChange={(v: any) => setPdfOrientation(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">直式</SelectItem>
                      <SelectItem value="landscape">橫式</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={closeDialog}>
            取消
          </Button>
          <Button onClick={handleExport} disabled={isExporting || !filename.trim()}>
            {isExporting ? (
              <>匯出中...</>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                匯出 {format.toUpperCase()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ExportDialog;
