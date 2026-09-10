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
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import {
  getAdminKYC,
  getAdminKYCDetail,
  kycAction,
  type AdminKYC,
  type AdminKYCDetail,
} from '@/services/adminApi';

const STATUS_COLORS: Record<string, string> = {
  pending: Brand.rating,
  approved: Brand.primary,
  rejected: Brand.danger,
};

const FILTERS = ['pending', 'approved', 'rejected'] as const;

export default function AdminKYCScreen() {
  const router = useRouter();
  const [kycs, setKycs] = useState<AdminKYC[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('pending');
  const [detail, setDetail] = useState<AdminKYCDetail | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (status?: string) => {
    try {
      setRefreshing(true);
      const data = await getAdminKYC(status);
      setKycs(data);
    } catch (e: any) {
      console.error('Admin KYC error:', e?.message);
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
    setNotesText('');
    try {
      const data = await getAdminKYCDetail(id);
      setDetail(data);
      setNotesText(data.review_notes || '');
    } catch {
      Alert.alert('Error', 'Failed to load KYC details');
      setDetailVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAction = async (action: string) => {
    if (!detail) return;
    setSaving(true);
    try {
      await kycAction(detail.id, action, notesText);
      Alert.alert('Success', `KYC ${action}d successfully`);
      setDetailVisible(false);
      load(filter);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || `Failed to ${action} KYC`);
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: AdminKYC }) => {
    const color = STATUS_COLORS[item.status] || Brand.textTertiary;
    return (
      <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={() => openDetail(item.id)}>
        <View style={styles.cardHeader}>
          <Text style={styles.storeName} numberOfLines={1}>{item.store_name}</Text>
          <View style={[styles.badge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.badgeText, { color }]}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.ownerEmail}>{item.owner_email}</Text>
        <Text style={styles.businessName}>{item.business_name}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.metaText}>{item.business_type}</Text>
          {item.submitted_at && (
            <Text style={styles.dateText}>{new Date(item.submitted_at).toLocaleDateString()}</Text>
          )}
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
          <Text style={styles.headerTitle}>KYC Review</Text>
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
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.centerBody}><ActivityIndicator size="large" color={Brand.primary} /></View>
        ) : (
          <FlatList
            data={kycs}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(filter)} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="shield-account-outline" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No KYC submissions</Text>
                <Text style={styles.emptySub}>No {filter} KYC applications</Text>
              </View>
            }
          />
        )}

        <Modal visible={detailVisible} transparent animationType="fade" onRequestClose={() => setDetailVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>KYC Details</Text>
                <Pressable onPress={() => setDetailVisible(false)} hitSlop={12}>
                  <MaterialCommunityIcons name="close" size={24} color={Brand.textTertiary} />
                </Pressable>
              </View>
              {detailLoading ? (
                <ActivityIndicator size="large" color={Brand.primary} style={{ padding: 40 }} />
              ) : detail ? (
                <ScrollView style={{ maxHeight: '70%' }} showsVerticalScrollIndicator={false}>
                  <Text style={styles.detailLabel}>Store</Text>
                  <Text style={styles.detailValue}>{detail.store_name}</Text>
                  <Text style={styles.detailLabel}>Owner Email</Text>
                  <Text style={styles.detailValue}>{detail.owner_email}</Text>
                  <Text style={styles.detailLabel}>Business Name</Text>
                  <Text style={styles.detailValue}>{detail.business_name}</Text>
                  <Text style={styles.detailLabel}>Business Type</Text>
                  <Text style={styles.detailValue}>{detail.business_type}</Text>
                  <Text style={styles.detailLabel}>Trading License #</Text>
                  <Text style={styles.detailValue}>{detail.trading_license_number || '—'}</Text>
                  <Text style={styles.detailLabel}>Tax ID</Text>
                  <Text style={styles.detailValue}>{detail.tax_id || '—'}</Text>
                  <Text style={styles.detailLabel}>Status</Text>
                  <View style={[styles.badge, { backgroundColor: (STATUS_COLORS[detail.status] || Brand.textTertiary) + '20', alignSelf: 'flex-start', marginTop: 4 }]}>
                    <Text style={[styles.badgeText, { color: STATUS_COLORS[detail.status] || Brand.textTertiary }]}>{detail.status}</Text>
                  </View>
                  <Text style={styles.detailLabel}>ID Document</Text>
                  <Text style={styles.detailValue}>{detail.id_document || 'Not uploaded'}</Text>
                  <Text style={styles.detailLabel}>License Document</Text>
                  <Text style={styles.detailValue}>{detail.license_document || 'Not uploaded'}</Text>
                  <Text style={styles.detailLabel}>Reviewed By</Text>
                  <Text style={styles.detailValue}>{detail.reviewed_by || 'Not reviewed yet'}</Text>
                  {detail.submitted_at && (
                    <>
                      <Text style={styles.detailLabel}>Submitted</Text>
                      <Text style={styles.detailValue}>{new Date(detail.submitted_at).toLocaleString()}</Text>
                    </>
                  )}
                  {detail.reviewed_at && (
                    <>
                      <Text style={styles.detailLabel}>Reviewed At</Text>
                      <Text style={styles.detailValue}>{new Date(detail.reviewed_at).toLocaleString()}</Text>
                    </>
                  )}
                  <Text style={styles.detailLabel}>Review Notes</Text>
                  <TextInput
                    style={styles.notesInput}
                    value={notesText}
                    onChangeText={setNotesText}
                    placeholder="Add review notes..."
                    placeholderTextColor={Brand.textTertiary}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                  {detail.status === 'pending' && (
                    <View style={styles.modalActions}>
                      <Pressable style={[styles.actionBtn, styles.rejectBtn]} disabled={saving} onPress={() => handleAction('reject')}>
                        <Text style={styles.actionBtnText}>{saving ? '...' : 'Reject'}</Text>
                      </Pressable>
                      <Pressable style={[styles.actionBtn, styles.approveBtn]} disabled={saving} onPress={() => handleAction('approve')}>
                        <Text style={styles.actionBtnText}>{saving ? '...' : 'Approve'}</Text>
                      </Pressable>
                    </View>
                  )}
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
  storeName: { fontSize: 15, fontWeight: '800', color: Brand.text, flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  ownerEmail: { fontSize: 13, color: Brand.textSecondary, marginBottom: 2 },
  businessName: { fontSize: 13, fontWeight: '600', color: Brand.text, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaText: { fontSize: 12, fontWeight: '600', color: Brand.textTertiary },
  dateText: { fontSize: 12, color: Brand.textTertiary },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  emptySub: { fontSize: 13, color: Brand.textTertiary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Brand.text },
  detailLabel: { fontSize: 11, fontWeight: '700', color: Brand.textTertiary, marginTop: 12, marginBottom: 4, textTransform: 'uppercase' },
  detailValue: { fontSize: 14, color: Brand.text },
  notesInput: { borderWidth: 1, borderColor: Brand.border, borderRadius: 10, padding: 12, fontSize: 14, color: Brand.text, marginTop: 4, minHeight: 80 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  approveBtn: { backgroundColor: Brand.primary },
  rejectBtn: { backgroundColor: Brand.danger },
  actionBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});
