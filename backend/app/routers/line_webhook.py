"""
LINE Messaging API Webhook
接收 LINE 訊息並自動回覆
"""

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import os
import hashlib
import hmac
import base64
import json
import httpx

router = APIRouter(prefix="/api/line", tags=["line"])

# 環境變數
LINE_CHANNEL_ID = os.getenv("LINE_CHANNEL_ID", "")
LINE_CHANNEL_SECRET = os.getenv("LINE_CHANNEL_SECRET", "")
LINE_CHANNEL_ACCESS_TOKEN = os.getenv("LINE_CHANNEL_ACCESS_TOKEN", "")


def verify_signature(body: bytes, signature: str) -> bool:
    """驗證 LINE webhook 簽名"""
    if not LINE_CHANNEL_SECRET:
        return False
    hash_value = hmac.new(
        LINE_CHANNEL_SECRET.encode("utf-8"),
        body,
        hashlib.sha256
    ).digest()
    expected = base64.b64encode(hash_value).decode("utf-8")
    return hmac.compare_digest(signature, expected)


async def reply_message(reply_token: str, messages: list):
    """使用 LINE Messaging API 回覆訊息"""
    if not LINE_CHANNEL_ACCESS_TOKEN:
        print("[LINE] 未設定 Channel Access Token，無法回覆")
        return
    
    url = "https://api.line.me/v2/bot/message/reply"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {LINE_CHANNEL_ACCESS_TOKEN}"
    }
    payload = {
        "replyToken": reply_token,
        "messages": messages
    }
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code != 200:
            print(f"[LINE] Reply failed: {resp.status_code} {resp.text}")
        else:
            print(f"[LINE] Reply sent successfully")


# 自動回覆知識庫（簡化版）
AUTO_REPLIES = {
    "你好": "嗨！歡迎使用 King Jam AI 🤖\n\n我們是 AI 驅動的智慧內容創作平台，提供：\n✨ AI 文章生成\n🎨 社群圖文設計\n📹 短影音製作\n\n前往 https://kingjam.app 開始體驗！",
    "功能": "King Jam AI 主要功能：\n\n📝 部落格文章生成\n🎨 社群圖文設計\n📹 短影音生成\n📅 排程發布\n🖼️ 圖片編輯室\n\n更多詳情請訪問：https://kingjam.app",
    "價格": "💰 King Jam AI 點數方案：\n\n💚 輕量包 100 點 NT$99\n💙 標準包 500 點 NT$399\n💜 專業包 1500 點 NT$999\n🧡 企業包 5000 點 NT$2999\n\n🎁 新用戶註冊即贈 100 點！\n\n前往購買：https://kingjam.app/dashboard/pricing",
    "客服": "📧 客服信箱：service@kingjam.app\n⏰ 服務時間：週一至週五 09:00-18:00\n\n您也可以直接在這裡留言，我們會盡快回覆！",
}

def get_auto_reply(text: str) -> Optional[str]:
    """根據關鍵字匹配自動回覆"""
    text_lower = text.lower().strip()
    
    # 精確匹配
    for keyword, reply in AUTO_REPLIES.items():
        if keyword in text_lower:
            return reply
    
    # 關鍵字匹配
    if any(w in text_lower for w in ["嗨", "哈囉", "hi", "hello", "安安"]):
        return AUTO_REPLIES["你好"]
    if any(w in text_lower for w in ["多少錢", "費用", "方案", "點數", "購買"]):
        return AUTO_REPLIES["價格"]
    if any(w in text_lower for w in ["聯繫", "問題", "幫助", "聯絡"]):
        return AUTO_REPLIES["客服"]
    
    # 預設回覆
    return None


DEFAULT_REPLY = """感謝您的訊息！🤖

我是 King Jam AI 助手，目前支援以下查詢：
• 輸入「功能」了解平台功能
• 輸入「價格」查看點數方案
• 輸入「客服」取得客服資訊

更多功能請前往：https://kingjam.app

如需人工客服，請寄信至 service@kingjam.app"""


@router.post("/webhook")
async def line_webhook(request: Request):
    """
    LINE Messaging API Webhook 端點
    
    接收 LINE 平台推送的事件（訊息、追蹤、取消追蹤等）
    """
    body = await request.body()
    
    # 驗證簽名（若有設定 Channel Secret）
    signature = request.headers.get("x-line-signature", "")
    if LINE_CHANNEL_SECRET and signature:
        if not verify_signature(body, signature):
            raise HTTPException(status_code=403, detail="Invalid signature")
    
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    events = data.get("events", [])
    
    for event in events:
        event_type = event.get("type")
        reply_token = event.get("replyToken")
        
        if event_type == "message" and reply_token:
            message = event.get("message", {})
            msg_type = message.get("type")
            
            if msg_type == "text":
                user_text = message.get("text", "")
                print(f"[LINE] Received message: {user_text}")
                
                # 嘗試自動回覆
                auto_reply = get_auto_reply(user_text)
                reply_text = auto_reply if auto_reply else DEFAULT_REPLY
                
                await reply_message(reply_token, [
                    {"type": "text", "text": reply_text}
                ])
            else:
                # 非文字訊息
                await reply_message(reply_token, [
                    {"type": "text", "text": "感謝您的訊息！目前我只能處理文字訊息 😊\n\n請輸入文字查詢，或前往 https://kingjam.app 了解更多。"}
                ])
        
        elif event_type == "follow":
            # 用戶追蹤（加好友）
            if reply_token:
                await reply_message(reply_token, [
                    {"type": "text", "text": "歡迎加入 King Jam AI！🎉\n\n我是 AI 智能助手，可以幫您：\n✨ 了解平台功能\n💰 查詢點數方案\n📧 聯繫客服\n\n輸入「功能」或「價格」開始查詢！\n\n前往平台：https://kingjam.app"}
                ])
            print(f"[LINE] New follower")
        
        elif event_type == "unfollow":
            print(f"[LINE] User unfollowed")
    
    return {"status": "ok"}


@router.get("/status")
async def line_status():
    """檢查 LINE 串接狀態"""
    return {
        "channel_id": LINE_CHANNEL_ID or "未設定",
        "channel_secret": "已設定" if LINE_CHANNEL_SECRET else "未設定",
        "access_token": "已設定" if LINE_CHANNEL_ACCESS_TOKEN else "未設定",
        "webhook_url": "/api/line/webhook",
        "ready": bool(LINE_CHANNEL_SECRET and LINE_CHANNEL_ACCESS_TOKEN),
    }
