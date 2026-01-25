"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles, ArrowLeft, Save, Plus, Trash2, Code, Eye, 
  FileText, Image, Video, Mic, Loader2, AlertCircle, Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ============================================================
// Types & Constants
// ============================================================

interface VariableDefinition {
  name: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  default?: string;
  options?: string[];
}

const CATEGORIES = [
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
  { id: "copywriting", name: "文案生成", icon: FileText },
  { id: "image", name: "圖片生成", icon: Image },
  { id: "video", name: "影片生成", icon: Video },
  { id: "tts", name: "語音合成", icon: Mic },
];

const MODELS = {
  copywriting: ["gpt-4o", "gpt-4o-mini", "gemini-2.0-flash", "gemini-1.5-pro"],
  image: ["flux-schnell", "flux-dev", "dall-e-3", "imagen-3"],
  video: ["veo-2", "runway-gen3", "minimax"],
  tts: ["edge-tts", "elevenlabs", "azure-tts"],
};

// ============================================================
// Main Component
// ============================================================

export default function NewPromptPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"basic" | "template" | "variables" | "config">("basic");

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [generationType, setGenerationType] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [supportedModels, setSupportedModels] = useState<string[]>([]);
  const [defaultModel, setDefaultModel] = useState("");

  // Template state
  const [positiveTemplate, setPositiveTemplate] = useState("");
  const [negativeTemplate, setNegativeTemplate] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");

  // Variables state
  const [variables, setVariables] = useState<VariableDefinition[]>([]);

  // Model config state
  const [modelConfig, setModelConfig] = useState({
    temperature: 0.7,
    max_tokens: 2000,
    top_p: 0.9,
  });

  // Handlers
  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleAddVariable = () => {
    setVariables([...variables, {
      name: "",
      label: "",
      type: "text",
      required: false,
      placeholder: "",
      default: "",
    }]);
  };

  const handleUpdateVariable = (index: number, field: string, value: any) => {
    const updated = [...variables];
    updated[index] = { ...updated[index], [field]: value };
    setVariables(updated);
  };

  const handleRemoveVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      toast.error("請輸入 Prompt 名稱");
      return;
    }
    if (!category) {
      toast.error("請選擇分類");
      return;
    }
    if (!generationType) {
      toast.error("請選擇生成類型");
      return;
    }
    if (!positiveTemplate.trim()) {
      toast.error("請輸入正向提示詞模板");
      return;
    }

    setSaving(true);
    try {
      await api.post("/prompts", {
        name: name.trim(),
        description: description.trim() || null,
        category,
        generation_type: generationType,
        positive_template: positiveTemplate,
        negative_template: negativeTemplate || null,
        system_prompt: systemPrompt || null,
        model_config: modelConfig,
        variables: variables.filter(v => v.name && v.label),
        supported_models: supportedModels,
        default_model: defaultModel || null,
        tags,
        is_system: false,
      });

      toast.success("Prompt 已建立");
      router.push("/dashboard/admin/prompts");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "建立失敗");
    } finally {
      setSaving(false);
    }
  };

  // Extract variables from template
  const extractVariables = () => {
    const regex = /\{\{([^}]+)\}\}/g;
    const matches = positiveTemplate.matchAll(regex);
    const varNames = new Set<string>();
    
    for (const match of matches) {
      varNames.add(match[1].trim());
    }

    // Add new variables that don't exist yet
    const existingNames = variables.map(v => v.name);
    const newVars = Array.from(varNames)
      .filter(name => !existingNames.includes(name))
      .map(name => ({
        name,
        label: name,
        type: "text",
        required: true,
        placeholder: `請輸入${name}`,
        default: "",
      }));

    if (newVars.length > 0) {
      setVariables([...variables, ...newVars]);
      toast.success(`已提取 ${newVars.length} 個變數`);
    } else {
      toast.info("沒有發現新的變數");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => router.back()}
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
            新增 Prompt
          </h1>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500"
        >
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          儲存
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {[
          { id: "basic", label: "基本資訊", icon: Info },
          { id: "template", label: "提示詞模板", icon: Code },
          { id: "variables", label: "變數定義", icon: FileText },
          { id: "config", label: "模型配置", icon: Sparkles },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors",
              activeTab === tab.id
                ? "bg-violet-500/20 text-violet-400"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "basic" && (
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">基本資訊</CardTitle>
            <CardDescription className="text-slate-400">設定 Prompt 的名稱、分類和標籤</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <Label className="text-slate-300">名稱 *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：Instagram 貼文文案生成器"
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-slate-300">說明</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="描述這個 Prompt 的用途和特點..."
                className="bg-slate-800 border-slate-600 text-white min-h-[80px]"
              />
            </div>

            {/* Category & Type */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">分類 *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue placeholder="選擇分類" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.id} value={cat.id} className="text-white">
                        {cat.icon} {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">生成類型 *</Label>
                <Select value={generationType} onValueChange={(v) => {
                  setGenerationType(v);
                  setSupportedModels([]);
                  setDefaultModel("");
                }}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue placeholder="選擇類型" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {GENERATION_TYPES.map(type => (
                      <SelectItem key={type.id} value={type.id} className="text-white">
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Models */}
            {generationType && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">支援的模型</Label>
                  <div className="flex flex-wrap gap-2">
                    {MODELS[generationType as keyof typeof MODELS]?.map(model => (
                      <Badge
                        key={model}
                        variant="outline"
                        className={cn(
                          "cursor-pointer transition-colors",
                          supportedModels.includes(model)
                            ? "bg-violet-500/20 border-violet-500 text-violet-400"
                            : "border-slate-600 text-slate-400 hover:border-slate-500"
                        )}
                        onClick={() => {
                          if (supportedModels.includes(model)) {
                            setSupportedModels(supportedModels.filter(m => m !== model));
                            if (defaultModel === model) setDefaultModel("");
                          } else {
                            setSupportedModels([...supportedModels, model]);
                          }
                        }}
                      >
                        {model}
                      </Badge>
                    ))}
                  </div>
                </div>

                {supportedModels.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-slate-300">預設模型</Label>
                    <Select value={defaultModel} onValueChange={setDefaultModel}>
                      <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                        <SelectValue placeholder="選擇預設模型" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        {supportedModels.map(model => (
                          <SelectItem key={model} value={model} className="text-white">
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {/* Tags */}
            <div className="space-y-2">
              <Label className="text-slate-300">標籤</Label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="輸入標籤後按 Enter"
                  className="bg-slate-800 border-slate-600 text-white"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                />
                <Button type="button" variant="outline" onClick={handleAddTag} className="border-slate-600">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="bg-slate-700 text-slate-300">
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)} className="ml-1 hover:text-red-400">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "template" && (
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">提示詞模板</CardTitle>
            <CardDescription className="text-slate-400">
              使用 {"{{variable}}"} 格式定義變數，例如：{"{{topic}}"}, {"{{platform}}"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* System Prompt */}
            {generationType === "copywriting" && (
              <div className="space-y-2">
                <Label className="text-slate-300">系統提示詞 (System Prompt)</Label>
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="定義 AI 的角色和行為規範..."
                  className="bg-slate-800 border-slate-600 text-white min-h-[100px] font-mono text-sm"
                />
              </div>
            )}

            {/* Positive Template */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-slate-300">正向提示詞模板 *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={extractVariables}
                  className="border-slate-600 text-xs"
                >
                  <Code className="w-3 h-3 mr-1" />
                  提取變數
                </Button>
              </div>
              <Textarea
                value={positiveTemplate}
                onChange={(e) => setPositiveTemplate(e.target.value)}
                placeholder={`例如：
你是一位專業的社群媒體行銷專家。
請為 {{brand_name}} 撰寫一篇關於 {{topic}} 的 {{platform}} 貼文。

目標受眾：{{target_audience}}
語調風格：{{tone}}
字數限制：{{word_limit}} 字以內`}
                className="bg-slate-800 border-slate-600 text-white min-h-[250px] font-mono text-sm"
              />
            </div>

            {/* Negative Template */}
            {(generationType === "image" || generationType === "video") && (
              <div className="space-y-2">
                <Label className="text-slate-300">負向提示詞模板 (Negative Prompt)</Label>
                <Textarea
                  value={negativeTemplate}
                  onChange={(e) => setNegativeTemplate(e.target.value)}
                  placeholder="blurry, low quality, distorted, watermark, text, logo, ugly, deformed"
                  className="bg-slate-800 border-slate-600 text-white min-h-[100px] font-mono text-sm"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "variables" && (
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">變數定義</CardTitle>
                <CardDescription className="text-slate-400">定義模板中使用的變數及其屬性</CardDescription>
              </div>
              <Button onClick={handleAddVariable} variant="outline" size="sm" className="border-slate-600">
                <Plus className="w-4 h-4 mr-1" />
                新增變數
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {variables.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>尚未定義任何變數</p>
                <p className="text-sm">點擊「提取變數」自動從模板中提取，或手動新增</p>
              </div>
            ) : (
              <div className="space-y-4">
                {variables.map((variable, index) => (
                  <div key={index} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="grid md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400">變數名稱</Label>
                        <Input
                          value={variable.name}
                          onChange={(e) => handleUpdateVariable(index, "name", e.target.value)}
                          placeholder="topic"
                          className="bg-slate-700 border-slate-600 text-white text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400">顯示標籤</Label>
                        <Input
                          value={variable.label}
                          onChange={(e) => handleUpdateVariable(index, "label", e.target.value)}
                          placeholder="主題"
                          className="bg-slate-700 border-slate-600 text-white text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400">類型</Label>
                        <Select
                          value={variable.type}
                          onValueChange={(v) => handleUpdateVariable(index, "type", v)}
                        >
                          <SelectTrigger className="bg-slate-700 border-slate-600 text-white text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-600">
                            <SelectItem value="text" className="text-white">文字</SelectItem>
                            <SelectItem value="textarea" className="text-white">多行文字</SelectItem>
                            <SelectItem value="select" className="text-white">下拉選單</SelectItem>
                            <SelectItem value="number" className="text-white">數字</SelectItem>
                            <SelectItem value="boolean" className="text-white">是/否</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end gap-2">
                        <label className="flex items-center gap-2 text-sm text-slate-400">
                          <input
                            type="checkbox"
                            checked={variable.required}
                            onChange={(e) => handleUpdateVariable(index, "required", e.target.checked)}
                            className="rounded border-slate-600"
                          />
                          必填
                        </label>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveVariable(index)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 ml-auto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {variable.type === "select" && (
                      <div className="mt-3 space-y-1">
                        <Label className="text-xs text-slate-400">選項（逗號分隔）</Label>
                        <Input
                          value={variable.options?.join(", ") || ""}
                          onChange={(e) => handleUpdateVariable(index, "options", e.target.value.split(",").map(s => s.trim()))}
                          placeholder="選項1, 選項2, 選項3"
                          className="bg-slate-700 border-slate-600 text-white text-sm"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "config" && (
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">模型配置</CardTitle>
            <CardDescription className="text-slate-400">設定模型的預設參數</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              {generationType === "copywriting" && (
                <>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Temperature</Label>
                    <Input
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                      value={modelConfig.temperature}
                      onChange={(e) => setModelConfig({ ...modelConfig, temperature: parseFloat(e.target.value) })}
                      className="bg-slate-800 border-slate-600 text-white"
                    />
                    <p className="text-xs text-slate-500">控制輸出的隨機性 (0-2)</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Max Tokens</Label>
                    <Input
                      type="number"
                      min={1}
                      value={modelConfig.max_tokens}
                      onChange={(e) => setModelConfig({ ...modelConfig, max_tokens: parseInt(e.target.value) })}
                      className="bg-slate-800 border-slate-600 text-white"
                    />
                    <p className="text-xs text-slate-500">最大輸出 Token 數</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Top P</Label>
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.1}
                      value={modelConfig.top_p}
                      onChange={(e) => setModelConfig({ ...modelConfig, top_p: parseFloat(e.target.value) })}
                      className="bg-slate-800 border-slate-600 text-white"
                    />
                    <p className="text-xs text-slate-500">核心採樣參數 (0-1)</p>
                  </div>
                </>
              )}
              
              {generationType === "image" && (
                <div className="col-span-3 text-center py-8 text-slate-500">
                  <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>圖片生成配置（尺寸、步數等）將在未來版本支援</p>
                </div>
              )}
              
              {generationType === "video" && (
                <div className="col-span-3 text-center py-8 text-slate-500">
                  <Video className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>影片生成配置（時長、FPS 等）將在未來版本支援</p>
                </div>
              )}
              
              {!generationType && (
                <div className="col-span-3 text-center py-8 text-slate-500">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>請先選擇生成類型</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
