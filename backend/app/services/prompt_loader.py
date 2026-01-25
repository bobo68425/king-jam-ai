"""
Prompt 載入器
==============

提供各引擎統一的 Prompt 載入介面，支援：
1. 從資料庫讀取（優先）
2. 回退到內建 Prompt（備用）
3. 使用記錄（可選）
4. 自動注入用戶地區變量

使用方式:
    from app.services.prompt_loader import PromptLoader, load_prompt
    
    # 方式一：使用 PromptLoader
    loader = PromptLoader(db)
    result = await loader.get("blog-article-generator", {"topic": "...", "tone": "..."})
    prompt_text = result.positive
    
    # 方式二：使用便捷函數（支援用戶地區自動注入）
    result = await load_prompt(
        db=db,
        slug="social-media-caption-generator",
        variables={"topic": "..."},
        user=current_user,  # 自動提取用戶地區
        client_ip="1.2.3.4"  # 可選：當前 IP
    )
"""

from typing import Dict, Any, Optional, NamedTuple, TYPE_CHECKING
from sqlalchemy.orm import Session
import re

if TYPE_CHECKING:
    from app.models import User


class PromptResult(NamedTuple):
    """Prompt 結果"""
    positive: str
    negative: Optional[str]
    system: Optional[str]
    model_config: Dict[str, Any]
    from_db: bool
    prompt_id: Optional[int]
    version_id: Optional[int]


def get_locale_variables(
    user: Optional["User"] = None,
    client_ip: Optional[str] = None,
    current_ip_country: Optional[str] = None
) -> Dict[str, Any]:
    """
    取得用戶地區相關的 Prompt 變量
    
    優先順序：
    1. 用戶自填國籍 (user.country)
    2. 地址國籍 (user.address_country)
    3. 註冊時 IP 國籍 (user.register_ip_country)
    4. 當前 IP 國籍 (current_ip_country)
    5. 預設：台灣
    
    Args:
        user: 用戶對象
        client_ip: 當前請求的 IP（用於日誌，實際國籍需預先查詢）
        current_ip_country: 當前 IP 的國籍（預先查詢好的）
        
    Returns:
        包含地區相關變量的字典
    """
    from app.services.geo_service import get_user_locale
    
    user_country = None
    address_country = None
    register_ip_country = None
    
    if user:
        # 使用 try-except 處理可能不存在的欄位（資料庫尚未遷移的情況）
        try:
            user_country = getattr(user, 'country', None)
            address_country = getattr(user, 'address_country', None)
            register_ip_country = getattr(user, 'register_ip_country', None)
        except Exception:
            # 如果欄位不存在，使用默認值
            pass
    
    locale_info = get_user_locale(
        user_country=user_country,
        address_country=address_country,
        register_ip_country=register_ip_country,
        current_ip_country=current_ip_country
    )
    
    # 轉換為 Prompt 變量格式
    return {
        "user_country": locale_info["country"],
        "user_language": locale_info["language"],
        "user_culture": locale_info["culture"],
        "user_timezone": locale_info["timezone"],
        "content_style": locale_info["content_style"],
        "hashtag_style": locale_info["hashtag_style"],
        "preferred_platforms": ", ".join(locale_info["social_platforms"]),
        "locale_source": locale_info["source"],
    }


class PromptLoader:
    """
    Prompt 載入器
    
    集中管理所有 AI 引擎的 Prompt 載入邏輯
    """
    
    # 內建備用 Prompt 對照表
    FALLBACK_PROMPTS: Dict[str, Dict[str, Any]] = {}
    
    def __init__(self, db: Optional[Session] = None):
        self.db = db
        self._cache: Dict[str, PromptResult] = {}
    
    async def get(
        self,
        slug: str,
        variables: Dict[str, Any],
        fallback: Optional[str] = None
    ) -> PromptResult:
        """
        獲取渲染後的 Prompt
        
        Args:
            slug: Prompt 識別碼（如 "blog-article-generator"）
            variables: 變數字典
            fallback: 備用 Prompt 模板（如果資料庫沒有）
        
        Returns:
            PromptResult 包含 positive, negative, system, model_config 等
        """
        # 嘗試從資料庫獲取
        if self.db:
            try:
                from app.services.prompt_service import prompt_service
                
                # 通過 slug 獲取 Prompt
                prompt = await prompt_service.get_prompt(self.db, slug=slug)
                
                if prompt and prompt.current_version_id:
                    result = await prompt_service.get_rendered_prompt(
                        db=self.db,
                        prompt_id=prompt.id,
                        variables=variables
                    )
                    
                    if "error" not in result:
                        print(f"[PromptLoader] ✓ 載入 '{slug}' (ID: {prompt.id}, Version: {result['version_id']})")
                        return PromptResult(
                            positive=result["rendered"]["positive"],
                            negative=result["rendered"].get("negative"),
                            system=result["rendered"].get("system"),
                            model_config=result.get("model_config", {}),
                            from_db=True,
                            prompt_id=prompt.id,
                            version_id=result.get("version_id")
                        )
                    else:
                        print(f"[PromptLoader] ⚠️ 渲染 '{slug}' 失敗: {result['error']}")
                else:
                    print(f"[PromptLoader] ⚠️ Prompt '{slug}' 不存在或無版本")
                    
            except Exception as e:
                print(f"[PromptLoader] ❌ 從資料庫載入 '{slug}' 失敗: {e}")
        
        # 使用備用 Prompt
        if fallback:
            rendered = self._render_template(fallback, variables)
            print(f"[PromptLoader] 使用備用 Prompt: '{slug}'")
            return PromptResult(
                positive=rendered,
                negative=None,
                system=None,
                model_config={},
                from_db=False,
                prompt_id=None,
                version_id=None
            )
        
        # 沒有可用的 Prompt
        print(f"[PromptLoader] ❌ 無可用 Prompt: '{slug}'")
        return PromptResult(
            positive="",
            negative=None,
            system=None,
            model_config={},
            from_db=False,
            prompt_id=None,
            version_id=None
        )
    
    def _render_template(self, template: str, variables: Dict[str, Any]) -> str:
        """
        渲染模板變數
        支援 {{variable}} 格式
        """
        def replace_var(match):
            var_name = match.group(1).strip()
            return str(variables.get(var_name, ""))
        
        pattern = r'\{\{([^}]+)\}\}'
        return re.sub(pattern, replace_var, template)
    
    async def log_usage(
        self,
        slug: str,
        prompt_id: int,
        version_id: int,
        user_id: Optional[int] = None,
        model_used: Optional[str] = None,
        is_success: bool = True,
        error_message: Optional[str] = None
    ):
        """
        記錄 Prompt 使用情況（可選）
        """
        if not self.db or not prompt_id:
            return
        
        try:
            from app.services.prompt_service import prompt_service
            await prompt_service.log_usage(
                db=self.db,
                prompt_id=prompt_id,
                version_id=version_id,
                user_id=user_id,
                model_used=model_used,
                is_success=is_success,
                error_message=error_message
            )
        except Exception as e:
            print(f"[PromptLoader] 記錄使用失敗: {e}")


# ============================================================
# 便捷函數
# ============================================================

async def load_prompt(
    db: Optional[Session],
    slug: str,
    variables: Dict[str, Any],
    fallback: Optional[str] = None,
    user: Optional["User"] = None,
    client_ip: Optional[str] = None,
    current_ip_country: Optional[str] = None,
    inject_locale: bool = True
) -> PromptResult:
    """
    便捷函數：載入並渲染 Prompt（支援用戶地區自動注入）
    
    Args:
        db: 資料庫 session
        slug: Prompt 識別碼
        variables: 變數字典
        fallback: 備用 Prompt 模板
        user: 用戶對象（用於提取國籍資訊）
        client_ip: 當前請求的 IP 地址（僅用於日誌）
        current_ip_country: 當前 IP 的國籍（預先查詢好的）
        inject_locale: 是否自動注入地區變量（預設 True）
    
    自動注入的地區變量（當 inject_locale=True）：
        - {{user_country}}: 用戶國家（如 "台灣"）
        - {{user_language}}: 偏好語言（如 "繁體中文"）
        - {{user_culture}}: 文化背景（如 "台灣文化"）
        - {{user_timezone}}: 時區（如 "Asia/Taipei"）
        - {{content_style}}: 內容風格建議
        - {{hashtag_style}}: Hashtag 風格建議
        - {{preferred_platforms}}: 常用社群平台
    
    Usage:
        from app.services.prompt_loader import load_prompt
        
        result = await load_prompt(
            db=db,
            slug="social-media-caption-generator",
            variables={"topic": "咖啡", "platform": "Instagram"},
            fallback="請為 {{topic}} 撰寫 {{platform}} 貼文...",
            user=current_user,  # 自動注入用戶地區
        )
        
        prompt_text = result.positive
    """
    # 自動注入地區變量
    if inject_locale:
        locale_vars = get_locale_variables(
            user=user,
            client_ip=client_ip,
            current_ip_country=current_ip_country
        )
        # 地區變量優先級較低，不會覆蓋用戶明確指定的變量
        merged_variables = {**locale_vars, **variables}
        
        if user:
            print(f"[PromptLoader] 注入地區變量: country={locale_vars['user_country']}, source={locale_vars['locale_source']}")
    else:
        merged_variables = variables
    
    loader = PromptLoader(db)
    return await loader.get(slug, merged_variables, fallback)


def load_prompt_sync(
    db: Optional[Session],
    slug: str,
    variables: Dict[str, Any],
    fallback: Optional[str] = None,
    user: Optional["User"] = None,
    inject_locale: bool = True
) -> PromptResult:
    """
    同步版本的 Prompt 載入函數（支援用戶地區自動注入）
    """
    import asyncio
    
    # 先處理地區變量注入
    if inject_locale:
        locale_vars = get_locale_variables(user=user)
        merged_variables = {**locale_vars, **variables}
    else:
        merged_variables = variables
    
    try:
        # 檢查是否已經在 async context 中
        try:
            loop = asyncio.get_running_loop()
            # 如果有運行中的 loop，使用 nest_asyncio 或直接回退
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(
                    asyncio.run,
                    load_prompt(db, slug, merged_variables, fallback, inject_locale=False)
                )
                return future.result(timeout=10)
        except RuntimeError:
            # 沒有運行中的 loop
            return asyncio.run(load_prompt(db, slug, merged_variables, fallback, inject_locale=False))
    except Exception as e:
        print(f"[PromptLoader] 同步載入失敗: {e}")
        
        # 回退到簡單渲染
        if fallback:
            loader = PromptLoader(None)
            rendered = loader._render_template(fallback, merged_variables)
            return PromptResult(
                positive=rendered,
                negative=None,
                system=None,
                model_config={},
                from_db=False,
                prompt_id=None,
                version_id=None
            )
        
        return PromptResult(
            positive="",
            negative=None,
            system=None,
            model_config={},
            from_db=False,
            prompt_id=None,
            version_id=None
        )
