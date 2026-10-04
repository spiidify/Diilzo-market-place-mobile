import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';

import { GradientHeader } from '@/components/GradientHeader';
import { Brand, Spacing } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { createChatThread } from '@/services/chat';
import {
    cancelOrder,
    fetchOrderById,
    openDispute,
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
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: Brand.success,
  pending: Brand.rating,
  unpaid: Brand.danger,
  failed: Brand.danger,
};

const DISPUTE_REASONS = [
  { key: 'item_not_received', label: 'Item not received' },
  { key: 'item_not_as_described', label: 'Not as described' },
  { key: 'damaged', label: 'Arrived damaged' },
  { key: 'wrong_item', label: 'Wrong item sent' },
  { key: 'quality_issue', label: 'Quality issue' },
  { key: 'other', label: 'Other' },
];

export default function OrderDetailScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ id: string }>();
  const orderId = Number(params.id);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Dispute flow
  const [disputeVisible, setDisputeVisible] = useState(false);
  const [disputeSuborder, setDisputeSuborder] = useState<number | null>(null);
  const [disputeReason, setDisputeReason] = useState('item_not_received');
  const [disputeDesc, setDisputeDesc] = useState('');

  const handleOpenDispute = () => {
    setDisputeSuborder(order?.suborders?.[0]?.id ?? null);
    setDisputeReason('item_not_received');
    setDisputeDesc('');
    setDisputeVisible(true);
  };

  const submitDispute = async () => {
    if (!disputeDesc.trim()) {
      Alert.alert('Missing details', 'Please describe the problem so we can investigate.');
      return;
    }
    setActionLoading('dispute');
    try {
      const res = await openDispute(orderId, {
        reason: disputeReason,
        description: disputeDesc.trim(),
        suborder_id: disputeSuborder ?? undefined,
      });
      setDisputeVisible(false);
      Alert.alert('Dispute Opened', res.detail || 'Diilzo will review your dispute shortly.');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || e?.message || 'Failed to open dispute');
    } finally {
      setActionLoading(null);
    }
  };

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

  const handleContactSeller = async () => {
    try {
      const suborder = order?.suborders?.[0];
      if (!suborder?.store_slug) return;
      const thread = await createChatThread(suborder.store_slug, undefined, order?.id);
      router.push(`/chat/${thread.id}` as any);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to start chat');
    }
  };

  const handleTrack = () => {
    router.push(`/buyer/tracking?order_id=${orderId}` as any);
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <GradientHeader title="Order Details" />
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.screen}>
        <GradientHeader title="Order Details" />
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="package-variant-remove" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>Order not found</Text>
          <Pressable style={styles.shopBtn} onPress={() => router.back()}>
            <Text style={styles.shopBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[order.status] || colors.textTertiary;
  const payColor = PAYMENT_STATUS_COLORS[order.payment_status] || colors.textTertiary;
  const canCancel = order.status === 'pending' || order.status === 'processing';
  const canReturn = order.status === 'delivered';
  const canTrack = order.status !== 'cancelled' && order.status !== 'refunded';
  const canDispute = ['processing', 'shipped', 'delivered'].includes(order.status);

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
      <GradientHeader
        title="Order Details"
        subtitle={`#${order.order_number}`}
        rightIcon={canTrack ? 'map-marker-path' : undefined}
        onRightPress={canTrack ? handleTrack : undefined}
      />

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
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.orderNumberLabel}>Order</Text>
                <Text style={styles.orderNumber} numberOfLines={1} adjustsFontSizeToFit>#{order.order_number}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </Text>
                </View>
                {canTrack && (
                  <Pressable style={styles.trackPill} onPress={handleTrack} hitSlop={6}>
                    <MaterialCommunityIcons name="map-marker-path" size={13} color="#FFFFFF" />
                    <Text style={styles.trackPillText}>Track</Text>
                  </Pressable>
                )}
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

          {/* Cross-border / customs notice */}
          {order.import_notice && (
            <View style={styles.importBanner}>
              <MaterialCommunityIcons name="earth" size={20} color="#B45309" />
              <View style={{ flex: 1 }}>
                <Text style={styles.importTitle}>International order</Text>
                <Text style={styles.importText}>
                  Ships from {order.import_notice.origin_countries.join(', ')} — {order.import_notice.message}
                </Text>
                <Text style={styles.importEstimate}>
                  Estimated duties: UGX {Number(order.import_notice.estimated_duty_min).toLocaleString()}
                  {' '}– {Number(order.import_notice.estimated_duty_max).toLocaleString()}
                  {' '}(payable on arrival, set by customs)
                </Text>
              </View>
            </View>
          )}

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
                    <MaterialCommunityIcons name="store-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.suborderStore}>{sub.store_name}</Text>
                    <View style={[styles.suborderStatus, { backgroundColor: (STATUS_COLORS[sub.status] || colors.textTertiary) + '20' }]}>
                      <Text style={[styles.suborderStatusText, { color: STATUS_COLORS[sub.status] || colors.textTertiary }]}>
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
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={[styles.itemImage, styles.itemImageFallback]}>
                          <MaterialCommunityIcons name="image-outline" size={20} color={colors.textTertiary} />
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
            <Pressable
              style={({ pressed }) => [styles.actionBtn, styles.actionBtnOutline, pressed && { opacity: 0.85 }]}
              onPress={handleContactSeller}
            >
              <MaterialCommunityIcons name="chat-outline" size={20} color="#EC4899" />
              <Text style={styles.actionBtnOutlineText}>Message Seller</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.actionBtn, styles.actionBtnOutline, pressed && { opacity: 0.85 }]}
              onPress={() => router.push(`/buyer/orders/invoice/${orderId}` as any)}
            >
              <MaterialCommunityIcons name="file-document-outline" size={20} color="#06B6D4" />
              <Text style={styles.actionBtnOutlineText}>Invoice / Receipt</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.actionBtn, styles.actionBtnOutline, pressed && { opacity: 0.85 }]}
              onPress={() => router.push({ pathname: '/buyer/support', params: { order_id: String(orderId), order_number: order.order_number } } as any)}
            >
              <MaterialCommunityIcons name="headset" size={20} color="#8B5CF6" />
              <Text style={styles.actionBtnOutlineText}>Contact Support</Text>
            </Pressable>
            {canDispute && (
              <Pressable
                style={({ pressed }) => [styles.actionBtn, styles.actionBtnDispute, pressed && { opacity: 0.85 }]}
                onPress={handleOpenDispute}
                disabled={actionLoading === 'dispute'}
              >
                {actionLoading === 'dispute' ? (
                  <ActivityIndicator size="small" color={Brand.rating} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="alert-octagon-outline" size={20} color={Brand.rating} />
                    <Text style={styles.actionBtnDisputeText}>Report a Problem</Text>
                  </>
                )}
              </Pressable>
            )}
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

      {/* Dispute modal */}
      <Modal visible={disputeVisible} transparent animationType="slide" onRequestClose={() => setDisputeVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Report a Problem</Text>
                <Text style={styles.modalSub}>
                  Your payment stays protected in escrow while we review the dispute.
                </Text>
              </View>
              <Pressable onPress={() => setDisputeVisible(false)} hitSlop={8}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {(order?.suborders?.length || 0) > 1 && (
                <>
                  <Text style={styles.fieldLabel}>Which seller?</Text>
                  <View style={styles.chipRow}>
                    {order?.suborders?.map((s) => (
                      <Pressable
                        key={s.id}
                        style={[styles.chip, disputeSuborder === s.id && styles.chipActive]}
                        onPress={() => setDisputeSuborder(s.id)}
                      >
                        <Text style={[styles.chipText, disputeSuborder === s.id && styles.chipTextActive]}>
                          {s.store_name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.fieldLabel}>What's wrong?</Text>
              <View style={styles.chipRow}>
                {DISPUTE_REASONS.map((r) => (
                  <Pressable
                    key={r.key}
                    style={[styles.chip, disputeReason === r.key && styles.chipActive]}
                    onPress={() => setDisputeReason(r.key)}
                  >
                    <Text style={[styles.chipText, disputeReason === r.key && styles.chipTextActive]}>
                      {r.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Describe the issue</Text>
              <TextInput
                style={styles.disputeInput}
                multiline
                numberOfLines={4}
                placeholder="Tell us what happened — include order details, what you received vs. expected…"
                placeholderTextColor={colors.textTertiary}
                value={disputeDesc}
                onChangeText={setDisputeDesc}
                textAlignVertical="top"
              />

              <Pressable
                style={[styles.submitDisputeBtn, actionLoading === 'dispute' && { opacity: 0.7 }]}
                onPress={submitDispute}
                disabled={actionLoading === 'dispute'}
              >
                {actionLoading === 'dispute' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitDisputeText}>Submit Dispute</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { marginTop: Spacing.three, fontSize: 15, color: c.textSecondary },
  shopBtn: {
    marginTop: Spacing.three,
    backgroundColor: Brand.primary,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + Spacing.one,
    borderRadius: 10,
  },
  shopBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  body: { flex: 1, backgroundColor: c.background },
  bodyContent: { padding: 12, paddingBottom: Spacing.six },

  // Order header card
  orderHeaderCard: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: c.borderLight,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  orderHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.three,
  },
  orderNumberLabel: { fontSize: 11, color: c.textTertiary },
  orderNumber: { fontSize: 14, fontWeight: '800', color: c.text },
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
  trackPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Brand.primary, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 12,
  },
  trackPillText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  orderHeaderRow: { flexDirection: 'row', justifyContent: 'space-between' },
  orderHeaderInfo: { gap: 4 },
  infoLabel: { fontSize: 11, color: c.textTertiary },
  infoValue: { fontSize: 14, fontWeight: '600', color: c.text },
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
  sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text },
  card: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: c.borderLight,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },

  // Address
  addressLine: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 4 },
  addressDetail: { fontSize: 13, color: c.textSecondary, marginBottom: 2 },

  // Suborders & items
  suborder: { marginBottom: Spacing.three },
  suborderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    marginBottom: Spacing.two,
    paddingBottom: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
  suborderStore: { flex: 1, fontSize: 14, fontWeight: '700', color: c.text },
  suborderStatus: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: 6 },
  suborderStatusText: { fontSize: 11, fontWeight: '700' },
  orderItem: {
    flexDirection: 'row',
    gap: Spacing.two + Spacing.one,
    paddingVertical: Spacing.two,
  },
  itemImage: { width: 56, height: 56, borderRadius: 10, backgroundColor: c.surfaceAlt },
  itemImageFallback: { justifyContent: 'center', alignItems: 'center' },
  itemInfo: { flex: 1, gap: 2 },
  itemName: { fontSize: 14, fontWeight: '600', color: c.text },
  itemQty: { fontSize: 12, color: c.textTertiary },
  itemPrice: { fontSize: 14, fontWeight: '700', color: Brand.primary },
  suborderTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: c.borderLight,
  },
  suborderTotalLabel: { fontSize: 13, color: c.textSecondary },
  suborderTotalValue: { fontSize: 14, fontWeight: '700', color: c.text },

  // Totals
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  totalRowLabel: { fontSize: 14, color: c.textSecondary },
  totalRowValue: { fontSize: 14, fontWeight: '600', color: c.text },
  totalDivider: { height: 1, backgroundColor: c.borderLight, marginVertical: Spacing.two },
  grandTotalLabel: { fontSize: 16, fontWeight: '700', color: c.text },
  grandTotalValue: { fontSize: 16, fontWeight: '800', color: Brand.primary },

  // Actions — 2-column grid
  actionsSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
    marginBottom: Spacing.six,
  },
  actionBtn: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Platform.select({ ios: 13, android: 11 }),
    borderRadius: 12,
  },
  actionBtnPrimary: { backgroundColor: Brand.primary },
  actionBtnPrimaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  actionBtnOutline: {
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderColor: Brand.primary,
  },
  actionBtnOutlineText: { color: Brand.primary, fontWeight: '700', fontSize: 13 },
  actionBtnDanger: { backgroundColor: Brand.danger },
  actionBtnDangerText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  actionBtnDispute: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Brand.rating,
  },
  actionBtnDisputeText: { color: Brand.rating, fontWeight: '700', fontSize: 13 },

  // Cross-border customs banner
  importBanner: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A',
    borderRadius: 12, padding: 12, marginBottom: Spacing.three,
  },
  importTitle: { fontSize: 13, fontWeight: '800', color: '#B45309' },
  importText: { fontSize: 12, color: '#92400E', marginTop: 2, lineHeight: 17 },
  importEstimate: { fontSize: 11, fontWeight: '700', color: '#B45309', marginTop: 6 },

  // Dispute modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.four,
    maxHeight: '88%',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.three },
  modalTitle: { fontSize: 17, fontWeight: '800', color: c.text },
  modalSub: { fontSize: 12, color: c.textSecondary, marginTop: 3 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: c.text, marginTop: Spacing.two, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18,
    backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border,
  },
  chipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: c.textSecondary },
  chipTextActive: { color: '#FFFFFF' },
  disputeInput: {
    borderWidth: 1, borderColor: c.border, borderRadius: 12,
    padding: 12, minHeight: 96, fontSize: 14, color: c.text,
    backgroundColor: c.surfaceAlt,
  },
  submitDisputeBtn: {
    marginTop: Spacing.three, marginBottom: Spacing.four,
    backgroundColor: Brand.danger, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
  },
  submitDisputeText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});
