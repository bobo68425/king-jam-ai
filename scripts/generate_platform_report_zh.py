#!/usr/bin/env python3
"""
King Jam AI 平台全盤解析報告生成器（繁體中文版）
生成 PDF 格式的技術與商業分析報告
"""

import os
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, 
    PageBreak, ListFlowable, ListItem, Image, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# 嘗試載入中文字體
FONT_NAME = "Helvetica"
FONT_NAME_BOLD = "Helvetica-Bold"

# 嘗試載入系統中文字體
try:
    font_paths = [
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/PingFang.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    ]
    for path in font_paths:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont('ChineseFont', path, subfontIndex=0))
                FONT_NAME = "ChineseFont"
                FONT_NAME_BOLD = "ChineseFont"
                print(f"✓ 已載入中文字體: {path}")
                break
            except Exception as e:
                continue
except Exception as e:
    print(f"無法載入中文字體，使用預設字體: {e}")


def create_styles():
    """創建自定義樣式"""
    styles = getSampleStyleSheet()
    
    # 標題樣式
    styles.add(ParagraphStyle(
        'CustomTitle',
        parent=styles['Title'],
        fontName=FONT_NAME_BOLD,
        fontSize=26,
        spaceAfter=30,
        textColor=colors.HexColor('#1e3a5f'),
        alignment=TA_CENTER,
    ))
    
    # 副標題
    styles.add(ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontName=FONT_NAME,
        fontSize=14,
        spaceAfter=20,
        textColor=colors.HexColor('#64748b'),
        alignment=TA_CENTER,
    ))
    
    # 章節標題
    styles.add(ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading1'],
        fontName=FONT_NAME_BOLD,
        fontSize=16,
        spaceBefore=20,
        spaceAfter=12,
        textColor=colors.HexColor('#1e40af'),
    ))
    
    # 子章節標題
    styles.add(ParagraphStyle(
        'SubSectionHeading',
        parent=styles['Heading2'],
        fontName=FONT_NAME_BOLD,
        fontSize=13,
        spaceBefore=12,
        spaceAfter=8,
        textColor=colors.HexColor('#1e3a8a'),
    ))
    
    # 內文樣式
    styles.add(ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontName=FONT_NAME,
        fontSize=10,
        leading=16,
        spaceAfter=8,
        alignment=TA_JUSTIFY,
    ))
    
    # 項目符號樣式
    styles.add(ParagraphStyle(
        'BulletItem',
        parent=styles['Normal'],
        fontName=FONT_NAME,
        fontSize=10,
        leading=14,
        leftIndent=15,
        spaceAfter=4,
    ))
    
    # 代碼樣式
    styles.add(ParagraphStyle(
        'CodeBlock',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=9,
        leading=12,
        backColor=colors.HexColor('#f1f5f9'),
        borderColor=colors.HexColor('#e2e8f0'),
        borderWidth=1,
        borderPadding=8,
    ))
    
    # 強調文字
    styles.add(ParagraphStyle(
        'Emphasis',
        parent=styles['Normal'],
        fontName=FONT_NAME_BOLD,
        fontSize=10,
        textColor=colors.HexColor('#dc2626'),
    ))
    
    # 小標註
    styles.add(ParagraphStyle(
        'Note',
        parent=styles['Normal'],
        fontName=FONT_NAME,
        fontSize=9,
        textColor=colors.HexColor('#6b7280'),
        leftIndent=10,
    ))
    
    return styles


def create_table(data, col_widths=None, header=True):
    """創建格式化表格"""
    if col_widths is None:
        col_widths = [2*inch] * len(data[0])
    
    table = Table(data, colWidths=col_widths)
    
    style_commands = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3b82f6')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), FONT_NAME_BOLD),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
        ('FONTNAME', (0, 1), (-1, -1), FONT_NAME),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
    ]
    
    # 斑馬紋
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_commands.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#f1f5f9')))
    
    table.setStyle(TableStyle(style_commands))
    return table


def build_report():
    """構建報告內容"""
    styles = create_styles()
    story = []
    
    # ============================================================
    # 封面
    # ============================================================
    story.append(Spacer(1, 1.5*inch))
    story.append(Paragraph("King Jam AI", styles['CustomTitle']))
    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph("平台全盤解析報告", styles['CustomTitle']))
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph("技術架構 · 商業模式 · 安全機制", styles['CustomSubtitle']))
    story.append(Spacer(1, 1*inch))
    
    # 報告資訊表
    info_data = [
        ['報告資訊', ''],
        ['版本', '2.0.0'],
        ['報告日期', datetime.now().strftime('%Y年%m月%d日')],
        ['編製單位', 'King Jam AI 開發團隊'],
        ['文件分類', '內部技術文件'],
    ]
    info_table = create_table(info_data, col_widths=[2.5*inch, 3*inch])
    story.append(info_table)
    
    story.append(PageBreak())
    
    # ============================================================
    # 目錄
    # ============================================================
    story.append(Paragraph("目錄", styles['SectionHeading']))
    story.append(Spacer(1, 0.2*inch))
    
    toc_items = [
        "1. 執行摘要",
        "2. 系統架構",
        "3. AI 生成引擎",
        "4. 點數金融系統",
        "5. 推薦夥伴制度",
        "6. 排程上架系統",
        "7. 安全與詐騙偵測",
        "8. 監控與告警機制",
        "9. 資料生命週期管理",
        "10. 前端介面分析",
        "11. 商業模式",
        "12. 技術規格",
    ]
    
    for item in toc_items:
        story.append(Paragraph(f"  {item}", styles['BulletItem']))
    
    story.append(PageBreak())
    
    # ============================================================
    # 1. 執行摘要
    # ============================================================
    story.append(Paragraph("1. 執行摘要", styles['SectionHeading']))
    
    story.append(Paragraph("1.1 平台概述", styles['SubSectionHeading']))
    story.append(Paragraph(
        "King Jam AI 是一個整合型 AI 內容生成與社群管理平台。平台提供完整的解決方案，讓企業和內容創作者能夠一鍵生成高品質的部落格文章、社群圖文和短影片。系統整合了多種先進 AI 模型，包括 Google Gemini、Vertex AI（Veo/Imagen）和 Kling AI。",
        styles['CustomBody']
    ))
    
    story.append(Paragraph("1.2 關鍵數據", styles['SubSectionHeading']))
    stats_data = [
        ['項目', '數量', '說明'],
        ['後端 API 端點', '130+', 'RESTful APIs'],
        ['資料庫表', '25+', 'PostgreSQL'],
        ['前端頁面', '15', 'Next.js 14'],
        ['背景任務佇列', '3', 'Celery Workers'],
        ['整合 AI 模型', '6+', 'Gemini, Veo, Imagen, Kling'],
        ['支援社群平台', '8', 'Instagram, TikTok, Facebook 等'],
    ]
    story.append(create_table(stats_data, col_widths=[1.8*inch, 1.2*inch, 2.5*inch]))
    
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("1.3 核心價值主張", styles['SubSectionHeading']))
    
    values = [
        "• AI 驅動內容生成 - 一鍵創建部落格文章、社群圖文、短影片",
        "• 跨平台智慧排程 - 自動化跨平台內容發布",
        "• 點數經濟系統 - 完善的點數消費、儲值、提領機制",
        "• 夥伴推薦制度 - 多層級分潤的夥伴計畫",
        "• 企業級安全性 - 手機認證、身份認證、雙重認證、詐騙偵測",
    ]
    for v in values:
        story.append(Paragraph(v, styles['BulletItem']))
    
    story.append(PageBreak())
    
    # ============================================================
    # 2. 系統架構
    # ============================================================
    story.append(Paragraph("2. 系統架構", styles['SectionHeading']))
    
    story.append(Paragraph("2.1 整體架構", styles['SubSectionHeading']))
    story.append(Paragraph(
        "平台採用微服務啟發式架構，前後端分離。前端使用 Next.js 14 建構，透過 RESTful API 與 FastAPI 後端通訊。背景任務由 Celery Workers 處理，Redis 作為訊息佇列和快取。",
        styles['CustomBody']
    ))
    
    arch_data = [
        ['層級', '技術', '用途'],
        ['前端', 'Next.js 14, React 18, TypeScript', '使用者介面'],
        ['API 閘道', 'FastAPI, Uvicorn', 'REST API 服務'],
        ['資料庫', 'PostgreSQL 15', '主要資料儲存'],
        ['快取/佇列', 'Redis 7', '快取與訊息佇列'],
        ['背景任務', 'Celery 5.3', '非同步任務處理'],
        ['排程器', 'Celery Beat', '定期任務排程'],
        ['容器', 'Docker, Docker Compose', '容器編排'],
    ]
    story.append(create_table(arch_data, col_widths=[1.3*inch, 2.5*inch, 1.7*inch]))
    
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("2.2 Celery 佇列架構", styles['SubSectionHeading']))
    story.append(Paragraph(
        "系統採用三個獨立的 Celery 佇列，確保資源合理分配與隔離：",
        styles['CustomBody']
    ))
    
    queue_data = [
        ['佇列名稱', '並發數', '處理任務'],
        ['queue_high', '2 workers', '驗證碼發送、即時通知'],
        ['queue_default', '4 workers', '社群發布、排程任務'],
        ['queue_video', '1 worker', '影片渲染（隔離防 OOM）'],
    ]
    story.append(create_table(queue_data, col_widths=[1.5*inch, 1.3*inch, 2.7*inch]))
    
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("2.3 Docker 服務配置", styles['SubSectionHeading']))
    
    docker_data = [
        ['服務', '容器名稱', '端口', '記憶體限制'],
        ['後端 API', 'kingjam_backend', '8000', '預設'],
        ['PostgreSQL', 'kingjam_db', '5432', '預設'],
        ['Redis', 'kingjam_redis', '6379', '預設'],
        ['Celery Worker (高)', 'kingjam_celery_high', '-', '預設'],
        ['Celery Worker (預設)', 'kingjam_celery_default', '-', '預設'],
        ['Celery Worker (影片)', 'kingjam_celery_video', '-', '4GB'],
        ['Celery Beat', 'kingjam_celery_beat', '-', '預設'],
        ['Flower 監控', 'kingjam_flower', '5555', '預設'],
    ]
    story.append(create_table(docker_data, col_widths=[1.6*inch, 1.8*inch, 0.7*inch, 1.2*inch]))
    
    story.append(PageBreak())
    
    # ============================================================
    # 3. AI 生成引擎
    # ============================================================
    story.append(Paragraph("3. AI 生成引擎", styles['SectionHeading']))
    
    story.append(Paragraph("3.1 部落格文章生成器", styles['SubSectionHeading']))
    story.append(Paragraph(
        "部落格生成器使用 Google Gemini 模型創建 SEO 優化文章。支援多種寫作風格和語調配置，並可自動使用 Imagen 生成封面圖片。",
        styles['CustomBody']
    ))
    
    blog_features = [
        "• 多種 AI 模型：Gemini 2.5 Flash、Gemini 2.5 Pro、Gemini Pro Latest",
        "• 14 種語調風格：專業正式、輕鬆隨性、親切友善、幽默風趣、教育科普等",
        "• 自動 SEO 優化：標題、描述、關鍵字",
        "• 封面圖片生成：無圖、標準品質、精緻品質",
    ]
    for f in blog_features:
        story.append(Paragraph(f, styles['BulletItem']))
    
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph("3.2 社群圖文生成器", styles['SubSectionHeading']))
    story.append(Paragraph(
        "創建平台優化的社群媒體貼文，包含 AI 生成的文案和圖片。支援多種比例和品質等級。",
        styles['CustomBody']
    ))
    
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph("3.3 短影片生成器（Director Engine）", styles['SubSectionHeading']))
    story.append(Paragraph(
        "Director Engine 是一個精密的兩階段影片生成系統：",
        styles['CustomBody']
    ))
    
    video_data = [
        ['階段', '功能', 'AI 模型'],
        ['腳本生成', '將主題轉換為結構化場景', 'Google Gemini'],
        ['影片渲染', '生成實際影片內容', 'Veo 3 / Kling AI / Imagen+FFmpeg'],
    ]
    story.append(create_table(video_data, col_widths=[1.5*inch, 2.3*inch, 1.7*inch]))
    
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph("3.4 影片模型比較", styles['SubSectionHeading']))
    
    model_data = [
        ['模型', '時長', '解析度', '點數', '適用場景'],
        ['Kling v2.1', '5秒', '720p', '30', '經濟實惠'],
        ['Kling v2.1', '10秒', '720p', '55', '較長經濟內容'],
        ['Kling v2.1 Pro', '5秒', '1080p', '50', '較高品質'],
        ['Kling v2.1 Pro', '10秒', '1080p', '90', '最佳性價比（推薦）'],
        ['Veo 3 Fast', '8秒', 'HD', '200', '頂級品質'],
        ['Veo 3 Pro', '8秒', 'HD', '350', '最高品質'],
        ['Imagen + FFmpeg', '任意', '自訂', '50-120', '基礎合成'],
    ]
    story.append(create_table(model_data, col_widths=[1.2*inch, 0.7*inch, 0.8*inch, 0.7*inch, 1.8*inch]))
    
    story.append(PageBreak())
    
    # ============================================================
    # 4. 點數金融系統
    # ============================================================
    story.append(Paragraph("4. 點數金融系統", styles['SectionHeading']))
    
    story.append(Paragraph("4.1 點數類別", styles['SubSectionHeading']))
    story.append(Paragraph(
        "平台實作精密的點數帳本系統，分為四種類別，各有其特性和消耗順序：",
        styles['CustomBody']
    ))
    
    credit_data = [
        ['類別', '代碼', '來源', '有效期', '可退款'],
        ['活動點數', 'PROMO', '新手任務、行銷活動', '7-30天', '否'],
        ['月費點數', 'SUB', '訂閱方案每月發放', '當月有效', '否'],
        ['購買點數', 'PAID', '直接購買', '永久', '是'],
        ['獎金點數', 'BONUS', '推薦分潤', '永久', '可提領'],
    ]
    story.append(create_table(credit_data, col_widths=[1.1*inch, 0.8*inch, 1.5*inch, 1*inch, 0.9*inch]))
    
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph(
        "消耗順序：PROMO → SUB → PAID → BONUS",
        styles['Emphasis']
    ))
    story.append(Paragraph(
        "此順序確保活動點數優先使用（避免過期），而 BONUS 點數（等同現金）最後消耗，讓用戶決定是累積提領還是用於生成。",
        styles['CustomBody']
    ))
    
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph("4.2 交易原子性保護", styles['SubSectionHeading']))
    story.append(Paragraph(
        "點數系統實作資料庫層級保護，確保帳務一致性：",
        styles['CustomBody']
    ))
    
    atomicity_features = [
        "• SELECT FOR UPDATE：行級鎖定防止競爭條件",
        "• 單一 DB Transaction：餘額更新與交易記錄同時提交",
        "• PostgreSQL CHECK 約束：強制 credits = 各類別點數總和",
        "• 定期一致性檢查：每小時背景驗證任務",
    ]
    for f in atomicity_features:
        story.append(Paragraph(f, styles['BulletItem']))
    
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph("4.3 提領系統", styles['SubSectionHeading']))
    
    withdrawal_data = [
        ['參數', '設定值'],
        ['匯率', '10 點 = NT$ 1'],
        ['最低提領', '3,000 點（NT$ 300）'],
        ['單次上限', '100,000 點'],
        ['每月上限', '300,000 點'],
        ['必要認證', '手機 + 身份 + 雙重認證'],
    ]
    story.append(create_table(withdrawal_data, col_widths=[2.5*inch, 3*inch]))
    
    story.append(PageBreak())
    
    # ============================================================
    # 5. 推薦夥伴制度
    # ============================================================
    story.append(Paragraph("5. 推薦夥伴制度", styles['SectionHeading']))
    
    story.append(Paragraph("5.1 夥伴等級", styles['SubSectionHeading']))
    
    partner_data = [
        ['等級', '升級條件', '分潤比例', '推薦獎金'],
        ['銅牌', '預設', '10%', '200 活動點數'],
        ['銀牌', '10人 + NT$5,000', '15%', '300 活動點數 + 月獎金'],
        ['金牌', '30人 + NT$20,000', '20%', '500 活動點數 + 月獎金'],
    ]
    story.append(create_table(partner_data, col_widths=[0.9*inch, 1.6*inch, 1*inch, 2*inch]))
    
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph("5.2 推薦獎金對照表", styles['SubSectionHeading']))
    
    bonus_data = [
        ['訂閱方案', '方案價格', '銅牌獎金', '銀牌獎金', '金牌獎金'],
        ['入門版', 'NT$ 299', '300 點', '450 點', '600 點'],
        ['專業版', 'NT$ 699', '700 點', '1,050 點', '1,400 點'],
        ['企業版', 'NT$ 3,699', '3,700 點', '5,550 點', '7,400 點'],
    ]
    story.append(create_table(bonus_data, col_widths=[1.1*inch, 1.1*inch, 1.1*inch, 1.1*inch, 1.1*inch]))
    
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph("5.3 推薦流程", styles['SubSectionHeading']))
    
    flow_items = [
        "• 1. 用戶 A 生成專屬推薦碼",
        "• 2. 用戶 B 使用推薦碼註冊",
        "• 3. 用戶 A 立即獲得 200 活動點數",
        "• 4. 用戶 B 訂閱付費方案",
        "• 5. 系統依用戶 A 夥伴等級計算分潤",
        "• 6. 24 小時內發放 BONUS 點數給用戶 A",
        "• 7. 用戶 A 可將 BONUS 點數提領現金（10:1 匯率）",
    ]
    for item in flow_items:
        story.append(Paragraph(item, styles['BulletItem']))
    
    story.append(PageBreak())
    
    # ============================================================
    # 6. 排程上架系統
    # ============================================================
    story.append(Paragraph("6. 排程上架系統", styles['SectionHeading']))
    
    story.append(Paragraph("6.1 支援平台", styles['SubSectionHeading']))
    
    platform_data = [
        ['平台', '內容類型', 'OAuth 狀態', '自動發布'],
        ['Instagram', '圖片、輪播、Reels', 'Meta Business API', '是'],
        ['Facebook', '圖片、影片、連結', 'Meta Business API', '是'],
        ['TikTok', '影片', 'TikTok for Business', '是'],
        ['LinkedIn', '圖片、影片、文章', 'LinkedIn API', '是'],
        ['YouTube', '影片、Shorts', 'Google OAuth', '是'],
        ['LINE', '訊息、圖片', 'LINE Messaging API', '是'],
        ['WordPress', '文章、頁面', 'REST API', '是'],
        ['Threads', '文字、圖片', 'Meta API', '規劃中'],
    ]
    story.append(create_table(platform_data, col_widths=[1.1*inch, 1.4*inch, 1.5*inch, 1*inch]))
    
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph("6.2 排程功能特點", styles['SubSectionHeading']))
    
    schedule_features = [
        "• 跨平台統一排程介面",
        "• 智慧發布時間建議（基於受眾分析）",
        "• 批量排程管理",
        "• OAuth Token 自動刷新（24小時週期）",
        "• 失敗自動重試（最多 3 次，指數退避）",
        "• 即時發布狀態追蹤與詳細日誌",
    ]
    for f in schedule_features:
        story.append(Paragraph(f, styles['BulletItem']))
    
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph("6.3 發布狀態流程", styles['SubSectionHeading']))
    story.append(Paragraph(
        "pending → queued → publishing → published / failed",
        styles['CodeBlock']
    ))
    
    story.append(PageBreak())
    
    # ============================================================
    # 7. 安全與詐騙偵測
    # ============================================================
    story.append(Paragraph("7. 安全與詐騙偵測", styles['SectionHeading']))
    
    story.append(Paragraph("7.1 認證系統", styles['SubSectionHeading']))
    
    auth_data = [
        ['機制', '實作方式', '用途'],
        ['JWT Token', 'HS256, 24小時有效', 'API 認證'],
        ['密碼雜湊', 'bcrypt (cost=12)', '憑證保護'],
        ['手機認證', 'SMS OTP (6碼)', '帳號驗證'],
        ['身份認證', '身分證 + AI 驗證', 'KYC 合規'],
        ['雙重認證', 'TOTP (RFC 6238)', '提領安全'],
    ]
    story.append(create_table(auth_data, col_widths=[1.3*inch, 1.8*inch, 2.2*inch]))
    
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph("7.2 詐騙偵測系統", styles['SubSectionHeading']))
    story.append(Paragraph(
        "平台實作全面的詐騙偵測機制，防止推薦獎金濫用：",
        styles['CustomBody']
    ))
    
    fraud_features = [
        "• IP 地址追蹤：偵測同 IP 多帳號",
        "• 裝置指紋識別：跨帳號識別相同裝置",
        "• 風險評分：自動評估（低/中/高/封鎖）",
        "• 可疑推薦偵測：識別自我推薦模式",
        "• 自動獎金封鎖：暫停標記帳號的獎勵",
        "• 管理員告警：高風險活動即時通知",
    ]
    for f in fraud_features:
        story.append(Paragraph(f, styles['BulletItem']))
    
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph("7.3 裝置指紋收集項目", styles['SubSectionHeading']))
    
    fingerprint_data = [
        ['資料點', '用途'],
        ['螢幕解析度', '裝置識別'],
        ['時區', '地理位置推測'],
        ['瀏覽器語言', '用戶輪廓'],
        ['Canvas 指紋', '唯一裝置簽名'],
        ['WebGL 渲染器', 'GPU 識別'],
        ['安裝字型', '系統指紋'],
        ['音訊上下文', '硬體簽名'],
    ]
    story.append(create_table(fingerprint_data, col_widths=[1.8*inch, 3.5*inch]))
    
    story.append(PageBreak())
    
    # ============================================================
    # 8. 監控與告警
    # ============================================================
    story.append(Paragraph("8. 監控與告警機制", styles['SectionHeading']))
    
    story.append(Paragraph("8.1 健康檢查系統", styles['SubSectionHeading']))
    
    health_data = [
        ['檢查類型', '頻率', '閾值', '告警級別'],
        ['快速 Ping', '1 分鐘', '無', '資訊'],
        ['Worker 心跳', '2 分鐘', '60秒逾時', '警告'],
        ['完整健康檢查', '5 分鐘', '多項', '嚴重'],
        ['記憶體使用', '5 分鐘', '80%/90%', '警告/嚴重'],
        ['磁碟使用', '5 分鐘', '80%/90%', '警告/嚴重'],
        ['佇列長度', '5 分鐘', '100/500', '警告/嚴重'],
    ]
    story.append(create_table(health_data, col_widths=[1.4*inch, 1*inch, 1.2*inch, 1.4*inch]))
    
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph("8.2 告警通道", styles['SubSectionHeading']))
    
    alert_channels = [
        "• Slack Webhook：即時團隊通知",
        "• Email (SendGrid)：詳細事件報告",
        "• LINE Notify：嚴重問題行動通知",
        "• 控制台日誌：始終開啟的除錯輸出",
    ]
    for c in alert_channels:
        story.append(Paragraph(c, styles['BulletItem']))
    
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph("8.3 告警抑制", styles['SubSectionHeading']))
    story.append(Paragraph(
        "為防止告警風暴，系統實作冷卻期：警告告警 5 分鐘內不重複，嚴重告警 1 分鐘內不重複。",
        styles['CustomBody']
    ))
    
    story.append(PageBreak())
    
    # ============================================================
    # 9. 資料生命週期管理
    # ============================================================
    story.append(Paragraph("9. 資料生命週期管理", styles['SectionHeading']))
    
    story.append(Paragraph("9.1 媒體保留政策", styles['SubSectionHeading']))
    
    retention_data = [
        ['媒體類型', '保留期限', '儲存位置'],
        ['短影片', '7 天', '本地 + Cloudflare R2'],
        ['社群圖片', '14 天', '本地 + Cloudflare R2'],
        ['部落格圖片', '14 天', '本地 + Cloudflare R2'],
        ['排程媒體', '30 天', '本地 + Cloudflare R2'],
        ['縮圖', '同原檔案', '本地'],
    ]
    story.append(create_table(retention_data, col_widths=[1.5*inch, 1.3*inch, 2.5*inch]))
    
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph("9.2 清理任務", styles['SubSectionHeading']))
    
    cleanup_data = [
        ['任務', '排程', '佇列'],
        ['過期媒體清理', '每日凌晨 4 點', 'queue_default'],
        ['暫存檔清理', '每 6 小時', 'queue_default'],
        ['點數一致性檢查', '每小時', 'queue_default'],
        ['Token 刷新', '每小時', 'queue_default'],
    ]
    story.append(create_table(cleanup_data, col_widths=[1.8*inch, 1.8*inch, 1.8*inch]))
    
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph("9.3 OOM 預防措施", styles['SubSectionHeading']))
    
    oom_measures = [
        "• Docker 記憶體限制：影片 Worker 限制 4GB",
        "• Worker 隔離：影片渲染專用 Worker",
        "• 任務限制：max-tasks-per-child=10, prefetch-multiplier=1",
        "• 速率限制：全局每分鐘最多 10 個影片任務",
        "• 記憶體監控：任務執行前 psutil 檢查",
        "• 自動垃圾回收：任務失敗時執行",
    ]
    for m in oom_measures:
        story.append(Paragraph(m, styles['BulletItem']))
    
    story.append(PageBreak())
    
    # ============================================================
    # 10. 前端介面分析
    # ============================================================
    story.append(Paragraph("10. 前端介面分析", styles['SectionHeading']))
    
    story.append(Paragraph("10.1 技術棧", styles['SubSectionHeading']))
    
    frontend_data = [
        ['技術', '版本', '用途'],
        ['Next.js', '14.x', 'React 框架 (App Router)'],
        ['React', '18.x', 'UI 函式庫'],
        ['TypeScript', '5.x', '型別安全'],
        ['Tailwind CSS', '3.4', '原子化樣式'],
        ['shadcn/ui', '最新', '元件庫'],
        ['Lucide React', '最新', '圖標庫'],
        ['Sonner', '最新', 'Toast 通知'],
        ['Axios', '1.6', 'HTTP 客戶端'],
    ]
    story.append(create_table(frontend_data, col_widths=[1.4*inch, 0.9*inch, 3*inch]))
    
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph("10.2 頁面結構", styles['SubSectionHeading']))
    
    pages_data = [
        ['路由', '頁面名稱', '功能'],
        ['/login', '登入頁', '用戶認證'],
        ['/dashboard', '儀表板', '主要概覽'],
        ['/dashboard/blog', '部落格生成器', 'AI 文章創作'],
        ['/dashboard/social', '社群生成器', '社群內容創作'],
        ['/dashboard/video', '影片生成器', '短影片創作'],
        ['/dashboard/scheduler', '排程管理', '內容排程'],
        ['/dashboard/credits', '點數錢包', '點數管理'],
        ['/dashboard/referral', '推薦中心', '夥伴計畫'],
        ['/dashboard/profile', '會員資料', '個人檔案'],
        ['/dashboard/history', '生成紀錄', '歷史記錄'],
        ['/dashboard/settings', '設定', '帳號設定'],
    ]
    story.append(create_table(pages_data, col_widths=[1.8*inch, 1.3*inch, 2.2*inch]))
    
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph("10.3 設計系統", styles['SubSectionHeading']))
    
    design_features = [
        "• 深色主題：Slate 色系 (slate-800/900)",
        "• 漸層強調：Pink-Rose、Cyan-Blue 漸層",
        "• 響應式布局：移動優先設計，側邊導航",
        "• Toast 通知：Sonner 深色自定義樣式",
        "• 載入狀態：骨架載入器和旋轉器",
        "• 微互動：懸停效果、過渡動畫",
    ]
    for f in design_features:
        story.append(Paragraph(f, styles['BulletItem']))
    
    story.append(PageBreak())
    
    # ============================================================
    # 11. 商業模式
    # ============================================================
    story.append(Paragraph("11. 商業模式", styles['SectionHeading']))
    
    story.append(Paragraph("11.1 訂閱方案", styles['SubSectionHeading']))
    
    plan_data = [
        ['方案', '月費', '每月點數', '主要功能'],
        ['免費版', 'NT$ 0', '200（一次性）', '基本功能'],
        ['入門版', 'NT$ 299', '500', '標準功能'],
        ['專業版', 'NT$ 699', '1,500', '進階功能 + 優先處理'],
        ['企業版', 'NT$ 3,699', '10,000', '完整功能 + 專屬客服'],
    ]
    story.append(create_table(plan_data, col_widths=[1.1*inch, 1*inch, 1.2*inch, 2.2*inch]))
    
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph("11.2 點數包", styles['SubSectionHeading']))
    
    package_data = [
        ['方案', '點數', '價格', '單點價格'],
        ['入門包', '500', 'NT$ 150', 'NT$ 0.30'],
        ['標準包', '1,000', 'NT$ 250', 'NT$ 0.25'],
        ['進階包', '3,000', 'NT$ 600', 'NT$ 0.20'],
        ['企業包', '10,000', 'NT$ 1,500', 'NT$ 0.15'],
    ]
    story.append(create_table(package_data, col_widths=[1.3*inch, 1.2*inch, 1.3*inch, 1.5*inch]))
    
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph("11.3 收入來源", styles['SubSectionHeading']))
    
    revenue_items = [
        "• 訂閱收入：付費方案的月經常性收入",
        "• 點數銷售：額外點數的一次性購買",
        "• 企業合約：大型組織的客製定價",
        "• API 存取：（未來）B2B API 授權",
    ]
    for r in revenue_items:
        story.append(Paragraph(r, styles['BulletItem']))
    
    story.append(PageBreak())
    
    # ============================================================
    # 12. 技術規格
    # ============================================================
    story.append(Paragraph("12. 技術規格", styles['SectionHeading']))
    
    story.append(Paragraph("12.1 後端依賴套件", styles['SubSectionHeading']))
    
    backend_deps = [
        ['套件', '版本', '用途'],
        ['fastapi', '0.100+', 'Web 框架'],
        ['sqlalchemy', '2.0+', 'ORM'],
        ['celery', '5.3+', '任務佇列'],
        ['redis', '5.0+', 'Redis 客戶端'],
        ['google-generativeai', '最新', 'Gemini API'],
        ['google-genai', '最新', 'Vertex AI'],
        ['replicate', '最新', 'Kling AI'],
        ['pillow', '10.0+', '圖片處理'],
        ['pydantic', '2.0+', '資料驗證'],
        ['pyotp', '2.9+', '雙重認證'],
        ['psutil', '5.9+', '系統監控'],
    ]
    story.append(create_table(backend_deps, col_widths=[1.8*inch, 1*inch, 2.5*inch]))
    
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph("12.2 API 端點統計", styles['SubSectionHeading']))
    
    api_summary = [
        ['模組', '端點前綴', '數量'],
        ['認證', '/auth', '10+'],
        ['用戶', '/users', '10+'],
        ['部落格', '/blog', '8+'],
        ['社群', '/social', '6+'],
        ['影片', '/video', '12+'],
        ['排程', '/scheduler', '15+'],
        ['點數', '/credits', '12+'],
        ['推薦', '/referral', '8+'],
        ['驗證', '/verification', '10+'],
        ['通知', '/notifications', '6+'],
        ['管理', '/admin', '15+'],
    ]
    story.append(create_table(api_summary, col_widths=[1.3*inch, 1.8*inch, 1.3*inch]))
    
    story.append(Spacer(1, 0.5*inch))
    story.append(HRFlowable(width="100%", color=colors.HexColor('#e2e8f0')))
    story.append(Spacer(1, 0.3*inch))
    
    # 結尾
    story.append(Paragraph(
        f"報告生成時間：{datetime.now().strftime('%Y年%m月%d日 %H:%M:%S')}",
        styles['CustomSubtitle']
    ))
    story.append(Paragraph(
        "King Jam AI 開發團隊",
        styles['CustomSubtitle']
    ))
    
    return story


def main():
    """主函數"""
    output_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'docs',
        f'King_Jam_AI_平台解析報告_{datetime.now().strftime("%Y%m%d")}.pdf'
    )
    
    # 確保 docs 目錄存在
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # 創建 PDF
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=0.7*inch,
        leftMargin=0.7*inch,
        topMargin=0.7*inch,
        bottomMargin=0.7*inch,
    )
    
    story = build_report()
    doc.build(story)
    
    print(f"✅ 報告已生成：{output_path}")
    return output_path


if __name__ == "__main__":
    main()
