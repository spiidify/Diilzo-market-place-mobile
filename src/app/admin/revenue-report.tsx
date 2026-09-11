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
import { getRevenueReport, type RevenueReport } from '@/services/financial';

export default function AdminRevenueReportScreen() {
  const [report, setReport] = useState<RevenueReport | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (period: number = days) => {
    try {
      setRefreshing(true);
      setError(null);
      const result = await getRevenueReport(period);
      setReport(result);
    } catch (e: any) {
      setError(e?.message || 'Failed to load revenue report');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const fmt = (v: string | number | undefined | null) => Number(v || 0).toLocaleString();

  const periods = [7, 30, 90, 365];

  if (loading && !report) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Revenue Report" subtitle="Platform revenue breakdown" />
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      </View>
    );
  }

  if (error && !report) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Revenue Report" subtitle="Platform revenue breakdown" />
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ModernHeader title="Revenue Report" subtitle="Platform revenue breakdown" />

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load()} colors={[Brand.primary]} tintColor={Brand.primary} />}
      >
        <View style={styles.body}>
          {/* Period selector */}
          <View style={styles.periodRow}>
            {periods.map((p) => (
              <Pressable
                key={p}
                style={[styles.periodBtn, days === p && { backgroundColor: Brand.primary }]}
                onPress={() => { setDays(p); load(p); }}
              >
                <Text style={[styles.periodText, days === p && { color: '#FFFFFF' }]}>
                  {p === 365 ? '1 Year' : `${p} Days`}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* KPI cards */}
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, { backgroundColor: '#3B82F6' }]}>
              <MaterialCommunityIcons name="shopping" size={22} color="#FFFFFF" />
              <Text style={styles.kpiLabel}>GMV</Text>
              <Text style={styles.kpiValue}>UGX {fmt(report?.gmv)}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: Brand.success }]}>
              <MaterialCommunityIcons name="chart-line" size={22} color="#FFFFFF" />
              <Text style={styles.kpiLabel}>Net Revenue</Text>
              <Text style={styles.kpiValue}>UGX {fmt(report?.net_revenue)}</Text>
            </View>
          </View>

          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, { backgroundColor: '#8B5CF6' }]}>
              <MaterialCommunityIcons name="percent" size={22} color="#FFFFFF" />
              <Text style={styles.kpiLabel}>Take Rate</Text>
              <Text style={styles.kpiValue}>{report?.take_rate || '0'}%</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: Brand.dark }]}>
              <MaterialCommunityIcons name="calendar-clock" size={22} color="#FFFFFF" />
              <Text style={styles.kpiLabel}>Period</Text>
              <Text style={styles.kpiValue}>{report?.period_days || days}d</Text>
            </View>
          </View>

          {/* Revenue breakdown */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Revenue Breakdown</Text>
            <RevenueRow label="Commission" value={report?.revenue?.commission} color={Brand.success} />
            <RevenueRow label="Commission Reversals" value={report?.revenue?.commission_reversals} color={Brand.danger} />
            <RevenueRow label="Net Commission" value={report?.revenue?.net_commission} color={Brand.text} bold />
            <RevenueRow label="Platform Fees" value={report?.revenue?.platform_fees} color={Brand.success} />
            <RevenueRow label="Shipping Margin" value={report?.revenue?.shipping_margin} color={Brand.success} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Revenue</Text>
              <Text style={[styles.totalValue, { color: Brand.success }]}>UGX {fmt(report?.revenue?.total)}</Text>
            </View>
          </View>

          {/* Cost breakdown */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Cost Breakdown</Text>
            <RevenueRow label="Refunds" value={report?.costs?.refunds} color={Brand.danger} />
            <RevenueRow label="Delivery Partner Costs" value={report?.costs?.delivery_partners} color={Brand.danger} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Costs</Text>
              <Text style={[styles.totalValue, { color: Brand.danger }]}>UGX {fmt(report?.costs?.total)}</Text>
            </View>
          </View>

          {/* Net revenue banner */}
          <View style={styles.netBanner}>
            <MaterialCommunityIcons name="cash" size={28} color={Brand.success} />
            <View>
              <Text style={styles.netBannerTitle}>Net Revenue</Text>
              <Text style={styles.netBannerValue}>UGX {fmt(report?.net_revenue)}</Text>
              <Text style={styles.netBannerSub}>Total revenue minus costs over {report?.period_days || days} days</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function RevenueRow({ label, value, color, bold }: { label: string; value?: string; color: string; bold?: boolean }) {
  return (
    <View style={styles.revenueRow}>
      <Text style={[styles.revenueLabel, bold && { fontWeight: '700' }]}>{label}</Text>
      <Text style={[styles.revenueValue, { color }, bold && { fontWeight: '800' }]}>UGX {Number(value || 0).toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  body: { padding: 12, paddingBottom: 32 },

  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  periodBtn: { flex: 1, borderWidth: 1, borderColor: Brand.border, borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: '#FFFFFF' },
  periodText: { fontSize: 12, fontWeight: '600', color: Brand.text },

  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  kpiCard: {
    flex: 1, borderRadius: 16, padding: 14,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  kpiLabel: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '600', marginTop: 6 },
  kpiValue: { fontSize: 15, fontWeight: '900', color: '#FFFFFF', marginTop: 2 },

  sectionCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Brand.text, marginBottom: 12 },

  revenueRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Brand.borderLight },
  revenueLabel: { fontSize: 13, color: Brand.text },
  revenueValue: { fontSize: 13, fontWeight: '700' },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, backgroundColor: Brand.surfaceAlt, borderRadius: 8, paddingHorizontal: 10, marginTop: 8 },
  totalLabel: { fontSize: 14, fontWeight: '700', color: Brand.text },
  totalValue: { fontSize: 16, fontWeight: '800' },

  netBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#DCF5EC', borderRadius: 16, padding: 16,
  },
  netBannerTitle: { fontSize: 13, color: Brand.textSecondary, fontWeight: '600' },
  netBannerValue: { fontSize: 22, fontWeight: '900', color: Brand.success },
  netBannerSub: { fontSize: 11, color: Brand.textTertiary, marginTop: 2 },
});
