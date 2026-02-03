"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, MessageCircle, MapPin, Phone, Mail, Send, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // 模擬提交（實際上應該發送到後端 API）
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 發送郵件
    const mailtoLink = `mailto:bobo68425@gmail.com?subject=${encodeURIComponent(formData.subject)}&body=${encodeURIComponent(`
姓名：${formData.name}
Email：${formData.email}

訊息內容：
${formData.message}
    `)}`;
    
    window.location.href = mailtoLink;
    
    setIsSubmitting(false);
    setSubmitted(true);
    toast.success("感謝您的訊息！我們會盡快回覆您。");
  };

  const faqs = [
    { q: "如何開始使用 King Jam AI？", a: "註冊帳號後即可開始使用，新用戶可獲得免費試用點數。" },
    { q: "支援哪些付款方式？", a: "我們支援信用卡、LINE Pay、街口支付等多種付款方式。" },
    { q: "可以申請退款嗎？", a: "購買後 7 天內未使用可申請全額退款，詳情請參閱退款政策。" },
    { q: "如何成為合作夥伴？", a: "請前往合作夥伴頁面了解詳情，或直接與我們聯繫。" },
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
            <MessageCircle className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">聯絡我們</h1>
          <p className="text-slate-400">有任何問題或建議？我們很樂意聽取您的意見</p>
        </div>

        {/* Content */}
        <div className="space-y-8">
          {/* 聯絡資訊卡片 */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50 text-center">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">地址</h3>
              <p className="text-slate-400 text-sm">台北市信義區福德街84巷30號23樓之11</p>
            </div>
            <div className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50 text-center">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                <Phone className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">電話</h3>
              <a href="tel:+886981689608" className="text-slate-400 text-sm hover:text-white transition-colors">
                +886 981 689 608
              </a>
            </div>
            <div className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50 text-center">
              <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-pink-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">電子信箱</h3>
              <a href="mailto:bobo68425@gmail.com" className="text-slate-400 text-sm hover:text-white transition-colors">
                bobo68425@gmail.com
              </a>
            </div>
          </div>

          {/* 聯絡表單 */}
          <div className="grid md:grid-cols-2 gap-8">
            <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <h2 className="text-xl font-semibold text-white mb-6">傳送訊息</h2>
              
              {submitted ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                  <h3 className="text-white font-semibold text-lg mb-2">訊息已送出！</h3>
                  <p className="text-slate-400">感謝您的來信，我們會盡快回覆您。</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      setSubmitted(false);
                      setFormData({ name: "", email: "", subject: "", message: "" });
                    }}
                  >
                    傳送另一則訊息
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-slate-300">姓名</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="請輸入您的姓名"
                      required
                      className="bg-slate-700/50 border-slate-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-slate-300">電子信箱</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="請輸入您的 Email"
                      required
                      className="bg-slate-700/50 border-slate-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject" className="text-slate-300">主旨</Label>
                    <Input
                      id="subject"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      placeholder="請輸入訊息主旨"
                      required
                      className="bg-slate-700/50 border-slate-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-slate-300">訊息內容</Label>
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="請輸入您想說的話..."
                      rows={5}
                      required
                      className="bg-slate-700/50 border-slate-600"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
                  >
                    {isSubmitting ? (
                      <>處理中...</>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        傳送訊息
                      </>
                    )}
                  </Button>
                </form>
              )}
            </section>

            {/* 常見問題 */}
            <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <h2 className="text-xl font-semibold text-white mb-6">常見問題</h2>
              <div className="space-y-4">
                {faqs.map((faq, i) => (
                  <div key={i} className="p-4 bg-slate-700/30 rounded-xl">
                    <h3 className="text-white font-medium mb-2">{faq.q}</h3>
                    <p className="text-slate-400 text-sm">{faq.a}</p>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-white font-medium">客服時間</h3>
                </div>
                <p className="text-slate-400 text-sm">
                  週一至週五 09:00 - 18:00<br />
                  例假日休息，來信將於上班日回覆
                </p>
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
