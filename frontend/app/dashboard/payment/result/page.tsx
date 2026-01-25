"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle, XCircle, Loader2, Coins, ArrowRight,
  Clock, AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// ============================================================
// Types
// ============================================================

interface PaymentResult {
  success: boolean;
  order_no: string;
  status: string;
  item_name: string;
  total_amount: number;
  credits_granted: number;
  paid_at: string | null;
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
// Status Config
// ============================================================

const STATUS_CONFIG: Record<string, { 
  icon: React.ElementType; 
  title: string; 
  description: string;
  color: string;
}> = {
  completed: {
    icon: CheckCircle,
    title: "付款成功",
    description: "您的點數已經入帳，可以開始使用了！",
    color: "text-green-400",
  },
  paid: {
    icon: CheckCircle,
    title: "付款成功",
    description: "正在處理您的訂單...",
    color: "text-green-400",
  },
  processing: {
    icon: Clock,
    title: "處理中",
    description: "正在等待付款確認...",
    color: "text-yellow-400",
  },
  pending: {
    icon: Clock,
    title: "待付款",
    description: "請完成付款以繼續",
    color: "text-yellow-400",
  },
  failed: {
    icon: XCircle,
    title: "付款失敗",
    description: "付款過程中發生錯誤，請重試",
    color: "text-red-400",
  },
  cancelled: {
    icon: AlertTriangle,
    title: "已取消",
    description: "訂單已取消",
    color: "text-slate-400",
  },
};

// ============================================================
// Result Content Component
// ============================================================

function PaymentResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderNo = searchParams.get("order_no");
  
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!orderNo) {
      setError("找不到訂單編號");
      setLoading(false);
      return;
    }

    const fetchResult = async () => {
      try {
        const res = await api.get(`/payment/result/${orderNo}`);
        setResult(res.data);
        
        // 如果還在處理中，繼續輪詢
        if (res.data.status === "processing" && retryCount < 10) {
          setTimeout(() => {
            setRetryCount(retryCount + 1);
          }, 3000);
        }
      } catch (err: any) {
        setError(err?.response?.data?.detail || "查詢訂單失敗");
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [orderNo, retryCount]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-400 mx-auto" />
          <p className="text-slate-400">正在查詢訂單狀態...</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-6">
        <Card className="bg-slate-900/50 border-slate-700/50 max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <XCircle className="w-16 h-16 text-red-400 mx-auto" />
            <h2 className="text-xl font-bold text-white">查詢失敗</h2>
            <p className="text-slate-400">{error || "無法取得訂單資訊"}</p>
            <div className="flex gap-2 justify-center pt-4">
              <Link href="/dashboard/pricing">
                <Button variant="outline" className="bg-slate-800/50 border-slate-700">
                  返回購買頁面
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button className="bg-indigo-600 hover:bg-indigo-700">
                  回到首頁
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[result.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-6">
      <Card className="bg-slate-900/50 border-slate-700/50 max-w-md w-full">
        <CardHeader className="text-center">
          <StatusIcon className={cn("w-16 h-16 mx-auto mb-4", statusConfig.color)} />
          <CardTitle className="text-2xl text-white">{statusConfig.title}</CardTitle>
          <p className="text-slate-400">{statusConfig.description}</p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Order Details */}
          <div className="p-4 rounded-lg bg-slate-800/50 space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400">訂單編號</span>
              <span className="text-white font-mono text-sm">{result.order_no}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">商品</span>
              <span className="text-white">{result.item_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">金額</span>
              <span className="text-emerald-400 font-semibold">
                {formatPrice(result.total_amount)}
              </span>
            </div>
            {result.credits_granted > 0 && (
              <div className="flex justify-between pt-3 border-t border-slate-700">
                <span className="text-slate-300 font-medium">獲得點數</span>
                <span className="text-indigo-400 font-bold flex items-center gap-1">
                  <Coins className="w-4 h-4" />
                  {formatNumber(result.credits_granted)} 點
                </span>
              </div>
            )}
          </div>

          {/* Processing indicator */}
          {result.status === "processing" && (
            <div className="flex items-center justify-center gap-2 text-yellow-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">正在確認付款結果...</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {(result.status === "completed" || result.status === "paid") && (
              <Link href="/dashboard">
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
                  開始使用
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            )}
            
            {(result.status === "failed" || result.status === "cancelled") && (
              <Link href="/dashboard/pricing">
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
                  重新購買
                </Button>
              </Link>
            )}
            
            <Link href="/dashboard/credits">
              <Button variant="outline" className="w-full bg-slate-800/50 border-slate-700">
                查看點數錢包
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Main Component with Suspense
// ============================================================

export default function PaymentResultPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-400" />
      </div>
    }>
      <PaymentResultContent />
    </Suspense>
  );
}
