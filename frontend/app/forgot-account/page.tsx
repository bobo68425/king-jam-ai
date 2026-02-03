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
import { Loader2, Phone, ArrowLeft, CheckCircle, Search, User, Mail } from "lucide-react";

export default function ForgotAccountPage() {
  const router = useRouter();
  const [searchType, setSearchType] = useState<"phone" | "name">("phone");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [foundAccounts, setFoundAccounts] = useState<string[]>([]);
  const [notFound, setNotFound] = useState(false);

  const handleSearch = async () => {
    if (searchType === "phone" && !phone) {
      toast.error("請輸入您的手機號碼");
      return;
    }
    if (searchType === "name" && !fullName) {
      toast.error("請輸入您的姓名");
      return;
    }

    setIsLoading(true);
    setNotFound(false);
    setFoundAccounts([]);

    try {
      const response = await api.post("/auth/find-account", {
        phone: searchType === "phone" ? phone : undefined,
        full_name: searchType === "name" ? fullName : undefined,
      });
      
      if (response.data.accounts && response.data.accounts.length > 0) {
        setFoundAccounts(response.data.accounts);
      } else {
        setNotFound(true);
      }
    } catch (error: any) {
      const statusCode = error.response?.status;
      if (statusCode === 404) {
        setNotFound(true);
      } else {
        const errorDetail = error.response?.data?.detail;
        const errorMsg = typeof errorDetail === "string" ? errorDetail : "查詢失敗，請稍後再試";
        toast.error(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const maskEmail = (email: string) => {
    const [localPart, domain] = email.split("@");
    if (localPart.length <= 3) {
      return `${localPart[0]}***@${domain}`;
    }
    const visibleStart = localPart.slice(0, 2);
    const visibleEnd = localPart.slice(-1);
    return `${visibleStart}***${visibleEnd}@${domain}`;
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
          <CardTitle className="text-center text-xl">找回帳號</CardTitle>
          <CardDescription className="text-center text-slate-400">
            輸入您註冊時使用的資訊來找回帳號
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {foundAccounts.length > 0 ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
              </div>
              <p className="text-center text-slate-300">
                找到以下帳號：
              </p>
              <div className="space-y-2">
                {foundAccounts.map((account, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg border border-slate-600"
                  >
                    <Mail className="w-5 h-5 text-cyan-400" />
                    <span className="text-slate-200 font-mono">
                      {maskEmail(account)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-slate-400 text-center">
                為保護您的隱私，部分字元已隱藏
              </p>
              <div className="pt-2 space-y-2">
                <Button
                  className="w-full"
                  onClick={() => router.push("/login")}
                >
                  前往登入
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-slate-600 hover:bg-slate-700"
                  onClick={() => router.push("/forgot-password")}
                >
                  忘記密碼？重設密碼
                </Button>
              </div>
            </div>
          ) : notFound ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-amber-400" />
                </div>
              </div>
              <p className="text-center text-slate-300">
                找不到符合的帳號
              </p>
              <p className="text-sm text-slate-400 text-center">
                請確認您輸入的資訊正確，或嘗試其他方式查詢
              </p>
              <div className="pt-2 space-y-2">
                <Button
                  variant="outline"
                  className="w-full border-slate-600 hover:bg-slate-700"
                  onClick={() => {
                    setNotFound(false);
                    setPhone("");
                    setFullName("");
                  }}
                >
                  重新查詢
                </Button>
                <Button
                  className="w-full"
                  onClick={() => router.push("/register")}
                >
                  建立新帳號
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* 搜尋方式選擇 */}
              <div className="flex gap-2">
                <Button
                  variant={searchType === "phone" ? "default" : "outline"}
                  className={`flex-1 ${searchType !== "phone" ? "border-slate-600" : ""}`}
                  onClick={() => setSearchType("phone")}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  手機號碼
                </Button>
                <Button
                  variant={searchType === "name" ? "default" : "outline"}
                  className={`flex-1 ${searchType !== "name" ? "border-slate-600" : ""}`}
                  onClick={() => setSearchType("name")}
                >
                  <User className="w-4 h-4 mr-2" />
                  姓名
                </Button>
              </div>

              {/* 搜尋輸入 */}
              {searchType === "phone" ? (
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="tel"
                    placeholder="請輸入您註冊時的手機號碼"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={isLoading}
                    onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                    className="pl-10"
                  />
                </div>
              ) : (
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="請輸入您註冊時的姓名"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={isLoading}
                    onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                    className="pl-10"
                  />
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleSearch}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    查詢中...
                  </span>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    查詢帳號
                  </>
                )}
              </Button>

              <p className="text-xs text-slate-500 text-center">
                提示：手機號碼或姓名必須與註冊時填寫的資訊完全一致
              </p>
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
