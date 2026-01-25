#!/usr/bin/env python3
"""
King Jam AI 平台全盤解析報告生成器
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

try:
    # 嘗試載入系統中文字體
    font_paths = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    ]
    for path in font_paths:
        if os.path.exists(path):
            pdfmetrics.registerFont(TTFont('Chinese', path, subfontIndex=0))
            FONT_NAME = "Chinese"
            FONT_NAME_BOLD = "Chinese"
            break
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
        fontSize=28,
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
        fontSize=18,
        spaceBefore=25,
        spaceAfter=15,
        textColor=colors.HexColor('#1e40af'),
        borderColor=colors.HexColor('#3b82f6'),
        borderWidth=2,
        borderPadding=5,
    ))
    
    # 子章節標題
    styles.add(ParagraphStyle(
        'SubSectionHeading',
        parent=styles['Heading2'],
        fontName=FONT_NAME_BOLD,
        fontSize=14,
        spaceBefore=15,
        spaceAfter=10,
        textColor=colors.HexColor('#1e3a8a'),
    ))
    
    # 內文樣式
    styles.add(ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontName=FONT_NAME,
        fontSize=11,
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
        leftIndent=20,
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
        fontSize=11,
        textColor=colors.HexColor('#dc2626'),
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
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
        ('FONTNAME', (0, 1), (-1, -1), FONT_NAME),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
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
    story.append(Spacer(1, 2*inch))
    story.append(Paragraph("King Jam AI", styles['CustomTitle']))
    story.append(Paragraph("Platform Technical & Business Analysis Report", styles['CustomSubtitle']))
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph("平台全盤解析報告", styles['CustomSubtitle']))
    story.append(Spacer(1, 1*inch))
    
    # 報告資訊表
    info_data = [
        ['Report Information', ''],
        ['Version', '2.0.0'],
        ['Report Date', datetime.now().strftime('%Y-%m-%d')],
        ['Author', 'King Jam AI Development Team'],
        ['Classification', 'Internal Technical Document'],
    ]
    info_table = create_table(info_data, col_widths=[2.5*inch, 3*inch])
    story.append(info_table)
    
    story.append(PageBreak())
    
    # ============================================================
    # 目錄
    # ============================================================
    story.append(Paragraph("Table of Contents", styles['SectionHeading']))
    story.append(Spacer(1, 0.3*inch))
    
    toc_items = [
        "1. Executive Summary (執行摘要)",
        "2. System Architecture (系統架構)",
        "3. AI Generation Engines (AI 生成引擎)",
        "4. Credit & Financial System (點數金融系統)",
        "5. Referral & Partner Program (推薦夥伴制度)",
        "6. Scheduling & Publishing (排程上架系統)",
        "7. Security & Fraud Detection (安全與詐騙偵測)",
        "8. Monitoring & Alerting (監控與告警)",
        "9. Data Lifecycle Management (資料生命週期管理)",
        "10. Frontend UX/UI Analysis (前端介面分析)",
        "11. Business Model (商業模式)",
        "12. Technical Specifications (技術規格)",
    ]
    
    for item in toc_items:
        story.append(Paragraph(f"• {item}", styles['BulletItem']))
    
    story.append(PageBreak())
    
    # ============================================================
    # 1. 執行摘要
    # ============================================================
    story.append(Paragraph("1. Executive Summary", styles['SectionHeading']))
    
    story.append(Paragraph("1.1 Platform Overview", styles['SubSectionHeading']))
    story.append(Paragraph(
        "King Jam AI is an integrated AI content generation and social media management platform. "
        "The platform provides comprehensive solutions for businesses and content creators to generate "
        "high-quality blog posts, social media content, and short videos powered by advanced AI models "
        "including Google Gemini, Vertex AI (Veo/Imagen), and Kling AI.",
        styles['CustomBody']
    ))
    
    story.append(Paragraph("1.2 Key Statistics", styles['SubSectionHeading']))
    stats_data = [
        ['Metric', 'Value', 'Notes'],
        ['Backend API Endpoints', '130+', 'RESTful APIs'],
        ['Database Tables', '25+', 'PostgreSQL'],
        ['Frontend Pages', '15', 'Next.js 14'],
        ['Background Task Queues', '3', 'Celery Workers'],
        ['AI Models Integrated', '6+', 'Gemini, Veo, Imagen, Kling'],
        ['Supported Social Platforms', '8', 'Instagram, TikTok, Facebook, etc.'],
    ]
    story.append(create_table(stats_data, col_widths=[2*inch, 1.5*inch, 2.5*inch]))
    
    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph("1.3 Core Value Propositions", styles['SubSectionHeading']))
    
    values = [
        "AI-Powered Content Generation - One-click creation of blog posts, social images, and short videos",
        "Multi-Platform Scheduling - Automated cross-platform content publishing",
        "Credit Economy System - Complete credit consumption, purchase, and withdrawal mechanism",
        "Partner Referral Program - Multi-tier commission-based partner program",
        "Enterprise-Grade Security - Phone verification, identity verification, 2FA, and fraud detection",
    ]
    for v in values:
        story.append(Paragraph(f"• {v}", styles['BulletItem']))
    
    story.append(PageBreak())
    
    # ============================================================
    # 2. 系統架構
    # ============================================================
    story.append(Paragraph("2. System Architecture", styles['SectionHeading']))
    
    story.append(Paragraph("2.1 High-Level Architecture", styles['SubSectionHeading']))
    story.append(Paragraph(
        "The platform follows a microservices-inspired architecture with clear separation of concerns. "
        "The frontend is built with Next.js 14, communicating with a FastAPI backend through RESTful APIs. "
        "Background tasks are handled by Celery workers with Redis as the message broker.",
        styles['CustomBody']
    ))
    
    arch_data = [
        ['Layer', 'Technology', 'Purpose'],
        ['Frontend', 'Next.js 14, React 18, TypeScript', 'User Interface'],
        ['API Gateway', 'FastAPI, Uvicorn', 'REST API Services'],
        ['Database', 'PostgreSQL 15', 'Primary Data Store'],
        ['Cache/Queue', 'Redis 7', 'Caching & Message Queue'],
        ['Background Tasks', 'Celery 5.3', 'Async Task Processing'],
        ['Scheduler', 'Celery Beat', 'Periodic Task Scheduling'],
        ['Container Runtime', 'Docker, Docker Compose', 'Container Orchestration'],
    ]
    story.append(create_table(arch_data, col_widths=[1.5*inch, 2.5*inch, 2*inch]))
    
    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph("2.2 Celery Queue Architecture", styles['SubSectionHeading']))
    story.append(Paragraph(
        "The system employs three dedicated Celery queues to ensure proper resource allocation and isolation:",
        styles['CustomBody']
    ))
    
    queue_data = [
        ['Queue', 'Concurrency', 'Purpose'],
        ['queue_high', '2 workers', 'Verification codes, instant notifications'],
        ['queue_default', '4 workers', 'Social publishing, scheduled tasks'],
        ['queue_video', '1 worker', 'Video rendering (isolated for OOM prevention)'],
    ]
    story.append(create_table(queue_data, col_widths=[1.8*inch, 1.5*inch, 2.7*inch]))
    
    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph("2.3 Docker Services", styles['SubSectionHeading']))
    
    docker_data = [
        ['Service', 'Container Name', 'Port', 'Memory Limit'],
        ['Backend API', 'kingjam_backend', '8000', 'Default'],
        ['PostgreSQL', 'kingjam_db', '5432', 'Default'],
        ['Redis', 'kingjam_redis', '6379', 'Default'],
        ['Celery Worker (High)', 'kingjam_celery_high', '-', 'Default'],
        ['Celery Worker (Default)', 'kingjam_celery_default', '-', 'Default'],
        ['Celery Worker (Video)', 'kingjam_celery_video', '-', '4GB'],
        ['Celery Beat', 'kingjam_celery_beat', '-', 'Default'],
        ['Flower Monitor', 'kingjam_flower', '5555', 'Default'],
    ]
    story.append(create_table(docker_data, col_widths=[1.8*inch, 1.8*inch, 0.8*inch, 1.5*inch]))
    
    story.append(PageBreak())
    
    # ============================================================
    # 3. AI 生成引擎
    # ============================================================
    story.append(Paragraph("3. AI Generation Engines", styles['SectionHeading']))
    
    story.append(Paragraph("3.1 Blog Article Generator", styles['SubSectionHeading']))
    story.append(Paragraph(
        "The blog generator uses Google Gemini models to create SEO-optimized articles. "
        "It supports multiple writing styles and tone configurations, and can automatically "
        "generate cover images using Imagen.",
        styles['CustomBody']
    ))
    
    blog_features = [
        "Multiple AI Models: Gemini 2.5 Flash, Gemini 2.5 Pro, Gemini Pro Latest",
        "14 Tone Styles: Professional, Casual, Friendly, Humorous, Educational, etc.",
        "Automatic SEO Optimization: Title, meta description, keywords",
        "Cover Image Generation: Basic (no image), Standard, Premium quality",
    ]
    for f in blog_features:
        story.append(Paragraph(f"• {f}", styles['BulletItem']))
    
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("3.2 Social Image Generator", styles['SubSectionHeading']))
    story.append(Paragraph(
        "Creates platform-optimized social media posts with AI-generated captions and images. "
        "Supports multiple aspect ratios and quality levels.",
        styles['CustomBody']
    ))
    
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("3.3 Short Video Generator (Director Engine)", styles['SubSectionHeading']))
    story.append(Paragraph(
        "The Director Engine is a sophisticated two-stage video generation system:",
        styles['CustomBody']
    ))
    
    video_data = [
        ['Stage', 'Function', 'AI Model'],
        ['Script Generation', 'Convert topic to structured scenes', 'Google Gemini'],
        ['Video Rendering', 'Generate actual video content', 'Veo 3 / Kling AI / Imagen+FFmpeg'],
    ]
    story.append(create_table(video_data, col_widths=[1.8*inch, 2.5*inch, 1.7*inch]))
    
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("3.4 Video Model Comparison", styles['SubSectionHeading']))
    
    model_data = [
        ['Model', 'Duration', 'Resolution', 'Cost (Credits)', 'Best For'],
        ['Kling v2.1', '5s', '720p', '30', 'Budget-friendly'],
        ['Kling v2.1', '10s', '720p', '55', 'Longer budget content'],
        ['Kling v2.1 Pro', '5s', '1080p', '50', 'Higher quality'],
        ['Kling v2.1 Pro', '10s', '1080p', '90', 'Best value (Recommended)'],
        ['Veo 3 Fast', '8s', 'HD', '200', 'Premium quality'],
        ['Veo 3 Pro', '8s', 'HD', '350', 'Top-tier quality'],
        ['Imagen + FFmpeg', 'Any', 'Custom', '50-120', 'Basic synthesis'],
    ]
    story.append(create_table(model_data, col_widths=[1.2*inch, 0.8*inch, 0.9*inch, 1*inch, 2*inch]))
    
    story.append(PageBreak())
    
    # ============================================================
    # 4. 點數金融系統
    # ============================================================
    story.append(Paragraph("4. Credit & Financial System", styles['SectionHeading']))
    
    story.append(Paragraph("4.1 Credit Categories", styles['SubSectionHeading']))
    story.append(Paragraph(
        "The platform implements a sophisticated credit ledger system with four distinct categories, "
        "each with specific characteristics and consumption order:",
        styles['CustomBody']
    ))
    
    credit_data = [
        ['Category', 'Code', 'Source', 'Validity', 'Refundable'],
        ['Promo Credits', 'PROMO', 'New user tasks, marketing', '7-30 days', 'No'],
        ['Subscription Credits', 'SUB', 'Monthly subscription', 'Current month', 'No'],
        ['Paid Credits', 'PAID', 'Direct purchase', 'Permanent', 'Yes'],
        ['Bonus Credits', 'BONUS', 'Referral commissions', 'Permanent', 'Withdrawable'],
    ]
    story.append(create_table(credit_data, col_widths=[1.3*inch, 0.8*inch, 1.5*inch, 1.2*inch, 1.2*inch]))
    
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph(
        "Consumption Order: PROMO → SUB → PAID → BONUS",
        styles['Emphasis']
    ))
    story.append(Paragraph(
        "This order ensures promotional credits are used first (before expiry), while BONUS credits "
        "(equivalent to cash) are preserved for potential withdrawal.",
        styles['CustomBody']
    ))
    
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("4.2 Transaction Atomicity", styles['SubSectionHeading']))
    story.append(Paragraph(
        "The credit system implements database-level protection to ensure accounting consistency:",
        styles['CustomBody']
    ))
    
    atomicity_features = [
        "SELECT FOR UPDATE: Row-level locking prevents race conditions",
        "Single DB Transaction: Balance updates and transaction records are committed together",
        "PostgreSQL CHECK Constraints: Enforces credits = sum of category credits",
        "Periodic Consistency Checks: Hourly background verification tasks",
    ]
    for f in atomicity_features:
        story.append(Paragraph(f"• {f}", styles['BulletItem']))
    
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("4.3 Withdrawal System", styles['SubSectionHeading']))
    
    withdrawal_data = [
        ['Parameter', 'Value'],
        ['Exchange Rate', '10 Credits = NT$ 1'],
        ['Minimum Withdrawal', '3,000 Credits (NT$ 300)'],
        ['Maximum Per Request', '100,000 Credits'],
        ['Maximum Per Month', '300,000 Credits'],
        ['Required Verifications', 'Phone + Identity + 2FA'],
    ]
    story.append(create_table(withdrawal_data, col_widths=[2.5*inch, 3*inch]))
    
    story.append(PageBreak())
    
    # ============================================================
    # 5. 推薦夥伴制度
    # ============================================================
    story.append(Paragraph("5. Referral & Partner Program", styles['SectionHeading']))
    
    story.append(Paragraph("5.1 Partner Tiers", styles['SubSectionHeading']))
    
    partner_data = [
        ['Tier', 'Requirements', 'Commission Rate', 'Bonus per Referral'],
        ['Bronze', 'Default', '10%', '200 PROMO credits'],
        ['Silver', '10 referrals + NT$5,000', '15%', '300 PROMO + Monthly bonus'],
        ['Gold', '30 referrals + NT$20,000', '20%', '500 PROMO + Monthly bonus'],
    ]
    story.append(create_table(partner_data, col_widths=[1*inch, 2*inch, 1.3*inch, 1.7*inch]))
    
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("5.2 Referral Bonus Table", styles['SubSectionHeading']))
    
    bonus_data = [
        ['Subscription Plan', 'Price (TWD)', 'Bronze Bonus', 'Silver Bonus', 'Gold Bonus'],
        ['Basic', 'NT$ 299', '300 pts', '450 pts', '600 pts'],
        ['Pro', 'NT$ 699', '700 pts', '1,050 pts', '1,400 pts'],
        ['Enterprise', 'NT$ 3,699', '3,700 pts', '5,550 pts', '7,400 pts'],
    ]
    story.append(create_table(bonus_data, col_widths=[1.3*inch, 1.1*inch, 1.1*inch, 1.1*inch, 1.1*inch]))
    
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("5.3 Referral Flow", styles['SubSectionHeading']))
    
    flow_items = [
        "1. User A generates unique referral code",
        "2. User B registers using User A's referral code",
        "3. User A receives 200 PROMO credits immediately",
        "4. User B subscribes to a paid plan",
        "5. Commission calculated based on User A's partner tier",
        "6. BONUS credits awarded to User A within 24 hours",
        "7. User A can withdraw BONUS credits as cash (10:1 rate)",
    ]
    for item in flow_items:
        story.append(Paragraph(f"• {item}", styles['BulletItem']))
    
    story.append(PageBreak())
    
    # ============================================================
    # 6. 排程上架系統
    # ============================================================
    story.append(Paragraph("6. Scheduling & Publishing", styles['SectionHeading']))
    
    story.append(Paragraph("6.1 Supported Platforms", styles['SubSectionHeading']))
    
    platform_data = [
        ['Platform', 'Content Types', 'OAuth Status', 'Auto-Publishing'],
        ['Instagram', 'Image, Carousel, Reels', 'Meta Business API', 'Yes'],
        ['Facebook', 'Image, Video, Link', 'Meta Business API', 'Yes'],
        ['TikTok', 'Video', 'TikTok for Business', 'Yes'],
        ['LinkedIn', 'Image, Video, Article', 'LinkedIn API', 'Yes'],
        ['YouTube', 'Video, Shorts', 'Google OAuth', 'Yes'],
        ['LINE', 'Message, Image', 'LINE Messaging API', 'Yes'],
        ['WordPress', 'Article, Page', 'REST API', 'Yes'],
        ['Threads', 'Text, Image', 'Meta API', 'Planned'],
    ]
    story.append(create_table(platform_data, col_widths=[1.2*inch, 1.5*inch, 1.5*inch, 1.3*inch]))
    
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("6.2 Scheduling Features", styles['SubSectionHeading']))
    
    schedule_features = [
        "Cross-platform unified scheduling interface",
        "Smart publishing time suggestions based on audience analytics",
        "Batch scheduling for multiple posts",
        "Automatic OAuth token refresh (24-hour cycle)",
        "Automatic retry on failure (up to 3 attempts with exponential backoff)",
        "Real-time publish status tracking with detailed logs",
    ]
    for f in schedule_features:
        story.append(Paragraph(f"• {f}", styles['BulletItem']))
    
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("6.3 Post Status Flow", styles['SubSectionHeading']))
    story.append(Paragraph(
        "pending → queued → publishing → published/failed",
        styles['CodeBlock']
    ))
    
    story.append(PageBreak())
    
    # ============================================================
    # 7. 安全與詐騙偵測
    # ============================================================
    story.append(Paragraph("7. Security & Fraud Detection", styles['SectionHeading']))
    
    story.append(Paragraph("7.1 Authentication System", styles['SubSectionHeading']))
    
    auth_data = [
        ['Mechanism', 'Implementation', 'Purpose'],
        ['JWT Tokens', 'HS256, 24h expiry', 'API Authentication'],
        ['Password Hashing', 'bcrypt (cost=12)', 'Credential Protection'],
        ['Phone Verification', 'SMS OTP (6-digit)', 'Account Verification'],
        ['Identity Verification', 'ID card + AI validation', 'KYC Compliance'],
        ['Two-Factor Auth', 'TOTP (RFC 6238)', 'Withdrawal Security'],
    ]
    story.append(create_table(auth_data, col_widths=[1.5*inch, 1.8*inch, 2.2*inch]))
    
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("7.2 Fraud Detection System", styles['SubSectionHeading']))
    story.append(Paragraph(
        "The platform implements comprehensive fraud detection to prevent referral abuse:",
        styles['CustomBody']
    ))
    
    fraud_features = [
        "IP Address Tracking: Detects multiple accounts from same IP",
        "Device Fingerprinting: Identifies same device across accounts",
        "Risk Scoring: Automated risk assessment (Low/Medium/High/Blocked)",
        "Suspicious Referral Detection: Identifies self-referral patterns",
        "Automatic Bonus Blocking: Suspends rewards for flagged accounts",
        "Admin Alert System: Real-time notifications for high-risk activities",
    ]
    for f in fraud_features:
        story.append(Paragraph(f"• {f}", styles['BulletItem']))
    
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("7.3 Device Fingerprint Collection", styles['SubSectionHeading']))
    
    fingerprint_data = [
        ['Data Point', 'Purpose'],
        ['Screen Resolution', 'Device identification'],
        ['Timezone', 'Location approximation'],
        ['Browser Language', 'User profile'],
        ['Canvas Fingerprint', 'Unique device signature'],
        ['WebGL Renderer', 'GPU identification'],
        ['Installed Fonts', 'System fingerprint'],
        ['Audio Context', 'Hardware signature'],
    ]
    story.append(create_table(fingerprint_data, col_widths=[2*inch, 4*inch]))
    
    story.append(PageBreak())
    
    # ============================================================
    # 8. 監控與告警
    # ============================================================
    story.append(Paragraph("8. Monitoring & Alerting", styles['SectionHeading']))
    
    story.append(Paragraph("8.1 Health Check System", styles['SubSectionHeading']))
    
    health_data = [
        ['Check Type', 'Frequency', 'Threshold', 'Alert Level'],
        ['Quick Ping', '1 minute', 'N/A', 'INFO'],
        ['Worker Heartbeat', '2 minutes', '60s timeout', 'WARNING'],
        ['Full Health Check', '5 minutes', 'Multiple', 'CRITICAL'],
        ['Memory Usage', '5 minutes', '80%/90%', 'WARNING/CRITICAL'],
        ['Disk Usage', '5 minutes', '80%/90%', 'WARNING/CRITICAL'],
        ['Queue Length', '5 minutes', '100/500', 'WARNING/CRITICAL'],
    ]
    story.append(create_table(health_data, col_widths=[1.5*inch, 1.2*inch, 1.3*inch, 1.5*inch]))
    
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("8.2 Alert Channels", styles['SubSectionHeading']))
    
    alert_channels = [
        "Slack Webhook: Real-time team notifications",
        "Email (SendGrid): Detailed incident reports",
        "LINE Notify: Mobile alerts for critical issues",
        "Console Logging: Always-on debug output",
    ]
    for c in alert_channels:
        story.append(Paragraph(f"• {c}", styles['BulletItem']))
    
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("8.3 Alert Suppression", styles['SubSectionHeading']))
    story.append(Paragraph(
        "To prevent alert storms, the system implements cooldown periods: "
        "WARNING alerts have a 5-minute cooldown, while CRITICAL alerts have a 1-minute cooldown.",
        styles['CustomBody']
    ))
    
    story.append(PageBreak())
    
    # ============================================================
    # 9. 資料生命週期管理
    # ============================================================
    story.append(Paragraph("9. Data Lifecycle Management", styles['SectionHeading']))
    
    story.append(Paragraph("9.1 Media Retention Policies", styles['SubSectionHeading']))
    
    retention_data = [
        ['Media Type', 'Retention Period', 'Storage Location'],
        ['Short Videos', '7 days', 'Local + Cloudflare R2'],
        ['Social Images', '14 days', 'Local + Cloudflare R2'],
        ['Blog Images', '14 days', 'Local + Cloudflare R2'],
        ['Scheduled Media', '30 days', 'Local + Cloudflare R2'],
        ['Thumbnails', 'Same as parent', 'Local'],
    ]
    story.append(create_table(retention_data, col_widths=[1.5*inch, 1.5*inch, 2.5*inch]))
    
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("9.2 Cleanup Tasks", styles['SubSectionHeading']))
    
    cleanup_data = [
        ['Task', 'Schedule', 'Queue'],
        ['Expired Media Cleanup', 'Daily at 4 AM', 'queue_default'],
        ['Temp Files Cleanup', 'Every 6 hours', 'queue_default'],
        ['Credit Consistency Check', 'Hourly', 'queue_default'],
        ['Token Refresh', 'Hourly', 'queue_default'],
    ]
    story.append(create_table(cleanup_data, col_widths=[2*inch, 2*inch, 2*inch]))
    
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("9.3 OOM Prevention Measures", styles['SubSectionHeading']))
    
    oom_measures = [
        "Docker Memory Limits: 4GB limit for video worker",
        "Worker Isolation: Dedicated worker for video rendering",
        "Task Limits: max-tasks-per-child=10, prefetch-multiplier=1",
        "Rate Limiting: 10 video tasks per minute (global)",
        "Memory Monitoring: psutil-based checks before task execution",
        "Automatic Garbage Collection: On task failure",
    ]
    for m in oom_measures:
        story.append(Paragraph(f"• {m}", styles['BulletItem']))
    
    story.append(PageBreak())
    
    # ============================================================
    # 10. 前端介面分析
    # ============================================================
    story.append(Paragraph("10. Frontend UX/UI Analysis", styles['SectionHeading']))
    
    story.append(Paragraph("10.1 Technology Stack", styles['SubSectionHeading']))
    
    frontend_data = [
        ['Technology', 'Version', 'Purpose'],
        ['Next.js', '14.x', 'React Framework (App Router)'],
        ['React', '18.x', 'UI Library'],
        ['TypeScript', '5.x', 'Type Safety'],
        ['Tailwind CSS', '3.4', 'Utility-First Styling'],
        ['shadcn/ui', 'Latest', 'Component Library'],
        ['Lucide React', 'Latest', 'Icon Library'],
        ['Sonner', 'Latest', 'Toast Notifications'],
        ['Axios', '1.6', 'HTTP Client'],
    ]
    story.append(create_table(frontend_data, col_widths=[1.5*inch, 1*inch, 3*inch]))
    
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("10.2 Page Structure", styles['SubSectionHeading']))
    
    pages_data = [
        ['Route', 'Page Name', 'Function'],
        ['/login', 'Login', 'User authentication'],
        ['/dashboard', 'Dashboard', 'Main overview'],
        ['/dashboard/blog', 'Blog Generator', 'AI article creation'],
        ['/dashboard/social', 'Social Generator', 'Social content creation'],
        ['/dashboard/video', 'Video Generator', 'Short video creation'],
        ['/dashboard/scheduler', 'Scheduler', 'Content scheduling'],
        ['/dashboard/accounts', 'Accounts', 'Social account management'],
        ['/dashboard/credits', 'Credits', 'Credit wallet'],
        ['/dashboard/referral', 'Referral', 'Partner program'],
        ['/dashboard/profile', 'Profile', 'User profile'],
        ['/dashboard/history', 'History', 'Generation history'],
        ['/dashboard/settings', 'Settings', 'Account settings'],
        ['/dashboard/notifications', 'Notifications', 'Message center'],
    ]
    story.append(create_table(pages_data, col_widths=[2*inch, 1.5*inch, 2.5*inch]))
    
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("10.3 Design System", styles['SubSectionHeading']))
    
    design_features = [
        "Dark Theme: Slate-based color palette (slate-800/900)",
        "Gradient Accents: Pink-to-Rose, Cyan-to-Blue gradients",
        "Responsive Layout: Mobile-first with sidebar navigation",
        "Toast Notifications: Sonner with custom dark styling",
        "Loading States: Skeleton loaders and spinners",
        "Micro-interactions: Hover effects, transitions",
    ]
    for f in design_features:
        story.append(Paragraph(f"• {f}", styles['BulletItem']))
    
    story.append(PageBreak())
    
    # ============================================================
    # 11. 商業模式
    # ============================================================
    story.append(Paragraph("11. Business Model", styles['SectionHeading']))
    
    story.append(Paragraph("11.1 Subscription Plans", styles['SubSectionHeading']))
    
    plan_data = [
        ['Plan', 'Monthly Price', 'Monthly Credits', 'Key Features'],
        ['Free', 'NT$ 0', '200 (one-time)', 'Basic features'],
        ['Basic', 'NT$ 299', '500', 'Standard features'],
        ['Pro', 'NT$ 699', '1,500', 'Advanced features + Priority'],
        ['Enterprise', 'NT$ 3,699', '10,000', 'All features + Dedicated support'],
    ]
    story.append(create_table(plan_data, col_widths=[1.2*inch, 1.2*inch, 1.3*inch, 2.3*inch]))
    
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("11.2 Credit Packages", styles['SubSectionHeading']))
    
    package_data = [
        ['Package', 'Credits', 'Price (TWD)', 'Price per Credit'],
        ['Starter', '500', 'NT$ 150', 'NT$ 0.30'],
        ['Standard', '1,000', 'NT$ 250', 'NT$ 0.25'],
        ['Premium', '3,000', 'NT$ 600', 'NT$ 0.20'],
        ['Enterprise', '10,000', 'NT$ 1,500', 'NT$ 0.15'],
    ]
    story.append(create_table(package_data, col_widths=[1.3*inch, 1.2*inch, 1.3*inch, 1.7*inch]))
    
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("11.3 Revenue Streams", styles['SubSectionHeading']))
    
    revenue_items = [
        "Subscription Revenue: Monthly recurring revenue from paid plans",
        "Credit Sales: One-time purchases for additional credits",
        "Enterprise Contracts: Custom pricing for large organizations",
        "API Access: (Future) B2B API licensing",
    ]
    for r in revenue_items:
        story.append(Paragraph(f"• {r}", styles['BulletItem']))
    
    story.append(PageBreak())
    
    # ============================================================
    # 12. 技術規格
    # ============================================================
    story.append(Paragraph("12. Technical Specifications", styles['SectionHeading']))
    
    story.append(Paragraph("12.1 Backend Dependencies", styles['SubSectionHeading']))
    
    backend_deps = [
        ['Package', 'Version', 'Purpose'],
        ['fastapi', '0.100+', 'Web Framework'],
        ['sqlalchemy', '2.0+', 'ORM'],
        ['celery', '5.3+', 'Task Queue'],
        ['redis', '5.0+', 'Redis Client'],
        ['google-generativeai', 'Latest', 'Gemini API'],
        ['google-genai', 'Latest', 'Vertex AI'],
        ['replicate', 'Latest', 'Kling AI'],
        ['pillow', '10.0+', 'Image Processing'],
        ['pydantic', '2.0+', 'Data Validation'],
        ['pyotp', '2.9+', '2FA Support'],
        ['psutil', '5.9+', 'System Monitoring'],
    ]
    story.append(create_table(backend_deps, col_widths=[1.8*inch, 1.2*inch, 2.5*inch]))
    
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("12.2 API Endpoints Summary", styles['SubSectionHeading']))
    
    api_summary = [
        ['Module', 'Endpoint Prefix', 'Count'],
        ['Authentication', '/auth', '10+'],
        ['Users', '/users', '10+'],
        ['Blog', '/blog', '8+'],
        ['Social', '/social', '6+'],
        ['Video', '/video', '12+'],
        ['Scheduler', '/scheduler', '15+'],
        ['Credits', '/credits', '12+'],
        ['Referral', '/referral', '8+'],
        ['Verification', '/verification', '10+'],
        ['Notifications', '/notifications', '6+'],
        ['Admin', '/admin', '15+'],
    ]
    story.append(create_table(api_summary, col_widths=[1.5*inch, 2*inch, 1.5*inch]))
    
    story.append(Spacer(1, 0.5*inch))
    story.append(HRFlowable(width="100%", color=colors.HexColor('#e2e8f0')))
    story.append(Spacer(1, 0.3*inch))
    
    # 結尾
    story.append(Paragraph(
        f"Report generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        styles['CustomSubtitle']
    ))
    story.append(Paragraph(
        "King Jam AI Development Team",
        styles['CustomSubtitle']
    ))
    
    return story


def main():
    """主函數"""
    output_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'docs',
        f'King_Jam_AI_Platform_Report_{datetime.now().strftime("%Y%m%d")}.pdf'
    )
    
    # 確保 docs 目錄存在
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # 創建 PDF
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch,
    )
    
    story = build_report()
    doc.build(story)
    
    print(f"✅ Report generated: {output_path}")
    return output_path


if __name__ == "__main__":
    main()
