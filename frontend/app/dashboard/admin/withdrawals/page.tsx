"use client";

import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Wallet, Search, Filter, MoreHorizontal, CheckCircle, XCircle,
  Loader2, Clock, AlertTriangle, DollarSign, User, Building2,
  CreditCard, RefreshCw, ChevronLeft, ChevronRight, Eye,
  Send, Ban, FileCheck, ShieldAlert, ArrowLeft
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
    // Pydantic validation errors
    return detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ");
  }
  if (typeof detail === "object") {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  return "操作失敗";
}

// 避免 SSR hydration 問題的數字格式化
function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ============================================================
// Types
// ============================================================

interface WithdrawalRequest {
  id: number;
  user_id: number;
  user_email: string | null;
  credits_amount: number;
  amount_twd: number;
  status: string;
  bank_code: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  rejection_reason: string | null;
  transfer_reference: string | null;
  user_note: string | null;
  // 風控資訊
  is_first_withdrawal?: boolean;
  requires_manual_review?: boolean;
  risk_level?: string;
  risk_notes?: string;
  // 時間
  created_at: string;
  reviewed_at: string | null;
  transferred_at: string | null;
}

interface WithdrawalStats {
  total: number;
  pending: number;
  reviewing: number;
  approved: number;
  completed: number;
  rejected: number;
  total_amount_pending: number;
}

interface EligibleUser {
  id: number;
  email: string;
  full_name: string | null;
  customer_id: string | null;
  // BONUS 點數（獎金，可提領）
  bonus_balance: number;
  available_bonus: number;
  cooling_bonus: number;
  withdrawable_twd: number;
  // PAID 點數（付費，可退款 75%）
  paid_balance: number;
  paid_exchange_rate: number;  // 最後購買匯率 (TWD/點)
  paid_refundable_twd: number; // 可退款金額 (75%)
  // 認證狀態
  phone_verified: boolean;
  identity_verified: boolean;
  identity_real_name: string | null;
  two_factor_enabled: boolean;
  all_verified: boolean;
  has_pending_withdrawal: boolean;
  created_at: string | null;
}

interface EligibleStats {
  total_eligible_users: number;
  fully_verified_users: number;
  total_bonus_points: number;
  total_paid_points: number;
  total_withdrawable_twd: number;
  total_paid_refundable_twd: number;
}

// ============================================================
// Constants
// ============================================================

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "待審核", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Clock },
  reviewing: { label: "審核中", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Eye },
  approved: { label: "已核准", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle },
  rejected: { label: "已駁回", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle },
  completed: { label: "已完成", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: FileCheck },
  cancelled: { label: "已取消", color: "bg-slate-500/20 text-slate-400 border-slate-500/30", icon: Ban },
};

const RISK_LEVEL_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: "低風險", color: "bg-green-500/20 text-green-400" },
  medium: { label: "中風險", color: "bg-yellow-500/20 text-yellow-400" },
  high: { label: "高風險", color: "bg-red-500/20 text-red-400" },
};

// ============================================================
// Main Component
// ============================================================

export default function WithdrawalsAdminPage() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  // Dialog states
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequest | null>(null);
  const [actionType, setActionType] = useState<"view" | "approve" | "reject" | "complete" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [reviewNote, setReviewNote] = useState("");

  // Stats
  const [stats, setStats] = useState<WithdrawalStats>({
    total: 0,
    pending: 0,
    reviewing: 0,
    approved: 0,
    completed: 0,
    rejected: 0,
    total_amount_pending: 0,
  });

  // Tab state
  const [activeTab, setActiveTab] = useState<"requests" | "eligible">("requests");

  // Eligible users state
  const [eligibleUsers, setEligibleUsers] = useState<EligibleUser[]>([]);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [eligibleStats, setEligibleStats] = useState<EligibleStats>({
    total_eligible_users: 0,
    fully_verified_users: 0,
    total_bonus_points: 0,
    total_paid_points: 0,
    total_withdrawable_twd: 0,
    total_paid_refundable_twd: 0,
  });
  const [eligibleSearchTerm, setEligibleSearchTerm] = useState("");
  const [eligiblePage, setEligiblePage] = useState(0);
  const [eligibleTotal, setEligibleTotal] = useState(0);

  // ============================================================
  // Data Fetching
  // ============================================================

  const fetchWithdrawals = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        limit: pageSize,
        offset: page * pageSize,
      };
      if (statusFilter !== "all") {
        params.status = statusFilter;
      }

      const res = await api.get("/credits/admin/withdrawals", { params });
      setWithdrawals(res.data.requests || []);
      setTotal(res.data.total || 0);

      // Calculate stats by fetching each status count
      const statusList = ["pending", "reviewing", "approved", "completed", "rejected"];
      const statsPromises = statusList.map(s => 
        api.get("/credits/admin/withdrawals", { params: { status: s, limit: 1 } })
      );
      const statsResults = await Promise.all(statsPromises);
      
      // Also get all pending/reviewing/approved for amount calculation
      const pendingRes = await api.get("/credits/admin/withdrawals", { params: { status: "pending", limit: 200 } });
      const reviewingRes = await api.get("/credits/admin/withdrawals", { params: { status: "reviewing", limit: 200 } });
      const approvedRes = await api.get("/credits/admin/withdrawals", { params: { status: "approved", limit: 200 } });
      
      const pendingAmount = (pendingRes.data.requests || []).reduce((sum: number, w: WithdrawalRequest) => sum + w.amount_twd, 0);
      const reviewingAmount = (reviewingRes.data.requests || []).reduce((sum: number, w: WithdrawalRequest) => sum + w.amount_twd, 0);
      const approvedAmount = (approvedRes.data.requests || []).reduce((sum: number, w: WithdrawalRequest) => sum + w.amount_twd, 0);
      
      const newStats: WithdrawalStats = {
        total: res.data.total || 0,
        pending: statsResults[0].data.total || 0,
        reviewing: statsResults[1].data.total || 0,
        approved: statsResults[2].data.total || 0,
        completed: statsResults[3].data.total || 0,
        rejected: statsResults[4].data.total || 0,
        total_amount_pending: pendingAmount + reviewingAmount + approvedAmount,
      };
      
      setStats(newStats);
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  // Fetch eligible users
  const fetchEligibleUsers = useCallback(async () => {
    setEligibleLoading(true);
    try {
      const res = await api.get("/credits/admin/eligible-users", {
        params: {
          limit: pageSize,
          offset: eligiblePage * pageSize,
        }
      });
      setEligibleUsers(res.data.users || []);
      setEligibleTotal(res.data.total || 0);
      setEligibleStats(res.data.stats || {
        total_eligible_users: 0,
        fully_verified_users: 0,
        total_bonus_points: 0,
        total_paid_points: 0,
        total_withdrawable_twd: 0,
        total_paid_refundable_twd: 0,
      });
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    } finally {
      setEligibleLoading(false);
    }
  }, [eligiblePage]);

  useEffect(() => {
    if (activeTab === "eligible") {
      fetchEligibleUsers();
    }
  }, [activeTab, fetchEligibleUsers]);

  // ============================================================
  // Actions
  // ============================================================

  const handleApprove = async () => {
    if (!selectedWithdrawal) return;
    setActionLoading(true);
    try {
      await api.post(`/credits/admin/withdrawals/${selectedWithdrawal.id}/review`, {
        action: "approve",
        note: reviewNote || undefined,
      });
      toast.success("已核准提領申請");
      setActionType(null);
      setSelectedWithdrawal(null);
      setReviewNote("");
      fetchWithdrawals();
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedWithdrawal || !rejectionReason.trim()) {
      toast.error("請輸入駁回原因");
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/credits/admin/withdrawals/${selectedWithdrawal.id}/review`, {
        action: "reject",
        rejection_reason: rejectionReason,
        note: reviewNote || undefined,
      });
      toast.success("已駁回提領申請，點數已退還用戶");
      setActionType(null);
      setSelectedWithdrawal(null);
      setRejectionReason("");
      setReviewNote("");
      fetchWithdrawals();
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!selectedWithdrawal || !transferReference.trim()) {
      toast.error("請輸入轉帳序號");
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/credits/admin/withdrawals/${selectedWithdrawal.id}/complete`, {
        transfer_reference: transferReference,
      });
      toast.success("已完成匯款");
      setActionType(null);
      setSelectedWithdrawal(null);
      setTransferReference("");
      fetchWithdrawals();
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  // ============================================================
  // Filtered Data
  // ============================================================

  const filteredWithdrawals = withdrawals.filter((w) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      w.user_email?.toLowerCase().includes(search) ||
      w.account_holder?.toLowerCase().includes(search) ||
      w.id.toString().includes(search)
    );
  });

  // ============================================================
  // Render
  // ============================================================

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    // 使用固定格式避免 SSR hydration 問題
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hour = String(d.getHours()).padStart(2, "0");
    const minute = String(d.getMinutes()).padStart(2, "0");
    return `${year}/${month}/${day} ${hour}:${minute}`;
  };

  const formatAmount = (amount: number) => {
    // 使用固定格式避免 SSR hydration 問題
    const rounded = Math.round(amount);
    return `NT$${formatNumber(rounded)}`;
  };

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
                <Wallet className="w-6 h-6 text-emerald-400" />
                提領審核
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                管理用戶提領申請，審核與匯款確認
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchWithdrawals}
            disabled={loading}
            className="bg-slate-800/50 border-slate-700"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
            刷新
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/20">
                  <Clock className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">待審核</p>
                  <p className="text-xl font-bold text-white">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Eye className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">審核中</p>
                  <p className="text-xl font-bold text-white">{stats.reviewing}</p>
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
                  <p className="text-xs text-slate-400">待匯款</p>
                  <p className="text-xl font-bold text-white">{stats.approved}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <FileCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">已完成</p>
                  <p className="text-xl font-bold text-white">{stats.completed}</p>
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
                  <p className="text-xs text-slate-400">已駁回</p>
                  <p className="text-xl font-bold text-white">{stats.rejected}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/20">
                  <DollarSign className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">待處理金額</p>
                  <p className="text-lg font-bold text-white">{formatAmount(stats.total_amount_pending)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "requests" | "eligible")}>
          <TabsList className="bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="requests" className="data-[state=active]:bg-indigo-600">
              提領申請
            </TabsTrigger>
            <TabsTrigger value="eligible" className="data-[state=active]:bg-emerald-600">
              可提領用戶
              {eligibleStats.total_eligible_users > 0 && (
                <Badge className="ml-2 bg-emerald-500/20 text-emerald-400">
                  {eligibleStats.total_eligible_users}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="space-y-4 mt-4">
            {/* Filters */}
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="搜尋用戶 Email、戶名、申請編號..."
                      className="pl-10 bg-slate-800/50 border-slate-700"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                    <SelectTrigger className="w-[180px] bg-slate-800/50 border-slate-700">
                      <Filter className="w-4 h-4 mr-2 text-slate-400" />
                      <SelectValue placeholder="狀態篩選" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="all">全部狀態</SelectItem>
                      <SelectItem value="pending">待審核</SelectItem>
                      <SelectItem value="reviewing">審核中</SelectItem>
                      <SelectItem value="approved">已核准（待匯款）</SelectItem>
                      <SelectItem value="completed">已完成</SelectItem>
                      <SelectItem value="rejected">已駁回</SelectItem>
                      <SelectItem value="cancelled">已取消</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

        {/* Withdrawals List */}
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white">提領申請列表</CardTitle>
            <CardDescription>
              共 {total} 筆申請
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              </div>
            ) : filteredWithdrawals.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>沒有提領申請</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredWithdrawals.map((withdrawal) => {
                  const statusConfig = STATUS_CONFIG[withdrawal.status] || STATUS_CONFIG.pending;
                  const StatusIcon = statusConfig.icon;
                  const riskConfig = RISK_LEVEL_CONFIG[withdrawal.risk_level || "low"];

                  return (
                    <div
                      key={withdrawal.id}
                      className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-slate-600/50 transition-colors"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Left: Info */}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-sm font-mono text-slate-400">#{withdrawal.id}</span>
                            <Badge className={cn("border", statusConfig.color)}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusConfig.label}
                            </Badge>
                            {withdrawal.is_first_withdrawal && (
                              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                                首次提領
                              </Badge>
                            )}
                            {withdrawal.requires_manual_review && (
                              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                                <ShieldAlert className="w-3 h-3 mr-1" />
                                需人工審核
                              </Badge>
                            )}
                            {withdrawal.risk_level && withdrawal.risk_level !== "low" && (
                              <Badge className={riskConfig.color}>
                                {riskConfig.label}
                              </Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-slate-500">用戶</p>
                              <p className="text-white flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {withdrawal.user_email || `ID: ${withdrawal.user_id}`}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">金額</p>
                              <p className="text-emerald-400 font-semibold">
                                {formatAmount(withdrawal.amount_twd)}
                                <span className="text-slate-500 font-normal ml-1">
                                  ({formatNumber(withdrawal.credits_amount)} 點)
                                </span>
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">銀行帳戶</p>
                              <p className="text-white flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {withdrawal.bank_name} ({withdrawal.bank_code})
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">戶名 / 帳號</p>
                              <p className="text-white flex items-center gap-1">
                                <CreditCard className="w-3 h-3" />
                                {withdrawal.account_holder} / {withdrawal.account_number}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span>申請時間：{formatDate(withdrawal.created_at)}</span>
                            {withdrawal.reviewed_at && (
                              <span>審核時間：{formatDate(withdrawal.reviewed_at)}</span>
                            )}
                            {withdrawal.transferred_at && (
                              <span>匯款時間：{formatDate(withdrawal.transferred_at)}</span>
                            )}
                          </div>

                          {withdrawal.risk_notes && (
                            <p className="text-xs text-orange-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {withdrawal.risk_notes}
                            </p>
                          )}

                          {withdrawal.rejection_reason && (
                            <p className="text-xs text-red-400 flex items-center gap-1">
                              <XCircle className="w-3 h-3" />
                              駁回原因：{withdrawal.rejection_reason}
                            </p>
                          )}

                          {withdrawal.transfer_reference && (
                            <p className="text-xs text-emerald-400 flex items-center gap-1">
                              <FileCheck className="w-3 h-3" />
                              轉帳序號：{withdrawal.transfer_reference}
                            </p>
                          )}
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {(withdrawal.status === "pending" || withdrawal.status === "reviewing") && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedWithdrawal(withdrawal);
                                  setActionType("approve");
                                }}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                核准
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setSelectedWithdrawal(withdrawal);
                                  setActionType("reject");
                                }}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                駁回
                              </Button>
                            </>
                          )}
                          {withdrawal.status === "approved" && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedWithdrawal(withdrawal);
                                setActionType("complete");
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              <Send className="w-4 h-4 mr-1" />
                              確認匯款
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedWithdrawal(withdrawal);
                              setActionType("view");
                            }}
                            className="text-slate-400 hover:text-white"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {total > pageSize && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700/50">
                <p className="text-sm text-slate-400">
                  顯示 {page * pageSize + 1} - {Math.min((page + 1) * pageSize, total)} / 共 {total} 筆
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                    className="bg-slate-800/50 border-slate-700"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={(page + 1) * pageSize >= total}
                    onClick={() => setPage(page + 1)}
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

          {/* Eligible Users Tab */}
          <TabsContent value="eligible" className="space-y-4 mt-4">
            {/* Eligible Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Card className="bg-slate-900/50 border-slate-700/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/20">
                      <User className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">可提領用戶</p>
                      <p className="text-xl font-bold text-white">{eligibleStats.total_eligible_users}</p>
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
                      <p className="text-xs text-slate-400">已完成認證</p>
                      <p className="text-xl font-bold text-white">{eligibleStats.fully_verified_users}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-slate-700/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/20">
                      <Wallet className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">BONUS 獎金點數</p>
                      <p className="text-xl font-bold text-indigo-400">{formatNumber(eligibleStats.total_bonus_points)}</p>
                      <p className="text-[10px] text-slate-500">可提領現金</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-slate-700/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/20">
                      <CreditCard className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">PAID 付費點數</p>
                      <p className="text-xl font-bold text-purple-400">{formatNumber(eligibleStats.total_paid_points)}</p>
                      <p className="text-[10px] text-slate-500">
                        可退 {formatAmount(eligibleStats.total_paid_refundable_twd)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-slate-700/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/20">
                      <DollarSign className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">可提領總額</p>
                      <p className="text-lg font-bold text-amber-400">{formatAmount(eligibleStats.total_withdrawable_twd)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Search */}
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      value={eligibleSearchTerm}
                      onChange={(e) => setEligibleSearchTerm(e.target.value)}
                      placeholder="搜尋用戶 Email、姓名..."
                      className="pl-10 bg-slate-800/50 border-slate-700"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchEligibleUsers}
                    disabled={eligibleLoading}
                    className="bg-slate-800/50 border-slate-700"
                  >
                    <RefreshCw className={cn("w-4 h-4 mr-2", eligibleLoading && "animate-spin")} />
                    刷新
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Eligible Users List */}
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white">可提領用戶清單</CardTitle>
                <CardDescription>
                  獎金點數達 300 點以上的用戶（1 BONUS 點 = NT$1）
                </CardDescription>
              </CardHeader>
              <CardContent>
                {eligibleLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                  </div>
                ) : eligibleUsers.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>目前沒有達到提領門檻的用戶</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {eligibleUsers
                      .filter((u) => {
                        if (!eligibleSearchTerm) return true;
                        const search = eligibleSearchTerm.toLowerCase();
                        return (
                          u.email?.toLowerCase().includes(search) ||
                          u.full_name?.toLowerCase().includes(search) ||
                          u.identity_real_name?.toLowerCase().includes(search)
                        );
                      })
                      .map((user) => (
                        <div
                          key={user.id}
                          className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-slate-600/50 transition-colors"
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            {/* Left: Info */}
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-sm font-mono text-slate-400">#{user.id}</span>
                                {user.all_verified ? (
                                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    認證完成
                                  </Badge>
                                ) : (
                                  <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    認證未完成
                                  </Badge>
                                )}
                                {user.has_pending_withdrawal && (
                                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                                    <Clock className="w-3 h-3 mr-1" />
                                    有待處理申請
                                  </Badge>
                                )}
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                                <div>
                                  <p className="text-slate-500">用戶</p>
                                  <p className="text-white">{user.email}</p>
                                  {user.full_name && (
                                    <p className="text-slate-400 text-xs">{user.full_name}</p>
                                  )}
                                </div>
                                <div>
                                  <p className="text-slate-500 flex items-center gap-1">
                                    <Badge className="text-[10px] px-1 py-0 bg-indigo-500/20 text-indigo-400">BONUS</Badge>
                                    獎金
                                  </p>
                                  <p className="text-indigo-400 font-semibold">
                                    {formatNumber(user.bonus_balance)} 點
                                  </p>
                                  {user.cooling_bonus > 0 ? (
                                    <p className="text-orange-400 text-xs">
                                      冷卻中: {formatNumber(user.cooling_bonus)}
                                    </p>
                                  ) : (
                                    <p className="text-slate-500 text-xs">可提領現金</p>
                                  )}
                                </div>
                                <div>
                                  <p className="text-slate-500 flex items-center gap-1">
                                    <Badge className="text-[10px] px-1 py-0 bg-purple-500/20 text-purple-400">PAID</Badge>
                                    付費
                                  </p>
                                  <p className="text-purple-400 font-semibold">
                                    {formatNumber(user.paid_balance)} 點
                                  </p>
                                  <p className="text-slate-500 text-xs">
                                    可退 {formatAmount(user.paid_refundable_twd)}
                                  </p>
                                  {user.paid_exchange_rate > 0 && (
                                    <p className="text-slate-600 text-[10px]">
                                      @{user.paid_exchange_rate}/點×75%
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <p className="text-slate-500">可提領</p>
                                  <p className="text-emerald-400 font-semibold">
                                    {formatAmount(user.withdrawable_twd)}
                                  </p>
                                  <p className="text-slate-500 text-xs">
                                    ({formatNumber(user.available_bonus)} 點)
                                  </p>
                                </div>
                                <div>
                                  <p className="text-slate-500">認證狀態</p>
                                  <div className="flex gap-1 mt-1">
                                    <Badge className={cn(
                                      "text-[10px] px-1.5",
                                      user.phone_verified 
                                        ? "bg-green-500/20 text-green-400" 
                                        : "bg-slate-500/20 text-slate-400"
                                    )}>
                                      手機
                                    </Badge>
                                    <Badge className={cn(
                                      "text-[10px] px-1.5",
                                      user.identity_verified 
                                        ? "bg-green-500/20 text-green-400" 
                                        : "bg-slate-500/20 text-slate-400"
                                    )}>
                                      身份
                                    </Badge>
                                    <Badge className={cn(
                                      "text-[10px] px-1.5",
                                      user.two_factor_enabled 
                                        ? "bg-green-500/20 text-green-400" 
                                        : "bg-slate-500/20 text-slate-400"
                                    )}>
                                      2FA
                                    </Badge>
                                  </div>
                                </div>
                              </div>

                              {user.identity_real_name && (
                                <p className="text-xs text-slate-500">
                                  身份認證姓名：{user.identity_real_name}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* Pagination */}
                {eligibleTotal > pageSize && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700/50">
                    <p className="text-sm text-slate-400">
                      顯示 {eligiblePage * pageSize + 1} - {Math.min((eligiblePage + 1) * pageSize, eligibleTotal)} / 共 {eligibleTotal} 筆
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={eligiblePage === 0}
                        onClick={() => setEligiblePage(eligiblePage - 1)}
                        className="bg-slate-800/50 border-slate-700"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={(eligiblePage + 1) * pageSize >= eligibleTotal}
                        onClick={() => setEligiblePage(eligiblePage + 1)}
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
        </Tabs>
      </div>

      {/* Approve Dialog */}
      <Dialog open={actionType === "approve"} onOpenChange={() => setActionType(null)}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              確認核准提領
            </DialogTitle>
            <DialogDescription>
              核准後將進入「待匯款」狀態，需手動完成匯款後再標記為完成
            </DialogDescription>
          </DialogHeader>

          {selectedWithdrawal && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-800/50 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">用戶</span>
                  <span className="text-white">{selectedWithdrawal.user_email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">金額</span>
                  <span className="text-emerald-400 font-semibold">
                    {formatAmount(selectedWithdrawal.amount_twd)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">銀行</span>
                  <span className="text-white">{selectedWithdrawal.bank_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">帳號</span>
                  <span className="text-white font-mono">{selectedWithdrawal.account_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">戶名</span>
                  <span className="text-white">{selectedWithdrawal.account_holder}</span>
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-2 block">審核備註（可選）</label>
                <Textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="輸入審核備註..."
                  className="bg-slate-800/50 border-slate-700"
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setActionType(null)}
              className="text-slate-400"
            >
              取消
            </Button>
            <Button
              onClick={handleApprove}
              disabled={actionLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              確認核准
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={actionType === "reject"} onOpenChange={() => setActionType(null)}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-400" />
              駁回提領申請
            </DialogTitle>
            <DialogDescription>
              駁回後點數將自動退還給用戶
            </DialogDescription>
          </DialogHeader>

          {selectedWithdrawal && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-800/50 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">用戶</span>
                  <span className="text-white">{selectedWithdrawal.user_email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">金額</span>
                  <span className="text-white">{formatAmount(selectedWithdrawal.amount_twd)}</span>
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-2 block">
                  駁回原因 <span className="text-red-400">*</span>
                </label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="請輸入駁回原因，用戶將會看到此訊息..."
                  className="bg-slate-800/50 border-slate-700"
                  rows={3}
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-2 block">內部備註（可選）</label>
                <Textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="輸入內部備註..."
                  className="bg-slate-800/50 border-slate-700"
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setActionType(null)}
              className="text-slate-400"
            >
              取消
            </Button>
            <Button
              onClick={handleReject}
              disabled={actionLoading || !rejectionReason.trim()}
              variant="destructive"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              確認駁回
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={actionType === "complete"} onOpenChange={() => setActionType(null)}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-emerald-400" />
              確認已完成匯款
            </DialogTitle>
            <DialogDescription>
              請確認已完成銀行匯款，並輸入轉帳序號
            </DialogDescription>
          </DialogHeader>

          {selectedWithdrawal && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-800/50 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">用戶</span>
                  <span className="text-white">{selectedWithdrawal.user_email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">金額</span>
                  <span className="text-emerald-400 font-semibold">
                    {formatAmount(selectedWithdrawal.amount_twd)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">銀行</span>
                  <span className="text-white">{selectedWithdrawal.bank_name} ({selectedWithdrawal.bank_code})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">帳號</span>
                  <span className="text-white font-mono">{selectedWithdrawal.account_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">戶名</span>
                  <span className="text-white">{selectedWithdrawal.account_holder}</span>
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-2 block">
                  轉帳序號 <span className="text-red-400">*</span>
                </label>
                <Input
                  value={transferReference}
                  onChange={(e) => setTransferReference(e.target.value)}
                  placeholder="輸入銀行轉帳序號..."
                  className="bg-slate-800/50 border-slate-700 font-mono"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setActionType(null)}
              className="text-slate-400"
            >
              取消
            </Button>
            <Button
              onClick={handleComplete}
              disabled={actionLoading || !transferReference.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileCheck className="w-4 h-4 mr-2" />
              )}
              確認完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={actionType === "view"} onOpenChange={() => setActionType(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Eye className="w-5 h-5 text-indigo-400" />
              提領申請詳情
            </DialogTitle>
          </DialogHeader>

          {selectedWithdrawal && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                {/* Status */}
                <div className="flex items-center gap-3">
                  {(() => {
                    const config = STATUS_CONFIG[selectedWithdrawal.status];
                    const Icon = config.icon;
                    return (
                      <Badge className={cn("border text-sm", config.color)}>
                        <Icon className="w-4 h-4 mr-1" />
                        {config.label}
                      </Badge>
                    );
                  })()}
                  {selectedWithdrawal.is_first_withdrawal && (
                    <Badge className="bg-purple-500/20 text-purple-400">首次提領</Badge>
                  )}
                  {selectedWithdrawal.risk_level && selectedWithdrawal.risk_level !== "low" && (
                    <Badge className={RISK_LEVEL_CONFIG[selectedWithdrawal.risk_level].color}>
                      {RISK_LEVEL_CONFIG[selectedWithdrawal.risk_level].label}
                    </Badge>
                  )}
                </div>

                {/* Basic Info */}
                <div className="p-4 rounded-lg bg-slate-800/50 space-y-3">
                  <h4 className="text-sm font-medium text-white">基本資訊</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500">申請編號</p>
                      <p className="text-white font-mono">#{selectedWithdrawal.id}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">用戶 ID</p>
                      <p className="text-white">{selectedWithdrawal.user_id}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">用戶 Email</p>
                      <p className="text-white">{selectedWithdrawal.user_email}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">提領點數</p>
                      <p className="text-white">{formatNumber(selectedWithdrawal.credits_amount)} 點</p>
                    </div>
                    <div>
                      <p className="text-slate-500">金額</p>
                      <p className="text-emerald-400 font-semibold">{formatAmount(selectedWithdrawal.amount_twd)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">申請時間</p>
                      <p className="text-white">{formatDate(selectedWithdrawal.created_at)}</p>
                    </div>
                  </div>
                </div>

                {/* Bank Info */}
                <div className="p-4 rounded-lg bg-slate-800/50 space-y-3">
                  <h4 className="text-sm font-medium text-white">銀行帳戶</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500">銀行</p>
                      <p className="text-white">{selectedWithdrawal.bank_name} ({selectedWithdrawal.bank_code})</p>
                    </div>
                    <div>
                      <p className="text-slate-500">帳號</p>
                      <p className="text-white font-mono">{selectedWithdrawal.account_number}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-slate-500">戶名</p>
                      <p className="text-white">{selectedWithdrawal.account_holder}</p>
                    </div>
                  </div>
                </div>

                {/* Risk Info */}
                {(selectedWithdrawal.risk_notes || selectedWithdrawal.requires_manual_review) && (
                  <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30 space-y-3">
                    <h4 className="text-sm font-medium text-orange-400 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4" />
                      風控資訊
                    </h4>
                    <div className="text-sm space-y-2">
                      {selectedWithdrawal.requires_manual_review && (
                        <p className="text-orange-300">需人工審核</p>
                      )}
                      {selectedWithdrawal.risk_notes && (
                        <p className="text-orange-300">{selectedWithdrawal.risk_notes}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Review Info */}
                {(selectedWithdrawal.reviewed_at || selectedWithdrawal.rejection_reason || selectedWithdrawal.transfer_reference) && (
                  <div className="p-4 rounded-lg bg-slate-800/50 space-y-3">
                    <h4 className="text-sm font-medium text-white">處理記錄</h4>
                    <div className="text-sm space-y-2">
                      {selectedWithdrawal.reviewed_at && (
                        <div>
                          <p className="text-slate-500">審核時間</p>
                          <p className="text-white">{formatDate(selectedWithdrawal.reviewed_at)}</p>
                        </div>
                      )}
                      {selectedWithdrawal.rejection_reason && (
                        <div>
                          <p className="text-slate-500">駁回原因</p>
                          <p className="text-red-400">{selectedWithdrawal.rejection_reason}</p>
                        </div>
                      )}
                      {selectedWithdrawal.transfer_reference && (
                        <div>
                          <p className="text-slate-500">轉帳序號</p>
                          <p className="text-emerald-400 font-mono">{selectedWithdrawal.transfer_reference}</p>
                        </div>
                      )}
                      {selectedWithdrawal.transferred_at && (
                        <div>
                          <p className="text-slate-500">匯款時間</p>
                          <p className="text-white">{formatDate(selectedWithdrawal.transferred_at)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* User Note */}
                {selectedWithdrawal.user_note && (
                  <div className="p-4 rounded-lg bg-slate-800/50 space-y-3">
                    <h4 className="text-sm font-medium text-white">用戶備註</h4>
                    <p className="text-sm text-slate-300">{selectedWithdrawal.user_note}</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setActionType(null)}
              className="text-slate-400"
            >
              關閉
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
