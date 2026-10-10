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
    View
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { useScreenshotPrevention } from '@/hooks/useScreenshotPrevention';
import {
    getFinancialDashboard,
    type FinancialDashboard,
} from '@/services/financial';

export default function SellerFinanceDashboardScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
            <View style={[styles.balanceCard, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
              <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>Total Paid Out</Text>
              <Text style={[styles.balanceValue, { color: colors.text, fontSize: 16 }]}>UGX {fmt(data?.total_paid_out)}</Text>
            </View>
            <View style={[styles.balanceCard, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
              <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>Effective Rate</Text>
              <Text style={[styles.balanceValue, { color: colors.text, fontSize: 16 }]}>{data?.commission_rate || '0'}%</Text>
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
            {/* Extended summary row */}
            <View style={[styles.summaryGrid, { marginTop: 8 }]}>
              <View style={styles.summaryCell}>
                <Text style={[styles.summaryValue, { color: Brand.danger, fontSize: 12 }]}>UGX {fmt(data?.refunds_30d)}</Text>
                <Text style={styles.summaryLabel}>Refunds</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={[styles.summaryValue, { color: '#8B5CF6', fontSize: 12 }]}>UGX {fmt(data?.platform_fees_30d)}</Text>
                <Text style={styles.summaryLabel}>Platform Fees</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={[styles.summaryValue, { color: '#F59E0B', fontSize: 12 }]}>UGX {fmt(data?.ad_spend_30d)}</Text>
                <Text style={styles.summaryLabel}>Ad Spend</Text>
              </View>
            </View>
          </View>

          {/* In-Store POS revenue — instant settlement, no commission */}
          <View style={[styles.sectionCard, styles.posCard]}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialCommunityIcons name="cash-register" size={18} color="#D97706" />
                <Text style={styles.sectionTitle}>In-Store POS Revenue</Text>
              </View>
              <View style={styles.noFeeBadge}>
                <Text style={styles.noFeeBadgeText}>NO COMMISSION</Text>
              </View>
            </View>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCell}>
                <Text style={[styles.summaryValue, { color: '#D97706' }]}>UGX {fmt(data?.pos_revenue_30d)}</Text>
                <Text style={styles.summaryLabel}>POS Revenue (30d)</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={[styles.summaryValue, { color: '#2563EB' }]}>{data?.pos_count_30d || 0}</Text>
                <Text style={styles.summaryLabel}>POS Sales (30d)</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={[styles.summaryValue, { color: Brand.success }]}>UGX {fmt(data?.pos_today_total)}</Text>
                <Text style={styles.summaryLabel}>Today ({data?.pos_today_count || 0})</Text>
              </View>
            </View>
            {data?.pos_methods_30d && data.pos_methods_30d.length > 0 ? (
              <View style={styles.posMethodsRow}>
                {data.pos_methods_30d.map((m, i) => (
                  <View key={`pm-${i}`} style={styles.posMethodChip}>
                    <Text style={styles.posMethodChipText}>
                      {m.label} · UGX {fmt(m.total)} · {m.count} sale{m.count === 1 ? '' : 's'}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>No in-store sales in the last 30 days.</Text>
            )}
            <Pressable style={styles.posLinkBtn} onPress={() => router.push('/seller/pos' as any)}>
              <Text style={styles.posLinkText}>Open POS Terminal</Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color={Brand.primary} />
            </Pressable>
          </View>

          {/* Recent POS sales */}
          {data?.recent_pos_sales && data.recent_pos_sales.length > 0 ? (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent POS Sales</Text>
                <Pressable onPress={() => router.push('/seller/pos' as any)}>
                  <Text style={styles.viewAllText}>Open POS</Text>
                </Pressable>
              </View>
              {data.recent_pos_sales.map((s) => (
                <View key={`pos-${s.id}`} style={styles.txRow}>
                  <View style={[styles.txIcon, { backgroundColor: '#F59E0B20' }]}>
                    <MaterialCommunityIcons name="receipt" size={18} color="#D97706" />
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={styles.txRef} numberOfLines={1}>{s.sale_number}</Text>
                    <Text style={styles.txRule}>
                      {s.payment_method.replace(/_/g, ' ').toUpperCase()} · {s.cashier || 'Cashier'} · {new Date(s.sale_date).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={[styles.txCommission, { color: Brand.success }]}>+UGX {fmt(s.total)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Commission rate + transaction count */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Commission Summary</Text>
            <View style={styles.commissionRow}>
              <View style={styles.commissionMetric}>
                <View style={[styles.commissionIcon, { backgroundColor: '#8B5CF620' }]}>
                  <MaterialCommunityIcons name="percent" size={20} color="#8B5CF6" />
                </View>
                <Text style={styles.commissionValue}>{data?.commission_rate || '0'}%</Text>
                <Text style={styles.commissionLabel}>Effective Rate</Text>
              </View>
              <View style={styles.commissionMetric}>
                <View style={[styles.commissionIcon, { backgroundColor: Brand.primary + '20' }]}>
                  <MaterialCommunityIcons name="swap-horizontal" size={20} color={Brand.primary} />
                </View>
                <Text style={styles.commissionValue}>{data?.commission_transactions_30d || 0}</Text>
                <Text style={styles.commissionLabel}>Transactions</Text>
              </View>
              <View style={styles.commissionMetric}>
                <View style={[styles.commissionIcon, { backgroundColor: Brand.success + '20' }]}>
                  <MaterialCommunityIcons name="wallet-outline" size={20} color={Brand.success} />
                </View>
                <Text style={styles.commissionValue}>UGX {fmt(data?.eligible_for_payout)}</Text>
                <Text style={styles.commissionLabel}>Eligible</Text>
              </View>
            </View>

            {/* Dynamic-rate detail — commission varies by category/rule,
                so the headline rate alone isn't the whole story */}
            {(() => {
              const byCat = data?.commission_by_category || [];
              const rules = data?.commission_rules || [];
              const planDisc = Number(data?.plan_discount || 0);
              const varies = byCat.some(c => Number(c.rate) !== Number(data?.commission_rate));
              if (!varies && rules.length === 0 && planDisc === 0) return null;
              return (
                <View style={{ marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 10 }}>
                  {planDisc > 0 && (
                    <Text style={[styles.rateDetailLine, { color: Brand.success }]}>
                      Plan discount: −{planDisc}% applied to every rate below
                    </Text>
                  )}
                  {byCat.map(c => (
                    <View key={c.name} style={styles.rateRow}>
                      <Text style={[styles.rateRowLabel, { color: colors.textSecondary }]}>{c.name}</Text>
                      <Text style={[styles.rateRowValue, { color: colors.text }]}>{Number(c.rate).toFixed(1)}%</Text>
                    </View>
                  ))}
                  {rules.map(r => (
                    <View key={r.name} style={styles.rateRow}>
                      <Text style={[styles.rateRowLabel, { color: '#8B5CF6' }]}>Rule: {r.name} ({r.scope})</Text>
                      <Text style={[styles.rateRowValue, { color: '#8B5CF6' }]}>{Number(r.percentage).toFixed(1)}%{Number(r.fixed_fee) > 0 ? ` +${fmt(r.fixed_fee)}` : ''}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}
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
                <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textSecondary} />
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
                <MaterialCommunityIcons name="receipt" size={36} color={colors.textTertiary} />
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

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: c.textSecondary },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  body: { padding: 12, paddingBottom: 32 },

  balanceRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  balanceCard: {
    flex: 1, borderRadius: 16, padding: 8,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  balanceLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  balanceValue: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', marginTop: 4 },

  sectionCard: {
    backgroundColor: c.surface, borderRadius: 16, padding: 8, marginBottom: 12,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  viewAllText: { fontSize: 13, fontWeight: '600', color: Brand.primary },

  summaryGrid: { flexDirection: 'row', gap: 8 },
  summaryCell: { flex: 1, backgroundColor: c.surfaceAlt, borderRadius: 10, padding: 10, alignItems: 'center' },
  summaryValue: { fontSize: 13, fontWeight: '800' },
  summaryLabel: { fontSize: 10, color: c.textSecondary, marginTop: 4 },

  // Commission summary
  commissionRow: { flexDirection: 'row', gap: 10 },
  commissionMetric: { flex: 1, alignItems: 'center', gap: 6 },
  commissionIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  commissionValue: { fontSize: 14, fontWeight: '800', color: c.text },
  commissionLabel: { fontSize: 10, color: c.textTertiary, fontWeight: '600' },

  rateDetailLine: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  rateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  rateRowLabel: { fontSize: 12, flex: 1, marginRight: 8 },
  rateRowValue: { fontSize: 12, fontWeight: '700' },

  holdsAlert: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14, marginBottom: 12,
  },
  holdsAlertTitle: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  holdsAlertText: { fontSize: 12, color: '#92400E' },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionItem: { alignItems: 'center', width: 90 },
  actionIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  actionLabel: { fontSize: 11, color: c.text, marginTop: 6, fontWeight: '500' },

  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: c.surfaceAlt, borderRadius: 12, padding: 12, marginBottom: 6,
  },
  txIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  txInfo: { flex: 1, gap: 2 },
  txRef: { fontSize: 14, fontWeight: '600', color: c.text },
  txRule: { fontSize: 11, color: c.textTertiary },
  txCommission: { fontSize: 14, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { marginTop: 8, fontSize: 14, color: c.textSecondary, fontWeight: '600' },
  emptySubtext: { marginTop: 4, fontSize: 12, color: c.textTertiary },

  // ── POS revenue section ─────────────────────────────────────────
  posCard: { borderLeftWidth: 4, borderLeftColor: '#F59E0B' },
  noFeeBadge: {
    backgroundColor: '#16A34A18',
    borderWidth: 1,
    borderColor: '#16A34A40',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  noFeeBadgeText: { fontSize: 9, fontWeight: '800', color: '#16A34A', letterSpacing: 0.4 },
  posMethodsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  posMethodChip: {
    backgroundColor: c.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: c.border,
  },
  posMethodChipText: { fontSize: 11, fontWeight: '600', color: c.text },
  posLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Brand.primary,
  },
  posLinkText: { fontSize: 13, fontWeight: '700', color: Brand.primary },
});
