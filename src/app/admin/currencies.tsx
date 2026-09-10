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
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import {
  createCurrency,
  getAdminCurrencies,
  updateCurrencyRate,
  type AdminCurrency,
} from '@/services/adminApi';

export default function AdminCurrenciesScreen() {
  const router = useRouter();
  const [currencies, setCurrencies] = useState<AdminCurrency[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [rateModalVisible, setRateModalVisible] = useState(false);
  const [rateCurrency, setRateCurrency] = useState<AdminCurrency | null>(null);
  const [newRate, setNewRate] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ currency_code: '', currency_name: '', currency_symbol: '', rate_to_ugx: '', is_active: true });

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await getAdminCurrencies();
      setCurrencies(data);
    } catch (e: any) {
      console.error('Admin currencies error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.currency_code.trim() || !form.currency_name.trim() || !form.rate_to_ugx.trim()) {
      Alert.alert('Error', 'Code, name and rate are required');
      return;
    }
    setSaving(true);
    try {
      await createCurrency({
        currency_code: form.currency_code.trim().toUpperCase(),
        currency_name: form.currency_name.trim(),
        currency_symbol: form.currency_symbol.trim() || form.currency_code.trim(),
        rate_to_ugx: Number(form.rate_to_ugx),
        is_active: form.is_active,
      });
      Alert.alert('Success', 'Currency created successfully');
      setModalVisible(false);
      setForm({ currency_code: '', currency_name: '', currency_symbol: '', rate_to_ugx: '', is_active: true });
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to create currency');
    } finally {
      setSaving(false);
    }
  };

  const openRateModal = (currency: AdminCurrency) => {
    setRateCurrency(currency);
    setNewRate(currency.rate_to_ugx);
    setRateModalVisible(true);
  };

  const handleUpdateRate = async () => {
    if (!rateCurrency || !newRate.trim()) return;
    setSaving(true);
    try {
      await updateCurrencyRate(rateCurrency.id, Number(newRate));
      Alert.alert('Success', 'Rate updated successfully');
      setRateModalVisible(false);
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to update rate');
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: AdminCurrency }) => (
    <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={() => openRateModal(item)}>
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={styles.symbolBadge}>
            <Text style={styles.symbolText}>{item.currency_symbol}</Text>
          </View>
          <View>
            <Text style={styles.currencyCode}>{item.currency_code}</Text>
            <Text style={styles.currencyName}>{item.currency_name}</Text>
          </View>
        </View>
        <View style={[styles.badge, { backgroundColor: (item.is_active ? Brand.primary : Brand.textTertiary) + '20' }]}>
          <Text style={[styles.badgeText, { color: item.is_active ? Brand.primary : Brand.textTertiary }]}>
            {item.is_active ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.rateLabel}>Rate to UGX</Text>
        <Text style={styles.rateValue}>{item.rate_to_ugx}</Text>
      </View>
      <View style={styles.actionHint}>
        <MaterialCommunityIcons name="gesture-tap" size={14} color={Brand.primary} />
        <Text style={styles.actionHintText}>Tap to update rate</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <ModernHeader title="Currencies" rightIcon="plus" onRightPress={() => setModalVisible(true)} />
      <View style={styles.body}>
        {loading ? (
          <View style={styles.centerBody}><ActivityIndicator size="large" color={Brand.primary} /></View>
        ) : (
          <FlatList
            data={currencies}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="currency-usd-off" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No currencies found</Text>
                <Text style={styles.emptySub}>Create one to get started</Text>
              </View>
            }
          />
        )}

        <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Currency</Text>
                <Pressable onPress={() => setModalVisible(false)} hitSlop={12}>
                  <MaterialCommunityIcons name="close" size={24} color={Brand.textTertiary} />
                </Pressable>
              </View>
              <Text style={styles.fieldLabel}>Currency Code</Text>
              <TextInput style={styles.input} value={form.currency_code} onChangeText={(v) => setForm({ ...form, currency_code: v })} placeholder="e.g. USD" placeholderTextColor={Brand.textTertiary} autoCapitalize="characters" />
              <Text style={styles.fieldLabel}>Currency Name</Text>
              <TextInput style={styles.input} value={form.currency_name} onChangeText={(v) => setForm({ ...form, currency_name: v })} placeholder="e.g. US Dollar" placeholderTextColor={Brand.textTertiary} />
              <Text style={styles.fieldLabel}>Currency Symbol</Text>
              <TextInput style={styles.input} value={form.currency_symbol} onChangeText={(v) => setForm({ ...form, currency_symbol: v })} placeholder="e.g. $" placeholderTextColor={Brand.textTertiary} />
              <Text style={styles.fieldLabel}>Rate to UGX</Text>
              <TextInput style={styles.input} value={form.rate_to_ugx} onChangeText={(v) => setForm({ ...form, rate_to_ugx: v })} placeholder="e.g. 3800" placeholderTextColor={Brand.textTertiary} keyboardType="numeric" />
              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Active</Text>
                <Switch value={form.is_active} onValueChange={(v) => setForm({ ...form, is_active: v })} trackColor={{ false: Brand.border, true: Brand.primary }} />
              </View>
              <Pressable style={[styles.saveBtn, saving && { opacity: 0.5 }]} disabled={saving} onPress={handleCreate}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Create'}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal visible={rateModalVisible} transparent animationType="fade" onRequestClose={() => setRateModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Update Rate — {rateCurrency?.currency_code}</Text>
                <Pressable onPress={() => setRateModalVisible(false)} hitSlop={12}>
                  <MaterialCommunityIcons name="close" size={24} color={Brand.textTertiary} />
                </Pressable>
              </View>
              <Text style={styles.fieldLabel}>New Rate to UGX</Text>
              <TextInput style={styles.input} value={newRate} onChangeText={setNewRate} placeholder="e.g. 3800" placeholderTextColor={Brand.textTertiary} keyboardType="numeric" />
              <Pressable style={[styles.saveBtn, saving && { opacity: 0.5 }]} disabled={saving} onPress={handleUpdateRate}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Update Rate'}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  body: { flex: 1 },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  symbolBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: Brand.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  symbolText: { fontSize: 18, fontWeight: '900', color: Brand.accent },
  currencyCode: { fontSize: 15, fontWeight: '800', color: Brand.text },
  currencyName: { fontSize: 12, color: Brand.textSecondary },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  rateLabel: { fontSize: 12, fontWeight: '600', color: Brand.textTertiary },
  rateValue: { fontSize: 16, fontWeight: '800', color: Brand.text },
  actionHint: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  actionHintText: { fontSize: 12, fontWeight: '600', color: Brand.primary },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  emptySub: { fontSize: 13, color: Brand.textTertiary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Brand.text },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: Brand.textSecondary, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: Brand.border, borderRadius: 10, padding: 12, fontSize: 14, color: Brand.text, marginBottom: 16 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  saveBtn: { backgroundColor: Brand.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});
