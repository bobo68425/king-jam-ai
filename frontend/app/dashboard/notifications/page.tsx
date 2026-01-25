"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell, Check, CheckCheck, Trash2, Filter, RefreshCw,
  Coins, Shield, CreditCard, Users, FileText, Calendar,
  Megaphone, Settings, ChevronRight, Clock, AlertCircle,
  Loader2, BellOff, Mail, MailOpen
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
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

// ============================================================
// Constants
// ============================================================

const NOTIFICATION_TYPES = {
  system: { 
    label: "系統通知", 
    icon: Bell, 
    color: "text-blue-400",
    bgColor: "bg-blue-500/10"
  },
  credit: { 
    label: "點數通知", 
    icon: Coins, 
    color: "text-amber-400",
    bgColor: "bg-amber-500/10"
  },
  payment: { 
    label: "付款通知", 
    icon: CreditCard, 
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10"
  },
  security: { 
    label: "安全通知", 
    icon: Shield, 
    color: "text-red-400",
    bgColor: "bg-red-500/10"
  },
  referral: { 
    label: "推薦通知", 
    icon: Users, 
    color: "text-purple-400",
    bgColor: "bg-purple-500/10"
  },
  content: { 
    label: "內容通知", 
    icon: FileText, 
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10"
  },
  schedule: { 
    label: "排程通知", 
    icon: Calendar, 
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/10"
  },
  marketing: { 
    label: "行銷通知", 
    icon: Megaphone, 
    color: "text-pink-400",
    bgColor: "bg-pink-500/10"
  },
};

// ============================================================
// Helper Functions
// ============================================================

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  if (diffHours < 24) {
    return formatDistanceToNow(date, { addSuffix: true, locale: zhTW });
  } else if (diffHours < 24 * 7) {
    return format(date, "EEEE HH:mm", { locale: zhTW });
  } else {
    return format(date, "MM/dd HH:mm", { locale: zhTW });
  }
}

// ============================================================
// Components
// ============================================================

function NotificationItem({ 
  notification, 
  onMarkRead, 
  onDelete,
  selected,
  onSelect
}: { 
  notification: Notification;
  onMarkRead: (id: number) => void;
  onDelete: (id: number) => void;
  selected: boolean;
  onSelect: (id: number, checked: boolean) => void;
}) {
  const typeConfig = NOTIFICATION_TYPES[notification.notification_type as keyof typeof NOTIFICATION_TYPES] 
    || NOTIFICATION_TYPES.system;
  const Icon = typeConfig.icon;

  return (
    <div 
      className={cn(
        "group p-4 border-b border-slate-700/50 last:border-0 transition-colors",
        !notification.is_read && "bg-indigo-500/5",
        "hover:bg-slate-800/50"
      )}
    >
      <div className="flex gap-4">
        {/* Checkbox */}
        <div className="flex items-start pt-1">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(notification.id, e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
          />
        </div>

        {/* Icon */}
        <div className={cn(
          "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
          typeConfig.bgColor
        )}>
          <Icon className={cn("w-5 h-5", typeConfig.color)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className={cn(
                "font-medium",
                notification.is_read ? "text-slate-300" : "text-white"
              )}>
                {notification.title}
              </h3>
              {!notification.is_read && (
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
              )}
            </div>
            <span className="text-xs text-slate-500 whitespace-nowrap">
              {formatTime(notification.created_at)}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1 line-clamp-2">
            {notification.message}
          </p>
          
          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
            {!notification.is_read && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-slate-400 hover:text-white"
                onClick={() => onMarkRead(notification.id)}
              >
                <Check className="w-3 h-3 mr-1" />
                標記已讀
              </Button>
            )}
            {notification.data?.action_url && (
              <Link href={notification.data.action_url}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-indigo-400 hover:text-indigo-300"
                >
                  查看詳情
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-red-400 hover:text-red-300 ml-auto"
              onClick={() => onDelete(notification.id)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
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
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 20;

  // Fetch notifications
  const fetchNotifications = async (reset = false) => {
    try {
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
      fetchStats();
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Bell className="w-7 h-7 text-indigo-400" />
              通知中心
            </h1>
            <p className="text-slate-400 mt-1">
              {stats?.unread || 0} 則未讀通知
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/profile">
              <Button variant="outline" size="sm" className="bg-slate-800/50 border-slate-700">
                <Settings className="w-4 h-4 mr-2" />
                通知設定
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(NOTIFICATION_TYPES).slice(0, 4).map(([key, config]) => {
            const stat = stats?.by_type[key];
            const Icon = config.icon;
            return (
              <Card 
                key={key}
                className={cn(
                  "bg-slate-900/50 border-slate-700/50 cursor-pointer transition-all",
                  filter === key && "ring-2 ring-indigo-500"
                )}
                onClick={() => setFilter(filter === key ? null : key)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", config.bgColor)}>
                      <Icon className={cn("w-4 h-4", config.color)} />
                    </div>
                    {(stat?.unread || 0) > 0 && (
                      <Badge className="bg-indigo-500/20 text-indigo-300 text-xs">
                        {stat?.unread}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 mt-2">{config.label}</p>
                  <p className="text-lg font-semibold text-white">{stat?.total || 0}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Actions Bar */}
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="text-slate-400"
                >
                  {selectedIds.size === notifications.length ? (
                    <CheckCheck className="w-4 h-4 mr-2" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  {selectedIds.size > 0 ? `已選 ${selectedIds.size}` : "全選"}
                </Button>
                
                {selectedIds.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkSelectedRead}
                    className="text-indigo-400"
                  >
                    <MailOpen className="w-4 h-4 mr-2" />
                    標記已讀
                  </Button>
                )}
                
                <div className="h-6 w-px bg-slate-700 mx-2" />
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUnreadOnly(!unreadOnly)}
                  className={cn(
                    unreadOnly ? "text-indigo-400" : "text-slate-400"
                  )}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  {unreadOnly ? "只顯示未讀" : "顯示全部"}
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllRead}
                  className="text-slate-400"
                  disabled={!stats?.unread}
                >
                  <CheckCheck className="w-4 h-4 mr-2" />
                  全部已讀
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="text-red-400"
                  disabled={notifications.length === 0}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  清除全部
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchNotifications(true)}
                  className="text-slate-400"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filter Tags */}
        {filter && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">篩選：</span>
            <Badge 
              className="bg-indigo-500/20 text-indigo-300 cursor-pointer"
              onClick={() => setFilter(null)}
            >
              {NOTIFICATION_TYPES[filter as keyof typeof NOTIFICATION_TYPES]?.label}
              <span className="ml-2">×</span>
            </Badge>
          </div>
        )}

        {/* Notifications List */}
        <Card className="bg-slate-900/50 border-slate-700/50 overflow-hidden">
          {notifications.length === 0 ? (
            <CardContent className="p-12 text-center">
              <BellOff className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-400">沒有通知</h3>
              <p className="text-sm text-slate-500 mt-1">
                {unreadOnly ? "沒有未讀通知" : "目前沒有任何通知"}
              </p>
            </CardContent>
          ) : (
            <>
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={handleMarkRead}
                  onDelete={handleDelete}
                  selected={selectedIds.has(notification.id)}
                  onSelect={handleSelect}
                />
              ))}
              
              {/* Load More */}
              {hasMore && (
                <div className="p-4 text-center">
                  <Button
                    variant="ghost"
                    onClick={() => fetchNotifications(false)}
                    className="text-slate-400"
                  >
                    載入更多
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Email Settings Reminder */}
        <Card className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-indigo-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <Mail className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-white">Email 通知設定</h3>
                <p className="text-sm text-slate-400">
                  您可以在帳號設定中管理 Email 通知偏好，選擇接收哪些類型的郵件通知。
                </p>
              </div>
              <Link href="/dashboard/profile">
                <Button variant="outline" size="sm" className="bg-slate-800/50 border-slate-700">
                  前往設定
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
