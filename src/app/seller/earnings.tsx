import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { useScreenshotPrevention } from '@/hooks/useScreenshotPrevention';
import { getMyEarnings, requestPayout, type SellerEarnings } from '@/services/seller';

const fmt = (v: string | number | undefined | null) =>
  `UGX ${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function SellerEarningsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  useScreenshotPrevention(true); // Block screenshots on financial screen
  const [data, setData] = useState<SellerEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRefreshing(true);
      const result = await getMyEarnings();
      setData(result);
    } catch (e: any) {
      setError(e?.message || 'Failed to load data');
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

  const owed = Number(data?.owed_to_diilzo || 0);

  const stats = useMemo(() => ([
    { icon: 'safe' as const, label: 'In Escrow', value: data?.pending_balance, tint: '#2563EB' },
    { icon: 'chart-line' as const, label: 'Total Earned', value: data?.total_earned, tint: '#7C3AED' },
    { icon: 'percent-outline' as const, label: 'Commission to Diilzo', value: data?.commission_to_diilzo, tint: '#D97706' },
    { icon: 'bank-transfer-out' as const, label: 'Paid to Diilzo', value: data?.paid_to_diilzo, tint: '#0891B2' },
    { icon: 'alert-circle-outline' as const, label: 'Not yet paid', value: data?.owed_to_diilzo, tint: owed > 0 ? Brand.danger : '#16A34A' },
  ]), [data, owed]);

  const renderLedgerItem = ({ item }: { item: any }) => (
    <View style={styles.ledgerRow}>
      <View style={[styles.ledgerIcon, { backgroundColor: item.is_credit ? '#16A34A18' : '#DC262618' }]}>
        <MaterialCommunityIcons
          name={item.is_credit ? 'arrow-down-bold' : 'arrow-up-bold'}
          size={16}
          color={item.is_credit ? '#16A34A' : Brand.danger}
        />
      </View>
      <View style={styles.ledgerInfo}>
        <Text style={styles.ledgerRef} numberOfLines={1}>{item.reference || item.entry_type}</Text>
        <Text style={styles.ledgerDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
      </View>
      <Text style={[styles.ledgerAmount, { color: item.is_credit ? '#16A34A' : Brand.danger }]}>
        {item.is_credit ? '+' : '−'}{fmt(item.amount)}
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
                {/* ── Hero balance card ── */}
                <LinearGradient
                  colors={[Brand.primary, Brand.primaryDark, Brand.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroCard}
                >
                  <View style={styles.heroTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.heroLabel}>Available Balance</Text>
                      <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit>
                        {fmt(data?.available_balance)}
                      </Text>
                    </View>
                    <View style={styles.heroIconWrap}>
                      <MaterialCommunityIcons name="wallet" size={22} color="#FFFFFF" />
                    </View>
                  </View>
                  <View style={styles.heroSubRow}>
                    <MaterialCommunityIcons name="percent" size={12} color="rgba(255,255,255,0.85)" />
                    <Text style={styles.heroSubText}>
                      Effective rate {data?.commission_rate || '0'}%
                      {(data?.commission_by_category || []).some(
                        c => Number(c.rate) !== Number(data?.commission_rate)
                      )
                        ? ` — varies by category (${data!.commission_by_category!
                            .slice(0, 3).map(c => `${c.name} ${Number(c.rate).toFixed(0)}%`).join(', ')}${data!.commission_by_category!.length > 3 ? '…' : ''})`
                        : ''}
                    </Text>
                  </View>
                  <View style={styles.heroPayoutRow}>
                    <TextInput
                      style={styles.heroPayoutInput}
                      placeholder="Amount (UGX)"
                      placeholderTextColor="rgba(255,255,255,0.6)"
                      keyboardType="numeric"
                      value={payoutAmount}
                      onChangeText={setPayoutAmount}
                    />
                    <Pressable
                      style={[styles.heroPayoutBtn, requesting && { opacity: 0.6 }]}
                      onPress={handlePayout}
                      disabled={requesting}
                    >
                      {requesting ? (
                        <ActivityIndicator size="small" color={Brand.primary} />
                      ) : (
                        <Text style={styles.heroPayoutBtnText}>Withdraw</Text>
                      )}
                    </Pressable>
                  </View>
                </LinearGradient>

                {/* ── Settlement stats ── */}
                <View style={styles.statsGrid}>
                  {stats.map((s) => (
                    <View key={s.label} style={styles.statTile}>
                      <View style={[styles.statIcon, { backgroundColor: s.tint + '1A' }]}>
                        <MaterialCommunityIcons name={s.icon} size={15} color={s.tint} />
                      </View>
                      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                        {fmt(s.value)}
                      </Text>
                      <Text style={styles.statLabel} numberOfLines={1}>{s.label}</Text>
                    </View>
                  ))}
                </View>

                {/* ── Payout history ── */}
                {data?.payouts && data.payouts.length > 0 && (
                  <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Payout History</Text>
                    {data.payouts.slice(0, 5).map((p: any, i: number) => (
                      <View key={`payout-${i}`} style={styles.payoutHistoryRow}>
                        <Text style={styles.payoutHistoryAmount}>{fmt(p.amount)}</Text>
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
              <View style={styles.emptyBody}>
                <MaterialCommunityIcons name="receipt-text-outline" size={36} color={colors.textTertiary} />
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

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyBody: { alignItems: 'center', paddingVertical: 36, gap: 6 },
  emptyText: { fontSize: 13, color: c.textSecondary },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  list: { padding: 10, paddingBottom: 32 },

  // Hero balance card
  heroCard: {
    borderRadius: 16, padding: 16, marginBottom: 12,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroLabel: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  heroValue: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', marginTop: 2 },
  heroSubRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  heroSubText: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  heroPayoutRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  heroPayoutInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: '#FFFFFF',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  heroPayoutBtn: {
    backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 18,
    justifyContent: 'center', alignItems: 'center', minWidth: 88,
  },
  heroPayoutBtnText: { color: Brand.primary, fontWeight: '800', fontSize: 13 },

  // Settlement stat tiles
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  statTile: {
    flexBasis: '31.5%', flexGrow: 1,
    backgroundColor: c.surface, borderRadius: 12, padding: 10, gap: 3,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  statIcon: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  statValue: { fontSize: 12.5, fontWeight: '800', color: c.text },
  statLabel: { fontSize: 10, fontWeight: '600', color: c.textSecondary },

  sectionCard: {
    backgroundColor: c.surface, borderRadius: 12, padding: 10, marginBottom: 12,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: c.text, marginBottom: 8, marginTop: 2 },

  payoutHistoryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 7, borderTopWidth: 1, borderTopColor: c.borderLight,
  },
  payoutHistoryAmount: { fontSize: 12.5, fontWeight: '700', color: c.text, flex: 1 },
  payoutHistoryStatus: { fontSize: 11, fontWeight: '700', color: Brand.primary, textTransform: 'capitalize' },
  payoutHistoryDate: { fontSize: 11, color: c.textTertiary, width: 80, textAlign: 'right' },

  ledgerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: c.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, marginBottom: 6,
  },
  ledgerIcon: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  ledgerInfo: { flex: 1, gap: 1 },
  ledgerRef: { fontSize: 12.5, fontWeight: '600', color: c.text },
  ledgerDate: { fontSize: 10.5, color: c.textTertiary },
  ledgerAmount: { fontSize: 12.5, fontWeight: '800' },
});
