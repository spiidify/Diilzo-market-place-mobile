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

export type SocialProvider = 'google' | 'apple';

// ── Backend token exchange ────────────────────────────────────────
/**
 * Exchange a Google token for Diilzo JWT tokens.
 * POST /api/v1/auth/social/
 */
export async function socialLogin(
  provider: SocialProvider,
  payload: { access_token?: string; id_token?: string; code?: string; redirect_uri?: string; first_name?: string; last_name?: string }
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

// ── Apple Sign In (iOS) ────────────────────────────────────────────
// expo-apple-authentication is NOT bundled in Expo Go — a top-level
// import would crash the whole app there. Lazy require() keeps the JS
// module eval behind a try/catch so everything degrades gracefully.
type AppleModule = typeof import('expo-apple-authentication');
type AppleCredential = import('expo-apple-authentication').AppleAuthenticationCredential;

let _appleMod: AppleModule | null | undefined;
function getAppleAuth(): AppleModule | null {
  if (_appleMod === undefined) {
    try {
      _appleMod = require('expo-apple-authentication');
    } catch {
      _appleMod = null;
    }
  }
  return _appleMod ?? null;
}

/** Whether the native Apple module is present (dev build) AND iOS supports it. */
export async function isAppleAuthAvailable(): Promise<boolean> {
  const mod = getAppleAuth();
  if (!mod) return false;
  try {
    return await mod.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Opens the native Apple sheet and returns the raw credential. */
export async function appleSignIn(): Promise<AppleCredential> {
  const mod = getAppleAuth();
  if (!mod) throw new Error('Sign in with Apple requires a development build.');
  const cred = await mod.signInAsync({
    requestedScopes: [
      mod.AppleAuthenticationScope.FULL_NAME,
      mod.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!cred.identityToken) {
    throw new Error('Apple did not return an identity token');
  }
  return cred;
}

export async function appleLogin(): Promise<LoginResponse> {
  const cred = await appleSignIn();
  return socialLogin('apple', {
    id_token: cred.identityToken!,
    first_name: cred.fullName?.givenName ?? undefined,
    last_name: cred.fullName?.familyName ?? undefined,
  });
}

// In Expo Go the default redirect is an exp:// custom-scheme URL that
// Google can't redirect a browser to (shows a 400/404 error page). Route
// through Expo's auth proxy instead — this https URL must be added to the
// Google client's Authorized redirect URIs.
const PROXY_REDIRECT_URI = 'https://auth.expo.io/@dayankennedy/diilzo-mobile';

// Always call the hook (Rules of Hooks). When clientId is empty the
// request is unusable, but the hook count stays stable.
export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    // Implicit token flow: on native the SDK defaults to code flow, but a
    // web OAuth client can't exchange a code without the client secret.
    // Token flow returns an access_token the backend verifies directly.
    responseType: 'token',
    redirectUri: PROXY_REDIRECT_URI,
    scopes: ['openid', 'profile', 'email'],
  });
  return { request, response, promptAsync, configured: isGoogleConfigured() };
}

// Ensure the auth session completes properly when returning from the browser
maybeCompleteAuthSession();
