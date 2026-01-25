"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const errorParam = searchParams.get("error");

      if (errorParam) {
        setError("Google 登入已取消");
        setTimeout(() => router.push("/login"), 2000);
        return;
      }

      if (!code) {
        setError("無效的回調參數");
        setTimeout(() => router.push("/login"), 2000);
        return;
      }

      try {
        const redirectUri = `${window.location.origin}/auth/callback/google`;
        
        // 呼叫後端 API 完成登入
        const res = await api.post("/auth/google", {
          code,
          redirect_uri: redirectUri,
        });

        // 儲存 Token
        localStorage.setItem("token", res.data.access_token);
        
        // 清除推薦碼
        sessionStorage.removeItem("referral_code");
        
        toast.success("登入成功！");
        router.push("/dashboard");
      } catch (err: any) {
        console.error("Google login error:", err);
        const msg = err.response?.data?.detail || "Google 登入失敗";
        setError(msg);
        toast.error(msg);
        setTimeout(() => router.push("/login"), 3000);
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900">
      <div className="text-center space-y-4">
        {error ? (
          <>
            <div className="text-red-400 text-lg">{error}</div>
            <p className="text-slate-400">正在返回登入頁面...</p>
          </>
        ) : (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-cyan-400 mx-auto" />
            <p className="text-slate-300">正在完成 Google 登入...</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-900">
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-cyan-400 mx-auto" />
            <p className="text-slate-300">載入中...</p>
          </div>
        </div>
      }
    >
      <GoogleCallbackContent />
    </Suspense>
  );
}
