// ── Social Auth Service ───────────────────────────────────────────
// Google-only social login using expo-auth-session. The OAuth flow
// runs in the browser and returns an ID/access token, which is
// exchanged for Diilzo JWT tokens via POST /api/v1/auth/social/.

import * as Google from 'expo-auth-session/providers/google';
import { maybeCompleteAuthSession } from 'expo-web-browser';

import type { LoginResponse } from '../types';
import { apiRequest, setTokens } from './api';

// ── Client ID (from env) ───────────────────────────────────────────
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';

export type SocialProvider = 'google';

// ── Backend token exchange ────────────────────────────────────────
/**
 * Exchange a Google token for Diilzo JWT tokens.
 * POST /api/v1/auth/social/
 */
export async function socialLogin(
  provider: SocialProvider,
  payload: { access_token?: string; id_token?: string; code?: string; redirect_uri?: string }
): Promise<LoginResponse> {
  const data = await apiRequest<LoginResponse>({
    method: 'POST',
    url: '/auth/social/',
    data: { provider, ...payload },
  });
  await setTokens(data.access, data.refresh);
  return data;
}

export function isGoogleConfigured(): boolean {
  return !!GOOGLE_CLIENT_ID;
}

// Always call the hook (Rules of Hooks). When clientId is empty the
// request is unusable, but the hook count stays stable.
export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
  });
  return { request, response, promptAsync, configured: isGoogleConfigured() };
}

// Ensure the auth session completes properly when returning from the browser
maybeCompleteAuthSession();
