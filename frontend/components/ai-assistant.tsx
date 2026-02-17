"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
  ChevronDown,
  Search,
  ArrowLeft,
  RefreshCw,
  CheckCheck,
} from "lucide-react";

// ============================================================
// 泡泡狀態管理（使用 localStorage 持久化）
// ============================================================
type BubbleMode = "full" | "minimized" | "hidden";

const STORAGE_KEY_ASSISTANT = "kingjam_assistant_mode";
const STORAGE_KEY_LINE = "kingjam_line_mode";

function getBubbleMode(key: string, fallback: BubbleMode = "full"): BubbleMode {
  if (typeof window === "undefined") return fallback;
  const stored = localStorage.getItem(key);
  if (stored === "full" || stored === "minimized" || stored === "hidden") return stored;
  return fallback;
}

function setBubbleMode(key: string, mode: BubbleMode) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, mode);
  window.dispatchEvent(new CustomEvent("bubble-mode-change", { detail: { key, mode } }));
}

// ============================================================
// 知識庫
// ============================================================
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isAI?: boolean;
}

const KNOWLEDGE_BASE: Record<string, { keywords: string[]; response: string }> = {
  greeting: {
    keywords: ["嗨", "哈囉", "你好", "hi", "hello", "hey", "安安"],
    response: `嗨！我是 King Jam AI 智能助手 🤖\n\n很高興為您服務！我可以幫助您：\n• 了解平台功能與使用方式\n• 解答點數與方案問題\n• 提供內容創作建議\n• 排解使用問題\n\n請問有什麼可以幫您的？`
  },
  newUser: {
    keywords: ["新用戶", "新手", "開始", "入門", "如何使用", "怎麼用", "教學", "第一次"],
    response: `歡迎使用 King Jam AI！🎉\n\n**快速入門 5 步驟：**\n\n1️⃣ **註冊/登入** - 使用 Email 或 Google 帳號\n2️⃣ **領取免費點數** - 新用戶註冊即獲得 100 點試用\n3️⃣ **選擇創作類型** - 文章生成、社群圖文、短影片\n4️⃣ **輸入主題** - 告訴 AI 你想創作的內容\n5️⃣ **一鍵生成** - AI 將為你產出專業內容\n\n有任何問題歡迎隨時詢問！`
  },
  video: {
    keywords: ["影片", "視頻", "video", "短影音", "短片", "vlog", "reels"],
    response: `AI 短影片生成 📹\n\n**使用步驟：**\n1. 進入「短影片生成」功能\n2. 輸入影片主題或腳本\n3. 選擇風格和時長（15秒/30秒/60秒）\n4. AI 自動生成影片\n\n**強大功能：**\n• 🎙️ 自動配音（多種語音可選）\n• 🎨 AI 生成精美畫面\n• 📝 字幕自動生成\n• 🎵 背景音樂自動配樂\n\n⏱️ 生成時間：約 2-5 分鐘\n💰 消耗點數：100-300 點/支`
  },
  article: {
    keywords: ["文章", "部落格", "blog", "寫作", "文案", "copywriting", "seo"],
    response: `AI 文章生成 ✍️\n\n**使用步驟：**\n1. 選擇「文章生成」功能\n2. 輸入文章主題或關鍵字\n3. 選擇文章類型和風格\n4. 點擊生成\n\n**支援類型：**\n• 📰 部落格文章\n• 🛍️ 產品介紹\n• 📢 新聞稿\n• 🔍 SEO 優化文章\n• 📱 社群貼文\n\n💰 消耗點數：10-30 點/篇`
  },
  image: {
    keywords: ["圖片", "圖文", "設計", "海報", "貼圖", "ig", "instagram", "社群圖"],
    response: `社群圖文設計 🎨\n\n**使用步驟：**\n1. 選擇「設計工作室」\n2. 輸入主題或上傳素材\n3. 選擇平台尺寸（IG/FB/LINE）\n4. AI 生成設計\n\n**功能特色：**\n• 📐 多種尺寸模板\n• 🖼️ AI 智能排版\n• ✨ 一鍵去背功能\n• 🎨 風格濾鏡\n\n💰 消耗點數：20-50 點/張`
  },
  credits: {
    keywords: ["點數", "價格", "方案", "費用", "購買", "多少錢", "價目", "收費"],
    response: `點數方案說明 💰\n\n**點數用途：**\n• 文章生成：10-30 點/篇\n• 圖文設計：20-50 點/張\n• 短影片：100-300 點/支\n\n**購買方案：**\n💚 輕量包 100 點 NT$99\n💙 標準包 500 點 NT$399\n💜 專業包 1500 點 NT$999\n🧡 企業包 5000 點 NT$2999\n\n🎁 新用戶優惠：註冊即贈 100 點！\n⏰ 點數期限：永久有效`
  },
  schedule: {
    keywords: ["排程", "發布", "定時", "schedule", "自動發布", "預約"],
    response: `排程發布功能 📅\n\n**支援平台：**\n• 📘 Facebook 粉絲專頁\n• 📷 Instagram 商業帳號\n• 💬 LINE 官方帳號\n• 🌐 WordPress 網站\n\n**使用步驟：**\n1. 先在「社群帳號管理」綁定帳號\n2. 創作完成後選擇「排程發布」\n3. 設定發布時間\n4. 系統會自動在指定時間發布`
  },
  contact: {
    keywords: ["聯繫", "客服", "問題", "幫助", "聯絡", "email", "信箱"],
    response: `客服聯繫方式 📧\n\n**Email**：service@kingjam.app\n**客服時間**：週一至週五 09:00-18:00\n**回覆時間**：24 小時內\n\n您也可以直接在這裡詢問，我會盡力協助！`
  },
  thanks: {
    keywords: ["謝謝", "感謝", "thanks", "thank", "3q", "thx"],
    response: `不客氣！很高興能幫到您 😊\n\n如果還有其他問題，隨時歡迎詢問！\n\n祝您創作順利 ✨`
  },
  bye: {
    keywords: ["bye", "掰", "再見", "拜拜", "goodbye"],
    response: `再見！感謝您使用 King Jam AI 👋\n\n期待再次為您服務！有任何問題歡迎隨時回來詢問 😊`
  }
};

function getLocalResponse(message: string): string {
  const m = message.toLowerCase();
  for (const [, data] of Object.entries(KNOWLEDGE_BASE)) {
    if (data.keywords.some(kw => m.includes(kw))) {
      return data.response;
    }
  }
  return `我是 King Jam AI 智能助手 🤖\n\n我可以幫您解答：\n• 平台功能使用方式\n• 點數與方案說明\n• 內容創作技巧\n• 帳號相關問題\n\n請問您想了解什麼呢？\n\n💡 試試輸入：影片、文章、點數、排程`;
}

const QUICK_BTNS = [
  { icon: HelpCircle, label: "如何開始？", msg: "我是新用戶，如何開始使用？" },
  { icon: Video, label: "影片生成", msg: "如何生成短影片？" },
  { icon: FileText, label: "文章創作", msg: "如何生成文章？" },
  { icon: CreditCard, label: "點數方案", msg: "點數如何計算？有哪些方案？" },
];

// ============================================================
// LINE 泡泡 SVG Icon
// ============================================================
function LineIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  );
}

// ============================================================
// 時間格式化工具
// ============================================================
function formatTime(dateStr: string) {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "剛剛";
    if (diffMins < 60) return `${diffMins}分`;
    if (diffHours < 24) return `${diffHours}時`;
    if (diffDays < 7) return `${diffDays}天`;
    return date.toLocaleDateString("zh-TW");
  } catch { return ""; }
}

function formatMsgTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

// ============================================================
// LINE 對話介面型別
// ============================================================
interface LineConversation {
  line_user_id: string;
  display_name: string;
  avatar_url: string | null;
  last_message: string;
  last_message_direction: string;
  last_message_at: string;
  unread_count: number;
}

interface LineMsg {
  id: number;
  direction: string;
  message_type: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

// ============================================================
// 主元件：整合小幫手 + LINE 泡泡
// ============================================================
export function AIAssistant() {
  // 小幫手狀態
  const [assistantMode, setAssistantMode] = useState<BubbleMode>("full");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [mini, setMini] = useState(false);
  const [msgs, setMsgs] = useState<Message[]>([
    { id: "w", role: "assistant", content: "嗨！我是 King Jam AI 智能助手 🤖\n\n有什麼可以幫您的？\n\n您可以直接輸入問題，或點擊下方快速選項！" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastUserMsg, setLastUserMsg] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // LINE 泡泡狀態
  const [lineMode, setLineMode] = useState<BubbleMode>("full");
  // LINE 對話
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lineOpen, setLineOpen] = useState(false);
  const [lineMini, setLineMini] = useState(false);
  const [conversations, setConversations] = useState<LineConversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [lineMessages, setLineMessages] = useState<LineMsg[]>([]);
  const [lineUserInfo, setLineUserInfo] = useState<{ display_name: string; avatar_url: string | null }>({ display_name: "", avatar_url: null });
  const [lineInput, setLineInput] = useState("");
  const [lineSending, setLineSending] = useState(false);
  const [lineSearch, setLineSearch] = useState("");
  const [lineLoadingMsgs, setLineLoadingMsgs] = useState(false);
  const lineEndRef = useRef<HTMLDivElement>(null);
  const lineInputRef = useRef<HTMLTextAreaElement>(null);

  // 初始化 - 從 localStorage 讀取 + 檢查管理員
  useEffect(() => {
    setAssistantMode(getBubbleMode(STORAGE_KEY_ASSISTANT, "full"));
    setLineMode(getBubbleMode(STORAGE_KEY_LINE, "full"));

    // 監聽來自幫助中心的設定變更
    const handler = (e: Event) => {
      const { key, mode } = (e as CustomEvent).detail;
      if (key === STORAGE_KEY_ASSISTANT) setAssistantMode(mode);
      if (key === STORAGE_KEY_LINE) setLineMode(mode);
    };
    window.addEventListener("bubble-mode-change", handler);

    // 檢查登入 + 管理員身份
    const checkAdmin = async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        if (!token) { setIsLoggedIn(false); setIsAdmin(false); return; }
        setIsLoggedIn(true);
        const API = process.env.NEXT_PUBLIC_API_URL || "https://api.kingjam.app";
        const res = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setIsLoggedIn(true);
          setIsAdmin(data.is_admin === true);
        } else {
          setIsLoggedIn(false);
          setIsAdmin(false);
        }
      } catch { setIsLoggedIn(false); setIsAdmin(false); }
    };
    checkAdmin();

    return () => window.removeEventListener("bubble-mode-change", handler);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  useEffect(() => {
    lineEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lineMessages]);

  // 更新模式
  const updateAssistantMode = useCallback((mode: BubbleMode) => {
    setAssistantMode(mode);
    setBubbleMode(STORAGE_KEY_ASSISTANT, mode);
    if (mode === "hidden" || mode === "minimized") {
      setAssistantOpen(false);
    }
  }, []);

  const updateLineMode = useCallback((mode: BubbleMode) => {
    setLineMode(mode);
    setBubbleMode(STORAGE_KEY_LINE, mode);
  }, []);

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

  // AI API（開發中）
  const sendAI = () => {
    if (loading) return;
    setLoading(true);
    window.setTimeout(() => {
      setMsgs(p => [...p, {
        id: `a${Date.now()}`,
        role: "assistant",
        content: `🚧 **AI 智能回答功能開發中**\n\n此功能即將上線！敬請期待 ✨\n\n目前您可以：\n• 使用快速問答按鈕\n• 直接輸入關鍵字查詢\n• 聯繫客服 service@kingjam.app`,
        isAI: true
      }]);
      setLoading(false);
    }, 500);
  };

  // ========== LINE 對話 API ==========
  const apiCall = useCallback(async (path: string, opts?: RequestInit) => {
    const token = localStorage.getItem("token");
    const API = process.env.NEXT_PUBLIC_API_URL || "https://api.kingjam.app";
    return fetch(`${API}${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts?.headers || {}) },
    });
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await apiCall("/api/line-chat/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch { /* ignore */ }
  }, [apiCall]);

  const fetchMessages = useCallback(async (userId: string) => {
    setLineLoadingMsgs(true);
    try {
      const res = await apiCall(`/api/line-chat/conversations/${userId}/messages?page_size=100`);
      if (res.ok) {
        const data = await res.json();
        setLineMessages(data.messages || []);
        setLineUserInfo(data.user_info || { display_name: userId, avatar_url: null });
      }
      // 標記已讀
      await apiCall(`/api/line-chat/conversations/${userId}/read`, { method: "POST" });
      setConversations(prev => prev.map(c =>
        c.line_user_id === userId ? { ...c, unread_count: 0 } : c
      ));
    } catch { /* ignore */ }
    setLineLoadingMsgs(false);
  }, [apiCall]);

  // LINE 自動刷新
  useEffect(() => {
    if (isAdmin && lineOpen) {
      fetchConversations();
      const interval = setInterval(fetchConversations, 10000);
      return () => clearInterval(interval);
    }
  }, [isAdmin, lineOpen, fetchConversations]);

  useEffect(() => {
    if (selectedUser && lineOpen) {
      fetchMessages(selectedUser);
      const interval = setInterval(() => fetchMessages(selectedUser), 5000);
      return () => clearInterval(interval);
    }
  }, [selectedUser, lineOpen, fetchMessages]);

  // 發送LINE回覆
  const handleLineSend = async () => {
    if (!lineInput.trim() || !selectedUser || lineSending) return;
    setLineSending(true);
    try {
      const res = await apiCall(`/api/line-chat/conversations/${selectedUser}/send`, {
        method: "POST",
        body: JSON.stringify({ message: lineInput.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setLineMessages(prev => [...prev, data.message]);
          setLineInput("");
          lineInputRef.current?.focus();
          setConversations(prev => prev.map(c =>
            c.line_user_id === selectedUser
              ? { ...c, last_message: lineInput.trim(), last_message_direction: "outgoing", last_message_at: new Date().toISOString() }
              : c
          ));
        }
      }
    } catch { /* ignore */ }
    setLineSending(false);
  };

  // 過濾對話
  const filteredConvs = conversations.filter(c =>
    c.display_name.toLowerCase().includes(lineSearch.toLowerCase()) ||
    c.line_user_id.toLowerCase().includes(lineSearch.toLowerCase())
  );

  const totalUnread = conversations.reduce((acc, c) => acc + c.unread_count, 0);

  // 計算泡泡堆疊位置
  const lineBottom = 24;
  const assistantBottom = lineMode === "full" ? 24 + 56 + 12 : lineMode === "minimized" ? 24 + 28 + 12 : 24;

  return (
    <>
      {/* ========================================== */}
      {/* LINE 泡泡 */}
      {/* ========================================== */}
      {lineMode === "full" && !lineOpen && (
        <div style={{ position: "fixed", bottom: lineBottom, right: 24, zIndex: 9998 }}>
          {/* 關閉/最小化按鈕 */}
          <div style={{
            position: "absolute", top: -8, right: -4, display: "flex", gap: 2, zIndex: 1
          }}>
            <button
              onClick={() => updateLineMode("minimized")}
              title="最小化"
              style={{
                width: 18, height: 18, borderRadius: "50%",
                background: "#475569", border: "1px solid #64748b",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", padding: 0
              }}
            >
              <Minimize2 size={10} color="white" />
            </button>
            <button
              onClick={() => updateLineMode("hidden")}
              title="關閉"
              style={{
                width: 18, height: 18, borderRadius: "50%",
                background: "#475569", border: "1px solid #64748b",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", padding: 0
              }}
            >
              <X size={10} color="white" />
            </button>
          </div>
          {/* 所有用戶：打開對話框 */}
          <button
            onClick={() => { setLineOpen(true); }}
            style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "#06C755", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(6,199,85,0.4)",
              transition: "transform 0.2s", position: "relative",
              color: "white",
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          >
            <LineIcon size={28} />
            {isAdmin && totalUnread > 0 && (
              <span style={{
                position: "absolute", top: -4, right: -4,
                minWidth: 20, height: 20, borderRadius: 10,
                background: "#ef4444", color: "white",
                fontSize: 11, fontWeight: 700, display: "flex",
                alignItems: "center", justifyContent: "center",
                padding: "0 5px", border: "2px solid #0f172a",
              }}>
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            )}
          </button>
          {/* Tooltip */}
          <div style={{
            position: "absolute", right: 64, bottom: 8,
            background: "#06C755", padding: "6px 10px", borderRadius: 8,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)", whiteSpace: "nowrap",
            fontSize: 13, color: "white", fontWeight: 500
          }}>
            LINE 客服
          </div>
        </div>
      )}

      {lineMode === "minimized" && !lineOpen && (
        <button
          onClick={() => { updateLineMode("full"); setLineOpen(true); }}
          style={{
            position: "fixed", bottom: lineBottom, right: 24, zIndex: 9998,
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 12px 5px 8px", borderRadius: 14,
            background: "#06C755", border: "none", cursor: "pointer",
            color: "white", fontSize: 12, fontWeight: 500,
            boxShadow: "0 2px 8px rgba(6,199,85,0.3)",
            transition: "transform 0.2s"
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >
          <LineIcon size={16} />
          LINE
          {totalUnread > 0 && (
            <span style={{
              minWidth: 16, height: 16, borderRadius: 8,
              background: "#ef4444", color: "white",
              fontSize: 10, fontWeight: 700, display: "flex",
              alignItems: "center", justifyContent: "center",
              padding: "0 4px", marginLeft: 2,
            }}>
              {totalUnread > 9 ? "9+" : totalUnread}
            </span>
          )}
        </button>
      )}

      {/* ========================================== */}
      {/* LINE 對話框（管理員限定） */}
      {/* ========================================== */}
      {lineOpen && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 10000,
          width: 420, maxWidth: "calc(100vw - 48px)",
          height: lineMini ? "auto" : 580,
          background: "#0f172a", borderRadius: 16,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          border: "1px solid #1e4620",
          display: "flex", flexDirection: "column",
          overflow: "hidden"
        }}>
          {/* 標題列 */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px",
            background: "linear-gradient(135deg, #06C755, #05a648)",
            color: "white"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {selectedUser && !lineMini ? (
                <button onClick={() => { setSelectedUser(null); setLineMessages([]); }} style={{
                  width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.15)",
                  border: "none", cursor: "pointer", color: "white",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <ArrowLeft size={16} />
                </button>
              ) : (
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "rgba(255,255,255,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <LineIcon size={22} />
                </div>
              )}
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>
                  {selectedUser && !lineMini ? lineUserInfo.display_name : "LINE 客服對話"}
                </div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>
                  {selectedUser && !lineMini
                    ? "LINE 用戶"
                    : isAdmin
                      ? `${conversations.length} 個對話${totalUnread > 0 ? ` · ${totalUnread} 則未讀` : ""}`
                      : "客服中心"
                  }
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {!selectedUser && (
                <button onClick={fetchConversations} style={{
                  width: 32, height: 32, background: "rgba(255,255,255,0.1)", border: "none",
                  borderRadius: 6, cursor: "pointer", color: "white",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <RefreshCw size={14} />
                </button>
              )}
              <button onClick={() => setLineMini(!lineMini)} style={{
                width: 32, height: 32, background: "rgba(255,255,255,0.1)", border: "none",
                borderRadius: 6, cursor: "pointer", color: "white",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {lineMini ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
              </button>
              <button onClick={() => { updateLineMode("minimized"); setLineOpen(false); }} style={{
                width: 32, height: 32, background: "rgba(255,255,255,0.1)", border: "none",
                borderRadius: 6, cursor: "pointer", color: "white",
                display: "flex", alignItems: "center", justifyContent: "center"
              }} title="最小化到標籤">
                <ChevronDown size={16} />
              </button>
              <button onClick={() => setLineOpen(false)} style={{
                width: 32, height: 32, background: "rgba(255,255,255,0.1)", border: "none",
                borderRadius: 6, cursor: "pointer", color: "white",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <X size={16} />
              </button>
            </div>
          </div>

          {/* 內容 */}
          {!lineMini && (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
              {!isAdmin ? (
                /* ====== 非管理員：登入提示 / 訪客對話 ====== */
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: "50%",
                    background: "linear-gradient(135deg, #06C755, #05a648)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <LineIcon size={36} />
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#e2e8f0", marginBottom: 6 }}>
                      LINE 客服中心
                    </div>
                    <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                      {isLoggedIn
                        ? "此功能僅限管理員使用。\n如需客服協助，請透過 LINE 聯繫我們。"
                        : "登入後即可使用 LINE 客服功能，\n或以訪客身份透過 LINE 聯繫我們。"
                      }
                    </div>
                  </div>
                  {!isLoggedIn && (
                    <button
                      onClick={() => { window.location.href = "/login"; }}
                      style={{
                        width: "100%", maxWidth: 240, padding: "12px 20px",
                        borderRadius: 12,
                        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                        border: "none", cursor: "pointer",
                        color: "white", fontSize: 14, fontWeight: 600,
                        transition: "transform 0.2s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"}
                      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                    >
                      登入帳號
                    </button>
                  )}
                  <a
                    href="https://line.me/ti/p/@975ukpvt"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      width: "100%", maxWidth: 240, padding: "12px 20px",
                      borderRadius: 12, textAlign: "center",
                      background: "#06C755",
                      border: "none", cursor: "pointer",
                      color: "white", fontSize: 14, fontWeight: 600,
                      textDecoration: "none",
                      display: "block",
                      transition: "transform 0.2s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"}
                    onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                  >
                    {isLoggedIn ? "透過 LINE 聯繫客服" : "訪客 LINE 對話"}
                  </a>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, textAlign: "center" }}>
                    客服時間：週一至週五 09:00-18:00
                  </div>
                </div>
              ) : selectedUser ? (
                /* ====== 訊息視圖 ====== */
                <>
                  <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                    {lineLoadingMsgs ? (
                      <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                        <Loader2 size={20} color="#94a3b8" className="animate-spin" />
                      </div>
                    ) : lineMessages.length === 0 ? (
                      <div style={{ textAlign: "center", color: "#64748b", padding: 32 }}>
                        <MessageCircle size={32} style={{ opacity: 0.3, margin: "0 auto 8px" }} />
                        <div style={{ fontSize: 13 }}>尚無訊息</div>
                      </div>
                    ) : (
                      lineMessages.map((m) => (
                        <div key={m.id} style={{
                          display: "flex",
                          justifyContent: m.direction === "outgoing" ? "flex-end" : "flex-start",
                          marginBottom: 10,
                        }}>
                          <div style={{
                            maxWidth: "80%",
                            padding: "10px 14px",
                            borderRadius: 16,
                            fontSize: 13,
                            lineHeight: 1.6,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            background: m.direction === "outgoing"
                              ? "linear-gradient(135deg, #06C755, #05a648)"
                              : "#1e293b",
                            color: "white",
                            borderBottomRightRadius: m.direction === "outgoing" ? 4 : 16,
                            borderBottomLeftRadius: m.direction === "outgoing" ? 16 : 4,
                          }}>
                            {m.content}
                            <div style={{
                              display: "flex", alignItems: "center", gap: 3,
                              justifyContent: m.direction === "outgoing" ? "flex-end" : "flex-start",
                              marginTop: 4,
                            }}>
                              <span style={{ fontSize: 10, opacity: 0.6 }}>
                                {m.created_at ? formatMsgTime(m.created_at) : ""}
                              </span>
                              {m.direction === "outgoing" && (
                                <CheckCheck size={12} style={{ opacity: 0.6 }} />
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={lineEndRef} />
                  </div>
                  {/* 輸入框 */}
                  <div style={{ padding: 12, borderTop: "1px solid #334155", background: "#0f172a" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <textarea
                        ref={lineInputRef}
                        value={lineInput}
                        onChange={e => setLineInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleLineSend(); } }}
                        placeholder="輸入訊息..."
                        rows={1}
                        style={{
                          flex: 1, padding: "10px 14px", borderRadius: 12,
                          background: "#1e293b", border: "1px solid #334155", outline: "none",
                          color: "#e2e8f0", fontSize: 13, resize: "none",
                          minHeight: 40, maxHeight: 80, fontFamily: "inherit",
                        }}
                      />
                      <button
                        onClick={handleLineSend}
                        disabled={!lineInput.trim() || lineSending}
                        style={{
                          width: 40, height: 40, borderRadius: 10,
                          background: lineInput.trim() && !lineSending ? "#06C755" : "#334155",
                          border: "none",
                          cursor: lineInput.trim() && !lineSending ? "pointer" : "not-allowed",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "background 0.2s", flexShrink: 0,
                        }}
                      >
                        {lineSending ? <Loader2 size={16} color="white" className="animate-spin" /> : <Send size={16} color="white" />}
                      </button>
                    </div>
                    <div style={{ fontSize: 10, color: "#64748b", marginTop: 4, textAlign: "center" }}>
                      Enter 發送 · Shift+Enter 換行
                    </div>
                  </div>
                </>
              ) : (
                /* ====== 對話列表視圖 ====== */
                <>
                  {/* 搜尋 */}
                  <div style={{ padding: "8px 12px", borderBottom: "1px solid #1e293b" }}>
                    <div style={{ position: "relative" }}>
                      <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                      <input
                        value={lineSearch}
                        onChange={e => setLineSearch(e.target.value)}
                        placeholder="搜尋對話..."
                        style={{
                          width: "100%", padding: "8px 12px 8px 32px", borderRadius: 10,
                          background: "#1e293b", border: "1px solid #334155", outline: "none",
                          color: "#e2e8f0", fontSize: 13,
                        }}
                      />
                    </div>
                  </div>
                  {/* 對話列表 */}
                  <div style={{ flex: 1, overflowY: "auto" }}>
                    {filteredConvs.length === 0 ? (
                      <div style={{ textAlign: "center", color: "#64748b", padding: 40 }}>
                        <MessageCircle size={32} style={{ opacity: 0.3, margin: "0 auto 8px" }} />
                        <div style={{ fontSize: 13 }}>尚無對話</div>
                        <div style={{ fontSize: 11, marginTop: 4 }}>等待 LINE 用戶傳訊</div>
                      </div>
                    ) : (
                      filteredConvs.map(conv => (
                        <button
                          key={conv.line_user_id}
                          onClick={() => setSelectedUser(conv.line_user_id)}
                          style={{
                            width: "100%", display: "flex", alignItems: "center", gap: 10,
                            padding: "10px 14px", textAlign: "left",
                            background: "transparent", border: "none", borderBottom: "1px solid #1e293b",
                            cursor: "pointer", color: "#e2e8f0",
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = "#1e293b"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                          {/* 頭像 */}
                          <div style={{ position: "relative", flexShrink: 0 }}>
                            <div style={{
                              width: 40, height: 40, borderRadius: "50%",
                              background: conv.avatar_url ? `url(${conv.avatar_url}) center/cover` : "linear-gradient(135deg, #06C755, #05a648)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              color: "white", fontWeight: 600, fontSize: 16,
                            }}>
                              {!conv.avatar_url && conv.display_name.charAt(0)}
                            </div>
                            {conv.unread_count > 0 && (
                              <span style={{
                                position: "absolute", top: -3, right: -3,
                                minWidth: 18, height: 18, borderRadius: 9,
                                background: "#ef4444", color: "white",
                                fontSize: 10, fontWeight: 700,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                padding: "0 4px", border: "2px solid #0f172a",
                              }}>
                                {conv.unread_count > 9 ? "9+" : conv.unread_count}
                              </span>
                            )}
                          </div>
                          {/* 對話資訊 */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{
                                fontSize: 13,
                                fontWeight: conv.unread_count > 0 ? 600 : 400,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }}>
                                {conv.display_name}
                              </span>
                              <span style={{ fontSize: 10, color: "#64748b", flexShrink: 0, marginLeft: 8 }}>
                                {conv.last_message_at ? formatTime(conv.last_message_at) : ""}
                              </span>
                            </div>
                            <div style={{
                              fontSize: 12, color: conv.unread_count > 0 ? "#cbd5e1" : "#64748b",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              marginTop: 2,
                            }}>
                              {conv.last_message_direction === "outgoing" && (
                                <span style={{ color: "#64748b", marginRight: 4 }}>你：</span>
                              )}
                              {conv.last_message || "..."}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* 小幫手泡泡 */}
      {/* ========================================== */}
      {assistantMode === "minimized" && !assistantOpen && (
        <button
          onClick={() => { setAssistantMode("full"); setBubbleMode(STORAGE_KEY_ASSISTANT, "full"); setAssistantOpen(false); }}
          style={{
            position: "fixed", bottom: assistantBottom, right: 24, zIndex: 9999,
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 12px 5px 8px", borderRadius: 14,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            border: "none", cursor: "pointer",
            color: "white", fontSize: 12, fontWeight: 500,
            boxShadow: "0 2px 8px rgba(99,102,241,0.3)",
            transition: "transform 0.2s"
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >
          <MessageCircle size={16} />
          助手
        </button>
      )}

      {assistantMode === "full" && !assistantOpen && (
        <div style={{ position: "fixed", bottom: assistantBottom, right: 24, zIndex: 9999 }}>
          {/* 關閉/最小化按鈕 */}
          <div style={{
            position: "absolute", top: -8, right: -4, display: "flex", gap: 2, zIndex: 1
          }}>
            <button
              onClick={() => updateAssistantMode("minimized")}
              title="最小化"
              style={{
                width: 18, height: 18, borderRadius: "50%",
                background: "#475569", border: "1px solid #64748b",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", padding: 0
              }}
            >
              <Minimize2 size={10} color="white" />
            </button>
            <button
              onClick={() => updateAssistantMode("hidden")}
              title="關閉"
              style={{
                width: 18, height: 18, borderRadius: "50%",
                background: "#475569", border: "1px solid #64748b",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", padding: 0
              }}
            >
              <X size={10} color="white" />
            </button>
          </div>
          <button
            onClick={() => setAssistantOpen(true)}
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
      )}

      {/* 打開的對話框 */}
      {assistantOpen && (
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
          {/* 標題列 */}
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
              <button onClick={() => { updateAssistantMode("minimized"); setAssistantOpen(false); }} style={{
                width: 32, height: 32, background: "rgba(255,255,255,0.1)", border: "none",
                borderRadius: 6, cursor: "pointer", color: "white",
                display: "flex", alignItems: "center", justifyContent: "center"
              }} title="最小化到標籤">
                <ChevronDown size={16} />
              </button>
              <button onClick={() => setAssistantOpen(false)} style={{
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
                  {lastUserMsg && (
                    <button
                      onClick={() => sendAI()}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "8px 12px", borderRadius: 16, marginTop: 8,
                        background: "linear-gradient(135deg, #6b7280, #4b5563)",
                        border: "none", color: "white", fontSize: 12, cursor: "pointer",
                        width: "100%", justifyContent: "center", opacity: 0.8
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
      )}
    </>
  );
}

// ============================================================
// 導出設定工具函式（供幫助中心使用）
// ============================================================
export function getAssistantMode(): BubbleMode { return getBubbleMode(STORAGE_KEY_ASSISTANT, "full"); }
export function getLineMode(): BubbleMode { return getBubbleMode(STORAGE_KEY_LINE, "full"); }
export function setAssistantModeGlobal(mode: BubbleMode) { setBubbleMode(STORAGE_KEY_ASSISTANT, mode); }
export function setLineModeGlobal(mode: BubbleMode) { setBubbleMode(STORAGE_KEY_LINE, mode); }
export type { BubbleMode };
