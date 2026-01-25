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
  Hash, Edit3, Eye, Save
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

interface ScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  content: ScheduleContent | null;
  onSuccess?: () => void;
}

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
  
  // 智慧排程建議
  const [smartSuggestions, setSmartSuggestions] = useState<SmartScheduleResponse | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // 初始化編輯內容
  useEffect(() => {
    if (content) {
      setEditedContent({ ...content });
      setEditMode(false);
      fetchSmartSuggestions();
    }
  }, [content]);

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

  // 建立排程
  const handleCreateSchedule = async () => {
    if (!editedContent) return;
    
    if (!scheduledAt) {
      toast.error("請選擇排程時間");
      return;
    }

    if (!editedContent.caption && !editedContent.title) {
      toast.error("請輸入內容");
      return;
    }

    setCreating(true);
    try {
      await api.post("/scheduler/posts", {
        content_type: editedContent.type,
        title: editedContent.title,
        caption: editedContent.caption,
        media_urls: editedContent.media_urls,
        hashtags: editedContent.hashtags,
        scheduled_at: new Date(scheduledAt).toISOString(),
        timezone: "Asia/Taipei",
      });
      
      toast.success("排程已建立！", {
        description: `將於 ${new Date(scheduledAt).toLocaleString("zh-TW")} 發布`,
      });
      
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "建立排程失敗");
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
                <Calendar className="w-5 h-5 text-white" />
              </div>
              排程上架確認
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
            確認內容後設定發布時間，排程將自動執行
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
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

          {/* 排程時間設定 */}
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
              onClick={handleCreateSchedule}
              disabled={creating || !scheduledAt || (!editedContent.caption && !editedContent.title)}
              className={cn("bg-gradient-to-r", typeConfig.color, "hover:opacity-90")}
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  建立中...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  確認排程
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
