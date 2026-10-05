import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/theme';
import { useAppTheme } from '@/context/ThemeContext';

/** Branded 404 for unmatched routes — shown instead of Expo's default. */
export default function NotFoundScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.iconWrap, { backgroundColor: Brand.primary + '15' }]}>
        <MaterialCommunityIcons name="compass-off-outline" size={56} color={Brand.primary} />
      </View>
      <Text style={styles.code}>404</Text>
      <Text style={[styles.title, { color: colors.text }]}>Page not found</Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>
        The page you're looking for doesn't exist or may have been moved.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
        onPress={() => router.replace('/' as any)}
      >
        <MaterialCommunityIcons name="home-outline" size={18} color="#FFFFFF" />
        <Text style={styles.btnText}>Back to Home</Text>
      </Pressable>
      {router.canGoBack() && (
        <Pressable
          style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.btnGhostText, { color: colors.textSecondary }]}>Go Back</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  iconWrap: {
    width: 104, height: 104, borderRadius: 52,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  code: {
    fontSize: 44, fontWeight: '900', color: Brand.primary, letterSpacing: -1,
  },
  title: { fontSize: 20, fontWeight: '800', marginTop: 8 },
  message: {
    fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10, marginBottom: 28,
  },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Brand.primary, paddingHorizontal: 26, paddingVertical: 13,
    borderRadius: 12,
  },
  btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  btnGhost: { marginTop: 14, paddingHorizontal: 20, paddingVertical: 10 },
  btnGhostText: { fontSize: 14, fontWeight: '600' },
});
