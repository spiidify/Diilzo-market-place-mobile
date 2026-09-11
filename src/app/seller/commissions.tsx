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
import { getCommissionHistory, type CommissionTransaction } from '@/services/financial';

export default function SellerCommissionsScreen() {
  useScreenshotPrevention(true);
  const [transactions, setTransactions] = useState<CommissionTransaction[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const result = await getCommissionHistory();
      setTransactions(result.transactions || []);
      setSummary(result.summary_30d);
    } catch (e: any) {
      setError(e?.message || 'Failed to load commission history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmt = (v: string | number | undefined | null) => Number(v || 0).toLocaleString();

  const renderItem = ({ item }: { item: CommissionTransaction }) => (
    <View style={styles.txCard}>
      <View style={styles.txHeader}>
        <View style={[styles.txIcon, { backgroundColor: item.is_reversal ? '#DC262620' : '#8B5CF620' }]}>
          <MaterialCommunityIcons
            name={item.is_reversal ? 'arrow-u-left-top' : 'percent'}
            size={20}
            color={item.is_reversal ? Brand.danger : '#8B5CF6'}
          />
        </View>
        <View style={styles.txInfo}>
          <Text style={styles.txOrder}>#{item.order_number}</Text>
          <Text style={styles.txDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.txAmounts}>
        <View style={styles.txAmountCell}>
          <Text style={styles.txAmountLabel}>Gross</Text>
          <Text style={styles.txAmountValue}>UGX {fmt(item.gross_amount)}</Text>
        </View>
        <View style={styles.txAmountCell}>
          <Text style={styles.txAmountLabel}>Rate</Text>
          <Text style={styles.txAmountValue}>{item.commission_percentage}%</Text>
        </View>
        <View style={styles.txAmountCell}>
          <Text style={styles.txAmountLabel}>Commission</Text>
          <Text style={[styles.txAmountValue, { color: Brand.danger }]}>UGX {fmt(item.commission_amount)}</Text>
        </View>
        <View style={styles.txAmountCell}>
          <Text style={styles.txAmountLabel}>Net</Text>
          <Text style={[styles.txAmountValue, { color: Brand.success }]}>UGX {fmt(item.seller_amount)}</Text>
        </View>
      </View>

      {item.rule_name ? (
        <Text style={styles.txRule}>Rule: {item.rule_name}</Text>
      ) : null}
    </View>
  );

  if (loading && transactions.length === 0) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Commission History" subtitle="All commission transactions" />
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      </View>
    );
  }

  if (error && transactions.length === 0) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Commission History" subtitle="All commission transactions" />
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
      <ModernHeader title="Commission History" subtitle="All commission transactions" />
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
            <MaterialCommunityIcons name="receipt" size={48} color={Brand.textTertiary} />
            <Text style={styles.emptyText}>No commission transactions yet</Text>
            <Text style={styles.emptySubtext}>Commissions appear when orders are settled</Text>
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
    case 'reversed': return '#DC262620';
    default: return '#8B5CF620';
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
  txHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  txIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  txInfo: { flex: 1, gap: 2 },
  txOrder: { fontSize: 15, fontWeight: '700', color: Brand.text },
  txDate: { fontSize: 12, color: Brand.textTertiary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700', color: Brand.text, textTransform: 'capitalize' },

  txAmounts: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  txAmountCell: { flex: 1, backgroundColor: Brand.surfaceAlt, borderRadius: 8, padding: 8, alignItems: 'center' },
  txAmountLabel: { fontSize: 10, color: Brand.textSecondary, marginBottom: 2 },
  txAmountValue: { fontSize: 12, fontWeight: '700', color: Brand.text },

  txRule: { fontSize: 11, color: Brand.textTertiary, fontStyle: 'italic' },
});
