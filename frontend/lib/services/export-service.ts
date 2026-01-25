/**
 * Export Service - 匯出服務
 * 支援 PNG、JPG、PDF 格式匯出
 */

import { jsPDF } from 'jspdf';

// ============================================================
// 類型定義
// ============================================================

export type ExportFormat = 'png' | 'jpg' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  quality?: number;           // JPG 品質 0.1-1.0
  transparentBg?: boolean;    // PNG 透明背景
  scale?: number;             // 縮放比例
  pdfSize?: 'a4' | 'a3' | 'letter' | 'custom';
  pdfOrientation?: 'portrait' | 'landscape';
}

export interface ExportResult {
  success: boolean;
  filename?: string;
  error?: string;
}

// ============================================================
// 匯出服務
// ============================================================

class ExportService {
  /**
   * 匯出畫布
   */
  async export(
    canvas: any,
    filename: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    if (!canvas) {
      return { success: false, error: 'Canvas 不存在' };
    }

    try {
      switch (options.format) {
        case 'png':
          return await this.exportPNG(canvas, filename, options);
        case 'jpg':
          return await this.exportJPG(canvas, filename, options);
        case 'pdf':
          return await this.exportPDF(canvas, filename, options);
        default:
          return { success: false, error: '不支援的格式' };
      }
    } catch (error) {
      console.error('匯出失敗:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '匯出失敗' 
      };
    }
  }

  /**
   * 匯出為 PNG
   */
  private async exportPNG(
    canvas: any,
    filename: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    const scale = options.scale || 1;
    
    // 暫存背景色
    const originalBg = canvas.backgroundColor;
    
    // 如果需要透明背景
    if (options.transparentBg) {
      canvas.setBackgroundColor('', () => {});
    }

    const dataUrl = canvas.toDataURL({
      format: 'png',
      multiplier: scale
    });

    // 恢復背景色
    if (options.transparentBg) {
      canvas.setBackgroundColor(originalBg, () => {});
      canvas.renderAll();
    }

    this.downloadDataUrl(dataUrl, `${filename}.png`);
    return { success: true, filename: `${filename}.png` };
  }

  /**
   * 匯出為 JPG
   */
  private async exportJPG(
    canvas: any,
    filename: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    const quality = options.quality ?? 0.9;
    const scale = options.scale || 1;

    // JPG 不支援透明，確保有背景色
    const originalBg = canvas.backgroundColor;
    if (!originalBg || originalBg === 'transparent') {
      canvas.setBackgroundColor('#ffffff', () => {});
    }

    const dataUrl = canvas.toDataURL({
      format: 'jpeg',
      quality: quality,
      multiplier: scale
    });

    // 恢復背景色
    if (!originalBg || originalBg === 'transparent') {
      canvas.setBackgroundColor(originalBg, () => {});
      canvas.renderAll();
    }

    this.downloadDataUrl(dataUrl, `${filename}.jpg`);
    return { success: true, filename: `${filename}.jpg` };
  }

  /**
   * 匯出為 PDF
   */
  private async exportPDF(
    canvas: any,
    filename: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    const orientation = options.pdfOrientation || 'portrait';
    const pdfSize = options.pdfSize || 'a4';
    
    // 計算 PDF 尺寸
    let pdfWidth: number;
    let pdfHeight: number;
    
    switch (pdfSize) {
      case 'a3':
        pdfWidth = orientation === 'portrait' ? 297 : 420;
        pdfHeight = orientation === 'portrait' ? 420 : 297;
        break;
      case 'letter':
        pdfWidth = orientation === 'portrait' ? 215.9 : 279.4;
        pdfHeight = orientation === 'portrait' ? 279.4 : 215.9;
        break;
      case 'custom':
        // 使用畫布原始尺寸（轉換為 mm，假設 96 DPI）
        pdfWidth = (canvas.width / 96) * 25.4;
        pdfHeight = (canvas.height / 96) * 25.4;
        break;
      case 'a4':
      default:
        pdfWidth = orientation === 'portrait' ? 210 : 297;
        pdfHeight = orientation === 'portrait' ? 297 : 210;
        break;
    }

    // 產生高品質圖片
    const dataUrl = canvas.toDataURL({
      format: 'jpeg',
      quality: 1,
      multiplier: 2
    });

    // 建立 PDF
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: pdfSize === 'custom' ? [pdfWidth, pdfHeight] : pdfSize
    });

    // 計算圖片在 PDF 中的位置和大小（保持比例）
    const imgRatio = canvas.width / canvas.height;
    const pdfRatio = pdfWidth / pdfHeight;
    
    let imgWidth: number;
    let imgHeight: number;
    let imgX: number;
    let imgY: number;

    if (imgRatio > pdfRatio) {
      // 圖片較寬，以寬度為基準
      imgWidth = pdfWidth;
      imgHeight = pdfWidth / imgRatio;
      imgX = 0;
      imgY = (pdfHeight - imgHeight) / 2;
    } else {
      // 圖片較高，以高度為基準
      imgHeight = pdfHeight;
      imgWidth = pdfHeight * imgRatio;
      imgX = (pdfWidth - imgWidth) / 2;
      imgY = 0;
    }

    pdf.addImage(dataUrl, 'JPEG', imgX, imgY, imgWidth, imgHeight);
    pdf.save(`${filename}.pdf`);

    return { success: true, filename: `${filename}.pdf` };
  }

  /**
   * 下載 Data URL
   */
  private downloadDataUrl(dataUrl: string, filename: string): void {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * 取得預覽圖
   */
  getPreview(canvas: any, format: ExportFormat, options: Partial<ExportOptions> = {}): string {
    if (!canvas) return '';

    const tempBg = canvas.backgroundColor;
    
    if (format === 'png' && options.transparentBg) {
      canvas.setBackgroundColor('', () => {});
    }

    const dataUrl = canvas.toDataURL({
      format: format === 'jpg' ? 'jpeg' : 'png',
      quality: format === 'jpg' ? (options.quality ?? 0.9) : undefined,
      multiplier: 0.5 // 預覽用小尺寸
    });

    if (format === 'png' && options.transparentBg) {
      canvas.setBackgroundColor(tempBg, () => {});
      canvas.renderAll();
    }

    return dataUrl;
  }

  /**
   * 取得估計檔案大小
   */
  estimateFileSize(canvas: any, format: ExportFormat, options: Partial<ExportOptions> = {}): string {
    if (!canvas) return '0 KB';

    const scale = options.scale || 1;
    const quality = options.quality ?? 0.9;
    
    // 大致估算
    const pixels = canvas.width * canvas.height * scale * scale;
    let estimatedBytes: number;

    switch (format) {
      case 'png':
        // PNG 壓縮率約 1-3 bytes/pixel
        estimatedBytes = pixels * (options.transparentBg ? 2.5 : 2);
        break;
      case 'jpg':
        // JPG 壓縮率取決於品質
        estimatedBytes = pixels * quality * 0.5;
        break;
      case 'pdf':
        // PDF 大約是 JPG + overhead
        estimatedBytes = pixels * 0.5 + 50000;
        break;
      default:
        estimatedBytes = pixels * 2;
    }

    return this.formatBytes(estimatedBytes);
  }

  /**
   * 格式化位元組
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// 單例
export const exportService = new ExportService();
export default exportService;
