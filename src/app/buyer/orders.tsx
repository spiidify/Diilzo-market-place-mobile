import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View
} from 'react-native';

import { GradientHeader } from '@/components/GradientHeader';
import { OrderListSkeleton } from '@/components/skeleton';
import { Brand } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { apiRequest } from '@/services/api';

interface Order {
  id: number;
  order_number: string;
  total: string;
  status: string;
  payment_status?: string;
  created_at: string;
  items_count?: number;
}

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

const STATUS_COLORS: Record<string, string> = {
  pending: Brand.rating,
  processing: '#8B5CF6',
  shipped: '#06B6D4',
  delivered: '#16A34A',
  cancelled: Brand.danger,
};

export default function BuyerOrdersScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const params = useLocalSearchParams<{ status?: string }>();
  const [filter, setFilter] = useState<FilterKey>((params.status as FilterKey) || 'all');

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const data = await apiRequest<any>({ method: 'GET', url: '/orders/' });
      setOrders(Array.isArray(data) ? data : data.results || []);
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

  const renderItem = ({ item }: { item: Order }) => {
    const statusColor = STATUS_COLORS[item.status] || colors.textTertiary;
    return (
      <Pressable
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}
        onPress={() => router.push(`/buyer/orders/${item.id}` as any)}
      >
        <View style={styles.info}>
          <View style={styles.topRow}>
            <Text style={styles.orderNumber}>#{item.order_number}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
            </View>
          </View>
          <Text style={styles.meta}>
            {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            {item.items_count != null ? ` · ${item.items_count} item${item.items_count === 1 ? '' : 's'}` : ''}
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.totalValue}>UGX {Number(item.total).toLocaleString()}</Text>
          <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textTertiary} />
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

      {/* Status filter chips */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
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
          <MaterialCommunityIcons name="shopping-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>{filter === 'all' ? 'No orders yet' : `No orders in "${FILTERS.find(f => f.key === filter)?.label}"`}</Text>
          <Pressable style={styles.shopBtn} onPress={() => router.push('/')}>
            <Text style={styles.shopBtnText}>Start Shopping</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => `${item.id}`}
          renderItem={renderItem}
          style={styles.listCard}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
          maxToRenderPerBatch={12}
          windowSize={11}
          initialNumToRender={12}
          removeClippedSubviews={true}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
        />
      )}
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyText: { marginTop: 12, fontSize: 14, color: c.textSecondary },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  shopBtn: { marginTop: 16, backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  shopBtnText: { color: '#FFFFFF', fontWeight: '700' },

  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 10, paddingVertical: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  filterChipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  filterChipText: { fontSize: 12, fontWeight: '700', color: c.textSecondary },
  filterChipTextActive: { color: '#FFFFFF' },

  listCard: { flex: 1 },
  list: {
    margin: 10, borderRadius: 14, overflow: 'hidden',
    backgroundColor: c.surface,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 9,
  },
  info: { flex: 1, gap: 2 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderNumber: { fontSize: 13, fontWeight: '700', color: c.text },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  meta: { fontSize: 11, color: c.textTertiary, fontWeight: '500' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  totalValue: { fontSize: 14, fontWeight: '800', color: Brand.primary },
  rowDivider: { height: 1, backgroundColor: c.borderLight, marginLeft: 12 },
});
