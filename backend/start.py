"""
Railway 啟動腳本 - 讀取 PORT 環境變數並啟動 uvicorn
避免 shell 變數展開問題
"""
import os
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"[start.py] Starting server on 0.0.0.0:{port}")
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        workers=1,
        access_log=True,
    )
