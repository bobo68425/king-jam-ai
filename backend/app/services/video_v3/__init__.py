"""
v3.0 引擎後端服務 — 初始化
使用 lazy import 避免啟動時因缺少依賴而崩潰
"""
# Lazy imports — 實際使用時才載入，避免 import chain 失敗
# from .fal_service import generate_scene_clip, check_scene_status, handle_webhook, select_best_model
# from .openai_tts import generate_tts_with_timestamps
# from .render_client import submit_render_job, check_render_status
