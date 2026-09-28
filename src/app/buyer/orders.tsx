import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
  created_at: string;
  items_count?: number;
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
      ) : orders.length === 0 ? (
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="shopping-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>No orders yet</Text>
          <Pressable style={styles.shopBtn} onPress={() => router.push('/')}>
            <Text style={styles.shopBtnText}>Start Shopping</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={orders}
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
