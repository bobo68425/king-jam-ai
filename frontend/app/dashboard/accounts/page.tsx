"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Link2,
  Link2Off,
  Loader2,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  User,
  Shield,
  AlertTriangle,
  Globe,
  X,
  Eye,
  EyeOff,
  HelpCircle,
  TrendingUp,
  BarChart3
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SocialAccount {
  id: number;
  platform: string;
  platform_user_id: string | null;
  platform_username: string | null;
  platform_avatar: string | null;
  is_active: boolean;
  token_expires_at: string | null;
  last_sync_at: string | null;
  created_at: string;
}

interface PlatformInfo {
  id: string;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  description: string;
  available: boolean;
}

const platforms: PlatformInfo[] = [
  {
    id: "wordpress",
    name: "WordPress",
    icon: "📝",
    color: "text-sky-400",
    bgColor: "bg-gradient-to-br from-sky-500/20 to-blue-500/20 border-sky-500/30",
    description: "連結 WordPress 網站，自動發布文章與排程",
    available: true,
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: "📸",
    color: "text-pink-400",
    bgColor: "bg-gradient-to-br from-pink-500/20 to-purple-500/20 border-pink-500/30",
    description: "連結 Instagram 商業帳號，自動發布貼文和限時動態",
    available: true,
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: "👍",
    color: "text-blue-400",
    bgColor: "bg-gradient-to-br from-blue-500/20 to-blue-600/20 border-blue-500/30",
    description: "連結 Facebook 粉絲專頁，排程發布貼文",
    available: true,
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: "🎵",
    color: "text-cyan-400",
    bgColor: "bg-gradient-to-br from-cyan-500/20 to-pink-500/20 border-cyan-500/30",
    description: "連結 TikTok 帳號，自動上傳短影片",
    available: true,
  },
  {
    id: "youtube",
    name: "YouTube",
    icon: "▶️",
    color: "text-red-400",
    bgColor: "bg-gradient-to-br from-red-500/20 to-red-600/20 border-red-500/30",
    description: "連結 YouTube 頻道，排程發布 Shorts",
    available: true,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: "💼",
    color: "text-blue-500",
    bgColor: "bg-gradient-to-br from-blue-600/20 to-blue-700/20 border-blue-600/30",
    description: "連結 LinkedIn 個人或公司頁面",
    available: true,
  },
  {
    id: "threads",
    name: "Threads",
    icon: "🧵",
    color: "text-slate-300",
    bgColor: "bg-gradient-to-br from-slate-500/20 to-slate-600/20 border-slate-500/30",
    description: "連結 Threads 帳號（即將推出）",
    available: false,
  },
  {
    id: "xiaohongshu",
    name: "小紅書",
    icon: "📕",
    color: "text-red-400",
    bgColor: "bg-gradient-to-br from-red-500/20 to-red-400/20 border-red-400/30",
    description: "連結小紅書帳號（即將推出）",
    available: false,
  },
  {
    id: "line",
    name: "LINE",
    icon: "💬",
    color: "text-green-400",
    bgColor: "bg-gradient-to-br from-green-500/20 to-green-600/20 border-green-500/30",
    description: "連結 LINE 官方帳號，推播訊息",
    available: true,
  },
];

// WordPress 站點介面
interface WordPressSite {
  id: number;
  site_url: string;
  site_name: string | null;
  username: string;
  avatar_url: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  ga4_property_id?: string | null;
}

const PLATFORM_NAMES: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok",
  youtube: "YouTube", linkedin: "LinkedIn", line: "LINE", wordpress: "WordPress"
};

function AccountsContent() {
  const searchParams = useSearchParams();
  // 防止 Hydration 錯誤
  const [isMounted, setIsMounted] = useState(false);
  
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  
  // WordPress 連結狀態
  const [showWpDialog, setShowWpDialog] = useState(false);
  const [wpSiteUrl, setWpSiteUrl] = useState("");
  const [wpUsername, setWpUsername] = useState("");
  const [wpAppPassword, setWpAppPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [wpConnecting, setWpConnecting] = useState(false);
  const [wpSites, setWpSites] = useState<WordPressSite[]>([]);

  // 客戶端掛載
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    fetchAccounts();
    fetchWpSites();
  }, [isMounted]);

  // 處理 OAuth 回調結果（連結完成後導回此頁）
  useEffect(() => {
    const oauthResult = searchParams.get("oauth");
    const platform = searchParams.get("platform");
    const username = searchParams.get("username");
    const errorMessage = searchParams.get("message");
    if (oauthResult === "success" && platform) {
      toast.success(`${PLATFORM_NAMES[platform] || platform} 連結成功！`, {
        description: username ? `已連結帳號 @${username}` : undefined
      });
      window.history.replaceState({}, "", "/dashboard/accounts");
      fetchAccounts();
    } else if (oauthResult === "error") {
      toast.error("連結失敗", { description: errorMessage || "請重試或聯繫客服" });
      window.history.replaceState({}, "", "/dashboard/accounts");
    }
  }, [searchParams]);

  const fetchAccounts = async () => {
    try {
      const res = await api.get<SocialAccount[]>("/scheduler/accounts");
      setAccounts(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Failed to fetch accounts", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWpSites = async () => {
    try {
      const res = await api.get<WordPressSite[]>("/wordpress/sites");
      setWpSites(res.data);
    } catch (error) {
      console.error("Failed to fetch WordPress sites", error);
    }
  };

  const handleWpConnect = async () => {
    if (!wpSiteUrl || !wpUsername || !wpAppPassword) {
      toast.error("請填寫所有欄位");
      return;
    }

    // 確保 URL 格式正確
    let siteUrl = wpSiteUrl.trim();
    if (!siteUrl.startsWith("http")) {
      siteUrl = "https://" + siteUrl;
    }
    siteUrl = siteUrl.replace(/\/$/, ""); // 移除尾部斜線

    setWpConnecting(true);
    try {
      const res = await api.post("/wordpress/connect", {
        site_url: siteUrl,
        username: wpUsername,
        app_password: wpAppPassword.replace(/\s/g, ""), // 移除空格
      });
      
      toast.success("WordPress 站點連接成功！", {
        description: res.data.site_name || siteUrl
      });
      
      // 重置表單並關閉對話框
      setWpSiteUrl("");
      setWpUsername("");
      setWpAppPassword("");
      setShowWpDialog(false);
      
      // 刷新列表
      fetchWpSites();
      
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "WordPress 連接失敗");
    } finally {
      setWpConnecting(false);
    }
  };

  const handleWpDisconnect = async (siteId: number, siteName: string) => {
    if (!confirm(`確定要解除連結 ${siteName} 嗎？`)) {
      return;
    }

    try {
      await api.delete(`/wordpress/sites/${siteId}`);
      toast.success("已成功解除連結");
      fetchWpSites();
    } catch (error: any) {
      toast.error(`解除連結失敗：${error.response?.data?.detail || "請稍後再試"}`);
    }
  };

  const handleWpVerify = async (siteId: number) => {
    try {
      const res = await api.post(`/wordpress/sites/${siteId}/verify`);
      if (res.data.status === "connected") {
        toast.success("連線正常");
      } else {
        toast.error("連線失效，請重新連接");
      }
      fetchWpSites();
    } catch (error: any) {
      toast.error(`驗證失敗：${error.response?.data?.detail || "請稍後再試"}`);
    }
  };

  const handleConnect = async (platformId: string) => {
    // WordPress 使用特殊流程
    if (platformId === "wordpress") {
      setShowWpDialog(true);
      return;
    }
    
    setConnecting(platformId);
    try {
      // 獲取 OAuth URL
      const res = await api.get<{ auth_url: string }>(`/oauth/connect/${platformId}`);
      // 導向 OAuth 頁面
      window.location.href = res.data.auth_url;
    } catch (error: any) {
      console.error("Failed to initiate OAuth", error);
      toast.error(`連結 ${platformId} 失敗：${error.response?.data?.detail || "請稍後再試"}`);
      setConnecting(null);
    }
  };

  const handleDisconnect = async (accountId: number, platform: string) => {
    if (!confirm(`確定要解除連結 ${platform} 帳號嗎？這將會取消所有相關的排程貼文。`)) {
      return;
    }

    try {
      await api.delete(`/scheduler/accounts/${accountId}`);
      toast.success("已成功解除連結");
      fetchAccounts();
    } catch (error: any) {
      toast.error(`解除連結失敗：${error.response?.data?.detail || "請稍後再試"}`);
    }
  };

  const handleRefreshToken = async (accountId: number) => {
    try {
      await api.post(`/tasks/refresh-token/${accountId}`);
      toast.success("Token 刷新任務已加入佇列");
    } catch (error: any) {
      toast.error(`刷新失敗：${error.response?.data?.detail || "請稍後再試"}`);
    }
  };

  const getAccountByPlatform = (platformId: string) => {
    return accounts.find(a => a.platform === platformId);
  };

  const getTokenStatus = (account: SocialAccount) => {
    if (!account.token_expires_at) {
      return { status: "unknown", label: "未知", color: "text-slate-400" };
    }

    const expiresAt = new Date(account.token_expires_at);
    const now = new Date();
    const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilExpiry < 0) {
      return { status: "expired", label: "已過期", color: "text-red-400" };
    }
    if (hoursUntilExpiry < 24) {
      return { status: "expiring", label: "即將過期", color: "text-amber-400" };
    }
    return { status: "valid", label: "有效", color: "text-emerald-400" };
  };

  // 防止 Hydration 錯誤：等待客戶端掛載
  if (!isMounted) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">社群帳號</h1>
            <p className="text-slate-400 mt-1">載入中...</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-slate-800/50 border-slate-700 animate-pulse">
              <CardContent className="p-4">
                <div className="h-12 w-12 rounded-full bg-slate-700 mb-3" />
                <div className="h-4 w-24 bg-slate-700 rounded mb-2" />
                <div className="h-3 w-32 bg-slate-700/50 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 頁面標題 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">社群帳號</h1>
          <p className="text-slate-400 mt-1">
            連結您的社群平台帳號，啟用自動發布功能
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchAccounts}
          className="border-slate-700 hover:bg-slate-800 w-fit"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          重新整理
        </Button>
      </div>

      {/* 已連結帳號 */}
      {accounts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            已連結帳號 ({accounts.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => {
              const platform = platforms.find(p => p.id === account.platform);
              const tokenStatus = getTokenStatus(account);

              return (
                <Card
                  key={account.id}
                  className={`${platform?.bgColor || "bg-slate-800/50 border-slate-700"} overflow-hidden`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {account.platform_avatar ? (
                          <img
                            src={account.platform_avatar}
                            alt={account.platform_username || ""}
                            className="h-12 w-12 rounded-full border-2 border-white/20"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-slate-700 flex items-center justify-center text-2xl">
                            {platform?.icon || "📱"}
                          </div>
                        )}
                        <div>
                          <h3 className="font-semibold text-white">
                            {account.platform_username || platform?.name}
                          </h3>
                          <p className="text-sm text-slate-400">{platform?.name}</p>
                        </div>
                      </div>
                      <Badge
                        className={`${
                          account.is_active
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-red-500/20 text-red-400"
                        } border-0`}
                      >
                        {account.is_active ? "已連結" : "需重新授權"}
                      </Badge>
                    </div>

                    {/* Token 狀態 */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          授權狀態
                        </span>
                        <span className={tokenStatus.color}>{tokenStatus.label}</span>
                      </div>
                      {account.token_expires_at && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            到期時間
                          </span>
                          <span className="text-slate-300">
                            {formatDistanceToNow(new Date(account.token_expires_at), {
                              addSuffix: true,
                              locale: zhTW,
                            })}
                          </span>
                        </div>
                      )}
                      {account.last_sync_at && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400 flex items-center gap-1">
                            <RefreshCw className="h-3 w-3" />
                            最後同步
                          </span>
                          <span className="text-slate-300">
                            {format(new Date(account.last_sync_at), "MM/dd HH:mm", { locale: zhTW })}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 警告訊息 */}
                    {tokenStatus.status === "expired" && (
                      <div className="p-2 rounded bg-red-500/10 border border-red-500/20 mb-4">
                        <p className="text-xs text-red-400 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          授權已過期，請重新連結帳號
                        </p>
                      </div>
                    )}
                    {tokenStatus.status === "expiring" && (
                      <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 mb-4">
                        <p className="text-xs text-amber-400 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          授權即將過期，建議重新連結
                        </p>
                      </div>
                    )}

                    {/* 操作按鈕 */}
                    <div className="flex gap-2">
                      {tokenStatus.status === "expired" || !account.is_active ? (
                        <Button
                          size="sm"
                          className="flex-1 bg-indigo-600 hover:bg-indigo-500"
                          onClick={() => handleConnect(account.platform)}
                          disabled={connecting === account.platform}
                        >
                          {connecting === account.platform ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Link2 className="mr-2 h-4 w-4" />
                          )}
                          重新連結
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-slate-600"
                          onClick={() => handleRefreshToken(account.id)}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          刷新授權
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => handleDisconnect(account.id, platform?.name || account.platform)}
                      >
                        <Link2Off className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* 可連結的平台 */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Plus className="h-5 w-5 text-indigo-400" />
          新增社群帳號
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {platforms.map((platform) => {
            const connectedAccount = getAccountByPlatform(platform.id);
            const isConnected = !!connectedAccount;

            return (
              <Card
                key={platform.id}
                className={`${
                  isConnected
                    ? "bg-slate-800/30 border-slate-700/50 opacity-60"
                    : platform.available
                      ? `${platform.bgColor} hover:scale-[1.02] transition-transform cursor-pointer`
                      : "bg-slate-800/30 border-slate-700/50 opacity-50"
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-3xl">{platform.icon}</div>
                    <div>
                      <h3 className={`font-semibold ${platform.color}`}>{platform.name}</h3>
                      {isConnected && (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">
                          已連結
                        </Badge>
                      )}
                      {!platform.available && (
                        <Badge className="bg-slate-500/20 text-slate-400 border-0 text-xs">
                          即將推出
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">{platform.description}</p>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!platform.available || isConnected || connecting === platform.id}
                    onClick={() => handleConnect(platform.id)}
                  >
                    {connecting === platform.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        連結中...
                      </>
                    ) : isConnected ? (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        已連結
                      </>
                    ) : platform.available ? (
                      <>
                        <Link2 className="mr-2 h-4 w-4" />
                        連結帳號
                      </>
                    ) : (
                      <>
                        <Clock className="mr-2 h-4 w-4" />
                        即將推出
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* WordPress 站點列表 */}
      {wpSites.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Globe className="h-5 w-5 text-sky-400" />
            已連結的 WordPress 站點 ({wpSites.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {wpSites.map((site) => (
              <Card
                key={site.id}
                className="bg-gradient-to-br from-sky-500/20 to-blue-500/20 border-sky-500/30 overflow-hidden"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {site.avatar_url ? (
                        <img
                          src={site.avatar_url}
                          alt={site.site_name || ""}
                          className="h-12 w-12 rounded-full border-2 border-white/20"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-sky-500 to-blue-500 flex items-center justify-center">
                          <Globe className="w-6 h-6 text-white" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-white">
                          {site.site_name || "WordPress"}
                        </h3>
                        <p className="text-xs text-slate-400 truncate max-w-[150px]" title={site.site_url}>
                          {site.site_url}
                        </p>
                      </div>
                    </div>
                    <Badge
                      className={`${
                        site.is_active
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-red-500/20 text-red-400"
                      } border-0`}
                    >
                      {site.is_active ? "已連結" : "連線失效"}
                    </Badge>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400 flex items-center gap-1">
                        <User className="h-3 w-3" />
                        使用者
                      </span>
                      <span className="text-slate-300">{site.username}</span>
                    </div>
                    {site.last_sync_at && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          最後同步
                        </span>
                        <span className="text-slate-300">
                          {format(new Date(site.last_sync_at), "MM/dd HH:mm", { locale: zhTW })}
                        </span>
                      </div>
                    )}
                  </div>

                  {!site.is_active && (
                    <div className="p-2 rounded bg-red-500/10 border border-red-500/20 mb-4">
                      <p className="text-xs text-red-400 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        連線失效，請重新連接
                      </p>
                    </div>
                  )}

                  {/* GA4 設定按鈕 */}
                  <a
                    href="/dashboard/settings/ga4"
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-lg text-sm mb-4 transition-colors",
                      site.ga4_property_id
                        ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30"
                        : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      {site.ga4_property_id ? "GA4 已連接" : "設定 GA4 獲取瀏覽數據"}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                  </a>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-slate-600"
                      onClick={() => handleWpVerify(site.id)}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      驗證連線
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => handleWpDisconnect(site.id, site.site_name || site.site_url)}
                    >
                      <Link2Off className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 說明區塊 */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-400" />
            關於社群帳號連結
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-400">
          <p>
            <strong className="text-slate-300">安全性：</strong>
            我們使用 OAuth 2.0 標準協議連結您的社群帳號，不會儲存您的密碼。您可以隨時在此頁面解除連結。
          </p>
          <p>
            <strong className="text-slate-300">授權範圍：</strong>
            連結後，我們僅會請求發布貼文所需的最小權限。我們不會讀取您的私人訊息或其他敏感資料。
          </p>
          <p>
            <strong className="text-slate-300">Token 過期：</strong>
            社群平台的授權 Token 可能會過期，系統會自動嘗試刷新。如果刷新失敗，您需要重新連結帳號。
          </p>
          <p>
            <strong className="text-slate-300">WordPress：</strong>
            使用「應用程式密碼」(Application Password) 連接您的 WordPress 站點。
            請在 WordPress 後台 → 使用者 → 編輯個人資料 → 應用程式密碼 中生成。
          </p>
        </CardContent>
      </Card>

      {/* WordPress 連結對話框 */}
      {isMounted && showWpDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-slate-900 border-slate-700 animate-in zoom-in-95 duration-300">
            <CardHeader className="border-b border-slate-700">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-sky-500 to-blue-500">
                    <Globe className="w-5 h-5 text-white" />
                  </div>
                  連結 WordPress 站點
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowWpDialog(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <CardDescription className="text-slate-400">
                使用應用程式密碼連接您的 WordPress 網站
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-5">
              {/* 網站網址 */}
              <div>
                <label className="text-sm text-slate-300 mb-2 block">
                  WordPress 網站網址
                </label>
                <Input
                  placeholder="https://your-site.com"
                  value={wpSiteUrl}
                  onChange={(e) => setWpSiteUrl(e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white"
                />
                <p className="text-xs text-slate-500 mt-1">例如：https://myblog.com</p>
              </div>

              {/* 使用者名稱 */}
              <div>
                <label className="text-sm text-slate-300 mb-2 block">
                  WordPress 使用者名稱
                </label>
                <Input
                  placeholder="admin"
                  value={wpUsername}
                  onChange={(e) => setWpUsername(e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>

              {/* 應用程式密碼 */}
              <div>
                <label className="text-sm text-slate-300 mb-2 block flex items-center gap-2">
                  應用程式密碼
                  <a
                    href="https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-400 hover:text-sky-300"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                  </a>
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                    value={wpAppPassword}
                    onChange={(e) => setWpAppPassword(e.target.value)}
                    className="bg-slate-800 border-slate-600 text-white pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  在 WordPress 後台 → 使用者 → 編輯個人資料 → 應用程式密碼 中生成
                </p>
              </div>

              {/* 說明 */}
              <div className="p-3 bg-sky-900/20 rounded-lg border border-sky-500/30 text-xs text-slate-300 space-y-2">
                <p className="font-medium text-sky-400">如何取得應用程式密碼：</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-400">
                  <li>登入您的 WordPress 後台</li>
                  <li>前往「使用者」→「編輯個人資料」</li>
                  <li>滾動到「應用程式密碼」區段</li>
                  <li>輸入名稱（如：King Jam AI），點擊「新增應用程式密碼」</li>
                  <li>複製產生的密碼貼到上方欄位</li>
                </ol>
              </div>

              {/* 按鈕 */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowWpDialog(false)}
                  className="text-slate-400"
                >
                  取消
                </Button>
                <Button
                  onClick={handleWpConnect}
                  disabled={wpConnecting || !wpSiteUrl || !wpUsername || !wpAppPassword}
                  className="bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white"
                >
                  {wpConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      連接中...
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4 mr-2" />
                      連結站點
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function AccountsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[200px]"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>}>
      <AccountsContent />
    </Suspense>
  );
}
