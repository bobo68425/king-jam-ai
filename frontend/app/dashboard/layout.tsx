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
import { Menu, Crown, Star, Award, User, Settings, HelpCircle, LogOut, ChevronDown, Coins, Bell, Check, Sparkles, CreditCard, Gift, Shield, X } from "lucide-react";
import Image from "next/image";
import { Toaster } from "sonner";
import { ThemeSwitcher } from "@/components/theme-switcher";
import api from "@/lib/api";
import { CreditsProvider, useCredits } from "@/lib/credits-context";

// 會員等級配置
const TIER_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: typeof Crown }> = {
  free: { label: "免費版", color: "text-slate-400", bgColor: "bg-slate-500/20", icon: User },
  basic: { label: "入門版", color: "text-blue-400", bgColor: "bg-blue-500/20", icon: Star },
  pro: { label: "專業版", color: "text-purple-400", bgColor: "bg-purple-500/20", icon: Crown },
  enterprise: { label: "企業版", color: "text-amber-400", bgColor: "bg-amber-500/20", icon: Award },
  admin: { label: "管理員", color: "text-rose-400", bgColor: "bg-rose-500/20", icon: Crown },
};

// 夥伴層級配置
const PARTNER_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  bronze: { label: "銅牌", color: "text-orange-400", bgColor: "bg-orange-500/20" },
  silver: { label: "銀牌", color: "text-slate-300", bgColor: "bg-slate-400/20" },
  gold: { label: "金牌", color: "text-yellow-400", bgColor: "bg-yellow-500/20" },
};

interface UserInfo {
  email: string;
  full_name: string | null;
  avatar: string | null;
  tier: string;
  partner_tier: string;
}

// 通知類型（對應後端）
interface Notification {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

// 通知類型配置
const NOTIFICATION_CONFIG: Record<string, { icon: typeof Sparkles; color: string }> = {
  system: { icon: Settings, color: 'text-slate-400' },
  credit: { icon: CreditCard, color: 'text-amber-400' },
  referral: { icon: Gift, color: 'text-pink-400' },
  security: { icon: Shield, color: 'text-blue-400' },
  content: { icon: Sparkles, color: 'text-purple-400' },
};

// 格式化時間（客戶端專用）
function formatNotificationTime(dateStr: string, isMounted: boolean = true): string {
  if (!isMounted) return '...'; // SSR 時返回佔位符
  
  try {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return '剛剛';
  if (diffMins < 60) return `${diffMins} 分鐘前`;
  if (diffHours < 24) return `${diffHours} 小時前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return date.toLocaleDateString('zh-TW');
  } catch {
    return '...';
  }
}

// 內部組件，使用 Credits Context
function DashboardContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { credits, setCredits } = useCredits();
  
  // 客戶端掛載後才顯示
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // 獲取通知列表
  const fetchNotifications = async () => {
    try {
      const res = await api.get("/notifications?limit=10");
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };
  
  const markAsRead = async (id: number) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };
  
  const markAllAsRead = async () => {
    try {
      await api.post("/notifications/read-all");
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };
  
  const removeNotification = async (id: number) => {
    try {
      await api.delete(`/notifications/${id}`);
      const wasUnread = notifications.find(n => n.id === id && !n.is_read);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  useEffect(() => {
    const fetchUserInfo = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        // 獲取用戶資料和通知
        const [statsRes, balanceRes] = await Promise.allSettled([
          api.get("/referral/stats"),
          api.get("/credits/balance"),
        ]);

        if (statsRes.status === "fulfilled" && balanceRes.status === "fulfilled") {
          const stats = statsRes.value.data;
          const balance = balanceRes.value.data;
          setUserInfo({
            email: stats.email || "",
            full_name: stats.full_name,
            avatar: stats.avatar,
            tier: balance.tier || "free",
            partner_tier: stats.partner_tier || "bronze",
          });
          // 設置點數到 Context
          setCredits(balance.balance || 0);
        }
        
        // 獲取通知
        fetchNotifications();
      } catch (error) {
        console.error("Failed to fetch user info:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, [router, setCredits]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  const tierConfig = TIER_CONFIG[userInfo?.tier || "free"] || TIER_CONFIG.free;
  const partnerConfig = PARTNER_CONFIG[userInfo?.partner_tier || "bronze"] || PARTNER_CONFIG.bronze;
  const TierIcon = tierConfig.icon;

  return (
    <>
    <Toaster 
      position="top-center" 
      richColors 
      toastOptions={{
        className: "!bg-card !border-border !text-foreground",
      }}
    />
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* --- 電腦版側邊欄 (Desktop Sidebar) --- */}
      <aside className="hidden w-64 flex-col border-r border-border bg-sidebar md:flex">
        <div className="flex items-center justify-center border-b border-sidebar-border px-4 py-5 lg:px-6">
          <Link href="/dashboard" className="flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="King Jam AI"
              width={110}
              height={110}
              className="h-[110px] w-auto rounded-xl"
              priority
              onError={(e) => {
                // 圖片加載失敗時顯示文字 fallback
                const target = e.currentTarget;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent && !parent.querySelector('.logo-fallback')) {
                  const fallback = document.createElement('span');
                  fallback.className = 'logo-fallback text-lg font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent';
                  fallback.textContent = 'King Jam AI';
                  parent.appendChild(fallback);
                }
              }}
            />
            <span className="logo-fallback text-lg font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent hidden">
              King Jam AI
            </span>
          </Link>
        </div>
        <div className="flex-1 overflow-auto py-2 px-4">
          <DashboardNav />
        </div>
      </aside>

      {/* --- 主內容區 (Main Content Area) --- */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="flex h-14 items-center gap-4 border-b border-border bg-card px-4 lg:h-[60px] lg:px-6">
          {/* 手機版漢堡選單 (Mobile Trigger) */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col bg-sidebar border-sidebar-border p-0 w-[280px]">
              {/* Logo 區域 - 固定在頂部 */}
              <div className="flex-shrink-0 border-b border-sidebar-border">
                <Link href="/dashboard" className="flex items-center justify-center py-4">
                  <Image
                    src="/logo.png"
                    alt="King Jam AI"
                    width={90}
                    height={90}
                    className="h-[90px] w-auto rounded-xl"
                    priority
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent && !parent.querySelector('.logo-fallback')) {
                        const fallback = document.createElement('span');
                        fallback.className = 'logo-fallback text-lg font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent';
                        fallback.textContent = 'King Jam AI';
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                  <span className="logo-fallback text-lg font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent hidden">
                    King Jam AI
                  </span>
                </Link>
              </div>
              
              {/* 可滾動的導航區域 */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3">
                <DashboardNav />
              </div>
            </SheetContent>
          </Sheet>
          
          <div className="w-full flex-1">
             {/* 這裡未來可以放搜尋框 */}
          </div>

          {/* 點數顯示 */}
          <Link 
            href="/dashboard/credits"
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 hover:border-amber-500/40 transition-all"
          >
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-400">
              {credits?.toLocaleString() || 0}
            </span>
          </Link>

          {/* 主題切換 */}
          <ThemeSwitcher />

          {/* 通知中心 */}
          <DropdownMenu open={showNotifications} onOpenChange={setShowNotifications}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-rose-500 text-white text-[10px] font-bold rounded-full px-1 animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 bg-card border-border p-0">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  訊息中心
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-400 text-[10px] font-medium rounded-full">
                      {unreadCount} 則未讀
                    </span>
                  )}
                </h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    全部已讀
                  </button>
                )}
              </div>
              
              {/* Notifications List */}
              <div className="max-h-[360px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center">
                    <Bell className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">暫無通知</p>
                  </div>
                ) : (
                  notifications.map(notification => {
                    const config = NOTIFICATION_CONFIG[notification.notification_type] || NOTIFICATION_CONFIG.system;
                    const Icon = config.icon;
                    return (
                      <div
                        key={notification.id}
                        className={`px-4 py-3 border-b border-border/50 hover:bg-accent/50 transition-colors cursor-pointer ${
                          !notification.is_read ? 'bg-accent/30' : ''
                        }`}
                        onClick={() => markAsRead(notification.id)}
                      >
                        <div className="flex gap-3">
                          <div className={`w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0`}>
                            <Icon className={`w-4 h-4 ${config.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm font-medium ${notification.is_read ? 'text-muted-foreground' : 'text-foreground'}`}>
                                {notification.title}
                              </p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeNotification(notification.id);
                                }}
                                className="text-muted-foreground hover:text-foreground p-0.5"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            <p className={`text-xs mt-0.5 ${notification.is_read ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
                              {notification.message}
                            </p>
                            <p className="text-[10px] text-muted-foreground/70 mt-1" suppressHydrationWarning>{formatNotificationTime(notification.created_at, mounted)}</p>
                          </div>
                          {!notification.is_read && (
                            <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              
              {/* Footer */}
              <div className="px-4 py-2 border-t border-border">
                <Link
                  href="/dashboard/notifications"
                  className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground py-1"
                  onClick={() => setShowNotifications(false)}
                >
                  查看所有通知
                  <ChevronDown className="w-3 h-3 rotate-[-90deg]" />
                </Link>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* 用戶頭像選單 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-accent/50 transition-all group">
                {/* Avatar with gradient ring */}
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-0.5">
                    <Avatar className="h-full w-full border-2 border-card">
                      {userInfo?.avatar ? (
                        <AvatarImage src={userInfo.avatar.startsWith('http') ? userInfo.avatar : `${process.env.NEXT_PUBLIC_API_URL || ''}${userInfo.avatar}`} />
                      ) : null}
                      <AvatarFallback className="bg-card text-foreground text-sm font-medium">
                        {userInfo?.full_name?.[0] || userInfo?.email?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  {/* Online indicator */}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-card" />
                </div>

                {/* User info - hidden on small screens */}
                <div className="hidden lg:flex flex-col items-start">
                  <span className="text-sm font-medium text-foreground leading-tight">
                    {userInfo?.full_name || userInfo?.email?.split('@')[0] || "用戶"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {/* 會員等級 */}
                    <span className={`flex items-center gap-0.5 text-[10px] font-medium ${tierConfig.color}`}>
                      <TierIcon className="w-3 h-3" />
                      {tierConfig.label}
                    </span>
                    <span className="text-muted-foreground/50">•</span>
                    {/* 夥伴層級 */}
                    <span className={`text-[10px] font-medium ${partnerConfig.color}`}>
                      {partnerConfig.label}夥伴
                    </span>
                  </div>
                </div>

                <ChevronDown className="w-4 h-4 text-muted-foreground hidden lg:block group-hover:text-foreground transition-colors" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-card border-border">
              {/* User Header */}
              <div className="px-3 py-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-0.5">
                    <Avatar className="h-full w-full border-2 border-card">
                      {userInfo?.avatar ? (
                        <AvatarImage src={userInfo.avatar.startsWith('http') ? userInfo.avatar : `${process.env.NEXT_PUBLIC_API_URL || ''}${userInfo.avatar}`} />
                      ) : null}
                      <AvatarFallback className="bg-card text-foreground text-sm font-medium">
                        {userInfo?.full_name?.[0] || userInfo?.email?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {userInfo?.full_name || userInfo?.email?.split('@')[0] || "用戶"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{userInfo?.email}</p>
                  </div>
                </div>
                {/* Badges */}
                <div className="flex items-center gap-2 mt-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${tierConfig.bgColor} ${tierConfig.color}`}>
                    <TierIcon className="w-3 h-3" />
                    {tierConfig.label}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${partnerConfig.bgColor} ${partnerConfig.color}`}>
                    {partnerConfig.label}夥伴
                  </span>
                </div>
              </div>

              <div className="py-1">
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/profile" className="flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground cursor-pointer">
                    <User className="w-4 h-4" />
                    會員資料
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/credits" className="flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground cursor-pointer">
                    <Coins className="w-4 h-4" />
                    點數錢包
                    <span className="ml-auto text-xs text-amber-400 font-medium">
                      {credits?.toLocaleString() || 0} 點
                    </span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings" className="flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground cursor-pointer">
                    <Settings className="w-4 h-4" />
                    帳號設定
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/help" className="flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground cursor-pointer">
                    <HelpCircle className="w-4 h-4" />
                    幫助中心
                  </Link>
                </DropdownMenuItem>
              </div>

              <DropdownMenuSeparator className="bg-border" />
              
              <div className="py-1">
                <DropdownMenuItem 
                  onClick={handleLogout} 
                  className="flex items-center gap-2 px-3 py-2 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  登出帳號
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        
        {/* 頁面內容注入點 */}
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background min-w-0 overflow-x-auto">
          {children}
        </main>
      </div>
    </div>
    </>
  );
}

// 主導出：包裝 CreditsProvider
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CreditsProvider>
      <DashboardContent>{children}</DashboardContent>
    </CreditsProvider>
  );
}