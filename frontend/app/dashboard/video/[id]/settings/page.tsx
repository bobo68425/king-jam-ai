"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft, Save, Activity, Code, Eye,
    BarChart3, CheckCircle2, AlertCircle, ShieldCheck, Loader2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import api from "@/lib/api";
import { toast } from "sonner";

interface TrackingSettings {
    fb_pixel_id: string | null;
    ga_measurement_id: string | null;
    custom_script: string | null;
}

export default function VideoTrackingSettingsPage() {
    const params = useParams();
    const router = useRouter();
    const historyId = params.id as string;

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [settings, setSettings] = useState<TrackingSettings>({
        fb_pixel_id: "",
        ga_measurement_id: "",
        custom_script: ""
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await api.get(`/history/${historyId}/tracking`);
                setSettings({
                    fb_pixel_id: response.data.fb_pixel_id || "",
                    ga_measurement_id: response.data.ga_measurement_id || "",
                    custom_script: response.data.custom_script || ""
                });
            } catch (err) {
                console.error("Failed to fetch tracking settings:", err);
                toast.error("無法載入追蹤設定", {
                    description: "影片紀錄不存在或連線異常"
                });
            } finally {
                setIsLoading(false);
            }
        };

        if (historyId) {
            fetchSettings();
        }
    }, [historyId]);

    const handleSave = async () => {
        try {
            setIsSaving(true);
            const payload = {
                fb_pixel_id: settings.fb_pixel_id || null,
                ga_measurement_id: settings.ga_measurement_id || null,
                custom_script: settings.custom_script || null
            };

            await api.put(`/history/${historyId}/tracking`, payload);

            toast.success("追蹤設定已儲存", {
                description: "您的自訂代碼已通過安全稽核並成功寫入",
                icon: <CheckCircle2 className="text-emerald-500" />
            });
        } catch (err: any) {
            console.error("Failed to save tracking settings:", err);
            toast.error("儲存失敗", {
                description: err.response?.data?.detail || "請稍後再試",
                icon: <AlertCircle className="text-red-500" />
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCopyLink = () => {
        const url = `${window.location.origin}/v/${historyId}`;
        navigator.clipboard.writeText(url);
        toast.success("已複製公開分享連結！", {
            description: "您可以使用此連結搭配 Pixel 進行廣告投放"
        });
    };

    if (isLoading) {
        return (
            <div className="flex-1 w-full p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-slate-400 mt-4">載入設定中...</p>
            </div>
        );
    }

    return (
        <div className="flex-1 w-full p-4 sm:p-6 lg:p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => router.back()}
                            className="bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-300"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                                影片成效追蹤設定
                            </h1>
                            <p className="text-slate-400 text-sm mt-1">
                                為這個 AI 影片專屬的分享頁面綁定 Pixel 或 GA4，精準收集訪客受眾數據
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={handleCopyLink}
                            className="bg-slate-900/50 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
                        >
                            <Eye className="w-4 h-4 mr-2" />
                            預覽公開頁面
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {isSaving ? "儲存中..." : "儲存設定"}
                        </Button>
                    </div>
                </div>

                {/* Feature Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-slate-900 border-slate-800">
                        <CardContent className="p-5 flex gap-4 items-center">
                            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                                <BarChart3 className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="font-medium text-white text-sm">GA4 流量統計</p>
                                <p className="text-xs text-slate-500">掌握訪客來源與來源媒介</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-900 border-slate-800">
                        <CardContent className="p-5 flex gap-4 items-center">
                            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
                                <Activity className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="font-medium text-white text-sm">播放進度事件</p>
                                <p className="text-xs text-slate-500">自動回傳 25/50/75/100%</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-900 border-slate-800">
                        <CardContent className="p-5 flex gap-4 items-center">
                            <div className="p-3 bg-pink-500/10 rounded-xl text-pink-400">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="font-medium text-white text-sm">XSS 安全過濾</p>
                                <p className="text-xs text-slate-500">所有自訂代碼皆經歷安全掃描</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Form Settings */}
                <div className="grid grid-cols-1 gap-6">
                    <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
                        {/* 裝飾線 */}
                        <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

                        <CardHeader className="pb-4 border-b border-slate-800/50">
                            <CardTitle className="text-lg text-white">標準追蹤碼 (Pixels & Analytics)</CardTitle>
                            <CardDescription className="text-slate-400">
                                我們會在背景自動為您準備好這些追蹤碼的初始化流程與播放事件綁定。
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">

                            <div className="space-y-2 relative">
                                <Label htmlFor="fb-pixel" className="text-slate-300 font-medium flex justify-between">
                                    Meta Pixel ID (Facebook 像素)
                                </Label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500 border-r border-slate-700 pr-3 h-full bg-slate-800/50 rounded-l-md font-mono text-xs">
                                        ID
                                    </div>
                                    <Input
                                        id="fb-pixel"
                                        placeholder="例: 123456789012345"
                                        className="pl-[3.5rem] bg-slate-950 border-slate-700 text-slate-200 focus:border-indigo-500"
                                        value={settings.fb_pixel_id || ""}
                                        onChange={(e) => setSettings({ ...settings, fb_pixel_id: e.target.value.replace(/\D/g, '') })}
                                    />
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                                    只須填入那串純數字的 ID。<a href="https://business.facebook.com/events_manager2" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">如何取得？</a>
                                </p>
                            </div>

                            <div className="space-y-2 pt-2 border-t border-slate-800/50">
                                <Label htmlFor="ga-measurement" className="text-slate-300 font-medium">
                                    Google Analytics Measurement ID (評估 ID)
                                </Label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500 border-r border-slate-700 pr-3 h-full bg-slate-800/50 rounded-l-md font-mono text-xs">
                                        G-
                                    </div>
                                    <Input
                                        id="ga-measurement"
                                        placeholder="例: XXXXXXXXXX"
                                        className="pl-[3.5rem] bg-slate-950 border-slate-700 text-slate-200 focus:border-indigo-500 uppercase"
                                        value={settings.ga_measurement_id?.replace(/^G-/i, '') || ""}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setSettings({ ...settings, ga_measurement_id: val ? `G-${val.toUpperCase()}` : "" });
                                        }}
                                    />
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1.5">
                                    填寫 10 碼英數字組合（不需要輸入開頭的 G-）。
                                </p>
                            </div>

                        </CardContent>
                    </Card>

                    <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden relative">
                        <CardHeader className="pb-4 border-b border-slate-800/50">
                            <div className="flex items-center gap-2 text-amber-500 mb-1">
                                <Code className="w-4 h-4" />
                                <span className="text-xs font-semibold uppercase tracking-wider">Advanced / 進階使用</span>
                            </div>
                            <CardTitle className="text-lg text-white">自定義 &lt;head&gt; 追蹤代碼</CardTitle>
                            <CardDescription className="text-slate-400">
                                您可以貼上 TikTok Pixel、Line Tag 或是其他第三方追蹤程式碼。
                                基於安全性考量，系統將使用 Bleach 引擎過濾惡意的 JavaScript 行為。
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6">
                            <Textarea
                                placeholder="<!-- 貼上您的 HTML <script> 標籤 -->"
                                className="font-mono text-xs sm:text-sm bg-[#0d1117] border-slate-700 text-blue-300 focus:border-indigo-500 min-h-[250px] p-4 leading-relaxed tracking-tight"
                                value={settings.custom_script || ""}
                                onChange={(e) => setSettings({ ...settings, custom_script: e.target.value })}
                            />
                            <div className="flex items-start gap-2 mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-200">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <p className="text-xs">
                                    **安全警告：** 為了防範 XSS，系統會在寫入資料庫前，將帶有 <code>onload</code>, <code>onerror</code> 事件，或者非原生之未知標籤強制移除。如果您發現代碼未能正常執行，請只保留乾淨的 <code>&lt;script&gt;</code>、<code>&lt;noscript&gt;</code> 和 <code>&lt;img&gt;</code> 標籤。
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
