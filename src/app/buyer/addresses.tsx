import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/services/api';
import type { Address } from '@/types';

export default function BuyerAddressesScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [form, setForm] = useState({
    label: 'home', street: '', city: '', state: '', postal_code: '',
    country: 'Uganda', phone: '', is_default: false,
  });

  const load = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return; }
    try {
      const data = await apiRequest<{ results: Address[] } | Address[]>({ method: 'GET', url: '/auth/addresses/' });
      setAddresses(Array.isArray(data) ? data : data.results);
    } catch (e: any) {
      console.error('Addresses error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ label: 'home', street: '', city: '', state: '', postal_code: '', country: 'Uganda', phone: '', is_default: false });
    setShowForm(true);
  };

  const openEdit = (addr: Address) => {
    setEditing(addr);
    setForm({
      label: addr.label || 'home', street: addr.street || '', city: addr.city || '',
      state: addr.state || '', postal_code: addr.postal_code || '',
      country: addr.country || 'Uganda', phone: addr.phone || '', is_default: addr.is_default,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await apiRequest({ method: 'PATCH', url: `/auth/addresses/${editing.id}/`, data: form });
      } else {
        await apiRequest({ method: 'POST', url: '/auth/addresses/', data: form });
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      console.error('Save address error:', e?.message);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiRequest({ method: 'DELETE', url: `/auth/addresses/${id}/` });
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch (e: any) {
      console.error('Delete address error:', e?.message);
    }
  };

  const renderItem = ({ item }: { item: Address }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons
          name={item.label === 'home' ? 'home' : item.label === 'work' ? 'briefcase' : 'map-marker'}
          size={20} color={Brand.primary}
        />
        <Text style={styles.cardLabel}>{item.label}</Text>
        {item.is_default && <View style={styles.defaultBadge}><Text style={styles.defaultText}>Default</Text></View>}
      </View>
      <Text style={styles.cardText}>{item.street}</Text>
      <Text style={styles.cardText}>{item.city}, {item.state} {item.postal_code}</Text>
      <Text style={styles.cardText}>{item.country}</Text>
      {item.phone ? <Text style={styles.cardText}>Phone: {item.phone}</Text> : null}
      <View style={styles.cardActions}>
        <Pressable style={styles.editBtn} onPress={() => openEdit(item)}>
          <MaterialCommunityIcons name="pencil" size={16} color={Brand.primary} />
          <Text style={styles.editBtnText}>Edit</Text>
        </Pressable>
        <Pressable style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
          <MaterialCommunityIcons name="trash-can" size={16} color={Brand.danger} />
          <Text style={styles.deleteBtnText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient colors={[Brand.primaryDark, Brand.primary, Brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>My Addresses</Text>
          <Pressable hitSlop={12} onPress={openAdd}>
            <MaterialCommunityIcons name="plus" size={26} color="#FFFFFF" />
          </Pressable>
        </LinearGradient>

        {loading ? (
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
          </View>
        ) : addresses.length === 0 ? (
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="map-marker-outline" size={56} color={Brand.textTertiary} />
            <Text style={styles.title}>No saved addresses</Text>
            <Text style={styles.subtitle}>Add a delivery address for faster checkout</Text>
            <Pressable style={styles.addBtn} onPress={openAdd}>
              <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
              <Text style={styles.addBtnText}>Add Address</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={addresses}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[Brand.primary]} tintColor={Brand.primary} />}
          />
        )}

        {/* Add/Edit Modal */}
        <Modal visible={showForm} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editing ? 'Edit Address' : 'Add Address'}</Text>
                <Pressable onPress={() => setShowForm(false)} hitSlop={12}>
                  <MaterialCommunityIcons name="close" size={24} color={Brand.text} />
                </Pressable>
              </View>
              <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.fieldLabel}>Label</Text>
                <View style={styles.labelRow}>
                  {['home', 'work', 'other'].map((l) => (
                    <Pressable
                      key={l}
                      style={[styles.labelChip, form.label === l && styles.labelChipActive]}
                      onPress={() => setForm({ ...form, label: l })}
                    >
                      <Text style={[styles.labelChipText, form.label === l && styles.labelChipTextActive]}>{l}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.fieldLabel}>Street</Text>
                <TextInput style={styles.input} value={form.street} onChangeText={(v) => setForm({ ...form, street: v })} placeholder="Street address" />
                <Text style={styles.fieldLabel}>City</Text>
                <TextInput style={styles.input} value={form.city} onChangeText={(v) => setForm({ ...form, city: v })} placeholder="City" />
                <Text style={styles.fieldLabel}>State/Region</Text>
                <TextInput style={styles.input} value={form.state} onChangeText={(v) => setForm({ ...form, state: v })} placeholder="State" />
                <Text style={styles.fieldLabel}>Postal Code</Text>
                <TextInput style={styles.input} value={form.postal_code} onChangeText={(v) => setForm({ ...form, postal_code: v })} placeholder="Postal code" />
                <Text style={styles.fieldLabel}>Country</Text>
                <TextInput style={styles.input} value={form.country} onChangeText={(v) => setForm({ ...form, country: v })} placeholder="Country" />
                <Text style={styles.fieldLabel}>Phone</Text>
                <TextInput style={styles.input} value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} placeholder="Phone number" keyboardType="phone-pad" />
                <Pressable
                  style={[styles.defaultToggle, form.is_default && styles.defaultToggleActive]}
                  onPress={() => setForm({ ...form, is_default: !form.is_default })}
                >
                  <MaterialCommunityIcons name={form.is_default ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={form.is_default ? Brand.primary : Brand.textTertiary} />
                  <Text style={styles.defaultToggleText}>Set as default address</Text>
                </Pressable>
                <Pressable style={styles.saveBtn} onPress={handleSave}>
                  <Text style={styles.saveBtnText}>{editing ? 'Update' : 'Save'} Address</Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

import { ScrollView } from 'react-native';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  safeArea: { flex: 1, backgroundColor: Brand.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  title: { marginTop: 16, fontSize: 18, fontWeight: '700', color: Brand.text },
  subtitle: { marginTop: 8, fontSize: 14, color: Brand.textSecondary, textAlign: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, backgroundColor: Brand.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 },
  addBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  list: { padding: Spacing.two, gap: Spacing.two },
  card: { backgroundColor: Brand.surface, borderRadius: 12, padding: Spacing.three, gap: 4, borderWidth: 1, borderColor: Brand.borderLight },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardLabel: { fontSize: 15, fontWeight: '700', color: Brand.text, textTransform: 'capitalize', flex: 1 },
  defaultBadge: { backgroundColor: Brand.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  defaultText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  cardText: { fontSize: 13, color: Brand.textSecondary },
  cardActions: { flexDirection: 'row', gap: 16, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Brand.borderLight },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editBtnText: { color: Brand.primary, fontSize: 13, fontWeight: '600' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deleteBtnText: { color: Brand.danger, fontSize: 13, fontWeight: '600' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Brand.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', paddingBottom: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.three, borderBottomWidth: 1, borderBottomColor: Brand.borderLight },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Brand.text },
  formScroll: { padding: Spacing.three },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Brand.textSecondary, marginTop: 12, marginBottom: 4 },
  input: { backgroundColor: Brand.surfaceAlt, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Brand.text, borderWidth: 1, borderColor: Brand.border },
  labelRow: { flexDirection: 'row', gap: 8 },
  labelChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: Brand.surfaceAlt, borderWidth: 1, borderColor: Brand.border },
  labelChipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  labelChipText: { fontSize: 13, fontWeight: '600', color: Brand.textSecondary, textTransform: 'capitalize' },
  labelChipTextActive: { color: '#FFFFFF' },
  defaultToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  defaultToggleActive: {},
  defaultToggleText: { fontSize: 14, color: Brand.text },
  saveBtn: { backgroundColor: Brand.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
