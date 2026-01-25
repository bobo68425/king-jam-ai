/**
 * Asset Service - 素材庫服務
 * 管理用戶上傳的圖片和字體
 */

import { 
  db, 
  generateId, 
  formatFileSize,
  type Asset 
} from '../db/design-studio-db';

// 支援的圖片格式
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

// 最大檔案大小 (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 縮圖最大尺寸
const THUMBNAIL_MAX_SIZE = 200;

// ============================================================
// 素材庫服務
// ============================================================

export const assetService = {
  /**
   * 取得所有素材（依時間倒序）
   */
  async getAllAssets(): Promise<Asset[]> {
    return await db.assets
      .orderBy('createdAt')
      .reverse()
      .toArray();
  },

  /**
   * 取得指定類型的素材
   */
  async getAssetsByType(type: 'image' | 'font'): Promise<Asset[]> {
    return await db.assets
      .where('type')
      .equals(type)
      .reverse()
      .sortBy('createdAt');
  },

  /**
   * 取得單一素材
   */
  async getAsset(id: string): Promise<Asset | undefined> {
    return await db.assets.get(id);
  },

  /**
   * 上傳圖片
   */
  async uploadImage(file: File): Promise<Asset> {
    // 驗證檔案類型
    if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
      throw new Error(`不支援的檔案格式: ${file.type}。支援的格式: JPEG, PNG, GIF, WebP, SVG`);
    }

    // 驗證檔案大小
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`檔案太大: ${formatFileSize(file.size)}。最大允許: ${formatFileSize(MAX_FILE_SIZE)}`);
    }

    // 讀取檔案為 Data URL
    const dataUrl = await this.fileToDataUrl(file);
    
    // 取得圖片尺寸
    const dimensions = await this.getImageDimensions(dataUrl);
    
    // 產生縮圖
    const thumbnail = await this.generateImageThumbnail(dataUrl, dimensions.width, dimensions.height);

    const asset: Asset = {
      id: generateId(),
      name: file.name,
      type: 'image',
      data: file,
      dataUrl,
      thumbnail,
      mimeType: file.type,
      size: file.size,
      width: dimensions.width,
      height: dimensions.height,
      metadata: {
        originalName: file.name,
        lastModified: file.lastModified
      },
      createdAt: new Date()
    };

    await db.assets.add(asset);
    return asset;
  },

  /**
   * 批量上傳圖片
   */
  async uploadImages(files: FileList | File[]): Promise<{ success: Asset[]; failed: { file: File; error: string }[] }> {
    const success: Asset[] = [];
    const failed: { file: File; error: string }[] = [];

    for (const file of Array.from(files)) {
      try {
        const asset = await this.uploadImage(file);
        success.push(asset);
      } catch (error) {
        failed.push({
          file,
          error: error instanceof Error ? error.message : '上傳失敗'
        });
      }
    }

    return { success, failed };
  },

  /**
   * 刪除素材
   */
  async deleteAsset(id: string): Promise<void> {
    await db.assets.delete(id);
  },

  /**
   * 重命名素材
   */
  async renameAsset(id: string, newName: string): Promise<void> {
    await db.assets.update(id, { name: newName });
  },

  /**
   * 取得素材數量
   */
  async getAssetCount(): Promise<number> {
    return await db.assets.count();
  },

  /**
   * 取得總儲存空間使用量
   */
  async getTotalStorageUsed(): Promise<string> {
    const assets = await db.assets.toArray();
    const totalBytes = assets.reduce((sum, asset) => sum + asset.size, 0);
    return formatFileSize(totalBytes);
  },

  /**
   * 搜尋素材
   */
  async searchAssets(query: string): Promise<Asset[]> {
    const lowerQuery = query.toLowerCase();
    return await db.assets
      .filter(asset => asset.name.toLowerCase().includes(lowerQuery))
      .toArray();
  },

  /**
   * 清空所有素材
   */
  async clearAllAssets(): Promise<void> {
    await db.assets.clear();
  },

  // ========== 輔助方法 ==========

  /**
   * 將 File 轉換為 Data URL
   */
  async fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('讀取檔案失敗'));
      reader.readAsDataURL(file);
    });
  },

  /**
   * 取得圖片尺寸
   */
  async getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => reject(new Error('載入圖片失敗'));
      img.src = dataUrl;
    });
  },

  /**
   * 產生圖片縮圖
   */
  async generateImageThumbnail(
    dataUrl: string, 
    originalWidth: number, 
    originalHeight: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // 計算縮圖尺寸
        let width = originalWidth;
        let height = originalHeight;
        
        if (width > THUMBNAIL_MAX_SIZE || height > THUMBNAIL_MAX_SIZE) {
          const ratio = Math.min(THUMBNAIL_MAX_SIZE / width, THUMBNAIL_MAX_SIZE / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // 使用 Canvas 產生縮圖
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('無法建立 Canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => reject(new Error('產生縮圖失敗'));
      img.src = dataUrl;
    });
  },

  /**
   * 從 Data URL 取得 Blob
   */
  dataUrlToBlob(dataUrl: string): Blob {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const bstr = atob(parts[1]);
    const arr = new Uint8Array(bstr.length);
    
    for (let i = 0; i < bstr.length; i++) {
      arr[i] = bstr.charCodeAt(i);
    }
    
    return new Blob([arr], { type: mime });
  }
};

export default assetService;
