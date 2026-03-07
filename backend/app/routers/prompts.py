"""
Prompt Registry API

提供 Prompt 管理的 RESTful API：
- CRUD 操作
- 版本控制
- 使用記錄
- 統計報表
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.database import get_db
from app.models import User, Prompt, PromptVersion
from app.routers.auth import get_current_user
from app.services.prompt_service import prompt_service

router = APIRouter(prefix="/prompts", tags=["Prompt Registry"])


# ============================================================
# Admin 權限驗證
# ============================================================

async def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    驗證當前用戶是否為管理員
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user

# ============================================================
# Schemas
# ============================================================

class VariableDefinition(BaseModel):
    """變數定義"""
    name: str = Field(..., description="變數名稱")
    label: str = Field(..., description="顯示標籤")
    type: str = Field("text", description="類型: text, textarea, select, number, boolean")
    required: bool = Field(False, description="是否必填")
    placeholder: Optional[str] = Field(None, description="輸入提示")
    default: Optional[Any] = Field(None, description="預設值")
    options: Optional[List[str]] = Field(None, description="選項（select 類型用）")
    min: Optional[float] = Field(None, description="最小值（number 類型用）")
    max: Optional[float] = Field(None, description="最大值（number 類型用）")


class ModelConfigSchema(BaseModel):
    """模型配置"""
    temperature: Optional[float] = Field(0.7, ge=0, le=2)
    max_tokens: Optional[int] = Field(2000, ge=1)
    top_p: Optional[float] = Field(0.9, ge=0, le=1)
    top_k: Optional[int] = Field(40, ge=1)
    presence_penalty: Optional[float] = Field(0, ge=-2, le=2)
    frequency_penalty: Optional[float] = Field(0, ge=-2, le=2)
    # 圖片生成
    width: Optional[int] = Field(None)
    height: Optional[int] = Field(None)
    guidance_scale: Optional[float] = Field(None)
    num_inference_steps: Optional[int] = Field(None)
    seed: Optional[int] = Field(None)
    # 影片生成
    duration_seconds: Optional[int] = Field(None)
    fps: Optional[int] = Field(None)
    aspect_ratio: Optional[str] = Field(None)


class OutputFormatSchema(BaseModel):
    """輸出格式定義"""
    type: str = Field("text", description="輸出類型: text, json, markdown")
    schema_def: Optional[Dict[str, str]] = Field(None, alias="schema", description="JSON Schema 定義")


class ExampleSchema(BaseModel):
    """範例輸入/輸出"""
    input: Dict[str, Any]
    output: str


# ========== Create ==========

class PromptCreate(BaseModel):
    """創建 Prompt"""
    name: str = Field(..., min_length=1, max_length=200, description="Prompt 名稱")
    description: Optional[str] = Field(None, description="說明描述")
    category: str = Field(..., description="分類")
    generation_type: str = Field(..., description="生成類型: copywriting, image, video, tts")
    
    positive_template: str = Field(..., min_length=1, description="正向提示詞模板")
    negative_template: Optional[str] = Field(None, description="負向提示詞模板")
    
    model_config_data: Optional[Dict[str, Any]] = Field(None, alias="model_config", description="模型配置")
    variables: Optional[List[Dict[str, Any]]] = Field(None, description="變數定義")
    system_prompt: Optional[str] = Field(None, description="系統提示詞")
    output_format: Optional[Dict[str, Any]] = Field(None, description="輸出格式")
    examples: Optional[List[Dict[str, Any]]] = Field(None, description="範例")
    
    supported_models: Optional[List[str]] = Field(None, description="支援的模型")
    default_model: Optional[str] = Field(None, description="預設模型")
    tags: Optional[List[str]] = Field(None, description="標籤")
    
    is_system: bool = Field(False, description="是否為系統預設")

    class Config:
        populate_by_name = True


class PromptUpdate(BaseModel):
    """更新 Prompt 基本資訊"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    category: Optional[str] = None
    generation_type: Optional[str] = None
    supported_models: Optional[List[str]] = None
    default_model: Optional[str] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None
    is_public: Optional[bool] = None


class VersionCreate(BaseModel):
    """創建新版本"""
    positive_template: str = Field(..., min_length=1)
    negative_template: Optional[str] = None
    model_config_data: Optional[Dict[str, Any]] = Field(None, alias="model_config")
    variables: Optional[List[Dict[str, Any]]] = None
    system_prompt: Optional[str] = None
    output_format: Optional[Dict[str, Any]] = None
    examples: Optional[List[Dict[str, Any]]] = None
    version_tag: Optional[str] = None
    changelog: Optional[str] = None
    set_as_current: bool = Field(True, description="是否設為當前版本")

    class Config:
        populate_by_name = True


class RenderRequest(BaseModel):
    """渲染請求"""
    variables: Dict[str, Any] = Field(..., description="變數值")
    version_id: Optional[int] = Field(None, description="指定版本（空則使用當前版本）")


class UsageRating(BaseModel):
    """使用評分"""
    rating: int = Field(..., ge=1, le=5, description="評分 1-5")
    feedback: Optional[str] = Field(None, description="文字回饋")


# ========== Response ==========

class PromptResponse(BaseModel):
    """Prompt 回應"""
    id: int
    name: str
    slug: str
    description: Optional[str]
    category: str
    generation_type: str
    supported_models: List[str]
    default_model: Optional[str]
    tags: List[str]
    usage_count: int
    is_active: bool
    is_system: bool
    is_public: bool
    current_version_id: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class VersionResponse(BaseModel):
    """版本回應"""
    id: int
    prompt_id: int
    version_number: int
    version_tag: Optional[str]
    positive_template: str
    negative_template: Optional[str]
    model_config_data: Dict[str, Any] = Field(alias="model_config")
    variables: List[Dict[str, Any]]
    system_prompt: Optional[str]
    output_format: Dict[str, Any]
    examples: List[Dict[str, Any]]
    changelog: Optional[str]
    is_active: bool
    is_draft: bool
    avg_rating: float
    total_ratings: int
    created_at: datetime

    model_config = {
        "from_attributes": True,
        "populate_by_name": True,
        "by_alias": True,  # 序列化時使用 alias
    }


class PromptDetailResponse(PromptResponse):
    """Prompt 詳細回應（含當前版本）"""
    current_version: Optional[VersionResponse] = None


class RenderResponse(BaseModel):
    """渲染結果"""
    prompt_id: int
    prompt_name: str
    version_id: int
    version_number: int
    generation_type: str
    model_configuration: Dict[str, Any] = Field(alias="model_config")
    rendered: Dict[str, Optional[str]]
    output_format: Dict[str, Any]

    class Config:
        populate_by_name = True


# ============================================================
# API Endpoints
# ============================================================

# ========== Prompt CRUD ==========

@router.post("", response_model=PromptResponse, status_code=status.HTTP_201_CREATED)
async def create_prompt(
    request: PromptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)  # 需要管理員權限
):
    """
    創建新的 Prompt（需要管理員權限）
    """
    prompt = await prompt_service.create_prompt(
        db=db,
        name=request.name,
        category=request.category,
        generation_type=request.generation_type,
        positive_template=request.positive_template,
        negative_template=request.negative_template,
        model_config=request.model_config_data,
        variables=request.variables,
        description=request.description,
        supported_models=request.supported_models,
        default_model=request.default_model,
        tags=request.tags,
        system_prompt=request.system_prompt,
        output_format=request.output_format,
        examples=request.examples,
        is_system=request.is_system,
        created_by=current_user.id
    )
    return prompt


@router.get("", response_model=Dict[str, Any])
async def list_prompts(
    category: Optional[str] = Query(None, description="分類篩選"),
    generation_type: Optional[str] = Query(None, description="生成類型篩選"),
    tags: Optional[str] = Query(None, description="標籤篩選（逗號分隔）"),
    search: Optional[str] = Query(None, description="搜尋關鍵字"),
    is_active: bool = Query(True, description="是否只顯示啟用的"),
    is_system: Optional[bool] = Query(None, description="是否為系統預設"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("updated_at", description="排序欄位"),
    sort_order: str = Query("desc", description="排序方向: asc, desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    列出 Prompts（支援分頁、篩選、排序）
    """
    tag_list = tags.split(",") if tags else None
    
    result = await prompt_service.list_prompts(
        db=db,
        category=category,
        generation_type=generation_type,
        tags=tag_list,
        search=search,
        is_active=is_active,
        is_system=is_system,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order
    )
    
    # 為每個 Prompt 附加當前版本資訊
    items = []
    for p in result["items"]:
        prompt_data = PromptResponse.model_validate(p).model_dump()
        # 獲取當前版本資訊
        if p.current_version_id:
            current_version = await prompt_service.get_version(db, p.current_version_id)
            if current_version:
                prompt_data["current_version"] = VersionResponse.model_validate(current_version).model_dump(by_alias=True)
        items.append(prompt_data)
    
    return {
        "items": items,
        "total": result["total"],
        "page": result["page"],
        "page_size": result["page_size"],
        "total_pages": result["total_pages"]
    }


@router.get("/categories")
async def get_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取所有分類
    """
    return {
        "categories": [
            {"id": "social_media", "name": "社群媒體文案", "icon": "📱"},
            {"id": "blog", "name": "部落格文章", "icon": "📝"},
            {"id": "marketing", "name": "行銷文案", "icon": "📣"},
            {"id": "product", "name": "產品描述", "icon": "🛍️"},
            {"id": "video_script", "name": "影片腳本", "icon": "🎬"},
            {"id": "image_prompt", "name": "圖片生成", "icon": "🎨"},
            {"id": "video_prompt", "name": "影片生成", "icon": "🎥"},
            {"id": "tts_prompt", "name": "語音合成", "icon": "🎙️"},
        ],
        "generation_types": [
            {"id": "copywriting", "name": "文案生成", "icon": "✍️"},
            {"id": "image", "name": "圖片生成", "icon": "🖼️"},
            {"id": "video", "name": "影片生成", "icon": "📹"},
            {"id": "tts", "name": "語音合成", "icon": "🔊"},
        ]
    }


@router.get("/{prompt_id}", response_model=PromptDetailResponse)
async def get_prompt(
    prompt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取單一 Prompt 詳情（含當前版本）
    """
    prompt = await prompt_service.get_prompt(db, prompt_id=prompt_id)
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    # 獲取當前版本
    current_version = None
    if prompt.current_version_id:
        current_version = await prompt_service.get_version(db, prompt.current_version_id)
    
    response = PromptDetailResponse.model_validate(prompt)
    if current_version:
        response.current_version = VersionResponse.model_validate(current_version)
    
    return response


@router.get("/slug/{slug}", response_model=PromptDetailResponse)
async def get_prompt_by_slug(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    通過 slug 獲取 Prompt
    """
    prompt = await prompt_service.get_prompt(db, slug=slug)
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    current_version = None
    if prompt.current_version_id:
        current_version = await prompt_service.get_version(db, prompt.current_version_id)
    
    response = PromptDetailResponse.model_validate(prompt)
    if current_version:
        response.current_version = VersionResponse.model_validate(current_version)
    
    return response


@router.put("/{prompt_id}", response_model=PromptResponse)
async def update_prompt(
    prompt_id: int,
    request: PromptUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """
    更新 Prompt 基本資訊（需要管理員權限）
    """
    prompt = await prompt_service.update_prompt(
        db=db,
        prompt_id=prompt_id,
        **request.model_dump(exclude_none=True)
    )
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return prompt


@router.delete("/{prompt_id}")
async def delete_prompt(
    prompt_id: int,
    soft_delete: bool = Query(True, description="軟刪除（停用）或硬刪除"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """
    刪除 Prompt（需要管理員權限）
    """
    success = await prompt_service.delete_prompt(db, prompt_id, soft_delete)
    if not success:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return {"message": "Prompt deleted successfully"}


# ========== 版本管理 ==========

@router.get("/{prompt_id}/versions", response_model=List[VersionResponse])
async def list_versions(
    prompt_id: int,
    include_drafts: bool = Query(False, description="是否包含草稿"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    列出 Prompt 的所有版本
    """
    versions = await prompt_service.list_versions(db, prompt_id, include_drafts)
    return [VersionResponse.model_validate(v) for v in versions]


@router.post("/{prompt_id}/versions", response_model=VersionResponse, status_code=status.HTTP_201_CREATED)
async def create_version(
    prompt_id: int,
    request: VersionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """
    創建新版本（需要管理員權限）
    """
    version = await prompt_service.create_version(
        db=db,
        prompt_id=prompt_id,
        positive_template=request.positive_template,
        negative_template=request.negative_template,
        model_config=request.model_config_data,
        variables=request.variables,
        system_prompt=request.system_prompt,
        output_format=request.output_format,
        examples=request.examples,
        version_tag=request.version_tag,
        changelog=request.changelog,
        created_by=current_user.id,
        set_as_current=request.set_as_current
    )
    if not version:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return version


@router.get("/{prompt_id}/versions/{version_id}", response_model=VersionResponse)
async def get_version(
    prompt_id: int,
    version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取特定版本
    """
    version = await prompt_service.get_version(db, version_id)
    if not version or version.prompt_id != prompt_id:
        raise HTTPException(status_code=404, detail="Version not found")
    return version


@router.put("/{prompt_id}/current-version")
async def set_current_version(
    prompt_id: int,
    version_id: int = Query(..., description="要設為當前的版本 ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """
    設定當前生效版本（回滾功能）
    """
    success = await prompt_service.set_current_version(db, prompt_id, version_id)
    if not success:
        raise HTTPException(status_code=404, detail="Prompt or version not found")
    return {"message": "Current version updated successfully"}


@router.get("/{prompt_id}/versions/compare")
async def compare_versions(
    prompt_id: int,
    version_1: int = Query(..., description="版本 1 ID"),
    version_2: int = Query(..., description="版本 2 ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    比較兩個版本的差異
    """
    result = await prompt_service.compare_versions(db, version_1, version_2)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


# ========== Prompt 渲染 ==========

@router.post("/{prompt_id}/render", response_model=RenderResponse)
async def render_prompt(
    prompt_id: int,
    request: RenderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    渲染 Prompt（變數替換）
    """
    result = await prompt_service.get_rendered_prompt(
        db=db,
        prompt_id=prompt_id,
        variables=request.variables,
        version_id=request.version_id
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result


# ========== 使用記錄與統計 ==========

@router.get("/{prompt_id}/stats")
async def get_usage_stats(
    prompt_id: int,
    days: int = Query(30, ge=1, le=365, description="統計天數"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取 Prompt 使用統計
    """
    stats = await prompt_service.get_usage_stats(db, prompt_id, days)
    return stats


@router.post("/usage/{usage_log_id}/rate")
async def rate_usage(
    usage_log_id: int,
    request: UsageRating,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    對使用結果評分
    """
    success = await prompt_service.rate_usage(
        db=db,
        usage_log_id=usage_log_id,
        rating=request.rating,
        feedback=request.feedback
    )
    if not success:
        raise HTTPException(status_code=404, detail="Usage log not found")
    return {"message": "Rating submitted successfully"}
@router.post("/seed/v3")
async def seed_v3_prompts(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """
    註冊短影音 3.0 相關的系統 Prompt
    """
    from app.services.prompt_service import prompt_service
    
    results = []
    
    # 1. Short Video 3.0 - Text to Video Background Prompt
    v3_t2v = await prompt_service.create_prompt(
        db=db,
        name="Short Video 3.0 (T2V) Background",
        category="video_prompt",
        generation_type="video",
        description="精準控制短影片 3.0 的場景生成與解剖學正確性",
        positive_template="""你是一位專業的短影音導演與編劇。用戶會給你一段文字主題，請將它轉化為 {{scenes_count}} 個場景的短影音腳本。

重要規則：
- **解剖學正確**：人物必須具備正常的生理結構，嚴禁多手、多腳、斷頭、或身體撕裂。
- **電影級質感**：在 visualPrompt 中始終包含 "Hyper-realistic", "Cinematic 8k", "Highly detailed anatomy", "Perfect limbs" 等核心提示。
- **動態穩定性**：描述清晰、合理的物理運動。

每個場景需要包含：narration, visualPrompt, cameraMove, transition, type。
風格模板: {{style_id}}, 總長: {{duration}}s, 比例: {{aspect_ratio}}
嚴格以 JSON 陣列格式回覆。""",
        variables=[
            {"name": "scenes_count", "label": "場景數量", "type": "number", "default": 3},
            {"name": "style_id", "label": "風格模板", "type": "text", "default": "cinematic"},
            {"name": "duration", "label": "影片總長", "type": "number", "default": 15},
            {"name": "aspect_ratio", "label": "比例", "type": "text", "default": "9:16"}
        ],
        slug="short-video-v3-t2v",
        is_system=True,
        created_by=current_admin.id
    )
    results.append(v3_t2v.name)

    # 2. Short Video 3.0 - Image to Video Background Prompt
    v3_i2v = await prompt_service.create_prompt(
        db=db,
        name="Short Video 3.0 (I2V) Background",
        category="video_prompt",
        generation_type="video",
        description="以參考圖片為核心的短影片 3.0 生成邏輯",
        positive_template="""你是一位專業的影片動態導演。用戶會給你一段描述，以及一張參考圖片的概念。請基於這張圖片，生成 {{scenes_count}} 個場景的短影音腳本，讓圖片「動起來」。

重要規則：
- 每個場景應該呈現圖片中不同角度、不同動態的變化
- visualPrompt 必須包含 "reference image" 的元素描述
- 動態應該自然流暢，像電影鏡頭掃描一張照片
- **人像維持原則**：人物必須具備正常的解剖學特徵（如：恰好兩隻手臂、兩條腿、一個頭）。
- **禁止幻象**：嚴禁生成多肢體、斷頭、或分裂的人像描述。
- **高品質渲染詞**：在 visualPrompt 加入如 "cinematic lighting", "high detail", "stable motion", "8k resolution" 等詞彙。

每個場景需要包含：narration, visualPrompt, cameraMove, transition, type。
風格模板: {{style_id}}, 總長: {{duration}}s, 比例: {{aspect_ratio}}
嚴格以 JSON 陣列格式回覆。""",
        variables=[
            {"name": "scenes_count", "label": "場景數量", "type": "number", "default": 3},
            {"name": "style_id", "label": "風格模板", "type": "text", "default": "cinematic"},
            {"name": "duration", "label": "影片總長", "type": "number", "default": 15},
            {"name": "aspect_ratio", "label": "比例", "type": "text", "default": "9:16"}
        ],
        slug="short-video-v3-i2v",
        is_system=True,
        created_by=current_admin.id
    )
    results.append(v3_i2v.name)

    # 3. Short Video 3.0 - Speech to Video Background Prompt
    v3_s2v = await prompt_service.create_prompt(
        db=db,
        name="Short Video 3.0 (S2V) Background",
        category="video_prompt",
        generation_type="video",
        description="以語音為驅動的短影片 3.0 生成邏輯",
        positive_template="""你是一位專業的語音驅動影片導演。用戶會給你一段語音/對話的描述，請生成 {{scenes_count}} 個場景的短影音腳本。

重要規則：
- 旁白文字即為語音內容，需要自然朗讀感
- visualPrompt 要包含角色的表情、動作、口型同步效果
- 場景應該配合語音情緒變化
- **人物完整性**：確保人物四肢健全，比例正確，嚴禁多肢或畸形描述。
- **背景穩定**：背景應維持連貫，避免閃爍或不自然的空間扭曲。

每個場景需要包含：narration, visualPrompt, cameraMove, transition, type, emotion。
風格模板: {{style_id}}, 總長: {{duration}}s, 比例: {{aspect_ratio}}
嚴格以 JSON 陣列格式回覆。""",
        variables=[
            {"name": "scenes_count", "label": "場景數量", "type": "number", "default": 3},
            {"name": "style_id", "label": "風格模板", "type": "text", "default": "cinematic"},
            {"name": "duration", "label": "影片總長", "type": "number", "default": 15},
            {"name": "aspect_ratio", "label": "比例", "type": "text", "default": "9:16"}
        ],
        slug="short-video-v3-s2v",
        is_system=True,
        created_by=current_admin.id
    )
    results.append(v3_s2v.name)

    # 4. Short Video 3.0 - Quality Modifiers
    v3_quality = await prompt_service.create_prompt(
        db=db,
        name="Short Video 3.0 Quality Modifiers",
        category="video_prompt",
        generation_type="video",
        description="強制注入於所有 V3 影片生成的質量詞與負面詞",
        positive_template="masterpiece, best quality, highly detailed, ultra-realistic, cinematic, 8k resolution, perfect anatomy",
        negative_template="(deformed iris, deformed pupils, semi-realistic, cgi, 3d, render, sketch, cartoon, drawing, anime:1.4), text, close up, cropped, out of frame, worst quality, low quality, jpeg artifacts, ugly, duplicate, morbid, mutilated, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, deformed, dehydrated, bad anatomy, bad proportions, extra limbs, cloned face, disfigured, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers, long neck",
        variables=[],
        slug="short-video-v3-quality",
        is_system=True,
        created_by=current_admin.id
    )
    results.append(v3_quality.name)

    return {"status": "ok", "seeded": results}
