/**
 * Version Service - 版本歷史服務
 * 管理專案的版本歷史，支援版本保存和恢復
 */

import { 
  db, 
  generateId, 
  generateThumbnail,
  type Version 
} from '../db/design-studio-db';
import { projectService } from './project-service';

// 每個專案最多保留的版本數
const MAX_VERSIONS_PER_PROJECT = 20;

// ============================================================
// 版本歷史服務
// ============================================================

export const versionService = {
  /**
   * 取得專案的所有版本（依時間倒序）
   */
  async getVersions(projectId: string): Promise<Version[]> {
    return await db.versions
      .where('projectId')
      .equals(projectId)
      .reverse()
      .sortBy('createdAt');
  },

  /**
   * 取得單一版本
   */
  async getVersion(id: string): Promise<Version | undefined> {
    return await db.versions.get(id);
  },

  /**
   * 保存新版本
   */
  async saveVersion(params: {
    projectId: string;
    description: string;
    canvas: any;
  }): Promise<Version> {
    const { projectId, description, canvas } = params;
    
    if (!canvas) {
      throw new Error('Canvas 不存在');
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

    const version: Version = {
      id: generateId(),
      projectId,
      canvasJson,
      thumbnail: generateThumbnail(canvas),
      description: description || `版本 ${new Date().toLocaleString('zh-TW')}`,
      createdAt: new Date()
    };

    await db.versions.add(version);
    
    // 更新專案的版本計數
    await projectService.incrementVersionCount(projectId);
    
    // 清理舊版本
    await this.cleanupOldVersions(projectId);

    return version;
  },

  /**
   * 恢復到指定版本
   */
  async restoreVersion(versionId: string, canvas: any): Promise<Version | null> {
    const version = await db.versions.get(versionId);
    if (!version) {
      console.error('版本不存在:', versionId);
      return null;
    }

    try {
      const canvasData = JSON.parse(version.canvasJson);
      
      return new Promise((resolve) => {
        canvas.loadFromJSON(canvasData, () => {
          canvas.renderAll();
          console.log('已恢復到版本:', version.description);
          resolve(version);
        });
      });
    } catch (error) {
      console.error('恢復版本失敗:', error);
      return null;
    }
  },

  /**
   * 刪除版本
   */
  async deleteVersion(id: string): Promise<void> {
    await db.versions.delete(id);
  },

  /**
   * 刪除專案的所有版本
   */
  async deleteAllVersions(projectId: string): Promise<void> {
    await db.versions.where('projectId').equals(projectId).delete();
  },

  /**
   * 清理舊版本（保留最新的 N 個）
   */
  async cleanupOldVersions(projectId: string): Promise<void> {
    const versions = await db.versions
      .where('projectId')
      .equals(projectId)
      .sortBy('createdAt');
    
    if (versions.length > MAX_VERSIONS_PER_PROJECT) {
      const toDelete = versions.slice(0, versions.length - MAX_VERSIONS_PER_PROJECT);
      const idsToDelete = toDelete.map(v => v.id);
      await db.versions.bulkDelete(idsToDelete);
      console.log(`已清理 ${idsToDelete.length} 個舊版本`);
    }
  },

  /**
   * 取得版本數量
   */
  async getVersionCount(projectId: string): Promise<number> {
    return await db.versions.where('projectId').equals(projectId).count();
  },

  /**
   * 比較兩個版本（返回是否相同）
   */
  async compareVersions(versionId1: string, versionId2: string): Promise<boolean> {
    const v1 = await db.versions.get(versionId1);
    const v2 = await db.versions.get(versionId2);
    
    if (!v1 || !v2) return false;
    
    return v1.canvasJson === v2.canvasJson;
  },

  /**
   * 從版本建立新專案
   */
  async createProjectFromVersion(versionId: string, newProjectName: string): Promise<string | null> {
    const version = await db.versions.get(versionId);
    if (!version) return null;

    const project = await projectService.createProject({
      name: newProjectName,
      canvasWidth: 1080,  // 預設值，實際上應該從 version 解析
      canvasHeight: 1080,
      backgroundColor: '#ffffff',
      canvasJson: version.canvasJson
    });

    return project.id;
  }
};

export default versionService;
