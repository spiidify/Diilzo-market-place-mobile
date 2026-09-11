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
  View,
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import { createShippingMethod, deleteShippingMethod, getShippingMethods, type ShippingMethod } from '@/services/seller';

export default function SellerShippingScreen() {
  const router = useRouter();
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [days, setDays] = useState('3');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRefreshing(true);
      const data = await getShippingMethods();
      setMethods(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!name.trim()) { Alert.alert('Validation', 'Name is required'); return; }
    if (!cost) { Alert.alert('Validation', 'Cost is required'); return; }
    setCreating(true);
    try {
      await createShippingMethod({
        name: name.trim(),
        cost: parseFloat(cost),
        estimated_days: parseInt(days) || 3,
        is_active: isActive,
      });
      setShowModal(false);
      setName(''); setCost(''); setDays('3'); setIsActive(true);
      load();
      Alert.alert('Success', 'Shipping method created');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (item: ShippingMethod) => {
    Alert.alert('Delete', `Delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await deleteShippingMethod(item.id); setMethods(prev => prev.filter(m => m.id !== item.id)); }
          catch { Alert.alert('Error', 'Failed to delete'); }
        }
      },
    ]);
  };

  const renderItem = ({ item }: { item: ShippingMethod }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.nameWrap}>
          <MaterialCommunityIcons name="truck-fast" size={20} color={Brand.primary} />
          <Text style={styles.name}>{item.name}</Text>
        </View>
        <Switch value={item.is_active} disabled trackColor={{ false: '#E0E0E0', true: Brand.primary + '40' }} thumbColor={item.is_active ? Brand.primary : '#BDBDBD'} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.metricCol}>
          <Text style={styles.metricValue}>UGX {Number(item.cost).toLocaleString()}</Text>
          <Text style={styles.metricLabel}>Cost</Text>
        </View>
        <View style={styles.metricCol}>
          <Text style={styles.metricValue}>{item.estimated_days} days</Text>
          <Text style={styles.metricLabel}>Est. Delivery</Text>
        </View>
      </View>
      <Pressable style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]} onPress={() => handleDelete(item)}>
        <MaterialCommunityIcons name="trash-can-outline" size={16} color={Brand.danger} />
        <Text style={styles.deleteText}>Delete</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.screen}>
      <ModernHeader
        title="Shipping"
        rightIcon="plus"
        onRightPress={() => setShowModal(true)}
      />

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
            data={methods}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="truck-outline" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No shipping methods</Text>
                <Text style={styles.emptySub}>Tap + to add one</Text>
              </View>
            }
          />
        )}

        <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Shipping Method</Text>
                <Pressable onPress={() => setShowModal(false)} hitSlop={12}><MaterialCommunityIcons name="close" size={24} color={Brand.textTertiary} /></Pressable>
              </View>
              <Text style={styles.formLabel}>Name *</Text>
              <TextInput style={styles.formInput} value={name} onChangeText={setName} placeholder="e.g. Standard Delivery" placeholderTextColor={Brand.textTertiary} />
              <Text style={styles.formLabel}>Cost (UGX) *</Text>
              <TextInput style={styles.formInput} value={cost} onChangeText={setCost} placeholder="e.g. 5000" keyboardType="numeric" placeholderTextColor={Brand.textTertiary} />
              <Text style={styles.formLabel}>Estimated Days</Text>
              <TextInput style={styles.formInput} value={days} onChangeText={setDays} placeholder="3" keyboardType="numeric" placeholderTextColor={Brand.textTertiary} />
              <View style={styles.switchRow}>
                <Text style={styles.formLabel}>Active</Text>
                <Switch value={isActive} onValueChange={setIsActive} trackColor={{ false: '#E0E0E0', true: Brand.primary + '40' }} thumbColor={isActive ? Brand.primary : '#BDBDBD'} />
              </View>
              <Pressable style={({ pressed }) => [styles.createBtn, (creating || pressed) && { opacity: 0.85 }]} onPress={handleCreate} disabled={creating}>
                {creating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.createBtnText}>Create</Text>}
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
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  listContent: { padding: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  nameWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 16, fontWeight: '800', color: Brand.text },
  cardBody: { flexDirection: 'row', gap: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Brand.borderLight },
  metricCol: { flex: 1 },
  metricValue: { fontSize: 14, fontWeight: '700', color: Brand.text },
  metricLabel: { fontSize: 10, color: Brand.textTertiary, marginTop: 2 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(220,38,38,0.08)' },
  deleteText: { fontSize: 13, fontWeight: '600', color: Brand.danger },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  emptySub: { fontSize: 13, color: Brand.textTertiary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Brand.text },
  formLabel: { fontSize: 13, fontWeight: '700', color: Brand.text, marginBottom: 6, marginTop: 12 },
  formInput: { borderWidth: 1.5, borderColor: Brand.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Brand.text },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  createBtn: { backgroundColor: Brand.primary, marginTop: 20, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  createBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});
