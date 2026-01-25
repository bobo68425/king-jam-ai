"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  PenTool, 
  Image as ImageIcon, 
  Video, 
  Settings,
  LogOut 
} from "lucide-react";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "儀表板" },
  { href: "/dashboard/blog", icon: PenTool, label: "部落格引擎" },
  { href: "/dashboard/social", icon: ImageIcon, label: "社群圖文" },
  { href: "/dashboard/video", icon: Video, label: "短影音引擎" },
  { href: "/dashboard/settings", icon: Settings, label: "設定" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="grid items-start gap-2">
      {navItems.map((item, index) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={index}
            href={item.href}
            className={cn(
              "group flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
              isActive ? "bg-accent text-accent-foreground" : "transparent"
            )}
          >
            <Icon className="mr-2 h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}