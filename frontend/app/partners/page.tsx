"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Handshake, Building2, Rocket, Gift, MapPin, Phone, Mail, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PartnersPage() {
  const benefits = [
    { title: "專屬佣金", desc: "享有優渥的推薦獎金制度" },
    { title: "行銷資源", desc: "提供完整的行銷素材與支援" },
    { title: "優先體驗", desc: "搶先體驗最新功能與服務" },
    { title: "專屬客服", desc: "合作夥伴專屬的客戶服務" },
    { title: "聯合行銷", desc: "共同曝光與品牌合作機會" },
    { title: "技術支援", desc: "API 整合與技術諮詢服務" },
  ];

  const partnerTypes = [
    {
      icon: Building2,
      title: "企業合作",
      desc: "適合企業客戶、代理商或經銷商，提供團隊授權與客製化解決方案",
      color: "indigo",
    },
    {
      icon: Rocket,
      title: "推廣夥伴",
      desc: "適合網紅、部落客、KOL，透過推薦連結賺取佣金",
      color: "purple",
    },
    {
      icon: Gift,
      title: "策略聯盟",
      desc: "適合相關產業夥伴，共同開發市場與產品整合",
      color: "pink",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/logo.png" alt="King Jam AI" width={40} height={40} className="rounded-xl" />
              <span className="text-xl font-bold text-white">King Jam AI</span>
            </Link>
            <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              返回首頁
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Title */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 mb-6">
            <Handshake className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">合作夥伴計畫</h1>
          <p className="text-slate-400 max-w-2xl mx-auto">
            加入 King Jam AI 合作夥伴計畫，一起開創 AI 內容創作的無限可能
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-invert prose-slate max-w-none">
          <div className="space-y-8">
            {/* 合作類型 */}
            <section>
              <h2 className="text-xl font-semibold text-white mb-6">合作類型</h2>
              <div className="grid md:grid-cols-3 gap-4">
                {partnerTypes.map((type, i) => (
                  <div key={i} className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50 text-center">
                    <div className={`w-12 h-12 rounded-xl bg-${type.color}-500/10 flex items-center justify-center mx-auto mb-4`}>
                      <type.icon className={`w-6 h-6 text-${type.color}-400`} />
                    </div>
                    <h3 className="text-white font-semibold mb-2">{type.title}</h3>
                    <p className="text-slate-400 text-sm">{type.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 合作優勢 */}
            <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <h2 className="text-xl font-semibold text-white mb-6">合作夥伴專屬福利</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {benefits.map((benefit, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-700/30 rounded-xl">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-white font-medium">{benefit.title}</h3>
                      <p className="text-slate-400 text-sm">{benefit.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 加入方式 */}
            <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <h2 className="text-xl font-semibold text-white mb-4">如何成為合作夥伴</h2>
              <div className="space-y-4 text-slate-300">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0 text-white font-bold">1</div>
                  <div>
                    <h3 className="text-white font-medium">提交申請</h3>
                    <p className="text-slate-400 text-sm">填寫下方聯絡資訊，說明您的合作意向</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0 text-white font-bold">2</div>
                  <div>
                    <h3 className="text-white font-medium">評估審核</h3>
                    <p className="text-slate-400 text-sm">我們將在 3-5 個工作天內審核您的申請</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0 text-white font-bold">3</div>
                  <div>
                    <h3 className="text-white font-medium">簽署合約</h3>
                    <p className="text-slate-400 text-sm">通過審核後，簽署合作夥伴協議</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0 text-white font-bold">4</div>
                  <div>
                    <h3 className="text-white font-medium">開始合作</h3>
                    <p className="text-slate-400 text-sm">獲得專屬資源，開始您的合作之旅</p>
                  </div>
                </div>
              </div>
            </section>

            {/* 聯絡資訊 */}
            <section className="p-6 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-2xl border border-indigo-500/20">
              <h2 className="text-xl font-semibold text-white mb-6">聯絡我們洽談合作</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">地址</p>
                    <p className="text-slate-400">台北市信義區福德街84巷30號23樓之11</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">電話</p>
                    <a href="tel:+886981689608" className="text-slate-400 hover:text-white transition-colors">+886 981 689 608</a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">電子信箱</p>
                    <a href="mailto:bobo68425@gmail.com" className="text-slate-400 hover:text-white transition-colors">bobo68425@gmail.com</a>
                  </div>
                </div>
              </div>
              <div className="mt-6">
                <Button asChild className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600">
                  <a href="mailto:bobo68425@gmail.com?subject=合作夥伴申請">
                    立即申請合作
                  </a>
                </Button>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-slate-500 text-sm">
          © 2026 King Jam AI. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
