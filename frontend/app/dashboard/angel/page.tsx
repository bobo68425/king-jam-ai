"use client";

import React, { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import api from "@/lib/api";
import { Loader2, AlertCircle, TrendingUp, ShieldCheck, Rocket, Share2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const AngelDashboard = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await api.get("/angel/stats");
        setData(response.data);
      } catch (err: any) {
        console.error("Failed to fetch angel stats:", err);
        const msg = err.response?.data?.detail || "無法獲取數據，請確認管理員權限";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <Loader2 className="w-12 h-12 animate-spin mb-4 text-blue-500" />
        <p className="text-lg">正在加載天使數據...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400 px-4">
        <AlertCircle className="w-16 h-16 mb-4 text-red-500" />
        <h2 className="text-xl font-bold text-white mb-2">訪問受限</h2>
        <p className="text-center max-w-md">{error || "您沒有權限查看此頁面。"}</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[#0a0b14] min-h-screen text-slate-100">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
          King-Jam-AI 天使專屬儀表板
        </h1>
        <p className="text-slate-400 text-sm">
          數據更新：{new Date().toLocaleDateString("zh-TW")} | 持股單位：{data.investment_units} 單位
        </p>
      </div>

      {/* 財務牆：核心卡片 */}
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
        <div className="w-1.5 h-6 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
        財務牆 (Financial Wall)
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard
          title="持股單位 & 投資額"
          value={`NT$ ${(data.total_invested || 0).toLocaleString()}`}
          color="text-indigo-400"
          desc={`${data.investment_units || 0} 單位 (每單位 1% 分紅)`}
        />
        <StatCard
          title="總計畫籌資額"
          value="NT$ 2,000,000"
          color="text-emerald-400"
          desc="目標發行 12 單位"
        />
        <StatCard
          title="本月實收營收"
          value={`NT$ ${data.revenue.toLocaleString()}`}
          color="text-blue-400"
          desc="ECPay / BluePay 實收"
        />
        <StatCard
          title="您的本月分紅"
          value={`NT$ ${data.dividend.toLocaleString()}`}
          color="text-amber-400"
          highlight
          desc="淨利潤分紅 (扣除成本與稅金)"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <StatCard
          title="預計支出 & 稅金"
          value={`NT$ ${((data.gpu_cost || 0) + (data.withholding_tax || 0)).toLocaleString()}`}
          color="text-rose-400"
          desc={`含稅金: NT$ ${(data.withholding_tax || 0).toLocaleString()}`}
        />
        <StatCard
          title="推廣成效 (Referral)"
          value={`${data.referral_stats?.count || 0} 人`}
          color="text-emerald-400"
          desc={`累計預約/註冊用戶`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        {/* 財務趨勢圖 */}
        <div className="lg:col-span-2 bg-[#11121d] border border-white/5 p-6 rounded-2xl shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <TrendingUp className="text-blue-400 w-5 h-5" />
              營收與利潤趨勢
            </h3>
            <div className="flex gap-4 text-[10px] uppercase font-bold tracking-widest text-slate-500">
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500"/> 營收</span>
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"/> 利潤</span>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.historical_data}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="name" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#475569" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `NT$${value/1000}k`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#11121d",
                    border: "1px solid #1e293b",
                    borderRadius: "12px",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                  }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  name="月營收"
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorProfit)"
                  name="預估利潤"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 系統健康度 */}
        <div className="bg-[#11121d] border border-white/5 p-6 rounded-2xl shadow-xl">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <ShieldCheck className="text-emerald-400 w-5 h-5" />
            系統健康度 (Sentry)
          </h3>
          <div className="space-y-6">
            <HealthMetric label="伺服器穩定度" value={`${data.system_health?.stability}%`} color="bg-emerald-500" />
            <HealthMetric label="生成成功率" value={`${data.system_health?.success_rate}%`} color="bg-blue-500" />
            <div className="pt-4 border-t border-white/5 flex justify-between items-center text-sm">
              <span className="text-slate-400">目前錯誤攔截 (Sentry)</span>
              <span className="text-rose-400 font-mono font-bold">{data.system_health?.error_count} 次</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">平均生成延遲</span>
              <span className="text-amber-400 font-mono font-bold">{data.system_health?.latency_ms} ms</span>
            </div>
          </div>
          <div className="mt-8 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-emerald-500 font-mono uppercase tracking-widest">
              Live Monitoring Active
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        {/* 預估支出表 */}
        <div className="bg-[#11121d] border border-white/5 p-6 rounded-2xl shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <TrendingUp className="text-pink-400 w-5 h-5" />
              預估支出 (Budget Allocation)
            </h3>
            <Link 
              href="/dashboard/expenses" 
              className="text-[10px] uppercase font-bold tracking-widest text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 transition-colors group"
            >
              查看支出明細
              <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500 border-b border-white/5">
                <tr>
                  <th className="pb-3 font-semibold">項目</th>
                  <th className="pb-3 font-semibold text-right">預算</th>
                  <th className="pb-3 pl-6 font-semibold">說明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {data.budget_allocation?.map((item: any, idx: number) => (
                  <tr key={idx} className="group hover:bg-white/5 transition-colors">
                    <td className="py-4 font-medium">{item.item}</td>
                    <td className="py-4 text-right text-pink-400 font-mono font-bold">NT$ {item.budget.toLocaleString()}</td>
                    <td className="py-4 pl-6 text-xs text-slate-500">{item.desc}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-6 font-bold text-white border-t-2 border-white/5">總計預算分配</td>
                  <td className="py-6 text-right font-bold text-white font-mono text-lg border-t-2 border-white/5">
                    NT$ {data.budget_allocation?.reduce((acc: number, curr: any) => acc + curr.budget, 0).toLocaleString()}
                  </td>
                  <td className="py-6 pl-6 text-xs text-slate-500 italic border-t-2 border-white/5">每月預估動態與固定支出攤銷</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 推廣與研發進度 */}
        <div className="space-y-8">
          {/* 推廣成效 */}
          <div className="bg-gradient-to-br from-indigo-900/40 via-[#11121d] to-[#11121d] border border-indigo-500/20 p-6 rounded-2xl shadow-xl">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Rocket className="text-emerald-400 w-5 h-5" />
              推廣成效 (Referral Results)
            </h3>
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="bg-white/5 p-5 rounded-2xl border border-white/5 group hover:border-emerald-500/30 transition-all">
                <p className="text-slate-500 text-[10px] mb-1 uppercase tracking-wider">推廣註冊總數</p>
                <p className="text-3xl font-extrabold font-mono text-emerald-400">
                  {data.referral_stats?.count || 0} <span className="text-sm font-normal text-slate-600">人</span>
                </p>
              </div>
              <div className="bg-white/5 p-5 rounded-2xl border border-white/5 group hover:border-blue-500/30 transition-all">
                <p className="text-slate-500 text-[10px] mb-1 uppercase tracking-wider">轉換營收回報</p>
                <p className="text-3xl font-extrabold font-mono text-blue-400">
                  NT$ {(data.referral_stats?.revenue || 0).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between bg-black/40 p-4 rounded-xl border border-white/5 group">
              <div className="overflow-hidden">
                <p className="text-[10px] text-slate-400 mb-1">推廣大使專屬連結</p>
                <code className="text-[10px] text-indigo-400 truncate block w-48 font-mono">
                  https://kingjam.app/?ref={data.referral_code || 'angel'}
                </code>
              </div>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(`https://kingjam.app/?ref=${data.referral_code || 'angel'}`);
                  toast.success('連結已複製到剪貼簿');
                }}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-lg shadow-indigo-500/20 group-hover:scale-105 active:scale-95"
              >
                <Share2 className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* 研發進度 */}
          <div className="bg-[#11121d] border border-white/5 p-6 rounded-2xl shadow-xl">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <TrendingUp className="text-purple-400 w-5 h-5" />
              研發進度 (Roadmap)
            </h3>
            <div className="space-y-4">
              <ProgressBar label="LTX-2 1080p 畫質優化" percent={75} color="bg-blue-500" />
              <ProgressBar label="起勢方案 (私有化微調建模)" percent={30} color="bg-indigo-500" />
              <ProgressBar label="AI 廣告投放系統研發" percent={15} color="bg-pink-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, color, highlight, desc }: any) => (
  <div
    className={`p-6 bg-[#11121d] rounded-2xl border transition-all duration-300 ${
      highlight ? "border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.05)]" : "border-white/5"
    } hover:border-white/10 group overflow-hidden`}
  >
    <p className="text-sm text-slate-500 mb-1 group-hover:text-slate-400 transition-colors truncate whitespace-nowrap">
      {title}
    </p>
    <p className={`text-2xl lg:text-3xl font-bold ${color} mb-2 whitespace-nowrap tabular-nums`}>
      {value}
    </p>
    {desc && <p className="text-[10px] text-slate-600 font-medium line-clamp-2">{desc}</p>}
  </div>
);

const HealthMetric = ({ label, value, color }: any) => (
  <div className="space-y-2">
    <div className="flex justify-between text-xs mb-1">
      <span className="text-slate-400">{label}</span>
      <span className="text-white font-bold">{value}</span>
    </div>
    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
      <div
        className={`${color} h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(255,255,255,0.1)]`}
        style={{ width: value }}
      ></div>
    </div>
  </div>
);

const ProgressBar = ({ label, percent, color }: any) => (
  <div className="group">
    <div className="flex justify-between text-xs mb-2">
      <span className="text-slate-400 font-medium group-hover:text-slate-300 transition-colors uppercase tracking-tight">{label}</span>
      <span className={`${percent === 100 ? "text-emerald-400" : "text-slate-500"} font-bold`}>
        {percent}%
      </span>
    </div>
    <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/5 p-0.5">
      <div
        className={`${color} h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(255,255,255,0.1)]`}
        style={{ width: `${percent}%` }}
      ></div>
    </div>
  </div>
);

export default AngelDashboard;
