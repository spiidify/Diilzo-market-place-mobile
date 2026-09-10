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
  TextInput,
  View,
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import { useScreenshotPrevention } from '@/hooks/useScreenshotPrevention';
import { getMyEarnings, requestPayout, type SellerEarnings } from '@/services/seller';

export default function SellerEarningsScreen() {
  const router = useRouter();
  useScreenshotPrevention(true); // Block screenshots on financial screen
  const [data, setData] = useState<SellerEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [requesting, setRequesting] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const result = await getMyEarnings();
      setData(result);
    } catch (e: any) {
      console.error('Seller earnings error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePayout = async () => {
    if (!payoutAmount || Number(payoutAmount) <= 0) return;
    try {
      setRequesting(true);
      await requestPayout(payoutAmount);
      setPayoutAmount('');
      await load();
    } catch (e: any) {
      console.error('Payout error:', e?.message);
    } finally {
      setRequesting(false);
    }
  };

  const renderLedgerItem = ({ item }: { item: any }) => (
    <View style={styles.ledgerRow}>
      <View style={[styles.ledgerIcon, { backgroundColor: item.is_credit ? '#16A34A20' : '#DC262620' }]}>
        <MaterialCommunityIcons
          name={item.is_credit ? 'arrow-down-bold' : 'arrow-up-bold'}
          size={18}
          color={item.is_credit ? '#16A34A' : Brand.danger}
        />
      </View>
      <View style={styles.ledgerInfo}>
        <Text style={styles.ledgerRef} numberOfLines={1}>{item.reference || item.entry_type}</Text>
        <Text style={styles.ledgerDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
      </View>
      <Text style={[styles.ledgerAmount, { color: item.is_credit ? '#16A34A' : Brand.danger }]}>
        {item.is_credit ? '+' : '-'}UGX {Number(item.amount).toLocaleString()}
      </Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      <ModernHeader title="Earnings" />

      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
          </View>
        ) : (
          <FlatList
            data={data?.ledger || []}
            keyExtractor={(item) => `${item.id}`}
            maxToRenderPerBatch={10}
            windowSize={11}
            initialNumToRender={10}
            removeClippedSubviews={true}
            renderItem={renderLedgerItem}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListHeaderComponent={
              <View>
                {/* Balance cards */}
                <View style={styles.balanceRow}>
                  <View style={styles.balanceCard}>
                    <Text style={styles.balanceLabel}>Available</Text>
                    <Text style={styles.balanceValue}>UGX {Number(data?.available_balance || 0).toLocaleString()}</Text>
                  </View>
                  <View style={[styles.balanceCard, { backgroundColor: Brand.text }]}>
                    <Text style={[styles.balanceLabel, { color: Brand.textTertiary }]}>Pending</Text>
                    <Text style={[styles.balanceValue, { color: '#FFFFFF' }]}>UGX {Number(data?.pending_balance || 0).toLocaleString()}</Text>
                  </View>
                </View>

                {/* Commission rate */}
                <View style={styles.commissionRow}>
                  <MaterialCommunityIcons name="percent" size={18} color={Brand.primary} />
                  <Text style={styles.commissionText}>Commission rate: {data?.commission_rate || '0'}%</Text>
                </View>

                {/* Payout request */}
                <View style={styles.payoutCard}>
                  <Text style={styles.payoutTitle}>Request Payout</Text>
                  <View style={styles.payoutInputRow}>
                    <TextInput
                      style={styles.payoutInput}
                      placeholder="Amount (UGX)"
                      keyboardType="numeric"
                      value={payoutAmount}
                      onChangeText={setPayoutAmount}
                    />
                    <Pressable style={[styles.payoutBtn, requesting && { opacity: 0.6 }]} onPress={handlePayout} disabled={requesting}>
                      <Text style={styles.payoutBtnText}>{requesting ? '...' : 'Withdraw'}</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Payouts history */}
                {data?.payouts && data.payouts.length > 0 && (
                  <View style={styles.payoutsHistory}>
                    <Text style={styles.sectionTitle}>Payout History</Text>
                    {data.payouts.slice(0, 5).map((p: any, i: number) => (
                      <View key={`payout-${i}`} style={styles.payoutHistoryRow}>
                        <Text style={styles.payoutHistoryAmount}>UGX {Number(p.amount).toLocaleString()}</Text>
                        <Text style={styles.payoutHistoryStatus}>{p.status}</Text>
                        <Text style={styles.payoutHistoryDate}>{new Date(p.created_at).toLocaleDateString()}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <Text style={styles.sectionTitle}>Transaction History</Text>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.centerBody}>
                <Text style={styles.emptyText}>No transactions yet</Text>
              </View>
            }
            contentContainerStyle={styles.list}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { marginTop: 12, fontSize: 14, color: Brand.textSecondary },
  list: { padding: 12, paddingBottom: 32 },

  balanceRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  balanceCard: {
    flex: 1, backgroundColor: Brand.primary, borderRadius: 16, padding: 18,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  balanceLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  balanceValue: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', marginTop: 4 },

  commissionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 12,
  },
  commissionText: { fontSize: 14, fontWeight: '600', color: Brand.text },

  payoutCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, marginBottom: 16,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  payoutTitle: { fontSize: 16, fontWeight: '700', color: Brand.text, marginBottom: 12 },
  payoutInputRow: { flexDirection: 'row', gap: 10 },
  payoutInput: {
    flex: 1, backgroundColor: Brand.surfaceAlt, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: Brand.border,
  },
  payoutBtn: { backgroundColor: Brand.primary, borderRadius: 10, paddingHorizontal: 24, justifyContent: 'center' },
  payoutBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  payoutsHistory: { marginBottom: 16 },
  payoutHistoryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12, marginBottom: 6,
  },
  payoutHistoryAmount: { fontSize: 14, fontWeight: '700', color: Brand.text },
  payoutHistoryStatus: { fontSize: 12, fontWeight: '600', color: Brand.primary },
  payoutHistoryDate: { fontSize: 12, color: Brand.textTertiary },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: Brand.text, marginBottom: 10, marginTop: 4 },

  ledgerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 8,
  },
  ledgerIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  ledgerInfo: { flex: 1, gap: 2 },
  ledgerRef: { fontSize: 14, fontWeight: '600', color: Brand.text },
  ledgerDate: { fontSize: 12, color: Brand.textTertiary },
  ledgerAmount: { fontSize: 14, fontWeight: '700' },
});



