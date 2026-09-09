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

import { Brand } from '@/constants/theme';
import { getDashboardMetrics, type DashboardMetrics } from '@/services/dashboardApi';

const POLL_INTERVAL_MS = 30000;

export default function AdminOpsCentralScreen() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const data = await getDashboardMetrics();
      setMetrics(data);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to load metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const metricCards = [
    { icon: 'shopping', label: 'Total Orders', value: metrics?.total_orders, color: '#3B82F6' },
    { icon: 'clock-outline', label: 'Pending Pickups', value: metrics?.pending_pickups, color: '#F59E0B' },
    { icon: 'package-variant-closed', label: 'Ready for Collection', value: metrics?.ready_for_collection, color: '#8B5CF6' },
    { icon: 'check-circle-outline', label: 'Collected', value: metrics?.collected, color: Brand.primary },
    { icon: 'truck-fast', label: 'Dispatched Fleet', value: metrics?.dispatched_fleet_items, color: '#EC4899' },
    { icon: 'map-marker', label: 'Active Stations', value: metrics?.active_pickup_stations, color: '#06B6D4' },
    { icon: 'truck', label: 'In-Transit Shipments', value: metrics?.in_transit_shipments, color: '#F97316' },
  ];

  if (loading && !metrics) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <Text style={styles.loadingText}>Loading AdminOps Central...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (error && !metrics) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <LinearGradient colors={[Brand.dark, Brand.darkLight, Brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.headerTitle}>AdminOps Central</Text>
            <View style={{ width: 24 }} />
          </LinearGradient>
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient colors={[Brand.dark, Brand.darkLight, Brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>AdminOps Central</Text>
            <Text style={styles.headerSub}>Operations Dashboard</Text>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live</Text>
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
        >
          {error ? (
            <View style={styles.errorBanner}>
              <MaterialCommunityIcons name="alert-circle" size={16} color={Brand.danger} />
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          ) : null}

          <Text style={styles.lastUpdated}>Last updated: {lastUpdated} · Auto-refresh 30s</Text>

          <View style={styles.metricsGrid}>
            {metricCards.map((card, index) => (
              <View key={`metric-${index}`} style={styles.metricCard}>
                <View style={[styles.metricIconWrap, { backgroundColor: card.color + '20' }]}>
                  <MaterialCommunityIcons name={card.icon as any} size={24} color={card.color} />
                </View>
                <Text style={styles.metricValue}>{card.value ?? '—'}</Text>
                <Text style={styles.metricLabel}>{card.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <MaterialCommunityIcons name="information-outline" size={20} color={Brand.textSecondary} />
              <Text style={styles.infoTitle}>About AdminOps Central</Text>
            </View>
            <Text style={styles.infoText}>
              This read-only mobile dashboard displays real-time operations metrics for
              logistics staff and super admins. Metrics auto-refresh every 30 seconds.
              Use the web dashboard at /admin-ops/ for full management capabilities including
              bulk actions, order editing, and pickup station management.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  safeArea: { flex: 1, backgroundColor: Brand.dark },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(50,199,0,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Brand.primary },
  liveText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },

  body: { flex: 1 },

  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  loadingText: { marginTop: 8, color: Brand.textSecondary, fontSize: 14 },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center' },
  retryBtn: { marginTop: 16, backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#FFFFFF', fontWeight: '700' },

  lastUpdated: { fontSize: 11, color: Brand.textTertiary, paddingHorizontal: 16, paddingTop: 12, fontWeight: '600' },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(220,38,38,0.08)', marginHorizontal: 12, marginTop: 12,
    padding: 12, borderRadius: 8,
  },
  errorBannerText: { fontSize: 12, color: Brand.danger, fontWeight: '600', flex: 1 },

  metricsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: 12, paddingTop: 12,
  },
  metricCard: {
    flex: 1, minWidth: '46%', backgroundColor: '#FFFFFF',
    borderRadius: 14, padding: 16, gap: 8,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  metricIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  metricValue: { fontSize: 28, fontWeight: '900', color: Brand.text },
  metricLabel: { fontSize: 12, color: Brand.textSecondary, fontWeight: '600' },

  infoCard: {
    backgroundColor: '#FFFFFF', marginHorizontal: 12, marginTop: 16, marginBottom: 32,
    padding: 16, borderRadius: 14,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  infoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  infoTitle: { fontSize: 14, fontWeight: '700', color: Brand.text },
  infoText: { fontSize: 13, color: Brand.textSecondary, lineHeight: 20 },
});
