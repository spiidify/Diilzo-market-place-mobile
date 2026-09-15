import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Brand } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { getPendingStatus, type PendingStatus } from '@/services/seller';

export default function SellerPendingScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [data, setData] = useState<PendingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRefreshing(true);
      const result = await getPendingStatus();
      setData(result);
    } catch (e: any) {
      setError(e?.message || 'Failed to load status');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return (
      <View style={styles.screen}>
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // If store is approved, redirect to dashboard
  if (data?.status === 'approved') {
    setTimeout(() => router.replace('/seller'), 0);
  }

  // If no store, redirect to become seller
  if (data && !data.has_store) {
    setTimeout(() => router.replace('/seller/register' as any), 0);
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.bodyContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
      >
        {/* Status icon */}
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="clock-check-outline" size={64} color={Brand.rating} />
        </View>

        <Text style={styles.title}>Store Pending Approval</Text>
        <Text style={styles.subtitle}>
          {data?.name ? `"${data.name}" is ` : 'Your store is '}
          currently under review by our team. This usually takes 1-2 business days.
        </Text>

        {/* Status card */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <MaterialCommunityIcons name="store" size={20} color={colors.textTertiary} />
            <Text style={styles.statusLabel}>Store Name</Text>
            <Text style={styles.statusValue}>{data?.name || '—'}</Text>
          </View>
          <View style={styles.statusRow}>
            <MaterialCommunityIcons name="clipboard-list-outline" size={20} color={colors.textTertiary} />
            <Text style={styles.statusLabel}>Status</Text>
            <View style={[styles.badge, { backgroundColor: Brand.rating + '20' }]}>
              <Text style={[styles.badgeText, { color: Brand.rating }]}>
                {data?.status || 'pending'}
              </Text>
            </View>
          </View>
          {data?.is_supplier && (
            <View style={styles.statusRow}>
              <MaterialCommunityIcons name="factory" size={20} color={colors.textTertiary} />
              <Text style={styles.statusLabel}>Type</Text>
              <Text style={styles.statusValue}>Supplier / B2B</Text>
            </View>
          )}
          {data?.verification_status && data.verification_status !== 'unverified' && (
            <View style={styles.statusRow}>
              <MaterialCommunityIcons name="shield-check-outline" size={20} color={colors.textTertiary} />
              <Text style={styles.statusLabel}>Verification</Text>
              <Text style={styles.statusValue}>{data.verification_status}</Text>
            </View>
          )}
        </View>

        {/* What happens next */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>What happens next?</Text>
          <View style={styles.stepRow}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
            <Text style={styles.stepText}>Our team reviews your store details and documents</Text>
          </View>
          <View style={styles.stepRow}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
            <Text style={styles.stepText}>You'll receive an email notification once approved</Text>
          </View>
          <View style={styles.stepRow}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
            <Text style={styles.stepText}>Start listing products and selling on Diilzo</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/seller/settings' as any)}
          >
            <MaterialCommunityIcons name="cog-outline" size={20} color={Brand.primary} />
            <Text style={styles.actionBtnText}>Edit Store</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.actionBtnSecondary, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/buyer' as any)}
          >
            <MaterialCommunityIcons name="shopping" size={20} color={colors.text} />
            <Text style={styles.actionBtnTextDark}>Browse as Buyer</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.refreshStatusBtn, pressed && { opacity: 0.85 }]}
          onPress={load}
        >
          <MaterialCommunityIcons name="refresh" size={18} color={Brand.primary} />
          <Text style={styles.refreshStatusText}>Check Status Again</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  bodyContent: { padding: 24, alignItems: 'center', paddingTop: 40 },

  iconWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Brand.rating + '15',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: '900', color: c.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: c.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22, marginBottom: 24 },

  statusCard: {
    backgroundColor: c.surface, borderRadius: 14, padding: 16,
    width: '100%', marginBottom: 16, elevation: 2, shadowColor: '#000',
    shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  statusLabel: { fontSize: 13, fontWeight: '600', color: c.textTertiary, width: 90 },
  statusValue: { flex: 1, fontSize: 14, color: c.text, fontWeight: '500' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  infoCard: {
    backgroundColor: c.surface, borderRadius: 14, padding: 16,
    width: '100%', marginBottom: 20, elevation: 2, shadowColor: '#000',
    shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  infoTitle: { fontSize: 15, fontWeight: '800', color: c.text, marginBottom: 14 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  stepNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Brand.primary + '20', justifyContent: 'center', alignItems: 'center',
  },
  stepNumText: { fontSize: 13, fontWeight: '800', color: Brand.primary },
  stepText: { flex: 1, fontSize: 14, color: c.textSecondary },

  actionsRow: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 14 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Brand.primary + '12', paddingVertical: 14, borderRadius: 12,
  },
  actionBtnSecondary: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderLight },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: Brand.primary },
  actionBtnTextDark: { fontSize: 14, fontWeight: '700', color: c.text },

  refreshStatusBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12,
  },
  refreshStatusText: { fontSize: 14, fontWeight: '600', color: Brand.primary },
});
