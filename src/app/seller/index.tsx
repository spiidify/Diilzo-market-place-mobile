import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useAuth } from '@/context/AuthContext';
import { useBadges } from '@/context/BadgeContext';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
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

const STATUS_DOT_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  accepted: '#3B82F6',
  processing: '#8B5CF6',
  shipped: '#06B6D4',
  delivered: '#16A34A',
  cancelled: '#EF4444',
};

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
  const { user } = useAuth();
  const [data, setData] = useState<SellerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { chatUnread, refreshBadges } = useBadges();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const result = await getMyStore();
      setData(result);
      // Redirect to pending screen if store is not approved
      if (result?.store?.status && result.store.status !== 'approved') {
        router.replace('/seller/pending' as any);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh badges when screen gains focus (also polled every 20s by BadgeProvider)
  useFocusEffect(
    useCallback(() => {
      refreshBadges();
    }, [refreshBadges])
  );

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
        { icon: 'account-group-outline', label: 'Customers', color: '#10B981', route: '/seller/customers' },
        { icon: 'truck-fast', label: 'Shipments', color: '#3B82F6', route: '/seller/shipments' },
        { icon: 'alert-circle-outline', label: 'Disputes', color: Brand.danger, route: '/seller/disputes' },
        { icon: 'cash-refund', label: 'Refunds', color: '#F59E0B', route: '/seller/refunds' },
        { icon: 'file-document-outline', label: 'RFQs', color: '#8B5CF6', route: '/seller/rfqs' },
      ],
    },
    {
      title: 'Products & Inventory',
      items: [
        { icon: 'package-variant-closed', label: 'Products', color: '#3B82F6', route: '/seller/products', count: stats?.total_products },
        { icon: 'ticket-percent', label: 'Coupons', color: '#06B6D4', route: '/seller/coupons' },
        { icon: 'truck-outline', label: 'Delivery', color: '#16A34A', route: '/seller/shipping' },
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
        { icon: 'lock-outline', label: 'Escrow', color: '#F59E0B', route: '/seller/escrow' },
        { icon: 'receipt', label: 'Commissions', color: '#8B5CF6', route: '/seller/commissions' },
      ],
    },
    {
      title: 'Store Management',
      items: [
        { icon: 'account-group', label: 'Staff', color: '#3B82F6', route: '/seller/staff' },
        { icon: 'shield-check-outline', label: 'Verification', color: colors.textSecondary, route: '/seller/verification' },
        { icon: 'crown', label: 'Membership', color: '#F59E0B', route: '/seller/membership' },
        { icon: 'chat-outline', label: 'Messages', color: '#EC4899', route: '/seller/messages', count: chatUnread },
        { icon: 'store-settings-outline', label: 'Settings', color: colors.textSecondary, route: '/seller/settings' },
        { icon: 'storefront', label: 'My Store', color: Brand.primary, route: store?.slug ? `/store/${store.slug}` : '/seller/settings' },
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { load(); refreshBadges(); }} colors={[Brand.primary]} tintColor={Brand.primary} />}
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

        {/* ── Supplier KPIs (B2B only) ─────────────────────────────── */}
        {data?.supplier_stats && (
          <View style={styles.supplierKpiRow}>
            <Pressable style={styles.supplierKpiCard} onPress={() => router.push('/seller/rfqs' as any)}>
              <MaterialCommunityIcons name="file-document-outline" size={20} color="#8B5CF6" />
              <Text style={styles.supplierKpiValue}>{data.supplier_stats.pending_rfqs}</Text>
              <Text style={styles.supplierKpiLabel}>Pending RFQs</Text>
            </Pressable>
            <Pressable style={styles.supplierKpiCard} onPress={() => router.push('/seller/rfqs' as any)}>
              <MaterialCommunityIcons name="check-circle-outline" size={20} color={Brand.primary} />
              <Text style={styles.supplierKpiValue}>{data.supplier_stats.accepted_rfqs}</Text>
              <Text style={styles.supplierKpiLabel}>Accepted</Text>
            </Pressable>
            <Pressable style={styles.supplierKpiCard} onPress={() => router.push('/seller/messages' as any)}>
              <MaterialCommunityIcons name="comment-text-outline" size={20} color="#3B82F6" />
              <Text style={styles.supplierKpiValue}>{data.supplier_stats.unread_inquiries}</Text>
              <Text style={styles.supplierKpiLabel}>Inquiries</Text>
            </Pressable>
          </View>
        )}

        {/* ── Profile completion (suppliers) ──────────────────────── */}
        {data?.profile_completion && data.profile_completion.percentage < 100 && (
          <Pressable
            style={styles.completionCard}
            onPress={() => router.push('/seller/settings' as any)}
          >
            <View style={styles.completionHeader}>
              <MaterialCommunityIcons name="clipboard-check-outline" size={20} color={Brand.primary} />
              <Text style={styles.completionTitle}>Profile Completion</Text>
              <Text style={styles.completionPct}>{data.profile_completion.percentage}%</Text>
            </View>
            <View style={styles.completionBar}>
              <View style={[styles.completionFill, { width: `${data.profile_completion.percentage}%` }]} />
            </View>
            <Text style={styles.completionSub}>
              {data.profile_completion.completed}/{data.profile_completion.total} fields completed · Tap to finish
            </Text>
          </Pressable>
        )}

        {/* ── Recent Orders (full-width) ──────────────────────────── */}
        <View style={styles.fullWidgetCard}>
          <View style={styles.widgetHeader}>
            <Text style={styles.widgetTitle}>Recent Orders</Text>
            <Pressable onPress={() => router.push('/seller/orders' as any)}>
              <Text style={styles.widgetLink}>View All ›</Text>
            </Pressable>
          </View>
          {data?.recent_orders && data.recent_orders.length > 0 ? (
            data.recent_orders.slice(0, 3).map((order, idx) => {
              const statusColor = STATUS_DOT_COLORS[order.status] || colors.textTertiary;
              return (
                <Pressable
                  key={`order-${idx}`}
                  style={({ pressed }) => [styles.orderRow, pressed && { opacity: 0.85 }]}
                  onPress={() => router.push(`/seller/orders/${order.id}` as any)}
                >
                  <View style={[styles.orderStatusDot, { backgroundColor: statusColor }]} />
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderNum}>#{order.order_number}</Text>
                    <Text style={styles.orderDate}>{new Date(order.created_at).toLocaleDateString()}</Text>
                  </View>
                  <View style={styles.orderStatusBadge}>
                    <Text style={[styles.orderStatusText, { color: statusColor }]}>
                      {order.status}
                    </Text>
                  </View>
                  <Text style={styles.orderAmount}>UGX {Number(order.seller_amount).toLocaleString()}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textTertiary} />
                </Pressable>
              );
            })
          ) : (
            <View style={styles.widgetEmpty}>
              <MaterialCommunityIcons name="inbox-outline" size={24} color={colors.textTertiary} />
              <Text style={styles.widgetEmptyText}>No orders yet</Text>
            </View>
          )}
        </View>

        {/* ── Low Stock Alerts (full-width) ────────────────────────── */}
        <View style={styles.fullWidgetCard}>
          <View style={styles.widgetHeader}>
            <Text style={styles.widgetTitle}>Low Stock Alerts</Text>
            <Pressable onPress={() => router.push('/seller/products' as any)}>
              <Text style={styles.widgetLink}>View All ›</Text>
            </Pressable>
          </View>
          {data?.low_stock_products && data.low_stock_products.length > 0 ? (
            data.low_stock_products.slice(0, 3).map((prod, idx) => (
              <Pressable
                key={`stock-${idx}`}
                style={({ pressed }) => [styles.orderRow, pressed && { opacity: 0.85 }]}
                onPress={() => router.push(`/seller/products/edit?id=${prod.id}` as any)}
              >
                <MaterialCommunityIcons
                  name={prod.stock_quantity === 0 ? 'alert-circle' : 'package-variant-closed'}
                  size={18}
                  color={prod.stock_quantity === 0 ? Brand.danger : Brand.rating}
                />
                <View style={styles.orderInfo}>
                  <Text style={styles.orderNum} numberOfLines={1}>{prod.name}</Text>
                  <Text style={styles.orderDate}>Product ID: {prod.id}</Text>
                </View>
                <Text style={[styles.orderAmount, { color: prod.stock_quantity === 0 ? Brand.danger : Brand.rating }]}>
                  {prod.stock_quantity} left
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textTertiary} />
              </Pressable>
            ))
          ) : (
            <View style={styles.widgetEmpty}>
              <MaterialCommunityIcons name="check-circle-outline" size={24} color={Brand.primary} />
              <Text style={styles.widgetEmptyText}>All stock healthy</Text>
            </View>
          )}
        </View>

        {/* ── Role switching ─────────────────────────────────────────── */}
        <View style={styles.roleSwitchSection}>
          {/* Switch to Buyer Mode */}
          <Pressable
            style={({ pressed }) => [styles.roleSwitchBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/buyer' as any)}
          >
            <View style={styles.roleSwitchIcon}>
              <MaterialCommunityIcons name="shopping" size={22} color={Brand.primary} />
            </View>
            <View style={styles.roleSwitchInfo}>
              <Text style={styles.roleSwitchTitle}>Switch to Buyer Mode</Text>
              <Text style={styles.roleSwitchSub}>Browse and shop products</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
          </Pressable>

          {/* Admin access for superusers */}
          {user?.is_superuser && (
            <Pressable
              style={({ pressed }) => [styles.roleSwitchBtn, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/admin' as any)}
            >
              <View style={[styles.roleSwitchIcon, { backgroundColor: '#8B5CF612' }]}>
                <MaterialCommunityIcons name="view-dashboard" size={22} color="#8B5CF6" />
              </View>
              <View style={styles.roleSwitchInfo}>
                <Text style={styles.roleSwitchTitle}>Admin Dashboard</Text>
                <Text style={styles.roleSwitchSub}>Full platform management</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
            </Pressable>
          )}
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
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const location = [store?.city, store?.country].filter(Boolean).join(', ');
  const rating = stats?.rating ? parseFloat(stats.rating).toFixed(1) : null;
  const followers = store?.follower_count || 0;
  const products = stats?.total_products || 0;

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
              onPress={() => router.push(`/store/${store.slug}` as any)}
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
            {store?.tagline ? (
              <Text style={styles.heroTagline} numberOfLines={1}>{store.tagline}</Text>
            ) : null}
            {store?.status ? (
              <View style={styles.heroStatusRow}>
                <View style={[
                  styles.heroStatusDot,
                  { backgroundColor: store.status === 'approved' ? '#4ADE80' : '#FBBF24' },
                ]} />
                <Text style={styles.heroStatusText}>
                  {store.status === 'approved' ? 'Active' : store.status === 'pending' ? 'Pending Review' : store.status}
                </Text>
                {store?.is_wholesaler ? (
                  <View style={styles.heroSupplierBadge}>
                    <MaterialCommunityIcons name="factory" size={9} color="#FFFFFF" />
                    <Text style={styles.heroSupplierText}>Supplier</Text>
                  </View>
                ) : null}
              </View>
            ) : store?.is_wholesaler ? (
              <View style={styles.heroStatusRow}>
                <View style={styles.heroSupplierBadge}>
                  <MaterialCommunityIcons name="factory" size={9} color="#FFFFFF" />
                  <Text style={styles.heroSupplierText}>Supplier</Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* Store metrics row */}
        <View style={styles.heroMetricsRow}>
          {location ? (
            <View style={styles.heroMetric}>
              <MaterialCommunityIcons name="map-marker-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.heroMetricText} numberOfLines={1}>{location}</Text>
            </View>
          ) : null}
          {rating ? (
            <View style={styles.heroMetric}>
              <MaterialCommunityIcons name="star" size={14} color="#FBBF24" />
              <Text style={styles.heroMetricText}>{rating} ({stats?.review_count || 0})</Text>
            </View>
          ) : null}
          {followers > 0 ? (
            <View style={styles.heroMetric}>
              <MaterialCommunityIcons name="account-group-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.heroMetricText}>{followers} followers</Text>
            </View>
          ) : null}
          {products > 0 ? (
            <View style={styles.heroMetric}>
              <MaterialCommunityIcons name="package-variant-closed" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.heroMetricText}>{products} products</Text>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ── Styles ──────────────────────────────────────────────────────────
const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surfaceAlt },

  body: { flex: 1 },

  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  loadingText: { marginTop: 8, color: c.textSecondary, fontSize: 14 },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center' },
  retryBtn: { marginTop: 16, backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  // ── Hero header ────────────────────────────────────────────────────
  hero: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingBottom: 20,
    paddingHorizontal: 12,
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
  heroStoreInfo: { flex: 1, gap: 4 },
  heroStoreName: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  heroTagline: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  heroStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroStatusDot: { width: 8, height: 8, borderRadius: 4 },
  heroStatusText: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  heroSupplierBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4,
  },
  heroSupplierText: { fontSize: 9, fontWeight: '700', color: '#FFFFFF' },

  // Store metrics row
  heroMetricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingHorizontal: 4 },
  heroMetric: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroMetricText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },

  // ── 2-column stats grid ────────────────────────────────────────────
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    rowGap: 10, columnGap: 10,
    paddingHorizontal: 8, marginTop: -12, marginBottom: 12,
  },
  statCard: {
    flexBasis: '48%', flexGrow: 1,
    backgroundColor: c.surface, borderRadius: 16, padding: 16,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  statIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  statValue: { fontSize: 24, fontWeight: '900', color: c.text, letterSpacing: -0.5 },
  statSublabel: { fontSize: 11, color: c.textTertiary, fontWeight: '600', marginTop: -2 },
  statLabel: { fontSize: 12, color: c.textSecondary, fontWeight: '600', marginTop: 4 },

  // ── Sales + rating banner ──────────────────────────────────────────
  salesBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: c.surface, marginHorizontal: 8, marginBottom: 12,
    padding: 16, borderRadius: 16,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  salesLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  salesDivider: { width: 1, height: 36, backgroundColor: c.borderLight, marginHorizontal: 8 },
  salesRight: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  salesLabel: { fontSize: 11, color: c.textTertiary, fontWeight: '600' },
  salesValue: { fontSize: 16, fontWeight: '800', color: c.text, marginTop: 2 },
  reviewText: { fontSize: 12, color: c.textTertiary, fontWeight: '500' },

  // ── Quick action buttons ───────────────────────────────────────────
  quickActions: { flexDirection: 'row', gap: 10, paddingHorizontal: 8, marginBottom: 20 },
  quickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Brand.primary, paddingVertical: 14, borderRadius: 14,
  },
  quickBtnSecondary: { backgroundColor: c.surface, borderWidth: 1.5, borderColor: Brand.primary },
  quickBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  quickBtnTextDark: { fontSize: 14, fontWeight: '800', color: Brand.primary },

  // ── Supplier KPIs ───────────────────────────────────────────────────
  supplierKpiRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 8, marginBottom: 14 },
  supplierKpiCard: {
    flex: 1, backgroundColor: c.surface, borderRadius: 14, padding: 14,
    alignItems: 'center', gap: 4, elevation: 2, shadowColor: '#000',
    shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  supplierKpiValue: { fontSize: 18, fontWeight: '900', color: c.text },
  supplierKpiLabel: { fontSize: 11, color: c.textTertiary, fontWeight: '600' },

  // ── Profile completion ───────────────────────────────────────────────
  completionCard: {
    backgroundColor: c.surface, marginHorizontal: 8, marginBottom: 14,
    padding: 16, borderRadius: 14, borderWidth: 1, borderColor: Brand.primary + '30',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  completionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  completionTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: c.text },
  completionPct: { fontSize: 16, fontWeight: '900', color: Brand.primary },
  completionBar: { height: 8, backgroundColor: c.surfaceAlt, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  completionFill: { height: '100%', backgroundColor: Brand.primary, borderRadius: 4 },
  completionSub: { fontSize: 12, color: c.textTertiary },

  // ── Full-width widget cards ────────────────────────────────────────
  fullWidgetCard: {
    backgroundColor: c.surface, marginHorizontal: 8, marginBottom: 12,
    padding: 14, borderRadius: 14, elevation: 2, shadowColor: '#000',
    shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  widgetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  widgetTitle: { fontSize: 13, fontWeight: '800', color: c.text, textTransform: 'uppercase', letterSpacing: 0.3 },
  widgetLink: { fontSize: 12, fontWeight: '700', color: Brand.primary },

  // ── Compact order row ───────────────────────────────────────────────
  orderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: c.borderLight,
  },
  orderStatusDot: { width: 8, height: 8, borderRadius: 4 },
  orderInfo: { flex: 1, gap: 2 },
  orderNum: { fontSize: 13, fontWeight: '700', color: c.text },
  orderDate: { fontSize: 11, color: c.textTertiary },
  orderStatusBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: c.surfaceAlt,
  },
  orderStatusText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  orderAmount: { fontSize: 13, fontWeight: '800', color: c.text, marginRight: 4 },

  widgetEmpty: { alignItems: 'center', paddingVertical: 16, gap: 6 },
  widgetEmptyText: { fontSize: 12, color: c.textTertiary },

  // ── Role switching ──────────────────────────────────────────────────
  roleSwitchSection: { paddingHorizontal: 8, marginBottom: 18, gap: 8 },
  roleSwitchBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: c.surface, padding: 16, borderRadius: 14,
    borderWidth: 1, borderColor: c.borderLight,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  roleSwitchIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Brand.primary + '12',
    justifyContent: 'center', alignItems: 'center',
  },
  roleSwitchInfo: { flex: 1, gap: 2 },
  roleSwitchTitle: { fontSize: 15, fontWeight: '700', color: c.text },
  roleSwitchSub: { fontSize: 13, color: c.textTertiary },

  // ── Menu groups ────────────────────────────────────────────────────
  menuGroup: { paddingHorizontal: 8, marginBottom: 18 },
  groupTitle: {
    fontSize: 13, fontWeight: '800', color: c.textSecondary,
    marginBottom: 10, marginLeft: 2, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  menuCard: {
    flexBasis: '47%', flexGrow: 1, backgroundColor: c.surface, borderRadius: 14,
    padding: 16, alignItems: 'flex-start',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  menuIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  menuLabel: { fontSize: 14, fontWeight: '700', color: c.text },
  menuBadge: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: Brand.primary, minWidth: 22, height: 22, borderRadius: 11,
    paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center',
  },
  menuBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
