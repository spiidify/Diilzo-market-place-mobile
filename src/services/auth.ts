// ── Auth API Service (SimpleJWT) ──────────────────────────────────

import type { LoginResponse, RefreshResponse, RegisterResponse, User } from '../types';
import { apiRequest, clearTokens, getAccessToken, setTokens } from './api';

/**
 * Login with email + password. Stores JWT tokens in SecureStore.
 * POST /api/v1/auth/login/
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const data = await apiRequest<LoginResponse & { requires_2fa?: boolean }>({
    method: 'POST',
    url: '/auth/login/',
    data: { email, password },
  });
  if (data.requires_2fa) {
    throw new Error('This account has two-factor authentication enabled. Please sign in with email/phone to receive a code.');
  }
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
export async function getProfile(
  imageSize?: { width: number; height: number }
): Promise<User> {
  return apiRequest<User>({ method: 'GET', url: '/auth/profile/', params: imageSize });
}

/**
 * Update current user profile.
 * PATCH /api/v1/auth/profile/
 */
export async function updateProfile(data: Partial<Pick<User, 'first_name' | 'last_name' | 'phone'>>): Promise<User> {
  return apiRequest<User>({ method: 'PATCH', url: '/auth/profile/', data });
}

/**
 * Update profile with avatar (multipart upload).
 * PATCH /api/v1/auth/profile/
 */
export async function updateProfileWithAvatar(formData: FormData): Promise<User> {
  return apiRequest<User>({
    method: 'PATCH',
    url: '/auth/profile/',
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

/**
 * Check if the user is authenticated (has a stored access token).
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getAccessToken();
  return token !== null;
}

// ── Password Reset / Change ────────────────────────────────────────

/**
 * Request a password reset email.
 * POST /api/v1/auth/password/reset/
 */
export async function requestPasswordReset(email: string): Promise<{ detail: string }> {
  return apiRequest<{ detail: string }>({
    method: 'POST',
    url: '/auth/password/reset/',
    data: { email },
  });
}

/**
 * Confirm a password reset with uid + token from the email link.
 * POST /api/v1/auth/password/reset/confirm/
 */
export async function confirmPasswordReset(
  uid: string,
  token: string,
  newPassword: string
): Promise<{ detail: string }> {
  return apiRequest<{ detail: string }>({
    method: 'POST',
    url: '/auth/password/reset/confirm/',
    data: { uid, token, new_password: newPassword },
  });
}

/**
 * Change password for an authenticated user.
 * POST /api/v1/auth/change-password/
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ detail: string }> {
  return apiRequest<{ detail: string }>({
    method: 'POST',
    url: '/auth/change-password/',
    data: { current_password: currentPassword, new_password: newPassword },
  });
}

// ── 2FA (Email-based) ──────────────────────────────────────────────

/** Response from login when 2FA is required. */
export interface TwoFactorRequiredResponse {
  requires_2fa: true;
  temp_token: string;
  email: string;
}

/** Response from login when 2FA is not required (normal JWT). */
export interface LoginSuccessResponse {
  user: User;
  access: string;
  refresh: string;
}

/**
 * Login with email/phone + password. Returns either JWT tokens or a 2FA challenge.
 * POST /api/v1/auth/login/
 */
export async function loginWithCredentials(
  emailOrPhone: string,
  password: string
): Promise<LoginSuccessResponse | TwoFactorRequiredResponse> {
  // Detect if the input looks like a phone number
  const isPhone = /^\+?[\d\s-]{7,}$/.test(emailOrPhone.trim());
  const data = isPhone
    ? { phone: emailOrPhone.trim(), password }
    : { email: emailOrPhone.trim(), password };
  return apiRequest<LoginSuccessResponse | TwoFactorRequiredResponse>({
    method: 'POST',
    url: '/auth/login/',
    data,
  });
}

/**
 * Verify 2FA OTP code and get JWT tokens.
 * POST /api/v1/auth/2fa/verify/
 */
export async function verifyTwoFactor(
  tempToken: string,
  code: string
): Promise<LoginSuccessResponse> {
  return apiRequest<LoginSuccessResponse>({
    method: 'POST',
    url: '/auth/2fa/verify/',
    data: { temp_token: tempToken, code },
  });
}

/**
 * Resend 2FA OTP code.
 * POST /api/v1/auth/2fa/resend/
 */
export async function resendTwoFactor(
  tempToken: string
): Promise<{ detail: string; temp_token: string }> {
  return apiRequest<{ detail: string; temp_token: string }>({
    method: 'POST',
    url: '/auth/2fa/resend/',
    data: { temp_token: tempToken },
  });
}

/**
 * Enable or disable 2FA. Requires current password.
 * POST /api/v1/auth/2fa/toggle/
 */
export async function toggleTwoFactor(
  enabled: boolean,
  password: string
): Promise<{ detail: string; two_factor_enabled: boolean }> {
  return apiRequest<{ detail: string; two_factor_enabled: boolean }>({
    method: 'POST',
    url: '/auth/2fa/toggle/',
    data: { enabled, password },
  });
}
