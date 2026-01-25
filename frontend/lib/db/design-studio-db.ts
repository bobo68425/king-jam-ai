/**
 * Design Studio IndexedDB - Dexie 資料庫定義
 * 用於本地儲存專案、版本歷史、素材和自動保存
 */

import Dexie, { type Table } from 'dexie';

// ============================================================
// 資料類型定義
// ============================================================

export interface Project {
  id: string;
  name: string;
  thumbnail: string;        // Base64 縮圖
  canvasJson: string;       // Fabric.js JSON
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
  createdAt: Date;
  updatedAt: Date;
  versionCount: number;
}

export interface Version {
  id: string;
  projectId: string;
  canvasJson: string;
  thumbnail: string;
  description: string;
  createdAt: Date;
}

export interface Asset {
  id: string;
  name: string;
  type: 'image' | 'font';
  data: Blob;               // 原始檔案
  dataUrl?: string;         // Base64 Data URL (用於圖片預覽)
  thumbnail?: string;       // 縮圖 (圖片用)
  mimeType: string;
  size: number;
  width?: number;           // 圖片寬度
  height?: number;          // 圖片高度
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface AutoSaveData {
  id: string;               // 'current' 為主要自動保存
  projectId?: string;       // 關聯的專案 ID（如果有）
  projectName?: string;     // 專案名稱
  canvasJson: string;
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
  timestamp: Date;
}

// ============================================================
// Dexie 資料庫類別
// ============================================================

export class DesignStudioDB extends Dexie {
  projects!: Table<Project>;
  versions!: Table<Version>;
  assets!: Table<Asset>;
  autosave!: Table<AutoSaveData>;

  constructor() {
    super('DesignStudioDB');
    
    // 定義資料庫 schema
    this.version(1).stores({
      projects: 'id, name, createdAt, updatedAt',
      versions: 'id, projectId, createdAt',
      assets: 'id, name, type, createdAt',
      autosave: 'id, projectId, timestamp'
    });
  }
}

// 單例資料庫實例
export const db = new DesignStudioDB();

// ============================================================
// 工具函數
// ============================================================

/**
 * 產生唯一 ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * 從 Fabric.js Canvas 產生縮圖
 */
export function generateThumbnail(
  canvas: any, 
  maxWidth: number = 200, 
  maxHeight: number = 150
): string {
  if (!canvas) return '';
  
  try {
    const dataUrl = canvas.toDataURL({
      format: 'jpeg',
      quality: 0.6,
      multiplier: Math.min(maxWidth / canvas.width, maxHeight / canvas.height)
    });
    return dataUrl;
  } catch (error) {
    console.error('產生縮圖失敗:', error);
    return '';
  }
}

/**
 * 格式化檔案大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 格式化日期時間
 */
export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}
