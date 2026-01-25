"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  DollarSign,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  Clock,
  Wallet,
  RefreshCw,
  FileText,
  ShieldAlert,
  Calendar,
  ArrowRight,
  Activity,
  Zap,
  BarChart3,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Crown,
} from "lucide-react";
import Link from "next/link";

interface PendingItems {
  withdrawals: { count: number; amount: number };
  refunds: { count: number; amount: number };
  orders: number;
  failed_posts: number;
  fraud_alerts: number;
  total: number;
}

interface DashboardData {
  success: boolean;
  timestamp: string;
  is_super_admin: boolean;
  pending_items: PendingItems;
  users: {
    total: number;
    active: number;
    paying: number;
    new_today: number;
    new_week: number;
  };
  revenue: {
    today: number;
    week: number;
    month: number;
  };
  generations: {
    today: number;
    week: number;
  };
  recent_pending: {
    withdrawals: any[];
    refunds: any[];
    orders: any[];
    failed_posts: any[];
  };
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/admin/dashboard/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 403) {
          router.push("/dashboard");
          return;
        }
        throw new Error("Failed to fetch");
      }

      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching dashboard:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [API_URL, router]);

  useEffect(() => {
    fetchDashboard();
    // 每 30 秒自動刷新
    const interval = setInterval(() => fetchDashboard(true), 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("zh-TW").format(num);
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency: "TWD",
      minimumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("zh-TW", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "outline", label: "待處理" },
      reviewing: { variant: "secondary", label: "審核中" },
      approved: { variant: "default", label: "已核准" },
      processing: { variant: "secondary", label: "處理中" },
      paid: { variant: "default", label: "已付款" },
      completed: { variant: "default", label: "已完成" },
      failed: { variant: "destructive", label: "失敗" },
      rejected: { variant: "destructive", label: "已駁回" },
    };
    const c = config[status] || { variant: "outline" as const, label: status };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const getRiskBadge = (level: string) => {
    const config: Record<string, { className: string; label: string }> = {
      low: { className: "bg-green-500/20 text-green-500", label: "低風險" },
      medium: { className: "bg-yellow-500/20 text-yellow-500", label: "中風險" },
      high: { className: "bg-red-500/20 text-red-500", label: "高風險" },
    };
    const c = config[level] || { className: "bg-gray-500/20 text-gray-500", label: level };
    return <Badge className={c.className}>{c.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">無法載入儀表板數據</p>
        <Button onClick={() => fetchDashboard()}>重新載入</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            管理員總覽
            {data.is_super_admin && (
              <Badge className="bg-amber-500 text-white">
                <Crown className="h-3 w-3 mr-1" />
                Super Admin
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">
            系統狀態與待處理事項一覽
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchDashboard(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "刷新中..." : "刷新"}
        </Button>
      </div>

      {/* 待處理事項提醒 */}
      {data.pending_items.total > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/20 rounded-full">
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-500">
                  您有 {data.pending_items.total} 項待處理事項
                </h3>
                <p className="text-sm text-muted-foreground">
                  {data.pending_items.withdrawals.count > 0 && `${data.pending_items.withdrawals.count} 筆提領申請 · `}
                  {data.pending_items.refunds.count > 0 && `${data.pending_items.refunds.count} 筆退款申請 · `}
                  {data.pending_items.fraud_alerts > 0 && `${data.pending_items.fraud_alerts} 個詐騙警報 · `}
                  {data.pending_items.failed_posts > 0 && `${data.pending_items.failed_posts} 個發布失敗`}
                </p>
              </div>
              <Button asChild>
                <Link href="#pending">立即處理</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 統計卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 待處理提領 */}
        <Card className={data.pending_items.withdrawals.count > 0 ? "border-orange-500/50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">待處理提領</CardTitle>
            <Wallet className={`h-4 w-4 ${data.pending_items.withdrawals.count > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.pending_items.withdrawals.count}</div>
            <p className="text-xs text-muted-foreground">
              金額 {formatCurrency(data.pending_items.withdrawals.amount)}
            </p>
            {data.pending_items.withdrawals.count > 0 && (
              <Button variant="link" size="sm" className="p-0 h-auto mt-2" asChild>
                <Link href="/dashboard/admin/withdrawals">
                  前往審核 <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* 待處理退款 */}
        <Card className={data.pending_items.refunds.count > 0 ? "border-red-500/50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">待處理退款</CardTitle>
            <CreditCard className={`h-4 w-4 ${data.pending_items.refunds.count > 0 ? "text-red-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.pending_items.refunds.count}</div>
            <p className="text-xs text-muted-foreground">
              金額 {formatCurrency(data.pending_items.refunds.amount)}
            </p>
          </CardContent>
        </Card>

        {/* 詐騙警報 */}
        <Card className={data.pending_items.fraud_alerts > 0 ? "border-red-500/50 bg-red-500/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">詐騙警報</CardTitle>
            <ShieldAlert className={`h-4 w-4 ${data.pending_items.fraud_alerts > 0 ? "text-red-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.pending_items.fraud_alerts}</div>
            <p className="text-xs text-muted-foreground">
              未解決警報
            </p>
            {data.pending_items.fraud_alerts > 0 && (
              <Button variant="link" size="sm" className="p-0 h-auto mt-2 text-red-500" asChild>
                <Link href="/dashboard/admin/fraud">
                  立即查看 <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* 發布失敗 */}
        <Card className={data.pending_items.failed_posts > 0 ? "border-yellow-500/50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">發布失敗</CardTitle>
            <Calendar className={`h-4 w-4 ${data.pending_items.failed_posts > 0 ? "text-yellow-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.pending_items.failed_posts}</div>
            <p className="text-xs text-muted-foreground">
              排程發布失敗
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 營運數據 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 用戶總數 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">用戶總數</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.users.total)}</div>
            <p className="text-xs text-muted-foreground">
              活躍 {formatNumber(data.users.active)} · 今日新增 +{data.users.new_today}
            </p>
          </CardContent>
        </Card>

        {/* 付費用戶 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">付費用戶</CardTitle>
            <Crown className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.users.paying)}</div>
            <p className="text-xs text-muted-foreground">
              轉換率 {((data.users.paying / data.users.total) * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        {/* 本月收入 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">本月收入</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {formatCurrency(data.revenue.month)}
            </div>
            <p className="text-xs text-muted-foreground">
              今日 {formatCurrency(data.revenue.today)} · 本週 {formatCurrency(data.revenue.week)}
            </p>
          </CardContent>
        </Card>

        {/* 生成次數 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">AI 生成</CardTitle>
            <Zap className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.generations.week)}</div>
            <p className="text-xs text-muted-foreground">
              本週生成 · 今日 {formatNumber(data.generations.today)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 待處理事項詳細列表 */}
      <div id="pending">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              總覽
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              提領
              {data.pending_items.withdrawals.count > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                  {data.pending_items.withdrawals.count}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="refunds" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              退款
              {data.pending_items.refunds.count > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                  {data.pending_items.refunds.count}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              訂單
            </TabsTrigger>
          </TabsList>

          {/* 總覽 Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 最近提領申請 */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">最近提領申請</CardTitle>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/dashboard/admin/withdrawals">查看全部</Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {data.recent_pending.withdrawals.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p>暫無待處理提領</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {data.recent_pending.withdrawals.map((w) => (
                        <div key={w.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <div className="font-medium">用戶 #{w.user_id}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatNumber(w.credits_amount)} 點 → {formatCurrency(w.amount_twd)}
                            </div>
                          </div>
                          <div className="text-right">
                            {getRiskBadge(w.risk_level)}
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatDate(w.created_at)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 最近退款申請 */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">最近退款申請</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {data.recent_pending.refunds.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p>暫無待處理退款</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {data.recent_pending.refunds.map((r) => (
                        <div key={r.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <div className="font-medium font-mono">{r.request_no}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatNumber(r.credits_amount)} 點 → {formatCurrency(r.refund_amount)}
                            </div>
                          </div>
                          <div className="text-right">
                            {getStatusBadge(r.status)}
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatDate(r.created_at)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* 失敗的排程 */}
            {data.recent_pending.failed_posts.length > 0 && (
              <Card className="border-yellow-500/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                    發布失敗的排程
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>用戶</TableHead>
                        <TableHead>類型</TableHead>
                        <TableHead>錯誤訊息</TableHead>
                        <TableHead>重試次數</TableHead>
                        <TableHead>時間</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recent_pending.failed_posts.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>#{p.id}</TableCell>
                          <TableCell>#{p.user_id}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{p.content_type}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm text-red-500">
                            {p.error_message || "-"}
                          </TableCell>
                          <TableCell>{p.retry_count}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(p.updated_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 提領 Tab */}
          <TabsContent value="withdrawals" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>待處理提領申請</CardTitle>
                    <CardDescription>
                      共 {data.pending_items.withdrawals.count} 筆，金額 {formatCurrency(data.pending_items.withdrawals.amount)}
                    </CardDescription>
                  </div>
                  <Button asChild>
                    <Link href="/dashboard/admin/withdrawals">前往審核頁面</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {data.recent_pending.withdrawals.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                    <p>所有提領申請都已處理完畢</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>用戶</TableHead>
                        <TableHead>點數</TableHead>
                        <TableHead>金額</TableHead>
                        <TableHead>風險等級</TableHead>
                        <TableHead>狀態</TableHead>
                        <TableHead>申請時間</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recent_pending.withdrawals.map((w) => (
                        <TableRow key={w.id}>
                          <TableCell>#{w.id}</TableCell>
                          <TableCell>#{w.user_id}</TableCell>
                          <TableCell>{formatNumber(w.credits_amount)}</TableCell>
                          <TableCell className="font-semibold">{formatCurrency(w.amount_twd)}</TableCell>
                          <TableCell>{getRiskBadge(w.risk_level)}</TableCell>
                          <TableCell>{getStatusBadge(w.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(w.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 退款 Tab */}
          <TabsContent value="refunds" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>待處理退款申請</CardTitle>
                    <CardDescription>
                      共 {data.pending_items.refunds.count} 筆，金額 {formatCurrency(data.pending_items.refunds.amount)}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {data.recent_pending.refunds.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                    <p>所有退款申請都已處理完畢</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>申請編號</TableHead>
                        <TableHead>用戶</TableHead>
                        <TableHead>點數</TableHead>
                        <TableHead>退款金額</TableHead>
                        <TableHead>狀態</TableHead>
                        <TableHead>申請時間</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recent_pending.refunds.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono">{r.request_no}</TableCell>
                          <TableCell>#{r.user_id}</TableCell>
                          <TableCell>{formatNumber(r.credits_amount)}</TableCell>
                          <TableCell className="font-semibold">{formatCurrency(r.refund_amount)}</TableCell>
                          <TableCell>{getStatusBadge(r.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(r.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 訂單 Tab */}
          <TabsContent value="orders" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>待完成訂單</CardTitle>
                <CardDescription>
                  已付款但尚未完成發放的訂單
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.recent_pending.orders.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                    <p>所有訂單都已處理完畢</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>訂單編號</TableHead>
                        <TableHead>用戶</TableHead>
                        <TableHead>商品</TableHead>
                        <TableHead>金額</TableHead>
                        <TableHead>支付方式</TableHead>
                        <TableHead>狀態</TableHead>
                        <TableHead>時間</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recent_pending.orders.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="font-mono">{o.order_no}</TableCell>
                          <TableCell>#{o.user_id}</TableCell>
                          <TableCell>{o.item_name}</TableCell>
                          <TableCell className="font-semibold">{formatCurrency(o.total_amount)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{o.payment_provider || "-"}</Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(o.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(o.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* 快速操作 */}
      <Card>
        <CardHeader>
          <CardTitle>快速操作</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/dashboard/admin/users">
                <Users className="h-5 w-5" />
                <span>用戶管理</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/dashboard/admin/withdrawals">
                <Wallet className="h-5 w-5" />
                <span>提領審核</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/dashboard/admin/fraud">
                <ShieldAlert className="h-5 w-5" />
                <span>詐騙偵測</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/dashboard/admin/prompts">
                <FileText className="h-5 w-5" />
                <span>Prompt 管理</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
