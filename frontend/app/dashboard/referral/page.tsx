"use client";

import { useState, useEffect } from "react";
import { 
  Gift, Copy, Share2, Users, TrendingUp, Award, 
  ChevronRight, CheckCircle, Clock, DollarSign,
  Medal, Star, Crown, Wallet, ArrowUpRight
} from "lucide-react";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import api from "@/lib/api";

// ============================================================
// Types
// ============================================================

interface PartnerTier {
  tier_code: string;
  tier_name: string;
  commission_rate: number;
  min_referrals: number;
  min_revenue: number;
  referral_bonus_promo: number;
  monthly_bonus: number | null;
}

interface PartnerStats {
  user_id: number;
  referral_code: string | null;
  partner_tier: string;
  tier_name: string;
  commission_rate: number;
  total_referrals: number;
  total_referral_revenue: number;
  next_tier: string | null;
  next_tier_name: string | null;
  progress: {
    referrals: { current: number; required: number; percentage: number };
    revenue: { current: number; required: number; percentage: number };
  };
  bonus_credits: number;
  withdrawable_twd: number;
}

interface ReferralHistory {
  user_id: number;
  email: string;
  subscription_plan: string;
  registered_at: string | null;
}

interface BonusTable {
  partner_tiers: PartnerTier[];
  bonus_table: Record<string, Record<string, number>>;
  subscription_prices: Record<string, number>;
  bonus_table_yearly?: Record<string, Record<string, number>>;
  subscription_prices_yearly?: Record<string, number>;
}

// ============================================================
// Components
// ============================================================

function TierBadge({ tier }: { tier: string }) {
  const config = {
    bronze: { icon: Medal, color: "text-amber-600", bg: "bg-amber-500/10", label: "銅牌" },
    silver: { icon: Star, color: "text-slate-300", bg: "bg-slate-400/10", label: "銀牌" },
    gold: { icon: Crown, color: "text-yellow-400", bg: "bg-yellow-500/10", label: "金牌" },
  }[tier] || { icon: Medal, color: "text-amber-600", bg: "bg-amber-500/10", label: "銅牌" };

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.color}`}>
      <Icon className="w-4 h-4" />
      {config.label}夥伴
    </span>
  );
}

function ProgressBar({ percentage, color = "indigo" }: { percentage: number; color?: string }) {
  return (
    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
      <div 
        className={`h-full bg-gradient-to-r from-${color}-500 to-${color}-400 transition-all duration-500`}
        style={{ width: `${Math.min(100, percentage)}%` }}
      />
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function ReferralPage() {
  const [stats, setStats] = useState<PartnerStats | null>(null);
  const [history, setHistory] = useState<ReferralHistory[]>([]);
  const [bonusTable, setBonusTable] = useState<BonusTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "table">("overview");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, historyRes, tableRes] = await Promise.all([
        api.get("/referral/stats"),
        api.get("/referral/history"),
        api.get("/referral/bonus-table"),
      ]);

      setStats(statsRes.data);
      setHistory(historyRes.data);
      setBonusTable(tableRes.data);
    } catch (error) {
      console.error("Failed to fetch referral data:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyReferralCode = async () => {
    if (!stats?.referral_code) return;
    
    try {
      await navigator.clipboard.writeText(stats.referral_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const shareReferralLink = async () => {
    if (!stats?.referral_code) return;
    
    const shareUrl = `https://kingjam.ai/register?ref=${stats.referral_code}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: "加入 King Jam AI",
          text: "使用我的推薦碼註冊，我們都能獲得獎勵！",
          url: shareUrl,
        });
      } catch (error) {
        console.log("Share cancelled");
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Gift className="w-7 h-7 text-pink-500" />
            推薦中心
          </h1>
          <p className="text-slate-400 mt-1">
            邀請好友加入，賺取豐厚獎金
          </p>
        </div>
        {stats && <TierBadge tier={stats.partner_tier} />}
      </div>

      {/* Referral Code Card */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-6 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#grid)" />
          </svg>
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white/90">我的推薦碼</h2>
            <span className="text-sm text-white/70">{stats?.commission_rate ? `${(stats.commission_rate * 100).toFixed(0)}% 分潤` : ""}</span>
          </div>
          
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 bg-white/10 backdrop-blur rounded-xl px-6 py-4 border border-white/20">
              <span className="text-3xl font-mono font-bold text-white tracking-wider">
                {stats?.referral_code || "生成中..."}
              </span>
            </div>
            <button 
              onClick={copyReferralCode}
              className="p-4 bg-white/10 hover:bg-white/20 backdrop-blur rounded-xl border border-white/20 transition-all"
            >
              {copied ? (
                <CheckCircle className="w-6 h-6 text-green-400" />
              ) : (
                <Copy className="w-6 h-6 text-white" />
              )}
            </button>
            <button 
              onClick={shareReferralLink}
              className="p-4 bg-white/10 hover:bg-white/20 backdrop-blur rounded-xl border border-white/20 transition-all"
            >
              <Share2 className="w-6 h-6 text-white" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
              <Users className="w-5 h-5 text-white/70 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{stats?.total_referrals || 0}</div>
              <div className="text-xs text-white/60">推薦人數</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
              <DollarSign className="w-5 h-5 text-white/70 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">NT${stats?.total_referral_revenue?.toLocaleString() || 0}</div>
              <div className="text-xs text-white/60">累積收益</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
              <Wallet className="w-5 h-5 text-white/70 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{stats?.bonus_credits?.toLocaleString() || 0}</div>
              <div className="text-xs text-white/60">獎金點數</div>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade Progress */}
      {stats?.next_tier && (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">升級進度</h3>
            <span className="text-sm text-slate-400">
              目標：<span className="text-indigo-400">{stats.next_tier_name}</span>
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Referrals Progress */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">推薦人數</span>
                <span className="text-sm text-white">
                  {stats.progress.referrals.current} / {stats.progress.referrals.required}
                </span>
              </div>
              <ProgressBar percentage={stats.progress.referrals.percentage} />
            </div>

            {/* Revenue Progress */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">累積收益</span>
                <span className="text-sm text-white">
                  NT${stats.progress.revenue.current.toLocaleString()} / NT${stats.progress.revenue.required.toLocaleString()}
                </span>
              </div>
              <ProgressBar percentage={stats.progress.revenue.percentage} color="purple" />
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-4">
            * 達成任一條件即可升級
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700">
        {[
          { id: "overview", label: "獎金規則", icon: Award },
          { id: "history", label: "推薦記錄", icon: Clock },
          { id: "table", label: "獎金對照表", icon: TrendingUp },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.id
                  ? "text-indigo-400 border-indigo-400"
                  : "text-slate-400 border-transparent hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Partner Tiers */}
            <div className="grid md:grid-cols-3 gap-4">
              {bonusTable?.partner_tiers.map((tier) => (
                <div 
                  key={tier.tier_code}
                  className={`bg-slate-800/50 rounded-xl p-6 border transition-all ${
                    stats?.partner_tier === tier.tier_code
                      ? "border-indigo-500 ring-2 ring-indigo-500/20"
                      : "border-slate-700/50 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <TierBadge tier={tier.tier_code} />
                    {stats?.partner_tier === tier.tier_code && (
                      <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-full">
                        目前等級
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">分潤比例</span>
                      <span className="text-white font-semibold">{(tier.commission_rate * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">推薦送點</span>
                      <span className="text-white">{tier.referral_bonus_promo} 點</span>
                    </div>
                    {tier.monthly_bonus && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">每月額外</span>
                        <span className="text-green-400">+{tier.monthly_bonus} 點</span>
                      </div>
                    )}
                    <div className="pt-3 border-t border-slate-700">
                      <div className="text-xs text-slate-500">升級條件</div>
                      <div className="text-slate-300 mt-1">
                        {tier.min_referrals > 0 
                          ? `${tier.min_referrals} 人推薦 或 NT$${tier.min_revenue.toLocaleString()} 收益`
                          : "預設等級"
                        }
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* How It Works */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
              <h3 className="text-lg font-semibold text-white mb-4">如何運作</h3>
              <div className="grid md:grid-cols-4 gap-4">
                {[
                  { step: 1, title: "分享推薦碼", desc: "將您的推薦碼分享給朋友" },
                  { step: 2, title: "朋友註冊", desc: "朋友使用推薦碼註冊，雙方獲得點數" },
                  { step: 3, title: "朋友訂閱", desc: "朋友升級付費方案時，您獲得獎金" },
                  { step: 4, title: "提領現金", desc: "獎金點數滿 3000 點可提領" },
                ].map((item, i) => (
                  <div key={item.step} className="relative">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold mb-3">
                        {item.step}
                      </div>
                      <h4 className="text-white font-medium mb-1">{item.title}</h4>
                      <p className="text-xs text-slate-400">{item.desc}</p>
                    </div>
                    {i < 3 && (
                      <ChevronRight className="hidden md:block absolute top-4 -right-2 w-4 h-4 text-slate-600" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            {history.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-300 mb-2">尚無推薦記錄</h3>
                <p className="text-sm text-slate-500">分享您的推薦碼，開始賺取獎金！</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-6 py-4">用戶</th>
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-6 py-4">方案</th>
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-6 py-4">註冊時間</th>
                    <th className="text-right text-xs font-medium text-slate-400 uppercase tracking-wider px-6 py-4">狀態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {history.map((item) => (
                    <tr key={item.user_id} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-white">{item.email}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.subscription_plan === "free"
                            ? "bg-slate-600/50 text-slate-300"
                            : item.subscription_plan === "pro"
                            ? "bg-purple-500/20 text-purple-400"
                            : item.subscription_plan === "enterprise"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-indigo-500/20 text-indigo-400"
                        }`}>
                          {item.subscription_plan === "free" ? "免費版" :
                           item.subscription_plan === "basic" ? "入門版" :
                           item.subscription_plan === "pro" ? "專業版" :
                           item.subscription_plan === "enterprise" ? "企業版" : item.subscription_plan}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-sm">
                        {item.registered_at 
                          ? format(new Date(item.registered_at), "yyyy/MM/dd HH:mm", { locale: zhTW })
                          : "-"
                        }
                      </td>
                      <td className="px-6 py-4 text-right">
                        {item.subscription_plan !== "free" ? (
                          <span className="text-green-400 text-sm">已獲得獎金</span>
                        ) : (
                          <span className="text-slate-500 text-sm">待升級</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "table" && bonusTable && (
          <div className="space-y-6">
            {/* 月繳方案獎金 */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="px-6 py-3 border-b border-slate-700/50 bg-slate-800/80">
                <h3 className="text-sm font-semibold text-white">月繳方案 · 推薦獎金</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-800/50">
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-6 py-4">訂閱方案</th>
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-6 py-4">月繳價格</th>
                    <th className="text-center text-xs font-medium text-amber-500 uppercase tracking-wider px-6 py-4">🥉 銅牌 (3%)</th>
                    <th className="text-center text-xs font-medium text-slate-300 uppercase tracking-wider px-6 py-4">🥈 銀牌 (5%)</th>
                    <th className="text-center text-xs font-medium text-yellow-400 uppercase tracking-wider px-6 py-4">🥇 金牌 (8%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {Object.entries(bonusTable.bonus_table).map(([plan, bonuses]) => (
                    <tr key={plan} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-white font-medium">
                          {plan === "basic" ? "入門方案" : plan === "pro" ? "標準方案" : plan === "enterprise" ? "企業方案" : plan}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400">NT${bonusTable.subscription_prices[plan]?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center"><span className="text-amber-400 font-semibold">{bonuses.bronze}</span><span className="text-slate-500 text-sm"> 點</span></td>
                      <td className="px-6 py-4 text-center"><span className="text-slate-200 font-semibold">{bonuses.silver}</span><span className="text-slate-500 text-sm"> 點</span></td>
                      <td className="px-6 py-4 text-center"><span className="text-yellow-400 font-semibold">{bonuses.gold}</span><span className="text-slate-500 text-sm"> 點</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 年繳方案獎金 */}
            {bonusTable.bonus_table_yearly && Object.keys(bonusTable.bonus_table_yearly).length > 0 && bonusTable.subscription_prices_yearly && (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="px-6 py-3 border-b border-slate-700/50 bg-slate-800/80 flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">年繳方案 · 推薦獎金</h3>
                  <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">省 20%</span>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700/50 bg-slate-800/50">
                      <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-6 py-4">訂閱方案</th>
                      <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-6 py-4">年繳價格</th>
                      <th className="text-center text-xs font-medium text-amber-500 uppercase tracking-wider px-6 py-4">🥉 銅牌 (3%)</th>
                      <th className="text-center text-xs font-medium text-slate-300 uppercase tracking-wider px-6 py-4">🥈 銀牌 (5%)</th>
                      <th className="text-center text-xs font-medium text-yellow-400 uppercase tracking-wider px-6 py-4">🥇 金牌 (8%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {Object.entries(bonusTable.bonus_table_yearly).map(([plan, bonuses]) => (
                      <tr key={`yearly-${plan}`} className="hover:bg-slate-700/20 transition-colors">
                        <td className="px-6 py-4">
                          <span className="text-white font-medium">
                            {plan === "basic" ? "入門方案" : plan === "pro" ? "標準方案" : plan === "enterprise" ? "企業方案" : plan}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-400">NT${bonusTable.subscription_prices_yearly[plan]?.toLocaleString()}</td>
                        <td className="px-6 py-4 text-center"><span className="text-amber-400 font-semibold">{bonuses.bronze}</span><span className="text-slate-500 text-sm"> 點</span></td>
                        <td className="px-6 py-4 text-center"><span className="text-slate-200 font-semibold">{bonuses.silver}</span><span className="text-slate-500 text-sm"> 點</span></td>
                        <td className="px-6 py-4 text-center"><span className="text-yellow-400 font-semibold">{bonuses.gold}</span><span className="text-slate-500 text-sm"> 點</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
              <p className="text-xs text-slate-500">
                * 被推薦人訂閱月繳或年繳，您皆可依方案價格獲得對應比例獎金；獎金點數可累積提領，滿 3,000 點（NT$300）即可申請提領現金
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      {stats && stats.bonus_credits >= 3000 && (
        <div className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 rounded-xl p-6 border border-green-500/30">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">🎉 恭喜！您可以提領獎金了</h3>
              <p className="text-green-400 mt-1">
                目前可提領 <span className="font-bold">{stats.bonus_credits.toLocaleString()} 點</span>
                （約 NT${stats.withdrawable_twd.toLocaleString()}）
              </p>
            </div>
            <a 
              href="/dashboard/credits"
              className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-medium transition-colors"
            >
              前往提領
              <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
