"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  User, Mail, Calendar, Crown, Shield, Star, 
  Coins, Gift, TrendingUp, Award, Clock, 
  CheckCircle, AlertCircle, CreditCard, Zap,
  Medal, Edit3, Camera, BadgeCheck, Phone,
  Smartphone, Key, FileText, Upload, X, Loader2,
  ArrowRight, Sparkles, Lock, Unlock, ExternalLink,
  Copy, Check, ChevronRight, Wallet, Settings,
  Bell, History, LogOut, HelpCircle, ChevronDown,
  Package, Timer, RefreshCw, PenTool, Video, Image
} from "lucide-react";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { toast } from "sonner";
import api from "@/lib/api";

// ============================================================
// Types
// ============================================================

interface UserProfile {
  id: number;
  email: string;
  full_name: string | null;
  avatar: string | null;
  tier: string;
  subscription_plan: string;
  partner_tier: string;
  credits: number;
  credits_promo: number;
  credits_sub: number;
  credits_paid: number;
  credits_bonus: number;
  referral_code: string | null;
  total_referrals: number;
  total_referral_revenue: number;
  created_at: string;
  subscription_expires_at: string | null;
}

interface VerificationStatus {
  phone: {
    is_verified: boolean;
    phone_number: string | null;
    verified_at: string | null;
  };
  identity: {
    status: string;
    is_verified: boolean;
    real_name: string | null;
    submitted_at: string | null;
    rejection_reason: string | null;
  };
  two_factor: {
    is_enabled: boolean;
    is_totp_enabled: boolean;
    enabled_at: string | null;
  };
}

// ============================================================
// Tier Configurations
// ============================================================

const TIER_CONFIG: Record<string, { 
  icon: typeof Crown; 
  gradient: string; 
  label: string; 
  labelEn: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
}> = {
  free: { 
    icon: User, 
    gradient: "from-slate-500 to-slate-600", 
    label: "免費版", 
    labelEn: "Free",
    textColor: "text-slate-300",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/30"
  },
  basic: { 
    icon: Star, 
    gradient: "from-blue-500 to-cyan-500", 
    label: "入門版", 
    labelEn: "Basic",
    textColor: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30"
  },
  pro: { 
    icon: Crown, 
    gradient: "from-purple-500 to-pink-500", 
    label: "專業版", 
    labelEn: "Pro",
    textColor: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30"
  },
  enterprise: { 
    icon: Shield, 
    gradient: "from-amber-500 to-orange-500", 
    label: "企業版", 
    labelEn: "Enterprise",
    textColor: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30"
  },
  admin: { 
    icon: BadgeCheck, 
    gradient: "from-red-500 to-rose-500", 
    label: "管理員", 
    labelEn: "Admin",
    textColor: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30"
  },
};

const PARTNER_CONFIG: Record<string, { 
  icon: typeof Medal; 
  color: string; 
  bg: string; 
  label: string;
  rate: string;
}> = {
  bronze: { icon: Medal, color: "text-amber-600", bg: "bg-gradient-to-r from-amber-900/30 to-orange-900/30", label: "銅牌夥伴", rate: "10%" },
  silver: { icon: Star, color: "text-slate-300", bg: "bg-gradient-to-r from-slate-700/50 to-slate-600/50", label: "銀牌夥伴", rate: "15%" },
  gold: { icon: Crown, color: "text-yellow-400", bg: "bg-gradient-to-r from-yellow-900/30 to-amber-900/30", label: "金牌夥伴", rate: "20%" },
};

const SUBSCRIPTION_CONFIG: Record<string, { 
  name: string;
  price: string;
  priceYearly?: string;
  monthlyCredits: number;
  features: string[];
  color: string;
}> = {
  free: { name: "免費方案", price: "免費", monthlyCredits: 0, features: ["基本功能", "一次性 200 點"], color: "slate" },
  basic: { name: "入門方案", price: "NT$299/月", priceYearly: "2,870", monthlyCredits: 0, features: ["基本功能", "無廣告"], color: "blue" },
  pro: { name: "標準方案", price: "NT$699/月", priceYearly: "6,710", monthlyCredits: 1000, features: ["進階功能", "每月 1000 點", "優先支援"], color: "purple" },
  enterprise: { name: "企業方案", price: "NT$3699/月", priceYearly: "35,510", monthlyCredits: 5000, features: ["完整功能", "每月 5000 點", "專屬客服", "API 存取"], color: "amber" },
  admin: { name: "管理員", price: "無限制", monthlyCredits: 99999, features: ["完整功能", "系統管理", "無限點數"], color: "red" },
};

// ============================================================
// Components
// ============================================================

function AnimatedNumber({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  return (
    <span className="tabular-nums">
      {prefix}{value.toLocaleString()}{suffix}
    </span>
  );
}

function GlowCard({ children, className = "", glowColor = "indigo" }: { children: React.ReactNode; className?: string; glowColor?: string }) {
  const glowGradients: Record<string, string> = {
    indigo: "from-indigo-500 to-purple-500",
    amber: "from-amber-500 to-orange-500",
    green: "from-green-500 to-emerald-500",
    purple: "from-purple-500 to-pink-500",
    blue: "from-blue-500 to-cyan-500",
    red: "from-red-500 to-rose-500",
  };
  const gradient = glowGradients[glowColor] || glowGradients.indigo;
  
  return (
    <div className={`relative group ${className}`}>
      <div className={`absolute -inset-0.5 bg-gradient-to-r ${gradient} rounded-2xl blur opacity-0 group-hover:opacity-20 transition duration-500`}></div>
      <div className="relative bg-slate-800/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function SecurityCard({ 
  icon: Icon, 
  title, 
  subtitle,
  verified, 
  verifiedText,
  pendingText,
  unverifiedText,
  status,
  rejectionReason,
  onAction,
  actionText,
  accentColor = "green"
}: { 
  icon: typeof Smartphone;
  title: string;
  subtitle: string;
  verified: boolean;
  verifiedText?: string;
  pendingText?: string;
  unverifiedText?: string;
  status?: string;
  rejectionReason?: string | null;
  onAction?: () => void;
  actionText?: string;
  accentColor?: string;
}) {
  const isPending = status === "pending";
  const isRejected = status === "rejected";
  const isSupplementRequired = status === "supplement_required";
  
  // 靜態類名映射避免 Tailwind 動態問題
  const colorStyles: Record<string, { 
    cardBg: string; cardBorder: string; cardHover: string;
    indicator: string; iconBg: string; iconText: string; 
    verifiedText: string; btnGradient: string; btnShadow: string;
  }> = {
    green: {
      cardBg: "bg-green-500/5", cardBorder: "border-green-500/20", cardHover: "hover:border-green-500/40",
      indicator: "bg-green-400", iconBg: "bg-green-500/10", iconText: "text-green-400",
      verifiedText: "text-green-400", 
      btnGradient: "from-green-600 to-green-500 hover:from-green-500 hover:to-green-400",
      btnShadow: "shadow-green-500/20"
    },
    blue: {
      cardBg: "bg-blue-500/5", cardBorder: "border-blue-500/20", cardHover: "hover:border-blue-500/40",
      indicator: "bg-blue-400", iconBg: "bg-blue-500/10", iconText: "text-blue-400",
      verifiedText: "text-blue-400", 
      btnGradient: "from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400",
      btnShadow: "shadow-blue-500/20"
    },
    purple: {
      cardBg: "bg-purple-500/5", cardBorder: "border-purple-500/20", cardHover: "hover:border-purple-500/40",
      indicator: "bg-purple-400", iconBg: "bg-purple-500/10", iconText: "text-purple-400",
      verifiedText: "text-purple-400", 
      btnGradient: "from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400",
      btnShadow: "shadow-purple-500/20"
    },
    indigo: {
      cardBg: "bg-indigo-500/5", cardBorder: "border-indigo-500/20", cardHover: "hover:border-indigo-500/40",
      indicator: "bg-indigo-400", iconBg: "bg-indigo-500/10", iconText: "text-indigo-400",
      verifiedText: "text-indigo-400", 
      btnGradient: "from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400",
      btnShadow: "shadow-indigo-500/20"
    },
  };
  const colors = colorStyles[accentColor] || colorStyles.green;
  
  return (
    <div className={`relative p-5 rounded-xl border transition-all duration-300 ${
      verified 
        ? `${colors.cardBg} ${colors.cardBorder} ${colors.cardHover}` 
        : isPending
        ? "bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40"
        : isSupplementRequired
        ? "bg-orange-500/5 border-orange-500/20 hover:border-orange-500/40"
        : "bg-slate-800/50 border-slate-700/50 hover:border-slate-600"
    }`}>
      {/* Status indicator */}
      <div className={`absolute top-4 right-4 w-2.5 h-2.5 rounded-full ${
        verified ? `${colors.indicator} animate-pulse` : 
        isPending ? "bg-amber-400 animate-pulse" : 
        isSupplementRequired ? "bg-orange-400 animate-pulse" :
        "bg-slate-600"
      }`}></div>
      
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
          verified ? colors.iconBg : 
          isPending ? "bg-amber-500/10" : 
          isSupplementRequired ? "bg-orange-500/10" :
          "bg-slate-700/50"
        }`}>
          <Icon className={`w-6 h-6 ${
            verified ? colors.iconText : 
            isPending ? "text-amber-400" : 
            isSupplementRequired ? "text-orange-400" :
            "text-slate-400"
          }`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-white mb-0.5">{title}</h4>
          <p className="text-sm text-slate-400 mb-3">{subtitle}</p>
          
          {verified ? (
            <div className={`inline-flex items-center gap-1.5 text-sm ${colors.verifiedText}`}>
              <CheckCircle className="w-4 h-4" />
              {verifiedText}
            </div>
          ) : isPending ? (
            <div className="inline-flex items-center gap-1.5 text-sm text-amber-400">
              <Clock className="w-4 h-4 animate-spin" style={{ animationDuration: '3s' }} />
              {pendingText}
            </div>
          ) : isSupplementRequired ? (
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 text-sm text-orange-400">
                <AlertCircle className="w-4 h-4" />
                需要補件
              </div>
              {rejectionReason && (
                <div className="p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg text-xs text-orange-300">
                  📋 補件說明：{rejectionReason}
                </div>
              )}
              <button
                onClick={onAction}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-orange-500/20"
              >
                重新上傳補件
              </button>
            </div>
          ) : isRejected ? (
            <div className="space-y-2">
              <div className="text-sm text-red-400">
                ✗ 審核未通過
              </div>
              {rejectionReason && (
                <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-300">
                  原因：{rejectionReason}
                </div>
              )}
              <button
                onClick={onAction}
                className={`w-full px-4 py-2.5 bg-gradient-to-r ${colors.btnGradient} text-white rounded-lg text-sm font-medium transition-all shadow-lg ${colors.btnShadow}`}
              >
                {actionText || "重新提交"}
              </button>
            </div>
          ) : (
            <button
              onClick={onAction}
              className={`w-full px-4 py-2.5 bg-gradient-to-r ${colors.btnGradient} text-white rounded-lg text-sm font-medium transition-all shadow-lg ${colors.btnShadow} flex items-center justify-center gap-2`}
            >
              {actionText || "立即認證"}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Modals (保持原有的 Modal 組件)
// ============================================================

function PhoneVerificationModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void; }) {
  const [step, setStep] = useState<"input" | "verify">("input");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [devCode, setDevCode] = useState("");

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const sendCode = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/verification/phone/send-code", { phone_number: phone });
      setStep("verify");
      setCountdown(60);
      if (res.data.dev_code) setDevCode(res.data.dev_code);
    } catch (err: any) { 
      const d = err.response?.data?.detail;
      const msg = typeof d === "string" ? d : Array.isArray(d) && d[0]?.msg ? d[0].msg : "";
      setError(msg || "發送失敗，請稍後再試"); 
    }
    finally { setLoading(false); }
  };

  const verifyCode = async () => {
    setLoading(true);
    setError("");
    try {
      await api.post("/verification/phone/verify", { code });
      onSuccess();
      onClose();
    } catch (err: any) { 
      setError(err.response?.data?.detail || "驗證失敗，請稍後再試"); 
    }
    finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl w-full max-w-md border border-slate-700/50 shadow-2xl">
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">手機認證</h3>
                <p className="text-sm text-slate-400">驗證您的手機號碼</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {step === "input" ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">手機號碼</label>
                <div className="flex gap-2">
                  <div className="px-4 py-3 bg-slate-700/30 rounded-xl text-slate-400 text-sm border border-slate-600/50">+886</div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    placeholder="0912345678"
                    className="flex-1 px-4 py-3 bg-slate-700/30 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all"
                    maxLength={10}
                  />
                </div>
              </div>
              {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
              <button onClick={sendCode} disabled={loading || phone.length < 10}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all shadow-lg shadow-green-500/20">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                發送驗證碼
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">驗證碼</label>
                <input type="text" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="輸入 6 位數驗證碼"
                  className="w-full px-4 py-4 bg-slate-700/30 border border-slate-600/50 rounded-xl text-white text-center text-2xl tracking-[0.5em] placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                  maxLength={6}
                />
              </div>
              {devCode && <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-sm">🔧 開發模式驗證碼：<span className="font-mono font-bold">{devCode}</span></div>}
              {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
              <button onClick={verifyCode} disabled={loading || code.length < 6}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                驗證
              </button>
              <button onClick={sendCode} disabled={countdown > 0 || loading} className="w-full text-center text-sm text-slate-400 hover:text-white disabled:text-slate-600 transition-colors">
                {countdown > 0 ? `${countdown} 秒後可重新發送` : "重新發送驗證碼"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 圖片上傳組件
function ImageUploadBox({ 
  label, 
  description, 
  imageUrl, 
  onUpload, 
  uploading,
  icon: Icon
}: { 
  label: string; 
  description: string; 
  imageUrl: string | null; 
  onUpload: (file: File) => void; 
  uploading: boolean;
  icon: React.ElementType;
}) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>
      <div 
        className={`relative border-2 border-dashed rounded-xl p-4 transition-all cursor-pointer hover:border-blue-500/50 ${
          imageUrl ? "border-green-500/50 bg-green-500/5" : "border-slate-600/50 bg-slate-700/20"
        }`}
      >
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleFileChange} 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
          disabled={uploading}
        />
        {uploading ? (
          <div className="flex flex-col items-center justify-center py-4">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-2" />
            <p className="text-sm text-slate-400">上傳中...</p>
          </div>
        ) : imageUrl ? (
          <div className="relative min-h-[12rem] flex items-center justify-center bg-slate-800/30 rounded-lg">
            <img 
              src={imageUrl.startsWith('http') ? imageUrl : `${process.env.NEXT_PUBLIC_API_URL || ''}${imageUrl}`} 
              alt={label} 
              className="max-w-full max-h-52 object-contain object-center rounded-lg"
            />
            <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded text-white text-xs opacity-0 hover:opacity-100 transition-opacity">
              點擊更換
            </div>
            <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shrink-0">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4">
            <div className="w-12 h-12 rounded-full bg-slate-700/50 flex items-center justify-center mb-3">
              <Icon className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm text-slate-300 font-medium">{description}</p>
            <p className="text-xs text-slate-500 mt-1">點擊或拖曳上傳</p>
          </div>
        )}
      </div>
    </div>
  );
}

function IdentityVerificationModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void; }) {
  const [step, setStep] = useState<"info" | "upload">("info");
  const [idNumber, setIdNumber] = useState("");
  const [realName, setRealName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [idValid, setIdValid] = useState<boolean | null>(null);
  
  // 圖片上傳狀態
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);

  /** 台灣身分證格式與檢查碼驗證（權重 1,9,8,7,6,5,4,3,2,1,1） */
  const validateId = (): boolean => {
    if (idNumber.length < 10) {
      setIdValid(null);
      return false;
    }
    const n = idNumber.toUpperCase();
    if (n.length !== 10 || !/^[A-Z][12]\d{8}$/.test(n)) {
      setIdValid(false);
      setError("請輸入正確的身分證字號格式（如 A123456789）");
      return false;
    }
    const letterMap: Record<string, number> = {
      'A': 10, 'B': 11, 'C': 12, 'D': 13, 'E': 14, 'F': 15,
      'G': 16, 'H': 17, 'I': 34, 'J': 18, 'K': 19, 'L': 20,
      'M': 21, 'N': 22, 'O': 35, 'P': 23, 'Q': 24, 'R': 25,
      'S': 26, 'T': 27, 'U': 28, 'V': 29, 'W': 32, 'X': 30,
      'Y': 31, 'Z': 33
    };
    const letterNum = letterMap[n[0]];
    if (!letterNum) {
      setIdValid(false);
      setError("請輸入正確的身分證字號格式（如 A123456789）");
      return false;
    }
    const n1 = Math.floor(letterNum / 10), n2 = letterNum % 10;
    const digitWeights = [8, 7, 6, 5, 4, 3, 2, 1, 1];
    let total = n1 * 1 + n2 * 9;
    for (let i = 1; i < n.length; i++) total += parseInt(n[i]) * digitWeights[i - 1];
    const valid = total % 10 === 0;
    setIdValid(valid);
    setError(valid ? "" : "身分證字號檢查碼不正確，請確認輸入");
    return valid;
  };

  const uploadImage = async (file: File, imageType: "front" | "back" | "selfie") => {
    const setUploading = imageType === "front" ? setUploadingFront : 
                         imageType === "back" ? setUploadingBack : setUploadingSelfie;
    const setImage = imageType === "front" ? setFrontImage : 
                     imageType === "back" ? setBackImage : setSelfieImage;
    
    setUploading(true);
    setError("");
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("image_type", imageType);
      
      const res = await api.post("/verification/identity/upload-image", formData);
      const url = res.data?.image_url || res.data?.url;
      if (!url) throw new Error("未取得上傳結果");
      setImage(url);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : Array.isArray(detail) && detail[0]?.msg ? detail[0].msg : "";
      setError(msg || "上傳失敗，請稍後再試");
    } finally {
      setUploading(false);
    }
  };

  const goToUpload = () => {
    // 點擊時重新驗證（避免未 blur 導致 idValid 為 null）
    const idOk = validateId();
    if (!idOk || !realName.trim() || !birthDate) {
      setError("請先完整填寫基本資料");
      return;
    }
    setError("");
    setStep("upload");
  };

  const submit = async () => {
    if (!frontImage || !backImage || !selfieImage) {
      setError("請上傳所有必要的照片");
      return;
    }
    
    setLoading(true);
    setError("");
    try {
      await api.post("/verification/submit", { 
        id_number: idNumber.toUpperCase(), 
        real_name: realName, 
        birth_date: birthDate,
        id_front_image: frontImage,
        id_back_image: backImage,
        selfie_image: selfieImage,
      });
      onSuccess();
      onClose();
    } catch (err: any) { 
      setError(err.response?.data?.detail || "提交失敗，請稍後再試"); 
    }
    finally { setLoading(false); }
  };

  // 重置狀態
  useEffect(() => {
    if (!isOpen) {
      setStep("info");
      setIdNumber("");
      setRealName("");
      setBirthDate("");
      setFrontImage(null);
      setBackImage(null);
      setSelfieImage(null);
      setError("");
      setIdValid(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl w-full max-w-lg border border-slate-700/50 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-700/50 sticky top-0 bg-gradient-to-b from-slate-800 to-slate-800/95 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">身份認證</h3>
                <p className="text-sm text-slate-400">
                  {step === "info" ? "步驟 1/2：填寫基本資料" : "步驟 2/2：上傳證件照片"}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
          
          {/* 步驟指示器 */}
          <div className="flex items-center gap-2 mt-4">
            <div className={`flex-1 h-1 rounded-full transition-all ${step === "info" || step === "upload" ? "bg-blue-500" : "bg-slate-700"}`} />
            <div className={`flex-1 h-1 rounded-full transition-all ${step === "upload" ? "bg-blue-500" : "bg-slate-700"}`} />
          </div>
        </div>

        <div className="p-6 space-y-4">
          {step === "info" ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">身分證字號</label>
                <input type="text" value={idNumber} onChange={(e) => setIdNumber(e.target.value.toUpperCase())} onBlur={validateId}
                  placeholder="A123456789"
                  className={`w-full px-4 py-3 bg-slate-700/30 border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                    idValid === true ? "border-green-500/50 focus:ring-green-500/50" :
                    idValid === false ? "border-red-500/50 focus:ring-red-500/50" :
                    "border-slate-600/50 focus:ring-blue-500/50"
                  }`}
                  maxLength={10}
                />
                {idValid === true && <p className="text-green-400 text-xs mt-1.5 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> 格式正確</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">真實姓名</label>
                <input type="text" value={realName} onChange={(e) => setRealName(e.target.value)} placeholder="請輸入身分證上的姓名"
                  className="w-full px-4 py-3 bg-slate-700/30 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">出生日期</label>
                <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/30 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                />
              </div>
              {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
              <button onClick={goToUpload} disabled={idNumber.length < 10 || !realName.trim() || !birthDate}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-500/20">
                下一步：上傳證件
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              {/* 浮水印說明 */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-300 font-medium text-sm">證件安全保護</p>
                    <p className="text-amber-200/70 text-xs mt-1">
                      上傳的照片將自動加上「僅供網站開通認證使用」浮水印，防止證件被盜用。
                    </p>
                  </div>
                </div>
              </div>

              {/* 上傳區域 */}
              <div className="space-y-4">
                <ImageUploadBox
                  label="身分證正面"
                  description="上傳身分證正面照片"
                  imageUrl={frontImage}
                  onUpload={(file) => uploadImage(file, "front")}
                  uploading={uploadingFront}
                  icon={CreditCard}
                />
                
                <ImageUploadBox
                  label="身分證背面"
                  description="上傳身分證背面照片"
                  imageUrl={backImage}
                  onUpload={(file) => uploadImage(file, "back")}
                  uploading={uploadingBack}
                  icon={CreditCard}
                />
                
                <ImageUploadBox
                  label="手持證件自拍"
                  description="手持身分證於臉旁自拍"
                  imageUrl={selfieImage}
                  onUpload={(file) => uploadImage(file, "selfie")}
                  uploading={uploadingSelfie}
                  icon={Camera}
                />
              </div>

              {/* 拍照說明 */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-300 text-xs space-y-1">
                <p>📷 拍照注意事項：</p>
                <ul className="list-disc list-inside text-blue-200/70 space-y-0.5 ml-2">
                  <li>確保證件四角完整可見</li>
                  <li>避免光線反射造成資訊模糊</li>
                  <li>手持自拍需露出完整臉部</li>
                </ul>
              </div>

              {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
              
              <div className="p-3 bg-slate-700/30 border border-slate-600/50 rounded-xl text-slate-300 text-sm">
                ⚠️ 審核約需 1-3 個工作天，審核結果將以 Email 通知
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep("info")} 
                  className="flex-1 px-4 py-3 border border-slate-600/50 hover:bg-slate-700/50 text-slate-300 rounded-xl font-medium transition-all">
                  上一步
                </button>
                <button onClick={submit} disabled={loading || !frontImage || !backImage || !selfieImage}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-500/20">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  提交審核
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TwoFactorSetupModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void; }) {
  const [step, setStep] = useState<"setup" | "verify" | "backup">("setup");
  const [secret, setSecret] = useState("");
  const [provisioningUri, setProvisioningUri] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);

  const setup = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/verification/2fa/setup");
      setSecret(res.data.secret);
      setProvisioningUri(res.data.provisioning_uri);
      setStep("verify");
    } catch (err: any) { 
      setError(err.response?.data?.detail || "設定失敗，請稍後再試"); 
    }
    finally { setLoading(false); }
  };

  const verify = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/verification/2fa/verify", { code });
      setBackupCodes(res.data.backup_codes || []);
      setStep("backup");
    } catch (err: any) { 
      setError(err.response?.data?.detail || "驗證失敗，請稍後再試"); 
    }
    finally { setLoading(false); }
  };

  const copySecret = async () => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 動態載入 QRCode 組件
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [QRCodeComponent, setQRCodeComponent] = useState<React.ComponentType<any> | null>(null);
  
  useEffect(() => {
    import('qrcode.react').then((mod) => {
      setQRCodeComponent(() => mod.QRCodeSVG);
    });
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl w-full max-w-md border border-slate-700/50 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Key className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">雙重驗證</h3>
                <p className="text-sm text-slate-400">設定 Authenticator App</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {step === "setup" && (
            <div className="space-y-6 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mx-auto">
                <Lock className="w-10 h-10 text-purple-400" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">增強帳號安全性</h4>
                <p className="text-slate-400 text-sm">使用 Google Authenticator 或其他 TOTP App 來保護您的帳號</p>
              </div>
              
              {/* 支援的 App 列表 */}
              <div className="flex items-center justify-center gap-4 py-3">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-12 h-12 rounded-xl bg-slate-700/50 flex items-center justify-center">
                    <span className="text-2xl">🔐</span>
                  </div>
                  <span className="text-xs text-slate-500">Google</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-12 h-12 rounded-xl bg-slate-700/50 flex items-center justify-center">
                    <span className="text-2xl">🛡️</span>
                  </div>
                  <span className="text-xs text-slate-500">Microsoft</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-12 h-12 rounded-xl bg-slate-700/50 flex items-center justify-center">
                    <span className="text-2xl">🔑</span>
                  </div>
                  <span className="text-xs text-slate-500">Authy</span>
                </div>
              </div>
              
              <button onClick={setup} disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-purple-500/20">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                開始設定
              </button>
            </div>
          )}

          {step === "verify" && (
            <div className="space-y-5">
              {/* QR Code 區域 */}
              <div className="text-center">
                <p className="text-sm text-slate-400 mb-4">使用 Authenticator App 掃描下方 QR Code：</p>
                <div className="inline-block p-4 bg-white rounded-2xl shadow-xl">
                  {QRCodeComponent && provisioningUri ? (
                    <QRCodeComponent 
                      value={provisioningUri} 
                      size={180} 
                      bgColor="#ffffff" 
                      fgColor="#1e293b"
                      level="M"
                    />
                  ) : (
                    <div className="w-[180px] h-[180px] flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                    </div>
                  )}
                </div>
              </div>
              
              {/* 手動輸入選項 */}
              <div>
                <button 
                  onClick={() => setShowManualEntry(!showManualEntry)}
                  className="w-full text-center text-sm text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                  {showManualEntry ? "隱藏手動輸入" : "無法掃描？手動輸入金鑰"}
                  <ChevronRight className={`w-4 h-4 transition-transform ${showManualEntry ? "rotate-90" : ""}`} />
                </button>
                
                {showManualEntry && (
                  <div className="mt-3 p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
                    <p className="text-xs text-slate-500 mb-2">在 App 中手動輸入以下金鑰：</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm font-mono text-white break-all bg-slate-800/50 px-3 py-2 rounded-lg">{secret}</code>
                      <button onClick={copySecret} className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors shrink-0">
                        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 mt-2">帳號名稱：King Jam AI</p>
                  </div>
                )}
              </div>

              {/* 驗證碼輸入 */}
              <div className="pt-2 border-t border-slate-700/50">
                <label className="block text-sm font-medium text-slate-300 mb-2">輸入 App 顯示的 6 位數驗證碼</label>
                <input type="text" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000"
                  className="w-full px-4 py-4 bg-slate-700/30 border border-slate-600/50 rounded-xl text-white text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                  maxLength={6}
                />
              </div>
              {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
              <button onClick={verify} disabled={loading || code.length < 6}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-slate-600 disabled:to-slate-600 text-white rounded-xl font-medium transition-all">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                驗證並啟用
              </button>
            </div>
          )}

          {step === "backup" && (
            <div className="space-y-4">
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                雙重驗證已啟用！
              </div>
              <div>
                <p className="text-sm text-slate-300 mb-3">請保存以下備用碼（可用於無法使用 App 時登入）：</p>
                <div className="grid grid-cols-2 gap-2 p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
                  {backupCodes.map((code, i) => (
                    <div key={i} className="font-mono text-sm text-slate-300 py-1">{code}</div>
                  ))}
                </div>
              </div>
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-sm">⚠️ 請將備用碼保存在安全的地方，每個只能使用一次</div>
              <button onClick={() => { onSuccess(); onClose(); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-medium transition-all">
                <CheckCircle className="w-4 h-4" />
                完成
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Change Email Modal
// ============================================================

function ChangeEmailModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  currentEmail 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: () => void; 
  currentEmail: string;
}) {
  const [step, setStep] = useState<"input" | "verify">("input");
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [devCode, setDevCode] = useState("");

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    if (!isOpen) {
      setStep("input");
      setNewEmail("");
      setCode("");
      setError("");
      setDevCode("");
    }
  }, [isOpen]);

  const sendVerificationCode = async () => {
    if (!newEmail || !newEmail.includes("@")) {
      setError("請輸入有效的電子郵件地址");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/users/change-email/request", { new_email: newEmail });
      setStep("verify");
      setCountdown(60);
      if (res.data.dev_code) {
        setDevCode(res.data.dev_code);
      }
      toast.success("驗證碼已發送至新郵箱");
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError("登入已過期，請重新登入");
        toast.error("登入已過期，即將跳轉至登入頁面...");
      } else {
        setError(err.response?.data?.detail || "發送失敗，請稍後再試");
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyAndChange = async () => {
    if (code.length < 6) {
      setError("請輸入 6 位驗證碼");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.post("/users/change-email/confirm", { new_email: newEmail, code });
      toast.success("電子郵件已變更成功！");
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || "驗證失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl w-full max-w-md border border-slate-700/50 shadow-2xl">
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">變更電子郵件</h3>
                <p className="text-sm text-slate-400">目前：{currentEmail}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {step === "input" ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">新電子郵件地址</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="請輸入新的電子郵件"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <button
                onClick={sendVerificationCode}
                disabled={loading || !newEmail}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                發送驗證碼
              </button>
            </>
          ) : (
            <>
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-300 text-sm">
                驗證碼已發送至 <strong>{newEmail}</strong>
              </div>
              {devCode && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>開發環境驗證碼：<strong className="font-mono text-lg">{devCode}</strong></span>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">驗證碼</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="請輸入 6 位驗證碼"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white text-center text-2xl tracking-widest placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  maxLength={6}
                />
              </div>
              <button
                onClick={verifyAndChange}
                disabled={loading || code.length < 6}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                確認變更
              </button>
              <button
                onClick={sendVerificationCode}
                disabled={countdown > 0 || loading}
                className="w-full text-center text-sm text-slate-400 hover:text-white disabled:text-slate-600 transition-colors"
              >
                {countdown > 0 ? `${countdown} 秒後可重新發送` : "重新發送驗證碼"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Change Password Modal
// ============================================================

function ChangePasswordModal({ 
  isOpen, 
  onClose, 
  onSuccess 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: () => void; 
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError("");
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!currentPassword) {
      setError("請輸入目前密碼");
      return;
    }
    if (newPassword.length < 8) {
      setError("新密碼至少需要 8 個字元");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("新密碼與確認密碼不符");
      return;
    }
    
    setLoading(true);
    setError("");
    try {
      await api.post("/users/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success("密碼已變更成功！");
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || "變更失敗，請確認目前密碼是否正確");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl w-full max-w-md border border-slate-700/50 shadow-2xl">
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Lock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">變更密碼</h3>
                <p className="text-sm text-slate-400">請輸入目前密碼以驗證身份</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">目前密碼</label>
            <input
              type={showPasswords ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="請輸入目前密碼"
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">新密碼</label>
            <input
              type={showPasswords ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="至少 8 個字元"
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">確認新密碼</label>
            <input
              type={showPasswords ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次輸入新密碼"
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowPasswords(!showPasswords)}
            className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2"
          >
            {showPasswords ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            {showPasswords ? "隱藏密碼" : "顯示密碼"}
          </button>

          <button
            onClick={handleSubmit}
            disabled={loading || !currentPassword || !newPassword || !confirmPassword}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            確認變更
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Notification Settings Modal
// ============================================================

// ============================================================
// Edit Profile Modal
// ============================================================

function EditProfileModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  initialData
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: () => void;
  initialData: {
    full_name: string | null;
    email: string;
    bio?: string;
    website?: string;
    company?: string;
    job_title?: string;
    location?: string;
  };
}) {
  const [formData, setFormData] = useState({
    full_name: initialData.full_name || "",
    bio: initialData.bio || "",
    website: initialData.website || "",
    company: initialData.company || "",
    job_title: initialData.job_title || "",
    location: initialData.location || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 當 modal 打開或 initialData 變化時重設表單
  useEffect(() => {
    if (isOpen) {
      setFormData({
        full_name: initialData.full_name || "",
        bio: initialData.bio || "",
        website: initialData.website || "",
        company: initialData.company || "",
        job_title: initialData.job_title || "",
        location: initialData.location || "",
      });
      setError("");
    }
  }, [isOpen, initialData]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      await api.put("/users/profile", formData);
      toast.success("個人資料已更新");
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || "更新失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl w-full max-w-lg border border-slate-700/50 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-slate-700/50 sticky top-0 bg-gradient-to-b from-slate-800 to-slate-800/95 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <Edit3 className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">編輯個人資料</h3>
                <p className="text-sm text-slate-400">更新您的公開個人資訊</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* 顯示名稱 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">顯示名稱</label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => handleChange("full_name", e.target.value)}
              placeholder="輸入您的名稱"
              className="w-full px-4 py-3 bg-slate-700/30 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
              maxLength={100}
            />
            <p className="text-xs text-slate-500 mt-1.5">此名稱會顯示在您的個人頁面上</p>
          </div>

          {/* Email（唯讀） */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">電子郵件</label>
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={initialData.email}
                disabled
                className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-400 cursor-not-allowed"
              />
              <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl">
                <Lock className="w-5 h-5 text-slate-500" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">Email 請從帳號設定中變更</p>
          </div>

          {/* 個人簡介 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">個人簡介</label>
            <textarea
              value={formData.bio}
              onChange={(e) => handleChange("bio", e.target.value)}
              placeholder="介紹一下自己..."
              rows={3}
              className="w-full px-4 py-3 bg-slate-700/30 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all resize-none"
              maxLength={500}
            />
            <p className="text-xs text-slate-500 mt-1.5">{formData.bio.length}/500 字元</p>
          </div>

          {/* 公司與職稱 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">公司</label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => handleChange("company", e.target.value)}
                placeholder="公司名稱"
                className="w-full px-4 py-3 bg-slate-700/30 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                maxLength={100}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">職稱</label>
              <input
                type="text"
                value={formData.job_title}
                onChange={(e) => handleChange("job_title", e.target.value)}
                placeholder="您的職稱"
                className="w-full px-4 py-3 bg-slate-700/30 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                maxLength={100}
              />
            </div>
          </div>

          {/* 所在地區 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">所在地區</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => handleChange("location", e.target.value)}
              placeholder="例如：台北, 台灣"
              className="w-full px-4 py-3 bg-slate-700/30 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
              maxLength={100}
            />
          </div>

          {/* 個人網站 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">個人網站</label>
            <div className="flex items-center gap-2">
              <div className="px-4 py-3 bg-slate-700/30 border border-slate-600/50 rounded-l-xl text-slate-400 text-sm">
                https://
              </div>
              <input
                type="text"
                value={formData.website.replace(/^https?:\/\//, "")}
                onChange={(e) => handleChange("website", e.target.value)}
                placeholder="yourwebsite.com"
                className="flex-1 px-4 py-3 bg-slate-700/30 border border-slate-600/50 rounded-r-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                maxLength={200}
              />
            </div>
          </div>

          {/* 提交按鈕 */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-slate-600/50 hover:bg-slate-700/50 text-slate-300 rounded-xl font-medium transition-all"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              儲存變更
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function NotificationSettingsModal({ 
  isOpen, 
  onClose, 
  onSuccess 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: () => void; 
}) {
  const [settings, setSettings] = useState({
    email_marketing: true,
    email_updates: true,
    email_security: true,
    email_referral: true,
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setInitialLoading(true);
    try {
      const res = await api.get("/users/notification-settings");
      setSettings(res.data);
    } catch {
      // 使用預設值
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.put("/users/notification-settings", settings);
      toast.success("通知設定已更新！");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "儲存失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  };

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (!isOpen) return null;

  const settingItems = [
    { key: "email_marketing" as const, label: "行銷活動通知", desc: "接收促銷、優惠和新功能通知" },
    { key: "email_updates" as const, label: "產品更新通知", desc: "接收平台更新和公告" },
    { key: "email_security" as const, label: "安全性通知", desc: "接收登入提醒和安全警報（建議開啟）" },
    { key: "email_referral" as const, label: "推薦獎勵通知", desc: "接收推薦獎金入帳通知" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl w-full max-w-md border border-slate-700/50 shadow-2xl">
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">通知設定</h3>
                <p className="text-sm text-slate-400">管理電子郵件通知偏好</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          {initialLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              {settingItems.map((item) => (
                <div key={item.key} className="flex items-center justify-between p-4 bg-slate-700/30 border border-slate-600/30 rounded-xl">
                  <div>
                    <div className="font-medium text-white">{item.label}</div>
                    <div className="text-xs text-slate-400">{item.desc}</div>
                  </div>
                  <button
                    onClick={() => toggleSetting(item.key)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      settings[item.key] ? "bg-purple-600" : "bg-slate-600"
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        settings[item.key] ? "translate-x-7" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              ))}

              <button
                onClick={handleSave}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-slate-600 disabled:to-slate-600 text-white rounded-xl font-medium transition-all mt-6"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                儲存設定
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [verification, setVerification] = useState<VerificationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [profileExtended, setProfileExtended] = useState<{
    bio?: string;
    website?: string;
    company?: string;
    job_title?: string;
    location?: string;
  }>({});
  
  const router = useRouter();

  useEffect(() => { fetchProfileData(); }, []);

  const fetchProfileData = async () => {
    try {
      const [profileRes, balanceRes, verifyRes, extendedRes] = await Promise.allSettled([
        api.get("/referral/stats"),
        api.get("/credits/balance"),
        api.get("/verification/status"),
        api.get("/users/profile"),
      ]);
      
      if (profileRes.status === "fulfilled" && balanceRes.status === "fulfilled") {
        const data = profileRes.value.data;
        const balanceData = balanceRes.value.data;
        // 正確讀取 API 結構：category_balance 包含各類別點數
        const categoryBalance = balanceData.category_balance || {};
        setProfile({
          id: data.user_id, 
          email: data.email || "service@kingjam.app", 
          full_name: data.full_name || null,
          avatar: data.avatar || null,
          tier: balanceData.tier || "admin", 
          subscription_plan: balanceData.tier || "admin", 
          partner_tier: data.partner_tier || "bronze",
          credits: balanceData.balance || 0, 
          credits_promo: categoryBalance.promo || 0,
          credits_sub: categoryBalance.sub || 0, 
          credits_paid: categoryBalance.paid || 0,
          credits_bonus: categoryBalance.bonus || 0, 
          referral_code: data.referral_code,
          total_referrals: data.total_referrals || 0,
          total_referral_revenue: data.total_referral_revenue || 0,
          created_at: new Date().toISOString(), 
          subscription_expires_at: null,
        });
      }
      
      if (verifyRes.status === "fulfilled") {
        setVerification(verifyRes.value.data);
      }
      
      // 獲取擴展資料
      if (extendedRes.status === "fulfilled") {
        const extData = extendedRes.value.data.profile || {};
        setProfileExtended({
          bio: extData.bio || "",
          website: extData.website || "",
          company: extData.company || "",
          job_title: extData.job_title || "",
          location: extData.location || "",
        });
      }
    } catch (error) { 
      console.error("Failed to fetch profile:", error); 
    }
    finally { setLoading(false); }
  };

  const copyReferralCode = async () => {
    if (!profile?.referral_code) return;
    await navigator.clipboard.writeText(profile.referral_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-slate-700 border-t-indigo-500 animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <User className="w-6 h-6 text-slate-500" />
          </div>
        </div>
      </div>
    );
  }
  
  const tierConfig = TIER_CONFIG[profile?.tier || "free"];
  const partnerConfig = PARTNER_CONFIG[profile?.partner_tier || "bronze"];
  const TierIcon = tierConfig.icon;
  const PartnerIcon = partnerConfig.icon;
  const totalCredits = profile ? profile.credits_promo + profile.credits_sub + profile.credits_paid + profile.credits_bonus : 0;
  const verificationComplete = verification?.phone?.is_verified && verification?.identity?.is_verified && verification?.two_factor?.is_enabled;

  // 登出功能
  const handleLogout = () => {
    localStorage.removeItem("token");
    toast.success("已成功登出");
    router.push("/login");
  };

  // 功能開發中提示
  const handleComingSoon = (feature: string) => {
    toast.info(`${feature} 功能即將推出`);
  };

  // 頭像上傳處理
  const handleAvatarClick = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 檢查檔案類型
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('不支援的圖片格式，請使用 JPG、PNG、GIF 或 WebP');
      return;
    }

    // 檢查檔案大小 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('圖片大小不能超過 5MB');
      return;
    }

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post('/users/avatar', formData);
      
      if (res.data.success) {
        // 更新 profile 中的 avatar
        setProfile(prev => prev ? { ...prev, avatar: res.data.avatar_url } : null);
        setAvatarError(false); // 重置錯誤狀態
        toast.success('頭像已更新');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || '上傳失敗，請稍後再試');
    } finally {
      setAvatarUploading(false);
      // 清除 input 以便再次選擇相同檔案
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  // 移除頭像
  const handleRemoveAvatar = async () => {
    if (!profile?.avatar) return;
    
    try {
      const res = await api.delete('/users/avatar');
      if (res.data.success) {
        setProfile(prev => prev ? { ...prev, avatar: null } : null);
        setAvatarError(false);
        toast.success('頭像已移除');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || '移除失敗，請稍後再試');
    }
  };

  return (
    <div className="space-y-8 pb-8">
      {/* Hero Profile Card */}
      <GlowCard>
        {/* Banner */}
        <div className="h-36 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptMCAwdi02aC02djZoNnptLTYgMGgtNnY2aDZ2LTZ6bTAtNmgtNnY2aDZ2LTZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30"></div>
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-slate-800/80 to-transparent"></div>
        </div>

        <div className="px-6 pb-6 -mt-16 relative">
          <div className="flex flex-col lg:flex-row lg:items-end gap-6">
            {/* Avatar */}
            <div className="relative group">
              <input
                type="file"
                ref={avatarInputRef}
                onChange={(e) => {
                  handleAvatarChange(e);
                  setShowAvatarMenu(false);
                }}
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                className="hidden"
              />
              {/* 頭像 - 點擊顯示選單 */}
              <div 
                className="w-28 h-28 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-1 shadow-2xl cursor-pointer hover:scale-105 transition-transform"
                onClick={() => setShowAvatarMenu(!showAvatarMenu)}
              >
                {profile?.avatar && !avatarError ? (
                  <img 
                    src={profile.avatar.startsWith('http') ? profile.avatar : `${process.env.NEXT_PUBLIC_API_URL || ''}${profile.avatar}`}
                    alt="用戶頭像"
                    className="w-full h-full rounded-xl object-cover"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <div className="w-full h-full rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                    <Crown className="w-12 h-12 text-yellow-400 drop-shadow-lg" />
                  </div>
                )}
              </div>
              
              {/* 彈出選單 */}
              {showAvatarMenu && (
                <>
                  {/* 背景遮罩 */}
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowAvatarMenu(false)}
                  />
                  {/* 選單按鈕 */}
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-50">
                    {/* 上傳按鈕 */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAvatarClick();
                      }}
                      disabled={avatarUploading}
                      className="w-10 h-10 rounded-full bg-indigo-600 border-2 border-indigo-500 flex items-center justify-center hover:bg-indigo-500 transition-all shadow-lg hover:scale-110 disabled:opacity-50 animate-in fade-in zoom-in duration-200"
                      title="上傳頭像"
                    >
                      {avatarUploading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Camera className="w-5 h-5 text-white" />
                      )}
                    </button>
                    {/* 移除按鈕 */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveAvatar();
                        setShowAvatarMenu(false);
                      }}
                      className="w-10 h-10 rounded-full bg-red-600 border-2 border-red-500 flex items-center justify-center hover:bg-red-500 transition-all shadow-lg hover:scale-110 animate-in fade-in zoom-in duration-200"
                      title="移除頭像"
                    >
                      <X className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </>
              )}
              
              {/* 編輯提示 */}
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-slate-800/90 border-2 border-slate-700 flex items-center justify-center shadow-lg pointer-events-none">
                <Camera className="w-4 h-4 text-slate-400" />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-white">
                  {verification?.identity?.real_name || profile?.full_name || "King Jam 用戶"}
                </h1>
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${tierConfig.bgColor} ${tierConfig.textColor} border ${tierConfig.borderColor}`}>
                  <TierIcon className="w-4 h-4" />
                  {tierConfig.label}
                </div>
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${partnerConfig.bg} ${partnerConfig.color}`}>
                  <PartnerIcon className="w-4 h-4" />
                  {partnerConfig.label}
                  <span className="text-xs opacity-70">({partnerConfig.rate})</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-400">
                <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" />{profile?.email}</span>
                {profileExtended.company && profileExtended.job_title ? (
                  <span className="flex items-center gap-1.5">
                    <Award className="w-4 h-4" />
                    {profileExtended.job_title} @ {profileExtended.company}
                  </span>
                ) : profileExtended.company ? (
                  <span className="flex items-center gap-1.5">
                    <Award className="w-4 h-4" />{profileExtended.company}
                  </span>
                ) : profileExtended.job_title ? (
                  <span className="flex items-center gap-1.5">
                    <Award className="w-4 h-4" />{profileExtended.job_title}
                  </span>
                ) : null}
                {profileExtended.location && (
                  <span className="flex items-center gap-1.5">
                    <span className="text-base">📍</span>{profileExtended.location}
                  </span>
                )}
                <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />加入於 2026 年 1 月</span>
                {verificationComplete && (
                  <span className="flex items-center gap-1.5 text-green-400"><BadgeCheck className="w-4 h-4" />已完成認證</span>
                )}
              </div>
              {/* 個人簡介 */}
              {profileExtended.bio && (
                <p className="mt-3 text-slate-300 text-sm max-w-2xl leading-relaxed">
                  {profileExtended.bio}
                </p>
              )}
              {/* 個人網站 */}
              {profileExtended.website && (
                <a 
                  href={profileExtended.website.startsWith("http") ? profileExtended.website : `https://${profileExtended.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  {profileExtended.website.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>

            {/* Actions */}
            <button 
              onClick={() => setShowEditProfileModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/20"
            >
              <Edit3 className="w-4 h-4" />
              編輯資料
            </button>
          </div>
        </div>
      </GlowCard>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 總點數 */}
        <GlowCard glowColor="amber">
          <div className="p-5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mb-3">
              <Coins className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              <AnimatedNumber value={totalCredits} suffix=" 點" />
            </div>
            <div className="text-sm text-slate-400">總點數</div>
          </div>
        </GlowCard>

        {/* 推薦人數 */}
        <GlowCard glowColor="pink">
          <div className="p-5">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center mb-3">
              <Gift className="w-5 h-5 text-pink-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              <AnimatedNumber value={profile?.total_referrals || 0} suffix=" 人" />
            </div>
            <div className="text-sm text-slate-400">推薦人數</div>
          </div>
        </GlowCard>

        {/* 推薦收益 */}
        <GlowCard glowColor="green">
          <div className="p-5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-3">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              <AnimatedNumber value={profile?.total_referral_revenue || 0} prefix="NT$" />
            </div>
            <div className="text-sm text-slate-400">推薦收益</div>
          </div>
        </GlowCard>

        {/* 可提領 */}
        <GlowCard glowColor="purple">
          <div className="p-5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-3">
              <Wallet className="w-5 h-5 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              <AnimatedNumber value={(profile?.credits_bonus || 0) * 0.1} prefix="NT$" />
            </div>
            <div className="text-sm text-slate-400">可提領</div>
          </div>
        </GlowCard>
      </div>

      {/* Security Section */}
      <GlowCard glowColor="green">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">安全認證</h2>
                <p className="text-sm text-slate-400">提領獎金時需完成認證（一般使用無需認證）</p>
              </div>
            </div>
            {verificationComplete && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-sm text-green-400">全部完成</span>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <SecurityCard
              icon={Smartphone}
              title="手機認證"
              subtitle="簡訊 OTP 驗證"
              verified={verification?.phone?.is_verified || false}
              verifiedText={`已認證 ${verification?.phone?.phone_number || ""}`}
              onAction={() => setShowPhoneModal(true)}
              accentColor="green"
            />
            <SecurityCard
              icon={FileText}
              title="身份認證"
              subtitle="台灣身分證"
              verified={verification?.identity?.is_verified || false}
              verifiedText={`已認證 ${verification?.identity?.real_name || ""}`}
              pendingText="審核中（約 1-3 工作天）"
              status={verification?.identity?.status}
              rejectionReason={verification?.identity?.rejection_reason}
              onAction={() => setShowIdentityModal(true)}
              accentColor="blue"
            />
            <SecurityCard
              icon={Key}
              title="雙重驗證"
              subtitle="Authenticator App"
              verified={verification?.two_factor?.is_enabled || false}
              verifiedText="已啟用 TOTP"
              onAction={() => setShow2FAModal(true)}
              accentColor="purple"
            />
          </div>

          {!verificationComplete && (
            <div className="mt-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-300 text-sm font-medium">尚未完成所有認證</p>
                <p className="text-amber-400/70 text-sm mt-0.5">完成全部認證後才能使用獎金提領等金融功能</p>
              </div>
            </div>
          )}
        </div>
      </GlowCard>

      {/* Credits & Referral Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Credits */}
        <GlowCard glowColor="amber">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                  <Coins className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">點數錢包</h2>
                  <p className="text-sm text-slate-400">四類點數餘額</p>
                </div>
              </div>
              <a href="/dashboard/credits" className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                查看明細 <ChevronRight className="w-4 h-4" />
              </a>
            </div>

            <div className="text-center py-6 mb-6 bg-gradient-to-br from-slate-900/50 to-slate-800/50 rounded-xl border border-slate-700/50">
              <div className="text-4xl font-bold text-white mb-1">
                <AnimatedNumber value={totalCredits} />
              </div>
              <div className="text-slate-400">總可用點數</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* 優惠點數 */}
              <div className="p-4 bg-pink-500/5 border border-pink-500/20 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500">優惠點數</span>
                  <span className="text-xs text-pink-400">限時</span>
                </div>
                <div className="text-xl font-bold text-pink-400">
                  <AnimatedNumber value={profile?.credits_promo || 0} />
                </div>
              </div>
              
              {/* 月費點數 */}
              <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500">月費點數</span>
                  <span className="text-xs text-blue-400">當月</span>
                </div>
                <div className="text-xl font-bold text-blue-400">
                  <AnimatedNumber value={profile?.credits_sub || 0} />
                </div>
              </div>
              
              {/* 購買點數 */}
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500">購買點數</span>
                  <span className="text-xs text-emerald-400">永久</span>
                </div>
                <div className="text-xl font-bold text-emerald-400">
                  <AnimatedNumber value={profile?.credits_paid || 0} />
                </div>
              </div>
              
              {/* 獎金點數 */}
              <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500">獎金點數</span>
                  <span className="text-xs text-amber-400">可提領</span>
                </div>
                <div className="text-xl font-bold text-amber-400">
                  <AnimatedNumber value={profile?.credits_bonus || 0} />
                </div>
              </div>
            </div>
          </div>
        </GlowCard>

        {/* Referral */}
        <GlowCard glowColor="pink">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center">
                  <Gift className="w-5 h-5 text-pink-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">推薦計畫</h2>
                  <p className="text-sm text-slate-400">邀請好友賺獎金</p>
                </div>
              </div>
              <a href="/dashboard/referral" className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                推薦中心 <ChevronRight className="w-4 h-4" />
              </a>
            </div>

            {profile?.referral_code && (
              <div className="mb-6">
                <label className="block text-sm text-slate-400 mb-2">我的推薦碼</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl">
                    <span className="text-xl font-mono font-bold text-white tracking-wider">
                      {profile.referral_code}
                    </span>
                  </div>
                  <button onClick={copyReferralCode}
                    className="p-3 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 rounded-xl transition-all">
                    {copiedCode ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-slate-400" />}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-900/50 border border-slate-700/50 rounded-xl text-center">
                <div className="text-2xl font-bold text-white mb-1">{profile?.total_referrals || 0}</div>
                <div className="text-sm text-slate-400">推薦人數</div>
              </div>
              <div className="p-4 bg-slate-900/50 border border-slate-700/50 rounded-xl text-center">
                <div className="text-2xl font-bold text-green-400 mb-1">NT${(profile?.total_referral_revenue || 0).toLocaleString()}</div>
                <div className="text-sm text-slate-400">累積收益</div>
              </div>
            </div>

            <a href="/dashboard/referral"
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-pink-500/20">
              <Gift className="w-4 h-4" />
              邀請好友賺獎金
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </GlowCard>
      </div>

      {/* Subscription & Account Info */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Subscription Plan */}
        <GlowCard glowColor="purple">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
                  <Package className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">訂閱方案</h2>
                  <p className="text-sm text-slate-400">您的會員權益</p>
                </div>
              </div>
            </div>

            {(() => {
              const planKey = profile?.subscription_plan || "free";
              const plan = SUBSCRIPTION_CONFIG[planKey] || SUBSCRIPTION_CONFIG.free;
              
              // 使用靜態 class 避免 Tailwind 動態問題
              const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
                slate: { bg: "from-slate-500/10 to-slate-600/5", border: "border-slate-500/20", text: "text-slate-400" },
                blue: { bg: "from-blue-500/10 to-blue-600/5", border: "border-blue-500/20", text: "text-blue-400" },
                purple: { bg: "from-purple-500/10 to-purple-600/5", border: "border-purple-500/20", text: "text-purple-400" },
                amber: { bg: "from-amber-500/10 to-amber-600/5", border: "border-amber-500/20", text: "text-amber-400" },
                red: { bg: "from-red-500/10 to-red-600/5", border: "border-red-500/20", text: "text-red-400" },
              };
              const colors = colorClasses[plan.color] || colorClasses.slate;
              
              return (
                <div className={`p-5 bg-gradient-to-br ${colors.bg} border ${colors.border} rounded-xl mb-4`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className={`${colors.text} font-semibold text-lg`}>{plan.name}</span>
                      <span className="text-slate-400 text-sm ml-2">{plan.price}</span>
                    </div>
                    {profile?.subscription_plan !== "free" && (
                      <span className="text-xs text-slate-500">
                        到期：{profile?.subscription_expires_at ? format(new Date(profile.subscription_expires_at), "yyyy/MM/dd") : "永久"}
                      </span>
                    )}
                  </div>
                  {plan.priceYearly && (
                    <p className="text-sm text-emerald-400/90 mb-2">
                      年繳 NT${plan.priceYearly} <span className="text-emerald-300">省 20%</span>
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {plan.features.map((feature, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800/50 rounded text-xs text-slate-300">
                        <CheckCircle className="w-3 h-3 text-green-400" />
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {profile?.subscription_plan === "free" && (
              <a href="/dashboard/pricing"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-purple-500/20">
                <Zap className="w-4 h-4" />
                升級方案
                <ArrowRight className="w-4 h-4" />
              </a>
            )}
            {profile?.subscription_plan && profile.subscription_plan !== "free" && profile.subscription_plan !== "admin" && (
              <a
                href={`/dashboard/pricing?plan=${profile.subscription_plan}&cycle=yearly`}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 mt-2 bg-slate-700/80 hover:bg-slate-600 text-slate-200 rounded-xl font-medium transition-all border border-slate-600"
              >
                <Crown className="w-4 h-4 text-amber-400" />
                改為年繳更省 20%
                <ArrowRight className="w-4 h-4" />
              </a>
            )}
          </div>
        </GlowCard>

        {/* Account Settings */}
        <GlowCard glowColor="slate">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600/20 to-slate-500/20 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">帳號資訊</h2>
                  <p className="text-sm text-slate-400">基本設定與安全</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-700/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <div>
                    <div className="text-xs text-slate-500">電子郵件</div>
                    <div className="text-sm text-white">{profile?.email}</div>
                  </div>
                </div>
                <button onClick={() => setShowEmailModal(true)} className="text-xs text-indigo-400 hover:text-indigo-300">變更</button>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-700/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <div>
                    <div className="text-xs text-slate-500">註冊日期</div>
                    <div className="text-sm text-white">
                      {profile?.created_at ? format(new Date(profile.created_at), "yyyy 年 MM 月 dd 日", { locale: zhTW }) : "2026 年 1 月"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-700/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Lock className="w-4 h-4 text-slate-500" />
                  <div>
                    <div className="text-xs text-slate-500">登入密碼</div>
                    <div className="text-sm text-white">••••••••</div>
                  </div>
                </div>
                <button onClick={() => setShowPasswordModal(true)} className="text-xs text-indigo-400 hover:text-indigo-300">變更</button>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-700/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Bell className="w-4 h-4 text-slate-500" />
                  <div>
                    <div className="text-xs text-slate-500">通知設定</div>
                    <div className="text-sm text-white">電子郵件通知</div>
                  </div>
                </div>
                <button onClick={() => setShowNotificationModal(true)} className="text-xs text-indigo-400 hover:text-indigo-300">設定</button>
              </div>
            </div>
          </div>
        </GlowCard>
      </div>

      {/* Quick Actions */}
      <GlowCard>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">快捷操作</h2>
              <p className="text-sm text-slate-400">常用功能入口</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <a href="/dashboard/blog" className="flex flex-col items-center gap-2 p-4 bg-slate-900/50 hover:bg-blue-500/10 border border-slate-700/50 hover:border-blue-500/30 rounded-xl transition-all group">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 flex items-center justify-center transition-all">
                <PenTool className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-sm text-slate-300 group-hover:text-white transition-colors">寫文章</span>
            </a>

            <a href="/dashboard/social" className="flex flex-col items-center gap-2 p-4 bg-slate-900/50 hover:bg-pink-500/10 border border-slate-700/50 hover:border-pink-500/30 rounded-xl transition-all group">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 group-hover:bg-pink-500/20 flex items-center justify-center transition-all">
                <Image className="w-5 h-5 text-pink-400" />
              </div>
              <span className="text-sm text-slate-300 group-hover:text-white transition-colors">做圖文</span>
            </a>

            <a href="/dashboard/video" className="flex flex-col items-center gap-2 p-4 bg-slate-900/50 hover:bg-purple-500/10 border border-slate-700/50 hover:border-purple-500/30 rounded-xl transition-all group">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 flex items-center justify-center transition-all">
                <Video className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-sm text-slate-300 group-hover:text-white transition-colors">拍短片</span>
            </a>

            <a href="/dashboard/scheduler" className="flex flex-col items-center gap-2 p-4 bg-slate-900/50 hover:bg-emerald-500/10 border border-slate-700/50 hover:border-emerald-500/30 rounded-xl transition-all group">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 flex items-center justify-center transition-all">
                <Calendar className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-sm text-slate-300 group-hover:text-white transition-colors">排程發布</span>
            </a>

            <a href="/dashboard/credits" className="flex flex-col items-center gap-2 p-4 bg-slate-900/50 hover:bg-amber-500/10 border border-slate-700/50 hover:border-amber-500/30 rounded-xl transition-all group">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 group-hover:bg-amber-500/20 flex items-center justify-center transition-all">
                <Coins className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-sm text-slate-300 group-hover:text-white transition-colors">購買點數</span>
            </a>

            <a href="/dashboard/history" className="flex flex-col items-center gap-2 p-4 bg-slate-900/50 hover:bg-slate-500/10 border border-slate-700/50 hover:border-slate-500/30 rounded-xl transition-all group">
              <div className="w-10 h-10 rounded-xl bg-slate-500/10 group-hover:bg-slate-500/20 flex items-center justify-center transition-all">
                <History className="w-5 h-5 text-slate-400" />
              </div>
              <span className="text-sm text-slate-300 group-hover:text-white transition-colors">生成紀錄</span>
            </a>
          </div>
        </div>
      </GlowCard>

      {/* Help & Support */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500">
        <a href="/help" className="flex items-center gap-1.5 hover:text-slate-300 transition-colors">
          <HelpCircle className="w-4 h-4" />
          幫助中心
        </a>
        <span className="text-slate-700">•</span>
        <a href="/terms" className="hover:text-slate-300 transition-colors">服務條款</a>
        <span className="text-slate-700">•</span>
        <a href="/privacy" className="hover:text-slate-300 transition-colors">隱私政策</a>
        <span className="text-slate-700">•</span>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-red-400/70 hover:text-red-400 transition-colors">
          <LogOut className="w-4 h-4" />
          登出帳號
        </button>
      </div>

      {/* Modals */}
      <PhoneVerificationModal isOpen={showPhoneModal} onClose={() => setShowPhoneModal(false)} onSuccess={fetchProfileData} />
      <IdentityVerificationModal isOpen={showIdentityModal} onClose={() => setShowIdentityModal(false)} onSuccess={fetchProfileData} />
      <TwoFactorSetupModal isOpen={show2FAModal} onClose={() => setShow2FAModal(false)} onSuccess={fetchProfileData} />
      <ChangeEmailModal isOpen={showEmailModal} onClose={() => setShowEmailModal(false)} onSuccess={fetchProfileData} currentEmail={profile?.email || ""} />
      <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} onSuccess={fetchProfileData} />
      <NotificationSettingsModal isOpen={showNotificationModal} onClose={() => setShowNotificationModal(false)} onSuccess={fetchProfileData} />
      <EditProfileModal 
        isOpen={showEditProfileModal} 
        onClose={() => setShowEditProfileModal(false)} 
        onSuccess={fetchProfileData} 
        initialData={{
          full_name: profile?.full_name || null,
          email: profile?.email || "",
          ...profileExtended
        }}
      />
    </div>
  );
}
