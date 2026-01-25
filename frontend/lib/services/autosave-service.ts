/**
 * AutoSave Service - 自動保存服務
 * 定期自動保存畫布狀態，支援草稿恢復
 */

import { db, type AutoSaveData } from '../db/design-studio-db';

// 自動保存間隔（毫秒）
const AUTOSAVE_INTERVAL = 30000; // 30 秒

// 自動保存 ID
const AUTOSAVE_ID = 'current';

// ============================================================
// 自動保存服務
// ============================================================

class AutoSaveService {
  private intervalId: NodeJS.Timeout | null = null;
  private isEnabled: boolean = true;
  private lastSaveTime: number = 0;
  private pendingSave: boolean = false;

  /**
   * 啟動自動保存
   */
  start(getCanvasState: () => {
    canvas: any;
    projectId?: string;
    projectName?: string;
    canvasWidth: number;
    canvasHeight: number;
    backgroundColor: string;
  }) {
    if (this.intervalId) {
      this.stop();
    }

    this.isEnabled = true;

    this.intervalId = setInterval(async () => {
      if (!this.isEnabled || this.pendingSave) return;

      try {
        const state = getCanvasState();
        if (!state.canvas) return;

        await this.save(state);
      } catch (error) {
        console.error('自動保存失敗:', error);
      }
    }, AUTOSAVE_INTERVAL);

    console.log('自動保存已啟動');
  }

  /**
   * 停止自動保存
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isEnabled = false;
    console.log('自動保存已停止');
  }

  /**
   * 暫停自動保存
   */
  pause() {
    this.isEnabled = false;
  }

  /**
   * 恢復自動保存
   */
  resume() {
    this.isEnabled = true;
  }

  /**
   * 立即保存
   */
  async save(state: {
    canvas: any;
    projectId?: string;
    projectName?: string;
    canvasWidth: number;
    canvasHeight: number;
    backgroundColor: string;
  }): Promise<void> {
    if (this.pendingSave) return;
    this.pendingSave = true;

    try {
      const { canvas, projectId, projectName, canvasWidth, canvasHeight, backgroundColor } = state;
      
      if (!canvas) {
        console.warn('Canvas 不存在，跳過自動保存');
        return;
      }

      const customProperties = [
        'id', 'name', 'blendMode', 'globalCompositeOperation', 
        'lockUniScaling', 'isGrid', 'isGuide'
      ];

      // 過濾掉網格和參考線
      const objects = canvas.getObjects().filter((obj: any) => !obj.isGrid && !obj.isGuide);
      const canvasJson = JSON.stringify({
        ...canvas.toJSON(customProperties),
        objects: objects.map((obj: any) => obj.toJSON(customProperties))
      });

      const autosaveData: AutoSaveData = {
        id: AUTOSAVE_ID,
        projectId,
        projectName: projectName || '未命名專案',
        canvasJson,
        canvasWidth,
        canvasHeight,
        backgroundColor,
        timestamp: new Date()
      };

      await db.autosave.put(autosaveData);
      this.lastSaveTime = Date.now();
      console.log('自動保存完成:', new Date().toLocaleTimeString());
    } catch (error) {
      console.error('自動保存錯誤:', error);
      throw error;
    } finally {
      this.pendingSave = false;
    }
  }

  /**
   * 取得自動保存的草稿
   */
  async getDraft(): Promise<AutoSaveData | undefined> {
    return await db.autosave.get(AUTOSAVE_ID);
  }

  /**
   * 檢查是否有草稿可恢復
   */
  async hasDraft(): Promise<boolean> {
    const draft = await this.getDraft();
    return !!draft;
  }

  /**
   * 清除草稿
   */
  async clearDraft(): Promise<void> {
    await db.autosave.delete(AUTOSAVE_ID);
    console.log('草稿已清除');
  }

  /**
   * 恢復草稿到畫布
   */
  async recoverDraft(canvas: any): Promise<AutoSaveData | null> {
    try {
      const draft = await this.getDraft();
      if (!draft) {
        console.log('沒有可恢復的草稿');
        return null;
      }

      const canvasData = JSON.parse(draft.canvasJson);
      
      return new Promise((resolve) => {
        canvas.loadFromJSON(canvasData, () => {
          canvas.renderAll();
          console.log('草稿已恢復');
          resolve(draft);
        });
      });
    } catch (error) {
      console.error('恢復草稿失敗:', error);
      return null;
    }
  }

  /**
   * 取得上次保存時間
   */
  getLastSaveTime(): number {
    return this.lastSaveTime;
  }

  /**
   * 檢查是否正在運行
   */
  isRunning(): boolean {
    return this.intervalId !== null && this.isEnabled;
  }
}

// 單例
export const autosaveService = new AutoSaveService();
export default autosaveService;
