import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
    Image,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { GradientHeader } from '@/components/GradientHeader';
import { OrderListSkeleton } from '@/components/skeleton';
import { Brand } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { confirmReceipt, fetchOrders, reorder } from '@/services/orders';
import type { Order } from '@/types';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'to_pay', label: 'To Pay' },
  { key: 'to_ship', label: 'To Ship' },
  { key: 'to_receive', label: 'To Receive' },
  { key: 'to_review', label: 'To Review' },
  { key: 'cancelled', label: 'Cancelled' },
] as const;

type FilterKey = typeof FILTERS[number]['key'];

function matchesFilter(o: Order, f: FilterKey): boolean {
  switch (f) {
    case 'to_pay': return o.payment_status === 'pending' && o.status === 'pending';
    case 'to_ship': return o.payment_status === 'paid' && (o.status === 'pending' || o.status === 'processing');
    case 'to_receive': return o.status === 'shipped';
    case 'to_review': return o.status === 'delivered';
    case 'cancelled': return o.status === 'cancelled' || o.status === 'refunded';
    default: return true;
  }
}

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'Pending', color: '#F59E0B', icon: 'clock-outline' },
  processing: { label: 'Processing', color: '#8B5CF6', icon: 'package-variant' },
  shipped: { label: 'On the way', color: '#06B6D4', icon: 'truck-fast-outline' },
  delivered: { label: 'Delivered', color: '#16A34A', icon: 'check-decagram-outline' },
  cancelled: { label: 'Cancelled', color: '#EF4444', icon: 'close-circle-outline' },
  refunded: { label: 'Refunded', color: '#06B6D4', icon: 'cash-refund' },
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function BuyerOrdersScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<number | null>(null);
  const params = useLocalSearchParams<{ status?: string }>();
  const [filter, setFilter] = useState<FilterKey>((params.status as FilterKey) || 'all');

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const data = await fetchOrders();
      setOrders(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredOrders = useMemo(
    () => orders.filter((o) => matchesFilter(o, filter)),
    [orders, filter]
  );

  // Per-filter counts for the chips
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of FILTERS) {
      counts[f.key] = f.key === 'all' ? orders.length : orders.filter((o) => matchesFilter(o, f.key)).length;
    }
    return counts;
  }, [orders]);

  const handleConfirm = (order: Order) => {
    Alert.alert(
      'Confirm Receipt',
      'Confirming releases the escrow payment to the seller. Only confirm if you received everything.',
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'I received it',
          onPress: async () => {
            try {
              setActionBusy(order.id);
              await confirmReceipt(order.id);
              load();
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.detail || e?.message || 'Failed to confirm receipt');
            } finally {
              setActionBusy(null);
            }
          },
        },
      ]
    );
  };

  const handleBuyAgain = async (order: Order) => {
    try {
      setActionBusy(order.id);
      const res = await reorder(order.id);
      Alert.alert('Added to Cart', `${res.added} item(s) added to your cart.`, [
        { text: 'Keep Shopping', style: 'cancel' },
        { text: 'View Cart', onPress: () => router.push('/cart' as any) },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || e?.message || 'Could not reorder');
    } finally {
      setActionBusy(null);
    }
  };

  const renderItem = ({ item }: { item: Order }) => {
    const meta = STATUS_META[item.status] || { label: item.status, color: colors.textTertiary, icon: 'circle-outline' };
    const unpaid = item.payment_status === 'pending';
    const thumbs = (item.suborders || [])
      .flatMap((s) => s.items || [])
      .map((i) => i.product_image_url || i.product_image)
      .filter(Boolean) as string[];
    const stores = [...new Set((item.suborders || []).map((s) => s.store_name).filter(Boolean))];
    const busy = actionBusy === item.id;

    // Contextual actions
    const actions: { label: string; icon: string; primary?: boolean; onPress: () => void }[] = [];
    if (item.status === 'shipped') {
      actions.push({ label: 'Track', icon: 'truck-fast-outline', primary: true, onPress: () => router.push(`/buyer/tracking?order_id=${item.id}` as any) });
      actions.push({ label: 'Confirm Receipt', icon: 'check-decagram-outline', onPress: () => handleConfirm(item) });
    }
    if (item.status === 'delivered') {
      const firstSlug = item.suborders?.[0]?.items?.[0]?.product_slug;
      actions.push({ label: 'Review', icon: 'star-outline', primary: true, onPress: () => firstSlug ? router.push(`/product/${firstSlug}` as any) : router.push('/buyer/reviews' as any) });
      actions.push({ label: 'Buy Again', icon: 'refresh', onPress: () => handleBuyAgain(item) });
    }
    if (unpaid && item.status === 'pending') {
      actions.push({ label: 'Pay Now', icon: 'credit-card-outline', primary: true, onPress: () => router.push(`/buyer/orders/${item.id}` as any) });
    }
    if (item.status === 'cancelled' || item.status === 'refunded') {
      actions.push({ label: 'Buy Again', icon: 'refresh', primary: true, onPress: () => handleBuyAgain(item) });
    }
    if (item.status === 'pending' || item.status === 'processing') {
      actions.push({ label: 'Track', icon: 'truck-fast-outline', onPress: () => router.push(`/buyer/tracking?order_id=${item.id}` as any) });
    }

    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
        onPress={() => router.push(`/buyer/orders/${item.id}` as any)}
      >
        {/* Header: store + status */}
        <View style={styles.cardHead}>
          <View style={styles.storeRow}>
            <MaterialCommunityIcons name="storefront-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.storeText} numberOfLines={1}>
              {stores.length > 0 ? stores.join(', ') : 'Diilzo'}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: meta.color + '15' }]}>
            <MaterialCommunityIcons name={meta.icon as any} size={10} color={meta.color} />
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>

        {/* Thumbnails + order meta */}
        <View style={styles.bodyRow}>
          <View style={styles.thumbRow}>
            {thumbs.slice(0, 4).map((uri, i) => (
              <Image key={i} source={{ uri }} style={styles.thumb} resizeMode="cover" />
            ))}
            {thumbs.length === 0 && (
              <View style={[styles.thumb, styles.thumbFallback]}>
                <MaterialCommunityIcons name="package-variant-closed" size={16} color={colors.textTertiary} />
              </View>
            )}
            {thumbs.length > 4 && (
              <View style={[styles.thumb, styles.thumbMore]}>
                <Text style={styles.thumbMoreText}>+{thumbs.length - 4}</Text>
              </View>
            )}
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.orderNo}>#{item.order_number}</Text>
            <Text style={styles.metaText}>
              {fmtDate(item.created_at)} · {item.total_items || thumbs.length || 1} item{(item.total_items || thumbs.length || 1) === 1 ? '' : 's'}
            </Text>
            {unpaid && (
              <View style={styles.unpaidPill}>
                <MaterialCommunityIcons name="alert-circle-outline" size={10} color="#B45309" />
                <Text style={styles.unpaidText}>Awaiting payment</Text>
              </View>
            )}
          </View>
          <View style={styles.rightCol}>
            <Text style={styles.total} numberOfLines={1} adjustsFontSizeToFit>
              {item.currency || 'UGX'} {Number(item.total).toLocaleString()}
            </Text>
            {/* Inline actions — same block as the order row, keeps cards compact */}
            {actions.map((a) => (
              <Pressable
                key={a.label}
                style={[styles.inlineAction, a.primary && styles.inlineActionPrimary]}
                disabled={busy}
                hitSlop={6}
                onPress={(e) => { e.stopPropagation(); a.onPress(); }}
              >
                <MaterialCommunityIcons
                  name={a.icon as any}
                  size={11}
                  color={a.primary ? '#FFFFFF' : colors.textSecondary}
                />
                <Text style={[styles.inlineActionText, a.primary && styles.inlineActionTextPrimary]}>
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <GradientHeader
        title="My Orders"
        subtitle={!loading && orders.length > 0 ? `${orders.length} order${orders.length === 1 ? '' : 's'}` : undefined}
      />

      {/* Status filter chips with counts */}
      <View style={styles.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
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
      </View>

      {loading ? (
        <OrderListSkeleton count={4} />
      ) : error ? (
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="alert-circle-outline" size={44} color={Brand.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.shopBtn} onPress={load}>
            <Text style={styles.shopBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.centerBody}>
          <View style={styles.emptyIcon}>
            <MaterialCommunityIcons name="shopping-outline" size={40} color={colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>
            {filter === 'all' ? 'No orders yet' : `Nothing in "${FILTERS.find((f) => f.key === filter)?.label}"`}
          </Text>
          <Text style={styles.emptySub}>
            {filter === 'all'
              ? 'Your orders will appear here once you start shopping.'
              : 'Try another filter to see your orders.'}
          </Text>
          <Pressable style={styles.shopBtn} onPress={() => filter === 'all' ? router.push('/') : setFilter('all')}>
            <Text style={styles.shopBtnText}>{filter === 'all' ? 'Start Shopping' : 'View All Orders'}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => `${item.id}`}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          maxToRenderPerBatch={10}
          windowSize={11}
          initialNumToRender={10}
          removeClippedSubviews={true}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
        />
      )}
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: c.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { marginTop: 14, fontSize: 16, fontWeight: '800', color: c.text },
  emptySub: { marginTop: 6, fontSize: 13, color: c.textSecondary, textAlign: 'center', lineHeight: 19 },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  shopBtn: { marginTop: 18, backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 11, borderRadius: 10 },
  shopBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },

  // Filters
  filterWrap: { backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.borderLight },
  filterRow: { gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
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

  list: { padding: 10, paddingBottom: 30 },

  // Order card
  card: {
    backgroundColor: c.surface, borderRadius: 12, padding: 10, marginBottom: 8,
    borderWidth: 1, borderColor: c.borderLight,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, marginRight: 8 },
  storeText: { fontSize: 11, fontWeight: '700', color: c.textSecondary },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
  },
  statusText: { fontSize: 10, fontWeight: '800' },

  bodyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  thumbRow: { flexDirection: 'row' },
  thumb: {
    width: 36, height: 36, borderRadius: 8, backgroundColor: c.surfaceAlt,
    marginRight: -6, borderWidth: 2, borderColor: c.surface,
  },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', marginRight: 0 },
  thumbMore: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.surfaceAlt, zIndex: 1,
  },
  thumbMoreText: { fontSize: 10, fontWeight: '800', color: c.textSecondary },
  metaCol: { flex: 1, marginLeft: 10 },
  orderNo: { fontSize: 12, fontWeight: '800', color: c.text },
  metaText: { fontSize: 10, color: c.textTertiary, marginTop: 1 },
  unpaidPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start',
    backgroundColor: '#FFFBEB', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5, marginTop: 3,
  },
  unpaidText: { fontSize: 9, fontWeight: '700', color: '#B45309' },
  rightCol: { alignItems: 'flex-end', gap: 3 },
  total: { fontSize: 13, fontWeight: '800', color: c.text, maxWidth: 110 },

  inlineAction: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 2 },
  inlineActionPrimary: {
    backgroundColor: Brand.primary, paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 12, alignSelf: 'flex-end', marginTop: 1,
  },
  inlineActionText: { fontSize: 11, fontWeight: '600', color: c.textSecondary },
  inlineActionTextPrimary: { color: '#FFFFFF', fontWeight: '800' },
});
