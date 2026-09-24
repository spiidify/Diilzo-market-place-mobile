// ── Social Auth Service ───────────────────────────────────────────
// Social login (Google, Facebook, Instagram, TikTok) using
// expo-auth-session. The OAuth flow runs in the browser and returns
// an ID/access token or an authorization code, which is exchanged for
// Diilzo JWT tokens via POST /api/v1/auth/social/.
//
// Instagram and TikTok use authorization-code flows whose token
// exchange requires a client secret — the app sends the returned code
// to the backend, which exchanges it server-side.
//
// Apple Sign-In requires a native module and is not available in
// Expo Go. It can be added later with a development build.

import * as Facebook from 'expo-auth-session/providers/facebook';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import { maybeCompleteAuthSession } from 'expo-web-browser';

import type { LoginResponse } from '../types';
import { apiRequest, setTokens } from './api';

// ── Client IDs (from env) ──────────────────────────────────────────
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
const FACEBOOK_CLIENT_ID = process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_ID || '';
const INSTAGRAM_CLIENT_ID = process.env.EXPO_PUBLIC_INSTAGRAM_CLIENT_ID || '';
const TIKTOK_CLIENT_KEY = process.env.EXPO_PUBLIC_TIKTOK_CLIENT_KEY || '';

const REDIRECT_URI = makeRedirectUri({ scheme: 'diilzomobile' });

export type SocialProvider = 'google' | 'facebook' | 'apple' | 'instagram' | 'tiktok';

// ── Backend token exchange ────────────────────────────────────────
/**
 * Exchange a social provider token/code for Diilzo JWT tokens.
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

// ── Configuration checks ───────────────────────────────────────────
export function isGoogleConfigured(): boolean {
  return !!GOOGLE_CLIENT_ID;
}

export function isFacebookConfigured(): boolean {
  return !!FACEBOOK_CLIENT_ID;
}

export function isInstagramConfigured(): boolean {
  return !!INSTAGRAM_CLIENT_ID;
}

export function isTiktokConfigured(): boolean {
  return !!TIKTOK_CLIENT_KEY;
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

// ── Instagram ─────────────────────────────────────────────────────
// Instagram Login OAuth (api.instagram.com token exchange is done
// server-side — the app only collects the authorization code).
export function useInstagramAuth() {
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: INSTAGRAM_CLIENT_ID,
      scopes: ['instagram_business_basic'],
      redirectUri: REDIRECT_URI,
    },
    {
      authorizationEndpoint: 'https://www.instagram.com/oauth/authorize',
      tokenEndpoint: 'https://api.instagram.com/oauth/access_token',
    }
  );
  return { request, response, promptAsync, configured: isInstagramConfigured(), redirectUri: REDIRECT_URI };
}

// ── TikTok ────────────────────────────────────────────────────────
// TikTok Login Kit v2. Token exchange is done server-side; the app
// only collects the authorization code.
export function useTiktokAuth() {
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: TIKTOK_CLIENT_KEY,
      scopes: ['user.info.basic'],
      redirectUri: REDIRECT_URI,
    },
    {
      authorizationEndpoint: 'https://www.tiktok.com/v2/auth/authorize/',
      tokenEndpoint: 'https://open.tiktokapis.com/v2/oauth/token/',
    }
  );
  return { request, response, promptAsync, configured: isTiktokConfigured(), redirectUri: REDIRECT_URI };
}

// ── Apple ─────────────────────────────────────────────────────────
// Apple Sign-In requires a native module (expo-apple-authentication).
// Not available in Expo Go. The backend endpoint is ready for it.
export function useAppleAuth() {
  return { configured: false };
}

// Ensure the auth session completes properly when returning from the browser
maybeCompleteAuthSession();
