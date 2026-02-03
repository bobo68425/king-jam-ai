/**
 * 鍵盤快捷鍵工具
 * 自動判斷 Mac/Windows 並顯示對應的快捷鍵符號
 * 
 * 注意：為避免 React Hydration 錯誤，請使用 useIsMac() hook 或 <Kbd> 組件
 */

import { useState, useEffect } from 'react';

// 快取結果
let cachedIsMac: boolean | null = null;

// 檢測是否為 Mac 系統（僅在客戶端使用）
export function isMacClient(): boolean {
  if (typeof window === 'undefined') {
    return true; // SSR fallback
  }
  if (cachedIsMac === null) {
    cachedIsMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 ||
                  navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
  }
  return cachedIsMac;
}

// React Hook：安全地檢測是否為 Mac（避免 hydration 問題）
export function useIsMac(): boolean {
  const [isMacOS, setIsMacOS] = useState(true); // 預設 Mac

  useEffect(() => {
    setIsMacOS(isMacClient());
  }, []);

  return isMacOS;
}

// 向後兼容的 isMac 函數（SSR 時返回 true）
export function isMac(): boolean {
  if (typeof window === 'undefined') {
    return true; // SSR 時預設為 Mac
  }
  return isMacClient();
}

// 修飾鍵符號
export const modifierKeys = {
  // Mac 符號
  mac: {
    cmd: '⌘',
    ctrl: '⌃',
    alt: '⌥',
    shift: '⇧',
    enter: '↵',
    backspace: '⌫',
    delete: '⌦',
    escape: 'Esc',
    tab: '⇥',
    up: '↑',
    down: '↓',
    left: '←',
    right: '→',
  },
  // Windows 符號
  win: {
    cmd: 'Ctrl',
    ctrl: 'Ctrl',
    alt: 'Alt',
    shift: 'Shift',
    enter: 'Enter',
    backspace: 'Backspace',
    delete: 'Del',
    escape: 'Esc',
    tab: 'Tab',
    up: '↑',
    down: '↓',
    left: '←',
    right: '→',
  },
};

// 取得當前系統的修飾鍵符號
export function getModifierKey(key: keyof typeof modifierKeys.mac): string {
  return isMac() ? modifierKeys.mac[key] : modifierKeys.win[key];
}

// 格式化快捷鍵顯示
// 輸入: "cmd+s" 或 "cmd+shift+s"
// 輸出: Mac: "⌘S" 或 "⌘⇧S", Windows: "Ctrl+S" 或 "Ctrl+Shift+S"
export function formatShortcut(shortcut: string): string {
  const isMacOS = isMac();
  const keys = shortcut.toLowerCase().split('+');
  
  const formattedKeys = keys.map(key => {
    switch (key) {
      case 'cmd':
      case 'command':
      case 'meta':
        return isMacOS ? '⌘' : 'Ctrl';
      case 'ctrl':
      case 'control':
        return isMacOS ? '⌃' : 'Ctrl';
      case 'alt':
      case 'option':
        return isMacOS ? '⌥' : 'Alt';
      case 'shift':
        return isMacOS ? '⇧' : 'Shift';
      case 'enter':
      case 'return':
        return isMacOS ? '↵' : 'Enter';
      case 'backspace':
        return isMacOS ? '⌫' : 'Backspace';
      case 'delete':
      case 'del':
        return isMacOS ? '⌦' : 'Del';
      case 'escape':
      case 'esc':
        return 'Esc';
      case 'tab':
        return isMacOS ? '⇥' : 'Tab';
      case 'space':
        return 'Space';
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      case 'left':
        return '←';
      case 'right':
        return '→';
      default:
        // 單個字母或數字，大寫顯示
        return key.toUpperCase();
    }
  });

  // Mac 使用符號連接，Windows 使用 + 連接
  return isMacOS ? formattedKeys.join('') : formattedKeys.join('+');
}

// 快捷鍵常用預設
export const shortcuts = {
  save: () => formatShortcut('cmd+s'),
  saveAs: () => formatShortcut('cmd+shift+s'),
  new: () => formatShortcut('cmd+n'),
  open: () => formatShortcut('cmd+o'),
  undo: () => formatShortcut('cmd+z'),
  redo: () => formatShortcut('cmd+shift+z'),
  copy: () => formatShortcut('cmd+c'),
  paste: () => formatShortcut('cmd+v'),
  cut: () => formatShortcut('cmd+x'),
  duplicate: () => formatShortcut('cmd+d'),
  delete: () => isMac() ? '⌫' : 'Del',
  selectAll: () => formatShortcut('cmd+a'),
  export: () => formatShortcut('cmd+e'),
  zoomIn: () => formatShortcut('cmd++'),
  zoomOut: () => formatShortcut('cmd+-'),
  zoomReset: () => formatShortcut('cmd+0'),
};

// 格式化快捷鍵（接受 isMac 參數，用於 hook）
export function formatShortcutWithOS(shortcut: string, isMacOS: boolean): string {
  const keys = shortcut.toLowerCase().split('+');
  
  const formattedKeys = keys.map(key => {
    switch (key) {
      case 'cmd':
      case 'command':
      case 'meta':
        return isMacOS ? '⌘' : 'Ctrl';
      case 'ctrl':
      case 'control':
        return isMacOS ? '⌃' : 'Ctrl';
      case 'alt':
      case 'option':
        return isMacOS ? '⌥' : 'Alt';
      case 'shift':
        return isMacOS ? '⇧' : 'Shift';
      case 'enter':
      case 'return':
        return isMacOS ? '↵' : 'Enter';
      case 'backspace':
        return isMacOS ? '⌫' : 'Backspace';
      case 'delete':
      case 'del':
        return isMacOS ? '⌦' : 'Del';
      case 'escape':
      case 'esc':
        return 'Esc';
      case 'tab':
        return isMacOS ? '⇥' : 'Tab';
      case 'space':
        return 'Space';
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      case 'left':
        return '←';
      case 'right':
        return '→';
      default:
        return key.toUpperCase();
    }
  });

  return isMacOS ? formattedKeys.join('') : formattedKeys.join('+');
}

// React Hook: 用於在組件中取得快捷鍵顯示（避免 hydration 問題）
export function useShortcutDisplay() {
  const isMacOS = useIsMac();
  
  return {
    isMac: isMacOS,
    formatShortcut: (shortcut: string) => formatShortcutWithOS(shortcut, isMacOS),
    modKey: isMacOS ? '⌘' : 'Ctrl',
    deleteKey: isMacOS ? '⌫' : 'Del',
  };
}
