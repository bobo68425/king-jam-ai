"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import api from "@/lib/api";

interface CreditsContextType {
  credits: number;
  setCredits: (credits: number) => void;
  refreshCredits: () => Promise<void>;
  deductCredits: (amount: number) => void;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export function CreditsProvider({ children, initialCredits = 0 }: { children: ReactNode; initialCredits?: number }) {
  const [credits, setCredits] = useState(initialCredits);

  const refreshCredits = useCallback(async () => {
    try {
      const res = await api.get("/credits/balance");
      setCredits(res.data.balance || 0);
    } catch (error) {
      console.error("Failed to refresh credits:", error);
    }
  }, []);

  const deductCredits = useCallback((amount: number) => {
    setCredits(prev => Math.max(0, prev - amount));
  }, []);

  return (
    <CreditsContext.Provider value={{ credits, setCredits, refreshCredits, deductCredits }}>
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
