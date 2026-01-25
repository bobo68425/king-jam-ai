"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, RefreshCw, CreditCard, Clock, AlertCircle, CheckCircle, HelpCircle, Mail } from "lucide-react";

export default function RefundPolicyPage() {
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 mb-6">
            <RefreshCw className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">退款政策</h1>
          <p className="text-slate-400">最後更新日期：2026 年 1 月 23 日</p>
        </div>

        {/* Quick Summary */}
        <div className="mb-10 p-6 bg-gradient-to-r from-emerald-500/10 to-green-500/10 rounded-2xl border border-emerald-500/20">
          <h2 className="text-lg font-semibold text-emerald-400 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            退款政策摘要
          </h2>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 bg-slate-900/50 rounded-xl">
              <div className="text-2xl font-bold text-white mb-1">7 天</div>
              <div className="text-slate-400">訂閱方案退款期限</div>
            </div>
            <div className="p-4 bg-slate-900/50 rounded-xl">
              <div className="text-2xl font-bold text-amber-400 mb-1">75%</div>
              <div className="text-slate-400">PAID 點數退款比例</div>
            </div>
            <div className="p-4 bg-slate-900/50 rounded-xl">
              <div className="text-2xl font-bold text-white mb-1">3-7 天</div>
              <div className="text-slate-400">退款處理時間</div>
            </div>
          </div>
        </div>

        {/* Policy Content */}
        <div className="space-y-8">
          {/* Section 1 */}
          <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-indigo-400" />
              </div>
              <h2 className="text-xl font-semibold text-white m-0">一、適用範圍</h2>
            </div>
            <div className="text-slate-300 space-y-3">
              <p>
                本退款政策適用於在 King Jam AI 平台（以下簡稱「本平台」）上進行的所有付費交易，包括但不限於：
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-400">
                <li>訂閱方案（入門版、專業版、企業版）</li>
                <li>點數包購買</li>
                <li>其他付費服務</li>
              </ul>
            </div>
          </section>

          {/* Section 2 */}
          <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold text-white m-0">二、訂閱方案退款</h2>
            </div>
            <div className="text-slate-300 space-y-4">
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                <h3 className="text-emerald-400 font-medium mb-2">✓ 可申請退款的情況</h3>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>首次訂閱後 7 天內，且未使用超過 100 點</li>
                  <li>系統故障導致無法正常使用服務超過 24 小時</li>
                  <li>重複扣款或錯誤扣款</li>
                </ul>
              </div>
              
              <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                <h3 className="text-red-400 font-medium mb-2">✗ 不適用退款的情況</h3>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>訂閱超過 7 天</li>
                  <li>已使用超過 100 點</li>
                  <li>續訂（非首次訂閱）</li>
                  <li>違反服務條款被停權</li>
                </ul>
              </div>

              <div className="p-4 bg-slate-900/50 rounded-xl">
                <h3 className="text-white font-medium mb-2">退款金額計算</h3>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>7 天內申請：全額退款</li>
                  <li>系統故障：按故障天數比例退款</li>
                  <li>退款將扣除已使用點數的等值金額</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-white m-0">三、點數包退款（PAID 點數）</h2>
            </div>
            <div className="text-slate-300 space-y-4">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <p className="text-emerald-300 font-medium">
                  ✓ PAID 點數（購買點數）支援退款，退款比例為購買金額的 75%
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-white font-medium">退款規則</h3>
                <ul className="list-disc list-inside space-y-2 text-slate-400">
                  <li>退款金額 = 申請退款點數 × 購買單價 × <strong className="text-amber-400">75%</strong></li>
                  <li>僅限 PAID 點數（購買點數）可退款</li>
                  <li>購買時贈送的點數不可退款</li>
                  <li>每次只能有一筆退款申請進行中</li>
                  <li>退款需經管理員審核</li>
                </ul>
              </div>

              <div className="p-4 bg-slate-900/50 rounded-xl">
                <h3 className="text-white font-medium mb-2">退款計算範例</h3>
                <div className="text-slate-400 text-sm space-y-1">
                  <p>購買 1000 點，花費 NT$650（每點 NT$0.65）</p>
                  <p>申請退款 1000 點</p>
                  <p>退款金額 = 1000 × 0.65 × 75% = <strong className="text-emerald-400">NT$487.5</strong></p>
                </div>
              </div>

              <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                <h3 className="text-red-400 font-medium mb-2">✗ 不可退款的點數類型</h3>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li><strong>PROMO 優惠點數</strong>：新手任務、行銷活動贈送</li>
                  <li><strong>SUB 月費點數</strong>：訂閱方案每月發放</li>
                  <li><strong>BONUS 獎金點數</strong>：推薦分潤獎金（可提領現金）</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-400" />
              </div>
              <h2 className="text-xl font-semibold text-white m-0">四、退款申請流程</h2>
            </div>
            <div className="text-slate-300 space-y-4">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold text-sm">1</div>
                  <div>
                    <h3 className="text-white font-medium">查詢退款資格</h3>
                    <p className="text-slate-400 text-sm">登入帳號後，前往「點數中心」→「PAID 點數退款」查看可退款餘額</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold text-sm">2</div>
                  <div>
                    <h3 className="text-white font-medium">提交退款申請</h3>
                    <p className="text-slate-400 text-sm">輸入要退款的點數數量，選擇退款方式（原付款方式或銀行轉帳）</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold text-sm">3</div>
                  <div>
                    <h3 className="text-white font-medium">點數凍結</h3>
                    <p className="text-slate-400 text-sm">申請後，該筆點數將被凍結，等待管理員審核</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold text-sm">4</div>
                  <div>
                    <h3 className="text-white font-medium">等待審核</h3>
                    <p className="text-slate-400 text-sm">我們將在 1-3 個工作天內審核您的申請</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold text-sm">5</div>
                  <div>
                    <h3 className="text-white font-medium">退款處理</h3>
                    <p className="text-slate-400 text-sm">審核通過後，退款將在 3-7 個工作天內退回指定方式</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl mt-4">
                <p className="text-blue-300 text-sm">
                  <strong>提示：</strong>在審核完成前，您可以隨時取消退款申請，凍結的點數將立即退還。
                </p>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-white m-0">五、退款方式</h2>
            </div>
            <div className="text-slate-300 space-y-3">
              <p>您可以選擇以下退款方式：</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-900/50 rounded-xl border-2 border-emerald-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-white font-medium">原付款方式退回</h3>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded">推薦</span>
                  </div>
                  <p className="text-slate-400 text-sm">退回至原付款的信用卡/Line Pay/ATM 帳戶</p>
                  <p className="text-slate-500 text-xs mt-1">處理時間：3-7 個工作天</p>
                </div>
                <div className="p-4 bg-slate-900/50 rounded-xl">
                  <h3 className="text-white font-medium mb-2">銀行轉帳</h3>
                  <p className="text-slate-400 text-sm">轉帳至您指定的銀行帳戶</p>
                  <p className="text-slate-500 text-xs mt-1">處理時間：5-7 個工作天</p>
                </div>
              </div>
              
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl mt-4">
                <p className="text-amber-300 text-sm">
                  <strong>注意：</strong>選擇銀行轉帳時，請確保提供正確的銀行代碼、帳號及戶名，資料錯誤將導致退款延遲。
                </p>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-pink-400" />
              </div>
              <h2 className="text-xl font-semibold text-white m-0">六、取消訂閱</h2>
            </div>
            <div className="text-slate-300 space-y-3">
              <p>您可以隨時取消訂閱：</p>
              <ul className="list-disc list-inside space-y-2 text-slate-400">
                <li>取消後，您的訂閱將在當期結束後停止</li>
                <li>當期已付費用不予退還</li>
                <li>取消後仍可使用服務至當期結束</li>
                <li>點數餘額在帳號有效期間內不會過期</li>
              </ul>
              <div className="p-4 bg-slate-900/50 rounded-xl mt-4">
                <p className="text-sm text-slate-400">
                  <strong className="text-white">取消方式：</strong>登入帳號 → 會員中心 → 訂閱管理 → 取消訂閱
                </p>
              </div>
            </div>
          </section>

          {/* Section 7 */}
          <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-cyan-400" />
              </div>
              <h2 className="text-xl font-semibold text-white m-0">七、特殊情況</h2>
            </div>
            <div className="text-slate-300 space-y-3">
              <p>以下特殊情況，我們將個案處理：</p>
              <ul className="list-disc list-inside space-y-2 text-slate-400">
                <li>帳號被盜用導致的非授權交易</li>
                <li>未成年人未經監護人同意的購買</li>
                <li>不可抗力因素（天災、系統重大故障等）</li>
              </ul>
              <p className="mt-4">
                如遇上述情況，請儘速聯繫客服並提供相關證明文件。
              </p>
            </div>
          </section>

          {/* Section 8 */}
          <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-rose-400" />
              </div>
              <h2 className="text-xl font-semibold text-white m-0">八、聯絡我們</h2>
            </div>
            <div className="text-slate-300 space-y-3">
              <p>如您對退款有任何疑問，請透過以下方式聯絡我們：</p>
              <div className="p-4 bg-slate-900/50 rounded-xl">
                <p><strong>King Jam AI 客服</strong></p>
                <p>電子郵件：<a href="mailto:service@kingjam.app" className="text-indigo-400 hover:text-indigo-300">service@kingjam.app</a></p>
                <p>服務時間：週一至週五 09:00-18:00（國定假日除外）</p>
                <p>網站：<a href="https://kingjam.app" className="text-indigo-400 hover:text-indigo-300">https://kingjam.app</a></p>
              </div>
            </div>
          </section>

          {/* Section 9 */}
          <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-slate-500/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-slate-400" />
              </div>
              <h2 className="text-xl font-semibold text-white m-0">九、政策變更</h2>
            </div>
            <div className="text-slate-300 space-y-3">
              <p>
                本平台保留隨時修改本退款政策的權利。修改後的政策將在網站上公佈，並於公佈時立即生效。建議您定期查閱本政策以了解最新資訊。
              </p>
              <p>
                如有重大變更，我們將透過電子郵件或網站公告通知您。
              </p>
            </div>
          </section>
        </div>

        {/* Back to Home */}
        <div className="mt-12 text-center">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回首頁
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-500 text-sm">
          © 2026 King Jam AI. All rights reserved. | <a href="https://kingjam.app" className="hover:text-white transition-colors">kingjam.app</a>
        </div>
      </footer>
    </div>
  );
}
