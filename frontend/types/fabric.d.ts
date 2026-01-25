/**
 * Fabric.js 類型宣告
 * 提供基本的類型支援
 */

declare module 'fabric' {
  // 頂層類型導出（供 import type { Canvas } from 'fabric' 使用）
  export type Canvas = fabric.Canvas;
  export type Object = fabric.Object;
  export type IText = fabric.IText;
  export type Text = fabric.Text;
  export type Image = fabric.Image;
  export type Rect = fabric.Rect;
  export type Circle = fabric.Circle;
  export type Triangle = fabric.Triangle;
  export type Line = fabric.Line;
  export type Path = fabric.Path;
  export type Polygon = fabric.Polygon;
  export type ActiveSelection = fabric.ActiveSelection;
  export type Group = fabric.Group;
  export type Shadow = fabric.Shadow;
  export type Control = fabric.Control;
  
  // 導出 fabric 命名空間
  export namespace fabric {
    // 基礎 Canvas
    class Canvas {
      constructor(element: HTMLCanvasElement | string | null, options?: ICanvasOptions);
      add(...objects: Object[]): Canvas;
      remove(...objects: Object[]): Canvas;
      clear(): Canvas;
      renderAll(): Canvas;
      requestRenderAll(): Canvas;
      setWidth(value: number): Canvas;
      setHeight(value: number): Canvas;
      getWidth(): number;
      getHeight(): number;
      getElement(): HTMLCanvasElement;
      setBackgroundColor(color: string | null, callback?: () => void): Canvas;
      getObjects(type?: string): Object[];
      getActiveObject(): Object | null;
      getActiveObjects(): Object[];
      setActiveObject(object: Object): Canvas;
      discardActiveObject(): Canvas;
      sendToBack(...objects: Object[]): Canvas;
      bringToFront(object: Object): Canvas;
      bringForward(object: Object, intersecting?: boolean): Canvas;
      sendBackwards(object: Object, intersecting?: boolean): Canvas;
      moveTo(object: Object, index: number): Canvas;
      toDataURL(options?: IDataURLOptions): string;
      toSVG(options?: ISVGOptions, reviver?: Function): string;
      toJSON(propertiesToInclude?: string[]): Record<string, unknown>;
      loadFromJSON(json: Record<string, unknown> | string, callback?: () => void, reviver?: Function): Canvas;
      on(event: string, handler: Function): Canvas;
      off(event: string, handler?: Function): Canvas;
      dispose(): void;
      backgroundColor?: string | null;
      width?: number;
      height?: number;
    }
    
    interface ISVGOptions {
      suppressPreamble?: boolean;
      viewBox?: { x: number; y: number; width: number; height: number };
      encoding?: string;
      width?: string;
      height?: string;
    }
    
    interface ICanvasOptions {
      width?: number;
      height?: number;
      backgroundColor?: string;
      selection?: boolean;
      preserveObjectStacking?: boolean;
      [key: string]: unknown;
    }
    
    interface IDataURLOptions {
      format?: string;
      quality?: number;
      multiplier?: number;
    }
    
    // Control
    class Control {
      constructor(options?: IControlOptions);
    }
    
    interface IControlOptions {
      x?: number;
      y?: number;
      offsetX?: number;
      offsetY?: number;
      actionHandler?: Function;
      actionName?: string;
      render?: Function;
      cursorStyle?: string;
      [key: string]: unknown;
    }
    
    namespace controlsUtils {
      function renderCircleControl(ctx: CanvasRenderingContext2D, left: number, top: number, styleOverride: Record<string, unknown>, fabricObject: Object): void;
      function rotationWithSnapping(eventData: unknown, transform: unknown, x: number, y: number): boolean;
    }
    
    // 基礎 Object
    class Object {
      constructor(options?: IObjectOptions);
      set(key: string | Record<string, unknown>, value?: unknown): Object;
      get(property: string): unknown;
      setCoords(): Object;
      clone(callback: (clone: Object) => void, propertiesToInclude?: string[]): void;
      toObject(propertiesToInclude?: string[]): Record<string, unknown>;
      toDataURL(options?: IDataURLOptions): string;
      sendBackwards(intersecting?: boolean): Object;
      bringForward(intersecting?: boolean): Object;
      getBoundingRect(absolute?: boolean, calculate?: boolean): { left: number; top: number; width: number; height: number };
      on(event: string, handler: Function): Object;
      off(event: string, handler?: Function): Object;
      
      static prototype: {
        controls?: Record<string, Control>;
        [key: string]: unknown;
      };
      
      // 常用屬性
      left?: number;
      top?: number;
      width?: number;
      height?: number;
      scaleX?: number;
      scaleY?: number;
      angle?: number;
      opacity?: number;
      fill?: string | null;
      stroke?: string | null;
      strokeWidth?: number;
      visible?: boolean;
      selectable?: boolean;
      evented?: boolean;
      flipX?: boolean;
      flipY?: boolean;
      originX?: string;
      originY?: string;
      shadow?: Shadow | null;
      type?: string;
      globalCompositeOperation?: string;
      excludeFromExport?: boolean;
      controls?: Record<string, Control>;
      [key: string]: unknown;
    }
    
    interface IObjectOptions {
      left?: number;
      top?: number;
      width?: number;
      height?: number;
      scaleX?: number;
      scaleY?: number;
      angle?: number;
      opacity?: number;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      visible?: boolean;
      selectable?: boolean;
      evented?: boolean;
      originX?: string;
      originY?: string;
      [key: string]: unknown;
    }
    
    // IText
    class IText extends Object {
      constructor(text: string, options?: ITextOptions);
      text?: string;
      fontFamily?: string;
      fontSize?: number;
      fontWeight?: string | number;
      fontStyle?: string;
      textAlign?: string;
      underline?: boolean;
      lineHeight?: number;
      charSpacing?: number;
      isEditing?: boolean;
      enterEditing(): IText;
      exitEditing(): IText;
    }
    
    interface ITextOptions extends IObjectOptions {
      text?: string;
      fontFamily?: string;
      fontSize?: number;
      fontWeight?: string | number;
      fontStyle?: string;
      textAlign?: string;
      underline?: boolean;
      lineHeight?: number;
      charSpacing?: number;
    }
    
    // Text
    class Text extends IText {
      constructor(text: string, options?: ITextOptions);
    }
    
    // Image
    class Image extends Object {
      constructor(element: HTMLImageElement | HTMLCanvasElement, options?: IImageOptions);
      static fromURL(url: string, callback: (image: Image) => void, options?: IImageOptions): void;
      setSrc(src: string, callback?: (image: Image) => void, options?: IImageOptions): Image;
      getSrc(): string;
      getElement(): HTMLImageElement;
      toDataURL(options?: IDataURLOptions): string;
      _element?: HTMLImageElement;
      filters?: ImageFilter[];
      applyFilters(): Image;
    }
    
    interface IImageOptions extends IObjectOptions {
      crossOrigin?: string;
    }
    
    // Image Filters
    interface ImageFilter {
      applyTo(canvasEl: HTMLCanvasElement): void;
    }
    
    // Rect
    class Rect extends Object {
      constructor(options?: IRectOptions);
      rx?: number;
      ry?: number;
    }
    
    interface IRectOptions extends IObjectOptions {
      rx?: number;
      ry?: number;
    }
    
    // Circle
    class Circle extends Object {
      constructor(options?: ICircleOptions);
      radius?: number;
    }
    
    interface ICircleOptions extends IObjectOptions {
      radius?: number;
    }
    
    // Triangle
    class Triangle extends Object {
      constructor(options?: IObjectOptions);
    }
    
    // Line
    class Line extends Object {
      constructor(points?: number[], options?: ILineOptions);
    }
    
    interface ILineOptions extends IObjectOptions {
      x1?: number;
      y1?: number;
      x2?: number;
      y2?: number;
    }
    
    // Path
    class Path extends Object {
      constructor(path?: string | unknown[], options?: IObjectOptions);
    }
    
    // Polygon
    class Polygon extends Object {
      constructor(points?: { x: number; y: number }[], options?: IObjectOptions);
    }
    
    // ActiveSelection
    class ActiveSelection extends Object {
      constructor(objects?: Object[], options?: IObjectOptions);
      toGroup(): Group;
      getObjects(): Object[];
    }
    
    // Group
    class Group extends Object {
      constructor(objects?: Object[], options?: IObjectOptions);
      getObjects(): Object[];
      addWithUpdate(object: Object): Group;
      removeWithUpdate(object: Object): Group;
      destroy(): void;
      toActiveSelection(): ActiveSelection;
    }
    
    // Shadow
    class Shadow {
      constructor(options?: IShadowOptions);
      color?: string;
      blur?: number;
      offsetX?: number;
      offsetY?: number;
    }
    
    interface IShadowOptions {
      color?: string;
      blur?: number;
      offsetX?: number;
      offsetY?: number;
    }
    
    // Gradient
    class Gradient {
      constructor(options?: IGradientOptions);
      type?: string;
      coords?: { x1?: number; y1?: number; x2?: number; y2?: number; r1?: number; r2?: number };
      colorStops?: Array<{ offset: number; color: string }>;
      toObject(): Record<string, unknown>;
    }
    
    interface IGradientOptions {
      type?: 'linear' | 'radial';
      coords?: { x1?: number; y1?: number; x2?: number; y2?: number; r1?: number; r2?: number };
      colorStops?: Array<{ offset: number; color: string }>;
    }
    
    // Util
    namespace util {
      function enlivenObjects(objects: unknown[], callback: (objects: Object[]) => void, namespace?: string): void;
      function loadImage(url: string, callback: (img: HTMLImageElement) => void, context?: unknown, crossOrigin?: string): void;
    }
    
    // Filters namespace
    namespace Image {
      namespace filters {
        class BaseFilter implements ImageFilter {
          applyTo(canvasEl: HTMLCanvasElement): void;
        }
        class Brightness extends BaseFilter {
          constructor(options?: { brightness?: number });
          brightness?: number;
        }
        class Contrast extends BaseFilter {
          constructor(options?: { contrast?: number });
          contrast?: number;
        }
        class Saturation extends BaseFilter {
          constructor(options?: { saturation?: number });
          saturation?: number;
        }
        class Blur extends BaseFilter {
          constructor(options?: { blur?: number });
          blur?: number;
        }
        class Grayscale extends BaseFilter {
          constructor(options?: { mode?: string });
        }
        class Invert extends BaseFilter {}
        class Sepia extends BaseFilter {}
        class Noise extends BaseFilter {
          constructor(options?: { noise?: number });
          noise?: number;
        }
        class Pixelate extends BaseFilter {
          constructor(options?: { blocksize?: number });
          blocksize?: number;
        }
      }
    }
  }
}

// 全域 fabric 命名空間（用於 `fabric.Object` 等引用）
declare namespace fabric {
  export class Canvas extends import('fabric').fabric.Canvas {}
  export class Object extends import('fabric').fabric.Object {}
  export class IText extends import('fabric').fabric.IText {}
  export class Text extends import('fabric').fabric.Text {}
  export class Image extends import('fabric').fabric.Image {}
  export class Rect extends import('fabric').fabric.Rect {}
  export class Circle extends import('fabric').fabric.Circle {}
  export class Triangle extends import('fabric').fabric.Triangle {}
  export class Line extends import('fabric').fabric.Line {}
  export class Path extends import('fabric').fabric.Path {}
  export class Polygon extends import('fabric').fabric.Polygon {}
  export class ActiveSelection extends import('fabric').fabric.ActiveSelection {}
  export class Group extends import('fabric').fabric.Group {}
  export class Shadow extends import('fabric').fabric.Shadow {}
  export class Control extends import('fabric').fabric.Control {}
  export class Gradient extends import('fabric').fabric.Gradient {}
  export type ICanvasOptions = import('fabric').fabric.ICanvasOptions;
  export type IObjectOptions = import('fabric').fabric.IObjectOptions;
  export type ITextOptions = import('fabric').fabric.ITextOptions;
  export type IImageOptions = import('fabric').fabric.IImageOptions;
  export type IRectOptions = import('fabric').fabric.IRectOptions;
  export type ICircleOptions = import('fabric').fabric.ICircleOptions;
  export type ILineOptions = import('fabric').fabric.ILineOptions;
  export type IShadowOptions = import('fabric').fabric.IShadowOptions;
  export type IControlOptions = import('fabric').fabric.IControlOptions;
  export namespace util {
    export const enlivenObjects: typeof import('fabric').fabric.util.enlivenObjects;
    export const loadImage: typeof import('fabric').fabric.util.loadImage;
  }
  export namespace controlsUtils {
    export const renderCircleControl: typeof import('fabric').fabric.controlsUtils.renderCircleControl;
    export const rotationWithSnapping: typeof import('fabric').fabric.controlsUtils.rotationWithSnapping;
  }
}
