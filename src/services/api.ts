import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from '@/types';
import { getAccessToken, getRefreshToken, setSessionTokens } from '@/services/authSession';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

const api = axios.create({
  baseURL: apiBaseUrl || undefined,
  timeout: 15000,
  headers: { Accept: 'application/json' },
});

api.interceptors.request.use(config => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

type RetryConfig = InternalAxiosRequestConfig & { _mastRetried?: boolean };
let refreshing: Promise<string> | null = null;
api.interceptors.response.use(response => response, async (error: AxiosError) => {
  const config = error.config as RetryConfig | undefined;
  const refreshToken = getRefreshToken();
  const status = error.response?.status;
  const isAuthRequest = /\/auth\/(login|register|refresh|logout)/.test(config?.url ?? '');
  if (status !== 401 || !config || config._mastRetried || isAuthRequest || !refreshToken || !apiBaseUrl) throw error;
  config._mastRetried = true;
  refreshing ??= axios.post(`${apiBaseUrl.replace(/\/$/, '')}/auth/refresh`, { refresh_token: refreshToken }, { timeout: 15000 })
    .then(response => {
      const tokens = response.data as { access_token: string; refresh_token: string };
      setSessionTokens(tokens.access_token, tokens.refresh_token);
      return tokens.access_token;
    })
    .catch(reason => { setSessionTokens(null, null); if (typeof window !== 'undefined') window.location.assign('/login'); throw reason; })
    .finally(() => { refreshing = null; });
  const token = await refreshing;
  config.headers.Authorization = `Bearer ${token}`;
  return api.request(config);
});

export function toApiError(error: unknown): ApiError {
  if (!axios.isAxiosError(error)) {
    if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
      return { message: error.message, code: 'code' in error && typeof error.code === 'string' ? error.code : undefined, status: 'status' in error && typeof error.status === 'number' ? error.status : undefined };
    }
    return { message: 'Something went wrong. Please try again.' };
  }

  const axiosError = error as AxiosError;
  const status = axiosError.response?.status;

  if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
    return { message: 'The request took too long. Please try again.', code: axiosError.code, status };
  }

  if (!axiosError.response) {
    return { message: 'Could not connect to the MAST service. Check the connection and try again.', code: axiosError.code };
  }
  const responseDetail = (axiosError.response.data as { detail?: unknown } | undefined)?.detail;
  const safeDetail = typeof responseDetail === 'string' && responseDetail.length <= 200 ? responseDetail : undefined;
  const message = status === 401 ? 'Your session may have expired. Please sign in again.'
    : status === 403 ? 'You do not have permission to access this information.'
    : status === 404 ? 'The requested item could not be found.'
    : status === 409 ? (safeDetail?.toLowerCase().includes('already been uploaded') ? 'This exact package was already uploaded to this application.' : 'This request conflicts with the current resource state.')
    : status === 413 ? 'The selected package exceeds the server upload limit.'
    : status === 415 ? 'The server rejected this file type or package format.'
    : status === 400 && safeDetail ? safeDetail
    : status !== undefined && status >= 500 ? 'The MAST service encountered a problem. Please try again later.'
    : 'The request could not be completed. Please check the information and try again.';
  return { message, code: axiosError.code, status };
}

export function isMockMode(): boolean {
  return import.meta.env.VITE_USE_MOCK_DATA?.trim().toLowerCase() !== 'false';
}

export function getApiBaseUrl(): string | undefined { return apiBaseUrl; }

export function assertApiConfigured(): void {
  if (!apiBaseUrl) {
    throw { message: 'Set VITE_API_BASE_URL to use API mode.' } satisfies ApiError;
  }
}

export default api;
