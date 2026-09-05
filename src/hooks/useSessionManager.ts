// ── Session Manager Hook ──────────────────────────────────────────
// Tracks app state and enforces session timeout when app goes to background.

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { touchSession, clearTokens } from '../services/api';
import { useAuth } from '../context/AuthContext';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Hook that monitors app state and enforces session timeout.
 * Call this once at the app root level.
 */
export function useSessionManager(): void {
  const { isAuthenticated, logout } = useAuth();
  const backgroundTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        // App came back to foreground
        if (backgroundTimeRef.current !== null) {
          const elapsed = Date.now() - backgroundTimeRef.current;
          backgroundTimeRef.current = null;

          if (elapsed > SESSION_TIMEOUT_MS) {
            // Session expired — force logout
            await clearTokens();
            await logout();
          } else {
            // Still within session — refresh timestamp
            await touchSession();
          }
        }
      } else if (nextState === 'background' || nextState === 'inactive') {
        // App went to background
        backgroundTimeRef.current = Date.now();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [isAuthenticated, logout]);
}
