import { MaterialCommunityIcons } from '@expo/vector-icons';
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

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { getSellerStatement, type SellerStatement } from '@/services/financial';

const fmt = (v: string | number | undefined | null) =>
  Number(v || 0).toLocaleString();

export default function SellerStatementScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [data, setData] = useState<SellerStatement | null>(null);
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (m?: string) => {
    try {
      setError(null);
      setRefreshing(true);
      setData(await getSellerStatement(m));
    } catch (e: any) {
      setError(e?.message || 'Failed to load statement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  const changeMonth = (value: string) => {
    setMonth(value);
    setLoading(true);
    load(value);
  };

  const s = data?.summary;

  const summaryRows: Array<{ label: string; value: string | number | undefined; accent?: string; bold?: boolean }> = s ? [
    { label: 'Orders', value: s.order_count },
    { label: 'Gross online sales', value: `UGX ${fmt(s.gross_sales)}`, bold: true },
    { label: 'Commission charged', value: `−UGX ${fmt(s.gross_commission)}`, accent: Brand.danger },
    { label: 'Commission reversed (refunds)', value: `+UGX ${fmt(s.reversed_commission)}`, accent: Brand.success },
    { label: 'Net commission kept by Diilzo', value: `−UGX ${fmt(s.net_commission)}`, accent: Brand.danger },
    { label: 'Platform / service fees', value: `−UGX ${fmt(s.platform_fees)}`, accent: Brand.danger },
    { label: 'Subscription fees', value: `−UGX ${fmt(s.subscription_fees)}`, accent: Brand.danger },
    { label: 'AdPulse ad spend', value: `−UGX ${fmt(s.ad_spend)}`, accent: Brand.danger },
    { label: 'Total Diilzo charges', value: `−UGX ${fmt(s.total_diilzo_charges)}`, accent: Brand.danger, bold: true },
    { label: 'Net seller earnings', value: `UGX ${fmt(s.seller_net_earnings)}`, accent: Brand.success, bold: true },
    { label: `Payouts disbursed (${s.payouts_count})`, value: `UGX ${fmt(s.payouts_total)}` },
  ] : [];

  return (
    <View style={styles.screen}>
      <ModernHeader title="Monthly Statement" showBack />

      {loading && !data ? (
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      ) : error && !data ? (
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => load(month)}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : data ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(month)} tintColor={Brand.primary} />}
        >
          {/* Statement header */}
          <View style={styles.headerCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.headerIcon}>
                <MaterialCommunityIcons name="file-document-outline" size={24} color="#0EA5E9" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>{data.statement_number}</Text>
                <Text style={styles.headerSub}>{data.store_name} · {data.period_label}</Text>
              </View>
            </View>
          </View>

          {/* Month selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll} contentContainerStyle={{ gap: 8 }}>
            {data.month_options.map((m) => (
              <Pressable
                key={m.value}
                style={[styles.monthChip, data.period === m.value && styles.monthChipActive]}
                onPress={() => changeMonth(m.value)}
              >
                <Text style={[styles.monthChipText, data.period === m.value && styles.monthChipTextActive]}>
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Summary */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Revenue & Fee Summary</Text>
            {summaryRows.map((row) => (
              <View key={row.label} style={[styles.summaryRow, row.bold && styles.summaryRowBold]}>
                <Text style={[styles.summaryLabel, row.bold && { fontWeight: '800', color: colors.text }]}>
                  {row.label}
                </Text>
                <Text style={[styles.summaryValue, row.accent ? { color: row.accent } : null, row.bold && { fontWeight: '800' }]}>
                  {row.value}
                </Text>
              </View>
            ))}
          </View>

          {/* Itemized commission ledger */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              Commission Ledger · {data.transactions.length} entr{data.transactions.length === 1 ? 'y' : 'ies'}
            </Text>
            {data.transactions.length === 0 ? (
              <Text style={styles.emptyText}>No commission transactions this month.</Text>
            ) : (
              data.transactions.map((t) => (
                <View key={t.id} style={styles.txRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txOrder}>
                      {t.is_reversal ? '↩ ' : ''}{t.order_number || 'Order'}
                    </Text>
                    <Text style={styles.txMeta}>
                      {new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      {' · '}{t.rule_name} · {t.status}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.txComm, { color: t.is_reversal ? Brand.success : Brand.danger }]}>
                      {t.is_reversal ? '+' : '−'}UGX {fmt(t.commission_amount)}
                    </Text>
                    <Text style={styles.txRate}>{Number(t.commission_percentage).toFixed(1)}% of UGX {fmt(t.gross_amount)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          <Text style={styles.footerNote}>
            Statement generated from Diilzo's commission ledger. Keep this for your monthly tax records.
          </Text>
        </ScrollView>
      ) : null}
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  content: { padding: 14, paddingBottom: 30 },

  headerCard: {
    backgroundColor: c.surface, borderRadius: 14, padding: 14, marginBottom: 12,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  headerIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#0EA5E920',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: '800', color: c.text },
  headerSub: { fontSize: 12, color: c.textSecondary, marginTop: 2 },

  monthScroll: { flexGrow: 0, marginBottom: 12 },
  monthChip: {
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 16,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
  },
  monthChipActive: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  monthChipText: { fontSize: 12, fontWeight: '700', color: c.textSecondary },
  monthChipTextActive: { color: '#fff' },

  sectionCard: {
    backgroundColor: c.surface, borderRadius: 14, padding: 14, marginBottom: 12,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: c.text, marginBottom: 10 },

  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6,
  },
  summaryRowBold: { borderTopWidth: 1, borderTopColor: c.borderLight, marginTop: 2, paddingTop: 8 },
  summaryLabel: { fontSize: 13, color: c.textSecondary, flex: 1, marginRight: 10 },
  summaryValue: { fontSize: 13, fontWeight: '700', color: c.text },

  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border,
  },
  txOrder: { fontSize: 13, fontWeight: '700', color: c.text },
  txMeta: { fontSize: 11, color: c.textTertiary, marginTop: 2 },
  txComm: { fontSize: 13, fontWeight: '800' },
  txRate: { fontSize: 10, color: c.textTertiary, marginTop: 2 },

  emptyText: { fontSize: 13, color: c.textTertiary, textAlign: 'center', paddingVertical: 16 },
  footerNote: { fontSize: 11, color: c.textTertiary, textAlign: 'center', marginTop: 4, lineHeight: 16 },
});
