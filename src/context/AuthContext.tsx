// ── Auth Context ──────────────────────────────────────────────────
// Global auth state for the Diilzo mobile app.

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { useImageDimensions } from '../hooks/useImageDimensions';
import { getAccessToken, setTokens } from '../services/api';
import {
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  getProfile,
  loginWithCredentials,
  type TwoFactorRequiredResponse,
} from '../services/auth';
import { clearGuestCartId } from '../services/cart';
import { socialLogin as apiSocialLogin, type SocialProvider } from '../services/socialAuth';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

/** Thrown when login requires 2FA verification. */
export class TwoFactorRequiredError extends Error {
  tempToken: string;
  email: string;
  constructor(response: TwoFactorRequiredResponse) {
    super('Two-factor authentication required');
    this.tempToken = response.temp_token;
    this.email = response.email;
  }
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  loginWithEmailOrPhone: (emailOrPhone: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string, phone?: string) => Promise<void>;
  socialLogin: (provider: SocialProvider, payload: { access_token?: string; id_token?: string; code?: string; redirect_uri?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });
  const avatarSize = useImageDimensions('avatar');

  // Bootstrap: check for stored tokens on app launch
  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken();
        if (token) {
          const user = await getProfile(avatarSize);
          setState({ user, isLoading: false, isAuthenticated: true });
        } else {
          setState({ user: null, isLoading: false, isAuthenticated: false });
        }
      } catch {
        // Token might be expired — clear and continue as guest
        await apiLogout();
        setState({ user: null, isLoading: false, isAuthenticated: false });
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await apiLogin(email, password);
    const user = await getProfile(avatarSize);
    // Clear guest cart ID — the backend merges guest cart items into the user's cart
    await clearGuestCartId();
    setState({ user, isLoading: false, isAuthenticated: true });
  }, [avatarSize]);

  const loginWithEmailOrPhone = useCallback(async (emailOrPhone: string, password: string) => {
    const result = await loginWithCredentials(emailOrPhone, password);
    if ('requires_2fa' in result) {
      throw new TwoFactorRequiredError(result);
    }
    await setTokens(result.access, result.refresh);
    const user = await getProfile(avatarSize);
    await clearGuestCartId();
    setState({ user, isLoading: false, isAuthenticated: true });
  }, [avatarSize]);

  const register = useCallback(async (
    email: string, password: string, firstName: string, lastName: string, phone?: string
  ) => {
    await apiRegister(email, password, firstName, lastName, phone);
    const user = await getProfile(avatarSize);
    await clearGuestCartId();
    setState({ user, isLoading: false, isAuthenticated: true });
  }, [avatarSize]);

  const socialLogin = useCallback(async (
    provider: SocialProvider,
    payload: { access_token?: string; id_token?: string; code?: string; redirect_uri?: string }
  ) => {
    await apiSocialLogin(provider, payload);
    const user = await getProfile(avatarSize);
    await clearGuestCartId();
    setState({ user, isLoading: false, isAuthenticated: true });
  }, [avatarSize]);

  const logout = useCallback(async () => {
    await apiLogout();
    setState({ user: null, isLoading: false, isAuthenticated: false });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const user = await getProfile(avatarSize);
      setState((prev) => ({ ...prev, user }));
    } catch {
      // ignore
    }
  }, [avatarSize]);

  return (
    <AuthContext.Provider value={{ ...state, login, loginWithEmailOrPhone, register, socialLogin, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
