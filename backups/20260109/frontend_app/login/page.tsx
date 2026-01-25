"use client"; // 標記為客戶端組件

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      // 呼叫後端 API (使用 Form Data 格式)
      const formData = new FormData();
      formData.append("username", email);
      formData.append("password", password);

      const res = await api.post("/auth/login", formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
      });

      // 儲存 Token
      localStorage.setItem("token", res.data.access_token);
      alert("登入成功！");
      router.push("/dashboard"); // 跳轉到部落格生成頁
    } catch (error) {
      alert("登入失敗，請檢查帳號密碼");
      console.error(error);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-900">
      <Card className="w-[350px] bg-slate-800 border-slate-700">
        <CardHeader>
          <div className="flex justify-center py-5">
            <Image
              src="/logo.png"
              alt="KING JINK AI"
              width={520}
              height={172}
              className="h-[125px] w-auto"
              priority
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent && !parent.querySelector('.logo-fallback')) {
                  const fallback = document.createElement('span');
                  fallback.className = 'logo-fallback text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent';
                  fallback.textContent = 'KING JINK AI';
                  parent.appendChild(fallback);
                }
              }}
            />
            <span className="logo-fallback text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent hidden">
              KING JINK AI
            </span>
          </div>
          <CardTitle className="text-center">登入</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input 
            placeholder="Email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
          />
          <Input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
          />
          <Button className="w-full" onClick={handleLogin}>
            登入開始創作
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}