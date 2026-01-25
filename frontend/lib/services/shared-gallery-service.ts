/**
 * Shared Gallery Service - 跨引擎圖片共享服務
 * 用於在不同引擎間共享圖片
 * - 社群圖文、部落格、短影音 → 圖片編輯室
 * - 圖片編輯室 → 其他引擎
 */

import Dexie, { type Table } from 'dexie';

// ============================================================
// 類型定義
// ============================================================

export type ImageSource = 'social' | 'blog' | 'video' | 'design-studio' | 'upload';

export interface SharedImage {
  id: string;
  name: string;
  source: ImageSource;           // 圖片來源
  sourceId?: string;             // 來源記錄 ID
  dataUrl: string;               // Base64 Data URL
  thumbnail?: string;            // 縮圖
  width: number;
  height: number;
  mimeType: string;
  size: number;                  // bytes
  metadata?: Record<string, any>; // 額外資訊（如 prompt、caption 等）
  createdAt: Date;
  updatedAt: Date;
}

export interface GalleryStats {
  totalImages: number;
  totalSize: number;
  bySource: Record<ImageSource, number>;
}

// ============================================================
// IndexedDB Database
// ============================================================

class SharedGalleryDB extends Dexie {
  images!: Table<SharedImage>;

  constructor() {
    super('SharedGalleryDB');
    
    // 版本 2: 添加複合索引支持 where({ source, sourceId }) 查詢
    this.version(2).stores({
      images: 'id, name, source, sourceId, [source+sourceId], createdAt, updatedAt',
    });
  }
}

// 只在瀏覽器環境中創建資料庫
let db: SharedGalleryDB | null = null;

const getDB = (): SharedGalleryDB => {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB is not available on the server');
  }
  if (!db) {
    db = new SharedGalleryDB();
  }
  return db;
};

// ============================================================
// 工具函數
// ============================================================

function generateId(): string {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function urlToDataUrl(url: string): Promise<string> {
  // 如果已經是 data URL，直接返回
  if (url.startsWith('data:')) {
    return url;
  }
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    // 只對外部 URL 設置 crossOrigin
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('無法取得 Canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = (e) => {
      console.error('圖片載入失敗:', url.substring(0, 100), e);
      reject(new Error('圖片載入失敗'));
    };
    img.src = url;
  });
}

async function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => reject(new Error('無法取得圖片尺寸'));
    img.src = dataUrl;
  });
}

function generateThumbnail(dataUrl: string, maxSize: number = 150): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('無法取得 Canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => reject(new Error('縮圖生成失敗'));
    img.src = dataUrl;
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================
// Shared Gallery Service
// ============================================================

class SharedGalleryService {
  /**
   * 從 URL 新增圖片到圖庫
   */
  async addImageFromUrl(
    url: string,
    options: {
      name?: string;
      source: ImageSource;
      sourceId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<SharedImage> {
    try {
      console.log(`[SharedGallery] 新增圖片到圖庫: ${options.name || 'unnamed'}, source: ${options.source}`);
      const dataUrl = await urlToDataUrl(url);
      const result = await this.addImageFromDataUrl(dataUrl, options);
      console.log(`[SharedGallery] ✓ 成功新增圖片: ${result.id}`);
      return result;
    } catch (error) {
      console.error('[SharedGallery] 從 URL 新增圖片失敗:', error);
      throw error;
    }
  }

  /**
   * 從 Data URL 新增圖片到圖庫
   */
  async addImageFromDataUrl(
    dataUrl: string,
    options: {
      name?: string;
      source: ImageSource;
      sourceId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<SharedImage> {
    try {
      // 檢查是否已存在相同來源的圖片（避免重複）
      if (options.sourceId) {
        const existing = await this.getImageBySourceId(options.source, options.sourceId);
        if (existing) {
          console.log(`[SharedGallery] 圖片已存在: ${options.sourceId}`);
          return existing;
        }
      }

      const { width, height } = await getImageDimensions(dataUrl);
      const thumbnail = await generateThumbnail(dataUrl);
      
      // 計算大小
      const base64Length = dataUrl.split(',')[1]?.length || 0;
      const size = Math.round((base64Length * 3) / 4);
      
      // 取得 MIME 類型
      const mimeMatch = dataUrl.match(/data:([^;]+);/);
      const mimeType = mimeMatch?.[1] || 'image/png';

      const now = new Date();
      const image: SharedImage = {
        id: generateId(),
        name: options.name || `圖片-${Date.now()}`,
        source: options.source,
        sourceId: options.sourceId,
        dataUrl,
        thumbnail,
        width,
        height,
        mimeType,
        size,
        metadata: options.metadata,
        createdAt: now,
        updatedAt: now,
      };

      await getDB().images.add(image);
      console.log(`[SharedGallery] ✓ 圖片已保存到圖庫: ${image.name} (${options.source})`);
      return image;
    } catch (error) {
      console.error('[SharedGallery] 新增圖片到圖庫失敗:', error);
      throw error;
    }
  }

  /**
   * 取得所有圖片
   */
  async getAllImages(): Promise<SharedImage[]> {
    if (typeof window === 'undefined') return [];
    try {
      const images = await getDB().images.orderBy('updatedAt').reverse().toArray();
      console.log(`[SharedGallery] 載入 ${images.length} 張圖片`);
      return images;
    } catch (error) {
      console.error('[SharedGallery] 載入圖片失敗:', error);
      return [];
    }
  }

  /**
   * 根據來源取得圖片
   */
  async getImagesBySource(source: ImageSource): Promise<SharedImage[]> {
    if (typeof window === 'undefined') return [];
    return await getDB().images
      .where('source')
      .equals(source)
      .reverse()
      .sortBy('updatedAt');
  }

  /**
   * 取得單張圖片
   */
  async getImage(id: string): Promise<SharedImage | undefined> {
    if (typeof window === 'undefined') return undefined;
    return await getDB().images.get(id);
  }

  /**
   * 更新圖片
   */
  async updateImage(id: string, updates: Partial<SharedImage>): Promise<void> {
    await getDB().images.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  /**
   * 刪除圖片
   */
  async deleteImage(id: string): Promise<void> {
    await getDB().images.delete(id);
  }

  /**
   * 清空圖庫
   */
  async clearAll(): Promise<void> {
    await getDB().images.clear();
  }

  /**
   * 取得圖庫統計
   */
  async getStats(): Promise<GalleryStats> {
    const images = await this.getAllImages();
    
    const bySource: Record<ImageSource, number> = {
      social: 0,
      blog: 0,
      video: 0,
      'design-studio': 0,
      upload: 0,
    };
    
    let totalSize = 0;
    
    for (const img of images) {
      bySource[img.source]++;
      totalSize += img.size;
    }

    return {
      totalImages: images.length,
      totalSize,
      bySource,
    };
  }

  /**
   * 格式化檔案大小
   */
  formatSize(bytes: number): string {
    return formatSize(bytes);
  }

  /**
   * 檢查圖庫中是否已有相同來源 ID 的圖片
   */
  async hasImage(source: ImageSource, sourceId: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const count = await getDB().images
        .where('[source+sourceId]')
        .equals([source, sourceId])
        .count();
      return count > 0;
    } catch (error) {
      // 如果複合索引查詢失敗，回退到過濾查詢
      const images = await getDB().images
        .where('source')
        .equals(source)
        .filter(img => img.sourceId === sourceId)
        .toArray();
      return images.length > 0;
    }
  }

  /**
   * 根據來源 ID 取得圖片
   */
  async getImageBySourceId(source: ImageSource, sourceId: string): Promise<SharedImage | undefined> {
    if (typeof window === 'undefined') return undefined;
    try {
      return await getDB().images
        .where('[source+sourceId]')
        .equals([source, sourceId])
        .first();
    } catch (error) {
      // 如果複合索引查詢失敗，回退到過濾查詢
      return await getDB().images
        .where('source')
        .equals(source)
        .filter(img => img.sourceId === sourceId)
        .first();
    }
  }
}

export const sharedGalleryService = new SharedGalleryService();

// ============================================================
// LocalStorage 快取 - 用於跨頁面傳遞圖片
// 注意：圖片數據存在 IndexedDB，只在 localStorage 存元數據
// ============================================================

const PENDING_IMAGE_KEY = 'pendingImageForEditor';
const PENDING_IMAGE_GALLERY_ID = 'pendingImageGalleryId';

export interface PendingImageData {
  imageUrl: string;
  source: ImageSource;
  sourceId?: string;
  name?: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

/**
 * 設定待編輯的圖片（跨頁面傳遞）
 * 圖片會先存到 IndexedDB，只在 localStorage 存元數據
 */
export async function setPendingImageForEditor(data: Omit<PendingImageData, 'timestamp'>): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    // 先把圖片存到共享圖庫（IndexedDB）
    const galleryImage = await sharedGalleryService.addImageFromUrl(data.imageUrl, {
      name: data.name || 'pending-edit',
      source: data.source,
      sourceId: data.sourceId,
      metadata: { ...data.metadata, isPendingEdit: true },
    });
    
    // 在 localStorage 只存元數據和圖庫 ID
    const pendingMeta = {
      galleryId: galleryImage.id,
      source: data.source,
      sourceId: data.sourceId,
      name: data.name,
      metadata: data.metadata,
      timestamp: Date.now(),
    };
    
    localStorage.setItem(PENDING_IMAGE_KEY, JSON.stringify(pendingMeta));
  } catch (error) {
    console.error('Failed to set pending image:', error);
    // 降級方案：如果圖片是 URL（非 base64），可以直接存
    if (!data.imageUrl.startsWith('data:')) {
      const pendingData = { ...data, timestamp: Date.now() };
      localStorage.setItem(PENDING_IMAGE_KEY, JSON.stringify(pendingData));
    }
  }
}

/**
 * 取得並清除待編輯的圖片
 */
export async function getPendingImageForEditor(): Promise<PendingImageData | null> {
  if (typeof window === 'undefined') return null;
  
  const stored = localStorage.getItem(PENDING_IMAGE_KEY);
  if (!stored) return null;
  
  try {
    const meta = JSON.parse(stored);
    
    // 檢查是否過期（5 分鐘）
    if (Date.now() - meta.timestamp > 5 * 60 * 1000) {
      localStorage.removeItem(PENDING_IMAGE_KEY);
      return null;
    }
    
    // 清除已讀取的資料
    localStorage.removeItem(PENDING_IMAGE_KEY);
    
    // 如果有圖庫 ID，從 IndexedDB 獲取圖片
    if (meta.galleryId) {
      const galleryImage = await sharedGalleryService.getImage(meta.galleryId);
      if (galleryImage) {
        return {
          imageUrl: galleryImage.dataUrl,
          source: meta.source,
          sourceId: meta.sourceId,
          name: meta.name,
          metadata: meta.metadata,
          timestamp: meta.timestamp,
        };
      }
    }
    
    // 降級：直接返回存儲的數據（可能是 URL）
    if (meta.imageUrl) {
      return meta as PendingImageData;
    }
    
    return null;
  } catch {
    localStorage.removeItem(PENDING_IMAGE_KEY);
    return null;
  }
}

/**
 * 檢查是否有待編輯的圖片
 */
export function hasPendingImageForEditor(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(PENDING_IMAGE_KEY) !== null;
}

// ============================================================
// 從圖片編輯室導回其他引擎
// 注意：圖片數據存在 IndexedDB，只在 localStorage 存元數據
// ============================================================

const PENDING_IMAGE_FOR_ENGINE_KEY = 'pendingImageForEngine';

export type TargetEngine = 'social' | 'blog' | 'video';

export interface PendingImageForEngine {
  dataUrl: string;
  targetEngine: TargetEngine;
  name?: string;
  width: number;
  height: number;
  metadata?: Record<string, any>;
  timestamp: number;
}

/**
 * 設定待導入引擎的圖片（從圖片編輯室導出）
 * 圖片會先存到 IndexedDB，只在 localStorage 存元數據
 */
export async function setPendingImageForEngine(data: Omit<PendingImageForEngine, 'timestamp'>): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    // 先把圖片存到共享圖庫（IndexedDB）
    const galleryImage = await sharedGalleryService.addImageFromDataUrl(data.dataUrl, {
      name: data.name || 'pending-return',
      source: 'design-studio',
      metadata: { ...data.metadata, isPendingReturn: true, targetEngine: data.targetEngine },
    });
    
    // 在 localStorage 只存元數據和圖庫 ID
    const pendingMeta = {
      galleryId: galleryImage.id,
      targetEngine: data.targetEngine,
      name: data.name,
      width: data.width,
      height: data.height,
      metadata: data.metadata,
      timestamp: Date.now(),
    };
    
    localStorage.setItem(PENDING_IMAGE_FOR_ENGINE_KEY, JSON.stringify(pendingMeta));
  } catch (error) {
    console.error('Failed to set pending image for engine:', error);
    throw error;
  }
}

/**
 * 取得並清除待導入引擎的圖片
 */
export async function getPendingImageForEngine(targetEngine?: TargetEngine): Promise<PendingImageForEngine | null> {
  if (typeof window === 'undefined') return null;
  
  const stored = localStorage.getItem(PENDING_IMAGE_FOR_ENGINE_KEY);
  if (!stored) return null;
  
  try {
    const meta = JSON.parse(stored);
    
    // 檢查是否過期（5 分鐘）
    if (Date.now() - meta.timestamp > 5 * 60 * 1000) {
      localStorage.removeItem(PENDING_IMAGE_FOR_ENGINE_KEY);
      return null;
    }
    
    // 如果指定了目標引擎，檢查是否匹配
    if (targetEngine && meta.targetEngine !== targetEngine) {
      return null;
    }
    
    // 清除已讀取的資料
    localStorage.removeItem(PENDING_IMAGE_FOR_ENGINE_KEY);
    
    // 從 IndexedDB 獲取圖片
    if (meta.galleryId) {
      const galleryImage = await sharedGalleryService.getImage(meta.galleryId);
      if (galleryImage) {
        return {
          dataUrl: galleryImage.dataUrl,
          targetEngine: meta.targetEngine,
          name: meta.name,
          width: meta.width || galleryImage.width,
          height: meta.height || galleryImage.height,
          metadata: meta.metadata,
          timestamp: meta.timestamp,
        };
      }
    }
    
    return null;
  } catch {
    localStorage.removeItem(PENDING_IMAGE_FOR_ENGINE_KEY);
    return null;
  }
}

/**
 * 檢查是否有待導入引擎的圖片
 */
export function hasPendingImageForEngine(targetEngine?: TargetEngine): boolean {
  if (typeof window === 'undefined') return false;
  
  const stored = localStorage.getItem(PENDING_IMAGE_FOR_ENGINE_KEY);
  if (!stored) return false;
  
  if (!targetEngine) return true;
  
  try {
    const meta = JSON.parse(stored);
    return meta.targetEngine === targetEngine;
  } catch {
    return false;
  }
}
