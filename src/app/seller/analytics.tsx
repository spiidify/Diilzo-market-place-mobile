import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Spacing } from '@/constants/theme';
import { apiRequest } from '@/services/api';
import { getMyStore } from '@/services/seller';

type Period = '7d' | '30d' | '90d';

interface AnalyticsData {
  revenue: number;
  orders_count: number;
  total_views: number;
  conversion_rate: number;
  revenue_series: { label: string; value: number }[];
  top_products: { id: number; name: string; sold: number; revenue: number; image_url?: string | null }[];
  sales_by_category: { name: string; revenue: number }[];
}

const PERIODS: { key: Period; label: string }[] = [
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: '90d', label: '90 Days' },
];

export default function SellerAnalyticsScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('30d');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      // Try the dedicated analytics endpoint; fall back to deriving from dashboard
      try {
        const result = await apiRequest<AnalyticsData>({
          method: 'GET',
          url: '/sellers/api/seller/analytics/',
          params: { period },
        });
        setData(result);
      } catch {
        // Fallback: derive basic stats from the dashboard store
        const dashboard = await getMyStore();
        const stats = dashboard?.stats;
        const fallback: AnalyticsData = {
          revenue: Number(stats?.lifetime_sales || 0),
          orders_count: stats?.total_orders || 0,
          total_views: 0,
          conversion_rate: 0,
          revenue_series: [],
          top_products: [],
          sales_by_category: [],
        };
        setData(fallback);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const maxRevenue = data?.revenue_series?.length
    ? Math.max(...data.revenue_series.map((s) => s.value), 1)
    : 1;

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient
          colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Analytics</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

        {/* ── Period selector ─────────────────────────────────────── */}
        <View style={styles.periodRow}>
          {PERIODS.map((p) => (
            <Pressable
              key={p.key}
              style={[styles.periodBtn, period === p.key && styles.periodBtnActive]}
              onPress={() => setPeriod(p.key)}
            >
              <Text
                style={[
                  styles.periodText,
                  period === p.key && styles.periodTextActive,
                ]}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading && !data ? (
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <Text style={styles.loadingText}>Loading analytics...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={load}
                colors={[Brand.primary]}
                tintColor={Brand.primary}
              />
            }
          >
            {/* ── KPI cards ─────────────────────────────────────────── */}
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <View style={[styles.kpiIcon, { backgroundColor: Brand.primary + '20' }]}>
                  <MaterialCommunityIcons name="cash-multiple" size={22} color={Brand.primary} />
                </View>
                <Text style={styles.kpiValue}>UGX {Number(data?.revenue || 0).toLocaleString()}</Text>
                <Text style={styles.kpiLabel}>Revenue</Text>
              </View>

              <View style={styles.kpiCard}>
                <View style={[styles.kpiIcon, { backgroundColor: '#16A34A20' }]}>
                  <MaterialCommunityIcons name="clipboard-list-outline" size={22} color="#16A34A" />
                </View>
                <Text style={styles.kpiValue}>{data?.orders_count || 0}</Text>
                <Text style={styles.kpiLabel}>Orders</Text>
              </View>

              <View style={styles.kpiCard}>
                <View style={[styles.kpiIcon, { backgroundColor: '#3B82F620' }]}>
                  <MaterialCommunityIcons name="eye-outline" size={22} color="#3B82F6" />
                </View>
                <Text style={styles.kpiValue}>{Number(data?.total_views || 0).toLocaleString()}</Text>
                <Text style={styles.kpiLabel}>Total Views</Text>
              </View>

              <View style={styles.kpiCard}>
                <View style={[styles.kpiIcon, { backgroundColor: Brand.rating + '20' }]}>
                  <MaterialCommunityIcons name="percent" size={22} color={Brand.rating} />
                </View>
                <Text style={styles.kpiValue}>{Number(data?.conversion_rate || 0).toFixed(1)}%</Text>
                <Text style={styles.kpiLabel}>Conversion</Text>
              </View>
            </View>

            {/* ── Revenue chart ─────────────────────────────────────── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Revenue Trend</Text>
              {data?.revenue_series && data.revenue_series.length > 0 ? (
                <View style={styles.chart}>
                  {data.revenue_series.map((point, idx) => {
                    const heightPct = (point.value / maxRevenue) * 100;
                    return (
                      <View key={`bar-${idx}`} style={styles.barCol}>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.bar,
                              {
                                height: `${Math.max(heightPct, 4)}%`,
                                backgroundColor: idx === data.revenue_series.length - 1
                                  ? Brand.primary
                                  : Brand.primaryDark,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.barLabel} numberOfLines={1}>
                          {point.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyChart}>
                  <MaterialCommunityIcons name="chart-bar" size={36} color={Brand.textTertiary} />
                  <Text style={styles.emptyChartText}>No revenue data for this period</Text>
                </View>
              )}
            </View>

            {/* ── Top products ──────────────────────────────────────── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Top Products</Text>
              {data?.top_products && data.top_products.length > 0 ? (
                <View style={styles.listInner}>
                  {data.top_products.slice(0, 5).map((prod, idx) => (
                    <View key={`top-${prod.id}-${idx}`} style={styles.topProductRow}>
                      <View style={styles.rankBadge}>
                        <Text style={styles.rankText}>{idx + 1}</Text>
                      </View>
                      <View style={styles.topProductInfo}>
                        <Text style={styles.topProductName} numberOfLines={1}>
                          {prod.name}
                        </Text>
                        <Text style={styles.topProductMeta}>
                          {prod.sold} sold · UGX {Number(prod.revenue).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>No product sales yet</Text>
              )}
            </View>

            {/* ── Sales by category ─────────────────────────────────── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sales by Category</Text>
              {data?.sales_by_category && data.sales_by_category.length > 0 ? (
                <View style={styles.listInner}>
                  {data.sales_by_category.map((cat, idx) => {
                    const totalCat = data.sales_by_category.reduce(
                      (sum, c) => sum + c.revenue,
                      0
                    );
                    const pct = totalCat > 0 ? (cat.revenue / totalCat) * 100 : 0;
                    return (
                      <View key={`cat-${idx}`} style={styles.categoryRow}>
                        <View style={styles.categoryHeader}>
                          <Text style={styles.categoryName} numberOfLines={1}>
                            {cat.name}
                          </Text>
                          <Text style={styles.categoryValue}>
                            UGX {Number(cat.revenue).toLocaleString()}
                          </Text>
                        </View>
                        <View style={styles.progressTrack}>
                          <View
                            style={[styles.progressBar, { width: `${Math.max(pct, 3)}%` }]}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.emptyText}>No category sales yet</Text>
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  safeArea: { flex: 1, backgroundColor: Brand.primaryDark },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },

  // ── Period selector ───────────────────────────────────────────
  periodRow: {
    flexDirection: 'row',
    backgroundColor: Brand.surface,
    marginHorizontal: Spacing.three,
    marginTop: Spacing.three - Spacing.half,
    borderRadius: 12,
    padding: Spacing.one,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: Spacing.two + Spacing.half,
    borderRadius: 9,
    alignItems: 'center',
  },
  periodBtnActive: { backgroundColor: Brand.primary },
  periodText: { fontSize: 13, fontWeight: '600', color: Brand.textSecondary },
  periodTextActive: { color: '#FFFFFF', fontWeight: '700' },

  body: { flex: 1 },
  bodyContent: { padding: Spacing.three, paddingBottom: Spacing.six },

  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.four },
  loadingText: { marginTop: Spacing.two, color: Brand.textSecondary, fontSize: 14 },
  errorText: { marginTop: Spacing.three - Spacing.half, fontSize: 14, color: Brand.danger, textAlign: 'center' },
  retryBtn: {
    marginTop: Spacing.three + Spacing.half,
    backgroundColor: Brand.primary,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + Spacing.half,
    borderRadius: 10,
  },
  retryText: { color: '#FFFFFF', fontWeight: '700' },

  // ── KPI grid ──────────────────────────────────────────────────
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two + Spacing.half,
    marginBottom: Spacing.three - Spacing.half,
  },
  kpiCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: Brand.surface,
    borderRadius: 14,
    padding: Spacing.three - Spacing.half,
    gap: Spacing.one + Spacing.half,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  kpiIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiValue: { fontSize: 18, fontWeight: '800', color: Brand.text },
  kpiLabel: { fontSize: 12, color: Brand.textSecondary, fontWeight: '500' },

  // ── Card ──────────────────────────────────────────────────────
  card: {
    backgroundColor: Brand.surface,
    borderRadius: 14,
    padding: Spacing.three + Spacing.half,
    marginBottom: Spacing.three - Spacing.half,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Brand.text, marginBottom: Spacing.three - Spacing.half },

  // ── Chart ─────────────────────────────────────────────────────
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 160,
    gap: Spacing.one + Spacing.half,
  },
  barCol: { flex: 1, alignItems: 'center', gap: Spacing.one + Spacing.half },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '80%', borderRadius: 6, minHeight: 4 },
  barLabel: { fontSize: 10, color: Brand.textTertiary, fontWeight: '500' },

  emptyChart: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.four, gap: Spacing.two },
  emptyChartText: { fontSize: 13, color: Brand.textTertiary },

  // ── Top products ──────────────────────────────────────────────
  listInner: { gap: Spacing.two + Spacing.half },
  topProductRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - Spacing.half },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Brand.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: { fontSize: 13, fontWeight: '800', color: Brand.primary },
  topProductInfo: { flex: 1, gap: Spacing.half },
  topProductName: { fontSize: 14, fontWeight: '600', color: Brand.text },
  topProductMeta: { fontSize: 12, color: Brand.textSecondary },

  // ── Category ──────────────────────────────────────────────────
  categoryRow: { gap: Spacing.one + Spacing.half },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryName: { flex: 1, fontSize: 13, fontWeight: '600', color: Brand.text },
  categoryValue: { fontSize: 12, fontWeight: '700', color: Brand.primary },
  progressTrack: {
    height: 8,
    backgroundColor: Brand.surfaceAlt,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: { height: '100%', backgroundColor: Brand.primary, borderRadius: 4 },

  emptyText: { fontSize: 13, color: Brand.textTertiary, paddingVertical: Spacing.two },
});
