"""
Railway 啟動腳本 - 讀取 PORT 環境變數並啟動 uvicorn
避免 shell 變數展開問題
"""
import os
import uvicorn

if __name__ == "__main__":
    # 執行資料庫遷移
    print("[start.py] ℹ️ 正在準備啟動程序...")
    
    # 確保 PYTHONPATH 包含當前目錄
    os.environ["PYTHONPATH"] = os.getcwd()
    
    print("[start.py] ⚙️ 正在執行資料庫遷移 (Alembic)...")
    try:
        # 使用 check=False 避免遷移失敗導致整個啟動掛掉
        exit_code = os.system("python -m alembic upgrade head")
        if exit_code != 0:
            print(f"[start.py] ⚠️ 資料庫遷移失敗 (Exit Code: {exit_code})，但仍將嘗試啟動伺服器...")
        else:
            print("[start.py] ✅ 資料庫遷移完成")
    except Exception as e:
        print(f"[start.py] ❌ 遷移過程中發生例外: {e}")

    port = int(os.environ.get("PORT", 8080))
    print(f"[start.py] 🚀 正在啟動伺服器 0.0.0.0:{port} ...")
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        workers=1,
        access_log=True,
    )
