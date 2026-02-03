"use client"; // 標記為客戶端組件

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getQuickFingerprint } from "@/lib/fingerprint";
import { toast } from "sonner";
import { Loader2, Mail, Lock, AlertCircle, KeyRound, HelpCircle } from "lucide-react";

// Google OAuth 配置
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const FACEBOOK_APP_ID = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || "";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    // 檢查是否因為 session 過期而跳轉
    if (typeof window !== 'undefined') {
      const expired = sessionStorage.getItem('session_expired');
      if (expired) {
        setSessionExpired(true);
        sessionStorage.removeItem('session_expired');
      }
    }
  }, []);

  const [isLoading, setIsLoading] = useState(false);
  const [riskWarning, setRiskWarning] = useState<string | null>(null);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Google 登入
  const handleGoogleLogin = () => {
    if (!GOOGLE_CLIENT_ID) {
      toast.error("Google 登入尚未配置");
      return;
    }
    setSocialLoading("google");
    const redirectUri = `${window.location.origin}/auth/callback/google`;
    const scope = "openid email profile";
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    window.location.href = authUrl.toString();
  };

  // Facebook 登入
  const handleFacebookLogin = () => {
    if (!FACEBOOK_APP_ID) {
      toast.error("Facebook 登入尚未配置");
      return;
    }
    setSocialLoading("facebook");
    const redirectUri = `${window.location.origin}/auth/callback/facebook`;
    const scope = "email,public_profile";
    const authUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
    authUrl.searchParams.set("client_id", FACEBOOK_APP_ID);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("response_type", "code");
    window.location.href = authUrl.toString();
  };

  const handleLogin = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setRiskWarning(null);
    
    try {
      // 收集裝置指紋（用於風險偵測）
      let fingerprint = null;
      let fingerprintData = null;
      
      try {
        const fp = await getQuickFingerprint();
        fingerprint = fp.hash;
        fingerprintData = fp.data;
      } catch (fpError) {
        console.warn("無法收集裝置指紋:", fpError);
        // 指紋收集失敗不影響登入
      }

      // 嘗試使用帶指紋的登入 API
      try {
        const res = await api.post("/auth/login-with-fingerprint", {
          email,
          password,
          fingerprint,
          fingerprint_data: fingerprintData,
        });

        // 儲存 Token
        localStorage.setItem("token", res.data.access_token);
        
        // 檢查風險警告
        if (res.data.risk_warning) {
          setRiskWarning(res.data.risk_warning);
          // 延遲 4 秒跳轉，讓用戶看到警告
          setTimeout(() => {
            router.push("/dashboard");
          }, 4000);
        } else {
          router.push("/dashboard");
        }
        
        return;
      } catch (fpLoginError: any) {
        // 如果帶指紋的登入失敗，降級到傳統登入
        if (fpLoginError.response?.status !== 404) {
          throw fpLoginError;
        }
      }
      
      // 降級：使用傳統登入 API (Form Data 格式)
      const formData = new FormData();
      formData.append("username", email);
      formData.append("password", password);

      const res = await api.post("/auth/login", formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
      });

      // 儲存 Token
      localStorage.setItem("token", res.data.access_token);
      router.push("/dashboard");
      
    } catch (error: any) {
      const errorDetail = error.response?.data?.detail;
      const statusCode = error.response?.status;
      
      // 檢查是否為社交登入帳號
      if (errorDetail?.type === "social_login_required") {
        const provider = errorDetail.provider;
        toast.info(errorDetail.message);
        
        // 延遲後自動跳轉到對應的社交登入
        setTimeout(() => {
          if (provider === "google") {
            handleGoogleLogin();
          } else if (provider === "facebook") {
            handleFacebookLogin();
          }
        }, 1500);
        return;
      }
      
      // 401 錯誤 - 帳號或密碼錯誤，顯示彈窗
      if (statusCode === 401) {
        setErrorMessage("帳號或密碼錯誤，請確認後再試");
        setShowErrorDialog(true);
        return;
      }
      
      const errorMsg = typeof errorDetail === "string" ? errorDetail : "登入失敗，請稍後再試";
      toast.error(errorMsg);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <Card className="w-full max-w-[400px] bg-slate-800 border-slate-700">
        <CardHeader>
          <div className="flex justify-center py-6">
            <Image
              src="/logo.png"
              alt="King Jam AI"
              width={400}
              height={400}
              className="h-[120px] w-auto rounded-2xl"
              priority
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
              }}
            />
          </div>
          <CardTitle className="text-center text-xl">歡迎回來</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sessionExpired && (
            <div className="bg-amber-500/20 border border-amber-500/50 text-amber-400 px-3 py-2 rounded-lg text-sm text-center">
              ⚠️ 登入已過期，請重新登入
            </div>
          )}
          {riskWarning && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-400 px-3 py-2 rounded-lg text-sm text-center">
              🚨 {riskWarning}
            </div>
          )}

          {/* 社交登入按鈕 */}
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full bg-white hover:bg-gray-100 text-gray-800 border-gray-300"
              onClick={handleGoogleLogin}
              disabled={socialLoading === "google"}
            >
              {socialLoading === "google" ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              使用 Google 登入
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white border-[#1877F2]"
              onClick={handleFacebookLogin}
              disabled={socialLoading === "facebook"}
            >
              {socialLoading === "facebook" ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              )}
              使用 Facebook 登入
            </Button>
          </div>

          {/* 分隔線 */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-600" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-800 px-2 text-slate-400">或使用 Email 登入</span>
            </div>
          </div>

          {/* Email 登入 */}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              className="pl-10"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              type="password" 
              placeholder="Password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              className="pl-10"
            />
          </div>
          <Button 
            className="w-full" 
            onClick={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                登入中...
              </span>
            ) : (
              "登入開始創作"
            )}
          </Button>

          {/* 忘記密碼/帳號連結 */}
          <div className="flex justify-center gap-4 text-sm">
            <Link 
              href="/forgot-password" 
              className="text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-1"
            >
              <KeyRound className="w-3.5 h-3.5" />
              忘記密碼
            </Link>
            <span className="text-slate-600">|</span>
            <Link 
              href="/forgot-account" 
              className="text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-1"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              忘記帳號
            </Link>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-slate-400">
            還沒有帳號？
            <Link href="/register" className="text-cyan-400 hover:underline ml-1">
              立即註冊
            </Link>
          </p>
        </CardFooter>
      </Card>

      {/* 登入錯誤彈窗 */}
      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent className="sm:max-w-md bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              登入失敗
            </DialogTitle>
            <DialogDescription className="text-slate-300 pt-2">
              {errorMessage}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-4">
            <p className="text-sm text-slate-400">
              如果您忘記了登入資訊，請嘗試：
            </p>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="w-full justify-start border-slate-600 hover:bg-slate-700"
                onClick={() => {
                  setShowErrorDialog(false);
                  router.push("/forgot-password");
                }}
              >
                <KeyRound className="w-4 h-4 mr-2 text-cyan-400" />
                重設密碼
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start border-slate-600 hover:bg-slate-700"
                onClick={() => {
                  setShowErrorDialog(false);
                  router.push("/forgot-account");
                }}
              >
                <HelpCircle className="w-4 h-4 mr-2 text-amber-400" />
                找回帳號
              </Button>
            </div>
            <Button
              className="w-full mt-2"
              onClick={() => {
                setShowErrorDialog(false);
                setEmail("");
                setPassword("");
              }}
            >
              再試一次
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}