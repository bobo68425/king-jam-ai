import useSWR, { SWRConfiguration } from 'swr';
import api from './api';

const defaultOptions: SWRConfiguration = {
  revalidateOnFocus: false,
  shouldRetryOnError: false,
};

export function useUser(options?: SWRConfiguration) {
  const { data, error, isLoading, mutate } = useSWR(
    '/auth/me',
    (url) => api.get(url).then((res) => res.data),
    { ...defaultOptions, ...options }
  );
  return {
    user: data,
    isLoading,
    isError: error,
    mutate,
  };
}

export function useCredits(options?: SWRConfiguration) {
  const { data, error, isLoading, mutate } = useSWR(
    '/credits/balance',
    (url) => api.get(url).then((res) => res.data),
    { ...defaultOptions, dedupingInterval: 60000, ...options }
  );
  return {
    credits: data,
    isLoading,
    isError: error,
    mutate,
  };
}

export function useReferralStats(options?: SWRConfiguration) {
  const { data, error, isLoading, mutate } = useSWR(
    '/referral/stats',
    (url) => api.get(url).then((res) => res.data),
    { ...defaultOptions, ...options }
  );
  return {
    stats: data,
    isLoading,
    isError: error,
    mutate,
  };
}

export function useUsageStats(days: number = 30, options?: SWRConfiguration) {
  const { data, error, isLoading, mutate } = useSWR(
    `/credits/usage-stats?days=${days}`,
    (url) => api.get(url).then((res) => res.data),
    { ...defaultOptions, ...options }
  );
  return {
    usage: data,
    isLoading,
    isError: error,
    mutate,
  };
}

export function useExpiringCredits(options?: SWRConfiguration) {
  const { data, error, isLoading, mutate } = useSWR(
    '/credits/expiring',
    (url) => api.get(url).then((res) => res.data),
    { ...defaultOptions, ...options }
  );
  return {
    expiring: data,
    isLoading,
    isError: error,
    mutate,
  };
}

export function useRecentHistory(limit: number = 5, options?: SWRConfiguration) {
  const { data, error, isLoading, mutate } = useSWR(
    `/history?limit=${limit}`,
    (url) => api.get(url).then((res) => res.data),
    { ...defaultOptions, ...options }
  );
  return {
    history: data?.items || [],
    isLoading,
    isError: error,
    mutate,
  };
}

export function useUpcomingPosts(limit: number = 5, options?: SWRConfiguration) {
  const { data, error, isLoading, mutate } = useSWR(
    `/scheduler/posts?status=pending&limit=${limit}`,
    (url) => api.get(url).then((res) => res.data),
    { ...defaultOptions, ...options }
  );
  return {
    posts: Array.isArray(data) ? data : [],
    isLoading,
    isError: error,
    mutate,
  };
}

export function useSocialAccounts(options?: SWRConfiguration) {
  const { data, error, isLoading, mutate } = useSWR(
    '/scheduler/accounts',
    (url) => api.get(url).then((res) => res.data),
    { ...defaultOptions, ...options }
  );
  return {
    accounts: Array.isArray(data) ? data : [],
    isLoading,
    isError: error,
    mutate,
  };
}

export function useNotifications(limit: number = 10, options?: SWRConfiguration) {
  const { data, error, isLoading, mutate } = useSWR(
    `/notifications?limit=${limit}&navbar_only=true`,
    (url) => api.get(url).then((res) => res.data),
    { ...defaultOptions, dedupingInterval: 30000, ...options }
  );
  return {
    notifications: data?.notifications || [],
    unreadCount: data?.unread_count || 0,
    isLoading,
    isError: error,
    mutate,
  };
}

export function useDashboardSummary(options?: SWRConfiguration) {
  const { data, error, isLoading, mutate } = useSWR(
    '/dashboard/summary',
    (url) => api.get(url).then((res) => res.data),
    { ...defaultOptions, dedupingInterval: 30000, ...options }
  );
  return {
    summary: data,
    isLoading,
    isError: error,
    mutate,
  };
}