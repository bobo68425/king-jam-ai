"use client";

import { useState, useRef, useEffect } from "react";
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  Sparkles,
  Loader2,
  Minimize2,
  Maximize2,
  HelpCircle,
  CreditCard,
  Video,
  FileText,
  Wand2,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isAI?: boolean; // 是否為 AI API 回應
}

// ============================================================
// 加強版知識庫
// ============================================================
const KNOWLEDGE_BASE: Record<string, { keywords: string[]; response: string }> = {
  greeting: {
    keywords: ["嗨", "哈囉", "你好", "hi", "hello", "hey", "安安"],
    response: `嗨！我是 King Jam AI 智能助手 🤖

很高興為您服務！我可以幫助您：
• 了解平台功能與使用方式
• 解答點數與方案問題
• 提供內容創作建議
• 排解使用問題

請問有什麼可以幫您的？`
  },
  
  newUser: {
    keywords: ["新用戶", "新手", "開始", "入門", "如何使用", "怎麼用", "教學", "第一次"],
    response: `歡迎使用 King Jam AI！🎉

**快速入門 5 步驟：**

1️⃣ **註冊/登入**
   使用 Email 或 Google 帳號

2️⃣ **領取免費點數**
   新用戶註冊即獲得 100 點試用

3️⃣ **選擇創作類型**
   文章生成、社群圖文、短影片

4️⃣ **輸入主題**
   告訴 AI 你想創作的內容

5️⃣ **一鍵生成**
   AI 將為你產出專業內容

有任何問題歡迎隨時詢問！`
  },

  video: {
    keywords: ["影片", "視頻", "video", "短影音", "短片", "vlog", "reels"],
    response: `AI 短影片生成 📹

**使用步驟：**
1. 進入「短影片生成」功能
2. 輸入影片主題或腳本
3. 選擇風格和時長（15秒/30秒/60秒）
4. AI 自動生成影片

**強大功能：**
• 🎙️ 自動配音（多種語音可選）
• 🎨 AI 生成精美畫面
• 📝 字幕自動生成
• 🎵 背景音樂自動配樂

⏱️ 生成時間：約 2-5 分鐘
💰 消耗點數：100-300 點/支

**小技巧**：描述越詳細，生成效果越好！`
  },

  article: {
    keywords: ["文章", "部落格", "blog", "寫作", "文案", "copywriting", "seo"],
    response: `AI 文章生成 ✍️

**使用步驟：**
1. 選擇「文章生成」功能
2. 輸入文章主題或關鍵字
3. 選擇文章類型和風格
4. 點擊生成

**支援類型：**
• 📰 部落格文章
• 🛍️ 產品介紹
• 📢 新聞稿
• 🔍 SEO 優化文章
• 📱 社群貼文

💰 消耗點數：10-30 點/篇

**小技巧**：可以指定字數、語氣、目標受眾！`
  },

  image: {
    keywords: ["圖片", "圖文", "設計", "海報", "貼圖", "ig", "instagram", "社群圖"],
    response: `社群圖文設計 🎨

**使用步驟：**
1. 選擇「設計工作室」
2. 輸入主題或上傳素材
3. 選擇平台尺寸（IG/FB/LINE）
4. AI 生成設計

**功能特色：**
• 📐 多種尺寸模板
• 🖼️ AI 智能排版
• ✨ 一鍵去背功能
• 🎨 風格濾鏡

💰 消耗點數：20-50 點/張

**支援平台尺寸**：
• Instagram 貼文/限動
• Facebook 貼文/封面
• LINE 圖文訊息`
  },

  credits: {
    keywords: ["點數", "價格", "方案", "費用", "購買", "多少錢", "價目", "收費"],
    response: `點數方案說明 💰

**點數用途：**
• 文章生成：10-30 點/篇
• 圖文設計：20-50 點/張
• 短影片：100-300 點/支

**購買方案：**
┌─────────────────────────┐
│ 💚 輕量包   100 點   NT$99   │
│ 💙 標準包   500 點   NT$399  │
│ 💜 專業包  1500 點  NT$999  │
│ 🧡 企業包  5000 點  NT$2999 │
└─────────────────────────┘

🎁 **新用戶優惠**：註冊即贈 100 點！
⏰ **點數期限**：永久有效，不會過期

前往「價格方案」頁面即可購買！`
  },

  schedule: {
    keywords: ["排程", "發布", "定時", "schedule", "自動發布", "預約"],
    response: `排程發布功能 📅

**支援平台：**
• 📘 Facebook 粉絲專頁
• 📷 Instagram 商業帳號
• 💬 LINE 官方帳號
• 🌐 WordPress 網站

**使用步驟：**
1. 先在「社群帳號管理」綁定帳號
2. 創作完成後選擇「排程發布」
3. 設定發布時間
4. 系統會自動在指定時間發布

**小技巧**：可以一次排程多篇內容！`
  },

  bindAccount: {
    keywords: ["綁定", "連結", "社群帳號", "連接", "授權", "oauth", "串接"],
    response: `社群帳號綁定 🔗

**綁定步驟：**
1. 前往「設定」>「社群帳號管理」
2. 點擊要綁定的平台
3. 依照指示完成授權
4. 授權成功即完成綁定

**支援平台：**
• Facebook 粉絲專頁
• Instagram 商業帳號
• LINE 官方帳號
• WordPress 網站
• YouTube 頻道

💡 輸入平台名稱查看詳細串接教學！`
  },

  facebook: {
    keywords: ["facebook", "fb", "臉書", "粉專", "粉絲專頁"],
    response: `Facebook 粉絲專頁串接 📘

**前置條件：**
• 擁有 Facebook 粉絲專頁
• 您是該專頁的管理員

**串接步驟：**
1. 前往「社群帳號管理」
2. 點擊「連結 Facebook」
3. 登入 Facebook 帳號
4. 選擇要連結的粉絲專頁
5. 授權必要權限
6. 完成！

**可用功能：**
✅ 發布貼文（文字+圖片）
✅ 排程發布
✅ 查看成效數據

**常見問題：**
Q: 為什麼看不到我的專頁？
A: 請確認您是該專頁的「管理員」角色`
  },

  instagram: {
    keywords: ["instagram", "ig", "限動", "reels"],
    response: `Instagram 商業帳號串接 📷

**前置條件：**
• Instagram 帳號需轉為「商業帳號」或「創作者帳號」
• 需綁定 Facebook 粉絲專頁

**轉換商業帳號：**
1. IG App > 設定 > 帳號
2. 切換為專業帳號
3. 選擇「商業」或「創作者」
4. 連結 Facebook 粉絲專頁

**串接步驟：**
1. 先完成 Facebook 串接
2. 在「社群帳號管理」點擊「連結 Instagram」
3. 選擇對應的 IG 商業帳號
4. 完成！

**可用功能：**
✅ 發布貼文（單圖/多圖）
✅ 排程發布
✅ 查看洞察數據

⚠️ 限動(Stories)目前不支援 API 發布`
  },

  line: {
    keywords: ["line", "line@", "官方帳號", "line官方"],
    response: `LINE 官方帳號串接 💬

**前置條件：**
• 擁有 LINE 官方帳號（LINE Official Account）
• 需要 Messaging API 的 Channel Access Token

**取得 Token 步驟：**
1. 前往 LINE Developers Console
   https://developers.line.biz/
2. 登入並選擇您的 Provider
3. 選擇或建立 Messaging API Channel
4. 在「Messaging API」頁籤找到 Channel Access Token
5. 點擊「Issue」產生 Token

**串接步驟：**
1. 在「社群帳號管理」點擊「連結 LINE」
2. 貼上 Channel Access Token
3. 完成！

**可用功能：**
✅ 推播訊息給好友
✅ 排程發送
✅ 圖文訊息`
  },

  wordpress: {
    keywords: ["wordpress", "wp", "部落格", "網站"],
    response: `WordPress 網站串接 🌐

**前置條件：**
• WordPress 5.6 以上版本
• 您是網站管理員

**產生應用程式密碼：**
1. 登入 WordPress 後台
2. 前往「使用者」>「個人資料」
3. 捲動到「應用程式密碼」區塊
4. 輸入名稱（如：King Jam AI）
5. 點擊「新增應用程式密碼」
6. 複製產生的密碼（含空格）

**串接步驟：**
1. 在「社群帳號管理」點擊「連結 WordPress」
2. 輸入網站網址（如：https://yourblog.com）
3. 輸入使用者名稱（登入帳號）
4. 貼上應用程式密碼
5. 完成！

**可用功能：**
✅ 發布文章（草稿/立即發布）
✅ 排程發布
✅ 上傳特色圖片
✅ 設定分類與標籤`
  },

  youtube: {
    keywords: ["youtube", "yt", "頻道", "影片上傳"],
    response: `YouTube 頻道串接 🎬

**前置條件：**
• 擁有 YouTube 頻道
• Google 帳號需有頻道管理權限

**串接步驟：**
1. 在「社群帳號管理」點擊「連結 YouTube」
2. 登入 Google 帳號
3. 選擇要連結的 YouTube 頻道
4. 授權必要權限
5. 完成！

**可用功能：**
✅ 上傳影片
✅ 設定標題、描述、標籤
✅ 排程發布
✅ 查看頻道數據

**注意事項：**
• 每日上傳有數量限制
• 影片需符合 YouTube 社群規範`
  },

  tiktok: {
    keywords: ["tiktok", "抖音", "短視頻"],
    response: `TikTok 串接 🎵

**目前狀態：** 🚧 即將支援

TikTok API 串接功能正在開發中！

**預計支援功能：**
• 影片上傳
• 排程發布
• 數據分析

敬請期待！有最新消息會通知您 ✨`
  },

  connectError: {
    keywords: ["連不上", "斷線", "失敗", "錯誤", "無法連接", "token", "過期", "重新連接"],
    response: `社群帳號連線問題排解 🔧

**常見問題與解決方案：**

**1. 顯示「連線錯誤」**
• 嘗試重新連結帳號
• 檢查網路連線
• 清除瀏覽器快取後重試

**2. Token 過期**
• 前往「社群帳號管理」
• 點擊「重新授權」
• 重新完成授權流程

**3. Facebook/IG 無法連結**
• 確認是粉絲專頁管理員
• IG 需為商業帳號
• 嘗試先解除再重新綁定

**4. WordPress 連線失敗**
• 確認網址正確（含 https://）
• 檢查應用程式密碼是否正確
• 確認 WordPress 版本 >= 5.6

**5. 權限不足**
• 重新授權時勾選所有權限
• 檢查帳號角色是否正確

仍有問題？請聯繫 service@kingjam.app`
  },

  disconnect: {
    keywords: ["解除", "取消綁定", "移除", "刪除帳號", "斷開"],
    response: `解除社群帳號綁定 🔓

**解除步驟：**
1. 前往「設定」>「社群帳號管理」
2. 找到要解除的帳號
3. 點擊「⋯」更多選項
4. 選擇「解除連結」
5. 確認解除

**注意事項：**
• 解除後排程中的貼文將無法發布
• 歷史發布記錄仍會保留
• 可隨時重新綁定

**完全移除授權：**
如需完全移除，也可在各平台設定中撤銷：
• Facebook：設定 > 應用程式和網站
• Google：myaccount.google.com > 安全性 > 第三方應用程式`
  },

  refund: {
    keywords: ["退款", "退費", "取消", "refund"],
    response: `退款政策說明 💳

**退款條件：**
• 購買後 7 天內可申請
• 點數使用不超過 10%
• 首次購買可全額退款

**申請方式：**
發送郵件至 service@kingjam.app
請註明：訂單編號、退款原因

我們會在 3 個工作天內處理！`
  },

  contact: {
    keywords: ["聯繫", "客服", "問題", "幫助", "聯絡", "email", "信箱"],
    response: `客服聯繫方式 📧

**Email**：service@kingjam.app
**客服時間**：週一至週五 09:00-18:00
**回覆時間**：24 小時內

您也可以直接在這裡詢問，我會盡力協助！`
  },

  copyright: {
    keywords: ["版權", "商用", "授權", "著作權", "commercial"],
    response: `版權與商用說明 📜

**內容版權**：
所有透過 King Jam AI 生成的內容，版權歸您所有！

**可以做：**
✅ 個人使用
✅ 商業使用
✅ 修改編輯
✅ 社群發布

**不可以做：**
❌ 聲稱為其他 AI 服務生成
❌ 轉售生成服務本身

放心使用，創作無限！`
  },

  language: {
    keywords: ["語言", "中文", "英文", "翻譯", "多語"],
    response: `支援語言說明 🌍

**主要支援：**
• 繁體中文 ✅
• 簡體中文 ✅
• 英文 ✅

**其他語言**：
日文、韓文、越南文等也可嘗試，但品質可能略有差異

**翻譯功能**：
生成內容後可使用「翻譯」功能轉換語言`
  },

  thanks: {
    keywords: ["謝謝", "感謝", "thanks", "thank", "3q", "thx"],
    response: `不客氣！很高興能幫到您 😊

如果還有其他問題，隨時歡迎詢問！

祝您創作順利 ✨`
  },

  bye: {
    keywords: ["bye", "掰", "再見", "拜拜", "goodbye"],
    response: `再見！感謝您使用 King Jam AI 👋

期待再次為您服務！

有任何問題歡迎隨時回來詢問 😊`
  }
};

// 本地知識庫回應
function getLocalResponse(message: string): string {
  const m = message.toLowerCase();
  
  // 遍歷知識庫找匹配
  for (const [key, data] of Object.entries(KNOWLEDGE_BASE)) {
    if (data.keywords.some(kw => m.includes(kw))) {
      return data.response;
    }
  }
  
  // 預設回應
  return `我是 King Jam AI 智能助手 🤖

我可以幫您解答：
• 平台功能使用方式
• 點數與方案說明
• 內容創作技巧
• 帳號相關問題

請問您想了解什麼呢？

💡 試試輸入：影片、文章、點數、排程`;
}

// 快速按鈕
const QUICK_BTNS = [
  { icon: HelpCircle, label: "如何開始？", msg: "我是新用戶，如何開始使用？" },
  { icon: Video, label: "影片生成", msg: "如何生成短影片？" },
  { icon: FileText, label: "文章創作", msg: "如何生成文章？" },
  { icon: CreditCard, label: "點數方案", msg: "點數如何計算？有哪些方案？" },
];

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [mini, setMini] = useState(false);
  const [msgs, setMsgs] = useState<Message[]>([
    { id: "w", role: "assistant", content: "嗨！我是 King Jam AI 智能助手 🤖\n\n有什麼可以幫您的？\n\n您可以直接輸入問題，或點擊下方快速選項！" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastUserMsg, setLastUserMsg] = useState(""); // 記錄最後一則用戶訊息，用於 AI 回答
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  // 本地回應
  const sendLocal = (text: string) => {
    const t = text.trim();
    if (!t || loading) return;
    
    setMsgs(p => [...p, { id: `u${Date.now()}`, role: "user", content: t }]);
    setInput("");
    setLoading(true);
    setLastUserMsg(t);
    
    window.setTimeout(() => {
      setMsgs(p => [...p, { id: `a${Date.now()}`, role: "assistant", content: getLocalResponse(t) }]);
      setLoading(false);
    }, 300);
  };

  // AI API 回應（開發中）
  const sendAI = () => {
    if (loading) return;
    
    setLoading(true);
    
    window.setTimeout(() => {
      setMsgs(p => [...p, { 
        id: `a${Date.now()}`, 
        role: "assistant", 
        content: `🚧 **AI 智能回答功能開發中**

此功能即將上線！敬請期待 ✨

目前您可以：
• 使用快速問答按鈕
• 直接輸入關鍵字查詢
• 聯繫客服 service@kingjam.app

感謝您的耐心等候！`,
        isAI: true 
      }]);
      setLoading(false);
    }, 500);
  };

  // 關閉狀態 - 顯示浮動按鈕
  if (!open) {
    return (
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999 }}>
        <button
          onClick={() => setOpen(true)}
          style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            transition: "transform 0.2s"
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >
          <MessageCircle color="white" size={24} />
        </button>
        <div style={{
          position: "absolute", right: 64, bottom: 8,
          background: "white", padding: "8px 12px", borderRadius: 8,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)", whiteSpace: "nowrap",
          fontSize: 14, color: "#374151"
        }}>
          需要幫助嗎？
        </div>
      </div>
    );
  }

  // 打開狀態 - 顯示對話框
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      width: 400, maxWidth: "calc(100vw - 48px)",
      height: mini ? "auto" : 560,
      background: "#0f172a", borderRadius: 16,
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      border: "1px solid #334155",
      display: "flex", flexDirection: "column",
      overflow: "hidden"
    }}>
      {/* 標題 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px",
        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
        color: "white"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <Bot size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>King Jam 智能助手</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>24 小時為您服務</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => setMini(!mini)} style={{
            width: 32, height: 32, background: "rgba(255,255,255,0.1)", border: "none",
            borderRadius: 6, cursor: "pointer", color: "white",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            {mini ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
          <button onClick={() => setOpen(false)} style={{
            width: 32, height: 32, background: "rgba(255,255,255,0.1)", border: "none",
            borderRadius: 6, cursor: "pointer", color: "white",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 內容 */}
      {!mini && (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          {/* 訊息區 */}
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {msgs.map(m => (
              <div key={m.id} style={{
                display: "flex", gap: 8, marginBottom: 16,
                flexDirection: m.role === "user" ? "row-reverse" : "row"
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  background: m.role === "user" ? "#6366f1" : m.isAI ? "linear-gradient(135deg, #10b981, #059669)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  {m.role === "user" ? <User size={16} color="white" /> : 
                   m.isAI ? <Wand2 size={16} color="white" /> : <Sparkles size={16} color="white" />}
                </div>
                <div style={{
                  maxWidth: "80%", padding: "10px 14px", borderRadius: 16,
                  fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap",
                  background: m.role === "user" ? "#6366f1" : "#1e293b",
                  color: m.role === "user" ? "white" : "#e2e8f0",
                  borderTopRightRadius: m.role === "user" ? 4 : 16,
                  borderTopLeftRadius: m.role === "user" ? 16 : 4,
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <Sparkles size={16} color="white" />
                </div>
                <div style={{ background: "#1e293b", borderRadius: 16, padding: "12px 14px" }}>
                  <Loader2 size={16} color="#94a3b8" className="animate-spin" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* 快速按鈕 */}
          {!loading && (
            <div style={{ padding: "0 16px 8px" }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>快速詢問：</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {QUICK_BTNS.map((b, i) => (
                  <button key={i} onClick={() => sendLocal(b.msg)} style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "6px 10px", borderRadius: 16,
                    background: "#1e293b", border: "1px solid #334155",
                    color: "#cbd5e1", fontSize: 12, cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#334155"; e.currentTarget.style.borderColor = "#6366f1"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#1e293b"; e.currentTarget.style.borderColor = "#334155"; }}
                  >
                    <b.icon size={14} />
                    {b.label}
                  </button>
                ))}
              </div>
              
              {/* AI 智能回答按鈕（開發中） */}
              {lastUserMsg && (
                <button 
                  onClick={() => sendAI()} 
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "8px 12px", borderRadius: 16, marginTop: 8,
                    background: "linear-gradient(135deg, #6b7280, #4b5563)", 
                    border: "none",
                    color: "white", fontSize: 12, cursor: "pointer",
                    width: "100%", justifyContent: "center",
                    opacity: 0.8
                  }}
                >
                  <Wand2 size={14} />
                  AI 智能回答（開發中）
                </button>
              )}
            </div>
          )}

          {/* 輸入區 */}
          <div style={{ padding: 12, borderTop: "1px solid #334155", background: "#0f172a" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) sendLocal(input); }}
                placeholder="輸入您的問題..."
                disabled={loading}
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: 12,
                  background: "#1e293b", border: "1px solid #334155", outline: "none",
                  color: "#e2e8f0", fontSize: 14
                }}
              />
              <button
                onClick={() => sendLocal(input)}
                disabled={!input.trim() || loading}
                style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: input.trim() && !loading ? "#6366f1" : "#334155", 
                  border: "none",
                  cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.2s"
                }}
              >
                <Send size={16} color="white" />
              </button>
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 6, textAlign: "center" }}>
              按 Enter 發送 · 輸入關鍵字快速查詢
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
