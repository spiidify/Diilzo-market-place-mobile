import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
import { getRFQDetail, getRFQs, quoteRFQ, type SellerRFQ, type SellerRFQDetail } from '@/services/seller';

const STATUS_COLORS: Record<string, string> = {
  pending: Brand.rating,
  quoted: '#3B82F6',
  accepted: Brand.primary,
  rejected: Brand.danger,
  expired: Brand.textTertiary,
};

export default function SellerRFQsScreen() {
  const router = useRouter();
  const [rfqs, setRfqs] = useState<SellerRFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<SellerRFQDetail | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [quotePrice, setQuotePrice] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRefreshing(true);
      const data = await getRFQs();
      setRfqs(data);
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
      const data = await getRFQDetail(id);
      setDetail(data);
      setQuotePrice(data.quoted_price || '');
      setQuoteNotes(data.seller_notes || '');
    } catch {
      Alert.alert('Error', 'Failed to load RFQ');
      setDetailVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleQuote = async () => {
    if (!detail) return;
    if (!quotePrice) { Alert.alert('Validation', 'Quote price is required'); return; }
    setQuoting(true);
    try {
      await quoteRFQ(detail.id, parseFloat(quotePrice), quoteNotes);
      Alert.alert('Success', 'Quote sent to buyer');
      setDetailVisible(false);
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to send quote');
    } finally {
      setQuoting(false);
    }
  };

  const renderItem = ({ item }: { item: SellerRFQ }) => {
    const color = STATUS_COLORS[item.status] || Brand.textTertiary;
    return (
      <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={() => openDetail(item.id)}>
        <View style={styles.cardHeader}>
          <Text style={styles.productName} numberOfLines={1}>{item.product_name}</Text>
          <View style={[styles.badge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.badgeText, { color }]}>{item.status}</Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.metricCol}>
            <Text style={styles.metricValue}>{item.quantity}</Text>
            <Text style={styles.metricLabel}>Qty</Text>
          </View>
          {item.target_price && (
            <View style={styles.metricCol}>
              <Text style={styles.metricValue}>UGX {Number(item.target_price).toLocaleString()}</Text>
              <Text style={styles.metricLabel}>Target</Text>
            </View>
          )}
          {item.quoted_price && (
            <View style={styles.metricCol}>
              <Text style={styles.metricValue}>UGX {Number(item.quoted_price).toLocaleString()}</Text>
              <Text style={styles.metricLabel}>Quoted</Text>
            </View>
          )}
        </View>
        <Text style={styles.buyerText}>{item.buyer_email}</Text>
        <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <ModernHeader title="RFQs" />

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
            data={rfqs}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="file-document-outline" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No RFQs</Text>
                <Text style={styles.emptySub}>Buyer quotes will appear here</Text>
              </View>
            }
          />
        )}

        <Modal visible={detailVisible} animationType="slide" transparent onRequestClose={() => setDetailVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>RFQ Details</Text>
                <Pressable onPress={() => setDetailVisible(false)} hitSlop={12}><MaterialCommunityIcons name="close" size={24} color={Brand.textTertiary} /></Pressable>
              </View>
              {detailLoading ? (
                <ActivityIndicator size="large" color={Brand.primary} style={{ padding: 40 }} />
              ) : detail ? (
                <View>
                  <Text style={styles.detailLabel}>Product</Text>
                  <Text style={styles.detailValue}>{detail.product_name}</Text>
                  <View style={styles.detailRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailLabel}>Quantity</Text>
                      <Text style={styles.detailValue}>{detail.quantity}</Text>
                    </View>
                    {detail.target_price && (
                      <View style={{ flex: 1 }}>
                        <Text style={styles.detailLabel}>Target Price</Text>
                        <Text style={styles.detailValue}>UGX {Number(detail.target_price).toLocaleString()}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.detailLabel}>Buyer</Text>
                  <Text style={styles.detailValue}>{detail.buyer_email}</Text>
                  <Text style={styles.detailLabel}>Buyer Notes</Text>
                  <Text style={styles.detailValue}>{detail.notes || 'No notes'}</Text>
                  {detail.status === 'pending' ? (
                    <View style={styles.quoteSection}>
                      <Text style={styles.quoteTitle}>Send Your Quote</Text>
                      <Text style={styles.formLabel}>Quote Price (UGX) *</Text>
                      <TextInput style={styles.formInput} value={quotePrice} onChangeText={setQuotePrice} placeholder="e.g. 50000" keyboardType="numeric" placeholderTextColor={Brand.textTertiary} />
                      <Text style={styles.formLabel}>Seller Notes</Text>
                      <TextInput style={[styles.formInput, { minHeight: 80 }]} value={quoteNotes} onChangeText={setQuoteNotes} placeholder="Add notes for the buyer..." multiline placeholderTextColor={Brand.textTertiary} />
                      <Pressable style={({ pressed }) => [styles.quoteBtn, (quoting || pressed) && { opacity: 0.85 }]} onPress={handleQuote} disabled={quoting}>
                        {quoting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.quoteBtnText}>Send Quote</Text>}
                      </Pressable>
                    </View>
                  ) : (
                    <View>
                      <Text style={styles.detailLabel}>Your Quote</Text>
                      <Text style={styles.detailValue}>UGX {Number(detail.quoted_price).toLocaleString()}</Text>
                      {detail.quoted_total && <Text style={styles.detailValue}>Total: UGX {Number(detail.quoted_total).toLocaleString()}</Text>}
                      <Text style={styles.detailLabel}>Your Notes</Text>
                      <Text style={styles.detailValue}>{detail.seller_notes || 'No notes'}</Text>
                    </View>
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
  productName: { fontSize: 15, fontWeight: '800', color: Brand.text, flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardBody: { flexDirection: 'row', gap: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Brand.borderLight },
  metricCol: { flex: 1 },
  metricValue: { fontSize: 13, fontWeight: '700', color: Brand.text },
  metricLabel: { fontSize: 10, color: Brand.textTertiary, marginTop: 2 },
  buyerText: { fontSize: 12, color: Brand.textSecondary, marginTop: 4 },
  dateText: { fontSize: 12, color: Brand.textTertiary, marginTop: 2 },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  emptySub: { fontSize: 13, color: Brand.textTertiary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Brand.text },
  detailLabel: { fontSize: 11, fontWeight: '700', color: Brand.textTertiary, marginTop: 12, marginBottom: 4, textTransform: 'uppercase' },
  detailValue: { fontSize: 14, color: Brand.text },
  detailRow: { flexDirection: 'row', gap: 12 },
  quoteSection: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: Brand.borderLight },
  quoteTitle: { fontSize: 16, fontWeight: '800', color: Brand.text, marginBottom: 12 },
  formLabel: { fontSize: 13, fontWeight: '700', color: Brand.text, marginBottom: 6, marginTop: 8 },
  formInput: { borderWidth: 1.5, borderColor: Brand.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Brand.text },
  quoteBtn: { backgroundColor: Brand.primary, marginTop: 16, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  quoteBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});
