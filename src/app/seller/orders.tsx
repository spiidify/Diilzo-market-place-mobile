import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import { getMyOrders, type SellerOrder } from '@/services/seller';

const STATUS_COLORS: Record<string, string> = {
  pending: Brand.rating,
  accepted: '#3B82F6',
  processing: '#8B5CF6',
  shipped: '#06B6D4',
  delivered: '#16A34A',
  cancelled: Brand.danger,
  refunded: Brand.textTertiary,
};

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function SellerOrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRefreshing(true);
      const data = await getMyOrders(statusFilter ? { status: statusFilter } : undefined);
      setOrders(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const renderItem = ({ item }: { item: SellerOrder }) => {
    const statusColor = STATUS_COLORS[item.status] || Brand.textTertiary;
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
        onPress={() => router.push(`/seller/orders/${item.id}` as any)}
      >
        <View style={styles.cardTop}>
          <Text style={styles.orderNumber}>#{item.order_number}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.amountCol}>
            <Text style={styles.amountLabel}>Subtotal</Text>
            <Text style={styles.amountValue}>UGX {Number(item.subtotal).toLocaleString()}</Text>
          </View>
          <View style={styles.amountCol}>
            <Text style={styles.amountLabel}>Commission</Text>
            <Text style={styles.amountValue}>UGX {Number(item.commission_amount).toLocaleString()}</Text>
          </View>
          <View style={styles.amountCol}>
            <Text style={styles.amountLabel}>Your earnings</Text>
            <Text style={[styles.amountValue, { color: Brand.primary }]}>UGX {Number(item.seller_amount).toLocaleString()}</Text>
          </View>
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.footerLeft}>
            {item.customer_name && (
              <View style={styles.customerRow}>
                <MaterialCommunityIcons name="account-outline" size={14} color={Brand.textTertiary} />
                <Text style={styles.customerName} numberOfLines={1}>{item.customer_name}</Text>
              </View>
            )}
            <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
          </View>
          {item.item_count !== undefined && (
            <View style={styles.itemCountBadge}>
              <Text style={styles.itemCountText}>{item.item_count} {item.item_count === 1 ? 'item' : 'items'}</Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <ModernHeader title="Orders" />

      {/* Status filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        {STATUS_FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.filterTab, statusFilter === f.key && styles.filterTabActive]}
            onPress={() => setStatusFilter(f.key)}
          >
            <Text style={[styles.filterText, statusFilter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="clipboard-list-outline" size={56} color={Brand.textTertiary} />
          <Text style={styles.emptyText}>No orders yet</Text>
          <Text style={styles.emptySub}>Orders from buyers will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { marginTop: 12, fontSize: 16, fontWeight: '700', color: Brand.text },
  emptySub: { marginTop: 4, fontSize: 14, color: Brand.textSecondary, textAlign: 'center' },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  // Filters
  filterRow: { backgroundColor: '#FFFFFF', maxHeight: 50, borderBottomWidth: 1, borderBottomColor: Brand.border },
  filterContent: { paddingHorizontal: 12, gap: 8, paddingVertical: 8 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Brand.surfaceAlt },
  filterTabActive: { backgroundColor: Brand.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: Brand.textSecondary },
  filterTextActive: { color: '#FFFFFF' },

  list: { padding: 12, gap: 10 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderNumber: { fontSize: 16, fontWeight: '700', color: Brand.text },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  cardBody: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  amountCol: { flex: 1, gap: 2 },
  amountLabel: { fontSize: 11, color: Brand.textTertiary },
  amountValue: { fontSize: 13, fontWeight: '700', color: Brand.text },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLeft: { gap: 4 },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  customerName: { fontSize: 12, color: Brand.textSecondary, fontWeight: '500' },
  dateText: { fontSize: 12, color: Brand.textTertiary },
  itemCountBadge: { backgroundColor: Brand.primary + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  itemCountText: { fontSize: 11, fontWeight: '600', color: Brand.primary },
});
