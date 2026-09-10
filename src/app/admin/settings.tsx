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
import {
  getAdminSettings,
  updateAdminSettings,
  type AdminSettings,
} from '@/services/adminApi';

export default function AdminSettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AdminSettings>({
    site_name: '',
    default_commission_rate: '',
    default_currency: '',
    min_payout_amount: '',
    escrow_period_days: 0,
    dispute_window_days: 0,
  });

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await getAdminSettings();
      setSettings(data);
      setForm(data);
    } catch (e: any) {
      console.error('Admin settings error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAdminSettings(form);
      Alert.alert('Success', 'Settings updated successfully');
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof AdminSettings, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <View style={styles.screen}>
      <ModernHeader title="Platform Settings" />
      <View style={styles.body}>
        {loading ? (
          <View style={styles.centerBody}><ActivityIndicator size="large" color={Brand.primary} /></View>
        ) : (
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
          >
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>General</Text>
              <View style={styles.card}>
                <Text style={styles.fieldLabel}>Site Name</Text>
                <TextInput style={styles.input} value={form.site_name} onChangeText={(v) => updateField('site_name', v)} placeholder="Site name" placeholderTextColor={Brand.textTertiary} />
                <Text style={styles.fieldLabel}>Default Currency</Text>
                <TextInput style={styles.input} value={form.default_currency} onChangeText={(v) => updateField('default_currency', v)} placeholder="e.g. UGX" placeholderTextColor={Brand.textTertiary} />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Commission & Payouts</Text>
              <View style={styles.card}>
                <Text style={styles.fieldLabel}>Default Commission Rate (%)</Text>
                <TextInput style={styles.input} value={form.default_commission_rate} onChangeText={(v) => updateField('default_commission_rate', v)} placeholder="e.g. 5" placeholderTextColor={Brand.textTertiary} keyboardType="numeric" />
                <Text style={styles.fieldLabel}>Minimum Payout Amount</Text>
                <TextInput style={styles.input} value={form.min_payout_amount} onChangeText={(v) => updateField('min_payout_amount', v)} placeholder="e.g. 50000" placeholderTextColor={Brand.textTertiary} keyboardType="numeric" />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Escrow & Disputes</Text>
              <View style={styles.card}>
                <Text style={styles.fieldLabel}>Escrow Period (days)</Text>
                <TextInput style={styles.input} value={String(form.escrow_period_days)} onChangeText={(v) => updateField('escrow_period_days', Number(v) || 0)} placeholder="e.g. 7" placeholderTextColor={Brand.textTertiary} keyboardType="numeric" />
                <Text style={styles.fieldLabel}>Dispute Window (days)</Text>
                <TextInput style={styles.input} value={String(form.dispute_window_days)} onChangeText={(v) => updateField('dispute_window_days', Number(v) || 0)} placeholder="e.g. 14" placeholderTextColor={Brand.textTertiary} keyboardType="numeric" />
              </View>
            </View>

            <Pressable style={[styles.saveBtn, saving && { opacity: 0.5 }]} disabled={saving} onPress={handleSave}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Settings'}</Text>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  body: { flex: 1 },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 12, paddingBottom: 40 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: Brand.textSecondary, marginBottom: 8, textTransform: 'uppercase' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: Brand.textSecondary, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: Brand.border, borderRadius: 10, padding: 12, fontSize: 14, color: Brand.text, marginBottom: 16 },
  saveBtn: { backgroundColor: Brand.primary, paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});
