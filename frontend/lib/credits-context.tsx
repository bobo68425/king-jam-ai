"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import api from "@/lib/api";

interface CreditsContextType {
  credits: number;
  setCredits: (credits: number) => void;
  refreshCredits: () => Promise<void>;
  deductCredits: (amount: number) => void;
  isSuperAdmin: boolean;
  setIsSuperAdmin: (val: boolean) => void;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export function CreditsProvider({ children, initialCredits = 0 }: { children: ReactNode; initialCredits?: number }) {
  const [credits, setCredits] = useState(initialCredits);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const refreshCredits = useCallback(async () => {
    // 未登入時不發送需要 Token 的請求，避免 console 出現 401 錯誤
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
      return;
    }
    try {
      const res = await api.get("/credits/balance");
      setCredits(res.data.balance || 0);
      setIsSuperAdmin(res.data.is_super_admin || false);
    } catch (error) {
      console.error("Failed to refresh credits:", error);
    }
  }, []);

  const deductCredits = useCallback((amount: number) => {
    setCredits(prev => Math.max(0, prev - amount));
  }, []);

  return (
    <CreditsContext.Provider value={{ credits, setCredits, refreshCredits, deductCredits, isSuperAdmin, setIsSuperAdmin }}>
      {children}
    </CreditsContext.Provider>
  );
}

export function useCredits() {
  const context = useContext(CreditsContext);
  if (context === undefined) {
    throw new Error("useCredits must be used within a CreditsProvider");
  }
  return context;
}

// 用於 layout 初始化的 hook
export function useCreditsOptional() {
  return useContext(CreditsContext);
}
