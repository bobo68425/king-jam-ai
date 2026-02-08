"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Coins, CheckCircle, Loader2, CreditCard,
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
// Main Content
// ============================================================

function PricingContent() {
  const [loading, setLoading] = useState(true);
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  
  // Checkout state
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CreditPackage | null>(null);
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
        if (res.data && !res.data.success && res.data.error) {
          toast.error(`載入產品失敗：${res.data.error}`);
          return;
        }
        setCreditPackages(res.data?.credit_packages ?? []);
      } catch (error: unknown) {
        const err = error as { response?: { data?: { detail?: string; error?: string }; status?: number }; message?: string };
        const msg = err.response?.data?.detail ?? err.response?.data?.error ?? err.message ?? "連線失敗，請檢查網路或稍後再試";
        console.error("Failed to fetch products:", error);
        toast.error(`載入產品失敗：${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
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
    setQuantity(1);
    setCheckoutDialogOpen(true);
  };

  const handleCheckout = async () => {
    if (!selectedItem) return;

    setCheckoutLoading(true);
    try {
      const res = await api.post("/payment/orders", {
        order_type: "credits",
        item_code: selectedItem.code,
        payment_provider: paymentProvider,
        quantity: quantity,
        referral_code: referralCode.trim() || undefined,
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
    return selectedItem.price * quantity;
  };

  const getTotalCredits = () => {
    if (!selectedItem) return 0;
    return (selectedItem.credits_amount + selectedItem.bonus_credits) * quantity;
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
            購買點數
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto">
            購買點數，解鎖 AI 創作的無限可能。如需訂閱方案請至
            <a href="/dashboard/subscription" className="text-indigo-400 hover:text-indigo-300 ml-1">訂閱管理</a>
          </p>
        </div>

        {/* Credit Packages */}
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
                    {selectedItem.name}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-slate-400">點數</span>
                  <span className="text-indigo-400">
                    {formatNumber(getTotalCredits())} 點
                  </span>
                </div>
                
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
// Page Export
// ============================================================

export default function PricingPage() {
  return <PricingContent />;
}
