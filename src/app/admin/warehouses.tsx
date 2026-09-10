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
  View
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import {
  getAdminWarehouses,
  getWarehouseInventory,
  type AdminWarehouse,
  type AdminWarehouseInventory,
} from '@/services/adminApi';

export default function AdminWarehousesScreen() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<AdminWarehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailWarehouse, setDetailWarehouse] = useState<AdminWarehouse | null>(null);
  const [inventory, setInventory] = useState<AdminWarehouseInventory[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await getAdminWarehouses();
      setWarehouses(data);
    } catch (e: any) {
      console.error('Admin warehouses error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (warehouse: AdminWarehouse) => {
    setDetailWarehouse(warehouse);
    setDetailVisible(true);
    setInventoryLoading(true);
    setInventory([]);
    try {
      const data = await getWarehouseInventory(warehouse.id);
      setInventory(data);
    } catch (e: any) {
      console.error('Warehouse inventory error:', e?.message);
    } finally {
      setInventoryLoading(false);
    }
  };

  const getUsagePercent = (item: AdminWarehouse) => {
    if (!item.capacity_cubic_meters) return 0;
    return Math.min(100, Math.round((item.used_capacity / item.capacity_cubic_meters) * 100));
  };

  const renderItem = ({ item }: { item: AdminWarehouse }) => {
    const usage = getUsagePercent(item);
    return (
      <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={() => openDetail(item)}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.warehouseName}>{item.name}</Text>
            <Text style={styles.warehouseCode}>Code: {item.code}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: (item.is_active ? Brand.primary : Brand.textTertiary) + '20' }]}>
            <Text style={[styles.badgeText, { color: item.is_active ? Brand.primary : Brand.textTertiary }]}>
              {item.is_active ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
        <Text style={styles.location}>{item.city}, {item.country}</Text>
        <View style={styles.usageContainer}>
          <View style={styles.usageBar}>
            <View style={[styles.usageFill, { width: `${usage}%`, backgroundColor: usage > 80 ? Brand.danger : usage > 50 ? Brand.rating : Brand.primary }]} />
          </View>
          <Text style={styles.usageText}>{item.used_capacity}/{item.capacity_cubic_meters} m³ ({usage}%)</Text>
        </View>
      </Pressable>
    );
  };

  const renderInventoryItem = ({ item }: { item: AdminWarehouseInventory }) => (
    <View style={styles.invCard}>
      <View style={styles.invHeader}>
        <Text style={styles.invProductName} numberOfLines={1}>{item.product_name}</Text>
        <Text style={styles.invQty}>{item.quantity} units</Text>
      </View>
      <Text style={styles.invStore}>{item.store_name}</Text>
      <View style={styles.invFooter}>
        <Text style={styles.invMeta}>Reserved: {item.reserved_quantity}</Text>
        <Text style={styles.invFee}>UGX {Number(item.storage_fee_per_month).toLocaleString()}/mo</Text>
      </View>
      {item.received_at && <Text style={styles.invDate}>Received: {new Date(item.received_at).toLocaleDateString()}</Text>}
    </View>
  );

  return (
    <View style={styles.screen}>
      <ModernHeader title="Warehouses" />
      <View style={styles.body}>
        {loading ? (
          <View style={styles.centerBody}><ActivityIndicator size="large" color={Brand.primary} /></View>
        ) : (
          <FlatList
            data={warehouses}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="warehouse" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No warehouses found</Text>
                <Text style={styles.emptySub}>No warehouses registered yet</Text>
              </View>
            }
          />
        )}

        <Modal visible={detailVisible} transparent animationType="fade" onRequestClose={() => setDetailVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{detailWarehouse?.name} — Inventory</Text>
                <Pressable onPress={() => setDetailVisible(false)} hitSlop={12}>
                  <MaterialCommunityIcons name="close" size={24} color={Brand.textTertiary} />
                </Pressable>
              </View>
              {detailWarehouse && (
                <View style={styles.detailSummary}>
                  <Text style={styles.detailText}>{detailWarehouse.city}, {detailWarehouse.country}</Text>
                  <Text style={styles.detailText}>Code: {detailWarehouse.code}</Text>
                </View>
              )}
              {inventoryLoading ? (
                <ActivityIndicator size="large" color={Brand.primary} style={{ padding: 40 }} />
              ) : (
                <FlatList
                  data={inventory}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={renderInventoryItem}
                  style={{ maxHeight: '65%' }}
                  ListEmptyComponent={
                    <View style={styles.emptyState}>
                      <MaterialCommunityIcons name="package-variant" size={36} color={Brand.textTertiary} />
                      <Text style={styles.emptyText}>No inventory</Text>
                      <Text style={styles.emptySub}>This warehouse has no inventory</Text>
                    </View>
                  }
                />
              )}
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  body: { flex: 1 },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  warehouseName: { fontSize: 15, fontWeight: '800', color: Brand.text },
  warehouseCode: { fontSize: 12, color: Brand.textTertiary },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  location: { fontSize: 13, color: Brand.textSecondary, marginBottom: 8 },
  usageContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  usageBar: { flex: 1, height: 8, borderRadius: 4, backgroundColor: Brand.surfaceAlt, overflow: 'hidden' },
  usageFill: { height: '100%', borderRadius: 4 },
  usageText: { fontSize: 12, fontWeight: '600', color: Brand.textTertiary },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  emptySub: { fontSize: 13, color: Brand.textTertiary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Brand.text, flex: 1 },
  detailSummary: { backgroundColor: Brand.surfaceAlt, borderRadius: 10, padding: 12, marginBottom: 12 },
  detailText: { fontSize: 13, color: Brand.textSecondary, marginBottom: 2 },
  invCard: { backgroundColor: Brand.surfaceAlt, borderRadius: 10, padding: 12, marginBottom: 8 },
  invHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  invProductName: { fontSize: 14, fontWeight: '700', color: Brand.text, flex: 1, marginRight: 8 },
  invQty: { fontSize: 13, fontWeight: '800', color: Brand.accent },
  invStore: { fontSize: 12, color: Brand.textSecondary, marginBottom: 4 },
  invFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  invMeta: { fontSize: 12, color: Brand.textTertiary },
  invFee: { fontSize: 12, fontWeight: '600', color: Brand.textTertiary },
  invDate: { fontSize: 11, color: Brand.textTertiary, marginTop: 2 },
});
