import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { getKYC, getVerificationLogs, submitKYC, type SellerKYC, type VerificationLog } from '@/services/seller';

const STATUS_COLORS: Record<string, string> = {
  pending: Brand.rating,
  under_review: '#3B82F6',
  approved: Brand.primary,
  rejected: Brand.danger,
};

export default function SellerVerificationScreen() {
  const router = useRouter();
  const [kyc, setKyc] = useState<SellerKYC | null>(null);
  const [logs, setLogs] = useState<VerificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('individual');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [taxId, setTaxId] = useState('');

  const load = useCallback(async () => {
    try {
      setError(null);
      setRefreshing(true);
      const [kycData, logsData] = await Promise.all([getKYC(), getVerificationLogs()]);
      setKyc(kycData);
      setLogs(logsData);
      if (kycData) {
        setBusinessName(kycData.business_name);
        setBusinessType(kycData.business_type);
        setLicenseNumber(kycData.trading_license_number);
        setTaxId(kycData.tax_id);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!businessName.trim()) { Alert.alert('Validation', 'Business name is required'); return; }
    if (!licenseNumber.trim()) { Alert.alert('Validation', 'License number is required'); return; }
    setSubmitting(true);
    try {
      await submitKYC({
        business_name: businessName.trim(),
        business_type: businessType,
        trading_license_number: licenseNumber.trim(),
        tax_id: taxId.trim(),
      });
      Alert.alert('Success', 'KYC submitted for review');
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor = kyc ? (STATUS_COLORS[kyc.status] || Brand.textTertiary) : Brand.textTertiary;
  const canSubmit = !kyc || kyc.status === 'rejected' || kyc.status === 'approved';

  return (
    <View style={styles.screen}>
      <ModernHeader title="Verification" />

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
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}>
            {/* Status card */}
            {kyc && (
              <View style={[styles.statusCard, { borderLeftColor: statusColor }]}>
                <View style={styles.statusHeader}>
                  <MaterialCommunityIcons name="shield-check-outline" size={28} color={statusColor} />
                  <View style={styles.statusInfo}>
                    <Text style={styles.statusTitle}>Verification Status</Text>
                    <View style={[styles.badge, { backgroundColor: statusColor + '20' }]}>
                      <Text style={[styles.badgeText, { color: statusColor }]}>{kyc.status.replace(/_/g, ' ').toUpperCase()}</Text>
                    </View>
                  </View>
                </View>
                {kyc.review_notes ? (
                  <View style={styles.reviewNotes}>
                    <Text style={styles.reviewNotesLabel}>Review Notes</Text>
                    <Text style={styles.reviewNotesText}>{kyc.review_notes}</Text>
                  </View>
                ) : null}
                {kyc.submitted_at && (
                  <Text style={styles.submittedText}>Submitted: {new Date(kyc.submitted_at).toLocaleDateString()}</Text>
                )}
                {kyc.reviewed_at && (
                  <Text style={styles.submittedText}>Reviewed: {new Date(kyc.reviewed_at).toLocaleDateString()}</Text>
                )}
              </View>
            )}

            {/* KYC form */}
            {canSubmit ? (
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>{kyc ? 'Update KYC' : 'Submit KYC'}</Text>
                <Text style={styles.formSub}>Verify your business to unlock all seller features</Text>

                <Text style={styles.formLabel}>Business Name *</Text>
                <TextInput style={styles.formInput} value={businessName} onChangeText={setBusinessName} placeholder="Your business name" placeholderTextColor={Brand.textTertiary} />

                <Text style={styles.formLabel}>Business Type</Text>
                <View style={styles.typeRow}>
                  {['individual', 'llc', 'corporation', 'partnership'].map((t) => (
                    <Pressable key={t} style={[styles.typeBtn, businessType === t && styles.typeBtnActive]} onPress={() => setBusinessType(t)}>
                      <Text style={[styles.typeBtnText, businessType === t && styles.typeBtnTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.formLabel}>Trading License Number *</Text>
                <TextInput style={styles.formInput} value={licenseNumber} onChangeText={setLicenseNumber} placeholder="e.g. URS-12345" placeholderTextColor={Brand.textTertiary} autoCapitalize="characters" />

                <Text style={styles.formLabel}>Tax ID (TIN)</Text>
                <TextInput style={styles.formInput} value={taxId} onChangeText={setTaxId} placeholder="Optional" placeholderTextColor={Brand.textTertiary} autoCapitalize="characters" />

                <Pressable style={({ pressed }) => [styles.submitBtn, (submitting || pressed) && { opacity: 0.85 }]} onPress={handleSubmit} disabled={submitting}>
                  {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.submitBtnText}>Submit for Review</Text>}
                </Pressable>
              </View>
            ) : (
              <View style={styles.pendingCard}>
                <MaterialCommunityIcons name="clock-outline" size={40} color={Brand.rating} />
                <Text style={styles.pendingTitle}>Under Review</Text>
                <Text style={styles.pendingSub}>Your KYC is being reviewed by our team. This usually takes 1-2 business days.</Text>
              </View>
            )}

            {/* Verification history */}
            {logs.length > 0 && (
              <View style={styles.historyCard}>
                <Text style={styles.historyTitle}>Verification History</Text>
                {logs.map((log, idx) => (
                  <View key={log.id} style={[styles.logItem, idx < logs.length - 1 && styles.logItemBorder]}>
                    <View style={styles.logHeader}>
                      <View style={[styles.logBadge, { backgroundColor: (STATUS_COLORS[log.new_status] || Brand.textTertiary) + '20' }]}>
                        <Text style={[styles.logBadgeText, { color: STATUS_COLORS[log.new_status] || Brand.textTertiary }]}>{log.action}</Text>
                      </View>
                      <Text style={styles.logDate}>{new Date(log.created_at).toLocaleDateString()}</Text>
                    </View>
                    <Text style={styles.logStatus}>{log.previous_status} → {log.new_status}</Text>
                    {log.notes ? <Text style={styles.logNotes}>{log.notes}</Text> : null}
                    {log.reviewed_by ? <Text style={styles.logReviewer}>By: {log.reviewed_by}</Text> : null}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}
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
  body: { flex: 1 },
  bodyContent: { padding: 12, paddingBottom: 40 },
  statusCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 12, borderLeftWidth: 4, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusInfo: { flex: 1 },
  statusTitle: { fontSize: 15, fontWeight: '800', color: Brand.text, marginBottom: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  reviewNotes: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Brand.borderLight },
  reviewNotesLabel: { fontSize: 11, fontWeight: '700', color: Brand.textTertiary, marginBottom: 4, textTransform: 'uppercase' },
  reviewNotesText: { fontSize: 13, color: Brand.textSecondary },
  submittedText: { fontSize: 12, color: Brand.textTertiary, marginTop: 4 },
  formCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 20, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  formTitle: { fontSize: 18, fontWeight: '800', color: Brand.text },
  formSub: { fontSize: 13, color: Brand.textTertiary, marginBottom: 16, marginTop: 2 },
  formLabel: { fontSize: 13, fontWeight: '700', color: Brand.text, marginBottom: 6, marginTop: 12 },
  formInput: { borderWidth: 1.5, borderColor: Brand.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Brand.text },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  typeBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: Brand.border },
  typeBtnActive: { borderColor: Brand.primary, backgroundColor: Brand.primary + '12' },
  typeBtnText: { fontSize: 12, fontWeight: '600', color: Brand.textTertiary },
  typeBtnTextActive: { color: Brand.primary },
  submitBtn: { backgroundColor: Brand.primary, marginTop: 20, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  submitBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  pendingCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 24, alignItems: 'center', marginBottom: 12, gap: 8 },
  pendingTitle: { fontSize: 16, fontWeight: '800', color: Brand.text },
  pendingSub: { fontSize: 13, color: Brand.textTertiary, textAlign: 'center' },
  historyCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  historyTitle: { fontSize: 15, fontWeight: '800', color: Brand.text, marginBottom: 12 },
  logItem: { paddingVertical: 12 },
  logItemBorder: { borderBottomWidth: 1, borderBottomColor: Brand.borderLight },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  logBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  logBadgeText: { fontSize: 10, fontWeight: '700' },
  logDate: { fontSize: 12, color: Brand.textTertiary },
  logStatus: { fontSize: 13, fontWeight: '600', color: Brand.text },
  logNotes: { fontSize: 12, color: Brand.textSecondary, marginTop: 4 },
  logReviewer: { fontSize: 11, color: Brand.textTertiary, marginTop: 2 },
});
