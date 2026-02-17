"""
LINE 客服對話 API
管理員專用：查看 LINE 用戶訊息並回覆
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_
from pydantic import BaseModel
from typing import Optional
import os
import httpx

from app.database import get_db
from app.models import LineMessage
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/line-chat", tags=["line-chat"])

LINE_CHANNEL_ACCESS_TOKEN = os.getenv("LINE_CHANNEL_ACCESS_TOKEN", "")


class SendMessageRequest(BaseModel):
    message: str


# ─────────────────────────────────────────────
# GET /conversations — 對話列表
# ─────────────────────────────────────────────
@router.get("/conversations")
async def list_conversations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """列出所有 LINE 對話（管理員限定）"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="管理員限定")

    # 子查詢：每個用戶的最新訊息 ID
    latest_msg = (
        db.query(
            LineMessage.line_user_id,
            func.max(LineMessage.id).label("max_id"),
        )
        .group_by(LineMessage.line_user_id)
        .subquery()
    )

    # 未讀數
    unread_counts = (
        db.query(
            LineMessage.line_user_id,
            func.count(LineMessage.id).label("unread"),
        )
        .filter(
            LineMessage.direction == "incoming",
            LineMessage.is_read == False,
        )
        .group_by(LineMessage.line_user_id)
        .subquery()
    )

    # 總訊息數
    msg_counts = (
        db.query(
            LineMessage.line_user_id,
            func.count(LineMessage.id).label("total"),
        )
        .group_by(LineMessage.line_user_id)
        .subquery()
    )

    # 取得最新訊息 + 用戶資訊
    conversations_query = (
        db.query(LineMessage, unread_counts.c.unread, msg_counts.c.total)
        .join(latest_msg, and_(
            LineMessage.line_user_id == latest_msg.c.line_user_id,
            LineMessage.id == latest_msg.c.max_id,
        ))
        .outerjoin(unread_counts, LineMessage.line_user_id == unread_counts.c.line_user_id)
        .outerjoin(msg_counts, LineMessage.line_user_id == msg_counts.c.line_user_id)
        .order_by(desc(LineMessage.created_at))
    )

    total = conversations_query.count()
    conversations = conversations_query.offset((page - 1) * page_size).limit(page_size).all()

    return {
        "conversations": [
            {
                "line_user_id": msg.line_user_id,
                "display_name": msg.display_name or msg.line_user_id[:8],
                "avatar_url": msg.avatar_url,
                "last_message": msg.content,
                "last_message_type": msg.message_type,
                "last_message_direction": msg.direction,
                "last_message_at": msg.created_at.isoformat() if msg.created_at else None,
                "unread_count": unread or 0,
                "total_messages": total_cnt or 0,
            }
            for msg, unread, total_cnt in conversations
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ─────────────────────────────────────────────
# GET /conversations/{line_user_id}/messages — 歷史訊息
# ─────────────────────────────────────────────
@router.get("/conversations/{line_user_id}/messages")
async def get_messages(
    line_user_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """取得特定用戶的訊息歷史"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="管理員限定")

    total = db.query(LineMessage).filter(
        LineMessage.line_user_id == line_user_id
    ).count()

    messages = (
        db.query(LineMessage)
        .filter(LineMessage.line_user_id == line_user_id)
        .order_by(desc(LineMessage.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "messages": [
            {
                "id": m.id,
                "direction": m.direction,
                "message_type": m.message_type,
                "content": m.content,
                "is_read": m.is_read,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in reversed(messages)  # 倒序取出，正序返回
        ],
        "user_info": {
            "line_user_id": line_user_id,
            "display_name": messages[0].display_name if messages else line_user_id[:8],
            "avatar_url": messages[0].avatar_url if messages else None,
        },
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ─────────────────────────────────────────────
# POST /conversations/{line_user_id}/send — 發送訊息
# ─────────────────────────────────────────────
@router.post("/conversations/{line_user_id}/send")
async def send_message(
    line_user_id: str,
    body: SendMessageRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """發送訊息給 LINE 用戶（使用 Push API）"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="管理員限定")

    if not LINE_CHANNEL_ACCESS_TOKEN:
        raise HTTPException(status_code=500, detail="LINE Channel Access Token 未設定")

    if not body.message.strip():
        raise HTTPException(status_code=400, detail="訊息不能為空")

    # 使用 LINE Push API 發送
    url = "https://api.line.me/v2/bot/message/push"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {LINE_CHANNEL_ACCESS_TOKEN}",
    }
    payload = {
        "to": line_user_id,
        "messages": [{"type": "text", "text": body.message.strip()}],
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code != 200:
            print(f"[LINE Chat] Push failed: {resp.status_code} {resp.text}")
            raise HTTPException(status_code=502, detail=f"LINE API 回覆失敗: {resp.text}")

    # 查找此用戶的資料（從最新訊息）
    latest = (
        db.query(LineMessage)
        .filter(LineMessage.line_user_id == line_user_id)
        .order_by(desc(LineMessage.created_at))
        .first()
    )

    # 存入 DB
    msg = LineMessage(
        line_user_id=line_user_id,
        display_name=latest.display_name if latest else None,
        avatar_url=latest.avatar_url if latest else None,
        direction="outgoing",
        message_type="text",
        content=body.message.strip(),
        is_read=True,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    return {
        "success": True,
        "message": {
            "id": msg.id,
            "direction": "outgoing",
            "message_type": "text",
            "content": msg.content,
            "created_at": msg.created_at.isoformat() if msg.created_at else None,
        },
    }


# ─────────────────────────────────────────────
# POST /conversations/{line_user_id}/read — 標記已讀
# ─────────────────────────────────────────────
@router.post("/conversations/{line_user_id}/read")
async def mark_as_read(
    line_user_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """標記對話為已讀"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="管理員限定")

    updated = (
        db.query(LineMessage)
        .filter(
            LineMessage.line_user_id == line_user_id,
            LineMessage.direction == "incoming",
            LineMessage.is_read == False,
        )
        .update({"is_read": True})
    )
    db.commit()

    return {"success": True, "updated_count": updated}
