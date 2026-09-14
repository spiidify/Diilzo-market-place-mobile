import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
import { getRefunds, type SellerRefund } from '@/services/seller';

const STATUS_COLORS: Record<string, string> = {
  pending: Brand.rating,
  processing: '#3B82F6',
  completed: Brand.primary,
  failed: Brand.danger,
};

const STATUS_ICONS: Record<string, string> = {
  pending: 'clock-outline',
  processing: 'progress-clock',
  completed: 'check-circle-outline',
  failed: 'alert-circle-outline',
};

export default function SellerRefundsScreen() {
  const router = useRouter();
  const [refunds, setRefunds] = useState<SellerRefund[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRefreshing(true);
      const data = await getRefunds();
      setRefunds(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load refunds');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Summary stats ──────────────────────────────────────────────
  const totalRefunded = refunds
    .filter((r) => r.status === 'completed')
    .reduce((sum, r) => sum + Number(r.amount), 0);
  const pendingCount = refunds.filter((r) => r.status === 'pending' || r.status === 'processing').length;
  const failedCount = refunds.filter((r) => r.status === 'failed').length;

  const renderItem = ({ item }: { item: SellerRefund }) => {
    const color = STATUS_COLORS[item.status] || Brand.textTertiary;
    const icon = STATUS_ICONS[item.status] || 'help-circle-outline';
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderNumber}>#{item.order_number || 'N/A'}</Text>
            <Text style={styles.paymentId}>{item.payment_id}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: color + '20' }]}>
            <MaterialCommunityIcons name={icon as any} size={13} color={color} />
            <Text style={[styles.badgeText, { color }]}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Refund Amount</Text>
          <Text style={styles.amountValue}>
            {Number(item.amount).toLocaleString()} <Text style={styles.currency}>{item.currency}</Text>
          </Text>
        </View>

        {item.reason ? (
          <Text style={styles.reason} numberOfLines={2}>{item.reason}</Text>
        ) : null}

        <View style={styles.cardFooter}>
          <View style={styles.footerLeft}>
            {item.payment_method ? (
              <View style={styles.footerChip}>
                <MaterialCommunityIcons name="credit-card-outline" size={12} color={Brand.textSecondary} />
                <Text style={styles.footerChipText}>{item.payment_method}</Text>
              </View>
            ) : null}
            {item.dispute_id ? (
              <View style={styles.footerChip}>
                <MaterialCommunityIcons name="alert-circle-outline" size={12} color={Brand.danger} />
                <Text style={styles.footerChipText}>{item.dispute_reason || 'Dispute'}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <ModernHeader title="Refunds" />

      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.centerBody}><ActivityIndicator size="large" color={Brand.primary} /></View>
        ) : error ? (
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={refunds}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListHeaderComponent={
              refunds.length > 0 ? (
                <View style={styles.statsRow}>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>UGX {totalRefunded.toLocaleString()}</Text>
                    <Text style={styles.statLabel}>Total Refunded</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={[styles.statValue, { color: Brand.rating }]}>{pendingCount}</Text>
                    <Text style={styles.statLabel}>Pending</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={[styles.statValue, { color: failedCount > 0 ? Brand.danger : Brand.textTertiary }]}>{failedCount}</Text>
                    <Text style={styles.statLabel}>Failed</Text>
                  </View>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="check-circle-outline" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No refunds</Text>
                <Text style={styles.emptySub}>No refunds have been issued for your store</Text>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  listContent: { padding: 12, paddingBottom: 40 },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14,
    alignItems: 'center', gap: 4,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  statValue: { fontSize: 16, fontWeight: '800', color: Brand.text },
  statLabel: { fontSize: 11, color: Brand.textTertiary },

  // Cards
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 10,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  orderInfo: { gap: 2 },
  orderNumber: { fontSize: 15, fontWeight: '800', color: Brand.text },
  paymentId: { fontSize: 11, color: Brand.textTertiary, fontFamily: 'monospace' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  amountLabel: { fontSize: 12, fontWeight: '600', color: Brand.textSecondary },
  amountValue: { fontSize: 18, fontWeight: '800', color: Brand.danger },
  currency: { fontSize: 12, fontWeight: '600', color: Brand.textTertiary },

  reason: { fontSize: 13, color: Brand.textSecondary, marginBottom: 8, lineHeight: 18 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  footerLeft: { flexDirection: 'row', gap: 6, flex: 1, flexWrap: 'wrap' },
  footerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Brand.surfaceAlt, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  footerChipText: { fontSize: 11, color: Brand.textSecondary },
  dateText: { fontSize: 12, color: Brand.textTertiary },

  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  emptySub: { fontSize: 13, color: Brand.textTertiary, textAlign: 'center' },
});
