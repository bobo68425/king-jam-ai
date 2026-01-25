"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sparkles, Plus, Search, Filter, MoreHorizontal, Edit, Trash2,
  Copy, Eye, History, ChevronRight, FileText, Image, Video, Mic,
  Loader2, Check, X, Code, Settings, Play, ArrowLeft, Save,
  GitBranch, Clock, Star, TrendingUp, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ============================================================
// Types
// ============================================================

interface Prompt {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  generation_type: string;
  supported_models: string[];
  default_model: string | null;
  tags: string[];
  usage_count: number;
  is_active: boolean;
  is_system: boolean;
  is_public: boolean;
  current_version_id: number | null;
  created_at: string;
  updated_at: string | null;
  current_version?: PromptVersion | null;
}

interface PromptVersion {
  id: number;
  prompt_id: number;
  version_number: number;
  version_tag: string | null;
  positive_template: string;
  negative_template: string | null;
  model_config: Record<string, any>;
  variables: VariableDefinition[];
  system_prompt: string | null;
  output_format: Record<string, any>;
  examples: any[];
  changelog: string | null;
  is_active: boolean;
  is_draft: boolean;
  avg_rating: number;
  total_ratings: number;
  created_at: string;
}

interface VariableDefinition {
  name: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  default?: any;
  options?: string[];
}

interface Category {
  id: string;
  name: string;
  icon: string;
}

// ============================================================
// Constants
// ============================================================

const CATEGORIES: Category[] = [
  { id: "social_media", name: "社群媒體文案", icon: "📱" },
  { id: "blog", name: "部落格文章", icon: "📝" },
  { id: "marketing", name: "行銷文案", icon: "📣" },
  { id: "product", name: "產品描述", icon: "🛍️" },
  { id: "video_script", name: "影片腳本", icon: "🎬" },
  { id: "image_prompt", name: "圖片生成", icon: "🎨" },
  { id: "video_prompt", name: "影片生成", icon: "🎥" },
  { id: "tts_prompt", name: "語音合成", icon: "🎙️" },
];

const GENERATION_TYPES = [
  { id: "copywriting", name: "文案生成", icon: FileText, color: "text-blue-400" },
  { id: "image", name: "圖片生成", icon: Image, color: "text-pink-400" },
  { id: "video", name: "影片生成", icon: Video, color: "text-purple-400" },
  { id: "tts", name: "語音合成", icon: Mic, color: "text-green-400" },
];

// ============================================================
// Components
// ============================================================

function PromptCard({ prompt, onEdit, onDelete, onDuplicate }: {
  prompt: Prompt;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const category = CATEGORIES.find(c => c.id === prompt.category);
  const genType = GENERATION_TYPES.find(t => t.id === prompt.generation_type);
  const GenIcon = genType?.icon || FileText;

  return (
    <Card className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all group">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2.5 rounded-xl bg-gradient-to-br",
              prompt.generation_type === "copywriting" && "from-blue-500/20 to-indigo-500/20",
              prompt.generation_type === "image" && "from-pink-500/20 to-rose-500/20",
              prompt.generation_type === "video" && "from-purple-500/20 to-violet-500/20",
              prompt.generation_type === "tts" && "from-green-500/20 to-emerald-500/20"
            )}>
              <GenIcon className={cn("w-5 h-5", genType?.color)} />
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors">
                {prompt.name}
              </h3>
              <p className="text-xs text-slate-500">{category?.icon} {category?.name}</p>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
              <DropdownMenuItem onClick={onEdit} className="text-slate-300 focus:text-white focus:bg-slate-700">
                <Edit className="w-4 h-4 mr-2" />
                編輯
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate} className="text-slate-300 focus:text-white focus:bg-slate-700">
                <Copy className="w-4 h-4 mr-2" />
                複製
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-red-400 focus:text-red-300 focus:bg-red-500/10">
                <Trash2 className="w-4 h-4 mr-2" />
                刪除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description */}
        {prompt.description && (
          <p className="text-sm text-slate-400 mb-3 line-clamp-2">{prompt.description}</p>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {prompt.tags.slice(0, 4).map((tag, i) => (
            <Badge key={i} variant="secondary" className="text-[10px] bg-slate-700/50 text-slate-400">
              {tag}
            </Badge>
          ))}
          {prompt.tags.length > 4 && (
            <Badge variant="secondary" className="text-[10px] bg-slate-700/50 text-slate-400">
              +{prompt.tags.length - 4}
            </Badge>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {prompt.usage_count} 次使用
            </span>
            {prompt.current_version && (
              <span className="flex items-center gap-1">
                <GitBranch className="w-3 h-3" />
                v{prompt.current_version.version_number}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {prompt.is_system && (
              <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-0">系統</Badge>
            )}
            <Badge className={cn(
              "text-[10px] border-0",
              prompt.is_active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
            )}>
              {prompt.is_active ? "啟用" : "停用"}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function PromptManagementPage() {
  const router = useRouter();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [activeTab, setActiveTab] = useState("list");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 12;

  // Fetch prompts
  const fetchPrompts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("page_size", pageSize.toString());
      if (search) params.append("search", search);
      if (categoryFilter !== "all") params.append("category", categoryFilter);
      if (typeFilter !== "all") params.append("generation_type", typeFilter);

      const res = await api.get(`/prompts?${params.toString()}`);
      setPrompts(res.data.items);
      setTotalPages(res.data.total_pages);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter, typeFilter]);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  // Handlers
  const handleDelete = async (promptId: number) => {
    if (!confirm("確定要刪除此 Prompt 嗎？")) return;
    
    try {
      await api.delete(`/prompts/${promptId}`);
      toast.success("已刪除");
      fetchPrompts();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "刪除失敗");
    }
  };

  const handleDuplicate = async (prompt: Prompt) => {
    try {
      // 獲取完整資料
      const res = await api.get(`/prompts/${prompt.id}`);
      const fullPrompt = res.data;
      
      // 創建副本
      await api.post("/prompts", {
        name: `${fullPrompt.name} (複製)`,
        description: fullPrompt.description,
        category: fullPrompt.category,
        generation_type: fullPrompt.generation_type,
        positive_template: fullPrompt.current_version?.positive_template || "",
        negative_template: fullPrompt.current_version?.negative_template,
        model_config: fullPrompt.current_version?.model_config,
        variables: fullPrompt.current_version?.variables,
        system_prompt: fullPrompt.current_version?.system_prompt,
        output_format: fullPrompt.current_version?.output_format,
        examples: fullPrompt.current_version?.examples,
        supported_models: fullPrompt.supported_models,
        default_model: fullPrompt.default_model,
        tags: fullPrompt.tags,
      });
      
      toast.success("已複製");
      fetchPrompts();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "複製失敗");
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/20">
            <Sparkles className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Prompt 管理中心</h1>
            <p className="text-sm text-slate-400">管理與優化 AI 生成的提示詞模板</p>
          </div>
        </div>

        <Button
          onClick={() => router.push("/dashboard/admin/prompts/new")}
          className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500"
        >
          <Plus className="w-4 h-4 mr-2" />
          新增 Prompt
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="搜尋 Prompt..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-600 text-white"
              />
            </div>

            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-[180px] bg-slate-800 border-slate-600 text-white">
                <SelectValue placeholder="所有分類" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="all" className="text-white">所有分類</SelectItem>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.id} value={cat.id} className="text-white">
                    {cat.icon} {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Type Filter */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-[150px] bg-slate-800 border-slate-600 text-white">
                <SelectValue placeholder="所有類型" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="all" className="text-white">所有類型</SelectItem>
                {GENERATION_TYPES.map(type => (
                  <SelectItem key={type.id} value={type.id} className="text-white">
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {GENERATION_TYPES.map(type => {
          const count = prompts.filter(p => p.generation_type === type.id).length;
          const Icon = type.icon;
          return (
            <Card key={type.id} className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("p-2 rounded-lg bg-slate-700/50")}>
                  <Icon className={cn("w-5 h-5", type.color)} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{count}</p>
                  <p className="text-xs text-slate-400">{type.name}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Prompt List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
        </div>
      ) : prompts.length === 0 ? (
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="py-16 text-center">
            <Sparkles className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <h3 className="text-lg font-medium text-slate-300 mb-2">尚無 Prompt</h3>
            <p className="text-slate-500 mb-4">建立您的第一個 Prompt 模板</p>
            <Button
              onClick={() => router.push("/dashboard/admin/prompts/new")}
              className="bg-violet-600 hover:bg-violet-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              新增 Prompt
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {prompts.map(prompt => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              onEdit={() => router.push(`/dashboard/admin/prompts/${prompt.id}`)}
              onDelete={() => handleDelete(prompt.id)}
              onDuplicate={() => handleDuplicate(prompt)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="border-slate-600"
          >
            上一頁
          </Button>
          <span className="text-sm text-slate-400">
            第 {page} / {totalPages} 頁
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
            className="border-slate-600"
          >
            下一頁
          </Button>
        </div>
      )}
    </div>
  );
}
