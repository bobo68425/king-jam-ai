/**
 * Design Studio Store - Zustand 狀態管理
 * 管理畫布狀態、選中物件、圖層系統
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import type { Canvas as FabricCanvas, Object as FabricObject, IText, Image as FabricImage } from 'fabric';

// 擴展 Fabric 物件類型，支援自定義屬性
export interface ExtendedFabricObject extends FabricObject {
  id?: string;
  name?: string;
  isGrid?: boolean;
  isGuide?: boolean;
  text?: string;
  src?: string;
}

// ============================================================
// 類型定義
// ============================================================

// 混合模式
export type BlendMode = 
  | 'source-over' | 'multiply' | 'screen' | 'overlay' 
  | 'darken' | 'lighten' | 'color-dodge' | 'color-burn'
  | 'hard-light' | 'soft-light' | 'difference' | 'exclusion';

// 物件類型
export type ObjectType = 'text' | 'image' | 'shape' | 'group';

// 圖層資料結構
export interface LayerData {
  id: string;
  name: string;
  type: ObjectType;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: BlendMode;
  fabricObject?: FabricObject;
}

// 模板 Schema (用於序列化/導出)
export interface TemplateSchema {
  version: string;
  canvas: {
    width: number;
    height: number;
    backgroundColor: string;
  };
  layers: LayerSchemaItem[];
  metadata: {
    name: string;
    createdAt: string;
    updatedAt: string;
    author?: string;
    tags?: string[];
  };
}

export interface LayerSchemaItem {
  id: string;
  type: ObjectType;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: BlendMode;
  transform: {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    angle: number;
  };
  style: Record<string, unknown>;
  content: string | null; // 文字內容、圖片 URL
}

// 畫布尺寸預設
export interface CanvasPreset {
  id: string;
  name: string;
  width: number;
  height: number;
  category: string;
}

// 歷史記錄操作類型
export type HistoryActionType = 
  | 'init'           // 初始化
  | 'add'            // 新增物件
  | 'remove'         // 刪除物件
  | 'modify'         // 修改物件（位置、大小、旋轉等）
  | 'style'          // 修改樣式（顏色、字體等）
  | 'reorder'        // 重新排序
  | 'batch';         // 批次操作

// 歷史記錄
export interface HistoryState {
  json: string;
  timestamp: number;
  action: HistoryActionType;
  description: string;
  objectIds?: string[];  // 受影響的物件 ID
}

// ============================================================
// Store 狀態類型
// ============================================================

interface DesignStudioState {
  // Canvas 實例
  canvas: FabricCanvas | null;
  setCanvas: (canvas: FabricCanvas | null) => void;
  
  // 畫布設定
  canvasWidth: number;
  canvasHeight: number;
  canvasBackgroundColor: string;
  zoom: number;
  setCanvasSize: (width: number, height: number) => void;
  setCanvasBackground: (color: string) => void;
  setZoom: (zoom: number) => void;
  
  // 選中狀態
  selectedObjectIds: string[];
  setSelectedObjects: (ids: string[]) => void;
  clearSelection: () => void;
  
  // 圖層系統
  layers: LayerData[];
  addLayer: (layer: LayerData) => void;
  removeLayer: (id: string) => void;
  updateLayer: (id: string, updates: Partial<LayerData>) => void;
  reorderLayers: (startIndex: number, endIndex: number) => void;
  
  // 活動工具
  activeTool: 'select' | 'text' | 'shape' | 'image' | 'pan';
  setActiveTool: (tool: 'select' | 'text' | 'shape' | 'image' | 'pan') => void;
  
  // 歷史記錄 (Undo/Redo)
  history: HistoryState[];
  historyIndex: number;
  isRestoringHistory: boolean;  // 標記是否正在恢復歷史（防止循環記錄）
  pushHistory: (state: Omit<HistoryState, 'action' | 'description'> & { action?: HistoryActionType; description?: string; objectIds?: string[] }) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  getHistoryInfo: () => { current: number; total: number; canUndo: boolean; canRedo: boolean };
  
  // 模板操作
  templateName: string;
  setTemplateName: (name: string) => void;
  exportToSchema: () => TemplateSchema | null;
  importFromSchema: (schema: TemplateSchema) => void;
  
  // UI 狀態
  showGrid: boolean;
  showRulers: boolean;
  snapToGrid: boolean;
  gridSize: number;
  toggleGrid: () => void;
  toggleRulers: () => void;
  toggleSnapToGrid: () => void;
  setGridSize: (size: number) => void;
  
  // 側邊面板
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
}

// ============================================================
// 畫布預設尺寸
// ============================================================

export const CANVAS_PRESETS: CanvasPreset[] = [
  // 社群媒體
  { id: 'ig-post', name: 'Instagram 貼文', width: 1080, height: 1080, category: '社群媒體' },
  { id: 'ig-story', name: 'Instagram 限動', width: 1080, height: 1920, category: '社群媒體' },
  { id: 'fb-post', name: 'Facebook 貼文', width: 1200, height: 630, category: '社群媒體' },
  { id: 'fb-cover', name: 'Facebook 封面', width: 1640, height: 624, category: '社群媒體' },
  { id: 'yt-thumbnail', name: 'YouTube 縮圖', width: 1280, height: 720, category: '社群媒體' },
  { id: 'linkedin-post', name: 'LinkedIn 貼文', width: 1200, height: 627, category: '社群媒體' },
  // 部落格
  { id: 'blog-cover', name: '部落格封面', width: 1200, height: 628, category: '部落格' },
  { id: 'blog-wide', name: '部落格寬幅', width: 1920, height: 600, category: '部落格' },
  // 廣告
  { id: 'banner-leaderboard', name: '橫幅廣告', width: 728, height: 90, category: '廣告' },
  { id: 'banner-medium', name: '中型廣告', width: 300, height: 250, category: '廣告' },
  { id: 'banner-skyscraper', name: '摩天樓廣告', width: 160, height: 600, category: '廣告' },
  // 印刷品
  { id: 'a4-portrait', name: 'A4 直式', width: 2480, height: 3508, category: '印刷品' },
  { id: 'a4-landscape', name: 'A4 橫式', width: 3508, height: 2480, category: '印刷品' },
  { id: 'business-card', name: '名片', width: 1050, height: 600, category: '印刷品' },
];

// ============================================================
// 混合模式選項
// ============================================================

export const BLEND_MODE_OPTIONS: { id: BlendMode; label: string; desc: string }[] = [
  { id: 'source-over', label: 'Normal', desc: '預設模式' },
  { id: 'multiply', label: 'Multiply', desc: '正片疊底' },
  { id: 'screen', label: 'Screen', desc: '濾色' },
  { id: 'overlay', label: 'Overlay', desc: '疊加' },
  { id: 'darken', label: 'Darken', desc: '變暗' },
  { id: 'lighten', label: 'Lighten', desc: '變亮' },
  { id: 'color-dodge', label: 'Color Dodge', desc: '顏色加亮' },
  { id: 'color-burn', label: 'Color Burn', desc: '顏色加深' },
  { id: 'hard-light', label: 'Hard Light', desc: '強光' },
  { id: 'soft-light', label: 'Soft Light', desc: '柔光' },
  { id: 'difference', label: 'Difference', desc: '差異化' },
  { id: 'exclusion', label: 'Exclusion', desc: '排除' },
];

// ============================================================
// 歷史記錄操作描述
// ============================================================

const getActionDescription = (action: HistoryActionType): string => {
  const descriptions: Record<HistoryActionType, string> = {
    init: '初始化畫布',
    add: '新增物件',
    remove: '刪除物件',
    modify: '修改物件',
    style: '變更樣式',
    reorder: '調整圖層順序',
    batch: '批次操作',
  };
  return descriptions[action] || '未知操作';
};

// ============================================================
// Store 實例
// ============================================================

export const useDesignStudioStore = create<DesignStudioState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // Canvas 實例
      canvas: null,
      setCanvas: (canvas) => set({ canvas }),
      
      // 畫布設定
      canvasWidth: 1080,
      canvasHeight: 1080,
      canvasBackgroundColor: '#FFFFFF',
      zoom: 1,
      setCanvasSize: (width, height) => set({ canvasWidth: width, canvasHeight: height }),
      setCanvasBackground: (color) => set({ canvasBackgroundColor: color }),
      setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(5, zoom)) }),
      
      // 選中狀態
      selectedObjectIds: [],
      setSelectedObjects: (ids) => set({ selectedObjectIds: ids }),
      clearSelection: () => set({ selectedObjectIds: [] }),
      
      // 圖層系統
      layers: [],
      addLayer: (layer) => set((state) => ({ 
        layers: [layer, ...state.layers] // 新圖層在最上面
      })),
      removeLayer: (id) => set((state) => ({
        layers: state.layers.filter((l) => l.id !== id)
      })),
      updateLayer: (id, updates) => set((state) => ({
        layers: state.layers.map((l) => 
          l.id === id ? { ...l, ...updates } : l
        )
      })),
      reorderLayers: (startIndex, endIndex) => set((state) => {
        const newLayers = [...state.layers];
        const [removed] = newLayers.splice(startIndex, 1);
        newLayers.splice(endIndex, 0, removed);
        return { layers: newLayers };
      }),
      
      // 活動工具
      activeTool: 'select',
      setActiveTool: (tool) => set({ activeTool: tool }),
      
      // 歷史記錄
      history: [],
      historyIndex: -1,
      isRestoringHistory: false,  // 正在恢復歷史狀態時為 true
      
      // 推送歷史記錄（含防抖動和智能合併）
      pushHistory: (state) => set((prev) => {
        // 如果正在恢復歷史，跳過記錄
        if (prev.isRestoringHistory) {
          console.log('pushHistory: 跳過（正在恢復歷史）');
          return {};
        }
        
        const now = Date.now();
        const action = state.action || 'modify';
        const description = state.description || getActionDescription(action);
        
        const newState: HistoryState = {
          json: state.json,
          timestamp: now,
          action,
          description,
          objectIds: state.objectIds,
        };
        
        // 取得目前索引之前的歷史（丟棄 redo 的部分）
        let newHistory = prev.history.slice(0, prev.historyIndex + 1);
        
        // 智能合併條件（更保守的策略）：
        // 1. 必須是修改操作
        // 2. 必須在 300ms 內
        // 3. 必須是相同的單一物件
        // 4. 上一個操作也是修改
        const lastState = newHistory[newHistory.length - 1];
        const currentIds = state.objectIds || [];
        const lastIds = lastState?.objectIds || [];
        
        const shouldMerge = lastState && 
          action === 'modify' &&                           // 只合併修改操作
          lastState.action === 'modify' &&                 // 上一個也是修改
          (now - lastState.timestamp < 300) &&             // 300ms 內（更短的時間窗口）
          currentIds.length === 1 &&                       // 只有一個物件
          lastIds.length === 1 &&                          // 上次也只有一個物件
          currentIds[0] === lastIds[0];                    // 是同一個物件
        
        if (shouldMerge) {
          // 合併：更新最後一個記錄的 JSON 和時間戳
          newHistory[newHistory.length - 1] = {
            ...lastState,
            json: state.json,
            timestamp: now,
          };
        } else {
          // 新增記錄
          newHistory.push(newState);
        }
        
        // 最多保留 50 個歷史狀態
        if (newHistory.length > 50) {
          newHistory = newHistory.slice(-50);
        }
        
        return { 
          history: newHistory, 
          historyIndex: newHistory.length - 1 
        };
      }),
      
      // 檢查是否可以 Undo
      canUndo: () => {
        const { historyIndex } = get();
        return historyIndex > 0;
      },
      
      // 檢查是否可以 Redo
      canRedo: () => {
        const { history, historyIndex } = get();
        return historyIndex < history.length - 1;
      },
      
      // 取得歷史記錄資訊
      getHistoryInfo: () => {
        const { history, historyIndex } = get();
        return {
          current: historyIndex + 1,
          total: history.length,
          canUndo: historyIndex > 0,
          canRedo: historyIndex < history.length - 1,
        };
      },
      undo: () => {
        const { history, historyIndex, canvas, isRestoringHistory } = get();
        
        // 如果已經在恢復歷史，跳過
        if (isRestoringHistory) {
          console.log('Undo: 跳過（正在恢復中）');
          return;
        }
        
        // 檢查是否可以 undo
        if (historyIndex <= 0) {
          console.log('Undo: 已經是最初狀態', { historyIndex });
          return;
        }
        
        if (!canvas) {
          console.log('Undo: canvas 不存在');
          return;
        }
        
        const prevState = history[historyIndex - 1];
        if (!prevState || !prevState.json) {
          console.log('Undo: 上一個狀態不存在');
          return;
        }
        
        // 設置標記，防止事件觸發新的歷史記錄
        set({ isRestoringHistory: true });
        
        // 更新 index
        const newIndex = historyIndex - 1;
        set({ historyIndex: newIndex });
        
        // 解析 JSON 並載入
        try {
          const jsonData = typeof prevState.json === 'string' 
            ? JSON.parse(prevState.json) 
            : prevState.json;
          
          // 清空畫布再載入（確保完全恢復狀態）
          canvas.clear();
          
          canvas.loadFromJSON(jsonData, () => {
            // 完全重建圖層列表（從畫布物件）
            const objects = canvas.getObjects();
            const newLayers: LayerData[] = [];
            
            // 反向遍歷物件（因為 fabric 的物件順序是從底到頂，但圖層顯示是從頂到底）
            for (let i = objects.length - 1; i >= 0; i--) {
              const obj = objects[i] as ExtendedFabricObject;
              if (obj.isGrid || obj.isGuide) continue; // 跳過網格線和參考線
              
              if (obj.id) {
                newLayers.push({
                  id: obj.id,
                  name: obj.name || `物件 ${obj.id}`,
                  type: obj.type === 'i-text' || obj.type === 'text' ? 'text' 
                    : obj.type === 'image' ? 'image' : 'shape',
                  visible: obj.visible !== false,
                  locked: obj.selectable === false,
                  opacity: obj.opacity || 1,
                  blendMode: (obj.globalCompositeOperation as BlendMode) || 'source-over',
                  fabricObject: obj,
                });
              }
            }
            
            set({ layers: newLayers, selectedObjectIds: [], isRestoringHistory: false });
            canvas.discardActiveObject();
            canvas.renderAll();
            console.log('Undo 完成:', { newIndex, objectCount: objects.length, layerCount: newLayers.length });
          });
        } catch (error) {
          console.error('Undo 錯誤:', error);
          // 恢復 index 和標記
          set({ historyIndex: historyIndex, isRestoringHistory: false });
        }
      },
      redo: () => {
        const { history, historyIndex, canvas, isRestoringHistory } = get();
        
        // 如果已經在恢復歷史，跳過
        if (isRestoringHistory) {
          console.log('Redo: 跳過（正在恢復中）');
          return;
        }
        
        // 檢查是否可以 redo
        if (historyIndex >= history.length - 1) {
          console.log('Redo: 已經是最新狀態', { historyIndex, historyLength: history.length });
          return;
        }
        
        if (!canvas) {
          console.log('Redo: canvas 不存在');
          return;
        }
        
        const nextState = history[historyIndex + 1];
        if (!nextState || !nextState.json) {
          console.log('Redo: 下一個狀態不存在');
          return;
        }
        
        // 設置標記，防止事件觸發新的歷史記錄
        set({ isRestoringHistory: true });
        
        // 更新 index
        const newIndex = historyIndex + 1;
        set({ historyIndex: newIndex });
        
        // 解析 JSON 並載入
        try {
          const jsonData = typeof nextState.json === 'string' 
            ? JSON.parse(nextState.json) 
            : nextState.json;
          
          // 清空畫布再載入（確保完全恢復狀態）
          canvas.clear();
          
          canvas.loadFromJSON(jsonData, () => {
            // 完全重建圖層列表（從畫布物件）
            const objects = canvas.getObjects();
            const newLayers: LayerData[] = [];
            
            // 反向遍歷物件（因為 fabric 的物件順序是從底到頂，但圖層顯示是從頂到底）
            for (let i = objects.length - 1; i >= 0; i--) {
              const obj = objects[i] as ExtendedFabricObject;
              if (obj.isGrid || obj.isGuide) continue; // 跳過網格線和參考線
              
              if (obj.id) {
                newLayers.push({
                  id: obj.id,
                  name: obj.name || `物件 ${obj.id}`,
                  type: obj.type === 'i-text' || obj.type === 'text' ? 'text' 
                    : obj.type === 'image' ? 'image' : 'shape',
                  visible: obj.visible !== false,
                  locked: obj.selectable === false,
                  opacity: obj.opacity || 1,
                  blendMode: (obj.globalCompositeOperation as BlendMode) || 'source-over',
                  fabricObject: obj,
                });
              }
            }
            
            set({ layers: newLayers, selectedObjectIds: [], isRestoringHistory: false });
            canvas.discardActiveObject();
            canvas.renderAll();
            console.log('Redo 完成:', { newIndex, objectCount: objects.length, layerCount: newLayers.length });
          });
        } catch (error) {
          console.error('Redo 錯誤:', error);
          // 恢復 index 和標記
          set({ historyIndex: historyIndex, isRestoringHistory: false });
        }
      },
      
      // 模板操作
      templateName: '未命名設計',
      setTemplateName: (name) => set({ templateName: name }),
      
      exportToSchema: () => {
        const { canvas, layers, canvasWidth, canvasHeight, canvasBackgroundColor, templateName } = get();
        if (!canvas) return null;
        
        const layerSchemas: LayerSchemaItem[] = layers.map((layer) => {
          const obj = layer.fabricObject;
          return {
            id: layer.id,
            type: layer.type,
            name: layer.name,
            visible: layer.visible,
            locked: layer.locked,
            opacity: layer.opacity,
            blendMode: layer.blendMode,
            transform: {
              x: obj?.left || 0,
              y: obj?.top || 0,
              scaleX: obj?.scaleX || 1,
              scaleY: obj?.scaleY || 1,
              angle: obj?.angle || 0,
            },
            style: obj?.toObject() || {},
            content: (obj as ExtendedFabricObject)?.text || (obj as ExtendedFabricObject)?.src || null,
          };
        });
        
        return {
          version: '1.0.0',
          canvas: {
            width: canvasWidth,
            height: canvasHeight,
            backgroundColor: canvasBackgroundColor,
          },
          layers: layerSchemas,
          metadata: {
            name: templateName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        };
      },
      
      importFromSchema: (schema) => {
        const { canvas, addLayer } = get();
        if (!canvas) return;
        
        // 更新畫布設定
        set({
          canvasWidth: schema.canvas.width,
          canvasHeight: schema.canvas.height,
          canvasBackgroundColor: schema.canvas.backgroundColor,
          templateName: schema.metadata.name,
          layers: [], // 清空現有圖層
        });
        
        // 更新畫布尺寸和背景
        canvas.setWidth(schema.canvas.width);
        canvas.setHeight(schema.canvas.height);
        canvas.setBackgroundColor(schema.canvas.backgroundColor, () => {});
        
        // 清除現有物件（保留網格和參考線）
        const objectsToRemove = canvas.getObjects().filter((obj) => {
          const extObj = obj as ExtendedFabricObject;
          return !extObj.isGrid && !extObj.isGuide;
        });
        objectsToRemove.forEach(obj => canvas.remove(obj));
        
        // 從 schema 重建圖層和物件
        schema.layers.forEach((layerSchema) => {
          const { fabric } = require('fabric');
          
          // 根據類型創建物件
          if (layerSchema.type === 'text' && layerSchema.content) {
            const text = new fabric.IText(layerSchema.content, {
              left: layerSchema.transform.x,
              top: layerSchema.transform.y,
              scaleX: layerSchema.transform.scaleX,
              scaleY: layerSchema.transform.scaleY,
              angle: layerSchema.transform.angle,
              opacity: layerSchema.opacity,
              visible: layerSchema.visible,
              selectable: !layerSchema.locked,
              evented: !layerSchema.locked,
              ...layerSchema.style,
            });
            (text as ExtendedFabricObject).id = layerSchema.id;
            (text as ExtendedFabricObject).name = layerSchema.name;
            canvas.add(text);
            
            addLayer({
              id: layerSchema.id,
              name: layerSchema.name,
              type: layerSchema.type,
              visible: layerSchema.visible,
              locked: layerSchema.locked,
              opacity: layerSchema.opacity,
              blendMode: layerSchema.blendMode,
              fabricObject: text,
            });
          } else if (layerSchema.type === 'image' && layerSchema.content) {
            fabric.Image.fromURL(layerSchema.content, (img: FabricImage) => {
              img.set({
                left: layerSchema.transform.x,
                top: layerSchema.transform.y,
                scaleX: layerSchema.transform.scaleX,
                scaleY: layerSchema.transform.scaleY,
                angle: layerSchema.transform.angle,
                opacity: layerSchema.opacity,
                visible: layerSchema.visible,
                selectable: !layerSchema.locked,
                evented: !layerSchema.locked,
              });
              (img as ExtendedFabricObject).id = layerSchema.id;
              (img as ExtendedFabricObject).name = layerSchema.name;
              canvas.add(img);
              canvas.renderAll();
              
              addLayer({
                id: layerSchema.id,
                name: layerSchema.name,
                type: layerSchema.type,
                visible: layerSchema.visible,
                locked: layerSchema.locked,
                opacity: layerSchema.opacity,
                blendMode: layerSchema.blendMode,
                fabricObject: img,
              });
            }, { crossOrigin: 'anonymous' });
          } else if (layerSchema.type === 'shape') {
            // 從 style 物件重建形狀
            const styleObj = layerSchema.style;
            if (styleObj && styleObj.type) {
              fabric.util.enlivenObjects([styleObj], (objects: FabricObject[]) => {
                if (objects.length > 0) {
                  const shape = objects[0] as ExtendedFabricObject;
                  shape.set({
                    left: layerSchema.transform.x,
                    top: layerSchema.transform.y,
                    scaleX: layerSchema.transform.scaleX,
                    scaleY: layerSchema.transform.scaleY,
                    angle: layerSchema.transform.angle,
                    opacity: layerSchema.opacity,
                    visible: layerSchema.visible,
                    selectable: !layerSchema.locked,
                    evented: !layerSchema.locked,
                  });
                  shape.id = layerSchema.id;
                  shape.name = layerSchema.name;
                  canvas.add(shape);
                  canvas.renderAll();
                  
                  addLayer({
                    id: layerSchema.id,
                    name: layerSchema.name,
                    type: layerSchema.type,
                    visible: layerSchema.visible,
                    locked: layerSchema.locked,
                    opacity: layerSchema.opacity,
                    blendMode: layerSchema.blendMode,
                    fabricObject: shape,
                  });
                }
              }, '');
            }
          }
        });
        
        canvas.renderAll();
      },
      
      // UI 狀態
      showGrid: false,
      showRulers: true,
      snapToGrid: false,
      gridSize: 20,
      toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
      toggleRulers: () => set((state) => ({ showRulers: !state.showRulers })),
      toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),
      setGridSize: (size) => set({ gridSize: size }),
      
      // 側邊面板
      leftPanelOpen: true,
      rightPanelOpen: true,
      toggleLeftPanel: () => set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),
      toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
      setLeftPanelOpen: (open) => set({ leftPanelOpen: open }),
      setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
    })),
    { name: 'design-studio-store' }
  )
);
