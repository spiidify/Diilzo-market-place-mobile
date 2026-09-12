import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { DiilzoSplash } from '@/components/diilzo-splash';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
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

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <CartProvider>
          <AppContent />
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
