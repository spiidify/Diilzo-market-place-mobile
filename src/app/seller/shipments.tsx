import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import { getShipmentDetail, getShipments, type SellerShipment, type SellerShipmentDetail } from '@/services/seller';

const STATUS_COLORS: Record<string, string> = {
  pending: Brand.rating,
  picked_up: '#3B82F6',
  in_transit: '#8B5CF6',
  out_for_delivery: '#06B6D4',
  delivered: Brand.primary,
  failed: Brand.danger,
  cancelled: Brand.textTertiary,
};

export default function SellerShipmentsScreen() {
  const router = useRouter();
  const [shipments, setShipments] = useState<SellerShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<SellerShipmentDetail | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRefreshing(true);
      const data = await getShipments();
      setShipments(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: number) => {
    setDetailVisible(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const data = await getShipmentDetail(id);
      setDetail(data);
    } catch {
      setDetailVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const renderItem = ({ item }: { item: SellerShipment }) => {
    const color = STATUS_COLORS[item.status] || Brand.textTertiary;
    return (
      <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={() => openDetail(item.id)}>
        <View style={styles.cardHeader}>
          <Text style={styles.orderNumber}>#{item.order_number}</Text>
          <View style={[styles.badge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.badgeText, { color }]}>{item.status.replace(/_/g, ' ')}</Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.metricCol}>
            <Text style={styles.metricValue}>{item.carrier}</Text>
            <Text style={styles.metricLabel}>Carrier</Text>
          </View>
          <View style={styles.metricCol}>
            <Text style={styles.metricValue} numberOfLines={1}>{item.tracking_number || '—'}</Text>
            <Text style={styles.metricLabel}>Tracking</Text>
          </View>
        </View>
        <View style={styles.cardFooter}>
          <MaterialCommunityIcons name="truck-fast-outline" size={14} color={Brand.textTertiary} />
          <Text style={styles.footerText}>{item.shipping_method}</Text>
          <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <ModernHeader title="Shipments" />

      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.centerBody}><ActivityIndicator size="large" color={Brand.primary} /></View>
        ) : error ? (
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={shipments}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="package-variant-closed" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No shipments</Text>
                <Text style={styles.emptySub}>Shipments will appear here</Text>
              </View>
            }
          />
        )}

        <Modal visible={detailVisible} animationType="slide" transparent onRequestClose={() => setDetailVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Shipment Details</Text>
                <Pressable onPress={() => setDetailVisible(false)} hitSlop={12}><MaterialCommunityIcons name="close" size={24} color={Brand.textTertiary} /></Pressable>
              </View>
              {detailLoading ? (
                <ActivityIndicator size="large" color={Brand.primary} style={{ padding: 40 }} />
              ) : detail ? (
                <View>
                  <Text style={styles.detailLabel}>Order</Text>
                  <Text style={styles.detailValue}>#{detail.order_number}</Text>
                  <Text style={styles.detailLabel}>Carrier</Text>
                  <Text style={styles.detailValue}>{detail.carrier}</Text>
                  <Text style={styles.detailLabel}>Tracking Number</Text>
                  <Text style={styles.detailValue}>{detail.tracking_number || '—'}</Text>
                  <Text style={styles.detailLabel}>Status</Text>
                  <View style={[styles.badge, { backgroundColor: (STATUS_COLORS[detail.status] || Brand.textTertiary) + '20', alignSelf: 'flex-start', marginTop: 4 }]}>
                    <Text style={[styles.badgeText, { color: STATUS_COLORS[detail.status] || Brand.textTertiary }]}>{detail.status.replace(/_/g, ' ')}</Text>
                  </View>
                  <Text style={styles.detailLabel}>Shipping Method</Text>
                  <Text style={styles.detailValue}>{detail.shipping_method}</Text>
                  <Text style={styles.detailLabel}>Fulfillment Type</Text>
                  <Text style={styles.detailValue}>{detail.fulfillment_type}</Text>
                  <Text style={styles.detailLabel}>Shipping Cost</Text>
                  <Text style={styles.detailValue}>UGX {Number(detail.shipping_cost).toLocaleString()}</Text>
                  {detail.weight_kg && detail.weight_kg !== '0' && (
                    <>
                      <Text style={styles.detailLabel}>Weight</Text>
                      <Text style={styles.detailValue}>{detail.weight_kg} kg</Text>
                    </>
                  )}
                  {detail.shipped_at && (
                    <>
                      <Text style={styles.detailLabel}>Shipped At</Text>
                      <Text style={styles.detailValue}>{new Date(detail.shipped_at).toLocaleString()}</Text>
                    </>
                  )}
                  {detail.estimated_delivery && (
                    <>
                      <Text style={styles.detailLabel}>Est. Delivery</Text>
                      <Text style={styles.detailValue}>{new Date(detail.estimated_delivery).toLocaleString()}</Text>
                    </>
                  )}
                  {detail.delivered_at && (
                    <>
                      <Text style={styles.detailLabel}>Delivered At</Text>
                      <Text style={styles.detailValue}>{new Date(detail.delivered_at).toLocaleString()}</Text>
                    </>
                  )}
                </View>
              ) : null}
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  listContent: { padding: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderNumber: { fontSize: 15, fontWeight: '800', color: Brand.text },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardBody: { flexDirection: 'row', gap: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Brand.borderLight },
  metricCol: { flex: 1 },
  metricValue: { fontSize: 13, fontWeight: '700', color: Brand.text },
  metricLabel: { fontSize: 10, color: Brand.textTertiary, marginTop: 2 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  footerText: { fontSize: 12, color: Brand.textSecondary, flex: 1 },
  dateText: { fontSize: 12, color: Brand.textTertiary },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  emptySub: { fontSize: 13, color: Brand.textTertiary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Brand.text },
  detailLabel: { fontSize: 11, fontWeight: '700', color: Brand.textTertiary, marginTop: 12, marginBottom: 4, textTransform: 'uppercase' },
  detailValue: { fontSize: 14, color: Brand.text },
});
