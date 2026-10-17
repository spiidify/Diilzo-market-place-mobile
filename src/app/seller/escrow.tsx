import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import {
    getEscrow,
    toggleTradeAssurance,
    updateEscrowProof,
    type EscrowHold,
    type EscrowResponse,
} from '@/services/seller';

const STATUS_COLORS: Record<string, string> = {
  held: Brand.rating,
  released: Brand.primary,
  refunded: Brand.danger,
  disputed: Brand.danger,
  partially_refunded: '#F59E0B',
};

const STATUS_LABELS: Record<string, string> = {
  held: 'Funds Held',
  released: 'Released',
  refunded: 'Refunded',
  disputed: 'Disputed',
  partially_refunded: 'Partially Refunded',
};

const FILTERS: Array<{ key: string; label: string }> = [
  { key: '', label: 'All' },
  { key: 'held', label: 'Held' },
  { key: 'released', label: 'Released' },
  { key: 'disputed', label: 'Disputed' },
  { key: 'refunded', label: 'Refunded' },
];

const fmt = (v: string | number | undefined | null) =>
  Number(v || 0).toLocaleString();

export default function SellerEscrowScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [data, setData] = useState<EscrowResponse | null>(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Proof / tracking modal
  const [proofTarget, setProofTarget] = useState<EscrowHold | null>(null);
  const [trackingInput, setTrackingInput] = useState('');
  const [docInput, setDocInput] = useState('');
  const [savingProof, setSavingProof] = useState(false);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async (statusFilter = filter) => {
    try {
      setError(null);
      setRefreshing(true);
      const result = await getEscrow(statusFilter || undefined);
      setData(result);
    } catch (e: any) {
      setError(e?.message || 'Failed to load escrow data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { load(''); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  const changeFilter = (key: string) => {
    setFilter(key);
    setLoading(true);
    load(key);
  };

  const onToggleAssurance = () => {
    const enabling = !data?.trade_assurance;
    Alert.alert(
      enabling ? 'Enable Trade Assurance?' : 'Disable Trade Assurance?',
      enabling
        ? 'Buyers will see your store as escrow-protected, which increases trust and conversions.'
        : 'Buyers will no longer see the Trade Assurance badge on your store.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: enabling ? 'Enable' : 'Disable',
          style: enabling ? 'default' : 'destructive',
          onPress: async () => {
            try {
              setToggling(true);
              const res = await toggleTradeAssurance();
              setData((prev) => prev ? { ...prev, trade_assurance: res.trade_assurance } : prev);
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Could not update Trade Assurance');
            } finally {
              setToggling(false);
            }
          },
        },
      ],
    );
  };

  const openProofModal = (item: EscrowHold) => {
    setProofTarget(item);
    setTrackingInput(item.tracking_number || '');
    setDocInput('');
  };

  const saveProof = async () => {
    if (!proofTarget) return;
    if (!trackingInput.trim() && !docInput.trim()) {
      Alert.alert('Nothing to save', 'Enter a tracking number or a document link.');
      return;
    }
    try {
      setSavingProof(true);
      await updateEscrowProof(proofTarget.id, {
        tracking_number: trackingInput.trim() || undefined,
        document_url: docInput.trim() || undefined,
      });
      setProofTarget(null);
      await load();
      Alert.alert('Saved', 'Delivery proof updated. The buyer has been notified.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save delivery proof');
    } finally {
      setSavingProof(false);
    }
  };

  const renderItem = ({ item }: { item: EscrowHold }) => {
    const color = STATUS_COLORS[item.status] || colors.textTertiary;
    const split = item.store_split;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Pressable
            onPress={() => split && router.push(`/seller/orders/${split.suborder_id}` as any)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <Text style={[styles.orderNumber, split && { color: Brand.primary }]}>#{item.order_number}</Text>
            {split ? <MaterialCommunityIcons name="chevron-right" size={16} color={Brand.primary} /> : null}
          </Pressable>
          <View style={[styles.badge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.badgeText, { color }]}>{STATUS_LABELS[item.status] || item.status}</Text>
          </View>
        </View>

        <View style={styles.buyerRow}>
          <MaterialCommunityIcons name="account-outline" size={13} color={colors.textTertiary} />
          <Text style={styles.buyerText} numberOfLines={1}>{item.buyer_email || 'Buyer'}</Text>
        </View>

        {/* Per-store money split — net escrow vs commission reserved */}
        {split ? (
          <View style={styles.splitBox}>
            <View style={styles.splitRow}>
              <Text style={styles.splitLabel}>Your subtotal</Text>
              <Text style={styles.splitValue}>{item.currency} {fmt(split.subtotal)}</Text>
            </View>
            <View style={styles.splitRow}>
              <Text style={styles.splitLabel}>Diilzo commission</Text>
              <Text style={[styles.splitValue, { color: Brand.danger }]}>−{item.currency} {fmt(split.commission_amount)}</Text>
            </View>
            {Number(split.seller_fees) > 0 ? (
              <View style={styles.splitRow}>
                <Text style={styles.splitLabel}>Platform fees</Text>
                <Text style={[styles.splitValue, { color: Brand.danger }]}>−{item.currency} {fmt(split.seller_fees)}</Text>
              </View>
            ) : null}
            <View style={[styles.splitRow, styles.splitTotal]}>
              <Text style={styles.splitTotalLabel}>Your net escrow</Text>
              <Text style={[styles.splitTotalValue, { color }]}>{item.currency} {fmt(split.seller_amount)}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.cardBody}>
            <View style={styles.metricCol}>
              <Text style={styles.metricValue}>{item.currency} {fmt(item.amount_held)}</Text>
              <Text style={styles.metricLabel}>Amount Held</Text>
            </View>
          </View>
        )}

        {item.refunded_amount && Number(item.refunded_amount) > 0 ? (
          <View style={styles.refundRow}>
            <MaterialCommunityIcons name="undo-variant" size={14} color={Brand.danger} />
            <Text style={styles.refundText}>
              {item.currency} {fmt(item.refunded_amount)} refunded
            </Text>
          </View>
        ) : null}
        {item.release_reason ? (
          <View style={styles.footerItem}>
            <MaterialCommunityIcons name="tag-outline" size={13} color={colors.textTertiary} />
            <Text style={styles.footerText}>
              {item.release_reason === 'auto_release' ? 'Auto-released'
                : item.release_reason === 'buyer_confirmation' ? 'Buyer confirmed'
                : item.release_reason === 'dispute_resolution' ? 'Dispute resolved'
                : 'Released by admin'}
            </Text>
          </View>
        ) : null}
        <View style={styles.cardFooter}>
          <View style={styles.footerItem}>
            <MaterialCommunityIcons name="calendar-clock" size={14} color={colors.textTertiary} />
            <Text style={styles.footerText}>Held: {new Date(item.held_at).toLocaleDateString()}</Text>
          </View>
          {item.auto_release_date && (item.status === 'held' || item.status === 'disputed') && (
            <View style={styles.footerItem}>
              <MaterialCommunityIcons name="lock-clock" size={14} color={Brand.rating} />
              <Text style={[styles.footerText, item.days_until_auto_release != null && item.days_until_auto_release <= 3 && { color: Brand.danger, fontWeight: '700' }]}>
                {item.days_until_auto_release === 0
                  ? 'Auto-releases today'
                  : item.days_until_auto_release != null
                    ? `Auto-release in ${item.days_until_auto_release}d`
                    : `Auto-release: ${new Date(item.auto_release_date).toLocaleDateString()}`}
              </Text>
            </View>
          )}
        </View>
        {item.tracking_number ? (
          <View style={styles.footerItem}>
            <MaterialCommunityIcons name="barcode-scan" size={14} color={colors.textTertiary} />
            <Text style={styles.footerText}>Tracking: {item.tracking_number}</Text>
          </View>
        ) : null}
        {(item.shipping_documents?.length ?? 0) > 0 && (
          <View style={styles.footerItem}>
            <MaterialCommunityIcons name="file-document-outline" size={14} color={colors.textTertiary} />
            <Text style={styles.footerText}>{item.shipping_documents!.length} delivery document{item.shipping_documents!.length > 1 ? 's' : ''} attached</Text>
          </View>
        )}
        <View style={styles.confirmRow}>
          <MaterialCommunityIcons
            name={item.buyer_confirmed_receipt ? 'check-circle' : 'clock-outline'}
            size={16}
            color={item.buyer_confirmed_receipt ? Brand.primary : Brand.rating}
          />
          <Text style={[styles.confirmText, { color: item.buyer_confirmed_receipt ? Brand.primary : Brand.rating }]}>
            {item.buyer_confirmed_receipt ? 'Buyer confirmed receipt' : 'Awaiting buyer confirmation'}
          </Text>
          {(item.status === 'held' || item.status === 'disputed') && (
            <Pressable style={styles.proofBtn} onPress={() => openProofModal(item)}>
              <MaterialCommunityIcons name="truck-check-outline" size={14} color={Brand.primary} />
              <Text style={styles.proofBtnText}>Add Proof</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <ModernHeader title="Escrow & Trade Assurance" showBack />

      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
          </View>
        ) : error ? (
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={() => load()}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : data ? (
          <FlatList
            data={data.escrows}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load()} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListHeaderComponent={
              <View>
                {/* Trade assurance banner with toggle */}
                <View style={styles.assuranceBanner}>
                  <MaterialCommunityIcons
                    name={data.trade_assurance ? 'shield-check' : 'shield-off-outline'}
                    size={28}
                    color={data.trade_assurance ? Brand.primary : colors.textTertiary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.assuranceTitle, !data.trade_assurance && { color: colors.textSecondary }]}>
                      Trade Assurance {data.trade_assurance ? 'Active' : 'Off'}
                    </Text>
                    <Text style={styles.assuranceSub}>
                      {data.trade_assurance
                        ? 'Your buyers are protected. Funds are held in escrow until they confirm receipt.'
                        : 'Enable the badge so buyers see your store is escrow-protected.'}
                    </Text>
                  </View>
                  <Pressable
                    style={[styles.toggleBtn, toggling && { opacity: 0.6 }]}
                    onPress={onToggleAssurance}
                    disabled={toggling}
                  >
                    <Text style={styles.toggleBtnText}>
                      {toggling ? '…' : data.trade_assurance ? 'Disable' : 'Enable'}
                    </Text>
                  </Pressable>
                </View>

                {/* KPI cards — seller net vs commission reserved */}
                <View style={styles.kpiRow}>
                  <View style={styles.kpiCard}>
                    <View style={[styles.kpiIcon, { backgroundColor: Brand.rating + '20' }]}>
                      <MaterialCommunityIcons name="lock" size={20} color={Brand.rating} />
                    </View>
                    <Text style={styles.kpiValue}>UGX {fmt(data.total_held)}</Text>
                    <Text style={styles.kpiLabel}>Net in Escrow</Text>
                  </View>
                  <View style={styles.kpiCard}>
                    <View style={[styles.kpiIcon, { backgroundColor: Brand.danger + '20' }]}>
                      <MaterialCommunityIcons name="percent" size={20} color={Brand.danger} />
                    </View>
                    <Text style={styles.kpiValue}>UGX {fmt(data.commission_held)}</Text>
                    <Text style={styles.kpiLabel}>Comm. Reserved</Text>
                  </View>
                </View>
                <View style={styles.kpiRow}>
                  <View style={styles.kpiCard}>
                    <View style={[styles.kpiIcon, { backgroundColor: Brand.primary + '20' }]}>
                      <MaterialCommunityIcons name="check-circle" size={20} color={Brand.primary} />
                    </View>
                    <Text style={styles.kpiValue}>UGX {fmt(data.total_released)}</Text>
                    <Text style={styles.kpiLabel}>Released</Text>
                  </View>
                  <View style={styles.kpiCard}>
                    <View style={[styles.kpiIcon, { backgroundColor: '#3B82F620' }]}>
                      <MaterialCommunityIcons name="gavel" size={20} color="#3B82F6" />
                    </View>
                    <Text style={styles.kpiValue}>{data.disputed_count ?? 0}</Text>
                    <Text style={styles.kpiLabel}>Disputed</Text>
                  </View>
                </View>

                {/* Status filter tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ gap: 8 }}>
                  {FILTERS.map((f) => (
                    <Pressable
                      key={f.key}
                      style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                      onPress={() => changeFilter(f.key)}
                    >
                      <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>
                        {f.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="lock-outline" size={48} color={colors.textTertiary} />
                <Text style={styles.emptyText}>No escrow transactions</Text>
                <Text style={styles.emptySub}>
                  {filter ? 'No escrows match this filter.' : 'Escrow-protected orders will appear here.'}
                </Text>
              </View>
            }
          />
        ) : null}
      </View>

      {/* Proof / tracking modal */}
      <Modal visible={!!proofTarget} transparent animationType="fade" onRequestClose={() => setProofTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delivery Proof & Tracking</Text>
            <Text style={styles.modalSub}>
              Order #{proofTarget?.order_number} — buyers release escrow faster when they can track their delivery.
            </Text>
            <Text style={styles.inputLabel}>Tracking number</Text>
            <TextInput
              style={styles.input}
              value={trackingInput}
              onChangeText={setTrackingInput}
              placeholder="e.g. DHL-9834521"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="characters"
            />
            <Text style={styles.inputLabel}>Document link (waybill / proof of delivery / invoice)</Text>
            <TextInput
              style={styles.input}
              value={docInput}
              onChangeText={setDocInput}
              placeholder="https://…"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              keyboardType="url"
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setProofTarget(null)} disabled={savingProof}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSave} onPress={saveProof} disabled={savingProof}>
                {savingProof
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalSaveText}>Save & Notify Buyer</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  listContent: { padding: 14, paddingBottom: 20 },

  // Assurance banner
  assuranceBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Brand.primary + '10', borderWidth: 1, borderColor: Brand.primary + '30',
    borderRadius: 14, padding: 12, marginBottom: 14,
  },
  assuranceTitle: { fontSize: 15, fontWeight: '800', color: Brand.primary },
  assuranceSub: { fontSize: 12, color: c.textSecondary, marginTop: 4, lineHeight: 18 },
  toggleBtn: {
    backgroundColor: Brand.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
  },
  toggleBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  // KPI row
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  kpiCard: {
    flex: 1, backgroundColor: c.surface, borderRadius: 14, padding: 12,
    alignItems: 'center', gap: 6, elevation: 2, shadowColor: '#000',
    shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  kpiIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  kpiValue: { fontSize: 13, fontWeight: '800', color: c.text },
  kpiLabel: { fontSize: 10, color: c.textTertiary, fontWeight: '600' },

  // Filter chips
  filterScroll: { flexGrow: 0, marginBottom: 12 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
  },
  filterChipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  filterChipText: { fontSize: 12, fontWeight: '700', color: c.textSecondary },
  filterChipTextActive: { color: '#fff' },

  // Card
  card: {
    backgroundColor: c.surface, borderRadius: 14, padding: 12,
    marginBottom: 10, elevation: 2, shadowColor: '#000',
    shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderNumber: { fontSize: 15, fontWeight: '800', color: c.text },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  buyerRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  buyerText: { fontSize: 12, color: c.textSecondary, flex: 1 },
  cardBody: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.borderLight },
  metricCol: { flex: 1 },
  metricValue: { fontSize: 13, fontWeight: '700', color: c.text },
  metricLabel: { fontSize: 10, color: c.textTertiary, marginTop: 2 },

  // Store split box
  splitBox: {
    backgroundColor: c.surfaceAlt, borderRadius: 10, padding: 10, marginTop: 2,
  },
  splitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  splitLabel: { fontSize: 12, color: c.textSecondary },
  splitValue: { fontSize: 12, fontWeight: '700', color: c.text },
  splitTotal: { borderTopWidth: 1, borderTopColor: c.borderLight, marginTop: 4, paddingTop: 6 },
  splitTotalLabel: { fontSize: 13, fontWeight: '800', color: c.text },
  splitTotalValue: { fontSize: 14, fontWeight: '800' },

  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  refundRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  refundText: { fontSize: 12, fontWeight: '700', color: Brand.danger },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  footerText: { fontSize: 12, color: c.textSecondary },

  confirmRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.borderLight,
  },
  confirmText: { fontSize: 13, fontWeight: '600', flex: 1 },
  proofBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Brand.primary + '15', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  proofBtnText: { fontSize: 12, fontWeight: '800', color: Brand.primary },

  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: c.textSecondary },
  emptySub: { fontSize: 13, color: c.textTertiary, textAlign: 'center', paddingHorizontal: 20 },

  // Modal
  modalWrap: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: c.surface, borderRadius: 16, padding: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: c.text },
  modalSub: { fontSize: 12, color: c.textSecondary, marginTop: 4, marginBottom: 14, lineHeight: 17 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: c.textSecondary, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 14, color: c.text, marginBottom: 14, backgroundColor: c.surfaceAlt,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancel: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: c.border,
  },
  modalCancelText: { fontSize: 14, fontWeight: '700', color: c.textSecondary },
  modalSave: {
    flex: 1.4, alignItems: 'center', justifyContent: 'center', paddingVertical: 12,
    borderRadius: 10, backgroundColor: Brand.primary,
  },
  modalSaveText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
