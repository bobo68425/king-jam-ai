"use client";

import React, { useState, useEffect } from "react";
import { 
  Crown, Star, Zap, Shield, Check, X, Clock, 
  CreditCard, Calendar, ArrowRight, AlertCircle,
  Sparkles, Gift, TrendingUp, ChevronRight, Loader2,
  RefreshCw, History, ExternalLink, BadgeCheck
} from "lucide-react";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { toast } from "sonner";
import api from "@/lib/api";

// ============================================================
// Types
// ============================================================

interface SubscriptionInfo {
  current_plan: string;
  plan_name: string;
  price: number;
  billing_cycle: string;
  status: string;
  started_at: string | null;
  expires_at: string | null;
  auto_renew: boolean;
  monthly_credits: number;
  features: string[];
  next_billing_date: string | null;
  next_billing_amount: number | null;
}

interface PaymentHistory {
  id: number;
  order_no: string;
  item_name: string;
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
}

// ============================================================
// Plan Configurations
// ============================================================

// 年繳折扣 20%（約 2 個月免費）
const YEARLY_DISCOUNT_PERCENT = 20;
const yearlyPrice = (monthly: number) => Math.round(monthly * 12 * (1 - YEARLY_DISCOUNT_PERCENT / 100));

const PLANS = [
  {
    id: "free",
    name: "免費版",
    price: 0,
    priceYearly: null as number | null,
    period: "永久免費",
    description: "適合個人嘗試體驗",
    monthlyCredits: 0,
    features: [
      { text: "註冊贈送 100 點", included: true },
      { text: "基本 AI 文章生成", included: true },
      { text: "社群圖文設計", included: true },
      { text: "手動發布功能", included: true },
      { text: "AI 短影片生成", included: false },
      { text: "智能排程發布", included: false },
      { text: "多平台同步", included: false },
      { text: "優先客服支援", included: false },
    ],
    color: "slate",
    icon: Star,
  },
  {
    id: "basic",
    name: "入門版",
    price: 299,
    priceYearly: yearlyPrice(299),
    period: "每月",
    description: "適合輕度使用者",
    monthlyCredits: 0,
    features: [
      { text: "基本功能無廣告", included: true },
      { text: "AI 文章生成", included: true },
      { text: "社群圖文設計", included: true },
      { text: "單平台發布", included: true },
      { text: "Email 客服支援", included: true },
      { text: "AI 短影片生成", included: false },
      { text: "智能排程發布", included: false },
      { text: "多平台同步", included: false },
    ],
    color: "blue",
    icon: Zap,
  },
  {
    id: "pro",
    name: "專業版",
    price: 699,
    priceYearly: yearlyPrice(699),
    period: "每月",
    description: "適合自媒體創作者",
    monthlyCredits: 1000,
    popular: true,
    features: [
      { text: "每月 1,000 點", included: true },
      { text: "全部 AI 功能解鎖", included: true },
      { text: "AI 短影片生成", included: true },
      { text: "智能排程發布", included: true },
      { text: "多平台同步", included: true },
      { text: "優先客服支援", included: true },
      { text: "API 存取權限", included: false },
      { text: "團隊協作功能", included: false },
    ],
    color: "purple",
    icon: Crown,
  },
  {
    id: "enterprise",
    name: "企業版",
    price: 3699,
    priceYearly: yearlyPrice(3699),
    period: "每月",
    description: "適合品牌與團隊",
    monthlyCredits: 5000,
    features: [
      { text: "每月 5,000 點", included: true },
      { text: "全部專業版功能", included: true },
      { text: "API 存取權限", included: true },
      { text: "團隊協作功能", included: true },
      { text: "專屬客戶經理", included: true },
      { text: "客製化需求", included: true },
      { text: "優先技術支援", included: true },
      { text: "SLA 保證", included: true },
    ],
    color: "amber",
    icon: Shield,
  },
];

const PLAN_COLORS: Record<string, { bg: string; border: string; text: string; gradient: string }> = {
  slate: { bg: "bg-slate-500/10", border: "border-slate-500/30", text: "text-slate-400", gradient: "from-slate-500 to-slate-600" },
  blue: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400", gradient: "from-blue-500 to-cyan-500" },
  purple: { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-400", gradient: "from-purple-500 to-pink-500" },
  amber: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", gradient: "from-amber-500 to-orange-500" },
};

// ============================================================
// Components
// ============================================================

function PlanCard({ 
  plan, 
  isCurrentPlan, 
  onSelect,
  loading
}: { 
  plan: typeof PLANS[0]; 
  isCurrentPlan: boolean;
  onSelect: () => void;
  loading: boolean;
}) {
  const colors = PLAN_COLORS[plan.color];
  const Icon = plan.icon;

  return (
    <div className={`relative p-6 rounded-2xl border-2 transition-all ${
      isCurrentPlan 
        ? `${colors.bg} ${colors.border} ring-2 ring-offset-2 ring-offset-slate-900 ring-${plan.color}-500/50`
        : "bg-slate-800/50 border-slate-700/50 hover:border-slate-600"
    } ${plan.popular ? "md:-mt-4 md:mb-4" : ""}`}>
      {/* Popular Badge */}
      {plan.popular && !isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-xs font-semibold text-white">
          最受歡迎
        </div>
      )}

      {/* Current Plan Badge */}
      {isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full text-xs font-semibold text-white flex items-center gap-1">
          <BadgeCheck className="w-3 h-3" />
          目前方案
        </div>
      )}

      {/* Plan Header */}
      <div className="text-center mb-6">
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center mx-auto mb-4 shadow-lg`}>
          <Icon className="w-7 h-7 text-white" />
        </div>
        <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
        <p className="text-sm text-slate-400">{plan.description}</p>
      </div>

      {/* Price */}
      <div className="text-center mb-6">
        <div className="flex items-baseline justify-center gap-1 flex-wrap">
          <span className="text-sm text-slate-500">NT$</span>
          <span className="text-4xl font-bold text-white">{plan.price.toLocaleString()}</span>
          {plan.price > 0 && <span className="text-slate-500">/月</span>}
        </div>
        {plan.price > 0 && plan.priceYearly != null && (
          <p className="text-sm text-slate-400 mt-2">
            年繳 NT${plan.priceYearly.toLocaleString()}
            <span className="text-emerald-400 ml-1">省 {YEARLY_DISCOUNT_PERCENT}%</span>
          </p>
        )}
        {plan.monthlyCredits > 0 && (
          <p className="text-sm text-emerald-400 mt-1">
            每月獲得 {plan.monthlyCredits.toLocaleString()} 點
          </p>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-3 mb-6">
        {plan.features.map((feature, i) => (
          <li key={i} className={`flex items-center gap-2 text-sm ${feature.included ? "text-slate-300" : "text-slate-500"}`}>
            {feature.included ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <X className="w-4 h-4 text-slate-600 shrink-0" />
            )}
            {feature.text}
          </li>
        ))}
      </ul>

      {/* Action Button */}
      <button
        onClick={onSelect}
        disabled={isCurrentPlan || loading}
        className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
          isCurrentPlan
            ? "bg-slate-700 text-slate-400 cursor-not-allowed"
            : plan.popular
            ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-500/30"
            : "bg-slate-700 hover:bg-slate-600 text-white"
        }`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isCurrentPlan ? (
          "目前方案"
        ) : plan.price === 0 ? (
          "降級至免費版"
        ) : (
          <>
            {plan.price > 0 ? "立即訂閱" : "選擇方案"}
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function SubscriptionPage() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<typeof PLANS[0] | null>(null);
  const [checkoutCycle, setCheckoutCycle] = useState<"monthly" | "yearly">("monthly");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    setLoading(true);
    try {
      // 獲取訂閱資訊
      const balanceRes = await api.get("/credits/balance");

      const balanceData = balanceRes.data;
      const currentPlan = balanceData.tier || "free";
      const planConfig = PLANS.find(p => p.id === currentPlan) || PLANS[0];

      setSubscription({
        current_plan: currentPlan,
        plan_name: planConfig.name,
        price: planConfig.price,
        billing_cycle: "monthly",
        status: currentPlan === "free" ? "free" : "active",
        started_at: null,
        expires_at: balanceData.subscription_expires_at || null,
        auto_renew: true,
        monthly_credits: planConfig.monthlyCredits,
        features: planConfig.features.filter(f => f.included).map(f => f.text),
        next_billing_date: balanceData.subscription_expires_at || null,
        next_billing_amount: planConfig.price,
      });

      // 嘗試獲取交易記錄作為付款歷史
      try {
        const txRes = await api.get("/credits/transactions?limit=10&transaction_type=subscription");
        if (txRes.data.transactions) {
          setPaymentHistory(txRes.data.transactions.map((t: any) => ({
            id: t.id,
            order_no: t.reference_id || `TX${t.id}`,
            item_name: t.description || "訂閱付款",
            amount: Math.abs(t.amount),
            status: "completed",
            paid_at: t.created_at,
            created_at: t.created_at,
          })));
        }
      } catch {
        // 交易記錄獲取失敗不影響主流程
        setPaymentHistory([]);
      }
    } catch (error) {
      console.error("Failed to fetch subscription data:", error);
      // 設置預設值
      setSubscription({
        current_plan: "free",
        plan_name: "免費版",
        price: 0,
        billing_cycle: "monthly",
        status: "free",
        started_at: null,
        expires_at: null,
        auto_renew: false,
        monthly_credits: 0,
        features: [],
        next_billing_date: null,
        next_billing_amount: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (planId: string) => {
    if (planId === subscription?.current_plan) return;

    const plan = PLANS.find(p => p.id === planId);
    if (!plan) return;

    // 降級到免費版
    if (planId === "free") {
      setShowCancelDialog(true);
      return;
    }

    // 升級：直接在本頁彈出結帳對話框
    setCheckoutPlan(plan);
    setCheckoutCycle("monthly");
  };

  const handleCheckout = async () => {
    if (!checkoutPlan) return;
    setCheckoutLoading(true);
    try {
      const isYearly = checkoutCycle === "yearly";
      const res = await api.post("/payment/orders", {
        order_type: "subscription",
        item_code: checkoutPlan.id,
        quantity: isYearly ? 1 : 1,
        billing_cycle: checkoutCycle,
      });

      if (res.data.success) {
        const provider = res.data.payment_provider || "ecpay";
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        if (provider === "stripe" && res.data.checkout_url) {
          window.location.href = res.data.checkout_url;
        } else if (provider === "ecpay" || res.data.form_html) {
          window.location.href = `${apiUrl}/payment/ecpay/checkout/${res.data.order_no}`;
        } else if (provider === "newebpay" && res.data.form_html) {
          window.location.href = `${apiUrl}/payment/newebpay/checkout/${res.data.order_no}`;
        } else {
          toast.error("無法取得付款頁面");
        }
      } else {
        toast.error(res.data.error || "建立訂單失敗");
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "建立訂單失敗，請稍後再試");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setActionLoading("cancel");
    // 目前訂閱取消功能需要聯繫客服
    toast.info("請聯繫客服 service@kingjam.app 協助取消訂閱");
    setShowCancelDialog(false);
    setActionLoading(null);
  };

  const handleToggleAutoRenew = async () => {
    // 目前自動續訂功能需要聯繫客服
    toast.info("請聯繫客服 service@kingjam.app 協助調整自動續訂設定");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-purple-500 mx-auto mb-4" />
          <p className="text-slate-400">載入訂閱資訊...</p>
        </div>
      </div>
    );
  }

  const currentPlanConfig = PLANS.find(p => p.id === subscription?.current_plan) || PLANS[0];
  const CurrentPlanIcon = currentPlanConfig.icon;
  const currentColors = PLAN_COLORS[currentPlanConfig.color];

  return (
    <div className="space-y-8 pb-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">訂閱管理</h1>
        <p className="text-slate-400">管理您的訂閱方案與付款設定</p>
      </div>

      {/* Current Subscription Card */}
      <div className={`p-6 rounded-2xl border ${currentColors.bg} ${currentColors.border}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${currentColors.gradient} flex items-center justify-center shadow-lg`}>
              <CurrentPlanIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-white">{subscription?.plan_name}</h2>
                {subscription?.status === "active" && (
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                    使用中
                  </span>
                )}
              </div>
              <p className="text-slate-400">
                {subscription?.price === 0 
                  ? "永久免費使用"
                  : `NT$${subscription?.price?.toLocaleString()} / 月`
                }
              </p>
              {currentPlanConfig.priceYearly != null && (
                <p className="text-sm text-emerald-400/90 mt-1">
                  年繳 NT${currentPlanConfig.priceYearly.toLocaleString()} 省 {YEARLY_DISCOUNT_PERCENT}%
                </p>
              )}
              {subscription?.monthly_credits && subscription.monthly_credits > 0 && (
                <p className="text-sm text-emerald-400 mt-1">
                  每月獲得 {subscription.monthly_credits.toLocaleString()} 點
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {subscription?.current_plan !== "free" && (
              <>
                <a
                  href={`/dashboard/pricing?plan=${subscription?.current_plan}&cycle=yearly`}
                  className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 border border-amber-500/30"
                >
                  改為年繳更省
                </a>
                <button
                  onClick={handleToggleAutoRenew}
                  className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  {subscription?.auto_renew ? "關閉自動續訂" : "開啟自動續訂"}
                </button>
                <button
                  onClick={() => setShowCancelDialog(true)}
                  className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-sm transition-colors"
                >
                  取消訂閱
                </button>
              </>
            )}
          </div>
        </div>

        {/* Subscription Details */}
        {subscription?.current_plan !== "free" && subscription?.expires_at && (
          <div className="mt-6 pt-6 border-t border-slate-700/50 grid sm:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-slate-500 mb-1">下次扣款日期</p>
              <p className="text-white font-medium">
                {format(new Date(subscription.expires_at), "yyyy/MM/dd", { locale: zhTW })}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">下次扣款金額</p>
              <p className="text-white font-medium">NT${subscription.price?.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">自動續訂</p>
              <p className={`font-medium ${subscription.auto_renew ? "text-emerald-400" : "text-slate-400"}`}>
                {subscription.auto_renew ? "已開啟" : "已關閉"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Plan Selection */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white">選擇方案</h2>
            <p className="text-sm text-slate-400">升級以獲得更多功能與點數</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrentPlan={plan.id === subscription?.current_plan}
              onSelect={() => handleSelectPlan(plan.id)}
              loading={actionLoading === plan.id}
            />
          ))}
        </div>
      </div>

      {/* Features Comparison Note */}
      <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-white font-medium mb-1">訂閱方案說明</p>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>• 訂閱方案按月計費，可隨時取消</li>
              <li>• 取消後，您仍可使用服務至當期結束</li>
              <li>• 月費點數（SUB）在當月有效，不累積至下月</li>
              <li>• 升級方案立即生效，差額按比例計算</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Payment History */}
      {paymentHistory.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-slate-400" />
              訂閱付款紀錄
            </h2>
            <a 
              href="/dashboard/credits" 
              className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              查看全部
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">訂單編號</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">方案</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">金額</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">日期</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">狀態</th>
                </tr>
              </thead>
              <tbody>
                {paymentHistory.slice(0, 5).map((payment) => (
                  <tr key={payment.id} className="border-b border-slate-700/30 last:border-0">
                    <td className="px-4 py-3 text-sm text-slate-400 font-mono">{payment.order_no}</td>
                    <td className="px-4 py-3 text-sm text-white">{payment.item_name}</td>
                    <td className="px-4 py-3 text-sm text-white">NT${payment.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {payment.paid_at 
                        ? format(new Date(payment.paid_at), "yyyy/MM/dd HH:mm")
                        : "-"
                      }
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                        已完成
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FAQ */}
      <div className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
        <h2 className="text-lg font-semibold text-white mb-4">常見問題</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-white font-medium mb-1">如何取消訂閱？</h3>
            <p className="text-sm text-slate-400">
              點擊上方的「取消訂閱」按鈕即可。取消後，您仍可使用服務至當期結束，不會立即失效。
            </p>
          </div>
          <div>
            <h3 className="text-white font-medium mb-1">升級方案如何計費？</h3>
            <p className="text-sm text-slate-400">
              升級時，我們會按照剩餘天數計算差額。例如：從入門版升級到專業版，只需補繳差價。
            </p>
          </div>
          <div>
            <h3 className="text-white font-medium mb-1">月費點數可以累積嗎？</h3>
            <p className="text-sm text-slate-400">
              月費點數（SUB）僅在當月有效，未使用完的點數不會累積至下月。購買的點數（PAID）則永久有效。
            </p>
          </div>
          <div>
            <h3 className="text-white font-medium mb-1">可以退款嗎？</h3>
            <p className="text-sm text-slate-400">
              首次訂閱後 7 天內，若未使用超過 100 點，可申請全額退款。詳情請參閱
              <a href="/refund" className="text-indigo-400 hover:text-indigo-300 ml-1">退款政策</a>。
            </p>
          </div>
        </div>
      </div>

      {/* Cancel Subscription Dialog */}
      {/* Cancel Subscription Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl w-full max-w-md border border-slate-700/50 shadow-2xl">
            <div className="p-6">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-white text-center mb-2">確定要取消訂閱嗎？</h3>
              <p className="text-slate-400 text-center mb-6">
                取消後，您仍可使用服務至當期結束。之後將自動降級為免費版。
              </p>

              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-6">
                <p className="text-amber-300 text-sm">
                  ⚠️ 取消後您將失去：
                </p>
                <ul className="text-amber-200/70 text-sm mt-2 space-y-1">
                  <li>• 每月 {subscription?.monthly_credits?.toLocaleString()} 點贈送</li>
                  <li>• AI 短影片生成功能</li>
                  <li>• 智能排程發布</li>
                  <li>• 多平台同步功能</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelDialog(false)}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
                >
                  保留訂閱
                </button>
                <button
                  onClick={handleCancelSubscription}
                  disabled={actionLoading === "cancel"}
                  className="flex-1 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {actionLoading === "cancel" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "確認取消"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Dialog - 直接在訂閱管理頁結帳 */}
      {checkoutPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl w-full max-w-lg border border-slate-700/50 shadow-2xl">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">確認升級方案</h3>
                <button
                  onClick={() => setCheckoutPlan(null)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Plan Info */}
              <div className="p-4 bg-slate-700/50 rounded-xl border border-slate-600/50 mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    checkoutPlan.color === "blue" ? "bg-blue-500/20" :
                    checkoutPlan.color === "purple" ? "bg-purple-500/20" :
                    "bg-orange-500/20"
                  }`}>
                    <checkoutPlan.icon className={`w-5 h-5 ${
                      checkoutPlan.color === "blue" ? "text-blue-400" :
                      checkoutPlan.color === "purple" ? "text-purple-400" :
                      "text-orange-400"
                    }`} />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold">{checkoutPlan.name}</h4>
                    <p className="text-slate-400 text-sm">{checkoutPlan.description}</p>
                  </div>
                </div>
                {checkoutPlan.monthlyCredits > 0 && (
                  <p className="text-sm text-emerald-400">
                    <Gift className="w-4 h-4 inline mr-1" />
                    每月獲得 {checkoutPlan.monthlyCredits.toLocaleString()} 點
                  </p>
                )}
              </div>

              {/* Billing Cycle Toggle */}
              {checkoutPlan.priceYearly && (
                <div className="mb-6">
                  <p className="text-sm text-slate-400 mb-3">選擇計費方式</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setCheckoutCycle("monthly")}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        checkoutCycle === "monthly"
                          ? "border-indigo-500 bg-indigo-500/10"
                          : "border-slate-600 bg-slate-700/30 hover:border-slate-500"
                      }`}
                    >
                      <div className="text-white font-semibold">月繳</div>
                      <div className="text-2xl font-bold text-white mt-1">
                        NT${checkoutPlan.price.toLocaleString()}
                        <span className="text-sm font-normal text-slate-400">/月</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setCheckoutCycle("yearly")}
                      className={`p-4 rounded-xl border-2 transition-all text-left relative ${
                        checkoutCycle === "yearly"
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "border-slate-600 bg-slate-700/30 hover:border-slate-500"
                      }`}
                    >
                      <span className="absolute -top-2.5 right-3 px-2 py-0.5 bg-emerald-500 text-white text-xs font-bold rounded-full">
                        省 {YEARLY_DISCOUNT_PERCENT}%
                      </span>
                      <div className="text-white font-semibold">年繳</div>
                      <div className="text-2xl font-bold text-white mt-1">
                        NT${checkoutPlan.priceYearly.toLocaleString()}
                        <span className="text-sm font-normal text-slate-400">/年</span>
                      </div>
                      <div className="text-xs text-emerald-400 mt-1">
                        約 NT${Math.round(checkoutPlan.priceYearly / 12).toLocaleString()}/月
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="p-4 bg-slate-700/30 rounded-xl mb-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">方案</span>
                  <span className="text-white">{checkoutPlan.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">計費方式</span>
                  <span className="text-white">{checkoutCycle === "yearly" ? "年繳" : "月繳"}</span>
                </div>
                <div className="border-t border-slate-600/50 pt-2 mt-2 flex justify-between">
                  <span className="text-white font-semibold">應付金額</span>
                  <span className="text-xl font-bold text-white">
                    NT${(checkoutCycle === "yearly" && checkoutPlan.priceYearly
                      ? checkoutPlan.priceYearly
                      : checkoutPlan.price
                    ).toLocaleString()}
                  </span>
                </div>
                {checkoutCycle === "yearly" && checkoutPlan.priceYearly && (
                  <div className="text-xs text-emerald-400 text-right">
                    比月繳省 NT${(checkoutPlan.price * 12 - checkoutPlan.priceYearly).toLocaleString()}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setCheckoutPlan(null)}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCheckout}
                  disabled={checkoutLoading}
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25"
                >
                  {checkoutLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      前往付款
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-slate-500 text-center mt-4">
                付款後立即生效，系統將自動升級您的帳戶權限
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
