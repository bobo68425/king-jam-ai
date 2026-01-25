"use client";

import { useState, useEffect } from "react";
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
import {
  Coins, Zap, Crown, CheckCircle, Loader2, CreditCard,
  Building2, ArrowRight, Sparkles, Star, Shield
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
// Main Component
// ============================================================

export default function PricingPage() {
  const [activeTab, setActiveTab] = useState<"credits" | "subscription">("credits");
  const [loading, setLoading] = useState(true);
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  
  // Checkout state
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CreditPackage | SubscriptionPlan | null>(null);
  const [selectedType, setSelectedType] = useState<"credits" | "subscription">("credits");
  const [paymentProvider, setPaymentProvider] = useState<"ecpay" | "stripe">("ecpay");
  const [quantity, setQuantity] = useState(1);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

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
      const res = await api.post("/payment/orders", {
        order_type: selectedType,
        item_code: selectedItem.code,
        payment_provider: paymentProvider,
        quantity: quantity,
      });

      if (res.data.success) {
        if (paymentProvider === "stripe" && res.data.checkout_url) {
          // Stripe: 跳轉到 Checkout 頁面
          window.location.href = res.data.checkout_url;
        } else if (paymentProvider === "ecpay") {
          // ECPay: 跳轉到付款頁面
          window.location.href = `/api/payment/ecpay/checkout/${res.data.order_no}`;
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
                          : "bg-slate-700 hover:bg-slate-600"
                      )}
                      onClick={() => handleSelectPackage(pkg)}
                    >
                      購買
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Subscription Plans */}
          <TabsContent value="subscription" className="mt-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {subscriptionPlans.map((plan) => (
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
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-white">
                        {formatPrice(plan.price)}
                      </span>
                      <span className="text-slate-400">/月</span>
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
                          : "bg-slate-700 hover:bg-slate-600"
                      )}
                      onClick={() => handleSelectPlan(plan)}
                    >
                      訂閱
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
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
            付款由綠界科技 (ECPay) 及 Stripe 安全處理
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

              {/* Payment Method */}
              <div className="space-y-3">
                <Label className="text-slate-300">付款方式</Label>
                <RadioGroup
                  value={paymentProvider}
                  onValueChange={(v) => setPaymentProvider(v as "ecpay" | "stripe")}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700 cursor-pointer hover:border-slate-600">
                    <RadioGroupItem value="ecpay" id="ecpay" />
                    <Label htmlFor="ecpay" className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">綠界科技</p>
                          <p className="text-slate-400 text-xs">信用卡、ATM、超商付款</p>
                        </div>
                        <Badge className="bg-green-500/20 text-green-400">推薦</Badge>
                      </div>
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700 cursor-pointer hover:border-slate-600">
                    <RadioGroupItem value="stripe" id="stripe" />
                    <Label htmlFor="stripe" className="flex-1 cursor-pointer">
                      <div>
                        <p className="text-white font-medium">Stripe</p>
                        <p className="text-slate-400 text-xs">國際信用卡</p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
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
