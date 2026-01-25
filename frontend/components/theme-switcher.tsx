"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type ThemeMode = "light" | "dark" | "system" | "auto";

export function ThemeSwitcher() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [autoMode, setAutoMode] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);

  // 確保 hydration 完成
  React.useEffect(() => {
    setMounted(true);
    // 檢查是否為自動模式
    const savedAutoMode = localStorage.getItem("theme-auto-mode") === "true";
    setAutoMode(savedAutoMode);
  }, []);

  // 自動依時區切換
  React.useEffect(() => {
    if (!autoMode) return;

    const checkAndSetTheme = () => {
      const hour = new Date().getHours();
      // 早上 6 點到晚上 6 點使用淺色主題
      const shouldBeDark = hour < 6 || hour >= 18;
      setTheme(shouldBeDark ? "dark" : "light");
    };

    checkAndSetTheme();
    // 每分鐘檢查一次
    const interval = setInterval(checkAndSetTheme, 60000);
    return () => clearInterval(interval);
  }, [autoMode, setTheme]);

  const handleModeChange = (mode: ThemeMode) => {
    if (mode === "auto") {
      setAutoMode(true);
      localStorage.setItem("theme-auto-mode", "true");
      // 立即根據時間設定
      const hour = new Date().getHours();
      setTheme(hour < 6 || hour >= 18 ? "dark" : "light");
    } else {
      setAutoMode(false);
      localStorage.setItem("theme-auto-mode", "false");
      setTheme(mode);
    }
    setIsOpen(false);
  };

  if (!mounted) {
    return (
      <div className="h-9 w-9 rounded-lg bg-muted animate-pulse" />
    );
  }

  const currentMode: ThemeMode = autoMode ? "auto" : (theme as ThemeMode) || "system";
  const isDark = resolvedTheme === "dark";

  const modes = [
    { value: "light" as ThemeMode, icon: Sun, label: "淺色模式" },
    { value: "dark" as ThemeMode, icon: Moon, label: "深色模式" },
    { value: "system" as ThemeMode, icon: Monitor, label: "跟隨系統" },
    { value: "auto" as ThemeMode, icon: Clock, label: "自動切換 (6AM-6PM)" },
  ];

  const CurrentIcon = autoMode 
    ? Clock 
    : isDark ? Moon : Sun;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-300",
          "hover:bg-accent hover:scale-105 active:scale-95",
          isDark 
            ? "bg-slate-800/50 text-amber-400 hover:text-amber-300" 
            : "bg-slate-100 text-amber-600 hover:text-amber-500"
        )}
        aria-label="切換主題"
      >
        <CurrentIcon className="h-[18px] w-[18px] transition-transform duration-500" />
      </button>

      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* 下拉選單 */}
          <div className={cn(
            "absolute right-0 top-full mt-2 z-50 min-w-[180px] rounded-xl p-1.5 shadow-xl",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200",
            isDark 
              ? "bg-slate-800 border border-slate-700" 
              : "bg-white border border-slate-200"
          )}>
            {modes.map((mode) => {
              const Icon = mode.icon;
              const isActive = currentMode === mode.value;
              
              return (
                <button
                  key={mode.value}
                  onClick={() => handleModeChange(mode.value)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? isDark
                        ? "bg-indigo-600/20 text-indigo-400"
                        : "bg-indigo-50 text-indigo-600"
                      : isDark
                        ? "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <Icon className={cn(
                    "h-4 w-4",
                    isActive && (isDark ? "text-indigo-400" : "text-indigo-500")
                  )} />
                  <span className="flex-1 text-left">{mode.label}</span>
                  {isActive && (
                    <div className={cn(
                      "h-2 w-2 rounded-full",
                      isDark ? "bg-indigo-400" : "bg-indigo-500"
                    )} />
                  )}
                </button>
              );
            })}
            
            {/* 自動模式說明 */}
            <div className={cn(
              "mt-1.5 px-3 py-2 text-xs rounded-lg",
              isDark ? "bg-slate-700/30 text-slate-500" : "bg-slate-50 text-slate-500"
            )}>
              💡 自動模式會依據當地時間切換：
              <br />• 06:00-18:00 淺色
              <br />• 18:00-06:00 深色
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// 簡易切換按鈕（可用於導航列）
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-9 w-9 rounded-lg bg-muted animate-pulse" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-300",
        "hover:scale-105 active:scale-95",
        isDark 
          ? "bg-slate-800/50 hover:bg-slate-700" 
          : "bg-slate-100 hover:bg-slate-200"
      )}
      aria-label={isDark ? "切換到淺色模式" : "切換到深色模式"}
    >
      <Sun className={cn(
        "absolute h-[18px] w-[18px] transition-all duration-500",
        isDark 
          ? "rotate-90 scale-0 text-amber-400" 
          : "rotate-0 scale-100 text-amber-600"
      )} />
      <Moon className={cn(
        "absolute h-[18px] w-[18px] transition-all duration-500",
        isDark 
          ? "rotate-0 scale-100 text-amber-400" 
          : "-rotate-90 scale-0 text-amber-600"
      )} />
    </button>
  );
}
