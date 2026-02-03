"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Users, Target, Heart, Sparkles, MapPin, Phone, Mail } from "lucide-react";

export default function AboutPage() {
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
            <Users className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">關於我們</h1>
          <p className="text-slate-400">打造 AI 驅動的智慧內容創作平台</p>
        </div>

        {/* Content */}
        <div className="prose prose-invert prose-slate max-w-none">
          <div className="space-y-8">
            {/* 公司介紹 */}
            <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                </div>
                <h2 className="text-xl font-semibold text-white m-0">我們是誰</h2>
              </div>
              <div className="text-slate-300 space-y-3">
                <p>
                  King Jam AI 是一個致力於革新內容創作的 AI 平台。我們相信每個人都應該能夠輕鬆創造專業級的內容，無論是社群媒體貼文、行銷素材，還是品牌視覺設計。
                </p>
                <p>
                  我們的團隊由經驗豐富的 AI 工程師、設計師和行銷專家組成，共同打造這個創新的平台，幫助個人和企業在數位時代脫穎而出。
                </p>
              </div>
            </section>

            {/* 使命願景 */}
            <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Target className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-xl font-semibold text-white m-0">我們的使命</h2>
              </div>
              <div className="text-slate-300 space-y-3">
                <p>
                  我們的使命是透過人工智慧技術，降低內容創作的門檻，讓每個人都能輕鬆產出高品質的內容。
                </p>
                <ul className="list-disc list-inside space-y-2 text-slate-400">
                  <li>提供直覺易用的 AI 工具，讓創作變得簡單</li>
                  <li>整合多平台社群媒體管理，提升工作效率</li>
                  <li>持續創新，引領內容創作的未來趨勢</li>
                  <li>建立創作者社群，共同成長進步</li>
                </ul>
              </div>
            </section>

            {/* 核心價值 */}
            <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-pink-400" />
                </div>
                <h2 className="text-xl font-semibold text-white m-0">核心價值</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-700/30 rounded-xl">
                  <h3 className="text-white font-medium mb-2">創新</h3>
                  <p className="text-slate-400 text-sm">持續探索 AI 技術的可能性，為用戶帶來最先進的創作工具</p>
                </div>
                <div className="p-4 bg-slate-700/30 rounded-xl">
                  <h3 className="text-white font-medium mb-2">品質</h3>
                  <p className="text-slate-400 text-sm">堅持高品質標準，確保每一個功能都能滿足專業需求</p>
                </div>
                <div className="p-4 bg-slate-700/30 rounded-xl">
                  <h3 className="text-white font-medium mb-2">用戶至上</h3>
                  <p className="text-slate-400 text-sm">傾聽用戶聲音，持續優化產品體驗</p>
                </div>
                <div className="p-4 bg-slate-700/30 rounded-xl">
                  <h3 className="text-white font-medium mb-2">信任</h3>
                  <p className="text-slate-400 text-sm">保護用戶資料安全，建立長期信任關係</p>
                </div>
              </div>
            </section>

            {/* 聯絡資訊 */}
            <section className="p-6 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-2xl border border-indigo-500/20">
              <h2 className="text-xl font-semibold text-white mb-6">聯絡資訊</h2>
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
