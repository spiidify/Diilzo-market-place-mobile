import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import {
  acceptOrder,
  cancelOrder,
  deliverOrder,
  getOrderDetail,
  shipOrder,
  type SellerOrderDetail,
} from '@/services/seller';

export default function SellerOrderDetailScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const STATUS_COLORS: Record<string, string> = {
    pending: Brand.rating,
    accepted: '#3B82F6',
    processing: '#8B5CF6',
    shipped: '#06B6D4',
    delivered: '#16A34A',
    cancelled: Brand.danger,
    refunded: colors.textTertiary,
  };

  const params = useLocalSearchParams<{ id: string }>();
  const orderId = Number(params.id);

  const [detail, setDetail] = useState<SellerOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const data = await getOrderDetail(orderId);
      setDetail(data);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (action: 'accept' | 'ship' | 'deliver' | 'cancel') => {
    setActionLoading(true);
    try {
      if (action === 'accept') await acceptOrder(orderId);
      else if (action === 'ship') await shipOrder(orderId);
      else if (action === 'deliver') await deliverOrder(orderId);
      else if (action === 'cancel') await cancelOrder(orderId);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to update order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = () => {
    Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: () => handleAction('cancel') },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Order Details" />
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Order Details" />
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="package-variant-remove" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>Order not found</Text>
        </View>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[detail.status] || colors.textTertiary;

  return (
    <View style={styles.screen}>
      <ModernHeader title={`#${detail.order_number}`} subtitle="Order Details" />

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        {/* Order header card */}
        <View style={styles.detailCard}>
          <View style={styles.detailHeaderRow}>
            <View>
              <Text style={styles.detailOrderNum}>#{detail.order_number}</Text>
              <Text style={styles.detailDate}>{new Date(detail.created_at).toLocaleString()}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{detail.status}</Text>
            </View>
          </View>
        </View>

        {/* Customer info */}
        <View style={styles.detailCard}>
          <Text style={styles.detailSectionTitle}>Customer</Text>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="account-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.detailRowText}>{detail.customer_name}</Text>
          </View>
          {detail.customer_email ? (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="email-outline" size={18} color={colors.textSecondary} />
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
                <Text style={[styles.detailRowText, { color: Brand.primary, fontWeight: '600' }]}>
                  {detail.shipping_address.phone}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Items */}
        <View style={styles.detailCard}>
          <Text style={styles.detailSectionTitle}>Items ({detail.items.length})</Text>
          {detail.items.map((item, idx) => (
            <View key={`item-${idx}`} style={styles.itemRow}>
              {item.product_image_url ? (
                <Image source={{ uri: item.product_image_url }} style={styles.itemImage} resizeMode="contain" />
              ) : (
                <View style={[styles.itemImage, styles.itemImageFallback]}>
                  <MaterialCommunityIcons name="image-outline" size={18} color={colors.textTertiary} />
                </View>
              )}
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
              onPress={() => handleAction('accept')}
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
              onPress={() => handleAction('ship')}
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
              onPress={() => handleAction('deliver')}
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
              onPress={handleCancel}
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
    </View>
  );
}

import { Pressable } from 'react-native';

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { marginTop: 12, fontSize: 16, fontWeight: '700', color: c.textSecondary },
  body: { flex: 1 },
  bodyContent: { padding: 12, paddingBottom: 32, gap: 10 },

  detailCard: {
    backgroundColor: c.surface, borderRadius: 14, padding: 16,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  detailHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  detailOrderNum: { fontSize: 18, fontWeight: '800', color: c.text },
  detailDate: { fontSize: 13, color: c.textTertiary, marginTop: 4 },
  detailSectionTitle: { fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  detailRowText: { fontSize: 14, color: c.text, flex: 1 },
  detailAddrText: { fontSize: 14, color: c.text, lineHeight: 20, marginBottom: 8 },

  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.borderLight },
  itemImage: { width: 48, height: 48, borderRadius: 8, backgroundColor: c.surfaceAlt },
  itemImageFallback: { justifyContent: 'center', alignItems: 'center' },
  itemInfo: { flex: 1, gap: 2 },
  itemName: { fontSize: 14, fontWeight: '600', color: c.text },
  itemQty: { fontSize: 12, color: c.textTertiary },
  itemTotal: { fontSize: 14, fontWeight: '700', color: c.text },

  earnRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  earnLabel: { fontSize: 14, color: c.textSecondary },
  earnValue: { fontSize: 14, fontWeight: '600', color: c.text },
  earnTotalRow: { borderTopWidth: 1, borderTopColor: c.borderLight, marginTop: 4, paddingTop: 10 },
  earnTotalLabel: { fontSize: 15, fontWeight: '700', color: c.text },
  earnTotalValue: { fontSize: 15, fontWeight: '800', color: Brand.primary },

  actionSection: { gap: 10, marginTop: 4 },
  actionButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12,
  },
  acceptBtn: { backgroundColor: '#16A34A' },
  shipBtn: { backgroundColor: '#06B6D4' },
  deliverBtn: { backgroundColor: '#16A34A' },
  cancelBtn: { backgroundColor: c.surface, borderWidth: 1.5, borderColor: Brand.danger },
  actionBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  deliveredBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, backgroundColor: '#16A34A15', borderRadius: 12 },
  deliveredText: { fontSize: 14, fontWeight: '600', color: '#16A34A', flex: 1 },
  cancelledBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, backgroundColor: Brand.danger + '15', borderRadius: 12 },
  cancelledText: { fontSize: 14, fontWeight: '600', color: Brand.danger, flex: 1 },
});
