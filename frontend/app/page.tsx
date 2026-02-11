"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  Sparkles, Zap, Video, PenTool, Image as ImageIcon, Calendar, 
  Share2, BarChart3, Shield, Clock, ChevronRight,
  Play, Check, Star, ArrowRight, Menu, X, Users,
  Globe, Rocket, Award, Heart, MessageCircle, TrendingUp,
  MousePointer, Layers, Target, Crown, Gift, Bot,
  Instagram, Facebook, Youtube, Linkedin, Twitter
} from "lucide-react";

// ============================================================
// Animated Components
// ============================================================

function GradientText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent ${className}`}>
      {children}
    </span>
  );
}

function FloatingOrb({ className = "", delay = 0 }: { className?: string; delay?: number }) {
  return (
    <div 
      className={`absolute rounded-full blur-3xl opacity-30 animate-pulse ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

function AnimatedCounter({ end, duration = 2000, suffix = "" }: { end: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    
    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [isVisible, end, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// ============================================================
// Navigation
// ============================================================

function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled ? "bg-slate-900/95 backdrop-blur-xl shadow-xl shadow-black/20" : "bg-transparent"
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <Image
              src="/logo.png" 
              alt="King Jam AI" 
              width={110} 
              height={110} 
              className="rounded-xl shadow-lg shadow-purple-500/30 group-hover:shadow-purple-500/50 transition-all mt-2.5"
            />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-slate-300 hover:text-white transition-colors text-sm">功能特色</a>
            <a href="#pricing" className="text-slate-300 hover:text-white transition-colors text-sm">價格方案</a>
            <a href="#how-it-works" className="text-slate-300 hover:text-white transition-colors text-sm">使用流程</a>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors">
              登入
            </Link>
            <Link href="/register" className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-full transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105">
              免費開始
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-white"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-slate-900/98 backdrop-blur-xl border-t border-slate-800">
          <div className="px-4 py-6 space-y-4">
            <a href="#features" className="block text-slate-300 hover:text-white py-2">功能特色</a>
            <a href="#pricing" className="block text-slate-300 hover:text-white py-2">價格方案</a>
            <a href="#how-it-works" className="block text-slate-300 hover:text-white py-2">使用流程</a>
            <div className="pt-4 border-t border-slate-800 flex flex-col gap-3">
              <Link href="/login" className="w-full py-3 text-center text-slate-300 border border-slate-700 rounded-xl">登入</Link>
              <Link href="/register" className="w-full py-3 text-center text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl font-medium">免費開始</Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

// ============================================================
// Hero Section
// ============================================================

function HeroSection() {
  const platforms = [
    { icon: Instagram, color: "from-pink-500 to-purple-500" },
    { icon: Facebook, color: "from-blue-600 to-blue-500" },
    { icon: Youtube, color: "from-red-600 to-red-500" },
    { icon: Linkedin, color: "from-blue-700 to-blue-600" },
    { icon: Twitter, color: "from-sky-500 to-sky-400" },
  ];

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pt-20">
      {/* Background Effects */}
      <FloatingOrb className="w-96 h-96 bg-indigo-600 -top-48 -left-48" delay={0} />
      <FloatingOrb className="w-96 h-96 bg-purple-600 top-1/3 -right-48" delay={500} />
      <FloatingOrb className="w-64 h-64 bg-pink-600 bottom-0 left-1/3" delay={1000} />
      
      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptMCAwdi02aC02djZoNnptLTYgMGgtNnY2aDZ2LTZ6bTAtNmgtNnY2aDZ2LTZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-40"></div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 mb-8 animate-fade-in">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span className="text-sm text-indigo-300">AI 驅動的內容創作革命</span>
          <span className="px-2 py-0.5 text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full">NEW</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
          用 AI 創造<br className="sm:hidden" />
          <GradientText>爆款內容</GradientText>
          </h1>

        {/* Sub Headline */}
        <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          一站式 AI 內容創作平台，讓你的
          <span className="text-white font-medium">文章、圖文、短影片</span>
          創作效率提升 10 倍，輕鬆征服各大社群平台
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Link href="/register" className="group w-full sm:w-auto px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 rounded-2xl transition-all shadow-2xl shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105 flex items-center justify-center gap-2">
            免費開始創作
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a href="#demo" className="group w-full sm:w-auto px-8 py-4 text-lg font-medium text-white border border-slate-600 hover:border-slate-500 hover:bg-slate-800/50 rounded-2xl transition-all flex items-center justify-center gap-2">
            <Play className="w-5 h-5" />
            觀看演示
          </a>
        </div>

        {/* Platform Icons */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <span className="text-sm text-slate-500">支援平台：</span>
          <div className="flex items-center gap-3">
            {platforms.map((platform, i) => (
              <div key={i} className={`w-10 h-10 rounded-xl bg-gradient-to-br ${platform.color} flex items-center justify-center shadow-lg opacity-80 hover:opacity-100 hover:scale-110 transition-all cursor-pointer`}>
                <platform.icon className="w-5 h-5 text-white" />
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto pt-8 border-t border-slate-800">
          <div>
            <div className="text-3xl sm:text-4xl font-bold text-white mb-1">
              <AnimatedCounter end={10000} suffix="+" />
            </div>
            <div className="text-sm text-slate-500">內容已生成</div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-bold text-white mb-1">
              <AnimatedCounter end={5000} suffix="+" />
            </div>
            <div className="text-sm text-slate-500">活躍用戶</div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-bold text-white mb-1">
              <AnimatedCounter end={98} suffix="%" />
            </div>
            <div className="text-sm text-slate-500">滿意度</div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-slate-600 flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-slate-500 rounded-full animate-pulse"></div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Features Section
// ============================================================

function FeaturesSection() {
  const features = [
    {
      icon: PenTool,
      title: "AI 文章生成",
      description: "輸入關鍵字或主題，AI 自動生成 SEO 優化的專業長文，從部落格到產品介紹一應俱全。",
      highlights: [
        "支援多種文章類型：部落格、新聞稿、產品介紹、SEO 文章",
        "自動生成封面圖片，搭配品牌風格",
        "一鍵發布至 WordPress 或排程上架",
        "智能 SEO 優化，提升搜尋排名",
      ],
      stats: { label: "每篇僅需", value: "5-20", unit: "點" },
      color: "from-blue-500 to-cyan-500",
      badge: "熱門",
      href: "/dashboard/blog",
    },
    {
      icon: ImageIcon,
      title: "社群圖文設計",
      description: "輸入主題描述，AI 自動生成吸睛的社群貼文配圖與文案，支援所有主流平台尺寸。",
      highlights: [
        "支援 IG 貼文/限動、FB 貼文/封面、LINE 圖文",
        "AI 智能排版，自動搭配色彩與字型",
        "圖片編輯室 PRO：去背、濾鏡、AI 生圖",
        "批量生成多張圖文，一次搞定整週素材",
      ],
      stats: { label: "每張僅需", value: "10-50", unit: "點" },
      color: "from-pink-500 to-rose-500",
      badge: null,
      href: "/dashboard/social",
    },
    {
      icon: Video,
      title: "AI 短影片",
      description: "使用 Google Veo 3 & Kling AI 打造專業級短影片，自動配音、字幕、背景音樂。",
      highlights: [
        "支援 15 秒 / 30 秒 / 60 秒多種時長",
        "AI 自動生成腳本、畫面、配音與字幕",
        "多種語音風格可選，支援中英文配音",
        "自動配樂與轉場特效，無需剪輯技能",
      ],
      stats: { label: "每支僅需", value: "100-300", unit: "點" },
      color: "from-purple-500 to-indigo-500",
      badge: "強大",
      href: "/dashboard/video",
    },
    {
      icon: Calendar,
      title: "智能排程",
      description: "設定自動發布時間，AI 分析歷史數據，推薦最佳發文時段，最大化觸及與互動率。",
      highlights: [
        "視覺化行事曆，拖拉排定發布時程",
        "AI 推薦最佳發文時段，提高互動率",
        "支援批量排程，一次安排整月內容",
        "發布失敗自動重試，確保內容準時上線",
      ],
      stats: { label: "自動化", value: "24/7", unit: "運作" },
      color: "from-emerald-500 to-green-500",
      badge: null,
      href: "/dashboard/scheduler",
    },
    {
      icon: Share2,
      title: "多平台發布",
      description: "一鍵同步發布至 Instagram、Facebook、YouTube、WordPress 等主流平台，自動適配格式。",
      highlights: [
        "支援 Facebook 粉專、Instagram、YouTube",
        "WordPress 文章直接發布與排程",
        "自動適配各平台尺寸與格式要求",
        "OAuth 安全授權，一次綁定持續使用",
      ],
      stats: { label: "支援平台", value: "5+", unit: "個" },
      color: "from-amber-500 to-orange-500",
      badge: null,
      href: "/dashboard/scheduler",
    },
    {
      icon: BarChart3,
      title: "數據洞察",
      description: "整合 GA4 分析，追蹤每篇內容的觸及、互動、轉換表現，AI 提供優化建議。",
      highlights: [
        "即時追蹤文章觸及率、互動率、轉換率",
        "AI 自動分析高表現內容特徵",
        "競品內容趨勢分析與建議",
        "每週自動生成績效報告，數據一目了然",
      ],
      stats: { label: "數據更新", value: "即時", unit: "同步" },
      color: "from-violet-500 to-purple-500",
      badge: "進階",
      href: "/dashboard/insights",
    },
  ];

  return (
    <section id="features" className="py-24 bg-slate-950 relative overflow-hidden">
      <FloatingOrb className="w-96 h-96 bg-indigo-600/50 -top-48 right-0" delay={200} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-4">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span className="text-sm text-indigo-300">功能特色</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
            一個平台，<GradientText>無限可能</GradientText>
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            整合最先進的 AI 技術，讓內容創作變得簡單、快速、專業
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <div 
              key={i}
              className="group relative p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-slate-700/50 hover:border-slate-600 transition-all hover:shadow-2xl hover:shadow-purple-500/10 hover:-translate-y-1 flex flex-col"
            >
              {feature.badge && (
                <div className="absolute top-4 right-4 px-2 py-1 text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full">
                  {feature.badge}
                </div>
              )}
              
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform`}>
                <feature.icon className="w-7 h-7 text-white" />
              </div>
              
              <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">{feature.description}</p>

              {/* 功能亮點列表 */}
              <ul className="space-y-2 mb-5 flex-1">
                {feature.highlights.map((h, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    <span className="text-slate-300">{h}</span>
                  </li>
                ))}
              </ul>

              {/* 底部：數據指標 + 連結 */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
                <div className="flex items-baseline gap-1">
                  <span className="text-[11px] text-slate-500">{feature.stats.label}</span>
                  <span className={`text-lg font-bold bg-gradient-to-r ${feature.color} bg-clip-text text-transparent`}>
                    {feature.stats.value}
                  </span>
                  <span className="text-[11px] text-slate-500">{feature.stats.unit}</span>
                </div>
                <Link 
                  href={feature.href}
                  className="flex items-center text-sm text-indigo-400 group-hover:text-indigo-300 transition-colors"
                >
                  立即體驗
                  <ChevronRight className="w-4 h-4 ml-0.5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// How It Works Section
// ============================================================

function HowItWorksSection() {
  const steps = [
    {
      number: "01",
      title: "選擇創作類型",
      description: "選擇你想創作的內容：文章、圖文或短影片",
      icon: MousePointer,
    },
    {
      number: "02",
      title: "輸入創意靈感",
      description: "告訴 AI 你的主題、風格和目標受眾",
      icon: Bot,
    },
    {
      number: "03",
      title: "AI 智能生成",
      description: "AI 立即為你生成專業級的內容",
      icon: Sparkles,
    },
    {
      number: "04",
      title: "一鍵發布",
      description: "直接發布到各大社群平台或排程自動發布",
      icon: Rocket,
    },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-gradient-to-b from-slate-950 to-slate-900 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <Target className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-emerald-300">使用流程</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
            <GradientText>四步驟</GradientText>，輕鬆上手
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            不需要專業技能，任何人都能在幾分鐘內開始創作
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {steps.map((step, i) => (
            <div key={i} className="relative">
              {/* Connection Line */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-14 left-1/2 w-full h-0.5 bg-gradient-to-r from-indigo-500/50 to-transparent"></div>
              )}
              
              <div className="relative p-6 h-full flex flex-col bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 hover:border-indigo-500/50 transition-all group">
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-sm font-bold text-white shadow-lg">
                  {step.number}
                </div>
                
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <step.icon className="w-8 h-8 text-indigo-400" />
                </div>
                
                <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-slate-400 text-sm flex-grow">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Pricing Section
// ============================================================

function PricingSection() {
  const plans = [
    {
      name: "免費版",
      price: "0",
      period: "永久免費",
      description: "適合個人嘗試體驗",
      features: [
        "註冊贈送 100 點",
        "基本 AI 文章生成",
        "社群圖文設計",
        "手動發布功能",
        "洞察引擎（僅 WordPress）",
      ],
      cta: "免費開始",
      popular: false,
      color: "slate",
    },
    {
      name: "入門版",
      price: "299",
      priceYearly: "2,870",
      period: "每月",
      description: "適合輕度使用者",
      features: [
        "每月 300 點",
        "基本功能無廣告",
        "AI 文章生成",
        "社群圖文設計",
        "單平台發布",
        "洞察引擎（僅 WordPress）",
        "Email 客服支援",
      ],
      cta: "立即訂閱",
      popular: false,
      color: "blue",
    },
    {
      name: "專業版",
      price: "699",
      priceYearly: "6,710",
      period: "每月",
      description: "適合自媒體創作者",
      features: [
        "每月 1,000 點",
        "全部 AI 功能解鎖",
        "完整成效洞察引擎",
        "GA4 流量分析整合",
        "AI 短影片生成",
        "智能排程發布",
        "多平台同步",
        "優先客服支援",
      ],
      cta: "立即訂閱",
      popular: true,
      color: "purple",
    },
    {
      name: "企業版",
      price: "3,699",
      priceYearly: "35,510",
      period: "每月",
      description: "適合品牌與團隊",
      features: [
        "每月 5,000 點",
        "全部專業版功能",
        "API 存取權限",
        "團隊協作功能",
        "專屬客戶經理",
        "客製化需求",
      ],
      cta: "立即訂閱",
      popular: false,
      color: "amber",
    },
  ];

  return (
    <section id="pricing" className="py-24 bg-slate-950 relative overflow-hidden">
      <FloatingOrb className="w-96 h-96 bg-purple-600/40 bottom-0 -left-48" delay={300} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4">
            <Crown className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-amber-300">價格方案</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
            透明定價，<GradientText>物超所值</GradientText>
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            選擇最適合你的方案，隨時可以升級或降級
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
          {plans.map((plan, i) => (
            <div 
              key={i}
              className={`relative p-6 rounded-2xl border transition-all ${
                plan.popular 
                  ? "bg-gradient-to-b from-purple-900/50 to-slate-900 border-purple-500/50 shadow-2xl shadow-purple-500/20 scale-[1.02] lg:scale-105" 
                  : "bg-slate-900/50 border-slate-700/50 hover:border-slate-600"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-sm font-semibold text-white shadow-lg">
                  最受歡迎
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-white mb-2">{plan.name}</h3>
                <div className="flex items-baseline justify-center gap-1 mb-1">
                  <span className="text-sm text-slate-500">NT$</span>
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-slate-500">/{plan.period}</span>
                </div>
                {"priceYearly" in plan && plan.priceYearly && (
                  <p className="text-sm text-emerald-400/90 mb-2">
                    年繳 NT${plan.priceYearly} <span className="text-emerald-300">省 20%</span>
                  </p>
                )}
                <p className="text-sm text-slate-400">{plan.description}</p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="w-5 h-5 text-green-400 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link 
                href="/register"
                className={`block w-full py-3 text-center font-medium rounded-xl transition-all ${
                  plan.popular
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-500/30"
                    : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Additional Info */}
        <div className="mt-12 text-center">
          <p className="text-slate-500 text-sm">
            所有方案皆可隨時取消 • 支援信用卡、Line Pay、超商付款
          </p>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Testimonials Section
// ============================================================

function TestimonialsSection() {
  const testimonials = [
    {
      content: "King Jam AI 讓我的自媒體經營效率提升了 10 倍！原本要花一整天寫的文章，現在 10 分鐘就搞定。",
      author: "陳先生",
      role: "旅遊部落客",
      avatar: "👨‍💼",
      rating: 5,
    },
    {
      content: "AI 短影片功能太強大了，完全不需要剪輯技能就能做出專業級的影片，推薦給所有自媒體人！",
      author: "林小姐",
      role: "美妝 YouTuber",
      avatar: "👩‍🎨",
      rating: 5,
    },
    {
      content: "智能排程功能幫我省下大量時間，現在可以一次準備一週的內容，系統自動發布。",
      author: "王先生",
      role: "電商賣家",
      avatar: "👨‍💻",
      rating: 5,
    },
  ];

  return (
    <section className="py-24 bg-gradient-to-b from-slate-900 to-slate-950 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-500/10 border border-pink-500/20 mb-4">
            <Heart className="w-4 h-4 text-pink-400" />
            <span className="text-sm text-pink-300">用戶好評</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
            聽聽他們<GradientText>怎麼說</GradientText>
          </h2>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, i) => (
            <div key={i} className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50 hover:border-slate-600 transition-all">
              {/* Rating */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, j) => (
                  <Star key={j} className="w-5 h-5 text-amber-400 fill-amber-400" />
                ))}
              </div>
              
              {/* Content */}
              <p className="text-slate-300 mb-6 leading-relaxed">"{testimonial.content}"</p>
              
              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-2xl">
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-medium text-white">{testimonial.author}</div>
                  <div className="text-sm text-slate-500">{testimonial.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// CTA Section
// ============================================================

function CTASection() {
  return (
    <section className="py-24 bg-slate-950 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-pink-600/20"></div>
      <FloatingOrb className="w-96 h-96 bg-purple-600/50 top-0 left-1/4" delay={0} />
      <FloatingOrb className="w-64 h-64 bg-pink-600/50 bottom-0 right-1/4" delay={500} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        {/* Gift Icon */}
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-purple-500/40">
          <Gift className="w-10 h-10 text-white" />
        </div>

        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6">
          現在註冊，<GradientText>免費獲得 100 點</GradientText>
        </h2>
        
        <p className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto">
          不需要信用卡，立即體驗 AI 內容創作的魔力。邀請好友還能賺取更多點數！
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/register" className="group w-full sm:w-auto px-10 py-4 text-lg font-semibold text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 rounded-2xl transition-all shadow-2xl shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105 flex items-center justify-center gap-2">
            立即免費註冊
            <Sparkles className="w-5 h-5" />
          </Link>
          <Link href="/login" className="w-full sm:w-auto px-10 py-4 text-lg font-medium text-white border border-slate-600 hover:border-slate-500 hover:bg-slate-800/50 rounded-2xl transition-all">
            我已有帳號
          </Link>
        </div>

        {/* Trust Badges */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-slate-500 text-sm">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-400" />
            <span>SSL 安全加密</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            <span>5,000+ 用戶信賴</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <span>24/7 客服支援</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Footer
// ============================================================

function Footer() {
  const links = {
    product: [
      { label: "功能特色", href: "#features" },
      { label: "價格方案", href: "#pricing" },
      { label: "使用教學", href: "#" },
      { label: "API 文件", href: "#" },
    ],
    company: [
      { label: "關於我們", href: "/about" },
      { label: "部落格", href: "#" },
      { label: "合作夥伴", href: "/partners" },
      { label: "聯絡我們", href: "/contact" },
    ],
    legal: [
      { label: "服務條款", href: "/terms" },
      { label: "隱私政策", href: "/privacy" },
      { label: "退款政策", href: "/refund" },
    ],
  };

  return (
    <footer className="bg-slate-950 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-3 mb-4">
              <Image
                src="/logo.png" 
                alt="King Jam AI" 
                width={56} 
                height={56} 
                className="rounded-xl shadow-lg"
              />
            </Link>
            <p className="text-slate-400 mb-6 max-w-sm">
              AI 驅動的智慧內容創作平台，讓每個人都能輕鬆創造專業級內容。
            </p>
            <div className="flex gap-4">
              {[Instagram, Facebook, Youtube, Twitter].map((Icon, i) => (
                <a key={i} href="#" className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                  <Icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">產品</h4>
            <ul className="space-y-3">
              {links.product.map((link, i) => (
                <li key={i}>
                  <a href={link.href} className="text-slate-400 hover:text-white transition-colors text-sm">{link.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">公司</h4>
            <ul className="space-y-3">
              {links.company.map((link, i) => (
                <li key={i}>
                  <a href={link.href} className="text-slate-400 hover:text-white transition-colors text-sm">{link.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">法律</h4>
            <ul className="space-y-3">
              {links.legal.map((link, i) => (
                <li key={i}>
                  <a href={link.href} className="text-slate-400 hover:text-white transition-colors text-sm">{link.label}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-white font-semibold mb-4">聯絡資訊</h4>
            <ul className="space-y-3 text-sm">
              <li className="text-slate-400">
                <span className="block text-slate-500 text-xs mb-1">地址</span>
                台北市信義區福德街84巷30號23樓之11
              </li>
              <li>
                <span className="block text-slate-500 text-xs mb-1">電話</span>
                <a href="tel:+886981689608" className="text-slate-400 hover:text-white transition-colors">+886 981 689 608</a>
              </li>
              <li>
                <span className="block text-slate-500 text-xs mb-1">Email</span>
                <a href="mailto:bobo68425@gmail.com" className="text-slate-400 hover:text-white transition-colors">bobo68425@gmail.com</a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-sm">
            © 2026 King Jam AI. All rights reserved. | <a href="https://kingjam.app" className="hover:text-white transition-colors">kingjam.app</a>
          </p>
          <p className="text-slate-600 text-sm">
            Made with ❤️ in Taiwan
          </p>
        </div>
      </div>
    </footer>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function LandingPage() {
  return (
    <div className="bg-slate-950 min-h-screen">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <PricingSection />
      <TestimonialsSection />
      <CTASection />
      <Footer />
    </div>
  );
}
