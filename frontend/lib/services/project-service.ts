/**
 * Project Service - 專案 CRUD 服務
 * 管理設計專案的新建、保存、載入、刪除
 */

import { 
  db, 
  generateId, 
  generateThumbnail,
  type Project 
} from '../db/design-studio-db';

// ============================================================
// 專案管理服務
// ============================================================

export const projectService = {
  /**
   * 取得所有專案（依更新時間排序）
   */
  async getAllProjects(): Promise<Project[]> {
    return await db.projects
      .orderBy('updatedAt')
      .reverse()
      .toArray();
  },

  /**
   * 取得單一專案
   */
  async getProject(id: string): Promise<Project | undefined> {
    return await db.projects.get(id);
  },

  /**
   * 建立新專案
   */
  async createProject(params: {
    name: string;
    canvasWidth: number;
    canvasHeight: number;
    backgroundColor: string;
    canvasJson?: string;
    canvas?: any;  // Fabric.js Canvas 實例（用於產生縮圖）
  }): Promise<Project> {
    const now = new Date();
    const id = generateId();
    
    const project: Project = {
      id,
      name: params.name,
      thumbnail: params.canvas ? generateThumbnail(params.canvas) : '',
      canvasJson: params.canvasJson || JSON.stringify({ version: '5.3.0', objects: [] }),
      canvasWidth: params.canvasWidth,
      canvasHeight: params.canvasHeight,
      backgroundColor: params.backgroundColor,
      createdAt: now,
      updatedAt: now,
      versionCount: 0
    };

    await db.projects.add(project);
    return project;
  },

  /**
   * 保存專案
   */
  async saveProject(params: {
    id: string;
    name?: string;
    canvasJson: string;
    canvasWidth?: number;
    canvasHeight?: number;
    backgroundColor?: string;
    canvas?: any;
  }): Promise<Project | undefined> {
    const existing = await db.projects.get(params.id);
    if (!existing) {
      throw new Error(`專案不存在: ${params.id}`);
    }

    const updates: Partial<Project> = {
      canvasJson: params.canvasJson,
      updatedAt: new Date()
    };

    if (params.name !== undefined) updates.name = params.name;
    if (params.canvasWidth !== undefined) updates.canvasWidth = params.canvasWidth;
    if (params.canvasHeight !== undefined) updates.canvasHeight = params.canvasHeight;
    if (params.backgroundColor !== undefined) updates.backgroundColor = params.backgroundColor;
    if (params.canvas) updates.thumbnail = generateThumbnail(params.canvas);

    await db.projects.update(params.id, updates);
    return await db.projects.get(params.id);
  },

  /**
   * 另存新檔
   */
  async saveAsProject(params: {
    name: string;
    canvasJson: string;
    canvasWidth: number;
    canvasHeight: number;
    backgroundColor: string;
    canvas?: any;
  }): Promise<Project> {
    return await this.createProject(params);
  },

  /**
   * 刪除專案
   */
  async deleteProject(id: string): Promise<void> {
    // 同時刪除關聯的版本
    await db.versions.where('projectId').equals(id).delete();
    await db.projects.delete(id);
  },

  /**
   * 重命名專案
   */
  async renameProject(id: string, newName: string): Promise<void> {
    await db.projects.update(id, { 
      name: newName,
      updatedAt: new Date()
    });
  },

  /**
   * 複製專案
   */
  async duplicateProject(id: string): Promise<Project | undefined> {
    const original = await db.projects.get(id);
    if (!original) return undefined;

    const now = new Date();
    const newProject: Project = {
      ...original,
      id: generateId(),
      name: `${original.name} (副本)`,
      createdAt: now,
      updatedAt: now,
      versionCount: 0
    };

    await db.projects.add(newProject);
    return newProject;
  },

  /**
   * 搜尋專案
   */
  async searchProjects(query: string): Promise<Project[]> {
    const lowerQuery = query.toLowerCase();
    return await db.projects
      .filter(project => project.name.toLowerCase().includes(lowerQuery))
      .toArray();
  },

  /**
   * 取得專案數量
   */
  async getProjectCount(): Promise<number> {
    return await db.projects.count();
  },

  /**
   * 更新專案縮圖
   */
  async updateThumbnail(id: string, canvas: any): Promise<void> {
    const thumbnail = generateThumbnail(canvas);
    await db.projects.update(id, { thumbnail });
  },

  /**
   * 增加版本計數
   */
  async incrementVersionCount(id: string): Promise<void> {
    const project = await db.projects.get(id);
    if (project) {
      await db.projects.update(id, { 
        versionCount: project.versionCount + 1 
      });
    }
  }
};

export default projectService;
