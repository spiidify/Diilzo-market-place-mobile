import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ErrorBoundaryProps } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/theme';

/**
 * Branded crash screen — shown when a route throws instead of the raw
 * red error. `retry` re-renders the route tree.
 */
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name="alert-circle-outline" size={56} color={Brand.danger} />
      </View>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>
        We hit an unexpected error. Please try again — if it keeps happening,
        contact Diilzo support.
      </Text>
      {__DEV__ && (
        <Text style={styles.devError} numberOfLines={6}>
          {error?.message}
        </Text>
      )}
      <Pressable
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
        onPress={retry}
      >
        <MaterialCommunityIcons name="refresh" size={18} color="#FFFFFF" />
        <Text style={styles.btnText}>Try Again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, backgroundColor: '#FFFFFF',
  },
  iconWrap: {
    width: 104, height: 104, borderRadius: 52,
    backgroundColor: '#FEE2E2',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  message: {
    fontSize: 14, lineHeight: 21, color: '#64748B',
    textAlign: 'center', marginTop: 10, marginBottom: 8,
  },
  devError: {
    fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' as any,
    marginTop: 8, marginBottom: 12, textAlign: 'center',
  },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Brand.primary, paddingHorizontal: 26, paddingVertical: 13,
    borderRadius: 12, marginTop: 12,
  },
  btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
