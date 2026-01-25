"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Settings, User, Link2, Unlink, Plus, Trash2, 
  CheckCircle2, XCircle, Loader2, ExternalLink, AlertCircle, RefreshCw,
  Building2, UserCircle, Palette, Target, MessageSquare, Sparkles, Save
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import api from "@/lib/api";

// 帳號類型
type AccountType = "personal" | "company";

// 個人資料類型
interface PersonalProfile {
  name: string;
  email: string;
  title: string;           // 職稱
  expertise: string;       // 專業領域
  personality: string;     // 個人特色/風格
  toneStyle: string;       // 語氣偏好
  bio: string;             // 個人簡介
}

// 公司/品牌資料類型
interface CompanyProfile {
  companyName: string;     // 公司名稱
  brandName: string;       // 品牌名稱
  email: string;
  phone: string;           // 聯絡電話
  mobile: string;          // 行動電話
  fax: string;             // 傳真
  address: string;         // 通訊地址
  city: string;            // 城市
  postalCode: string;      // 郵遞區號
  country: string;         // 國家/地區
  website: string;         // 官方網站
  industry: string;        // 產業類別
  brandPersonality: string; // 品牌調性
  targetAudience: string;  // 目標受眾
  coreValues: string;      // 核心價值
  brandColors: string;     // 品牌色彩
  slogan: string;          // 品牌標語
  description: string;     // 品牌描述
  socialLinks: {           // 社群連結
    facebook: string;
    instagram: string;
    linkedin: string;
    youtube: string;
    line: string;
  };
}

// 產業類別選項
const INDUSTRIES = [
  "科技/軟體", "電商/零售", "金融/保險", "教育/培訓", 
  "餐飲/食品", "美妝/時尚", "健康/醫療", "旅遊/觀光",
  "房地產", "製造業", "媒體/娛樂", "專業服務", "其他"
];

// 語氣風格選項
const TONE_STYLES = [
  { value: "professional", label: "專業正式", desc: "適合 B2B、專業服務" },
  { value: "friendly", label: "親切友善", desc: "適合大眾消費品牌" },
  { value: "playful", label: "活潑有趣", desc: "適合年輕族群" },
  { value: "luxury", label: "高端精緻", desc: "適合奢侈品牌" },
  { value: "inspiring", label: "激勵人心", desc: "適合教育/健身" },
  { value: "casual", label: "輕鬆隨性", desc: "適合生活風格" },
];

// 品牌調性選項
const BRAND_PERSONALITIES = [
  "專業可靠", "創新前衛", "溫暖親切", "年輕活力",
  "高端奢華", "簡約時尚", "自然環保", "幽默風趣"
];

// 預設色彩方案
const COLOR_PALETTES = [
  { name: "經典藍", colors: ["#1E3A8A", "#3B82F6", "#93C5FD"] },
  { name: "活力橙", colors: ["#EA580C", "#FB923C", "#FED7AA"] },
  { name: "優雅紫", colors: ["#7C3AED", "#A78BFA", "#DDD6FE"] },
  { name: "自然綠", colors: ["#166534", "#22C55E", "#BBF7D0"] },
  { name: "熱情紅", colors: ["#DC2626", "#F87171", "#FECACA"] },
  { name: "時尚粉", colors: ["#DB2777", "#F472B6", "#FBCFE8"] },
  { name: "科技青", colors: ["#0891B2", "#22D3EE", "#A5F3FC"] },
  { name: "奢華金", colors: ["#B45309", "#F59E0B", "#FDE68A"] },
  { name: "簡約灰", colors: ["#374151", "#6B7280", "#D1D5DB"] },
  { name: "清新薄荷", colors: ["#059669", "#34D399", "#A7F3D0"] },
];

// 單色選項
const SINGLE_COLORS = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308", "#84CC16", "#22C55E",
  "#10B981", "#14B8A6", "#06B6D4", "#0EA5E9", "#3B82F6", "#6366F1",
  "#8B5CF6", "#A855F7", "#D946EF", "#EC4899", "#F43F5E", "#78716C",
];

// 社群帳號類型
interface SocialAccount {
  id: number;
  platform: string;
  platform_username: string | null;
  platform_avatar: string | null;
  is_active: boolean;
  created_at: string;
  token_expires_at: string | null;
}

// 平台配置
const PLATFORMS: Record<string, { 
  name: string; 
  icon: string; 
  color: string; 
  gradient: string;
  description: string;
  hasCost?: boolean;
  costNote?: string;
}> = {
  instagram: { 
    name: "Instagram", 
    icon: "📸", 
    color: "text-pink-400",
    gradient: "from-purple-500 to-pink-500",
    description: "分享照片和短影音"
  },
  facebook: { 
    name: "Facebook", 
    icon: "📘", 
    color: "text-blue-400",
    gradient: "from-blue-600 to-blue-400",
    description: "連接朋友和社群"
  },
  tiktok: { 
    name: "TikTok", 
    icon: "🎵", 
    color: "text-slate-300",
    gradient: "from-slate-900 to-slate-700",
    description: "短影音創作平台"
  },
  threads: { 
    name: "Threads", 
    icon: "🧵", 
    color: "text-slate-300",
    gradient: "from-slate-800 to-slate-600",
    description: "文字為主的社群"
  },
  linkedin: { 
    name: "LinkedIn", 
    icon: "💼", 
    color: "text-blue-500",
    gradient: "from-blue-700 to-blue-500",
    description: "專業人脈網絡"
  },
  youtube: { 
    name: "YouTube", 
    icon: "📺", 
    color: "text-red-400",
    gradient: "from-red-600 to-red-400",
    description: "影片分享平台"
  },
  xiaohongshu: { 
    name: "小紅書", 
    icon: "📕", 
    color: "text-red-400",
    gradient: "from-red-500 to-rose-400",
    description: "生活方式分享社群"
  },
  line: { 
    name: "LINE", 
    icon: "💬", 
    color: "text-green-400",
    gradient: "from-green-500 to-emerald-400",
    description: "即時通訊與社群",
    hasCost: true,
    costNote: "溫馨提醒：發文會使用LINE用戶帳號免費發文500則的額度"
  },
};

// localStorage key
const PROFILE_STORAGE_KEY = "user-profile-settings";

function SettingsContent() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // 調色盤狀態
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pickerColor, setPickerColor] = useState({ h: 0, s: 100, l: 50 });
  const [hexInput, setHexInput] = useState("");
  
  // Email 編輯狀態
  const [userEmail, setUserEmail] = useState("");
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  
  // 用戶資訊
  const [userInfo, setUserInfo] = useState<{
    customer_id?: string;
    referral_code?: string;
    credits?: number;
    tier?: string;
  }>({});

  // 帳號類型狀態
  const [accountType, setAccountType] = useState<AccountType>("personal");
  
  // 個人資料狀態
  const [personalProfile, setPersonalProfile] = useState<PersonalProfile>({
    name: "",
    email: "",
    title: "",
    expertise: "",
    personality: "",
    toneStyle: "friendly",
    bio: "",
  });

  // 公司資料狀態
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>({
    companyName: "",
    brandName: "",
    email: "",
    phone: "",
    mobile: "",
    fax: "",
    address: "",
    city: "",
    postalCode: "",
    country: "台灣",
    website: "",
    industry: "",
    brandPersonality: "",
    targetAudience: "",
    coreValues: "",
    brandColors: "",
    slogan: "",
    description: "",
    socialLinks: {
      facebook: "",
      instagram: "",
      linkedin: "",
      youtube: "",
      line: "",
    },
  });

  // 載入用戶資訊
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const res = await api.get("/auth/me");
        if (res.data) {
          setUserEmail(res.data.email || "");
          setUserInfo({
            customer_id: res.data.customer_id,
            referral_code: res.data.referral_code,
            credits: res.data.credits,
            tier: res.data.tier,
          });
        }
      } catch (e) {
        console.error("載入用戶資料失敗:", e);
      }
    };
    fetchUserInfo();
  }, []);

  // 載入已儲存的資料
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        setAccountType(data.accountType || "personal");
        if (data.personalProfile) setPersonalProfile(data.personalProfile);
        if (data.companyProfile) setCompanyProfile(data.companyProfile);
      }
    } catch (e) {
      console.error("載入設定失敗:", e);
    }
  }, []);

  // 當 userEmail 載入後，自動填入 profile
  useEffect(() => {
    if (userEmail) {
      setPersonalProfile(prev => ({ ...prev, email: prev.email || userEmail }));
      setCompanyProfile(prev => ({ ...prev, email: prev.email || userEmail }));
    }
  }, [userEmail]);

  // 儲存資料
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const data = {
        accountType,
        personalProfile,
        companyProfile,
      };
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(data));
      toast.success("設定已儲存", {
        description: "您的資料將用於 AI 內容生成"
      });
    } catch (e) {
      toast.error("儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  // 處理 OAuth 回調結果
  useEffect(() => {
    const oauthResult = searchParams.get("oauth");
    const platform = searchParams.get("platform");
    const username = searchParams.get("username");
    const errorMessage = searchParams.get("message");

    if (oauthResult === "success" && platform) {
      toast.success(`${PLATFORMS[platform]?.name || platform} 連結成功！`, {
        description: username ? `已連結帳號 @${username}` : undefined
      });
      // 清除 URL 參數
      window.history.replaceState({}, "", "/dashboard/settings");
      // 重新載入帳號
      fetchAccounts();
    } else if (oauthResult === "error") {
      toast.error("連結失敗", {
        description: errorMessage || "請重試或聯繫客服"
      });
      window.history.replaceState({}, "", "/dashboard/settings");
    }
  }, [searchParams]);

  // 平台狀態（從後端獲取）
  const [platformStatus, setPlatformStatus] = useState<Record<string, string>>({});

  // 載入平台狀態
  const fetchPlatformStatus = useCallback(async () => {
    try {
      const res = await api.get("/scheduler/platforms");
      const statusMap: Record<string, string> = {};
      res.data?.platforms?.forEach((p: { id: string; status: string }) => {
        statusMap[p.id] = p.status;
      });
      setPlatformStatus(statusMap);
    } catch (error) {
      console.error("載入平台狀態失敗:", error);
    }
  }, []);

  // 載入已連結帳號
  const fetchAccounts = useCallback(async () => {
    try {
      const res = await api.get("/scheduler/accounts");
      setAccounts(res.data || []);
    } catch (error) {
      console.error("載入帳號失敗:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
    fetchPlatformStatus();
  }, [fetchAccounts, fetchPlatformStatus]);

  // 連結帳號 - 發起 OAuth 流程
  const handleConnect = async (platform: string) => {
    setConnecting(platform);
    
    try {
      // 調用後端獲取 OAuth 授權 URL
      const res = await api.get(`/oauth/connect/${platform}`);
      const { auth_url } = res.data;
      
      if (auth_url) {
        // 導向到平台授權頁面
        window.location.href = auth_url;
      } else {
        throw new Error("無法獲取授權連結");
      }
    } catch (error: any) {
      console.error("連結失敗:", error);
      
      // 檢查是否是尚未設定 API Key 的情況
      if (error.response?.status === 500) {
        toast.info(`${PLATFORMS[platform].name} 連結功能設定中`, {
          description: "請先在後端設定平台 API 金鑰"
        });
      } else {
        toast.error("連結失敗", {
          description: error.response?.data?.detail || "請稍後再試"
        });
      }
      
      setConnecting(null);
    }
  };

  // 斷開連結
  const handleDisconnect = async (accountId: number, platform: string) => {
    if (!confirm(`確定要斷開 ${PLATFORMS[platform]?.name || platform} 的連結嗎？`)) return;
    
    try {
      await api.delete(`/scheduler/accounts/${accountId}`);
      toast.success("帳號已斷開連結");
      fetchAccounts();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "斷開連結失敗");
    }
  };

  // 重新連結（用於 Token 過期）
  const handleReconnect = (platform: string) => {
    handleConnect(platform);
  };

  // 檢查 Token 是否即將過期
  const isTokenExpiringSoon = (account: SocialAccount) => {
    if (!account.token_expires_at) return false;
    const expiresAt = new Date(account.token_expires_at);
    const now = new Date();
    const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry < 7; // 7 天內過期
  };

  // 獲取已連結的平台
  const connectedPlatforms = accounts.map(a => a.platform);

  return (
    <div className="flex flex-col gap-6">
      {/* 頁面標題 */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700">
            <Settings className="w-6 h-6 text-white" />
          </div>
          帳號設定
        </h1>
        <p className="text-slate-400 mt-1">管理您的帳號資訊與社群平台連結</p>
      </div>
      
      {/* 客戶資訊卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 客戶編號 */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/20">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">客戶編號</p>
              <p className="text-lg font-mono font-semibold text-white">
                {userInfo.customer_id || "尚未分配"}
              </p>
            </div>
            {userInfo.customer_id && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(userInfo.customer_id || "");
                  toast.success("已複製客戶編號");
                }}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title="複製"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        {/* 推薦碼 */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-pink-500/20">
              <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">我的推薦碼</p>
              <p className="text-lg font-mono font-semibold text-white">
                {userInfo.referral_code || "—"}
              </p>
            </div>
            {userInfo.referral_code && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(userInfo.referral_code || "");
                  toast.success("已複製推薦碼，分享給朋友吧！");
                }}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title="複製"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        {/* 點數餘額 */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">點數餘額</p>
              <p className="text-lg font-semibold text-white">
                {userInfo.credits?.toLocaleString() || 0} <span className="text-sm text-slate-400">點</span>
              </p>
            </div>
            <Badge className={cn(
              "text-[10px]",
              userInfo.tier === "pro" 
                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0" 
                : "bg-slate-700 text-slate-300 border-slate-600"
            )}>
              {userInfo.tier === "pro" ? "Pro" : "Free"}
            </Badge>
          </div>
        </div>
      </div>
      
      <div className="grid gap-6">
        {/* 基本資訊 - 品牌 DNA */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="border-b border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  品牌 DNA 設定
                </CardTitle>
                <CardDescription className="text-slate-400 mt-1">
                  這些資料將作為 AI 生成內容的基礎參數
                </CardDescription>
              </div>
              <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/30">
                AI 參數
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* 類型切換 */}
            <div className="flex gap-2 p-1 bg-slate-800 rounded-xl">
              <button
                onClick={() => setAccountType("personal")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all",
                  accountType === "personal"
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <UserCircle className="w-5 h-5" />
                個人帳號
              </button>
              <button
                onClick={() => setAccountType("company")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all",
                  accountType === "company"
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <Building2 className="w-5 h-5" />
                公司/品牌
              </button>
            </div>

            {/* 個人帳號表單 */}
            {accountType === "personal" && (
              <div className="space-y-6">
                {/* 基本資訊 */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    基本資訊
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-400">姓名 *</Label>
                      <Input 
                        value={personalProfile.name}
                        onChange={(e) => setPersonalProfile({...personalProfile, name: e.target.value})}
                        placeholder="您的姓名"
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400 flex items-center justify-between">
                        <span>Email *</span>
                        {!isEditingEmail && personalProfile.email && (
                          <button
                            type="button"
                            onClick={() => setIsEditingEmail(true)}
                            className="text-[10px] text-pink-400 hover:text-pink-300 flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            修改
                          </button>
                        )}
                      </Label>
                      <div className="relative">
                        <Input 
                          type="email"
                          value={personalProfile.email}
                          onChange={(e) => setPersonalProfile({...personalProfile, email: e.target.value})}
                          placeholder="your@email.com"
                          disabled={!isEditingEmail && !!personalProfile.email}
                          className={cn(
                            "bg-slate-800 border-slate-600 text-white",
                            !isEditingEmail && personalProfile.email && "opacity-70 cursor-not-allowed"
                          )}
                        />
                        {isEditingEmail && (
                          <button
                            type="button"
                            onClick={() => setIsEditingEmail(false)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-green-400 hover:text-green-300"
                          >
                            確認
                          </button>
                        )}
                      </div>
                      {!isEditingEmail && personalProfile.email && (
                        <p className="text-[10px] text-slate-500">此為登入帳號 Email</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400">職稱</Label>
                      <Input 
                        value={personalProfile.title}
                        onChange={(e) => setPersonalProfile({...personalProfile, title: e.target.value})}
                        placeholder="例如：行銷總監、創業家、設計師"
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400">專業領域</Label>
                      <Input 
                        value={personalProfile.expertise}
                        onChange={(e) => setPersonalProfile({...personalProfile, expertise: e.target.value})}
                        placeholder="例如：數位行銷、品牌策略、科技趨勢"
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 風格設定 */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    內容風格
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-slate-400">個人特色/風格</Label>
                      <Input 
                        value={personalProfile.personality}
                        onChange={(e) => setPersonalProfile({...personalProfile, personality: e.target.value})}
                        placeholder="例如：幽默風趣、專業嚴謹、親切溫暖"
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400">語氣偏好</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {TONE_STYLES.map((tone) => (
                          <button
                            key={tone.value}
                            onClick={() => setPersonalProfile({...personalProfile, toneStyle: tone.value})}
                            className={cn(
                              "p-3 rounded-lg border text-left transition-all",
                              personalProfile.toneStyle === tone.value
                                ? "border-indigo-500 bg-indigo-500/10 text-white"
                                : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
                            )}
                          >
                            <p className="text-sm font-medium">{tone.label}</p>
                            <p className="text-xs text-slate-500">{tone.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400">個人簡介</Label>
                      <Textarea 
                        value={personalProfile.bio}
                        onChange={(e) => setPersonalProfile({...personalProfile, bio: e.target.value})}
                        placeholder="簡短介紹自己，AI 會根據這段描述生成符合您風格的內容..."
                        className="bg-slate-800 border-slate-600 text-white min-h-[100px]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 公司/品牌表單 */}
            {accountType === "company" && (
              <div className="space-y-6">
                {/* 公司基本資訊 */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    公司資訊
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-400">公司名稱 *</Label>
                      <Input 
                        value={companyProfile.companyName}
                        onChange={(e) => setCompanyProfile({...companyProfile, companyName: e.target.value})}
                        placeholder="正式公司名稱"
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400">品牌名稱 *</Label>
                      <Input 
                        value={companyProfile.brandName}
                        onChange={(e) => setCompanyProfile({...companyProfile, brandName: e.target.value})}
                        placeholder="對外品牌名稱"
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400 flex items-center justify-between">
                        <span>Email *</span>
                        {!isEditingEmail && companyProfile.email && (
                          <button
                            type="button"
                            onClick={() => setIsEditingEmail(true)}
                            className="text-[10px] text-pink-400 hover:text-pink-300 flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            修改
                          </button>
                        )}
                      </Label>
                      <div className="relative">
                        <Input 
                          type="email"
                          value={companyProfile.email}
                          onChange={(e) => setCompanyProfile({...companyProfile, email: e.target.value})}
                          placeholder="company@example.com"
                          disabled={!isEditingEmail && !!companyProfile.email}
                          className={cn(
                            "bg-slate-800 border-slate-600 text-white",
                            !isEditingEmail && companyProfile.email && "opacity-70 cursor-not-allowed"
                          )}
                        />
                        {isEditingEmail && (
                          <button
                            type="button"
                            onClick={() => setIsEditingEmail(false)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-green-400 hover:text-green-300"
                          >
                            確認
                          </button>
                        )}
                      </div>
                      {!isEditingEmail && companyProfile.email && (
                        <p className="text-[10px] text-slate-500">此為登入帳號 Email</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400">產業類別</Label>
                      <Select 
                        value={companyProfile.industry} 
                        onValueChange={(v) => setCompanyProfile({...companyProfile, industry: v})}
                      >
                        <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                          <SelectValue placeholder="選擇產業" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-600">
                          {INDUSTRIES.map((ind) => (
                            <SelectItem key={ind} value={ind} className="text-white">
                              {ind}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400">官方網站</Label>
                      <Input 
                        value={companyProfile.website}
                        onChange={(e) => setCompanyProfile({...companyProfile, website: e.target.value})}
                        placeholder="https://www.example.com"
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 聯絡資訊 */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    聯絡資訊（選填）
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-400">聯絡電話</Label>
                      <Input 
                        value={companyProfile.phone}
                        onChange={(e) => setCompanyProfile({...companyProfile, phone: e.target.value})}
                        placeholder="02-1234-5678"
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400">行動電話</Label>
                      <Input 
                        value={companyProfile.mobile}
                        onChange={(e) => setCompanyProfile({...companyProfile, mobile: e.target.value})}
                        placeholder="0912-345-678"
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400">傳真</Label>
                      <Input 
                        value={companyProfile.fax}
                        onChange={(e) => setCompanyProfile({...companyProfile, fax: e.target.value})}
                        placeholder="02-1234-5679"
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 通訊地址 */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    通訊地址（選填）
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-400">國家/地區</Label>
                      <Select 
                        value={companyProfile.country} 
                        onValueChange={(v) => setCompanyProfile({...companyProfile, country: v})}
                      >
                        <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                          <SelectValue placeholder="選擇國家" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-600">
                          {["台灣", "香港", "中國", "日本", "新加坡", "馬來西亞", "美國", "其他"].map((c) => (
                            <SelectItem key={c} value={c} className="text-white">
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400">城市</Label>
                      <Input 
                        value={companyProfile.city}
                        onChange={(e) => setCompanyProfile({...companyProfile, city: e.target.value})}
                        placeholder="台北市"
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400">郵遞區號</Label>
                      <Input 
                        value={companyProfile.postalCode}
                        onChange={(e) => setCompanyProfile({...companyProfile, postalCode: e.target.value})}
                        placeholder="100"
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-400">詳細地址</Label>
                    <Input 
                      value={companyProfile.address}
                      onChange={(e) => setCompanyProfile({...companyProfile, address: e.target.value})}
                      placeholder="中正區重慶南路一段 122 號"
                      className="bg-slate-800 border-slate-600 text-white"
                    />
                  </div>
                </div>

                {/* 社群連結 */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Link2 className="w-4 h-4" />
                    社群連結（選填）
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-400 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                        Facebook
                      </Label>
                      <Input 
                        value={companyProfile.socialLinks.facebook}
                        onChange={(e) => setCompanyProfile({...companyProfile, socialLinks: {...companyProfile.socialLinks, facebook: e.target.value}})}
                        placeholder="https://facebook.com/yourpage"
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                        Instagram
                      </Label>
                      <Input 
                        value={companyProfile.socialLinks.instagram}
                        onChange={(e) => setCompanyProfile({...companyProfile, socialLinks: {...companyProfile.socialLinks, instagram: e.target.value}})}
                        placeholder="https://instagram.com/yourpage"
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                        LinkedIn
                      </Label>
                      <Input 
                        value={companyProfile.socialLinks.linkedin}
                        onChange={(e) => setCompanyProfile({...companyProfile, socialLinks: {...companyProfile.socialLinks, linkedin: e.target.value}})}
                        placeholder="https://linkedin.com/company/yourpage"
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                        YouTube
                      </Label>
                      <Input 
                        value={companyProfile.socialLinks.youtube}
                        onChange={(e) => setCompanyProfile({...companyProfile, socialLinks: {...companyProfile.socialLinks, youtube: e.target.value}})}
                        placeholder="https://youtube.com/@yourchannel"
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-slate-400 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.193 0-.378-.09-.503-.234l-1.914-2.244v1.852c0 .345-.285.63-.63.63-.348 0-.63-.285-.63-.63V8.108c0-.27.174-.51.432-.596.063-.021.132-.031.199-.031.193 0 .378.09.503.234l1.914 2.244V8.108c0-.345.285-.63.63-.63.346 0 .63.285.63.63v4.771zm-5.741 0c0 .345-.285.63-.63.63-.348 0-.63-.285-.63-.63V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-2.466.63H4.917c-.345 0-.63-.285-.63-.63V8.108c0-.345.285-.63.63-.63.346 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
                        LINE 官方帳號
                      </Label>
                      <Input 
                        value={companyProfile.socialLinks.line}
                        onChange={(e) => setCompanyProfile({...companyProfile, socialLinks: {...companyProfile.socialLinks, line: e.target.value}})}
                        placeholder="@yourlineaccount"
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 品牌識別 */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    品牌識別
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-slate-400">品牌調性</Label>
                      <div className="flex flex-wrap gap-2">
                        {BRAND_PERSONALITIES.map((personality) => (
                          <button
                            key={personality}
                            onClick={() => {
                              const current = companyProfile.brandPersonality.split(",").map(s => s.trim()).filter(Boolean);
                              const updated = current.includes(personality)
                                ? current.filter(p => p !== personality)
                                : [...current, personality];
                              setCompanyProfile({...companyProfile, brandPersonality: updated.join(", ")});
                            }}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-sm border transition-all",
                              companyProfile.brandPersonality.includes(personality)
                                ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                                : "border-slate-700 text-slate-400 hover:border-slate-600"
                            )}
                          >
                            {personality}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* 品牌色彩調色盤 */}
                    <div className="space-y-4">
                      <Label className="text-slate-400 flex items-center gap-2">
                        <Palette className="w-4 h-4" />
                        品牌色彩
                      </Label>
                      
                      {/* 已選擇的顏色預覽 */}
                      {companyProfile.brandColors && (
                        <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-lg">
                          <span className="text-xs text-slate-400">已選擇：</span>
                          <div className="flex gap-1 flex-wrap">
                            {companyProfile.brandColors.split(',').map((color, idx) => (
                              <div
                                key={idx}
                                className="w-6 h-6 rounded-md border border-white/20 shadow-sm cursor-pointer hover:scale-110 transition-transform"
                                style={{ backgroundColor: color.trim() }}
                                onClick={() => {
                                  const colors = companyProfile.brandColors.split(',').filter((_, i) => i !== idx);
                                  setCompanyProfile({...companyProfile, brandColors: colors.join(',')});
                                }}
                                title={`${color.trim()} - 點擊移除`}
                              />
                            ))}
                          </div>
                          <button
                            onClick={() => setCompanyProfile({...companyProfile, brandColors: ''})}
                            className="ml-auto text-xs text-slate-500 hover:text-red-400"
                          >
                            清除全部
                          </button>
                        </div>
                      )}
                      
                      {/* 預設色彩方案 */}
                      <div className="space-y-2">
                        <span className="text-xs text-slate-500">快速套用配色方案</span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                          {COLOR_PALETTES.map((palette) => (
                            <button
                              key={palette.name}
                              onClick={() => setCompanyProfile({...companyProfile, brandColors: palette.colors.join(',')})}
                              className="group p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-slate-500 transition-all"
                            >
                              <div className="flex gap-0.5 mb-1">
                                {palette.colors.map((color, i) => (
                                  <div
                                    key={i}
                                    className="flex-1 h-5 first:rounded-l last:rounded-r"
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </div>
                              <span className="text-[10px] text-slate-400 group-hover:text-white">{palette.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* 單色選擇器 */}
                      <div className="space-y-2">
                        <span className="text-xs text-slate-500">或選擇單一顏色添加</span>
                        <div className="flex flex-wrap gap-1.5">
                          {SINGLE_COLORS.map((color) => (
                            <button
                              key={color}
                              onClick={() => {
                                const current = companyProfile.brandColors ? companyProfile.brandColors.split(',') : [];
                                if (!current.includes(color)) {
                                  setCompanyProfile({...companyProfile, brandColors: [...current, color].join(',')});
                                }
                              }}
                              className={`w-7 h-7 rounded-lg border-2 hover:scale-110 transition-all shadow-sm ${
                                companyProfile.brandColors?.includes(color) 
                                  ? 'border-white ring-2 ring-white/30' 
                                  : 'border-transparent hover:border-white/50'
                              }`}
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                      </div>
                      
                      {/* 自訂顏色輸入 */}
                      <div className="p-4 bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl border border-slate-700/50 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-300">自訂品牌色彩</span>
                          <div className="flex items-center gap-1 text-[10px] text-slate-500">
                            <Sparkles className="w-3 h-3" />
                            支援 HEX 色碼
                          </div>
                        </div>
                        
                        <div className="flex gap-3">
                          {/* 調色盤按鈕 */}
                          <div className="relative">
                            <button
                              onClick={() => setShowColorPicker(!showColorPicker)}
                              className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-500 via-green-500 to-blue-500 p-0.5 cursor-pointer hover:scale-105 transition-all shadow-lg hover:shadow-xl hover:shadow-pink-500/20"
                            >
                              <div className="w-full h-full rounded-[10px] bg-slate-900 flex items-center justify-center">
                                <div className="text-center">
                                  <Palette className="w-5 h-5 text-white mx-auto mb-0.5" />
                                  <span className="text-[8px] text-slate-400">調色盤</span>
                                </div>
                              </div>
                            </button>
                            
                            {/* 自訂調色盤彈窗 */}
                            {showColorPicker && (
                              <div className="absolute left-0 top-16 z-50 w-72 p-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 animate-in fade-in zoom-in-95 duration-200">
                                {/* 標題和關閉 */}
                                <div className="flex items-center justify-between mb-4">
                                  <span className="text-sm font-medium text-white">選擇顏色</span>
                                  <button 
                                    onClick={() => setShowColorPicker(false)}
                                    className="text-slate-400 hover:text-white"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </div>
                                
                                {/* 色相滑桿 */}
                                <div className="space-y-3 mb-4">
                                  <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px]">
                                      <span className="text-slate-400">色相 (H)</span>
                                      <span className="text-slate-500">{pickerColor.h}°</span>
                                    </div>
                                    <input
                                      type="range"
                                      min="0"
                                      max="360"
                                      value={pickerColor.h}
                                      onChange={(e) => setPickerColor({...pickerColor, h: parseInt(e.target.value)})}
                                      className="w-full h-3 rounded-full color-slider"
                                      style={{
                                        background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
                                      }}
                                    />
                                  </div>
                                  
                                  <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px]">
                                      <span className="text-slate-400">飽和度 (S)</span>
                                      <span className="text-slate-500">{pickerColor.s}%</span>
                                    </div>
                                    <input
                                      type="range"
                                      min="0"
                                      max="100"
                                      value={pickerColor.s}
                                      onChange={(e) => setPickerColor({...pickerColor, s: parseInt(e.target.value)})}
                                      className="w-full h-3 rounded-full color-slider"
                                      style={{
                                        background: `linear-gradient(to right, hsl(${pickerColor.h}, 0%, ${pickerColor.l}%), hsl(${pickerColor.h}, 100%, ${pickerColor.l}%))`
                                      }}
                                    />
                                  </div>
                                  
                                  <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px]">
                                      <span className="text-slate-400">亮度 (L)</span>
                                      <span className="text-slate-500">{pickerColor.l}%</span>
                                    </div>
                                    <input
                                      type="range"
                                      min="0"
                                      max="100"
                                      value={pickerColor.l}
                                      onChange={(e) => setPickerColor({...pickerColor, l: parseInt(e.target.value)})}
                                      className="w-full h-3 rounded-full color-slider"
                                      style={{
                                        background: `linear-gradient(to right, hsl(${pickerColor.h}, ${pickerColor.s}%, 0%), hsl(${pickerColor.h}, ${pickerColor.s}%, 50%), hsl(${pickerColor.h}, ${pickerColor.s}%, 100%))`
                                      }}
                                    />
                                  </div>
                                </div>
                                
                                {/* 顏色預覽 */}
                                <div className="flex gap-3 mb-4">
                                  <div 
                                    className="w-16 h-16 rounded-xl border-2 border-white/20 shadow-lg"
                                    style={{ backgroundColor: `hsl(${pickerColor.h}, ${pickerColor.s}%, ${pickerColor.l}%)` }}
                                  />
                                  <div className="flex-1 space-y-2">
                                    <div className="text-[10px] text-slate-400">HEX 色碼</div>
                                    <div className="flex gap-1">
                                      <Input
                                        value={hexInput || (() => {
                                          // HSL to HEX
                                          const h = pickerColor.h / 360;
                                          const s = pickerColor.s / 100;
                                          const l = pickerColor.l / 100;
                                          const hue2rgb = (p: number, q: number, t: number) => {
                                            if (t < 0) t += 1;
                                            if (t > 1) t -= 1;
                                            if (t < 1/6) return p + (q - p) * 6 * t;
                                            if (t < 1/2) return q;
                                            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                                            return p;
                                          };
                                          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                                          const p = 2 * l - q;
                                          const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
                                          const g = Math.round(hue2rgb(p, q, h) * 255);
                                          const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
                                          return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`.toUpperCase();
                                        })()}
                                        onChange={(e) => setHexInput(e.target.value.toUpperCase())}
                                        className="bg-slate-800 border-slate-600 text-white font-mono text-xs h-8"
                                        placeholder="#FF6B6B"
                                      />
                                    </div>
                                  </div>
                                </div>
                                
                                {/* 快速顏色 */}
                                <div className="mb-4">
                                  <div className="text-[10px] text-slate-400 mb-2">快速選擇</div>
                                  <div className="grid grid-cols-9 gap-1">
                                    {['#EF4444','#F97316','#EAB308','#22C55E','#14B8A6','#3B82F6','#8B5CF6','#EC4899','#6B7280',
                                      '#FCA5A5','#FDBA74','#FDE047','#86EFAC','#5EEAD4','#93C5FD','#C4B5FD','#F9A8D4','#D1D5DB'].map((color) => (
                                      <button
                                        key={color}
                                        onClick={() => {
                                          setHexInput(color);
                                          // HEX to HSL for preview
                                          const r = parseInt(color.slice(1,3), 16) / 255;
                                          const g = parseInt(color.slice(3,5), 16) / 255;
                                          const b = parseInt(color.slice(5,7), 16) / 255;
                                          const max = Math.max(r, g, b), min = Math.min(r, g, b);
                                          let h = 0, s = 0;
                                          const l = (max + min) / 2;
                                          if (max !== min) {
                                            const d = max - min;
                                            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                                            switch (max) {
                                              case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                                              case g: h = ((b - r) / d + 2) / 6; break;
                                              case b: h = ((r - g) / d + 4) / 6; break;
                                            }
                                          }
                                          setPickerColor({ h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) });
                                        }}
                                        className="w-6 h-6 rounded-md hover:scale-110 transition-transform border border-white/10"
                                        style={{ backgroundColor: color }}
                                      />
                                    ))}
                                  </div>
                                </div>
                                
                                {/* 確認按鈕 */}
                                <Button
                                  onClick={() => {
                                    let colorToAdd = hexInput;
                                    if (!colorToAdd) {
                                      // 從 HSL 計算 HEX
                                      const h = pickerColor.h / 360;
                                      const s = pickerColor.s / 100;
                                      const l = pickerColor.l / 100;
                                      const hue2rgb = (p: number, q: number, t: number) => {
                                        if (t < 0) t += 1;
                                        if (t > 1) t -= 1;
                                        if (t < 1/6) return p + (q - p) * 6 * t;
                                        if (t < 1/2) return q;
                                        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                                        return p;
                                      };
                                      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                                      const p = 2 * l - q;
                                      const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
                                      const g = Math.round(hue2rgb(p, q, h) * 255);
                                      const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
                                      colorToAdd = `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`.toUpperCase();
                                    }
                                    if (/^#[0-9A-F]{6}$/i.test(colorToAdd)) {
                                      const current = companyProfile.brandColors ? companyProfile.brandColors.split(',') : [];
                                      if (!current.includes(colorToAdd.toUpperCase())) {
                                        setCompanyProfile({...companyProfile, brandColors: [...current, colorToAdd.toUpperCase()].join(',')});
                                      }
                                      setShowColorPicker(false);
                                      setHexInput("");
                                      toast.success(`已添加顏色 ${colorToAdd}`);
                                    }
                                  }}
                                  className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
                                >
                                  <Plus className="w-4 h-4 mr-1" />
                                  添加此顏色
                                </Button>
                              </div>
                            )}
                          </div>
                          
                          {/* HEX 輸入框 */}
                          <div className="flex-1 space-y-2">
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">#</span>
                              <Input 
                                id="customColorInput"
                                placeholder="FF6B6B"
                                maxLength={6}
                                className="bg-slate-800/50 border-slate-600 text-white font-mono text-sm pl-7 uppercase tracking-wider"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    let input = e.currentTarget.value.trim().toUpperCase();
                                    if (!input.startsWith('#')) input = '#' + input;
                                    if (/^#[0-9A-F]{6}$/i.test(input)) {
                                      const current = companyProfile.brandColors ? companyProfile.brandColors.split(',') : [];
                                      if (!current.includes(input)) {
                                        setCompanyProfile({...companyProfile, brandColors: [...current, input].join(',')});
                                      }
                                      e.currentTarget.value = '';
                                    }
                                  }
                                }}
                              />
                            </div>
                            <p className="text-[10px] text-slate-500">輸入 6 位色碼後按 Enter 添加</p>
                          </div>
                        </div>
                        
                        {/* 快速複製提示 */}
                        {companyProfile.brandColors && (
                          <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                            <span className="text-[10px] text-slate-500">
                              已選 {companyProfile.brandColors.split(',').length} 個顏色
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(companyProfile.brandColors);
                                toast.success('已複製色碼到剪貼簿');
                              }}
                              className="text-[10px] text-pink-400 hover:text-pink-300 flex items-center gap-1"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              複製全部色碼
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* 品牌標語 */}
                    <div className="space-y-2">
                      <Label className="text-slate-400">品牌標語 Slogan</Label>
                      <Input 
                        value={companyProfile.slogan}
                        onChange={(e) => setCompanyProfile({...companyProfile, slogan: e.target.value})}
                        placeholder="例如：Just Do It"
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 目標與價值 */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    目標與價值
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-slate-400">目標受眾</Label>
                      <Textarea 
                        value={companyProfile.targetAudience}
                        onChange={(e) => setCompanyProfile({...companyProfile, targetAudience: e.target.value})}
                        placeholder="描述您的目標客群：年齡層、興趣、職業、痛點..."
                        className="bg-slate-800 border-slate-600 text-white min-h-[80px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400">核心價值</Label>
                      <Input 
                        value={companyProfile.coreValues}
                        onChange={(e) => setCompanyProfile({...companyProfile, coreValues: e.target.value})}
                        placeholder="例如：創新、品質、永續、客戶至上"
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400">品牌描述</Label>
                      <Textarea 
                        value={companyProfile.description}
                        onChange={(e) => setCompanyProfile({...companyProfile, description: e.target.value})}
                        placeholder="簡短描述您的品牌故事、使命願景，AI 會根據這段描述生成符合品牌調性的內容..."
                        className="bg-slate-800 border-slate-600 text-white min-h-[100px]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 儲存按鈕 */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-700">
              <p className="text-xs text-slate-500">
                💡 這些資料僅儲存在本地，用於優化 AI 生成內容
              </p>
              <Button 
                onClick={handleSaveProfile}
                disabled={saving}
                className="bg-gradient-to-r from-indigo-600 to-purple-600"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    儲存中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    儲存設定
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 社群帳號連結 */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="border-b border-slate-700">
            <CardTitle className="text-white flex items-center gap-2">
              <Link2 className="w-5 h-5 text-indigo-400" />
              社群帳號連結
            </CardTitle>
            <CardDescription className="text-slate-400">
              連結您的社群帳號以啟用自動排程發布功能
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {/* 已連結帳號 */}
            {accounts.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-slate-300 mb-3">已連結帳號</h3>
                <div className="space-y-3">
                  {accounts.map(account => {
                    const platform = PLATFORMS[account.platform];
                    const expiringSoon = isTokenExpiringSoon(account);
                    
                    return (
                      <div
                        key={account.id}
                        className={cn(
                          "flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border",
                          expiringSoon ? "border-yellow-500/50" : "border-slate-700"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-gradient-to-br",
                            platform?.gradient || "from-slate-600 to-slate-700"
                          )}>
                            {platform?.icon || "📱"}
                          </div>
                          <div>
                            <p className="text-white font-medium">{platform?.name || account.platform}</p>
                            <p className="text-sm text-slate-400">
                              {account.platform_username ? `@${account.platform_username}` : "已連結"}
                            </p>
                            {expiringSoon && (
                              <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                授權即將過期，請重新連結
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={account.is_active 
                            ? "bg-green-500/20 text-green-400 border-green-500/30" 
                            : "bg-red-500/20 text-red-400 border-red-500/30"
                          }>
                            {account.is_active ? (
                              <><CheckCircle2 className="w-3 h-3 mr-1" /> 已啟用</>
                            ) : (
                              <><XCircle className="w-3 h-3 mr-1" /> 已停用</>
                            )}
                          </Badge>
                          {expiringSoon && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReconnect(account.platform)}
                              className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
                              title="重新連結"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDisconnect(account.id, account.platform)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            title="斷開連結"
                          >
                            <Unlink className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 可連結平台 */}
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-3">
                {accounts.length > 0 ? "新增連結" : "選擇要連結的平台"}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(PLATFORMS).map(([id, platform]) => {
                  const isConnected = connectedPlatforms.includes(id);
                  const isConnecting = connecting === id;
                  const status = platformStatus[id] || "active"; // 預設為 active，讓用戶可以嘗試連結
                  const isReady = status === "active" || status === "needs_setup"; // needs_setup 也可以點擊
                  const needsSetup = status === "needs_setup";
                  const isComingSoon = status === "coming_soon";
                  
                  return (
                    <button
                      key={id}
                      onClick={() => !isConnected && !isComingSoon && handleConnect(id)}
                      disabled={isConnected || isConnecting || isComingSoon}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-xl border transition-all text-left relative",
                        isConnected
                          ? "bg-slate-800/30 border-slate-700 opacity-50 cursor-not-allowed"
                          : isComingSoon
                            ? "bg-slate-800/30 border-slate-700/50 opacity-60 cursor-not-allowed"
                            : "bg-slate-800/50 border-slate-700 hover:border-indigo-500/50 hover:bg-slate-800 cursor-pointer"
                      )}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-gradient-to-br",
                        platform.gradient,
                        isComingSoon && "opacity-50"
                      )}>
                        {platform.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium">{platform.name}</p>
                          {isComingSoon && (
                            <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 text-[10px]">
                              即將推出
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{platform.description}</p>
                        {platform.hasCost && platform.costNote && (
                          <p className="text-xs text-blue-400 mt-1">ℹ️ {platform.costNote}</p>
                        )}
                      </div>
                      {isConnecting ? (
                        <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                      ) : isConnected ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      ) : isComingSoon ? (
                        <AlertCircle className="w-5 h-5 text-slate-500" />
                      ) : (
                        <Plus className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 提示訊息 */}
            <div className="mt-6 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-indigo-400 mt-0.5" />
                <div>
                  <p className="text-sm text-indigo-300 font-medium">如何連結社群帳號</p>
                  <p className="text-xs text-indigo-400/80 mt-1">
                    點擊上方任一平台即可開始 OAuth 授權流程。連結成功後，您可以使用排程上架引擎
                    自動發布內容到該平台。
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    💡 提示：部分平台需要先在後端設定 API 金鑰（Client ID / Secret）才能使用連結功能。
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 偏好設定 */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="border-b border-slate-700">
            <CardTitle className="text-white">偏好設定</CardTitle>
            <CardDescription className="text-slate-400">個人化您的使用體驗</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">
              偏好設定功能開發中...
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// 載入中的 fallback 組件
function SettingsLoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <p className="text-slate-400">載入設定中...</p>
      </div>
    </div>
  );
}

// 主頁面組件：包裝 Suspense
export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsLoadingFallback />}>
      <SettingsContent />
    </Suspense>
  );
}
