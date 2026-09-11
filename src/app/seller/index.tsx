import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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

// ── Stat card data ──────────────────────────────────────────────────
interface StatItem {
  icon: string;
  label: string;
  value: string;
  sublabel?: string;
  color: string;
  bgColor: string;
}

// ── Menu group definitions ──────────────────────────────────────────
interface MenuItem {
  icon: string;
  label: string;
  color: string;
  route: any;
  count?: number;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

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

  // ── Build stat cards (2-column grid) ──────────────────────────────
  const statCards: StatItem[] = [
    {
      icon: 'package-variant-closed',
      label: 'Products',
      value: String(stats?.total_products || 0),
      sublabel: stats?.live_products !== undefined ? `${stats.live_products} live` : undefined,
      color: '#3B82F6',
      bgColor: '#EFF6FF',
    },
    {
      icon: 'clipboard-list-outline',
      label: 'Pending Orders',
      value: String(stats?.pending_orders || 0),
      sublabel: stats?.total_orders !== undefined ? `${stats.total_orders} total` : undefined,
      color: '#F59E0B',
      bgColor: '#FFFBEB',
    },
    {
      icon: 'cash-multiple',
      label: 'Available',
      value: formatShort(Number(stats?.available_balance || 0)),
      sublabel: 'UGX',
      color: '#16A34A',
      bgColor: '#F0FDF4',
    },
    {
      icon: 'clock-outline',
      label: 'Pending',
      value: formatShort(Number(stats?.pending_balance || 0)),
      sublabel: 'UGX',
      color: '#8B5CF6',
      bgColor: '#F5F3FF',
    },
  ];

  // ── Build menu groups ─────────────────────────────────────────────
  const menuGroups: MenuGroup[] = [
    {
      title: 'Sales & Orders',
      items: [
        { icon: 'clipboard-list-outline', label: 'Orders', color: '#16A34A', route: '/seller/orders', count: stats?.pending_orders },
        { icon: 'truck-fast', label: 'Shipments', color: '#3B82F6', route: '/seller/shipments' },
        { icon: 'alert-circle-outline', label: 'Disputes', color: Brand.danger, route: '/seller/disputes' },
        { icon: 'file-document-outline', label: 'RFQs', color: '#8B5CF6', route: '/seller/rfqs' },
      ],
    },
    {
      title: 'Products & Inventory',
      items: [
        { icon: 'package-variant-closed', label: 'Products', color: '#3B82F6', route: '/seller/products', count: stats?.total_products },
        { icon: 'ticket-percent', label: 'Coupons', color: '#06B6D4', route: '/seller/coupons' },
        { icon: 'truck-outline', label: 'Shipping', color: '#16A34A', route: '/seller/shipping' },
        { icon: 'bullhorn-outline', label: 'Promotions', color: '#F59E0B', route: '/seller/promotions' },
      ],
    },
    {
      title: 'Finance & Earnings',
      items: [
        { icon: 'wallet-outline', label: 'Earnings', color: '#8B5CF6', route: '/seller/earnings' },
        { icon: 'cash', label: 'Payouts', color: '#16A34A', route: '/seller/payouts' },
        { icon: 'chart-pie', label: 'Finance', color: '#16A34A', route: '/seller/finance' },
        { icon: 'chart-line', label: 'Analytics', color: Brand.rating, route: '/seller/analytics' },
      ],
    },
    {
      title: 'Store Management',
      items: [
        { icon: 'account-group', label: 'Staff', color: '#3B82F6', route: '/seller/staff' },
        { icon: 'shield-check-outline', label: 'Verification', color: Brand.textSecondary, route: '/seller/verification' },
        { icon: 'chat-outline', label: 'Messages', color: '#EC4899', route: '/seller/messages' },
        { icon: 'store-settings-outline', label: 'Settings', color: Brand.textSecondary, route: '/seller/settings' },
      ],
    },
    {
      title: 'Marketing & Tools',
      items: [
        { icon: 'bullhorn-outline', label: 'Ad Wallet', color: '#F59E0B', route: '/seller/ad-wallet' },
        { icon: 'credit-card-outline', label: 'Subscription', color: '#06B6D4', route: '/seller/subscription' },
        { icon: 'store-cog', label: 'Merchant Studio', color: '#06B6D4', route: '/merchant-studio' },
        { icon: 'rocket-launch', label: 'AdPulse', color: '#EC4899', route: '/adpulse' },
      ],
    },
    {
      title: 'Platform',
      items: [
        { icon: 'shield-crown-outline', label: 'AdminOps', color: '#0A2E1A', route: '/adminops' },
      ],
    },
  ];

  // ── Loading state ─────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <View style={styles.screen}>
        <GradientHero title="Seller Dashboard" store={null} />
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </View>
    );
  }

  // ── Error state ───────────────────────────────────────────────────
  if (error) {
    return (
      <View style={styles.screen}>
        <GradientHero title="Seller Dashboard" store={null} />
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
      >
        {/* ── Gradient hero header with store info ─────────────────── */}
        <GradientHero title="Seller Dashboard" store={store} stats={stats} />

        {/* ── 2-column stats grid ──────────────────────────────────── */}
        <View style={styles.statsGrid}>
          {statCards.map((stat, i) => (
            <View key={`stat-${i}`} style={styles.statCard}>
              <View style={[styles.statIconWrap, { backgroundColor: stat.bgColor }]}>
                <MaterialCommunityIcons name={stat.icon as any} size={22} color={stat.color} />
              </View>
              <Text style={styles.statValue} numberOfLines={1}>{stat.value}</Text>
              {stat.sublabel ? <Text style={styles.statSublabel}>{stat.sublabel}</Text> : null}
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Lifetime sales + rating banner ───────────────────────── */}
        <View style={styles.salesBanner}>
          <View style={styles.salesLeft}>
            <MaterialCommunityIcons name="trending-up" size={20} color={Brand.primary} />
            <View>
              <Text style={styles.salesLabel}>Lifetime Sales</Text>
              <Text style={styles.salesValue}>UGX {Number(stats?.lifetime_sales || 0).toLocaleString()}</Text>
            </View>
          </View>
          <View style={styles.salesDivider} />
          <View style={styles.salesRight}>
            <MaterialCommunityIcons name="star" size={18} color={Brand.rating} />
            <View>
              <Text style={styles.salesLabel}>Rating</Text>
              <Text style={styles.salesValue}>
                {stats?.rating ? parseFloat(stats.rating).toFixed(1) : '0.0'}
                <Text style={styles.reviewText}> ({stats?.review_count || 0})</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* ── Quick action buttons ─────────────────────────────────── */}
        <View style={styles.quickActions}>
          <Pressable
            style={({ pressed }) => [styles.quickBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/seller/products' as any)}
          >
            <MaterialCommunityIcons name="plus-circle-outline" size={22} color="#FFFFFF" />
            <Text style={styles.quickBtnText}>Add Product</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.quickBtn, styles.quickBtnSecondary, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/seller/orders' as any)}
          >
            <MaterialCommunityIcons name="clipboard-list-outline" size={22} color={Brand.primary} />
            <Text style={styles.quickBtnTextDark}>View Orders</Text>
          </Pressable>
        </View>

        {/* ── Menu groups (2-column grid per section) ──────────────── */}
        {menuGroups.map((group, gi) => (
          <View key={`group-${gi}`} style={styles.menuGroup}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            <View style={styles.menuGrid}>
              {group.items.map((item, ii) => (
                <Pressable
                  key={`menu-${gi}-${ii}`}
                  style={({ pressed }) => [styles.menuCard, pressed && { transform: [{ scale: 0.97 }] }]}
                  onPress={() => router.push(item.route)}
                >
                  <View style={[styles.menuIconWrap, { backgroundColor: item.color + '18' }]}>
                    <MaterialCommunityIcons name={item.icon as any} size={24} color={item.color} />
                  </View>
                  <Text style={styles.menuLabel} numberOfLines={1}>{item.label}</Text>
                  {item.count !== undefined && item.count > 0 && (
                    <View style={styles.menuBadge}>
                      <Text style={styles.menuBadgeText}>{item.count}</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Helper: format large numbers (e.g. 1.2M, 15K) ───────────────────
function formatShort(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return String(n);
}

// ── Gradient hero header component ──────────────────────────────────
function GradientHero({ title, store, stats }: { title: string; store: any; stats?: any }) {
  return (
    <LinearGradient
      colors={[Brand.dark, Brand.accent, Brand.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <SafeAreaView edges={['top']} style={styles.heroSafe}>
        {/* Title row */}
        <View style={styles.heroTitleRow}>
          <Text style={styles.heroTitle}>{title}</Text>
          {store?.slug ? (
            <Pressable
              style={styles.heroViewStore}
              onPress={() => { }}
            >
              <MaterialCommunityIcons name="open-in-new" size={14} color="#FFFFFF" />
              <Text style={styles.heroViewStoreText}>View Store</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Store info */}
        <View style={styles.heroStoreRow}>
          <View style={styles.heroLogoWrap}>
            {store?.logo_url ? (
              <Image source={{ uri: store.logo_url }} style={styles.heroLogo} resizeMode="contain" />
            ) : (
              <View style={styles.heroLogoFallback}>
                <MaterialCommunityIcons name="store" size={26} color="#FFFFFF" />
              </View>
            )}
          </View>
          <View style={styles.heroStoreInfo}>
            <Text style={styles.heroStoreName} numberOfLines={1}>{store?.name || 'My Store'}</Text>
            <View style={styles.heroStatusRow}>
              <View style={[
                styles.heroStatusDot,
                { backgroundColor: store?.status === 'approved' ? '#4ADE80' : '#FBBF24' },
              ]} />
              <Text style={styles.heroStatusText}>
                {store?.status === 'approved' ? 'Active' : store?.status === 'pending' ? 'Pending Review' : (store?.status || '—')}
              </Text>
              {store?.is_wholesaler ? (
                <View style={styles.heroSupplierBadge}>
                  <MaterialCommunityIcons name="factory" size={9} color="#FFFFFF" />
                  <Text style={styles.heroSupplierText}>Supplier</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },

  body: { flex: 1 },

  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  loadingText: { marginTop: 8, color: Brand.textSecondary, fontSize: 14 },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center' },
  retryBtn: { marginTop: 16, backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  // ── Hero header ────────────────────────────────────────────────────
  hero: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  heroSafe: { gap: 16 },
  heroTitleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 8,
  },
  heroTitle: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },
  heroViewStore: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8,
  },
  heroViewStoreText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

  heroStoreRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroLogoWrap: { width: 52, height: 52, borderRadius: 14, overflow: 'hidden' },
  heroLogo: { width: '100%', height: '100%' },
  heroLogoFallback: {
    width: '100%', height: '100%', backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', borderRadius: 14,
  },
  heroStoreInfo: { flex: 1, gap: 5 },
  heroStoreName: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  heroStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroStatusDot: { width: 8, height: 8, borderRadius: 4 },
  heroStatusText: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  heroSupplierBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4,
  },
  heroSupplierText: { fontSize: 9, fontWeight: '700', color: '#FFFFFF' },

  // ── 2-column stats grid ────────────────────────────────────────────
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 14, marginTop: -12,
  },
  statCard: {
    width: '48%', marginHorizontal: '1%',
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    marginBottom: 10,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  statIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  statValue: { fontSize: 24, fontWeight: '900', color: Brand.text, letterSpacing: -0.5 },
  statSublabel: { fontSize: 11, color: Brand.textTertiary, fontWeight: '600', marginTop: -2 },
  statLabel: { fontSize: 12, color: Brand.textSecondary, fontWeight: '600', marginTop: 4 },

  // ── Sales + rating banner ──────────────────────────────────────────
  salesBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', marginHorizontal: 14, marginBottom: 12,
    padding: 16, borderRadius: 16,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  salesLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  salesDivider: { width: 1, height: 36, backgroundColor: Brand.borderLight, marginHorizontal: 8 },
  salesRight: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  salesLabel: { fontSize: 11, color: Brand.textTertiary, fontWeight: '600' },
  salesValue: { fontSize: 16, fontWeight: '800', color: Brand.text, marginTop: 2 },
  reviewText: { fontSize: 12, color: Brand.textTertiary, fontWeight: '500' },

  // ── Quick action buttons ───────────────────────────────────────────
  quickActions: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, marginBottom: 20 },
  quickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Brand.primary, paddingVertical: 14, borderRadius: 14,
  },
  quickBtnSecondary: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: Brand.primary },
  quickBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  quickBtnTextDark: { fontSize: 14, fontWeight: '800', color: Brand.primary },

  // ── Menu groups ────────────────────────────────────────────────────
  menuGroup: { paddingHorizontal: 14, marginBottom: 18 },
  groupTitle: {
    fontSize: 13, fontWeight: '800', color: Brand.textSecondary,
    marginBottom: 10, marginLeft: 2, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  menuCard: {
    width: '47%', backgroundColor: '#FFFFFF', borderRadius: 14,
    padding: 16, alignItems: 'flex-start',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  menuIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  menuLabel: { fontSize: 14, fontWeight: '700', color: Brand.text },
  menuBadge: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: Brand.primary, minWidth: 22, height: 22, borderRadius: 11,
    paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center',
  },
  menuBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
