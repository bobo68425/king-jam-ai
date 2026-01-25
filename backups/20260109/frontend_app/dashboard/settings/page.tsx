"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">設定</h1>
      
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>帳號設定</CardTitle>
            <CardDescription>管理您的帳號資訊</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="your@email.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">姓名</Label>
              <Input id="name" type="text" placeholder="您的姓名" />
            </div>
            <Button>儲存變更</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>偏好設定</CardTitle>
            <CardDescription>個人化您的使用體驗</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              偏好設定功能開發中...
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


