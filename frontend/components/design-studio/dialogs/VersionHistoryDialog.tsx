"use client";

/**
 * VersionHistoryDialog - 版本歷史對話框
 * 管理專案版本，支援保存、預覽和恢復版本
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
  History, 
  Plus, 
  RotateCcw, 
  Trash2, 
  FileImage,
  Clock
} from 'lucide-react';
import { useFileStore } from '@/stores/file-store';
import { toast } from 'sonner';
import { useDesignStudioStore } from '@/stores/design-studio-store';
import { versionService } from '@/lib/services/version-service';
import { formatDateTime } from '@/lib/db/design-studio-db';
import type { Version } from '@/lib/db/design-studio-db';

export function VersionHistoryDialog() {
  const { activeDialog, closeDialog, currentProject } = useFileStore();
  const { canvas } = useDesignStudioStore();
  
  const [versions, setVersions] = useState<Version[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newVersionDesc, setNewVersionDesc] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  const isOpen = activeDialog === 'version-history';

  // 載入版本列表
  const loadVersions = useCallback(async () => {
    if (!currentProject) return;
    
    setIsLoading(true);
    try {
      const allVersions = await versionService.getVersions(currentProject.id);
      setVersions(allVersions);
    } catch (error) {
      console.error('載入版本列表失敗:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    if (isOpen && currentProject) {
      loadVersions();
      setShowSaveForm(false);
      setNewVersionDesc('');
      setSelectedId(null);
    }
  }, [isOpen, currentProject, loadVersions]);

  // 保存新版本
  const handleSaveVersion = async () => {
    if (!currentProject || !canvas) return;
    
    setIsSaving(true);
    try {
      await versionService.saveVersion({
        projectId: currentProject.id,
        description: newVersionDesc || `版本 ${new Date().toLocaleString('zh-TW')}`,
        canvas
      });
      
      setNewVersionDesc('');
      setShowSaveForm(false);
      loadVersions();
    } catch (error) {
      console.error('保存版本失敗:', error);
      toast.error('保存版本失敗');
    } finally {
      setIsSaving(false);
    }
  };

  // 恢復版本
  const handleRestore = async () => {
    if (!selectedId || !canvas) return;
    
    if (!confirm('確定要恢復到此版本？目前的變更將會遺失。')) return;
    
    setIsRestoring(true);
    try {
      await versionService.restoreVersion(selectedId, canvas);
      closeDialog();
    } catch (error) {
      console.error('恢復版本失敗:', error);
      toast.error('恢復版本失敗');
    } finally {
      setIsRestoring(false);
    }
  };

  // 刪除版本
  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此版本？此操作無法復原。')) return;
    
    try {
      await versionService.deleteVersion(id);
      if (selectedId === id) setSelectedId(null);
      loadVersions();
    } catch (error) {
      console.error('刪除版本失敗:', error);
    }
  };

  // 選取的版本
  const selectedVersion = versions.find(v => v.id === selectedId);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            版本歷史
          </DialogTitle>
          <DialogDescription>
            查看和管理專案的版本歷史，可以隨時恢復到之前的版本
          </DialogDescription>
        </DialogHeader>

        {!currentProject ? (
          <div className="py-8 text-center text-muted-foreground">
            請先保存專案，才能使用版本歷史功能
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 py-4">
            {/* 左側：版本列表 */}
            <div className="space-y-3">
              {/* 保存新版本按鈕 */}
              {showSaveForm ? (
                <div className="p-3 border rounded-lg space-y-2">
                  <Label htmlFor="version-desc">版本描述</Label>
                  <Input
                    id="version-desc"
                    value={newVersionDesc}
                    onChange={(e) => setNewVersionDesc(e.target.value)}
                    placeholder="輸入版本描述（選填）"
                  />
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={handleSaveVersion}
                      disabled={isSaving}
                    >
                      {isSaving ? '保存中...' : '保存'}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setShowSaveForm(false)}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => setShowSaveForm(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  保存目前版本
                </Button>
              )}
              
              {/* 版本列表 */}
              <div className="overflow-y-auto max-h-[350px] space-y-2">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    載入中...
                  </div>
                ) : versions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    尚無版本歷史
                  </div>
                ) : (
                  versions.map(version => (
                    <div
                      key={version.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                        ${selectedId === version.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                      onClick={() => setSelectedId(version.id)}
                    >
                      {/* 縮圖 */}
                      <div className="w-12 h-9 bg-muted rounded overflow-hidden flex-shrink-0">
                        {version.thumbnail ? (
                          <img
                            src={version.thumbnail}
                            alt={version.description}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileImage className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      
                      {/* 資訊 */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {version.description}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDateTime(version.createdAt)}
                        </div>
                      </div>
                      
                      {/* 刪除按鈕 */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(version.id);
                        }}
                      >
                        <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            {/* 右側：預覽 */}
            <div className="space-y-3">
              <Label>預覽</Label>
              <div className="aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                {selectedVersion?.thumbnail ? (
                  <img
                    src={selectedVersion.thumbnail}
                    alt={selectedVersion.description}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="text-muted-foreground text-sm">
                    {selectedId ? '無預覽' : '選擇一個版本查看預覽'}
                  </div>
                )}
              </div>
              
              {selectedVersion && (
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <div className="font-medium">{selectedVersion.description}</div>
                  <div className="text-sm text-muted-foreground">
                    建立於 {formatDateTime(selectedVersion.createdAt)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={closeDialog}>
            關閉
          </Button>
          <Button 
            onClick={handleRestore}
            disabled={!selectedId || isRestoring}
          >
            {isRestoring ? (
              '恢復中...'
            ) : (
              <>
                <RotateCcw className="w-4 h-4 mr-2" />
                恢復此版本
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default VersionHistoryDialog;
