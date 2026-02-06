"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Coins,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Gift,
  Sparkles,
  Clock,
  Zap,
  Crown,
  Star,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Info,
  CalendarDays,
  Percent,
  Award,
  Wallet,
  Building2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";

interface CategoryBalance {
  promo: number;
  sub: number;
  paid: number;
  bonus: number;
  total: number;
  withdrawable: number;
  withdrawable_twd: number;
}

interface CreditBalance {
  balance: number;
  category_balance: CategoryBalance;
  tier: string;
  is_consistent: boolean;
}

interface Transaction {
  id: number;
  credit_category: string;
  transaction_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string | null;
  reference_type: string | null;
  reference_id: number | null;
  consumed_from: Record<string, number> | null;
  created_at: string;
}

interface TransactionList {
  transactions: Transaction[];
  total: number;
  has_more: boolean;
}

interface UsageStats {
  total_earned: number;
  total_spent: number;
  balance: number;
  category_balance: CategoryBalance;
  by_type: Record<string, { count: number; amount: number }>;
  by_category: Record<string, { earned: number; spent: number }>;
}

interface PricingItem {
  feature_code: string;
  feature_name: string;
  credits_cost: number;
  description: string | null;
}

interface Package {
  id: number;
  package_code: string;
  name: string;
  credits_amount: number;
  bonus_credits: number;
  price_twd: number;
  original_price_twd: number | null;
  validity_days: number | null;
  is_popular: boolean;
  description: string | null;
}

interface VerificationStatus {
  phone_verified: boolean;
  identity_verified: boolean;
  identity_real_name: string | null;
  two_factor_enabled: boolean;
  all_verified: boolean;
}

interface WithdrawalEligibility {
  eligible: boolean;
  bonus_balance: number;
  min_credits: number;
  exchange_rate: number;
  withdrawable_twd: number;
  min_twd: number;
  verification_status: VerificationStatus;
  can_withdraw: boolean;
  missing_verifications: string[];
}

interface WithdrawalRequest {
  id: number;
  credits_amount: number;
  amount_twd: number;
  exchange_rate: number;
  status: string;
  bank_name: string | null;
  account_number_masked: string | null;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  transferred_at: string | null;
}

export default function CreditsPage() {
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [pricing, setPricing] = useState<PricingItem[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  
  // 提領相關狀態
  const [withdrawalEligibility, setWithdrawalEligibility] = useState<WithdrawalEligibility | null>(null);
  const [withdrawalHistory, setWithdrawalHistory] = useState<WithdrawalRequest[]>([]);
  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState<number>(300);
  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [withdrawalSubmitting, setWithdrawalSubmitting] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [balanceRes, txRes, statsRes, pricingRes, packagesRes, eligibilityRes, historyRes] = await Promise.allSettled([
        api.get<CreditBalance>("/credits/balance"),
        api.get<TransactionList>("/credits/transactions?limit=20"),
        api.get<UsageStats>("/credits/usage-stats?days=30"),
        api.get<PricingItem[]>("/credits/pricing"),
        api.get<Package[]>("/credits/packages"),
        api.get<WithdrawalEligibility>("/credits/withdrawal/eligibility"),
        api.get<{ requests: WithdrawalRequest[]; total: number }>("/credits/withdrawal/history"),
      ]);

      if (balanceRes.status === "fulfilled") setBalance(balanceRes.value.data);
      if (txRes.status === "fulfilled") {
        setTransactions(txRes.value.data.transactions);
        setHasMore(txRes.value.data.has_more);
        setOffset(txRes.value.data.transactions.length);
      }
      if (statsRes.status === "fulfilled") setStats(statsRes.value.data);
      if (pricingRes.status === "fulfilled") setPricing(pricingRes.value.data);
      if (packagesRes.status === "fulfilled") setPackages(packagesRes.value.data);
      if (eligibilityRes.status === "fulfilled") setWithdrawalEligibility(eligibilityRes.value.data);
      if (historyRes.status === "fulfilled") setWithdrawalHistory(historyRes.value.data.requests);
    } catch (error) {
      console.error("Failed to fetch credits data", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreTransactions = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await api.get<TransactionList>(`/credits/transactions?limit=20&offset=${offset}`);
      setTransactions(prev => [...prev, ...res.data.transactions]);
      setHasMore(res.data.has_more);
      setOffset(prev => prev + res.data.transactions.length);
    } catch (error) {
      console.error("Failed to load more transactions", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleWithdrawalSubmit = async () => {
    if (!withdrawalEligibility?.can_withdraw || withdrawalAmount < 300) return;
    
    setWithdrawalSubmitting(true);
    try {
      await api.post("/credits/withdrawal/request", {
        credits_amount: withdrawalAmount,
        bank_code: bankCode,
        bank_name: bankName,
        account_number: accountNumber,
        account_holder: accountHolder,
        totp_code: totpCode,
      });
      
      setWithdrawalDialogOpen(false);
      // 重新載入資料
      fetchInitialData();
      // 清空表單
      setBankCode("");
      setBankName("");
      setAccountNumber("");
      setAccountHolder("");
      setTotpCode("");
      setWithdrawalAmount(300);
      toast.success("提領申請已送出，請等待審核");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "提領申請失敗");
    } finally {
      setWithdrawalSubmitting(false);
    }
  };

  const getTransactionIcon = (type: string, amount: number) => {
    if (amount > 0) {
      return <ArrowUpRight className="h-4 w-4 text-emerald-400" />;
    }
    return <ArrowDownRight className="h-4 w-4 text-rose-400" />;
  };

  const getTransactionLabel = (type: string) => {
    const labels: Record<string, string> = {
      initial_grant: "註冊贈送",
      purchase: "購買點數",
      referral_bonus: "推薦獎勵",
      consume_social_image: "社群圖文",
      consume_blog_post: "部落格文章",
      consume_short_video: "短影片",
      consume_veo_video: "Veo 影片",
      refund: "退款",
      admin_adjustment: "系統調整",
      promo_credit: "活動贈送",
      subscription_grant: "訂閱贈送",
      monthly_grant: "每月分配",
      task_reward: "任務獎勵",
      compensation: "補償",
      withdrawal: "提領",
    };
    return labels[type] || type;
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      promo: "優惠點數",
      sub: "月費點數",
      paid: "購買點數",
      bonus: "獎金點數",
    };
    return labels[category] || category;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      promo: "text-pink-400",
      sub: "text-blue-400",
      paid: "text-emerald-400",
      bonus: "text-amber-400",
    };
    return colors[category] || "text-slate-400";
  };

  const getCategoryBgColor = (category: string) => {
    const colors: Record<string, string> = {
      promo: "bg-pink-500/20",
      sub: "bg-blue-500/20",
      paid: "bg-emerald-500/20",
      bonus: "bg-amber-500/20",
    };
    return colors[category] || "bg-slate-500/20";
  };

  const getWithdrawalStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-0">申請中</Badge>;
      case "reviewing":
        return <Badge className="bg-blue-500/20 text-blue-400 border-0">審核中</Badge>;
      case "approved":
        return <Badge className="bg-purple-500/20 text-purple-400 border-0">已核准</Badge>;
      case "completed":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-0">已完成</Badge>;
      case "rejected":
        return <Badge className="bg-rose-500/20 text-rose-400 border-0">已駁回</Badge>;
      case "cancelled":
        return <Badge className="bg-slate-500/20 text-slate-400 border-0">已取消</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const categoryConfig = [
    { key: "promo", label: "優惠點數", code: "PROMO", icon: Percent, color: "pink", description: "新手任務、行銷活動（7-30天有效）" },
    { key: "sub", label: "月費點數", code: "SUB", icon: CalendarDays, color: "blue", description: "訂閱方案每月發放（當月有效）" },
    { key: "paid", label: "購買點數", code: "PAID", icon: CreditCard, color: "emerald", description: "刷卡儲值（永久有效、可退款）" },
    { key: "bonus", label: "獎金點數", code: "BONUS", icon: Award, color: "amber", description: "推薦分潤（永久有效、可提領）" },
  ];

  const totalCredits = balance?.category_balance?.total || 0;
  const withdrawableTwd = balance?.category_balance?.withdrawable_twd || 0;

  return (
    <div className="flex flex-col gap-6">
      {/* 頁面標題 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">點數中心</h1>
          <p className="text-slate-400 mt-1">管理您的點數餘額、交易紀錄與獎金提領</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchInitialData}
          className="border-slate-700 hover:bg-slate-800 w-fit"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          重新整理
        </Button>
      </div>

      {/* 總餘額卡片 */}
      <Card className="bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-pink-500/10 border-indigo-500/30">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
                <Coins className="h-8 w-8 text-white" />
              </div>
              <div>
                <p className="text-sm text-slate-400">總餘額</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-white">
                    {loading ? "--" : totalCredits.toLocaleString()}
                  </span>
                  <span className="text-slate-400">點</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  帳戶等級：{balance?.tier === "free" ? "免費版" : balance?.tier === "admin" ? "管理員" : balance?.tier || "--"}
                </p>
              </div>
            </div>

            {/* 本月統計 + 可提領 */}
            <div className="flex gap-6 flex-wrap">
              <div className="text-center">
                <div className="flex items-center gap-1 text-emerald-400">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-2xl font-bold">+{stats?.total_earned?.toLocaleString() || 0}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">本月獲得</p>
              </div>
              <div className="w-px bg-slate-700"></div>
              <div className="text-center">
                <div className="flex items-center gap-1 text-rose-400">
                  <TrendingDown className="h-4 w-4" />
                  <span className="text-2xl font-bold">-{stats?.total_spent?.toLocaleString() || 0}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">本月消耗</p>
              </div>
              <div className="w-px bg-slate-700"></div>
              <div className="text-center">
                <div className="flex items-center gap-1 text-amber-400">
                  <Wallet className="h-4 w-4" />
                  <span className="text-2xl font-bold">NT${withdrawableTwd.toLocaleString()}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">可提領金額</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 點數類別明細 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {categoryConfig.map((cat) => {
          const Icon = cat.icon;
          const amount = balance?.category_balance?.[cat.key as keyof CategoryBalance] as number || 0;
          const percentage = totalCredits > 0 ? (amount / totalCredits) * 100 : 0;

          return (
            <Card 
              key={cat.key}
              className={`bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors ${
                cat.key === "bonus" ? "ring-1 ring-amber-500/30" : ""
              }`}
            >
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center bg-${cat.color}-500/20`}>
                    <Icon className={`h-5 w-5 text-${cat.color}-400`} />
                  </div>
                  <Badge variant="outline" className={`border-${cat.color}-500/30 text-${cat.color}-400 text-xs`}>
                    {cat.code}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-400">{cat.label}</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {loading ? "--" : amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{cat.description}</p>
                </div>
                <div className="mt-3">
                  <Progress 
                    value={percentage} 
                    className="h-1.5 bg-slate-700"
                  />
                </div>
                {cat.key === "bonus" && (
                  <p className="text-xs text-amber-400/80 mt-2 flex items-center gap-1">
                    <Wallet className="h-3 w-3" />
                    可提領 NT${(amount || 0).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 消耗順序 + 提領提示 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-slate-800/30 border-slate-700/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Info className="h-5 w-5 text-blue-400 flex-shrink-0" />
              <div className="text-sm text-slate-400">
                <span className="text-slate-300 font-medium">消耗順序：</span>
                <span className="text-pink-400">PROMO</span> → 
                <span className="text-blue-400">SUB</span> → 
                <span className="text-emerald-400">PAID</span> → 
                <span className="text-amber-400">BONUS</span>
                <p className="text-xs mt-1 text-slate-500">獎金點數最後扣除，讓您自行決定累積提領或用於生成</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                <Wallet className="h-5 w-5 text-amber-400" />
                <div className="text-sm">
                  <span className="text-amber-200 font-medium">獎金提領</span>
                  <p className="text-xs text-amber-200/60 mt-0.5">
                    滿 300 BONUS 點可申請提領（1點 = NT$1）
                  </p>
                </div>
              </div>
              <Dialog open={withdrawalDialogOpen} onOpenChange={(open) => {
                setWithdrawalDialogOpen(open);
                // 開啟時自動填入身份認證姓名
                if (open && withdrawalEligibility?.verification_status?.identity_real_name) {
                  setAccountHolder(withdrawalEligibility.verification_status.identity_real_name);
                }
              }}>
                <DialogTrigger asChild>
                  <Button 
                    size="sm"
                    disabled={!withdrawalEligibility?.eligible}
                    className="bg-amber-600 hover:bg-amber-500 text-white"
                  >
                    申請提領
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-700 max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-white">申請提領獎金點數</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      獎金點數可以提領為現金，1 BONUS 點 = NT$ 1
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    {/* 認證狀態檢查 */}
                    {withdrawalEligibility && !withdrawalEligibility.verification_status?.all_verified && (
                      <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-rose-200 font-medium text-sm">需完成以下認證才能提領：</p>
                            <div className="mt-2 space-y-2">
                              <div className="flex items-center gap-2 text-sm">
                                {withdrawalEligibility.verification_status?.phone_verified ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-rose-400" />
                                )}
                                <span className={withdrawalEligibility.verification_status?.phone_verified ? "text-emerald-300" : "text-rose-300"}>
                                  手機認證
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                {withdrawalEligibility.verification_status?.identity_verified ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-rose-400" />
                                )}
                                <span className={withdrawalEligibility.verification_status?.identity_verified ? "text-emerald-300" : "text-rose-300"}>
                                  身份認證
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                {withdrawalEligibility.verification_status?.two_factor_enabled ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-rose-400" />
                                )}
                                <span className={withdrawalEligibility.verification_status?.two_factor_enabled ? "text-emerald-300" : "text-rose-300"}>
                                  雙重驗證 (Authenticator App)
                                </span>
                              </div>
                            </div>
                            <a href="/dashboard/profile" className="inline-block mt-3 text-xs text-amber-400 hover:text-amber-300 underline">
                              前往會員資料完成認證 →
                            </a>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 已完成所有認證，顯示提領表單 */}
                    {withdrawalEligibility?.verification_status?.all_verified && (
                      <>
                        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                          <div className="flex justify-between items-center">
                            <span className="text-amber-200">可提領獎金點數</span>
                            <span className="text-2xl font-bold text-amber-400">
                              {withdrawalEligibility?.bonus_balance?.toLocaleString()} 點
                            </span>
                          </div>
                          <div className="flex justify-between items-center mt-2 text-sm">
                            <span className="text-amber-200/70">等值金額</span>
                            <span className="text-amber-300">
                              NT$ {withdrawalEligibility?.withdrawable_twd?.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-slate-300">提領點數</Label>
                          <Input
                            type="number"
                            min={300}
                            max={withdrawalEligibility?.bonus_balance || 0}
                            value={withdrawalAmount}
                            onChange={(e) => setWithdrawalAmount(Number(e.target.value))}
                            className="bg-slate-800 border-slate-700 text-white"
                          />
                          <p className="text-xs text-slate-500">
                            可獲得 NT$ {withdrawalAmount.toLocaleString()}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-slate-300">銀行代碼</Label>
                            <Input
                              placeholder="如：004"
                              value={bankCode}
                              onChange={(e) => setBankCode(e.target.value)}
                              className="bg-slate-800 border-slate-700 text-white"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-300">銀行名稱</Label>
                            <Input
                              placeholder="如：台灣銀行"
                              value={bankName}
                              onChange={(e) => setBankName(e.target.value)}
                              className="bg-slate-800 border-slate-700 text-white"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-slate-300">帳號</Label>
                          <Input
                            placeholder="請輸入銀行帳號"
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value)}
                            className="bg-slate-800 border-slate-700 text-white"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-slate-300">
                            戶名 
                            <span className="text-xs text-amber-400 ml-2">
                              （需與身份認證姓名一致）
                            </span>
                          </Label>
                          <Input
                            placeholder="請輸入帳戶戶名"
                            value={accountHolder}
                            onChange={(e) => setAccountHolder(e.target.value)}
                            className="bg-slate-800 border-slate-700 text-white"
                            readOnly
                          />
                          <p className="text-xs text-slate-500">
                            戶名已自動填入身份認證姓名，無法修改
                          </p>
                        </div>

                        {/* 2FA 驗證碼輸入 */}
                        <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
                          <div className="space-y-2">
                            <Label className="text-purple-200 flex items-center gap-2">
                              <span>🔐</span>
                              Authenticator App 驗證碼
                            </Label>
                            <Input
                              type="text"
                              placeholder="輸入 6 位數驗證碼"
                              value={totpCode}
                              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                              maxLength={6}
                              className="bg-slate-800 border-purple-500/50 text-white text-center text-xl tracking-widest"
                            />
                            <p className="text-xs text-purple-300/70">
                              請開啟 Authenticator App 輸入顯示的驗證碼
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setWithdrawalDialogOpen(false)}
                      className="border-slate-700"
                    >
                      取消
                    </Button>
                    {withdrawalEligibility?.verification_status?.all_verified && (
                      <Button
                        onClick={handleWithdrawalSubmit}
                        disabled={
                          withdrawalSubmitting ||
                          withdrawalAmount < 300 ||
                          withdrawalAmount > (withdrawalEligibility?.bonus_balance || 0) ||
                          !bankCode ||
                          !bankName ||
                          !accountNumber ||
                          !accountHolder ||
                          totpCode.length !== 6
                        }
                        className="bg-amber-600 hover:bg-amber-500"
                      >
                        {withdrawalSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            提交中...
                          </>
                        ) : (
                          "確認提領"
                        )}
                      </Button>
                    )}
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="packages" className="w-full">
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="packages" className="data-[state=active]:bg-indigo-600">
            <CreditCard className="mr-2 h-4 w-4" />
            購買點數
          </TabsTrigger>
          <TabsTrigger value="withdrawal" className="data-[state=active]:bg-indigo-600">
            <Wallet className="mr-2 h-4 w-4" />
            提領紀錄
          </TabsTrigger>
          <TabsTrigger value="pricing" className="data-[state=active]:bg-indigo-600">
            <Info className="mr-2 h-4 w-4" />
            定價說明
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-indigo-600">
            <Clock className="mr-2 h-4 w-4" />
            交易紀錄
          </TabsTrigger>
        </TabsList>

        {/* 購買點數 */}
        <TabsContent value="packages" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {packages.map((pkg) => (
              <Card 
                key={pkg.id}
                className={`relative overflow-hidden transition-all hover:scale-[1.02] ${
                  pkg.is_popular 
                    ? "bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border-indigo-500/50" 
                    : "bg-slate-800/50 border-slate-700"
                }`}
              >
                {pkg.is_popular && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                      <Star className="inline h-3 w-3 mr-1" />
                      最熱門
                    </div>
                  </div>
                )}
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-white">{pkg.name}</CardTitle>
                  {pkg.description && (
                    <CardDescription className="text-slate-400">{pkg.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-white">
                        {pkg.credits_amount.toLocaleString()}
                      </span>
                      <span className="text-slate-400">點</span>
                    </div>
                    {pkg.bonus_credits > 0 && (
                      <div className="flex items-center gap-1 text-emerald-400 text-sm">
                        <Gift className="h-3 w-3" />
                        加贈 {pkg.bonus_credits} 點
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-white">
                        NT${pkg.price_twd.toLocaleString()}
                      </span>
                      {pkg.original_price_twd && pkg.original_price_twd > pkg.price_twd && (
                        <span className="text-sm text-slate-500 line-through">
                          ${pkg.original_price_twd.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      約 NT${(pkg.price_twd / (pkg.credits_amount + pkg.bonus_credits)).toFixed(2)}/點
                    </p>
                  </div>

                  <Button 
                    className={`w-full ${
                      pkg.is_popular 
                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500" 
                        : "bg-indigo-500/80 hover:bg-indigo-600"
                    }`}
                    onClick={() => window.location.href = `/dashboard/pricing?tab=credits&code=${pkg.package_code}`}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    立即購買
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="mt-6 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-400 mt-0.5" />
              <div className="text-sm text-slate-400">
                <p className="font-medium text-slate-300 mb-1">付款說明</p>
                <p>購買後點數歸類為「購買點數 (PAID)」，永久有效且可申請退款。</p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 提領紀錄 */}
        <TabsContent value="withdrawal" className="mt-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">提領紀錄</CardTitle>
              <CardDescription className="text-slate-400">
                您的獎金提領申請記錄
              </CardDescription>
            </CardHeader>
            <CardContent>
              {withdrawalHistory.length === 0 ? (
                <div className="text-center py-12">
                  <Wallet className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                  <p className="text-slate-400">尚無提領紀錄</p>
                  <p className="text-sm text-slate-500 mt-1">累積滿 300 BONUS 點即可申請提領（1點 = NT$1）</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {withdrawalHistory.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-slate-700/30"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          w.status === "completed" ? "bg-emerald-500/20" :
                          w.status === "rejected" ? "bg-rose-500/20" :
                          "bg-amber-500/20"
                        }`}>
                          {w.status === "completed" ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                          ) : w.status === "rejected" ? (
                            <XCircle className="h-5 w-5 text-rose-400" />
                          ) : (
                            <Clock className="h-5 w-5 text-amber-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white">
                              {w.credits_amount.toLocaleString()} 點 → NT${w.amount_twd.toLocaleString()}
                            </p>
                            {getWithdrawalStatusBadge(w.status)}
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            {w.bank_name} {w.account_number_masked}
                          </p>
                          {w.rejection_reason && (
                            <p className="text-xs text-rose-400 mt-1">
                              駁回原因：{w.rejection_reason}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-sm text-slate-500">
                        <p>{format(new Date(w.created_at), "yyyy/MM/dd", { locale: zhTW })}</p>
                        {w.transferred_at && (
                          <p className="text-emerald-400 text-xs">
                            已匯款 {format(new Date(w.transferred_at), "MM/dd")}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 定價說明 */}
        <TabsContent value="pricing" className="mt-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">功能點數消耗</CardTitle>
              <CardDescription className="text-slate-400">
                各功能使用所需的點數
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {pricing.map((item) => (
                  <div
                    key={item.feature_code}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        item.feature_code.includes("veo") 
                          ? "bg-purple-500/20" 
                          : item.feature_code.includes("video")
                            ? "bg-pink-500/20"
                            : item.feature_code.includes("blog")
                              ? "bg-blue-500/20"
                              : "bg-emerald-500/20"
                      }`}>
                        {item.feature_code.includes("veo") ? (
                          <Crown className="h-5 w-5 text-purple-400" />
                        ) : item.feature_code.includes("video") ? (
                          <Zap className="h-5 w-5 text-pink-400" />
                        ) : item.feature_code.includes("blog") ? (
                          <Sparkles className="h-5 w-5 text-blue-400" />
                        ) : (
                          <Sparkles className="h-5 w-5 text-emerald-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white">{item.feature_name}</p>
                        {item.description && (
                          <p className="text-xs text-slate-400">{item.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        className={`${
                          item.credits_cost >= 100 
                            ? "bg-purple-500/20 text-purple-300" 
                            : item.credits_cost >= 20
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-emerald-500/20 text-emerald-300"
                        } border-0`}
                      >
                        {item.credits_cost} 點
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 交易紀錄 */}
        <TabsContent value="history" className="mt-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">交易紀錄</CardTitle>
              <CardDescription className="text-slate-400">
                您的點數收支明細（含點數類別）
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                          tx.amount > 0 ? "bg-emerald-500/20" : "bg-rose-500/20"
                        }`}>
                          {getTransactionIcon(tx.transaction_type, tx.amount)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white">
                              {getTransactionLabel(tx.transaction_type)}
                            </p>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${getCategoryBgColor(tx.credit_category)} ${getCategoryColor(tx.credit_category)} border-0`}
                            >
                              {getCategoryLabel(tx.credit_category)}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-400">
                            {tx.description || format(new Date(tx.created_at), "yyyy/MM/dd HH:mm", { locale: zhTW })}
                          </p>
                          {tx.consumed_from && Object.keys(tx.consumed_from).length > 1 && (
                            <p className="text-xs text-slate-500 mt-1">
                              扣除來源：{Object.entries(tx.consumed_from).map(([cat, amt]) => 
                                `${getCategoryLabel(cat)} ${amt}`
                              ).join("、")}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-medium ${tx.amount > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-500">
                          餘額 {tx.balance_after.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  
                  {hasMore && (
                    <div className="flex justify-center pt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadMoreTransactions}
                        disabled={loadingMore}
                        className="border-slate-600"
                      >
                        {loadingMore ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            載入中...
                          </>
                        ) : (
                          "載入更多"
                        )}
                      </Button>
                    </div>
                  )}
                  
                  {transactions.length === 0 && !loading && (
                    <div className="text-center py-12">
                      <Clock className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                      <p className="text-slate-400">尚無交易紀錄</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
