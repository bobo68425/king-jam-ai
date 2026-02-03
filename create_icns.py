#!/usr/bin/env python3
"""
創建 .icns 檔案的腳本
使用 rsvg-convert 將 SVG 轉換為各種尺寸的 PNG，然後使用 iconutil 創建 .icns
"""

import os
import subprocess

# 定義需要的尺寸
SIZES = [
    (16, "16x16"),
    (32, "16x16@2x"),
    (32, "32x32"),
    (64, "32x32@2x"),
    (128, "128x128"),
    (256, "128x128@2x"),
    (256, "256x256"),
    (512, "256x256@2x"),
    (512, "512x512"),
    (1024, "512x512@2x"),
]

def main():
    svg_file = "file.svg"
    iconset_dir = "kjam-icon.iconset"
    
    # 確保 iconset 資料夾存在
    os.makedirs(iconset_dir, exist_ok=True)
    
    # 轉換每個尺寸
    for size, name in SIZES:
        output_file = os.path.join(iconset_dir, f"icon_{name}.png")
        print(f"創建 {output_file} ({size}x{size})")
        
        result = subprocess.run([
            "rsvg-convert",
            "-w", str(size),
            "-h", str(size),
            svg_file,
            "-o", output_file
        ], capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"  ❌ 錯誤: {result.stderr}")
        else:
            print(f"  ✅ 成功")
    
    print("\n所有 PNG 檔案已創建！")
    
    # 使用 iconutil 創建 .icns 檔案
    print("\n正在創建 .icns 檔案...")
    result = subprocess.run(
        ["iconutil", "-c", "icns", iconset_dir, "-o", "kjam-file.icns"],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        print("✅ 成功創建 kjam-file.icns！")
        print(f"\n檔案位置: {os.path.abspath('kjam-file.icns')}")
    else:
        print(f"❌ 錯誤: {result.stderr}")

if __name__ == "__main__":
    main()
