"use client";

/**
 * Context Menu - 右鍵選單
 * 提供快速操作選項
 */

import React, { useEffect, useState, useCallback } from "react";
import { 
  Copy, 
  Clipboard,
  Trash2, 
  FlipHorizontal, 
  FlipVertical,
  ArrowUp,
  ArrowDown,
  Lock,
  Unlock,
  Layers,
  Eye,
  EyeOff,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  AlignEndVertical,
  LayoutGrid,
  Scissors,
  Group,
  Ungroup,
} from "lucide-react";
import { fabric } from "fabric";
import { useDesignStudioStore } from "@/stores/design-studio-store";
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";

interface ContextMenuProps {
  containerRef: React.RefObject<HTMLDivElement>;
}

interface MenuPosition {
  x: number;
  y: number;
}

export default function ContextMenu({ containerRef }: ContextMenuProps) {
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

  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ x: 0, y: 0 });
  const [clipboardObject, setClipboardObject] = useState<any>(null);
  const [clipboardMaskObject, setClipboardMaskObject] = useState<any>(null);
  const [clipboardOriginalPosition, setClipboardOriginalPosition] = useState<{ left: number; top: number } | null>(null);
  const [clipboardMaskOriginalPosition, setClipboardMaskOriginalPosition] = useState<{ left: number; top: number } | null>(null);

  // 獲取選中的圖層
  const selectedLayer = layers.find((l) => selectedObjectIds.includes(l.id));
  const selectedObject = selectedLayer?.fabricObject;
  const hasSelection = selectedObjectIds.length > 0 && selectedObject;

  // 處理右鍵點擊
  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    
    if (!containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    
    // 計算選單位置
    let x = e.clientX - containerRect.left;
    let y = e.clientY - containerRect.top;
    
    // 確保選單不超出容器
    const menuWidth = 200;
    const menuHeight = hasSelection ? 380 : 120;
    
    if (x + menuWidth > containerRect.width) {
      x = containerRect.width - menuWidth - 10;
    }
    if (y + menuHeight > containerRect.height) {
      y = containerRect.height - menuHeight - 10;
    }
    
    setPosition({ x: Math.max(10, x), y: Math.max(10, y) });
    setVisible(true);
  }, [containerRef, hasSelection]);

  // 關閉選單
  const closeMenu = useCallback(() => {
    setVisible(false);
  }, []);

  // 監聽事件
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("click", closeMenu);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });

    return () => {
      container.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("click", closeMenu);
    };
  }, [containerRef, handleContextMenu, closeMenu]);

  // 操作函數
  const handleCopy = () => {
    if (!selectedObject || !selectedLayer) return;
    
    // 保存原始位置
    setClipboardOriginalPosition({
      left: selectedObject.left || 0,
      top: selectedObject.top || 0,
    });
    
    selectedObject.clone((cloned: any) => {
      // 複製遮罩相關屬性
      cloned.clipMaskId = selectedLayer.clipMaskId;
      setClipboardObject(cloned);
    });
    
    // 如果有遮罩，同時複製遮罩物件
    if (selectedLayer.clipMaskId) {
      const maskLayer = layers.find(l => l.id === selectedLayer.clipMaskId);
      if (maskLayer?.fabricObject) {
        setClipboardMaskOriginalPosition({
          left: maskLayer.fabricObject.left || 0,
          top: maskLayer.fabricObject.top || 0,
        });
        maskLayer.fabricObject.clone((clonedMask: any) => {
          clonedMask.isClipMask = true;
          clonedMask.originalFill = (maskLayer.fabricObject as any).originalFill;
          clonedMask.originalStroke = (maskLayer.fabricObject as any).originalStroke;
          clonedMask.originalStrokeWidth = (maskLayer.fabricObject as any).originalStrokeWidth;
          clonedMask.originalOpacity = (maskLayer.fabricObject as any).originalOpacity;
          setClipboardMaskObject(clonedMask);
        });
      }
    } else {
      setClipboardMaskObject(null);
      setClipboardMaskOriginalPosition(null);
    }
    
    closeMenu();
  };

  const handleCut = () => {
    if (!canvas || !selectedObject || !selectedLayer) return;
    
    // 保存原始位置
    setClipboardOriginalPosition({
      left: selectedObject.left || 0,
      top: selectedObject.top || 0,
    });
    
    selectedObject.clone((cloned: any) => {
      cloned.clipMaskId = selectedLayer.clipMaskId;
      setClipboardObject(cloned);
    });
    
    // 如果有遮罩，同時複製遮罩物件
    if (selectedLayer.clipMaskId) {
      const maskLayer = layers.find(l => l.id === selectedLayer.clipMaskId);
      if (maskLayer?.fabricObject) {
        setClipboardMaskOriginalPosition({
          left: maskLayer.fabricObject.left || 0,
          top: maskLayer.fabricObject.top || 0,
        });
        maskLayer.fabricObject.clone((clonedMask: any) => {
          clonedMask.isClipMask = true;
          clonedMask.originalFill = (maskLayer.fabricObject as any).originalFill;
          clonedMask.originalStroke = (maskLayer.fabricObject as any).originalStroke;
          clonedMask.originalStrokeWidth = (maskLayer.fabricObject as any).originalStrokeWidth;
          clonedMask.originalOpacity = (maskLayer.fabricObject as any).originalOpacity;
          setClipboardMaskObject(clonedMask);
        });
        // 刪除遮罩物件
        canvas.remove(maskLayer.fabricObject);
        removeLayer(maskLayer.id);
      }
    } else {
      setClipboardMaskObject(null);
      setClipboardMaskOriginalPosition(null);
    }
    
    canvas.remove(selectedObject);
    canvas.discardActiveObject();
    canvas.renderAll();
    removeLayer(selectedLayer.id);
    closeMenu();
  };

  const handlePaste = () => {
    if (!canvas || !clipboardObject) return;
    
    // 先貼上遮罩物件（如果有）
    let newMaskId: string | undefined;
    
    if (clipboardMaskObject && clipboardMaskOriginalPosition) {
      clipboardMaskObject.clone((clonedMask: any) => {
        newMaskId = uuidv4().slice(0, 8);
        clonedMask.set({
          left: clipboardMaskOriginalPosition.left,
          top: clipboardMaskOriginalPosition.top,
        });
        clonedMask.id = newMaskId;
        clonedMask.name = `遮罩 ${newMaskId}`;
        clonedMask.isClipMask = true;
        clonedMask.originalFill = clipboardMaskObject.originalFill;
        clonedMask.originalStroke = clipboardMaskObject.originalStroke;
        clonedMask.originalStrokeWidth = clipboardMaskObject.originalStrokeWidth;
        clonedMask.originalOpacity = clipboardMaskObject.originalOpacity;
        
        canvas.add(clonedMask);
        
        addLayer({
          id: newMaskId!,
          name: `遮罩 ${newMaskId}`,
          type: "shape",
          visible: true,
          locked: false,
          opacity: clonedMask.opacity || 1,
          blendMode: "source-over",
          fabricObject: clonedMask,
          isClipMask: true,
          originalMaskStyle: {
            fill: clipboardMaskObject.originalFill,
            stroke: clipboardMaskObject.originalStroke,
            strokeWidth: clipboardMaskObject.originalStrokeWidth || 0,
            opacity: clipboardMaskObject.originalOpacity || 1,
          },
        });
      });
    }
    
    // 貼上主物件
    clipboardObject.clone((cloned: any) => {
      const id = uuidv4().slice(0, 8);
      // 使用原始位置
      if (clipboardOriginalPosition) {
        cloned.set({
          left: clipboardOriginalPosition.left,
          top: clipboardOriginalPosition.top,
        });
      }
      cloned.id = id;
      cloned.name = `貼上物件 ${id}`;
      
      // 如果有遮罩，重建 clipPath
      if (newMaskId && clipboardMaskObject) {
        cloned.clipMaskId = newMaskId;
        
        // 建立 clipPath
        const maskLeft = clipboardMaskOriginalPosition?.left || 0;
        const maskTop = clipboardMaskOriginalPosition?.top || 0;
        const targetLeft = clipboardOriginalPosition?.left || 0;
        const targetTop = clipboardOriginalPosition?.top || 0;
        
        const offsetX = maskLeft - targetLeft;
        const offsetY = maskTop - targetTop;
        
        const clipProps = {
          left: offsetX,
          top: offsetY,
          scaleX: clipboardMaskObject.scaleX || 1,
          scaleY: clipboardMaskObject.scaleY || 1,
          angle: clipboardMaskObject.angle || 0,
          originX: 'center' as const,
          originY: 'center' as const,
          absolutePositioned: false,
        };
        
        let clipPath: any = null;
        const maskType = clipboardMaskObject.type;
        
        if (maskType === 'circle') {
          clipPath = new (window as any).fabric.Circle({
            radius: clipboardMaskObject.radius,
            ...clipProps,
          });
        } else if (maskType === 'rect') {
          clipPath = new (window as any).fabric.Rect({
            width: clipboardMaskObject.width,
            height: clipboardMaskObject.height,
            rx: clipboardMaskObject.rx,
            ry: clipboardMaskObject.ry,
            ...clipProps,
          });
        } else if (maskType === 'ellipse') {
          clipPath = new (window as any).fabric.Ellipse({
            rx: clipboardMaskObject.rx,
            ry: clipboardMaskObject.ry,
            ...clipProps,
          });
        } else if (maskType === 'triangle') {
          clipPath = new (window as any).fabric.Triangle({
            width: clipboardMaskObject.width,
            height: clipboardMaskObject.height,
            ...clipProps,
          });
        }
        
        if (clipPath) {
          cloned.clipPath = clipPath;
          cloned.dirty = true;
        }
      }
      
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.renderAll();
      
      addLayer({
        id,
        name: `貼上物件 ${id}`,
        type: cloned.type === 'image' ? 'image' : cloned.type === 'i-text' || cloned.type === 'textbox' ? 'text' : 'shape',
        visible: true,
        locked: false,
        opacity: cloned.opacity || 1,
        blendMode: "source-over",
        fabricObject: cloned,
        clipMaskId: newMaskId,
      });
    });
    closeMenu();
  };

  const handleDuplicate = () => {
    if (!canvas || !selectedObject || !selectedLayer) return;
    
    // 如果有遮罩，先複製遮罩物件
    let newMaskId: string | undefined;
    const maskLayer = selectedLayer.clipMaskId ? layers.find(l => l.id === selectedLayer.clipMaskId) : null;
    
    if (maskLayer?.fabricObject) {
      maskLayer.fabricObject.clone((clonedMask: any) => {
        newMaskId = uuidv4().slice(0, 8);
        clonedMask.set({
          left: (clonedMask.left || 0) + 20,
          top: (clonedMask.top || 0) + 20,
        });
        clonedMask.id = newMaskId;
        clonedMask.name = `${maskLayer.name} 複製`;
        clonedMask.isClipMask = true;
        clonedMask.originalFill = (maskLayer.fabricObject as any).originalFill;
        clonedMask.originalStroke = (maskLayer.fabricObject as any).originalStroke;
        clonedMask.originalStrokeWidth = (maskLayer.fabricObject as any).originalStrokeWidth;
        clonedMask.originalOpacity = (maskLayer.fabricObject as any).originalOpacity;
        
        canvas.add(clonedMask);
        
        addLayer({
          id: newMaskId!,
          name: `${maskLayer.name} 複製`,
          type: "shape",
          visible: true,
          locked: false,
          opacity: clonedMask.opacity || 1,
          blendMode: "source-over",
          fabricObject: clonedMask,
          isClipMask: true,
          originalMaskStyle: maskLayer.originalMaskStyle,
        });
      });
    }
    
    selectedObject.clone((cloned: any) => {
      const id = uuidv4().slice(0, 8);
      cloned.set({
        left: (cloned.left || 0) + 20,
        top: (cloned.top || 0) + 20,
      });
      cloned.id = id;
      cloned.name = `${selectedLayer?.name} 複製`;
      
      // 如果有遮罩，重建 clipPath
      if (newMaskId && maskLayer?.fabricObject) {
        cloned.clipMaskId = newMaskId;
        
        // 建立 clipPath（偏移量不變，因為都偏移 20）
        const clipProps = {
          left: 0,
          top: 0,
          scaleX: maskLayer.fabricObject.scaleX || 1,
          scaleY: maskLayer.fabricObject.scaleY || 1,
          angle: maskLayer.fabricObject.angle || 0,
          originX: 'center' as const,
          originY: 'center' as const,
          absolutePositioned: false,
        };
        
        let clipPath: any = null;
        const maskType = maskLayer.fabricObject.type;
        
        if (maskType === 'circle') {
          clipPath = new (window as any).fabric.Circle({
            radius: (maskLayer.fabricObject as any).radius,
            ...clipProps,
          });
        } else if (maskType === 'rect') {
          clipPath = new (window as any).fabric.Rect({
            width: (maskLayer.fabricObject as any).width,
            height: (maskLayer.fabricObject as any).height,
            rx: (maskLayer.fabricObject as any).rx,
            ry: (maskLayer.fabricObject as any).ry,
            ...clipProps,
          });
        } else if (maskType === 'ellipse') {
          clipPath = new (window as any).fabric.Ellipse({
            rx: (maskLayer.fabricObject as any).rx,
            ry: (maskLayer.fabricObject as any).ry,
            ...clipProps,
          });
        } else if (maskType === 'triangle') {
          clipPath = new (window as any).fabric.Triangle({
            width: (maskLayer.fabricObject as any).width,
            height: (maskLayer.fabricObject as any).height,
            ...clipProps,
          });
        }
        
        if (clipPath) {
          cloned.clipPath = clipPath;
          cloned.dirty = true;
        }
      }
      
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
        clipMaskId: newMaskId,
      });
    });
    closeMenu();
  };

  const handleDelete = () => {
    if (!canvas || !selectedObject || !selectedLayer) return;
    
    // 如果有遮罩，同時刪除遮罩物件
    if (selectedLayer.clipMaskId) {
      const maskLayer = layers.find(l => l.id === selectedLayer.clipMaskId);
      if (maskLayer?.fabricObject) {
        canvas.remove(maskLayer.fabricObject);
        removeLayer(maskLayer.id);
      }
    }
    
    // 如果此物件是遮罩，清除被遮罩物件的 clipPath
    if (selectedLayer.isClipMask) {
      const maskedLayers = layers.filter(l => l.clipMaskId === selectedLayer.id);
      maskedLayers.forEach(maskedLayer => {
        if (maskedLayer.fabricObject) {
          maskedLayer.fabricObject.clipPath = undefined;
          maskedLayer.fabricObject.dirty = true;
          (maskedLayer.fabricObject as any).clipMaskId = undefined;
          updateLayer(maskedLayer.id, { clipMaskId: undefined });
        }
      });
    }
    
    canvas.remove(selectedObject);
    canvas.discardActiveObject();
    canvas.renderAll();
    removeLayer(selectedLayer.id);
    closeMenu();
  };

  const handleBringToFront = () => {
    if (!canvas || !selectedObject) return;
    canvas.bringToFront(selectedObject);
    canvas.renderAll();
    closeMenu();
  };

  const handleSendToBack = () => {
    if (!canvas || !selectedObject) return;
    canvas.sendToBack(selectedObject);
    canvas.renderAll();
    closeMenu();
  };

  const handleBringForward = () => {
    if (!canvas || !selectedObject) return;
    canvas.bringForward(selectedObject);
    canvas.renderAll();
    closeMenu();
  };

  const handleSendBackward = () => {
    if (!canvas || !selectedObject) return;
    canvas.sendBackwards(selectedObject);
    canvas.renderAll();
    closeMenu();
  };

  // 建立群組
  const handleGroup = () => {
    if (!canvas) return;
    
    const activeObject = canvas.getActiveObject();
    if (!activeObject || activeObject.type !== 'activeSelection') {
      return;
    }
    
    const activeSelection = activeObject as fabric.ActiveSelection;
    const objectsToGroup = activeSelection.getObjects();
    
    if (objectsToGroup.length < 2) return;
    
    // 建立群組
    const group = activeSelection.toGroup();
    const groupId = uuidv4().slice(0, 8);
    (group as any).id = groupId;
    (group as any).name = `群組 ${groupId.slice(0, 4)}`;
    (group as any).isGroup = true;
    
    // 獲取被群組的物件 ID
    const groupedIds = objectsToGroup.map(obj => (obj as any).id).filter(Boolean);
    
    // 移除被群組的圖層
    const remainingLayers = layers.filter(l => !groupedIds.includes(l.id));
    
    // 建立群組圖層
    const groupLayer = {
      id: groupId,
      name: `群組 ${groupId.slice(0, 4)}`,
      type: 'group' as const,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'source-over' as const,
      fabricObject: group,
      isGroup: true,
      childIds: groupedIds,
    };
    
    useDesignStudioStore.setState({
      layers: [groupLayer, ...remainingLayers],
      selectedObjectIds: [groupId],
    });
    
    canvas.renderAll();
    closeMenu();
  };

  // 取消群組
  const handleUngroup = () => {
    if (!canvas || !selectedObject || !selectedLayer?.isGroup) return;
    
    const group = selectedObject as fabric.Group;
    const objects = group.getObjects();
    
    // 取消群組
    group.toActiveSelection();
    canvas.discardActiveObject();
    
    // 建立新的圖層
    const newLayers: any[] = [];
    objects.forEach((obj, index) => {
      const objId = (obj as any).id || uuidv4().slice(0, 8);
      const objName = (obj as any).name || `物件 ${index + 1}`;
      
      (obj as any).id = objId;
      (obj as any).name = objName;
      
      newLayers.push({
        id: objId,
        name: objName,
        type: obj.type === 'i-text' || obj.type === 'textbox' ? 'text' :
              obj.type === 'image' ? 'image' : 'shape',
        visible: obj.visible !== false,
        locked: !obj.selectable,
        opacity: obj.opacity || 1,
        blendMode: 'source-over',
        fabricObject: obj,
      });
    });
    
    // 更新圖層列表
    const layerIndex = layers.findIndex(l => l.id === selectedLayer.id);
    const otherLayers = layers.filter(l => l.id !== selectedLayer.id);
    
    useDesignStudioStore.setState({
      layers: [
        ...otherLayers.slice(0, layerIndex),
        ...newLayers,
        ...otherLayers.slice(layerIndex),
      ],
      selectedObjectIds: newLayers.map(l => l.id),
    });
    
    canvas.renderAll();
    closeMenu();
  };

  // 檢查是否可以建立群組
  const canGroup = canvas?.getActiveObject()?.type === 'activeSelection';
  
  // 檢查是否為群組
  const isGroup = selectedLayer?.isGroup;

  const handleFlipH = () => {
    if (!canvas || !selectedObject) return;
    selectedObject.set("flipX", !selectedObject.flipX);
    canvas.renderAll();
    closeMenu();
  };

  const handleFlipV = () => {
    if (!canvas || !selectedObject) return;
    selectedObject.set("flipY", !selectedObject.flipY);
    canvas.renderAll();
    closeMenu();
  };

  const handleToggleLock = () => {
    if (!selectedLayer || !selectedObject) return;
    const newLocked = !selectedLayer.locked;
    updateLayer(selectedLayer.id, { locked: newLocked });
    selectedObject.set({
      selectable: !newLocked,
      evented: !newLocked,
    });
    canvas?.renderAll();
    closeMenu();
  };

  const handleToggleVisible = () => {
    if (!selectedLayer || !selectedObject) return;
    const newVisible = !selectedLayer.visible;
    updateLayer(selectedLayer.id, { visible: newVisible });
    selectedObject.set("visible", newVisible);
    canvas?.renderAll();
    closeMenu();
  };

  const handleCenterH = () => {
    if (!canvas || !selectedObject) return;
    selectedObject.set("left", canvasWidth / 2);
    selectedObject.setCoords();
    canvas.renderAll();
    closeMenu();
  };

  const handleCenterV = () => {
    if (!canvas || !selectedObject) return;
    selectedObject.set("top", canvasHeight / 2);
    selectedObject.setCoords();
    canvas.renderAll();
    closeMenu();
  };

  const handleSelectAll = () => {
    if (!canvas) return;
    const objects = canvas.getObjects().filter((obj: any) => !obj.isGrid);
    if (objects.length > 0) {
      const selection = new (window as any).fabric.ActiveSelection(objects, { canvas });
      canvas.setActiveObject(selection);
      canvas.renderAll();
    }
    closeMenu();
  };

  if (!visible) return null;

  // 選單項目組件
  const MenuItem = ({ 
    icon: Icon, 
    label, 
    shortcut, 
    onClick, 
    disabled = false,
    danger = false,
  }: {
    icon: React.ElementType;
    label: string;
    shortcut?: string;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors",
        disabled 
          ? "text-slate-600 cursor-not-allowed" 
          : danger
            ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
            : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
      )}
    >
      <Icon className="w-4 h-4" />
      <span className="flex-1 text-left">{label}</span>
      {shortcut && (
        <span className="text-[10px] text-slate-500 font-mono">{shortcut}</span>
      )}
    </button>
  );

  const Divider = () => (
    <div className="h-px bg-slate-700/50 my-1" />
  );

  return (
    <div
      className={cn(
        "absolute z-[100] min-w-[200px] p-1.5",
        "bg-slate-900/95 backdrop-blur-md rounded-xl",
        "border border-slate-700/50 shadow-2xl shadow-black/50",
        "animate-in fade-in-0 zoom-in-95 duration-100"
      )}
      style={{
        left: position.x,
        top: position.y,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {hasSelection ? (
        <>
          {/* 編輯操作 */}
          <MenuItem icon={Scissors} label="剪下" shortcut="⌘X" onClick={handleCut} />
          <MenuItem icon={Copy} label="複製" shortcut="⌘C" onClick={handleCopy} />
          <MenuItem 
            icon={Clipboard} 
            label="貼上" 
            shortcut="⌘V" 
            onClick={handlePaste} 
            disabled={!clipboardObject}
          />
          <MenuItem icon={Copy} label="建立副本" shortcut="⌘D" onClick={handleDuplicate} />
          
          <Divider />
          
          {/* 對齊 */}
          <MenuItem icon={AlignCenterHorizontal} label="水平置中" onClick={handleCenterH} />
          <MenuItem icon={AlignCenterVertical} label="垂直置中" onClick={handleCenterV} />
          
          <Divider />
          
          {/* 翻轉 */}
          <MenuItem icon={FlipHorizontal} label="水平翻轉" onClick={handleFlipH} />
          <MenuItem icon={FlipVertical} label="垂直翻轉" onClick={handleFlipV} />
          
          <Divider />
          
          {/* 圖層順序 */}
          <MenuItem icon={Layers} label="移至最上層" onClick={handleBringToFront} />
          <MenuItem icon={ArrowUp} label="上移一層" onClick={handleBringForward} />
          <MenuItem icon={ArrowDown} label="下移一層" onClick={handleSendBackward} />
          <MenuItem icon={Layers} label="移至最下層" onClick={handleSendToBack} />
          
          <Divider />
          
          {/* 狀態切換 */}
          <MenuItem 
            icon={selectedLayer?.locked ? Unlock : Lock} 
            label={selectedLayer?.locked ? "解鎖" : "鎖定"} 
            onClick={handleToggleLock} 
          />
          <MenuItem 
            icon={selectedLayer?.visible ? EyeOff : Eye} 
            label={selectedLayer?.visible ? "隱藏" : "顯示"} 
            onClick={handleToggleVisible} 
          />
          
          <Divider />
          
          {/* 群組功能 */}
          {isGroup ? (
            <MenuItem icon={Ungroup} label="取消群組" shortcut="⇧⌘G" onClick={handleUngroup} />
          ) : canGroup ? (
            <MenuItem icon={Group} label="建立群組" shortcut="⌘G" onClick={handleGroup} />
          ) : null}
          
          {(isGroup || canGroup) && <Divider />}
          
          {/* 刪除 */}
          <MenuItem icon={Trash2} label="刪除" shortcut="Del" onClick={handleDelete} danger />
        </>
      ) : (
        <>
          {/* 無選取時的選單 */}
          <MenuItem 
            icon={Clipboard} 
            label="貼上" 
            shortcut="⌘V" 
            onClick={handlePaste} 
            disabled={!clipboardObject}
          />
          <MenuItem icon={LayoutGrid} label="全選" shortcut="⌘A" onClick={handleSelectAll} />
        </>
      )}
    </div>
  );
}
