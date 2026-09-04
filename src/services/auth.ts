// ── Auth API Service (SimpleJWT) ──────────────────────────────────

import { apiRequest, setTokens, clearTokens, getAccessToken } from './api';
import type { LoginResponse, RegisterResponse, RefreshResponse, User } from '../types';

/**
 * Login with email + password. Stores JWT tokens in SecureStore.
 * POST /api/v1/auth/login/
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const data = await apiRequest<LoginResponse>({
    method: 'POST',
    url: '/auth/login/',
    data: { email, password },
  });
  await setTokens(data.access, data.refresh);
  return data;
}

/**
 * Register a new account. Stores JWT tokens on success.
 * POST /api/v1/auth/register/
 */
export async function register(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  phone?: string
): Promise<RegisterResponse> {
  const data = await apiRequest<RegisterResponse>({
    method: 'POST',
    url: '/auth/register/',
    data: {
      email,
      password,
      password2: password,
      first_name: firstName,
      last_name: lastName,
      phone: phone || '',
    },
  });
  await setTokens(data.access, data.refresh);
  return data;
}

/**
 * Refresh the access token using the stored refresh token.
 * POST /api/v1/auth/refresh/
 */
export async function refreshToken(refresh: string): Promise<RefreshResponse> {
  return apiRequest<RefreshResponse>({
    method: 'POST',
    url: '/auth/refresh/',
    data: { refresh },
  });
}

/**
 * Logout — clears stored tokens.
 */
export async function logout(): Promise<void> {
  await clearTokens();
}

/**
 * Get current user profile.
 * GET /api/v1/auth/profile/
 */
export async function getProfile(): Promise<User> {
  return apiRequest<User>({ method: 'GET', url: '/auth/profile/' });
}

/**
 * Update current user profile.
 * PATCH /api/v1/auth/profile/
 */
export async function updateProfile(data: Partial<Pick<User, 'first_name' | 'last_name' | 'phone'>>): Promise<User> {
  return apiRequest<User>({ method: 'PATCH', url: '/auth/profile/', data });
}

/**
 * Check if the user is authenticated (has a stored access token).
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getAccessToken();
  return token !== null;
}
