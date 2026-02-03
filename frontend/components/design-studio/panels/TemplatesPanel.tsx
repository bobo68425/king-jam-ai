"use client";

/**
 * Templates Panel - 模板庫面板
 * 提供預設範本和快速套用功能
 */

import React, { useState } from "react";
import { fabric } from "fabric";
import { 
  LayoutTemplate, 
  Sparkles, 
  Search,
  Instagram,
  Facebook,
  Youtube,
  Linkedin,
  FileText,
  ShoppingBag,
  Megaphone,
  PartyPopper,
  Briefcase,
  GraduationCap,
  Heart,
  Coffee,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDesignStudioStore } from "@/stores/design-studio-store";
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";

// 模板分類
const TEMPLATE_CATEGORIES = [
  { id: "all", label: "全部", icon: LayoutTemplate },
  { id: "social", label: "社群", icon: Instagram },
  { id: "marketing", label: "行銷", icon: Megaphone },
  { id: "business", label: "商業", icon: Briefcase },
  { id: "lifestyle", label: "生活", icon: Coffee },
];

// 預設模板數據
const TEMPLATES = [
  {
    id: "ig-promo-1",
    name: "促銷公告",
    category: "social",
    platform: "instagram",
    preview: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    canvasSize: { width: 1080, height: 1080 },
    elements: [
      { type: "rect", props: { fill: "#667eea", width: 1080, height: 1080 } },
      { type: "text", props: { text: "限時優惠", fontSize: 120, fill: "#FFFFFF", fontWeight: "bold", top: 350 } },
      { type: "text", props: { text: "全館 5 折起", fontSize: 80, fill: "#FFD700", top: 500 } },
      { type: "text", props: { text: "立即搶購 →", fontSize: 48, fill: "#FFFFFF", top: 650, opacity: 0.9 } },
    ],
  },
  {
    id: "ig-quote-1",
    name: "名言金句",
    category: "social",
    platform: "instagram",
    preview: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
    canvasSize: { width: 1080, height: 1080 },
    elements: [
      { type: "rect", props: { fill: "#1a1a2e", width: 1080, height: 1080 } },
      { type: "text", props: { text: "「", fontSize: 200, fill: "#FFD700", top: 200, left: 100, opacity: 0.5 } },
      { type: "text", props: { text: "成功不是終點\n失敗不是終結", fontSize: 72, fill: "#FFFFFF", top: 400, textAlign: "center" } },
      { type: "text", props: { text: "— 溫斯頓·邱吉爾", fontSize: 36, fill: "#888888", top: 700 } },
    ],
  },
  {
    id: "ig-minimalist",
    name: "極簡風格",
    category: "social",
    platform: "instagram",
    preview: "linear-gradient(180deg, #FFFFFF 0%, #F5F5F5 100%)",
    canvasSize: { width: 1080, height: 1080 },
    elements: [
      { type: "rect", props: { fill: "#FFFFFF", width: 1080, height: 1080 } },
      { type: "text", props: { text: "Less is More", fontSize: 96, fill: "#1a1a1a", fontStyle: "italic", top: 450 } },
      { type: "line", props: { stroke: "#1a1a1a", strokeWidth: 3, x1: 340, y1: 600, x2: 740, y2: 600 } },
    ],
  },
  {
    id: "fb-event",
    name: "活動宣傳",
    category: "marketing",
    platform: "facebook",
    preview: "linear-gradient(135deg, #FF6B6B 0%, #FFE66D 100%)",
    canvasSize: { width: 1200, height: 630 },
    elements: [
      { type: "rect", props: { fill: "#FF6B6B", width: 1200, height: 630 } },
      { type: "text", props: { text: "🎉 盛大開幕", fontSize: 80, fill: "#FFFFFF", fontWeight: "bold", top: 180 } },
      { type: "text", props: { text: "2024.01.15 - 2024.02.15", fontSize: 48, fill: "#FFFFFF", top: 320, opacity: 0.9 } },
      { type: "text", props: { text: "參加即抽萬元好禮", fontSize: 36, fill: "#FFE66D", top: 420 } },
    ],
  },
  {
    id: "yt-thumbnail",
    name: "影片封面",
    category: "social",
    platform: "youtube",
    preview: "linear-gradient(135deg, #141E30 0%, #243B55 100%)",
    canvasSize: { width: 1280, height: 720 },
    elements: [
      { type: "rect", props: { fill: "#141E30", width: 1280, height: 720 } },
      { type: "text", props: { text: "10 個必學技巧", fontSize: 96, fill: "#FFFFFF", fontWeight: "bold", top: 250, stroke: "#FF0000", strokeWidth: 4 } },
      { type: "text", props: { text: "讓你效率提升 300%", fontSize: 48, fill: "#FFD700", top: 400 } },
    ],
  },
  {
    id: "linkedin-pro",
    name: "專業形象",
    category: "business",
    platform: "linkedin",
    preview: "linear-gradient(135deg, #0077B5 0%, #00A0DC 100%)",
    canvasSize: { width: 1200, height: 627 },
    elements: [
      { type: "rect", props: { fill: "#0077B5", width: 1200, height: 627 } },
      { type: "text", props: { text: "職場進化論", fontSize: 72, fill: "#FFFFFF", fontWeight: "bold", top: 200 } },
      { type: "text", props: { text: "提升你的專業價值", fontSize: 48, fill: "#FFFFFF", top: 320, opacity: 0.9 } },
    ],
  },
  {
    id: "sale-banner",
    name: "促銷橫幅",
    category: "marketing",
    platform: "general",
    preview: "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)",
    canvasSize: { width: 1920, height: 600 },
    elements: [
      { type: "rect", props: { fill: "#e74c3c", width: 1920, height: 600 } },
      { type: "text", props: { text: "BLACK FRIDAY", fontSize: 120, fill: "#FFFFFF", fontWeight: "bold", top: 150 } },
      { type: "text", props: { text: "UP TO 70% OFF", fontSize: 80, fill: "#FFD700", top: 320 } },
      { type: "text", props: { text: "LIMITED TIME ONLY", fontSize: 36, fill: "#FFFFFF", top: 450, opacity: 0.8 } },
    ],
  },
  {
    id: "blog-cover",
    name: "部落格封面",
    category: "business",
    platform: "blog",
    preview: "linear-gradient(135deg, #2c3e50 0%, #4ca1af 100%)",
    canvasSize: { width: 1200, height: 628 },
    elements: [
      { type: "rect", props: { fill: "#2c3e50", width: 1200, height: 628 } },
      { type: "text", props: { text: "2024 趨勢報告", fontSize: 72, fill: "#FFFFFF", fontWeight: "bold", top: 220 } },
      { type: "text", props: { text: "深度解析產業動態", fontSize: 42, fill: "#4ca1af", top: 340 } },
      { type: "text", props: { text: "KING JAM AI", fontSize: 24, fill: "#FFFFFF", top: 500, opacity: 0.6 } },
    ],
  },
];

// 文字風格預設
const TEXT_STYLE_PRESETS = [
  {
    id: "neon",
    name: "霓虹燈",
    preview: "linear-gradient(135deg, #FF00FF 0%, #00FFFF 100%)",
    style: {
      fill: "#FFFFFF",
      shadow: { color: "#FF00FF", blur: 20, offsetX: 0, offsetY: 0 },
      stroke: "#FF00FF",
      strokeWidth: 2,
    },
  },
  {
    id: "gold",
    name: "奢華金",
    preview: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
    style: {
      fill: "linear-gradient(180deg, #FFD700, #FF8C00)",
      shadow: { color: "rgba(0,0,0,0.5)", blur: 10, offsetX: 3, offsetY: 3 },
    },
  },
  {
    id: "outline",
    name: "描邊風",
    preview: "linear-gradient(135deg, #1a1a1a 0%, #333333 100%)",
    style: {
      fill: "transparent",
      stroke: "#FFFFFF",
      strokeWidth: 3,
    },
  },
  {
    id: "retro",
    name: "復古風",
    preview: "linear-gradient(135deg, #F4A460 0%, #DEB887 100%)",
    style: {
      fill: "#8B4513",
      shadow: { color: "#DEB887", blur: 0, offsetX: 4, offsetY: 4 },
    },
  },
  {
    id: "gradient-purple",
    name: "夢幻紫",
    preview: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    style: {
      fill: "linear-gradient(135deg, #667eea, #764ba2)",
    },
  },
  {
    id: "3d-effect",
    name: "3D 立體",
    preview: "linear-gradient(135deg, #2C3E50 0%, #4CA1AF 100%)",
    style: {
      fill: "#FFFFFF",
      shadow: { color: "#000000", blur: 0, offsetX: 5, offsetY: 5 },
      stroke: "#2C3E50",
      strokeWidth: 2,
    },
  },
];

interface TemplatesPanelProps {
  onClose?: () => void;
}

export default function TemplatesPanel({ onClose }: TemplatesPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  
  const {
    canvas,
    setCanvasSize,
    setCanvasBackground,
    addLayer,
  } = useDesignStudioStore();

  // 過濾模板
  const filteredTemplates = TEMPLATES.filter((template) => {
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory;
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // 套用模板 - 將模板物件添加到現有畫布（不重置）
  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    if (!canvas) return;

    // 取得當前畫布尺寸用於計算縮放比例
    const currentWidth = canvas.getWidth() || 1080;
    const currentHeight = canvas.getHeight() || 1080;
    const templateWidth = template.canvasSize.width;
    const templateHeight = template.canvasSize.height;
    
    // 計算縮放比例（讓模板元素適應當前畫布）
    const scaleX = currentWidth / templateWidth;
    const scaleY = currentHeight / templateHeight;
    const scale = Math.min(scaleX, scaleY, 1); // 不放大，只縮小

    // 計算偏移量（讓模板元素置中）
    const offsetX = (currentWidth - templateWidth * scale) / 2;
    const offsetY = (currentHeight - templateHeight * scale) / 2;

    // 添加模板元素（跳過第一個背景元素）
    template.elements.forEach((element, index) => {
      // 跳過背景矩形（index === 0 且是 rect）
      if (index === 0 && element.type === "rect") {
        return;
      }

      const id = uuidv4().slice(0, 8);
      let fabricObj: fabric.Object | null = null;

      if (element.type === "rect") {
        const originalLeft = element.props.left || 0;
        const originalTop = element.props.top || 0;
        const originalWidth = element.props.width || 100;
        const originalHeight = element.props.height || 100;

        fabricObj = new fabric.Rect({
          left: originalLeft * scale + offsetX,
          top: originalTop * scale + offsetY,
          width: originalWidth * scale,
          height: originalHeight * scale,
          fill: element.props.fill || "#FFFFFF",
          selectable: true,
          evented: true,
        });
      } else if (element.type === "text") {
        const originalLeft = element.props.left || templateWidth / 2;
        const originalTop = element.props.top || templateHeight / 2;
        const originalFontSize = element.props.fontSize || 48;

        fabricObj = new fabric.IText(element.props.text || "文字", {
          left: originalLeft * scale + offsetX,
          top: originalTop * scale + offsetY,
          originX: element.props.left ? "left" : "center",
          originY: "center",
          fontSize: originalFontSize * scale,
          fill: element.props.fill || "#FFFFFF",
          fontWeight: element.props.fontWeight || "normal",
          fontStyle: element.props.fontStyle || "normal",
          fontFamily: "Noto Sans TC",
          textAlign: element.props.textAlign || "center",
          opacity: element.props.opacity || 1,
          stroke: element.props.stroke,
          strokeWidth: (element.props.strokeWidth || 0) * scale,
        });
      } else if (element.type === "line") {
        const x1 = (element.props.x1 || 0) * scale + offsetX;
        const y1 = (element.props.y1 || 0) * scale + offsetY;
        const x2 = (element.props.x2 || 100) * scale + offsetX;
        const y2 = (element.props.y2 || 0) * scale + offsetY;

        fabricObj = new fabric.Line([x1, y1, x2, y2], {
          stroke: element.props.stroke || "#000000",
          strokeWidth: (element.props.strokeWidth || 1) * scale,
        });
      }

      if (fabricObj) {
        (fabricObj as any).id = id;
        (fabricObj as any).name = `${template.name} - ${element.type} ${index}`;
        canvas.add(fabricObj);

        addLayer({
          id,
          name: `${element.type === "text" ? "文字" : element.type === "rect" ? "矩形" : "直線"} (${template.name})`,
          type: element.type === "text" ? "text" : "shape",
          visible: true,
          locked: false,
          opacity: element.props.opacity || 1,
          blendMode: "source-over",
          fabricObject: fabricObj,
        });
      }
    });

    canvas.renderAll();
    onClose?.();
  };

  // 套用文字風格
  const applyTextStyle = (stylePreset: typeof TEXT_STYLE_PRESETS[0]) => {
    if (!canvas) return;
    
    const activeObject = canvas.getActiveObject();
    if (!activeObject || activeObject.type !== "i-text") {
      // 如果沒有選中文字，創建新文字
      const id = uuidv4().slice(0, 8);
      const text = new fabric.IText("範例文字", {
        left: canvas.getWidth() / 2,
        top: canvas.getHeight() / 2,
        originX: "center",
        originY: "center",
        fontSize: 72,
        fontFamily: "Noto Sans TC",
        fontWeight: "bold",
        ...stylePreset.style,
        shadow: stylePreset.style.shadow 
          ? new fabric.Shadow(stylePreset.style.shadow as any)
          : undefined,
      });
      
      (text as any).id = id;
      (text as any).name = `${stylePreset.name} 文字`;
      
      canvas.add(text);
      canvas.setActiveObject(text);
      
      addLayer({
        id,
        name: `${stylePreset.name} 文字`,
        type: "text",
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: "source-over",
        fabricObject: text,
      });
    } else {
      // 套用到選中的文字
      activeObject.set({
        ...stylePreset.style,
        shadow: stylePreset.style.shadow 
          ? new fabric.Shadow(stylePreset.style.shadow as any)
          : undefined,
      });
    }
    
    canvas.renderAll();
  };

  // 平台圖示
  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "instagram": return <Instagram className="w-3 h-3" />;
      case "facebook": return <Facebook className="w-3 h-3" />;
      case "youtube": return <Youtube className="w-3 h-3" />;
      case "linkedin": return <Linkedin className="w-3 h-3" />;
      default: return <FileText className="w-3 h-3" />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900/95 overflow-hidden">
      {/* 標題 */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700/50">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
          <LayoutTemplate className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
          模板庫
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">選擇模板快速開始設計</p>
      </div>

      {/* 搜尋 */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-700/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜尋模板..."
            className="pl-9 bg-slate-100 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200"
          />
        </div>
      </div>

      {/* 分頁 */}
      <Tabs defaultValue="templates" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-3 mt-2 grid grid-cols-2 bg-slate-100 dark:bg-slate-800/50 shrink-0">
          <TabsTrigger value="templates" className="text-xs data-[state=active]:bg-indigo-500 data-[state=active]:text-white">設計模板</TabsTrigger>
          <TabsTrigger value="text-styles" className="text-xs data-[state=active]:bg-indigo-500 data-[state=active]:text-white">文字風格</TabsTrigger>
        </TabsList>

        {/* 設計模板 */}
        <TabsContent value="templates" className="flex-1 flex flex-col mt-0 min-h-0 overflow-hidden">
          {/* 分類標籤 */}
          <div className="flex gap-1 p-3 overflow-x-auto shrink-0">
            {TEMPLATE_CATEGORIES.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  "text-xs whitespace-nowrap",
                  selectedCategory === cat.id 
                    ? "bg-indigo-500 text-white" 
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                )}
              >
                <cat.icon className="w-3 h-3 mr-1" />
                {cat.label}
              </Button>
            ))}
          </div>

          {/* 模板網格 */}
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            <div className="grid grid-cols-2 gap-3">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => applyTemplate(template)}
                  className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700/50 hover:border-indigo-500/50 transition-all hover:scale-[1.02]"
                >
                  {/* 預覽 */}
                  <div 
                    className="aspect-square"
                    style={{ background: template.preview }}
                  />
                  
                  {/* 資訊覆蓋層 */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                    <div className="text-left">
                      <div className="flex items-center gap-1 text-[10px] text-slate-300 mb-1">
                        {getPlatformIcon(template.platform)}
                        <span>{template.canvasSize.width} × {template.canvasSize.height}</span>
                      </div>
                      <p className="text-sm font-medium text-white">{template.name}</p>
                    </div>
                  </div>
                  
                  {/* 底部標籤 */}
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-slate-800/90 dark:bg-slate-900/90">
                    <p className="text-xs text-white dark:text-slate-300 truncate">{template.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* 文字風格 */}
        <TabsContent value="text-styles" className="flex-1 mt-0 min-h-0 overflow-hidden">
          <div className="h-full overflow-y-auto p-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              點擊套用風格到選中的文字，或創建新文字
            </p>
            <div className="grid grid-cols-2 gap-3">
              {TEXT_STYLE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyTextStyle(preset)}
                  className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700/50 hover:border-indigo-500/50 transition-all hover:scale-[1.02]"
                >
                  <div 
                    className="aspect-video flex items-center justify-center"
                    style={{ background: preset.preview }}
                  >
                    <span 
                      className="text-2xl font-bold"
                      style={{
                        color: preset.style.fill === "transparent" ? "transparent" : "#FFFFFF",
                        WebkitTextStroke: preset.style.stroke ? `${preset.style.strokeWidth || 2}px ${preset.style.stroke}` : undefined,
                        textShadow: preset.style.shadow 
                          ? `${preset.style.shadow.offsetX}px ${preset.style.shadow.offsetY}px ${preset.style.shadow.blur}px ${preset.style.shadow.color}`
                          : undefined,
                      }}
                    >
                      Aa
                    </span>
                  </div>
                  <div className="p-2 bg-slate-800/90 dark:bg-slate-900/90">
                    <p className="text-xs text-white dark:text-slate-300">{preset.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
