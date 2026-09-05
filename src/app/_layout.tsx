import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { DiilzoSplash } from '@/components/diilzo-splash';
import { AuthProvider } from '@/context/AuthContext';
import { useSessionManager } from '@/hooks/useSessionManager';
import { registerForPushNotifications } from '@/services/push';

SplashScreen.preventAutoHideAsync();

function AppContent() {
  useSessionManager();
  useEffect(() => {
    registerForPushNotifications().catch(() => { });
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
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
