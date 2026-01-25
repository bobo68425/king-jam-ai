"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  User,
  Mail,
  Calendar,
  Shield,
  Coins,
  CreditCard,
  Gift,
  TrendingUp,
  Activity,
  History,
  Link2,
  Edit,
  Ban,
  RefreshCw,
  Package,
  Users,
  Award,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

interface UserDetail {
  id: number;
  customer_id: string | null;
  email: string;
  full_name: string | null;
  avatar: string | null;
  provider: string;
  is_active: boolean;
  is_admin: boolean;
  tier: string;
  credits: number;
  credits_paid: number;
  credits_bonus: number;
  credits_promo: number;
  credits_sub: number;
  partner_tier: string;
  total_referrals: number;
  total_referral_revenue: number;
  subscription_plan: string;
  subscription_expires_at: string | null;
  referral_code: string | null;
  referred_by: string | null;
  created_at: string;
  updated_at: string | null;
  total_orders: number;
  total_spent: number;
  total_generations: number;
  last_active_at: string | null;
}

interface Order {
  id: number;
  order_no: string;
  order_type: string;
  item_name: string;
  total_amount: number;
  status: string;
  payment_provider: string;
  credits_amount: number;
  bonus_credits: number;
  created_at: string;
  paid_at: string | null;
}

interface Transaction {
  id: number;
  transaction_type: string;
  credit_category: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  created_at: string;
}

interface Generation {
  id: number;
  generation_type: string;
  status: string;
  credits_used: number;
  thumbnail_url: string | null;
  created_at: string;
}

interface ReferralInfo {
  referral_code: string;
  referred_by: string | null;
  total_referrals: number;
  total_revenue: number;
  partner_tier: string;
  referred_users: Array<{
    id: number;
    email: string;
    created_at: string;
    subscription_plan: string;
  }>;
}

interface SocialAccount {
  id: number;
  platform: string;
  platform_username: string;
  is_active: boolean;
  last_sync_at: string | null;
}

interface UserStats {
  total_orders: number;
  total_spent: number;
  total_generations: number;
  total_credits_consumed: number;
  account_age_days: number;
  withdrawal_requests: number;
  refund_requests: number;
}

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [creditBalance, setCreditBalance] = useState<Record<string, number>>({});
  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);

  // 對話框
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  
  // 編輯表單
  const [editForm, setEditForm] = useState({
    full_name: "",
    tier: "",
    partner_tier: "",
    subscription_plan: "",
  });
  
  // 點數調整
  const [creditCategory, setCreditCategory] = useState("promo");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [secondaryPassword, setSecondaryPassword] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // 管理員權限
  const [adminSecondaryPassword, setAdminSecondaryPassword] = useState("");

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchUserDetail = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 403) {
          router.push("/dashboard");
          return;
        }
        if (response.status === 404) {
          router.push("/dashboard/admin/users");
          return;
        }
        throw new Error("Failed to fetch user");
      }

      const data = await response.json();
      setUser(data.user);
      setCreditBalance(data.credit_balance);
      setOrders(data.recent_orders);
      setTransactions(data.recent_transactions);
      setGenerations(data.recent_generations);
      setReferralInfo(data.referral_info);
      setSocialAccounts(data.social_accounts);
      setStats(data.stats);
      
      // 設置編輯表單初始值
      setEditForm({
        full_name: data.user.full_name || "",
        tier: data.user.tier,
        partner_tier: data.user.partner_tier,
        subscription_plan: data.user.subscription_plan,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
    } finally {
      setLoading(false);
    }
  }, [API_URL, userId, router]);

  useEffect(() => {
    fetchUserDetail();
  }, [fetchUserDetail]);

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/admin/users/${userId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editForm),
      });

      if (response.ok) {
        setEditDialogOpen(false);
        fetchUserDetail();
      } else {
        const data = await response.json();
        alert(data.detail || "更新失敗");
      }
    } catch (error) {
      console.error("Error updating user:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/admin/users/${userId}/toggle-active`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchUserDetail();
    } catch (error) {
      console.error("Error toggling status:", error);
    }
  };

  const handleToggleAdmin = async () => {
    if (!adminSecondaryPassword) return;
    
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/admin/users/${userId}/toggle-admin`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          secondary_password: adminSecondaryPassword,
        }),
      });
      
      if (response.ok) {
        setAdminDialogOpen(false);
        setAdminSecondaryPassword("");
        fetchUserDetail();
      } else {
        const data = await response.json();
        alert(data.detail || "操作失敗");
      }
    } catch (error) {
      console.error("Error toggling admin:", error);
    }
  };

  const handleAdjustCredits = async () => {
    if (!creditAmount || !creditReason || !secondaryPassword) return;

    setAdjusting(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/admin/users/${userId}/credits`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category: creditCategory,
          amount: parseInt(creditAmount),
          reason: creditReason,
          secondary_password: secondaryPassword,
        }),
      });

      if (response.ok) {
        setCreditDialogOpen(false);
        setCreditAmount("");
        setCreditReason("");
        setSecondaryPassword("");
        fetchUserDetail();
      } else {
        const data = await response.json();
        alert(data.detail || "調整失敗");
      }
    } catch (error) {
      console.error("Error adjusting credits:", error);
    } finally {
      setAdjusting(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "outline", label: "待處理" },
      processing: { variant: "secondary", label: "處理中" },
      paid: { variant: "default", label: "已付款" },
      completed: { variant: "default", label: "已完成" },
      failed: { variant: "destructive", label: "失敗" },
      cancelled: { variant: "destructive", label: "已取消" },
    };
    const c = config[status] || { variant: "outline" as const, label: status };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const getTransactionIcon = (type: string) => {
    if (type.includes("consume")) return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (type.includes("purchase") || type.includes("grant")) return <Gift className="h-4 w-4 text-green-500" />;
    if (type.includes("refund")) return <RefreshCw className="h-4 w-4 text-blue-500" />;
    return <Activity className="h-4 w-4 text-gray-500" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">用戶不存在</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 返回按鈕 & 標題 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              用戶詳情
              {user.is_admin && <Shield className="h-5 w-5 text-amber-500" />}
            </h1>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            編輯資料
          </Button>
          <Button variant="outline" onClick={() => setCreditDialogOpen(true)}>
            <Coins className="h-4 w-4 mr-2" />
            調整點數
          </Button>
        </div>
      </div>

      {/* 用戶基本資訊 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左側：基本資料 */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              基本資料
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-3xl font-bold">
                {user.full_name?.[0] || user.email[0].toUpperCase()}
              </div>
            </div>
            
            <div className="text-center">
              <h3 className="font-semibold text-lg">{user.full_name || "未設定姓名"}</h3>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>

            <Separator />

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID</span>
                <span className="font-mono">{user.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">客戶編號</span>
                <span className="font-mono">{user.customer_id || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">登入方式</span>
                <Badge variant="outline">{user.provider}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">帳號狀態</span>
                <Badge variant={user.is_active ? "default" : "destructive"}>
                  {user.is_active ? "啟用" : "停用"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">管理員</span>
                <Badge variant={user.is_admin ? "default" : "outline"}>
                  {user.is_admin ? "是" : "否"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">訂閱方案</span>
                <Badge>{user.subscription_plan}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">夥伴等級</span>
                <Badge className={
                  user.partner_tier === "gold" ? "bg-yellow-500" :
                  user.partner_tier === "silver" ? "bg-gray-400" : "bg-amber-600"
                }>
                  {user.partner_tier === "gold" ? "金牌" :
                   user.partner_tier === "silver" ? "銀牌" : "銅牌"}
                </Badge>
              </div>
            </div>

            <Separator />

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">註冊時間</span>
                <span>{formatDate(user.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">帳齡</span>
                <span>{stats?.account_age_days || 0} 天</span>
              </div>
            </div>

            <Separator />

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={handleToggleActive}
              >
                <Ban className="h-4 w-4 mr-1" />
                {user.is_active ? "停用" : "啟用"}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => setAdminDialogOpen(true)}
              >
                <Shield className="h-4 w-4 mr-1" />
                {user.is_admin ? "取消管理員" : "設為管理員"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 右側：點數與統計 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 點數餘額 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5" />
                點數餘額
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-4 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-lg">
                  <div className="text-2xl font-bold">{formatNumber(creditBalance.total || 0)}</div>
                  <div className="text-xs text-muted-foreground">總點數</div>
                </div>
                <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                  <div className="text-xl font-bold text-blue-600">{formatNumber(creditBalance.paid || 0)}</div>
                  <div className="text-xs text-muted-foreground">PAID 付費</div>
                </div>
                <div className="text-center p-4 bg-green-500/10 rounded-lg">
                  <div className="text-xl font-bold text-green-600">{formatNumber(creditBalance.bonus || 0)}</div>
                  <div className="text-xs text-muted-foreground">BONUS 獎金</div>
                </div>
                <div className="text-center p-4 bg-amber-500/10 rounded-lg">
                  <div className="text-xl font-bold text-amber-600">{formatNumber(creditBalance.promo || 0)}</div>
                  <div className="text-xs text-muted-foreground">PROMO 優惠</div>
                </div>
                <div className="text-center p-4 bg-purple-500/10 rounded-lg">
                  <div className="text-xl font-bold text-purple-600">{formatNumber(creditBalance.sub || 0)}</div>
                  <div className="text-xs text-muted-foreground">SUB 訂閱</div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-muted rounded-lg text-sm">
                <span className="text-muted-foreground">可提領金額：</span>
                <span className="font-bold ml-2">{formatCurrency(creditBalance.withdrawable_twd || 0)}</span>
                <span className="text-muted-foreground ml-2">（1 BONUS = NT$1）</span>
              </div>
            </CardContent>
          </Card>

          {/* 統計數據 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Package className="h-8 w-8 text-blue-500" />
                  <div>
                    <div className="text-2xl font-bold">{stats?.total_orders || 0}</div>
                    <div className="text-xs text-muted-foreground">總訂單數</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-8 w-8 text-green-500" />
                  <div>
                    <div className="text-2xl font-bold">{formatCurrency(stats?.total_spent || 0)}</div>
                    <div className="text-xs text-muted-foreground">累計消費</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Activity className="h-8 w-8 text-purple-500" />
                  <div>
                    <div className="text-2xl font-bold">{stats?.total_generations || 0}</div>
                    <div className="text-xs text-muted-foreground">生成次數</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-amber-500" />
                  <div>
                    <div className="text-2xl font-bold">{user.total_referrals}</div>
                    <div className="text-xs text-muted-foreground">推薦人數</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* 詳細記錄 Tabs */}
      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="orders">訂單記錄</TabsTrigger>
          <TabsTrigger value="transactions">點數交易</TabsTrigger>
          <TabsTrigger value="generations">生成記錄</TabsTrigger>
          <TabsTrigger value="referrals">推薦資訊</TabsTrigger>
          <TabsTrigger value="social">社群帳號</TabsTrigger>
        </TabsList>

        {/* 訂單記錄 */}
        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>最近訂單</CardTitle>
              <CardDescription>最近 10 筆訂單記錄</CardDescription>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">暫無訂單記錄</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>訂單編號</TableHead>
                      <TableHead>類型</TableHead>
                      <TableHead>商品</TableHead>
                      <TableHead>金額</TableHead>
                      <TableHead>點數</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead>付款方式</TableHead>
                      <TableHead>時間</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-xs">{order.order_no}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{order.order_type}</Badge>
                        </TableCell>
                        <TableCell>{order.item_name}</TableCell>
                        <TableCell>{formatCurrency(order.total_amount)}</TableCell>
                        <TableCell>
                          {order.credits_amount ? (
                            <span>
                              {formatNumber(order.credits_amount)}
                              {order.bonus_credits > 0 && (
                                <span className="text-green-500 ml-1">+{order.bonus_credits}</span>
                              )}
                            </span>
                          ) : "-"}
                        </TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell>{order.payment_provider || "-"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(order.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 點數交易 */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>點數交易記錄</CardTitle>
              <CardDescription>最近 20 筆交易記錄</CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">暫無交易記錄</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>類型</TableHead>
                      <TableHead>類別</TableHead>
                      <TableHead>金額</TableHead>
                      <TableHead>餘額變化</TableHead>
                      <TableHead>說明</TableHead>
                      <TableHead>時間</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="flex items-center gap-2">
                          {getTransactionIcon(tx.transaction_type)}
                          <span className="text-xs">{tx.transaction_type}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{tx.credit_category.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell className={tx.amount > 0 ? "text-green-600" : "text-red-600"}>
                          {tx.amount > 0 ? "+" : ""}{formatNumber(tx.amount)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatNumber(tx.balance_before)} → {formatNumber(tx.balance_after)}
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">
                          {tx.description}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(tx.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 生成記錄 */}
        <TabsContent value="generations">
          <Card>
            <CardHeader>
              <CardTitle>生成記錄</CardTitle>
              <CardDescription>最近 10 筆生成記錄</CardDescription>
            </CardHeader>
            <CardContent>
              {generations.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">暫無生成記錄</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>類型</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead>消耗點數</TableHead>
                      <TableHead>時間</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {generations.map((gen) => (
                      <TableRow key={gen.id}>
                        <TableCell className="font-mono">{gen.id}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{gen.generation_type}</Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(gen.status)}</TableCell>
                        <TableCell>{formatNumber(gen.credits_used)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(gen.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 推薦資訊 */}
        <TabsContent value="referrals">
          <Card>
            <CardHeader>
              <CardTitle>推薦資訊</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">推薦碼</div>
                  <div className="font-mono font-bold">{referralInfo?.referral_code || "-"}</div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">被推薦碼</div>
                  <div className="font-mono font-bold">{referralInfo?.referred_by || "-"}</div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">推薦人數</div>
                  <div className="font-bold text-xl">{referralInfo?.total_referrals || 0}</div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">推薦收益</div>
                  <div className="font-bold text-xl">{formatCurrency(referralInfo?.total_revenue || 0)}</div>
                </div>
              </div>

              {referralInfo?.referred_users && referralInfo.referred_users.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-3">推薦的用戶</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>訂閱方案</TableHead>
                          <TableHead>註冊時間</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {referralInfo.referred_users.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell>{u.id}</TableCell>
                            <TableCell>{u.email}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{u.subscription_plan}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(u.created_at)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 社群帳號 */}
        <TabsContent value="social">
          <Card>
            <CardHeader>
              <CardTitle>綁定的社群帳號</CardTitle>
            </CardHeader>
            <CardContent>
              {socialAccounts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">尚未綁定任何社群帳號</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>平台</TableHead>
                      <TableHead>帳號名稱</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead>最後同步</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {socialAccounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell>
                          <Badge variant="outline">{account.platform}</Badge>
                        </TableCell>
                        <TableCell>{account.platform_username || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={account.is_active ? "default" : "destructive"}>
                            {account.is_active ? "啟用" : "停用"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(account.last_sync_at)}
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

      {/* 編輯資料對話框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯用戶資料</DialogTitle>
            <DialogDescription>修改用戶的基本資料與等級設定</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                placeholder="用戶姓名"
              />
            </div>

            <div className="space-y-2">
              <Label>會員等級</Label>
              <Select
                value={editForm.tier}
                onValueChange={(v) => setEditForm({ ...editForm, tier: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">免費</SelectItem>
                  <SelectItem value="basic">基礎</SelectItem>
                  <SelectItem value="pro">專業</SelectItem>
                  <SelectItem value="enterprise">企業</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>夥伴等級</Label>
              <Select
                value={editForm.partner_tier}
                onValueChange={(v) => setEditForm({ ...editForm, partner_tier: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bronze">銅牌</SelectItem>
                  <SelectItem value="silver">銀牌</SelectItem>
                  <SelectItem value="gold">金牌</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>訂閱方案</Label>
              <Select
                value={editForm.subscription_plan}
                onValueChange={(v) => setEditForm({ ...editForm, subscription_plan: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">免費</SelectItem>
                  <SelectItem value="basic">基礎</SelectItem>
                  <SelectItem value="pro">專業</SelectItem>
                  <SelectItem value="enterprise">企業</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? "儲存中..." : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 點數調整對話框 */}
      <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>調整用戶點數</DialogTitle>
            <DialogDescription>為用戶 {user.email} 調整點數（僅限超級管理員）</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>點數類別</Label>
              <Select value={creditCategory} onValueChange={setCreditCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="promo">PROMO 優惠點數</SelectItem>
                  <SelectItem value="paid">PAID 付費點數</SelectItem>
                  <SelectItem value="bonus">BONUS 獎金點數</SelectItem>
                  <SelectItem value="sub">SUB 訂閱點數</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>調整金額</Label>
              <Input
                type="number"
                placeholder="正數增加，負數扣除"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                當前 {creditCategory.toUpperCase()} 餘額：
                {formatNumber(
                  creditCategory === "promo" ? creditBalance.promo || 0 :
                  creditCategory === "paid" ? creditBalance.paid || 0 :
                  creditCategory === "bonus" ? creditBalance.bonus || 0 :
                  creditBalance.sub || 0
                )}
              </p>
            </div>

            <div className="space-y-2">
              <Label>調整原因</Label>
              <Textarea
                placeholder="請輸入調整原因..."
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-amber-500">二次驗證密碼</Label>
              <Input
                type="password"
                placeholder="請輸入二次驗證密碼"
                value={secondaryPassword}
                onChange={(e) => setSecondaryPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                此操作需要超級管理員二次密碼驗證
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCreditDialogOpen(false);
              setSecondaryPassword("");
            }}>
              取消
            </Button>
            <Button
              onClick={handleAdjustCredits}
              disabled={adjusting || !creditAmount || !creditReason || !secondaryPassword}
            >
              {adjusting ? "處理中..." : "確認調整"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 管理員權限切換對話框 */}
      <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {user.is_admin ? "取消管理員權限" : "設為管理員"}
            </DialogTitle>
            <DialogDescription>
              {user.is_admin 
                ? `確定要取消 ${user.email} 的管理員權限嗎？`
                : `確定要將 ${user.email} 設為管理員嗎？`
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-sm text-amber-500">
                此操作僅限超級管理員執行，需要二次密碼驗證
              </p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-amber-500">二次驗證密碼</Label>
              <Input
                type="password"
                placeholder="請輸入二次驗證密碼"
                value={adminSecondaryPassword}
                onChange={(e) => setAdminSecondaryPassword(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAdminDialogOpen(false);
              setAdminSecondaryPassword("");
            }}>
              取消
            </Button>
            <Button 
              onClick={handleToggleAdmin} 
              disabled={!adminSecondaryPassword}
              variant={user.is_admin ? "destructive" : "default"}
            >
              {user.is_admin ? "取消權限" : "確認設為管理員"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
