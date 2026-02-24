"use client";

import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Calendar, Clock, X, Loader2, CheckCircle2, AlertCircle,
  Image as ImageIcon, Video, FileText, Lightbulb, Zap, TrendingUp,
  Hash, Edit3, Eye, Save, Send, Globe, Link2, Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ==================== 類型定義 ====================
export interface ScheduleContent {
  type: "social_image" | "short_video" | "blog_post";
  title: string;
  caption: string;
  media_urls: string[];
  hashtags: string[];
  // 生成時選擇的平台（用於預設勾選）
  platform?: string;
  // 原始內容（用於預覽）
  originalData?: any;
}

interface TimeSlotSuggestion {
  time: string;
  day_of_week: number;
  score: number;
  reason: string;
}

interface SmartScheduleResponse {
  suggested_slots: TimeSlotSuggestion[];
  platform_tips: Record<string, string>;
  next_available_slots: string[];
}

interface PlatformInfo {
  platform: string;
  name: string;
  icon: string;
  compatible: boolean;
  connected: boolean;
  account_id: number | null;
  account_username: string | null;
  account_avatar: string | null;
}

interface ScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  content: ScheduleContent | null;
  onSuccess?: () => void;
}

type PublishMode = "schedule" | "publish_now";

// 內容類型配置
const CONTENT_TYPE_CONFIG = {
  social_image: {
    label: "社群圖文",
    icon: ImageIcon,
    color: "from-pink-500 to-rose-500",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/30",
    textColor: "text-pink-400"
  },
  short_video: {
    label: "短影音",
    icon: Video,
    color: "from-purple-500 to-indigo-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    textColor: "text-purple-400"
  },
  blog_post: {
    label: "部落格文章",
    icon: FileText,
    color: "from-blue-500 to-cyan-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    textColor: "text-blue-400"
  }
};

export function ScheduleDialog({ open, onClose, content, onSuccess }: ScheduleDialogProps) {
  // 編輯狀態
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState<ScheduleContent | null>(null);

  // 排程狀態
  const [scheduledAt, setScheduledAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [publishMode, setPublishMode] = useState<PublishMode>("schedule");

  // 平台選擇
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);
  const [loadingPlatforms, setLoadingPlatforms] = useState(false);

  // 智慧排程建議
  const [smartSuggestions, setSmartSuggestions] = useState<SmartScheduleResponse | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // 初始化編輯內容 & 載入平台
  useEffect(() => {
    if (content && open) {
      setEditedContent({ ...content });
      setEditMode(false);
      setPublishMode("schedule");
      setSelectedAccountIds([]);
      fetchSmartSuggestions();
      fetchCompatiblePlatforms(content.type, content.platform);
    }
  }, [content, open]);

  // 內容類型 → 適用平台映射（前端 fallback）
  const CONTENT_TYPE_PLATFORM_MAP: Record<string, string[]> = {
    social_image: ["instagram", "facebook", "threads", "linkedin", "line", "tiktok"],
    short_video: ["instagram", "facebook", "tiktok", "youtube", "linkedin", "line", "threads"],
    blog_post: ["wordpress", "facebook", "linkedin", "threads", "line"],
  };

  const PLATFORM_DISPLAY: Record<string, { name: string; icon: string }> = {
    instagram: { name: "Instagram", icon: "📸" },
    facebook: { name: "Facebook", icon: "📘" },
    threads: { name: "Threads", icon: "🧵" },
    tiktok: { name: "TikTok", icon: "🎵" },
    youtube: { name: "YouTube", icon: "📺" },
    linkedin: { name: "LinkedIn", icon: "💼" },
    line: { name: "LINE", icon: "💬" },
    wordpress: { name: "WordPress", icon: "📝" },
  };

  // 載入適用平台（優先用新 API，fallback 用 /accounts + 本地映射）
  const fetchCompatiblePlatforms = useCallback(async (contentType: string, defaultPlatform?: string) => {
    setLoadingPlatforms(true);
    try {
      // 嘗試新 API
      const res = await api.get(`/scheduler/compatible-platforms?content_type=${contentType}`);
      const platformList: PlatformInfo[] = res.data.platforms || [];
      if (platformList.length > 0) {
        setPlatforms(platformList);
        // 只預設勾選原始生成平台（若有指定），否則勾選所有適用的
        const defaultSelected = defaultPlatform
          ? platformList
            .filter(p => p.platform === defaultPlatform && p.compatible && p.connected && p.account_id)
            .map(p => p.account_id as number)
          : platformList
            .filter(p => p.compatible && p.connected && p.account_id)
            .map(p => p.account_id as number);
        setSelectedAccountIds(defaultSelected);
        return;
      }
    } catch {
      // 新 API 不可用，使用 fallback
    }

    // Fallback: 用 /scheduler/accounts + 本地映射
    try {
      const res = await api.get("/scheduler/accounts");
      const accounts: any[] = res.data || [];
      const compatiblePlatforms = CONTENT_TYPE_PLATFORM_MAP[contentType] || [];

      // 建立 platform → account 映射
      const accountMap: Record<string, any> = {};
      for (const acc of accounts) {
        if (!accountMap[acc.platform]) {
          accountMap[acc.platform] = acc;
        }
      }

      // 組合平台列表
      const platformList: PlatformInfo[] = Object.entries(PLATFORM_DISPLAY).map(([id, display]) => {
        const account = accountMap[id];
        return {
          platform: id,
          name: display.name,
          icon: display.icon,
          compatible: compatiblePlatforms.includes(id),
          connected: !!account,
          account_id: account?.id || null,
          account_username: account?.platform_username || null,
          account_avatar: account?.platform_avatar || null,
        };
      });

      // 排序：適用 + 已連結排前面
      platformList.sort((a, b) => {
        if (a.compatible !== b.compatible) return a.compatible ? -1 : 1;
        if (a.connected !== b.connected) return a.connected ? -1 : 1;
        return 0;
      });

      setPlatforms(platformList);
      // 只預設勾選原始生成平台（若有指定），否則勾選所有適用的
      const defaultSelected = defaultPlatform
        ? platformList
          .filter(p => p.platform === defaultPlatform && p.compatible && p.connected && p.account_id)
          .map(p => p.account_id as number)
        : platformList
          .filter(p => p.compatible && p.connected && p.account_id)
          .map(p => p.account_id as number);
      setSelectedAccountIds(defaultSelected);
    } catch (error) {
      console.error("載入平台失敗:", error);
    } finally {
      setLoadingPlatforms(false);
    }
  }, []);

  // 載入智慧排程建議
  const fetchSmartSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    try {
      const res = await api.get("/scheduler/smart-schedule?count=5");
      setSmartSuggestions(res.data);
    } catch (error) {
      console.error("載入智慧排程建議失敗:", error);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  // 套用智慧建議時段
  const applySmartSlot = (slotTime: string) => {
    const date = new Date(slotTime);
    const formatted = date.toISOString().slice(0, 16);
    setScheduledAt(formatted);
    toast.success("已套用建議時段");
  };

  // 切換平台選擇
  const togglePlatform = (accountId: number) => {
    setSelectedAccountIds(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  // 建立排程 / 立即發布
  const handleSubmit = async () => {
    if (!editedContent) return;

    if (!editedContent.caption && !editedContent.title) {
      toast.error("請輸入內容");
      return;
    }

    if (publishMode === "schedule" && !scheduledAt) {
      toast.error("請選擇排程時間");
      return;
    }

    if (selectedAccountIds.length === 0) {
      toast.error("請至少選擇一個發布平台");
      return;
    }

    setCreating(true);
    try {
      // 嘗試新的批次 API
      try {
        const payload: any = {
          social_account_ids: selectedAccountIds,
          content_type: editedContent.type,
          title: editedContent.title,
          caption: editedContent.caption,
          media_urls: editedContent.media_urls,
          hashtags: editedContent.hashtags,
          mode: publishMode,
          timezone: "Asia/Taipei",
        };

        if (publishMode === "schedule") {
          payload.scheduled_at = new Date(scheduledAt).toISOString();
        }

        const res = await api.post("/scheduler/posts/batch", payload);
        const data = res.data;

        if (publishMode === "publish_now") {
          const successCount = data.results?.filter((r: any) => r.status === "published").length || 0;
          const failedCount = data.results?.filter((r: any) => r.status === "failed").length || 0;

          if (failedCount > 0) {
            toast.warning(`已發布 ${successCount} 個平台，${failedCount} 個失敗`, {
              description: data.results
                ?.filter((r: any) => r.status === "failed")
                .map((r: any) => `${r.platform}: ${r.message}`)
                .join("；"),
            });
          } else {
            toast.success(`已成功發布到 ${successCount} 個平台！`);
          }
        } else {
          toast.success(`排程已建立（${selectedAccountIds.length} 個平台）`, {
            description: `將於 ${new Date(scheduledAt).toLocaleString("zh-TW")} 發布`,
          });
        }

        onSuccess?.();
        onClose();
        return;
      } catch (batchError: any) {
        // 批次 API 不可用（404）或參數不符（422），使用舊版逐筆建立
        if (batchError.response?.status !== 404 && batchError.response?.status !== 422) throw batchError;
      }

      // Fallback: 逐筆建立排程
      let successCount = 0;
      let failedCount = 0;

      for (const accountId of selectedAccountIds) {
        try {
          const scheduledTime = publishMode === "schedule"
            ? new Date(scheduledAt).toISOString()
            : new Date(Date.now() + 60000).toISOString(); // 立即發布時設 1 分鐘後

          const postRes = await api.post("/scheduler/posts", {
            social_account_id: accountId,
            content_type: editedContent.type,
            title: editedContent.title,
            caption: editedContent.caption,
            media_urls: editedContent.media_urls,
            hashtags: editedContent.hashtags,
            scheduled_at: scheduledTime,
            timezone: "Asia/Taipei",
          });

          // 若為立即發布，呼叫 publish-now
          if (publishMode === "publish_now" && postRes.data?.id) {
            try {
              await api.post(`/scheduler/posts/${postRes.data.id}/publish-now`);
            } catch {
              // 發布失敗不影響流程
            }
          }
          successCount++;
        } catch {
          failedCount++;
        }
      }

      if (publishMode === "publish_now") {
        if (failedCount > 0) {
          toast.warning(`已處理 ${successCount} 個平台，${failedCount} 個失敗`);
        } else {
          toast.success(`已成功發布到 ${successCount} 個平台！`);
        }
      } else {
        toast.success(`排程已建立（${successCount} 個平台）`, {
          description: `將於 ${new Date(scheduledAt).toLocaleString("zh-TW")} 發布`,
        });
      }

      onSuccess?.();
      onClose();
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      // detail 可能是字串或 Pydantic 驗證錯誤陣列 [{type, loc, msg, input}]
      const errorMsg = typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: any) => d.msg || JSON.stringify(d)).join("；")
          : "操作失敗";
      toast.error(errorMsg);
    } finally {
      setCreating(false);
    }
  };

  // 更新 hashtags
  const handleHashtagsChange = (value: string) => {
    if (!editedContent) return;
    const tags = value.split(",").map(t => t.trim()).filter(Boolean);
    setEditedContent({ ...editedContent, hashtags: tags });
  };

  if (!open || !content || !editedContent) return null;

  const typeConfig = CONTENT_TYPE_CONFIG[editedContent.type];
  const TypeIcon = typeConfig.icon;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <Card className="w-full max-w-2xl bg-slate-900 border-slate-700 my-8 animate-in zoom-in-95 duration-300">
        <CardHeader className="border-b border-slate-700">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-3">
              <div className={cn("p-2 rounded-xl bg-gradient-to-br", typeConfig.color)}>
                {publishMode === "publish_now" ? (
                  <Send className="w-5 h-5 text-white" />
                ) : (
                  <Calendar className="w-5 h-5 text-white" />
                )}
              </div>
              {publishMode === "publish_now" ? "立即發布" : "排程上架確認"}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          <CardDescription className="text-slate-400">
            確認內容後選擇平台，{publishMode === "publish_now" ? "立即" : "排程"}發布到多個社群
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-5">
          {/* 發布模式切換 */}
          <div className="flex rounded-xl bg-slate-800 p-1 gap-1">
            <button
              type="button"
              onClick={() => setPublishMode("schedule")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                publishMode === "schedule"
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <Clock className="w-4 h-4" />
              排程發布
            </button>
            <button
              type="button"
              onClick={() => setPublishMode("publish_now")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                publishMode === "publish_now"
                  ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <Zap className="w-4 h-4" />
              立即發布
            </button>
          </div>

          {/* 內容類型標籤 */}
          <div className="flex items-center gap-2">
            <Badge className={cn("px-3 py-1", typeConfig.bgColor, typeConfig.textColor, typeConfig.borderColor, "border")}>
              <TypeIcon className="w-3.5 h-3.5 mr-1.5" />
              {typeConfig.label}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditMode(!editMode)}
              className={cn(
                "text-xs",
                editMode ? "text-amber-400 hover:text-amber-300" : "text-slate-400 hover:text-white"
              )}
            >
              {editMode ? (
                <>
                  <Eye className="w-3.5 h-3.5 mr-1" />
                  預覽模式
                </>
              ) : (
                <>
                  <Edit3 className="w-3.5 h-3.5 mr-1" />
                  編輯內容
                </>
              )}
            </Button>
          </div>

          {/* 內容預覽/編輯區 */}
          <div className={cn(
            "rounded-xl border p-4",
            typeConfig.borderColor,
            typeConfig.bgColor
          )}>
            {editMode ? (
              // 編輯模式
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-slate-300 mb-1.5 block">標題</label>
                  <Input
                    value={editedContent.title}
                    onChange={(e) => setEditedContent({ ...editedContent, title: e.target.value })}
                    placeholder="輸入標題..."
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-300 mb-1.5 block">文案內容</label>
                  <Textarea
                    value={editedContent.caption}
                    onChange={(e) => setEditedContent({ ...editedContent, caption: e.target.value })}
                    placeholder="輸入文案..."
                    className="bg-slate-800 border-slate-600 text-white min-h-[100px]"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-300 mb-1.5 block flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5" />
                    標籤（逗號分隔）
                  </label>
                  <Input
                    value={editedContent.hashtags.join(", ")}
                    onChange={(e) => handleHashtagsChange(e.target.value)}
                    placeholder="例如: 行銷, 品牌, 社群..."
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
              </div>
            ) : (
              // 預覽模式
              <div className="flex gap-4">
                {/* 媒體預覽 */}
                {editedContent.media_urls.length > 0 && (
                  <div className="flex-shrink-0">
                    {editedContent.type === "short_video" ? (
                      <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                        <Video className="w-8 h-8 text-white" />
                      </div>
                    ) : (
                      <img
                        src={editedContent.media_urls[0]}
                        alt="預覽"
                        className="w-24 h-24 rounded-lg object-cover border border-slate-600"
                      />
                    )}
                  </div>
                )}

                {/* 文字內容 */}
                <div className="flex-1 min-w-0">
                  {editedContent.title && (
                    <h4 className="text-white font-medium mb-2">{editedContent.title}</h4>
                  )}
                  <p className="text-slate-300 text-sm line-clamp-3">{editedContent.caption}</p>

                  {editedContent.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {editedContent.hashtags.slice(0, 5).map((tag, i) => (
                        <Badge key={i} className="bg-slate-700/50 text-slate-300 text-xs">
                          #{tag}
                        </Badge>
                      ))}
                      {editedContent.hashtags.length > 5 && (
                        <Badge className="bg-slate-700/50 text-slate-400 text-xs">
                          +{editedContent.hashtags.length - 5}
                        </Badge>
                      )}
                    </div>
                  )}

                  {editedContent.media_urls.length > 1 && (
                    <p className="text-xs text-slate-500 mt-2">
                      +{editedContent.media_urls.length - 1} 個媒體文件
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 平台選擇區塊 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-slate-300" />
              <span className="text-sm text-slate-300 font-medium">選擇發布平台</span>
              {loadingPlatforms && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
              {selectedAccountIds.length > 0 && (
                <Badge className="bg-emerald-500/20 text-emerald-400 text-xs ml-auto">
                  已選 {selectedAccountIds.length} 個
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {platforms.map((p) => {
                const isSelected = p.account_id ? selectedAccountIds.includes(p.account_id) : false;
                const canSelect = p.compatible && p.connected && p.account_id;

                return (
                  <button
                    key={p.platform}
                    type="button"
                    disabled={!canSelect}
                    onClick={() => canSelect && p.account_id && togglePlatform(p.account_id)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                      canSelect && isSelected
                        ? "border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/30"
                        : canSelect
                          ? "border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800"
                          : "border-slate-800 bg-slate-900/50 opacity-50 cursor-not-allowed"
                    )}
                  >
                    {/* 勾選框 */}
                    <div className={cn(
                      "w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all",
                      canSelect && isSelected
                        ? "border-emerald-500 bg-emerald-500"
                        : canSelect
                          ? "border-slate-600"
                          : "border-slate-700"
                    )}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>

                    {/* 平台圖示+名稱 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{p.icon}</span>
                        <span className={cn(
                          "text-sm font-medium",
                          canSelect ? "text-white" : "text-slate-500"
                        )}>
                          {p.name}
                        </span>
                      </div>
                      {p.connected && p.account_username ? (
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          @{p.account_username}
                        </p>
                      ) : !p.compatible ? (
                        <p className="text-xs text-slate-600 mt-0.5">不支援此格式</p>
                      ) : (
                        <p className="text-xs text-amber-500/70 mt-0.5 flex items-center gap-1">
                          <Link2 className="w-3 h-3" />
                          未連結
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 排程時間設定（僅排程模式） */}
          {publishMode === "schedule" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-300 mb-2 block flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  排程發布時間
                </label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white"
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>

              {/* 智慧排程建議 */}
              <div className="p-4 bg-gradient-to-r from-yellow-900/20 to-amber-900/20 rounded-xl border border-yellow-500/30">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4 text-yellow-400" />
                  <span className="text-yellow-400 font-medium text-sm">智慧時段建議</span>
                  {loadingSuggestions && (
                    <Loader2 className="w-3 h-3 animate-spin text-yellow-400 ml-auto" />
                  )}
                </div>

                {smartSuggestions ? (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-400 mb-2">
                      {smartSuggestions.platform_tips?.content_tip || "點選下方時段自動填入"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {smartSuggestions.next_available_slots.slice(0, 4).map((slot, idx) => {
                        const date = new Date(slot);
                        const isSelected = scheduledAt === date.toISOString().slice(0, 16);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => applySmartSlot(slot)}
                            className={cn(
                              "px-3 py-2 rounded-lg text-xs transition-all flex items-center gap-2",
                              isSelected
                                ? "bg-yellow-500 text-black"
                                : "bg-slate-800 text-slate-300 hover:bg-yellow-500/20 hover:text-yellow-300 border border-slate-700"
                            )}
                          >
                            <TrendingUp className="w-3 h-3" />
                            <span>
                              {date.toLocaleDateString("zh-TW", { weekday: "short", month: "short", day: "numeric" })}
                              {" "}
                              {date.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {smartSuggestions.suggested_slots[idx] && (
                              <Badge className="bg-green-500/20 text-green-400 text-[10px]">
                                {smartSuggestions.suggested_slots[idx].score}分
                              </Badge>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {smartSuggestions.suggested_slots[0]?.reason && (
                      <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {smartSuggestions.suggested_slots[0].reason}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={fetchSmartSuggestions}
                      disabled={loadingSuggestions}
                      className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                    >
                      {loadingSuggestions ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          分析中...
                        </>
                      ) : (
                        <>
                          <Zap className="w-3 h-3 mr-1" />
                          取得建議時段
                        </>
                      )}
                    </Button>
                    <span className="text-xs text-slate-500">根據最佳發文時段推薦</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 按鈕 */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-slate-400"
            >
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                creating ||
                selectedAccountIds.length === 0 ||
                (publishMode === "schedule" && !scheduledAt) ||
                (!editedContent.caption && !editedContent.title)
              }
              className={cn(
                "bg-gradient-to-r hover:opacity-90 min-w-[160px]",
                publishMode === "publish_now"
                  ? "from-emerald-500 to-green-500"
                  : typeConfig.color
              )}
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  處理中...
                </>
              ) : publishMode === "publish_now" ? (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  立即發布（{selectedAccountIds.length} 個平台）
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  確認排程（{selectedAccountIds.length} 個平台）
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ScheduleDialog;
