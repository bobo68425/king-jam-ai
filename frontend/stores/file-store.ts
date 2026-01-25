/**
 * File Store - 檔案狀態管理
 * 管理專案的保存狀態、當前專案資訊、儲存模式
 * 支援 IndexedDB 和本地檔案兩種儲存方式
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// 儲存模式
export type StorageMode = 'indexeddb' | 'local';

// 簡化的專案資訊（用於追蹤當前開啟的專案）
export interface ProjectInfo {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// 類型定義
// ============================================================

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

export type DialogType = 
  | 'none'
  | 'new-project'
  | 'open-project'
  | 'save-as'
  | 'export'
  | 'version-history'
  | 'confirm-discard';

interface FileStoreState {
  // 儲存模式
  storageMode: StorageMode;
  setStorageMode: (mode: StorageMode) => void;
  
  // IndexedDB 設定
  maxStorageSize: number; // bytes
  setMaxStorageSize: (size: number) => void;
  
  // 當前專案
  currentProject: ProjectInfo | null;
  setCurrentProject: (project: ProjectInfo | null) => void;
  
  // 保存狀態
  saveStatus: SaveStatus;
  setSaveStatus: (status: SaveStatus) => void;
  lastSavedAt: Date | null;
  setLastSavedAt: (date: Date | null) => void;
  
  // 對話框狀態
  activeDialog: DialogType;
  openDialog: (dialog: DialogType) => void;
  closeDialog: () => void;
  
  // 是否有未保存的變更
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
  
  // 工具方法
  markAsModified: () => void;
  markAsSaved: () => void;
  
  // 重置
  reset: () => void;
}

// ============================================================
// Store 實作
// ============================================================

// 預設 IndexedDB 空間上限選項
export const STORAGE_SIZE_OPTIONS = [
  { value: 10 * 1024 * 1024, label: '10 MB' },
  { value: 25 * 1024 * 1024, label: '25 MB' },
  { value: 50 * 1024 * 1024, label: '50 MB' },
  { value: 100 * 1024 * 1024, label: '100 MB' },
  { value: 200 * 1024 * 1024, label: '200 MB' },
];

export const useFileStore = create<FileStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        // 儲存模式（預設本地檔案）
        storageMode: 'local' as StorageMode,
        setStorageMode: (mode) => set({ storageMode: mode }),
        
        // IndexedDB 設定（預設 50MB）
        maxStorageSize: 50 * 1024 * 1024,
        setMaxStorageSize: (size) => set({ maxStorageSize: size }),
        
        // 當前專案
        currentProject: null,
        setCurrentProject: (project) => set({ 
          currentProject: project,
          hasUnsavedChanges: false,
          saveStatus: project ? 'saved' : 'unsaved'
        }),
        
        // 保存狀態
        saveStatus: 'unsaved' as SaveStatus,
        setSaveStatus: (status) => set({ saveStatus: status }),
        lastSavedAt: null,
        setLastSavedAt: (date) => set({ lastSavedAt: date }),
        
        // 對話框狀態
        activeDialog: 'none' as DialogType,
        openDialog: (dialog) => set({ activeDialog: dialog }),
        closeDialog: () => set({ activeDialog: 'none' }),
        
        // 未保存變更
        hasUnsavedChanges: false,
        setHasUnsavedChanges: (value) => set({ 
          hasUnsavedChanges: value,
          saveStatus: value ? 'unsaved' : 'saved'
        }),
        
        // 標記為已修改
        markAsModified: () => {
          const { saveStatus } = get();
          if (saveStatus !== 'saving') {
            set({ 
              hasUnsavedChanges: true, 
              saveStatus: 'unsaved' 
            });
          }
        },
        
        // 標記為已保存
        markAsSaved: () => set({ 
          hasUnsavedChanges: false, 
          saveStatus: 'saved',
          lastSavedAt: new Date()
        }),
        
        // 重置
        reset: () => set({
          currentProject: null,
          saveStatus: 'unsaved',
          lastSavedAt: null,
          activeDialog: 'none',
          hasUnsavedChanges: false
        })
      }),
      {
        name: 'file-store',
        partialize: (state) => ({
          storageMode: state.storageMode,
          maxStorageSize: state.maxStorageSize,
        }),
      }
    ),
    { name: 'FileStore' }
  )
);

export default useFileStore;
