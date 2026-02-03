"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, FileText, Scale, AlertTriangle, CreditCard, Ban, RefreshCw, Gavel, HelpCircle, MapPin, Phone, Mail } from "lucide-react";

export default function TermsOfServicePage() {
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
            <FileText className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">服務條款</h1>
          <p className="text-slate-400">最後更新日期：2026 年 2 月 3 日</p>
        </div>

        {/* Terms Content */}
        <div className="prose prose-invert prose-slate max-w-none">
          <div className="space-y-8">
            {/* Section 1 - 前言 */}
            <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <Scale className="w-5 h-5 text-indigo-400" />
                </div>
                <h2 className="text-xl font-semibold text-white m-0">一、前言與接受條款</h2>
              </div>
              <div className="text-slate-300 space-y-3">
                <p>
                  歡迎使用 King Jam AI（以下簡稱「本平台」或「我們」）。本服務條款（以下簡稱「本條款」）構成您與本平台之間具有法律約束力的協議。
                </p>
                <p>
                  當您註冊帳號、使用本平台的任何服務或功能時，即表示您已閱讀、理解並同意遵守本條款。若您不同意本條款的任何部分，請勿使用本平台的服務。
                </p>
                <p>
                  本平台保留隨時修改本條款的權利。修改後的條款將於公布時立即生效。您繼續使用本平台的服務，即表示您接受修改後的條款。
                </p>
              </div>
            </section>

            {/* Section 2 - 服務說明 */}
            <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-xl font-semibold text-white m-0">二、服務說明</h2>
              </div>
              <div className="text-slate-300 space-y-4">
                <p>King Jam AI 提供以下主要服務：</p>
                <ul className="list-disc list-inside space-y-2 text-slate-400">
                  <li><strong className="text-white">AI 內容生成：</strong>利用人工智慧技術生成文字、圖片等內容</li>
                  <li><strong className="text-white">圖片編輯室：</strong>專業級的線上圖片設計與編輯工具</li>
                  <li><strong className="text-white">社群媒體管理：</strong>多平台帳號管理、內容排程發布</li>
                  <li><strong className="text-white">AI 短影片製作：</strong>自動生成短影片內容</li>
                  <li><strong className="text-white">數據分析：</strong>社群媒體數據追蹤與分析報告</li>
                </ul>
                <p>
                  本平台保留隨時修改、暫停或終止任何服務的權利，恕不另行通知。
                </p>
              </div>
            </section>

            {/* Section 3 - 帳號與安全 */}
            <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-xl font-semibold text-white m-0">三、帳號註冊與安全</h2>
              </div>
              <div className="text-slate-300 space-y-4">
                <div className="space-y-3">
                  <h3 className="text-white font-medium">3.1 帳號註冊</h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>您必須年滿 18 歲或具有完全民事行為能力</li>
                    <li>您必須提供真實、準確、完整的註冊資訊</li>
                    <li>每位用戶僅能註冊一個帳號</li>
                    <li>禁止使用他人資訊進行註冊</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h3 className="text-white font-medium">3.2 帳號安全</h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>您有責任妥善保管您的帳號密碼</li>
                    <li>您應對使用您帳號進行的所有活動負責</li>
                    <li>如發現帳號被盜用，請立即通知我們</li>
                    <li>本平台不對因您未妥善保管帳號而造成的損失負責</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 4 - 付費服務 */}
            <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-green-400" />
                </div>
                <h2 className="text-xl font-semibold text-white m-0">四、付費服務與點數</h2>
              </div>
              <div className="text-slate-300 space-y-4">
                <div className="space-y-3">
                  <h3 className="text-white font-medium">4.1 點數購買</h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>本平台採用點數制，使用服務需消耗對應點數</li>
                    <li>點數購買後不可轉讓給他人</li>
                    <li>點數有效期限依購買方案而定</li>
                    <li>所有價格均以新台幣計價，並包含適用稅金</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h3 className="text-white font-medium">4.2 訂閱方案</h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>訂閱方案將自動續訂，除非您在續訂日前取消</li>
                    <li>取消訂閱後，您仍可使用服務至當期結束</li>
                    <li>方案價格可能調整，調整前會提前通知</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h3 className="text-white font-medium">4.3 退款政策</h3>
                  <p className="text-slate-400">
                    詳細退款政策請參閱 <Link href="/refund" className="text-indigo-400 hover:text-indigo-300">退款政策</Link> 頁面。
                  </p>
                </div>
              </div>
            </section>

            {/* Section 5 - 使用規範 */}
            <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <Ban className="w-5 h-5 text-red-400" />
                </div>
                <h2 className="text-xl font-semibold text-white m-0">五、禁止行為</h2>
              </div>
              <div className="text-slate-300 space-y-3">
                <p>使用本平台時，您不得：</p>
                <ul className="list-disc list-inside space-y-2 text-slate-400">
                  <li>違反任何適用法律法規</li>
                  <li>侵犯他人的智慧財產權、隱私權或其他權利</li>
                  <li>生成、傳播或儲存非法、有害、威脅、辱罵、騷擾、誹謗、淫穢或其他令人反感的內容</li>
                  <li>生成涉及未成年人的不當內容</li>
                  <li>冒充他人或虛假陳述您與任何個人或實體的關係</li>
                  <li>干擾或破壞本平台的服務或伺服器</li>
                  <li>嘗試未經授權存取本平台的系統或用戶帳號</li>
                  <li>使用自動化工具大量擷取或複製本平台內容</li>
                  <li>進行任何可能損害本平台聲譽的行為</li>
                  <li>轉售、出租或以商業目的分享您的帳號</li>
                </ul>
                <p className="text-yellow-400/80 mt-4">
                  ⚠️ 違反上述規定可能導致帳號被暫停或永久終止，且不予退款。
                </p>
              </div>
            </section>

            {/* Section 6 - 智慧財產權 */}
            <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                  <Gavel className="w-5 h-5 text-yellow-400" />
                </div>
                <h2 className="text-xl font-semibold text-white m-0">六、智慧財產權</h2>
              </div>
              <div className="text-slate-300 space-y-4">
                <div className="space-y-3">
                  <h3 className="text-white font-medium">6.1 平台內容</h3>
                  <p className="text-slate-400">
                    本平台的商標、標誌、軟體、介面設計及其他內容均受智慧財產權法保護，未經授權不得使用。
                  </p>
                </div>
                <div className="space-y-3">
                  <h3 className="text-white font-medium">6.2 用戶生成內容</h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>您透過本平台生成的內容，其著作權歸您所有</li>
                    <li>您授權本平台為提供服務而使用、儲存您的內容</li>
                    <li>您保證您上傳的素材不侵犯他人權利</li>
                    <li>若您的內容侵犯他人權利，您應自行承擔法律責任</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 7 - 免責聲明 */}
            <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-orange-400" />
                </div>
                <h2 className="text-xl font-semibold text-white m-0">七、免責聲明與責任限制</h2>
              </div>
              <div className="text-slate-300 space-y-4">
                <div className="space-y-3">
                  <h3 className="text-white font-medium">7.1 服務提供</h3>
                  <p className="text-slate-400">
                    本平台按「現狀」提供服務，不對服務的可用性、準確性、完整性或適用於特定目的作出任何明示或暗示的保證。
                  </p>
                </div>
                <div className="space-y-3">
                  <h3 className="text-white font-medium">7.2 AI 生成內容</h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>AI 生成的內容可能不準確或不完整</li>
                    <li>您應自行驗證 AI 生成內容的準確性</li>
                    <li>本平台不對 AI 生成內容的使用後果負責</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h3 className="text-white font-medium">7.3 責任限制</h3>
                  <p className="text-slate-400">
                    在法律允許的最大範圍內，本平台對任何間接、附帶、特殊、懲罰性或後果性損害不承擔責任，即使已被告知可能發生此類損害。
                  </p>
                </div>
              </div>
            </section>

            {/* Section 8 - 終止 */}
            <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
                  <Ban className="w-5 h-5 text-pink-400" />
                </div>
                <h2 className="text-xl font-semibold text-white m-0">八、服務終止</h2>
              </div>
              <div className="text-slate-300 space-y-3">
                <p>本平台得在以下情況終止或暫停您的帳號：</p>
                <ul className="list-disc list-inside space-y-2 text-slate-400">
                  <li>您違反本條款的任何規定</li>
                  <li>您的行為可能對本平台或其他用戶造成損害</li>
                  <li>法律要求我們這樣做</li>
                  <li>您長期未使用帳號（超過 12 個月）</li>
                </ul>
                <p>
                  您也可以隨時透過帳號設定頁面申請刪除帳號。帳號刪除後，您的資料將依據隱私權政策處理。
                </p>
              </div>
            </section>

            {/* Section 9 - 準據法 */}
            <section className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                  <Gavel className="w-5 h-5 text-cyan-400" />
                </div>
                <h2 className="text-xl font-semibold text-white m-0">九、準據法與管轄</h2>
              </div>
              <div className="text-slate-300 space-y-3">
                <p>
                  本條款應依據中華民國法律解釋。因本條款引起的任何爭議，雙方同意以台灣台北地方法院為第一審管轄法院。
                </p>
              </div>
            </section>

            {/* Section 10 - 聯絡資訊 */}
            <section className="p-6 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-2xl border border-indigo-500/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
                  <HelpCircle className="w-5 h-5 text-indigo-400" />
                </div>
                <h2 className="text-xl font-semibold text-white m-0">十、聯絡我們</h2>
              </div>
              <div className="text-slate-300 space-y-4">
                <p>如果您對本條款有任何疑問，請透過以下方式聯絡我們：</p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">地址</p>
                      <p className="text-slate-400">台北市信義區福德街84巷30號23樓之11</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                      <Phone className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">電話</p>
                      <a href="tel:+886981689608" className="text-slate-400 hover:text-white transition-colors">+886 981 689 608</a>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">電子信箱</p>
                      <a href="mailto:bobo68425@gmail.com" className="text-slate-400 hover:text-white transition-colors">bobo68425@gmail.com</a>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 相關連結 */}
            <section className="p-6 bg-slate-800/30 rounded-2xl border border-slate-700/30">
              <h2 className="text-lg font-semibold text-white mb-4">相關政策</h2>
              <div className="flex flex-wrap gap-3">
                <Link href="/privacy" className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors text-sm">
                  隱私權政策
                </Link>
                <Link href="/refund" className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors text-sm">
                  退款政策
                </Link>
                <Link href="/contact" className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors text-sm">
                  聯絡我們
                </Link>
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
