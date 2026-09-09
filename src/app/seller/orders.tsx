import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import {
  acceptOrder,
  cancelOrder,
  deliverOrder,
  getMyOrders,
  getOrderDetail,
  shipOrder,
  type SellerOrder,
  type SellerOrderDetail,
} from '@/services/seller';

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
  const [detailVisible, setDetailVisible] = useState(false);
  const [detail, setDetail] = useState<SellerOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await getMyOrders(statusFilter ? { status: statusFilter } : undefined);
      setOrders(data);
    } catch (e: any) {
      console.error('Seller orders error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (orderId: number) => {
    setDetailVisible(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const data = await getOrderDetail(orderId);
      setDetail(data);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to load order details');
      setDetailVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAction = async (action: 'accept' | 'ship' | 'deliver' | 'cancel', orderId: number) => {
    setActionLoading(true);
    try {
      if (action === 'accept') await acceptOrder(orderId);
      else if (action === 'ship') await shipOrder(orderId);
      else if (action === 'deliver') await deliverOrder(orderId);
      else if (action === 'cancel') await cancelOrder(orderId);

      // Reload detail
      const updated = await getOrderDetail(orderId);
      setDetail(updated);
      // Refresh list
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to update order');
    } finally {
      setActionLoading(false);
    }
  };

  const renderItem = ({ item }: { item: SellerOrder }) => {
    const statusColor = STATUS_COLORS[item.status] || Brand.textTertiary;
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
        onPress={() => openDetail(item.id)}
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
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient colors={[Brand.primary, Brand.primary, Brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Orders</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

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
      </SafeAreaView>

      {/* ── Order Detail Modal ─────────────────────────────────────── */}
      <Modal visible={detailVisible} animationType="slide" onRequestClose={() => setDetailVisible(false)}>
        <View style={styles.modalScreen}>
          <SafeAreaView edges={['top']} style={styles.modalSafeArea}>
            <LinearGradient colors={[Brand.primary, Brand.primary, Brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modalHeader}>
              <Pressable onPress={() => setDetailVisible(false)} hitSlop={12}>
                <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
              </Pressable>
              <Text style={styles.modalTitle}>Order Details</Text>
              <View style={{ width: 24 }} />
            </LinearGradient>

            {detailLoading ? (
              <View style={styles.centerBody}>
                <ActivityIndicator size="large" color={Brand.primary} />
              </View>
            ) : detail ? (
              <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
                {/* Order header */}
                <View style={styles.detailCard}>
                  <View style={styles.detailHeaderRow}>
                    <Text style={styles.detailOrderNum}>#{detail.order_number}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[detail.status] || Brand.textTertiary) + '20' }]}>
                      <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[detail.status] || Brand.textTertiary }]} />
                      <Text style={[styles.statusText, { color: STATUS_COLORS[detail.status] || Brand.textTertiary }]}>{detail.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.detailDate}>{new Date(detail.created_at).toLocaleString()}</Text>
                </View>

                {/* Customer info */}
                <View style={styles.detailCard}>
                  <Text style={styles.detailSectionTitle}>Customer</Text>
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="account-outline" size={18} color={Brand.textSecondary} />
                    <Text style={styles.detailRowText}>{detail.customer_name}</Text>
                  </View>
                  {detail.customer_email ? (
                    <View style={styles.detailRow}>
                      <MaterialCommunityIcons name="email-outline" size={18} color={Brand.textSecondary} />
                      <Text style={styles.detailRowText}>{detail.customer_email}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Shipping address */}
                {detail.shipping_address && Object.keys(detail.shipping_address).length > 0 && (
                  <View style={styles.detailCard}>
                    <Text style={styles.detailSectionTitle}>Shipping Address</Text>
                    <Text style={styles.detailAddrText}>
                      {detail.shipping_address.street || ''}{'\n'}
                      {detail.shipping_address.city || ''}, {detail.shipping_address.state || ''}{'\n'}
                      {detail.shipping_address.country || ''}
                    </Text>
                    {detail.shipping_address.phone && (
                      <View style={styles.detailRow}>
                        <MaterialCommunityIcons name="phone-outline" size={18} color={Brand.primary} />
                        <Text style={[styles.detailRowText, { color: Brand.primary, fontWeight: '600' }]}>{detail.shipping_address.phone}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Items */}
                <View style={styles.detailCard}>
                  <Text style={styles.detailSectionTitle}>Items ({detail.items.length})</Text>
                  {detail.items.map((item, idx) => (
                    <View key={`item-${idx}`} style={styles.itemRow}>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName} numberOfLines={2}>{item.product_name}</Text>
                        <Text style={styles.itemQty}>{item.quantity} x UGX {Number(item.unit_price).toLocaleString()}</Text>
                      </View>
                      <Text style={styles.itemTotal}>UGX {Number(item.total_price).toLocaleString()}</Text>
                    </View>
                  ))}
                </View>

                {/* Earnings breakdown */}
                <View style={styles.detailCard}>
                  <Text style={styles.detailSectionTitle}>Earnings</Text>
                  <View style={styles.earnRow}>
                    <Text style={styles.earnLabel}>Subtotal</Text>
                    <Text style={styles.earnValue}>UGX {Number(detail.subtotal).toLocaleString()}</Text>
                  </View>
                  <View style={styles.earnRow}>
                    <Text style={styles.earnLabel}>Commission</Text>
                    <Text style={[styles.earnValue, { color: Brand.danger }]}>-UGX {Number(detail.commission_amount).toLocaleString()}</Text>
                  </View>
                  <View style={[styles.earnRow, styles.earnTotalRow]}>
                    <Text style={styles.earnTotalLabel}>Your earnings</Text>
                    <Text style={styles.earnTotalValue}>UGX {Number(detail.seller_amount).toLocaleString()}</Text>
                  </View>
                </View>

                {/* Action buttons */}
                <View style={styles.actionSection}>
                  {detail.status === 'pending' && (
                    <Pressable
                      style={({ pressed }) => [styles.actionButton, styles.acceptBtn, pressed && { opacity: 0.85 }]}
                      onPress={() => handleAction('accept', detail.id)}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                        <>
                          <MaterialCommunityIcons name="check" size={20} color="#FFFFFF" />
                          <Text style={styles.actionBtnText}>Accept Order</Text>
                        </>
                      )}
                    </Pressable>
                  )}
                  {detail.status === 'accepted' && (
                    <Pressable
                      style={({ pressed }) => [styles.actionButton, styles.shipBtn, pressed && { opacity: 0.85 }]}
                      onPress={() => handleAction('ship', detail.id)}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                        <>
                          <MaterialCommunityIcons name="truck-fast-outline" size={20} color="#FFFFFF" />
                          <Text style={styles.actionBtnText}>Mark as Shipped</Text>
                        </>
                      )}
                    </Pressable>
                  )}
                  {detail.status === 'shipped' && (
                    <Pressable
                      style={({ pressed }) => [styles.actionButton, styles.deliverBtn, pressed && { opacity: 0.85 }]}
                      onPress={() => handleAction('deliver', detail.id)}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                        <>
                          <MaterialCommunityIcons name="package-check" size={20} color="#FFFFFF" />
                          <Text style={styles.actionBtnText}>Mark as Delivered</Text>
                        </>
                      )}
                    </Pressable>
                  )}
                  {['pending', 'accepted'].includes(detail.status) && (
                    <Pressable
                      style={({ pressed }) => [styles.actionButton, styles.cancelBtn, pressed && { opacity: 0.85 }]}
                      onPress={() => {
                        Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
                          { text: 'No', style: 'cancel' },
                          { text: 'Yes, Cancel', style: 'destructive', onPress: () => handleAction('cancel', detail.id) },
                        ]);
                      }}
                      disabled={actionLoading}
                    >
                      <MaterialCommunityIcons name="close" size={20} color={Brand.danger} />
                      <Text style={[styles.actionBtnText, { color: Brand.danger }]}>Cancel Order</Text>
                    </Pressable>
                  )}
                  {detail.status === 'delivered' && (
                    <View style={styles.deliveredBanner}>
                      <MaterialCommunityIcons name="check-circle" size={24} color="#16A34A" />
                      <Text style={styles.deliveredText}>Order delivered and earnings settled</Text>
                    </View>
                  )}
                  {detail.status === 'cancelled' && (
                    <View style={styles.cancelledBanner}>
                      <MaterialCommunityIcons name="cancel" size={24} color={Brand.danger} />
                      <Text style={styles.cancelledText}>This order was cancelled</Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.centerBody}>
                <Text style={styles.emptyText}>Failed to load order</Text>
              </View>
            )}
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  safeArea: { flex: 1, backgroundColor: Brand.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { marginTop: 12, fontSize: 16, fontWeight: '700', color: Brand.text },
  emptySub: { marginTop: 4, fontSize: 14, color: Brand.textSecondary, textAlign: 'center' },

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

  // ── Modal ──────────────────────────────────────────────────────
  modalScreen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  modalSafeArea: { flex: 1, backgroundColor: Brand.primary },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  modalBody: { flex: 1 },
  modalBodyContent: { padding: 12, paddingBottom: 32, gap: 10 },

  detailCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  detailHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailOrderNum: { fontSize: 18, fontWeight: '800', color: Brand.text },
  detailDate: { fontSize: 13, color: Brand.textTertiary, marginTop: 6 },
  detailSectionTitle: { fontSize: 14, fontWeight: '700', color: Brand.text, marginBottom: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  detailRowText: { fontSize: 14, color: Brand.text, flex: 1 },
  detailAddrText: { fontSize: 14, color: Brand.textSecondary, lineHeight: 20, marginBottom: 8 },

  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Brand.border },
  itemInfo: { flex: 1, gap: 2 },
  itemName: { fontSize: 14, fontWeight: '600', color: Brand.text },
  itemQty: { fontSize: 12, color: Brand.textSecondary },
  itemTotal: { fontSize: 14, fontWeight: '700', color: Brand.text },

  earnRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  earnLabel: { fontSize: 14, color: Brand.textSecondary },
  earnValue: { fontSize: 14, fontWeight: '600', color: Brand.text },
  earnTotalRow: { borderTopWidth: 1, borderTopColor: Brand.border, marginTop: 6, paddingTop: 10 },
  earnTotalLabel: { fontSize: 15, fontWeight: '700', color: Brand.text },
  earnTotalValue: { fontSize: 16, fontWeight: '800', color: Brand.primary },

  actionSection: { gap: 10, marginTop: 4 },
  actionButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12,
  },
  acceptBtn: { backgroundColor: '#16A34A' },
  shipBtn: { backgroundColor: '#06B6D4' },
  deliverBtn: { backgroundColor: Brand.primary },
  cancelBtn: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: Brand.danger },
  actionBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  deliveredBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#16A34A15', padding: 16, borderRadius: 12 },
  deliveredText: { fontSize: 14, fontWeight: '600', color: '#16A34A', flex: 1 },
  cancelledBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Brand.danger + '15', padding: 16, borderRadius: 12 },
  cancelledText: { fontSize: 14, fontWeight: '600', color: Brand.danger, flex: 1 },
});
