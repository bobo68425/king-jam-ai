"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Sparkles, Heart, MessageCircle, Send, Bookmark, Copy, Download, Check, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, RefreshCw, Edit3, Save, X, Trash2, Clock, CheckSquare, Image as ImageIcon, Type, Palette, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FaInstagram, FaFacebookF, FaTiktok, FaPinterestP, FaLinkedinIn, FaLine, FaThreads } from "react-icons/fa6";
import { ScheduleDialog, ScheduleContent } from "@/components/schedule-dialog";
import ImageTextEditor from "@/components/image-text-editor";
import { useRouter } from "next/navigation";
import { setPendingImageForEditor, sharedGalleryService, type SharedImage, getPendingImageForEngine } from "@/lib/services/shared-gallery-service";
import { useCredits } from "@/lib/credits-context";

// HEIC 圖片轉換函數（動態導入 heic2any 避免 SSR 問題）
const convertHeicToJpeg = async (file: File): Promise<File> => {
  if (file.type === "image/heic" || file.type === "image/heif" || file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif")) {
    try {
      // 動態導入 heic2any（僅在客戶端執行）
      const heic2any = (await import("heic2any")).default;
      const convertedBlob = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.9,
      });
      const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      return new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
    } catch (error) {
      console.error("HEIC 轉換失敗:", error);
      throw new Error("HEIC 圖片轉換失敗，請嘗試其他格式");
    }
  }
  return file;
};

// 品牌 LOGO 組件 - King Jam AI
const BrandLogo = ({ size = "md", className = "" }: { size?: "sm" | "md" | "lg"; className?: string }) => {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12"
  };
  
  const fontSize = {
    sm: "text-[10px]",
    md: "text-xs",
    lg: "text-sm"
  };

  return (
    <div className={cn(
      "relative rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg",
      sizeClasses[size],
      className
    )}>
      {/* 內圈 */}
      <div className="absolute inset-[2px] rounded-full bg-gradient-to-br from-slate-900 to-slate-800" />
      {/* LOGO 文字 */}
      <div className="relative flex flex-col items-center justify-center">
        <span className={cn("font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 leading-none", fontSize[size])}>
          KJ
        </span>
      </div>
      {/* AI 光點 */}
      <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-lg shadow-emerald-400/50" />
    </div>
  );
};

// 平台圖標組件 - 使用 react-icons 官方圖標
const PlatformIcon = ({ platform, className = "w-6 h-6" }: { platform: string; className?: string }) => {
  const iconClass = "w-[55%] h-[55%]";
  
  const renderIcon = () => {
    switch (platform) {
      case "instagram":
        return (
          <div className={cn("flex items-center justify-center rounded-xl bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF]", className)} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
            <FaInstagram className={cn(iconClass, "text-white")} />
          </div>
        );
      case "facebook":
        return (
          <div className={cn("flex items-center justify-center rounded-xl bg-gradient-to-b from-[#18ACFE] to-[#0163E0]", className)} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
            <FaFacebookF className={cn(iconClass, "text-white")} />
          </div>
        );
      case "tiktok":
        return (
          <div className={cn("flex items-center justify-center rounded-xl bg-black", className)} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
            <FaTiktok className={cn(iconClass, "text-white")} />
          </div>
        );
      case "pinterest":
        return (
          <div className={cn("flex items-center justify-center rounded-xl bg-[#E60023]", className)} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
            <FaPinterestP className={cn(iconClass, "text-white")} />
          </div>
        );
      case "threads":
        return (
          <div className={cn("flex items-center justify-center rounded-xl bg-black", className)} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
            <FaThreads className={cn(iconClass, "text-white")} />
          </div>
        );
      case "linkedin":
        return (
          <div className={cn("flex items-center justify-center rounded-xl bg-[#0A66C2]", className)} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
            <FaLinkedinIn className={cn(iconClass, "text-white")} />
          </div>
        );
      case "xiaohongshu":
        return (
          <div className={cn("flex items-center justify-center rounded-xl bg-[#FE2C55]", className)} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
            <span className="text-white font-bold text-[40%]">小红书</span>
          </div>
        );
      case "line":
        return (
          <div className={cn("flex items-center justify-center rounded-xl bg-gradient-to-br from-[#00D653] to-[#00B900]", className)} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
            <FaLine className={cn(iconClass, "text-white")} />
          </div>
        );
      default:
        return <Sparkles className={className} />;
    }
  };

  return renderIcon();
};

// 平台配置
const PLATFORMS = [
  { id: "instagram", name: "Instagram", color: "from-purple-500 to-pink-500" },
  { id: "facebook", name: "Facebook", color: "from-blue-600 to-blue-400" },
  { id: "tiktok", name: "TikTok", color: "from-slate-900 to-slate-700" },
  { id: "pinterest", name: "Pinterest", color: "from-red-600 to-red-400" },
  { id: "threads", name: "Threads", color: "from-slate-800 to-slate-600" },
  { id: "linkedin", name: "LinkedIn", color: "from-blue-700 to-blue-500" },
  { id: "xiaohongshu", name: "小紅書", color: "from-red-500 to-rose-400" },
  { id: "line", name: "LINE", color: "from-green-500 to-emerald-400" },
] as const;

// 定義成本表 (需與後端一致)
const COST_TABLE = {
  draft: 10,
  standard: 20,
  premium: 50
};

// 歷史記錄（從 API 載入）
interface SocialHistoryRecord {
  id: number;  // API 返回的是數字 ID
  topic: string;
  platform: string;
  quality: "draft" | "standard" | "premium";
  tone: string;
  keywords: string;
  imagePrompt: string;
  productInfo: string;
  image_url: string;
  caption: string;
  createdAt: string;
  // API 額外欄位
  credits_used?: number;
  media_cloud_url?: string;
}

// 小紅書專屬預覽組件
function XiaohongshuPreview({ 
  loading, 
  result, 
  quality,
  navigationOverlay
}: { 
  loading: boolean; 
  result: { image_url: string; caption: string } | null; 
  quality: "draft" | "standard" | "premium";
  navigationOverlay?: React.ReactNode;
}) {
  return (
    <div className="relative w-[375px] shrink-0">
      {/* 手機外框 */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black rounded-[50px] shadow-[0_20px_60px_rgba(0,0,0,0.4),inset_0_2px_10px_rgba(255,255,255,0.1)]"></div>
      
      {/* 小紅書手機螢幕 */}
      <div className="relative bg-white rounded-[42px] overflow-hidden border-[10px] border-slate-900 shadow-[inset_0_0_20px_rgba(0,0,0,0.1)]">
        {/* iOS 狀態欄 */}
        <div className="h-7 bg-white flex items-center justify-between px-4 text-[10px] font-semibold text-black">
          <span>9:41</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-2 border border-black rounded-sm">
              <div className="w-3 h-full bg-black rounded-sm"></div>
            </div>
            <svg className="w-4 h-3 text-black" viewBox="0 0 24 12" fill="none">
              <path d="M1 6h22M20 1l3 5-3 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        {/* 小紅書頂部列 - 紅色主題 */}
        <div className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {/* 小紅書 Logo - 紅色 */}
            <div className="w-7 h-7 rounded-full bg-[#FF2442] flex items-center justify-center">
              <span className="text-white text-xs font-bold">小</span>
            </div>
            <span className="text-black font-bold text-lg">小紅書</span>
          </div>
          <div className="flex items-center gap-3">
            {/* 搜尋圖示 */}
            <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {/* 訊息圖示 */}
            <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        </div>

        {/* 小紅書圖片區域 - 3:4 垂直 */}
        <div className="relative aspect-[3/4] bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center group overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center gap-4 text-slate-400">
              <div className="relative">
                <div className="absolute inset-0 bg-[#FF2442]/20 rounded-full blur-xl animate-pulse"></div>
                <Loader2 className="h-12 w-12 animate-spin text-[#FF2442] relative z-10" />
              </div>
              <div className="text-center">
                <span className="text-sm font-medium block animate-pulse">AI 正在繪圖中...</span>
                <span className="text-xs text-slate-400 mt-1 block">請稍候片刻</span>
              </div>
            </div>
          ) : result?.image_url ? (
            <div className="relative w-full h-full group">
              <img 
                src={result.image_url} 
                alt="Generated Content" 
                className="w-full h-full object-cover"
              />
              {/* 品質標籤 */}
              <Badge className="absolute top-3 left-3 bg-black/70 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white shadow-lg px-3 py-1 text-xs font-semibold">
                {quality === 'draft' && '⚡'}
                {quality === 'standard' && '✨'}
                {quality === 'premium' && '💎'}
                {' '}
                {quality.toUpperCase()}
              </Badge>
              {navigationOverlay}
            </div>
          ) : (
            <div className="text-slate-300 flex flex-col items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-[#FF2442]/10 rounded-full blur-2xl"></div>
                <Sparkles className="h-16 w-16 relative z-10 text-slate-300" />
              </div>
              <div className="text-center">
                <span className="text-sm font-medium block">預覽區域</span>
                <span className="text-xs text-slate-400 mt-1 block">生成後將顯示於此</span>
              </div>
            </div>
          )}

          {/* 小紅書右側互動按鈕列 */}
          <div className="absolute right-3 bottom-20 flex flex-col gap-5 items-center">
            {/* 頭像 */}
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-white overflow-hidden shadow-lg">
                <BrandLogo size="lg" className="w-full h-full" />
              </div>
            </div>

            {/* 愛心按鈕 */}
            <button className="flex flex-col items-center gap-1 group">
              <div className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-md border border-slate-200 flex items-center justify-center group-hover:bg-white shadow-lg transition-colors">
                <Heart className="w-7 h-7 text-slate-700 group-hover:text-[#FF2442] transition-colors fill-transparent group-hover:fill-[#FF2442]" />
              </div>
              <span className="text-xs text-white font-semibold drop-shadow-lg">1.2K</span>
            </button>

            {/* 收藏按鈕 */}
            <button className="flex flex-col items-center gap-1 group">
              <div className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-md border border-slate-200 flex items-center justify-center group-hover:bg-white shadow-lg transition-colors">
                <Bookmark className="w-7 h-7 text-slate-700 group-hover:text-[#FF2442] transition-colors fill-transparent group-hover:fill-[#FF2442]" />
              </div>
              <span className="text-xs text-white font-semibold drop-shadow-lg">45</span>
            </button>

            {/* 留言按鈕 */}
            <button className="flex flex-col items-center gap-1 group">
              <div className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-md border border-slate-200 flex items-center justify-center group-hover:bg-white shadow-lg transition-colors">
                <MessageCircle className="w-7 h-7 text-slate-700 group-hover:text-[#FF2442] transition-colors" />
              </div>
              <span className="text-xs text-white font-semibold drop-shadow-lg">12</span>
            </button>

            {/* 分享按鈕 */}
            <button className="flex flex-col items-center gap-1 group">
              <div className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-md border border-slate-200 flex items-center justify-center group-hover:bg-white shadow-lg transition-colors">
                <Send className="w-7 h-7 text-slate-700 group-hover:text-[#FF2442] transition-colors" />
              </div>
            </button>
          </div>
        </div>

        {/* 小紅書底部資訊區域 */}
        <div className="px-4 py-3 bg-white space-y-2">
          {/* 用戶資訊 */}
          <div className="flex items-center gap-2">
            <BrandLogo size="sm" className="w-6 h-6" />
            <span className="text-sm font-semibold text-black">king_jam_ai</span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-slate-500">2 小時前</span>
          </div>

          {/* 文案 */}
          <div className="text-sm leading-relaxed text-slate-800">
            {loading ? (
              <div className="space-y-2">
                <div className="h-3 bg-slate-200 animate-pulse rounded w-3/4"></div>
                <div className="h-3 bg-slate-200 animate-pulse rounded w-1/2"></div>
              </div>
            ) : result?.caption ? (
              <span 
                dangerouslySetInnerHTML={{ __html: result.caption.replace(/\n/g, '<br />') }} 
              />
            ) : (
              <span className="text-slate-400 italic">貼文文案將顯示於此...</span>
            )}
          </div>

          {/* 標籤 */}
          {result && (
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="text-xs text-[#FF2442] font-semibold bg-[#FF2442]/10 px-2 py-1 rounded">#KingJamAI</span>
              <span className="text-xs text-[#FF2442] font-semibold bg-[#FF2442]/10 px-2 py-1 rounded">#AI生成</span>
            </div>
          )}
        </div>

        {/* 小紅書底部導航欄 */}
        <div className="h-14 bg-white border-t border-slate-200 flex items-center justify-around">
          <div className="flex flex-col items-center gap-1">
            <svg className="w-6 h-6 text-[#FF2442]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs text-[#FF2442] font-semibold">首頁</span>
          </div>
          <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <div className="w-10 h-10 rounded-full bg-[#FF2442] flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <div className="w-7 h-7 rounded-full bg-slate-200"></div>
        </div>
      </div>
    </div>
  );
}

// LinkedIn 專屬預覽組件
function LinkedInPreview({ 
  loading, 
  result, 
  quality,
  navigationOverlay
}: { 
  loading: boolean; 
  result: { image_url: string; caption: string } | null; 
  quality: "draft" | "standard" | "premium";
  navigationOverlay?: React.ReactNode;
}) {
  return (
    <div className="relative w-[600px] shrink-0">
      {/* 桌面外框 */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.4),inset_0_2px_10px_rgba(255,255,255,0.1)]"></div>
      
      {/* LinkedIn 桌面螢幕 */}
      <div className="relative bg-slate-50 rounded-lg overflow-hidden border-[8px] border-slate-900 shadow-[inset_0_0_20px_rgba(0,0,0,0.1)]">
        {/* LinkedIn 頂部導航欄 */}
        <div className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {/* LinkedIn Logo */}
            <svg className="w-7 h-7 text-[#0077B5]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            <div className="h-6 w-px bg-slate-300"></div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-sm text-slate-600">搜尋</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <div className="w-7 h-7 rounded-full bg-slate-200"></div>
          </div>
        </div>

        {/* LinkedIn 內容區域 */}
        <div className="bg-slate-50 p-4">
          {/* 貼文卡片 */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            {/* 用戶資訊列 */}
            <div className="px-4 py-3 flex items-start justify-between border-b border-slate-100">
              <div className="flex items-start gap-3">
                <BrandLogo size="lg" className="w-12 h-12 border-2 border-slate-200" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">King Jam AI</span>
                    <span className="text-xs text-slate-500">•</span>
                    <span className="text-xs text-slate-500">2 小時前</span>
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    AI 內容生成平台 • 創辦人
                  </div>
                </div>
              </div>
              <button className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                <svg className="w-5 h-5 text-slate-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
              </button>
            </div>

            {/* LinkedIn 圖片區域 - 1.91:1 橫向 */}
            <div className="relative aspect-[1.91/1] bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center group overflow-hidden">
              {loading ? (
                <div className="flex flex-col items-center gap-4 text-slate-400">
                  <div className="relative">
                    <div className="absolute inset-0 bg-[#0077B5]/20 rounded-full blur-xl animate-pulse"></div>
                    <Loader2 className="h-12 w-12 animate-spin text-[#0077B5] relative z-10" />
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-medium block animate-pulse">AI 正在繪圖中...</span>
                    <span className="text-xs text-slate-400 mt-1 block">請稍候片刻</span>
                  </div>
                </div>
              ) : result?.image_url ? (
                <div className="relative w-full h-full group">
                  <img 
                    src={result.image_url} 
                    alt="Generated Content" 
                    className="w-full h-full object-cover"
                  />
                  {/* 品質標籤 */}
                  <Badge className="absolute top-3 left-3 bg-black/70 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white shadow-lg px-3 py-1 text-xs font-semibold">
                    {quality === 'draft' && '⚡'}
                    {quality === 'standard' && '✨'}
                    {quality === 'premium' && '💎'}
                    {' '}
                    {quality.toUpperCase()}
                  </Badge>
                  {navigationOverlay}
                </div>
              ) : (
                <div className="text-slate-300 flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-[#0077B5]/10 rounded-full blur-2xl"></div>
                    <Sparkles className="h-16 w-16 relative z-10 text-slate-300" />
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-medium block">預覽區域</span>
                    <span className="text-xs text-slate-400 mt-1 block">生成後將顯示於此</span>
                  </div>
                </div>
              )}
            </div>

            {/* LinkedIn 互動按鈕列 */}
            <div className="px-4 py-2 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-6">
                {/* 讚按鈕 */}
                <button className="flex items-center gap-2 group px-3 py-1.5 rounded-md hover:bg-slate-50 transition-colors">
                  <svg className="w-5 h-5 text-slate-600 group-hover:text-[#0077B5] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                  </svg>
                  <span className="text-sm font-semibold text-slate-600 group-hover:text-[#0077B5] transition-colors">讚</span>
                </button>

                {/* 留言按鈕 */}
                <button className="flex items-center gap-2 group px-3 py-1.5 rounded-md hover:bg-slate-50 transition-colors">
                  <MessageCircle className="w-5 h-5 text-slate-600 group-hover:text-[#0077B5] transition-colors" />
                  <span className="text-sm font-semibold text-slate-600 group-hover:text-[#0077B5] transition-colors">留言</span>
                </button>

                {/* 轉發按鈕 */}
                <button className="flex items-center gap-2 group px-3 py-1.5 rounded-md hover:bg-slate-50 transition-colors">
                  <svg className="w-5 h-5 text-slate-600 group-hover:text-[#0077B5] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span className="text-sm font-semibold text-slate-600 group-hover:text-[#0077B5] transition-colors">轉發</span>
                </button>

                {/* 傳送按鈕 */}
                <button className="flex items-center gap-2 group px-3 py-1.5 rounded-md hover:bg-slate-50 transition-colors">
                  <Send className="w-5 h-5 text-slate-600 group-hover:text-[#0077B5] transition-colors" />
                  <span className="text-sm font-semibold text-slate-600 group-hover:text-[#0077B5] transition-colors">傳送</span>
                </button>
              </div>
            </div>

            {/* LinkedIn 文案區域 */}
            <div className="px-4 py-3 space-y-2">
              <div className="text-sm leading-relaxed text-slate-800">
                {loading ? (
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-200 animate-pulse rounded w-3/4"></div>
                    <div className="h-3 bg-slate-200 animate-pulse rounded w-1/2"></div>
                  </div>
                ) : result?.caption ? (
                  <span 
                    dangerouslySetInnerHTML={{ __html: result.caption.replace(/\n/g, '<br />') }} 
                  />
                ) : (
                  <span className="text-slate-400 italic">貼文文案將顯示於此...</span>
                )}
              </div>

              {/* 互動統計 */}
              <div className="flex items-center gap-4 pt-2 text-xs text-slate-500">
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-[#0077B5]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"/>
                  </svg>
                  <span>1.2K</span>
                </div>
                <span>•</span>
                <span>45 則留言</span>
                <span>•</span>
                <span>12 次轉發</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Threads 專屬預覽組件
function ThreadsPreview({ 
  loading, 
  result, 
  quality,
  navigationOverlay
}: { 
  loading: boolean; 
  result: { image_url: string; caption: string } | null; 
  quality: "draft" | "standard" | "premium";
  navigationOverlay?: React.ReactNode;
}) {
  return (
    <div className="relative w-[375px] shrink-0">
      {/* 手機外框 */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black rounded-[50px] shadow-[0_20px_60px_rgba(0,0,0,0.4),inset_0_2px_10px_rgba(255,255,255,0.1)]"></div>
      
      {/* Threads 手機螢幕 */}
      <div className="relative bg-white rounded-[42px] overflow-hidden border-[10px] border-slate-900 shadow-[inset_0_0_20px_rgba(0,0,0,0.1)]">
        {/* iOS 狀態欄 */}
        <div className="h-7 bg-white flex items-center justify-between px-4 text-[10px] font-semibold text-black">
          <span>9:41</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-2 border border-black rounded-sm">
              <div className="w-3 h-full bg-black rounded-sm"></div>
            </div>
            <svg className="w-4 h-3 text-black" viewBox="0 0 24 12" fill="none">
              <path d="M1 6h22M20 1l3 5-3 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        {/* Threads 頂部列 */}
        <div className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {/* Threads Logo */}
            <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 19c-.721 0-1.418-.109-2.073-.312a4.5 4.5 0 0 1-2.198-2.198C7.109 15.418 7 14.721 7 14s.109-1.418.312-2.073a4.5 4.5 0 0 1 2.198-2.198C10.582 9.109 11.279 9 12 9s1.418.109 2.073.312a4.5 4.5 0 0 1 2.198 2.198C16.891 12.582 17 13.279 17 14s-.109 1.418-.312 2.073a4.5 4.5 0 0 1-2.198 2.198C13.418 18.891 12.721 19 12 19z"/>
            </svg>
            <span className="text-black font-bold text-lg">Threads</span>
          </div>
          <div className="flex items-center gap-3">
            {/* 搜尋圖示 */}
            <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {/* 新增圖示 */}
            <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
        </div>

        {/* Threads 貼文區域 */}
        <div className="bg-white">
          {/* 用戶資訊列 */}
          <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-3">
              <BrandLogo size="md" className="w-10 h-10 border border-slate-200" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-black">king_jam_ai</span>
                <span className="text-xs text-slate-500">2 小時前</span>
              </div>
            </div>
            <button className="p-1 hover:bg-slate-100 rounded-full transition-colors">
              <svg className="w-5 h-5 text-slate-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>
          </div>

          {/* Threads 圖片區域 - 正方形 */}
          <div className="relative aspect-square bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center group overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center gap-4 text-slate-400">
                <div className="relative">
                  <div className="absolute inset-0 bg-black/20 rounded-full blur-xl animate-pulse"></div>
                  <Loader2 className="h-12 w-12 animate-spin text-black relative z-10" />
                </div>
                <div className="text-center">
                  <span className="text-sm font-medium block animate-pulse">AI 正在繪圖中...</span>
                  <span className="text-xs text-slate-400 mt-1 block">請稍候片刻</span>
                </div>
              </div>
            ) : result?.image_url ? (
              <div className="relative w-full h-full group">
                <img 
                  src={result.image_url} 
                  alt="Generated Content" 
                  className="w-full h-full object-cover"
                />
                {/* 品質標籤 */}
                <Badge className="absolute top-3 left-3 bg-black/70 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white shadow-lg px-3 py-1 text-xs font-semibold">
                  {quality === 'draft' && '⚡'}
                  {quality === 'standard' && '✨'}
                  {quality === 'premium' && '💎'}
                  {' '}
                  {quality.toUpperCase()}
                </Badge>
                {navigationOverlay}
              </div>
            ) : (
              <div className="text-slate-300 flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-black/10 rounded-full blur-2xl"></div>
                  <Sparkles className="h-16 w-16 relative z-10 text-slate-300" />
                </div>
                <div className="text-center">
                  <span className="text-sm font-medium block">預覽區域</span>
                  <span className="text-xs text-slate-400 mt-1 block">生成後將顯示於此</span>
                </div>
              </div>
            )}
          </div>

          {/* Threads 互動按鈕列 */}
          <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-4">
              {/* 愛心按鈕 */}
              <button className="flex items-center gap-2 group">
                <div className="w-8 h-8 rounded-full flex items-center justify-center group-hover:bg-slate-100 transition-colors">
                  <Heart className="w-6 h-6 text-black group-hover:text-red-500 transition-colors fill-transparent group-hover:fill-red-500" />
                </div>
                <span className="text-sm font-semibold text-black">1.2K</span>
              </button>

              {/* 回覆按鈕 */}
              <button className="flex items-center gap-2 group">
                <div className="w-8 h-8 rounded-full flex items-center justify-center group-hover:bg-slate-100 transition-colors">
                  <MessageCircle className="w-6 h-6 text-black group-hover:text-blue-500 transition-colors" />
                </div>
                <span className="text-sm font-semibold text-black">45</span>
              </button>

              {/* 轉發按鈕 */}
              <button className="flex items-center gap-2 group">
                <div className="w-8 h-8 rounded-full flex items-center justify-center group-hover:bg-slate-100 transition-colors">
                  <svg className="w-6 h-6 text-black group-hover:text-green-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-black">12</span>
              </button>

              {/* 分享按鈕 */}
              <button className="flex items-center gap-2 group">
                <div className="w-8 h-8 rounded-full flex items-center justify-center group-hover:bg-slate-100 transition-colors">
                  <Send className="w-6 h-6 text-black group-hover:text-blue-400 transition-colors" />
                </div>
              </button>
            </div>

            {/* 儲存按鈕 */}
            <button className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <Bookmark className="w-5 h-5 text-black" />
            </button>
          </div>

          {/* Threads 文案區域 */}
          <div className="px-4 py-3 space-y-2">
            <div className="text-sm leading-relaxed text-black">
              {loading ? (
                <div className="space-y-2">
                  <div className="h-3 bg-slate-200 animate-pulse rounded w-3/4"></div>
                  <div className="h-3 bg-slate-200 animate-pulse rounded w-1/2"></div>
                </div>
              ) : result?.caption ? (
                <span 
                  dangerouslySetInnerHTML={{ __html: result.caption.replace(/\n/g, '<br />') }} 
                />
              ) : (
                <span className="text-slate-400 italic">貼文文案將顯示於此...</span>
              )}
            </div>

            {/* 查看回覆 */}
            <button className="text-xs text-slate-500 hover:text-slate-700 transition-colors">
              查看 45 則回覆
            </button>
          </div>
        </div>

        {/* Threads 底部導航欄 */}
        <div className="h-14 bg-white border-t border-slate-200 flex items-center justify-around">
          <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <div className="w-7 h-7 rounded-full bg-slate-200"></div>
        </div>
      </div>
    </div>
  );
}

// Pinterest 專屬預覽組件
function PinterestPreview({ 
  loading, 
  result, 
  quality,
  navigationOverlay
}: { 
  loading: boolean; 
  result: { image_url: string; caption: string } | null; 
  quality: "draft" | "standard" | "premium";
  navigationOverlay?: React.ReactNode;
}) {
  return (
    <div className="relative w-[375px] shrink-0">
      {/* 手機外框 */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black rounded-[50px] shadow-[0_20px_60px_rgba(0,0,0,0.4),inset_0_2px_10px_rgba(255,255,255,0.1)]"></div>
      
      {/* Pinterest 手機螢幕 */}
      <div className="relative bg-white rounded-[42px] overflow-hidden border-[10px] border-slate-900 shadow-[inset_0_0_20px_rgba(0,0,0,0.1)]">
        {/* iOS 狀態欄 */}
        <div className="h-7 bg-white flex items-center justify-between px-4 text-[10px] font-semibold text-black">
          <span>9:41</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-2 border border-black rounded-sm">
              <div className="w-3 h-full bg-black rounded-sm"></div>
            </div>
            <svg className="w-4 h-3 text-black" viewBox="0 0 24 12" fill="none">
              <path d="M1 6h22M20 1l3 5-3 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        {/* Pinterest 頂部列 - 紅色主題 */}
        <div className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {/* Pinterest Logo */}
            <svg className="w-7 h-7 text-[#BD081C]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 19c-.721 0-1.418-.109-2.073-.312a4.5 4.5 0 0 1-2.198-2.198C7.109 15.418 7 14.721 7 14s.109-1.418.312-2.073a4.5 4.5 0 0 1 2.198-2.198C10.582 9.109 11.279 9 12 9s1.418.109 2.073.312a4.5 4.5 0 0 1 2.198 2.198C16.891 12.582 17 13.279 17 14s-.109 1.418-.312 2.073a4.5 4.5 0 0 1-2.198 2.198C13.418 18.891 12.721 19 12 19z"/>
            </svg>
            <span className="text-black font-bold text-lg">Pinterest</span>
          </div>
          <div className="flex items-center gap-3">
            {/* 搜尋圖示 */}
            <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {/* 訊息圖示 */}
            <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        </div>

        {/* Pinterest 圖片區域 - 2:3 垂直 */}
        <div className="relative aspect-[2/3] bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center group overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center gap-4 text-slate-400">
              <div className="relative">
                <div className="absolute inset-0 bg-red-500/20 rounded-full blur-xl animate-pulse"></div>
                <Loader2 className="h-12 w-12 animate-spin text-[#BD081C] relative z-10" />
              </div>
              <div className="text-center">
                <span className="text-sm font-medium block animate-pulse">AI 正在繪圖中...</span>
                <span className="text-xs text-slate-400 mt-1 block">請稍候片刻</span>
              </div>
            </div>
          ) : result?.image_url ? (
            <div className="relative w-full h-full group">
              <img 
                src={result.image_url} 
                alt="Generated Content" 
                className="w-full h-full object-cover"
              />
              {/* Pinterest 儲存按鈕 - 浮動在右上角 */}
              <button className="absolute top-3 right-3 bg-[#BD081C] hover:bg-[#8B0615] text-white px-4 py-2 rounded-full font-semibold text-sm shadow-lg transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
                </svg>
                儲存
              </button>
              {/* 品質標籤 */}
              <Badge className="absolute top-3 left-3 bg-black/70 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white shadow-lg px-3 py-1 text-xs font-semibold">
                {quality === 'draft' && '⚡'}
                {quality === 'standard' && '✨'}
                {quality === 'premium' && '💎'}
                {' '}
                {quality.toUpperCase()}
              </Badge>
              {navigationOverlay}
            </div>
          ) : (
            <div className="text-slate-300 flex flex-col items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-red-500/10 rounded-full blur-2xl"></div>
                <Sparkles className="h-16 w-16 relative z-10 text-slate-300" />
              </div>
              <div className="text-center">
                <span className="text-sm font-medium block">預覽區域</span>
                <span className="text-xs text-slate-400 mt-1 block">生成後將顯示於此</span>
              </div>
            </div>
          )}
        </div>

        {/* Pinterest 資訊區域 */}
        <div className="px-4 py-3 space-y-2 bg-white border-b border-slate-200">
          {/* 用戶資訊 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BrandLogo size="sm" className="w-8 h-8" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-black">King Jam AI</span>
                <span className="text-xs text-slate-500">2 小時前</span>
              </div>
            </div>
            <button className="p-1 hover:bg-slate-100 rounded-full transition-colors">
              <svg className="w-5 h-5 text-slate-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>
          </div>

          {/* 文案 */}
          <div className="text-sm leading-relaxed text-slate-800">
            {loading ? (
              <div className="space-y-2">
                <div className="h-3 bg-slate-200 animate-pulse rounded w-3/4"></div>
                <div className="h-3 bg-slate-200 animate-pulse rounded w-1/2"></div>
              </div>
            ) : result?.caption ? (
              <span 
                dangerouslySetInnerHTML={{ __html: result.caption.replace(/\n/g, '<br />') }} 
              />
            ) : (
              <span className="text-slate-400 italic">貼文文案將顯示於此...</span>
            )}
          </div>

          {/* 互動統計 */}
          <div className="flex items-center gap-4 pt-2 text-xs text-slate-600">
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              <span>1.2K</span>
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
              </svg>
              <span>45</span>
            </div>
          </div>
        </div>

        {/* Pinterest 底部導航欄 */}
        <div className="h-12 bg-white border-t border-slate-200 flex items-center justify-around">
          <svg className="w-6 h-6 text-[#BD081C]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 19c-.721 0-1.418-.109-2.073-.312a4.5 4.5 0 0 1-2.198-2.198C7.109 15.418 7 14.721 7 14s.109-1.418.312-2.073a4.5 4.5 0 0 1 2.198-2.198C10.582 9.109 11.279 9 12 9s1.418.109 2.073.312a4.5 4.5 0 0 1 2.198 2.198C16.891 12.582 17 13.279 17 14s-.109 1.418-.312 2.073a4.5 4.5 0 0 1-2.198 2.198C13.418 18.891 12.721 19 12 19z"/>
          </svg>
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <div className="w-10 h-10 rounded-lg bg-[#BD081C] flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
          </svg>
          <div className="w-7 h-7 rounded-full bg-slate-200"></div>
        </div>
      </div>
    </div>
  );
}

// TikTok 專屬預覽組件
function TikTokPreview({ 
  loading, 
  result, 
  quality,
  navigationOverlay
}: { 
  loading: boolean; 
  result: { image_url: string; caption: string } | null; 
  quality: "draft" | "standard" | "premium";
  navigationOverlay?: React.ReactNode;
}) {
  return (
    <div className="relative w-[375px] shrink-0">
      {/* 手機外框 */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black rounded-[50px] shadow-[0_20px_60px_rgba(0,0,0,0.4),inset_0_2px_10px_rgba(255,255,255,0.1)]"></div>
      
      {/* TikTok 手機螢幕 - 垂直全螢幕 */}
      <div className="relative bg-black rounded-[42px] overflow-hidden border-[10px] border-slate-900 shadow-[inset_0_0_20px_rgba(0,0,0,0.1)]">
        {/* iOS 狀態欄 - 黑色背景 */}
        <div className="h-7 bg-black flex items-center justify-between px-4 text-[10px] font-semibold text-white">
          <span>9:41</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-2 border border-white rounded-sm">
              <div className="w-3 h-full bg-white rounded-sm"></div>
            </div>
            <svg className="w-4 h-3 text-white" viewBox="0 0 24 12" fill="none">
              <path d="M1 6h22M20 1l3 5-3 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        {/* TikTok 圖片/影片區域 - 9:16 垂直 */}
        <div className="relative aspect-[9/16] bg-black flex items-center justify-center group overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center gap-4 text-white">
              <div className="relative">
                <div className="absolute inset-0 bg-pink-500/20 rounded-full blur-xl animate-pulse"></div>
                <Loader2 className="h-12 w-12 animate-spin text-pink-500 relative z-10" />
              </div>
              <div className="text-center">
                <span className="text-sm font-medium block animate-pulse">AI 正在繪圖中...</span>
                <span className="text-xs text-slate-400 mt-1 block">請稍候片刻</span>
              </div>
            </div>
          ) : result?.image_url ? (
            <div className="relative w-full h-full group">
              <img 
                src={result.image_url} 
                alt="Generated Content" 
                className="w-full h-full object-cover"
              />
              {/* 品質標籤 */}
              <Badge className="absolute top-3 left-3 bg-black/70 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white shadow-lg px-3 py-1 text-xs font-semibold">
                {quality === 'draft' && '⚡'}
                {quality === 'standard' && '✨'}
                {quality === 'premium' && '💎'}
                {' '}
                {quality.toUpperCase()}
              </Badge>
              {navigationOverlay}
            </div>
          ) : (
            <div className="text-slate-400 flex flex-col items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-pink-500/10 rounded-full blur-2xl"></div>
                <Sparkles className="h-16 w-16 relative z-10 text-slate-400" />
              </div>
              <div className="text-center">
                <span className="text-sm font-medium block">預覽區域</span>
                <span className="text-xs text-slate-500 mt-1 block">生成後將顯示於此</span>
              </div>
            </div>
          )}

          {/* TikTok 右側互動按鈕列 */}
          <div className="absolute right-3 bottom-20 flex flex-col gap-6 items-center">
            {/* 頭像 */}
            <div className="relative">
              <BrandLogo size="lg" className="w-12 h-12 border-2 border-white" />
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-5 bg-pink-500 rounded-full border-2 border-black flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </div>

            {/* 愛心按鈕 */}
            <button className="flex flex-col items-center gap-1 group">
              <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-md border border-white/20 flex items-center justify-center group-hover:bg-black/50 transition-colors">
                <Heart className="w-7 h-7 text-white group-hover:text-pink-500 transition-colors fill-transparent group-hover:fill-pink-500" />
              </div>
              <span className="text-xs text-white font-semibold">1.2K</span>
            </button>

            {/* 留言按鈕 */}
            <button className="flex flex-col items-center gap-1 group">
              <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-md border border-white/20 flex items-center justify-center group-hover:bg-black/50 transition-colors">
                <MessageCircle className="w-7 h-7 text-white group-hover:text-blue-400 transition-colors" />
              </div>
              <span className="text-xs text-white font-semibold">45</span>
            </button>

            {/* 收藏按鈕 */}
            <button className="flex flex-col items-center gap-1 group">
              <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-md border border-white/20 flex items-center justify-center group-hover:bg-black/50 transition-colors">
                <Bookmark className="w-7 h-7 text-white group-hover:text-yellow-400 transition-colors fill-transparent group-hover:fill-yellow-400" />
              </div>
              <span className="text-xs text-white font-semibold">12</span>
            </button>

            {/* 分享按鈕 */}
            <button className="flex flex-col items-center gap-1 group">
              <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-md border border-white/20 flex items-center justify-center group-hover:bg-black/50 transition-colors">
                <Send className="w-7 h-7 text-white group-hover:text-green-400 transition-colors" />
              </div>
              <span className="text-xs text-white font-semibold">分享</span>
            </button>
          </div>

          {/* TikTok 底部資訊區域 */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-4 pb-6">
            {/* 用戶名和音樂 */}
            <div className="flex items-center gap-3 mb-2">
              <span className="text-white font-bold text-base">@king_jam_ai</span>
              <div className="flex items-center gap-2 px-3 py-1 bg-black/30 backdrop-blur-md rounded-full border border-white/20">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
                <span className="text-xs text-white font-medium">原創音樂</span>
              </div>
            </div>

            {/* 文案 */}
            <div className="text-sm text-white leading-relaxed mb-3">
              {loading ? (
                <div className="space-y-2">
                  <div className="h-3 bg-white/20 animate-pulse rounded w-3/4"></div>
                  <div className="h-3 bg-white/20 animate-pulse rounded w-1/2"></div>
                </div>
              ) : result?.caption ? (
                <span 
                  className="text-white" 
                  dangerouslySetInnerHTML={{ __html: result.caption.replace(/\n/g, '<br />') }} 
                />
              ) : (
                <span className="text-white/60 italic">貼文文案將顯示於此...</span>
              )}
            </div>

            {/* Hashtag 標籤 */}
            {result && (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-white/80 font-semibold">#KingJinkAI</span>
                <span className="text-xs text-white/80 font-semibold">#AI生成</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// LINE 專屬預覽組件
function LinePreview({ 
  loading, 
  result, 
  quality,
  navigationOverlay
}: { 
  loading: boolean; 
  result: { image_url: string; caption: string } | null; 
  quality: "draft" | "standard" | "premium";
  navigationOverlay?: React.ReactNode;
}) {
  return (
    <div className="relative w-[375px] shrink-0">
      {/* 手機外框 */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black rounded-[50px] shadow-[0_20px_60px_rgba(0,0,0,0.4),inset_0_2px_10px_rgba(255,255,255,0.1)]"></div>
      
      {/* LINE 手機螢幕 */}
      <div className="relative bg-white rounded-[42px] overflow-hidden border-[10px] border-slate-900 shadow-[inset_0_0_20px_rgba(0,0,0,0.1)]">
        {/* iOS 狀態欄 */}
        <div className="h-7 bg-white flex items-center justify-between px-4 text-[10px] font-semibold text-black">
          <span>9:41</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-2 border border-black rounded-sm">
              <div className="w-3 h-full bg-black rounded-sm"></div>
            </div>
            <svg className="w-4 h-3 text-black" viewBox="0 0 24 12" fill="none">
              <path d="M1 6h22M20 1l3 5-3 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        {/* LINE 頂部列 - 綠色主題 */}
        <div className="h-12 bg-[#00C300] flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {/* LINE Logo */}
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-[#00C300]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.27l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.086.766.063.841l-.164.975c-.037.231-.239.895.705.515.943-.382 5.59-3.226 7.646-5.414.88-.785 1.463-1.643 1.89-2.531C22.809 15.104 24 12.88 24 10.314"/>
              </svg>
            </div>
            <span className="text-white font-bold text-lg">LINE</span>
          </div>
          <div className="flex items-center gap-3">
            {/* 搜尋圖示 */}
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {/* 更多圖示 */}
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </div>
        </div>

        {/* LINE 貼文頭部 */}
        <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {/* LINE 風格的圓形頭像 */}
            <BrandLogo size="md" className="w-10 h-10 border-2 border-[#00C300]" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-black leading-tight">King Jam AI</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500">2 小時前</span>
                <span className="text-[10px] text-slate-400">·</span>
                <svg className="w-3 h-3 text-[#00C300]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
            </div>
          </div>
          <button className="p-1">
            <svg className="w-5 h-5 text-slate-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
          </button>
        </div>

        {/* LINE 圖片區域 - 正方形 */}
        <div className="aspect-square bg-gradient-to-br from-slate-50 to-slate-100 relative flex items-center justify-center group overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center gap-4 text-slate-400">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl animate-pulse"></div>
                <Loader2 className="h-12 w-12 animate-spin text-[#00C300] relative z-10" />
              </div>
              <div className="text-center">
                <span className="text-sm font-medium block animate-pulse">AI 正在繪圖中...</span>
                <span className="text-xs text-slate-400 mt-1 block">請稍候片刻</span>
              </div>
            </div>
          ) : result?.image_url ? (
            <div className="relative w-full h-full group">
              <img 
                src={result.image_url} 
                alt="Generated Content" 
                className="w-full h-full object-cover"
              />
              {navigationOverlay}
            </div>
          ) : (
            <div className="text-slate-300 flex flex-col items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500/10 rounded-full blur-2xl"></div>
                <Sparkles className="h-16 w-16 relative z-10 text-slate-300" />
              </div>
              <div className="text-center">
                <span className="text-sm font-medium block">預覽區域</span>
                <span className="text-xs text-slate-400 mt-1 block">生成後將顯示於此</span>
              </div>
            </div>
          )}
          
          {/* 品質標籤 */}
          {result && (
            <Badge className="absolute top-3 right-3 bg-black/70 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white shadow-lg px-3 py-1 text-xs font-semibold">
              {quality === 'draft' && '⚡'}
              {quality === 'standard' && '✨'}
              {quality === 'premium' && '💎'}
              {' '}
              {quality.toUpperCase()}
            </Badge>
          )}
        </div>

        {/* LINE 互動按鈕列 - 綠色主題 */}
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {/* 讚數顯示 */}
              <div className="flex items-center gap-1">
                <svg className="w-5 h-5 text-[#00C300]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
                <span className="text-xs text-slate-600 font-medium">1.2K</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span>45 則留言</span>
              <span>12 次分享</span>
            </div>
          </div>
          
          {/* LINE 按鈕列 */}
          <div className="flex items-center border-t border-slate-200 pt-2">
            <button className="flex-1 flex items-center justify-center gap-2 py-2 hover:bg-slate-50 rounded-lg transition-colors group">
              <svg className="w-5 h-5 text-slate-600 group-hover:text-[#00C300] transition-colors" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              <span className="text-sm font-semibold text-slate-600 group-hover:text-[#00C300] transition-colors">讚</span>
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 py-2 hover:bg-slate-50 rounded-lg transition-colors group">
              <svg className="w-5 h-5 text-slate-600 group-hover:text-[#00C300] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="text-sm font-semibold text-slate-600 group-hover:text-[#00C300] transition-colors">留言</span>
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 py-2 hover:bg-slate-50 rounded-lg transition-colors group">
              <svg className="w-5 h-5 text-slate-600 group-hover:text-[#00C300] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342c-.714 0-1.314-.59-1.314-1.313 0-.726.6-1.314 1.314-1.314.716 0 1.314.588 1.314 1.314 0 .723-.598 1.313-1.314 1.313zm5.316 0c-.714 0-1.314-.59-1.314-1.313 0-.726.6-1.314 1.314-1.314.716 0 1.314.588 1.314 1.314 0 .723-.598 1.313-1.314 1.313zm5.316 0c-.714 0-1.314-.59-1.314-1.313 0-.726.6-1.314 1.314-1.314.716 0 1.314.588 1.314 1.314 0 .723-.598 1.313-1.314 1.313z" />
              </svg>
              <span className="text-sm font-semibold text-slate-600 group-hover:text-[#00C300] transition-colors">分享</span>
            </button>
          </div>
        </div>

        {/* LINE 文案區域 */}
        <div className="px-4 py-3 space-y-2 bg-white">
          <div className="text-sm leading-relaxed">
            {loading ? (
              <div className="space-y-2">
                <div className="h-3 bg-slate-200 animate-pulse rounded w-3/4"></div>
                <div className="h-3 bg-slate-200 animate-pulse rounded w-1/2"></div>
              </div>
            ) : result?.caption ? (
              <span 
                className="text-slate-800" 
                dangerouslySetInnerHTML={{ __html: result.caption.replace(/\n/g, '<br />') }} 
              />
            ) : (
              <span className="text-slate-400 italic">貼文文案將顯示於此...</span>
            )}
          </div>
        </div>

        {/* LINE 底部導航欄 */}
        <div className="h-12 bg-white border-t border-slate-200 flex items-center justify-around">
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <div className="w-10 h-10 rounded-full bg-[#00C300] flex items-center justify-center">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.27l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.086.766.063.841l-.164.975c-.037.231-.239.895.705.515.943-.382 5.59-3.226 7.646-5.414.88-.785 1.463-1.643 1.89-2.531C22.809 15.104 24 12.88 24 10.314"/>
            </svg>
          </div>
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
          </svg>
          <div className="w-7 h-7 rounded-full bg-slate-200"></div>
        </div>
      </div>
    </div>
  );
}

// Facebook 專屬預覽組件
function FacebookPreview({ 
  loading, 
  result, 
  quality,
  navigationOverlay
}: { 
  loading: boolean; 
  result: { image_url: string; caption: string } | null; 
  quality: "draft" | "standard" | "premium";
  navigationOverlay?: React.ReactNode;
}) {
  return (
    <div className="relative w-[375px] shrink-0">
      {/* 手機外框 */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black rounded-[50px] shadow-[0_20px_60px_rgba(0,0,0,0.4),inset_0_2px_10px_rgba(255,255,255,0.1)]"></div>
      
      {/* Facebook 手機螢幕 */}
      <div className="relative bg-white rounded-[42px] overflow-hidden border-[10px] border-slate-900 shadow-[inset_0_0_20px_rgba(0,0,0,0.1)]">
        {/* iOS 狀態欄 */}
        <div className="h-7 bg-white flex items-center justify-between px-4 text-[10px] font-semibold text-black">
          <span>9:41</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-2 border border-black rounded-sm">
              <div className="w-3 h-full bg-black rounded-sm"></div>
            </div>
            <svg className="w-4 h-3 text-black" viewBox="0 0 24 12" fill="none">
              <path d="M1 6h22M20 1l3 5-3 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        {/* Facebook 頂部列 - 藍色主題 */}
        <div className="h-12 bg-[#1877F2] flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {/* Facebook Logo */}
            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            <span className="text-white font-semibold text-lg">facebook</span>
          </div>
          <div className="flex items-center gap-3">
            {/* 搜尋圖示 */}
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {/* 訊息圖示 */}
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        </div>

        {/* Facebook 貼文頭部 */}
        <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {/* Facebook 風格的圓形頭像 */}
            <BrandLogo size="md" className="w-10 h-10 border-2 border-slate-200" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-black leading-tight">King Jam AI</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500">2 小時前</span>
                <span className="text-[10px] text-slate-400">·</span>
                <svg className="w-3 h-3 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
            </div>
          </div>
          <button className="p-1">
            <svg className="w-5 h-5 text-slate-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
          </button>
        </div>

        {/* Facebook 圖片區域 - 正方形 */}
        <div className="aspect-square bg-gradient-to-br from-slate-50 to-slate-100 relative flex items-center justify-center group overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center gap-4 text-slate-400">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse"></div>
                <Loader2 className="h-12 w-12 animate-spin text-blue-500 relative z-10" />
              </div>
              <div className="text-center">
                <span className="text-sm font-medium block animate-pulse">AI 正在繪圖中...</span>
                <span className="text-xs text-slate-400 mt-1 block">請稍候片刻</span>
              </div>
            </div>
          ) : result?.image_url ? (
            <div className="relative w-full h-full group">
              <img 
                src={result.image_url} 
                alt="Generated Content" 
                className="w-full h-full object-cover"
              />
              {navigationOverlay}
            </div>
          ) : (
            <div className="text-slate-300 flex flex-col items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-2xl"></div>
                <Sparkles className="h-16 w-16 relative z-10 text-slate-300" />
              </div>
              <div className="text-center">
                <span className="text-sm font-medium block">預覽區域</span>
                <span className="text-xs text-slate-400 mt-1 block">生成後將顯示於此</span>
              </div>
            </div>
          )}
          
          {/* 品質標籤 */}
          {result && (
            <Badge className="absolute top-3 right-3 bg-black/70 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white shadow-lg px-3 py-1 text-xs font-semibold">
              {quality === 'draft' && '⚡'}
              {quality === 'standard' && '✨'}
              {quality === 'premium' && '💎'}
              {' '}
              {quality.toUpperCase()}
            </Badge>
          )}
        </div>

        {/* Facebook 互動按鈕列 - 藍色主題 */}
        <div className="px-4 py-2 border-b border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
              {/* 讚數圖示 */}
              <div className="flex -space-x-1">
                <div className="w-5 h-5 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zM12.1 18.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-8.9 10.05z"/>
                  </svg>
                </div>
                <div className="w-5 h-5 rounded-full bg-red-500 border-2 border-white flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                </div>
              </div>
              <span className="text-xs text-slate-600 font-medium">1.2K</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span>45 則留言</span>
              <span>12 次分享</span>
            </div>
          </div>
          
          {/* Facebook 按鈕列 */}
          <div className="flex items-center border-t border-slate-200 pt-2">
            <button className="flex-1 flex items-center justify-center gap-2 py-2 hover:bg-slate-50 rounded-lg transition-colors group">
              <svg className="w-5 h-5 text-slate-600 group-hover:text-blue-500 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zM12.1 18.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-8.9 10.05z"/>
              </svg>
              <span className="text-sm font-semibold text-slate-600 group-hover:text-blue-500 transition-colors">讚</span>
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 py-2 hover:bg-slate-50 rounded-lg transition-colors group">
              <svg className="w-5 h-5 text-slate-600 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="text-sm font-semibold text-slate-600 group-hover:text-blue-500 transition-colors">留言</span>
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 py-2 hover:bg-slate-50 rounded-lg transition-colors group">
              <svg className="w-5 h-5 text-slate-600 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342c-.714 0-1.314-.59-1.314-1.313 0-.726.6-1.314 1.314-1.314.716 0 1.314.588 1.314 1.314 0 .723-.598 1.313-1.314 1.313zm5.316 0c-.714 0-1.314-.59-1.314-1.313 0-.726.6-1.314 1.314-1.314.716 0 1.314.588 1.314 1.314 0 .723-.598 1.313-1.314 1.313zm5.316 0c-.714 0-1.314-.59-1.314-1.313 0-.726.6-1.314 1.314-1.314.716 0 1.314.588 1.314 1.314 0 .723-.598 1.313-1.314 1.313z" />
              </svg>
              <span className="text-sm font-semibold text-slate-600 group-hover:text-blue-500 transition-colors">分享</span>
            </button>
          </div>
        </div>

        {/* Facebook 文案區域 */}
        <div className="px-4 py-3 space-y-2 bg-white">
          <div className="text-sm leading-relaxed">
            {loading ? (
              <div className="space-y-2">
                <div className="h-3 bg-slate-200 animate-pulse rounded w-3/4"></div>
                <div className="h-3 bg-slate-200 animate-pulse rounded w-1/2"></div>
              </div>
            ) : result?.caption ? (
              <span 
                className="text-slate-800" 
                dangerouslySetInnerHTML={{ __html: result.caption.replace(/\n/g, '<br />') }} 
              />
            ) : (
              <span className="text-slate-400 italic">貼文文案將顯示於此...</span>
            )}
          </div>
          
          <div className="text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span>查看翻譯</span>
          </div>
        </div>

        {/* Facebook 底部導航欄 */}
        <div className="h-12 bg-white border-t border-slate-200 flex items-center justify-around">
          <svg className="w-6 h-6 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-blue-400 to-blue-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
          </svg>
          <div className="w-7 h-7 rounded-full bg-slate-200"></div>
        </div>
      </div>
    </div>
  );
}

// Instagram 專屬預覽組件
function InstagramPreview({ 
  loading, 
  result, 
  quality,
  navigationOverlay
}: { 
  loading: boolean; 
  result: { image_url: string; caption: string } | null; 
  quality: "draft" | "standard" | "premium";
  navigationOverlay?: React.ReactNode;
}) {
  return (
    <div className="relative w-[375px] shrink-0">
      {/* 手機外框 */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black rounded-[50px] shadow-[0_20px_60px_rgba(0,0,0,0.4),inset_0_2px_10px_rgba(255,255,255,0.1)]"></div>
      
      {/* Instagram 手機螢幕 */}
      <div className="relative bg-white rounded-[42px] overflow-hidden border-[10px] border-slate-900 shadow-[inset_0_0_20px_rgba(0,0,0,0.1)]">
        {/* iOS 狀態欄 */}
        <div className="h-7 bg-white flex items-center justify-between px-4 text-[10px] font-semibold text-black">
          <span>9:41</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-2 border border-black rounded-sm">
              <div className="w-3 h-full bg-black rounded-sm"></div>
            </div>
            <svg className="w-4 h-3 text-black" viewBox="0 0 24 12" fill="none">
              <path d="M1 6h22M20 1l3 5-3 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        {/* Instagram 頂部列 - 經典 Instagram 風格 */}
        <div className="h-14 bg-white border-b border-slate-100 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {/* Instagram Logo */}
            <div className="w-24 h-7 relative">
              <svg viewBox="0 0 104 28" className="w-full h-full">
                <defs>
                  <linearGradient id="instagram-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#833AB4" />
                    <stop offset="50%" stopColor="#FD1D1D" />
                    <stop offset="100%" stopColor="#FCAF45" />
                  </linearGradient>
                </defs>
                <path d="M20.5 14c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5-2 4.5-4.5 4.5-4.5-2-4.5-4.5zm4.5-6.5c-3.6 0-6.5 2.9-6.5 6.5s2.9 6.5 6.5 6.5 6.5-2.9 6.5-6.5-2.9-6.5-6.5-6.5zm-1.5-2.5h3v-2h-3v2zm-6 2.5c0-5 4-9 9-9s9 4 9 9-4 9-9 9-9-4-9-9zm9-6.5c-3.6 0-6.5 2.9-6.5 6.5s2.9 6.5 6.5 6.5 6.5-2.9 6.5-6.5-2.9-6.5-6.5-6.5z" fill="url(#instagram-gradient)"/>
              </svg>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* 訊息圖示 */}
            <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        </div>

        {/* Instagram 貼文頭部 */}
        <div className="h-14 bg-white border-b border-slate-100 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {/* Instagram 風格的圓形頭像（帶漸層邊框） */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 rounded-full blur-sm opacity-60"></div>
              <div className="relative w-10 h-10 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2.5px]">
                <div className="w-full h-full rounded-full bg-white p-[1.5px] flex items-center justify-center">
                  <BrandLogo size="sm" className="w-full h-full" />
                </div>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-black leading-tight">king_jam_ai</span>
              <span className="text-[10px] text-slate-500">Sponsored</span>
            </div>
          </div>
          <button className="p-1">
            <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
          </button>
        </div>

        {/* Instagram 圖片區域 - 正方形 */}
        <div className="aspect-square bg-gradient-to-br from-slate-50 to-slate-100 relative flex items-center justify-center group overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center gap-4 text-slate-400">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl animate-pulse"></div>
                <Loader2 className="h-12 w-12 animate-spin text-indigo-500 relative z-10" />
              </div>
              <div className="text-center">
                <span className="text-sm font-medium block animate-pulse">AI 正在繪圖中...</span>
                <span className="text-xs text-slate-400 mt-1 block">請稍候片刻</span>
              </div>
            </div>
          ) : result?.image_url ? (
            <div className="relative w-full h-full group">
              <img 
                src={result.image_url} 
                alt="Generated Content" 
                className="w-full h-full object-cover"
              />
              {/* 導航箭頭覆蓋層 */}
              {navigationOverlay}
            </div>
          ) : (
            <div className="text-slate-300 flex flex-col items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/10 rounded-full blur-2xl"></div>
                <Sparkles className="h-16 w-16 relative z-10 text-slate-300" />
              </div>
              <div className="text-center">
                <span className="text-sm font-medium block">預覽區域</span>
                <span className="text-xs text-slate-400 mt-1 block">生成後將顯示於此</span>
              </div>
            </div>
          )}
          
          {/* 品質標籤 */}
          {result && (
            <Badge className="absolute top-3 right-3 bg-black/70 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white shadow-lg px-3 py-1 text-xs font-semibold">
              {quality === 'draft' && '⚡'}
              {quality === 'standard' && '✨'}
              {quality === 'premium' && '💎'}
              {' '}
              {quality.toUpperCase()}
            </Badge>
          )}
        </div>

        {/* Instagram 互動按鈕列 */}
        <div className="px-4 py-3 flex justify-between items-center border-b border-slate-100">
          <div className="flex gap-4">
            <button className="p-1 hover:scale-110 transition-transform">
              <Heart className="w-6 h-6 text-black hover:text-red-500 transition-colors fill-transparent hover:fill-red-500" />
            </button>
            <button className="p-1 hover:scale-110 transition-transform">
              <MessageCircle className="w-6 h-6 text-black hover:text-blue-500 transition-colors" />
            </button>
            <button className="p-1 hover:scale-110 transition-transform">
              <Send className="w-6 h-6 text-black hover:text-indigo-500 transition-colors" />
            </button>
          </div>
          <button className="p-1 hover:scale-110 transition-transform">
            <Bookmark className="w-6 h-6 text-black hover:text-yellow-500 transition-colors fill-transparent hover:fill-yellow-500" />
          </button>
        </div>

        {/* Instagram 文案區域 */}
        <div className="px-4 py-3 space-y-2 bg-white">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-5 h-5 rounded-full border-2 border-white bg-gradient-to-tr from-pink-400 to-purple-500"></div>
              ))}
            </div>
            <span className="text-sm font-semibold text-black">
              <span className="font-bold">1,204</span> 個讚
            </span>
          </div>
          
          <div className="text-sm leading-relaxed">
            <span className="font-semibold text-black mr-2">king_jam_ai</span>
            {loading ? (
              <div className="inline-block space-y-1">
                <span className="inline-block w-3/4 h-3 bg-slate-200 animate-pulse rounded"></span>
                <span className="inline-block w-1/2 h-3 bg-slate-200 animate-pulse rounded block"></span>
              </div>
            ) : result?.caption ? (
              <span 
                className="text-slate-800" 
                dangerouslySetInnerHTML={{ __html: result.caption.replace(/\n/g, '<br />') }} 
              />
            ) : (
              <span className="text-slate-400 italic">貼文文案將顯示於此...</span>
            )}
          </div>
          
          <div className="text-xs text-slate-400 uppercase tracking-wide">2 小時前</div>
        </div>

        {/* Instagram 底部導航欄 */}
        <div className="h-12 bg-white border-t border-slate-100 flex items-center justify-around text-black">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10.5 3.75L6 7.5v11.25h4.5V3.75zm7.5 0v15h4.5V7.5L18 3.75z"/>
          </svg>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-yellow-400 to-purple-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
          </svg>
          <div className="w-7 h-7 rounded-full bg-slate-200"></div>
        </div>
      </div>
    </div>
  );
}

// 平台配置（含推薦比例）
const PLATFORM_CONFIG = {
  instagram: {
    name: "Instagram",
    icon: "📷",
    aspectRatio: "aspect-square",
    ratioValue: 1,           // 1:1
    ratioLabel: "1:1 正方形",
    headerColor: "bg-white",
    primaryColor: "text-slate-900",
    showLikes: true,
    showComments: true,
    layout: "mobile",
  },
  facebook: {
    name: "Facebook",
    icon: "👥",
    aspectRatio: "aspect-square",
    ratioValue: 1,           // 1:1
    ratioLabel: "1:1 正方形",
    headerColor: "bg-white",
    primaryColor: "text-slate-900",
    showLikes: true,
    showComments: true,
    layout: "mobile",
  },
  tiktok: {
    name: "TikTok",
    icon: "🎵",
    aspectRatio: "aspect-[9/16]",
    ratioValue: 9/16,        // 9:16
    ratioLabel: "9:16 直式",
    headerColor: "bg-black",
    primaryColor: "text-white",
    showLikes: true,
    showComments: false,
    layout: "vertical",
  },
  pinterest: {
    name: "Pinterest",
    icon: "📌",
    aspectRatio: "aspect-[2/3]",
    ratioValue: 2/3,         // 2:3
    ratioLabel: "2:3 直式",
    headerColor: "bg-white",
    primaryColor: "text-slate-900",
    showLikes: true,
    showComments: false,
    layout: "vertical",
  },
  threads: {
    name: "Threads",
    icon: "🧵",
    aspectRatio: "aspect-square",
    ratioValue: 1,           // 1:1
    ratioLabel: "1:1 正方形",
    headerColor: "bg-white",
    primaryColor: "text-slate-900",
    showLikes: true,
    showComments: true,
    layout: "mobile",
  },
  linkedin: {
    name: "LinkedIn",
    icon: "💼",
    aspectRatio: "aspect-[1.91/1]",
    ratioValue: 1.91,        // 1.91:1
    ratioLabel: "1.91:1 橫式",
    headerColor: "bg-white",
    primaryColor: "text-slate-900",
    showLikes: false,
    showComments: false,
    layout: "desktop",
  },
  xiaohongshu: {
    name: "小紅書",
    icon: "📖",
    aspectRatio: "aspect-[3/4]",
    ratioValue: 3/4,         // 3:4
    ratioLabel: "3:4 直式",
    headerColor: "bg-white",
    primaryColor: "text-slate-900",
    showLikes: true,
    showComments: true,
    layout: "vertical",
  },
  line: {
    name: "LINE",
    icon: "💬",
    aspectRatio: "aspect-square",
    ratioValue: 1,           // 1:1
    ratioLabel: "1:1 正方形",
    headerColor: "bg-white",
    primaryColor: "text-slate-900",
    showLikes: true,
    showComments: true,
    layout: "mobile",
  },
};

// 檢查圖片比例是否符合平台要求
const checkImageRatio = (width: number, height: number, platformRatio: number): { match: boolean; actualRatio: number; suggestion: string } => {
  const actualRatio = width / height;
  const tolerance = 0.15; // 15% 容差
  const match = Math.abs(actualRatio - platformRatio) / platformRatio <= tolerance;
  
  let suggestion = "";
  if (!match) {
    if (actualRatio > platformRatio) {
      suggestion = "建議裁切左右兩側，或選擇橫式平台";
    } else {
      suggestion = "建議裁切上下兩側，或選擇直式平台";
    }
  }
  
  return { match, actualRatio, suggestion };
};

// 獲取圖片尺寸（僅客戶端，使用原生 HTMLImageElement）
const getImageSize = (dataUrl: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve({ width: 0, height: 0 });
      return;
    }
    // 使用 document.createElement 避免與 Next.js Image 組件衝突
    const img = document.createElement('img');
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = dataUrl;
  });
};

// 自動裁切圖片到指定比例
const autoCropImage = (dataUrl: string, targetRatio: number): Promise<{ croppedDataUrl: string; cropDirection: 'horizontal' | 'vertical' | 'none' }> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve({ croppedDataUrl: dataUrl, cropDirection: 'none' });
      return;
    }
    
    const img = document.createElement('img');
    img.onload = () => {
      const { naturalWidth: width, naturalHeight: height } = img;
      const actualRatio = width / height;
      const tolerance = 0.15;
      
      // 如果比例已經符合，直接返回原圖
      if (Math.abs(actualRatio - targetRatio) / targetRatio <= tolerance) {
        resolve({ croppedDataUrl: dataUrl, cropDirection: 'none' });
        return;
      }
      
      // 創建 Canvas 進行裁切
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve({ croppedDataUrl: dataUrl, cropDirection: 'none' });
        return;
      }
      
      let cropX = 0, cropY = 0, cropWidth = width, cropHeight = height;
      let cropDirection: 'horizontal' | 'vertical' = 'horizontal';
      
      if (actualRatio > targetRatio) {
        // 圖片太寬，需要裁切左右兩側
        cropWidth = Math.round(height * targetRatio);
        cropX = Math.round((width - cropWidth) / 2);
        cropDirection = 'horizontal';
      } else {
        // 圖片太高，需要裁切上下兩側
        cropHeight = Math.round(width / targetRatio);
        cropY = Math.round((height - cropHeight) / 2);
        cropDirection = 'vertical';
      }
      
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      
      ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      
      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      resolve({ croppedDataUrl, cropDirection });
    };
    
    img.onerror = () => resolve({ croppedDataUrl: dataUrl, cropDirection: 'none' });
    img.src = dataUrl;
  });
};

export default function SocialPage() {
  const router = useRouter();
  const { refreshCredits } = useCredits();
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestAbortController, setSuggestAbortController] = useState<AbortController | null>(null);
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [tone, setTone] = useState("engaging");
  const [quality, setQuality] = useState<"draft" | "standard" | "premium">("standard");
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // 新增的自填欄位
  const [keywords, setKeywords] = useState(""); // 貼文關鍵詞
  const [imagePrompt, setImagePrompt] = useState(""); // 圖片提示詞
  const [productInfo, setProductInfo] = useState(""); // 商品資訊
  
  // 生成結果 - 支持多圖
  const [result, setResult] = useState<{
    image_url: string;      // 主圖（向後兼容）
    image_urls: string[];   // 多圖陣列
    caption: string;
  } | null>(null);
  
  // 使用 ref 追蹤最新的 result（用於閉包中存取）
  const resultRef = React.useRef(result);
  React.useEffect(() => {
    resultRef.current = result;
  }, [result]);
  
  // 當前顯示的圖片索引（用於多圖輪播）
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // 用戶上傳的額外圖片
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  
  // 新增：進階選項折疊、複製狀態
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  
  // 排程上架狀態
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleContent, setScheduleContent] = useState<ScheduleContent | null>(null);
  
  // 文案編輯
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [editedCaption, setEditedCaption] = useState("");
  
  // 載入進度
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // 歷史記錄
  const [history, setHistory] = useState<SocialHistoryRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<number>>(new Set());
  const [isHistorySelectionMode, setIsHistorySelectionMode] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  
  // 圖片標題編輯器
  const [showImageEditor, setShowImageEditor] = useState(false);
  
  // 圖庫選擇 Dialog
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);
  const [galleryImages, setGalleryImages] = useState<SharedImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  
  // 圖片比例警告
  const [ratioWarnings, setRatioWarnings] = useState<string[]>([]);
  
  // 載入圖庫圖片
  const loadGalleryImages = async () => {
    setGalleryLoading(true);
    try {
      const images = await sharedGalleryService.getAllImages();
      setGalleryImages(images);
    } catch (e) {
      console.error("載入圖庫失敗:", e);
    } finally {
      setGalleryLoading(false);
    }
  };
  
  // 從圖庫添加圖片到多圖列表
  const addImageFromGallery = async (image: SharedImage) => {
    // 計算當前總圖片數
    const currentImages = result?.image_urls?.length || uploadedImages.length;
    
    if (currentImages >= 20) {
      toast.error("已達到最大圖片數量 (20 張)");
      return;
    }
    
    const imageToAdd = image.dataUrl;
    
    // 檢查比例（僅提示）
    const platformConfig = PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG];
    if (platformConfig) {
      const { match, suggestion } = checkImageRatio(image.width, image.height, platformConfig.ratioValue);
      if (!match) {
        toast.warning(`圖片比例與 ${platformConfig.name} 推薦 (${platformConfig.ratioLabel}) 不符。${suggestion}`, {
          duration: 4000,
        });
      }
    }
    
    // 如果已有生成結果，添加到 result.image_urls；否則添加到 uploadedImages
    if (resultRef.current?.image_urls && resultRef.current.image_urls.length > 0) {
      const newIndex = resultRef.current.image_urls.length;
      setResult(prev => prev ? {
        ...prev,
        image_urls: [...prev.image_urls, imageToAdd],
      } : null);
      setCurrentImageIndex(newIndex);
    } else {
      const newIndex = uploadedImages.length;
      setUploadedImages(prev => [...prev, imageToAdd]);
      setCurrentImageIndex(newIndex);
    }
    toast.success("已添加圖片");
  };
  
  // 從 API 載入歷史記錄
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get("/history", {
        params: { generation_type: "social_image", page: 1, page_size: 50 }
      });
      
      // 轉換 API 回應格式
      const records: SocialHistoryRecord[] = res.data.items.map((item: any) => ({
        id: item.id,
        topic: item.input_params?.topic || "",
        platform: item.input_params?.platform || "instagram",
        quality: item.input_params?.quality || "standard",
        tone: item.input_params?.tone || "professional",
        keywords: item.input_params?.keywords || "",
        imagePrompt: item.input_params?.imagePrompt || "",
        productInfo: item.input_params?.productInfo || "",
        image_url: item.output_data?.image_url || item.media_cloud_url || "",
        caption: item.output_data?.caption || "",
        createdAt: item.created_at,
        credits_used: item.credits_used,
        media_cloud_url: item.media_cloud_url,
      }));
      
      setHistory(records);
    } catch (e) {
      console.error("載入歷史記錄失敗:", e);
      // 如果 API 失敗，不顯示錯誤（可能是用戶未登入）
    } finally {
      setHistoryLoading(false);
    }
  };
  
  // 初始載入歷史記錄
  useEffect(() => {
    loadHistory();
  }, []);
  
  // === 頁面重整狀態保存與恢復 ===
  // 注意：只保存輕量設定，不保存圖片數據（避免 QuotaExceededError）
  const SESSION_STATE_KEY = 'socialPageState';
  
  // 恢復頁面狀態（頁面載入時執行一次）
  useEffect(() => {
    try {
      const savedState = sessionStorage.getItem(SESSION_STATE_KEY);
      if (savedState) {
        const state = JSON.parse(savedState);
        // 恢復設定
        if (state.topic) setTopic(state.topic);
        if (state.platform) setPlatform(state.platform);
        if (state.tone) setTone(state.tone);
        if (state.quality) setQuality(state.quality);
        if (state.keywords) setKeywords(state.keywords);
        if (state.imagePrompt) setImagePrompt(state.imagePrompt);
        if (state.productInfo) setProductInfo(state.productInfo);
        if (state.showAdvanced !== undefined) setShowAdvanced(state.showAdvanced);
        // 恢復文案（不含圖片）
        if (state.caption) {
          setResult({ image_url: '', image_urls: [], caption: state.caption });
        }
        // 恢復當前圖片索引
        if (typeof state.currentImageIndex === 'number') {
          setTimeout(() => setCurrentImageIndex(state.currentImageIndex), 100);
        }
      }
    } catch (e) {
      console.error('恢復頁面狀態失敗:', e);
      sessionStorage.removeItem(SESSION_STATE_KEY);
    }
  }, []);
  
  // 保存頁面狀態（當關鍵狀態變更時）- 只保存輕量設定
  useEffect(() => {
    const stateToSave = {
      topic,
      platform,
      tone,
      quality,
      keywords,
      imagePrompt,
      productInfo,
      showAdvanced,
      // 只保存文案，不保存圖片 URL（避免超出配額）
      caption: result?.caption || '',
      currentImageIndex,
    };
    
    try {
      sessionStorage.setItem(SESSION_STATE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.error('保存頁面狀態失敗:', e);
      // 如果還是失敗，清除舊數據重試
      try {
        sessionStorage.removeItem(SESSION_STATE_KEY);
      } catch {}
    }
  }, [topic, platform, tone, quality, keywords, imagePrompt, productInfo, showAdvanced, result?.caption, currentImageIndex]);
  
  // 檢查是否有從圖片編輯室導入的圖片
  useEffect(() => {
    const checkPendingImage = async () => {
      const pendingImage = await getPendingImageForEngine('social');
      if (!pendingImage) return;
      
      // 檢查是否有保存的貼文狀態（從同一篇貼文跳轉到編輯室再返回）
      const savedStateStr = localStorage.getItem('socialPostStateForReturn');
      
      if (savedStateStr) {
        try {
          const savedState = JSON.parse(savedStateStr);
          
          // 檢查是否過期（10 分鐘內有效）
          if (Date.now() - savedState.timestamp < 10 * 60 * 1000) {
            // 恢復貼文狀態（元數據）
            if (savedState.topic) setTopic(savedState.topic);
            if (savedState.platform) setPlatform(savedState.platform);
            if (savedState.quality) setQuality(savedState.quality);
            if (savedState.tone) setTone(savedState.tone);
            if (savedState.keywords) setKeywords(savedState.keywords);
            if (savedState.imagePrompt) setImagePrompt(savedState.imagePrompt);
            if (savedState.productInfo) setProductInfo(savedState.productInfo);
            
            // 恢復結果（使用編輯後的圖片）
            if (savedState.resultCaption) {
              const editingIndex = savedState.editingImageIndex ?? 0;
              setResult({
                image_url: pendingImage.dataUrl,
                image_urls: [pendingImage.dataUrl],
                caption: savedState.resultCaption,
              });
              setCurrentImageIndex(0);
            } else {
              // 沒有文案，只添加圖片
              setUploadedImages(prev => [...prev, pendingImage.dataUrl]);
            }
            
            toast.success("已返回原貼文，圖片已更新", { duration: 3000 });
          } else {
            // 狀態過期，當作新圖片處理
            setUploadedImages(prev => [...prev, pendingImage.dataUrl]);
            toast.success(`已從圖片編輯室導入「${pendingImage.name || '設計作品'}」`, { duration: 4000 });
          }
        } catch (e) {
          // 解析失敗，當作新圖片處理
          setUploadedImages(prev => [...prev, pendingImage.dataUrl]);
          toast.success(`已從圖片編輯室導入「${pendingImage.name || '設計作品'}」`, { duration: 4000 });
        }
        
        // 清除保存的狀態
        localStorage.removeItem('socialPostStateForReturn');
      } else {
        // 沒有保存的狀態，當作新圖片添加
        setUploadedImages(prev => [...prev, pendingImage.dataUrl]);
        toast.success(`已從圖片編輯室導入「${pendingImage.name || '設計作品'}」`, { duration: 4000 });
      }
    };
    
    checkPendingImage();
  }, []);
  
  // 添加到歷史記錄（保存到 API）
  const addToHistory = async (result: { image_url: string; caption: string }, creditsUsed: number = 0) => {
    try {
      await api.post("/history", {
        generation_type: "social_image",
        status: "completed",
        input_params: {
          topic,
          platform,
          quality,
          tone,
          keywords,
          imagePrompt,
          productInfo,
        },
        output_data: {
          image_url: result.image_url,
          caption: result.caption,
        },
        media_cloud_url: result.image_url,
        credits_used: creditsUsed,
      });
      
      // 重新載入歷史記錄
      loadHistory();
      console.log("[Social History] 已保存到資料庫");
    } catch (e) {
      console.error("保存歷史記錄失敗:", e);
      // 保存失敗不影響用戶體驗
    }
  };
  
  // 套用歷史記錄
  const applyHistory = (record: SocialHistoryRecord) => {
    setTopic(record.topic);
    setPlatform(record.platform);
    setQuality(record.quality);
    setTone(record.tone);
    setKeywords(record.keywords);
    setImagePrompt(record.imagePrompt);
    setProductInfo(record.productInfo);
    setResult({ 
      image_url: record.image_url, 
      image_urls: [record.image_url],
      caption: record.caption 
    });
    setCurrentImageIndex(0);
    setUploadedImages([]);
    setShowHistory(false);
    toast.success("已載入歷史記錄");
  };
  
  // 刪除歷史記錄（調用 API）
  const deleteHistory = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation(); // 防止觸發父元素的點擊事件
    try {
      await api.delete(`/history/${id}`);
      // 從本地狀態中移除
      setHistory(prev => prev.filter(h => h.id !== id));
      toast.success("已刪除記錄");
    } catch (e) {
      console.error("刪除歷史記錄失敗:", e);
      toast.error("刪除失敗");
    }
  };
  
  // 清空所有歷史（逐一刪除）
  const clearAllHistory = async () => {
    try {
      // 逐一刪除（API 沒有批次刪除功能）
      for (const record of history) {
        await api.delete(`/history/${record.id}`);
      }
      setHistory([]);
      setShowHistory(false);
      setSelectedHistoryIds(new Set());
      setIsHistorySelectionMode(false);
      toast.success("已清空所有歷史記錄");
    } catch (e) {
      console.error("清空歷史記錄失敗:", e);
      toast.error("清空失敗");
    }
  };

  // 切換歷史選擇模式
  const toggleHistorySelectionMode = () => {
    if (isHistorySelectionMode) {
      setSelectedHistoryIds(new Set());
    }
    setIsHistorySelectionMode(!isHistorySelectionMode);
  };

  // 切換單個歷史記錄的選擇狀態
  const toggleSelectHistory = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedHistoryIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // 全選/取消全選歷史
  const toggleSelectAllHistory = () => {
    if (selectedHistoryIds.size === history.length) {
      setSelectedHistoryIds(new Set());
    } else {
      setSelectedHistoryIds(new Set(history.map(h => h.id)));
    }
  };

  // 批量刪除歷史
  const handleBatchDeleteHistory = async () => {
    if (selectedHistoryIds.size === 0) return;
    
    const confirmed = window.confirm(
      `確定要刪除選取的 ${selectedHistoryIds.size} 筆記錄嗎？\n\n刪除後無法恢復。`
    );
    if (!confirmed) return;
    
    setIsBatchDeleting(true);
    try {
      // 逐一刪除
      for (const id of selectedHistoryIds) {
        await api.delete(`/history/${id}`);
      }
      setHistory(prev => prev.filter(h => !selectedHistoryIds.has(h.id)));
      setSelectedHistoryIds(new Set());
      setIsHistorySelectionMode(false);
      toast.success(`已刪除 ${selectedHistoryIds.size} 筆記錄`);
    } catch (e) {
      console.error("批量刪除失敗:", e);
      toast.error("批量刪除失敗");
    } finally {
      setIsBatchDeleting(false);
    }
  };

  // 複製文案到剪貼簿
  const handleCopyCaption = async () => {
    if (!result?.caption) return;
    try {
      // 移除 HTML 標籤
      const plainText = result.caption.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      toast.success("文案已複製到剪貼簿！");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("複製失敗，請手動複製");
    }
  };

  // 下載圖片
  const handleDownloadImage = async () => {
    const currentImage = result?.image_urls?.[currentImageIndex] || result?.image_url;
    if (!currentImage) return;
    setDownloading(true);
    try {
      let blob: Blob;
      
      if (currentImage.startsWith('data:')) {
        // Base64 圖片
        const response = await fetch(currentImage);
        blob = await response.blob();
      } else {
        // URL 圖片
        const response = await fetch(currentImage);
        blob = await response.blob();
      }
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `kingjam-${platform}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("圖片下載成功！");
    } catch (err) {
      toast.error("下載失敗，請右鍵另存圖片");
    } finally {
      setDownloading(false);
    }
  };

  // 在圖片編輯室開啟
  const handleOpenInDesignStudio = async () => {
    const currentImage = result?.image_urls?.[currentImageIndex] || result?.image_url;
    if (!currentImage) {
      toast.error("沒有可編輯的圖片");
      return;
    }

    // 保存當前貼文狀態到 localStorage（用於編輯後返回）
    // 注意：不保存圖片數據，只保存元數據
    const socialPostState = {
      topic,
      platform,
      quality,
      tone,
      keywords,
      imagePrompt,
      productInfo,
      // 保存 result 但排除大型圖片數據
      resultCaption: result?.caption,
      resultImageCount: result?.image_urls?.length || 0,
      uploadedImagesCount: uploadedImages.length,
      currentImageIndex,
      editingImageIndex: currentImageIndex, // 記錄正在編輯的是哪張圖
      timestamp: Date.now(),
    };
    localStorage.setItem('socialPostStateForReturn', JSON.stringify(socialPostState));

    try {
      // 設定待編輯的圖片資訊（async）
      await setPendingImageForEditor({
        imageUrl: currentImage,
        source: "social",
        sourceId: `social-${Date.now()}`,
        name: topic || "社群圖文",
        metadata: {
          platform,
          caption: result?.caption,
          keywords,
          tone,
          quality,
        },
      });

      // 導航到圖片編輯室
      router.push("/dashboard/design-studio");
      toast.info("正在開啟圖片編輯室...");
    } catch (error) {
      console.error("Failed to prepare image for editor:", error);
      toast.error("準備圖片失敗");
    }
  };

  // 開始編輯文案
  const handleStartEditCaption = () => {
    if (!result?.caption) return;
    const plainText = result.caption.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
    setEditedCaption(plainText);
    setIsEditingCaption(true);
  };

  // 儲存編輯的文案
  const handleSaveCaption = () => {
    if (!result) return;
    setResult({
      ...result,
      caption: editedCaption.replace(/\n/g, '<br />')
    });
    setIsEditingCaption(false);
    toast.success("文案已更新！");
  };

  // 取消編輯
  const handleCancelEdit = () => {
    setIsEditingCaption(false);
    setEditedCaption("");
  };

  // 計算文案字數
  const getCaptionLength = () => {
    if (!result?.caption) return 0;
    const plainText = result.caption.replace(/<br\s*\/?>/gi, '').replace(/<[^>]*>/g, '');
    return plainText.length;
  };

  // 分享功能
  const handleShare = async () => {
    if (!result) return;
    
    const plainCaption = result.caption.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
    
    // 檢查是否支持 Web Share API
    if (navigator.share) {
      try {
        // 嘗試分享圖片和文字
        if (result.image_url.startsWith('data:')) {
          const response = await fetch(result.image_url);
          const blob = await response.blob();
          const file = new File([blob], `kingjam-${platform}.png`, { type: 'image/png' });
          
          await navigator.share({
            title: `${topic} - King Jam AI`,
            text: plainCaption,
            files: [file]
          });
        } else {
          await navigator.share({
            title: `${topic} - King Jam AI`,
            text: plainCaption,
            url: result.image_url
          });
        }
        toast.success("分享成功！");
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          // 降級到只分享文字
          await navigator.share({
            title: `${topic} - King Jam AI`,
            text: plainCaption
          });
        }
      }
    } else {
      // 不支持 Web Share API，複製到剪貼簿
      try {
        await navigator.clipboard.writeText(plainCaption);
        toast.success("文案已複製，請手動貼到社群平台");
      } catch {
        toast.error("分享失敗");
      }
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 驗證檔案類型（包含 HEIC）
      const isImage = file.type.startsWith('image/') || 
        file.name.toLowerCase().endsWith('.heic') || 
        file.name.toLowerCase().endsWith('.heif');
      if (!isImage) {
        toast.error('請選擇圖片檔案');
        return;
      }
      
      // 驗證檔案大小（10MB）
      if (file.size > 10 * 1024 * 1024) {
        toast.error('圖片大小不能超過 10MB');
        return;
      }
      
      try {
        // HEIC 轉換
        const processedFile = await convertHeicToJpeg(file);
        setReferenceImage(processedFile);
        
        // 建立預覽
        const reader = new FileReader();
        reader.onloadend = () => {
          setReferenceImagePreview(reader.result as string);
        };
        reader.readAsDataURL(processedFile);
      } catch (error: any) {
        toast.error(error.message || '圖片處理失敗');
      }
    }
  };

  const handleRemoveReferenceImage = () => {
    setReferenceImage(null);
    setReferenceImagePreview(null);
  };

  // 處理拖放上傳
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const isImage = file.type.startsWith('image/') || 
        file.name.toLowerCase().endsWith('.heic') || 
        file.name.toLowerCase().endsWith('.heif');
      if (!isImage) {
        toast.error('請選擇圖片檔案');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('圖片大小不能超過 10MB');
        return;
      }
      
      try {
        // HEIC 轉換
        const processedFile = await convertHeicToJpeg(file);
        setReferenceImage(processedFile);
        const reader = new FileReader();
        reader.onloadend = () => {
          setReferenceImagePreview(reader.result as string);
        };
        reader.readAsDataURL(processedFile);
      } catch (error: any) {
        toast.error(error.message || '圖片處理失敗');
      }
    }
  };

  // 格式化檔案大小
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleGenerate = async () => {
    if (!topic) return;
    setLoading(true);
    setResult(null);
    setCurrentImageIndex(0);
    setLoadingStep("準備生成中...");
    setLoadingProgress(0);

    // 模擬進度的 interval
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 1500);

    try {
      setLoadingStep("📤 上傳資料中...");
      setLoadingProgress(10);
      
      const formData = new FormData();
      formData.append('topic', topic);
      formData.append('platform', platform);
      formData.append('image_quality', quality);
      formData.append('tone', tone);
      
      // 新增的自填欄位
      if (keywords.trim()) {
        formData.append('keywords', keywords.trim());
      }
      if (imagePrompt.trim()) {
        formData.append('image_prompt', imagePrompt.trim());
      }
      if (productInfo.trim()) {
        formData.append('product_info', productInfo.trim());
      }
      
      if (referenceImage) {
        formData.append('reference_image', referenceImage);
        setLoadingStep("🔍 分析參考圖片...");
        setLoadingProgress(20);
      }

      setLoadingStep("🎨 AI 正在繪製圖片...");
      setLoadingProgress(30);

      // 不要手動設置 Content-Type，讓瀏覽器自動設置（包含 boundary）
      const res = await api.post("/social/generate", formData);
      
      setLoadingStep("✍️ 生成文案中...");
      setLoadingProgress(80);
      
      // 如果有參考圖片分析結果，且圖片視覺描述為空，自動填入
      if (res.data.reference_analysis && !imagePrompt.trim()) {
        setImagePrompt(`參考上傳圖片。${res.data.reference_analysis}`);
      }
      
      setLoadingProgress(100);
      
      // 整合生成的圖片和用戶上傳的圖片
      const generatedUrl = res.data.image_url;
      const allImages = generatedUrl 
        ? [generatedUrl, ...uploadedImages] 
        : uploadedImages;
      
      setResult({
        ...res.data,
        image_urls: allImages,
      });
      setCurrentImageIndex(0);
      
      // 儲存到歷史記錄（API 持久化）
      addToHistory(res.data, COST_TABLE[quality]);

      // 自動保存到跨引擎圖庫
      if (res.data.image_url) {
        import("@/lib/services/shared-gallery-service").then(({ sharedGalleryService }) => {
          sharedGalleryService.addImageFromUrl(res.data.image_url, {
            name: topic || "社群圖文",
            source: "social",
            sourceId: `social-${Date.now()}`,
            metadata: {
              platform,
              caption: res.data.caption,
              keywords,
              tone,
              quality,
            },
          }).catch(console.error);
        });
      }
      
      toast.success("🎉 生成成功！", {
        description: "⚠️ 圖片保留 14 天（排程上架 30 天），請及時下載",
        duration: 6000,
      });
      
      // 即時更新導覽列點數
      refreshCredits();
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || "生成失敗";
      if (error.response?.status === 402) {
        toast.error(`點數不足！需要 ${COST_TABLE[quality]} 點`);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      clearInterval(progressInterval);
      setLoading(false);
      setLoadingProgress(0);
    }
  };

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-2 gap-4 lg:gap-6 min-h-[calc(100vh-8rem)] lg:h-[calc(100vh-8rem)]">
      
      {/* --- 左側：控制台 --- */}
      <div className="space-y-4 lg:space-y-6 lg:overflow-y-auto lg:pr-2">
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  社群貼文生成器
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  AI 一鍵生成圖片與文案
          </p>
              </div>
            </div>
          </div>
          
          {/* 快速模板 */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            {[
              { id: "cafe", icon: "☕", label: "咖啡廳", topic: "週末療癒咖啡廳推薦", platform: "instagram", tone: "cozy", keywords: "咖啡, 下午茶, 放鬆, 週末" },
              { id: "food", icon: "🍜", label: "美食", topic: "必吃美食開箱分享", platform: "xiaohongshu", tone: "engaging", keywords: "美食, 推薦, 必吃, 好吃" },
              { id: "ootd", icon: "👗", label: "穿搭", topic: "今日穿搭 OOTD 分享", platform: "instagram", tone: "modern", keywords: "穿搭, OOTD, 時尚, 搭配" },
              { id: "travel", icon: "✈️", label: "旅遊", topic: "絕美秘境景點推薦", platform: "xiaohongshu", tone: "romantic", keywords: "旅遊, 景點, 秘境, 打卡" },
              { id: "tech", icon: "📱", label: "科技", topic: "新品開箱體驗心得", platform: "threads", tone: "professional", keywords: "開箱, 評測, 推薦, 科技" },
              { id: "fitness", icon: "💪", label: "健身", topic: "居家健身訓練菜單", platform: "tiktok", tone: "energetic", keywords: "健身, 運動, 訓練, 塑身" },
            ].map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => {
                  setTopic(template.topic);
                  setPlatform(template.platform);
                  setTone(template.tone);
                  setKeywords(template.keywords);
                  toast.success(`已套用「${template.label}」模板`);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-indigo-600/50 border border-slate-700 hover:border-indigo-500 rounded-full transition-all duration-200 whitespace-nowrap text-xs sm:text-sm"
              >
                <span>{template.icon}</span>
                <span>{template.label}</span>
              </button>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>內容設定</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 平台選擇 - 3D 立體圖標卡片 */}
            <div className="space-y-2 sm:space-y-3">
              <Label>社群平台 *</Label>
              <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlatform(p.id)}
                    className={cn(
                      "relative flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl sm:rounded-2xl transition-all duration-300 group",
                      platform === p.id
                        ? "bg-gradient-to-b from-slate-700 to-slate-800 shadow-[0_8px_16px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] scale-105 ring-2 ring-indigo-500/50"
                        : "bg-gradient-to-b from-slate-800 to-slate-900 shadow-[0_4px_8px_rgba(0,0,0,0.3)] hover:shadow-[0_6px_12px_rgba(0,0,0,0.4)] active:scale-95 sm:hover:scale-102 sm:hover:-translate-y-0.5"
                    )}
                  >
                    {/* 3D 高光效果 */}
                    <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent rounded-t-xl sm:rounded-t-2xl pointer-events-none" />
                    
                    <div className={cn(
                      "w-8 h-8 sm:w-10 sm:h-10 mb-1 sm:mb-2 transition-all duration-300",
                      platform === p.id ? "scale-110 -translate-y-0.5" : "group-hover:scale-105"
                    )}>
                      <PlatformIcon platform={p.id} className="w-full h-full" />
                    </div>
                    <span className={cn(
                      "text-[10px] sm:text-[11px] font-semibold truncate w-full text-center transition-colors",
                      platform === p.id ? "text-white" : "text-slate-400 group-hover:text-slate-300"
                    )}>
                      {p.name}
                    </span>
                    {platform === p.id && (
                      <div className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-lg">
                        <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">
                圖片尺寸和文案風格會自動適配所選平台
              </p>
            </div>

            {/* 主題輸入 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
              <Label>貼文主題 *</Label>
                {(topic || keywords || imagePrompt || productInfo || referenceImage) && (
                  <button
                    type="button"
                    onClick={() => {
                      setTopic("");
                      setKeywords("");
                      setImagePrompt("");
                      setProductInfo("");
                      setReferenceImage(null);
                      setReferenceImagePreview(null);
                      setResult(null);
                      setUploadedImages([]);
                      setCurrentImageIndex(0);
                      toast.success("已清除所有內容");
                    }}
                    className="text-xs text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> 清除全部
                  </button>
                )}
              </div>
              <Input 
                placeholder="例如：台北信義區的極簡風咖啡廳..." 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
              {/* 快速主題建議 */}
              <div className="flex flex-wrap gap-1 sm:gap-1.5">
                {[
                  { label: "☕ 咖啡廳", topic: "週末必訪的隱藏版咖啡廳" },
                  { label: "🍜 美食", topic: "超人氣排隊美食開箱" },
                  { label: "👗 穿搭", topic: "今日 OOTD 穿搭紀錄" },
                  { label: "🏖️ 旅遊", topic: "絕美秘境景點推薦" },
                  { label: "💄 美妝", topic: "近期愛用彩妝推薦" },
                  { label: "🏋️ 健身", topic: "居家健身訓練菜單" },
                  { label: "📱 3C", topic: "最新科技產品開箱評測" },
                  { label: "🎬 影劇", topic: "近期追劇心得分享" },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setTopic(item.topic)}
                    className="px-2 sm:px-2.5 py-0.5 sm:py-1 text-[11px] sm:text-xs bg-slate-700/50 hover:bg-indigo-600/50 active:bg-indigo-600/70 border border-slate-600 hover:border-indigo-500 rounded-full transition-all duration-200"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {suggesting ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled
                    >
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> AI 正在分析中...
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (suggestAbortController) {
                          suggestAbortController.abort();
                          setSuggestAbortController(null);
                          setSuggesting(false);
                        }
                      }}
                    >
                      取消
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={async () => {
                      if (!topic.trim()) {
                        toast.error("請先輸入主題");
                        return;
                      }
                      
                      // 確認對話框，提示扣除點數無法返回
                      const confirmed = window.confirm(
                        "⚠️ 注意：使用此功能將扣除 10 點，且點數無法退回。\n\n" +
                        "確定要繼續嗎？"
                      );
                      
                      if (!confirmed) {
                        return;
                      }
                      
                      // 創建 AbortController 用於取消請求
                      const abortController = new AbortController();
                      setSuggestAbortController(abortController);
                      setSuggesting(true);
                      
                      try {
                        const res = await api.post("/social/suggest", {
                          topic: topic,
                          platform: platform,
                        }, {
                          signal: abortController.signal,
                          timeout: 60000, // 60 秒超時
                        });
                        
                        console.log("AI生成快速建議 API 響應:", res.data);
                        
                        // 確保正確設置值
                        if (res.data) {
                          setKeywords(res.data.keywords || "");
                          setImagePrompt(res.data.image_prompt || "");
                          setProductInfo(res.data.product_info || "");
                          
                          console.log("已填入欄位:", {
                            keywords: res.data.keywords || "",
                            image_prompt: res.data.image_prompt || "",
                            product_info: res.data.product_info || ""
                          });
                        }
                      } catch (error: any) {
                        // 如果是取消請求，不顯示錯誤
                        if (error.name === 'CanceledError' || error.name === 'AbortError') {
                          console.log("請求已取消");
                          return;
                        }
                        console.error("Failed to get suggestions", error);
                        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
                          toast.error("請求超時（超過 60 秒），請稍後再試或嘗試更簡短的主題");
                        } else if (error.response?.status === 504) {
                          toast.error(error.response.data.detail || "AI 回應超時，請稍後再試");
                        } else if (error.response?.data?.detail) {
                          toast.error(error.response.data.detail);
                        } else {
                          toast.error("生成建議失敗，請稍後再試");
                        }
                      } finally {
                        setSuggesting(false);
                        setSuggestAbortController(null);
                      }
                    }}
                    disabled={suggesting || !topic.trim()}
                  >
                    <Sparkles className="mr-2 h-4 w-4" /> AI 生成快速建議 (-2 點)
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  {suggesting 
                    ? "正在生成建議中，如需取消請點擊取消按鈕（注意：點數已扣除無法退回）"
                    : "點擊按鈕可讓 AI 根據主題自動填入關鍵詞、圖片提示詞和商品資訊"
                  }
                </p>
              </div>
            </div>

            {/* 進階選項折疊區 */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between w-full px-4 py-3 bg-slate-800/50 hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">進階設定</span>
                  <Badge variant="secondary" className="text-xs bg-slate-700">
                    {(keywords || imagePrompt || productInfo) ? "已填寫" : "選填"}
                  </Badge>
                </div>
                {showAdvanced ? (
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
              </button>
              
              {showAdvanced && (
                <div className="space-y-4 p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
            {/* 貼文關鍵詞 */}
            <div className="space-y-2">
                    <Label>貼文關鍵詞</Label>
              <Input 
                placeholder="例如：咖啡、文青、極簡、台北、下午茶..." 
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                輸入關鍵詞，讓 AI 在文案中重點強調這些元素
              </p>
            </div>

            {/* 圖片提示詞 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                      <Label>圖片視覺描述</Label>
                <span className="text-xs text-muted-foreground">
                  {imagePrompt.length}/200
                </span>
              </div>
              <Textarea 
                      placeholder="描述你想要的畫面，例如：&#10;• 場景：咖啡廳窗邊、城市街道&#10;• 主體：咖啡杯、產品特寫&#10;• 氛圍：溫暖陽光、現代簡約"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value.slice(0, 200))}
                      rows={3}
                className="resize-none"
              />
              {/* 快速提示詞模板 */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "☕ 咖啡美學", prompt: "精緻咖啡特寫，溫暖自然光，木質桌面，淺景深，奶油色調" },
                  { label: "🍃 自然清新", prompt: "戶外自然場景，綠色植物，陽光灑落，清新空氣感" },
                  { label: "✨ 極簡風格", prompt: "簡約白色背景，乾淨構圖，大量留白，現代設計感" },
                  { label: "🌆 城市街拍", prompt: "都市街道場景，建築背景，自然光影，生活氛圍" },
                  { label: "🎨 藝術感", prompt: "創意構圖，強烈色彩對比，藝術攝影風格，視覺衝擊" },
                ].map((template) => (
                  <button
                    key={template.label}
                    type="button"
                    onClick={() => setImagePrompt(template.prompt)}
                    className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded-full transition-colors"
                  >
                    {template.label}
                  </button>
                ))}
              </div>
                    {referenceImage && (
                      <p className="text-xs text-emerald-400">
                        ✨ 將結合參考圖片風格生成
              </p>
                    )}
            </div>

            {/* 商品資訊 */}
            <div className="space-y-2">
                    <Label>商品資訊</Label>
              <Textarea 
                      placeholder="例如：商品名稱：手沖咖啡豆&#10;價格：NT$ 350&#10;特色：100% 阿拉比卡豆..."
                value={productInfo}
                onChange={(e) => setProductInfo(e.target.value)}
                      rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                      AI 會將商品資訊自然融入文案中
              </p>
                  </div>
                </div>
              )}
            </div>

            {/* 語氣選擇 */}
            <div className="space-y-2">
              <Label>文案語氣與視覺風格</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="engaging">💬 親切互動 (Engaging)</SelectItem>
                  <SelectItem value="professional">💼 專業介紹 (Professional)</SelectItem>
                  <SelectItem value="humorous">😄 幽默風趣 (Humorous)</SelectItem>
                  <SelectItem value="minimalist">⚪️ 極簡冷淡 (Minimalist)</SelectItem>
                  <SelectItem value="romantic">🌹 浪漫唯美 (Romantic)</SelectItem>
                  <SelectItem value="energetic">⚡ 活力動感 (Energetic)</SelectItem>
                  <SelectItem value="elegant">✨ 優雅高貴 (Elegant)</SelectItem>
                  <SelectItem value="cozy">🏠 溫馨舒適 (Cozy)</SelectItem>
                  <SelectItem value="dramatic">🎭 戲劇張力 (Dramatic)</SelectItem>
                  <SelectItem value="vintage">📷 復古懷舊 (Vintage)</SelectItem>
                  <SelectItem value="modern">🚀 現代時尚 (Modern)</SelectItem>
                  <SelectItem value="nature">🌿 自然清新 (Nature)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                選擇的語氣會同時影響文案風格和圖片視覺效果
              </p>
            </div>

            {/* 參考圖片上傳 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>參考圖片（選填）</Label>
                {referenceImage && (
                  <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400 text-xs">
                    🔍 AI 將分析此圖片
                  </Badge>
                )}
              </div>
              {referenceImagePreview ? (
                <div className="relative group">
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden border-2 border-emerald-500/50 bg-slate-800">
                    <Image
                      src={referenceImagePreview}
                      alt="參考圖片預覽"
                      fill
                      className="object-contain"
                    />
                    {/* 圖片資訊覆蓋層 */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                      <div className="flex items-center justify-between text-xs text-white/80">
                        <span className="truncate max-w-[60%]">{referenceImage?.name}</span>
                        <span>{referenceImage && formatFileSize(referenceImage.size)}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={handleRemoveReferenceImage}
                  >
                    ✕ 移除
                  </Button>
                  <div className="mt-2 p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <p className="text-xs text-emerald-400 flex items-center gap-1">
                      <span>✨</span> 生成時將自動分析此圖片的風格、構圖和色彩
                    </p>
                  </div>
                </div>
              ) : (
                <label 
                  className={cn(
                    "flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200",
                    isDragging 
                      ? "border-emerald-500 bg-emerald-500/10 scale-[1.02]" 
                      : "border-slate-600 hover:border-slate-500 hover:bg-slate-800/50"
                  )}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="flex flex-col items-center justify-center py-4">
                    <div className={cn(
                      "w-12 h-12 mb-3 rounded-full flex items-center justify-center transition-colors",
                      isDragging ? "bg-emerald-500/20" : "bg-slate-700"
                    )}>
                      <svg className={cn("w-6 h-6", isDragging ? "text-emerald-400" : "text-slate-400")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="mb-1 text-sm text-slate-300">
                      {isDragging ? (
                        <span className="text-emerald-400 font-semibold">放開以上傳圖片</span>
                      ) : (
                        <>
                          <span className="font-semibold text-emerald-400">點擊上傳</span>
                          <span className="text-slate-400"> 或拖放圖片到此處</span>
                        </>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">支援 PNG, JPG, WEBP, HEIC (最大 10MB)</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageSelect}
                  />
                </label>
              )}
              <p className="text-xs text-muted-foreground">
                📷 上傳參考圖片後，AI 會自動分析其視覺風格並融入生成的圖片中
              </p>
            </div>

            {/* 品質選擇器 - 視覺化卡片 */}
            <div className="space-y-2 sm:space-y-3 pt-2">
              <Label>圖片品質與成本</Label>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {[
                  { 
                    id: "draft", 
                    icon: "⚡", 
                    name: "草稿", 
                    cost: 10, 
                    desc: "快速預覽",
                    color: "from-slate-500 to-slate-600",
                    border: "border-slate-500"
                  },
                  { 
                    id: "standard", 
                    icon: "✨", 
                    name: "標準", 
                    cost: 20, 
                    desc: "推薦使用",
                    color: "from-indigo-500 to-indigo-600",
                    border: "border-indigo-500",
                    badge: "推薦"
                  },
                  { 
                    id: "premium", 
                    icon: "💎", 
                    name: "精修", 
                    cost: 50, 
                    desc: "4K高畫質",
                    color: "from-purple-500 via-pink-500 to-rose-500",
                    border: "border-purple-500"
                  }
                ].map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setQuality(q.id as "draft" | "standard" | "premium")}
                    className={cn(
                      "relative flex flex-col items-center p-2 sm:p-3 rounded-lg sm:rounded-xl border-2 transition-all duration-300",
                      quality === q.id 
                        ? `bg-gradient-to-br ${q.color} ${q.border} shadow-lg scale-[1.02]`
                        : "bg-slate-800/50 border-slate-700 hover:border-slate-600 hover:bg-slate-800 active:scale-95"
                    )}
                  >
                    {q.badge && quality !== q.id && (
                      <span className="absolute -top-1.5 sm:-top-2 left-1/2 -translate-x-1/2 px-1.5 sm:px-2 py-0.5 bg-indigo-600 text-[8px] sm:text-[9px] font-bold text-white rounded-full whitespace-nowrap">
                        {q.badge}
                      </span>
                    )}
                    <span className="text-lg sm:text-xl mb-0.5 sm:mb-1">{q.icon}</span>
                    <span className={cn(
                      "text-xs sm:text-sm font-semibold",
                      quality === q.id ? "text-white" : "text-slate-300"
                    )}>
                      {q.name}
                    </span>
                    <span className={cn(
                      "text-[10px] sm:text-xs mt-0.5 hidden sm:block",
                      quality === q.id ? "text-white/80" : "text-slate-500"
                    )}>
                      {q.desc}
                    </span>
                    <span className={cn(
                      "text-[10px] sm:text-xs font-mono mt-1 sm:mt-1.5 px-1.5 sm:px-2 py-0.5 rounded-full",
                      quality === q.id 
                        ? "bg-white/20 text-white"
                        : "bg-slate-700 text-slate-400"
                    )}>
                      -{q.cost}
                    </span>
                    {quality === q.id && (
                      <div className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white flex items-center justify-center shadow-lg">
                        <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-indigo-600" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 多圖上傳區域 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  額外圖片（選填，支援多圖貼文）
                </Label>
                <div className="flex items-center gap-2">
                  {(result?.image_urls?.length || uploadedImages.length) > 0 && (
                    <Badge variant="secondary" className="bg-indigo-500/20 text-indigo-400 text-xs">
                      已有 {result?.image_urls?.length || uploadedImages.length} 張
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs text-slate-400">
                    推薦比例: {PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.ratioLabel}
                  </Badge>
                </div>
              </div>
              
              {/* 已上傳的圖片預覽 */}
              {uploadedImages.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  {uploadedImages.map((img, idx) => (
                    <div 
                      key={idx} 
                      className={cn(
                        "relative group w-16 h-16 cursor-pointer transition-all duration-200",
                        currentImageIndex === idx 
                          ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-800 scale-105" 
                          : "hover:ring-2 hover:ring-slate-500 hover:ring-offset-1 hover:ring-offset-slate-800"
                      )}
                      onClick={() => setCurrentImageIndex(idx)}
                    >
                      <img 
                        src={img} 
                        alt={`上傳圖片 ${idx + 1}`}
                        className="w-full h-full object-cover rounded-lg border border-slate-600"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation(); // 防止觸發父元素的點擊事件
                          setUploadedImages(prev => prev.filter((_, i) => i !== idx));
                          // 如果刪除的是當前顯示的圖片，調整索引
                          if (idx <= currentImageIndex && currentImageIndex > 0) {
                            setCurrentImageIndex(prev => prev - 1);
                          }
                        }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                      <span className={cn(
                        "absolute bottom-0.5 right-0.5 text-white text-[10px] px-1 rounded",
                        currentImageIndex === idx ? "bg-indigo-600" : "bg-black/70"
                      )}>
                        {idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* 上傳和圖庫選擇按鈕 */}
              {(result?.image_urls?.length || uploadedImages.length) < 20 && (
                <div className="flex gap-2">
                  {/* 本機上傳 */}
                  <label className="flex-1 flex items-center justify-center h-16 border-2 border-dashed border-slate-600 hover:border-indigo-500 rounded-lg cursor-pointer transition-all duration-200 hover:bg-slate-800/50">
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="flex items-center gap-1.5 text-sm text-slate-400">
                        <ImageIcon className="w-4 h-4" />
                        <span>本機上傳</span>
                      </div>
                      <span className="text-[10px] text-slate-500">PNG, JPG, WEBP, HEIC</span>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      multiple
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (!files) return;
                        
                        // 計算當前總圖片數
                        const currentTotal = result?.image_urls?.length || uploadedImages.length;
                        const remaining = 20 - currentTotal;
                        const filesToProcess = Array.from(files).slice(0, remaining);
                      
                        // 處理每個檔案（包含 HEIC 轉換和比例檢測）
                        for (let i = 0; i < filesToProcess.length; i++) {
                          const file = filesToProcess[i];
                          const isLast = i === filesToProcess.length - 1;
                          try {
                            // 檢查是否為 HEIC 並轉換
                            const processedFile = await convertHeicToJpeg(file);
                            
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const dataUrl = event.target?.result as string;
                              if (!dataUrl) {
                                toast.error("圖片讀取失敗");
                                return;
                              }
                              
                              console.log('[Upload] 圖片讀取成功, 準備添加到狀態');
                              
                              // 使用 ref 檢查最新的 result 狀態
                              const hasResult = resultRef.current?.image_urls && resultRef.current.image_urls.length > 0;
                              console.log('[Upload] hasResult:', hasResult);
                              
                              if (hasResult) {
                                // 已有生成結果，添加到 result.image_urls
                                setResult(prev => {
                                  if (!prev) return null;
                                  const newUrls = [...prev.image_urls, dataUrl];
                                  if (isLast) {
                                    setTimeout(() => setCurrentImageIndex(newUrls.length - 1), 50);
                                  }
                                  return { ...prev, image_urls: newUrls };
                                });
                              } else {
                                // 沒有生成結果，添加到 uploadedImages
                                setUploadedImages(prev => {
                                  const newImages = [...prev, dataUrl];
                                  console.log('[Upload] uploadedImages 更新為', newImages.length, '張');
                                  if (isLast) {
                                    setTimeout(() => setCurrentImageIndex(newImages.length - 1), 50);
                                  }
                                  return newImages;
                                });
                              }
                              
                              toast.success("圖片已添加");
                            };
                            reader.readAsDataURL(processedFile);
                          } catch (error: any) {
                            toast.error(error.message || "圖片處理失敗");
                          }
                        }
                        
                        if (files.length > remaining) {
                          toast.info(`已達到最大圖片數量，僅上傳前 ${remaining} 張`);
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>
                  
                  {/* 從圖庫選擇 */}
                  <button
                    type="button"
                    onClick={() => {
                      loadGalleryImages();
                      setShowGalleryPicker(true);
                    }}
                    className="flex-1 flex items-center justify-center h-16 border-2 border-dashed border-purple-600/50 hover:border-purple-500 rounded-lg cursor-pointer transition-all duration-200 hover:bg-purple-500/10"
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="flex items-center gap-1.5 text-sm text-purple-400">
                        <Sparkles className="w-4 h-4" />
                        <span>從圖庫選擇</span>
                      </div>
                      <span className="text-[10px] text-slate-500">使用平台生成的圖片</span>
                    </div>
                  </button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                📸 上傳或選擇的圖片會與 AI 生成的圖片一起組成多圖貼文（最多 20 張）
              </p>
            </div>

            {/* 生成按鈕 - 增強視覺效果 */}
            <div className="relative group">
            <Button 
              className={cn(
                  "relative w-full transition-all duration-300 h-12 sm:h-14 overflow-hidden",
                  loading 
                    ? "bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_100%] animate-shimmer"
                    : quality === 'premium' 
                      ? "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:shadow-lg hover:shadow-purple-500/30" 
                      : quality === 'standard'
                        ? "bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600"
                        : "bg-slate-600 hover:bg-slate-500"
              )}
              onClick={handleGenerate}
              disabled={loading || !topic}
            >
              {loading ? (
                  <div className="flex flex-col items-center py-0.5 sm:py-1">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="relative">
                        <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                        <div className="absolute inset-0 h-4 w-4 sm:h-5 sm:w-5 animate-ping opacity-30 rounded-full bg-white" />
                      </div>
                      <span className="font-medium text-sm sm:text-base">{loadingStep || "生成中..."}</span>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 text-xs opacity-80 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      <span>約 30-90 秒，請耐心等待</span>
                    </div>
                  </div>
              ) : (
                  <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                    <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" /> 
                    <span className="font-semibold text-sm sm:text-base">開始生成</span>
                    <span className="px-1.5 sm:px-2 py-0.5 bg-white/20 rounded-full text-xs sm:text-sm">
                      -{COST_TABLE[quality]}
                    </span>
                  </div>
              )}
            </Button>
              {/* 進度條 */}
              {loading && (
                <div className="mt-3 space-y-1.5">
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${Math.min(loadingProgress, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{loadingStep}</span>
                    <span>{Math.round(loadingProgress)}%</span>
                  </div>
                </div>
              )}
              {/* 按鈕發光效果 */}
              {!loading && topic && (
                <div className="absolute inset-0 -z-10 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 blur-xl opacity-30 group-hover:opacity-50 transition-opacity" />
              )}
            </div>

            {/* 歷史記錄按鈕 - 始終顯示 */}
            {!loading && (
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200 text-sm",
                  showHistory 
                    ? "bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border-violet-500/30 shadow-lg shadow-violet-500/5"
                    : "bg-gradient-to-r from-slate-800/80 to-slate-800/50 hover:from-slate-700/80 hover:to-slate-700/50 border-slate-700/80"
                )}
              >
                <div className="flex items-center gap-3 text-slate-200">
                  <div className={cn(
                    "p-2 rounded-lg transition-colors",
                    showHistory ? "bg-violet-500/20" : "bg-indigo-500/20"
                  )}>
                    <Clock className={cn(
                      "w-4 h-4",
                      showHistory ? "text-violet-400" : "text-indigo-400"
                    )} />
                  </div>
                  <div className="text-left">
                    <span className="font-semibold block">生成歷史</span>
                    <span className="text-[11px] text-slate-400">
                      {isHistorySelectionMode && selectedHistoryIds.size > 0 
                        ? `已選取 ${selectedHistoryIds.size} / ${history.length} 筆`
                        : `共 ${history.length} 筆記錄`}
                    </span>
                  </div>
                </div>
                <div className={cn(
                  "p-1.5 rounded-lg transition-all",
                  showHistory ? "bg-violet-500/20 rotate-180" : "bg-slate-700/50"
                )}>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </div>
              </button>
            )}
            
            {/* 歷史記錄列表 */}
            {showHistory && (
              <div className="bg-gradient-to-b from-slate-900 to-slate-950 rounded-xl border border-slate-700/50 shadow-xl overflow-hidden animate-in slide-in-from-top-2 duration-200">
                {history.length > 0 ? (
                  <>
                    {/* 標題和操作按鈕 */}
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-800/80 to-slate-900/80 border-b border-slate-700/50">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={toggleHistorySelectionMode}
                          className={cn(
                            "p-2 rounded-lg transition-all",
                            isHistorySelectionMode 
                              ? "text-violet-400 bg-violet-500/20 ring-1 ring-violet-500/30" 
                              : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                          )}
                          title={isHistorySelectionMode ? "取消選擇" : "批量選擇"}
                        >
                          <CheckSquare className="w-4 h-4" />
                        </button>
                        {isHistorySelectionMode && (
                          <button
                            onClick={toggleSelectAllHistory}
                            className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-700/50 transition-colors"
                          >
                            {selectedHistoryIds.size === history.length ? "取消全選" : "全選"}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isHistorySelectionMode && selectedHistoryIds.size > 0 ? (
                          <button
                            onClick={handleBatchDeleteHistory}
                            disabled={isBatchDeleting}
                            className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors disabled:opacity-50"
                          >
                            {isBatchDeleting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            刪除 ({selectedHistoryIds.size})
                          </button>
                        ) : !isHistorySelectionMode && (
                          <button
                            onClick={clearAllHistory}
                            className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            清空全部
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* 歷史記錄列表 */}
                    <div className="p-3 space-y-2 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
                      {history.map((item, index) => {
                        const platformInfo = PLATFORMS.find(p => p.id === item.platform);
                        const qualityLabel = item.quality === 'draft' ? '快速' : item.quality === 'standard' ? '標準' : '高級';
                        const qualityColors: Record<string, string> = {
                          draft: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
                          standard: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
                          premium: 'bg-purple-500/15 text-purple-300 border-purple-500/20'
                        };
                        
                        return (
                          <div
                            key={item.id}
                            style={{ animationDelay: `${index * 30}ms` }}
                            className={cn(
                              "group relative flex items-center gap-3 p-3 rounded-xl transition-all duration-200 cursor-pointer border animate-in fade-in-0 slide-in-from-right-2",
                              isHistorySelectionMode && selectedHistoryIds.has(item.id)
                                ? "bg-violet-500/10 border-violet-500/50 ring-2 ring-violet-500/20 shadow-lg shadow-violet-500/5"
                                : "bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600/50 hover:shadow-md"
                            )}
                            onClick={() => isHistorySelectionMode ? toggleSelectHistory(item.id, { stopPropagation: () => {} } as React.MouseEvent) : applyHistory(item)}
                          >
                            {/* 選擇模式下的 Checkbox */}
                            {isHistorySelectionMode && (
                              <div 
                                onClick={(e) => toggleSelectHistory(item.id, e)}
                                className={cn(
                                  "w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all cursor-pointer",
                                  selectedHistoryIds.has(item.id) 
                                    ? "bg-gradient-to-br from-violet-500 to-indigo-500 shadow-lg shadow-violet-500/30" 
                                    : "border-2 border-slate-500/50 hover:border-violet-400/50 hover:bg-violet-500/10"
                                )}
                              >
                                {selectedHistoryIds.has(item.id) && (
                                  <Check className="w-3 h-3 text-white" />
                                )}
                              </div>
                            )}
                            
                            {/* 縮圖 */}
                            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600/30 shadow-inner">
                              {item.image_url ? (
                                <img 
                                  src={item.image_url} 
                                  alt="" 
                                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" 
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ImageIcon className="w-6 h-6 text-slate-500" />
                                </div>
                              )}
                            </div>
                            
                            {/* 資訊 */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate mb-1.5 group-hover:text-indigo-200 transition-colors">
                                {item.topic}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="inline-flex items-center text-[10px] text-slate-300 bg-slate-700/50 px-1.5 py-0.5 rounded-md border border-slate-600/30">
                                  <PlatformIcon platform={item.platform} className="w-3 h-3 mr-1" />
                                  {platformInfo?.name || item.platform}
                                </span>
                                <span className={cn(
                                  "inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-md border",
                                  qualityColors[item.quality] || qualityColors.standard
                                )}>
                                  {qualityLabel}
                                </span>
                                <span className="text-[10px] text-slate-500 flex items-center">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {new Date(item.createdAt).toLocaleDateString('zh-TW', { 
                                    month: 'short', 
                                    day: 'numeric'
                                  })}
                                </span>
                              </div>
                            </div>
                            
                            {/* 刪除按鈕 */}
                            {!isHistorySelectionMode && (
                              <button
                                onClick={(e) => deleteHistory(item.id, e)}
                                className="opacity-0 group-hover:opacity-100 p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all duration-200 border border-transparent hover:border-red-500/20"
                                title="刪除此記錄"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                            
                            {/* 選中狀態的發光效果 */}
                            {isHistorySelectionMode && selectedHistoryIds.has(item.id) && (
                              <div className="absolute inset-0 pointer-events-none rounded-xl">
                                <div className="absolute -inset-px bg-gradient-to-r from-violet-500/10 via-transparent to-indigo-500/10 rounded-xl" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  /* 空狀態 - 更精緻的設計 */
                  <div className="flex flex-col items-center justify-center py-16 px-4">
                    <div className="relative mb-4">
                      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-indigo-500/20 rounded-full blur-2xl scale-150" />
                      <div className="relative p-4 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50">
                        <Clock className="w-10 h-10 text-slate-500"/>
                      </div>
                    </div>
                    <h4 className="text-sm font-medium text-slate-300 mb-1">尚無生成記錄</h4>
                    <p className="text-xs text-slate-500 text-center">
                      生成的內容會自動保存在這裡
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 文案字數統計 - 結果顯示後 */}
            {result && (() => {
              const charCount = getCaptionLength();
              const platformLimits: Record<string, { max: number; warning: number }> = {
                instagram: { max: 2200, warning: 2000 },
                facebook: { max: 63206, warning: 500 },
                tiktok: { max: 2200, warning: 150 },
                pinterest: { max: 500, warning: 400 },
                threads: { max: 500, warning: 400 },
                linkedin: { max: 3000, warning: 1300 },
                xiaohongshu: { max: 1000, warning: 800 },
                line: { max: 10000, warning: 500 },
              };
              const limit = platformLimits[platform] || { max: 2000, warning: 1500 };
              const isOverLimit = charCount > limit.max;
              const isNearLimit = charCount > limit.warning;
              
              return (
                <div className="space-y-2 pt-2 border-t border-slate-700">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        isOverLimit ? "text-red-400" : isNearLimit ? "text-yellow-400" : "text-muted-foreground"
                      )}>
                        文案字數：{charCount} / {limit.max} 字
                      </span>
                      {isOverLimit && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          超出限制
                        </Badge>
                      )}
                    </div>
                    <span className="text-emerald-400">✓ 生成完成</span>
                  </div>
                  {/* 字數進度條 */}
                  <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        isOverLimit 
                          ? "bg-red-500" 
                          : isNearLimit 
                            ? "bg-yellow-500" 
                            : "bg-emerald-500"
                      )}
                      style={{ width: `${Math.min((charCount / limit.max) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* --- 右側：平台預覽 (Live Preview) --- */}
      <div className="flex flex-col items-center bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950 rounded-xl p-4 sm:p-6 min-h-[400px] lg:h-full overflow-x-auto lg:overflow-y-auto">
        {/* 頂部操作列 */}
        <div className="w-full flex flex-wrap items-center justify-between gap-2 mb-3 sm:mb-4">
          <Badge className="bg-indigo-600 text-white px-2 sm:px-3 py-1 text-xs sm:text-sm font-semibold shadow-lg">
            {PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.icon} {PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.name}
          </Badge>
          
          {/* 操作按鈕 - 生成結果後顯示 */}
          {result && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyCaption}
                className="flex items-center gap-1.5 bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-800 border-slate-300 dark:border-slate-600"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">已複製</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>複製文案</span>
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadImage}
                disabled={downloading}
                className="flex items-center gap-1.5 bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-800 border-slate-300 dark:border-slate-600"
              >
                {downloading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>下載中...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>下載圖片</span>
                  </>
                )}
              </Button>
              {/* 在圖片編輯室開啟 */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenInDesignStudio}
                className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 hover:from-indigo-500/20 hover:to-purple-500/20 border-indigo-500/50 text-indigo-400"
              >
                <Palette className="h-4 w-4" />
                <span className="hidden sm:inline">圖片編輯室</span>
              </Button>
              {/* 排程上架按鈕 */}
              <Button
                size="sm"
                onClick={() => {
                  if (!result) return;
                  setScheduleContent({
                    type: "social_image",
                    title: topic || "社群貼文",
                    caption: result.caption || "",
                    media_urls: result.image_urls?.length ? result.image_urls : (result.image_url ? [result.image_url] : []),
                    hashtags: keywords ? keywords.split(",").map((k: string) => k.trim()) : [],
                    originalData: result
                  });
                  setShowScheduleDialog(true);
                }}
                className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white"
              >
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">排程上架</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartEditCaption}
                className="flex items-center gap-1.5 bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-800 border-slate-300 dark:border-slate-600"
              >
                <Edit3 className="h-4 w-4" />
                <span className="hidden sm:inline">編輯文案</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowImageEditor(true)}
                className="flex items-center gap-1.5 bg-gradient-to-r from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 border-purple-500/50 text-purple-400"
              >
                <Type className="h-4 w-4" />
                <span className="hidden sm:inline">加標題</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 hover:from-indigo-500/20 hover:to-purple-500/20 border-indigo-500/50 text-indigo-400"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">分享</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={loading}
                className="flex items-center gap-1.5 bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-800 border-slate-300 dark:border-slate-600"
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                <span className="hidden sm:inline">重新生成</span>
              </Button>
            </div>
          )}
        </div>

        {/* 文案編輯面板 */}
        {isEditingCaption && (
          <Card className="w-full mb-4 bg-slate-900/95 border-indigo-500/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-indigo-400" />
                  編輯文案
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {editedCaption.length} 字
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={editedCaption}
                onChange={(e) => setEditedCaption(e.target.value)}
                rows={8}
                className="resize-none bg-slate-800 border-slate-700 focus:border-indigo-500"
                placeholder="編輯你的文案..."
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="border-slate-600"
                >
                  <X className="h-4 w-4 mr-1" />
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveCaption}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Save className="h-4 w-4 mr-1" />
                  儲存
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 平台專屬預覽 - 手機版縮放 */}
        <div className="transform scale-[0.75] sm:scale-[0.85] lg:scale-100 origin-top relative">
        {(() => {
          // 計算要傳遞給預覽組件的 result
          // 支持多圖切換：優先使用 result.image_urls，其次 uploadedImages
          const displayImages = result?.image_urls && result.image_urls.length > 0 
            ? result.image_urls 
            : uploadedImages.length > 0 
              ? uploadedImages 
              : [];
          const safeIndex = Math.min(currentImageIndex, Math.max(0, displayImages.length - 1));
          const currentDisplayImage = displayImages[safeIndex] || null;
          const totalImages = displayImages.length;
          
          const previewResult = currentDisplayImage 
            ? { 
                image_url: currentDisplayImage, 
                caption: result?.caption || '' 
              }
            : result?.image_url 
              ? result 
              : null;
          
          // 箭頭導航按鈕組件
          const NavigationArrows = () => {
            if (totalImages <= 1) return null;
            return (
              <>
                {/* 左箭頭 */}
                <button
                  type="button"
                  onClick={() => setCurrentImageIndex(prev => prev > 0 ? prev - 1 : totalImages - 1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all duration-200 shadow-lg backdrop-blur-sm"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                {/* 右箭頭 */}
                <button
                  type="button"
                  onClick={() => setCurrentImageIndex(prev => prev < totalImages - 1 ? prev + 1 : 0)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all duration-200 shadow-lg backdrop-blur-sm"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
                {/* 圖片計數器 */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-black/60 text-white text-xs font-medium backdrop-blur-sm">
                  {safeIndex + 1} / {totalImages}
                </div>
              </>
            );
          };
          
          return platform === "instagram" ? (
            <InstagramPreview 
              loading={loading}
              result={previewResult}
              quality={quality}
              navigationOverlay={<NavigationArrows />}
            />
          ) : platform === "facebook" ? (
            <FacebookPreview 
              loading={loading}
              result={previewResult}
              quality={quality}
              navigationOverlay={<NavigationArrows />}
            />
          ) : platform === "line" ? (
            <LinePreview 
              loading={loading}
              result={previewResult}
              quality={quality}
              navigationOverlay={<NavigationArrows />}
            />
          ) : platform === "tiktok" ? (
            <TikTokPreview 
              loading={loading}
              result={previewResult}
              quality={quality}
              navigationOverlay={<NavigationArrows />}
            />
          ) : platform === "pinterest" ? (
            <PinterestPreview 
              loading={loading}
              result={previewResult}
              quality={quality}
              navigationOverlay={<NavigationArrows />}
            />
          ) : platform === "threads" ? (
            <ThreadsPreview 
              loading={loading}
              result={previewResult}
              quality={quality}
              navigationOverlay={<NavigationArrows />}
            />
          ) : platform === "linkedin" ? (
            <LinkedInPreview 
              loading={loading}
              result={previewResult}
              quality={quality}
              navigationOverlay={<NavigationArrows />}
            />
          ) : platform === "xiaohongshu" ? (
            <XiaohongshuPreview 
              loading={loading}
              result={previewResult}
              quality={quality}
              navigationOverlay={<NavigationArrows />}
            />
          ) : (
          <>
            {/* 其他平台預覽（暫時使用通用模板） */}
            {/* 預覽外框 - 根據平台調整 */}
            <div className={cn(
          "relative shrink-0",
          PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.layout === "desktop" 
            ? "w-[600px]" 
            : "w-[375px]"
        )}>
          {/* 外框陰影和光澤效果 - 根據平台調整 */}
          {PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.layout !== "desktop" && (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black rounded-[50px] shadow-[0_20px_60px_rgba(0,0,0,0.4),inset_0_2px_10px_rgba(255,255,255,0.1)]"></div>
          )}
          
          {/* 螢幕 - 根據平台調整 */}
          <div className={cn(
            "relative bg-white overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,0.1)]",
            PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.layout === "desktop"
              ? "rounded-lg border-2 border-slate-200"
              : "rounded-[42px] border-[10px] border-slate-900"
          )}>
            {/* 狀態欄 (Status Bar) - 僅手機平台顯示 */}
            {PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.layout !== "desktop" && (
              <div className={cn(
                "h-7 flex items-center justify-between px-4 text-[10px] font-medium border-b",
                PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.headerColor === "bg-black"
                  ? "bg-black text-white border-slate-800"
                  : "bg-white text-slate-900 border-slate-100"
              )}>
                <span>9:41</span>
                <div className="flex items-center gap-1">
                  <div className={cn(
                    "w-4 h-2 border rounded-sm",
                    PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.headerColor === "bg-black"
                      ? "border-white"
                      : "border-slate-900"
                  )}>
                    <div className={cn(
                      "w-3 h-full rounded-sm",
                      PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.headerColor === "bg-black"
                        ? "bg-white"
                        : "bg-slate-900"
                    )}></div>
                  </div>
                  <svg className={cn(
                    "w-4 h-3",
                    PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.headerColor === "bg-black"
                      ? "text-white"
                      : "text-slate-900"
                  )} viewBox="0 0 24 12" fill="none">
                    <path d="M1 6h22M20 1l3 5-3 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>
            )}

            {/* 平台頂部列 - 根據平台調整 */}
            <div className={cn(
              "h-14 border-b flex items-center justify-between px-4 sticky top-0 z-10 backdrop-blur-sm",
              PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.headerColor,
              PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.headerColor === "bg-black" 
                ? "border-slate-800" 
                : "border-slate-100"
            )}>
              <div className="flex items-center gap-3">
                {/* 頭像 - 品牌 LOGO */}
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 rounded-full blur-sm opacity-60"></div>
                  <BrandLogo size="sm" className="relative w-9 h-9" />
                </div>
                <div className="flex flex-col">
                  <span className={cn(
                    "text-sm font-semibold leading-tight",
                    PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.primaryColor
                  )}>
                    {platform === "linkedin" ? "King Jam AI" : "king_jam_ai"}
                  </span>
                  {platform === "instagram" && (
                    <span className="text-[10px] text-slate-500">Sponsored</span>
                  )}
                  {platform === "linkedin" && (
                    <span className="text-[10px] text-slate-500">Company Page</span>
                  )}
                </div>
              </div>
              <button className={cn(
                "p-1 rounded-full transition-colors",
                PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.headerColor === "bg-black"
                  ? "hover:bg-slate-800"
                  : "hover:bg-slate-100"
              )}>
                <svg className={cn(
                  "w-5 h-5",
                  PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.primaryColor
                )} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>

            {/* 圖片區域 - 根據平台調整比例，支援多圖輪播 */}
            {(() => {
              // 計算要顯示的圖片列表
              const displayImages = result?.image_urls && result.image_urls.length > 0 
                ? result.image_urls 
                : uploadedImages.length > 0 
                  ? uploadedImages 
                  : [];
              const safeIndex = Math.min(currentImageIndex, Math.max(0, displayImages.length - 1));
              
              // 調試信息
              console.log('[Display] result:', result);
              console.log('[Display] uploadedImages:', uploadedImages);
              console.log('[Display] displayImages.length:', displayImages.length);
              
              return (
                <div className={cn(
                  "bg-gradient-to-br from-slate-50 to-slate-100 relative flex items-center justify-center group overflow-hidden",
                  PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.aspectRatio || "aspect-square"
                )}>
                  {loading ? (
                    <div className="flex flex-col items-center gap-4 text-slate-400">
                      <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl animate-pulse"></div>
                        <Loader2 className="h-12 w-12 animate-spin text-indigo-500 relative z-10" />
                      </div>
                      <div className="text-center">
                        <span className="text-sm font-medium block animate-pulse">AI 正在繪圖中...</span>
                        <span className="text-xs text-slate-400 mt-1 block">請稍候片刻</span>
                      </div>
                    </div>
                  ) : displayImages.length > 0 ? (
                    <div className="relative w-full h-full group">
                      <img 
                        src={displayImages[safeIndex]} 
                        alt={`圖片 ${safeIndex + 1}`}
                        className="w-full h-full object-cover transition-all duration-300"
                      />
                      {/* 圖片遮罩效果 */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      
                      {/* 多圖導航箭頭 */}
                      {displayImages.length > 1 && (
                        <>
                          {/* 左箭頭 */}
                          <button
                            onClick={() => setCurrentImageIndex(prev => prev > 0 ? prev - 1 : displayImages.length - 1)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm"
                          >
                            <ChevronUp className="w-5 h-5 -rotate-90" />
                          </button>
                          {/* 右箭頭 */}
                          <button
                            onClick={() => setCurrentImageIndex(prev => prev < displayImages.length - 1 ? prev + 1 : 0)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm"
                          >
                            <ChevronDown className="w-5 h-5 -rotate-90" />
                          </button>
                          {/* 指示點 */}
                          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                            {displayImages.map((_, idx) => (
                              <button
                                key={idx}
                                onClick={() => setCurrentImageIndex(idx)}
                                className={cn(
                                  "w-2 h-2 rounded-full transition-all duration-200",
                                  idx === safeIndex 
                                    ? "bg-white w-4" 
                                    : "bg-white/50 hover:bg-white/70"
                                )}
                              />
                            ))}
                          </div>
                          {/* 圖片計數 */}
                          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
                            {safeIndex + 1} / {displayImages.length}
                          </div>
                        </>
                      )}
                      
                      {/* 預覽標籤（尚未生成時） */}
                      {!result && uploadedImages.length > 0 && (
                        <div className="absolute top-3 right-3 bg-purple-500/80 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
                          預覽中
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-slate-300 flex flex-col items-center gap-3">
                      <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500/10 rounded-full blur-2xl"></div>
                        <Sparkles className="h-16 w-16 relative z-10 text-slate-300" />
                      </div>
                      <div className="text-center">
                        <span className="text-sm font-medium block">預覽區域</span>
                        <span className="text-xs text-slate-400 mt-1 block">上傳圖片或生成後將顯示於此</span>
                      </div>
                    </div>
                  )}
                  
                  {/* 品質標籤 - 更精緻的設計 */}
                  {result && (
                    <Badge className="absolute top-3 right-3 bg-black/70 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white shadow-lg px-3 py-1 text-xs font-semibold">
                      {quality === 'draft' && '⚡'}
                      {quality === 'standard' && '✨'}
                      {quality === 'premium' && '💎'}
                      {' '}
                      {quality.toUpperCase()}
                    </Badge>
                  )}
                </div>
              );
            })()}

            {/* 多圖管理條 - 縮略圖列表 */}
            {(() => {
              const displayImages = result?.image_urls && result.image_urls.length > 0 
                ? result.image_urls 
                : uploadedImages.length > 0 
                  ? uploadedImages 
                  : [];
              const safeIndex = Math.min(currentImageIndex, Math.max(0, displayImages.length - 1));
              const isResultMode = result?.image_urls && result.image_urls.length > 0;
              
              if (displayImages.length === 0 && !result) return null;
              
              return (
                <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    {/* 縮略圖列表 */}
                    <div className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent pb-1">
                      {displayImages.map((img, idx) => (
                        <div 
                          key={idx}
                          className={cn(
                            "relative group flex-shrink-0 cursor-pointer rounded-md overflow-hidden border-2 transition-all duration-200",
                            idx === safeIndex 
                              ? "border-indigo-500 ring-2 ring-indigo-500/30" 
                              : "border-transparent hover:border-slate-300"
                          )}
                          onClick={() => setCurrentImageIndex(idx)}
                        >
                          <img 
                            src={img} 
                            alt={`圖片 ${idx + 1}`}
                            className="w-12 h-12 object-cover"
                          />
                          {/* 序號標籤 */}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-0.5">
                            {idx + 1}
                          </div>
                          {/* 刪除按鈕 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isResultMode && result) {
                                // 刪除 result 中的圖片
                                const newImageUrls = [...result.image_urls];
                                newImageUrls.splice(idx, 1);
                                if (newImageUrls.length === 0) {
                                  setResult(null);
                                } else {
                                  setResult({
                                    ...result,
                                    image_url: newImageUrls[0],
                                    image_urls: newImageUrls,
                                  });
                                  if (currentImageIndex >= newImageUrls.length) {
                                    setCurrentImageIndex(Math.max(0, newImageUrls.length - 1));
                                  }
                                }
                              } else {
                                // 刪除 uploadedImages 中的圖片
                                setUploadedImages(prev => {
                                  const newImages = [...prev];
                                  newImages.splice(idx, 1);
                                  return newImages;
                                });
                                if (currentImageIndex >= uploadedImages.length - 1) {
                                  setCurrentImageIndex(Math.max(0, uploadedImages.length - 2));
                                }
                              }
                              toast.success("已刪除圖片");
                            }}
                            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      
                      {/* 新增圖片按鈕 */}
                      {displayImages.length < 20 && (
                        <div className="flex gap-1">
                          {/* 從本機上傳 */}
                          <label className="flex-shrink-0 w-12 h-12 rounded-md border-2 border-dashed border-slate-300 hover:border-indigo-400 flex items-center justify-center cursor-pointer transition-colors bg-white hover:bg-indigo-50 group">
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
                              className="hidden"
                              multiple
                              onChange={async (e) => {
                                const files = Array.from(e.target.files || []);
                                if (files.length === 0) return;
                                
                                const remaining = 20 - displayImages.length;
                                const filesToProcess = files.slice(0, remaining);
                                
                                for (let i = 0; i < filesToProcess.length; i++) {
                                  const file = filesToProcess[i];
                                  const isLast = i === filesToProcess.length - 1;
                                  try {
                                    const processedFile = await convertHeicToJpeg(file);
                                    const reader = new FileReader();
                                    reader.onload = (ev) => {
                                      const dataUrl = ev.target?.result as string;
                                      if (!dataUrl) return;
                                      
                                      // 使用 ref 檢查最新的 result 狀態
                                      if (resultRef.current?.image_urls && resultRef.current.image_urls.length > 0) {
                                        setResult(prev => {
                                          if (!prev) return null;
                                          const newUrls = [...prev.image_urls, dataUrl];
                                          if (isLast) {
                                            setTimeout(() => setCurrentImageIndex(newUrls.length - 1), 50);
                                          }
                                          return { ...prev, image_urls: newUrls };
                                        });
                                      } else {
                                        setUploadedImages(prev => {
                                          const newImages = [...prev, dataUrl];
                                          if (isLast) {
                                            setTimeout(() => setCurrentImageIndex(newImages.length - 1), 50);
                                          }
                                          return newImages;
                                        });
                                      }
                                      toast.success("圖片已添加");
                                    };
                                    reader.readAsDataURL(processedFile);
                                  } catch (err) {
                                    toast.error("圖片處理失敗");
                                  }
                                }
                                e.target.value = "";
                              }}
                            />
                            <Plus className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                          </label>
                          
                          {/* 從圖庫選擇 */}
                          <button
                            onClick={() => {
                              loadGalleryImages();
                              setShowGalleryPicker(true);
                            }}
                            className="flex-shrink-0 w-12 h-12 rounded-md border-2 border-dashed border-slate-300 hover:border-purple-400 flex items-center justify-center cursor-pointer transition-colors bg-white hover:bg-purple-50 group"
                            title="從圖庫選擇"
                          >
                            <ImageIcon className="w-5 h-5 text-slate-400 group-hover:text-purple-500 transition-colors" />
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* 圖片數量提示 */}
                    <div className="flex-shrink-0 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                      {displayImages.length}/20
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 互動按鈕列 - 根據平台顯示 */}
            {PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.showLikes && (
              <div className={cn(
                "px-4 py-3 flex justify-between items-center border-b",
                PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.headerColor === "bg-black"
                  ? "border-slate-800"
                  : "border-slate-100"
              )}>
                <div className="flex gap-5">
                  <button className="p-1 hover:scale-110 transition-transform">
                    <Heart className={cn(
                      "w-7 h-7 hover:text-red-500 transition-colors fill-transparent hover:fill-red-500",
                      PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.primaryColor
                    )} />
                  </button>
                  {PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.showComments && (
                    <button className="p-1 hover:scale-110 transition-transform">
                      <MessageCircle className={cn(
                        "w-7 h-7 hover:text-blue-500 transition-colors",
                        PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.primaryColor
                      )} />
                    </button>
                  )}
                  {platform !== "linkedin" && (
                    <button className="p-1 hover:scale-110 transition-transform">
                      <Send className={cn(
                        "w-7 h-7 hover:text-indigo-500 transition-colors",
                        PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.primaryColor
                      )} />
                    </button>
                  )}
                </div>
                {platform !== "linkedin" && (
                  <button className="p-1 hover:scale-110 transition-transform">
                    <Bookmark className={cn(
                      "w-7 h-7 hover:text-yellow-500 transition-colors fill-transparent hover:fill-yellow-500",
                      PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.primaryColor
                    )} />
                  </button>
                )}
              </div>
            )}

            {/* 文案區域 - 根據平台調整 */}
            <div className={cn(
              "px-4 py-4 space-y-3",
              PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.headerColor
            )}>
              {PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.showLikes && (
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="w-5 h-5 rounded-full border-2 border-white bg-gradient-to-tr from-pink-400 to-purple-500"></div>
                    ))}
                  </div>
                  <span className={cn(
                    "text-sm font-semibold",
                    PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.primaryColor
                  )}>
                    <span className="font-bold">1,204</span> {platform === "linkedin" ? "個讚" : "個讚"}
                  </span>
                </div>
              )}
              
              <div className="text-sm leading-relaxed">
                <span className={cn(
                  "font-semibold mr-2",
                  PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.primaryColor
                )}>
                  {platform === "linkedin" ? "King Jam AI" : "king_jam_ai"}
                </span>
                {loading ? (
                  <div className="inline-block space-y-1">
                    <span className="inline-block w-3/4 h-3 bg-slate-200 animate-pulse rounded"></span>
                    <span className="inline-block w-1/2 h-3 bg-slate-200 animate-pulse rounded block"></span>
                  </div>
                ) : result?.caption ? (
                  <span 
                    className={cn(
                      PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.primaryColor
                    )} 
                    dangerouslySetInnerHTML={{ __html: result.caption }} 
                  />
                ) : (
                  <span className={cn(
                    "italic",
                    PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.headerColor === "bg-black"
                      ? "text-slate-400"
                      : "text-slate-400"
                  )}>貼文文案將顯示於此...</span>
                )}
              </div>
              
              <div className={cn(
                "flex items-center justify-between pt-2 border-t",
                PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.headerColor === "bg-black"
                  ? "border-slate-800"
                  : "border-slate-50"
              )}>
                <span className={cn(
                  "text-xs uppercase tracking-wide",
                  PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.headerColor === "bg-black"
                    ? "text-slate-400"
                    : "text-slate-400"
                )}>2 小時前</span>
                {platform !== "linkedin" && (
                  <div className={cn(
                    "flex items-center gap-4 text-xs",
                    PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.headerColor === "bg-black"
                      ? "text-slate-400"
                      : "text-slate-400"
                  )}>
                    <span className={cn(
                      "hover:cursor-pointer",
                      PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.headerColor === "bg-black"
                        ? "hover:text-slate-300"
                        : "hover:text-slate-600"
                    )}>查看翻譯</span>
                    <span className={cn(
                      "hover:cursor-pointer",
                      PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.headerColor === "bg-black"
                        ? "hover:text-slate-300"
                        : "hover:text-slate-600"
                    )}>更多</span>
                  </div>
                )}
              </div>
            </div>

            {/* 底部導航欄 - 僅手機平台顯示 */}
            {PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.layout !== "desktop" && (
              <div className={cn(
                "h-12 border-t flex items-center justify-around",
                PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.headerColor === "bg-black"
                  ? "bg-black border-slate-800 text-slate-400"
                  : "bg-white border-slate-100 text-slate-400"
              )}>
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10.5 3.75L6 7.5v11.25h4.5V3.75zm7.5 0v15h4.5V7.5L18 3.75z"/>
                </svg>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-yellow-400 to-purple-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
              </svg>
              <div className="w-7 h-7 rounded-full bg-slate-200"></div>
              </div>
            )}
          </div>
        </div>
          </>
        )
        })()}
        </div>
      </div>

      {/* 排程上架彈窗 */}
      <ScheduleDialog
        open={showScheduleDialog}
        onClose={() => {
          setShowScheduleDialog(false);
          setScheduleContent(null);
        }}
        content={scheduleContent}
        onSuccess={() => {
          toast.success("社群貼文已加入排程！");
        }}
      />

      {/* 圖庫選擇彈窗 */}
      <Dialog open={showGalleryPicker} onOpenChange={setShowGalleryPicker}>
        <DialogContent className="max-w-[800px] max-h-[80vh] overflow-hidden bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Sparkles className="h-5 w-5 text-purple-400" />
              從圖庫選擇圖片
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {galleryLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              </div>
            ) : galleryImages.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>圖庫中沒有圖片</p>
                <p className="text-sm mt-1">生成圖片後會自動保存到圖庫</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>共 {galleryImages.length} 張圖片</span>
                  <span>點擊圖片添加到多圖貼文</span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3 max-h-[50vh] overflow-y-auto p-1">
                  {galleryImages.map((img) => {
                    const platformConfig = PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG];
                    const ratioCheck = platformConfig 
                      ? checkImageRatio(img.width, img.height, platformConfig.ratioValue)
                      : { match: true };
                    
                    return (
                      <button
                        key={img.id}
                        onClick={() => {
                          addImageFromGallery(img);
                          setShowGalleryPicker(false);
                        }}
                        className={cn(
                          "relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-105 hover:shadow-lg",
                          ratioCheck.match 
                            ? "border-slate-600 hover:border-purple-500" 
                            : "border-yellow-500/50 hover:border-yellow-500"
                        )}
                      >
                        <img 
                          src={img.thumbnail || img.dataUrl} 
                          alt={img.name}
                          className="w-full h-full object-cover"
                        />
                        {/* 來源標籤 */}
                        <span className={cn(
                          "absolute top-1 left-1 text-[9px] px-1.5 py-0.5 rounded-full font-medium",
                          img.source === "social" ? "bg-pink-500/80 text-white" :
                          img.source === "blog" ? "bg-blue-500/80 text-white" :
                          img.source === "video" ? "bg-red-500/80 text-white" :
                          img.source === "design-studio" ? "bg-purple-500/80 text-white" :
                          "bg-slate-500/80 text-white"
                        )}>
                          {img.source === "social" ? "社群" :
                           img.source === "blog" ? "部落格" :
                           img.source === "video" ? "影片" :
                           img.source === "design-studio" ? "編輯" : "上傳"}
                        </span>
                        {/* 比例警告 */}
                        {!ratioCheck.match && (
                          <span className="absolute bottom-1 right-1 text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/80 text-white font-medium">
                            ⚠️ 比例
                          </span>
                        )}
                        {/* 尺寸資訊 */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 pt-4">
                          <span className="text-[9px] text-white/80">{img.width}×{img.height}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 圖片標題編輯器彈窗 */}
      <Dialog open={showImageEditor} onOpenChange={setShowImageEditor}>
        <DialogContent className="max-w-[95vw] w-[1400px] max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Type className="h-5 w-5 text-purple-400" />
              圖片標題編輯器
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <ImageTextEditor 
              imageUrl={result?.image_urls?.[currentImageIndex] || result?.image_url} 
              onExport={(dataUrl) => {
                // 更新結果圖片為編輯後的版本
                if (result) {
                  const newImageUrls = [...result.image_urls];
                  newImageUrls[currentImageIndex] = dataUrl;
                  setResult({ 
                    ...result, 
                    image_url: currentImageIndex === 0 ? dataUrl : result.image_url,
                    image_urls: newImageUrls
                  });
                }
                setShowImageEditor(false);
                toast.success("圖片已更新！");
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}