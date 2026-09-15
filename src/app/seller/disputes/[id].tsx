import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  getDisputeDetail,
  updateDisputeNotes,
  type SellerDisputeDetail,
} from '@/services/seller';

const STATUS_COLORS: Record<string, string> = {
  open: Brand.rating,
  under_review: '#3B82F6',
  resolved: Brand.primary,
  closed: '#9CA3AF',
  escalated: Brand.danger,
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  under_review: 'Under Review',
  resolved: 'Resolved',
  closed: 'Closed',
  escalated: 'Escalated',
};

export default function DisputeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [detail, setDetail] = useState<SellerDisputeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      setRefreshing(true);
      const data = await getDisputeDetail(Number(id));
      setDetail(data);
      setNotesText(data.admin_notes || '');
    } catch (e: any) {
      setError(e?.message || 'Failed to load dispute');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      await updateDisputeNotes(detail.id, notesText);
      Alert.alert('Saved', 'Your response has been submitted');
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const statusColor = detail ? STATUS_COLORS[detail.status] || colors.textTertiary : colors.textTertiary;
  const isActive = detail && (detail.status === 'open' || detail.status === 'under_review');

  return (
    <View style={styles.screen}>
      <ModernHeader title="Dispute Details" showBack />

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
                <MaterialCommunityIcons
                  name={detail.status === 'resolved' || detail.status === 'closed' ? 'check-circle' : 'alert-circle'}
                  size={24}
                  color={statusColor}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statusLabel}>Status</Text>
                <Text style={[styles.statusValue, { color: statusColor }]}>
                  {STATUS_LABELS[detail.status] || detail.status}
                </Text>
              </View>
              <Text style={styles.orderNum}>#{detail.order_number}</Text>
            </View>

            {/* Dispute info card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Dispute Information</Text>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="format-title" size={18} color={colors.textTertiary} />
                <Text style={styles.infoLabel}>Reason</Text>
                <Text style={styles.infoValue}>{detail.reason}</Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="account-outline" size={18} color={colors.textTertiary} />
                <Text style={styles.infoLabel}>Opened By</Text>
                <Text style={styles.infoValue}>{detail.opened_by}</Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="calendar-clock" size={18} color={colors.textTertiary} />
                <Text style={styles.infoLabel}>Filed</Text>
                <Text style={styles.infoValue}>{new Date(detail.created_at).toLocaleString()}</Text>
              </View>
              {detail.resolved_at && (
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="check-circle-outline" size={18} color={Brand.primary} />
                  <Text style={styles.infoLabel}>Resolved</Text>
                  <Text style={styles.infoValue}>{new Date(detail.resolved_at).toLocaleString()}</Text>
                </View>
              )}
            </View>

            {/* Description card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Buyer's Description</Text>
              <Text style={styles.descriptionText}>{detail.description}</Text>
            </View>

            {/* Resolution card */}
            {detail.refund_amount !== '0' && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Resolution</Text>
                <View style={styles.resolutionRow}>
                  <MaterialCommunityIcons name="cash-refund" size={20} color={Brand.danger} />
                  <Text style={styles.resolutionLabel}>Refund Amount</Text>
                  <Text style={styles.resolutionValue}>UGX {Number(detail.refund_amount).toLocaleString()}</Text>
                </View>
                {detail.resolution && (
                  <Text style={styles.resolutionStatus}>Status: {detail.resolution}</Text>
                )}
              </View>
            )}

            {/* Admin notes card */}
            {detail.admin_notes ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Admin Notes</Text>
                <Text style={styles.notesText}>{detail.admin_notes}</Text>
              </View>
            ) : null}

            {/* Seller response card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Your Response</Text>
              {isActive ? (
                <>
                  <TextInput
                    style={styles.notesInput}
                    value={notesText}
                    onChangeText={setNotesText}
                    placeholder="Explain your side, provide evidence, tracking info, etc."
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                  />
                  <Pressable
                    style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="send" size={18} color="#FFFFFF" />
                        <Text style={styles.submitBtnText}>Submit Response</Text>
                      </>
                    )}
                  </Pressable>
                </>
              ) : (
                <View style={styles.resolvedBox}>
                  <MaterialCommunityIcons name="check-circle-outline" size={32} color={Brand.primary} />
                  <Text style={styles.resolvedText}>This dispute has been resolved.</Text>
                </View>
              )}
            </View>

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
  orderNum: { fontSize: 14, fontWeight: '700', color: c.textSecondary },

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
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 6,
  },
  infoLabel: { fontSize: 13, fontWeight: '600', color: c.textTertiary, width: 70 },
  infoValue: { flex: 1, fontSize: 14, color: c.text, fontWeight: '500' },

  // Description
  descriptionText: { fontSize: 14, color: c.textSecondary, lineHeight: 22 },

  // Resolution
  resolutionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resolutionLabel: { fontSize: 13, fontWeight: '600', color: c.textSecondary, flex: 1 },
  resolutionValue: { fontSize: 16, fontWeight: '800', color: Brand.danger },
  resolutionStatus: { fontSize: 13, color: c.textTertiary, marginTop: 8 },

  // Notes
  notesText: { fontSize: 14, color: c.textSecondary, lineHeight: 22 },
  notesInput: {
    backgroundColor: c.surfaceAlt, borderRadius: 12, padding: 14,
    fontSize: 14, color: c.text, minHeight: 120, borderWidth: 1, borderColor: c.borderLight,
    marginBottom: 12,
  },

  // Submit
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Brand.primary, paddingVertical: 14, borderRadius: 12,
  },
  submitBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },

  // Resolved
  resolvedBox: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  resolvedText: { fontSize: 14, color: c.textSecondary, fontWeight: '500' },
});
