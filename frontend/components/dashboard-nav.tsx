"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  PenTool, 
  Image as ImageIcon, 
  Video, 
  Calendar,
  Settings,
  Coins,
  History,
  Share2,
  HelpCircle,
  Gift,
  User,
  Users,
  Crown,
  BarChart3,
  Palette,
  Shield,
  ShieldAlert,
  FileText,
  Layers,
  Wallet,
  Bell,
  Megaphone,
} from "lucide-react";

const navItems = [
  { 
    section: "總覽",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "儀表板" },
    ]
  },
  {
    section: "AI 生成引擎",
    items: [
      { href: "/dashboard/blog", icon: PenTool, label: "部落格文章" },
      { href: "/dashboard/social", icon: ImageIcon, label: "社群圖文" },
      { href: "/dashboard/video", icon: Video, label: "短影音生成", isNew: true },
      { href: "/dashboard/design-studio", icon: Layers, label: "圖片編輯室", isNew: true, isPro: true },
    ]
  },
  {
    section: "發布管理",
    items: [
      { href: "/dashboard/scheduler", icon: Calendar, label: "排程上架" },
      { href: "/dashboard/accounts", icon: Share2, label: "社群帳號" },
      { href: "/dashboard/insights", icon: BarChart3, label: "成效洞察", isNew: true },
    ]
  },
  {
    section: "會員中心",
    items: [
      { href: "/dashboard/profile", icon: User, label: "會員資料" },
      { href: "/dashboard/notifications", icon: Bell, label: "通知中心" },
      { href: "/dashboard/subscription", icon: Crown, label: "訂閱管理" },
      { href: "/dashboard/verification", icon: Shield, label: "身份認證", isNew: true },
      { href: "/dashboard/pricing", icon: Coins, label: "購買點數" },
      { href: "/dashboard/referral", icon: Gift, label: "推薦獎勵" },
      { href: "/dashboard/credits", icon: Wallet, label: "點數錢包" },
      { href: "/dashboard/history", icon: History, label: "生成紀錄" },
      { href: "/dashboard/settings", icon: Settings, label: "帳號設定" },
      { href: "/dashboard/settings/brand-kit", icon: Palette, label: "品牌資產包" },
    ]
  },
];

// 管理員專屬選單
const adminNavItems = [
  {
    section: "管理後台",
    items: [
      { href: "/dashboard/admin", icon: BarChart3, label: "總覽儀表板" },
      { href: "/dashboard/admin/users", icon: Users, label: "用戶管理" },
      { href: "/dashboard/admin/verification", icon: Shield, label: "身份認證" },
      { href: "/dashboard/admin/campaigns", icon: Megaphone, label: "行銷活動", isNew: true },
      { href: "/dashboard/admin/notifications", icon: Bell, label: "通知中心", isNew: true },
      { href: "/dashboard/admin/withdrawals", icon: Wallet, label: "提領審核" },
      { href: "/dashboard/admin/fraud", icon: ShieldAlert, label: "詐騙偵測" },
      { href: "/dashboard/admin/prompts", icon: FileText, label: "Prompt 管理" },
    ]
  },
];

export function DashboardNav() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // 檢查用戶是否為管理員
    const checkAdminStatus = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const user = await response.json();
          setIsAdmin(user.is_admin === true);
        }
      } catch (error) {
        console.error("Failed to check admin status:", error);
      }
    };
    
    checkAdminStatus();
  }, []);

  // 合併導航項目（管理員選單只在客戶端 mounted 後顯示，避免 hydration 錯誤）
  const allNavItems = mounted && isAdmin ? [...navItems, ...adminNavItems] : navItems;

  return (
    <nav className="grid items-start gap-1">
      {allNavItems.map((section, sectionIndex) => (
        <div key={sectionIndex} className="mb-4">
          <h3 className={cn(
            "mb-2 px-3 text-xs font-semibold uppercase tracking-wider",
            section.section === "管理後台" 
              ? "text-amber-500" 
              : "text-muted-foreground"
          )}>
            {section.section === "管理後台" && (
              <Shield className="inline-block mr-1 h-3 w-3" />
            )}
            {section.section}
          </h3>
          <div className="space-y-1">
            {section.items.map((item, index) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");

              return (
                <Link
                  key={index}
                  href={item.href}
                  className={cn(
                    "group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive 
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25" 
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon className={cn(
                    "mr-3 h-4 w-4 transition-transform group-hover:scale-110",
                    isActive ? "text-white" : "text-muted-foreground/70 group-hover:text-primary"
                  )} />
                  <span>{item.label}</span>
                  {(item as any).isPro && (
                    <span className="ml-auto flex h-5 items-center rounded-full bg-purple-500/20 px-2 text-[10px] font-semibold text-purple-400">
                      PRO
                    </span>
                  )}
                  {(item as any).isNew && !(item as any).isPro && (
                    <span className="ml-auto flex h-5 items-center rounded-full bg-amber-500/20 px-2 text-[10px] font-semibold text-amber-400">
                      NEW
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
      
      {/* 底部幫助連結 */}
      <div className="mt-auto pt-4 border-t border-sidebar-border">
        <Link
          href="/dashboard/help"
          className="flex items-center rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
        >
          <HelpCircle className="mr-3 h-4 w-4" />
          <span>幫助中心</span>
        </Link>
      </div>
    </nav>
  );
}
