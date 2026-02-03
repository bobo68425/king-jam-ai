"use client";
// @ts-nocheck
// TODO: Fix Fabric.js type issues in this file

/**
 * Canvas Stage - Fabric.js 畫布核心組件
 * 處理畫布初始化、事件綁定、響應式調整
 * 
 * 改進：
 * - 整合浮動工具列
 * - 整合右鍵選單
 * - 優化縮放控制 UI
 */

import React, { useRef, useEffect, useCallback, useState } from "react";
import { fabric } from "fabric";
import { useDesignStudioStore, ExtendedFabricObject } from "@/stores/design-studio-store";
import { autosaveService } from "@/lib/services/autosave-service";
import { toast } from "sonner";

// Fabric 事件類型
interface FabricTransformEvent {
  transform?: {
    target?: fabric.Object;
    action?: string;
  };
}

interface FabricObjectEvent {
  target?: ExtendedFabricObject;
}
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Minus, Plus, Maximize, Square, ZoomIn, RotateCcw } from "lucide-react";
import FloatingToolbar from "../panels/FloatingToolbar";
import ContextMenu from "../panels/ContextMenu";

interface CanvasStageProps {
  className?: string;
}

export default function CanvasStage({ className }: CanvasStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const {
    canvas,
    setCanvas,
    canvasWidth,
    canvasHeight,
    canvasBackgroundColor,
    zoom,
    setZoom,
    showGrid,
    gridSize,
    setSelectedObjects,
    addLayer,
    updateLayer,
    removeLayer,
    layers,
    pushHistory,
  } = useDesignStudioStore();

  // 初始化 Fabric.js Canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const fabricCanvas = new fabric.Canvas(canvasRef.current, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: canvasBackgroundColor,
      preserveObjectStacking: true, // 保持物件層級
      selection: true,
      selectionColor: "rgba(99, 102, 241, 0.3)",
      selectionBorderColor: "#6366F1",
      selectionLineWidth: 2,
      centeredScaling: false,
      centeredRotation: true,
      uniformScaling: false, // 預設自由縮放
    });

    // 自訂控制點樣式 - 更精緻的外觀
    fabric.Object.prototype.set({
      borderColor: "#6366F1",
      cornerColor: "#FFFFFF",
      cornerStrokeColor: "#6366F1",
      cornerStyle: "circle",
      cornerSize: 12,
      transparentCorners: false,
      borderScaleFactor: 1.5,
      padding: 8,
      borderDashArray: [5, 5],
    });

    // 自訂旋轉控制點
    if (fabric.Object.prototype.controls) {
      fabric.Object.prototype.controls.mtr = new fabric.Control({
      x: 0,
      y: -0.5,
      offsetY: -40,
      cursorStyle: 'crosshair',
      actionHandler: fabric.controlsUtils.rotationWithSnapping,
      actionName: 'rotate',
      render: (ctx: CanvasRenderingContext2D, left: number, top: number, styleOverride: object, fabricObject: fabric.Object) => {
        const size = 24;
        ctx.save();
        ctx.translate(left, top);
        
        // 繪製連接線
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 30);
        ctx.strokeStyle = '#6366F1';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 繪製圓形旋轉手柄
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, 2 * Math.PI);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#6366F1';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 繪製旋轉圖示
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, 1.5 * Math.PI);
        ctx.strokeStyle = '#6366F1';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 箭頭
        ctx.beginPath();
        ctx.moveTo(-6, -2);
        ctx.lineTo(-6, -8);
        ctx.lineTo(-1, -6);
        ctx.fillStyle = '#6366F1';
        ctx.fill();
        
        ctx.restore();
      },
      cornerSize: 24,
    });
    }

    // ========================================
    // 縮放快捷鍵控制：
    // - Shift = 等比例縮放（保持比例，固定對角）
    // - Option/Alt = 從中心點縮放
    // - Shift + Option/Alt = 從中心等比例縮放
    // ========================================
    
    // 追蹤按鍵狀態
    let isShiftPressed = false;
    let isAltPressed = false;
    
    // 縮放開始時的原始狀態
    let scalingStartState: {
      scaleX: number;
      scaleY: number;
      left: number;
      top: number;
      width: number;
      height: number;
      originX: string;
      originY: string;
      aspectRatio: number;
    } | null = null;

    // 監聽鍵盤事件
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果正在輸入文字，不處理快捷鍵
      const activeElement = document.activeElement;
      const isTyping = activeElement?.tagName === 'INPUT' || 
                       activeElement?.tagName === 'TEXTAREA' ||
                       (activeElement as HTMLElement)?.contentEditable === 'true';
      
      // Shift 鍵
      if (e.key === 'Shift' && !isShiftPressed) {
        isShiftPressed = true;
      }
      // Alt/Option 鍵
      if (e.key === 'Alt' && !isAltPressed) {
        isAltPressed = true;
      }
      
      // 如果正在輸入，只處理 Shift/Alt 鍵
      if (isTyping) return;
      
      const activeObject = fabricCanvas.getActiveObject();
      
      // ========== Undo/Redo 快捷鍵 ==========
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useDesignStudioStore.getState().undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        useDesignStudioStore.getState().redo();
        return;
      }
      
      // ========== 刪除物件 ==========
      if ((e.key === 'Delete' || e.key === 'Backspace') && activeObject) {
        e.preventDefault();
        // 如果是文字編輯模式，不刪除物件
        if ((activeObject as fabric.IText).isEditing) return;
        
        fabricCanvas.remove(activeObject);
        fabricCanvas.discardActiveObject();
        fabricCanvas.renderAll();
        return;
      }
      
      // ========== 取消選取 ==========
      if (e.key === 'Escape') {
        e.preventDefault();
        fabricCanvas.discardActiveObject();
        fabricCanvas.renderAll();
        return;
      }
      
      // ========== 全選 ==========
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        const objects = fabricCanvas.getObjects().filter((obj) => !(obj as ExtendedFabricObject).isGrid);
        if (objects.length > 0) {
          const selection = new fabric.ActiveSelection(objects, { canvas: fabricCanvas });
          fabricCanvas.setActiveObject(selection);
          fabricCanvas.renderAll();
        }
        return;
      }
      
      // ========== 複製物件 ==========
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && activeObject) {
        e.preventDefault();
        activeObject.clone((cloned: fabric.Object) => {
          cloned.set({
            left: (cloned.left || 0) + 20,
            top: (cloned.top || 0) + 20,
          });
          fabricCanvas.add(cloned);
          fabricCanvas.setActiveObject(cloned);
          fabricCanvas.renderAll();
        });
        return;
      }
      
      // ========== 圖片去背快捷鍵 (Cmd/Ctrl + B) ==========
      if ((e.ctrlKey || e.metaKey) && e.key === 'b' && activeObject) {
        e.preventDefault();
        // 發送自定義事件觸發去背功能
        window.dispatchEvent(new CustomEvent('triggerRemoveBackground'));
        return;
      }
      
      // ========== 方向鍵微調位置 ==========
      if (activeObject && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1; // Shift 按住時移動 10px
        
        switch (e.key) {
          case 'ArrowUp':
            activeObject.set('top', (activeObject.top || 0) - step);
            break;
          case 'ArrowDown':
            activeObject.set('top', (activeObject.top || 0) + step);
            break;
          case 'ArrowLeft':
            activeObject.set('left', (activeObject.left || 0) - step);
            break;
          case 'ArrowRight':
            activeObject.set('left', (activeObject.left || 0) + step);
            break;
        }
        
        activeObject.setCoords();
        fabricCanvas.renderAll();
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftPressed = false;
      }
      if (e.key === 'Alt') {
        isAltPressed = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // 縮放開始時記錄原始狀態
    fabricCanvas.on('before:transform', (e: FabricTransformEvent) => {
      const target = e.transform?.target;
      if (target && e.transform?.action === 'scale') {
        scalingStartState = {
          scaleX: target.scaleX || 1,
          scaleY: target.scaleY || 1,
          left: target.left || 0,
          top: target.top || 0,
          width: target.width || 0,
          height: target.height || 0,
          originX: target.originX || 'left',
          originY: target.originY || 'top',
          aspectRatio: ((target.width || 1) * (target.scaleX || 1)) / ((target.height || 1) * (target.scaleY || 1)),
        };
      }
    });

    // 縮放過程中處理等比例和中心縮放
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fabricCanvas.on('object:scaling', (e: any) => {
      const target = e.target;
      if (!target || !scalingStartState) return;
      
      const corner = (target as fabric.Object & { __corner?: string }).__corner;
      const isCorner = corner === 'tl' || corner === 'tr' || corner === 'bl' || corner === 'br';
      
      // ========== Shift：等比例縮放 ==========
      if (isShiftPressed && isCorner) {
        const currentScaleX = target.scaleX || 1;
        const currentScaleY = target.scaleY || 1;
        
        // 計算原始寬高比
        const originalWidth = scalingStartState.width * scalingStartState.scaleX;
        const originalHeight = scalingStartState.height * scalingStartState.scaleY;
        const aspectRatio = originalWidth / originalHeight;
        
        // 決定主要縮放方向（基於哪個縮放變化更大）
        const scaleChangeX = Math.abs(currentScaleX - scalingStartState.scaleX);
        const scaleChangeY = Math.abs(currentScaleY - scalingStartState.scaleY);
        
        let newScaleX: number;
        let newScaleY: number;
        
        if (scaleChangeX >= scaleChangeY) {
          // 以 X 軸為主
          newScaleX = currentScaleX;
          newScaleY = (target.width * currentScaleX) / (target.height * aspectRatio);
        } else {
          // 以 Y 軸為主
          newScaleY = currentScaleY;
          newScaleX = (target.height * currentScaleY * aspectRatio) / target.width;
        }
        
        // 計算需要調整的位置（保持對角固定）
        if (!isAltPressed) {
          const oldWidth = target.width * target.scaleX;
          const oldHeight = target.height * target.scaleY;
          const newWidth = target.width * newScaleX;
          const newHeight = target.height * newScaleY;
          
          let left = target.left || 0;
          let top = target.top || 0;
          
          // 根據拖曳的角落調整位置
          if (corner === 'tl') {
            left = left + (oldWidth - newWidth);
            top = top + (oldHeight - newHeight);
          } else if (corner === 'tr') {
            top = top + (oldHeight - newHeight);
          } else if (corner === 'bl') {
            left = left + (oldWidth - newWidth);
          }
          // br 不需要調整位置
          
          target.set({
            scaleX: newScaleX,
            scaleY: newScaleY,
            left: left,
            top: top,
          });
        } else {
          // Alt 按住時從中心縮放
          target.set({
            scaleX: newScaleX,
            scaleY: newScaleY,
          });
        }
      }
      
      // ========== Alt/Option：從中心縮放 ==========
      if (isAltPressed && !isShiftPressed) {
        // Fabric.js 預設不支援中心縮放，需要手動計算
        const currentScaleX = target.scaleX || 1;
        const currentScaleY = target.scaleY || 1;
        
        // 計算中心點
        const centerX = scalingStartState.left + (scalingStartState.width * scalingStartState.scaleX) / 2;
        const centerY = scalingStartState.top + (scalingStartState.height * scalingStartState.scaleY) / 2;
        
        // 計算新的位置（保持中心點不變）
        const newWidth = target.width * currentScaleX;
        const newHeight = target.height * currentScaleY;
        
        target.set({
          left: centerX - newWidth / 2,
          top: centerY - newHeight / 2,
        });
      }
      
      // ========== Shift + Alt：從中心等比例縮放 ==========
      if (isShiftPressed && isAltPressed && isCorner) {
        const currentScaleX = target.scaleX || 1;
        const currentScaleY = target.scaleY || 1;
        
        const originalWidth = scalingStartState.width * scalingStartState.scaleX;
        const originalHeight = scalingStartState.height * scalingStartState.scaleY;
        const aspectRatio = originalWidth / originalHeight;
        
        const scaleChangeX = Math.abs(currentScaleX - scalingStartState.scaleX);
        const scaleChangeY = Math.abs(currentScaleY - scalingStartState.scaleY);
        
        let newScaleX: number;
        let newScaleY: number;
        
        if (scaleChangeX >= scaleChangeY) {
          newScaleX = currentScaleX;
          newScaleY = (target.width * currentScaleX) / (target.height * aspectRatio);
        } else {
          newScaleY = currentScaleY;
          newScaleX = (target.height * currentScaleY * aspectRatio) / target.width;
        }
        
        // 保持中心點
        const centerX = scalingStartState.left + (scalingStartState.width * scalingStartState.scaleX) / 2;
        const centerY = scalingStartState.top + (scalingStartState.height * scalingStartState.scaleY) / 2;
        
        const newWidth = target.width * newScaleX;
        const newHeight = target.height * newScaleY;
        
        target.set({
          scaleX: newScaleX,
          scaleY: newScaleY,
          left: centerX - newWidth / 2,
          top: centerY - newHeight / 2,
        });
      }
    });

    // 物件選取時設定控制點
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fabricCanvas.on('selection:created', (e: any) => {
      const obj = e.selected?.[0];
      if (obj) {
        // 確保所有控制點都可見
        obj.setControlsVisibility({
          mt: true,
          mb: true,
          ml: true,
          mr: true,
          tl: true,
          tr: true,
          bl: true,
          br: true,
          mtr: true,
        });
      }
    });

    // ========================================
    // Smart Guides - 智能對齊參考線（優化版）
    // 修復閃動和跳動問題
    // ========================================
    const SNAP_THRESHOLD = 5; // 吸附閾值（像素）- 減小以減少誤觸發
    const GUIDE_COLOR = '#6366F1'; // 參考線顏色
    let verticalLines: fabric.Line[] = [];
    let horizontalLines: fabric.Line[] = [];
    
    // 追蹤當前吸附狀態
    let isSnappingX = false;
    let isSnappingY = false;
    let lastSnapX: number | null = null;
    let lastSnapY: number | null = null;

    // 創建參考線
    const createGuideLine = (points: number[], isHorizontal: boolean): fabric.Line => {
      const line = new fabric.Line(points, {
        stroke: GUIDE_COLOR,
        strokeWidth: 2,
        strokeDashArray: [6, 4],
        selectable: false,
        evented: false,
        excludeFromExport: true,
        opacity: 0.9,
      });
      (line as ExtendedFabricObject).isGuide = true;
      return line;
    };

    // 清除所有參考線
    const clearGuides = () => {
      [...verticalLines, ...horizontalLines].forEach(line => {
        fabricCanvas.remove(line);
      });
      verticalLines = [];
      horizontalLines = [];
    };

    // 計算物件的對齊點（使用物件屬性而非 bounding rect 以獲得更穩定的值）
    const getSnapPoints = (target: fabric.Object) => {
      const left = target.left || 0;
      const top = target.top || 0;
      const width = (target.width || 0) * (target.scaleX || 1);
      const height = (target.height || 0) * (target.scaleY || 1);
      
      return {
        left,
        right: left + width,
        centerX: left + width / 2,
        top,
        bottom: top + height,
        centerY: top + height / 2,
        width,
        height,
      };
    };

    // 處理物件移動時的對齊
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    fabricCanvas.on('object:moving', (e: any) => {
      const target = e.target;
      if (!target) return;

      clearGuides();

      const targetPoints = getSnapPoints(target);
      const canvasCenterX = canvasWidth / 2;
      const canvasCenterY = canvasHeight / 2;

      // 收集所有可能的吸附點及其距離
      type SnapCandidate = {
        snapTo: number;      // 要吸附到的位置
        newValue: number;    // 物件的新 left/top 值
        distance: number;    // 距離
        linePos: number;     // 參考線位置
      };
      
      let xCandidates: SnapCandidate[] = [];
      let yCandidates: SnapCandidate[] = [];
      
      // 輔助函數：檢查 X 軸吸附
      const checkX = (targetValue: number, snapTo: number, offsetFromLeft: number) => {
        const distance = Math.abs(targetValue - snapTo);
        if (distance < SNAP_THRESHOLD) {
          xCandidates.push({
            snapTo,
            newValue: snapTo - offsetFromLeft,
            distance,
            linePos: snapTo,
          });
        }
      };
      
      // 輔助函數：檢查 Y 軸吸附
      const checkY = (targetValue: number, snapTo: number, offsetFromTop: number) => {
        const distance = Math.abs(targetValue - snapTo);
        if (distance < SNAP_THRESHOLD) {
          yCandidates.push({
            snapTo,
            newValue: snapTo - offsetFromTop,
            distance,
            linePos: snapTo,
          });
        }
      };

      // 檢查與畫布邊緣/中心的對齊
      // X 軸：左邊緣、中心、右邊緣
      checkX(targetPoints.left, 0, 0);
      checkX(targetPoints.centerX, canvasCenterX, targetPoints.width / 2);
      checkX(targetPoints.right, canvasWidth, targetPoints.width);
      
      // Y 軸：上邊緣、中心、下邊緣
      checkY(targetPoints.top, 0, 0);
      checkY(targetPoints.centerY, canvasCenterY, targetPoints.height / 2);
      checkY(targetPoints.bottom, canvasHeight, targetPoints.height);

      // 檢查與其他物件的對齊
      const objects = fabricCanvas.getObjects().filter((obj) => {
        const extObj = obj as ExtendedFabricObject;
        return obj !== target && !extObj.isGrid && !extObj.isGuide;
      });

      objects.forEach((obj: fabric.Object) => {
        const objPoints = getSnapPoints(obj);

        // X 軸對齊
        // 目標左邊 -> 物件左/中/右
        checkX(targetPoints.left, objPoints.left, 0);
        checkX(targetPoints.left, objPoints.centerX, 0);
        checkX(targetPoints.left, objPoints.right, 0);
        // 目標中心 -> 物件左/中/右
        checkX(targetPoints.centerX, objPoints.left, targetPoints.width / 2);
        checkX(targetPoints.centerX, objPoints.centerX, targetPoints.width / 2);
        checkX(targetPoints.centerX, objPoints.right, targetPoints.width / 2);
        // 目標右邊 -> 物件左/中/右
        checkX(targetPoints.right, objPoints.left, targetPoints.width);
        checkX(targetPoints.right, objPoints.centerX, targetPoints.width);
        checkX(targetPoints.right, objPoints.right, targetPoints.width);

        // Y 軸對齊
        // 目標上邊 -> 物件上/中/下
        checkY(targetPoints.top, objPoints.top, 0);
        checkY(targetPoints.top, objPoints.centerY, 0);
        checkY(targetPoints.top, objPoints.bottom, 0);
        // 目標中心 -> 物件上/中/下
        checkY(targetPoints.centerY, objPoints.top, targetPoints.height / 2);
        checkY(targetPoints.centerY, objPoints.centerY, targetPoints.height / 2);
        checkY(targetPoints.centerY, objPoints.bottom, targetPoints.height / 2);
        // 目標下邊 -> 物件上/中/下
        checkY(targetPoints.bottom, objPoints.top, targetPoints.height);
        checkY(targetPoints.bottom, objPoints.centerY, targetPoints.height);
        checkY(targetPoints.bottom, objPoints.bottom, targetPoints.height);
      });

      const newVerticalLines: fabric.Line[] = [];
      const newHorizontalLines: fabric.Line[] = [];

      // 找出最佳 X 軸吸附點（距離最近的）
      if (xCandidates.length > 0) {
        xCandidates.sort((a, b) => a.distance - b.distance);
        const best = xCandidates[0];
        
        // 只有在確實需要吸附時才設置位置
        if (best.distance < SNAP_THRESHOLD) {
          target.set('left', best.newValue);
          lastSnapX = best.linePos;
          isSnappingX = true;
          
          // 繪製垂直參考線
          const line = createGuideLine([best.linePos, 0, best.linePos, canvasHeight], false);
          newVerticalLines.push(line);
          fabricCanvas.add(line);
          fabricCanvas.bringToFront(line); // 確保參考線在最上層
        }
      } else {
        isSnappingX = false;
        lastSnapX = null;
      }

      // 找出最佳 Y 軸吸附點（距離最近的）
      if (yCandidates.length > 0) {
        yCandidates.sort((a, b) => a.distance - b.distance);
        const best = yCandidates[0];
        
        // 只有在確實需要吸附時才設置位置
        if (best.distance < SNAP_THRESHOLD) {
          target.set('top', best.newValue);
          lastSnapY = best.linePos;
          isSnappingY = true;
          
          // 繪製水平參考線
          const line = createGuideLine([0, best.linePos, canvasWidth, best.linePos], true);
          newHorizontalLines.push(line);
          fabricCanvas.add(line);
          fabricCanvas.bringToFront(line); // 確保參考線在最上層
        }
      } else {
        isSnappingY = false;
        lastSnapY = null;
      }

      verticalLines = newVerticalLines;
      horizontalLines = newHorizontalLines;
      
      // 重新渲染以顯示參考線
      if (newVerticalLines.length > 0 || newHorizontalLines.length > 0) {
        fabricCanvas.requestRenderAll();
      }
    });

    // 移動結束時清除參考線和狀態
    fabricCanvas.on('object:modified', () => {
      clearGuides();
      scalingStartState = null;
      isSnappingX = false;
      isSnappingY = false;
      lastSnapX = null;
      lastSnapY = null;
    });

    fabricCanvas.on('mouse:up', () => {
      clearGuides();
      isSnappingX = false;
      isSnappingY = false;
      lastSnapX = null;
      lastSnapY = null;
    });

    setCanvas(fabricCanvas);

    // 用於追蹤 canvas 是否已被清理
    let isDisposed = false;
    
    // 檢查 canvas 是否有效
    const isCanvasValid = () => {
      try {
        if (isDisposed || !fabricCanvas) return false;
        // 檢查 fabric canvas 的內部元素是否存在
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctx = (fabricCanvas as any).getContext?.() || (fabricCanvas as any).contextContainer;
        return ctx !== null && ctx !== undefined;
      } catch {
        return false;
      }
    };
    
    // 嘗試恢復草稿
    const recoverDraft = async () => {
      // 檢查 canvas 是否仍然有效
      if (!isCanvasValid()) {
        console.log('Canvas 已被清理，跳過恢復');
        return;
      }
      
      try {
        // 先檢查 IndexedDB 中的草稿
        let hasDraft = await autosaveService.hasDraft();
        let draftData: any = null;
        
        if (hasDraft) {
          draftData = await autosaveService.getDraft();
        }
        
        // 如果沒有 IndexedDB 草稿，檢查 localStorage 緊急保存
        if (!draftData) {
          const emergencySave = localStorage.getItem('designStudio_emergencySave');
          if (emergencySave) {
            try {
              const parsed = JSON.parse(emergencySave);
              // 檢查是否是最近 24 小時內的保存
              if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
                draftData = {
                  canvasJson: parsed.canvasJson,
                  canvasWidth: parsed.canvasWidth,
                  canvasHeight: parsed.canvasHeight,
                  backgroundColor: parsed.backgroundColor,
                  projectName: parsed.projectName
                };
                console.log('從緊急保存恢復');
              }
            } catch (e) {
              console.error('解析緊急保存失敗:', e);
            }
          }
        }
        
        // 再次檢查 canvas 是否仍然有效
        if (!isCanvasValid()) {
          console.log('Canvas 已被清理，跳過恢復');
          return;
        }
        
        if (draftData && draftData.canvasJson) {
          // 更新 store 中的畫布設定
          const { setCanvasSize, setCanvasBackground, setTemplateName, addLayer } = useDesignStudioStore.getState();
          setCanvasSize(draftData.canvasWidth, draftData.canvasHeight);
          setCanvasBackground(draftData.backgroundColor);
          if (draftData.projectName) {
            setTemplateName(draftData.projectName);
          }
          
          // 載入畫布 JSON
          const canvasData = typeof draftData.canvasJson === 'string' 
            ? JSON.parse(draftData.canvasJson) 
            : draftData.canvasJson;
          
          console.log('恢復草稿 - 畫布尺寸:', draftData.canvasWidth, 'x', draftData.canvasHeight);
          console.log('恢復草稿 - 物件數量:', canvasData.objects?.length);
          if (canvasData.objects?.length > 0) {
            console.log('恢復草稿 - 第一個物件位置:', canvasData.objects[0].left, canvasData.objects[0].top);
          }
          
          // 使用 try-catch 包裹 loadFromJSON
          try {
            await new Promise<void>((resolve, reject) => {
              if (!isCanvasValid()) {
                reject(new Error('Canvas disposed'));
                return;
              }
              fabricCanvas.loadFromJSON(canvasData, () => {
                if (isCanvasValid()) {
                  // 確保畫布尺寸正確
                  fabricCanvas.setWidth(draftData.canvasWidth);
                  fabricCanvas.setHeight(draftData.canvasHeight);
                  // 重置視口變換
                  fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
                  fabricCanvas.renderAll();
                  
                  // 調試：打印恢復後的物件位置
                  const objs = fabricCanvas.getObjects();
                  console.log('恢復後物件數量:', objs.length);
                  objs.forEach((obj: any, i: number) => {
                    if (!obj.isGrid && !obj.isGuide) {
                      console.log(`物件 ${i}: left=${obj.left}, top=${obj.top}, type=${obj.type}`);
                    }
                  });
                }
                resolve();
              });
            });
          } catch (loadError) {
            console.error('載入 JSON 失敗:', loadError);
            return;
          }
          
          // 檢查 canvas 是否仍然有效
          if (!isCanvasValid()) {
            return;
          }
          
          // 重建圖層列表
          const objects = fabricCanvas.getObjects();
          objects.forEach((obj: fabric.Object) => {
            const extObj = obj as ExtendedFabricObject;
            if (extObj.id && !extObj.isGrid && !extObj.isGuide) {
              // 判斷物件類型
              let objType: 'text' | 'image' | 'shape' | 'group' = 'shape';
              if ((extObj as any).isGroup || obj.type === 'group') {
                objType = 'group';
              } else if (obj.type === 'i-text' || obj.type === 'textbox') {
                objType = 'text';
              } else if (obj.type === 'image') {
                objType = 'image';
              }
              
              addLayer({
                id: extObj.id,
                name: extObj.name || '物件',
                type: objType,
                visible: obj.visible !== false,
                locked: !obj.selectable,
                opacity: obj.opacity || 1,
                blendMode: 'source-over',
                fabricObject: obj,
                clipMaskId: (extObj as any).clipMaskId,
                isClipMask: (extObj as any).isClipMask,
                originalMaskStyle: (extObj as any).isClipMask ? {
                  fill: (extObj as any).originalFill,
                  stroke: (extObj as any).originalStroke,
                  strokeWidth: (extObj as any).originalStrokeWidth || 0,
                  opacity: (extObj as any).originalOpacity || 1,
                } : undefined,
                isGroup: (extObj as any).isGroup,
                childIds: (extObj as any).childIds,
              });
            }
          });
          
          // 重建遮罩關係（clipPath）
          const { layers: restoredLayers } = useDesignStudioStore.getState();
          restoredLayers.forEach(layer => {
            if (layer.clipMaskId && layer.fabricObject) {
              const maskLayer = restoredLayers.find(l => l.id === layer.clipMaskId);
              if (maskLayer?.fabricObject) {
                // 重建 clipPath
                const maskObj = maskLayer.fabricObject;
                const targetObj = layer.fabricObject;
                
                const maskCenter = maskObj.getCenterPoint();
                const targetCenter = targetObj.getCenterPoint();
                const offsetX = maskCenter.x - targetCenter.x;
                const offsetY = maskCenter.y - targetCenter.y;
                
                // 獲取目標物件的縮放比例（用於補償）
                const targetScaleX = targetObj.scaleX || 1;
                const targetScaleY = targetObj.scaleY || 1;
                
                const clipProps = {
                  left: offsetX / targetScaleX,
                  top: offsetY / targetScaleY,
                  scaleX: (maskObj.scaleX || 1) / targetScaleX,
                  scaleY: (maskObj.scaleY || 1) / targetScaleY,
                  angle: (maskObj.angle || 0) - (targetObj.angle || 0),
                  originX: 'center' as const,
                  originY: 'center' as const,
                  absolutePositioned: false,
                };
                
                let clipPath: fabric.Object | null = null;
                
                if (maskObj.type === 'circle') {
                  clipPath = new fabric.Circle({
                    radius: (maskObj as fabric.Circle).radius,
                    ...clipProps,
                  });
                } else if (maskObj.type === 'rect') {
                  clipPath = new fabric.Rect({
                    width: (maskObj as fabric.Rect).width,
                    height: (maskObj as fabric.Rect).height,
                    rx: (maskObj as fabric.Rect).rx,
                    ry: (maskObj as fabric.Rect).ry,
                    ...clipProps,
                  });
                } else if (maskObj.type === 'ellipse') {
                  clipPath = new fabric.Ellipse({
                    rx: (maskObj as fabric.Ellipse).rx,
                    ry: (maskObj as fabric.Ellipse).ry,
                    ...clipProps,
                  });
                } else if (maskObj.type === 'triangle') {
                  clipPath = new fabric.Triangle({
                    width: (maskObj as fabric.Triangle).width,
                    height: (maskObj as fabric.Triangle).height,
                    ...clipProps,
                  });
                } else if (maskObj.type === 'polygon') {
                  clipPath = new fabric.Polygon((maskObj as fabric.Polygon).points || [], {
                    ...clipProps,
                  });
                } else if (maskObj.type === 'path') {
                  clipPath = new fabric.Path((maskObj as fabric.Path).path || [], {
                    ...clipProps,
                  });
                } else {
                  // 對於其他類型，嘗試使用 clone
                  maskObj.clone((cloned: fabric.Object) => {
                    cloned.set(clipProps);
                    targetObj.clipPath = cloned;
                    targetObj.dirty = true;
                  });
                }
                
                if (clipPath) {
                  targetObj.clipPath = clipPath;
                  targetObj.dirty = true;
                }
              }
            }
          });
          
          fabricCanvas.renderAll();
          toast.success('已恢復上次編輯的內容');
          
          // 清除緊急保存
          localStorage.removeItem('designStudio_emergencySave');
        }
      } catch (error) {
        console.error('恢復草稿失敗:', error);
      }
      
      // 無論是否恢復草稿，都推送初始歷史記錄
      if (isCanvasValid()) {
        pushHistory({
          json: JSON.stringify(fabricCanvas.toJSON()),
          timestamp: Date.now(),
          action: 'init',
          description: '初始化畫布',
        });
      }
    };
    
    // 延遲執行恢復
    setTimeout(recoverDraft, 200);

    // 啟動自動保存
    const getCanvasState = () => ({
      canvas: fabricCanvas,
      projectName: useDesignStudioStore.getState().templateName,
      canvasWidth: useDesignStudioStore.getState().canvasWidth,
      canvasHeight: useDesignStudioStore.getState().canvasHeight,
      backgroundColor: useDesignStudioStore.getState().canvasBackgroundColor,
    });
    
    autosaveService.start(getCanvasState);

    // 在頁面關閉/重整前保存
    const handleBeforeUnload = () => {
      try {
        // 同步保存（使用 localStorage 作為備份）
        const state = getCanvasState();
        if (state.canvas) {
          const customProperties = ['id', 'name', 'blendMode', 'globalCompositeOperation', 'lockUniScaling', 'isGrid', 'isGuide', 'selectable', 'evented', 'clipMaskId', 'isClipMask', 'originalFill', 'originalStroke', 'originalStrokeWidth', 'originalOpacity', 'isGroup', 'groupId', 'childIds'];
          const objects = state.canvas.getObjects().filter((obj: any) => !obj.isGrid && !obj.isGuide);
          const canvasJson = JSON.stringify({
            ...state.canvas.toJSON(customProperties),
            objects: objects.map((obj: any) => obj.toJSON(customProperties))
          });
          
          localStorage.setItem('designStudio_emergencySave', JSON.stringify({
            canvasJson,
            canvasWidth: state.canvasWidth,
            canvasHeight: state.canvasHeight,
            backgroundColor: state.backgroundColor,
            projectName: state.projectName,
            timestamp: Date.now()
          }));
        }
      } catch (e) {
        console.error('緊急保存失敗:', e);
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);

    // 監聽物件變更，觸發保存
    const handleModified = () => {
      // 延遲保存，避免頻繁觸發
      setTimeout(() => {
        autosaveService.save(getCanvasState()).catch(console.error);
      }, 1000);
    };
    
    fabricCanvas.on('object:modified', handleModified);
    fabricCanvas.on('object:added', handleModified);
    fabricCanvas.on('object:removed', handleModified);

    return () => {
      // 標記為已清理
      isDisposed = true;
      // 停止自動保存
      autosaveService.stop();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      fabricCanvas.off('object:modified', handleModified);
      fabricCanvas.off('object:added', handleModified);
      fabricCanvas.off('object:removed', handleModified);
      fabricCanvas.dispose();
      setCanvas(null);
    };
  }, []);

  // 更新畫布尺寸
  useEffect(() => {
    if (!canvas) return;
    canvas.setWidth(canvasWidth);
    canvas.setHeight(canvasHeight);
    canvas.renderAll();
  }, [canvas, canvasWidth, canvasHeight]);

  // 更新背景色
  useEffect(() => {
    if (!canvas) return;
    canvas.setBackgroundColor(canvasBackgroundColor, () => {
      canvas.renderAll();
    });
  }, [canvas, canvasBackgroundColor]);

  // 繪製網格
  useEffect(() => {
    if (!canvas) return;
    
    // 移除舊網格
    const existingGrid = canvas.getObjects().filter((obj) => (obj as ExtendedFabricObject).isGrid);
    existingGrid.forEach((obj) => canvas.remove(obj));
    
    if (showGrid) {
      const gridLines: fabric.Line[] = [];
      
      // 垂直線
      for (let x = 0; x <= canvasWidth; x += gridSize) {
        const line = new fabric.Line([x, 0, x, canvasHeight], {
          stroke: "rgba(99, 102, 241, 0.15)",
          strokeWidth: 1,
          selectable: false,
          evented: false,
          excludeFromExport: true,
        });
        (line as ExtendedFabricObject).isGrid = true;
        gridLines.push(line);
      }
      
      // 水平線
      for (let y = 0; y <= canvasHeight; y += gridSize) {
        const line = new fabric.Line([0, y, canvasWidth, y], {
          stroke: "rgba(99, 102, 241, 0.15)",
          strokeWidth: 1,
          selectable: false,
          evented: false,
          excludeFromExport: true,
        });
        (line as ExtendedFabricObject).isGrid = true;
        gridLines.push(line);
      }
      
      gridLines.forEach((line) => canvas.add(line));
      canvas.sendToBack(...gridLines);
    }
    
    canvas.renderAll();
  }, [canvas, showGrid, gridSize, canvasWidth, canvasHeight]);

  // 事件處理
  useEffect(() => {
    if (!canvas) return;

    // 選取事件
    const handleSelection = () => {
      const activeObjects = canvas.getActiveObjects();
      const ids = activeObjects.map((obj) => (obj as ExtendedFabricObject).id).filter(Boolean) as string[];
      setSelectedObjects(ids);
    };

    // 取消選取
    const handleDeselection = () => {
      setSelectedObjects([]);
    };

    // 自訂屬性列表（用於 JSON 序列化）
    const customProperties = [
      "id", 
      "name", 
      "blendMode", 
      "globalCompositeOperation",
      "lockUniScaling",
      "isGrid",
      "isGuide",
      "selectable",
      "evented",
      "clipMaskId",
      "isClipMask",
      "originalFill",
      "originalStroke",
      "originalStrokeWidth",
      "originalOpacity",
      "isGroup",
      "groupId",
      "childIds"
    ];

    // 保存歷史記錄的輔助函數 - 排除網格和參考線
    const saveHistory = (action: 'add' | 'remove' | 'modify' | 'style', objectIds?: string[]) => {
      // 檢查是否正在恢復歷史（直接從 store 取得最新狀態）
      const { isRestoringHistory } = useDesignStudioStore.getState();
      if (isRestoringHistory) {
        console.log(`saveHistory: 跳過 ${action}（正在恢復歷史）`);
        return;
      }
      
      // 獲取所有物件的 ID（排除網格和參考線）
      const allObjectIds = canvas.getObjects()
        .filter((obj) => {
          const extObj = obj as ExtendedFabricObject;
          return !extObj.isGrid && !extObj.isGuide && extObj.id;
        })
        .map((obj) => (obj as ExtendedFabricObject).id) as string[];
      
      pushHistory({
        json: JSON.stringify(canvas.toJSON(customProperties)),
        timestamp: Date.now(),
        action,
        objectIds: objectIds || allObjectIds, // 如果沒有指定，使用所有物件 ID
      });
    };

    // 物件修改後保存歷史
    const handleModified = (e: FabricObjectEvent) => {
      const target = e.target;
      const objectId = target?.id;
      
      // clipPath 使用相對位置（absolutePositioned: false），會自動跟著物件移動
      // 不需要手動同步
      
      saveHistory('modify', objectId ? [objectId] : undefined);
    };

    // 物件新增後保存歷史
    const handleAdded = (e: FabricObjectEvent) => {
      const target = e.target;
      // 跳過網格線和參考線
      if (target?.isGrid || target?.isGuide) return;
      const objectId = target?.id;
      if (objectId) {
        saveHistory('add', [objectId]);
      }
    };

    // 物件刪除後保存歷史並同步圖層（處理遮罩綁定）
    const handleRemoved = (e: FabricObjectEvent) => {
      const target = e.target;
      // 跳過網格線和參考線
      if (target?.isGrid || target?.isGuide) return;
      const objectId = target?.id;
      if (objectId) {
        const { layers, updateLayer } = useDesignStudioStore.getState();
        const currentLayer = layers.find(l => l.id === objectId);
        
        // 如果此物件有遮罩，同時刪除遮罩物件
        if (currentLayer?.clipMaskId) {
          const maskLayer = layers.find(l => l.id === currentLayer.clipMaskId);
          if (maskLayer?.fabricObject && maskLayer.fabricObject.canvas) {
            canvas.remove(maskLayer.fabricObject);
            removeLayer(maskLayer.id);
          }
        }
        
        // 如果此物件是遮罩，清除被遮罩物件的 clipPath
        if (currentLayer?.isClipMask) {
          const maskedLayers = layers.filter(l => l.clipMaskId === objectId);
          maskedLayers.forEach(maskedLayer => {
            if (maskedLayer.fabricObject) {
              maskedLayer.fabricObject.clipPath = undefined;
              maskedLayer.fabricObject.dirty = true;
              updateLayer(maskedLayer.id, { clipMaskId: undefined });
            }
          });
          canvas.renderAll();
        }
        
        // 同步移除圖層
        removeLayer(objectId);
        saveHistory('remove', [objectId]);
      }
    };

    // 綁定事件
    canvas.on("selection:created", handleSelection);
    canvas.on("selection:updated", handleSelection);
    canvas.on("selection:cleared", handleDeselection);
    canvas.on("object:modified", handleModified);
    canvas.on("object:added", handleAdded);
    canvas.on("object:removed", handleRemoved);

    return () => {
      canvas.off("selection:created", handleSelection);
      canvas.off("selection:updated", handleSelection);
      canvas.off("selection:cleared", handleDeselection);
      canvas.off("object:modified", handleModified);
      canvas.off("object:added", handleAdded);
      canvas.off("object:removed", handleRemoved);
    };
  }, [canvas, setSelectedObjects, pushHistory, removeLayer]);

  // 計算最佳縮放比例，讓畫布適應容器
  const calculateFitZoom = useCallback(() => {
    if (!containerRef.current) return 1;
    
    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // 預留邊距（上下左右各 40px）
    const padding = 80;
    const availableWidth = containerWidth - padding;
    const availableHeight = containerHeight - padding;
    
    // 計算適應比例
    const scaleX = availableWidth / canvasWidth;
    const scaleY = availableHeight / canvasHeight;
    
    // 取較小值以確保完全顯示
    const fitZoom = Math.min(scaleX, scaleY, 1); // 最大不超過 100%
    
    return Math.max(0.1, fitZoom); // 最小 10%
  }, [canvasWidth, canvasHeight]);

  // 初始化時自動調整縮放以適應螢幕
  useEffect(() => {
    if (!canvas || !containerRef.current) return;
    
    // 延遲執行，確保容器尺寸已計算完成
    const timer = setTimeout(() => {
      const fitZoom = calculateFitZoom();
      setZoom(fitZoom);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [canvas, calculateFitZoom, setZoom]);

  // 監聽視窗大小變化，可選擇重新調整（目前不自動調整，保持用戶設定的縮放）
  useEffect(() => {
    const handleResize = () => {
      // 如果需要自動調整，取消下面的註解
      // const fitZoom = calculateFitZoom();
      // setZoom(fitZoom);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateFitZoom, setZoom]);

  // 滾輪縮放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(zoom + delta);
  }, [zoom, setZoom]);

  // 雙擊容器空白處重置縮放
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    // 只在點擊容器背景時觸發（非畫布區域）
    if (e.target === containerRef.current) {
      const fitZoom = calculateFitZoom();
      setZoom(fitZoom);
    }
  }, [calculateFitZoom, setZoom]);

  // 計算畫布容器樣式
  const containerStyle = {
    transform: `scale(${zoom})`,
    transformOrigin: "center center",
  };

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative flex items-center justify-center bg-slate-800/50 overflow-auto",
        className
      )}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    >
      {/* 畫布陰影效果 */}
      <div 
        className="relative shadow-2xl shadow-black/50"
        style={containerStyle}
      >
        {/* 棋盤格背景（透明指示） */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(45deg, #374151 25%, transparent 25%),
              linear-gradient(-45deg, #374151 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #374151 75%),
              linear-gradient(-45deg, transparent 75%, #374151 75%)
            `,
            backgroundSize: "20px 20px",
            backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
            opacity: 0.3,
          }}
        />
        
        {/* Fabric.js Canvas */}
        <canvas ref={canvasRef} />
      </div>

      {/* 浮動快速操作工具列 */}
      <FloatingToolbar containerRef={containerRef} />

      {/* 右鍵選單 */}
      <ContextMenu containerRef={containerRef} />
      
      {/* 縮放控制器 - 改進版 */}
      <TooltipProvider delayDuration={200}>
        <div className="absolute bottom-4 right-4 flex items-center gap-1 px-2 py-1.5 bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-700/50 shadow-xl">
          {/* 縮小 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-slate-800 border-slate-700 text-xs">
              縮小 (⌘-)
            </TooltipContent>
          </Tooltip>
          
          {/* 縮放比例 - 可點擊重設 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => setZoom(1)}
                className={cn(
                  "text-sm font-mono min-w-[52px] text-center py-1 px-2 rounded-lg transition-all",
                  zoom === 1 
                    ? "bg-indigo-500/20 text-indigo-400" 
                    : "text-slate-300 hover:text-indigo-400 hover:bg-slate-700/50"
                )}
              >
                {Math.round(zoom * 100)}%
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-slate-800 border-slate-700 text-xs">
              點擊重設為 100%
            </TooltipContent>
          </Tooltip>
          
          {/* 放大 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setZoom(Math.min(5, zoom + 0.1))}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-slate-800 border-slate-700 text-xs">
              放大 (⌘+)
            </TooltipContent>
          </Tooltip>
          
          {/* 分隔線 */}
          <div className="w-px h-5 bg-slate-700/50 mx-1" />
          
          {/* 適應螢幕 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setZoom(calculateFitZoom())}
                className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-slate-800 border-slate-700 text-xs">
              <div>適應螢幕</div>
              <div className="text-slate-500 text-[10px]">或雙擊空白處</div>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* 畫布尺寸提示 */}
      <div className="absolute top-4 left-4 px-3 py-1.5 bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700/50 text-xs text-slate-400">
        <span className="font-mono">{canvasWidth} × {canvasHeight}</span>
      </div>
    </div>
  );
}
