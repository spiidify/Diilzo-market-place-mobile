import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

export default function SellerOrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await getMyOrders();
      setOrders(data);
    } catch (e: any) {
      console.error('Seller orders error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const renderItem = ({ item }: { item: SellerOrder }) => {
    const statusColor = STATUS_COLORS[item.status] || Brand.textTertiary;
    return (
      <View style={styles.card}>
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
        <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient colors={[Brand.primary, Brand.primary, Brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Orders</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

        {loading ? (
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="clipboard-list-outline" size={48} color={Brand.textTertiary} />
            <Text style={styles.emptyText}>No orders yet</Text>
          </View>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(item) => `${item.id}`}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  safeArea: { flex: 1, backgroundColor: Brand.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { marginTop: 12, fontSize: 14, color: Brand.textSecondary },
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
  dateText: { fontSize: 12, color: Brand.textTertiary },
});



