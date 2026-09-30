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

const STATUS_DOT_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  accepted: '#3B82F6',
  processing: '#8B5CF6',
  shipped: '#06B6D4',
  delivered: '#16A34A',
  cancelled: '#EF4444',
};

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

  useFocusEffect(
    useCallback(() => {
      refreshBadges();
    }, [refreshBadges])
  );

  const stats = data?.stats;
  const store = data?.store;

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
      title: 'Products & In-Store POS',
      items: [
        { icon: 'package-variant-closed', label: 'Products', color: '#3B82F6', route: '/seller/products', count: stats?.total_products },
        { icon: 'warehouse', label: 'Inventory', color: '#8B5CF6', route: '/seller/inventory' },
        { icon: 'cash-register', label: 'Point of Sale (POS)', color: '#10B981', route: '/seller/pos' },
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

  if (loading && !data) {
    return (
      <View style={styles.screen}>
        <DashboardHero store={null} />
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <DashboardHero store={null} />
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

  return (
    <View style={styles.screen}>
      <DashboardHero store={store} stats={stats} />

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { load(); refreshBadges(); }} colors={[Brand.primary]} tintColor={Brand.primary} />}
      >
        {/* ── Quick actions ─────────────────────────────────────────── */}
        <View style={styles.quickRow}>
          <Pressable
            style={({ pressed }) => [styles.quickBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/seller/products' as any)}
          >
            <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
            <Text style={styles.quickBtnText}>Add Product</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.quickBtn, styles.quickBtnGhost, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/seller/pos' as any)}
          >
            <MaterialCommunityIcons name="cash-register" size={18} color="#7C3AED" />
            <Text style={styles.quickBtnTextDark}>POS</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.quickBtn, styles.quickBtnGhost, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/seller/orders' as any)}
          >
            <MaterialCommunityIcons name="clipboard-list-outline" size={18} color={Brand.primary} />
            <Text style={styles.quickBtnTextDark}>Orders</Text>
            {(stats?.pending_orders || 0) > 0 && (
              <View style={styles.quickBadge}>
                <Text style={styles.quickBadgeText}>{stats!.pending_orders}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* ── Supplier KPIs (B2B only) ──────────────────────────────── */}
        {data?.supplier_stats && (
          <View style={styles.card}>
            <View style={styles.kpiRow}>
              <Pressable style={styles.kpiItem} onPress={() => router.push('/seller/rfqs' as any)}>
                <Text style={styles.kpiValue}>{data.supplier_stats.pending_rfqs}</Text>
                <Text style={styles.kpiLabel}>Pending RFQs</Text>
              </Pressable>
              <View style={styles.kpiDivider} />
              <Pressable style={styles.kpiItem} onPress={() => router.push('/seller/rfqs' as any)}>
                <Text style={styles.kpiValue}>{data.supplier_stats.accepted_rfqs}</Text>
                <Text style={styles.kpiLabel}>Accepted</Text>
              </Pressable>
              <View style={styles.kpiDivider} />
              <Pressable style={styles.kpiItem} onPress={() => router.push('/seller/messages' as any)}>
                <Text style={styles.kpiValue}>{data.supplier_stats.unread_inquiries}</Text>
                <Text style={styles.kpiLabel}>Inquiries</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── Profile completion ────────────────────────────────────── */}
        {data?.profile_completion && data.profile_completion.percentage < 100 && (
          <Pressable
            style={({ pressed }) => [styles.card, styles.completionCard, pressed && { opacity: 0.9 }]}
            onPress={() => router.push('/seller/settings' as any)}
          >
            <View style={styles.completionHead}>
              <Text style={styles.completionTitle}>Complete your profile</Text>
              <Text style={styles.completionPct}>{data.profile_completion.percentage}%</Text>
            </View>
            <View style={styles.completionBar}>
              <View style={[styles.completionFill, { width: `${data.profile_completion.percentage}%` }]} />
            </View>
          </Pressable>
        )}

        {/* ── Recent orders ─────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Recent Orders</Text>
            <Pressable style={styles.cardLink} onPress={() => router.push('/seller/orders' as any)} hitSlop={8}>
              <Text style={styles.cardLinkText}>View all</Text>
              <MaterialCommunityIcons name="chevron-right" size={14} color={Brand.primary} />
            </Pressable>
          </View>
          {data?.recent_orders && data.recent_orders.length > 0 ? (
            data.recent_orders.slice(0, 3).map((order, idx) => {
              const statusColor = STATUS_DOT_COLORS[order.status] || colors.textTertiary;
              return (
                <Pressable
                  key={`order-${idx}`}
                  style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: colors.surfaceAlt }]}
                  onPress={() => router.push(`/seller/orders/${order.id}` as any)}
                >
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle} numberOfLines={1}>#{order.order_number}</Text>
                    <Text style={styles.rowSub}>{new Date(order.created_at).toLocaleDateString()}</Text>
                  </View>
                  <Text style={[styles.rowStatus, { color: statusColor }]}>{order.status}</Text>
                  <Text style={styles.rowAmount}>UGX {Number(order.seller_amount).toLocaleString()}</Text>
                </Pressable>
              );
            })
          ) : (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>No orders yet</Text>
            </View>
          )}
        </View>

        {/* ── Low stock alerts — only when there are alerts ─────────── */}
        {data?.low_stock_products && data.low_stock_products.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>Low Stock</Text>
              <Pressable style={styles.cardLink} onPress={() => router.push('/seller/products' as any)} hitSlop={8}>
                <Text style={styles.cardLinkText}>View all</Text>
                <MaterialCommunityIcons name="chevron-right" size={14} color={Brand.primary} />
              </Pressable>
            </View>
            {data.low_stock_products.slice(0, 3).map((prod, idx) => (
              <Pressable
                key={`stock-${idx}`}
                style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: colors.surfaceAlt }]}
                onPress={() => router.push(`/seller/products/edit?id=${prod.id}` as any)}
              >
                <MaterialCommunityIcons
                  name={prod.stock_quantity === 0 ? 'alert-circle' : 'package-variant-closed'}
                  size={16}
                  color={prod.stock_quantity === 0 ? Brand.danger : Brand.rating}
                />
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{prod.name}</Text>
                </View>
                <Text style={[styles.rowAmount, { color: prod.stock_quantity === 0 ? Brand.danger : Brand.rating }]}>
                  {prod.stock_quantity} left
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* ── Menu groups — compact rows ────────────────────────────── */}
        {menuGroups.map((group, gi) => (
          <View key={`group-${gi}`} style={styles.card}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            {group.items.map((item, ii) => (
              <View key={`menu-${gi}-${ii}`}>
                {ii > 0 && <View style={styles.rowDivider} />}
                <Pressable
                  style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: colors.surfaceAlt }]}
                  onPress={() => router.push(item.route)}
                >
                  <View style={[styles.menuIcon, { backgroundColor: item.color + '16' }]}>
                    <MaterialCommunityIcons name={item.icon as any} size={18} color={item.color} />
                  </View>
                  <Text style={styles.menuLabel} numberOfLines={1}>{item.label}</Text>
                  {item.count !== undefined && item.count > 0 && (
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{item.count}</Text>
                    </View>
                  )}
                  <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textTertiary} />
                </Pressable>
              </View>
            ))}
          </View>
        ))}

        {/* ── Role switching ────────────────────────────────────────── */}
        <View style={styles.card}>
          {user?.is_superuser && (
            <>
              <Pressable
                style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: colors.surfaceAlt }]}
                onPress={() => router.push('/admin' as any)}
              >
                <View style={[styles.menuIcon, { backgroundColor: '#8B5CF616' }]}>
                  <MaterialCommunityIcons name="view-dashboard" size={18} color="#8B5CF6" />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.menuLabel}>Admin Dashboard</Text>
                  <Text style={styles.rowSub}>Full platform management</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textTertiary} />
              </Pressable>
              <View style={styles.rowDivider} />
            </>
          )}
          <Pressable
            style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: colors.surfaceAlt }]}
            onPress={() => router.push('/buyer' as any)}
          >
            <View style={[styles.menuIcon, { backgroundColor: Brand.primary + '16' }]}>
              <MaterialCommunityIcons name="shopping" size={18} color={Brand.primary} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.menuLabel}>Switch to Buyer Mode</Text>
              <Text style={styles.rowSub}>Browse and shop products</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textTertiary} />
          </Pressable>
        </View>
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

// ── Gradient header: title + store details + compact balance strip ──
function DashboardHero({ store, stats }: { store?: any; stats?: any }) {
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
        <View style={styles.heroTopRow}>
          <Text style={styles.heroTitle}>Seller Dashboard</Text>
          {store?.slug ? (
            <Pressable
              style={({ pressed }) => [styles.heroStoreBtn, pressed && { opacity: 0.8 }]}
              onPress={() => router.push(`/store/${store.slug}` as any)}
            >
              <MaterialCommunityIcons name="storefront-outline" size={13} color="#FFFFFF" />
              <Text style={styles.heroStoreBtnText}>View Store</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Store details — amber panel that reads "selling" */}
        <View style={styles.storePanel}>
        <View style={styles.heroStoreRow}>
          <View style={styles.heroLogoWrap}>
            {store?.logo_url ? (
              <Image source={{ uri: store.logo_url }} style={styles.heroLogo} resizeMode="contain" />
            ) : (
              <MaterialCommunityIcons name="store" size={24} color={Brand.primary} />
            )}
          </View>
          <View style={styles.heroStoreInfo}>
            <Text style={styles.heroStoreName} numberOfLines={1}>{store?.name || 'My Store'}</Text>
            <View style={styles.heroStatusRow}>
              {store?.status ? (
                <>
                  <View style={[
                    styles.heroStatusDot,
                    { backgroundColor: store.status === 'approved' ? '#4ADE80' : '#FBBF24' },
                  ]} />
                  <Text style={styles.heroStatusText}>
                    {store.status === 'approved' ? 'Active' : store.status === 'pending' ? 'Pending Review' : store.status}
                  </Text>
                </>
              ) : null}
              {store?.is_wholesaler ? (
                <View style={styles.heroChip}>
                  <MaterialCommunityIcons name="factory" size={9} color="#FFFFFF" />
                  <Text style={styles.heroChipText}>Supplier</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* Store meta — one inline row */}
        {(location || rating || followers > 0 || products > 0) ? (
          <View style={styles.heroMeta}>
            {location ? (
              <View style={styles.heroMetaItem}>
                <MaterialCommunityIcons name="map-marker-outline" size={12} color={colors.textTertiary} />
                <Text style={styles.heroMetaText} numberOfLines={1}>{location}</Text>
              </View>
            ) : null}
            {rating ? (
              <View style={styles.heroMetaItem}>
                <MaterialCommunityIcons name="star" size={12} color={Brand.rating} />
                <Text style={styles.heroMetaText}>{rating} ({stats?.review_count || 0})</Text>
              </View>
            ) : null}
            {followers > 0 ? (
              <View style={styles.heroMetaItem}>
                <MaterialCommunityIcons name="account-group-outline" size={12} color={colors.textTertiary} />
                <Text style={styles.heroMetaText}>{followers}</Text>
              </View>
            ) : null}
            {products > 0 ? (
              <View style={styles.heroMetaItem}>
                <MaterialCommunityIcons name="package-variant-closed" size={12} color={colors.textTertiary} />
                <Text style={styles.heroMetaText}>{products} products</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        </View>

        {/* Compact money strip — the stats that actually matter */}
        {stats ? (
          <View style={styles.moneyRow}>
            <View style={styles.moneyTile}>
              <Text style={styles.moneyLabel}>AVAILABLE</Text>
              <Text style={styles.moneyValue} numberOfLines={1}>UGX {formatShort(Number(stats.available_balance || 0))}</Text>
            </View>
            <View style={styles.moneyTile}>
              <Text style={styles.moneyLabel}>PENDING</Text>
              <Text style={styles.moneyValue} numberOfLines={1}>UGX {formatShort(Number(stats.pending_balance || 0))}</Text>
            </View>
            <View style={styles.moneyTile}>
              <Text style={styles.moneyLabel}>ORDERS</Text>
              <Text style={styles.moneyValue} numberOfLines={1}>{stats.pending_orders || 0} pending</Text>
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </LinearGradient>
  );
}

// ── Styles ──────────────────────────────────────────────────────────
const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surfaceAlt },
  body: { flex: 1 },
  bodyContent: { paddingTop: 12, paddingBottom: 32, gap: 10 },

  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  loadingText: { marginTop: 8, color: c.textSecondary, fontSize: 14 },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center' },
  retryBtn: { marginTop: 16, backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  // ── Gradient hero ─────────────────────────────────────────────────
  hero: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  heroSafe: { gap: 10 },
  heroTopRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 6,
  },
  heroTitle: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },
  heroStoreBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8,
  },
  heroStoreBtnText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

  storePanel: {
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  heroStoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroLogoWrap: {
    width: 44, height: 44, borderRadius: 12, overflow: 'hidden',
    backgroundColor: Brand.primary + '14', justifyContent: 'center', alignItems: 'center',
  },
  heroLogo: { width: '100%', height: '100%', backgroundColor: '#FFFFFF' },
  heroStoreInfo: { flex: 1, gap: 3 },
  heroStoreName: { fontSize: 17, fontWeight: '800', color: c.text },
  heroStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroStatusDot: { width: 7, height: 7, borderRadius: 4 },
  heroStatusText: { fontSize: 11, color: c.textSecondary, fontWeight: '600' },
  heroChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#F59E0B', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  heroChipText: { fontSize: 9, fontWeight: '700', color: '#FFFFFF' },

  heroMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  heroMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  heroMetaText: { fontSize: 11, color: c.textSecondary, fontWeight: '500' },

  moneyRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  moneyTile: {
    flex: 1, backgroundColor: c.surface, borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 10, gap: 2,
  },
  moneyLabel: { fontSize: 9, fontWeight: '700', color: c.textTertiary, letterSpacing: 0.5 },
  moneyValue: { fontSize: 14, fontWeight: '800', color: c.text },

  // ── Quick actions ─────────────────────────────────────────────────
  quickRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 10 },
  quickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Brand.primary, paddingVertical: 11, borderRadius: 12,
  },
  quickBtnGhost: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderLight },
  quickBtnText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  quickBtnTextDark: { fontSize: 13, fontWeight: '800', color: c.text },
  quickBadge: {
    backgroundColor: Brand.danger, minWidth: 18, height: 18, borderRadius: 9,
    paddingHorizontal: 5, justifyContent: 'center', alignItems: 'center',
  },
  quickBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },

  // ── Cards ─────────────────────────────────────────────────────────
  card: {
    backgroundColor: c.surface, marginHorizontal: 10, borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 12,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 12, fontWeight: '800', color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  cardLink: { flexDirection: 'row', alignItems: 'center' },
  cardLinkText: { fontSize: 12, fontWeight: '700', color: Brand.primary },
  groupTitle: { fontSize: 12, fontWeight: '800', color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2, paddingTop: 2 },

  // ── Compact list rows ─────────────────────────────────────────────
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: 2,
    borderRadius: 8,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  rowInfo: { flex: 1, gap: 1 },
  rowTitle: { fontSize: 13, fontWeight: '700', color: c.text },
  rowSub: { fontSize: 11, color: c.textTertiary },
  rowStatus: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  rowAmount: { fontSize: 12, fontWeight: '800', color: c.text },

  emptyRow: { alignItems: 'center', paddingVertical: 12 },
  emptyText: { fontSize: 12, color: c.textTertiary },

  rowDivider: { height: 1, backgroundColor: c.borderLight, marginLeft: 44 },

  // ── Menu rows ─────────────────────────────────────────────────────
  menuRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingHorizontal: 2, borderRadius: 8,
  },
  menuIcon: {
    width: 32, height: 32, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center',
  },
  menuLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: c.text },
  countBadge: {
    backgroundColor: Brand.primary, minWidth: 20, height: 20, borderRadius: 10,
    paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center',
  },
  countBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },

  // ── Supplier KPIs ─────────────────────────────────────────────────
  kpiRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  kpiItem: { flex: 1, alignItems: 'center', gap: 1, paddingVertical: 6 },
  kpiValue: { fontSize: 17, fontWeight: '900', color: c.text },
  kpiLabel: { fontSize: 10, color: c.textTertiary, fontWeight: '600' },
  kpiDivider: { width: 1, height: 28, backgroundColor: c.borderLight },

  // ── Profile completion ────────────────────────────────────────────
  completionCard: { gap: 6 },
  completionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  completionTitle: { fontSize: 13, fontWeight: '700', color: c.text },
  completionPct: { fontSize: 14, fontWeight: '900', color: Brand.primary },
  completionBar: { height: 6, backgroundColor: c.surfaceAlt, borderRadius: 3, overflow: 'hidden' },
  completionFill: { height: '100%', backgroundColor: Brand.primary, borderRadius: 3 },
});
