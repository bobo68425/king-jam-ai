#!/usr/bin/env python3
"""
列出 Google Gemini API 中支援圖片生成的模型
"""
import os
from google import genai

# 從環境變數讀取 API Key（或直接寫在這裡）
api_key = os.getenv("GOOGLE_GEMINI_KEY")
if not api_key:
    print("請設定環境變數 GOOGLE_GEMINI_KEY，或直接在腳本中填入 API Key")
    exit(1)

client = genai.Client(api_key=api_key)

print("=" * 60)
print("正在查詢可用的 Gemini 模型...")
print("=" * 60)

image_models = []
all_models = []

try:
    for model in client.models.list():
        all_models.append(model)
        methods = model.supported_generation_methods or []
        
        # 檢查是否支援圖片生成
        if "generateImages" in methods or "generate_images" in methods or "images" in str(methods).lower():
            image_models.append(model)
            print(f"\n✅ 找到圖片生成模型：")
            print(f"   名稱: {model.name}")
            print(f"   支援的方法: {methods}")
            print(f"   顯示名稱: {getattr(model, 'display_name', 'N/A')}")
except Exception as e:
    print(f"❌ 查詢模型時發生錯誤: {e}")
    print("\n嘗試列出所有模型...")
    for model in client.models.list():
        print(f"   - {model.name}")

print("\n" + "=" * 60)
if image_models:
    print(f"總共找到 {len(image_models)} 個支援圖片生成的模型")
    print("\n建議使用的模型名稱（複製其中一個給後端使用）：")
    for model in image_models:
        print(f"   {model.name}")
else:
    print("⚠️  沒有找到明確標示支援圖片生成的模型")
    print("\n所有可用模型：")
    for model in all_models[:10]:  # 只顯示前 10 個
        print(f"   - {model.name}")
        methods = model.supported_generation_methods or []
        if methods:
            print(f"     方法: {methods}")

print("=" * 60)

