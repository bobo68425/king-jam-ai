"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Lock, ArrowLeft, CheckCircle, Eye, EyeOff, ShieldCheck } from "lucide-react";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isInvalidToken, setIsInvalidToken] = useState(false);

  useEffect(() => {
    if (!token) {
      setIsInvalidToken(true);
    }
  }, [token]);

  const handleSubmit = async () => {
    if (!password) {
      toast.error("請輸入新密碼");
      return;
    }

    if (password.length < 6) {
      toast.error("密碼長度至少需要 6 個字元");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("兩次輸入的密碼不一致");
      return;
    }

    setIsLoading(true);
    try {
      await api.post("/auth/reset-password", {
        token,
        new_password: password,
      });
      setIsSuccess(true);
      toast.success("密碼重設成功");
    } catch (error: any) {
      const errorDetail = error.response?.data?.detail;
      const errorMsg = typeof errorDetail === "string" ? errorDetail : "重設失敗，請稍後再試";
      toast.error(errorMsg);
      
      if (error.response?.status === 400) {
        setIsInvalidToken(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isInvalidToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
        <Card className="w-full max-w-[400px] bg-slate-800 border-slate-700">
          <CardHeader>
            <div className="flex justify-center py-4">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                <ShieldCheck className="w-8 h-8 text-red-400" />
              </div>
            </div>
            <CardTitle className="text-center text-xl text-red-400">連結無效</CardTitle>
            <CardDescription className="text-center text-slate-400">
              此重設密碼連結已過期或無效
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-400 text-center">
              重設密碼連結的有效期為 24 小時。<br />
              請重新申請重設密碼。
            </p>
            <div className="pt-2 space-y-2">
              <Button
                className="w-full"
                onClick={() => router.push("/forgot-password")}
              >
                重新申請重設密碼
              </Button>
              <Button
                variant="outline"
                className="w-full border-slate-600 hover:bg-slate-700"
                onClick={() => router.push("/login")}
              >
                返回登入
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <Card className="w-full max-w-[400px] bg-slate-800 border-slate-700">
        <CardHeader>
          <div className="flex justify-center py-4">
            <Image
              src="/logo.png"
              alt="King Jam AI"
              width={200}
              height={200}
              className="h-[80px] w-auto rounded-2xl"
              priority
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
              }}
            />
          </div>
          <CardTitle className="text-center text-xl">重設密碼</CardTitle>
          <CardDescription className="text-center text-slate-400">
            {isSuccess ? "密碼已成功重設" : "請輸入您的新密碼"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSuccess ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-slate-300">
                  您的密碼已成功重設！
                </p>
                <p className="text-sm text-slate-400">
                  請使用新密碼登入您的帳號
                </p>
              </div>
              <div className="pt-4">
                <Button
                  className="w-full"
                  onClick={() => router.push("/login")}
                >
                  前往登入
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="請輸入新密碼（至少 6 個字元）"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="請再次輸入新密碼"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
                  className="pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-300"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              
              {/* 密碼強度提示 */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <div className={`w-2 h-2 rounded-full ${password.length >= 6 ? "bg-green-400" : "bg-slate-600"}`} />
                  <span className={password.length >= 6 ? "text-green-400" : "text-slate-500"}>
                    至少 6 個字元
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className={`w-2 h-2 rounded-full ${password === confirmPassword && password.length > 0 ? "bg-green-400" : "bg-slate-600"}`} />
                  <span className={password === confirmPassword && password.length > 0 ? "text-green-400" : "text-slate-500"}>
                    密碼確認一致
                  </span>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={isLoading || password.length < 6 || password !== confirmPassword}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    重設中...
                  </span>
                ) : (
                  "確認重設密碼"
                )}
              </Button>
            </>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link
            href="/login"
            className="text-sm text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            返回登入頁面
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
