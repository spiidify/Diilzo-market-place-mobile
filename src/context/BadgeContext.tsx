// ── Badge Context ─────────────────────────────────────────────────
// Global real-time badge counts for chat unread and notifications.
// Polls every 20 seconds while the app is in the foreground so badges
// update without requiring a manual screen refresh.

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { useAuth } from './AuthContext';
import { getChatUnreadCount } from '../services/chat';
import { fetchUnreadNotificationCount } from '../services/catalog';

interface BadgeContextValue {
  chatUnread: number;
  notificationCount: number;
  refreshBadges: () => Promise<void>;
}

const BadgeContext = createContext<BadgeContextValue | undefined>(undefined);

const POLL_INTERVAL = 20000; // 20 seconds

export function BadgeProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [chatUnread, setChatUnread] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const appStateRef = useRef<AppStateStatus>('active');

  const refreshBadges = useCallback(async () => {
    if (!isAuthenticated) {
      setChatUnread(0);
      setNotificationCount(0);
      return;
    }
    try {
      const [notifCount, chatCount] = await Promise.all([
        fetchUnreadNotificationCount().catch(() => 0),
        getChatUnreadCount().catch(() => 0),
      ]);
      setNotificationCount(notifCount);
      setChatUnread(chatCount);
    } catch {
      // non-critical — keep last known values
    }
  }, [isAuthenticated]);

  // Poll every POLL_INTERVAL while the app is in the foreground
  useEffect(() => {
    if (!isAuthenticated) {
      setChatUnread(0);
      setNotificationCount(0);
      return;
    }

    // Fetch immediately on mount/auth change
    refreshBadges();

    const interval = setInterval(() => {
      if (appStateRef.current === 'active') {
        refreshBadges();
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [isAuthenticated, refreshBadges]);

  // Track app state so we only poll while in the foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      appStateRef.current = nextState;
      // Refresh immediately when the app comes back to the foreground
      if (nextState === 'active') {
        refreshBadges();
      }
    });
    return () => subscription.remove();
  }, [refreshBadges]);

  return (
    <BadgeContext.Provider value={{ chatUnread, notificationCount, refreshBadges }}>
      {children}
    </BadgeContext.Provider>
  );
}

export function useBadges() {
  const ctx = useContext(BadgeContext);
  if (!ctx) throw new Error('useBadges must be used within BadgeProvider');
  return ctx;
}
