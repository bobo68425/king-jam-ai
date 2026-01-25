"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  Sparkles, ArrowLeft, Save, Plus, Trash2, Code, Eye, 
  FileText, Image, Video, Mic, Loader2, AlertCircle, Info,
  GitBranch, Clock, Star, TrendingUp, History, Play, RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";

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
  default?: string;
  options?: string[];
}

// ============================================================
// Main Component
// ============================================================

export default function PromptDetailPage() {
  const router = useRouter();
  const params = useParams();
  const promptId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<PromptVersion | null>(null);
  const [activeTab, setActiveTab] = useState("details");

  // Edit state
  const [editMode, setEditMode] = useState(false);
  const [editedTemplate, setEditedTemplate] = useState("");
  const [editedNegative, setEditedNegative] = useState("");
  const [editedSystem, setEditedSystem] = useState("");
  const [editedVariables, setEditedVariables] = useState<VariableDefinition[]>([]);
  const [changelog, setChangelog] = useState("");

  // Test state
  const [testVariables, setTestVariables] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  // Fetch prompt details
  const fetchPrompt = useCallback(async () => {
    try {
      const [promptRes, versionsRes] = await Promise.all([
        api.get(`/prompts/${promptId}`),
        api.get(`/prompts/${promptId}/versions`)
      ]);

      setPrompt(promptRes.data);
      setVersions(versionsRes.data);

      // 設定當前版本
      if (promptRes.data.current_version) {
        setSelectedVersion(promptRes.data.current_version);
        initEditState(promptRes.data.current_version);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "載入失敗");
      router.push("/dashboard/admin/prompts");
    } finally {
      setLoading(false);
    }
  }, [promptId, router]);

  useEffect(() => {
    fetchPrompt();
  }, [fetchPrompt]);

  const initEditState = (version: PromptVersion) => {
    setEditedTemplate(version.positive_template);
    setEditedNegative(version.negative_template || "");
    setEditedSystem(version.system_prompt || "");
    setEditedVariables(version.variables || []);
    
    // 初始化測試變數
    const vars: Record<string, string> = {};
    version.variables?.forEach(v => {
      vars[v.name] = v.default || "";
    });
    setTestVariables(vars);
  };

  const handleSelectVersion = (version: PromptVersion) => {
    setSelectedVersion(version);
    initEditState(version);
    setTestResult(null);
  };

  const handleCreateVersion = async () => {
    if (!editedTemplate.trim()) {
      toast.error("請輸入正向提示詞模板");
      return;
    }

    setSaving(true);
    try {
      await api.post(`/prompts/${promptId}/versions`, {
        positive_template: editedTemplate,
        negative_template: editedNegative || null,
        system_prompt: editedSystem || null,
        variables: editedVariables,
        model_config: selectedVersion?.model_config || {},
        changelog: changelog || null,
        set_as_current: true,
      });

      toast.success("新版本已建立");
      setEditMode(false);
      setChangelog("");
      fetchPrompt();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "建立失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleRollback = async (versionId: number) => {
    if (!confirm("確定要回滾到此版本嗎？")) return;

    try {
      await api.put(`/prompts/${promptId}/current-version?version_id=${versionId}`);
      toast.success("已回滾到指定版本");
      fetchPrompt();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "回滾失敗");
    }
  };

  const handleTest = async () => {
    if (!selectedVersion) return;

    setTesting(true);
    try {
      const res = await api.post(`/prompts/${promptId}/render`, {
        variables: testVariables,
        version_id: selectedVersion.id,
      });

      setTestResult(res.data.rendered.positive);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "測試失敗");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!prompt) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard/admin/prompts")}
          className="text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            {prompt.name}
          </h1>
          <p className="text-sm text-slate-400 mt-1">{prompt.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn(
            prompt.is_active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
          )}>
            {prompt.is_active ? "啟用中" : "已停用"}
          </Badge>
          {prompt.is_system && (
            <Badge className="bg-amber-500/20 text-amber-400">系統預設</Badge>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-2xl font-bold text-white">{prompt.usage_count}</p>
              <p className="text-xs text-slate-400">使用次數</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 flex items-center gap-3">
            <GitBranch className="w-5 h-5 text-purple-400" />
            <div>
              <p className="text-2xl font-bold text-white">{versions.length}</p>
              <p className="text-xs text-slate-400">版本數</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 flex items-center gap-3">
            <Star className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-2xl font-bold text-white">
                {selectedVersion?.avg_rating?.toFixed(1) || "-"}
              </p>
              <p className="text-xs text-slate-400">平均評分</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-sm font-medium text-white">
                {prompt.updated_at ? format(new Date(prompt.updated_at), "MM/dd HH:mm", { locale: zhTW }) : "-"}
              </p>
              <p className="text-xs text-slate-400">最後更新</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-800/50 border border-slate-700">
          <TabsTrigger value="details" className="data-[state=active]:bg-violet-600">
            <Code className="w-4 h-4 mr-2" />
            模板內容
          </TabsTrigger>
          <TabsTrigger value="versions" className="data-[state=active]:bg-violet-600">
            <History className="w-4 h-4 mr-2" />
            版本歷史
          </TabsTrigger>
          <TabsTrigger value="test" className="data-[state=active]:bg-violet-600">
            <Play className="w-4 h-4 mr-2" />
            測試
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">
                    當前版本 v{selectedVersion?.version_number || 1}
                    {selectedVersion?.version_tag && (
                      <Badge className="ml-2 bg-violet-500/20 text-violet-400">
                        {selectedVersion.version_tag}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {selectedVersion?.changelog || "無變更說明"}
                  </CardDescription>
                </div>
                {!editMode ? (
                  <Button onClick={() => setEditMode(true)} variant="outline" className="border-slate-600">
                    <Sparkles className="w-4 h-4 mr-2" />
                    建立新版本
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button onClick={() => setEditMode(false)} variant="ghost" className="text-slate-400">
                      取消
                    </Button>
                    <Button onClick={handleCreateVersion} disabled={saving} className="bg-violet-600 hover:bg-violet-500">
                      {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      儲存新版本
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* System Prompt */}
              {prompt.generation_type === "copywriting" && (
                <div className="space-y-2">
                  <Label className="text-slate-300">系統提示詞</Label>
                  <Textarea
                    value={editMode ? editedSystem : selectedVersion?.system_prompt || ""}
                    onChange={(e) => setEditedSystem(e.target.value)}
                    readOnly={!editMode}
                    className={cn(
                      "bg-slate-800 border-slate-600 text-white min-h-[80px] font-mono text-sm",
                      !editMode && "opacity-70"
                    )}
                  />
                </div>
              )}

              {/* Positive Template */}
              <div className="space-y-2">
                <Label className="text-slate-300">正向提示詞模板</Label>
                <Textarea
                  value={editMode ? editedTemplate : selectedVersion?.positive_template || ""}
                  onChange={(e) => setEditedTemplate(e.target.value)}
                  readOnly={!editMode}
                  className={cn(
                    "bg-slate-800 border-slate-600 text-white min-h-[200px] font-mono text-sm",
                    !editMode && "opacity-70"
                  )}
                />
              </div>

              {/* Negative Template */}
              {(prompt.generation_type === "image" || prompt.generation_type === "video") && (
                <div className="space-y-2">
                  <Label className="text-slate-300">負向提示詞模板</Label>
                  <Textarea
                    value={editMode ? editedNegative : selectedVersion?.negative_template || ""}
                    onChange={(e) => setEditedNegative(e.target.value)}
                    readOnly={!editMode}
                    className={cn(
                      "bg-slate-800 border-slate-600 text-white min-h-[80px] font-mono text-sm",
                      !editMode && "opacity-70"
                    )}
                  />
                </div>
              )}

              {/* Changelog (only in edit mode) */}
              {editMode && (
                <div className="space-y-2">
                  <Label className="text-slate-300">版本變更說明</Label>
                  <Input
                    value={changelog}
                    onChange={(e) => setChangelog(e.target.value)}
                    placeholder="描述此次變更的內容..."
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
              )}

              {/* Variables */}
              <div className="space-y-2">
                <Label className="text-slate-300">變數定義</Label>
                <div className="flex flex-wrap gap-2">
                  {(editMode ? editedVariables : selectedVersion?.variables || []).map((v, i) => (
                    <Badge key={i} variant="outline" className="border-slate-600 text-slate-300">
                      {`{{${v.name}}}`} - {v.label}
                      {v.required && <span className="text-red-400 ml-1">*</span>}
                    </Badge>
                  ))}
                  {(selectedVersion?.variables?.length || 0) === 0 && (
                    <span className="text-slate-500 text-sm">尚未定義變數</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Versions Tab */}
        <TabsContent value="versions" className="space-y-4">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">版本歷史</CardTitle>
              <CardDescription className="text-slate-400">查看和管理所有版本</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className={cn(
                      "p-4 rounded-lg border transition-colors cursor-pointer",
                      version.id === prompt.current_version_id
                        ? "bg-violet-500/10 border-violet-500/50"
                        : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                    )}
                    onClick={() => handleSelectVersion(version)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <GitBranch className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="font-medium text-white">
                            v{version.version_number}
                            {version.version_tag && (
                              <span className="text-slate-400 ml-2">({version.version_tag})</span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500">
                            {format(new Date(version.created_at), "yyyy/MM/dd HH:mm", { locale: zhTW })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {version.id === prompt.current_version_id ? (
                          <Badge className="bg-green-500/20 text-green-400">當前版本</Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRollback(version.id);
                            }}
                            className="text-slate-400 hover:text-white"
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            回滾
                          </Button>
                        )}
                        {version.avg_rating > 0 && (
                          <div className="flex items-center gap-1 text-amber-400">
                            <Star className="w-3 h-3 fill-current" />
                            <span className="text-xs">{version.avg_rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {version.changelog && (
                      <p className="text-sm text-slate-400 mt-2">{version.changelog}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test Tab */}
        <TabsContent value="test" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Input Variables */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">測試變數</CardTitle>
                <CardDescription className="text-slate-400">輸入變數值測試 Prompt 渲染結果</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedVersion?.variables?.map((v) => (
                  <div key={v.name} className="space-y-1">
                    <Label className="text-slate-300">
                      {v.label}
                      {v.required && <span className="text-red-400 ml-1">*</span>}
                    </Label>
                    {v.type === "textarea" ? (
                      <Textarea
                        value={testVariables[v.name] || ""}
                        onChange={(e) => setTestVariables({ ...testVariables, [v.name]: e.target.value })}
                        placeholder={v.placeholder}
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    ) : v.type === "select" ? (
                      <Select
                        value={testVariables[v.name] || ""}
                        onValueChange={(val) => setTestVariables({ ...testVariables, [v.name]: val })}
                      >
                        <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                          <SelectValue placeholder="選擇..." />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-600">
                          {v.options?.map((opt) => (
                            <SelectItem key={opt} value={opt} className="text-white">{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={v.type === "number" ? "number" : "text"}
                        value={testVariables[v.name] || ""}
                        onChange={(e) => setTestVariables({ ...testVariables, [v.name]: e.target.value })}
                        placeholder={v.placeholder}
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    )}
                  </div>
                ))}
                
                {(!selectedVersion?.variables || selectedVersion.variables.length === 0) && (
                  <div className="text-center py-8 text-slate-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>此 Prompt 沒有定義變數</p>
                  </div>
                )}

                <Button
                  onClick={handleTest}
                  disabled={testing}
                  className="w-full bg-violet-600 hover:bg-violet-500"
                >
                  {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                  測試渲染
                </Button>
              </CardContent>
            </Card>

            {/* Result */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">渲染結果</CardTitle>
                <CardDescription className="text-slate-400">變數替換後的最終 Prompt</CardDescription>
              </CardHeader>
              <CardContent>
                {testResult ? (
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
                      {testResult}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>點擊「測試渲染」查看結果</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
