# King Jam AI 效能與成本優化計劃

## 執行摘要

| 項目 | 預期改善 | 成本節省 |
|-----|---------|---------|
| 頁面載入速度 | 提升 40-60% | - |
| API 回應時間 | 降低 30-50% | - |
| 基礎設施成本 | - | $20-30/月 |

---

## 優化階段

### Phase 1: 前端效能優化 (1-2 天)

#### 1.1 安裝 SWR 資料快取
```bash
cd frontend && npm install swr
```

#### 1.2 建立統一 API Hooks
```typescript
// frontend/lib/use-api.ts
import useSWR from 'swr';
import api from './api';

export function useUser() {
  return useSWR('/auth/me', { 
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  });
}

export function useCredits() {
  return useSWR('/credits/balance', {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });
}

export function useDashboard() {
  return useSWR('/dashboard/summary', {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  });
}
```

#### 1.3 優化 Dashboard Layout
- 改用 SWR 替代 `useEffect` + `fetch`
- 消除重複 API 請求
- 減少 7 個 API 調用 → 1-2 個

#### 1.4 優化 Dashboard 主頁
- 使用 SWR 鉤子
- 添加 loading skeleton
- 合併 API 響應資料

#### 1.5 前端其他優化
- 移除 `@ts-nocheck` 並修復類型問題
- 考慮添加 React.lazy 延遲載入非必要元件

---

### Phase 2: 後端效能優化 (1-2 天)

#### 2.1 合併 API Endpoint (高優先)
```python
# backend/app/routers/dashboard.py (新增)
@router.get("/dashboard/summary")
def get_dashboard_summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """合併多個 API 為單一響應"""
    user = db.query(User).filter(User.id == current_user.id).first()
    # ... 一次回傳所有資料
```

#### 2.2 資料庫連接池優化
```python
# backend/app/database.py
POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "10"))  # 從 5 提升到 10
MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "20"))  # 從 10 提升到 20
```

#### 2.3 添加熱門查詢快取
```python
# 使用 Redis 快取用戶資料，TTL 5 分鐘
# 位置: credits, referral/stats 等熱門 endpoint
```

#### 2.4 修復程式碼問題
- 移除 `main.py` 中的硬編碼管理員郵箱
- 合併重複的天使修復 SQL

---

### Phase 3: 基礎設施優化 (2-3 天)

#### 3.1 合併 Celery Workers
```yaml
# docker-compose.yml
celery-worker:
  command: >
    celery -A app.celery_app worker 
    -Q queue_high,queue_default,queue_video 
    -c 3 
    -l info
```

```python
# backend/app/celery_app.py
celery_app.conf.task_routes = {
    'app.tasks.verification.*': {'queue': 'queue_high'},
    'app.tasks.scheduler.*': {'queue': 'queue_default'},
    'app.tasks.video.*': {'queue': 'queue_video'},
}
```

#### 3.2 移除或優化 Video Engine
- 若影片處理已使用 Replicate API，可考慮移除自建 Video Engine
- 或改用無伺服器方式 (Modal/Render) 降低成本

#### 3.3 資料庫遷移 (可選)
- 評估 Railway → Neon/Supabase (若流量低)
- 預估節省: $5/月

---

### Phase 4: 監控與長期維護 (持續)

#### 4.1 添加效能監控
- Sentry 已配置 (加強追蹤)
- 添加 API 響應時間 metrics

#### 4.2 建立效能基準
- Lighthouse 定期測試
- API 響應時間監控

---

## 詳細時程

| 階段 | 任務 | 天數 | 優先級 |
|-----|------|-----|-------|
| Phase 1 | 安裝 SWR + 建立鉤子 | 0.5 | P0 |
| Phase 1 | Dashboard Layout 優化 | 0.5 | P0 |
| Phase 1 | Dashboard 頁面優化 | 0.5 | P0 |
| Phase 2 | 合併 API Endpoint | 1 | P0 |
| Phase 2 | DB 連接池優化 | 0.5 | P1 |
| Phase 2 | 修復程式碼問題 | 0.5 | P1 |
| Phase 3 | 合併 Celery Workers | 1 | P1 |
| Phase 3 | 評估 Video Engine | 1 | P2 |
| Phase 4 | 效能監控 | 持續 | P2 |

---

## 預期成果

### 效能提升
- 首頁載入: 3-5s → 1-2s (60% 提升)
- Dashboard API: 7 請求 → 1 請求
- 通知輪詢: 30s → 60s (減少負載)

### 成本節省
- Celery instances: 3 → 1 (節省資源)
- 可選: Video Engine 移除 ($10/月)
- 可選: DB 遷移 ($5/月)

**總節省: $20-30/月**

---

## 待辦清單

- [x] Phase 1.1: 安裝 SWR
- [x] Phase 1.2: 建立 use-api.ts 鉤子
- [x] Phase 1.3: 優化 dashboard/layout.tsx
- [x] Phase 1.4: 優化 dashboard/page.tsx
- [x] Phase 2.1: 新增 /dashboard/summary API
- [x] Phase 2.2: DB 連接池優化 (5→10, 10→20)
- [x] Phase 2.3: 修復 main.py 硬編碼問題 (ADMIN_EMAIL, REPAIR_CODE)
- [x] Phase 3.1: 合併 Celery Workers (3→1 + video)