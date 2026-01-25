/**
 * Fabric.js Helper Functions
 * 提供常用的 Fabric.js 操作封裝
 */

import { fabric } from 'fabric';
import type { Canvas as FabricCanvas, Object as FabricObject } from 'fabric';

/**
 * 創建帶有唯一 ID 的 Fabric 物件
 */
export function createFabricObject<T extends FabricObject>(
  obj: T,
  id: string,
  name: string
): T {
  (obj as any).id = id;
  (obj as any).name = name;
  return obj;
}

/**
 * 將 Fabric 物件居中於畫布
 */
export function centerObject(canvas: FabricCanvas, obj: FabricObject): void {
  obj.set({
    left: canvas.getWidth() / 2,
    top: canvas.getHeight() / 2,
    originX: 'center',
    originY: 'center',
  });
  canvas.renderAll();
}

/**
 * 複製選中的物件
 */
export async function cloneSelectedObjects(canvas: FabricCanvas): Promise<FabricObject[]> {
  const activeObjects = canvas.getActiveObjects();
  const clonedObjects: FabricObject[] = [];

  for (const obj of activeObjects) {
    const cloned = await new Promise<FabricObject>((resolve) => {
      obj.clone((clonedObj: FabricObject) => {
        clonedObj.set({
          left: (obj.left || 0) + 20,
          top: (obj.top || 0) + 20,
        });
        resolve(clonedObj);
      });
    });
    clonedObjects.push(cloned);
    canvas.add(cloned);
  }

  canvas.renderAll();
  return clonedObjects;
}

/**
 * 對齊物件
 */
export function alignObjects(
  canvas: FabricCanvas,
  alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
): void {
  const activeObject = canvas.getActiveObject();
  if (!activeObject) return;

  const canvasWidth = canvas.getWidth();
  const canvasHeight = canvas.getHeight();
  const objWidth = (activeObject.width || 0) * (activeObject.scaleX || 1);
  const objHeight = (activeObject.height || 0) * (activeObject.scaleY || 1);

  switch (alignment) {
    case 'left':
      activeObject.set({ left: objWidth / 2 });
      break;
    case 'center':
      activeObject.set({ left: canvasWidth / 2 });
      break;
    case 'right':
      activeObject.set({ left: canvasWidth - objWidth / 2 });
      break;
    case 'top':
      activeObject.set({ top: objHeight / 2 });
      break;
    case 'middle':
      activeObject.set({ top: canvasHeight / 2 });
      break;
    case 'bottom':
      activeObject.set({ top: canvasHeight - objHeight / 2 });
      break;
  }

  canvas.renderAll();
}

/**
 * 獲取物件的邊界框
 */
export function getBoundingBox(obj: FabricObject): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  const bounds = obj.getBoundingRect();
  return {
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
  };
}

/**
 * 應用混合模式到物件
 */
export function applyBlendMode(
  obj: FabricObject,
  blendMode: GlobalCompositeOperation
): void {
  (obj as any).globalCompositeOperation = blendMode;
}

/**
 * 創建漸層填充
 */
export function createGradient(
  type: 'linear' | 'radial',
  colors: string[],
  direction: 'horizontal' | 'vertical' | 'diagonal' = 'vertical'
): fabric.Gradient {
  const coords =
    direction === 'horizontal'
      ? { x1: 0, y1: 0.5, x2: 1, y2: 0.5 }
      : direction === 'vertical'
      ? { x1: 0.5, y1: 0, x2: 0.5, y2: 1 }
      : { x1: 0, y1: 0, x2: 1, y2: 1 };

  const colorStops = colors.map((color, index) => ({
    offset: index / (colors.length - 1),
    color,
  }));

  return new fabric.Gradient({
    type,
    coords,
    colorStops,
  });
}

/**
 * 創建陰影效果
 */
export function createShadow(options: {
  color?: string;
  blur?: number;
  offsetX?: number;
  offsetY?: number;
}): fabric.Shadow {
  return new fabric.Shadow({
    color: options.color || 'rgba(0, 0, 0, 0.5)',
    blur: options.blur || 10,
    offsetX: options.offsetX || 5,
    offsetY: options.offsetY || 5,
  });
}

/**
 * 將畫布轉換為 Data URL
 */
export function canvasToDataURL(
  canvas: FabricCanvas,
  options?: {
    format?: 'png' | 'jpeg';
    quality?: number;
    multiplier?: number;
  }
): string {
  return canvas.toDataURL({
    format: options?.format || 'png',
    quality: options?.quality || 1,
    multiplier: options?.multiplier || 1,
  });
}

/**
 * 從 Data URL 載入圖片到畫布
 */
export function loadImageFromURL(
  canvas: FabricCanvas,
  url: string,
  options?: Partial<fabric.Image>
): Promise<fabric.Image> {
  return new Promise((resolve, reject) => {
    fabric.Image.fromURL(
      url,
      (img) => {
        if (!img) {
          reject(new Error('Failed to load image'));
          return;
        }
        if (options) {
          img.set(options);
        }
        canvas.add(img);
        canvas.renderAll();
        resolve(img);
      },
      { crossOrigin: 'anonymous' }
    );
  });
}

/**
 * 群組選中的物件
 */
export function groupSelectedObjects(canvas: FabricCanvas): fabric.Group | null {
  const activeSelection = canvas.getActiveObject();
  if (!activeSelection || activeSelection.type !== 'activeSelection') {
    return null;
  }

  const group = (activeSelection as fabric.ActiveSelection).toGroup();
  canvas.renderAll();
  return group;
}

/**
 * 解散群組
 */
export function ungroupObject(canvas: FabricCanvas, group: fabric.Group): FabricObject[] {
  const objects = group.getObjects();
  group.destroy();
  canvas.remove(group);
  
  objects.forEach((obj) => {
    canvas.add(obj);
  });
  
  canvas.renderAll();
  return objects;
}

/**
 * 鎖定/解鎖物件
 */
export function toggleObjectLock(obj: FabricObject, locked: boolean): void {
  obj.set({
    selectable: !locked,
    evented: !locked,
    hasControls: !locked,
    hasBorders: !locked,
  });
}

/**
 * 顯示/隱藏物件
 */
export function toggleObjectVisibility(
  canvas: FabricCanvas,
  obj: FabricObject,
  visible: boolean
): void {
  obj.set({ visible });
  canvas.renderAll();
}
