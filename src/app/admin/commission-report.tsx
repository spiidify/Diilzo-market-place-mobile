import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import { getCommissionReport } from '@/services/adminApi';

interface CommissionReport {
  top_stores?: { store__name: string; store__slug: string; total_commission: string; order_count: number }[];
  monthly_data?: { label: string; value: number }[];
  total_commission?: string;
  total_orders?: number;
  avg_commission_rate?: string;
}

export default function AdminCommissionReportScreen() {
  const router = useRouter();
  const [report, setReport] = useState<CommissionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await getCommissionReport();
      setReport(data);
    } catch (e: any) {
      console.error('Commission report error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const maxValue = report?.monthly_data?.length ? Math.max(...report.monthly_data.map((d) => d.value), 1) : 1;

  return (
    <View style={styles.screen}>
      <ModernHeader title="Commission Report" />
      <View style={styles.body}>
        {loading ? (
          <View style={styles.centerBody}><ActivityIndicator size="large" color={Brand.primary} /></View>
        ) : (
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
          >
            <View style={styles.summaryContainer}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Total Commission</Text>
                <Text style={[styles.summaryValue, { color: Brand.primary }]}>UGX {Number(report?.total_commission || 0).toLocaleString()}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Total Orders</Text>
                <Text style={[styles.summaryValue, { color: Brand.text }]}>{report?.total_orders || 0}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Avg Rate</Text>
                <Text style={[styles.summaryValue, { color: Brand.accent }]}>{report?.avg_commission_rate || '0'}%</Text>
              </View>
            </View>

            {report?.monthly_data && report.monthly_data.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Monthly Commission</Text>
                <View style={styles.chartCard}>
                  {report.monthly_data.map((d, i) => (
                    <View key={i} style={styles.chartBar}>
                      <View style={styles.barContainer}>
                        <View style={[styles.barFill, { height: `${(d.value / maxValue) * 100}%`, backgroundColor: Brand.primary }]} />
                      </View>
                      <Text style={styles.barLabel}>{d.label}</Text>
                      <Text style={styles.barValue}>{d.value.toLocaleString()}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top Stores by Commission</Text>
              {report?.top_stores && report.top_stores.length > 0 ? (
                report.top_stores.map((store, i) => (
                  <View key={i} style={styles.storeCard}>
                    <View style={styles.storeRank}>
                      <Text style={styles.storeRankText}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.storeName} numberOfLines={1}>{store.store__name}</Text>
                      <Text style={styles.storeMeta}>{store.order_count} orders</Text>
                    </View>
                    <Text style={styles.storeCommission}>UGX {Number(store.total_commission).toLocaleString()}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="chart-bar" size={48} color={Brand.textTertiary} />
                  <Text style={styles.emptyText}>No data available</Text>
                  <Text style={styles.emptySub}>Commission data will appear here</Text>
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  body: { flex: 1 },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 12, paddingBottom: 40 },
  summaryContainer: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: Brand.textTertiary, textTransform: 'uppercase', marginBottom: 4 },
  summaryValue: { fontSize: 14, fontWeight: '800' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: Brand.textSecondary, marginBottom: 8, textTransform: 'uppercase' },
  chartCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'flex-end', minHeight: 160, gap: 8, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  chartBar: { flex: 1, alignItems: 'center' },
  barContainer: { width: '100%', height: 100, justifyContent: 'flex-end', marginBottom: 4 },
  barFill: { width: '100%', borderRadius: 4, minHeight: 2 },
  barLabel: { fontSize: 10, color: Brand.textTertiary, fontWeight: '600' },
  barValue: { fontSize: 10, color: Brand.textSecondary, fontWeight: '700' },
  storeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 8, gap: 12, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  storeRank: { width: 32, height: 32, borderRadius: 16, backgroundColor: Brand.primary, justifyContent: 'center', alignItems: 'center' },
  storeRankText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  storeName: { fontSize: 14, fontWeight: '700', color: Brand.text },
  storeMeta: { fontSize: 12, color: Brand.textTertiary },
  storeCommission: { fontSize: 14, fontWeight: '800', color: Brand.primary },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  emptySub: { fontSize: 13, color: Brand.textTertiary },
});
