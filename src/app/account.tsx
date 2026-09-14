import { useFocusEffect, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';

// The account tab redirects to the buyer dashboard if logged in,
// or to the login screen if not authenticated.
export default function AccountScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isAuthenticated, isLoading } = useAuth();

  useFocusEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      router.replace('/buyer' as any);
    } else {
      router.replace('/(auth)/login' as any);
    }
  });

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Brand.primary} />
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
});
