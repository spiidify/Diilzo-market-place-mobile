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
import { getSubscriptionHistory, type SubscriptionTransaction } from '@/services/financial';

export default function SellerBillingScreen() {
  useScreenshotPrevention(true);
  const [transactions, setTransactions] = useState<SubscriptionTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const result = await getSubscriptionHistory();
      setTransactions(result.transactions || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load billing history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmt = (v: string | number | undefined | null) => Number(v || 0).toLocaleString();

  const renderItem = ({ item }: { item: SubscriptionTransaction }) => (
    <View style={styles.txCard}>
      <View style={styles.txHeader}>
        <View style={[styles.txIcon, { backgroundColor: statusColor(item.status) }]}>
          <MaterialCommunityIcons
            name={item.transaction_type === 'subscription' ? 'credit-card' : 'swap-horizontal'}
            size={20}
            color={Brand.text}
          />
        </View>
        <View style={styles.txInfo}>
          <Text style={styles.txType}>{item.transaction_type.replace('_', ' ').toUpperCase()}</Text>
          <Text style={styles.txPeriod}>{item.billing_period} · {item.currency}</Text>
          <Text style={styles.txDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
        <View style={styles.txAmountCol}>
          <Text style={styles.txAmount}>UGX {fmt(item.amount)}</Text>
          <Text style={[styles.txStatus, { color: statusTextColor(item.status) }]}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.txPeriodRow}>
        <Text style={styles.txPeriodLabel}>Period:</Text>
        <Text style={styles.txPeriodValue}>
          {new Date(item.period_start).toLocaleDateString()} — {new Date(item.period_end).toLocaleDateString()}
        </Text>
      </View>

      {item.failure_reason ? (
        <Text style={styles.txFailure}>Failure: {item.failure_reason}</Text>
      ) : null}
    </View>
  );

  if (loading && transactions.length === 0) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Billing History" subtitle="Subscription payments" />
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      </View>
    );
  }

  if (error && transactions.length === 0) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Billing History" subtitle="Subscription payments" />
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
      <ModernHeader title="Billing History" subtitle="Subscription payments" />
      <FlatList
        data={transactions}
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
            <MaterialCommunityIcons name="file-document-outline" size={48} color={Brand.textTertiary} />
            <Text style={styles.emptyText}>No billing history</Text>
            <Text style={styles.emptySubtext}>Subscribe to a plan to see payment history</Text>
          </View>
        }
      />
    </View>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case 'completed': return '#16A34A20';
    case 'pending': return '#F59E0B20';
    case 'failed': return '#DC262620';
    default: return '#8B5CF620';
  }
}

function statusTextColor(status: string): string {
  switch (status) {
    case 'completed': return Brand.success;
    case 'pending': return Brand.rating;
    case 'failed': return Brand.danger;
    default: return '#8B5CF6';
  }
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

  txCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  txHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  txIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  txInfo: { flex: 1, gap: 2 },
  txType: { fontSize: 13, fontWeight: '700', color: Brand.text, textTransform: 'capitalize' },
  txPeriod: { fontSize: 11, color: Brand.textTertiary },
  txDate: { fontSize: 11, color: Brand.textTertiary },
  txAmountCol: { alignItems: 'flex-end' },
  txAmount: { fontSize: 15, fontWeight: '800', color: Brand.text },
  txStatus: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize', marginTop: 2 },

  txPeriodRow: {
    flexDirection: 'row', gap: 6,
    backgroundColor: Brand.surfaceAlt, borderRadius: 8, padding: 8,
  },
  txPeriodLabel: { fontSize: 11, color: Brand.textSecondary, fontWeight: '600' },
  txPeriodValue: { fontSize: 11, color: Brand.text },

  txFailure: { fontSize: 11, color: Brand.danger, marginTop: 6, fontStyle: 'italic' },
});
