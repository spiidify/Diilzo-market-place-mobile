import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Spacing } from '@/constants/theme';
import {
  cancelOrder,
  fetchOrderById,
  reorder,
  requestReturn,
} from '@/services/orders';
import type { Order } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  pending: Brand.rating,
  processing: '#8B5CF6',
  confirmed: '#3B82F6',
  shipped: '#06B6D4',
  delivered: Brand.success,
  cancelled: Brand.danger,
  refunded: Brand.textTertiary,
  returned: Brand.textTertiary,
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: Brand.success,
  pending: Brand.rating,
  unpaid: Brand.danger,
  failed: Brand.danger,
  refunded: Brand.textTertiary,
};

export default function OrderDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const orderId = Number(params.id);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      setRefreshing(true);
      const data = await fetchOrderById(orderId);
      setOrder(data);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load order');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCancel = () => {
    Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          setActionLoading('cancel');
          try {
            await cancelOrder(orderId);
            await load();
            Alert.alert('Order Cancelled', 'Your order has been cancelled.');
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to cancel order');
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  };

  const handleReturn = () => {
    Alert.alert(
      'Request Return',
      'Do you want to request a return for this order? Our team will review your request and contact you for details.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit Request',
          onPress: async () => {
            setActionLoading('return');
            try {
              await requestReturn(orderId, 'Return requested by customer');
              Alert.alert('Return Requested', 'Your return request has been submitted for review.');
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to request return');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleReorder = async () => {
    setActionLoading('reorder');
    try {
      const result = await reorder(orderId);
      Alert.alert(
        'Items Added',
        `${result.added} item(s) from this order have been added to your cart.`,
        [{ text: 'View Cart', onPress: () => router.push('/cart' as any) }]
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to reorder items');
    } finally {
      setActionLoading(null);
    }
  };

  const handleTrack = () => {
    router.push(`/buyer/tracking?order_id=${orderId}` as any);
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <LinearGradient
            colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.headerTitle}>Order Details</Text>
            <View style={{ width: 24 }} />
          </LinearGradient>
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <LinearGradient
            colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.headerTitle}>Order Details</Text>
            <View style={{ width: 24 }} />
          </LinearGradient>
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="package-variant-remove" size={48} color={Brand.textTertiary} />
            <Text style={styles.emptyText}>Order not found</Text>
            <Pressable style={styles.shopBtn} onPress={() => router.back()}>
              <Text style={styles.shopBtnText}>Go Back</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[order.status] || Brand.textTertiary;
  const payColor = PAYMENT_STATUS_COLORS[order.payment_status] || Brand.textTertiary;
  const canCancel = order.status === 'pending' || order.status === 'processing';
  const canReturn = order.status === 'delivered';
  const canTrack = order.status === 'shipped' || order.status === 'delivered' || !!order.tracking_number;

  const addr = order.shipping_address || {};
  const addressStr = [
    addr.street,
    addr.city,
    addr.state,
    addr.postal_code,
    addr.country,
  ].filter(Boolean).join(', ');

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient
          colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Order Details</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={load}
              colors={[Brand.primary]}
              tintColor={Brand.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Order header card */}
          <View style={styles.orderHeaderCard}>
            <View style={styles.orderHeaderTop}>
              <View>
                <Text style={styles.orderNumberLabel}>Order</Text>
                <Text style={styles.orderNumber}>#{order.order_number}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </Text>
              </View>
            </View>
            <View style={styles.orderHeaderRow}>
              <View style={styles.orderHeaderInfo}>
                <Text style={styles.infoLabel}>Payment</Text>
                <View style={[styles.payBadge, { backgroundColor: payColor + '20' }]}>
                  <Text style={[styles.payBadgeText, { color: payColor }]}>
                    {order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1)}
                  </Text>
                </View>
              </View>
              <View style={styles.orderHeaderInfo}>
                <Text style={styles.infoLabel}>Date</Text>
                <Text style={styles.infoValue}>
                  {new Date(order.created_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
              <View style={styles.orderHeaderInfo}>
                <Text style={styles.infoLabel}>Items</Text>
                <Text style={styles.infoValue}>{order.total_items}</Text>
              </View>
            </View>
          </View>

          {/* Shipping address */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="map-marker-outline" size={20} color={Brand.primary} />
              <Text style={styles.sectionTitle}>Shipping Address</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.addressLine}>{addr.label || 'Delivery Address'}</Text>
              <Text style={styles.addressDetail}>{addressStr || 'N/A'}</Text>
              {addr.phone ? <Text style={styles.addressDetail}>Phone: {addr.phone}</Text> : null}
            </View>
          </View>

          {/* Order items */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="package-variant-closed" size={20} color={Brand.primary} />
              <Text style={styles.sectionTitle}>Items ({order.total_items})</Text>
            </View>
            <View style={styles.card}>
              {order.suborders.map((sub) => (
                <View key={`sub-${sub.id}`} style={styles.suborder}>
                  <View style={styles.suborderHeader}>
                    <MaterialCommunityIcons name="store-outline" size={16} color={Brand.textSecondary} />
                    <Text style={styles.suborderStore}>{sub.store_name}</Text>
                    <View style={[styles.suborderStatus, { backgroundColor: (STATUS_COLORS[sub.status] || Brand.textTertiary) + '20' }]}>
                      <Text style={[styles.suborderStatusText, { color: STATUS_COLORS[sub.status] || Brand.textTertiary }]}>
                        {sub.status}
                      </Text>
                    </View>
                  </View>
                  {sub.items.map((item) => (
                    <View key={`oi-${item.id}`} style={styles.orderItem}>
                      {item.product_image_url || item.product_image ? (
                        <Image
                          source={{ uri: item.product_image_url || item.product_image || '' }}
                          style={styles.itemImage}
                          contentFit="contain"
                        />
                      ) : (
                        <View style={[styles.itemImage, styles.itemImageFallback]}>
                          <MaterialCommunityIcons name="image-outline" size={20} color={Brand.textTertiary} />
                        </View>
                      )}
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName} numberOfLines={2}>{item.product_name}</Text>
                        <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
                        <Text style={styles.itemPrice}>UGX {Number(item.total_price).toLocaleString()}</Text>
                      </View>
                    </View>
                  ))}
                  <View style={styles.suborderTotal}>
                    <Text style={styles.suborderTotalLabel}>Subtotal</Text>
                    <Text style={styles.suborderTotalValue}>UGX {Number(sub.subtotal).toLocaleString()}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Totals */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="calculator-variant-outline" size={20} color={Brand.primary} />
              <Text style={styles.sectionTitle}>Order Summary</Text>
            </View>
            <View style={styles.card}>
              <View style={styles.totalRow}>
                <Text style={styles.totalRowLabel}>Subtotal</Text>
                <Text style={styles.totalRowValue}>UGX {Number(order.subtotal).toLocaleString()}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalRowLabel}>Shipping</Text>
                <Text style={styles.totalRowValue}>UGX {Number(order.shipping_cost).toLocaleString()}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalRowLabel}>Tax</Text>
                <Text style={styles.totalRowValue}>UGX {Number(order.tax_amount).toLocaleString()}</Text>
              </View>
              {Number(order.discount_amount) > 0 && (
                <View style={styles.totalRow}>
                  <Text style={[styles.totalRowLabel, { color: Brand.primary }]}>Discount</Text>
                  <Text style={[styles.totalRowValue, { color: Brand.primary }]}>
                    −UGX {Number(order.discount_amount).toLocaleString()}
                  </Text>
                </View>
              )}
              <View style={styles.totalDivider} />
              <View style={styles.totalRow}>
                <Text style={styles.grandTotalLabel}>Total</Text>
                <Text style={styles.grandTotalValue}>UGX {Number(order.total).toLocaleString()}</Text>
              </View>
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.actionsSection}>
            {canTrack && (
              <Pressable
                style={({ pressed }) => [styles.actionBtn, styles.actionBtnPrimary, pressed && { opacity: 0.85 }]}
                onPress={handleTrack}
              >
                <MaterialCommunityIcons name="map-marker-path" size={20} color="#FFFFFF" />
                <Text style={styles.actionBtnPrimaryText}>Track Order</Text>
              </Pressable>
            )}
            {canReturn && (
              <Pressable
                style={({ pressed }) => [styles.actionBtn, styles.actionBtnOutline, pressed && { opacity: 0.85 }]}
                onPress={handleReturn}
                disabled={actionLoading === 'return'}
              >
                {actionLoading === 'return' ? (
                  <ActivityIndicator size="small" color={Brand.primary} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="undo-variant" size={20} color={Brand.primary} />
                    <Text style={styles.actionBtnOutlineText}>Request Return</Text>
                  </>
                )}
              </Pressable>
            )}
            {canReturn && (
              <Pressable
                style={({ pressed }) => [styles.actionBtn, styles.actionBtnOutline, pressed && { opacity: 0.85 }]}
                onPress={() => {
                  if (order.suborders?.[0]?.items?.[0]?.product_slug) {
                    router.push(`/product/${order.suborders[0].items[0].product_slug}` as any);
                  }
                }}
              >
                <MaterialCommunityIcons name="star-outline" size={20} color={Brand.rating} />
                <Text style={styles.actionBtnOutlineText}>Rate Products</Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [styles.actionBtn, styles.actionBtnOutline, pressed && { opacity: 0.85 }]}
              onPress={handleReorder}
              disabled={actionLoading === 'reorder'}
            >
              {actionLoading === 'reorder' ? (
                <ActivityIndicator size="small" color={Brand.primary} />
              ) : (
                <>
                  <MaterialCommunityIcons name="cart-plus" size={20} color={Brand.primary} />
                  <Text style={styles.actionBtnOutlineText}>Reorder</Text>
                </>
              )}
            </Pressable>
            {canCancel && (
              <Pressable
                style={({ pressed }) => [styles.actionBtn, styles.actionBtnDanger, pressed && { opacity: 0.85 }]}
                onPress={handleCancel}
                disabled={actionLoading === 'cancel'}
              >
                {actionLoading === 'cancel' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="close-circle-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.actionBtnDangerText}>Cancel Order</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  safeArea: { flex: 1, backgroundColor: Brand.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { marginTop: Spacing.three, fontSize: 15, color: Brand.textSecondary },
  shopBtn: {
    marginTop: Spacing.three,
    backgroundColor: Brand.primary,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + Spacing.one,
    borderRadius: 10,
  },
  shopBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  body: { flex: 1 },
  bodyContent: { padding: Spacing.three, paddingBottom: Spacing.six },

  // Order header card
  orderHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  orderHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.three,
  },
  orderNumberLabel: { fontSize: 12, color: Brand.textTertiary },
  orderNumber: { fontSize: 20, fontWeight: '800', color: Brand.text },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 2,
    borderRadius: 8,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  orderHeaderRow: { flexDirection: 'row', justifyContent: 'space-between' },
  orderHeaderInfo: { gap: 4 },
  infoLabel: { fontSize: 11, color: Brand.textTertiary },
  infoValue: { fontSize: 14, fontWeight: '600', color: Brand.text },
  payBadge: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' },
  payBadgeText: { fontSize: 11, fontWeight: '700' },

  // Sections
  section: { marginBottom: Spacing.three },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Brand.text },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: Spacing.three,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },

  // Address
  addressLine: { fontSize: 15, fontWeight: '700', color: Brand.text, marginBottom: 4 },
  addressDetail: { fontSize: 13, color: Brand.textSecondary, marginBottom: 2 },

  // Suborders & items
  suborder: { marginBottom: Spacing.three },
  suborderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    marginBottom: Spacing.two,
    paddingBottom: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: Brand.borderLight,
  },
  suborderStore: { flex: 1, fontSize: 14, fontWeight: '700', color: Brand.text },
  suborderStatus: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: 6 },
  suborderStatusText: { fontSize: 11, fontWeight: '700' },
  orderItem: {
    flexDirection: 'row',
    gap: Spacing.two + Spacing.one,
    paddingVertical: Spacing.two,
  },
  itemImage: { width: 56, height: 56, borderRadius: 10, backgroundColor: Brand.surfaceAlt },
  itemImageFallback: { justifyContent: 'center', alignItems: 'center' },
  itemInfo: { flex: 1, gap: 2 },
  itemName: { fontSize: 14, fontWeight: '600', color: Brand.text },
  itemQty: { fontSize: 12, color: Brand.textTertiary },
  itemPrice: { fontSize: 14, fontWeight: '700', color: Brand.primary },
  suborderTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Brand.borderLight,
  },
  suborderTotalLabel: { fontSize: 13, color: Brand.textSecondary },
  suborderTotalValue: { fontSize: 14, fontWeight: '700', color: Brand.text },

  // Totals
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  totalRowLabel: { fontSize: 14, color: Brand.textSecondary },
  totalRowValue: { fontSize: 14, fontWeight: '600', color: Brand.text },
  totalDivider: { height: 1, backgroundColor: Brand.borderLight, marginVertical: Spacing.two },
  grandTotalLabel: { fontSize: 16, fontWeight: '700', color: Brand.text },
  grandTotalValue: { fontSize: 16, fontWeight: '800', color: Brand.primary },

  // Actions
  actionsSection: { gap: Spacing.two, marginTop: Spacing.one, marginBottom: Spacing.six },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Platform.select({ ios: 14, android: 12 }),
    borderRadius: 12,
  },
  actionBtnPrimary: { backgroundColor: Brand.primary },
  actionBtnPrimaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  actionBtnOutline: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Brand.primary,
  },
  actionBtnOutlineText: { color: Brand.primary, fontWeight: '700', fontSize: 15 },
  actionBtnDanger: { backgroundColor: Brand.danger },
  actionBtnDangerText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
