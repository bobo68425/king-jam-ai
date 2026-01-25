"use client";

import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ShieldAlert, Search, AlertTriangle, CheckCircle, XCircle,
  Loader2, Clock, User, Users, Monitor, Globe, Link2,
  RefreshCw, ChevronLeft, ChevronRight, Eye, Ban,
  ArrowLeft, Shield, Fingerprint, Network, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";

// ============================================================
// Helper Functions
// ============================================================

function getErrorMessage(error: any): string {
  const detail = error?.response?.data?.detail;
  if (!detail) return "操作失敗";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ");
  }
  if (typeof detail === "object") {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  return "操作失敗";
}

// ============================================================
// Types
// ============================================================

interface FraudAlert {
  id: number;
  user_id: number;
  alert_type: string;
  risk_level: string;
  risk_score: number;
  related_user_ids: number[];
  evidence: Record<string, any>;
  is_resolved: boolean;
  created_at: string;
}

interface FraudStats {
  alerts: {
    total: number;
    unresolved: number;
    by_type: Record<string, number>;
  };
  risk_profiles: {
    by_level: Record<string, number>;
    bonus_blocked: number;
  };
}

interface SuspiciousGroup {
  ip_hash: string;
  user_count: number;
  referrals_within_group: number;
  referrals: {
    referrer_id: number;
    referrer_email: string;
    referred_id: number;
    referred_email: string;
  }[];
  users: {
    id: number;
    email: string;
    subscription: string | null;
  }[];
}

interface UserRiskInfo {
  user_id: number;
  risk_level: string;
  risk_score: number;
  referral_bonus_blocked: boolean;
  withdrawal_blocked: boolean;
  account_restricted: boolean;
  block_reason: string | null;
  related_ips: string[];
  related_devices: number;
  alerts: FraudAlert[];
}

// ============================================================
// Constants
// ============================================================

const RISK_LEVEL_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  low: { label: "低風險", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle },
  medium: { label: "中風險", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: AlertTriangle },
  high: { label: "高風險", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: AlertCircle },
  blocked: { label: "已封鎖", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: Ban },
};

const ALERT_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; description: string }> = {
  same_device: { label: "同裝置多帳號", icon: Monitor, description: "多個帳號使用同一裝置" },
  same_ip: { label: "同 IP 多帳號", icon: Globe, description: "多個帳號來自同一 IP" },
  self_referral: { label: "自我推薦", icon: User, description: "疑似自己推薦自己" },
  referral_ring: { label: "推薦環", icon: Link2, description: "多帳號互相推薦形成環狀" },
  vpn_usage: { label: "VPN 使用", icon: Network, description: "使用 VPN/Proxy 登入" },
  datacenter_ip: { label: "機房 IP", icon: Globe, description: "來自資料中心的 IP" },
};

// ============================================================
// Main Component
// ============================================================

export default function FraudDetectionPage() {
  const [activeTab, setActiveTab] = useState<"alerts" | "suspicious" | "lookup">("alerts");
  const [loading, setLoading] = useState(true);
  
  // Alerts state
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [alertsTotal, setAlertsTotal] = useState(0);
  const [alertsPage, setAlertsPage] = useState(0);
  const [showResolved, setShowResolved] = useState(false);
  
  // Stats
  const [stats, setStats] = useState<FraudStats | null>(null);
  
  // Suspicious groups
  const [suspiciousGroups, setSuspiciousGroups] = useState<SuspiciousGroup[]>([]);
  const [suspiciousLoading, setSuspiciousLoading] = useState(false);
  
  // User lookup
  const [lookupUserId, setLookupUserId] = useState("");
  const [userRiskInfo, setUserRiskInfo] = useState<UserRiskInfo | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  
  // Resolve dialog
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [unblockUser, setUnblockUser] = useState(false);
  const [resolveLoading, setResolveLoading] = useState(false);

  const pageSize = 20;

  // ============================================================
  // Data Fetching
  // ============================================================

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get("/admin/fraud/stats");
      setStats(res.data);
    } catch (error) {
      console.error("Failed to fetch fraud stats:", error);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/fraud/alerts", {
        params: {
          resolved: showResolved,
          limit: pageSize,
          offset: alertsPage * pageSize,
        }
      });
      setAlerts(res.data.alerts || []);
      setAlertsTotal(res.data.total || 0);
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [alertsPage, showResolved]);

  const fetchSuspiciousGroups = useCallback(async () => {
    setSuspiciousLoading(true);
    try {
      const res = await api.get("/admin/fraud/suspicious-referrals", {
        params: { limit: 50 }
      });
      setSuspiciousGroups(res.data.suspicious_groups || []);
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    } finally {
      setSuspiciousLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchAlerts();
  }, [fetchStats, fetchAlerts]);

  useEffect(() => {
    if (activeTab === "suspicious") {
      fetchSuspiciousGroups();
    }
  }, [activeTab, fetchSuspiciousGroups]);

  // ============================================================
  // Actions
  // ============================================================

  const handleLookupUser = async () => {
    if (!lookupUserId.trim()) {
      toast.error("請輸入用戶 ID");
      return;
    }
    setLookupLoading(true);
    try {
      const res = await api.get(`/admin/fraud/user/${lookupUserId}`);
      setUserRiskInfo(res.data.data);
    } catch (error: any) {
      toast.error(getErrorMessage(error));
      setUserRiskInfo(null);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleResolveAlert = async () => {
    if (!selectedAlert) return;
    if (!resolutionNote.trim()) {
      toast.error("請輸入處理說明");
      return;
    }
    
    setResolveLoading(true);
    try {
      await api.post(`/admin/fraud/alerts/${selectedAlert.id}/resolve`, {
        resolution_note: resolutionNote,
        unblock_user: unblockUser,
      });
      toast.success("警報已處理");
      setResolveDialogOpen(false);
      setSelectedAlert(null);
      setResolutionNote("");
      setUnblockUser(false);
      fetchAlerts();
      fetchStats();
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    } finally {
      setResolveLoading(false);
    }
  };

  // ============================================================
  // Render Helpers
  // ============================================================

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    // 使用固定格式避免 SSR hydration 問題
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hour = String(d.getHours()).padStart(2, "0");
    const minute = String(d.getMinutes()).padStart(2, "0");
    return `${year}/${month}/${day} ${hour}:${minute}`;
  };

  const getRiskLevelConfig = (level: string) => {
    return RISK_LEVEL_CONFIG[level] || RISK_LEVEL_CONFIG.low;
  };

  const getAlertTypeConfig = (type: string) => {
    return ALERT_TYPE_CONFIG[type] || { label: type, icon: AlertTriangle, description: "" };
  };

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-1" />
                返回
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-red-400" />
                詐騙偵測
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                監控可疑活動，防止推薦獎金詐騙
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchStats(); fetchAlerts(); }}
            disabled={loading}
            className="bg-slate-800/50 border-slate-700"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
            刷新
          </Button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/20">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">未處理警報</p>
                    <p className="text-xl font-bold text-red-400">{stats.alerts.unresolved}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-500/20">
                    <Shield className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">總警報數</p>
                    <p className="text-xl font-bold text-white">{stats.alerts.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/20">
                    <Ban className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">獎金封鎖</p>
                    <p className="text-xl font-bold text-orange-400">{stats.risk_profiles.bonus_blocked}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">低風險</p>
                    <p className="text-xl font-bold text-green-400">{stats.risk_profiles.by_level.low || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-500/20">
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">中風險</p>
                    <p className="text-xl font-bold text-yellow-400">{stats.risk_profiles.by_level.medium || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/20">
                    <XCircle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">高風險</p>
                    <p className="text-xl font-bold text-red-400">{stats.risk_profiles.by_level.high || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="alerts" className="data-[state=active]:bg-red-600">
              警報列表
              {stats && stats.alerts.unresolved > 0 && (
                <Badge className="ml-2 bg-red-500/20 text-red-400">
                  {stats.alerts.unresolved}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="suspicious" className="data-[state=active]:bg-orange-600">
              可疑推薦
            </TabsTrigger>
            <TabsTrigger value="lookup" className="data-[state=active]:bg-indigo-600">
              用戶查詢
            </TabsTrigger>
          </TabsList>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-4 mt-4">
            {/* Filter */}
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="show-resolved"
                      checked={showResolved}
                      onCheckedChange={(checked) => {
                        setShowResolved(checked);
                        setAlertsPage(0);
                      }}
                    />
                    <Label htmlFor="show-resolved" className="text-slate-400">
                      顯示已處理
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Alerts List */}
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white">詐騙警報</CardTitle>
                <CardDescription>
                  系統自動偵測的可疑活動
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-red-400" />
                  </div>
                ) : alerts.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>{showResolved ? "沒有已處理的警報" : "目前沒有未處理的警報"}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {alerts.map((alert) => {
                      const typeConfig = getAlertTypeConfig(alert.alert_type);
                      const riskConfig = getRiskLevelConfig(alert.risk_level);
                      const TypeIcon = typeConfig.icon;
                      const RiskIcon = riskConfig.icon;

                      return (
                        <div
                          key={alert.id}
                          className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-slate-600/50 transition-colors"
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-sm font-mono text-slate-400">#{alert.id}</span>
                                <Badge className={cn("border", riskConfig.color)}>
                                  <RiskIcon className="w-3 h-3 mr-1" />
                                  {riskConfig.label}
                                </Badge>
                                <Badge className="bg-slate-700/50 text-slate-300">
                                  <TypeIcon className="w-3 h-3 mr-1" />
                                  {typeConfig.label}
                                </Badge>
                                {alert.is_resolved && (
                                  <Badge className="bg-green-500/20 text-green-400">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    已處理
                                  </Badge>
                                )}
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-slate-500">用戶 ID</p>
                                  <p className="text-white font-mono">#{alert.user_id}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500">風險分數</p>
                                  <p className="text-orange-400 font-semibold">{alert.risk_score.toFixed(1)}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500">關聯用戶</p>
                                  <p className="text-white">
                                    {alert.related_user_ids.length > 0 
                                      ? alert.related_user_ids.map(id => `#${id}`).join(", ")
                                      : "-"
                                    }
                                  </p>
                                </div>
                                <div>
                                  <p className="text-slate-500">建立時間</p>
                                  <p className="text-slate-300 text-xs">{formatDate(alert.created_at)}</p>
                                </div>
                              </div>

                              {typeConfig.description && (
                                <p className="text-xs text-slate-500">{typeConfig.description}</p>
                              )}

                              {alert.evidence && Object.keys(alert.evidence).length > 0 && (
                                <div className="mt-2 p-2 rounded bg-slate-900/50 text-xs">
                                  <p className="text-slate-500 mb-1">證據：</p>
                                  <pre className="text-slate-400 overflow-x-auto">
                                    {JSON.stringify(alert.evidence, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>

                            {!alert.is_resolved && (
                              <div className="flex-shrink-0">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedAlert(alert);
                                    setResolveDialogOpen(true);
                                  }}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  處理
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pagination */}
                {alertsTotal > pageSize && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700/50">
                    <p className="text-sm text-slate-400">
                      顯示 {alertsPage * pageSize + 1} - {Math.min((alertsPage + 1) * pageSize, alertsTotal)} / 共 {alertsTotal} 筆
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={alertsPage === 0}
                        onClick={() => setAlertsPage(alertsPage - 1)}
                        className="bg-slate-800/50 border-slate-700"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={(alertsPage + 1) * pageSize >= alertsTotal}
                        onClick={() => setAlertsPage(alertsPage + 1)}
                        className="bg-slate-800/50 border-slate-700"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Suspicious Referrals Tab */}
          <TabsContent value="suspicious" className="space-y-4 mt-4">
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-orange-400" />
                  可疑推薦群組
                </CardTitle>
                <CardDescription>
                  同 IP/裝置的用戶互相推薦
                </CardDescription>
              </CardHeader>
              <CardContent>
                {suspiciousLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
                  </div>
                ) : suspiciousGroups.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50 text-green-400" />
                    <p>沒有發現可疑的推薦群組</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {suspiciousGroups.map((group, index) => (
                      <div
                        key={index}
                        className="p-4 rounded-lg bg-slate-800/50 border border-orange-500/30"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <Badge className="bg-orange-500/20 text-orange-400">
                            <Globe className="w-3 h-3 mr-1" />
                            同 IP 群組
                          </Badge>
                          <span className="text-sm text-slate-400">
                            IP: {group.ip_hash}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                          <div>
                            <p className="text-slate-500">用戶數</p>
                            <p className="text-white font-semibold">{group.user_count}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">群內推薦</p>
                            <p className="text-orange-400 font-semibold">{group.referrals_within_group}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">用戶 IDs</p>
                            <p className="text-slate-300 font-mono text-xs">
                              {group.users.map(u => `#${u.id}`).join(", ")}
                            </p>
                          </div>
                        </div>

                        {group.referrals.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs text-slate-500">推薦關係：</p>
                            {group.referrals.map((ref, refIndex) => (
                              <div
                                key={refIndex}
                                className="flex items-center gap-2 text-sm p-2 rounded bg-slate-900/50"
                              >
                                <span className="text-slate-400">#{ref.referrer_id}</span>
                                <span className="text-slate-500">({ref.referrer_email})</span>
                                <Link2 className="w-4 h-4 text-orange-400" />
                                <span className="text-slate-400">#{ref.referred_id}</span>
                                <span className="text-slate-500">({ref.referred_email})</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Lookup Tab */}
          <TabsContent value="lookup" className="space-y-4 mt-4">
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white">用戶風險查詢</CardTitle>
                <CardDescription>
                  查詢特定用戶的風險資訊
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      value={lookupUserId}
                      onChange={(e) => setLookupUserId(e.target.value)}
                      placeholder="輸入用戶 ID..."
                      className="pl-10 bg-slate-800/50 border-slate-700"
                      onKeyDown={(e) => e.key === "Enter" && handleLookupUser()}
                    />
                  </div>
                  <Button
                    onClick={handleLookupUser}
                    disabled={lookupLoading}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {lookupLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    <span className="ml-2">查詢</span>
                  </Button>
                </div>

                {userRiskInfo && (
                  <div className="space-y-4">
                    {/* Risk Overview */}
                    <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                      <div className="flex items-center gap-3 mb-4">
                        <h3 className="text-white font-semibold">風險概覽</h3>
                        {(() => {
                          const config = getRiskLevelConfig(userRiskInfo.risk_level);
                          const Icon = config.icon;
                          return (
                            <Badge className={cn("border", config.color)}>
                              <Icon className="w-3 h-3 mr-1" />
                              {config.label}
                            </Badge>
                          );
                        })()}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500">用戶 ID</p>
                          <p className="text-white font-mono">#{userRiskInfo.user_id}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">風險分數</p>
                          <p className="text-orange-400 font-semibold">{userRiskInfo.risk_score.toFixed(1)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">關聯 IP 數</p>
                          <p className="text-white">{userRiskInfo.related_ips?.length || 0}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">關聯裝置數</p>
                          <p className="text-white">{userRiskInfo.related_devices || 0}</p>
                        </div>
                      </div>
                    </div>

                    {/* Restrictions */}
                    <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                      <h3 className="text-white font-semibold mb-4">限制狀態</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="flex items-center gap-2">
                          {userRiskInfo.referral_bonus_blocked ? (
                            <XCircle className="w-5 h-5 text-red-400" />
                          ) : (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                          )}
                          <span className="text-sm text-slate-300">推薦獎金</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {userRiskInfo.withdrawal_blocked ? (
                            <XCircle className="w-5 h-5 text-red-400" />
                          ) : (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                          )}
                          <span className="text-sm text-slate-300">提現功能</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {userRiskInfo.account_restricted ? (
                            <XCircle className="w-5 h-5 text-red-400" />
                          ) : (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                          )}
                          <span className="text-sm text-slate-300">帳號狀態</span>
                        </div>
                      </div>
                      {userRiskInfo.block_reason && (
                        <p className="mt-3 text-sm text-red-400">
                          封鎖原因：{userRiskInfo.block_reason}
                        </p>
                      )}
                    </div>

                    {/* User Alerts */}
                    {userRiskInfo.alerts && userRiskInfo.alerts.length > 0 && (
                      <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                        <h3 className="text-white font-semibold mb-4">相關警報</h3>
                        <div className="space-y-2">
                          {userRiskInfo.alerts.map((alert) => {
                            const typeConfig = getAlertTypeConfig(alert.alert_type);
                            const TypeIcon = typeConfig.icon;
                            return (
                              <div
                                key={alert.id}
                                className="flex items-center justify-between p-2 rounded bg-slate-900/50"
                              >
                                <div className="flex items-center gap-2">
                                  <TypeIcon className="w-4 h-4 text-orange-400" />
                                  <span className="text-sm text-slate-300">{typeConfig.label}</span>
                                  {alert.is_resolved && (
                                    <Badge className="text-[10px] bg-green-500/20 text-green-400">已處理</Badge>
                                  )}
                                </div>
                                <span className="text-xs text-slate-500">{formatDate(alert.created_at)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              處理警報
            </DialogTitle>
            <DialogDescription>
              標記此警報為已處理，並填寫處理說明
            </DialogDescription>
          </DialogHeader>

          {selectedAlert && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-800/50 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">警報 ID</span>
                  <span className="text-white">#{selectedAlert.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">類型</span>
                  <span className="text-white">{getAlertTypeConfig(selectedAlert.alert_type).label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">用戶 ID</span>
                  <span className="text-white">#{selectedAlert.user_id}</span>
                </div>
              </div>

              <div>
                <Label className="text-slate-300">處理說明</Label>
                <Textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="請輸入處理說明..."
                  className="mt-2 bg-slate-800/50 border-slate-700"
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="unblock-user"
                  checked={unblockUser}
                  onCheckedChange={setUnblockUser}
                />
                <Label htmlFor="unblock-user" className="text-slate-300">
                  同時解除用戶限制
                </Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResolveDialogOpen(false)}
              className="bg-slate-800/50 border-slate-700"
            >
              取消
            </Button>
            <Button
              onClick={handleResolveAlert}
              disabled={resolveLoading || !resolutionNote.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              {resolveLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              確認處理
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
