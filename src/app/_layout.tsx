import * as Device from 'expo-device';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { DiilzoSplash } from '@/components/diilzo-splash';
import { AuthProvider } from '@/context/AuthContext';
import { BadgeProvider } from '@/context/BadgeContext';
import { CartProvider } from '@/context/CartContext';
import { ThemeProvider as AppThemeProvider, useAppTheme } from '@/context/ThemeContext';
import { useSessionManager } from '@/hooks/useSessionManager';
import {
    addNotificationReceivedListener,
    addNotificationResponseListener,
    getLastNotificationResponse,
    registerForPushNotifications,
} from '@/services/push';
import { playSound, preloadSounds, Sounds } from '@/services/sound';
import { router } from 'expo-router';

SplashScreen.preventAutoHideAsync();

function AppContent() {
  useSessionManager();
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const orientationChange = Device.deviceType === Device.DeviceType.TABLET
      ? ScreenOrientation.unlockAsync()
      : ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    orientationChange.catch(() => {});
  }, []);
  useEffect(() => {
    // Preload sound effects and register for push notifications on app launch
    preloadSounds();
    registerForPushNotifications().catch(() => { });

    // Play sound when a push notification is received in the foreground
    const receivedListener = addNotificationReceivedListener(() => {
      playSound(Sounds.NOTIFICATION);
    });

    // Handle notification taps (deep-linking)
    const responseListener = addNotificationResponseListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) {
        // Defer navigation slightly to ensure router is ready
        setTimeout(() => router.push(url as any), 100);
      }
    });

    // Handle the notification that launched the app (cold start)
    getLastNotificationResponse().then((response) => {
      if (response) {
        const url = response.notification.request.content.data?.url;
        if (typeof url === 'string' && url.startsWith('/')) {
          setTimeout(() => router.push(url as any), 500);
        }
      }
    });

    return () => {
      responseListener.remove();
      receivedListener.remove();
    };
  }, []);
  return (
    <>
      <DiilzoSplash />
      <AppTabs />
    </>
  );
}

// Inner component that reads the app theme to configure expo-router's theme
function ThemedRoot() {
  const { isDark } = useAppTheme();
  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <BadgeProvider>
          <CartProvider>
            <AppContent />
          </CartProvider>
        </BadgeProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default function TabLayout() {
  return (
    <AppThemeProvider>
      <ThemedRoot />
    </AppThemeProvider>
  );
}
