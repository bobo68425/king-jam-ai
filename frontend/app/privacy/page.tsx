"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Shield, Lock, Eye, Database, UserCheck, Mail } from "lucide-react";

export default function PrivacyPolicyPage() {
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
            <Shield className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">隱私權政策</h1>
          <p className="text-slate-400">最後更新日期：2026 年 1 月 23 日</p>
        </div>

        {/* Policy Content */}
        <div className="prose prose-invert prose-slate max-w-none">
          <div className="space-y-8">
            {/* Section 1 */}
            <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-indigo-400" />
                </div>
                <h2 className="text-xl font-semibold text-white m-0">一、前言</h2>
              </div>
              <div className="text-slate-300 space-y-3">
                <p>
                  歡迎使用 King Jam AI（以下簡稱「本平台」或「我們」）。我們非常重視您的隱私權，並致力於保護您的個人資料。本隱私權政策說明我們如何蒐集、使用、揭露及保護您的個人資料。
                </p>
                <p>
                  當您使用本平台的服務時，即表示您同意本隱私權政策的條款。若您不同意本政策的任何部分，請勿使用本平台的服務。
                </p>
              </div>
            </section>

            {/* Section 2 */}
            <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Database className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-xl font-semibold text-white m-0">二、我們蒐集的資料</h2>
              </div>
              <div className="text-slate-300 space-y-4">
                <p>我們可能蒐集以下類型的個人資料：</p>
                
                <div className="space-y-3">
                  <h3 className="text-white font-medium">2.1 您主動提供的資料</h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>帳號註冊資料：電子郵件地址、密碼、姓名</li>
                    <li>身份驗證資料：身分證字號、出生日期、證件照片（用於提領功能）</li>
                    <li>付款資料：信用卡資訊、銀行帳戶資訊（透過第三方金流處理）</li>
                    <li>聯絡資訊：手機號碼、通訊地址</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h3 className="text-white font-medium">2.2 自動蒐集的資料</h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>裝置資訊：IP 位址、瀏覽器類型、作業系統</li>
                    <li>使用資料：登入時間、功能使用紀錄、生成內容紀錄</li>
                    <li>Cookies 及類似技術蒐集的資料</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h3 className="text-white font-medium">2.3 第三方登入資料</h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>Google 登入：電子郵件、姓名、頭像</li>
                    <li>Facebook 登入：電子郵件、姓名、頭像</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-xl font-semibold text-white m-0">三、資料使用目的</h2>
              </div>
              <div className="text-slate-300 space-y-3">
                <p>我們使用您的個人資料用於以下目的：</p>
                <ul className="list-disc list-inside space-y-2 text-slate-400">
                  <li>提供、維護及改善本平台的服務</li>
                  <li>處理您的註冊、訂閱及付款</li>
                  <li>驗證您的身份以確保帳號安全</li>
                  <li>處理獎金提領申請</li>
                  <li>發送服務通知、更新及行銷資訊（可選擇退出）</li>
                  <li>分析使用模式以改善用戶體驗</li>
                  <li>偵測及防止詐騙或濫用行為</li>
                  <li>遵守法律義務</li>
                </ul>
              </div>
            </section>

            {/* Section 4 */}
            <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-amber-400" />
                </div>
                <h2 className="text-xl font-semibold text-white m-0">四、資料保護措施</h2>
              </div>
              <div className="text-slate-300 space-y-3">
                <p>我們採取以下措施保護您的個人資料：</p>
                <ul className="list-disc list-inside space-y-2 text-slate-400">
                  <li>使用 SSL/TLS 加密技術保護資料傳輸</li>
                  <li>密碼以單向雜湊方式儲存，無法被還原</li>
                  <li>敏感資料（如身分證號碼）經過加密處理</li>
                  <li>定期進行安全性評估及滲透測試</li>
                  <li>嚴格限制員工存取個人資料的權限</li>
                  <li>與第三方服務供應商簽訂資料保護協議</li>
                </ul>
              </div>
            </section>

            {/* Section 5 */}
            <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-pink-400" />
                </div>
                <h2 className="text-xl font-semibold text-white m-0">五、資料分享與揭露</h2>
              </div>
              <div className="text-slate-300 space-y-3">
                <p>我們不會出售您的個人資料。我們可能在以下情況下分享您的資料：</p>
                <ul className="list-disc list-inside space-y-2 text-slate-400">
                  <li><strong>服務供應商：</strong>協助我們提供服務的第三方（如金流服務、雲端儲存）</li>
                  <li><strong>法律要求：</strong>為遵守法律義務、法院命令或政府機關的要求</li>
                  <li><strong>權益保護：</strong>為保護本平台、用戶或公眾的權利、財產或安全</li>
                  <li><strong>企業交易：</strong>在合併、收購或資產出售的情況下</li>
                </ul>
              </div>
            </section>

            {/* Section 6 */}
            <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-xl font-semibold text-white m-0">六、您的權利</h2>
              </div>
              <div className="text-slate-300 space-y-3">
                <p>根據相關法律，您擁有以下權利：</p>
                <ul className="list-disc list-inside space-y-2 text-slate-400">
                  <li><strong>查詢權：</strong>查詢我們是否持有您的個人資料</li>
                  <li><strong>存取權：</strong>取得您的個人資料副本</li>
                  <li><strong>更正權：</strong>更正不正確或不完整的資料</li>
                  <li><strong>刪除權：</strong>要求刪除您的個人資料（受法律限制）</li>
                  <li><strong>反對權：</strong>反對我們處理您的資料用於特定目的</li>
                  <li><strong>可攜權：</strong>以結構化格式取得您的資料</li>
                </ul>
                <p className="mt-4">
                  如需行使上述權利，請透過下方聯絡方式與我們聯繫。
                </p>
              </div>
            </section>

            {/* Section 7 */}
            <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                  <Database className="w-5 h-5 text-cyan-400" />
                </div>
                <h2 className="text-xl font-semibold text-white m-0">七、Cookies 政策</h2>
              </div>
              <div className="text-slate-300 space-y-3">
                <p>本平台使用 Cookies 及類似技術來：</p>
                <ul className="list-disc list-inside space-y-2 text-slate-400">
                  <li>維持您的登入狀態</li>
                  <li>記住您的偏好設定</li>
                  <li>分析網站流量及使用模式</li>
                  <li>提供個人化的內容及廣告</li>
                </ul>
                <p className="mt-4">
                  您可以透過瀏覽器設定管理或停用 Cookies，但這可能影響您使用本平台的體驗。
                </p>
              </div>
            </section>

            {/* Section 8 */}
            <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-violet-400" />
                </div>
                <h2 className="text-xl font-semibold text-white m-0">八、資料保留期限</h2>
              </div>
              <div className="text-slate-300 space-y-3">
                <p>我們會在達成蒐集目的所需的期間內保留您的個人資料：</p>
                <ul className="list-disc list-inside space-y-2 text-slate-400">
                  <li>帳號資料：帳號存續期間及刪除後 30 天</li>
                  <li>交易紀錄：依法律要求保留 7 年</li>
                  <li>身份驗證資料：驗證完成後 3 年</li>
                  <li>使用紀錄：12 個月</li>
                </ul>
              </div>
            </section>

            {/* Section 9 */}
            <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-rose-400" />
                </div>
                <h2 className="text-xl font-semibold text-white m-0">九、聯絡我們</h2>
              </div>
              <div className="text-slate-300 space-y-3">
                <p>如您對本隱私權政策有任何疑問，或需要行使您的資料權利，請透過以下方式聯絡我們：</p>
                <div className="p-4 bg-slate-900/50 rounded-xl">
                  <p><strong>King Jam AI</strong></p>
                  <p>電子郵件：<a href="mailto:service@kingjam.app" className="text-indigo-400 hover:text-indigo-300">service@kingjam.app</a></p>
                  <p>網站：<a href="https://kingjam.app" className="text-indigo-400 hover:text-indigo-300">https://kingjam.app</a></p>
                </div>
              </div>
            </section>

            {/* Section 10 */}
            <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-slate-500/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-slate-400" />
                </div>
                <h2 className="text-xl font-semibold text-white m-0">十、政策變更</h2>
              </div>
              <div className="text-slate-300 space-y-3">
                <p>
                  我們可能會不定期更新本隱私權政策。當我們進行重大變更時，將透過電子郵件或網站公告通知您。建議您定期查閱本政策以了解最新資訊。
                </p>
                <p>
                  繼續使用本平台的服務即表示您接受更新後的隱私權政策。
                </p>
              </div>
            </section>
          </div>
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
