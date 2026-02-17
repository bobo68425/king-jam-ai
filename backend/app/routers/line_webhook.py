"""
LINE Messaging API Webhook
接收 LINE 訊息並自動回覆，同時儲存對話記錄
"""

from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional
import os
import hashlib
import hmac
import base64
import json
import httpx

from app.database import get_db
from app.models import LineMessage

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


async def get_user_profile(user_id: str) -> dict:
    """使用 LINE API 取得用戶資訊"""
    if not LINE_CHANNEL_ACCESS_TOKEN:
        return {}
    try:
        url = f"https://api.line.me/v2/bot/profile/{user_id}"
        headers = {"Authorization": f"Bearer {LINE_CHANNEL_ACCESS_TOKEN}"}
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "display_name": data.get("displayName"),
                    "avatar_url": data.get("pictureUrl"),
                }
    except Exception as e:
        print(f"[LINE] Failed to get profile: {e}")
    return {}


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
    同時將訊息儲存到資料庫
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
    
    # 取得 DB session（手動，因為 webhook 不使用 Depends）
    from app.database import SessionLocal
    db = SessionLocal()
    
    try:
        for event in events:
            event_type = event.get("type")
            reply_token = event.get("replyToken")
            source = event.get("source", {})
            user_id = source.get("userId", "")
            
            if event_type == "message" and reply_token:
                message = event.get("message", {})
                msg_type = message.get("type")
                msg_id = message.get("id")
                
                # 取得用戶資料
                profile = await get_user_profile(user_id)
                display_name = profile.get("display_name")
                avatar_url = profile.get("avatar_url")
                
                if msg_type == "text":
                    user_text = message.get("text", "")
                    print(f"[LINE] Received from {display_name or user_id}: {user_text}")
                    
                    # 儲存收到的訊息
                    incoming_msg = LineMessage(
                        line_user_id=user_id,
                        display_name=display_name,
                        avatar_url=avatar_url,
                        direction="incoming",
                        message_type="text",
                        content=user_text,
                        line_message_id=msg_id,
                        is_read=False,
                    )
                    db.add(incoming_msg)
                    
                    # 嘗試自動回覆
                    auto_reply = get_auto_reply(user_text)
                    reply_text = auto_reply if auto_reply else DEFAULT_REPLY
                    
                    await reply_message(reply_token, [
                        {"type": "text", "text": reply_text}
                    ])
                    
                    # 儲存自動回覆的訊息
                    outgoing_msg = LineMessage(
                        line_user_id=user_id,
                        display_name=display_name,
                        avatar_url=avatar_url,
                        direction="outgoing",
                        message_type="text",
                        content=reply_text,
                        is_read=True,
                    )
                    db.add(outgoing_msg)
                else:
                    # 非文字訊息
                    content_desc = f"[{msg_type}]"
                    if msg_type == "image":
                        content_desc = "[圖片]"
                    elif msg_type == "sticker":
                        content_desc = "[貼圖]"
                    elif msg_type == "video":
                        content_desc = "[影片]"
                    elif msg_type == "audio":
                        content_desc = "[語音]"
                    elif msg_type == "location":
                        content_desc = "[位置]"
                    
                    # 儲存非文字訊息
                    incoming_msg = LineMessage(
                        line_user_id=user_id,
                        display_name=display_name,
                        avatar_url=avatar_url,
                        direction="incoming",
                        message_type=msg_type,
                        content=content_desc,
                        line_message_id=msg_id,
                        is_read=False,
                    )
                    db.add(incoming_msg)
                    
                    reply_text = "感謝您的訊息！目前我只能處理文字訊息 😊\n\n請輸入文字查詢，或前往 https://kingjam.app 了解更多。"
                    await reply_message(reply_token, [
                        {"type": "text", "text": reply_text}
                    ])
                    
                    # 儲存自動回覆
                    outgoing_msg = LineMessage(
                        line_user_id=user_id,
                        display_name=display_name,
                        avatar_url=avatar_url,
                        direction="outgoing",
                        message_type="text",
                        content=reply_text,
                        is_read=True,
                    )
                    db.add(outgoing_msg)
            
            elif event_type == "follow":
                # 用戶追蹤（加好友）
                profile = await get_user_profile(user_id)
                display_name = profile.get("display_name")
                avatar_url = profile.get("avatar_url")
                
                welcome_text = "歡迎加入 King Jam AI！🎉\n\n我是 AI 智能助手，可以幫您：\n✨ 了解平台功能\n💰 查詢點數方案\n📧 聯繫客服\n\n輸入「功能」或「價格」開始查詢！\n\n前往平台：https://kingjam.app"
                
                if reply_token:
                    await reply_message(reply_token, [
                        {"type": "text", "text": welcome_text}
                    ])
                
                # 儲存歡迎訊息
                outgoing_msg = LineMessage(
                    line_user_id=user_id,
                    display_name=display_name,
                    avatar_url=avatar_url,
                    direction="outgoing",
                    message_type="text",
                    content=welcome_text,
                    is_read=True,
                )
                db.add(outgoing_msg)
                print(f"[LINE] New follower: {display_name or user_id}")
            
            elif event_type == "unfollow":
                print(f"[LINE] User unfollowed: {user_id}")
        
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[LINE] Webhook error: {e}")
        raise
    finally:
        db.close()
    
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
