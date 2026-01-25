"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Shield, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AdminGuardState {
  status: "loading" | "authorized" | "unauthorized" | "error";
  message?: string;
}

/**
 * 管理後台 Layout
 * 
 * 防護機制：
 * 1. 驗證用戶登入狀態
 * 2. 檢查管理員權限
 * 3. 記錄非法訪問嘗試
 * 4. 未授權時顯示警告並重定向
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [guardState, setGuardState] = useState<AdminGuardState>({ status: "loading" });
  const [countdown, setCountdown] = useState(5);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const verifyAdminAccess = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      
      // 未登入
      if (!token) {
        setGuardState({
          status: "unauthorized",
          message: "請先登入",
        });
        return;
      }

      // 驗證身份
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token 無效或過期
          localStorage.removeItem("token");
          setGuardState({
            status: "unauthorized",
            message: "登入已過期，請重新登入",
          });
          return;
        }
        throw new Error("驗證失敗");
      }

      const user = await response.json();

      if (!user.is_admin) {
        // 非管理員 - 記錄訪問嘗試
        await logUnauthorizedAccess(token, user.email);
        
        setGuardState({
          status: "unauthorized",
          message: "您沒有管理員權限",
        });
        return;
      }

      // 驗證通過
      setGuardState({ status: "authorized" });
    } catch (error) {
      console.error("Admin verification error:", error);
      setGuardState({
        status: "error",
        message: "驗證過程發生錯誤",
      });
    }
  }, [API_URL]);

  // 記錄非法訪問
  const logUnauthorizedAccess = async (token: string, email: string) => {
    try {
      await fetch(`${API_URL}/admin/security/log-access-attempt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          attempted_path: pathname,
          user_email: email,
        }),
      });
    } catch {
      // 記錄失敗不影響主流程
    }
  };

  useEffect(() => {
    verifyAdminAccess();
  }, [verifyAdminAccess]);

  // 未授權時的倒數計時
  useEffect(() => {
    if (guardState.status === "unauthorized" || guardState.status === "error") {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            router.push("/dashboard");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [guardState.status, router]);

  // 載入中
  if (guardState.status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">驗證管理員權限中...</p>
        </div>
      </div>
    );
  }

  // 未授權
  if (guardState.status === "unauthorized" || guardState.status === "error") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md border-destructive/50">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-destructive">
                  存取被拒絕
                </h2>
                <p className="text-muted-foreground">
                  {guardState.message || "您沒有權限訪問此頁面"}
                </p>
              </div>

              <div className="pt-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  {countdown} 秒後自動返回儀表板
                </p>
                <Button 
                  onClick={() => router.push("/dashboard")}
                  className="w-full"
                >
                  立即返回
                </Button>
              </div>

              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Shield className="h-3 w-3" />
                  此訪問嘗試已被記錄
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 授權通過
  return <>{children}</>;
}
