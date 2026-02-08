"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Coins, Zap, Crown, CheckCircle, Loader2, CreditCard,
  Building2, ArrowRight, Sparkles, Star, Shield, Gift
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ============================================================
// Types
// ============================================================

interface CreditPackage {
  code: string;
  name: string;
  description: string | null;
  price: number;
  original_price: number | null;
  credits_amount: number;
  bonus_credits: number;
  is_popular: boolean;
}

interface SubscriptionPlan {
  code: string;
  name: string;
  description: string | null;
  price: number;
  monthly_credits: number;
  features: string[];
  is_popular: boolean;
  price_yearly: number | null;
  yearly_discount_percent: number | null;
}

// ============================================================
// Helper Functions
// ============================================================

function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatPrice(price: number): string {
  return `NT$${formatNumber(Math.round(price))}`;
}

// ============================================================
// Main Content (uses useSearchParams - must be in Suspense)
// ============================================================

function PricingContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"credits" | "subscription">("credits");
  const [loading, setLoading] = useState(true);
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  
  // 訂閱計費週期：月繳 / 年繳
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  
  // Checkout state
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CreditPackage | SubscriptionPlan | null>(null);
  const [selectedType, setSelectedType] = useState<"credits" | "subscription">("credits");
  const [paymentProvider, setPaymentProvider] = useState<"ecpay" | "stripe">("ecpay");
  const [quantity, setQuantity] = useState(1);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [referralCode, setReferralCode] = useState("");

  // ============================================================
  // Data Fetching
  // ============================================================

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await api.get("/payment/products");
        setCreditPackages(res.data.credit_packages || []);
        setSubscriptionPlans(res.data.subscription_plans || []);
      } catch (error) {
        console.error("Failed to fetch products:", error);
        toast.error("載入產品失敗");
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // 從 URL 參數預選方案與計費週期（例如從訂閱頁跳轉 ?plan=pro&cycle=yearly）
  useEffect(() => {
    if (loading) return;
    const plan = searchParams.get("plan");
    const cycle = searchParams.get("cycle");
    if (plan) {
      setActiveTab("subscription");
      if (cycle === "yearly") setBillingCycle("yearly");
    }
  }, [loading, searchParams]);

  // ============================================================
  // Checkout
  // ============================================================

  const handleSelectPackage = (pkg: CreditPackage) => {
    setSelectedItem(pkg);
    setSelectedType("credits");
    setQuantity(1);
    setCheckoutDialogOpen(true);
  };

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    setSelectedItem(plan);
    setSelectedType("subscription");
    setQuantity(1);
    setCheckoutDialogOpen(true);
  };

  const handleCheckout = async () => {
    if (!selectedItem) return;

    setCheckoutLoading(true);
    try {
      const isSubscriptionYearly = selectedType === "subscription" && billingCycle === "yearly";
      const res = await api.post("/payment/orders", {
        order_type: selectedType,
        item_code: selectedItem.code,
        payment_provider: paymentProvider,
        quantity: isSubscriptionYearly ? 1 : quantity,
        referral_code: referralCode.trim() || undefined,
        billing_cycle: selectedType === "subscription" ? billingCycle : undefined,
      });

      if (res.data.success) {
        const provider = res.data.payment_provider || paymentProvider;
        
        if (provider === "stripe" && res.data.checkout_url) {
          // Stripe: 跳轉到 Checkout 頁面
          window.location.href = res.data.checkout_url;
        } else if (provider === "newebpay" && res.data.form_html) {
          // 藍新金流: 使用表單 HTML 自動提交
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
          window.location.href = `${apiUrl}/payment/newebpay/checkout/${res.data.order_no}`;
        } else if (provider === "ecpay" || res.data.form_html) {
          // 綠界: 跳轉到後端付款頁面
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
          window.location.href = `${apiUrl}/payment/ecpay/checkout/${res.data.order_no}`;
        } else {
          toast.error("無法取得付款頁面");
        }
      } else {
        toast.error(res.data.error || "建立訂單失敗");
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "建立訂單失敗");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const getTotalPrice = () => {
    if (!selectedItem) return 0;
    if (selectedType === "subscription" && billingCycle === "yearly") {
      const plan = selectedItem as SubscriptionPlan;
      return plan.price_yearly ?? Math.round(plan.price * 12 * 0.8);
    }
    return selectedItem.price * quantity;
  };

  const getTotalCredits = () => {
    if (!selectedItem || selectedType !== "credits") return 0;
    const pkg = selectedItem as CreditPackage;
    return (pkg.credits_amount + pkg.bonus_credits) * quantity;
  };

  // ============================================================
  // Render
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-white">
            選擇適合您的方案
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto">
            購買點數或訂閱方案，解鎖 AI 創作的無限可能
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="credits" className="data-[state=active]:bg-indigo-600">
              <Coins className="w-4 h-4 mr-2" />
              點數套餐
            </TabsTrigger>
            <TabsTrigger value="subscription" className="data-[state=active]:bg-purple-600">
              <Crown className="w-4 h-4 mr-2" />
              訂閱方案
            </TabsTrigger>
          </TabsList>

          {/* Credit Packages */}
          <TabsContent value="credits" className="mt-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {creditPackages.map((pkg) => (
                <Card
                  key={pkg.code}
                  className={cn(
                    "bg-slate-900/50 border-slate-700/50 relative overflow-hidden transition-all hover:border-indigo-500/50",
                    pkg.is_popular && "border-indigo-500/50 shadow-lg shadow-indigo-500/10"
                  )}
                >
                  {pkg.is_popular && (
                    <div className="absolute top-0 right-0">
                      <Badge className="rounded-none rounded-bl-lg bg-indigo-600 text-white">
                        <Star className="w-3 h-3 mr-1" />
                        最熱門
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Coins className="w-5 h-5 text-indigo-400" />
                      {pkg.name}
                    </CardTitle>
                    <CardDescription>
                      {pkg.description}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-white">
                        {formatPrice(pkg.price)}
                      </span>
                      {pkg.original_price && (
                        <span className="text-slate-500 line-through text-sm">
                          {formatPrice(pkg.original_price)}
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-slate-300">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span>{formatNumber(pkg.credits_amount)} 點基本點數</span>
                      </div>
                      {pkg.bonus_credits > 0 && (
                        <div className="flex items-center gap-2 text-indigo-400">
                          <Sparkles className="w-4 h-4" />
                          <span>+{formatNumber(pkg.bonus_credits)} 點贈送</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <span>共 {formatNumber(pkg.credits_amount + pkg.bonus_credits)} 點</span>
                        <span>·</span>
                        <span>
                          每點 {(pkg.price / (pkg.credits_amount + pkg.bonus_credits)).toFixed(2)} 元
                        </span>
                      </div>
                    </div>
                  </CardContent>
                  
                  <CardFooter>
                    <Button
                      className={cn(
                        "w-full",
                        pkg.is_popular
                          ? "bg-indigo-600 hover:bg-indigo-700"
                          : "bg-indigo-500/80 hover:bg-indigo-600"
                      )}
                      onClick={() => handleSelectPackage(pkg)}
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      立即購買
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Subscription Plans */}
          <TabsContent value="subscription" className="mt-8">
            {/* 月繳 / 年繳切換 */}
            <div className="flex justify-center mb-6">
              <div className="inline-flex p-1 rounded-lg bg-slate-800/80 border border-slate-700">
                <button
                  type="button"
                  onClick={() => setBillingCycle("monthly")}
                  className={cn(
                    "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                    billingCycle === "monthly"
                      ? "bg-purple-600 text-white"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  月繳
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle("yearly")}
                  className={cn(
                    "px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2",
                    billingCycle === "yearly"
                      ? "bg-purple-600 text-white"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  年繳
                  {subscriptionPlans.some((p) => p.yearly_discount_percent != null) && (
                    <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded-full">
                      省 {subscriptionPlans.find((p) => p.yearly_discount_percent != null)?.yearly_discount_percent ?? 0}%
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {subscriptionPlans.map((plan) => {
                // API 若未回傳年繳價則用月價推算（8 折）
                const yearlyPrice = plan.price_yearly ?? Math.round(plan.price * 12 * 0.8);
                const discountPercent = plan.yearly_discount_percent ?? 20;
                const showYearly = billingCycle === "yearly";
                const displayPrice = showYearly ? yearlyPrice : plan.price;
                const periodLabel = showYearly ? "/年" : "/月";
                return (
                  <Card
                    key={plan.code}
                    className={cn(
                      "bg-slate-900/50 border-slate-700/50 relative overflow-hidden transition-all hover:border-purple-500/50",
                      plan.is_popular && "border-purple-500/50 shadow-lg shadow-purple-500/10 scale-105"
                    )}
                  >
                    {plan.is_popular && (
                      <div className="absolute top-0 right-0">
                        <Badge className="rounded-none rounded-bl-lg bg-purple-600 text-white">
                          <Star className="w-3 h-3 mr-1" />
                          推薦
                        </Badge>
                      </div>
                    )}
                    
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        {plan.code === "basic" && <Zap className="w-5 h-5 text-blue-400" />}
                        {plan.code === "pro" && <Crown className="w-5 h-5 text-purple-400" />}
                        {plan.code === "enterprise" && <Building2 className="w-5 h-5 text-amber-400" />}
                        {plan.name}
                      </CardTitle>
                      <CardDescription>
                        {plan.description}
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-3xl font-bold text-white">
                          {formatPrice(displayPrice)}
                        </span>
                        <span className="text-slate-400">{periodLabel}</span>
                        {showYearly && (
                          <span className="text-emerald-400 text-sm font-medium">
                            省 {discountPercent}%
                          </span>
                        )}
                        {showYearly && (
                          <span className="text-slate-500 text-sm line-through">
                            {formatPrice(plan.price * 12)}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-indigo-400">
                        <Coins className="w-4 h-4" />
                        <span>每月 {formatNumber(plan.monthly_credits)} 點</span>
                      </div>
                      
                      <div className="space-y-2 pt-4 border-t border-slate-700/50">
                        {plan.features.map((feature, index) => (
                          <div key={index} className="flex items-center gap-2 text-slate-300 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                    
                    <CardFooter>
                      <Button
                        className={cn(
                          "w-full",
                          plan.is_popular
                            ? "bg-purple-600 hover:bg-purple-700"
                            : "bg-purple-500/80 hover:bg-purple-600"
                        )}
                        onClick={() => handleSelectPlan(plan)}
                      >
                        <Crown className="w-4 h-4 mr-2" />
                        {showYearly ? "年繳訂閱" : "立即訂閱"}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        {/* Payment Methods Info */}
        <div className="text-center space-y-4 pt-8 border-t border-slate-700/50">
          <p className="text-slate-400 text-sm">支援的付款方式</p>
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-2 text-slate-300">
              <CreditCard className="w-5 h-5" />
              <span>信用卡</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Building2 className="w-5 h-5" />
              <span>ATM 轉帳</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Shield className="w-5 h-5" />
              <span>超商付款</span>
            </div>
          </div>
          <p className="text-slate-500 text-xs">
            付款由綠界科技 (ECPay) 安全處理
          </p>
        </div>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={checkoutDialogOpen} onOpenChange={setCheckoutDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">確認購買</DialogTitle>
            <DialogDescription>
              請選擇付款方式完成購買
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-6">
              {/* Order Summary */}
              <div className="p-4 rounded-lg bg-slate-800/50 space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">商品</span>
                  <span className="text-white font-medium">
                    {selectedType === "credits" 
                      ? (selectedItem as CreditPackage).name
                      : selectedType === "subscription" && billingCycle === "yearly"
                        ? `${(selectedItem as SubscriptionPlan).name} 年繳`
                        : `${(selectedItem as SubscriptionPlan).name} x ${quantity}個月`
                    }
                  </span>
                </div>
                
                {selectedType === "credits" && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">點數</span>
                    <span className="text-indigo-400">
                      {formatNumber(getTotalCredits())} 點
                    </span>
                  </div>
                )}
                
                {selectedType === "subscription" && (
                  <div className="space-y-2">
                    {billingCycle === "monthly" && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">訂閱月數</span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                            className="h-8 w-8 p-0 bg-slate-800 border-slate-600"
                          >
                            -
                          </Button>
                          <span className="text-white w-8 text-center">{quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setQuantity(Math.min(12, quantity + 1))}
                            className="h-8 w-8 p-0 bg-slate-800 border-slate-600"
                          >
                            +
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-400">每月點數</span>
                      <span className="text-indigo-400">
                        {formatNumber((selectedItem as SubscriptionPlan).monthly_credits)} 點/月
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between pt-3 border-t border-slate-700">
                  <span className="text-slate-300 font-medium">總計</span>
                  <span className="text-emerald-400 font-bold text-lg">
                    {formatPrice(getTotalPrice())}
                  </span>
                </div>
              </div>

              {/* Referral Code */}
              <div className="space-y-3">
                <Label className="text-slate-300 flex items-center gap-2">
                  <Gift className="w-4 h-4 text-amber-400" />
                  推薦碼（選填）
                </Label>
                <Input
                  placeholder="輸入推薦碼可獲得額外優惠"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 uppercase"
                  maxLength={10}
                />
                <p className="text-slate-500 text-xs">
                  首次購買輸入推薦碼，雙方都能獲得獎勵
                </p>
              </div>

              {/* Payment Method */}
              <div className="space-y-3">
                <Label className="text-slate-300">付款方式</Label>
                <div className="p-3 rounded-lg bg-slate-800/50 border border-indigo-500/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-indigo-400" />
                      <div>
                        <p className="text-white font-medium">綠界科技 ECPay</p>
                        <p className="text-slate-400 text-xs">信用卡、ATM 轉帳、超商代碼</p>
                      </div>
                    </div>
                    <Badge className="bg-green-500/20 text-green-400">安全付款</Badge>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCheckoutDialogOpen(false)}
              className="bg-slate-800/50 border-slate-700"
            >
              取消
            </Button>
            <Button
              onClick={handleCheckout}
              disabled={checkoutLoading}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {checkoutLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              前往付款
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Page with Suspense (required by Next.js for useSearchParams)
// ============================================================

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        </div>
      }
    >
      <PricingContent />
    </Suspense>
  );
}
