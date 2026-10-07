import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    SectionList,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { GradientHeader } from '@/components/GradientHeader';
import { Skeleton } from '@/components/skeleton';
import { Brand } from '@/constants/theme';
import { useBadges } from '@/context/BadgeContext';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import {
    fetchNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    type AppNotification,
} from '@/services/notifications';

// Map notification type to icon + color
const TYPE_CONFIG: Record<string, {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  label: string;
}> = {
  order: { icon: 'shopping', color: '#3B82F6', label: 'Order' },
  payment: { icon: 'credit-card-outline', color: '#8B5CF6', label: 'Payment' },
  shipping: { icon: 'truck-fast-outline', color: '#06B6D4', label: 'Shipping' },
  promo: { icon: 'tag-outline', color: '#F59E0B', label: 'Promo' },
  review: { icon: 'star-outline', color: '#F59E0B', label: 'Review' },
  message: { icon: 'chat-outline', color: '#EC4899', label: 'Message' },
  chat: { icon: 'chat-outline', color: '#EC4899', label: 'Message' },
  dispute: { icon: 'alert-circle-outline', color: '#EF4444', label: 'Dispute' },
  payout: { icon: 'wallet-outline', color: '#10B981', label: 'Payout' },
  rfq: { icon: 'file-document-outline', color: '#F59E0B', label: 'Quote' },
  new_product: { icon: 'package-variant-closed', color: '#10B981', label: 'New Product' },
  price_drop: { icon: 'tag-outline', color: '#F59E0B', label: 'Price Drop' },
  restock: { icon: 'box', color: '#06B6D4', label: 'Restock' },
  wallet: { icon: 'wallet-outline', color: '#10B981', label: 'Wallet' },
  loyalty: { icon: 'medal-outline', color: '#8B5CF6', label: 'Loyalty' },
  system: { icon: 'information-outline', color: '#64748B', label: 'Info' },
  default: { icon: 'bell-outline', color: Brand.primary, label: 'Update' },
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] || TYPE_CONFIG.default;
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'orders', label: 'Orders' },
  { key: 'promos', label: 'Promos' },
  { key: 'messages', label: 'Messages' },
] as const;

type FilterKey = typeof FILTERS[number]['key'];

const ORDER_TYPES = ['order', 'payment', 'shipping', 'dispute', 'payout', 'rfq', 'review'];
const PROMO_TYPES = ['promo', 'system', 'new_product', 'price_drop', 'restock'];
const MESSAGE_TYPES = ['message', 'chat'];

function matchesFilter(n: AppNotification, f: FilterKey): boolean {
  switch (f) {
    case 'unread': return !n.is_read;
    case 'orders': return ORDER_TYPES.includes(n.notification_type);
    case 'promos': return PROMO_TYPES.includes(n.notification_type);
    case 'messages': return MESSAGE_TYPES.includes(n.notification_type);
    default: return true;
  }
}

// Translate web link_url values (emitted by the Django backend) into
// Expo Router paths. Returns null for routes that have no mobile screen.
function mapNotificationRoute(linkUrl: string): string | null {
  if (!linkUrl) return null;
  let path = linkUrl.startsWith('/') ? linkUrl : `/${linkUrl}`;
  path = path.split('#')[0].split('?')[0].replace(/\/+$/, '') || '/';

  // Orders
  let m = path.match(/^\/orders\/(\d+)$/);
  if (m) return `/buyer/orders/${m[1]}`;
  m = path.match(/^\/orders\/(\d+)\/track$/);
  if (m) return `/buyer/tracking?order_id=${m[1]}`;

  // Chat / messages — web uses /chat/<thread>/, /account/messages/<thread>/
  // and /sellers/messages/<thread>/; mobile thread screen is /chat/[id]
  m = path.match(/^\/chat\/(\d+)$/);
  if (m) return `/chat/${m[1]}`;
  m = path.match(/^\/(?:account|sellers)\/messages\/(\d+)$/);
  if (m) return `/chat/${m[1]}`;
  if (path === '/account/messages') return '/chat';
  if (path === '/sellers/messages') return '/seller/messages';

  // Products
  m = path.match(/^\/products\/([\w-]+)$/);
  if (m) return `/product/${m[1]}`;
  if (path === '/products') return '/search';

  // Seller detail pages
  m = path.match(/^\/sellers\/orders\/(\d+)$/);
  if (m) return `/seller/orders/${m[1]}`;
  m = path.match(/^\/sellers\/rfq\/(\d+)$/);
  if (m) return `/seller/rfqs/${m[1]}`;
  m = path.match(/^\/sellers\/disputes\/(\d+)$/);
  if (m) return `/seller/disputes/${m[1]}`;
  m = path.match(/^\/sellers\/shipments\/(\d+)$/);
  if (m) return `/seller/shipments/${m[1]}`;
  if (/^\/sellers\/pos\/sales\/\d+$/.test(path)) return '/seller/pos-payments';

  // Seller list pages
  const sellerMap: Record<string, string> = {
    '/sellers': '/seller',
    '/sellers/dashboard': '/seller',
    '/sellers/orders': '/seller/orders',
    '/sellers/earnings': '/seller/earnings',
    '/sellers/escrow': '/seller/escrow',
    '/sellers/disputes': '/seller/disputes',
    '/sellers/products': '/seller/products',
    '/sellers/rfqs': '/seller/rfqs',
    '/sellers/kyc': '/seller/verification',
    '/sellers/pos': '/seller/pos',
    '/sellers/pos/sales': '/seller/pos-payments',
    '/sellers/shipments': '/seller/shipments',
  };
  if (sellerMap[path]) return sellerMap[path];

  // Buyer/support pages
  if (path === '/buyer/support' || /^\/admin-support\/tickets/.test(path)) {
    return '/buyer/support';
  }
  if (path === '/account') return '/buyer';
  if (path === '/') return '/';

  return null;
}

function dayBucket(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  if (date >= startOfToday) return 'Today';
  if (date >= startOfYesterday) return 'Yesterday';
  return 'Earlier';
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { refreshBadges } = useBadges();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');

  const load = useCallback(async () => {
    try {
      setError(null);
      setRefreshing(true);
      const data = await fetchNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePressNotification = async (item: AppNotification) => {
    if (!item.is_read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      );
      try {
        await markNotificationRead(item.id);
        refreshBadges();
      } catch {
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, is_read: false } : n))
        );
      }
    }
    const route = mapNotificationRoute(item.link_url);
    if (route) {
      try {
        router.push(route as any);
      } catch {
        // ignore navigation errors
      }
    }
  };

  const handleMarkAllRead = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    const prev = notifications;
    setNotifications((items) => items.map((n) => ({ ...n, is_read: true })));
    try {
      await markAllNotificationsRead();
      refreshBadges();
    } catch {
      setNotifications(prev);
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of FILTERS) {
      counts[f.key] = f.key === 'all'
        ? notifications.length
        : notifications.filter((n) => matchesFilter(n, f.key)).length;
    }
    return counts;
  }, [notifications]);

  // Group filtered notifications into Today / Yesterday / Earlier sections
  const sections = useMemo(() => {
    const filtered = notifications.filter((n) => matchesFilter(n, filter));
    const buckets: { title: string; data: AppNotification[] }[] = [
      { title: 'Today', data: [] },
      { title: 'Yesterday', data: [] },
      { title: 'Earlier', data: [] },
    ];
    for (const n of filtered) {
      const bucket = dayBucket(n.created_at);
      buckets.find((b) => b.title === bucket)?.data.push(n);
    }
    return buckets.filter((b) => b.data.length > 0);
  }, [notifications, filter]);

  const renderItem = ({ item }: { item: AppNotification }) => {
    const config = getTypeConfig(item.notification_type);
    return (
      <Pressable
        style={({ pressed }) => [
          styles.notifCard,
          !item.is_read && styles.notifCardUnread,
          pressed && { opacity: 0.85 },
        ]}
        onPress={() => handlePressNotification(item)}
      >
        <View style={[styles.notifIcon, { backgroundColor: config.color + '15' }]}>
          <MaterialCommunityIcons name={config.icon} size={20} color={config.color} />
        </View>
        <View style={styles.notifContent}>
          <View style={styles.notifHeader}>
            <Text style={[styles.notifTitle, !item.is_read && styles.notifTitleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
            {!item.is_read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notifMessage} numberOfLines={2}>
            {item.message}
          </Text>
          <View style={styles.notifFooter}>
            <View style={[styles.typeTag, { backgroundColor: config.color + '12' }]}>
              <Text style={[styles.typeTagText, { color: config.color }]}>{config.label}</Text>
            </View>
            <Text style={styles.notifTime}>{formatTimestamp(item.created_at)}</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderLoading = () => (
    <View style={styles.list}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={[styles.notifCard, { marginBottom: 10 }]}>
          <Skeleton width={44} height={44} borderRadius={12} />
          <View style={styles.notifContent}>
            <Skeleton width="65%" height={14} />
            <Skeleton width="90%" height={12} style={{ marginTop: 8 }} />
            <Skeleton width="40%" height={10} style={{ marginTop: 8 }} />
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.screen}>
      <GradientHeader
        title="Notifications"
        subtitle={!loading && unreadCount > 0 ? `${unreadCount} unread` : undefined}
      />

      {/* Filter tabs — horizontally scrollable, Mark-all pinned to the right */}
      <View style={styles.filterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          style={styles.filterScroll}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const count = filterCounts[f.key] || 0;
            return (
              <Pressable
                key={f.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{f.label}</Text>
                {count > 0 && (
                  <View style={[styles.filterCount, active && styles.filterCountActive]}>
                    <Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>
                      {count > 99 ? '99+' : count}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.markAllWrap}>
          <Pressable
            onPress={handleMarkAllRead}
            disabled={markingAll || unreadCount === 0}
            hitSlop={12}
            style={styles.markAllBtn}
          >
            {markingAll ? (
              <ActivityIndicator size="small" color={Brand.primary} />
            ) : (
              <MaterialCommunityIcons
                name="check-all"
                size={16}
                color={unreadCount === 0 ? colors.textTertiary : Brand.primary}
              />
            )}
          </Pressable>
        </View>
      </View>

      {loading ? (
        renderLoading()
      ) : error ? (
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.centerBody}>
          <View style={styles.emptyIcon}>
            <MaterialCommunityIcons name="bell-off-outline" size={40} color={colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>
            {filter === 'unread' ? 'All caught up' : 'No notifications yet'}
          </Text>
          <Text style={styles.emptySub}>
            {filter === 'unread'
              ? 'You have read all your notifications.'
              : filter === 'all'
                ? "You'll see updates about your orders, promos and messages here."
                : 'Try another filter to see notifications.'}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => `${item.id}`}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          maxToRenderPerBatch={12}
          windowSize={11}
          initialNumToRender={12}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={load}
              colors={[Brand.primary]}
              tintColor={Brand.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          SectionSeparatorComponent={() => <View style={{ height: 4 }} />}
        />
      )}
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },

  // Filter row
  filterWrap: {
    backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.borderLight,
    flexDirection: 'row', alignItems: 'center',
  },
  filterScroll: { flex: 1 },
  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  markAllWrap: {
    paddingHorizontal: 10, borderLeftWidth: 1, borderLeftColor: c.borderLight,
    alignSelf: 'stretch', justifyContent: 'center',
  },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18,
    backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border,
  },
  filterChipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  filterChipText: { fontSize: 12, fontWeight: '700', color: c.textSecondary },
  filterChipTextActive: { color: '#FFFFFF' },
  filterCount: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: c.border, alignItems: 'center', justifyContent: 'center',
  },
  filterCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  filterCountText: { fontSize: 10, fontWeight: '800', color: c.textSecondary },
  filterCountTextActive: { color: '#FFFFFF' },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  markAllText: { fontSize: 12, fontWeight: '700', color: Brand.primary },

  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: c.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { marginTop: 14, fontSize: 16, fontWeight: '800', color: c.text },
  emptySub: { marginTop: 6, fontSize: 13, color: c.textSecondary, textAlign: 'center', lineHeight: 19 },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  list: { padding: 12, paddingBottom: 30 },
  sectionHeader: {
    fontSize: 12, fontWeight: '800', color: c.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 10, marginTop: 6, marginLeft: 4,
  },

  // Notification card
  notifCard: {
    flexDirection: 'row', gap: 12,
    backgroundColor: c.surface, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: c.borderLight,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  notifCardUnread: {
    backgroundColor: '#F0F7FF',
    borderColor: '#BFDBFE',
  },
  notifIcon: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  notifContent: { flex: 1, gap: 4 },
  notifHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notifTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: c.textSecondary },
  notifTitleUnread: { fontWeight: '800', color: c.text },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Brand.primary },
  notifMessage: { fontSize: 13, color: c.textSecondary, lineHeight: 19 },
  notifFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  typeTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  typeTagText: { fontSize: 10, fontWeight: '800' },
  notifTime: { fontSize: 11, color: c.textTertiary },
});
