import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  getRFQDetail,
  quoteRFQ,
  type SellerRFQDetail,
} from '@/services/seller';

const STATUS_COLORS: Record<string, string> = {
  pending: Brand.rating,
  quoted: '#3B82F6',
  accepted: Brand.primary,
  rejected: Brand.danger,
  expired: '#9CA3AF',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Awaiting Quote',
  quoted: 'Quote Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
};

export default function RFQDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [detail, setDetail] = useState<SellerRFQDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quotePrice, setQuotePrice] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      setRefreshing(true);
      const data = await getRFQDetail(Number(id));
      setDetail(data);
      setQuotePrice(data.quoted_price || '');
      setQuoteNotes(data.seller_notes || '');
    } catch (e: any) {
      setError(e?.message || 'Failed to load RFQ');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleQuote = async () => {
    if (!detail) return;
    if (!quotePrice) { Alert.alert('Validation', 'Quote price is required'); return; }
    setQuoting(true);
    try {
      await quoteRFQ(detail.id, parseFloat(quotePrice), quoteNotes);
      Alert.alert('Success', 'Quote sent to buyer');
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to send quote');
    } finally {
      setQuoting(false);
    }
  };

  const statusColor = detail ? STATUS_COLORS[detail.status] || colors.textTertiary : colors.textTertiary;
  const canQuote = detail && detail.status === 'pending';

  return (
    <View style={styles.screen}>
      <ModernHeader title="RFQ Details" showBack />

      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
          </View>
        ) : error ? (
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : detail ? (
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
          >
            {/* Status banner */}
            <View style={[styles.statusBanner, { backgroundColor: statusColor + '15' }]}>
              <View style={[styles.statusIcon, { backgroundColor: statusColor + '25' }]}>
                <MaterialCommunityIcons name="file-document-outline" size={24} color={statusColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statusLabel}>Status</Text>
                <Text style={[styles.statusValue, { color: statusColor }]}>
                  {STATUS_LABELS[detail.status] || detail.status}
                </Text>
              </View>
            </View>

            {/* Product info */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Request Details</Text>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="package-variant-closed" size={18} color={colors.textTertiary} />
                <Text style={styles.infoLabel}>Product</Text>
                <Text style={styles.infoValue}>{detail.product_name}</Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="counter" size={18} color={colors.textTertiary} />
                <Text style={styles.infoLabel}>Quantity</Text>
                <Text style={styles.infoValue}>{detail.quantity} units</Text>
              </View>
              {detail.target_price && (
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="target" size={18} color={colors.textTertiary} />
                  <Text style={styles.infoLabel}>Target</Text>
                  <Text style={styles.infoValue}>UGX {Number(detail.target_price).toLocaleString()}</Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="account-outline" size={18} color={colors.textTertiary} />
                <Text style={styles.infoLabel}>Buyer</Text>
                <Text style={styles.infoValue}>{detail.buyer_email}</Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="calendar-clock" size={18} color={colors.textTertiary} />
                <Text style={styles.infoLabel}>Date</Text>
                <Text style={styles.infoValue}>{new Date(detail.created_at).toLocaleString()}</Text>
              </View>
            </View>

            {/* Buyer notes */}
            {detail.notes ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Buyer Notes</Text>
                <Text style={styles.notesText}>{detail.notes}</Text>
              </View>
            ) : null}

            {/* Quote section */}
            {canQuote ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Send Your Quote</Text>
                <Text style={styles.formLabel}>Quote Price (UGX) *</Text>
                <TextInput
                  style={styles.formInput}
                  value={quotePrice}
                  onChangeText={setQuotePrice}
                  placeholder="e.g. 50000"
                  keyboardType="numeric"
                  placeholderTextColor={colors.textTertiary}
                />
                <Text style={styles.formLabel}>Seller Notes</Text>
                <TextInput
                  style={[styles.formInput, { minHeight: 80 }]}
                  value={quoteNotes}
                  onChangeText={setQuoteNotes}
                  placeholder="Add notes for the buyer..."
                  multiline
                  textAlignVertical="top"
                  placeholderTextColor={colors.textTertiary}
                />
                <Pressable
                  style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }]}
                  onPress={handleQuote}
                  disabled={quoting}
                >
                  {quoting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="send" size={18} color="#FFFFFF" />
                      <Text style={styles.submitBtnText}>Send Quote</Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : detail.quoted_price ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Your Quote</Text>
                <View style={styles.quoteRow}>
                  <View style={styles.quoteMetric}>
                    <Text style={styles.quoteMetricLabel}>Unit Price</Text>
                    <Text style={styles.quoteMetricValue}>UGX {Number(detail.quoted_price).toLocaleString()}</Text>
                  </View>
                  {detail.quoted_total && (
                    <View style={styles.quoteMetric}>
                      <Text style={styles.quoteMetricLabel}>Total</Text>
                      <Text style={styles.quoteMetricValue}>UGX {Number(detail.quoted_total).toLocaleString()}</Text>
                    </View>
                  )}
                </View>
                {detail.seller_notes ? (
                  <View style={styles.prevNotesBox}>
                    <Text style={styles.prevNotesLabel}>Your Notes</Text>
                    <Text style={styles.notesText}>{detail.seller_notes}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={{ height: 30 }} />
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  body: { flex: 1 },
  bodyContent: { padding: 14, paddingBottom: 20 },

  // Status banner
  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: 14, marginBottom: 12,
  },
  statusIcon: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  statusLabel: { fontSize: 11, fontWeight: '600', color: c.textTertiary, textTransform: 'uppercase' },
  statusValue: { fontSize: 16, fontWeight: '800', marginTop: 2 },

  // Card
  card: {
    backgroundColor: c.surface, borderRadius: 14, padding: 16,
    marginBottom: 12, elevation: 2, shadowColor: '#000',
    shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  cardTitle: {
    fontSize: 14, fontWeight: '800', color: c.text,
    marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.3,
  },

  // Info row
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  infoLabel: { fontSize: 13, fontWeight: '600', color: c.textTertiary, width: 70 },
  infoValue: { flex: 1, fontSize: 14, color: c.text, fontWeight: '500' },

  // Notes
  notesText: { fontSize: 14, color: c.textSecondary, lineHeight: 22 },
  prevNotesBox: { marginTop: 12, padding: 12, backgroundColor: c.surfaceAlt, borderRadius: 10 },
  prevNotesLabel: { fontSize: 11, fontWeight: '700', color: c.textTertiary, marginBottom: 6, textTransform: 'uppercase' },

  // Form
  formLabel: { fontSize: 13, fontWeight: '700', color: c.text, marginBottom: 6, marginTop: 8 },
  formInput: {
    borderWidth: 1.5, borderColor: c.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: c.text,
  },

  // Submit
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Brand.primary, paddingVertical: 14, borderRadius: 12, marginTop: 16,
  },
  submitBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },

  // Quote display
  quoteRow: { flexDirection: 'row', gap: 12 },
  quoteMetric: { flex: 1, backgroundColor: c.surfaceAlt, borderRadius: 10, padding: 14 },
  quoteMetricLabel: { fontSize: 11, fontWeight: '600', color: c.textTertiary, textTransform: 'uppercase' },
  quoteMetricValue: { fontSize: 18, fontWeight: '800', color: c.text, marginTop: 4 },
});
