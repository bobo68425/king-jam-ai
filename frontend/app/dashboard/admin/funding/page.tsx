"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Gift, Loader2, Copy, Check, ChevronDown, ChevronUp,
  Tag, Package, Hash
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";

interface FundingProject {
  id: number;
  project_code: string;
  name: string;
  description: string | null;
  target_plan_code: string;
  subscription_months: number;
  fundraising_platform: string | null;
  platform_url: string | null;
  is_active: boolean;
  tiers: {
    id: number;
    tier_code: string;
    tier_name: string;
    fundraising_price_twd: number;
    original_price_twd: number | null;
    is_active: boolean;
  }[];
}

interface SalesCodeItem {
  id: number;
  code: string;
  tier_name: string;
  project_name: string;
  status: string;
  redeemed_at: string | null;
  expires_at: string | null;
  created_at: string | null;
  redeemer_email: string | null;
}

export default function AdminFundingPage() {
  const [projects, setProjects] = useState<FundingProject[]>([]);
  const [salesCodes, setSalesCodes] = useState<SalesCodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingTierId, setGeneratingTierId] = useState<number | null>(null);
  const [generateCount, setGenerateCount] = useState(10);
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null);
  const [showCodes, setShowCodes] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [codesFilter, setCodesFilter] = useState<{ tier_id?: number; status?: string }>({});

  const fetchData = async () => {
    setFetchError(false);
    setLoading(true);
    try {
      const [projectsRes, codesRes] = await Promise.all([
        api.get("/admin/funding/projects"),
        api.get("/admin/funding/sales-codes", {
          params: { limit: 100, ...codesFilter },
        }),
      ]);
      setProjects(projectsRes.data.projects || []);
      setSalesCodes(codesRes.data.codes || []);
    } catch (err) {
      console.error(err);
      setFetchError(true);
      toast.error("載入失敗，請確認管理員權限後重新載入");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [codesFilter.tier_id, codesFilter.status]);

  const handleGenerate = async (tierId: number) => {
    setGenerating(true);
    setGeneratingTierId(tierId);
    try {
      const res = await api.post("/admin/funding/sales-codes/generate", {
        tier_id: tierId,
        count: generateCount,
        expires_in_days: expiresInDays || undefined,
      });
      if (res.data.success) {
        setGeneratedCodes(res.data.codes);
        setShowCodes(true);
        toast.success(`已產生 ${res.data.count} 組銷售碼`);
        fetchData();
      } else {
        toast.error(res.data.error || "產生失敗");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.detail || "產生失敗";
      toast.error(typeof msg === "string" ? msg : "產生失敗");
    } finally {
      setGenerating(false);
      setGeneratingTierId(null);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success("已複製");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAllCodes = () => {
    const text = generatedCodes.join("\n");
    navigator.clipboard.writeText(text);
    toast.success(`已複製 ${generatedCodes.length} 組結帳碼`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  const pendingCount = salesCodes.filter((c) => c.status === "pending").length;
  const redeemedCount = salesCodes.filter((c) => c.status === "redeemed").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Gift className="w-7 h-7 text-amber-400" />
          募資行銷活動
        </h1>
        <p className="text-slate-400 mt-1">
          管理募資專案、產生銷售碼，供用戶在訂閱頁兌換
        </p>
      </div>

      {/* 募資專案與產生銷售碼 */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Package className="w-5 h-5" />
            募資專案與方案
          </CardTitle>
          <p className="text-sm text-slate-400">
            選擇方案層級並批次產生銷售碼
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 產生設定 */}
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm text-slate-400 mb-1">產生數量</label>
              <Input
                type="number"
                min={1}
                max={500}
                value={generateCount}
                onChange={(e) => setGenerateCount(parseInt(e.target.value) || 10)}
                className="w-24 bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">有效期（天，留空為永久）</label>
              <Input
                type="number"
                min={1}
                max={365}
                placeholder="留空"
                value={expiresInDays ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setExpiresInDays(v === "" ? null : parseInt(v) || null);
                }}
                className="w-24 bg-slate-800 border-slate-600 text-white"
              />
            </div>
          </div>

          {/* 專案列表 */}
          <div className="space-y-4">
            {fetchError ? (
              <div className="text-center py-8">
                <p className="text-amber-400 mb-3">載入失敗，請確認您有管理員權限</p>
                <Button variant="outline" onClick={fetchData} className="border-amber-500/50 text-amber-400">
                  重新載入
                </Button>
              </div>
            ) : projects.length === 0 ? (
              <p className="text-slate-500 py-8 text-center">
                尚無募資專案（後端啟動時會自動建立）
              </p>
            ) : (
              projects.map((project) => (
                <div
                  key={project.id}
                  className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50"
                >
                  <div className="font-medium text-white mb-2">
                    {project.name}
                    <span className="text-slate-500 text-sm ml-2">
                      → {project.target_plan_code} {project.subscription_months} 個月
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {project.tiers.map((tier) => (
                      <div
                        key={tier.id}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700/50"
                      >
                        <Tag className="w-4 h-4 text-amber-400" />
                        <span className="text-white">{tier.tier_name}</span>
                        <span className="text-slate-400 text-sm">
                          NT${tier.fundraising_price_twd.toLocaleString()}
                        </span>
                        <Button
                          size="sm"
                          onClick={() => handleGenerate(tier.id)}
                          disabled={generating}
                          className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400"
                        >
                          {generating && generatingTierId === tier.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "產生"
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 產生的銷售碼 */}
          {showCodes && generatedCodes.length > 0 && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-medium">
                  已產生 {generatedCodes.length} 組結帳碼
                </span>
                <Button size="sm" variant="outline" onClick={copyAllCodes}>
                  <Copy className="w-4 h-4 mr-1" />
                  複製全部
                </Button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 font-mono text-sm">
                {generatedCodes.map((code, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1 hover:bg-slate-800/30 rounded px-2"
                  >
                    <span className="text-slate-300">{code}</span>
                    <button
                      onClick={() => copyToClipboard(code, i)}
                      className="text-slate-500 hover:text-white"
                    >
                      {copiedIndex === i ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-slate-400"
                onClick={() => setShowCodes(false)}
              >
                收起
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 銷售碼列表 */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Hash className="w-5 h-5" />
            銷售碼列表
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <span className="text-sm text-slate-400">
              待使用: {pendingCount} | 已兌換: {redeemedCount}
            </span>
            <select
              value={codesFilter.status ?? ""}
              onChange={(e) =>
                setCodesFilter((p) => ({
                  ...p,
                  status: e.target.value || undefined,
                }))
              }
              className="bg-slate-800 border-slate-600 text-white rounded-lg px-2 py-1 text-sm"
            >
              <option value="">全部狀態</option>
              <option value="pending">待使用</option>
              <option value="redeemed">已兌換</option>
              <option value="expired">已過期</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 text-slate-400 font-medium">結帳碼</th>
                  <th className="text-left py-2 text-slate-400 font-medium">專案</th>
                  <th className="text-left py-2 text-slate-400 font-medium">方案</th>
                  <th className="text-left py-2 text-slate-400 font-medium">狀態</th>
                  <th className="text-left py-2 text-slate-400 font-medium">使用帳號</th>
                  <th className="text-left py-2 text-slate-400 font-medium">兌換時間</th>
                  <th className="text-left py-2 text-slate-400 font-medium">建立時間</th>
                </tr>
              </thead>
              <tbody>
                {salesCodes.map((c) => (
                  <tr key={c.id} className="border-b border-slate-700/50">
                    <td className="py-2 font-mono text-slate-300">{c.code}</td>
                    <td className="py-2 text-slate-400">{c.project_name}</td>
                    <td className="py-2 text-slate-400">{c.tier_name}</td>
                    <td className="py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          c.status === "redeemed"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : c.status === "expired"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-amber-500/20 text-amber-400"
                        }`}
                      >
                        {c.status === "pending"
                          ? "待使用"
                          : c.status === "redeemed"
                          ? "已兌換"
                          : "已過期"}
                      </span>
                    </td>
                    <td className="py-2 text-slate-400">
                      {c.redeemer_email ?? "-"}
                    </td>
                    <td className="py-2 text-slate-500">
                      {c.redeemed_at
                        ? format(new Date(c.redeemed_at), "yyyy/MM/dd HH:mm", {
                            locale: zhTW,
                          })
                        : "-"}
                    </td>
                    <td className="py-2 text-slate-500">
                      {c.created_at
                        ? format(new Date(c.created_at), "yyyy/MM/dd", {
                            locale: zhTW,
                          })
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {salesCodes.length === 0 && (
            <p className="text-slate-500 py-8 text-center">尚無銷售碼</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
