import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import {
  getDisputeDetail,
  getDisputes,
  updateDisputeNotes,
  type SellerDispute,
  type SellerDisputeDetail,
} from '@/services/seller';

const STATUS_COLORS: Record<string, string> = {
  open: Brand.rating,
  under_review: '#3B82F6',
  resolved: Brand.primary,
  closed: Brand.textTertiary,
  escalated: Brand.danger,
};

export default function SellerDisputesScreen() {
  const router = useRouter();
  const [disputes, setDisputes] = useState<SellerDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<SellerDisputeDetail | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await getDisputes();
      setDisputes(data);
    } catch (e: any) {
      console.error('Disputes error:', e?.message);
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
      const data = await getDisputeDetail(id);
      setDetail(data);
      setNotesText(data.admin_notes || '');
    } catch {
      Alert.alert('Error', 'Failed to load dispute');
      setDetailVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      await updateDisputeNotes(detail.id, notesText);
      Alert.alert('Saved', 'Notes updated successfully');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: SellerDispute }) => {
    const color = STATUS_COLORS[item.status] || Brand.textTertiary;
    return (
      <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={() => openDetail(item.id)}>
        <View style={styles.cardHeader}>
          <Text style={styles.orderNumber}>#{item.order_number}</Text>
          <View style={[styles.badge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.badgeText, { color }]}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.reason}>{item.reason}</Text>
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
          {item.refund_amount !== '0' && (
            <Text style={styles.refundAmount}>Refund: UGX {Number(item.refund_amount).toLocaleString()}</Text>
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
          <Text style={styles.headerTitle}>Disputes</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

        {loading ? (
          <View style={styles.centerBody}><ActivityIndicator size="large" color={Brand.primary} /></View>
        ) : (
          <FlatList
            data={disputes}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="check-circle-outline" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No disputes</Text>
                <Text style={styles.emptySub}>All clear!</Text>
              </View>
            }
          />
        )}

        {detailVisible && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Dispute Details</Text>
                <Pressable onPress={() => setDetailVisible(false)} hitSlop={12}>
                  <MaterialCommunityIcons name="close" size={24} color={Brand.textTertiary} />
                </Pressable>
              </View>
              {detailLoading ? (
                <ActivityIndicator size="large" color={Brand.primary} style={{ padding: 40 }} />
              ) : detail ? (
                <FlatList
                  data={[]}
                  renderItem={() => null}
                  ListHeaderComponent={
                    <View>
                      <Text style={styles.detailLabel}>Order</Text>
                      <Text style={styles.detailValue}>#{detail.order_number}</Text>
                      <Text style={styles.detailLabel}>Reason</Text>
                      <Text style={styles.detailValue}>{detail.reason}</Text>
                      <Text style={styles.detailLabel}>Description</Text>
                      <Text style={styles.detailValue}>{detail.description}</Text>
                      <Text style={styles.detailLabel}>Status</Text>
                      <View style={[styles.badge, { backgroundColor: (STATUS_COLORS[detail.status] || Brand.textTertiary) + '20', alignSelf: 'flex-start', marginTop: 4 }]}>
                        <Text style={[styles.badgeText, { color: STATUS_COLORS[detail.status] || Brand.textTertiary }]}>{detail.status}</Text>
                      </View>
                      {detail.refund_amount !== '0' && (
                        <>
                          <Text style={styles.detailLabel}>Refund Amount</Text>
                          <Text style={styles.detailValue}>UGX {Number(detail.refund_amount).toLocaleString()}</Text>
                        </>
                      )}
                      <Text style={styles.detailLabel}>Admin Notes</Text>
                      <Text style={styles.detailValue}>{detail.admin_notes || 'No admin notes yet.'}</Text>
                      <Text style={styles.detailLabel}>Opened By</Text>
                      <Text style={styles.detailValue}>{detail.opened_by}</Text>
                      <Text style={styles.detailLabel}>Date</Text>
                      <Text style={styles.detailValue}>{new Date(detail.created_at).toLocaleString()}</Text>
                    </View>
                  }
                />
              ) : null}
            </View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  safeArea: { flex: 1, backgroundColor: Brand.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderNumber: { fontSize: 15, fontWeight: '800', color: Brand.text },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  reason: { fontSize: 14, fontWeight: '700', color: Brand.text, marginBottom: 4 },
  description: { fontSize: 13, color: Brand.textSecondary, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateText: { fontSize: 12, color: Brand.textTertiary },
  refundAmount: { fontSize: 12, fontWeight: '700', color: Brand.danger },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  emptySub: { fontSize: 13, color: Brand.textTertiary },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Brand.text },
  detailLabel: { fontSize: 11, fontWeight: '700', color: Brand.textTertiary, marginTop: 12, marginBottom: 4, textTransform: 'uppercase' },
  detailValue: { fontSize: 14, color: Brand.text },
});
