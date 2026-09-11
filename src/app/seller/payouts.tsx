import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import { useScreenshotPrevention } from '@/hooks/useScreenshotPrevention';
import { getMyEarnings, requestPayout, type SellerEarnings } from '@/services/seller';

interface PayoutRow {
  id: number;
  amount: string;
  method: string;
  status: string;
  created_at: string;
  reference: string;
}

export default function SellerPayoutsScreen() {
  useScreenshotPrevention(true);
  const [data, setData] = useState<SellerEarnings | null>(null);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [requesting, setRequesting] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const result = await getMyEarnings();
      setData(result);
      setPayouts(result.payouts || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load payouts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmt = (v: string | number | undefined | null) => Number(v || 0).toLocaleString();

  const handlePayout = async () => {
    if (!amount || Number(amount) <= 0) {
      Alert.alert('Validation', 'Enter a valid amount');
      return;
    }
    const available = Number(data?.available_balance || 0);
    if (Number(amount) > available) {
      Alert.alert('Validation', 'Amount exceeds available balance');
      return;
    }
    setRequesting(true);
    try {
      await requestPayout(amount);
      setShowModal(false);
      setAmount('');
      Alert.alert('Success', 'Payout requested');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || e?.message || 'Failed to request payout');
    } finally {
      setRequesting(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return Brand.success;
      case 'pending':
      case 'processing':
        return Brand.rating;
      case 'failed':
      case 'rejected':
      case 'cancelled':
        return Brand.danger;
      default:
        return Brand.textSecondary;
    }
  };

  const renderPayout = ({ item }: { item: PayoutRow }) => {
    const color = statusColor(item.status);
    return (
      <View style={styles.payoutCard}>
        <View style={styles.payoutHeader}>
          <View style={[styles.payoutIcon, { backgroundColor: color + '20' }]}>
            <MaterialCommunityIcons name="bank-transfer-out" size={22} color={color} />
          </View>
          <View style={styles.payoutInfo}>
            <Text style={styles.payoutAmount}>UGX {fmt(item.amount)}</Text>
            <Text style={styles.payoutMethod}>{item.method || 'Mobile Money'}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.statusText, { color }]}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.payoutMetaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{new Date(item.created_at).toLocaleDateString()}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Reference</Text>
            <Text style={styles.metaValue} numberOfLines={1}>{item.reference || '-'}</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading && payouts.length === 0) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Payouts" subtitle="Withdraw your earnings" />
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      </View>
    );
  }

  if (error && payouts.length === 0) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Payouts" subtitle="Withdraw your earnings" />
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ModernHeader title="Payouts" subtitle="Withdraw your earnings" />
      <FlatList
        data={payouts}
        keyExtractor={(item) => `${item.id}`}
        renderItem={renderPayout}
        maxToRenderPerBatch={10}
        windowSize={11}
        initialNumToRender={10}
        removeClippedSubviews={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            {/* Balance summary */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryCol}>
                  <Text style={styles.summaryLabel}>Available</Text>
                  <Text style={[styles.summaryValue, { color: Brand.primary }]}>UGX {fmt(data?.available_balance)}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryCol}>
                  <Text style={styles.summaryLabel}>Pending</Text>
                  <Text style={styles.summaryValue}>UGX {fmt(data?.pending_balance)}</Text>
                </View>
              </View>
              <View style={styles.summaryRow}>
                <View style={styles.summaryCol}>
                  <Text style={styles.summaryLabel}>Total Earned</Text>
                  <Text style={styles.summaryValueSmall}>UGX {fmt(data?.total_earned)}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryCol}>
                  <Text style={styles.summaryLabel}>Total Payouts</Text>
                  <Text style={styles.summaryValueSmall}>UGX {fmt(data?.total_payouts)}</Text>
                </View>
              </View>
            </View>

            {/* Request payout button */}
            <Pressable style={({ pressed }) => [styles.requestBtn, pressed && { opacity: 0.85 }]} onPress={() => setShowModal(true)}>
              <MaterialCommunityIcons name="bank-transfer-out" size={20} color="#FFFFFF" />
              <Text style={styles.requestBtnText}>Request Payout</Text>
            </Pressable>

            <View style={styles.commissionRow}>
              <MaterialCommunityIcons name="percent" size={16} color={Brand.primary} />
              <Text style={styles.commissionText}>Commission rate: {data?.commission_rate || '0'}%</Text>
            </View>

            <Text style={styles.sectionTitle}>Payout History</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="bank-transfer-out" size={48} color={Brand.textTertiary} />
            <Text style={styles.emptyText}>No payouts yet</Text>
            <Text style={styles.emptySubtext}>Your withdrawal history will appear here</Text>
          </View>
        }
      />

      {/* Request payout modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Payout</Text>
              <Pressable onPress={() => setShowModal(false)} hitSlop={12}>
                <MaterialCommunityIcons name="close" size={24} color={Brand.textTertiary} />
              </Pressable>
            </View>

            <Text style={styles.availableText}>
              Available: UGX {fmt(data?.available_balance)}
            </Text>

            <Text style={styles.formLabel}>Amount (UGX) *</Text>
            <TextInput
              style={styles.formInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              keyboardType="numeric"
              placeholderTextColor={Brand.textTertiary}
            />

            <Pressable
              style={({ pressed }) => [styles.submitBtn, (requesting || pressed) && { opacity: 0.85 }]}
              onPress={handlePayout}
              disabled={requesting}
            >
              {requesting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Request</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  emptyText: { marginTop: 12, fontSize: 14, color: Brand.textSecondary, fontWeight: '600' },
  emptySubtext: { marginTop: 4, fontSize: 12, color: Brand.textTertiary },

  list: { padding: 12, paddingBottom: 32 },

  summaryCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, marginBottom: 12,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  summaryCol: { flex: 1, gap: 4 },
  summaryDivider: { width: 1, height: 36, backgroundColor: Brand.borderLight },
  summaryLabel: { fontSize: 12, color: Brand.textTertiary, fontWeight: '600' },
  summaryValue: { fontSize: 18, fontWeight: '800', color: Brand.text },
  summaryValueSmall: { fontSize: 15, fontWeight: '700', color: Brand.text },

  requestBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Brand.primary, borderRadius: 12, paddingVertical: 14, marginBottom: 12,
  },
  requestBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },

  commissionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 16,
  },
  commissionText: { fontSize: 13, fontWeight: '600', color: Brand.text },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: Brand.text, marginBottom: 10, marginTop: 4 },

  payoutCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  payoutHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  payoutIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  payoutInfo: { flex: 1, gap: 2 },
  payoutAmount: { fontSize: 16, fontWeight: '800', color: Brand.text },
  payoutMethod: { fontSize: 12, color: Brand.textTertiary, textTransform: 'capitalize' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  payoutMetaRow: {
    flexDirection: 'row', gap: 12,
    backgroundColor: Brand.surfaceAlt, borderRadius: 10, padding: 12,
  },
  metaCol: { flex: 1, gap: 2 },
  metaLabel: { fontSize: 11, color: Brand.textTertiary, fontWeight: '600' },
  metaValue: { fontSize: 13, color: Brand.text, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Brand.text },
  availableText: { fontSize: 14, fontWeight: '700', color: Brand.primary, marginBottom: 12 },
  formLabel: { fontSize: 13, fontWeight: '700', color: Brand.text, marginBottom: 6, marginTop: 4 },
  formInput: {
    borderWidth: 1.5, borderColor: Brand.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Brand.text,
  },
  submitBtn: { backgroundColor: Brand.primary, marginTop: 20, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  submitBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});
