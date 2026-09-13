// ── Social Auth Service ───────────────────────────────────────────
// Social login (Google, Facebook) using expo-auth-session.
// The OAuth flow runs in the browser, returns an ID/access token,
// which is then exchanged for Diilzo JWT tokens via the backend
// POST /api/v1/auth/social/ endpoint.
//
// Apple Sign-In requires a native module and is not available in
// Expo Go. It can be added later with a development build.

import * as Facebook from 'expo-auth-session/providers/facebook';
import * as Google from 'expo-auth-session/providers/google';
import { maybeCompleteAuthSession } from 'expo-web-browser';

import type { LoginResponse } from '../types';
import { apiRequest, setTokens } from './api';

// ── Client IDs (from env) ──────────────────────────────────────────
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
const FACEBOOK_CLIENT_ID = process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_ID || '';

// ── Backend token exchange ────────────────────────────────────────
/**
 * Exchange a social provider token for Diilzo JWT tokens.
 * POST /api/v1/auth/social/
 */
export async function socialLogin(
  provider: 'google' | 'facebook' | 'apple',
  payload: { access_token?: string; id_token?: string }
): Promise<LoginResponse> {
  const data = await apiRequest<LoginResponse>({
    method: 'POST',
    url: '/auth/social/',
    data: { provider, ...payload },
  });
  await setTokens(data.access, data.refresh);
  return data;
}

// ── Configuration checks ───────────────────────────────────────────
export function isGoogleConfigured(): boolean {
  return !!GOOGLE_CLIENT_ID;
}

export function isFacebookConfigured(): boolean {
  return !!FACEBOOK_CLIENT_ID;
}

export function isAppleConfigured(): boolean {
  return false; // Requires native module — future development build
}

// ── Google ────────────────────────────────────────────────────────
// Always call the hook (Rules of Hooks). When clientId is empty the
// request is unusable, but the hook count stays stable.
export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
  });
  return { request, response, promptAsync, configured: isGoogleConfigured() };
}

// ── Facebook ──────────────────────────────────────────────────────
export function useFacebookAuth() {
  const [request, response, promptAsync] = Facebook.useAuthRequest({
    clientId: FACEBOOK_CLIENT_ID,
    scopes: ['email', 'public_profile'],
  });
  return { request, response, promptAsync, configured: isFacebookConfigured() };
}

// ── Apple ─────────────────────────────────────────────────────────
// Apple Sign-In requires a native module (expo-apple-authentication).
// Not available in Expo Go. The backend endpoint is ready for it.
export function useAppleAuth() {
  return { configured: false };
}

// Ensure the auth session completes properly when returning from the browser
maybeCompleteAuthSession();
