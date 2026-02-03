'use client';

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Monitor,
  Smartphone,
  Image as ImageIcon,
  FileText,
  Video,
  Instagram,
  Facebook,
  Twitter,
  Youtube,
  Linkedin,
  Clock,
  Star,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================
// 類型定義
// ============================================================

interface PresetTemplate {
  id: string;
  name: string;
  width: number;
  height: number;
  category: string;
  icon?: React.ReactNode;
  description?: string;
}

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateProject: (params: {
    name: string;
    width: number;
    height: number;
    backgroundColor: string;
    resolution: number;
  }) => void;
}

// ============================================================
// 預設模板資料
// ============================================================

const PRESET_CATEGORIES = [
  { id: 'recent', name: '最近使用', icon: <Clock className="w-4 h-4" /> },
  { id: 'favorites', name: '常用', icon: <Star className="w-4 h-4" /> },
  { id: 'social', name: '社群媒體', icon: <Instagram className="w-4 h-4" /> },
  { id: 'print', name: '列印', icon: <FileText className="w-4 h-4" /> },
  { id: 'web', name: '網頁', icon: <Monitor className="w-4 h-4" /> },
  { id: 'mobile', name: '行動裝置', icon: <Smartphone className="w-4 h-4" /> },
  { id: 'video', name: '影片', icon: <Video className="w-4 h-4" /> },
  { id: 'photo', name: '照片', icon: <ImageIcon className="w-4 h-4" /> },
];

const PRESET_TEMPLATES: PresetTemplate[] = [
  // 社群媒體
  { id: 'ig-post', name: 'Instagram 貼文', width: 1080, height: 1080, category: 'social', icon: <Instagram className="w-5 h-5" /> },
  { id: 'ig-story', name: 'Instagram 限時動態', width: 1080, height: 1920, category: 'social', icon: <Instagram className="w-5 h-5" /> },
  { id: 'ig-reel', name: 'Instagram Reels', width: 1080, height: 1920, category: 'social', icon: <Instagram className="w-5 h-5" /> },
  { id: 'fb-post', name: 'Facebook 貼文', width: 1200, height: 630, category: 'social', icon: <Facebook className="w-5 h-5" /> },
  { id: 'fb-cover', name: 'Facebook 封面', width: 820, height: 312, category: 'social', icon: <Facebook className="w-5 h-5" /> },
  { id: 'fb-story', name: 'Facebook 限時動態', width: 1080, height: 1920, category: 'social', icon: <Facebook className="w-5 h-5" /> },
  { id: 'twitter-post', name: 'X (Twitter) 貼文', width: 1200, height: 675, category: 'social', icon: <Twitter className="w-5 h-5" /> },
  { id: 'twitter-header', name: 'X (Twitter) 封面', width: 1500, height: 500, category: 'social', icon: <Twitter className="w-5 h-5" /> },
  { id: 'linkedin-post', name: 'LinkedIn 貼文', width: 1200, height: 627, category: 'social', icon: <Linkedin className="w-5 h-5" /> },
  { id: 'linkedin-cover', name: 'LinkedIn 封面', width: 1584, height: 396, category: 'social', icon: <Linkedin className="w-5 h-5" /> },
  { id: 'youtube-thumbnail', name: 'YouTube 縮圖', width: 1280, height: 720, category: 'social', icon: <Youtube className="w-5 h-5" /> },
  { id: 'youtube-banner', name: 'YouTube 頻道封面', width: 2560, height: 1440, category: 'social', icon: <Youtube className="w-5 h-5" /> },
  { id: 'pinterest', name: 'Pinterest Pin', width: 1000, height: 1500, category: 'social' },
  { id: 'tiktok', name: 'TikTok 影片', width: 1080, height: 1920, category: 'social' },
  
  // 列印
  { id: 'a4-portrait', name: 'A4 直向', width: 2480, height: 3508, category: 'print', description: '210 × 297 mm @ 300 ppi' },
  { id: 'a4-landscape', name: 'A4 橫向', width: 3508, height: 2480, category: 'print', description: '297 × 210 mm @ 300 ppi' },
  { id: 'a3-portrait', name: 'A3 直向', width: 3508, height: 4961, category: 'print', description: '297 × 420 mm @ 300 ppi' },
  { id: 'a5-portrait', name: 'A5 直向', width: 1748, height: 2480, category: 'print', description: '148 × 210 mm @ 300 ppi' },
  { id: 'letter', name: 'Letter', width: 2550, height: 3300, category: 'print', description: '8.5 × 11 in @ 300 ppi' },
  { id: 'business-card', name: '名片', width: 1050, height: 600, category: 'print', description: '90 × 50 mm @ 300 ppi' },
  { id: 'postcard', name: '明信片', width: 1800, height: 1200, category: 'print', description: '6 × 4 in @ 300 ppi' },
  { id: 'poster-18x24', name: '海報 (18×24)', width: 5400, height: 7200, category: 'print', description: '18 × 24 in @ 300 ppi' },
  { id: 'flyer', name: '傳單 (A5)', width: 1748, height: 2480, category: 'print', description: '148 × 210 mm @ 300 ppi' },
  
  // 網頁
  { id: 'web-1920', name: '網頁 1920×1080', width: 1920, height: 1080, category: 'web', description: 'Full HD' },
  { id: 'web-1440', name: '網頁 1440×900', width: 1440, height: 900, category: 'web' },
  { id: 'web-1366', name: '網頁 1366×768', width: 1366, height: 768, category: 'web', description: '常見筆電' },
  { id: 'blog-header', name: '部落格封面', width: 1200, height: 600, category: 'web' },
  { id: 'email-header', name: 'Email 橫幅', width: 600, height: 200, category: 'web' },
  { id: 'banner-728', name: '橫幅廣告 (728×90)', width: 728, height: 90, category: 'web', description: 'Leaderboard' },
  { id: 'banner-300', name: '側欄廣告 (300×250)', width: 300, height: 250, category: 'web', description: 'Medium Rectangle' },
  { id: 'favicon', name: 'Favicon', width: 512, height: 512, category: 'web' },
  { id: 'og-image', name: 'OG Image', width: 1200, height: 630, category: 'web', description: '社群預覽圖' },
  
  // 行動裝置
  { id: 'iphone-15', name: 'iPhone 15 Pro', width: 1179, height: 2556, category: 'mobile' },
  { id: 'iphone-se', name: 'iPhone SE', width: 750, height: 1334, category: 'mobile' },
  { id: 'android-fhd', name: 'Android FHD+', width: 1080, height: 2400, category: 'mobile' },
  { id: 'ipad-pro', name: 'iPad Pro 12.9"', width: 2048, height: 2732, category: 'mobile' },
  { id: 'ipad-mini', name: 'iPad Mini', width: 1536, height: 2048, category: 'mobile' },
  { id: 'app-icon', name: 'App 圖示', width: 1024, height: 1024, category: 'mobile' },
  { id: 'app-splash', name: 'App 啟動畫面', width: 1242, height: 2688, category: 'mobile' },
  
  // 影片
  { id: 'video-4k', name: '4K UHD', width: 3840, height: 2160, category: 'video', description: '3840 × 2160' },
  { id: 'video-1080p', name: 'Full HD 1080p', width: 1920, height: 1080, category: 'video' },
  { id: 'video-720p', name: 'HD 720p', width: 1280, height: 720, category: 'video' },
  { id: 'video-vertical', name: '直式影片', width: 1080, height: 1920, category: 'video', description: '9:16' },
  { id: 'video-square', name: '方形影片', width: 1080, height: 1080, category: 'video', description: '1:1' },
  { id: 'video-cinematic', name: '電影比例', width: 2560, height: 1080, category: 'video', description: '21:9' },
  
  // 照片
  { id: 'photo-4x6', name: '4×6 相片', width: 1800, height: 1200, category: 'photo', description: '4 × 6 in @ 300 ppi' },
  { id: 'photo-5x7', name: '5×7 相片', width: 2100, height: 1500, category: 'photo', description: '5 × 7 in @ 300 ppi' },
  { id: 'photo-8x10', name: '8×10 相片', width: 3000, height: 2400, category: 'photo', description: '8 × 10 in @ 300 ppi' },
  { id: 'photo-square', name: '方形相片', width: 2000, height: 2000, category: 'photo' },
  { id: 'photo-16x9', name: '16:9 寬螢幕', width: 1920, height: 1080, category: 'photo' },
  { id: 'photo-3x2', name: '3:2 相機比例', width: 3000, height: 2000, category: 'photo' },
  { id: 'photo-4x3', name: '4:3 傳統比例', width: 2000, height: 1500, category: 'photo' },
];

const UNIT_OPTIONS = [
  { value: 'px', label: '像素' },
  { value: 'mm', label: '公釐' },
  { value: 'cm', label: '公分' },
  { value: 'in', label: '英吋' },
];

const RESOLUTION_OPTIONS = [
  { value: 72, label: '72 (網頁)' },
  { value: 150, label: '150 (中等)' },
  { value: 300, label: '300 (列印)' },
  { value: 600, label: '600 (高品質)' },
];

const BACKGROUND_OPTIONS = [
  { value: '#FFFFFF', label: '白色', color: '#FFFFFF' },
  { value: '#000000', label: '黑色', color: '#000000' },
  { value: 'transparent', label: '透明', color: 'transparent' },
  { value: '#F5F5F5', label: '淺灰', color: '#F5F5F5' },
  { value: '#E5E5E5', label: '灰色', color: '#E5E5E5' },
];

// ============================================================
// 主組件
// ============================================================

export default function NewProjectDialog({
  open,
  onOpenChange,
  onCreateProject,
}: NewProjectDialogProps) {
  // 狀態
  const [selectedCategory, setSelectedCategory] = useState('social');
  const [selectedTemplate, setSelectedTemplate] = useState<PresetTemplate | null>(null);
  const [projectName, setProjectName] = useState('未命名專案');
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(1080);
  const [unit, setUnit] = useState('px');
  const [resolution, setResolution] = useState(72);
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [recentTemplates, setRecentTemplates] = useState<PresetTemplate[]>([]);
  const [favoriteTemplates, setFavoriteTemplates] = useState<PresetTemplate[]>([]);

  // 根據分類過濾模板
  const filteredTemplates = PRESET_TEMPLATES.filter(t => {
    if (selectedCategory === 'recent') return recentTemplates.some(r => r.id === t.id);
    if (selectedCategory === 'favorites') return favoriteTemplates.some(f => f.id === t.id);
    return t.category === selectedCategory;
  });

  // 選擇模板
  const handleSelectTemplate = useCallback((template: PresetTemplate) => {
    setSelectedTemplate(template);
    setWidth(template.width);
    setHeight(template.height);
    setProjectName(template.name);
    setOrientation(template.height > template.width ? 'portrait' : 'landscape');
  }, []);

  // 切換方向
  const handleToggleOrientation = useCallback(() => {
    const newOrientation = orientation === 'portrait' ? 'landscape' : 'portrait';
    setOrientation(newOrientation);
    // 交換寬高
    const temp = width;
    setWidth(height);
    setHeight(temp);
  }, [orientation, width, height]);

  // 建立專案
  const handleCreate = useCallback(() => {
    // 儲存到最近使用
    if (selectedTemplate) {
      const newRecent = [selectedTemplate, ...recentTemplates.filter(r => r.id !== selectedTemplate.id)].slice(0, 10);
      setRecentTemplates(newRecent);
      // 可以存到 localStorage
      try {
        localStorage.setItem('designStudio_recentTemplates', JSON.stringify(newRecent.map(t => t.id)));
      } catch (e) {
        console.error('儲存最近使用失敗:', e);
      }
    }

    onCreateProject({
      name: projectName,
      width,
      height,
      backgroundColor: backgroundColor === 'transparent' ? 'rgba(0,0,0,0)' : backgroundColor,
      resolution,
    });
    onOpenChange(false);
  }, [projectName, width, height, backgroundColor, resolution, selectedTemplate, recentTemplates, onCreateProject, onOpenChange]);

  // 重置
  const handleReset = useCallback(() => {
    setWidth(1080);
    setHeight(1080);
    setProjectName('未命名專案');
    setResolution(72);
    setBackgroundColor('#FFFFFF');
    setOrientation('portrait');
    setSelectedTemplate(null);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] p-0 bg-slate-900 border-slate-700 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <DialogTitle className="text-xl font-semibold text-white">新建專案</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* 左側：分類和模板 */}
          <div className="flex-1 flex flex-col border-r border-slate-700">
            {/* 分類標籤 */}
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="flex-shrink-0">
              <TabsList className="w-full justify-start px-4 py-2 bg-slate-800/50 rounded-none border-b border-slate-700 h-auto flex-wrap gap-1">
                {PRESET_CATEGORIES.map((cat) => (
                  <TabsTrigger
                    key={cat.id}
                    value={cat.id}
                    className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white px-3 py-1.5 text-sm"
                  >
                    <span className="mr-1.5">{cat.icon}</span>
                    {cat.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* 模板網格 */}
            <ScrollArea className="flex-1 min-h-0 p-4">
              {filteredTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <Clock className="w-12 h-12 mb-4 opacity-50" />
                  <p>{selectedCategory === 'recent' ? '尚無最近使用的模板' : '尚無常用模板'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className={cn(
                        'group relative flex flex-col items-center p-3 rounded-lg border-2 transition-all',
                        'hover:border-indigo-500 hover:bg-slate-800/50',
                        selectedTemplate?.id === template.id
                          ? 'border-indigo-500 bg-indigo-500/10'
                          : 'border-slate-700 bg-slate-800/30'
                      )}
                    >
                      {/* 預覽框 */}
                      <div 
                        className="relative w-full aspect-square flex items-center justify-center mb-2"
                      >
                        <div
                          className={cn(
                            'border-2 border-slate-500 bg-slate-700/50 flex items-center justify-center',
                            'group-hover:border-indigo-400'
                          )}
                          style={{
                            width: template.width > template.height 
                              ? '80%' 
                              : `${(template.width / template.height) * 80}%`,
                            height: template.height > template.width 
                              ? '80%' 
                              : `${(template.height / template.width) * 80}%`,
                            maxWidth: '80%',
                            maxHeight: '80%',
                          }}
                        >
                          {template.icon && (
                            <span className="text-slate-400 group-hover:text-indigo-400">
                              {template.icon}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* 模板資訊 */}
                      <div className="text-center w-full">
                        <p className="text-sm font-medium text-white truncate">
                          {template.name}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {template.width} × {template.height} px
                        </p>
                        {template.description && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {template.description}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* 右側：自訂設定 */}
          <div className="w-80 flex-shrink-0 p-6 bg-slate-800/30 overflow-y-auto">
            <div className="space-y-6">
              {/* 專案名稱 */}
              <div>
                <Label className="text-slate-300 text-sm">專案名稱</Label>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="mt-1.5 bg-slate-800 border-slate-600 text-white"
                  placeholder="未命名專案"
                />
              </div>

              {/* 尺寸 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300 text-sm">寬度</Label>
                  <div className="flex mt-1.5 gap-2">
                    <Input
                      type="number"
                      value={width}
                      onChange={(e) => setWidth(Number(e.target.value))}
                      className="bg-slate-800 border-slate-600 text-white"
                      min={1}
                      max={10000}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-slate-300 text-sm">高度</Label>
                  <div className="flex mt-1.5 gap-2">
                    <Input
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(Number(e.target.value))}
                      className="bg-slate-800 border-slate-600 text-white"
                      min={1}
                      max={10000}
                    />
                  </div>
                </div>
              </div>

              {/* 單位 */}
              <div>
                <Label className="text-slate-300 text-sm">單位</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger className="mt-1.5 bg-slate-800 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {UNIT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-white">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 方向 */}
              <div>
                <Label className="text-slate-300 text-sm">方向</Label>
                <div className="flex gap-2 mt-1.5">
                  <Button
                    variant={orientation === 'portrait' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      if (orientation !== 'portrait') handleToggleOrientation();
                    }}
                    className={cn(
                      'flex-1',
                      orientation === 'portrait' 
                        ? 'bg-indigo-600 hover:bg-indigo-700' 
                        : 'bg-slate-800 border-slate-600 hover:bg-slate-700'
                    )}
                  >
                    <div className="w-3 h-4 border-2 border-current mr-2" />
                    直向
                  </Button>
                  <Button
                    variant={orientation === 'landscape' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      if (orientation !== 'landscape') handleToggleOrientation();
                    }}
                    className={cn(
                      'flex-1',
                      orientation === 'landscape' 
                        ? 'bg-indigo-600 hover:bg-indigo-700' 
                        : 'bg-slate-800 border-slate-600 hover:bg-slate-700'
                    )}
                  >
                    <div className="w-4 h-3 border-2 border-current mr-2" />
                    橫向
                  </Button>
                </div>
              </div>

              {/* 解析度 */}
              <div>
                <Label className="text-slate-300 text-sm">解析度 (PPI)</Label>
                <Select value={resolution.toString()} onValueChange={(v) => setResolution(Number(v))}>
                  <SelectTrigger className="mt-1.5 bg-slate-800 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {RESOLUTION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value.toString()} className="text-white">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 背景顏色 */}
              <div>
                <Label className="text-slate-300 text-sm">背景內容</Label>
                <div className="flex gap-2 mt-1.5 flex-wrap">
                  {BACKGROUND_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setBackgroundColor(opt.value)}
                      className={cn(
                        'w-8 h-8 rounded border-2 transition-all',
                        backgroundColor === opt.value
                          ? 'border-indigo-500 ring-2 ring-indigo-500/50'
                          : 'border-slate-600 hover:border-slate-400'
                      )}
                      style={{
                        backgroundColor: opt.color === 'transparent' ? undefined : opt.color,
                        backgroundImage: opt.color === 'transparent' 
                          ? 'linear-gradient(45deg, #666 25%, transparent 25%), linear-gradient(-45deg, #666 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #666 75%), linear-gradient(-45deg, transparent 75%, #666 75%)'
                          : undefined,
                        backgroundSize: '8px 8px',
                        backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
                      }}
                      title={opt.label}
                    />
                  ))}
                  {/* 自訂顏色 */}
                  <input
                    type="color"
                    value={backgroundColor === 'transparent' ? '#FFFFFF' : backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-2 border-slate-600 hover:border-slate-400"
                    title="自訂顏色"
                  />
                </div>
              </div>

              {/* 預覽資訊 */}
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <p className="text-sm text-slate-300">
                  <span className="text-slate-500">尺寸：</span>
                  {width} × {height} px
                </p>
                <p className="text-sm text-slate-300 mt-1">
                  <span className="text-slate-500">解析度：</span>
                  {resolution} ppi
                </p>
                <p className="text-sm text-slate-300 mt-1">
                  <span className="text-slate-500">預估大小：</span>
                  {((width * height * 4) / 1024 / 1024).toFixed(1)} MB (未壓縮)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 底部按鈕 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700 bg-slate-800/50 flex-shrink-0">
          <Button
            variant="ghost"
            onClick={handleReset}
            className="text-slate-400 hover:text-white"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            重置
          </Button>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="bg-slate-800 border-slate-600 hover:bg-slate-700"
            >
              取消
            </Button>
            <Button
              onClick={handleCreate}
              className="bg-indigo-600 hover:bg-indigo-700 px-8"
            >
              建立
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
