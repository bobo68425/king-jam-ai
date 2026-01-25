/**
 * Local File Service - 本地檔案服務
 * 使用 File System Access API 和標準下載方式
 * 讓用戶直接在本地裝置保存和開啟檔案
 */

import { fabric } from 'fabric';

// 擴展 Fabric 物件類型
interface ExtendedFabricObject extends fabric.Object {
  id?: string;
  name?: string;
  isGrid?: boolean;
  isGuide?: boolean;
}

// File System Access API 類型
interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
  getFile(): Promise<File>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: string | Blob | ArrayBuffer): Promise<void>;
  close(): Promise<void>;
}

interface ShowOpenFilePickerOptions {
  types?: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
  multiple?: boolean;
}

interface ShowSaveFilePickerOptions {
  suggestedName?: string;
  types?: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}

// 擴展 Window 類型
declare global {
  interface Window {
    showOpenFilePicker?: (options?: ShowOpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?: (options?: ShowSaveFilePickerOptions) => Promise<FileSystemFileHandle>;
  }
}

// 專案檔案格式
export interface ProjectFile {
  version: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  canvas: {
    width: number;
    height: number;
    backgroundColor: string;
    json: Record<string, unknown>;
  };
  metadata?: {
    author?: string;
    description?: string;
  };
}

// 自定義屬性列表（需要保存到 JSON 中）
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

class LocalFileService {
  private fileExtension = '.jam';
  private mimeType = 'application/json';

  /**
   * 保存專案到本地檔案
   */
  async saveProject(
    canvas: fabric.Canvas,
    projectName: string,
    canvasWidth: number,
    canvasHeight: number,
    backgroundColor: string
  ): Promise<boolean> {
    try {
      // 過濾掉網格和參考線
      const objects = canvas.getObjects().filter((obj) => {
        const extObj = obj as ExtendedFabricObject;
        return !extObj.isGrid && !extObj.isGuide;
      });
      
      // 創建臨時 canvas 來生成乾淨的 JSON
      const tempCanvas = new fabric.Canvas(null);
      tempCanvas.setWidth(canvasWidth);
      tempCanvas.setHeight(canvasHeight);
      tempCanvas.setBackgroundColor(backgroundColor, () => {});
      
      // 複製物件到臨時 canvas
      for (const obj of objects) {
        const cloned = await new Promise<fabric.Object>((resolve) => {
          obj.clone((c: fabric.Object) => resolve(c), CUSTOM_PROPERTIES);
        });
        tempCanvas.add(cloned);
      }
      
      const canvasJson = tempCanvas.toJSON(CUSTOM_PROPERTIES);
      tempCanvas.dispose();

      const projectData: ProjectFile = {
        version: '1.0.0',
        name: projectName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        canvas: {
          width: canvasWidth,
          height: canvasHeight,
          backgroundColor,
          json: canvasJson,
        },
      };

      const jsonString = JSON.stringify(projectData, null, 2);
      const blob = new Blob([jsonString], { type: this.mimeType });
      
      // 嘗試使用 File System Access API（現代瀏覽器）
      if (window.showSaveFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: `${projectName}${this.fileExtension}`,
            types: [{
              description: 'Jam 專案檔案',
              accept: { 'application/json': [this.fileExtension] },
            }],
          });
          
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          return true;
        } catch (err) {
          // 用戶取消或不支援
          if (err instanceof Error && err.name === 'AbortError') {
            return false;
          }
          // 回退到下載方式
        }
      }
      
      // 回退：使用標準下載方式
      this.downloadFile(blob, `${projectName}${this.fileExtension}`);
      return true;
    } catch (error) {
      console.error('保存專案失敗:', error);
      throw error;
    }
  }

  /**
   * 從本地檔案開啟專案
   */
  async openProject(): Promise<ProjectFile | null> {
    try {
      // 嘗試使用 File System Access API
      if (window.showOpenFilePicker) {
        try {
          const [handle] = await window.showOpenFilePicker({
            types: [{
              description: 'Jam 專案檔案',
              accept: { 'application/json': [this.fileExtension, '.kingjam', '.json'] },
            }],
            multiple: false,
          });
          
          const file = await handle.getFile();
          const content = await file.text();
          return this.parseProjectFile(content);
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            return null; // 用戶取消
          }
          // 回退到 input 方式
        }
      }
      
      // 回退：使用 input 元素
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = `${this.fileExtension},.kingjam,.json`;
        
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) {
            resolve(null);
            return;
          }
          
          const content = await file.text();
          resolve(this.parseProjectFile(content));
        };
        
        input.oncancel = () => resolve(null);
        input.click();
      });
    } catch (error) {
      console.error('開啟專案失敗:', error);
      throw error;
    }
  }

  /**
   * 解析專案檔案內容
   */
  private parseProjectFile(content: string): ProjectFile | null {
    try {
      const data = JSON.parse(content);
      
      // 驗證檔案格式
      if (!data.canvas || !data.canvas.json) {
        throw new Error('無效的專案檔案格式');
      }
      
      return data as ProjectFile;
    } catch (error) {
      console.error('解析專案檔案失敗:', error);
      throw new Error('無法解析專案檔案，請確認檔案格式正確');
    }
  }

  /**
   * 載入專案到畫布
   */
  async loadProjectToCanvas(
    project: ProjectFile,
    canvas: fabric.Canvas,
    setCanvasSize: (width: number, height: number) => void,
    setCanvasBackground: (color: string) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // 設置畫布尺寸和背景
        setCanvasSize(project.canvas.width, project.canvas.height);
        setCanvasBackground(project.canvas.backgroundColor);
        
        // 清除現有物件（保留網格和參考線）
        const objectsToRemove = canvas.getObjects().filter((obj) => {
          const extObj = obj as ExtendedFabricObject;
          return !extObj.isGrid && !extObj.isGuide;
        });
        objectsToRemove.forEach(obj => canvas.remove(obj));
        
        // 載入專案 JSON
        canvas.loadFromJSON(project.canvas.json, () => {
          canvas.renderAll();
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 匯出為 PNG
   * @param canvas Fabric.js 畫布
   * @param fileName 檔案名稱（不含副檔名）
   * @param options 匯出選項
   * @param options.multiplier 解析度倍數（預設 2）
   * @param options.quality 品質（預設 1）
   * @param options.transparent 是否透明背景（預設 false）
   */
  exportPNG(
    canvas: fabric.Canvas,
    fileName: string,
    options?: {
      multiplier?: number;
      quality?: number;
      transparent?: boolean;
    }
  ): void {
    const { multiplier = 2, quality = 1, transparent = false } = options || {};
    
    // 臨時隱藏網格和參考線
    const hiddenObjects: fabric.Object[] = [];
    canvas.getObjects().forEach((obj) => {
      const extObj = obj as ExtendedFabricObject;
      if (extObj.isGrid || extObj.isGuide) {
        obj.visible = false;
        hiddenObjects.push(obj);
      }
    });
    
    // 保存原背景色
    const originalBackground = canvas.backgroundColor;
    
    // 如果要透明背景，暫時移除背景色
    if (transparent) {
      canvas.backgroundColor = undefined;
      canvas.renderAll();
    }
    
    const dataUrl = canvas.toDataURL({
      format: 'png',
      quality,
      multiplier,
    });
    
    // 恢復背景色
    if (transparent) {
      canvas.backgroundColor = originalBackground;
    }
    
    // 恢復網格和參考線
    hiddenObjects.forEach(obj => obj.visible = true);
    canvas.renderAll();
    
    this.downloadDataUrl(dataUrl, `${fileName}.png`);
  }

  /**
   * 匯出為 JPG
   */
  exportJPG(
    canvas: fabric.Canvas,
    fileName: string,
    options?: {
      multiplier?: number;
      quality?: number;
      backgroundColor?: string;
    }
  ): void {
    const { multiplier = 2, quality = 0.92, backgroundColor = '#FFFFFF' } = options || {};
    
    // 臨時隱藏網格和參考線
    const hiddenObjects: fabric.Object[] = [];
    canvas.getObjects().forEach((obj) => {
      const extObj = obj as ExtendedFabricObject;
      if (extObj.isGrid || extObj.isGuide) {
        obj.visible = false;
        hiddenObjects.push(obj);
      }
    });
    
    // 保存原背景色
    const originalBg = canvas.backgroundColor;
    
    // 設置白色背景（JPG 不支援透明）
    canvas.setBackgroundColor(backgroundColor, () => {
      canvas.renderAll();
      
      const dataUrl = canvas.toDataURL({
        format: 'jpeg',
        quality,
        multiplier,
      });
      
      // 恢復原背景色和隱藏物件
      canvas.setBackgroundColor(originalBg as string, () => {
        hiddenObjects.forEach(obj => obj.visible = true);
        canvas.renderAll();
      });
      
      this.downloadDataUrl(dataUrl, `${fileName}.jpg`);
    });
  }

  /**
   * 匯出為 SVG
   */
  exportSVG(canvas: fabric.Canvas, fileName: string): void {
    // 臨時隱藏網格和參考線
    const hiddenObjects: fabric.Object[] = [];
    canvas.getObjects().forEach((obj) => {
      const extObj = obj as ExtendedFabricObject;
      if (extObj.isGrid || extObj.isGuide) {
        obj.visible = false;
        hiddenObjects.push(obj);
      }
    });
    
    const svg = canvas.toSVG();
    
    // 恢復
    hiddenObjects.forEach(obj => obj.visible = true);
    canvas.renderAll();
    
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    this.downloadFile(blob, `${fileName}.svg`);
  }

  /**
   * 匯出為 PDF（需要額外庫，這裡簡單使用圖片轉換）
   */
  async exportPDF(
    canvas: fabric.Canvas,
    fileName: string,
    options?: {
      orientation?: 'portrait' | 'landscape';
    }
  ): Promise<void> {
    // 動態載入 jsPDF
    const { jsPDF } = await import('jspdf');
    
    const { orientation = 'portrait' } = options || {};
    
    // 臨時隱藏網格和參考線
    const hiddenObjects: fabric.Object[] = [];
    canvas.getObjects().forEach((obj) => {
      const extObj = obj as ExtendedFabricObject;
      if (extObj.isGrid || extObj.isGuide) {
        obj.visible = false;
        hiddenObjects.push(obj);
      }
    });
    
    const dataUrl = canvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2,
    });
    
    // 恢復
    hiddenObjects.forEach(obj => obj.visible = true);
    canvas.renderAll();
    
    const pdf = new jsPDF({
      orientation,
      unit: 'px',
      format: [canvas.getWidth(), canvas.getHeight()],
    });
    
    pdf.addImage(dataUrl, 'PNG', 0, 0, canvas.getWidth(), canvas.getHeight());
    pdf.save(`${fileName}.pdf`);
  }

  /**
   * 輔助方法：下載檔案
   */
  private downloadFile(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * 輔助方法：下載 Data URL
   */
  private downloadDataUrl(dataUrl: string, fileName: string): void {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * 匯入圖片到畫布
   */
  async importImage(): Promise<{ dataUrl: string; width: number; height: number; name: string } | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          
          // 獲取圖片尺寸
          const img = new Image();
          img.onload = () => {
            resolve({
              dataUrl,
              width: img.width,
              height: img.height,
              name: file.name.replace(/\.[^/.]+$/, ''), // 移除副檔名
            });
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(file);
      };
      
      input.oncancel = () => resolve(null);
      input.click();
    });
  }

  /**
   * 開啟圖片檔案作為新專案
   * 支援 PNG、JPG、GIF、WebP、BMP、SVG 等常用格式
   */
  async openImageAsProject(): Promise<{
    dataUrl: string;
    width: number;
    height: number;
    name: string;
    format: string;
  } | null> {
    const supportedFormats = [
      '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.ico', '.tiff', '.tif'
    ];
    
    return new Promise((resolve) => {
      // 嘗試使用 File System Access API
      if (window.showOpenFilePicker) {
        (async () => {
          try {
            const [handle] = await window.showOpenFilePicker({
              types: [{
                description: '圖片檔案',
                accept: {
                  'image/*': supportedFormats,
                },
              }],
              multiple: false,
            });
            
            const file = await handle.getFile();
            this.processImageFile(file, resolve);
          } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
              resolve(null);
              return;
            }
            // 回退到 input 方式
            this.openImageWithInput(supportedFormats, resolve);
          }
        })();
      } else {
        this.openImageWithInput(supportedFormats, resolve);
      }
    });
  }

  /**
   * 使用 input 元素開啟圖片
   */
  private openImageWithInput(
    formats: string[],
    resolve: (value: { dataUrl: string; width: number; height: number; name: string; format: string } | null) => void
  ): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = formats.join(',') + ',image/*';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      this.processImageFile(file, resolve);
    };
    
    input.oncancel = () => resolve(null);
    input.click();
  }

  /**
   * 處理圖片檔案
   */
  private processImageFile(
    file: File,
    resolve: (value: { dataUrl: string; width: number; height: number; name: string; format: string } | null) => void
  ): void {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      
      // 獲取圖片尺寸
      const img = new Image();
      img.onload = () => {
        // 取得檔案名稱（不含副檔名）
        const name = file.name.replace(/\.[^/.]+$/, '');
        // 取得格式
        const format = file.type.split('/')[1] || file.name.split('.').pop() || 'unknown';
        
        resolve({
          dataUrl,
          width: img.width,
          height: img.height,
          name,
          format,
        });
      };
      
      img.onerror = () => {
        console.error('無法載入圖片');
        resolve(null);
      };
      
      img.src = dataUrl;
    };
    
    reader.onerror = () => {
      console.error('無法讀取檔案');
      resolve(null);
    };
    
    reader.readAsDataURL(file);
  }
}

export const localFileService = new LocalFileService();
