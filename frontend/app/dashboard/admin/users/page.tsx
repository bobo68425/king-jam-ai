"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Users,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Ban,
  Shield,
  Coins,
  RefreshCw,
  Download,
  UserPlus,
  TrendingUp,
  DollarSign,
  UserCheck,
  Activity,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface User {
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

interface UserStats {
  total_users: number;
  active_users: number;
  inactive_users: number;
  admin_users: number;
  paying_users: number;
  subscribers: number;
  new_users_today: number;
  new_users_week: number;
  new_users_month: number;
  subscription_breakdown: Record<string, number>;
  partner_tier_breakdown: Record<string, number>;
  total_revenue: number;
  revenue_today: number;
  revenue_week: number;
  revenue_month: number;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  
  // 分頁
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // 搜索與篩選
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterActive, setFilterActive] = useState<string>("all");
  const [filterSubscription, setFilterSubscription] = useState<string>("all");
  const [filterPartnerTier, setFilterPartnerTier] = useState<string>("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  
  // 對話框
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [creditCategory, setCreditCategory] = useState("promo");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [secondaryPassword, setSecondaryPassword] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  
  // 管理員切換對話框
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [adminTargetUser, setAdminTargetUser] = useState<User | null>(null);
  const [adminSecondaryPassword, setAdminSecondaryPassword] = useState("");

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      
      if (search) params.append("search", search);
      if (filterActive !== "all") params.append("is_active", filterActive);
      if (filterSubscription !== "all") params.append("subscription_plan", filterSubscription);
      if (filterPartnerTier !== "all") params.append("partner_tier", filterPartnerTier);
      
      const response = await fetch(`${API_URL}/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          router.push("/dashboard");
          return;
        }
        throw new Error("Failed to fetch users");
      }
      
      const data = await response.json();
      setUsers(data.users);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  }, [API_URL, page, pageSize, search, filterActive, filterSubscription, filterPartnerTier, sortBy, sortOrder, router]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/admin/users/stats/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setStatsLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, [fetchUsers, fetchStats]);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/admin/users/${user.id}/toggle-active`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        fetchUsers();
      }
    } catch (error) {
      console.error("Error toggling user status:", error);
    }
  };

  const handleToggleAdmin = async () => {
    if (!adminTargetUser || !adminSecondaryPassword) return;
    
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/admin/users/${adminTargetUser.id}/toggle-admin`, {
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
        setAdminTargetUser(null);
        setAdminSecondaryPassword("");
        fetchUsers();
      } else {
        const data = await response.json();
        alert(data.detail || "操作失敗");
      }
    } catch (error) {
      console.error("Error toggling admin status:", error);
    }
  };

  const handleAdjustCredits = async () => {
    if (!selectedUser || !creditAmount || !creditReason || !secondaryPassword) return;
    
    setAdjusting(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/admin/users/${selectedUser.id}/credits`, {
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
        setSelectedUser(null);
        fetchUsers();
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

  const getSubscriptionBadge = (plan: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      free: "outline",
      basic: "secondary",
      pro: "default",
      enterprise: "default",
    };
    const labels: Record<string, string> = {
      free: "免費",
      basic: "基礎",
      pro: "專業",
      enterprise: "企業",
    };
    return (
      <Badge variant={variants[plan] || "outline"}>
        {labels[plan] || plan}
      </Badge>
    );
  };

  const getPartnerBadge = (tier: string) => {
    const colors: Record<string, string> = {
      bronze: "bg-amber-600",
      silver: "bg-gray-400",
      gold: "bg-yellow-500",
    };
    const labels: Record<string, string> = {
      bronze: "銅牌",
      silver: "銀牌",
      gold: "金牌",
    };
    return (
      <Badge className={`${colors[tier] || "bg-gray-500"} text-white`}>
        {labels[tier] || tier}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            用戶管理
          </h1>
          <p className="text-muted-foreground mt-1">
            管理所有用戶帳號、點數調整、權限設定
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { fetchUsers(); fetchStats(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            重新整理
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            匯出資料
          </Button>
        </div>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">總用戶數</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : formatNumber(stats?.total_users || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              今日新增 +{stats?.new_users_today || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">付費用戶</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : formatNumber(stats?.paying_users || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              訂閱中 {stats?.subscribers || 0} 人
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本月收入</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : formatCurrency(stats?.revenue_month || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              今日 {formatCurrency(stats?.revenue_today || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本月新增</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : formatNumber(stats?.new_users_month || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              本週 +{stats?.new_users_week || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索與篩選 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex gap-2">
              <Input
                placeholder="搜索 Email、姓名、客戶編號..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="max-w-md"
              />
              <Button onClick={handleSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Select value={filterActive} onValueChange={(v) => { setFilterActive(v); setPage(1); }}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="狀態" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部狀態</SelectItem>
                  <SelectItem value="true">啟用</SelectItem>
                  <SelectItem value="false">停用</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterSubscription} onValueChange={(v) => { setFilterSubscription(v); setPage(1); }}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="訂閱" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部方案</SelectItem>
                  <SelectItem value="free">免費</SelectItem>
                  <SelectItem value="basic">基礎</SelectItem>
                  <SelectItem value="pro">專業</SelectItem>
                  <SelectItem value="enterprise">企業</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterPartnerTier} onValueChange={(v) => { setFilterPartnerTier(v); setPage(1); }}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="夥伴" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部等級</SelectItem>
                  <SelectItem value="bronze">銅牌</SelectItem>
                  <SelectItem value="silver">銀牌</SelectItem>
                  <SelectItem value="gold">金牌</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="排序" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">註冊時間</SelectItem>
                  <SelectItem value="credits">點數餘額</SelectItem>
                  <SelectItem value="total_referrals">推薦數</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
              >
                {sortOrder === "desc" ? "↓" : "↑"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 用戶列表 */}
      <Card>
        <CardHeader>
          <CardTitle>用戶列表</CardTitle>
          <CardDescription>
            共 {formatNumber(total)} 位用戶
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">ID</TableHead>
                      <TableHead>用戶</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead>方案</TableHead>
                      <TableHead>夥伴</TableHead>
                      <TableHead className="text-right">點數</TableHead>
                      <TableHead className="text-right">消費</TableHead>
                      <TableHead className="text-right">推薦</TableHead>
                      <TableHead>註冊日期</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-mono text-xs">
                          {user.id}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
                              {user.full_name?.[0] || user.email[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium flex items-center gap-1">
                                {user.full_name || "未設定"}
                                {user.is_admin && (
                                  <Shield className="h-3 w-3 text-amber-500" />
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.is_active ? "default" : "destructive"}>
                            {user.is_active ? "啟用" : "停用"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getSubscriptionBadge(user.subscription_plan)}
                        </TableCell>
                        <TableCell>
                          {getPartnerBadge(user.partner_tier)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumber(user.credits)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(user.total_spent)}
                        </TableCell>
                        <TableCell className="text-right">
                          {user.total_referrals}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(user.created_at)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>操作</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => router.push(`/dashboard/admin/users/${user.id}`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                查看詳情
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedUser(user);
                                setCreditDialogOpen(true);
                              }}>
                                <Coins className="h-4 w-4 mr-2" />
                                調整點數
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleToggleActive(user)}>
                                <Ban className="h-4 w-4 mr-2" />
                                {user.is_active ? "停用帳號" : "啟用帳號"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setAdminTargetUser(user);
                                setAdminDialogOpen(true);
                              }}>
                                <Shield className="h-4 w-4 mr-2" />
                                {user.is_admin ? "取消管理員" : "設為管理員"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 分頁 */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  顯示 {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} 筆，共 {formatNumber(total)} 筆
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    第 {page} / {totalPages} 頁
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 點數調整對話框 */}
      <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>調整用戶點數</DialogTitle>
            <DialogDescription>
              為用戶 {selectedUser?.email} 調整點數（僅限超級管理員）
            </DialogDescription>
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
                {selectedUser ? formatNumber(
                  creditCategory === "promo" ? selectedUser.credits_promo :
                  creditCategory === "paid" ? selectedUser.credits_paid :
                  creditCategory === "bonus" ? selectedUser.credits_bonus :
                  selectedUser.credits_sub
                ) : 0}
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
              {adminTargetUser?.is_admin ? "取消管理員權限" : "設為管理員"}
            </DialogTitle>
            <DialogDescription>
              {adminTargetUser?.is_admin 
                ? `確定要取消 ${adminTargetUser?.email} 的管理員權限嗎？`
                : `確定要將 ${adminTargetUser?.email} 設為管理員嗎？`
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
              setAdminTargetUser(null);
            }}>
              取消
            </Button>
            <Button 
              onClick={handleToggleAdmin} 
              disabled={!adminSecondaryPassword}
              variant={adminTargetUser?.is_admin ? "destructive" : "default"}
            >
              {adminTargetUser?.is_admin ? "取消權限" : "確認設為管理員"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
