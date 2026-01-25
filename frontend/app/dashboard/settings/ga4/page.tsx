"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, Settings, CheckCircle2, XCircle, Loader2, 
  ArrowLeft, ExternalLink, Globe, AlertCircle, Copy
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SocialAccount {
  id: number;
  platform: string;
  platform_username: string;
  is_active: boolean;
  extra_settings?: {
    site_url?: string;
    site_name?: string;
    ga4_property_id?: string;
  };
}

export default function GA4SettingsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [ga4Inputs, setGa4Inputs] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await api.get("/scheduler/accounts");
      // 只顯示 WordPress 帳號
      const wordpressAccounts = res.data.filter((a: SocialAccount) => a.platform === "wordpress");
      setAccounts(wordpressAccounts);
      
      // 初始化輸入值
      const inputs: Record<number, string> = {};
      wordpressAccounts.forEach((a: SocialAccount) => {
        inputs[a.id] = a.extra_settings?.ga4_property_id || "";
      });
      setGa4Inputs(inputs);
    } catch (error) {
      toast.error("載入帳號失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGA4 = async (accountId: number) => {
    const propertyId = ga4Inputs[accountId]?.trim();
    if (!propertyId) {
      toast.error("請輸入 GA4 Property ID");
      return;
    }

    // 驗證格式（只能是數字）
    if (!/^\d+$/.test(propertyId)) {
      toast.error("GA4 Property ID 只能包含數字");
      return;
    }

    setSaving(accountId);
    try {
      await api.put(`/scheduler/accounts/${accountId}/ga4-config`, {
        ga4_property_id: propertyId,
      });
      toast.success("GA4 設定已儲存");
      fetchAccounts();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "儲存失敗");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* 頁面標題 */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-red-600">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            Google Analytics 4 設定
          </h1>
          <p className="text-slate-400 mt-1">連接 GA4 以獲取網站真實瀏覽數據</p>
        </div>
      </div>

      {/* 說明卡片 */}
      <Card className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border-blue-500/30">
        <CardContent className="p-6">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-400" />
            如何取得 GA4 Property ID？
          </h3>
          <ol className="text-slate-300 space-y-2 text-sm ml-7 list-decimal">
            <li>前往 <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-1">Google Analytics <ExternalLink className="w-3 h-3" /></a></li>
            <li>點擊左下角的 <strong>「管理」</strong>（齒輪圖示）</li>
            <li>在「資源」欄位中，點擊 <strong>「資源設定」</strong></li>
            <li>複製 <strong>「資源 ID」</strong>（僅數字部分，例如：<code className="bg-slate-700 px-1.5 py-0.5 rounded">123456789</code>）</li>
          </ol>
          <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
            <p className="text-xs text-slate-400">
              <strong>注意：</strong>請確保您的網站已安裝 GA4 追蹤碼，否則將無法獲取數據。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* WordPress 帳號列表 */}
      {accounts.length === 0 ? (
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="p-12 text-center">
            <Globe className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <h3 className="text-lg font-medium text-slate-300 mb-2">尚未連接 WordPress 網站</h3>
            <p className="text-slate-500 mb-4">請先在排程上架頁面連接您的 WordPress 網站</p>
            <Button
              onClick={() => router.push("/dashboard/scheduler")}
              className="bg-gradient-to-r from-indigo-600 to-purple-600"
            >
              前往排程上架
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {accounts.map((account) => {
            const isConfigured = !!account.extra_settings?.ga4_property_id;
            return (
              <Card key={account.id} className="bg-slate-900 border-slate-700">
                <CardHeader className="border-b border-slate-700">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-3">
                      <span className="text-2xl">📝</span>
                      <div>
                        <p className="font-semibold">{account.extra_settings?.site_name || "WordPress"}</p>
                        <p className="text-sm text-slate-400 font-normal">{account.extra_settings?.site_url}</p>
                      </div>
                    </CardTitle>
                    <Badge className={cn(
                      isConfigured 
                        ? "bg-green-500/20 text-green-400 border-green-500/30" 
                        : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                    )}>
                      {isConfigured ? (
                        <><CheckCircle2 className="w-3 h-3 mr-1" /> GA4 已連接</>
                      ) : (
                        <><XCircle className="w-3 h-3 mr-1" /> 未設定 GA4</>
                      )}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-slate-400 mb-2 block">GA4 Property ID</label>
                      <div className="flex gap-3">
                        <Input
                          value={ga4Inputs[account.id] || ""}
                          onChange={(e) => setGa4Inputs({ ...ga4Inputs, [account.id]: e.target.value })}
                          placeholder="例如：123456789"
                          className="bg-slate-800 border-slate-600 text-white flex-1"
                        />
                        <Button
                          onClick={() => handleSaveGA4(account.id)}
                          disabled={saving === account.id}
                          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                        >
                          {saving === account.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "儲存"
                          )}
                        </Button>
                      </div>
                      {isConfigured && (
                        <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          目前設定：{account.extra_settings?.ga4_property_id}
                        </p>
                      )}
                    </div>
                    
                    {isConfigured && (
                      <div className="p-4 bg-slate-800/50 rounded-lg">
                        <p className="text-sm text-slate-300">
                          ✅ GA4 已連接。現在您可以在排程詳情頁面中看到真實的瀏覽數據。
                        </p>
                        <Button
                          variant="link"
                          className="text-indigo-400 p-0 h-auto mt-2"
                          onClick={() => router.push("/dashboard/scheduler")}
                        >
                          前往查看成效 →
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 幫助卡片 */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-400" />
            需要幫助？
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs text-slate-400">1</div>
            <div>
              <p className="text-slate-300">確認您的網站已安裝 GA4</p>
              <p className="text-slate-500 text-xs">您可以在網站的原始碼中搜尋 "gtag" 或 "GA4" 來確認</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs text-slate-400">2</div>
            <div>
              <p className="text-slate-300">等待數據累積</p>
              <p className="text-slate-500 text-xs">GA4 通常需要 24-48 小時才能顯示完整數據</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs text-slate-400">3</div>
            <div>
              <p className="text-slate-300">設定正確的權限</p>
              <p className="text-slate-500 text-xs">確保您有 GA4 資源的「檢視者」以上權限</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
