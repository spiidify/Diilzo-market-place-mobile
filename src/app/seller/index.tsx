import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {Image,
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
import { getMyStore, type SellerDashboard } from '@/services/seller';

export default function SellerDashboardScreen() {
  const router = useRouter();
  const [data, setData] = useState<SellerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const result = await getMyStore();
      setData(result);
    } catch (e: any) {
      setError(e?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = data?.stats;
  const store = data?.store;

  const menuItems = [
    { icon: 'package-variant-closed', label: 'Products', color: '#3B82F6', route: '/seller/products' as any, count: stats?.total_products },
    { icon: 'clipboard-list-outline', label: 'Orders', color: '#16A34A', route: '/seller/orders' as any, count: stats?.pending_orders },
    { icon: 'wallet-outline', label: 'Earnings', color: '#8B5CF6', route: '/seller/earnings' as any },
    { icon: 'chart-line', label: 'Analytics', color: Brand.rating, route: '/seller/analytics' as any },
    { icon: 'bullhorn-outline', label: 'Promotions', color: '#F59E0B', route: '/seller/promotions' as any },
    { icon: 'chat-outline', label: 'Messages', color: '#EC4899', route: '/chat' as any },
    { icon: 'store-settings-outline', label: 'Store Settings', color: Brand.textSecondary, route: '/seller/settings' as any },
  ];

  if (loading && !data) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <Text style={styles.loadingText}>Loading dashboard...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <LinearGradient colors={[Brand.primary, Brand.primary, Brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.headerTitle}>Seller Dashboard</Text>
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
        <LinearGradient colors={[Brand.primary, Brand.primary, Brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Seller Dashboard</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

        <ScrollView
          style={styles.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
        >
          {/* ── Store info card ────────────────────────────────────── */}
          <View style={styles.storeCard}>
            <View style={styles.storeLogoWrap}>
              {store?.logo_url ? (
                <Image source={{ uri: store.logo_url }} style={styles.storeLogo} resizeMode="contain" />
              ) : (
                <View style={styles.storeLogoFallback}>
                  <MaterialCommunityIcons name="store" size={28} color="#FFFFFF" />
                </View>
              )}
            </View>
            <View style={styles.storeInfo}>
              <Text style={styles.storeName} numberOfLines={1}>{store?.name || 'My Store'}</Text>
              <Text style={styles.storeStatus}>
                {store?.status === 'approved' ? '✓ Active' : store?.status === 'pending' ? '⏳ Pending Review' : store?.status}
              </Text>
              {store?.is_wholesaler && (
                <View style={styles.supplierBadge}>
                  <MaterialCommunityIcons name="factory" size={10} color="#FFFFFF" />
                  <Text style={styles.supplierBadgeText}>Supplier</Text>
                </View>
              )}
            </View>
          </View>

          {/* ── Stats grid ─────────────────────────────────────────── */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <MaterialCommunityIcons name="package-variant-closed" size={24} color={Brand.primary} />
              <Text style={styles.statValue}>{stats?.total_products || 0}</Text>
              <Text style={styles.statLabel}>Products</Text>
            </View>
            <View style={styles.statCard}>
              <MaterialCommunityIcons name="clipboard-list-outline" size={24} color="#16A34A" />
              <Text style={styles.statValue}>{stats?.pending_orders || 0}</Text>
              <Text style={styles.statLabel}>Pending Orders</Text>
            </View>
            <View style={styles.statCard}>
              <MaterialCommunityIcons name="cash-multiple" size={24} color="#8B5CF6" />
              <Text style={styles.statValue}>{Number(stats?.available_balance || 0).toLocaleString()}</Text>
              <Text style={styles.statLabel}>Available (UGX)</Text>
            </View>
            <View style={styles.statCard}>
              <MaterialCommunityIcons name="clock-outline" size={24} color={Brand.rating} />
              <Text style={styles.statValue}>{Number(stats?.pending_balance || 0).toLocaleString()}</Text>
              <Text style={styles.statLabel}>Pending (UGX)</Text>
            </View>
          </View>

          {/* ── Lifetime sales banner ──────────────────────────────── */}
          <View style={styles.salesBanner}>
            <View>
              <Text style={styles.salesLabel}>Lifetime Sales</Text>
              <Text style={styles.salesValue}>UGX {Number(stats?.lifetime_sales || 0).toLocaleString()}</Text>
            </View>
            <View style={styles.salesRight}>
              <MaterialCommunityIcons name="star" size={18} color={Brand.rating} />
              <Text style={styles.ratingText}>{stats?.rating ? parseFloat(stats.rating).toFixed(1) : '0.0'}</Text>
              <Text style={styles.reviewText}>({stats?.review_count || 0})</Text>
            </View>
          </View>

          {/* ── Menu items ─────────────────────────────────────────── */}
          <View style={styles.menuSection}>
            <Text style={styles.menuTitle}>Manage Store</Text>
            {menuItems.map((item, index) => (
              <Pressable
                key={`seller-menu-${index}`}
                style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: Brand.surfaceAlt }]}
                onPress={() => router.push(item.route)}
              >
                <View style={[styles.menuIcon, { backgroundColor: item.color + '20' }]}>
                  <MaterialCommunityIcons name={item.icon as any} size={22} color={item.color} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                {item.count !== undefined && item.count > 0 && (
                  <View style={styles.menuBadge}>
                    <Text style={styles.menuBadgeText}>{item.count}</Text>
                  </View>
                )}
                <MaterialCommunityIcons name="chevron-right" size={22} color={Brand.textTertiary} />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  safeArea: { flex: 1, backgroundColor: Brand.primary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },

  body: { flex: 1 },

  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  loadingText: { marginTop: 8, color: Brand.textSecondary, fontSize: 14 },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center' },
  retryBtn: { marginTop: 16, backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#FFFFFF', fontWeight: '700' },

  // ── Store card ──────────────────────────────────────────────────
  storeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', marginHorizontal: 12, marginTop: 12,
    padding: 16, borderRadius: 16,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  storeLogoWrap: { width: 56, height: 56, borderRadius: 14, overflow: 'hidden' },
  storeLogo: { width: '100%', height: '100%' },
  storeLogoFallback: { width: '100%', height: '100%', backgroundColor: Brand.primary, justifyContent: 'center', alignItems: 'center' },
  storeInfo: { flex: 1, gap: 4 },
  storeName: { fontSize: 17, fontWeight: '700', color: Brand.text },
  storeStatus: { fontSize: 13, color: '#16A34A', fontWeight: '600' },
  supplierBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Brand.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, alignSelf: 'flex-start',
  },
  supplierBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },

  // ── Stats grid ──────────────────────────────────────────────────
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: 12, paddingTop: 12,
  },
  statCard: {
    flex: 1, minWidth: '46%', backgroundColor: '#FFFFFF',
    borderRadius: 14, padding: 16, gap: 6,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  statValue: { fontSize: 22, fontWeight: '800', color: Brand.text },
  statLabel: { fontSize: 12, color: Brand.textSecondary },

  // ── Sales banner ────────────────────────────────────────────────
  salesBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Brand.text, marginHorizontal: 12, marginTop: 12,
    padding: 18, borderRadius: 16,
  },
  salesLabel: { fontSize: 12, color: Brand.textTertiary, fontWeight: '600' },
  salesValue: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', marginTop: 4 },
  salesRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  reviewText: { fontSize: 12, color: Brand.textTertiary },

  // ── Menu ────────────────────────────────────────────────────────
  menuSection: { paddingHorizontal: 12, paddingTop: 20, paddingBottom: 32 },
  menuTitle: { fontSize: 16, fontWeight: '700', color: Brand.text, marginBottom: 10 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 12, marginBottom: 8,
  },
  menuIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: Brand.text },
  menuBadge: {
    backgroundColor: Brand.primary, minWidth: 22, height: 22, borderRadius: 11,
    paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center',
  },
  menuBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
});



