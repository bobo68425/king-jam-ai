"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";

export default function LineChatRedirect() {
    const router = useRouter();

    useEffect(() => {
        // 3 秒後自動導向儀表板
        const t = setTimeout(() => router.push("/dashboard"), 3000);
        return () => clearTimeout(t);
    }, [router]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/10 to-green-600/10 flex items-center justify-center">
                <MessageCircle className="w-8 h-8 text-green-500/50" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">LINE 客服對話</h2>
            <p className="text-muted-foreground text-center max-w-md">
                LINE 客服對話已整合至右下角浮動視窗。<br />
                請點擊右下角的 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-sm font-medium">LINE 客服</span> 按鈕開始使用。
            </p>
            <p className="text-xs text-muted-foreground mt-2">即將自動導向儀表板...</p>
        </div>
    );
}
