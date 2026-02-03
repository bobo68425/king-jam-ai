"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Mail, ArrowLeft, CheckCircle, Send } from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!email) {
      toast.error("請輸入您的電子郵件");
      return;
    }

    // 簡單的 email 格式驗證
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("請輸入有效的電子郵件格式");
      return;
    }

    setIsLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setIsSuccess(true);
      toast.success("重設密碼郵件已發送");
    } catch (error: any) {
      const errorDetail = error.response?.data?.detail;
      // 為了安全，即使帳號不存在也顯示成功訊息
      if (error.response?.status === 404) {
        setIsSuccess(true);
        toast.success("如果此帳號存在，重設密碼郵件已發送");
      } else {
        const errorMsg = typeof errorDetail === "string" ? errorDetail : "發送失敗，請稍後再試";
        toast.error(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

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
          <CardTitle className="text-center text-xl">忘記密碼</CardTitle>
          <CardDescription className="text-center text-slate-400">
            {isSuccess 
              ? "請查看您的電子郵件" 
              : "輸入您的電子郵件，我們將發送重設密碼連結"
            }
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
                  我們已將重設密碼的連結發送到
                </p>
                <p className="text-cyan-400 font-medium">{email}</p>
                <p className="text-sm text-slate-400 mt-4">
                  請查看您的收件匣（包括垃圾郵件資料夾），<br />
                  連結將在 24 小時內有效。
                </p>
              </div>
              <div className="pt-4 space-y-2">
                <Button
                  variant="outline"
                  className="w-full border-slate-600 hover:bg-slate-700"
                  onClick={() => {
                    setIsSuccess(false);
                    setEmail("");
                  }}
                >
                  <Send className="w-4 h-4 mr-2" />
                  重新發送
                </Button>
                <Button
                  className="w-full"
                  onClick={() => router.push("/login")}
                >
                  返回登入
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="email"
                  placeholder="請輸入您的電子郵件"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
                  className="pl-10"
                />
              </div>
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    發送中...
                  </span>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    發送重設連結
                  </>
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
