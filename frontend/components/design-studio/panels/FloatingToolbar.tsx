"use client";

/**
 * Floating Toolbar - 浮動快速操作工具列
 * 選中物件時顯示在物件上方，提供常用操作
 */

import React, { useEffect, useState, useCallback } from "react";
import { 
  Copy, 
  Trash2, 
  FlipHorizontal, 
  FlipVertical,
  ArrowUp,
  ArrowDown,
  Lock,
  Unlock,
  MoreHorizontal,
  AlignCenterHorizontal,
  AlignCenterVertical,
  Layers,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useDesignStudioStore } from "@/stores/design-studio-store";
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";

interface FloatingToolbarProps {
  containerRef: React.RefObject<HTMLDivElement>;
}

export default function FloatingToolbar({ containerRef }: FloatingToolbarProps) {
  const {
    canvas,
    selectedObjectIds,
    layers,
    updateLayer,
    addLayer,
    removeLayer,
    canvasWidth,
    canvasHeight,
  } = useDesignStudioStore();

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);

  // 獲取選中的圖層
  const selectedLayer = layers.find((l) => selectedObjectIds.includes(l.id));
  const selectedObject = selectedLayer?.fabricObject;

  // 更新工具列位置
  const updatePosition = useCallback(() => {
    try {
      if (!canvas || !selectedObject || !containerRef.current) {
        setVisible(false);
        return;
      }

      // 確保物件存在且 canvas 已初始化
      if (!selectedObject.canvas || typeof selectedObject.getBoundingRect !== 'function') {
        setVisible(false);
        return;
      }

      const obj = selectedObject;
      let boundingRect;
      try {
        boundingRect = obj.getBoundingRect();
      } catch {
        setVisible(false);
        return;
      }

      if (!boundingRect) {
        setVisible(false);
        return;
      }

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      
      // 獲取當前縮放比例
      const zoom = useDesignStudioStore.getState().zoom;
      
      // 計算畫布在容器中的偏移
      const canvasEl = canvas.getElement();
      if (!canvasEl) {
        setVisible(false);
        return;
      }
      const canvasRect = canvasEl.getBoundingClientRect();
      
      // 計算物件在容器中的位置
      const objCenterX = canvasRect.left - containerRect.left + (boundingRect.left + boundingRect.width / 2) * zoom;
      const objTop = canvasRect.top - containerRect.top + boundingRect.top * zoom;
      
      // 工具列寬度和高度
      const toolbarWidth = 280;
      const toolbarHeight = 40;
      const offset = 12; // 距離物件的間距
      
      // 計算 X 位置（置中於物件）
      let x = objCenterX - toolbarWidth / 2;
      // 確保不超出容器左右邊界
      x = Math.max(10, Math.min(x, containerRect.width - toolbarWidth - 10));
      
      // 計算 Y 位置（物件上方）
      let y = objTop - toolbarHeight - offset;
      // 如果上方空間不足，放到下方
      if (y < 10) {
        const objBottom = canvasRect.top - containerRect.top + (boundingRect.top + boundingRect.height) * zoom;
        y = objBottom + offset;
      }
      
      setPosition({ x, y });
      setVisible(true);
    } catch (error) {
      console.warn('FloatingToolbar updatePosition error:', error);
      setVisible(false);
    }
  }, [canvas, selectedObject, containerRef]);

  // 監聽選取變化和物件移動
  useEffect(() => {
    if (!canvas) return;

    const handleUpdate = () => {
      requestAnimationFrame(updatePosition);
    };

    // 初始更新
    updatePosition();

    // 監聽事件
    canvas.on("selection:created", handleUpdate);
    canvas.on("selection:updated", handleUpdate);
    canvas.on("selection:cleared", () => setVisible(false));
    canvas.on("object:moving", handleUpdate);
    canvas.on("object:scaling", handleUpdate);
    canvas.on("object:rotating", handleUpdate);
    canvas.on("object:modified", handleUpdate);

    // 監聽縮放變化
    const unsubscribe = useDesignStudioStore.subscribe(
      (state) => state.zoom,
      handleUpdate
    );

    return () => {
      canvas.off("selection:created", handleUpdate);
      canvas.off("selection:updated", handleUpdate);
      canvas.off("selection:cleared", () => setVisible(false));
      canvas.off("object:moving", handleUpdate);
      canvas.off("object:scaling", handleUpdate);
      canvas.off("object:rotating", handleUpdate);
      canvas.off("object:modified", handleUpdate);
      unsubscribe();
    };
  }, [canvas, updatePosition]);

  // 如果沒有選中物件，不顯示
  if (!visible || !selectedObject || selectedObjectIds.length === 0) {
    return null;
  }

  // 複製物件
  const handleDuplicate = () => {
    if (!canvas || !selectedObject) return;
    
    selectedObject.clone((cloned: any) => {
      const id = uuidv4().slice(0, 8);
      cloned.set({
        left: (cloned.left || 0) + 20,
        top: (cloned.top || 0) + 20,
      });
      cloned.id = id;
      cloned.name = `${selectedLayer?.name} 複製`;
      
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.renderAll();
      
      addLayer({
        id,
        name: `${selectedLayer?.name} 複製`,
        type: selectedLayer?.type || "shape",
        visible: true,
        locked: false,
        opacity: cloned.opacity || 1,
        blendMode: "source-over",
        fabricObject: cloned,
      });
    });
  };

  // 刪除物件
  const handleDelete = () => {
    if (!canvas || !selectedObject || !selectedLayer) return;
    
    canvas.remove(selectedObject);
    canvas.discardActiveObject();
    canvas.renderAll();
    removeLayer(selectedLayer.id);
  };

  // 水平翻轉
  const handleFlipH = () => {
    if (!canvas || !selectedObject) return;
    selectedObject.set("flipX", !selectedObject.flipX);
    canvas.renderAll();
  };

  // 垂直翻轉
  const handleFlipV = () => {
    if (!canvas || !selectedObject) return;
    selectedObject.set("flipY", !selectedObject.flipY);
    canvas.renderAll();
  };

  // 上移一層
  const handleBringForward = () => {
    if (!canvas || !selectedObject) return;
    canvas.bringForward(selectedObject);
    canvas.renderAll();
  };

  // 下移一層
  const handleSendBackward = () => {
    if (!canvas || !selectedObject) return;
    canvas.sendBackwards(selectedObject);
    canvas.renderAll();
  };

  // 鎖定/解鎖
  const handleToggleLock = () => {
    if (!selectedLayer) return;
    const newLocked = !selectedLayer.locked;
    updateLayer(selectedLayer.id, { locked: newLocked });
    
    if (selectedObject) {
      selectedObject.set({
        selectable: !newLocked,
        evented: !newLocked,
      });
      canvas?.renderAll();
    }
  };

  // 水平置中
  const handleCenterH = () => {
    if (!canvas || !selectedObject) return;
    selectedObject.set("left", canvasWidth / 2);
    selectedObject.setCoords();
    canvas.renderAll();
  };

  // 垂直置中
  const handleCenterV = () => {
    if (!canvas || !selectedObject) return;
    selectedObject.set("top", canvasHeight / 2);
    selectedObject.setCoords();
    canvas.renderAll();
  };

  // 工具按鈕
  const ToolBtn = ({ 
    icon: Icon, 
    label, 
    onClick,
    active = false,
  }: { 
    icon: React.ElementType; 
    label: string; 
    onClick: () => void;
    active?: boolean;
  }) => (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClick}
            className={cn(
              "w-8 h-8 p-0 rounded-lg transition-colors",
              active 
                ? "bg-indigo-500/20 text-indigo-400" 
                : "text-slate-300 hover:text-white hover:bg-slate-700/50"
            )}
          >
            <Icon className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-slate-800 border-slate-700 text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <div
      className={cn(
        "absolute z-50 flex items-center gap-0.5 px-2 py-1.5",
        "bg-slate-900/95 backdrop-blur-md rounded-xl",
        "border border-slate-700/50 shadow-xl shadow-black/30",
        "animate-in fade-in-0 zoom-in-95 duration-150"
      )}
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {/* 複製 */}
      <ToolBtn icon={Copy} label="複製 (⌘D)" onClick={handleDuplicate} />
      
      {/* 刪除 */}
      <ToolBtn icon={Trash2} label="刪除 (Del)" onClick={handleDelete} />
      
      <Separator orientation="vertical" className="h-5 mx-1 bg-slate-700" />
      
      {/* 翻轉 */}
      <ToolBtn 
        icon={FlipHorizontal} 
        label="水平翻轉" 
        onClick={handleFlipH} 
        active={selectedObject?.flipX}
      />
      <ToolBtn 
        icon={FlipVertical} 
        label="垂直翻轉" 
        onClick={handleFlipV}
        active={selectedObject?.flipY}
      />
      
      <Separator orientation="vertical" className="h-5 mx-1 bg-slate-700" />
      
      {/* 對齊 */}
      <ToolBtn icon={AlignCenterHorizontal} label="水平置中" onClick={handleCenterH} />
      <ToolBtn icon={AlignCenterVertical} label="垂直置中" onClick={handleCenterV} />
      
      <Separator orientation="vertical" className="h-5 mx-1 bg-slate-700" />
      
      {/* 圖層順序 */}
      <ToolBtn icon={ArrowUp} label="上移一層" onClick={handleBringForward} />
      <ToolBtn icon={ArrowDown} label="下移一層" onClick={handleSendBackward} />
      
      {/* 更多選項 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-8 h-8 p-0 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/50"
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="bg-slate-800 border-slate-700 min-w-[160px]"
        >
          <DropdownMenuItem 
            onClick={handleToggleLock}
            className="text-sm"
          >
            {selectedLayer?.locked ? (
              <>
                <Unlock className="w-4 h-4 mr-2" />
                解鎖
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                鎖定
              </>
            )}
          </DropdownMenuItem>
          
          <DropdownMenuSeparator className="bg-slate-700" />
          
          <DropdownMenuItem 
            onClick={() => {
              if (!canvas || !selectedObject) return;
              canvas.bringToFront(selectedObject);
              canvas.renderAll();
            }}
            className="text-sm"
          >
            <Layers className="w-4 h-4 mr-2" />
            移至最上層
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={() => {
              if (!canvas || !selectedObject) return;
              canvas.sendToBack(selectedObject);
              canvas.renderAll();
            }}
            className="text-sm"
          >
            <Layers className="w-4 h-4 mr-2 rotate-180" />
            移至最下層
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
