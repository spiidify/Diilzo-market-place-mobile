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
  getAdminSupplierDetail,
  getAdminSuppliers,
  supplierAction,
  type AdminSupplier,
  type AdminSupplierDetail,
} from '@/services/adminApi';

const VERIFICATION_COLORS: Record<string, string> = {
  verified: Brand.primary,
  gold: Brand.rating,
  pending: '#3B82F6',
  unverified: Brand.textTertiary,
};

export default function AdminSuppliersScreen() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<AdminSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<AdminSupplierDetail | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await getAdminSuppliers();
      setSuppliers(data);
    } catch (e: any) {
      console.error('Admin suppliers error:', e?.message);
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
      const data = await getAdminSupplierDetail(id);
      setDetail(data);
    } catch {
      Alert.alert('Error', 'Failed to load supplier details');
      setDetailVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAction = (supplierId: number, action: string, label: string) => {
    Alert.alert(
      `Confirm ${label}`,
      `Are you sure you want to ${label.toLowerCase()} this supplier?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await supplierAction(supplierId, action);
              Alert.alert('Success', `${label} successful`);
              if (detailVisible && detail) {
                const updated = await getAdminSupplierDetail(detail.id);
                setDetail(updated);
              }
              load();
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error || `Failed to ${label.toLowerCase()}`);
            }
          },
        },
      ],
    );
  };

  const showActions = (supplier: AdminSupplier) => {
    Alert.alert(
      `Actions for ${supplier.name}`,
      'Choose an action',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Verify', onPress: () => handleAction(supplier.id, 'verify', 'Verify') },
        { text: 'Gold', onPress: () => handleAction(supplier.id, 'gold', 'Set Gold') },
        { text: 'Unverify', style: 'destructive', onPress: () => handleAction(supplier.id, 'unverify', 'Unverify') },
        {
          text: supplier.trade_assurance ? 'Remove Trade Assurance' : 'Add Trade Assurance',
          onPress: () => handleAction(supplier.id, 'toggle_trade_assurance', supplier.trade_assurance ? 'Remove Trade Assurance' : 'Add Trade Assurance'),
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: AdminSupplier }) => {
    const vColor = VERIFICATION_COLORS[item.verification_status] || Brand.textTertiary;
    return (
      <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={() => openDetail(item.id)}>
        <View style={styles.cardHeader}>
          <Text style={styles.supplierName} numberOfLines={1}>{item.name}</Text>
          <View style={[styles.badge, { backgroundColor: vColor + '20' }]}>
            <Text style={[styles.badgeText, { color: vColor }]}>{item.verification_status}</Text>
          </View>
        </View>
        <Text style={styles.businessType}>{item.business_type}</Text>
        <View style={styles.cardFooter}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {item.trade_assurance && (
              <View style={[styles.badge, { backgroundColor: Brand.accent + '20' }]}>
                <Text style={[styles.badgeText, { color: Brand.accent }]}>Trade Assurance</Text>
              </View>
            )}
            {item.is_wholesaler && (
              <View style={[styles.badge, { backgroundColor: '#3B82F620' }]}>
                <Text style={[styles.badgeText, { color: '#3B82F6' }]}>Wholesaler</Text>
              </View>
            )}
          </View>
          <Text style={styles.metaText}>{item.product_count} products</Text>
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
          <Text style={styles.headerTitle}>Suppliers</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

        {loading ? (
          <View style={styles.centerBody}><ActivityIndicator size="large" color={Brand.primary} /></View>
        ) : (
          <FlatList
            data={suppliers}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="domain" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No suppliers found</Text>
                <Text style={styles.emptySub}>No suppliers registered yet</Text>
              </View>
            }
          />
        )}

        <Modal visible={detailVisible} transparent animationType="fade" onRequestClose={() => setDetailVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Supplier Details</Text>
                <Pressable onPress={() => setDetailVisible(false)} hitSlop={12}>
                  <MaterialCommunityIcons name="close" size={24} color={Brand.textTertiary} />
                </Pressable>
              </View>
              {detailLoading ? (
                <ActivityIndicator size="large" color={Brand.primary} style={{ padding: 40 }} />
              ) : detail ? (
                <ScrollView style={{ maxHeight: '70%' }} showsVerticalScrollIndicator={false}>
                  <Text style={styles.detailLabel}>Name</Text>
                  <Text style={styles.detailValue}>{detail.name}</Text>
                  <Text style={styles.detailLabel}>Company Name</Text>
                  <Text style={styles.detailValue}>{detail.company_name || '—'}</Text>
                  <Text style={styles.detailLabel}>Owner Email</Text>
                  <Text style={styles.detailValue}>{detail.owner_email}</Text>
                  <Text style={styles.detailLabel}>Business Type</Text>
                  <Text style={styles.detailValue}>{detail.business_type}</Text>
                  <Text style={styles.detailLabel}>Verification</Text>
                  <View style={[styles.badge, { backgroundColor: (VERIFICATION_COLORS[detail.verification_status] || Brand.textTertiary) + '20', alignSelf: 'flex-start', marginTop: 4 }]}>
                    <Text style={[styles.badgeText, { color: VERIFICATION_COLORS[detail.verification_status] || Brand.textTertiary }]}>{detail.verification_status}</Text>
                  </View>
                  <Text style={styles.detailLabel}>Trade Assurance</Text>
                  <Text style={styles.detailValue}>{detail.trade_assurance ? 'Yes' : 'No'}</Text>
                  <Text style={styles.detailLabel}>Year Established</Text>
                  <Text style={styles.detailValue}>{detail.year_established || '—'}</Text>
                  <Text style={styles.detailLabel}>Website</Text>
                  <Text style={styles.detailValue}>{detail.website || '—'}</Text>
                  <Text style={styles.detailLabel}>Phone</Text>
                  <Text style={styles.detailValue}>{detail.phone || '—'}</Text>
                  <Text style={styles.detailLabel}>Location</Text>
                  <Text style={styles.detailValue}>{detail.city}, {detail.country}</Text>
                  <Text style={styles.detailLabel}>Rating</Text>
                  <Text style={styles.detailValue}>{detail.rating} ({detail.review_count} reviews)</Text>
                  <Text style={styles.detailLabel}>Transactions</Text>
                  <Text style={styles.detailValue}>{detail.transactions_count}</Text>
                  <Text style={styles.detailLabel}>Response Rate</Text>
                  <Text style={styles.detailValue}>{detail.response_rate}%</Text>
                  <Text style={styles.detailLabel}>Total Orders</Text>
                  <Text style={styles.detailValue}>{detail.total_orders}</Text>
                  <Text style={styles.detailLabel}>Total Sales</Text>
                  <Text style={styles.detailValue}>UGX {Number(detail.total_sales).toLocaleString()}</Text>
                  <Text style={styles.detailLabel}>Products</Text>
                  <Text style={styles.detailValue}>{detail.product_count}</Text>
                  <View style={styles.modalActions}>
                    <Pressable style={[styles.actionBtn, styles.verifyBtn]} onPress={() => handleAction(detail.id, 'verify', 'Verify')}>
                      <Text style={styles.actionBtnText}>Verify</Text>
                    </Pressable>
                    <Pressable style={[styles.actionBtn, styles.goldBtn]} onPress={() => handleAction(detail.id, 'gold', 'Set Gold')}>
                      <Text style={styles.actionBtnText}>Gold</Text>
                    </Pressable>
                  </View>
                  <Pressable style={[styles.actionBtn, styles.unverifyBtn, { marginTop: 8 }]} onPress={() => handleAction(detail.id, 'unverify', 'Unverify')}>
                    <Text style={styles.actionBtnText}>Unverify</Text>
                  </Pressable>
                  <Pressable style={[styles.actionBtn, styles.tradeBtn, { marginTop: 8 }]} onPress={() => handleAction(detail.id, 'toggle_trade_assurance', detail.trade_assurance ? 'Remove Trade Assurance' : 'Add Trade Assurance')}>
                    <Text style={styles.actionBtnText}>{detail.trade_assurance ? 'Remove Trade Assurance' : 'Add Trade Assurance'}</Text>
                  </Pressable>
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
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  supplierName: { fontSize: 15, fontWeight: '800', color: Brand.text, flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  businessType: { fontSize: 13, color: Brand.textSecondary, marginBottom: 8 },
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
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  verifyBtn: { backgroundColor: Brand.primary },
  goldBtn: { backgroundColor: Brand.rating },
  unverifyBtn: { backgroundColor: Brand.danger },
  tradeBtn: { backgroundColor: Brand.accent },
  actionBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});
