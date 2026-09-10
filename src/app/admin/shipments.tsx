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
  getAdminShipmentDetail,
  getAdminShipments,
  updateShipmentStatus,
  type AdminShipment,
  type AdminShipmentDetail,
} from '@/services/adminApi';

const STATUS_COLORS: Record<string, string> = {
  pending: Brand.rating,
  shipped: '#3B82F6',
  in_transit: '#8B5CF6',
  delivered: Brand.primary,
  cancelled: Brand.danger,
};

const FILTERS = ['all', 'pending', 'shipped', 'in_transit', 'delivered'] as const;
const STATUS_OPTIONS = ['pending', 'shipped', 'in_transit', 'delivered'] as const;

export default function AdminShipmentsScreen() {
  const router = useRouter();
  const [shipments, setShipments] = useState<AdminShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [detail, setDetail] = useState<AdminShipmentDetail | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async (status?: string) => {
    try {
      setRefreshing(true);
      const data = await getAdminShipments(status && status !== 'all' ? { status } : undefined);
      setShipments(data);
    } catch (e: any) {
      console.error('Admin shipments error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(filter); }, [load, filter]);

  const openDetail = async (id: number) => {
    setDetailVisible(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const data = await getAdminShipmentDetail(id);
      setDetail(data);
    } catch {
      Alert.alert('Error', 'Failed to load shipment details');
      setDetailVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUpdateStatus = (status: string) => {
    if (!detail) return;
    Alert.alert(
      'Update Status',
      `Update shipment for #${detail.order_number} to "${status}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            setUpdating(true);
            try {
              await updateShipmentStatus(detail.id, { status });
              Alert.alert('Success', 'Shipment status updated');
              const updated = await getAdminShipmentDetail(detail.id);
              setDetail(updated);
              load(filter);
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error || 'Failed to update status');
            } finally {
              setUpdating(false);
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: AdminShipment }) => {
    const color = STATUS_COLORS[item.status] || Brand.textTertiary;
    return (
      <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={() => openDetail(item.id)}>
        <View style={styles.cardHeader}>
          <Text style={styles.orderNumber}>#{item.order_number}</Text>
          <View style={[styles.badge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.badgeText, { color }]}>{item.status.replace('_', ' ')}</Text>
          </View>
        </View>
        <Text style={styles.storeName}>{item.store_name}</Text>
        <View style={styles.cardFooter}>
          <View style={{ flexDirection: 'row', gap: 12, flex: 1 }}>
            <Text style={styles.metaText}>{item.carrier}</Text>
            <Text style={styles.metaText} numberOfLines={1}>{item.tracking_number}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={Brand.textTertiary} />
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient colors={[Brand.dark, Brand.darkLight, Brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Shipments</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContainer}>
          {FILTERS.map((f) => (
            <Pressable
              key={f}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === 'all' ? 'All' : f.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.centerBody}><ActivityIndicator size="large" color={Brand.primary} /></View>
        ) : (
          <FlatList
            data={shipments}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(filter)} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="truck-fast-outline" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No shipments found</Text>
                <Text style={styles.emptySub}>No shipments match this filter</Text>
              </View>
            }
          />
        )}

        <Modal visible={detailVisible} transparent animationType="fade" onRequestClose={() => setDetailVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Shipment Details</Text>
                <Pressable onPress={() => setDetailVisible(false)} hitSlop={12}>
                  <MaterialCommunityIcons name="close" size={24} color={Brand.textTertiary} />
                </Pressable>
              </View>
              {detailLoading ? (
                <ActivityIndicator size="large" color={Brand.primary} style={{ padding: 40 }} />
              ) : detail ? (
                <ScrollView style={{ maxHeight: '70%' }} showsVerticalScrollIndicator={false}>
                  <Text style={styles.detailLabel}>Order</Text>
                  <Text style={styles.detailValue}>#{detail.order_number}</Text>
                  <Text style={styles.detailLabel}>Store</Text>
                  <Text style={styles.detailValue}>{detail.store_name}</Text>
                  <Text style={styles.detailLabel}>Carrier</Text>
                  <Text style={styles.detailValue}>{detail.carrier}</Text>
                  <Text style={styles.detailLabel}>Tracking Number</Text>
                  <Text style={styles.detailValue}>{detail.tracking_number || '—'}</Text>
                  <Text style={styles.detailLabel}>Shipping Method</Text>
                  <Text style={styles.detailValue}>{detail.shipping_method}</Text>
                  <Text style={styles.detailLabel}>Fulfillment Type</Text>
                  <Text style={styles.detailValue}>{detail.fulfillment_type}</Text>
                  <Text style={styles.detailLabel}>Status</Text>
                  <View style={[styles.badge, { backgroundColor: (STATUS_COLORS[detail.status] || Brand.textTertiary) + '20', alignSelf: 'flex-start', marginTop: 4 }]}>
                    <Text style={[styles.badgeText, { color: STATUS_COLORS[detail.status] || Brand.textTertiary }]}>{detail.status.replace('_', ' ')}</Text>
                  </View>
                  <Text style={styles.detailLabel}>Shipping Cost</Text>
                  <Text style={styles.detailValue}>UGX {Number(detail.shipping_cost).toLocaleString()}</Text>
                  <Text style={styles.detailLabel}>Weight</Text>
                  <Text style={styles.detailValue}>{detail.weight_kg} kg</Text>
                  {detail.shipped_at && (
                    <>
                      <Text style={styles.detailLabel}>Shipped At</Text>
                      <Text style={styles.detailValue}>{new Date(detail.shipped_at).toLocaleString()}</Text>
                    </>
                  )}
                  {detail.estimated_delivery && (
                    <>
                      <Text style={styles.detailLabel}>Estimated Delivery</Text>
                      <Text style={styles.detailValue}>{new Date(detail.estimated_delivery).toLocaleDateString()}</Text>
                    </>
                  )}
                  {detail.delivered_at && (
                    <>
                      <Text style={styles.detailLabel}>Delivered At</Text>
                      <Text style={styles.detailValue}>{new Date(detail.delivered_at).toLocaleString()}</Text>
                    </>
                  )}
                  <Text style={styles.detailLabel}>Update Status</Text>
                  <View style={styles.statusOptions}>
                    {STATUS_OPTIONS.map((s) => (
                      <Pressable
                        key={s}
                        style={[styles.statusBtn, detail.status === s && styles.statusBtnActive]}
                        disabled={updating || detail.status === s}
                        onPress={() => handleUpdateStatus(s)}
                      >
                        <Text style={[styles.statusBtnText, detail.status === s && styles.statusBtnTextActive]}>
                          {s.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              ) : null}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  safeArea: { flex: 1, backgroundColor: Brand.dark },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  filterContainer: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Brand.border },
  filterTabActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: Brand.textSecondary },
  filterTextActive: { color: '#FFFFFF' },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  orderNumber: { fontSize: 15, fontWeight: '800', color: Brand.text },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  storeName: { fontSize: 13, color: Brand.textSecondary, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaText: { fontSize: 12, fontWeight: '600', color: Brand.textTertiary },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  emptySub: { fontSize: 13, color: Brand.textTertiary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Brand.text },
  detailLabel: { fontSize: 11, fontWeight: '700', color: Brand.textTertiary, marginTop: 12, marginBottom: 4, textTransform: 'uppercase' },
  detailValue: { fontSize: 14, color: Brand.text },
  statusOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  statusBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: Brand.surfaceAlt, borderWidth: 1, borderColor: Brand.border },
  statusBtnActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  statusBtnText: { fontSize: 13, fontWeight: '600', color: Brand.textSecondary },
  statusBtnTextActive: { color: '#FFFFFF' },
});
