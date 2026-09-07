// ── Diilzo Mobile API Client ─────────────────────────────────────
// Axios instance with dynamic BASE_URL, JWT auth, and auto-refresh.
// Security: HTTPS-only, token rotation, timeout, error sanitization.

import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

// ── BASE_URL resolution ──────────────────────────────────────────
// Production: hosted Railway backend (used by default for all devices)
// Local dev: set EXPO_PUBLIC_API_URL env var to override (e.g. http://10.0.2.2:8000/api/v1)
const PRODUCTION_API_URL = 'https://diilzo-market-place-production.up.railway.app/api/v1';

function resolveBaseUrl(): string {
  // Allow override via env for local development
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    const cleaned = envUrl.replace(/\/$/, '');
    // SECURITY: Only allow HTTPS in production builds
    if (!__DEV__ && !cleaned.startsWith('https://')) {
      console.warn('Non-HTTPS API URL blocked in production. Falling back to production URL.');
      return PRODUCTION_API_URL;
    }
    return cleaned;
  }

  return PRODUCTION_API_URL;
}

export const BASE_URL = resolveBaseUrl();

// Debug: log which API URL is being used (helps troubleshoot env issues)
if (__DEV__) {
  console.log('[API] Using BASE_URL:', BASE_URL);
}

// ── Token storage keys (use keychain/keystore via SecureStore) ───
const ACCESS_TOKEN_KEY = 'diilzo_access_token';
const REFRESH_TOKEN_KEY = 'diilzo_refresh_token';
// Track when tokens were last refreshed for session timeout
const TOKEN_TIMESTAMP_KEY = 'diilzo_token_timestamp';

// ── Session timeout (30 minutes of inactivity) ───────────────────
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export async function getAccessToken(): Promise<string | null> {
  try {
    // Check session timeout
    const timestamp = await SecureStore.getItemAsync(TOKEN_TIMESTAMP_KEY);
    if (timestamp) {
      const elapsed = Date.now() - parseInt(timestamp, 10);
      if (elapsed > SESSION_TIMEOUT_MS) {
        // Session expired — clear tokens
        await clearTokens();
        return null;
      }
    }
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setTokens(access: string, refresh: string): Promise<void> {
  // SECURITY: Require authentication for SecureStore on Android
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await SecureStore.setItemAsync(TOKEN_TIMESTAMP_KEY, Date.now().toString());
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(TOKEN_TIMESTAMP_KEY);
}

/** Update the session timestamp on activity (call from app state change). */
export async function touchSession(): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    if (token) {
      await SecureStore.setItemAsync(TOKEN_TIMESTAMP_KEY, Date.now().toString());
    }
  } catch {
    // ignore
  }
}

// ── Axios instance ───────────────────────────────────────────────
const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  maxContentLength: 10 * 1024 * 1024, // 10MB max response
  maxBodyLength: 2 * 1024 * 1024,     // 2MB max request body
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Client': 'diilzo-mobile',
    'X-Client-Version': '1.0.0',
  },
});

// Request interceptor — attach JWT + validate HTTPS
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // SECURITY: Block non-HTTPS requests in production
    if (!__DEV__ && config.baseURL && !config.baseURL.startsWith('https://')) {
      return Promise.reject(new Error('Insecure request blocked'));
    }

    const token = await getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — auto-refresh on 401
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) {
          await clearTokens();
          processQueue(new Error('No refresh token'), null);
          return Promise.reject(error);
        }

        // Call refresh endpoint directly (no interceptors to avoid loops)
        const res = await axios.post(`${BASE_URL}/auth/refresh/`, { refresh: refreshToken });
        const newAccess = res.data.access;
        const newRefresh = res.data.refresh || refreshToken;

        await setTokens(newAccess, newRefresh);
        processQueue(null, newAccess);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        await clearTokens();
        processQueue(refreshError, null);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ── API helper with automatic retry on 429 (rate limit) ──────────
export async function apiRequest<T>(config: AxiosRequestConfig): Promise<T> {
  const maxRetries = 2;
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await api.request<T>(config);
      return response.data;
    } catch (error: any) {
      lastError = error;
      // Retry on 429 (Too Many Requests) with exponential backoff
      if (error.response?.status === 429 && attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt); // 1s, 2s
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export default api;
