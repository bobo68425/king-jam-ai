/**
 * 圖片去背服務
 * 使用本地 rembg 進行圖片去背處理（免費開源方案）
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface RemoveBackgroundOptions {
  outputType?: 1 | 2;  // 1=PNG透明背景, 2=JPG白色背景
  returnType?: 1 | 2;  // 1=URL, 2=Base64（本地服務只支援 Base64）
  useAsync?: boolean;   // 保留參數但本地服務不需要
}

export interface RemoveBackgroundResult {
  success: boolean;
  image: string;       // 去背後的圖片（Base64）
  width?: number;
  height?: number;
}

class BackgroundRemovalService {
  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  }

  /**
   * 將 fabric.Image 物件轉換為 Base64
   */
  async fabricImageToBase64(fabricImage: fabric.Image): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // 檢查物件是否有有效的 canvas 引用
        if (!fabricImage.canvas) {
          // 嘗試使用原始圖片來源
          const imgElement = fabricImage.getElement() as HTMLImageElement;
          if (imgElement && imgElement.src) {
            resolve(imgElement.src);
            return;
          }
          reject(new Error('圖片物件沒有有效的 canvas 引用'));
          return;
        }
        
        // 使用 fabric.js 的 toDataURL 方法
        const imgWithMethod = fabricImage as fabric.Image & { toDataURL: (options: { format: string; quality: number; multiplier: number }) => string };
        const dataUrl = imgWithMethod.toDataURL({
          format: 'png',
          quality: 1,
          multiplier: 1,
        });
        resolve(dataUrl);
      } catch (error) {
        // 嘗試使用替代方案
        try {
          const imgElement = fabricImage.getElement() as HTMLImageElement;
          if (imgElement && imgElement.src) {
            resolve(imgElement.src);
            return;
          }
        } catch {
          // 忽略替代方案錯誤
        }
        reject(error);
      }
    });
  }

  /**
   * 從 Canvas 物件去背
   */
  async removeBackgroundFromFabricImage(
    fabricImage: fabric.Image,
    options: RemoveBackgroundOptions = {}
  ): Promise<RemoveBackgroundResult> {
    const base64 = await this.fabricImageToBase64(fabricImage);
    return this.removeBackground({ imageBase64: base64, ...options });
  }

  /**
   * 去背 API 調用
   */
  async removeBackground(params: {
    imageBase64?: string;
    imageUrl?: string;
    outputType?: 1 | 2;
    returnType?: 1 | 2;
    useAsync?: boolean;
  }): Promise<RemoveBackgroundResult> {
    const token = this.getAuthToken();
    
    if (!token) {
      throw new Error('請先登入');
    }

    const response = await fetch(`${API_BASE_URL}/api/design-studio/remove-background`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        image_base64: params.imageBase64,
        image_url: params.imageUrl,
        output_type: params.outputType ?? 1,
        return_type: params.returnType ?? 2,
        use_async: params.useAsync ?? false,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: '未知錯誤' }));
      throw new Error(error.detail || `去背失敗: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 檢查去背服務狀態
   */
  async checkApiStatus(): Promise<{ configured: boolean; message: string }> {
    const token = this.getAuthToken();
    
    if (!token) {
      return { configured: false, message: '請先登入' };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/design-studio/api-status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return { configured: false, message: 'API 服務不可用' };
      }

      const data = await response.json();
      return {
        configured: data.available ?? true, // rembg 本地服務預設可用
        message: data.message,
      };
    } catch (error) {
      return { configured: false, message: '無法連接 API 服務' };
    }
  }
}

export const backgroundRemovalService = new BackgroundRemovalService();
