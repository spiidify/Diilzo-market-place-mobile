import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

// The account tab redirects to the buyer dashboard if logged in,
// or to the login screen if not authenticated.
export default function AccountScreen() {
  const router = useRouter();
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
    <View style={{ flex: 1, backgroundColor: Brand.surface, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={Brand.primary} />
    </View>
  );
}
