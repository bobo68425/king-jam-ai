/**
 * Storage Service - 統一儲存服務
 * 支援 IndexedDB（瀏覽器內）和本地檔案系統
 * 用戶可自行選擇儲存方式
 */

import Dexie, { type Table } from 'dexie';
import { fabric } from 'fabric';
import { localFileService, type ProjectFile } from './local-file-service';

// ============================================================
// 類型定義
// ============================================================

export type StorageMode = 'indexeddb' | 'local';

export interface StoredProject {
  id: string;
  name: string;
  thumbnail?: string;
  canvasJson: string;
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
  createdAt: Date;
  updatedAt: Date;
  size: number; // 檔案大小（bytes）
}

export interface StorageSettings {
  mode: StorageMode;
  maxStorageSize: number; // IndexedDB 最大儲存空間（bytes）
  autoSaveEnabled: boolean;
  autoSaveInterval: number; // 自動保存間隔（毫秒）
}

export interface StorageStats {
  usedSpace: number;
  maxSpace: number;
  projectCount: number;
  percentUsed: number;
}

// ============================================================
// IndexedDB 設定
// ============================================================

const DEFAULT_MAX_STORAGE = 50 * 1024 * 1024; // 50MB 預設上限
const STORAGE_WARNING_THRESHOLD = 0.8; // 80% 時警告

// 自定義屬性列表
const CUSTOM_PROPERTIES = [
  'id',
  'name',
  'blendMode',
  'globalCompositeOperation',
  'lockUniScaling',
  'isGrid',
  'isGuide',
  'selectable',
  'evented',
];

// ============================================================
// IndexedDB Database
// ============================================================

class DesignStudioDB extends Dexie {
  projects!: Table<StoredProject>;
  settings!: Table<{ key: string; value: any }>;

  constructor() {
    super('DesignStudioDB');
    
    this.version(1).stores({
      projects: 'id, name, updatedAt, createdAt',
      settings: 'key',
    });
  }
}

// 只在瀏覽器環境中創建資料庫
let db: DesignStudioDB | null = null;

const getDB = (): DesignStudioDB => {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB is not available on the server');
  }
  if (!db) {
    db = new DesignStudioDB();
  }
  return db;
};

// ============================================================
// Storage Service
// ============================================================

class StorageService {
  private settings: StorageSettings = {
    mode: 'local',
    maxStorageSize: DEFAULT_MAX_STORAGE,
    autoSaveEnabled: false,
    autoSaveInterval: 60000,
  };

  constructor() {
    this.loadSettings();
  }

  // ========================================
  // 設定管理
  // ========================================

  async loadSettings(): Promise<StorageSettings> {
    if (typeof window === 'undefined') return this.settings;
    
    try {
      const stored = await getDB().settings.get('storage-settings');
      if (stored?.value) {
        this.settings = { ...this.settings, ...stored.value };
      }
    } catch (error) {
      console.error('載入儲存設定失敗:', error);
    }
    return this.settings;
  }

  async saveSettings(settings: Partial<StorageSettings>): Promise<void> {
    if (typeof window === 'undefined') return;
    
    this.settings = { ...this.settings, ...settings };
    await getDB().settings.put({ key: 'storage-settings', value: this.settings });
  }

  getSettings(): StorageSettings {
    return { ...this.settings };
  }

  getMode(): StorageMode {
    return this.settings.mode;
  }

  async setMode(mode: StorageMode): Promise<void> {
    await this.saveSettings({ mode });
  }

  async setMaxStorageSize(bytes: number): Promise<void> {
    await this.saveSettings({ maxStorageSize: bytes });
  }

  // ========================================
  // 儲存統計
  // ========================================

  async getStorageStats(): Promise<StorageStats> {
    if (typeof window === 'undefined') {
      return {
        usedSpace: 0,
        maxSpace: this.settings.maxStorageSize,
        projectCount: 0,
        percentUsed: 0,
      };
    }
    
    try {
      const projects = await getDB().projects.toArray();
      const usedSpace = projects.reduce((sum, p) => sum + (p.size || 0), 0);
      const projectCount = projects.length;
      
      return {
        usedSpace,
        maxSpace: this.settings.maxStorageSize,
        projectCount,
        percentUsed: (usedSpace / this.settings.maxStorageSize) * 100,
      };
    } catch (error) {
      console.error('取得儲存統計失敗:', error);
      return {
        usedSpace: 0,
        maxSpace: this.settings.maxStorageSize,
        projectCount: 0,
        percentUsed: 0,
      };
    }
  }

  async checkStorageLimit(additionalSize: number): Promise<{ canStore: boolean; warning?: string }> {
    const stats = await this.getStorageStats();
    const newTotal = stats.usedSpace + additionalSize;
    const newPercent = newTotal / stats.maxSpace;

    if (newTotal > stats.maxSpace) {
      return {
        canStore: false,
        warning: `儲存空間不足！已使用 ${this.formatSize(stats.usedSpace)} / ${this.formatSize(stats.maxSpace)}`,
      };
    }

    if (newPercent > STORAGE_WARNING_THRESHOLD) {
      return {
        canStore: true,
        warning: `儲存空間即將用盡（${Math.round(newPercent * 100)}%），建議清理舊專案或改用本地儲存。`,
      };
    }

    return { canStore: true };
  }

  // ========================================
  // 專案管理 - IndexedDB
  // ========================================

  async getAllProjects(): Promise<StoredProject[]> {
    if (typeof window === 'undefined') return [];
    return await getDB().projects.orderBy('updatedAt').reverse().toArray();
  }

  async getProject(id: string): Promise<StoredProject | undefined> {
    if (typeof window === 'undefined') return undefined;
    return await getDB().projects.get(id);
  }

  async saveProjectToIndexedDB(
    canvas: fabric.Canvas,
    projectName: string,
    canvasWidth: number,
    canvasHeight: number,
    backgroundColor: string,
    existingId?: string
  ): Promise<{ success: boolean; id: string; warning?: string }> {
    try {
      // 過濾掉網格和參考線
      const objects = canvas.getObjects().filter((obj: any) => 
        !obj.isGrid && !obj.isGuide
      );
      
      // 創建臨時 canvas 來生成乾淨的 JSON
      const tempCanvas = new fabric.Canvas(null);
      tempCanvas.setWidth(canvasWidth);
      tempCanvas.setHeight(canvasHeight);
      tempCanvas.setBackgroundColor(backgroundColor, () => {});
      
      for (const obj of objects) {
        const cloned = await new Promise<fabric.Object>((resolve) => {
          obj.clone((c: fabric.Object) => resolve(c), CUSTOM_PROPERTIES);
        });
        tempCanvas.add(cloned);
      }
      
      const canvasJson = JSON.stringify(tempCanvas.toJSON(CUSTOM_PROPERTIES));
      tempCanvas.dispose();

      const size = new Blob([canvasJson]).size;
      
      // 檢查儲存空間
      const storageCheck = await this.checkStorageLimit(size);
      if (!storageCheck.canStore) {
        return { success: false, id: '', warning: storageCheck.warning };
      }

      // 生成縮圖
      const thumbnail = canvas.toDataURL({
        format: 'jpeg',
        quality: 0.5,
        multiplier: 0.2,
      });

      const id = existingId || this.generateId();
      const now = new Date();

      const project: StoredProject = {
        id,
        name: projectName,
        thumbnail,
        canvasJson,
        canvasWidth,
        canvasHeight,
        backgroundColor,
        createdAt: existingId ? (await this.getProject(existingId))?.createdAt || now : now,
        updatedAt: now,
        size,
      };

      await getDB().projects.put(project);

      return { success: true, id, warning: storageCheck.warning };
    } catch (error) {
      console.error('保存專案到 IndexedDB 失敗:', error);
      throw error;
    }
  }

  async deleteProject(id: string): Promise<void> {
    if (typeof window === 'undefined') return;
    await getDB().projects.delete(id);
  }

  async clearAllProjects(): Promise<void> {
    if (typeof window === 'undefined') return;
    await getDB().projects.clear();
  }

  async loadProjectFromIndexedDB(
    id: string,
    canvas: fabric.Canvas,
    setCanvasSize: (width: number, height: number) => void,
    setCanvasBackground: (color: string) => void
  ): Promise<StoredProject | null> {
    const project = await this.getProject(id);
    if (!project) return null;

    return new Promise((resolve, reject) => {
      try {
        setCanvasSize(project.canvasWidth, project.canvasHeight);
        setCanvasBackground(project.backgroundColor);

        // 清除現有物件
        const objectsToRemove = canvas.getObjects().filter((obj: any) => 
          !obj.isGrid && !obj.isGuide
        );
        objectsToRemove.forEach(obj => canvas.remove(obj));

        const jsonData = JSON.parse(project.canvasJson);
        canvas.loadFromJSON(jsonData, () => {
          canvas.renderAll();
          resolve(project);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // ========================================
  // 專案管理 - 本地檔案
  // ========================================

  async saveProjectToLocal(
    canvas: fabric.Canvas,
    projectName: string,
    canvasWidth: number,
    canvasHeight: number,
    backgroundColor: string
  ): Promise<boolean> {
    return await localFileService.saveProject(
      canvas,
      projectName,
      canvasWidth,
      canvasHeight,
      backgroundColor
    );
  }

  async openProjectFromLocal(): Promise<ProjectFile | null> {
    return await localFileService.openProject();
  }

  async loadProjectFromLocal(
    project: ProjectFile,
    canvas: fabric.Canvas,
    setCanvasSize: (width: number, height: number) => void,
    setCanvasBackground: (color: string) => void
  ): Promise<void> {
    return await localFileService.loadProjectToCanvas(
      project,
      canvas,
      setCanvasSize,
      setCanvasBackground
    );
  }

  // ========================================
  // 統一介面
  // ========================================

  async saveProject(
    canvas: fabric.Canvas,
    projectName: string,
    canvasWidth: number,
    canvasHeight: number,
    backgroundColor: string,
    existingId?: string
  ): Promise<{ success: boolean; id?: string; warning?: string }> {
    if (this.settings.mode === 'indexeddb') {
      return await this.saveProjectToIndexedDB(
        canvas,
        projectName,
        canvasWidth,
        canvasHeight,
        backgroundColor,
        existingId
      );
    } else {
      const success = await this.saveProjectToLocal(
        canvas,
        projectName,
        canvasWidth,
        canvasHeight,
        backgroundColor
      );
      return { success };
    }
  }

  // ========================================
  // 匯出功能
  // ========================================

  exportPNG(canvas: fabric.Canvas, fileName: string, options?: { multiplier?: number }) {
    localFileService.exportPNG(canvas, fileName, options);
  }

  exportJPG(canvas: fabric.Canvas, fileName: string, options?: { multiplier?: number; quality?: number }) {
    localFileService.exportJPG(canvas, fileName, options);
  }

  exportSVG(canvas: fabric.Canvas, fileName: string) {
    localFileService.exportSVG(canvas, fileName);
  }

  async exportPDF(canvas: fabric.Canvas, fileName: string, options?: { orientation?: 'portrait' | 'landscape' }) {
    await localFileService.exportPDF(canvas, fileName, options);
  }

  // ========================================
  // 輔助方法
  // ========================================

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

export const storageService = new StorageService();
