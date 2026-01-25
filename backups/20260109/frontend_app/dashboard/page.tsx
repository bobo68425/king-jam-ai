"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, CreditCard, Users, FileText } from "lucide-react";

interface MeResponse {
  id: number;
  email: string;
  full_name?: string | null;
  tier: string;
  credits: number;
  is_active: boolean;
}

export default function DashboardPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await api.get<MeResponse>("/auth/me");
        setMe(res.data);
      } catch (error) {
        console.error("Failed to fetch /auth/me", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMe();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">儀表板</h1>
      
      {/* 數據概覽卡片區 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">剩餘點數</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "--" : me?.credits?.toLocaleString() ?? "0"}
            </div>
            <p className="text-xs text-muted-foreground">
              {me ? `帳號層級：${me.tier}` : "載入中..."}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已生成文章</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+12</div>
            <p className="text-xs text-muted-foreground">本月新增 12 篇</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">活躍任務</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">正在排隊處理中</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">團隊成員</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
            <p className="text-xs text-muted-foreground">個人版方案</p>
          </CardContent>
        </Card>
      </div>

      {/* 近期活動區 (Placeholder) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>最近生成紀錄</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">尚無紀錄 (功能開發中...)</p>
          </CardContent>
        </Card>
        
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>快速開始</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="space-y-2">
                 <div className="p-3 bg-indigo-900/50 text-indigo-300 rounded-md text-sm cursor-pointer hover:bg-indigo-800/50">
                    ✨ 寫一篇關於 AI 的部落格
                 </div>
                 <div className="p-3 bg-pink-900/50 text-pink-300 rounded-md text-sm cursor-pointer hover:bg-pink-800/50">
                    📸 生成 IG 貼文圖片
                 </div>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}