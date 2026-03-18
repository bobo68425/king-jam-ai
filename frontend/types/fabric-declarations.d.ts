import { Canvas as FabricCanvas, Object as FabricObject } from 'fabric';

declare module 'fabric' {
  namespace fabric {
    class Ellipse extends FabricObject {
      constructor(options?: any);
    }
  }

  interface Canvas {
    setViewportTransform(transform: number[]): void;
    fire(eventName: string, eventObj?: any): this;
  }

  interface Object {
    getCenterPoint(): { x: number; y: number };
    get(property: string): any;
  }
}
