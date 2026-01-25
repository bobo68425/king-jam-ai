"""
Prompt Registry Service

提供 Prompt 管理的核心業務邏輯：
- CRUD 操作
- 版本控制
- 變數渲染
- 使用統計
"""

import re
import unicodedata
from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, func

from app.models import Prompt, PromptVersion, PromptUsageLog, User


def slugify(text: str, max_length: int = 200) -> str:
    """
    將文字轉換為 URL-friendly slug
    """
    # 標準化 Unicode
    text = unicodedata.normalize('NFKD', text)
    # 移除非 ASCII 字符，但保留中文等
    text = re.sub(r'[^\w\s\-]', '', text, flags=re.UNICODE)
    # 轉換空白為連字符
    text = re.sub(r'[\s_]+', '-', text.strip().lower())
    # 移除連續的連字符
    text = re.sub(r'-+', '-', text)
    # 移除開頭和結尾的連字符
    text = text.strip('-')
    # 限制長度
    return text[:max_length]


class PromptService:
    """Prompt 管理服務"""
    
    # ============================================================
    # Prompt CRUD
    # ============================================================
    
    async def create_prompt(
        self,
        db: Session,
        name: str,
        category: str,
        generation_type: str,
        positive_template: str,
        negative_template: Optional[str] = None,
        model_config: Optional[Dict] = None,
        variables: Optional[List[Dict]] = None,
        description: Optional[str] = None,
        supported_models: Optional[List[str]] = None,
        default_model: Optional[str] = None,
        tags: Optional[List[str]] = None,
        system_prompt: Optional[str] = None,
        output_format: Optional[Dict] = None,
        examples: Optional[List[Dict]] = None,
        is_system: bool = False,
        created_by: Optional[int] = None
    ) -> Prompt:
        """
        創建新的 Prompt（含初始版本）
        """
        # 生成 slug
        base_slug = slugify(name, allow_unicode=True)
        slug = base_slug
        counter = 1
        while db.query(Prompt).filter(Prompt.slug == slug).first():
            slug = f"{base_slug}-{counter}"
            counter += 1
        
        # 創建 Prompt 主記錄
        prompt = Prompt(
            name=name,
            slug=slug,
            description=description,
            category=category,
            generation_type=generation_type,
            supported_models=supported_models or [],
            default_model=default_model,
            tags=tags or [],
            is_system=is_system,
            is_active=True,
            created_by=created_by
        )
        db.add(prompt)
        db.flush()  # 獲取 prompt.id
        
        # 創建初始版本 (v1)
        version = PromptVersion(
            prompt_id=prompt.id,
            version_number=1,
            version_tag="v1.0",
            positive_template=positive_template,
            negative_template=negative_template,
            model_config=model_config or {},
            variables=variables or [],
            system_prompt=system_prompt,
            output_format=output_format or {},
            examples=examples or [],
            is_active=True,
            created_by=created_by
        )
        db.add(version)
        db.flush()
        
        # 更新當前版本指向
        prompt.current_version_id = version.id
        db.commit()
        db.refresh(prompt)
        
        return prompt
    
    async def get_prompt(
        self,
        db: Session,
        prompt_id: Optional[int] = None,
        slug: Optional[str] = None,
        include_versions: bool = False
    ) -> Optional[Prompt]:
        """
        獲取單一 Prompt
        """
        query = db.query(Prompt)
        
        if prompt_id:
            query = query.filter(Prompt.id == prompt_id)
        elif slug:
            query = query.filter(Prompt.slug == slug)
        else:
            return None
        
        prompt = query.first()
        
        if prompt and include_versions:
            # 預載入版本（已通過 relationship 定義排序）
            _ = prompt.versions
        
        return prompt
    
    async def list_prompts(
        self,
        db: Session,
        category: Optional[str] = None,
        generation_type: Optional[str] = None,
        tags: Optional[List[str]] = None,
        search: Optional[str] = None,
        is_active: Optional[bool] = True,
        is_system: Optional[bool] = None,
        created_by: Optional[int] = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: str = "updated_at",
        sort_order: str = "desc"
    ) -> Dict[str, Any]:
        """
        列出 Prompts（支援分頁、篩選、排序）
        """
        query = db.query(Prompt)
        
        # 篩選條件
        if category:
            query = query.filter(Prompt.category == category)
        if generation_type:
            query = query.filter(Prompt.generation_type == generation_type)
        if is_active is not None:
            query = query.filter(Prompt.is_active == is_active)
        if is_system is not None:
            query = query.filter(Prompt.is_system == is_system)
        if created_by:
            query = query.filter(Prompt.created_by == created_by)
        if search:
            query = query.filter(
                Prompt.name.ilike(f"%{search}%") |
                Prompt.description.ilike(f"%{search}%")
            )
        if tags:
            # JSON 陣列搜尋（PostgreSQL）
            for tag in tags:
                query = query.filter(Prompt.tags.contains([tag]))
        
        # 計算總數
        total = query.count()
        
        # 排序
        sort_column = getattr(Prompt, sort_by, Prompt.updated_at)
        if sort_order == "desc":
            query = query.order_by(desc(sort_column))
        else:
            query = query.order_by(sort_column)
        
        # 分頁
        offset = (page - 1) * page_size
        prompts = query.offset(offset).limit(page_size).all()
        
        return {
            "items": prompts,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size
        }
    
    async def update_prompt(
        self,
        db: Session,
        prompt_id: int,
        **kwargs
    ) -> Optional[Prompt]:
        """
        更新 Prompt 基本資訊（不包含版本內容）
        """
        prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
        if not prompt:
            return None
        
        # 可更新的欄位
        allowed_fields = [
            "name", "description", "category", "generation_type",
            "supported_models", "default_model", "tags",
            "is_active", "is_public"
        ]
        
        for key, value in kwargs.items():
            if key in allowed_fields and value is not None:
                setattr(prompt, key, value)
        
        # 如果更新名稱，重新生成 slug
        if "name" in kwargs:
            base_slug = slugify(kwargs["name"], allow_unicode=True)
            slug = base_slug
            counter = 1
            while db.query(Prompt).filter(
                and_(Prompt.slug == slug, Prompt.id != prompt_id)
            ).first():
                slug = f"{base_slug}-{counter}"
                counter += 1
            prompt.slug = slug
        
        db.commit()
        db.refresh(prompt)
        return prompt
    
    async def delete_prompt(
        self,
        db: Session,
        prompt_id: int,
        soft_delete: bool = True
    ) -> bool:
        """
        刪除 Prompt
        """
        prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
        if not prompt:
            return False
        
        if soft_delete:
            prompt.is_active = False
            db.commit()
        else:
            db.delete(prompt)
            db.commit()
        
        return True
    
    # ============================================================
    # 版本控制
    # ============================================================
    
    async def create_version(
        self,
        db: Session,
        prompt_id: int,
        positive_template: str,
        negative_template: Optional[str] = None,
        model_config: Optional[Dict] = None,
        variables: Optional[List[Dict]] = None,
        system_prompt: Optional[str] = None,
        output_format: Optional[Dict] = None,
        examples: Optional[List[Dict]] = None,
        version_tag: Optional[str] = None,
        changelog: Optional[str] = None,
        created_by: Optional[int] = None,
        set_as_current: bool = True
    ) -> Optional[PromptVersion]:
        """
        創建新版本
        """
        prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
        if not prompt:
            return None
        
        # 獲取最新版本號
        latest_version = db.query(PromptVersion).filter(
            PromptVersion.prompt_id == prompt_id
        ).order_by(desc(PromptVersion.version_number)).first()
        
        new_version_number = (latest_version.version_number + 1) if latest_version else 1
        
        # 自動生成版本標籤
        if not version_tag:
            version_tag = f"v{new_version_number}.0"
        
        # 創建新版本
        version = PromptVersion(
            prompt_id=prompt_id,
            version_number=new_version_number,
            version_tag=version_tag,
            positive_template=positive_template,
            negative_template=negative_template,
            model_config=model_config or {},
            variables=variables or [],
            system_prompt=system_prompt,
            output_format=output_format or {},
            examples=examples or [],
            changelog=changelog,
            is_active=True,
            created_by=created_by
        )
        db.add(version)
        db.flush()
        
        # 設為當前版本
        if set_as_current:
            prompt.current_version_id = version.id
        
        db.commit()
        db.refresh(version)
        return version
    
    async def get_version(
        self,
        db: Session,
        version_id: int
    ) -> Optional[PromptVersion]:
        """
        獲取特定版本
        """
        return db.query(PromptVersion).filter(
            PromptVersion.id == version_id
        ).first()
    
    async def list_versions(
        self,
        db: Session,
        prompt_id: int,
        include_drafts: bool = False
    ) -> List[PromptVersion]:
        """
        列出 Prompt 的所有版本
        """
        query = db.query(PromptVersion).filter(
            PromptVersion.prompt_id == prompt_id
        )
        
        if not include_drafts:
            query = query.filter(PromptVersion.is_draft == False)
        
        return query.order_by(desc(PromptVersion.version_number)).all()
    
    async def set_current_version(
        self,
        db: Session,
        prompt_id: int,
        version_id: int
    ) -> bool:
        """
        設定當前生效版本（回滾功能）
        """
        prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
        version = db.query(PromptVersion).filter(
            and_(
                PromptVersion.id == version_id,
                PromptVersion.prompt_id == prompt_id
            )
        ).first()
        
        if not prompt or not version:
            return False
        
        prompt.current_version_id = version_id
        db.commit()
        return True
    
    async def compare_versions(
        self,
        db: Session,
        version_id_1: int,
        version_id_2: int
    ) -> Dict[str, Any]:
        """
        比較兩個版本的差異
        """
        v1 = await self.get_version(db, version_id_1)
        v2 = await self.get_version(db, version_id_2)
        
        if not v1 or not v2:
            return {"error": "Version not found"}
        
        return {
            "version_1": {
                "id": v1.id,
                "version_number": v1.version_number,
                "version_tag": v1.version_tag,
                "created_at": v1.created_at.isoformat() if v1.created_at else None
            },
            "version_2": {
                "id": v2.id,
                "version_number": v2.version_number,
                "version_tag": v2.version_tag,
                "created_at": v2.created_at.isoformat() if v2.created_at else None
            },
            "changes": {
                "positive_template": v1.positive_template != v2.positive_template,
                "negative_template": v1.negative_template != v2.negative_template,
                "model_config": v1.model_config != v2.model_config,
                "variables": v1.variables != v2.variables,
                "system_prompt": v1.system_prompt != v2.system_prompt
            },
            "diff": {
                "positive_template_v1": v1.positive_template,
                "positive_template_v2": v2.positive_template,
                "negative_template_v1": v1.negative_template,
                "negative_template_v2": v2.negative_template,
            }
        }
    
    # ============================================================
    # Prompt 渲染
    # ============================================================
    
    def render_prompt(
        self,
        template: str,
        variables: Dict[str, Any]
    ) -> str:
        """
        渲染 Prompt 模板（變數替換）
        
        支援 {{variable}} 格式
        """
        def replace_var(match):
            var_name = match.group(1).strip()
            return str(variables.get(var_name, match.group(0)))
        
        # 替換 {{variable}} 格式
        pattern = r'\{\{([^}]+)\}\}'
        return re.sub(pattern, replace_var, template)
    
    async def get_rendered_prompt(
        self,
        db: Session,
        prompt_id: int,
        variables: Dict[str, Any],
        version_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        獲取渲染後的完整 Prompt
        """
        prompt = await self.get_prompt(db, prompt_id=prompt_id)
        if not prompt:
            return {"error": "Prompt not found"}
        
        # 獲取版本
        if version_id:
            version = await self.get_version(db, version_id)
        else:
            version = db.query(PromptVersion).filter(
                PromptVersion.id == prompt.current_version_id
            ).first()
        
        if not version:
            return {"error": "Version not found"}
        
        # 驗證必要變數
        required_vars = [
            v["name"] for v in (version.variables or [])
            if v.get("required", False)
        ]
        missing_vars = [v for v in required_vars if v not in variables]
        if missing_vars:
            return {"error": f"Missing required variables: {missing_vars}"}
        
        # 填充預設值
        for var_def in (version.variables or []):
            var_name = var_def["name"]
            if var_name not in variables and "default" in var_def:
                variables[var_name] = var_def["default"]
        
        # 渲染
        rendered_positive = self.render_prompt(version.positive_template, variables)
        rendered_negative = None
        if version.negative_template:
            rendered_negative = self.render_prompt(version.negative_template, variables)
        rendered_system = None
        if version.system_prompt:
            rendered_system = self.render_prompt(version.system_prompt, variables)
        
        return {
            "prompt_id": prompt.id,
            "prompt_name": prompt.name,
            "version_id": version.id,
            "version_number": version.version_number,
            "generation_type": prompt.generation_type,
            "model_config": version.model_config,
            "rendered": {
                "positive": rendered_positive,
                "negative": rendered_negative,
                "system": rendered_system
            },
            "output_format": version.output_format
        }
    
    # ============================================================
    # 使用記錄與統計
    # ============================================================
    
    async def log_usage(
        self,
        db: Session,
        prompt_id: int,
        version_id: int,
        user_id: Optional[int] = None,
        model_used: Optional[str] = None,
        input_variables: Optional[Dict] = None,
        rendered_prompt: Optional[str] = None,
        generation_id: Optional[int] = None,
        execution_time_ms: Optional[int] = None,
        tokens_used: Optional[int] = None,
        is_success: bool = True,
        error_message: Optional[str] = None
    ) -> PromptUsageLog:
        """
        記錄 Prompt 使用情況
        """
        log = PromptUsageLog(
            prompt_id=prompt_id,
            version_id=version_id,
            user_id=user_id,
            model_used=model_used,
            input_variables=input_variables or {},
            rendered_prompt=rendered_prompt,
            generation_id=generation_id,
            execution_time_ms=execution_time_ms,
            tokens_used=tokens_used,
            is_success=is_success,
            error_message=error_message
        )
        db.add(log)
        
        # 更新使用計數
        prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
        if prompt:
            prompt.usage_count = (prompt.usage_count or 0) + 1
        
        db.commit()
        db.refresh(log)
        return log
    
    async def rate_usage(
        self,
        db: Session,
        usage_log_id: int,
        rating: int,
        feedback: Optional[str] = None
    ) -> bool:
        """
        對使用結果評分
        """
        log = db.query(PromptUsageLog).filter(
            PromptUsageLog.id == usage_log_id
        ).first()
        
        if not log:
            return False
        
        log.user_rating = rating
        log.user_feedback = feedback
        
        # 更新版本的平均評分
        version = db.query(PromptVersion).filter(
            PromptVersion.id == log.version_id
        ).first()
        
        if version:
            # 計算新平均分
            total = version.total_ratings * version.avg_rating + rating
            version.total_ratings += 1
            version.avg_rating = total / version.total_ratings
        
        db.commit()
        return True
    
    async def get_usage_stats(
        self,
        db: Session,
        prompt_id: int,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        獲取使用統計
        """
        from datetime import timedelta
        
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # 基本統計
        total_uses = db.query(func.count(PromptUsageLog.id)).filter(
            PromptUsageLog.prompt_id == prompt_id,
            PromptUsageLog.created_at >= start_date
        ).scalar()
        
        successful_uses = db.query(func.count(PromptUsageLog.id)).filter(
            PromptUsageLog.prompt_id == prompt_id,
            PromptUsageLog.is_success == True,
            PromptUsageLog.created_at >= start_date
        ).scalar()
        
        avg_execution_time = db.query(func.avg(PromptUsageLog.execution_time_ms)).filter(
            PromptUsageLog.prompt_id == prompt_id,
            PromptUsageLog.execution_time_ms.isnot(None),
            PromptUsageLog.created_at >= start_date
        ).scalar()
        
        avg_rating = db.query(func.avg(PromptUsageLog.user_rating)).filter(
            PromptUsageLog.prompt_id == prompt_id,
            PromptUsageLog.user_rating.isnot(None),
            PromptUsageLog.created_at >= start_date
        ).scalar()
        
        # 按版本統計
        version_stats = db.query(
            PromptUsageLog.version_id,
            func.count(PromptUsageLog.id).label("uses"),
            func.avg(PromptUsageLog.user_rating).label("avg_rating")
        ).filter(
            PromptUsageLog.prompt_id == prompt_id,
            PromptUsageLog.created_at >= start_date
        ).group_by(PromptUsageLog.version_id).all()
        
        return {
            "prompt_id": prompt_id,
            "period_days": days,
            "total_uses": total_uses or 0,
            "successful_uses": successful_uses or 0,
            "success_rate": (successful_uses / total_uses * 100) if total_uses else 0,
            "avg_execution_time_ms": float(avg_execution_time) if avg_execution_time else None,
            "avg_rating": float(avg_rating) if avg_rating else None,
            "by_version": [
                {
                    "version_id": stat.version_id,
                    "uses": stat.uses,
                    "avg_rating": float(stat.avg_rating) if stat.avg_rating else None
                }
                for stat in version_stats
            ]
        }


# 單例實例
prompt_service = PromptService()


# ============================================================
# 便捷函數 - 供各引擎直接調用
# ============================================================

async def get_prompt_by_slug(
    db,
    slug: str,
    variables: Dict[str, Any],
    fallback_prompt: Optional[str] = None
) -> Dict[str, Any]:
    """
    通過 slug 獲取渲染後的 Prompt（便捷函數）
    
    Args:
        db: 資料庫連線
        slug: Prompt 的 slug 識別碼
        variables: 變數字典
        fallback_prompt: 如果資料庫中沒有，使用的備用 Prompt
    
    Returns:
        {
            "positive": "渲染後的正向提示詞",
            "negative": "渲染後的負向提示詞（可能為 None）",
            "system": "渲染後的系統提示詞（可能為 None）",
            "model_config": {...},
            "from_db": True/False  # 是否來自資料庫
        }
    
    Usage:
        from app.services.prompt_service import get_prompt_by_slug
        
        result = await get_prompt_by_slug(
            db=db,
            slug="blog-article-generator",
            variables={"topic": "如何提升工作效率", "tone_instructions": "專業語氣"},
            fallback_prompt="你是一位專業作家..."
        )
        
        prompt_text = result["positive"]
    """
    try:
        # 嘗試從資料庫獲取
        prompt = await prompt_service.get_prompt(db, slug=slug)
        
        if prompt and prompt.current_version_id:
            result = await prompt_service.get_rendered_prompt(
                db=db,
                prompt_id=prompt.id,
                variables=variables
            )
            
            if "error" not in result:
                return {
                    "positive": result["rendered"]["positive"],
                    "negative": result["rendered"].get("negative"),
                    "system": result["rendered"].get("system"),
                    "model_config": result.get("model_config", {}),
                    "prompt_id": prompt.id,
                    "version_id": result.get("version_id"),
                    "from_db": True
                }
    except Exception as e:
        print(f"[PromptService] 從資料庫獲取 Prompt '{slug}' 失敗: {e}")
    
    # 回退到備用 Prompt
    if fallback_prompt:
        # 簡單的變數替換
        rendered = fallback_prompt
        for key, value in variables.items():
            rendered = rendered.replace(f"{{{{{key}}}}}", str(value) if value else "")
        
        return {
            "positive": rendered,
            "negative": None,
            "system": None,
            "model_config": {},
            "from_db": False
        }
    
    return {
        "positive": "",
        "negative": None,
        "system": None,
        "model_config": {},
        "from_db": False,
        "error": f"Prompt '{slug}' not found"
    }


def get_prompt_sync(
    db,
    slug: str,
    variables: Dict[str, Any],
    fallback_prompt: Optional[str] = None
) -> Dict[str, Any]:
    """
    同步版本的 Prompt 獲取函數
    
    適用於不支援 async 的場景
    """
    import asyncio
    
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # 如果已經在 async context 中，創建新的 future
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(
                    asyncio.run,
                    get_prompt_by_slug(db, slug, variables, fallback_prompt)
                )
                return future.result(timeout=10)
        else:
            return loop.run_until_complete(
                get_prompt_by_slug(db, slug, variables, fallback_prompt)
            )
    except Exception as e:
        print(f"[PromptService] 同步獲取 Prompt 失敗: {e}")
        
        # 回退
        if fallback_prompt:
            rendered = fallback_prompt
            for key, value in variables.items():
                rendered = rendered.replace(f"{{{{{key}}}}}", str(value) if value else "")
            return {
                "positive": rendered,
                "negative": None,
                "system": None,
                "model_config": {},
                "from_db": False
            }
        
        return {
            "positive": "",
            "negative": None,
            "system": None,
            "model_config": {},
            "from_db": False,
            "error": str(e)
        }
