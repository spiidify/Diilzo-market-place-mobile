import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import { useScreenshotPrevention } from '@/hooks/useScreenshotPrevention';
import { getPayoutHolds, type PayoutHold } from '@/services/financial';

export default function SellerPayoutHoldsScreen() {
  useScreenshotPrevention(true);
  const [holds, setHolds] = useState<PayoutHold[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const result = await getPayoutHolds();
      setHolds(result.holds || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load payout holds');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmt = (v: string | number | undefined | null) => Number(v || 0).toLocaleString();

  const renderItem = ({ item }: { item: PayoutHold }) => (
    <View style={styles.holdCard}>
      <View style={styles.holdHeader}>
        <View style={[styles.holdIcon, { backgroundColor: item.status === 'active' ? '#F59E0B20' : '#16A34A20' }]}>
          <MaterialCommunityIcons
            name={item.status === 'active' ? 'lock-clock' : 'lock-open-check-outline'}
            size={22}
            color={item.status === 'active' ? Brand.rating : Brand.success}
          />
        </View>
        <View style={styles.holdInfo}>
          <Text style={styles.holdReason}>{item.reason}</Text>
          <Text style={styles.holdDate}>Placed: {new Date(item.started_at).toLocaleDateString()}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: item.status === 'active' ? '#F59E0B20' : '#16A34A20' }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.holdAmountRow}>
        <Text style={styles.holdAmountLabel}>Hold Amount</Text>
        <Text style={[styles.holdAmountValue, { color: Brand.danger }]}>UGX {fmt(item.amount)}</Text>
      </View>

      {item.expected_release_date ? (
        <Text style={styles.holdRelease}>
          Expected release: {new Date(item.expected_release_date).toLocaleDateString()}
        </Text>
      ) : null}

      {item.description ? (
        <Text style={styles.holdNotes}>{item.description}</Text>
      ) : null}
    </View>
  );

  if (loading && holds.length === 0) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Payout Holds" subtitle="Funds held for review" />
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      </View>
    );
  }

  if (error && holds.length === 0) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Payout Holds" subtitle="Funds held for review" />
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

  return (
    <View style={styles.screen}>
      <ModernHeader title="Payout Holds" subtitle="Funds held for review" />
      <FlatList
        data={holds}
        keyExtractor={(item) => `${item.id}`}
        renderItem={renderItem}
        maxToRenderPerBatch={10}
        windowSize={11}
        initialNumToRender={10}
        removeClippedSubviews={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="check-circle-outline" size={48} color={Brand.success} />
            <Text style={styles.emptyText}>No payout holds</Text>
            <Text style={styles.emptySubtext}>Your payouts are not being held</Text>
          </View>
        }
        ListHeaderComponent={
          <View style={styles.infoBanner}>
            <MaterialCommunityIcons name="information-outline" size={18} color={Brand.primary} />
            <Text style={styles.infoText}>
              Holds may be placed for pending deliveries, disputes, chargebacks, or fraud investigations.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  emptyText: { marginTop: 12, fontSize: 14, color: Brand.textSecondary, fontWeight: '600' },
  emptySubtext: { marginTop: 4, fontSize: 12, color: Brand.textTertiary },

  list: { padding: 12, paddingBottom: 32 },

  infoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#DCF5EC', borderRadius: 12, padding: 12, marginBottom: 12,
  },
  infoText: { flex: 1, fontSize: 12, color: Brand.textSecondary },

  holdCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  holdHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  holdIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  holdInfo: { flex: 1, gap: 2 },
  holdReason: { fontSize: 15, fontWeight: '700', color: Brand.text },
  holdDate: { fontSize: 12, color: Brand.textTertiary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700', color: Brand.text, textTransform: 'capitalize' },

  holdAmountRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Brand.surfaceAlt, borderRadius: 10, padding: 12, marginBottom: 8,
  },
  holdAmountLabel: { fontSize: 13, color: Brand.textSecondary, fontWeight: '600' },
  holdAmountValue: { fontSize: 16, fontWeight: '800' },

  holdRelease: { fontSize: 12, color: Brand.textSecondary, marginBottom: 4 },
  holdNotes: { fontSize: 12, color: Brand.textTertiary, fontStyle: 'italic' },
});
