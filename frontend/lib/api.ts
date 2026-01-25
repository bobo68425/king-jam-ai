import axios from 'axios';

// API 基礎網址（支援環境變數配置）
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// 建立 axios 實例
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 請求攔截器：自動帶上 Token
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