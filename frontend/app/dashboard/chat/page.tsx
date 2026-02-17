"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, Send, ArrowLeft, Search, RefreshCw, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

interface Conversation {
    line_user_id: string;
    display_name: string;
    avatar_url: string | null;
    last_message: string;
    last_message_type: string;
    last_message_direction: string;
    last_message_at: string;
    unread_count: number;
    total_messages: number;
}

interface Message {
    id: number;
    direction: string;
    message_type: string;
    content: string;
    is_read: boolean;
    created_at: string;
}

function formatTime(dateStr: string) {
    try {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 1) return "剛剛";
        if (diffMins < 60) return `${diffMins} 分鐘前`;
        if (diffHours < 24) return `${diffHours} 小時前`;
        if (diffDays < 7) return `${diffDays} 天前`;
        return date.toLocaleDateString("zh-TW");
    } catch {
        return "";
    }
}

function formatMessageTime(dateStr: string) {
    try {
        const date = new Date(dateStr);
        return date.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
    } catch {
        return "";
    }
}

export default function LineChatPage() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [userInfo, setUserInfo] = useState<{ display_name: string; avatar_url: string | null }>({ display_name: "", avatar_url: null });
    const [newMessage, setNewMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [loadingMessages, setLoadingMessages] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // 檢查管理員身份
    useEffect(() => {
        const checkAdmin = async () => {
            try {
                const res = await api.get("/auth/me");
                setIsAdmin(res.data.is_admin === true);
            } catch {
                setIsAdmin(false);
            } finally {
                setLoading(false);
            }
        };
        checkAdmin();
    }, []);

    // 載入對話列表
    const fetchConversations = useCallback(async () => {
        try {
            const res = await api.get("/api/line-chat/conversations");
            setConversations(res.data.conversations || []);
        } catch (error) {
            console.error("Failed to fetch conversations:", error);
        }
    }, []);

    useEffect(() => {
        if (isAdmin) {
            fetchConversations();
            const interval = setInterval(fetchConversations, 10000);
            return () => clearInterval(interval);
        }
    }, [isAdmin, fetchConversations]);

    // 載入訊息
    const fetchMessages = useCallback(async (lineUserId: string) => {
        setLoadingMessages(true);
        try {
            const res = await api.get(`/api/line-chat/conversations/${lineUserId}/messages?page_size=100`);
            setMessages(res.data.messages || []);
            setUserInfo(res.data.user_info || { display_name: lineUserId, avatar_url: null });
            // 標記已讀
            await api.post(`/api/line-chat/conversations/${lineUserId}/read`);
            // 更新對話列表的未讀數
            setConversations(prev => prev.map(c =>
                c.line_user_id === lineUserId ? { ...c, unread_count: 0 } : c
            ));
        } catch (error) {
            console.error("Failed to fetch messages:", error);
        } finally {
            setLoadingMessages(false);
        }
    }, []);

    useEffect(() => {
        if (selectedUser) {
            fetchMessages(selectedUser);
            const interval = setInterval(() => fetchMessages(selectedUser), 5000);
            return () => clearInterval(interval);
        }
    }, [selectedUser, fetchMessages]);

    // 自動滾動到底部
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // 發送訊息
    const handleSend = async () => {
        if (!newMessage.trim() || !selectedUser || sending) return;
        setSending(true);
        try {
            const res = await api.post(`/api/line-chat/conversations/${selectedUser}/send`, {
                message: newMessage.trim(),
            });
            if (res.data.success) {
                setMessages(prev => [...prev, res.data.message]);
                setNewMessage("");
                inputRef.current?.focus();
                // 更新對話列表最後訊息
                setConversations(prev => prev.map(c =>
                    c.line_user_id === selectedUser
                        ? { ...c, last_message: newMessage.trim(), last_message_direction: "outgoing", last_message_at: new Date().toISOString() }
                        : c
                ));
            }
        } catch (error: any) {
            console.error("Failed to send message:", error);
            alert(error.response?.data?.detail || "發送失敗");
        } finally {
            setSending(false);
        }
    };

    // 按 Enter 發送 (Shift+Enter 換行)
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // 過濾對話
    const filteredConversations = conversations.filter(c =>
        c.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.line_user_id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <MessageCircle className="w-16 h-16 text-muted-foreground/30" />
                <h2 className="text-xl font-semibold text-foreground">無權限</h2>
                <p className="text-muted-foreground">此功能僅限管理員使用</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)]">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/20">
                    <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-foreground">LINE 客服對話</h1>
                    <p className="text-xs text-muted-foreground">
                        {conversations.length} 個對話
                        {conversations.reduce((acc, c) => acc + c.unread_count, 0) > 0 && (
                            <span className="ml-2 text-rose-400">
                                • {conversations.reduce((acc, c) => acc + c.unread_count, 0)} 則未讀
                            </span>
                        )}
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="icon"
                    className="ml-auto"
                    onClick={fetchConversations}
                >
                    <RefreshCw className="w-4 h-4" />
                </Button>
            </div>

            {/* Chat Container */}
            <div className="flex flex-1 rounded-xl border border-border bg-card overflow-hidden min-h-0">
                {/* Conversation List */}
                <div className={cn(
                    "w-full md:w-80 border-r border-border flex flex-col bg-card",
                    selectedUser ? "hidden md:flex" : "flex"
                )}>
                    {/* Search */}
                    <div className="p-3 border-b border-border">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="搜尋對話..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 rounded-lg bg-muted border-0 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                    </div>

                    {/* Conversation Items */}
                    <div className="flex-1 overflow-y-auto">
                        {filteredConversations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <MessageCircle className="w-10 h-10 mb-2 opacity-30" />
                                <p className="text-sm">尚無對話</p>
                                <p className="text-xs mt-1">等待 LINE 用戶傳訊</p>
                            </div>
                        ) : (
                            filteredConversations.map((conv) => (
                                <button
                                    key={conv.line_user_id}
                                    onClick={() => setSelectedUser(conv.line_user_id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors border-b border-border/50",
                                        selectedUser === conv.line_user_id && "bg-accent"
                                    )}
                                >
                                    <div className="relative flex-shrink-0">
                                        <Avatar className="h-10 w-10">
                                            {conv.avatar_url ? (
                                                <AvatarImage src={conv.avatar_url} />
                                            ) : null}
                                            <AvatarFallback className="bg-gradient-to-br from-green-500 to-green-600 text-white text-sm font-medium">
                                                {conv.display_name.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                        {conv.unread_count > 0 && (
                                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-rose-500 text-white text-[10px] font-bold rounded-full px-1">
                                                {conv.unread_count > 9 ? "9+" : conv.unread_count}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className={cn(
                                                "text-sm truncate",
                                                conv.unread_count > 0 ? "font-semibold text-foreground" : "text-foreground"
                                            )}>
                                                {conv.display_name}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                                                {conv.last_message_at ? formatTime(conv.last_message_at) : ""}
                                            </span>
                                        </div>
                                        <p className={cn(
                                            "text-xs truncate mt-0.5",
                                            conv.unread_count > 0 ? "text-foreground" : "text-muted-foreground"
                                        )}>
                                            {conv.last_message_direction === "outgoing" && (
                                                <span className="text-muted-foreground mr-1">你：</span>
                                            )}
                                            {conv.last_message || "..."}
                                        </p>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Chat Area */}
                <div className={cn(
                    "flex-1 flex flex-col min-w-0",
                    !selectedUser ? "hidden md:flex" : "flex"
                )}>
                    {selectedUser ? (
                        <>
                            {/* Chat Header */}
                            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="md:hidden flex-shrink-0"
                                    onClick={() => setSelectedUser(null)}
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                </Button>
                                <Avatar className="h-9 w-9">
                                    {userInfo.avatar_url ? (
                                        <AvatarImage src={userInfo.avatar_url} />
                                    ) : null}
                                    <AvatarFallback className="bg-gradient-to-br from-green-500 to-green-600 text-white text-sm">
                                        {userInfo.display_name.charAt(0)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">
                                        {userInfo.display_name}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">LINE 用戶</p>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-muted/30">
                                {loadingMessages ? (
                                    <div className="flex items-center justify-center py-12">
                                        <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                        <MessageCircle className="w-8 h-8 mb-2 opacity-30" />
                                        <p className="text-sm">尚無訊息</p>
                                    </div>
                                ) : (
                                    messages.map((msg) => (
                                        <div
                                            key={msg.id}
                                            className={cn(
                                                "flex",
                                                msg.direction === "outgoing" ? "justify-end" : "justify-start"
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    "max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm",
                                                    msg.direction === "outgoing"
                                                        ? "bg-gradient-to-r from-green-500 to-green-600 text-white rounded-br-md"
                                                        : "bg-card border border-border text-foreground rounded-bl-md"
                                                )}
                                            >
                                                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                                                    {msg.content}
                                                </p>
                                                <div className={cn(
                                                    "flex items-center gap-1 mt-1",
                                                    msg.direction === "outgoing" ? "justify-end" : "justify-start"
                                                )}>
                                                    <span className={cn(
                                                        "text-[10px]",
                                                        msg.direction === "outgoing" ? "text-white/70" : "text-muted-foreground"
                                                    )}>
                                                        {msg.created_at ? formatMessageTime(msg.created_at) : ""}
                                                    </span>
                                                    {msg.direction === "outgoing" && (
                                                        <CheckCheck className="w-3 h-3 text-white/70" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input */}
                            <div className="px-4 py-3 border-t border-border bg-card">
                                <div className="flex items-end gap-2">
                                    <textarea
                                        ref={inputRef}
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="輸入訊息..."
                                        rows={1}
                                        className="flex-1 resize-none rounded-xl bg-muted border-0 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 max-h-32"
                                        style={{ minHeight: "40px" }}
                                    />
                                    <Button
                                        size="icon"
                                        onClick={handleSend}
                                        disabled={!newMessage.trim() || sending}
                                        className="flex-shrink-0 rounded-xl bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg shadow-green-500/20 h-10 w-10"
                                    >
                                        <Send className="w-4 h-4" />
                                    </Button>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
                                    Enter 發送 · Shift+Enter 換行
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500/10 to-green-600/10 flex items-center justify-center mb-4">
                                <MessageCircle className="w-10 h-10 text-green-500/50" />
                            </div>
                            <p className="text-lg font-medium text-foreground mb-1">LINE 客服對話</p>
                            <p className="text-sm text-muted-foreground">選擇左側的對話開始回覆</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
