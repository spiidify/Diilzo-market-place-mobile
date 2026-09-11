import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
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
import { runReconciliation, type ReconciliationResult } from '@/services/financial';

export default function AdminReconciliationScreen() {
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const r = await runReconciliation();
      setResult(r);
    } catch (e: any) {
      setError(e?.message || 'Failed to run reconciliation');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmt = (v: string | number | undefined | null) => Number(v || 0).toLocaleString();

  if (loading && !result) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Reconciliation" subtitle="Detect financial discrepancies" />
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
          <Text style={styles.loadingText}>Running reconciliation...</Text>
        </View>
      </View>
    );
  }

  if (error && !result) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Reconciliation" subtitle="Detect financial discrepancies" />
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

  const allClear = (result?.total_issues || 0) === 0;

  return (
    <View style={styles.screen}>
      <ModernHeader title="Reconciliation" subtitle="Detect financial discrepancies" />

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
      >
        <View style={styles.body}>
          {/* Status banner */}
          <View style={[styles.statusBanner, { backgroundColor: allClear ? '#DCF5EC' : '#FEF3C7' }]}>
            <MaterialCommunityIcons
              name={allClear ? 'check-circle' : 'alert-outline'}
              size={28}
              color={allClear ? Brand.success : Brand.rating}
            />
            <View>
              <Text style={[styles.statusTitle, { color: allClear ? Brand.success : '#92400E' }]}>
                {allClear ? 'All Clear — No Discrepancies' : `${result?.total_issues || 0} Discrepancies Found`}
              </Text>
              <Text style={styles.statusSub}>Last run: {result?.timestamp?.slice(0, 19)}</Text>
            </View>
          </View>

          {/* Summary KPIs */}
          <View style={styles.kpiRow}>
            <KpiCard icon="store" label="Balance Mismatches" value={result?.store_balances?.length || 0} color="#16A34A" />
            <KpiCard icon="percent" label="Commission Mismatches" value={result?.commissions?.length || 0} color="#F59E0B" />
          </View>
          <View style={styles.kpiRow}>
            <KpiCard icon="file-document" label="Missing Payments" value={result?.payments_vs_ledger?.length || 0} color="#3B82F6" />
            <KpiCard icon="paper-plane" label="Missing Payouts" value={result?.payouts?.length || 0} color="#8B5CF6" />
          </View>

          {/* Store balance mismatches */}
          <DiscrepancySection
            title="Store Balance Mismatches"
            items={result?.store_balances || []}
            emptyText="No balance mismatches"
            renderRow={(item: any) => (
              <>
                <Text style={styles.dispLabel}>{item.store_name}</Text>
                <Text style={styles.dispValue}>Diff: UGX {fmt(item.difference)}</Text>
              </>
            )}
          />

          {/* Commission mismatches */}
          <DiscrepancySection
            title="Commission Mismatches"
            items={result?.commissions || []}
            emptyText="No commission mismatches"
            renderRow={(item: any) => (
              <>
                <Text style={styles.dispLabel}>Order #{item.order_number}</Text>
                <Text style={styles.dispValue}>Diff: UGX {fmt(item.difference)}</Text>
              </>
            )}
          />

          {/* Missing payments */}
          <DiscrepancySection
            title="Missing Payment Ledger Entries"
            items={result?.payments_vs_ledger || []}
            emptyText="All payments have ledger entries"
            renderRow={(item: any) => (
              <>
                <Text style={styles.dispLabel}>Payment #{item.payment_id}</Text>
                <Text style={styles.dispValue}>Order: {item.order_number} · UGX {fmt(item.amount)}</Text>
              </>
            )}
          />

          {/* Missing payouts */}
          <DiscrepancySection
            title="Missing Payout Ledger Entries"
            items={result?.payouts || []}
            emptyText="All payouts have ledger entries"
            renderRow={(item: any) => (
              <>
                <Text style={styles.dispLabel}>Payout #{item.payout_id}</Text>
                <Text style={styles.dispValue}>{item.store_name} · UGX {fmt(item.amount)}</Text>
              </>
            )}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function KpiCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <View style={[styles.kpiCard, { backgroundColor: color }]}>
      <MaterialCommunityIcons name={icon as any} size={22} color="#FFFFFF" />
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
    </View>
  );
}

function DiscrepancySection({
  title,
  items,
  emptyText,
  renderRow,
}: {
  title: string;
  items: any[];
  emptyText: string;
  renderRow: (item: any) => React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.length > 0 ? (
        items.map((item, i) => (
          <View key={`item-${i}`} style={styles.dispRow}>
            {renderRow(item)}
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="check-circle-outline" size={28} color={Brand.success} />
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      )}
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

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, padding: 16, marginBottom: 12,
  },
  statusTitle: { fontSize: 16, fontWeight: '800' },
  statusSub: { fontSize: 12, color: Brand.textSecondary, marginTop: 2 },

  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  kpiCard: {
    flex: 1, borderRadius: 16, padding: 14,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  kpiLabel: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '600', marginTop: 6 },
  kpiValue: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', marginTop: 2 },

  sectionCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Brand.text, marginBottom: 10 },

  dispRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Brand.borderLight,
  },
  dispLabel: { fontSize: 13, fontWeight: '600', color: Brand.text, flex: 1 },
  dispValue: { fontSize: 12, color: Brand.danger, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingVertical: 16 },
  emptyText: { marginTop: 6, fontSize: 13, color: Brand.textSecondary },
});
