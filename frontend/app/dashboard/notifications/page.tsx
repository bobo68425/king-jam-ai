"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell, Check, CheckCheck, Trash2, Filter, RefreshCw,
  Coins, Shield, CreditCard, Users, FileText, Calendar,
  Megaphone, Settings, ChevronRight, ChevronDown, Clock, AlertCircle,
  Loader2, BellOff, Mail, MailOpen, Inbox, X, Eye,
  Sparkles, MoreHorizontal, Archive
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, isToday, isYesterday, isThisWeek } from "date-fns";
import { zhTW } from "date-fns/locale";
import { toast } from "sonner";
import Link from "next/link";

// ============================================================
// Types
// ============================================================

interface Notification {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  data: any;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

interface NotificationStats {
  total: number;
  unread: number;
  by_type: Record<string, { total: number; unread: number }>;
}

interface DateGroup {
  label: string;
  notifications: Notification[];
}

// ============================================================
// Constants
// ============================================================

const NOTIFICATION_TYPES: Record<string, {
  label: string;
  icon: any;
  color: string;
  bgColor: string;
  gradient: string;
}> = {
  system: {
    label: "系統",
    icon: Bell,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    gradient: "from-blue-500 to-blue-600"
  },
  credit: {
    label: "點數",
    icon: Coins,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    gradient: "from-amber-500 to-orange-600"
  },
  payment: {
    label: "付款",
    icon: CreditCard,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    gradient: "from-emerald-500 to-green-600"
  },
  security: {
    label: "安全",
    icon: Shield,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    gradient: "from-red-500 to-rose-600"
  },
  referral: {
    label: "推薦",
    icon: Users,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    gradient: "from-purple-500 to-violet-600"
  },
  content: {
    label: "內容",
    icon: FileText,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    gradient: "from-cyan-500 to-teal-600"
  },
  schedule: {
    label: "排程",
    icon: Calendar,
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/10",
    gradient: "from-indigo-500 to-blue-600"
  },
  marketing: {
    label: "行銷",
    icon: Megaphone,
    color: "text-pink-400",
    bgColor: "bg-pink-500/10",
    gradient: "from-pink-500 to-rose-600"
  },
};

// ============================================================
// Helper Functions
// ============================================================

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffHours < 1) {
    return formatDistanceToNow(date, { addSuffix: true, locale: zhTW });
  } else if (diffHours < 24) {
    return format(date, "HH:mm", { locale: zhTW });
  } else if (diffHours < 24 * 7) {
    return format(date, "EEEE HH:mm", { locale: zhTW });
  } else {
    return format(date, "yyyy/MM/dd HH:mm", { locale: zhTW });
  }
}

function groupByDate(notifications: Notification[]): DateGroup[] {
  const groups: Record<string, Notification[]> = {};
  const order: string[] = [];

  notifications.forEach(n => {
    const date = new Date(n.created_at);
    let label: string;

    if (isToday(date)) {
      label = "今天";
    } else if (isYesterday(date)) {
      label = "昨天";
    } else if (isThisWeek(date, { weekStartsOn: 1 })) {
      label = "本週";
    } else {
      label = format(date, "yyyy年MM月", { locale: zhTW });
    }

    if (!groups[label]) {
      groups[label] = [];
      order.push(label);
    }
    groups[label].push(n);
  });

  return order.map(label => ({ label, notifications: groups[label] }));
}

// ============================================================
// Sub Components
// ============================================================

function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
  selected,
  onSelect,
  expanded,
  onToggleExpand,
}: {
  notification: Notification;
  onMarkRead: (id: number) => void;
  onDelete: (id: number) => void;
  selected: boolean;
  onSelect: (id: number, checked: boolean) => void;
  expanded: boolean;
  onToggleExpand: (id: number) => void;
}) {
  const typeConfig = NOTIFICATION_TYPES[notification.notification_type as keyof typeof NOTIFICATION_TYPES]
    || NOTIFICATION_TYPES.system;
  const Icon = typeConfig.icon;

  return (
    <div
      className={cn(
        "group relative transition-all duration-200",
        !notification.is_read && "bg-indigo-500/[0.04]",
        expanded && "bg-slate-800/30"
      )}
    >
      {/* 未讀指示條 */}
      {!notification.is_read && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-indigo-500 to-purple-500 rounded-r-full" />
      )}

      <div
        className="flex gap-3 sm:gap-4 p-3 sm:p-4 cursor-pointer hover:bg-slate-800/40 transition-colors"
        onClick={() => {
          onToggleExpand(notification.id);
          if (!notification.is_read) onMarkRead(notification.id);
        }}
      >
        {/* Checkbox */}
        <div className="flex items-start pt-1 flex-shrink-0">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect(notification.id, e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
        </div>

        {/* Icon */}
        <div className={cn(
          "flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-gradient-to-br",
          typeConfig.gradient,
          notification.is_read && "opacity-50"
        )}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className={cn(
                "text-sm font-medium truncate",
                notification.is_read ? "text-slate-400" : "text-white"
              )}>
                {notification.title}
              </h3>
              {!notification.is_read && (
                <span className="flex-shrink-0 w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[11px] text-slate-500 whitespace-nowrap">
                {formatTime(notification.created_at)}
              </span>
              <ChevronDown className={cn(
                "w-3.5 h-3.5 text-slate-500 transition-transform duration-200",
                expanded && "rotate-180"
              )} />
            </div>
          </div>
          <p className={cn(
            "text-xs sm:text-sm mt-0.5",
            notification.is_read ? "text-slate-500" : "text-slate-400",
            !expanded && "line-clamp-1"
          )}>
            {notification.message}
          </p>

          {/* Expanded Detail */}
          {expanded && (
            <div className="mt-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
              {/* Full message */}
              <div className="text-sm text-slate-300 bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                {notification.message}
              </div>

              {/* Meta info */}
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <Badge className={cn("text-[10px] px-2 py-0", typeConfig.bgColor, typeConfig.color)}>
                  {typeConfig.label}
                </Badge>
                <span>{format(new Date(notification.created_at), "yyyy/MM/dd HH:mm:ss", { locale: zhTW })}</span>
                {notification.read_at && (
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    已讀於 {format(new Date(notification.read_at), "MM/dd HH:mm")}
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-1">
                {notification.data?.action_url && (
                  <Link href={notification.data.action_url}>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                      查看詳情
                      <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={(e) => { e.stopPropagation(); onDelete(notification.id); }}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  刪除
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const limit = 20;
  const loaderRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  const fetchNotifications = async (reset = false) => {
    try {
      if (!reset) setLoadingMore(true);
      const offset = reset ? 0 : page * limit;
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (filter) params.append("notification_type", filter);
      if (unreadOnly) params.append("unread_only", "true");

      const res = await api.get(`/notifications?${params}`);

      if (reset) {
        setNotifications(res.data.notifications);
        setPage(1);
      } else {
        setNotifications(prev => [...prev, ...res.data.notifications]);
        setPage(prev => prev + 1);
      }

      setHasMore(res.data.notifications.length === limit);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      toast.error("載入通知失敗");
    } finally {
      setLoadingMore(false);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const res = await api.get("/notifications/stats");
      setStats(res.data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchNotifications(true), fetchStats()]);
      setLoading(false);
    };
    init();
  }, [filter, unreadOnly]);

  // Infinite scroll
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0];
    if (target.isIntersecting && hasMore && !loadingMore && !loading) {
      fetchNotifications(false);
    }
  }, [hasMore, loadingMore, loading, page]);

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "100px",
      threshold: 0,
    });
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [handleObserver]);

  // Mark as read
  const handleMarkRead = async (id: number) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      );
      fetchStats();
    } catch (error) {
      toast.error("操作失敗");
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      await api.post("/notifications/read-all");
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      fetchStats();
      toast.success("已標記所有通知為已讀");
    } catch (error) {
      toast.error("操作失敗");
    }
  };

  // Mark selected as read
  const handleMarkSelectedRead = async () => {
    if (selectedIds.size === 0) return;

    try {
      await api.post("/notifications/mark-read-batch", {
        notification_ids: Array.from(selectedIds)
      });
      setNotifications(prev =>
        prev.map(n => selectedIds.has(n.id) ? { ...n, is_read: true } : n)
      );
      setSelectedIds(new Set());
      fetchStats();
      toast.success(`已標記 ${selectedIds.size} 則通知為已讀`);
    } catch (error) {
      toast.error("操作失敗");
    }
  };

  // Delete notification
  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (expandedId === id) setExpandedId(null);
      fetchStats();
      toast.success("已刪除通知");
    } catch (error) {
      toast.error("刪除失敗");
    }
  };

  // Batch delete selected
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`確定要刪除 ${selectedIds.size} 則通知嗎？`)) return;

    try {
      const deletePromises = Array.from(selectedIds).map(id => api.delete(`/notifications/${id}`));
      await Promise.all(deletePromises);
      setNotifications(prev => prev.filter(n => !selectedIds.has(n.id)));
      const count = selectedIds.size;
      setSelectedIds(new Set());
      fetchStats();
      toast.success(`已刪除 ${count} 則通知`);
    } catch (error) {
      toast.error("刪除失敗");
    }
  };

  // Clear all
  const handleClearAll = async () => {
    if (!confirm("確定要清除所有通知嗎？此操作無法復原。")) return;

    try {
      await api.delete("/notifications");
      setNotifications([]);
      fetchStats();
      toast.success("已清除所有通知");
    } catch (error) {
      toast.error("操作失敗");
    }
  };

  // Toggle selection
  const handleSelect = (id: number, checked: boolean) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  // Select all
  const handleSelectAll = () => {
    if (selectedIds.size === notifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notifications.map(n => n.id)));
    }
  };

  // Toggle expand
  const handleToggleExpand = (id: number) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  // Computed values
  const dateGroups = groupByDate(notifications);
  const unreadCount = stats?.unread || 0;
  const totalCount = stats?.total || 0;
  const readPercent = totalCount > 0 ? Math.round(((totalCount - unreadCount) / totalCount) * 100) : 100;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <span className="text-sm text-slate-400">載入通知中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* ==================== Header ==================== */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
                <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              通知中心
            </h1>
            <p className="text-slate-400 mt-1.5 text-sm">
              {unreadCount > 0 ? (
                <span>
                  <span className="text-indigo-400 font-semibold">{unreadCount}</span> 則未讀通知
                </span>
              ) : (
                "所有通知都已讀"
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { fetchNotifications(true); fetchStats(); }}
              className="text-slate-400 hover:text-white h-9 w-9"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Link href="/dashboard/profile">
              <Button variant="outline" size="sm" className="bg-slate-800/50 border-slate-700 text-slate-300 hidden sm:flex">
                <Settings className="w-4 h-4 mr-2" />
                通知設定
              </Button>
            </Link>
          </div>
        </div>

        {/* ==================== Stats Summary ==================== */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 已讀進度 */}
          <Card className="bg-slate-900/60 border-slate-700/50 sm:col-span-1">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="relative w-14 h-14 flex-shrink-0">
                  <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                    <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="4"
                      className="text-slate-700/50" />
                    <circle cx="28" cy="28" r="24" fill="none" stroke="url(#progress-gradient)" strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={`${readPercent * 1.508} 150.8`}
                    />
                    <defs>
                      <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#a855f7" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold text-white">{readPercent}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-400">已讀比例</p>
                  <p className="text-lg font-bold text-white">{totalCount - unreadCount} / {totalCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 類型概覽 */}
          <Card className="bg-slate-900/60 border-slate-700/50 sm:col-span-2">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-2.5">通知分佈</p>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(NOTIFICATION_TYPES).map(([key, config]) => {
                  const stat = stats?.by_type[key];
                  const count = stat?.total || 0;
                  const unread = stat?.unread || 0;
                  const Icon = config.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setFilter(filter === key ? null : key)}
                      className={cn(
                        "relative flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-center",
                        filter === key
                          ? "bg-indigo-500/15 ring-1 ring-indigo-500/40"
                          : "hover:bg-slate-800/60",
                        count === 0 && "opacity-40"
                      )}
                    >
                      {unread > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[9px] font-bold bg-indigo-500 text-white rounded-full flex items-center justify-center">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                      <Icon className={cn("w-4 h-4", config.color)} />
                      <span className="text-[10px] text-slate-400 leading-tight">{config.label}</span>
                      <span className="text-xs font-semibold text-white">{count}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ==================== Filter Tabs ==================== */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilter(null)}
            className={cn(
              "h-8 text-xs rounded-full px-4 flex-shrink-0 transition-all",
              !filter
                ? "bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30"
                : "text-slate-400 hover:text-white"
            )}
          >
            <Inbox className="w-3.5 h-3.5 mr-1.5" />
            全部
            <Badge className="ml-1.5 h-4 px-1.5 text-[10px] bg-slate-700/50 text-slate-300">{totalCount}</Badge>
          </Button>

          <div className="w-px h-5 bg-slate-700 flex-shrink-0" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setUnreadOnly(!unreadOnly)}
            className={cn(
              "h-8 text-xs rounded-full px-4 flex-shrink-0 transition-all",
              unreadOnly
                ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                : "text-slate-400 hover:text-white"
            )}
          >
            <Mail className="w-3.5 h-3.5 mr-1.5" />
            未讀
            {unreadCount > 0 && (
              <Badge className="ml-1.5 h-4 px-1.5 text-[10px] bg-amber-500/20 text-amber-300">{unreadCount}</Badge>
            )}
          </Button>

          <div className="w-px h-5 bg-slate-700 flex-shrink-0" />

          {Object.entries(NOTIFICATION_TYPES).map(([key, config]) => {
            const Icon = config.icon;
            const stat = stats?.by_type[key];
            if (!stat?.total) return null;
            return (
              <Button
                key={key}
                variant="ghost"
                size="sm"
                onClick={() => setFilter(filter === key ? null : key)}
                className={cn(
                  "h-8 text-xs rounded-full px-3 flex-shrink-0 transition-all",
                  filter === key
                    ? "bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <Icon className="w-3.5 h-3.5 mr-1.5" />
                {config.label}
              </Button>
            );
          })}
        </div>

        {/* ==================== Batch Actions Bar ==================== */}
        {selectedIds.size > 0 && (
          <div className="sticky top-2 z-20 animate-in slide-in-from-top-2 duration-200">
            <Card className="bg-indigo-950/90 border-indigo-500/30 backdrop-blur-lg shadow-xl shadow-indigo-500/5">
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-indigo-300 font-medium">
                    已選擇 <span className="text-white font-semibold">{selectedIds.size}</span> 則通知
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleMarkSelectedRead}
                      className="h-7 text-xs text-indigo-300 hover:text-white hover:bg-indigo-500/20"
                    >
                      <MailOpen className="w-3.5 h-3.5 mr-1" />
                      標記已讀
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleDeleteSelected}
                      className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      刪除
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedIds(new Set())}
                      className="h-7 text-xs text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ==================== Quick Actions ==================== */}
        {selectedIds.size === 0 && (unreadCount > 0 || notifications.length > 0) && (
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="text-slate-500 hover:text-slate-300 text-xs h-7"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
              全選
            </Button>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllRead}
                  className="text-slate-500 hover:text-slate-300 text-xs h-7"
                >
                  <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
                  全部已讀
                </Button>
              )}
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="text-slate-500 hover:text-red-400 text-xs h-7"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  清除全部
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ==================== Notifications List ==================== */}
        {notifications.length === 0 ? (
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="p-12 sm:p-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800/80 flex items-center justify-center mx-auto mb-4">
                <BellOff className="w-8 h-8 text-slate-600" />
              </div>
              <h3 className="text-lg font-medium text-slate-300">
                {unreadOnly ? "沒有未讀通知" : filter ? "此類型暫無通知" : "沒有通知"}
              </h3>
              <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto">
                {unreadOnly
                  ? "太棒了！您已經閱讀所有通知"
                  : filter
                    ? `目前沒有${NOTIFICATION_TYPES[filter]?.label || "此類型的"}通知`
                    : "新的通知會在這裡顯示"
                }
              </p>
              {(unreadOnly || filter) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 border-slate-700 text-slate-400"
                  onClick={() => { setFilter(null); setUnreadOnly(false); }}
                >
                  查看所有通知
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {dateGroups.map((group) => (
              <div key={group.label}>
                {/* Date Group Header */}
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-slate-800" />
                  <span className="text-[10px] text-slate-600">
                    {group.notifications.length} 則
                  </span>
                </div>

                {/* Notifications Card */}
                <Card className="bg-slate-900/50 border-slate-700/50 overflow-hidden divide-y divide-slate-700/30">
                  {group.notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkRead={handleMarkRead}
                      onDelete={handleDelete}
                      selected={selectedIds.has(notification.id)}
                      onSelect={handleSelect}
                      expanded={expandedId === notification.id}
                      onToggleExpand={handleToggleExpand}
                    />
                  ))}
                </Card>
              </div>
            ))}

            {/* Infinite Scroll Loader */}
            <div ref={loaderRef} className="py-4 text-center">
              {loadingMore && (
                <div className="flex items-center justify-center gap-2 text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">載入更多...</span>
                </div>
              )}
              {!hasMore && notifications.length > 0 && (
                <p className="text-xs text-slate-600">— 已顯示所有通知 —</p>
              )}
            </div>
          </div>
        )}

        {/* ==================== Email Settings Card ==================== */}
        <Card className="bg-gradient-to-r from-indigo-500/5 to-purple-500/5 border-indigo-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white text-sm">Email 通知設定</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  管理哪些通知會發送至您的信箱
                </p>
              </div>
              <Link href="/dashboard/profile">
                <Button variant="ghost" size="sm" className="text-indigo-400 hover:text-indigo-300 text-xs">
                  前往設定
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
