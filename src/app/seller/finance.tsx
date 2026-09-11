import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import { useScreenshotPrevention } from '@/hooks/useScreenshotPrevention';
import {
  getFinancialDashboard,
  type FinancialDashboard,
} from '@/services/financial';

export default function SellerFinanceDashboardScreen() {
  const router = useRouter();
  useScreenshotPrevention(true);
  const [data, setData] = useState<FinancialDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const result = await getFinancialDashboard();
      setData(result);
    } catch (e: any) {
      setError(e?.message || 'Failed to load financial dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmt = (v: string | number | undefined | null) =>
    Number(v || 0).toLocaleString();

  if (loading && !data) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Financial Dashboard" subtitle="Commissions, balances, fees" />
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
          <Text style={styles.loadingText}>Loading financial data...</Text>
        </View>
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Financial Dashboard" subtitle="Commissions, balances, fees" />
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

  const quickActions = [
    { icon: 'receipt', label: 'Commissions', color: '#8B5CF6', route: '/seller/commissions' as any },
    { icon: 'lock-clock', label: 'Holds', color: Brand.rating, route: '/seller/payout-holds' as any },
    { icon: 'bullhorn-outline', label: 'Ad Wallet', color: '#F59E0B', route: '/seller/ad-wallet' as any },
    { icon: 'credit-card-outline', label: 'Subscription', color: '#06B6D4', route: '/seller/subscription' as any },
    { icon: 'file-document-outline', label: 'Billing', color: '#16A34A', route: '/seller/billing' as any },
    { icon: 'wallet-outline', label: 'Earnings', color: Brand.primary, route: '/seller/earnings' as any },
  ];

  const renderLedger = (item: any) => (
    <View style={styles.txRow}>
      <View style={[styles.txIcon, { backgroundColor: item.is_credit ? '#16A34A20' : '#DC262620' }]}>
        <MaterialCommunityIcons
          name={item.is_credit ? 'arrow-down-bold' : 'arrow-up-bold'}
          size={18}
          color={item.is_credit ? Brand.success : Brand.danger}
        />
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txRef} numberOfLines={1}>{item.reference || item.type}</Text>
        <Text style={styles.txRule}>{item.notes || new Date(item.date).toLocaleDateString()}</Text>
      </View>
      <Text style={[styles.txCommission, { color: item.is_credit ? Brand.success : Brand.danger }]}>
        {item.is_credit ? '+' : '-'}UGX {fmt(item.amount)}
      </Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      <ModernHeader title="Financial Dashboard" subtitle="Commissions, balances, fees" />

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
      >
        <View style={styles.body}>
          {/* Balance cards */}
          <View style={styles.balanceRow}>
            <View style={[styles.balanceCard, { backgroundColor: Brand.primary }]}>
              <Text style={styles.balanceLabel}>Available</Text>
              <Text style={styles.balanceValue}>UGX {fmt(data?.available_balance)}</Text>
            </View>
            <View style={[styles.balanceCard, { backgroundColor: Brand.dark }]}>
              <Text style={[styles.balanceLabel, { color: 'rgba(255,255,255,0.7)' }]}>Pending</Text>
              <Text style={styles.balanceValue}>UGX {fmt(data?.pending_balance)}</Text>
            </View>
          </View>

          <View style={styles.balanceRow}>
            <View style={[styles.balanceCard, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Brand.border }]}>
              <Text style={[styles.balanceLabel, { color: Brand.textSecondary }]}>Total Paid Out</Text>
              <Text style={[styles.balanceValue, { color: Brand.text, fontSize: 16 }]}>UGX {fmt(data?.total_paid_out)}</Text>
            </View>
            <View style={[styles.balanceCard, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Brand.border }]}>
              <Text style={[styles.balanceLabel, { color: Brand.textSecondary }]}>Commission Rate</Text>
              <Text style={[styles.balanceValue, { color: Brand.text, fontSize: 16 }]}>{data?.commission_rate || '0'}%</Text>
            </View>
          </View>

          {/* Commission summary 30d */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Performance (30 Days)</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCell}>
                <Text style={[styles.summaryValue, { color: Brand.primary }]}>UGX {fmt(data?.gross_sales_30d)}</Text>
                <Text style={styles.summaryLabel}>Gross Sales</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={[styles.summaryValue, { color: Brand.danger }]}>UGX {fmt(data?.commission_30d)}</Text>
                <Text style={styles.summaryLabel}>Commission</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={[styles.summaryValue, { color: Brand.success }]}>UGX {fmt(data?.net_earnings_30d)}</Text>
                <Text style={styles.summaryLabel}>Net Earnings</Text>
              </View>
            </View>
          </View>

          {/* Active holds alert */}
          {data?.active_holds && data.active_holds > 0 ? (
            <View style={styles.holdsAlert}>
              <MaterialCommunityIcons name="lock-clock" size={20} color={Brand.rating} />
              <View style={{ flex: 1 }}>
                <Text style={styles.holdsAlertTitle}>{data.active_holds} Active Hold{data.active_holds > 1 ? 's' : ''}</Text>
                <Text style={styles.holdsAlertText}>UGX {fmt(data.hold_amount)} held</Text>
              </View>
              <Pressable onPress={() => router.push('/seller/payout-holds')}>
                <MaterialCommunityIcons name="chevron-right" size={24} color={Brand.textSecondary} />
              </Pressable>
            </View>
          ) : null}

          {/* Quick actions */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              {quickActions.map((a) => (
                <Pressable
                  key={a.label}
                  style={styles.actionItem}
                  onPress={() => router.push(a.route)}
                >
                  <View style={[styles.actionIcon, { backgroundColor: `${a.color}20` }]}>
                    <MaterialCommunityIcons name={a.icon as any} size={22} color={a.color} />
                  </View>
                  <Text style={styles.actionLabel}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Recent ledger entries */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              <Pressable onPress={() => router.push('/seller/commissions')}>
                <Text style={styles.viewAllText}>View All</Text>
              </Pressable>
            </View>
            {data?.recent_ledger && data.recent_ledger.length > 0 ? (
              data.recent_ledger.slice(0, 5).map((tx, i) => (
                <View key={`tx-${i}`}>{renderLedger(tx)}</View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="receipt" size={36} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No transactions yet</Text>
                <Text style={styles.emptySubtext}>Activity appears when orders are settled</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: Brand.textSecondary },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  body: { padding: 12, paddingBottom: 32 },

  balanceRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  balanceCard: {
    flex: 1, borderRadius: 16, padding: 16,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  balanceLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  balanceValue: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', marginTop: 4 },

  sectionCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Brand.text, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  viewAllText: { fontSize: 13, fontWeight: '600', color: Brand.primary },

  summaryGrid: { flexDirection: 'row', gap: 8 },
  summaryCell: { flex: 1, backgroundColor: Brand.surfaceAlt, borderRadius: 10, padding: 10, alignItems: 'center' },
  summaryValue: { fontSize: 13, fontWeight: '800' },
  summaryLabel: { fontSize: 10, color: Brand.textSecondary, marginTop: 4 },

  holdsAlert: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14, marginBottom: 12,
  },
  holdsAlertTitle: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  holdsAlertText: { fontSize: 12, color: '#92400E' },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionItem: { alignItems: 'center', width: 90 },
  actionIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  actionLabel: { fontSize: 11, color: Brand.text, marginTop: 6, fontWeight: '500' },

  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Brand.surfaceAlt, borderRadius: 12, padding: 12, marginBottom: 6,
  },
  txIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  txInfo: { flex: 1, gap: 2 },
  txRef: { fontSize: 14, fontWeight: '600', color: Brand.text },
  txRule: { fontSize: 11, color: Brand.textTertiary },
  txCommission: { fontSize: 14, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { marginTop: 8, fontSize: 14, color: Brand.textSecondary, fontWeight: '600' },
  emptySubtext: { marginTop: 4, fontSize: 12, color: Brand.textTertiary },
});
