"use client";

/**
 * FileManagerDialog - 檔案管理對話框
 * 包含新建專案、開啟專案、另存新檔等功能
 */

import { useState, useEffect, useCallback } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, 
  FolderOpen, 
  Trash2, 
  Copy, 
  Search,
  FileImage,
  MoreVertical,
  Edit2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFileStore } from '@/stores/file-store';
import { useDesignStudioStore, CANVAS_PRESETS } from '@/stores/design-studio-store';
import { projectService } from '@/lib/services/project-service';
import { formatDateTime } from '@/lib/db/design-studio-db';
import type { Project } from '@/lib/db/design-studio-db';

// ============================================================
// 新建專案對話框
// ============================================================

export function NewProjectDialog() {
  const { activeDialog, closeDialog, setCurrentProject } = useFileStore();
  const { setCanvasSize, setCanvasBackground, canvas } = useDesignStudioStore();
  
  const [name, setName] = useState('未命名專案');
  const [selectedPreset, setSelectedPreset] = useState('ig-post');
  const [customWidth, setCustomWidth] = useState(1080);
  const [customHeight, setCustomHeight] = useState(1080);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [isCustom, setIsCustom] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const isOpen = activeDialog === 'new-project';

  const handlePresetChange = (presetId: string) => {
    if (presetId === 'custom') {
      setIsCustom(true);
      setSelectedPreset('custom');
    } else {
      setIsCustom(false);
      setSelectedPreset(presetId);
      const preset = CANVAS_PRESETS.find(p => p.id === presetId);
      if (preset) {
        setCustomWidth(preset.width);
        setCustomHeight(preset.height);
      }
    }
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const width = isCustom ? customWidth : (CANVAS_PRESETS.find(p => p.id === selectedPreset)?.width || 1080);
      const height = isCustom ? customHeight : (CANVAS_PRESETS.find(p => p.id === selectedPreset)?.height || 1080);
      
      // 清空畫布
      if (canvas) {
        canvas.clear();
        canvas.setBackgroundColor(backgroundColor, () => {
          canvas.renderAll();
        });
      }
      
      // 設定畫布尺寸
      setCanvasSize(width, height);
      setCanvasBackground(backgroundColor);
      
      // 建立專案
      const project = await projectService.createProject({
        name,
        canvasWidth: width,
        canvasHeight: height,
        backgroundColor,
        canvas
      });
      
      setCurrentProject(project);
      closeDialog();
    } catch (error) {
      console.error('建立專案失敗:', error);
    } finally {
      setIsCreating(false);
    }
  };

  // 按分類分組預設
  const presetsByCategory = CANVAS_PRESETS.reduce((acc, preset) => {
    if (!acc[preset.category]) acc[preset.category] = [];
    acc[preset.category].push(preset);
    return acc;
  }, {} as Record<string, typeof CANVAS_PRESETS>);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            新建專案
          </DialogTitle>
          <DialogDescription>
            選擇畫布尺寸並命名您的專案
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* 專案名稱 */}
          <div className="space-y-2">
            <Label htmlFor="project-name">專案名稱</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="輸入專案名稱"
            />
          </div>
          
          {/* 畫布尺寸 */}
          <div className="space-y-2">
            <Label>畫布尺寸</Label>
            <Select value={selectedPreset} onValueChange={handlePresetChange}>
              <SelectTrigger>
                <SelectValue placeholder="選擇尺寸預設" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(presetsByCategory).map(([category, presets]) => (
                  <div key={category}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      {category}
                    </div>
                    {presets.map(preset => (
                      <SelectItem key={preset.id} value={preset.id}>
                        {preset.name} ({preset.width} × {preset.height})
                      </SelectItem>
                    ))}
                  </div>
                ))}
                <SelectItem value="custom">自訂尺寸</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* 自訂尺寸輸入 */}
          {isCustom && (
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="custom-width">寬度 (px)</Label>
                <Input
                  id="custom-width"
                  type="number"
                  min={100}
                  max={4096}
                  value={customWidth}
                  onChange={(e) => setCustomWidth(Number(e.target.value))}
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="custom-height">高度 (px)</Label>
                <Input
                  id="custom-height"
                  type="number"
                  min={100}
                  max={4096}
                  value={customHeight}
                  onChange={(e) => setCustomHeight(Number(e.target.value))}
                />
              </div>
            </div>
          )}
          
          {/* 背景色 */}
          <div className="space-y-2">
            <Label htmlFor="bg-color">背景顏色</Label>
            <div className="flex gap-2">
              <Input
                id="bg-color"
                type="color"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <Input
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                placeholder="#ffffff"
                className="flex-1"
              />
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={closeDialog}>
            取消
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || !name.trim()}>
            {isCreating ? '建立中...' : '建立專案'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// 開啟專案對話框
// ============================================================

export function OpenProjectDialog() {
  const { activeDialog, closeDialog, setCurrentProject } = useFileStore();
  const { setCanvasSize, setCanvasBackground, canvas } = useDesignStudioStore();
  const [projects, setProjects] = useState<Project[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const isOpen = activeDialog === 'open-project';

  // 載入專案列表
  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const allProjects = await projectService.getAllProjects();
      setProjects(allProjects);
    } catch (error) {
      console.error('載入專案列表失敗:', error);
    } finally {
      setIsLoading(false);
    }
  }, [setProjects]);

  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen, loadProjects]);

  // 過濾專案
  const filteredProjects = searchQuery
    ? projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : projects;

  // 開啟專案
  const handleOpen = async (project: Project) => {
    try {
      if (canvas) {
        canvas.loadFromJSON(JSON.parse(project.canvasJson), () => {
          canvas.renderAll();
        });
      }
      setCanvasSize(project.canvasWidth, project.canvasHeight);
      setCanvasBackground(project.backgroundColor);
      setCurrentProject(project);
      closeDialog();
    } catch (error) {
      console.error('開啟專案失敗:', error);
    }
  };

  // 刪除專案
  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此專案？此操作無法復原。')) return;
    try {
      await projectService.deleteProject(id);
      loadProjects();
    } catch (error) {
      console.error('刪除專案失敗:', error);
    }
  };

  // 複製專案
  const handleDuplicate = async (id: string) => {
    try {
      await projectService.duplicateProject(id);
      loadProjects();
    } catch (error) {
      console.error('複製專案失敗:', error);
    }
  };

  // 重命名專案
  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await projectService.renameProject(id, editName);
      setEditingId(null);
      loadProjects();
    } catch (error) {
      console.error('重命名失敗:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            開啟專案
          </DialogTitle>
          <DialogDescription>
            選擇要開啟的專案
          </DialogDescription>
        </DialogHeader>
        
        {/* 搜尋 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜尋專案..."
            className="pl-9"
          />
        </div>
        
        {/* 專案列表 */}
        <div className="overflow-y-auto max-h-[400px] space-y-2">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              載入中...
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? '找不到符合的專案' : '尚無專案，建立一個新專案開始設計'}
            </div>
          ) : (
            filteredProjects.map(project => (
              <div
                key={project.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                  ${selectedId === project.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                onClick={() => setSelectedId(project.id)}
                onDoubleClick={() => handleOpen(project)}
              >
                {/* 縮圖 */}
                <div className="w-16 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                  {project.thumbnail ? (
                    <img
                      src={project.thumbnail}
                      alt={project.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileImage className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                
                {/* 資訊 */}
                <div className="flex-1 min-w-0">
                  {editingId === project.id ? (
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => handleRename(project.id)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRename(project.id)}
                      autoFocus
                      className="h-7"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="font-medium truncate">{project.name}</div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {project.canvasWidth} × {project.canvasHeight} · 
                    更新於 {formatDateTime(project.updatedAt)}
                  </div>
                </div>
                
                {/* 操作選單 */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => {
                      setEditingId(project.id);
                      setEditName(project.name);
                    }}>
                      <Edit2 className="w-4 h-4 mr-2" />
                      重命名
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDuplicate(project.id)}>
                      <Copy className="w-4 h-4 mr-2" />
                      複製
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(project.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      刪除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={closeDialog}>
            取消
          </Button>
          <Button 
            onClick={() => {
              const project = projects.find(p => p.id === selectedId);
              if (project) handleOpen(project);
            }}
            disabled={!selectedId}
          >
            開啟
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// 另存新檔對話框
// ============================================================

export function SaveAsDialog() {
  const { activeDialog, closeDialog, currentProject, setCurrentProject } = useFileStore();
  const { canvas, canvasWidth, canvasHeight, canvasBackgroundColor } = useDesignStudioStore();
  
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isOpen = activeDialog === 'save-as';

  useEffect(() => {
    if (isOpen && currentProject) {
      setName(`${currentProject.name} (副本)`);
    } else if (isOpen) {
      setName('未命名專案');
    }
  }, [isOpen, currentProject]);

  const handleSave = async () => {
    if (!canvas) return;
    
    setIsSaving(true);
    try {
      const customProperties = ['id', 'name', 'blendMode', 'globalCompositeOperation', 'lockUniScaling'];
      const canvasJson = JSON.stringify(canvas.toJSON(customProperties));
      
      const project = await projectService.saveAsProject({
        name,
        canvasJson,
        canvasWidth,
        canvasHeight,
        backgroundColor: canvasBackgroundColor,
        canvas
      });
      
      setCurrentProject(project);
      closeDialog();
    } catch (error) {
      console.error('另存新檔失敗:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>另存新檔</DialogTitle>
          <DialogDescription>
            將目前的設計保存為新專案
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <Label htmlFor="save-as-name">專案名稱</Label>
          <Input
            id="save-as-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="輸入專案名稱"
            className="mt-2"
          />
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={closeDialog}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// 確認捨棄變更對話框
// ============================================================

export function ConfirmDiscardDialog({
  onConfirm
}: {
  onConfirm: () => void;
}) {
  const { activeDialog, closeDialog } = useFileStore();
  const isOpen = activeDialog === 'confirm-discard';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>捨棄變更？</DialogTitle>
          <DialogDescription>
            您有未保存的變更。是否要捨棄這些變更？
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter>
          <Button variant="outline" onClick={closeDialog}>
            取消
          </Button>
          <Button variant="destructive" onClick={() => {
            onConfirm();
            closeDialog();
          }}>
            捨棄變更
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 所有組件已透過 export function 導出
