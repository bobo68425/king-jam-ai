"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Megaphone, Users, Coins, Gift, Send, Play, Eye,
  TrendingUp, UserPlus, UserMinus, Crown, Loader2,
  CheckCircle, AlertCircle, Calendar, Target, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";

// ============================================================
// Types
// ============================================================

interface CampaignStats {
  total_users: number;
  active_users: number;
  new_users_7d: number;
  paid_users: number;
  promo_credits_this_month: number;
  by_tier: Record<string, number>;
}

interface TargetUser {
  id: number;
  email: string;
  full_name: string | null;
  tier: string;
  credits: number;
  created_at: string | null;
}

interface CampaignHistory {
  name: string;
  recipient_count: number;
  total_credits: number;
  first_at: string | null;
  last_at: string | null;
}

// ============================================================
// Quick Campaign Cards
// ============================================================

const QUICK_CAMPAIGNS = [
  {
    id: "welcome_back",
    name: "回歸禮活動",
    description: "對不活躍用戶發放點數，吸引他們回來使用",
    icon: UserMinus,
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    endpoint: "/admin/campaigns/quick/welcome-back",
    params: { inactive_days: 30, credits_amount: 50 }
  },
  {
    id: "new_user_bonus",
    name: "新手加碼活動",
    description: "對新註冊用戶發放額外點數作為歡迎禮",
    icon: UserPlus,
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    endpoint: "/admin/campaigns/quick/new-user-bonus",
    params: { days: 7, credits_amount: 100 }
  },
  {
    id: "vip_reward",
    name: "VIP 回饋活動",
    description: "對付費用戶發放感謝點數作為回饋",
    icon: Crown,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    endpoint: "/admin/campaigns/quick/vip-reward",
    params: { min_paid_credits: 1000, credits_amount: 200 }
  },
];

// ============================================================
// Main Component
// ============================================================

export default function CampaignsPage() {
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [history, setHistory] = useState<CampaignHistory[]>([]);
  const [targetUsers, setTargetUsers] = useState<TargetUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState<string | null>(null);
  
  // 自訂活動表單
  const [customForm, setCustomForm] = useState({
    target_type: "all",
    tier: "",
    inactive_days: 30,
    credits_amount: 50,
    expires_in_days: 30,
    campaign_name: "",
    notification_title: "",
    notification_message: "",
  });
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  // 載入數據
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, historyRes] = await Promise.all([
          api.get("/admin/campaigns/stats"),
          api.get("/admin/campaigns/history?limit=10"),
        ]);
        setStats(statsRes.data.stats);
        setHistory(historyRes.data.campaigns);
      } catch (error) {
        console.error("Failed to fetch data:", error);
        toast.error("載入數據失敗");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 查詢目標用戶
  const fetchTargetUsers = async () => {
    try {
      const params = new URLSearchParams({
        target_type: customForm.target_type,
        limit: "100",
      });
      if (customForm.tier) params.append("tier", customForm.tier);
      if (customForm.inactive_days) params.append("inactive_days", customForm.inactive_days.toString());
      
      const res = await api.get(`/admin/campaigns/target-users?${params}`);
      setTargetUsers(res.data.users);
      setSelectedUserIds(res.data.users.map((u: TargetUser) => u.id));
      toast.success(`找到 ${res.data.count} 位目標用戶`);
    } catch (error) {
      toast.error("查詢失敗");
    }
  };

  // 執行快速活動
  const executeQuickCampaign = async (campaign: typeof QUICK_CAMPAIGNS[0], dryRun: boolean) => {
    setExecuting(campaign.id);
    try {
      const params = new URLSearchParams({
        ...Object.fromEntries(
          Object.entries(campaign.params).map(([k, v]) => [k, String(v)])
        ),
        dry_run: String(dryRun),
      });
      
      const res = await api.post(`${campaign.endpoint}?${params}`);
      
      if (dryRun) {
        toast.info(
          `預覽：將發送給 ${res.data.target_count} 位用戶，` +
          `每人 ${res.data.credits_per_user} 點，共 ${res.data.total_credits} 點`
        );
      } else {
        toast.success(
          `活動執行成功！已發送給 ${res.data.success_count} 位用戶，` +
          `共 ${res.data.total_credits} 點`
        );
        // 重新載入統計
        const statsRes = await api.get("/admin/campaigns/stats");
        setStats(statsRes.data.stats);
        const historyRes = await api.get("/admin/campaigns/history?limit=10");
        setHistory(historyRes.data.campaigns);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "執行失敗");
    } finally {
      setExecuting(null);
    }
  };

  // 執行自訂活動
  const executeCustomCampaign = async (dryRun: boolean) => {
    if (!customForm.campaign_name) {
      toast.error("請輸入活動名稱");
      return;
    }
    if (selectedUserIds.length === 0) {
      toast.error("請先查詢並選擇目標用戶");
      return;
    }
    
    setExecuting("custom");
    try {
      if (dryRun) {
        toast.info(
          `預覽：將發送給 ${selectedUserIds.length} 位用戶，` +
          `每人 ${customForm.credits_amount} 點，共 ${customForm.credits_amount * selectedUserIds.length} 點`
        );
      } else {
        const res = await api.post("/admin/campaigns/bulk-credits", {
          user_ids: selectedUserIds,
          credits_amount: customForm.credits_amount,
          expires_in_days: customForm.expires_in_days,
          campaign_name: customForm.campaign_name,
          send_notification: true,
          notification_title: customForm.notification_title || `🎁 恭喜獲得 ${customForm.credits_amount} 點`,
          notification_message: customForm.notification_message || `您已獲得 ${customForm.credits_amount} 點優惠點數！`,
        });
        
        toast.success(
          `活動執行成功！成功: ${res.data.success_count}, 失敗: ${res.data.failed_count}`
        );
        
        // 重新載入
        const statsRes = await api.get("/admin/campaigns/stats");
        setStats(statsRes.data.stats);
        const historyRes = await api.get("/admin/campaigns/history?limit=10");
        setHistory(historyRes.data.campaigns);
        
        // 清空表單
        setTargetUsers([]);
        setSelectedUserIds([]);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "執行失敗");
    } finally {
      setExecuting(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Megaphone className="w-7 h-7 text-pink-400" />
              行銷活動管理
            </h1>
            <p className="text-slate-400 mt-1">
              建立促銷活動、發放優惠點數、管理行銷計畫
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-blue-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{stats?.total_users || 0}</p>
                  <p className="text-xs text-slate-400">總用戶數</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-green-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{stats?.active_users || 0}</p>
                  <p className="text-xs text-slate-400">活躍用戶</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <UserPlus className="w-8 h-8 text-cyan-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{stats?.new_users_7d || 0}</p>
                  <p className="text-xs text-slate-400">7日新用戶</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Crown className="w-8 h-8 text-amber-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{stats?.paid_users || 0}</p>
                  <p className="text-xs text-slate-400">付費用戶</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Coins className="w-8 h-8 text-purple-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{(stats?.promo_credits_this_month || 0).toLocaleString()}</p>
                  <p className="text-xs text-slate-400">本月發放點數</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Quick Campaigns */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  快速行銷活動
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {QUICK_CAMPAIGNS.map((campaign) => {
                  const Icon = campaign.icon;
                  return (
                    <div
                      key={campaign.id}
                      className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50"
                    >
                      <div className="flex items-start gap-4">
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", campaign.bgColor)}>
                          <Icon className={cn("w-6 h-6", campaign.color)} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium text-white">{campaign.name}</h3>
                          <p className="text-sm text-slate-400 mt-1">{campaign.description}</p>
                          <div className="flex items-center gap-2 mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-slate-700/50 border-slate-600"
                              onClick={() => executeQuickCampaign(campaign, true)}
                              disabled={executing === campaign.id}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              預覽
                            </Button>
                            <Button
                              size="sm"
                              className="bg-indigo-600 hover:bg-indigo-700"
                              onClick={() => executeQuickCampaign(campaign, false)}
                              disabled={executing === campaign.id}
                            >
                              {executing === campaign.id ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              ) : (
                                <Play className="w-4 h-4 mr-1" />
                              )}
                              執行
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Custom Campaign */}
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-cyan-400" />
                  自訂行銷活動
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-400">活動名稱</label>
                    <Input
                      value={customForm.campaign_name}
                      onChange={(e) => setCustomForm({ ...customForm, campaign_name: e.target.value })}
                      placeholder="例：新年送禮活動"
                      className="mt-1 bg-slate-800 border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">目標用戶</label>
                    <select
                      value={customForm.target_type}
                      onChange={(e) => setCustomForm({ ...customForm, target_type: e.target.value })}
                      className="mt-1 w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white"
                    >
                      <option value="all">全部用戶</option>
                      <option value="new_users">新用戶（7天內）</option>
                      <option value="inactive">不活躍用戶</option>
                      <option value="paid">付費用戶</option>
                      <option value="free">免費用戶</option>
                      <option value="tier">指定方案</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm text-slate-400">點數數量</label>
                    <Input
                      type="number"
                      value={customForm.credits_amount}
                      onChange={(e) => setCustomForm({ ...customForm, credits_amount: parseInt(e.target.value) || 0 })}
                      className="mt-1 bg-slate-800 border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">有效天數</label>
                    <Input
                      type="number"
                      value={customForm.expires_in_days}
                      onChange={(e) => setCustomForm({ ...customForm, expires_in_days: parseInt(e.target.value) || 30 })}
                      className="mt-1 bg-slate-800 border-slate-700"
                    />
                  </div>
                  {customForm.target_type === "inactive" && (
                    <div>
                      <label className="text-sm text-slate-400">不活躍天數</label>
                      <Input
                        type="number"
                        value={customForm.inactive_days}
                        onChange={(e) => setCustomForm({ ...customForm, inactive_days: parseInt(e.target.value) || 30 })}
                        className="mt-1 bg-slate-800 border-slate-700"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="bg-slate-700/50 border-slate-600"
                    onClick={fetchTargetUsers}
                  >
                    <Users className="w-4 h-4 mr-2" />
                    查詢目標用戶
                  </Button>
                  
                  {targetUsers.length > 0 && (
                    <Badge className="bg-indigo-500/20 text-indigo-300">
                      已選 {selectedUserIds.length} 位用戶
                    </Badge>
                  )}
                </div>

                {targetUsers.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-lg bg-slate-800/50 p-3">
                    <div className="text-xs text-slate-400 space-y-1">
                      {targetUsers.slice(0, 10).map((user) => (
                        <div key={user.id} className="flex items-center justify-between">
                          <span>{user.email}</span>
                          <span className="text-slate-500">{user.tier}</span>
                        </div>
                      ))}
                      {targetUsers.length > 10 && (
                        <div className="text-slate-500">... 還有 {targetUsers.length - 10} 位用戶</div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="bg-slate-700/50 border-slate-600"
                    onClick={() => executeCustomCampaign(true)}
                    disabled={executing === "custom"}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    預覽
                  </Button>
                  <Button
                    className="bg-indigo-600 hover:bg-indigo-700"
                    onClick={() => executeCustomCampaign(false)}
                    disabled={executing === "custom" || selectedUserIds.length === 0}
                  >
                    {executing === "custom" ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-1" />
                    )}
                    發送點數
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* History */}
          <div>
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-slate-400" />
                  活動歷史
                </CardTitle>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">暫無活動記錄</p>
                ) : (
                  <div className="space-y-3">
                    {history.map((item, index) => (
                      <div key={index} className="p-3 rounded-lg bg-slate-800/50">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-white text-sm">{item.name}</h4>
                            <p className="text-xs text-slate-400 mt-1">
                              {item.recipient_count} 人 · {item.total_credits.toLocaleString()} 點
                            </p>
                          </div>
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        </div>
                        {item.last_at && (
                          <p className="text-xs text-slate-500 mt-2">
                            {format(new Date(item.last_at), "yyyy/MM/dd HH:mm", { locale: zhTW })}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tier Stats */}
            {stats?.by_tier && (
              <Card className="bg-slate-900/50 border-slate-700/50 mt-6">
                <CardHeader>
                  <CardTitle className="text-white text-sm">用戶方案分布</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(stats.by_tier).map(([tier, count]) => (
                      <div key={tier} className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">{tier || "free"}</span>
                        <Badge variant="outline" className="border-slate-600">
                          {count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
