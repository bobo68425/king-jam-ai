"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Bell, Send, Users, Mail, Megaphone, AlertTriangle,
  CheckCircle, Clock, TrendingUp, FileText, Loader2,
  Eye, Copy, Sparkles, Settings, Info, Wrench, Plus,
  Edit, Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";

// ============================================================
// Types
// ============================================================

interface NotificationStats {
  total: number;
  today: number;
  unread: number;
  by_type: Record<string, number>;
  trend: { date: string; count: number }[];
}

interface NotificationHistory {
  title: string;
  notification_type: string;
  sent_count: number;
  read_count: number;
  read_rate: number;
  sent_at: string | null;
}

interface NotificationTemplate {
  id: number;
  code: string;
  name: string;
  description: string | null;
  notification_type: string;
  title: string;
  message: string;
  action_url: string | null;
  action_text: string | null;
  variables: { name: string; description: string }[];
  category: string | null;
  is_active: boolean;
  is_system: boolean;
  created_at: string | null;
}

// ============================================================
// Constants
// ============================================================

const NOTIFICATION_TYPES = [
  { id: "system", label: "系統通知", icon: Settings, color: "text-blue-400" },
  { id: "marketing", label: "行銷通知", icon: Megaphone, color: "text-pink-400" },
  { id: "credit", label: "點數通知", icon: Sparkles, color: "text-amber-400" },
  { id: "security", label: "安全通知", icon: AlertTriangle, color: "text-red-400" },
];

const ANNOUNCEMENT_TYPES = [
  { id: "info", label: "一般公告", icon: Info, color: "text-blue-400" },
  { id: "feature", label: "新功能", icon: Sparkles, color: "text-purple-400" },
  { id: "maintenance", label: "系統維護", icon: Wrench, color: "text-orange-400" },
  { id: "warning", label: "重要警告", icon: AlertTriangle, color: "text-red-400" },
];

// ============================================================
// Main Component
// ============================================================

export default function AdminNotificationsPage() {
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [history, setHistory] = useState<NotificationHistory[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<"broadcast" | "announcement" | "templates">("broadcast");
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  
  // 模板表單
  const [templateForm, setTemplateForm] = useState({
    name: "",
    code: "",
    description: "",
    notification_type: "system",
    title: "",
    message: "",
    action_url: "",
    action_text: "",
    category: "",
  });

  const resetTemplateForm = () => {
    setTemplateForm({
      name: "",
      code: "",
      description: "",
      notification_type: "system",
      title: "",
      message: "",
      action_url: "",
      action_text: "",
      category: "",
    });
  };

  // 廣播表單
  const [broadcastForm, setBroadcastForm] = useState({
    notification_type: "system",
    title: "",
    message: "",
    action_url: "",
    target_tier: "",
    send_email: false,
  });

  // 公告表單
  const [announcementForm, setAnnouncementForm] = useState({
    announcement_type: "info",
    title: "",
    message: "",
    action_url: "",
    priority: "normal",
    send_email: false,
  });

  // 載入數據
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, historyRes, templatesRes] = await Promise.all([
          api.get("/admin/notifications/stats"),
          api.get("/admin/notifications/history?limit=20"),
          api.get("/admin/notifications/templates"),
        ]);
        setStats(statsRes.data.stats);
        setHistory(historyRes.data.notifications);
        setTemplates(templatesRes.data.templates);
      } catch (error) {
        console.error("Failed to fetch data:", error);
        toast.error("載入數據失敗");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 發送廣播
  const sendBroadcast = async () => {
    if (!broadcastForm.title || !broadcastForm.message) {
      toast.error("請填寫標題和內容");
      return;
    }
    
    setSending(true);
    try {
      const res = await api.post("/admin/notifications/broadcast", {
        notification_type: broadcastForm.notification_type,
        title: broadcastForm.title,
        message: broadcastForm.message,
        action_url: broadcastForm.action_url || null,
        target_tier: broadcastForm.target_tier || null,
        send_email: broadcastForm.send_email,
      });
      
      toast.success(`廣播成功！已發送給 ${res.data.sent_count} 位用戶`);
      
      // 清空表單
      setBroadcastForm({
        notification_type: "system",
        title: "",
        message: "",
        action_url: "",
        target_tier: "",
        send_email: false,
      });
      
      // 重新載入
      const [statsRes, historyRes] = await Promise.all([
        api.get("/admin/notifications/stats"),
        api.get("/admin/notifications/history?limit=20"),
      ]);
      setStats(statsRes.data.stats);
      setHistory(historyRes.data.notifications);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "發送失敗");
    } finally {
      setSending(false);
    }
  };

  // 發送公告
  const sendAnnouncement = async () => {
    if (!announcementForm.title || !announcementForm.message) {
      toast.error("請填寫標題和內容");
      return;
    }
    
    setSending(true);
    try {
      const res = await api.post("/admin/notifications/announcement", {
        announcement_type: announcementForm.announcement_type,
        title: announcementForm.title,
        message: announcementForm.message,
        action_url: announcementForm.action_url || null,
        priority: announcementForm.priority,
        send_email: announcementForm.send_email,
      });
      
      toast.success(`公告發送成功！已發送給 ${res.data.sent_count} 位用戶`);
      
      // 清空表單
      setAnnouncementForm({
        announcement_type: "info",
        title: "",
        message: "",
        action_url: "",
        priority: "normal",
        send_email: false,
      });
      
      // 重新載入
      const [statsRes, historyRes] = await Promise.all([
        api.get("/admin/notifications/stats"),
        api.get("/admin/notifications/history?limit=20"),
      ]);
      setStats(statsRes.data.stats);
      setHistory(historyRes.data.notifications);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "發送失敗");
    } finally {
      setSending(false);
    }
  };

  // 使用模板
  const useTemplate = (template: NotificationTemplate) => {
    setBroadcastForm({
      ...broadcastForm,
      notification_type: template.notification_type,
      title: template.title,
      message: template.message,
      action_url: template.action_url || "",
    });
    setActiveTab("broadcast");
    toast.success("已套用模板，請切換到廣播通知發送");
  };

  // 當編輯模板時填充表單
  useEffect(() => {
    if (editingTemplate) {
      setTemplateForm({
        name: editingTemplate.name,
        code: editingTemplate.code,
        description: editingTemplate.description || "",
        notification_type: editingTemplate.notification_type,
        title: editingTemplate.title,
        message: editingTemplate.message,
        action_url: editingTemplate.action_url || "",
        action_text: editingTemplate.action_text || "",
        category: editingTemplate.category || "",
      });
    }
  }, [editingTemplate]);

  // 儲存模板
  const saveTemplate = async () => {
    if (!templateForm.name || !templateForm.code || !templateForm.title || !templateForm.message) {
      toast.error("請填寫必要欄位");
      return;
    }

    setSending(true);
    try {
      if (editingTemplate) {
        // 更新
        await api.put(`/admin/notifications/templates/${editingTemplate.id}`, {
          name: templateForm.name,
          description: templateForm.description || null,
          notification_type: templateForm.notification_type,
          title: templateForm.title,
          message: templateForm.message,
          action_url: templateForm.action_url || null,
          action_text: templateForm.action_text || null,
          category: templateForm.category || null,
        });
        toast.success("模板已更新");
      } else {
        // 建立
        await api.post("/admin/notifications/templates", {
          name: templateForm.name,
          code: templateForm.code,
          description: templateForm.description || null,
          notification_type: templateForm.notification_type,
          title: templateForm.title,
          message: templateForm.message,
          action_url: templateForm.action_url || null,
          action_text: templateForm.action_text || null,
          category: templateForm.category || null,
        });
        toast.success("模板已建立");
      }

      // 重新載入模板
      const res = await api.get("/admin/notifications/templates");
      setTemplates(res.data.templates);
      
      // 關閉表單
      setShowTemplateForm(false);
      setEditingTemplate(null);
      resetTemplateForm();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "操作失敗");
    } finally {
      setSending(false);
    }
  };

  // 刪除模板
  const deleteTemplate = async (templateId: number) => {
    if (!confirm("確定要刪除此模板嗎？")) return;

    try {
      await api.delete(`/admin/notifications/templates/${templateId}`);
      toast.success("模板已刪除");
      setTemplates(templates.filter(t => t.id !== templateId));
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "刪除失敗");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Bell className="w-7 h-7 text-indigo-400" />
              通知中心管理
            </h1>
            <p className="text-slate-400 mt-1">
              發送系統公告、廣播通知、管理通知模板
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Bell className="w-8 h-8 text-indigo-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{stats?.total?.toLocaleString() || 0}</p>
                  <p className="text-xs text-slate-400">總通知數</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Send className="w-8 h-8 text-green-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{stats?.today || 0}</p>
                  <p className="text-xs text-slate-400">今日發送</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-amber-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{stats?.unread?.toLocaleString() || 0}</p>
                  <p className="text-xs text-slate-400">未讀總數</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-cyan-400" />
                <div>
                  <p className="text-2xl font-bold text-white">
                    {stats?.trend?.[6]?.count || 0}
                  </p>
                  <p className="text-xs text-slate-400">昨日發送</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs */}
            <div className="flex gap-2">
              <Button
                variant={activeTab === "broadcast" ? "default" : "outline"}
                onClick={() => setActiveTab("broadcast")}
                className={activeTab === "broadcast" ? "bg-indigo-600" : "bg-slate-800/50 border-slate-700"}
              >
                <Megaphone className="w-4 h-4 mr-2" />
                廣播通知
              </Button>
              <Button
                variant={activeTab === "announcement" ? "default" : "outline"}
                onClick={() => setActiveTab("announcement")}
                className={activeTab === "announcement" ? "bg-indigo-600" : "bg-slate-800/50 border-slate-700"}
              >
                <FileText className="w-4 h-4 mr-2" />
                系統公告
              </Button>
              <Button
                variant={activeTab === "templates" ? "default" : "outline"}
                onClick={() => setActiveTab("templates")}
                className={activeTab === "templates" ? "bg-indigo-600" : "bg-slate-800/50 border-slate-700"}
              >
                <Copy className="w-4 h-4 mr-2" />
                通知模板
              </Button>
            </div>

            {/* Broadcast Form */}
            {activeTab === "broadcast" && (
              <Card className="bg-slate-900/50 border-slate-700/50">
                <CardHeader>
                  <CardTitle className="text-white">廣播通知</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-slate-400">通知類型</label>
                      <select
                        value={broadcastForm.notification_type}
                        onChange={(e) => setBroadcastForm({ ...broadcastForm, notification_type: e.target.value })}
                        className="mt-1 w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white"
                      >
                        {NOTIFICATION_TYPES.map((type) => (
                          <option key={type.id} value={type.id}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">目標用戶</label>
                      <select
                        value={broadcastForm.target_tier}
                        onChange={(e) => setBroadcastForm({ ...broadcastForm, target_tier: e.target.value })}
                        className="mt-1 w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white"
                      >
                        <option value="">全部用戶</option>
                        <option value="free">免費用戶</option>
                        <option value="basic">入門版用戶</option>
                        <option value="pro">專業版用戶</option>
                        <option value="enterprise">企業版用戶</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-slate-400">標題</label>
                    <Input
                      value={broadcastForm.title}
                      onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                      placeholder="通知標題"
                      className="mt-1 bg-slate-800 border-slate-700"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-400">內容</label>
                    <Textarea
                      value={broadcastForm.message}
                      onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                      placeholder="通知內容..."
                      rows={4}
                      className="mt-1 bg-slate-800 border-slate-700"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-400">操作連結（選填）</label>
                    <Input
                      value={broadcastForm.action_url}
                      onChange={(e) => setBroadcastForm({ ...broadcastForm, action_url: e.target.value })}
                      placeholder="/dashboard/..."
                      className="mt-1 bg-slate-800 border-slate-700"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={broadcastForm.send_email}
                        onChange={(e) => setBroadcastForm({ ...broadcastForm, send_email: e.target.checked })}
                        className="rounded border-slate-600"
                      />
                      <Mail className="w-4 h-4" />
                      同時發送 Email
                    </label>

                    <Button
                      onClick={sendBroadcast}
                      disabled={sending}
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      {sending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      發送廣播
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Announcement Form */}
            {activeTab === "announcement" && (
              <Card className="bg-slate-900/50 border-slate-700/50">
                <CardHeader>
                  <CardTitle className="text-white">系統公告</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-slate-400">公告類型</label>
                      <select
                        value={announcementForm.announcement_type}
                        onChange={(e) => setAnnouncementForm({ ...announcementForm, announcement_type: e.target.value })}
                        className="mt-1 w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white"
                      >
                        {ANNOUNCEMENT_TYPES.map((type) => (
                          <option key={type.id} value={type.id}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">優先級</label>
                      <select
                        value={announcementForm.priority}
                        onChange={(e) => setAnnouncementForm({ ...announcementForm, priority: e.target.value })}
                        className="mt-1 w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white"
                      >
                        <option value="normal">一般</option>
                        <option value="high">重要</option>
                        <option value="urgent">緊急</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-slate-400">標題</label>
                    <Input
                      value={announcementForm.title}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                      placeholder="公告標題"
                      className="mt-1 bg-slate-800 border-slate-700"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-400">內容</label>
                    <Textarea
                      value={announcementForm.message}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })}
                      placeholder="公告內容..."
                      rows={6}
                      className="mt-1 bg-slate-800 border-slate-700"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-400">操作連結（選填）</label>
                    <Input
                      value={announcementForm.action_url}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, action_url: e.target.value })}
                      placeholder="https://..."
                      className="mt-1 bg-slate-800 border-slate-700"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={announcementForm.send_email}
                        onChange={(e) => setAnnouncementForm({ ...announcementForm, send_email: e.target.checked })}
                        className="rounded border-slate-600"
                      />
                      <Mail className="w-4 h-4" />
                      同時發送 Email
                    </label>

                    <Button
                      onClick={sendAnnouncement}
                      disabled={sending}
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      {sending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Megaphone className="w-4 h-4 mr-2" />
                      )}
                      發布公告
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Templates */}
            {activeTab === "templates" && (
              <Card className="bg-slate-900/50 border-slate-700/50">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-white">通知模板</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-slate-700/50 border-slate-600"
                      onClick={async () => {
                        try {
                          const res = await api.post("/admin/notifications/templates/init-defaults");
                          toast.success(`已初始化 ${res.data.created} 個預設模板`);
                          const templatesRes = await api.get("/admin/notifications/templates");
                          setTemplates(templatesRes.data.templates);
                        } catch (error: any) {
                          toast.error(error.response?.data?.detail || "初始化失敗");
                        }
                      }}
                    >
                      <Sparkles className="w-4 h-4 mr-1" />
                      初始化預設
                    </Button>
                    <Button
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700"
                      onClick={() => setShowTemplateForm(true)}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      新增模板
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {templates.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400">尚無模板</p>
                      <p className="text-sm text-slate-500 mt-1">點擊「初始化預設」建立系統預設模板</p>
                    </div>
                  ) : (
                    templates.map((template) => (
                      <div
                        key={template.id}
                        className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-white">{template.name}</h3>
                              {template.is_system && (
                                <Badge className="bg-purple-500/20 text-purple-300 text-xs">系統</Badge>
                              )}
                              {!template.is_active && (
                                <Badge className="bg-slate-500/20 text-slate-400 text-xs">停用</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className="bg-slate-700 text-slate-300 text-xs">
                                {NOTIFICATION_TYPES.find(t => t.id === template.notification_type)?.label || template.notification_type}
                              </Badge>
                              <span className="text-xs text-slate-500">代碼: {template.code}</span>
                            </div>
                            {template.description && (
                              <p className="text-xs text-slate-500 mt-1">{template.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-slate-400 hover:text-white"
                              onClick={() => useTemplate(template)}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-slate-400 hover:text-white"
                              onClick={() => {
                                setEditingTemplate(template);
                                setShowTemplateForm(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            {!template.is_system && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-400 hover:text-red-300"
                                onClick={() => deleteTemplate(template.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 p-3 rounded-lg bg-slate-900/50">
                          <p className="text-sm font-medium text-slate-300">{template.title}</p>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2 whitespace-pre-wrap">{template.message}</p>
                        </div>
                        {template.variables && template.variables.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {template.variables.map((v, i) => (
                              <Badge key={i} variant="outline" className="text-xs border-slate-600">
                                {`{${v.name}}`}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            )}

            {/* Template Form Modal */}
            {showTemplateForm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <Card className="bg-slate-900 border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                  <CardHeader>
                    <CardTitle className="text-white">
                      {editingTemplate ? "編輯模板" : "新增模板"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-slate-400">模板名稱 *</label>
                        <Input
                          value={templateForm.name}
                          onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                          placeholder="例：系統維護公告"
                          className="mt-1 bg-slate-800 border-slate-700"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400">模板代碼 *</label>
                        <Input
                          value={templateForm.code}
                          onChange={(e) => setTemplateForm({ ...templateForm, code: e.target.value })}
                          placeholder="例：maintenance"
                          className="mt-1 bg-slate-800 border-slate-700"
                          disabled={!!editingTemplate}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-slate-400">通知類型</label>
                        <select
                          value={templateForm.notification_type}
                          onChange={(e) => setTemplateForm({ ...templateForm, notification_type: e.target.value })}
                          className="mt-1 w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white"
                        >
                          {NOTIFICATION_TYPES.map((type) => (
                            <option key={type.id} value={type.id}>{type.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-sm text-slate-400">分類</label>
                        <select
                          value={templateForm.category}
                          onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
                          className="mt-1 w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white"
                        >
                          <option value="">無</option>
                          <option value="system">系統</option>
                          <option value="marketing">行銷</option>
                          <option value="transactional">交易</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-slate-400">說明</label>
                      <Input
                        value={templateForm.description}
                        onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                        placeholder="模板用途說明"
                        className="mt-1 bg-slate-800 border-slate-700"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-slate-400">標題 *</label>
                      <Input
                        value={templateForm.title}
                        onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })}
                        placeholder="通知標題（可使用 {變數}）"
                        className="mt-1 bg-slate-800 border-slate-700"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-slate-400">內容 *</label>
                      <Textarea
                        value={templateForm.message}
                        onChange={(e) => setTemplateForm({ ...templateForm, message: e.target.value })}
                        placeholder="通知內容（可使用 {變數}）..."
                        rows={6}
                        className="mt-1 bg-slate-800 border-slate-700"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-slate-400">操作連結</label>
                        <Input
                          value={templateForm.action_url}
                          onChange={(e) => setTemplateForm({ ...templateForm, action_url: e.target.value })}
                          placeholder="/dashboard/..."
                          className="mt-1 bg-slate-800 border-slate-700"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400">按鈕文字</label>
                        <Input
                          value={templateForm.action_text}
                          onChange={(e) => setTemplateForm({ ...templateForm, action_text: e.target.value })}
                          placeholder="查看詳情"
                          className="mt-1 bg-slate-800 border-slate-700"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-4">
                      <Button
                        variant="outline"
                        className="bg-slate-800 border-slate-700"
                        onClick={() => {
                          setShowTemplateForm(false);
                          setEditingTemplate(null);
                          resetTemplateForm();
                        }}
                      >
                        取消
                      </Button>
                      <Button
                        className="bg-indigo-600 hover:bg-indigo-700"
                        onClick={saveTemplate}
                        disabled={sending}
                      >
                        {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {editingTemplate ? "儲存變更" : "建立模板"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Type Stats */}
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white text-sm">類型統計</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {NOTIFICATION_TYPES.map((type) => {
                    const Icon = type.icon;
                    const count = stats?.by_type?.[type.id] || 0;
                    return (
                      <div key={type.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className={cn("w-4 h-4", type.color)} />
                          <span className="text-sm text-slate-400">{type.label}</span>
                        </div>
                        <span className="text-sm text-white">{count.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* History */}
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white text-sm">發送記錄</CardTitle>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">暫無記錄</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {history.map((item, index) => (
                      <div key={index} className="p-3 rounded-lg bg-slate-800/50">
                        <h4 className="font-medium text-white text-sm line-clamp-1">{item.title}</h4>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="border-slate-600 text-xs">
                            {item.sent_count} 人
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs",
                              item.read_rate > 50 ? "border-green-500/50 text-green-400" : "border-slate-600"
                            )}
                          >
                            {item.read_rate}% 已讀
                          </Badge>
                        </div>
                        {item.sent_at && (
                          <p className="text-xs text-slate-500 mt-2">
                            {format(new Date(item.sent_at), "MM/dd HH:mm", { locale: zhTW })}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 7-day Trend */}
            {stats?.trend && (
              <Card className="bg-slate-900/50 border-slate-700/50">
                <CardHeader>
                  <CardTitle className="text-white text-sm">7日趨勢</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between h-20 gap-1">
                    {stats.trend.map((day, index) => {
                      const maxCount = Math.max(...stats.trend.map(d => d.count), 1);
                      const height = (day.count / maxCount) * 100;
                      return (
                        <div key={index} className="flex-1 flex flex-col items-center gap-1">
                          <div 
                            className="w-full bg-indigo-500/50 rounded-t"
                            style={{ height: `${Math.max(height, 4)}%` }}
                          />
                          <span className="text-[10px] text-slate-500">{day.date}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
