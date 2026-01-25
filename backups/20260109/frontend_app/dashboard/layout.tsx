"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardNav } from "@/components/dashboard-nav";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu } from "lucide-react";
import Image from "next/image";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    // 簡單的客戶端驗證，如果沒 Token 就踢回登入頁
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
    } else {
      // 實際專案這裡應該呼叫 /users/me API 拿資料
      setUserEmail("User"); 
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* --- 電腦版側邊欄 (Desktop Sidebar) --- */}
      <aside className="hidden w-64 flex-col border-r bg-slate-900 md:flex">
        <div className="flex items-center justify-center border-b border-slate-700 px-4 py-5 lg:px-6">
          <Link href="/dashboard" className="flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="KING JINK AI"
              width={390}
              height={130}
              className="h-[83px] w-auto"
              priority
              onError={(e) => {
                // 圖片加載失敗時顯示文字 fallback
                const target = e.currentTarget;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent && !parent.querySelector('.logo-fallback')) {
                  const fallback = document.createElement('span');
                  fallback.className = 'logo-fallback text-lg font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent';
                  fallback.textContent = 'KING JINK AI';
                  parent.appendChild(fallback);
                }
              }}
            />
            <span className="logo-fallback text-lg font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent hidden">
              KING JINK AI
            </span>
          </Link>
        </div>
        <div className="flex-1 overflow-auto py-2 px-4">
          <DashboardNav />
        </div>
      </aside>

      {/* --- 主內容區 (Main Content Area) --- */}
      <div className="flex flex-1 flex-col">
        {/* Top Header */}
        <header className="flex h-14 items-center gap-4 border-b border-slate-700 bg-slate-800 px-4 lg:h-[60px] lg:px-6">
          {/* 手機版漢堡選單 (Mobile Trigger) */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col bg-slate-900 border-slate-700">
              <nav className="grid gap-2 text-lg font-medium">
                <Link href="/dashboard" className="flex items-center justify-center py-5">
                  <Image
                    src="/logo.png"
                    alt="KING JINK AI"
                    width={390}
                    height={130}
                    className="h-[83px] w-auto"
                    priority
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent && !parent.querySelector('.logo-fallback')) {
                        const fallback = document.createElement('span');
                        fallback.className = 'logo-fallback text-lg font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent';
                        fallback.textContent = 'KING JINK AI';
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                  <span className="logo-fallback text-lg font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent hidden">
                    KING JINK AI
                  </span>
                </Link>
                <DashboardNav />
              </nav>
            </SheetContent>
          </Sheet>
          
          <div className="w-full flex-1">
             {/* 這裡未來可以放搜尋框 */}
          </div>
          
          {/* 用戶頭像選單 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="" /> {/* 之後接 API 顯示頭像 */}
                  <AvatarFallback>KJ</AvatarFallback>
                </Avatar>
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>設定</DropdownMenuItem>
              <DropdownMenuItem>客服支援</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
                登出
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        
        {/* 頁面內容注入點 */}
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-slate-900">
          {children}
        </main>
      </div>
    </div>
  );
}