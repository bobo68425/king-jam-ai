import axios from 'axios';

// API 基礎網址（支援環境變數配置）
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// AI 生成類的端點需要更長的超時時間（影片渲染可能需要 60-180 秒）
const AI_GENERATE_PATHS = [
  '/social/generate',
  '/api/design-studio/generate-image',
  '/api/design-studio/remove-background',
  '/video/generate',
  '/video/render',
  '/video/preview',
  '/video/render-preview',
  '/blog/generate',
  '/video/v3/render',
];

// LTX / v3 生成路徑需要超長 timeout（cold start + 生成約 5-8 分鐘）
const LTX_LONG_TIMEOUT_PATHS = [
  '/video/v3/api/generate-clips',
  '/video/v3/api/generate-video',
  '/video/v3/warmup-ltx',
];

// 建立 axios 實例
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,  // 一般請求 30 秒
  headers: {
    'Content-Type': 'application/json',
  },
});

// 請求攔截器：自動帶上 Token + AI 端點加長超時
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token'); // 從瀏覽器儲存區拿 Token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  // 如果是 FormData，移除 Content-Type 讓瀏覽器自動設置（包含 boundary）
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  // LTX / v3 end全生成端點使用 10 分鐘超時（cold start + 生成）
  const url = config.url || '';
  if (LTX_LONG_TIMEOUT_PATHS.some(path => url.includes(path))) {
    config.timeout = 600000; // 10 分鐘
  } else if (AI_GENERATE_PATHS.some(path => url.includes(path))) {
    // AI 生成端點使用更長的超時時間（180 秒）
    config.timeout = 180000;
  }

  return config;
});

// 響應攔截器：處理 401 錯誤（未授權）
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token 無效或過期
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        // 如果有 token 但仍然 401，表示 token 過期
        if (token) {
          console.warn('[API] Token 已過期，需要重新登入');
          localStorage.removeItem('token');
          // 設置一個標記讓頁面知道是因為過期而重定向
          sessionStorage.setItem('session_expired', 'true');
        }
        // 避免在登入頁面和 Modal 操作中重定向
        if (window.location.pathname !== '/login') {
          // 延遲重定向，讓錯誤訊息有時間顯示
          setTimeout(() => {
            window.location.href = '/login';
          }, 1500);
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;