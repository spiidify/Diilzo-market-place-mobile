import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/services/api';
import type { Address } from '@/types';

const LABELS: { key: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { key: 'home', icon: 'home' },
  { key: 'work', icon: 'briefcase' },
  { key: 'other', icon: 'map-marker' },
];

const EMPTY_FORM = {
  label: 'home',
  street: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'Uganda',
  phone: '',
  is_default: false,
};

export default function BuyerAddressesScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    try {
      const data = await apiRequest<{ results: Address[] } | Address[]>({
        method: 'GET',
        url: '/auth/addresses/',
      });
      setAddresses(Array.isArray(data) ? data : data.results);
    } catch (e: any) {
      console.error('Addresses error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  };

  const openEdit = (addr: Address) => {
    setEditing(addr);
    setForm({
      label: addr.label || 'home',
      street: addr.street || '',
      city: addr.city || '',
      state: addr.state || '',
      postal_code: addr.postal_code || '',
      country: addr.country || 'Uganda',
      phone: addr.phone || '',
      is_default: addr.is_default,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm({ ...EMPTY_FORM });
  };

  const handleSave = async () => {
    if (!form.street.trim() || !form.city.trim()) {
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await apiRequest({ method: 'PATCH', url: `/auth/addresses/${editing.id}/`, data: form });
      } else {
        await apiRequest({ method: 'POST', url: '/auth/addresses/', data: form });
      }
      closeForm();
      load();
    } catch (e: any) {
      console.error('Save address error:', e?.message);
    } finally {
      setSaving(false);
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

  const update = (key: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const renderItem = ({ item }: { item: Address }) => {
    const labelMeta = LABELS.find((l) => l.key === item.label) || LABELS[2];
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.cardIconWrap}>
            <MaterialCommunityIcons name={labelMeta.icon} size={20} color={Brand.primary} />
          </View>
          <View style={styles.cardInfo}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardLabel}>{item.label}</Text>
              {item.is_default ? (
                <View style={styles.defaultBadge}>
                  <Text style={styles.defaultText}>Default</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.cardStreet}>{item.street}</Text>
            <Text style={styles.cardCity}>
              {item.city}
              {item.state ? `, ${item.state}` : ''} {item.postal_code}
            </Text>
            <Text style={styles.cardCountry}>{item.country}</Text>
            {item.phone ? (
              <View style={styles.phoneRow}>
                <MaterialCommunityIcons name="phone-outline" size={13} color={Brand.textTertiary} />
                <Text style={styles.cardPhone}>{item.phone}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.cardActions}>
          <Pressable style={styles.actionBtn} onPress={() => openEdit(item)}>
            <MaterialCommunityIcons name="pencil-outline" size={16} color={Brand.primary} />
            <Text style={styles.actionEditText}>Edit</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => handleDelete(item.id)}>
            <MaterialCommunityIcons name="trash-can-outline" size={16} color={Brand.danger} />
            <Text style={styles.actionDeleteText}>Remove</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient
          colors={[Brand.primaryDark, Brand.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Addresses</Text>
          <Pressable hitSlop={12} onPress={openAdd} style={styles.headerBtn}>
            <MaterialCommunityIcons name="plus" size={26} color="#FFFFFF" />
          </Pressable>
        </LinearGradient>

        {loading ? (
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
          </View>
        ) : addresses.length === 0 ? (
          <View style={styles.centerBody}>
            <View style={styles.emptyIconWrap}>
              <MaterialCommunityIcons name="map-marker-plus-outline" size={48} color={Brand.primary} />
            </View>
            <Text style={styles.emptyTitle}>No saved addresses</Text>
            <Text style={styles.emptySubtitle}>Add a delivery address for faster checkout</Text>
            <Pressable style={styles.emptyAddBtn} onPress={openAdd}>
              <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
              <Text style={styles.emptyAddBtnText}>Add Address</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={addresses}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load();
                }}
                colors={[Brand.primary]}
                tintColor={Brand.primary}
              />
            }
          />
        )}

        {addresses.length > 0 && !loading ? (
          <Pressable style={styles.fab} onPress={openAdd}>
            <MaterialCommunityIcons name="plus" size={26} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </SafeAreaView>

      {/* Add/Edit Modal */}
      <Modal visible={showForm} animationType="slide" onRequestClose={closeForm}>
        <SafeAreaView edges={['top']} style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <Pressable onPress={closeForm} hitSlop={12} style={styles.closeBtn}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={Brand.text} />
            </Pressable>
            <Text style={styles.modalTitle}>{editing ? 'Edit Address' : 'New Address'}</Text>
            <View style={styles.headerSpacer} />
          </View>
          <KeyboardAvoidingView
            style={styles.formAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            enabled
          >
            <ScrollView
              style={styles.formScroll}
              contentContainerStyle={styles.formContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              <Text style={styles.sectionLabel}>Label</Text>
              <View style={styles.labelRow}>
                {LABELS.map((l) => {
                  const active = form.label === l.key;
                  return (
                    <Pressable
                      key={l.key}
                      style={[styles.labelChip, active && styles.labelChipActive]}
                      onPress={() => update('label', l.key)}
                    >
                      <MaterialCommunityIcons
                        name={l.icon}
                        size={16}
                        color={active ? '#FFFFFF' : Brand.textSecondary}
                      />
                      <Text style={[styles.labelChipText, active && styles.labelChipTextActive]}>
                        {l.key}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.sectionLabel}>Street Address</Text>
              <TextInput
                style={styles.input}
                value={form.street}
                onChangeText={(v) => update('street', v)}
                placeholder="e.g. Plot 12, Kampala Road"
                placeholderTextColor={Brand.textTertiary}
                returnKeyType="next"
              />

              <View style={styles.rowTwo}>
                <View style={styles.col}>
                  <Text style={styles.sectionLabel}>City</Text>
                  <TextInput
                    style={styles.input}
                    value={form.city}
                    onChangeText={(v) => update('city', v)}
                    placeholder="Kampala"
                    placeholderTextColor={Brand.textTertiary}
                    returnKeyType="next"
                  />
                </View>
                <View style={styles.col}>
                  <Text style={styles.sectionLabel}>Postal Code</Text>
                  <TextInput
                    style={styles.input}
                    value={form.postal_code}
                    onChangeText={(v) => update('postal_code', v)}
                    placeholder="00000"
                    placeholderTextColor={Brand.textTertiary}
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View style={styles.rowTwo}>
                <View style={styles.col}>
                  <Text style={styles.sectionLabel}>State / Region</Text>
                  <TextInput
                    style={styles.input}
                    value={form.state}
                    onChangeText={(v) => update('state', v)}
                    placeholder="Central"
                    placeholderTextColor={Brand.textTertiary}
                    returnKeyType="next"
                  />
                </View>
                <View style={styles.col}>
                  <Text style={styles.sectionLabel}>Country</Text>
                  <TextInput
                    style={styles.input}
                    value={form.country}
                    onChangeText={(v) => update('country', v)}
                    placeholder="Uganda"
                    placeholderTextColor={Brand.textTertiary}
                    returnKeyType="next"
                  />
                </View>
              </View>

              <Text style={styles.sectionLabel}>Phone</Text>
              <TextInput
                style={styles.input}
                value={form.phone}
                onChangeText={(v) => update('phone', v)}
                placeholder="+256 7XX XXX XXX"
                placeholderTextColor={Brand.textTertiary}
                keyboardType="phone-pad"
                returnKeyType="done"
              />

              <Pressable
                style={[styles.toggleRow, form.is_default && styles.toggleRowActive]}
                onPress={() => update('is_default', !form.is_default)}
              >
                <View style={styles.toggleTextWrap}>
                  <Text style={styles.toggleTitle}>Set as default</Text>
                  <Text style={styles.toggleSubtitle}>Use this address for new orders</Text>
                </View>
                <View style={[styles.togglePill, form.is_default && styles.togglePillActive]}>
                  <View style={[styles.toggleKnob, form.is_default && styles.toggleKnobActive]} />
                </View>
              </Pressable>

              <Pressable style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>{editing ? 'Update Address' : 'Save Address'}</Text>
                )}
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  safeArea: { flex: 1, backgroundColor: Brand.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Brand.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Brand.text },
  emptySubtitle: { marginTop: 6, fontSize: 14, color: Brand.textSecondary, textAlign: 'center' },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    backgroundColor: Brand.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyAddBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  list: { padding: 16, gap: 12, paddingBottom: 96 },
  card: {
    backgroundColor: Brand.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Brand.borderLight,
    gap: 12,
  },
  cardTop: { flexDirection: 'row', gap: 12 },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Brand.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1, gap: 2 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  cardLabel: { fontSize: 15, fontWeight: '700', color: Brand.text, textTransform: 'capitalize' },
  defaultBadge: {
    backgroundColor: Brand.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  defaultText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  cardStreet: { fontSize: 14, color: Brand.text },
  cardCity: { fontSize: 13, color: Brand.textSecondary },
  cardCountry: { fontSize: 13, color: Brand.textSecondary },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  cardPhone: { fontSize: 13, color: Brand.textTertiary },
  cardActions: {
    flexDirection: 'row',
    gap: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Brand.borderLight,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionEditText: { color: Brand.primary, fontSize: 13, fontWeight: '600' },
  actionDeleteText: { color: Brand.danger, fontSize: 13, fontWeight: '600' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  // Modal (full screen)
  modalSafeArea: { flex: 1, backgroundColor: Brand.surface },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Brand.borderLight,
    backgroundColor: Brand.surface,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: Brand.text },
  closeBtn: { padding: 4 },
  headerSpacer: { width: 24 },
  formAvoid: { flex: 1 },
  formScroll: { flex: 1 },
  formContent: { padding: 20, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.textSecondary,
    marginTop: 14,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: Brand.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Brand.text,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  labelRow: { flexDirection: 'row', gap: 8 },
  labelChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Brand.surfaceAlt,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  labelChipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  labelChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.textSecondary,
    textTransform: 'capitalize',
  },
  labelChipTextActive: { color: '#FFFFFF' },
  rowTwo: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Brand.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Brand.border,
  },
  toggleRowActive: {
    backgroundColor: Brand.primary + '12',
    borderColor: Brand.primary,
  },
  toggleTextWrap: { flex: 1, paddingRight: 12 },
  toggleTitle: { fontSize: 15, fontWeight: '700', color: Brand.text },
  toggleSubtitle: { fontSize: 12, color: Brand.textSecondary, marginTop: 2 },
  togglePill: {
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: Brand.border,
    padding: 3,
    justifyContent: 'center',
  },
  togglePillActive: { backgroundColor: Brand.primary },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  toggleKnobActive: { alignSelf: 'flex-end' },
  saveBtn: {
    backgroundColor: Brand.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
